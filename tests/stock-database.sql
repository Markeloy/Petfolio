BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); viewer_id uuid:=gen_random_uuid();
  family uuid; other_family uuid; item uuid:=gen_random_uuid(); create_request uuid:=gen_random_uuid(); adjustment uuid:=gen_random_uuid();
  version timestamptz; previous_version timestamptz; result uuid; invalid text;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Stock owner"}'),(member_id,'{"name":"Stock member"}'),(outsider,'{"name":"Stock outsider"}'),(viewer_id,'{"name":"Stock viewer"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  SELECT household_id INTO other_family FROM public.household_members WHERE user_id=outsider LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,member_id,'member'),(family,viewer_id,'viewer');
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  result:=public.stock_action('create',family,item,create_request,'{"name":"Food","category":"food","unit":"кг","quantity":2.125,"threshold":1,"notes":"Test"}');
  PERFORM public.stock_action('create',family,item,create_request,'{"name":"Food","category":"food","unit":"кг","quantity":2.125,"threshold":1}');
  IF (SELECT count(*) FROM public.stock_movements WHERE item_id=item)<>1 THEN RAISE EXCEPTION 'duplicate creation'; END IF;
  SELECT updated_at INTO previous_version FROM public.stock_items WHERE id=item;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  PERFORM public.stock_action('adjust',family,item,adjustment,'{"delta":-1.125,"reason":"Feeding"}');
  PERFORM public.stock_action('adjust',family,item,adjustment,'{"delta":-1.125,"reason":"Feeding"}');
  IF (SELECT quantity FROM public.stock_items WHERE id=item)<>1 OR NOT (SELECT is_low FROM public.stock_items WHERE id=item) THEN RAISE EXCEPTION 'balance or threshold failed'; END IF;
  IF (SELECT count(*) FROM public.stock_movements WHERE item_id=item)<>2 THEN RAISE EXCEPTION 'duplicate movement'; END IF;
  IF (SELECT actor_name FROM public.stock_movements WHERE id=adjustment)<>'Stock member' THEN RAISE EXCEPTION 'actor snapshot failed'; END IF;
  BEGIN
    PERFORM public.stock_action('adjust',family,item,adjustment,'{"delta":-0.5,"reason":"Feeding"}');
    RAISE EXCEPTION 'request payload replacement accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  FOREACH invalid IN ARRAY ARRAY['-2','0','"NaN"','"Infinity"','0.0001'] LOOP
    BEGIN
      PERFORM public.stock_action('adjust',family,item,gen_random_uuid(),jsonb_build_object('delta',invalid::jsonb,'reason','Invalid'));
      RAISE EXCEPTION 'invalid adjustment accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  END LOOP;
  BEGIN
    PERFORM public.stock_action('edit',family,item,gen_random_uuid(),jsonb_build_object('name','Changed','category','food','threshold',0,'version',previous_version));
    RAISE EXCEPTION 'stale edit accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.stock_items WHERE id=item;
  PERFORM public.stock_action('edit',family,item,gen_random_uuid(),jsonb_build_object('name','Changed','category','food','threshold',0.5,'version',version,'unit','л'));
  IF (SELECT unit FROM public.stock_items WHERE id=item)<>'кг' THEN RAISE EXCEPTION 'unit was changed'; END IF;
  SELECT updated_at INTO version FROM public.stock_items WHERE id=item;
  PERFORM public.stock_action('archive',family,item,gen_random_uuid(),jsonb_build_object('version',version));
  BEGIN
    PERFORM public.stock_action('adjust',family,item,gen_random_uuid(),'{"delta":1,"reason":"Purchase"}');
    RAISE EXCEPTION 'archived item changed' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.stock_items WHERE id=item;
  PERFORM public.stock_action('restore',family,item,gen_random_uuid(),jsonb_build_object('version',version));
  PERFORM public.stock_action('adjust',family,item,gen_random_uuid(),'{"delta":2,"reason":"Purchase"}');
  IF (SELECT quantity FROM public.stock_items WHERE id=item)<>3 THEN RAISE EXCEPTION 'restore/topup failed'; END IF;
  BEGIN
    UPDATE public.stock_items SET quantity=99 WHERE id=item;
    RAISE EXCEPTION 'direct quantity update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.stock_movements WHERE item_id=item;
    RAISE EXCEPTION 'history deletion allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',viewer_id::text,true);
  IF NOT EXISTS(SELECT 1 FROM public.stock_items WHERE id=item) THEN RAISE EXCEPTION 'viewer cannot read'; END IF;
  BEGIN
    PERFORM public.stock_action('adjust',family,item,gen_random_uuid(),'{"delta":1,"reason":"Forbidden"}');
    RAISE EXCEPTION 'viewer write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.stock_items WHERE id=item) OR EXISTS(SELECT 1 FROM public.stock_movements WHERE item_id=item) THEN RAISE EXCEPTION 'foreign family data visible'; END IF;
  BEGIN
    PERFORM public.stock_action('adjust',other_family,item,gen_random_uuid(),'{"delta":1,"reason":"Forbidden"}');
    RAISE EXCEPTION 'foreign item altered using own family';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.family_action('remove',family,p_target=>member_id);
  IF (SELECT actor_name FROM public.stock_movements WHERE id=adjustment)<>'Stock member' THEN RAISE EXCEPTION 'historical name lost'; END IF;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  BEGIN
    PERFORM public.stock_action('adjust',family,item,gen_random_uuid(),'{"delta":1,"reason":"Forbidden"}');
    RAISE EXCEPTION 'removed member write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: fractional balances, idempotence, low stock, validation, stale edit, archive, immutable unit/history, member/viewer/outsider access; fixtures rolled back' AS result;
