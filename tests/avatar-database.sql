-- Run only in the isolated database. Storage metadata is not a real upload.
BEGIN;
INSERT INTO storage.buckets(id,name,public) VALUES('pet-avatars','pet-avatars',false);
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); family uuid; pet uuid; affected integer;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Avatar owner"}'),(outsider,'{"name":"Outsider"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  INSERT INTO public.pets(household_id,name,created_by) VALUES(family,'Барсик',owner_id) RETURNING id INTO pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  INSERT INTO storage.objects(bucket_id,name) VALUES('pet-avatars',pet::text||'/photo.jpg');
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name=pet::text||'/photo.jpg') THEN RAISE EXCEPTION 'owner cannot read photo'; END IF;
  UPDATE storage.objects SET name=pet::text||'/updated.jpg' WHERE name=pet::text||'/photo.jpg';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'owner cannot update photo'; END IF;
  BEGIN
    UPDATE storage.objects SET name=gen_random_uuid()::text||'/stolen.jpg' WHERE name=pet::text||'/updated.jpg';
    RAISE EXCEPTION 'photo moved outside family';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='pet-avatars') THEN RAISE EXCEPTION 'outsider can read photo'; END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name) VALUES('pet-avatars',pet::text||'/forged.jpg');
    RAISE EXCEPTION 'outsider can upload photo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  DELETE FROM storage.objects WHERE name=pet::text||'/updated.jpg';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'owner cannot delete photo'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: avatar path resolution, read/upload/update/delete and family isolation (metadata only)' AS result;
