CREATE OR REPLACE FUNCTION public.create_medication_course(p_pet_id uuid, p_name text, p_dose_amount numeric, p_dose_unit text, p_instructions text, p_starts_on date, p_ends_on date, p_notes text, p_timezone text, p_days_of_week integer[], p_times text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  medication_id uuid;
  normalized_days smallint[];
  normalized_times text[];
  scheduled text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.pets p
    where p.id=p_pet_id and p.archived_at is null and private.is_household_member(p.household_id, actor)
  ) then
    raise exception 'Pet unavailable' using errcode='42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Invalid medication name' using errcode='22023';
  end if;
  if p_dose_amount is not null and (p_dose_amount <= 0 or p_dose_amount::text in ('NaN','Infinity','-Infinity') or p_dose_amount >= 10000000 or round(p_dose_amount,3) <> p_dose_amount) then
    raise exception 'Invalid dose' using errcode='22023';
  end if;
  if p_starts_on is null or not isfinite(p_starts_on) or (p_ends_on is not null and (not isfinite(p_ends_on) or p_ends_on < p_starts_on)) then
    raise exception 'Invalid course dates' using errcode='22023';
  end if;
  if length(coalesce(p_dose_unit,'')) > 80 or length(coalesce(p_instructions,'')) > 5000 or length(coalesce(p_notes,'')) > 5000 then
    raise exception 'Invalid medication text length' using errcode='22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception 'Invalid timezone' using errcode='22023';
  end if;

  select array_agg(distinct d order by d)::smallint[] into normalized_days
  from unnest(coalesce(p_days_of_week, array[]::integer[])) d
  where d between 1 and 7;
  if normalized_days is null or cardinality(normalized_days)=0
     or cardinality(normalized_days) <> cardinality(coalesce(p_days_of_week,array[]::integer[])) then
    raise exception 'Invalid schedule days' using errcode='22023';
  end if;

  select array_agg(distinct btrim(t) order by btrim(t)) into normalized_times
  from unnest(coalesce(p_times,array[]::text[])) t
  where btrim(t) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  if normalized_times is null or cardinality(normalized_times) not between 1 and 3
     or cardinality(normalized_times) <> cardinality(coalesce(p_times,array[]::text[])) then
    raise exception 'Invalid schedule times' using errcode='22023';
  end if;

  insert into public.medications(
    pet_id,name,dose_amount,dose_unit,instructions,starts_on,ends_on,notes,created_by
  ) values (
    p_pet_id,btrim(p_name),p_dose_amount,nullif(btrim(p_dose_unit),''),nullif(btrim(p_instructions),''),
    p_starts_on,p_ends_on,nullif(btrim(p_notes),''),actor
  ) returning id into medication_id;

  foreach scheduled in array normalized_times loop
    insert into public.medication_schedules(
      medication_id,scheduled_time,days_of_week,timezone,active_from,active_until,created_by
    ) values (
      medication_id,scheduled::time,normalized_days,p_timezone,p_starts_on,p_ends_on,actor
    );
  end loop;

  return medication_id;
end;
$function$
;
REVOKE ALL ON FUNCTION public.create_medication_course(uuid,text,numeric,text,text,date,date,text,text,integer[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_medication_course(uuid,text,numeric,text,text,date,date,text,text,integer[],text[]) TO authenticated;
