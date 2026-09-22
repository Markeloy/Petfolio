-- Current function definition, applied to the existing Petfolio database.
-- Explicit constraint name avoids collision with RETURNS TABLE output names.
CREATE OR REPLACE FUNCTION public.record_medication_dose(p_schedule_id uuid, p_scheduled_for timestamp with time zone, p_status medication_dose_status, p_administered_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, schedule_id uuid, scheduled_for timestamp with time zone, status medication_dose_status, administered_at timestamp with time zone, recorded_by uuid, dose_amount numeric, dose_unit text, notes text, recorded_at timestamp with time zone, already_recorded boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  caller uuid;
  target_pet uuid;
  medication_amount numeric(10,3);
  medication_unit text;
  existing public.medication_doses%rowtype;
  inserted public.medication_doses%rowtype;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select m.pet_id, m.dose_amount, m.dose_unit
    into target_pet, medication_amount, medication_unit
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id
  where s.id = p_schedule_id
    and s.is_active = true
    and m.status = 'active';

  if target_pet is null then
    raise exception 'Active medication schedule not found' using errcode = 'P0002';
  end if;

  if p_status = 'given' and p_administered_at is null then
    p_administered_at := now();
  elsif p_status = 'skipped' then
    p_administered_at := null;
  end if;

  insert into public.medication_doses (
    schedule_id,
    scheduled_for,
    status,
    administered_at,
    recorded_by,
    dose_amount,
    dose_unit,
    notes
  ) values (
    p_schedule_id,
    p_scheduled_for,
    p_status,
    p_administered_at,
    caller,
    medication_amount,
    medication_unit,
    p_notes
  )
  on conflict on constraint medication_doses_schedule_id_scheduled_for_key do nothing
  returning * into inserted;

  if inserted.id is null then
    select * into existing
    from public.medication_doses d
    where d.schedule_id = p_schedule_id
      and d.scheduled_for = p_scheduled_for;

    return query
    select existing.id,
           existing.schedule_id,
           existing.scheduled_for,
           existing.status,
           existing.administered_at,
           existing.recorded_by,
           existing.dose_amount,
           existing.dose_unit,
           existing.notes,
           existing.recorded_at,
           true;
    return;
  end if;

  return query
  select inserted.id,
         inserted.schedule_id,
         inserted.scheduled_for,
         inserted.status,
         inserted.administered_at,
         inserted.recorded_by,
         inserted.dose_amount,
         inserted.dose_unit,
         inserted.notes,
         inserted.recorded_at,
         false;
end;
$function$
;
