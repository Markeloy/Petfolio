-- Apply the same daily occurrence rules to RPC and direct Data API inserts.
CREATE OR REPLACE FUNCTION private.guard_medication_dose() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=auth.uid(); s public.medication_schedules%ROWTYPE; m public.medications%ROWTYPE;
  family uuid; day date; wall timestamp; expected timestamptz;
BEGIN
  IF actor IS NULL OR NEW.recorded_by IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Invalid author' USING ERRCODE='42501';
  END IF;
  SELECT p.household_id INTO family FROM public.medication_schedules sc
    JOIN public.medications med ON med.id=sc.medication_id JOIN public.pets p ON p.id=med.pet_id
    WHERE sc.id=NEW.schedule_id AND p.archived_at IS NULL;
  PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
  IF family IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=actor AND role IN ('owner','member')) THEN
    RAISE EXCEPTION 'Medication unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.medication_schedules WHERE id=NEW.schedule_id;
  SELECT * INTO m FROM public.medications WHERE id=s.medication_id;
  day:=(now() AT TIME ZONE s.timezone)::date;
  IF NOT s.is_active OR m.status<>'active' OR s.schedule_type<>'daily_time'
    OR day<s.active_from OR day<m.starts_on
    OR day>s.active_until OR day>m.ends_on
    OR NOT(extract(isodow FROM day)::smallint=ANY(s.days_of_week)) THEN
    RAISE EXCEPTION 'No active occurrence today' USING ERRCODE='22023';
  END IF;
  wall:=day+s.scheduled_time;
  -- Sample the offsets around this local day, then keep only exact round trips.
  -- A DST gap has no match; a repeated wall time always uses the first instant.
  SELECT min(candidate) INTO expected FROM (
    SELECT (wall-((sample AT TIME ZONE s.timezone)-(sample AT TIME ZONE 'UTC'))) AT TIME ZONE 'UTC' AS candidate
    FROM generate_series((wall AT TIME ZONE 'UTC')-interval '36 hours',(wall AT TIME ZONE 'UTC')+interval '36 hours',interval '1 hour') sample
  ) candidates WHERE candidate AT TIME ZONE s.timezone=wall;
  IF expected IS NULL OR NEW.scheduled_for IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Invalid scheduled occurrence' USING ERRCODE='22023';
  END IF;
  IF NEW.status='given' THEN
    NEW.administered_at:=coalesce(NEW.administered_at,now());
    IF NEW.administered_at>now() THEN RAISE EXCEPTION 'Administration cannot be in the future' USING ERRCODE='22023'; END IF;
  ELSE NEW.administered_at:=NULL;
  END IF;
  NEW.dose_amount:=m.dose_amount; NEW.dose_unit:=m.dose_unit; NEW.recorded_at:=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_medication_dose() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER medication_doses_guard BEFORE INSERT ON public.medication_doses FOR EACH ROW EXECUTE FUNCTION private.guard_medication_dose();
