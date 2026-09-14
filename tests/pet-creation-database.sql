BEGIN;
CREATE FUNCTION private.test_fail_initial_weight() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF new.weight_kg=13 THEN RAISE EXCEPTION 'forced initial weight failure' USING ERRCODE='P0099'; END IF; RETURN new; END $$;
CREATE TRIGGER test_fail_weight BEFORE INSERT ON public.weight_records FOR EACH ROW EXECUTE FUNCTION private.test_fail_initial_weight();
DO $$
DECLARE u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); h uuid; oh uuid; pet uuid; before_count bigint;
BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES(u,'{}'),(outsider,'{}');
 SELECT household_id INTO h FROM public.household_members WHERE user_id=u LIMIT 1;
 SELECT household_id INTO oh FROM public.household_members WHERE user_id=outsider LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 SELECT count(*) INTO before_count FROM public.pets;
 BEGIN
  PERFORM public.create_pet_with_weight(h,'{"name":"Fixture","species":"dog","sex":"unknown"}',13);
  RAISE EXCEPTION 'Expected initial weight failure';
 EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL; END;
 IF (SELECT count(*) FROM public.pets)<>before_count THEN RAISE EXCEPTION 'Orphan pet survived failed weight'; END IF;
 pet:=public.create_pet_with_weight(h,'{"name":"Fixture","species":"dog","sex":"unknown"}',12);
 IF NOT EXISTS(SELECT 1 FROM public.weight_records WHERE pet_id=pet AND weight_kg=12 AND created_by=u) THEN RAISE EXCEPTION 'Initial weight or author missing'; END IF;
 BEGIN
  PERFORM public.create_pet_with_weight(oh,'{"name":"Fixture","species":"dog","sex":"unknown"}',12);
  RAISE EXCEPTION 'Foreign household pet accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.create_pet_with_weight(h,jsonb_build_object('name','Fixture','species','dog','sex','unknown','created_by',outsider),12);
  RAISE EXCEPTION 'Spoofed author accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: atomic pet and initial weight, forced rollback, author and household isolation' AS result;
