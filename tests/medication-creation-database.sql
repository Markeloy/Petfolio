-- Isolated fixtures only. The forced error happens after the first schedule and all audit triggers.
BEGIN;
CREATE FUNCTION private.test_fail_second_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF new.scheduled_time='18:00'::time THEN RAISE EXCEPTION 'forced schedule failure' USING ERRCODE='P0099'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER test_fail_schedule BEFORE INSERT ON public.medication_schedules FOR EACH ROW EXECUTE FUNCTION private.test_fail_second_schedule();
DO $$
DECLARE u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); h uuid; other_h uuid; pet uuid; other_pet uuid;
 med uuid; med_count bigint; schedule_count bigint; audit_count bigint; bad_times text[]; bad_days integer[];
BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES(u,'{}'),(outsider,'{}');
 SELECT household_id INTO h FROM public.household_members WHERE user_id=u LIMIT 1;
 SELECT household_id INTO other_h FROM public.household_members WHERE user_id=outsider LIMIT 1;
 INSERT INTO public.pets(household_id,name,created_by) VALUES(h,'Atomic fixture',u) RETURNING id INTO pet;
 INSERT INTO public.pets(household_id,name,created_by) VALUES(other_h,'Other fixture',outsider) RETURNING id INTO other_pet;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 SELECT count(*) INTO med_count FROM public.medications;
 SELECT count(*) INTO schedule_count FROM public.medication_schedules;
 SELECT count(*) INTO audit_count FROM public.activity_log;
 BEGIN
  PERFORM public.create_medication_course(pet,'Atomic',1,'unit',null,current_date,null,null,'Europe/Moscow',ARRAY[1,2,3,4,5,6,7],ARRAY['09:00','18:00']);
  RAISE EXCEPTION 'Forced schedule failure was not reached';
 EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL; END;
 IF (SELECT count(*) FROM public.medications)<>med_count OR (SELECT count(*) FROM public.medication_schedules)<>schedule_count OR (SELECT count(*) FROM public.activity_log)<>audit_count THEN
  RAISE EXCEPTION 'Partial medication, schedule or audit write survived rollback';
 END IF;
 med:=public.create_medication_course(pet,'Atomic',1,'unit',null,current_date,null,null,'Europe/Moscow',ARRAY[1,2,3,4,5,6,7],ARRAY['09:00','19:00']);
 IF (SELECT count(*) FROM public.medication_schedules WHERE medication_id=med)<>2 OR
    NOT EXISTS(SELECT 1 FROM public.medications WHERE id=med AND created_by=u) OR
    EXISTS(SELECT 1 FROM public.medication_schedules WHERE medication_id=med AND created_by<>u) THEN RAISE EXCEPTION 'Atomic success or author failed'; END IF;
 BEGIN
  PERFORM public.create_medication_course(other_pet,'Forbidden',1,null,null,current_date,null,null,'UTC',ARRAY[1],ARRAY['09:00']);
  RAISE EXCEPTION 'Cross household course accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOREACH bad_times SLICE 1 IN ARRAY ARRAY[ARRAY['09:00','09:00','10:00','11:00'],ARRAY['09:00','10:00','11:00','12:00'],ARRAY['25:00','10:00','11:00','12:00']] LOOP
  BEGIN
   PERFORM public.create_medication_course(pet,'Invalid',1,null,null,current_date,null,null,'UTC',ARRAY[1],bad_times);
   RAISE EXCEPTION 'Invalid times accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN
  PERFORM public.create_medication_course(pet,'Invalid',1,null,null,current_date,null,null,'Invalid/Zone',ARRAY[1],ARRAY['09:00']);
  RAISE EXCEPTION 'Invalid timezone accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 FOREACH bad_days SLICE 1 IN ARRAY ARRAY[ARRAY[0,1],ARRAY[1,8],ARRAY[1,1]] LOOP
  BEGIN
   PERFORM public.create_medication_course(pet,'Invalid',1,null,null,current_date,null,null,'UTC',bad_days,ARRAY['09:00']);
   RAISE EXCEPTION 'Invalid days accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN
  PERFORM public.create_medication_course(pet,'Invalid','NaN'::numeric,null,null,current_date,null,null,'UTC',ARRAY[1],ARRAY['09:00']);
  RAISE EXCEPTION 'NaN dose accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: atomic course rollback after forced second schedule failure; author, isolation and validation' AS result;
