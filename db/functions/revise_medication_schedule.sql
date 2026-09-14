-- Version a daily schedule without changing its historical timezone or doses.
CREATE OR REPLACE FUNCTION public.revise_medication_schedule(
  p_schedule_id uuid, p_expected_updated_at timestamptz,
  p_effective_on date, p_time time, p_days smallint[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  s public.medication_schedules%rowtype;
  m public.medications%rowtype;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.medication_schedules WHERE id=p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO m FROM public.medications WHERE id=s.medication_id;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.pets WHERE id=m.pet_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Medication unavailable' USING ERRCODE='42501';
  END IF;
  IF p_expected_updated_at IS NULL OR s.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Schedule changed; reload' USING ERRCODE='40001';
  END IF;
  IF NOT s.is_active OR s.schedule_type <> 'daily_time' THEN
    RAISE EXCEPTION 'Only active daily schedules can be revised' USING ERRCODE='22023';
  END IF;
  IF p_effective_on IS NULL OR p_effective_on <= (now() AT TIME ZONE s.timezone)::date
    OR p_effective_on < s.active_from OR p_effective_on < m.starts_on
    OR (s.active_until IS NOT NULL AND p_effective_on > s.active_until)
    OR (m.ends_on IS NOT NULL AND p_effective_on > m.ends_on)
    OR p_time IS NULL OR p_time >= time '24:00'
    OR coalesce(cardinality(p_days),0)=0 OR NOT(p_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
    OR array_position(p_days,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid schedule values or effective date' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.medication_doses d WHERE d.schedule_id=s.id
    AND (d.scheduled_for AT TIME ZONE s.timezone)::date >= p_effective_on) THEN
    RAISE EXCEPTION 'Future doses already recorded' USING ERRCODE='22023';
  END IF;
  -- Avoid a second identical reminder from a different overlapping schedule.
  IF EXISTS (SELECT 1 FROM public.medication_schedules other
    WHERE other.medication_id=s.medication_id AND other.id<>s.id AND other.is_active
      AND other.schedule_type='daily_time' AND other.timezone=s.timezone
      AND other.scheduled_time=p_time AND other.days_of_week && p_days
      AND (other.active_until IS NULL OR other.active_until>=p_effective_on)
      AND (s.active_until IS NULL OR other.active_from<=s.active_until)) THEN
    RAISE EXCEPTION 'Overlapping schedule already exists' USING ERRCODE='22023';
  END IF;
  IF p_effective_on=s.active_from THEN
    UPDATE public.medication_schedules SET is_active=false WHERE id=s.id;
  ELSE
    UPDATE public.medication_schedules SET active_until=p_effective_on-1 WHERE id=s.id;
  END IF;
  INSERT INTO public.medication_schedules(medication_id,schedule_type,scheduled_time,days_of_week,
    timezone,active_from,active_until,created_by)
  VALUES(s.medication_id,'daily_time',p_time,p_days,s.timezone,p_effective_on,s.active_until,auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.revise_medication_schedule(uuid,timestamptz,date,time,smallint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revise_medication_schedule(uuid,timestamptz,date,time,smallint[]) TO authenticated;
