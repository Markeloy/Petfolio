-- Run through tests/isolated-db/activity.mjs; do not run synthetic account fixtures in production.
BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); viewer_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  family uuid; pet uuid; entry uuid:=gen_random_uuid(); version timestamptz; values jsonb; bad jsonb; before_count integer;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Activity owner"}'),(member_id,'{"name":"Activity member"}'),(viewer_id,'{"name":"Activity viewer"}'),(outsider,'{"name":"Activity outsider"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,member_id,'member'),(family,viewer_id,'viewer');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(family,'Activity test pet',owner_id) RETURNING id INTO pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  values:=jsonb_build_object('kind','walk','title','Morning walk','status','planned','started_at',now()+interval '1 day','duration_minutes',30,'distance_km',2.125,'notes','Test');
  PERFORM public.activity_action('create',pet,entry,values);
  PERFORM public.activity_action('create',pet,entry,values);
  IF (SELECT count(*) FROM public.pet_activities WHERE id=entry)<>1 OR (SELECT count(*) FROM public.activity_log WHERE entity_id=entry AND action='activity_create')<>1 THEN RAISE EXCEPTION 'duplicate creation'; END IF;
  FOR bad IN SELECT value FROM jsonb_array_elements('[{"duration_minutes":0},{"duration_minutes":1441},{"distance_km":-1},{"distance_km":1001},{"distance_km":"NaN"},{"distance_km":1.0001},{"kind":"bad"},{"status":"bad"},{"started_at":"infinity"},{"status":"completed"}]') LOOP
    BEGIN
      PERFORM public.activity_action('create',pet,gen_random_uuid(),values||bad);
      RAISE EXCEPTION 'invalid activity accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  END LOOP;
  BEGIN
    PERFORM public.activity_action('create',pet,gen_random_uuid(),values||jsonb_build_object('status','completed','started_at',now()-interval '5 minutes','duration_minutes',10));
    RAISE EXCEPTION 'unfinished activity accepted as completed' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.pet_activities WHERE id=entry;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  values:=values||jsonb_build_object('status','completed','started_at',now()-interval '1 hour','version',version);
  PERFORM public.activity_action('edit',pet,entry,values);
  IF (SELECT status FROM public.pet_activities WHERE id=entry)<>'completed' OR (SELECT editor_name FROM public.pet_activities WHERE id=entry)<>'Activity member' OR (SELECT author_name FROM public.pet_activities WHERE id=entry)<>'Activity owner' THEN RAISE EXCEPTION 'completion/author failed'; END IF;
  BEGIN
    PERFORM public.activity_action('edit',pet,entry,values||'{"title":"Stale edit"}');
    RAISE EXCEPTION 'stale edit accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.pet_activities WHERE id=entry;
  PERFORM public.activity_action('archive',pet,entry,jsonb_build_object('version',version));
  IF EXISTS(SELECT 1 FROM public.pet_activities WHERE id=entry AND status='completed' AND archived_at IS NULL) THEN RAISE EXCEPTION 'archive included in totals'; END IF;
  SELECT updated_at INTO version FROM public.pet_activities WHERE id=entry;
  PERFORM public.activity_action('restore',pet,entry,jsonb_build_object('version',version));
  IF NOT EXISTS(SELECT 1 FROM public.pet_activities WHERE id=entry AND status='completed' AND archived_at IS NULL) THEN RAISE EXCEPTION 'restore failed'; END IF;
  BEGIN
    UPDATE public.pet_activities SET duration_minutes=99 WHERE id=entry;
    RAISE EXCEPTION 'direct write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',viewer_id::text,true);
  IF NOT EXISTS(SELECT 1 FROM public.pet_activities WHERE id=entry) THEN RAISE EXCEPTION 'viewer read failed'; END IF;
  BEGIN
    PERFORM public.activity_action('create',pet,gen_random_uuid(),values);
    RAISE EXCEPTION 'viewer write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.pet_activities WHERE id=entry) THEN RAISE EXCEPTION 'foreign activity visible'; END IF;
  BEGIN
    PERFORM public.activity_action('create',pet,gen_random_uuid(),values);
    RAISE EXCEPTION 'foreign write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.family_action('remove',family,p_target=>member_id);
  IF (SELECT editor_name FROM public.pet_activities WHERE id=entry)<>'Activity member' THEN RAISE EXCEPTION 'historical editor lost'; END IF;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF EXISTS(SELECT 1 FROM public.pet_activities WHERE id=entry) THEN RAISE EXCEPTION 'removed member retains access'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: plans/completion, date/duration/distance, idempotence, stale edits, archive/totals, family roles and audit; all fixtures rolled back' AS result;
