INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('pet-documents','pet-documents',false,8388608,ARRAY['application/pdf','image/jpeg','image/png','image/webp']);
CREATE TABLE public.pet_documents (
  id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id),
  household_id uuid NOT NULL REFERENCES public.households(id),
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),
  category text NOT NULL CHECK(category IN ('passport','test','report','prescription','insurance','other')),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size integer NOT NULL CHECK(file_size BETWEEN 1 AND 8388608),
  storage_path text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);
CREATE INDEX pet_documents_pet ON public.pet_documents(pet_id,state,created_at DESC,id);
CREATE INDEX pet_documents_household ON public.pet_documents(household_id);
CREATE INDEX pet_documents_creator ON public.pet_documents(created_by);
ALTER TABLE public.pet_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pet_documents_read ON public.pet_documents FOR SELECT TO authenticated
USING ((SELECT private.is_household_member(household_id)) AND (state='ready' OR created_by=(SELECT auth.uid())));
REVOKE ALL ON public.pet_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pet_documents TO authenticated;

CREATE FUNCTION private.document_storage_access(object_path text,write_access boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.pet_documents d JOIN public.household_members m ON m.household_id=d.household_id
    JOIN public.pets p ON p.id=d.pet_id AND p.household_id=d.household_id
    WHERE d.storage_path=object_path AND m.user_id=auth.uid() AND
      CASE WHEN write_access THEN d.state='pending' AND d.created_by=auth.uid() AND m.role IN ('owner','member') AND p.archived_at IS NULL
      ELSE d.state='ready' OR d.created_by=auth.uid() END
  );
$$;
REVOKE ALL ON FUNCTION private.document_storage_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.document_storage_access(text,boolean) TO authenticated;
CREATE POLICY documents_storage_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='pet-documents' AND private.document_storage_access(storage.objects.name,false));
CREATE POLICY documents_storage_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='pet-documents' AND private.document_storage_access(storage.objects.name,true));
CREATE POLICY documents_storage_pending_cleanup ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='pet-documents' AND private.document_storage_access(storage.objects.name,true));

CREATE FUNCTION private.document_action(p_action text,p_pet uuid,p_document uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=auth.uid(); family uuid; doc public.pet_documents%ROWTYPE; title_value text; category_value text; note text;
  mime text; size_value integer; filename text; extension text; label text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
  SELECT household_id INTO family FROM public.pets WHERE id=p_pet AND archived_at IS NULL;
  PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
  IF family IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=actor AND role IN ('owner','member')) THEN
    RAISE EXCEPTION 'Нет доступа к документам питомца' USING ERRCODE='42501';
  END IF;
  IF p_document IS NULL THEN RAISE EXCEPTION 'Не указан документ'; END IF;
  SELECT * INTO doc FROM public.pet_documents WHERE id=p_document FOR UPDATE;
  IF doc.id IS NOT NULL AND (doc.pet_id<>p_pet OR doc.household_id<>family) THEN RAISE EXCEPTION 'Документ недоступен' USING ERRCODE='42501'; END IF;
  IF p_action IN ('init','edit') THEN
    title_value:=btrim(p_values->>'title'); category_value:=p_values->>'category'; note:=coalesce(p_values->>'notes','');
    IF title_value IS NULL OR length(title_value) NOT BETWEEN 1 AND 100 OR category_value IS NULL OR category_value NOT IN ('passport','test','report','prescription','insurance','other') OR length(note)>2000 THEN
      RAISE EXCEPTION 'Проверьте название, категорию и примечание';
    END IF;
  END IF;
  IF p_action='init' THEN
    mime:=p_values->>'mime_type'; size_value:=(p_values->>'file_size')::integer; filename:=p_values->>'original_name';
    extension:=CASE mime WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
    IF extension IS NULL OR size_value IS NULL OR size_value NOT BETWEEN 1 AND 8388608 OR filename IS NULL OR length(filename) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Выберите PDF, JPG, PNG или WebP размером до 8 МБ'; END IF;
    IF doc.id IS NOT NULL THEN
      IF doc.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Документ недоступен' USING ERRCODE='42501'; END IF;
      IF doc.mime_type<>mime OR doc.file_size<>size_value OR doc.original_name<>filename OR doc.title<>title_value OR doc.category<>category_value OR doc.notes<>note THEN RAISE EXCEPTION 'Загрузка уже начата с другими данными. Откройте форму заново'; END IF;
      RETURN jsonb_build_object('path',doc.storage_path,'state',doc.state);
    END IF;
    SELECT coalesce(nullif(btrim(display_name),''),'Участник') INTO label FROM public.profiles WHERE id=actor;
    INSERT INTO public.pet_documents(id,pet_id,household_id,title,category,notes,original_name,mime_type,file_size,storage_path,created_by,author_name)
    VALUES(p_document,p_pet,family,title_value,category_value,note,filename,mime,size_value,p_pet::text||'/'||p_document::text||'/file.'||extension,actor,coalesce(label,'Участник')) RETURNING * INTO doc;
    RETURN jsonb_build_object('path',doc.storage_path,'state',doc.state);
  END IF;
  IF doc.id IS NULL THEN RAISE EXCEPTION 'Документ не найден'; END IF;
  IF p_action='finish' THEN
    IF doc.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Завершить загрузку может её автор' USING ERRCODE='42501'; END IF;
    IF doc.state='ready' THEN RETURN jsonb_build_object('id',doc.id); END IF;
    IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='pet-documents' AND o.name=doc.storage_path
      AND (o.metadata->>'size')::bigint=doc.file_size AND o.metadata->>'mimetype'=doc.mime_type) THEN RAISE EXCEPTION 'Файл ещё не загружен полностью. Повторите загрузку'; END IF;
    UPDATE public.pet_documents SET state='ready',updated_at=clock_timestamp() WHERE id=doc.id;
  ELSIF p_action IN ('edit','archive','restore') THEN
    IF doc.state<>'ready' THEN RAISE EXCEPTION 'Сначала завершите загрузку'; END IF;
    IF p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz<>doc.updated_at THEN RAISE EXCEPTION 'Документ изменился. Обновите страницу'; END IF;
    IF p_action='edit' THEN
      UPDATE public.pet_documents SET title=title_value,category=category_value,notes=note,updated_at=clock_timestamp() WHERE id=doc.id;
    ELSE
      UPDATE public.pet_documents SET archived_at=CASE WHEN p_action='archive' THEN now() ELSE NULL END,updated_at=clock_timestamp() WHERE id=doc.id;
    END IF;
  ELSE RAISE EXCEPTION 'Неизвестное действие';
  END IF;
  INSERT INTO public.activity_log(household_id,pet_id,actor_id,action,entity_type,entity_id)
    VALUES(family,p_pet,actor,'document_'||p_action,'pet_documents',doc.id);
  RETURN jsonb_build_object('id',doc.id);
END $$;
REVOKE ALL ON FUNCTION private.document_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.document_action(text,uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.document_action(p_action text,p_pet uuid,p_document uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.document_action(p_action,p_pet,p_document,p_values); $$;
REVOKE ALL ON FUNCTION public.document_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_action(text,uuid,uuid,jsonb) TO authenticated;
