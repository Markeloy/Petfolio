-- Calendar reads must retain completed-course history and enforce family isolation.
BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  household uuid; pet uuid; medication uuid; schedule uuid; event_id uuid;
  day date:=current_date; stamp timestamptz:=now();
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"display_name":"Calendar test"}'),(outsider,'{"display_name":"Calendar outsider"}');
  SELECT household_id INTO household FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(household,'Calendar pet',owner_id) RETURNING id INTO pet;
  INSERT INTO public.medications(pet_id,name,created_by) VALUES(pet,'Calendar medicine',owner_id) RETURNING id INTO medication;
  INSERT INTO public.medication_schedules(medication_id,scheduled_time,active_from,created_by) VALUES(medication,'12:00',day,owner_id) RETURNING id INTO schedule;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  PERFORM public.record_medication_dose(schedule,stamp,'given');
  UPDATE public.medications SET status='completed' WHERE id=medication;
  INSERT INTO public.health_events(pet_id,kind,title,event_on,status,next_due_on,created_by)
    VALUES(pet,'vaccination','Calendar event',day-1,'completed',day,owner_id) RETURNING id INTO event_id;
  IF (SELECT count(*) FROM public.medication_doses d JOIN public.medication_schedules s ON s.id=d.schedule_id JOIN public.medications m ON m.id=s.medication_id
      WHERE m.pet_id=pet AND d.scheduled_for>=stamp-interval '1 day' AND d.scheduled_for<stamp+interval '2 days')<>1 THEN
    RAISE EXCEPTION 'completed-course history missing';
  END IF;
  IF (SELECT count(*) FROM public.health_events WHERE pet_id=pet AND archived_at IS NULL AND (event_on=day OR (status='completed' AND next_due_on=day)))<>1 THEN
    RAISE EXCEPTION 'repeat not visible';
  END IF;
  UPDATE public.health_events SET archived_at=now() WHERE id=event_id;
  IF EXISTS(SELECT 1 FROM public.health_events WHERE id=event_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'archive visible'; END IF;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.pets WHERE id=pet)
    OR EXISTS(SELECT 1 FROM public.medications WHERE id=medication)
    OR EXISTS(SELECT 1 FROM public.medication_schedules WHERE id=schedule)
    OR EXISTS(SELECT 1 FROM public.medication_doses WHERE schedule_id=schedule)
    OR EXISTS(SELECT 1 FROM public.health_events WHERE id=event_id) THEN RAISE EXCEPTION 'calendar family isolation failed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: completed-course history, repeats, archive, family isolation; fixtures rolled back' AS result;
