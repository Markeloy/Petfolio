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
