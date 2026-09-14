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


-- Owner and membership are verified by this invoker function and existing RLS.
CREATE OR REPLACE FUNCTION public.create_pet_with_weight(p_household_id uuid,p_values jsonb,p_weight numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); pet public.pets; pet_id uuid; k text;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=p_household_id AND user_id=actor AND role IN ('owner','member')) THEN
  RAISE EXCEPTION 'Household unavailable' USING ERRCODE='42501';
 END IF;
 IF p_values IS NULL OR jsonb_typeof(p_values)<>'object' THEN RAISE EXCEPTION 'Invalid pet values' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_values) LOOP
  IF k NOT IN ('name','species','sex','birth_date','breed','color','microchip_number','passport_number','vet_clinic','veterinarian','notes') THEN RAISE EXCEPTION 'Invalid pet field' USING ERRCODE='22023'; END IF;
 END LOOP;
 pet:=jsonb_populate_record(null::public.pets,p_values);
 IF pet.name IS NULL OR length(btrim(pet.name)) NOT BETWEEN 1 AND 100 OR pet.species IS NULL OR pet.sex IS NULL
 OR (pet.birth_date IS NOT NULL AND (NOT isfinite(pet.birth_date) OR pet.birth_date>(now() AT TIME ZONE coalesce((SELECT timezone FROM public.profiles WHERE id=actor),'UTC'))::date))
 THEN RAISE EXCEPTION 'Invalid pet profile' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_values) LOOP
  IF length(p_values->>k)>(CASE WHEN k='notes' THEN 5000 ELSE 300 END) THEN RAISE EXCEPTION 'Pet field too long' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_weight IS NOT NULL AND (p_weight::text IN ('NaN','Infinity','-Infinity') OR p_weight<0.001 OR p_weight>5000 OR round(p_weight,3)<>p_weight) THEN
  RAISE EXCEPTION 'Invalid weight' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.pets(household_id,created_by,name,species,sex,birth_date,breed,color,microchip_number,passport_number,vet_clinic,veterinarian,notes)
 VALUES(p_household_id,actor,btrim(pet.name),pet.species,pet.sex,pet.birth_date,pet.breed,pet.color,pet.microchip_number,pet.passport_number,pet.vet_clinic,pet.veterinarian,pet.notes) RETURNING id INTO pet_id;
 IF p_weight IS NOT NULL THEN INSERT INTO public.weight_records(pet_id,weight_kg,measured_at,created_by) VALUES(pet_id,p_weight,now(),actor); END IF;
 RETURN pet_id;
END $$;
REVOKE ALL ON FUNCTION public.create_pet_with_weight(uuid,jsonb,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_pet_with_weight(uuid,jsonb,numeric) TO authenticated;


-- Private, privacy-minimized ingestion. No client-supplied user_id.
CREATE TABLE IF NOT EXISTS private.analytics_events (
 event_id uuid PRIMARY KEY,event_name text NOT NULL,occurred_at timestamptz NOT NULL,
 user_id uuid,anonymous_id uuid,household_id uuid,pet_id uuid,surface text NOT NULL,
 app_version text NOT NULL,environment text NOT NULL,session_id uuid,source text NOT NULL,
 analytics_schema_version integer NOT NULL DEFAULT 1,properties jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.analytics_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.track_analytics_event(p_event_id uuid, p_event_name text, p_occurred_at timestamp with time zone, p_anonymous_id uuid DEFAULT NULL::uuid, p_household_id uuid DEFAULT NULL::uuid, p_pet_id uuid DEFAULT NULL::uuid, p_surface text DEFAULT 'pwa'::text, p_app_version text DEFAULT '0.1.0'::text, p_environment text DEFAULT 'production'::text, p_session_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'direct'::text, p_properties jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  resolved_household uuid := p_household_id;
  pet_household uuid;
  allowed_events constant text[] := array[
    'landing_viewed','signup_started','signup_completed','login_completed',
    'pet_creation_started','pet_created','pet_profile_updated','weight_recorded',
    'medication_created','medication_detail_viewed','dose_action_started','dose_recorded','dose_record_failed','medication_history_viewed',
    'reminder_created','notification_permission_prompted','notification_permission_result','reminder_delivery_attempted','reminder_delivered','reminder_opened','reminder_completed','reminder_snoozed','reminder_disabled',
    'health_event_created','vaccination_recorded','parasite_treatment_recorded','vet_visit_recorded',
    'calendar_viewed','calendar_item_opened',
    'family_invite_started','family_invite_sent','family_invite_accepted',
    'premium_trigger_reached','paywall_viewed','trial_started','subscription_started','subscription_renewed','subscription_cancelled','subscription_expired',
    'critical_action_failed','app_error_seen'
  ];
  rules jsonb := '{"app_error_seen":{"error_code":["page_load_failed"]},"critical_action_failed":{"error_code":["medication_access_denied","medication_create_failed","medication_creation_failed","pet_create_failed","weight_write_failed","medication_create_rls"],"failure_class":["validation","rls","network","storage","server","unknown"]},"dose_action_started":{"action":["given","skipped"]},"dose_record_failed":{"error_code":["dose_access_denied","dose_write_failed","dose_network_failed"],"failure_class":["validation","rls","network","storage","server","unknown"]},"dose_recorded":{"already_recorded":"boolean","schedule_type":["daily_time","interval","as_needed"],"status":["given","skipped"]},"health_event_created":{"event_type":["vaccination","parasite","visit","symptom","weight","other"],"status":["planned","completed","cancelled"]},"landing_viewed":{},"login_completed":{"auth_method":["password"]},"medication_created":{"has_end_date":"boolean","schedule_count":[1,2,3],"schedule_type":["daily_time","interval","as_needed"]},"medication_detail_viewed":{"medication_status":["active","paused","completed","cancelled"]},"medication_history_viewed":{"history_count_bucket":["0","1-2","3-9","10-29","30+"]},"parasite_treatment_recorded":{"has_next_due_date":"boolean"},"pet_created":{"is_first_pet":"boolean","species":["dog","cat","bird","rodent","reptile","other"]},"pet_creation_started":{"entry_point":["onboarding","home"]},"pet_profile_updated":{"fields_changed_count":"count"},"signup_completed":{"auth_method":["password"]},"signup_started":{},"vaccination_recorded":{"has_next_due_date":"boolean"},"vet_visit_recorded":{"has_follow_up_date":"boolean"},"weight_recorded":{"is_first_weight":"boolean"}}'::jsonb -> p_event_name;
  rule jsonb;
  property_key text;
  confirmed_at timestamptz;
begin
  if p_event_id is null or p_event_name is null or not (p_event_name = any(allowed_events)) then
    raise exception 'Unsupported analytics event' using errcode='22023';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' or p_occurred_at < now() - interval '30 days' then
    raise exception 'Invalid analytics timestamp' using errcode='22023';
  end if;
  if p_surface is null or p_environment is null or p_source is null or p_surface not in ('pwa','android_rustore','web_desktop')
     or p_environment not in ('production','staging','development')
     or p_source not in ('direct','telegram','vk','referral','rustore','organic','other') then
    raise exception 'Invalid analytics context' using errcode='22023';
  end if;
  if p_app_version is null or p_app_version !~ '^[0-9]{1,5}[.][0-9]{1,5}[.][0-9]{1,5}$' then
    raise exception 'Invalid app version' using errcode='22023';
  end if;
  if p_properties is null or jsonb_typeof(p_properties) <> 'object' or pg_column_size(p_properties) > 4096 then
    raise exception 'Invalid analytics properties' using errcode='22023';
  end if;
  if rules is null then
    raise exception 'Event reserved but not instrumented' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_properties)) <> (select count(*) from jsonb_object_keys(rules)) then
    raise exception 'Invalid analytics property set' using errcode='22023';
  end if;
  for property_key,rule in select key,value from jsonb_each(rules) loop
    if not p_properties ? property_key then raise exception 'Missing analytics property' using errcode='22023'; end if;
    if jsonb_typeof(rule) = 'array' then
      if not rule @> jsonb_build_array(p_properties->property_key) then raise exception 'Invalid analytics category' using errcode='22023'; end if;
    elsif rule = '"boolean"'::jsonb then
      if jsonb_typeof(p_properties->property_key) <> 'boolean' then raise exception 'Invalid analytics boolean' using errcode='22023'; end if;
    elsif rule = '"count"'::jsonb then
      if jsonb_typeof(p_properties->property_key) <> 'number' or (p_properties->>property_key) !~ '^(0|[1-9][0-9]?|100)$' then raise exception 'Invalid analytics count' using errcode='22023'; end if;
    end if;
  end loop;

  if actor is null then
    if p_event_name not in ('landing_viewed','signup_started','app_error_seen') then
      raise exception 'Authentication required for this analytics event' using errcode='42501';
    end if;
    if p_household_id is not null or p_pet_id is not null then
      raise exception 'Anonymous analytics cannot reference household data' using errcode='42501';
    end if;
    resolved_household := null;
  else
    if p_pet_id is not null then
      select household_id into pet_household from public.pets where id=p_pet_id and archived_at is null;
      if pet_household is null or not private.is_household_member(pet_household, actor) then
        raise exception 'Pet unavailable' using errcode='42501';
      end if;
      if resolved_household is not null and resolved_household <> pet_household then
        raise exception 'Household mismatch' using errcode='42501';
      end if;
      resolved_household := pet_household;
    elsif resolved_household is not null and not private.is_household_member(resolved_household, actor) then
      raise exception 'Household unavailable' using errcode='42501';
    end if;
  end if;

  -- Completion is tied to the verified Auth identity, not a client-supplied ID or clock.
  if p_event_name='signup_completed' then
    select email_confirmed_at into confirmed_at from auth.users where id=actor;
    if confirmed_at is null then raise exception 'Signup not confirmed' using errcode='42501'; end if;
    p_event_id := md5('petfolio:signup_completed:' || actor::text)::uuid;
    p_occurred_at := confirmed_at;
  end if;

  insert into private.analytics_events(
    event_id,event_name,occurred_at,user_id,anonymous_id,household_id,pet_id,
    surface,app_version,environment,session_id,source,analytics_schema_version,properties
  ) values (
    p_event_id,p_event_name,p_occurred_at,actor,p_anonymous_id,resolved_household,p_pet_id,
    p_surface,p_app_version,p_environment,p_session_id,p_source,1,p_properties
  ) on conflict (event_id) do nothing;

  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.track_analytics_event(p_event_id uuid, p_event_name text, p_occurred_at timestamp with time zone, p_anonymous_id uuid DEFAULT NULL::uuid, p_household_id uuid DEFAULT NULL::uuid, p_pet_id uuid DEFAULT NULL::uuid, p_surface text DEFAULT 'pwa'::text, p_app_version text DEFAULT '0.1.0'::text, p_environment text DEFAULT 'production'::text, p_session_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'direct'::text, p_properties jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.track_analytics_event(
    p_event_id,p_event_name,p_occurred_at,p_anonymous_id,p_household_id,p_pet_id,
    p_surface,p_app_version,p_environment,p_session_id,p_source,p_properties
  );
$function$
;
REVOKE ALL ON FUNCTION private.track_analytics_event(uuid,text,timestamptz,uuid,uuid,uuid,text,text,text,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_analytics_event(uuid,text,timestamptz,uuid,uuid,uuid,text,text,text,uuid,text,jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.track_analytics_event(uuid,text,timestamptz,uuid,uuid,uuid,text,text,text,uuid,text,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.track_analytics_event(uuid,text,timestamptz,uuid,uuid,uuid,text,text,text,uuid,text,jsonb) TO anon,authenticated;
