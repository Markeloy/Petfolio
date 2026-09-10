BEGIN;
DO $$
DECLARE
  u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); member_user uuid:=gen_random_uuid();
  h uuid; pet uuid; med uuid; sched uuid; replacement uuid; v timestamptz; changed timestamptz;
  effective date:=(now() AT TIME ZONE 'Europe/Moscow')::date+2;
  dose record; count_rows integer;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES
    (u,'{"display_name":"Edit test"}'),(other_user,'{"display_name":"Edit outsider"}'),(member_user,'{"display_name":"Edit member"}');
  SELECT household_id INTO h FROM public.household_members WHERE user_id=u LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(h,member_user,'member');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(h,'Edit test',u) RETURNING id INTO pet;
  INSERT INTO public.medications(pet_id,name,dose_amount,dose_unit,starts_on,created_by)
    VALUES(pet,'Edit course',1,'мл',effective-2,u) RETURNING id INTO med;
  INSERT INTO public.medication_schedules(medication_id,scheduled_time,active_from,timezone,created_by)
    VALUES(med,'08:00',effective-2,'Europe/Moscow',u) RETURNING id,updated_at INTO sched,v;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('role','authenticated',true);
  SELECT * INTO dose FROM public.record_medication_dose(sched,((effective-2)+'08:00'::time) AT TIME ZONE 'Europe/Moscow','given');
  SELECT updated_at INTO changed FROM public.medications WHERE id=med;
  UPDATE public.medications SET name='Edited course',dose_amount=2 WHERE id=med AND updated_at=changed;
  GET DIAGNOSTICS count_rows=ROW_COUNT;
  IF count_rows<>1 THEN RAISE EXCEPTION 'metadata update failed'; END IF;
  IF (SELECT dose_amount FROM public.medication_doses WHERE id=dose.id)<>1 THEN RAISE EXCEPTION 'historical dose overwritten'; END IF;
  PERFORM set_config('request.jwt.claim.sub',member_user::text,true);
  replacement:=public.revise_medication_schedule(sched,v,effective,'09:00',ARRAY[1,4]::smallint[]);
  IF (SELECT active_until FROM public.medication_schedules WHERE id=sched)<>effective-1 THEN RAISE EXCEPTION 'old schedule not ended'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.medication_schedules WHERE id=replacement AND active_from=effective AND scheduled_time='09:00' AND days_of_week=ARRAY[1,4]::smallint[] AND created_by=member_user) THEN RAISE EXCEPTION 'new schedule incorrect'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.medication_doses WHERE id=dose.id AND schedule_id=sched AND recorded_by=u AND dose_amount=1) THEN RAISE EXCEPTION 'history changed'; END IF;
  BEGIN
    PERFORM public.revise_medication_schedule(replacement,'2000-01-01',effective+1,'10:00',ARRAY[1]::smallint[]);
    RAISE EXCEPTION 'stale update accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  SELECT updated_at INTO v FROM public.medication_schedules WHERE id=replacement;
  BEGIN
    PERFORM public.revise_medication_schedule(replacement,v,effective-2,'10:00',ARRAY[1]::smallint[]);
    RAISE EXCEPTION 'past change accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.revise_medication_schedule(replacement,v,effective+1,'10:00',ARRAY[]::smallint[]);
    RAISE EXCEPTION 'empty weekdays accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT count(*) FROM public.medication_schedules WHERE medication_id=med)<>2 THEN RAISE EXCEPTION 'failed edits left partial writes'; END IF;
  PERFORM set_config('request.jwt.claim.sub',other_user::text,true);
  BEGIN
    PERFORM public.revise_medication_schedule(replacement,v,effective+1,'10:00',ARRAY[1]::smallint[]);
    RAISE EXCEPTION 'outsider edit accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.medications SET name='Forbidden' WHERE id=med;
  GET DIAGNOSTICS count_rows=ROW_COUNT;
  IF count_rows<>0 THEN RAISE EXCEPTION 'outsider metadata update accepted'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: metadata, dose snapshots, versioned schedule, member, stale/past/invalid edits, isolation; rolled back' AS result;
