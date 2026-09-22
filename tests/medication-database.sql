-- Run only in the isolated database harness. Never create production test users.
BEGIN;
DO $$
DECLARE
  u uuid := gen_random_uuid(); member_id uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  h uuid; other_h uuid; pet uuid; other_pet uuid; med uuid; other_med uuid; sched uuid; other_sched uuid;
  stamp timestamptz := (((now() AT TIME ZONE 'Europe/Moscow')::date)+'12:00'::time) AT TIME ZONE 'Europe/Moscow'; first_mark record; second_mark record; skip_mark record; skip_sched uuid;
BEGIN
  INSERT INTO auth.users(id, raw_user_meta_data) VALUES
    (u, '{"display_name":"Rollback owner"}'), (member_id, '{"display_name":"Rollback member"}'), (outsider, '{"display_name":"Rollback outsider"}');
  SELECT household_id INTO h FROM public.household_members WHERE user_id=u LIMIT 1;
  SELECT household_id INTO other_h FROM public.household_members WHERE user_id=outsider LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(h,member_id,'member');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(h,'Rollback pet',u) RETURNING id INTO pet;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(other_h,'Rollback other pet',outsider) RETURNING id INTO other_pet;
  INSERT INTO public.medications(pet_id,name,dose_amount,dose_unit,created_by) VALUES(pet,'Rollback medication',1,'мл',u) RETURNING id INTO med;
  INSERT INTO public.medications(pet_id,name,created_by) VALUES(other_pet,'Rollback other medication',outsider) RETURNING id INTO other_med;
  INSERT INTO public.medication_schedules(medication_id,scheduled_time,active_from,created_by) VALUES(med,'12:00',current_date,u) RETURNING id INTO sched;
  INSERT INTO public.medication_schedules(medication_id,scheduled_time,active_from,created_by) VALUES(med,'13:00',current_date,u) RETURNING id INTO skip_sched;
  INSERT INTO public.medication_schedules(medication_id,scheduled_time,active_from,created_by) VALUES(other_med,'12:00',current_date,outsider) RETURNING id INTO other_sched;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('role','authenticated',true);
  SELECT * INTO first_mark FROM public.record_medication_dose(sched,stamp,'given');
  IF first_mark.id IS NULL OR first_mark.already_recorded OR first_mark.recorded_by<>u OR first_mark.administered_at IS NULL OR first_mark.dose_amount<>1 THEN RAISE EXCEPTION 'given/author/snapshot failed'; END IF;
  SELECT * INTO second_mark FROM public.record_medication_dose(sched,stamp,'skipped');
  IF NOT second_mark.already_recorded OR first_mark.id<>second_mark.id OR second_mark.status<>'given' THEN RAISE EXCEPTION 'duplicate overwrote original'; END IF;
  SELECT * INTO skip_mark FROM public.record_medication_dose(skip_sched,stamp+interval '1 hour','skipped');
  IF skip_mark.administered_at IS NOT NULL OR skip_mark.status<>'skipped' THEN RAISE EXCEPTION 'skipped timestamp failed'; END IF;
  IF (SELECT count(*) FROM public.medication_doses WHERE schedule_id=sched AND scheduled_for=stamp)<>1 THEN RAISE EXCEPTION 'duplicate row'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_log WHERE entity_id=first_mark.id AND actor_id=u) THEN RAISE EXCEPTION 'audit failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.pets WHERE id=other_pet) THEN RAISE EXCEPTION 'other household pet visible'; END IF;
  BEGIN
    PERFORM public.record_medication_dose(other_sched,stamp,'given');
    RAISE EXCEPTION 'cross household RPC accepted';
  EXCEPTION WHEN no_data_found OR insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.medications(pet_id,name,created_by) VALUES(other_pet,'Forbidden',u);
    RAISE EXCEPTION 'cross household medication accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.medication_doses(schedule_id,scheduled_for,status,administered_at,recorded_by) VALUES(sched,stamp+interval '2 minutes','given',now(),member_id);
    RAISE EXCEPTION 'forged author accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  SELECT * INTO second_mark FROM public.record_medication_dose(sched,stamp,'given');
  IF NOT second_mark.already_recorded OR second_mark.recorded_by<>u THEN RAISE EXCEPTION 'family duplicate/author failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=u) THEN RAISE EXCEPTION 'family author not readable'; END IF;
  BEGIN
    PERFORM public.record_medication_dose(sched,stamp+interval '1 minute','given');
    RAISE EXCEPTION 'arbitrary time accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.record_medication_dose(sched,stamp+interval '1 day','given');
    RAISE EXCEPTION 'future day accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.record_medication_dose(sched,stamp,'given',now()+interval '1 day');
    RAISE EXCEPTION 'future administration accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: given, skipped, duplicate, family, audit, household isolation, forged author; fixtures rolled back' AS result;
