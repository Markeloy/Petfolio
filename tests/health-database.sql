BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  h uuid; pet uuid; other_h uuid; other_pet uuid; event_id uuid:=gen_random_uuid(); weight_id uuid:=gen_random_uuid();
  version timestamptz; rows_changed integer; kind_value text;
  follow_id uuid:=gen_random_uuid(); failed_id uuid:=gen_random_uuid(); repeated uuid;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"display_name":"Health owner"}'),(member_id,'{"display_name":"Health member"}'),(outsider,'{"display_name":"Health outsider"}');
  SELECT household_id INTO h FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  SELECT household_id INTO other_h FROM public.household_members WHERE user_id=outsider LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(h,member_id,'member');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(h,'Health test pet',owner_id) RETURNING id INTO pet;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(other_h,'Other test pet',outsider) RETURNING id INTO other_pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  INSERT INTO public.health_events(id,pet_id,kind,title,event_on,status,created_by)
    VALUES(event_id,pet,'vaccination','Vaccine',current_date,'completed',owner_id) RETURNING updated_at INTO version;
  FOREACH kind_value IN ARRAY ARRAY['parasite','visit','symptom','other'] LOOP
    INSERT INTO public.health_events(pet_id,kind,title,event_on,status,created_by) VALUES(pet,kind_value,'Test',current_date+7,'planned',owner_id);
  END LOOP;
  BEGIN
    INSERT INTO public.health_events(id,pet_id,kind,title,event_on,status,created_by) VALUES(event_id,pet,'vaccination','Duplicate',current_date,'completed',owner_id);
    RAISE EXCEPTION 'duplicate accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF (SELECT count(*) FROM public.health_events WHERE id=event_id)<>1 THEN RAISE EXCEPTION 'duplicate row'; END IF;
  BEGIN
    INSERT INTO public.health_events(pet_id,kind,title,event_on,status,created_by) VALUES(pet,'other','Forged',current_date,'completed',member_id);
    RAISE EXCEPTION 'forged author accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.health_events(pet_id,kind,title,event_on,status,created_by) VALUES(pet,'visit','Future done',current_date+5,'completed',owner_id);
    RAISE EXCEPTION 'future done accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    INSERT INTO public.health_events(pet_id,kind,title,event_on,next_due_on,status,created_by) VALUES(pet,'visit','Invalid repeat',current_date,current_date-1,'completed',owner_id);
    RAISE EXCEPTION 'invalid next date accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  UPDATE public.health_events SET notes='Member edit',updated_by=owner_id WHERE id=event_id AND updated_at=version;
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed<>1 OR (SELECT updated_by FROM public.health_events WHERE id=event_id)<>member_id THEN RAISE EXCEPTION 'member actor update failed'; END IF;
  UPDATE public.health_events SET notes='Stale' WHERE id=event_id AND updated_at=version;
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed<>0 THEN RAISE EXCEPTION 'lost update protection failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.activity_log WHERE entity_id=event_id AND actor_id=member_id AND action='updated' AND details->'after'->>'notes'='Member edit') THEN RAISE EXCEPTION 'audit missing'; END IF;
  BEGIN
    UPDATE public.health_events SET created_by=member_id WHERE id=event_id;
    RAISE EXCEPTION 'author reassigned';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.health_events SET archived_at=now() WHERE id=event_id;
  IF EXISTS(SELECT 1 FROM public.health_events WHERE id=event_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'archive failed'; END IF;
  UPDATE public.health_events SET archived_at=null WHERE id=event_id;
  IF NOT EXISTS(SELECT 1 FROM public.health_events WHERE id=event_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'restore failed'; END IF;
  INSERT INTO public.weight_records(id,pet_id,weight_kg,measured_at,created_by) VALUES(weight_id,pet,4.125,now()-interval '1 minute',member_id) RETURNING updated_at INTO version;
  UPDATE public.weight_records SET weight_kg=4.2 WHERE id=weight_id AND updated_at=version;
  IF NOT EXISTS(SELECT 1 FROM public.activity_log WHERE entity_id=weight_id AND action='updated' AND details->'before'->>'weight_kg' IS NOT NULL) THEN RAISE EXCEPTION 'weight audit failed'; END IF;
  UPDATE public.weight_records SET weight_kg=8 WHERE id=weight_id AND updated_at=version;
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed<>0 THEN RAISE EXCEPTION 'stale weight accepted'; END IF;
  UPDATE public.weight_records SET archived_at=now() WHERE id=weight_id;
  IF EXISTS(SELECT 1 FROM public.weight_records WHERE pet_id=pet AND archived_at IS NULL) THEN RAISE EXCEPTION 'archived weight remains active'; END IF;
  UPDATE public.weight_records SET archived_at=null WHERE id=weight_id;
  BEGIN
    INSERT INTO public.weight_records(pet_id,weight_kg,measured_at,created_by) VALUES(pet,5,now()+interval '1 day',member_id);
    RAISE EXCEPTION 'future weight accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    UPDATE public.weight_records SET pet_id=other_pet WHERE id=weight_id;
    RAISE EXCEPTION 'weight moved to other household';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.health_events SET next_due_on=current_date+30 WHERE id=event_id RETURNING updated_at INTO version;
  PERFORM public.record_health_followup(event_id,version,follow_id,jsonb_build_object('kind','vaccination','title','Repeat vaccine','event_on',current_date+30,'status','planned'));
  IF (SELECT next_due_on FROM public.health_events WHERE id=event_id) IS NOT NULL OR (SELECT event_on FROM public.health_events WHERE id=event_id)<>current_date THEN RAISE EXCEPTION 'followup damaged original'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.health_events WHERE id=follow_id AND status='planned' AND created_by=member_id) THEN RAISE EXCEPTION 'followup missing'; END IF;
  repeated:=public.record_health_followup(event_id,version,follow_id,jsonb_build_object('kind','vaccination','title','Repeat vaccine','event_on',current_date+30,'status','planned'));
  IF repeated<>follow_id THEN RAISE EXCEPTION 'followup not idempotent'; END IF;
  BEGIN
    PERFORM public.record_health_followup(event_id,version,gen_random_uuid(),jsonb_build_object('kind','vaccination','title','Stale repeat','event_on',current_date+30,'status','planned'));
    RAISE EXCEPTION 'two followups accepted from same version';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  UPDATE public.health_events SET next_due_on=current_date+10 WHERE id=event_id RETURNING updated_at INTO version;
  BEGIN
    PERFORM public.record_health_followup(event_id,version,failed_id,jsonb_build_object('kind','vaccination','title','Invalid repeat','event_on',current_date+10,'status','completed'));
    RAISE EXCEPTION 'invalid followup accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.health_events WHERE id=failed_id) OR (SELECT next_due_on FROM public.health_events WHERE id=event_id) IS NULL THEN RAISE EXCEPTION 'failed followup partially saved'; END IF;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.health_events WHERE pet_id=pet) OR EXISTS(SELECT 1 FROM public.weight_records WHERE pet_id=pet) OR EXISTS(SELECT 1 FROM public.activity_log WHERE pet_id=pet) THEN RAISE EXCEPTION 'cross-family read'; END IF;
  UPDATE public.health_events SET title='Forbidden' WHERE id=event_id;
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed<>0 THEN RAISE EXCEPTION 'cross-family edit'; END IF;
  BEGIN
    INSERT INTO public.health_events(pet_id,kind,title,event_on,status,created_by) VALUES(pet,'other','Forbidden',current_date,'planned',outsider);
    RAISE EXCEPTION 'cross-family insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: categories, duplicates, dates, family, authors, audit, stale edits, archive, weights, atomic followups and isolation; fixtures rolled back' AS result;
