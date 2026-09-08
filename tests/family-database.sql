BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
  family uuid; pet uuid; result jsonb; code text; used_code text; revoke_code text; expired_code text; invite_id uuid; n integer;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Family owner"}'),(member_id,'{"name":"Family member"}'),(stranger,'{"name":"Family stranger"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(family,'Family pet',owner_id) RETURNING id INTO pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  result:=public.family_action('create',family); code:=result->>'code'; used_code:=code;
  IF length(code)<>48 THEN RAISE EXCEPTION 'invalid generated code'; END IF;
  IF jsonb_array_length(public.family_action('invites',family))<>1 THEN RAISE EXCEPTION 'owner invite list failed'; END IF;
  BEGIN
    PERFORM public.family_action('leave',family);
    RAISE EXCEPTION 'last owner leave accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    DELETE FROM public.household_members WHERE household_id=family;
    RAISE EXCEPTION 'direct membership delete allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF EXISTS(SELECT 1 FROM public.pets WHERE id=pet) THEN RAISE EXCEPTION 'pet visible before joining'; END IF;
  result:=public.family_action('join',p_token=>code);
  IF result->>'household_id'<>family::text OR NOT EXISTS(SELECT 1 FROM public.pets WHERE id=pet) THEN RAISE EXCEPTION 'join access failed'; END IF;
  IF (SELECT role FROM public.household_members WHERE household_id=family AND user_id=member_id)<>'member' THEN RAISE EXCEPTION 'incorrect role'; END IF;
  PERFORM public.family_action('join',p_token=>code);
  IF (SELECT count(*) FROM public.household_members WHERE household_id=family AND user_id=member_id)<>1 THEN RAISE EXCEPTION 'duplicate membership'; END IF;
  BEGIN
    PERFORM public.family_action('create',family);
    RAISE EXCEPTION 'member invited without owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.household_members SET role='owner' WHERE household_id=family AND user_id=member_id;
    RAISE EXCEPTION 'member self promoted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF public.family_action('invites',family)<>'[]'::jsonb THEN RAISE EXCEPTION 'member sees invites'; END IF;
  PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
  BEGIN
    PERFORM public.family_action('join',p_token=>code);
    RAISE EXCEPTION 'used code accepted for stranger' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  result:=public.family_action('create',family); revoke_code:=result->>'code';
  result:=public.family_action('invites',family); invite_id:=(result->0->>'id')::uuid;
  -- Timestamps may tie in a transaction, so locate the newly created invitation as administrator.
  PERFORM set_config('role','postgres',true);
  SELECT id INTO invite_id FROM private.family_invites WHERE token_hash=encode(extensions.digest(revoke_code,'sha256'),'hex');
  PERFORM set_config('role','authenticated',true);
  PERFORM public.family_action('revoke',family,p_target=>invite_id);
  result:=public.family_action('create',family); expired_code:=result->>'code';
  PERFORM set_config('role','postgres',true);
  UPDATE private.family_invites SET expires_at=now()-interval '1 minute' WHERE token_hash=encode(extensions.digest(expired_code,'sha256'),'hex');
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
  FOREACH code IN ARRAY ARRAY[revoke_code,expired_code,repeat('0',48)] LOOP
    BEGIN
      PERFORM public.family_action('join',p_token=>code);
      RAISE EXCEPTION 'invalid invite accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.family_action('remove',family,p_target=>member_id);
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF EXISTS(SELECT 1 FROM public.pets WHERE id=pet) THEN RAISE EXCEPTION 'removed member retains access'; END IF;
  BEGIN
    PERFORM public.family_action('join',p_token=>used_code);
    RAISE EXCEPTION 'old used code rejoined after removal' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  result:=public.family_action('create',family); code:=result->>'code';
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  PERFORM public.family_action('join',p_token=>code);
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.family_action('transfer',family,p_target=>member_id);
  IF (SELECT role FROM public.household_members WHERE household_id=family AND user_id=owner_id)<>'member' THEN RAISE EXCEPTION 'former owner not demoted'; END IF;
  PERFORM public.family_action('leave',family);
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF (SELECT count(*) FROM public.household_members WHERE household_id=family AND role='owner')<>1 THEN RAISE EXCEPTION 'owner invariant failed'; END IF;
  PERFORM public.family_action('rename',family,p_name=>'Shared family');
  IF (SELECT name FROM public.households WHERE id=family)<>'Shared family' THEN RAISE EXCEPTION 'rename failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.activity_log WHERE household_id=family AND action='family_transfer') THEN RAISE EXCEPTION 'audit missing'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: join, idempotence, roles, revoke, expiry, removal, last owner, transfer, rename, audit; fixtures rolled back' AS result;
