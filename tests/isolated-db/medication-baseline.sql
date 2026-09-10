-- Local baseline reconstructed from read-only live schema catalog, 2026-09-08.
-- Not a deployment migration. Contains no user data.
CREATE TYPE medication_status AS ENUM ('active','paused','completed','cancelled');
CREATE TYPE medication_schedule_type AS ENUM ('daily_time','interval','as_needed');
CREATE TYPE medication_dose_status AS ENUM ('given','skipped');
CREATE TABLE public.medications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL,
  name text NOT NULL,
  dose_amount numeric(10,3),
  dose_unit text,
  instructions text,
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  status medication_status NOT NULL DEFAULT 'active'::medication_status,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.medications TO authenticated;
CREATE TABLE public.medication_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id uuid NOT NULL,
  schedule_type medication_schedule_type NOT NULL DEFAULT 'daily_time'::medication_schedule_type,
  scheduled_time time without time zone,
  interval_hours integer,
  days_of_week smallint[] NOT NULL DEFAULT ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint, (7)::smallint],
  timezone text NOT NULL DEFAULT 'Europe/Moscow'::text,
  active_from date NOT NULL,
  active_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.medication_schedules TO authenticated;
CREATE TABLE public.medication_doses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id uuid NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  status medication_dose_status NOT NULL,
  administered_at timestamp with time zone,
  recorded_by uuid NOT NULL,
  dose_amount numeric(10,3),
  dose_unit text,
  notes text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.medication_doses TO authenticated;
ALTER TABLE public.medication_doses ADD CONSTRAINT medication_doses_schedule_id_scheduled_for_key UNIQUE(schedule_id,scheduled_for);
CREATE FUNCTION private.pet_household_id(p_pet uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT household_id FROM public.pets WHERE id=p_pet; $$;
CREATE OR REPLACE FUNCTION private.log_medication_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  household uuid;
  actor uuid;
begin
  household := private.pet_household_id(coalesce(new.pet_id, old.pet_id));
  actor := coalesce(new.created_by, old.created_by);

  if tg_op = 'INSERT' then
    insert into public.activity_log (household_id, pet_id, actor_id, action, entity_type, entity_id, details)
    values (
      household,
      new.pet_id,
      actor,
      'medication_created',
      'medication',
      new.id,
      jsonb_build_object('name', new.name, 'status', new.status)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.activity_log (household_id, pet_id, actor_id, action, entity_type, entity_id, details)
    values (
      household,
      new.pet_id,
      auth.uid(),
      'medication_updated',
      'medication',
      new.id,
      jsonb_build_object('name', new.name, 'status', new.status)
    );
    return new;
  end if;

  return coalesce(new, old);
end;
$function$
;
CREATE OR REPLACE FUNCTION private.log_medication_dose_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_pet uuid;
  target_household uuid;
begin
  select m.pet_id into target_pet
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id
  where s.id = new.schedule_id;

  target_household := private.pet_household_id(target_pet);

  insert into public.activity_log (household_id, pet_id, actor_id, action, entity_type, entity_id, details)
  values (
    target_household,
    target_pet,
    new.recorded_by,
    case when new.status = 'given' then 'medication_dose_given' else 'medication_dose_skipped' end,
    'medication_dose',
    new.id,
    jsonb_build_object(
      'schedule_id', new.schedule_id,
      'scheduled_for', new.scheduled_for,
      'administered_at', new.administered_at,
      'dose_amount', new.dose_amount,
      'dose_unit', new.dose_unit
    )
  );

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.log_schedule_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_pet uuid;
  household uuid;
  actor uuid;
begin
  select m.pet_id into target_pet
  from public.medications m
  where m.id = new.medication_id;

  household := private.pet_household_id(target_pet);
  actor := case when tg_op = 'INSERT' then new.created_by else auth.uid() end;

  insert into public.activity_log (household_id, pet_id, actor_id, action, entity_type, entity_id, details)
  values (
    household,
    target_pet,
    actor,
    case when tg_op = 'INSERT' then 'medication_schedule_created' else 'medication_schedule_updated' end,
    'medication_schedule',
    new.id,
    jsonb_build_object(
      'schedule_type', new.schedule_type,
      'scheduled_time', new.scheduled_time,
      'interval_hours', new.interval_hours,
      'is_active', new.is_active
    )
  );

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE POLICY medication_doses_insert_member ON public.medication_doses FOR INSERT TO authenticated  WITH CHECK (((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM ((medication_schedules s
     JOIN medications m ON ((m.id = s.medication_id)))
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((s.id = medication_doses.schedule_id) AND (s.is_active = true) AND (m.status = 'active'::medication_status) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))));
CREATE POLICY medication_doses_select_member ON public.medication_doses FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((medication_schedules s
     JOIN medications m ON ((m.id = s.medication_id)))
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((s.id = medication_doses.schedule_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))) ;
CREATE POLICY medication_schedules_delete_owner ON public.medication_schedules FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (medications m
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((m.id = medication_schedules.medication_id) AND ( SELECT private.is_household_owner(p.household_id) AS is_household_owner))))) ;
CREATE POLICY medication_schedules_insert_member ON public.medication_schedules FOR INSERT TO authenticated  WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (medications m
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((m.id = medication_schedules.medication_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))));
CREATE POLICY medication_schedules_select_member ON public.medication_schedules FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (medications m
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((m.id = medication_schedules.medication_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))) ;
CREATE POLICY medication_schedules_update_member ON public.medication_schedules FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (medications m
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((m.id = medication_schedules.medication_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (medications m
     JOIN pets p ON ((p.id = m.pet_id)))
  WHERE ((m.id = medication_schedules.medication_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member)))));
CREATE POLICY medications_delete_owner ON public.medications FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM pets p
  WHERE ((p.id = medications.pet_id) AND ( SELECT private.is_household_owner(p.household_id) AS is_household_owner))))) ;
CREATE POLICY medications_insert_member ON public.medications FOR INSERT TO authenticated  WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM pets p
  WHERE ((p.id = medications.pet_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))));
CREATE POLICY medications_select_member ON public.medications FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM pets p
  WHERE ((p.id = medications.pet_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))) ;
CREATE POLICY medications_update_member ON public.medications FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM pets p
  WHERE ((p.id = medications.pet_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM pets p
  WHERE ((p.id = medications.pet_id) AND ( SELECT private.is_household_member(p.household_id) AS is_household_member)))));
CREATE TRIGGER medications_set_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER medication_schedules_set_updated_at BEFORE UPDATE ON public.medication_schedules FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER medications_log_medication_change AFTER INSERT OR UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION private.log_medication_change();
CREATE TRIGGER medication_schedules_log_schedule_change AFTER INSERT OR UPDATE ON public.medication_schedules FOR EACH ROW EXECUTE FUNCTION private.log_schedule_change();
CREATE TRIGGER medication_doses_log_medication_dose_insert AFTER INSERT ON public.medication_doses FOR EACH ROW EXECUTE FUNCTION private.log_medication_dose_insert();
