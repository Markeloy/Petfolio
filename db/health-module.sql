-- Additive migration for the existing Petfolio database.
CREATE TABLE public.health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('vaccination','parasite','visit','symptom','other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  event_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('planned','completed','cancelled')),
  next_due_on date CHECK (next_due_on >= event_on),
  product text CHECK (length(product)<=300),
  clinic text CHECK (length(clinic)<=300),
  veterinarian text CHECK (length(veterinarian)<=300),
  notes text CHECK (length(notes)<=5000),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);
CREATE INDEX health_events_pet_date_idx ON public.health_events(pet_id,event_on DESC,id);
CREATE INDEX health_events_created_by_idx ON public.health_events(created_by);
CREATE INDEX health_events_updated_by_idx ON public.health_events(updated_by);
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.health_events TO authenticated;
REVOKE ALL ON public.health_events FROM anon;
CREATE POLICY health_events_select_member ON public.health_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND private.is_household_member(p.household_id)));
CREATE POLICY health_events_insert_member ON public.health_events FOR INSERT TO authenticated
  WITH CHECK (created_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.archived_at IS NULL AND private.is_household_member(p.household_id)));
CREATE POLICY health_events_update_member ON public.health_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.archived_at IS NULL AND private.is_household_member(p.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.archived_at IS NULL AND private.is_household_member(p.household_id)));

ALTER TABLE public.weight_records ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.weight_records ADD COLUMN updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.weight_records ADD COLUMN archived_at timestamptz;
CREATE INDEX weight_records_updated_by_idx ON public.weight_records(updated_by);

-- The trigger is private and checks membership itself before writing the audit.
-- Privilege is needed only for the append-only activity_log, which clients cannot write.
CREATE FUNCTION private.guard_health_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); household uuid; tz text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT p.household_id INTO household FROM public.pets p WHERE p.id=NEW.pet_id AND p.archived_at IS NULL;
  IF household IS NULL OR NOT private.is_household_member(household) THEN
    RAISE EXCEPTION 'Pet unavailable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Invalid author' USING ERRCODE='42501'; END IF;
    NEW.created_at:=clock_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.pet_id IS DISTINCT FROM OLD.pet_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Identity fields are immutable' USING ERRCODE='42501';
    END IF;
  END IF;
  NEW.updated_by:=actor;
  NEW.updated_at:=clock_timestamp();
  SELECT timezone INTO tz FROM public.profiles WHERE id=actor;
  IF TG_TABLE_NAME='health_events' THEN
    IF NEW.status='completed' AND NEW.event_on>(now() AT TIME ZONE coalesce(tz,'UTC'))::date THEN
      RAISE EXCEPTION 'Completed event cannot be in the future' USING ERRCODE='22023';
    END IF;
  ELSIF TG_TABLE_NAME='weight_records' THEN
    IF NEW.measured_at>now() OR NEW.weight_kg<=0 OR NEW.weight_kg::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid measurement' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION private.audit_health_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE household uuid; action_name text;
BEGIN
  SELECT household_id INTO household FROM public.pets WHERE id=NEW.pet_id;
  IF auth.uid() IS NULL OR NOT private.is_household_member(household) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  action_name:=CASE WHEN TG_OP='INSERT' THEN 'created'
    WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archived'
    WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restored' ELSE 'updated' END;
  INSERT INTO public.activity_log(household_id,pet_id,actor_id,action,entity_type,entity_id,details)
    VALUES(household,NEW.pet_id,auth.uid(),action_name,TG_TABLE_NAME,NEW.id,
      jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,'after',to_jsonb(NEW)));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_health_write() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.audit_health_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER health_events_guard BEFORE INSERT OR UPDATE ON public.health_events FOR EACH ROW EXECUTE FUNCTION private.guard_health_write();
CREATE TRIGGER health_events_audit AFTER INSERT OR UPDATE ON public.health_events FOR EACH ROW EXECUTE FUNCTION private.audit_health_write();
CREATE TRIGGER weight_records_guard BEFORE INSERT OR UPDATE ON public.weight_records FOR EACH ROW EXECUTE FUNCTION private.guard_health_write();
CREATE TRIGGER weight_records_audit AFTER INSERT OR UPDATE ON public.weight_records FOR EACH ROW EXECUTE FUNCTION private.audit_health_write();
