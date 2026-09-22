-- All fixtures, including Storage metadata, are rolled back. No real file is uploaded.
BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  family uuid; pet uuid; doc uuid:=gen_random_uuid(); version timestamptz; path text; values jsonb; result jsonb;
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES(owner_id,'{"name":"Document owner"}'),(member_id,'{"name":"Document member"}'),(outsider,'{"name":"Document outsider"}');
  SELECT household_id INTO family FROM public.household_members WHERE user_id=owner_id LIMIT 1;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,member_id,'member');
  INSERT INTO public.pets(household_id,name,created_by) VALUES(family,'Document test pet',owner_id) RETURNING id INTO pet;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('role','authenticated',true);
  values:='{"title":"Blood test","category":"test","notes":"Test","original_name":"test.pdf","mime_type":"application/pdf","file_size":32}';
  result:=public.document_action('init',pet,doc,values);path:=result->>'path';
  PERFORM public.document_action('init',pet,doc,values);
  IF (SELECT count(*) FROM public.pet_documents WHERE id=doc)<>1 OR path<>pet::text||'/'||doc::text||'/file.pdf' THEN RAISE EXCEPTION 'duplicate/path failure'; END IF;
  IF NOT private.document_storage_access(path,true) THEN RAISE EXCEPTION 'creator cannot upload'; END IF;
  IF private.document_storage_access(path||'other',true) THEN RAISE EXCEPTION 'arbitrary path writable'; END IF;
  BEGIN
    PERFORM public.document_action('finish',pet,doc);
    RAISE EXCEPTION 'missing file finalized' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  BEGIN
    PERFORM public.document_action('init',pet,doc,values||'{"file_size":64}');
    RAISE EXCEPTION 'retry changed file identity' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF EXISTS(SELECT 1 FROM public.pet_documents WHERE id=doc) OR private.document_storage_access(path,true) THEN RAISE EXCEPTION 'member sees or overwrites pending upload'; END IF;
  PERFORM set_config('role','postgres',true);
  -- Simulate the metadata a successful Storage API upload creates; rollback removes it.
  INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('pet-documents',path,owner_id::text,'{"size":32,"mimetype":"application/pdf"}');
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.document_action('finish',pet,doc);
  PERFORM public.document_action('finish',pet,doc);
  IF (SELECT state FROM public.pet_documents WHERE id=doc)<>'ready' OR private.document_storage_access(path,true) THEN RAISE EXCEPTION 'finalized file writable'; END IF;
  IF (SELECT count(*) FROM public.activity_log WHERE entity_id=doc AND action='document_finish')<>1 THEN RAISE EXCEPTION 'duplicate finish audit'; END IF;
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF NOT private.document_storage_access(path,false) OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='pet-documents' AND name=path) THEN RAISE EXCEPTION 'family cannot read file'; END IF;
  SELECT updated_at INTO version FROM public.pet_documents WHERE id=doc;
  PERFORM public.document_action('edit',pet,doc,values||jsonb_build_object('title','Changed','version',version));
  BEGIN
    PERFORM public.document_action('edit',pet,doc,values||jsonb_build_object('version',version));
    RAISE EXCEPTION 'stale edit allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  SELECT updated_at INTO version FROM public.pet_documents WHERE id=doc;
  PERFORM public.document_action('archive',pet,doc,jsonb_build_object('version',version));
  IF (SELECT archived_at FROM public.pet_documents WHERE id=doc) IS NULL OR NOT private.document_storage_access(path,false) THEN RAISE EXCEPTION 'archive lost file'; END IF;
  SELECT updated_at INTO version FROM public.pet_documents WHERE id=doc;
  PERFORM public.document_action('restore',pet,doc,jsonb_build_object('version',version));
  BEGIN
    UPDATE public.pet_documents SET storage_path='forged' WHERE id=doc;
    RAISE EXCEPTION 'path tampering allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  IF EXISTS(SELECT 1 FROM public.pet_documents WHERE id=doc) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='pet-documents' AND name=path)
    OR private.document_storage_access(path,false) OR private.document_storage_access(path,true) THEN RAISE EXCEPTION 'foreign file accessible'; END IF;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM public.family_action('remove',family,p_target=>member_id);
  PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
  IF private.document_storage_access(path,false) THEN RAISE EXCEPTION 'removed member can read'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: pending/ready, metadata finalization, retry, path, family isolation, edit/version, archive, removal; all fixtures rolled back, no Storage upload tested' AS result;
