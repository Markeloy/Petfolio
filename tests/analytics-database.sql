BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); h uuid; oh uuid; pet uuid; op uuid; eid uuid:=gen_random_uuid(); payload jsonb;
BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES(u,'{}'),(outsider,'{}');
 SELECT household_id INTO h FROM public.household_members WHERE user_id=u LIMIT 1;
 SELECT household_id INTO oh FROM public.household_members WHERE user_id=outsider LIMIT 1;
 INSERT INTO public.pets(household_id,name,created_by) VALUES(h,'Fixture',u) RETURNING id INTO pet;
 INSERT INTO public.pets(household_id,name,created_by) VALUES(oh,'Other',outsider) RETURNING id INTO op;
 UPDATE auth.users SET email_confirmed_at=now()-interval '1 hour' WHERE id=u;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 PERFORM public.track_analytics_event(eid,'dose_recorded',now(),p_pet_id=>pet,p_environment=>'development',p_properties=>'{"status":"given","already_recorded":false,"schedule_type":"daily_time"}');
 PERFORM public.track_analytics_event(eid,'dose_recorded',now(),p_pet_id=>pet,p_environment=>'development',p_properties=>'{"status":"skipped","already_recorded":true,"schedule_type":"daily_time"}');
 BEGIN
  PERFORM public.track_analytics_event(gen_random_uuid(),'weight_recorded',now(),p_pet_id=>op,p_properties=>'{"is_first_weight":true}');
  RAISE EXCEPTION 'Foreign pet analytics accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOREACH payload IN ARRAY ARRAY['{"status":"private medical text","already_recorded":false,"schedule_type":"daily_time"}'::jsonb,'{"status":"given","already_recorded":"false","schedule_type":"daily_time"}'::jsonb,'{"status":"given","already_recorded":false,"schedule_type":"daily_time","notes":"private"}'::jsonb] LOOP
  BEGIN
   PERFORM public.track_analytics_event(gen_random_uuid(),'dose_recorded',now(),p_properties=>payload);
   RAISE EXCEPTION 'Sensitive or malformed payload accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN
  PERFORM public.track_analytics_event(gen_random_uuid(),'landing_viewed',now(),p_properties=>'{"utm_campaign":"person@example.com"}');
  RAISE EXCEPTION 'Raw acquisition text accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM 1 FROM private.analytics_events;
  RAISE EXCEPTION 'Private events readable by authenticated client';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.track_analytics_event(gen_random_uuid(),'signup_completed',now(),p_properties=>'{"auth_method":"password"}');
 PERFORM public.track_analytics_event(gen_random_uuid(),'signup_completed',now(),p_properties=>'{"auth_method":"password"}');
 PERFORM set_config('role','none',true);
 IF (SELECT count(*) FROM private.analytics_events WHERE event_name='signup_completed' AND user_id=u)<>1 THEN RAISE EXCEPTION 'Signup milestone duplicated'; END IF;
 IF (SELECT count(*) FROM private.analytics_events WHERE event_id=eid)<>1 THEN RAISE EXCEPTION 'Event deduplication failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.analytics_events WHERE event_id=eid AND user_id=u AND household_id=h AND properties->>'status'='given' AND analytics_schema_version=1) THEN RAISE EXCEPTION 'Actor/context/version derived incorrectly'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('role','anon',true);
 PERFORM public.track_analytics_event(gen_random_uuid(),'landing_viewed',now());
 BEGIN
  PERFORM public.track_analytics_event(gen_random_uuid(),'signup_completed',now(),p_properties=>'{"auth_method":"password"}');
  RAISE EXCEPTION 'Anonymous completed signup accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: analytics category privacy, deduplication, auth identity, private access and household isolation' AS result;
