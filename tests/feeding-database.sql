BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  family uuid; other_family uuid; pet uuid; other_pet uuid; stock uuid:=gen_random_uuid(); plan uuid:=gen_random_uuid();
  skip_plan uuid:=gen_random_uuid(); poor_plan uuid:=gen_random_uuid(); revision uuid:=gen_random_uuid(); unlinked uuid:=gen_random_uuid();
  mark_id uuid:=gen_random_uuid(); result uuid; day date; zone text; stamp timestamptz; version timestamptz; params jsonb; mark_values jsonb;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Feeding owner"}'),(member_id,'{"name":"Feeding member"}'),(outsider,'{"name":"Feeding outsider"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  SELECT household_id INTO other_family FROM public.household_members WHERE user_id=outsider LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,member_id,'member');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(family,'Feeding pet',owner_id) RETURNING id INTO pet;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(other_family,'Other pet',outsider) RETURNING id INTO other_pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  PERFORM public.stock_action('create',family,stock,gen_random_uuid(),'{"name":"Food","category":"food","unit":"г","quantity":200,"threshold":50}');
  params:=jsonb_build_object('food','Food','amount',50,'unit','г','time','08:00','stock_id',stock);
  PERFORM public.feeding_action('create',pet,plan,gen_random_uuid(),params);
  PERFORM public.feeding_action('create',pet,plan,gen_random_uuid(),params);
  IF (SELECT count(*) FROM public.feeding_plans WHERE id=plan)<>1 THEN RAISE EXCEPTION 'duplicate plan'; END IF;
  SELECT timezone,updated_at INTO zone,version FROM public.feeding_plans WHERE id=plan;
  day:=(now() AT TIME ZONE zone)::date; stamp:=(day+'08:00'::time) AT TIME ZONE zone;
  mark_values:=jsonb_build_object('day',day,'instant',stamp,'status','fed');
  PERFORM public.feeding_action('mark',pet,plan,mark_id,mark_values);
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  result:=public.feeding_action('mark',pet,plan,gen_random_uuid(),mark_values||'{"status":"skipped"}');
  IF result<>mark_id OR (SELECT quantity FROM public.stock_items WHERE id=stock)<>150
    OR (SELECT count(*) FROM public.feeding_logs WHERE plan_id=plan)<>1
    OR (SELECT status FROM public.feeding_logs WHERE plan_id=plan)<>'fed' THEN RAISE EXCEPTION 'double feeding or stock deduction'; END IF;
  IF (SELECT actor_name FROM public.feeding_logs WHERE id=mark_id)<>'Feeding owner' THEN RAISE EXCEPTION 'actor snapshot lost'; END IF;
  PERFORM public.feeding_action('create',pet,skip_plan,gen_random_uuid(),params);
  PERFORM public.feeding_action('mark',pet,skip_plan,gen_random_uuid(),mark_values||'{"status":"skipped"}');
  IF (SELECT quantity FROM public.stock_items WHERE id=stock)<>150 THEN RAISE EXCEPTION 'skip deducted stock'; END IF;
  PERFORM public.feeding_action('create',pet,poor_plan,gen_random_uuid(),params||'{"amount":200}');
  BEGIN
    PERFORM public.feeding_action('mark',pet,poor_plan,gen_random_uuid(),mark_values);
    RAISE EXCEPTION 'insufficient stock accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.feeding_logs WHERE plan_id=poor_plan) OR (SELECT quantity FROM public.stock_items WHERE id=stock)<>150 THEN RAISE EXCEPTION 'partial transaction persisted'; END IF;
  BEGIN
    PERFORM public.feeding_action('create',pet,gen_random_uuid(),gen_random_uuid(),params||'{"unit":"кг"}');
    RAISE EXCEPTION 'unit mismatch accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    PERFORM public.feeding_action('mark',pet,poor_plan,gen_random_uuid(),mark_values||jsonb_build_object('day',day+1,'instant',stamp+interval '1 day'));
    RAISE EXCEPTION 'future mark accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    PERFORM public.feeding_action('mark',pet,poor_plan,gen_random_uuid(),mark_values||jsonb_build_object('instant',stamp+interval '1 minute'));
    RAISE EXCEPTION 'wrong time accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  result:=public.feeding_action('revise',pet,plan,revision,params||jsonb_build_object('amount',25,'time','09:00','version',version));
  IF result<>revision OR (SELECT active_from FROM public.feeding_plans WHERE id=revision)<>day+1 OR (SELECT active_until FROM public.feeding_plans WHERE id=plan)<>day
    OR (SELECT amount FROM public.feeding_logs WHERE id=mark_id)<>50 THEN RAISE EXCEPTION 'revision changed history/today'; END IF;
  PERFORM public.feeding_action('revise',pet,plan,revision,params||jsonb_build_object('amount',25,'time','09:00','version',version));
  BEGIN
    PERFORM public.feeding_action('revise',pet,plan,gen_random_uuid(),params||jsonb_build_object('version',version));
    RAISE EXCEPTION 'stale revision accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  PERFORM public.feeding_action('create',pet,unlinked,gen_random_uuid(),params||'{"stock_id":""}');
  SELECT updated_at INTO version FROM public.feeding_plans WHERE id=unlinked;
  PERFORM public.feeding_action('archive',pet,unlinked,gen_random_uuid(),jsonb_build_object('version',version));
  BEGIN
    PERFORM public.feeding_action('mark',pet,unlinked,gen_random_uuid(),mark_values);
    RAISE EXCEPTION 'archived mark accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.feeding_plans WHERE id=unlinked;
  PERFORM public.feeding_action('restore',pet,unlinked,gen_random_uuid(),jsonb_build_object('version',version));
  PERFORM public.feeding_action('mark',pet,unlinked,gen_random_uuid(),mark_values);
  IF (SELECT quantity FROM public.stock_items WHERE id=stock)<>150 THEN RAISE EXCEPTION 'unlinked plan deducted stock'; END IF;
  BEGIN
    UPDATE public.feeding_logs SET status='skipped' WHERE id=mark_id;
    RAISE EXCEPTION 'direct history alteration allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.feeding_plans WHERE id=plan) OR EXISTS(SELECT 1 FROM public.feeding_logs WHERE id=mark_id) THEN RAISE EXCEPTION 'foreign feeding visible'; END IF;
  BEGIN
    PERFORM public.feeding_action('mark',pet,poor_plan,gen_random_uuid(),mark_values);
    RAISE EXCEPTION 'foreign feeding mark allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.feeding_action('create',other_pet,gen_random_uuid(),gen_random_uuid(),params);
    RAISE EXCEPTION 'foreign stock link allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: feeding, family duplicate, stock atomicity, skip, unit validation, time/date, versioning, archive, history and isolation; fixtures rolled back' AS result;
