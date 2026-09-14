CREATE TABLE public.pet_activities (
  id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id),
  household_id uuid NOT NULL REFERENCES public.households(id),
  kind text NOT NULL CHECK(kind IN ('walk','training','play','other')),
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),
  status text NOT NULL CHECK(status IN ('planned','completed','cancelled')),
  started_at timestamptz NOT NULL CHECK(isfinite(started_at)),
  timezone text NOT NULL,
  duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),
  distance_km numeric(9,3) CHECK(distance_km BETWEEN 0 AND 1000),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);
CREATE INDEX pet_activities_pet ON public.pet_activities(pet_id,started_at DESC,id);
CREATE INDEX pet_activities_household ON public.pet_activities(household_id);
CREATE INDEX pet_activities_creator ON public.pet_activities(created_by);
CREATE INDEX pet_activities_editor ON public.pet_activities(updated_by);
ALTER TABLE public.pet_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY pet_activities_read ON public.pet_activities FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
REVOKE ALL ON public.pet_activities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pet_activities TO authenticated;
CREATE FUNCTION private.activity_action(p_action text,p_pet uuid,p_activity uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=auth.uid(); family uuid; row public.pet_activities%ROWTYPE; title_value text; kind_value text; state text;
  start_value timestamptz; duration_value integer; distance_value numeric; note text; zone text; label text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
  SELECT household_id INTO family FROM public.pets WHERE id=p_pet AND archived_at IS NULL;
  PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
  IF family IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=actor AND role IN ('owner','member')) THEN
    RAISE EXCEPTION 'Нет права изменять активность питомца' USING ERRCODE='42501';
  END IF;
  IF p_activity IS NULL THEN RAISE EXCEPTION 'Не указана запись'; END IF;
  SELECT * INTO row FROM public.pet_activities WHERE id=p_activity FOR UPDATE;
  IF row.id IS NOT NULL AND (row.pet_id<>p_pet OR row.household_id<>family) THEN RAISE EXCEPTION 'Запись недоступна' USING ERRCODE='42501'; END IF;
  IF p_action='create' AND row.id IS NOT NULL THEN
    IF row.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Запись недоступна' USING ERRCODE='42501'; END IF;
    RETURN row.id;
  END IF;
  IF p_action<>'create' AND row.id IS NULL THEN RAISE EXCEPTION 'Запись не найдена'; END IF;
  IF p_action<>'create' AND (p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz<>row.updated_at) THEN RAISE EXCEPTION 'Запись изменена другим участником. Обновите страницу'; END IF;
  SELECT coalesce(nullif(btrim(display_name),''),'Участник'),coalesce(timezone,'Europe/Moscow') INTO label,zone FROM public.profiles WHERE id=actor;
  IF p_action IN ('create','edit') THEN
    title_value:=btrim(p_values->>'title'); kind_value:=p_values->>'kind'; state:=p_values->>'status'; start_value:=(p_values->>'started_at')::timestamptz;
    duration_value:=(p_values->>'duration_minutes')::integer; distance_value:=nullif(p_values->>'distance_km','')::numeric; note:=coalesce(p_values->>'notes','');
    IF title_value IS NULL OR length(title_value) NOT BETWEEN 1 AND 100 OR kind_value IS NULL OR kind_value NOT IN ('walk','training','play','other')
      OR state IS NULL OR state NOT IN ('planned','completed','cancelled') OR start_value IS NULL OR NOT isfinite(start_value)
      OR duration_value IS NULL OR duration_value NOT BETWEEN 1 AND 1440 OR length(note)>2000
      OR (distance_value IS NOT NULL AND (distance_value NOT BETWEEN 0 AND 1000 OR distance_value<>round(distance_value,3))) THEN RAISE EXCEPTION 'Проверьте поля активности'; END IF;
    IF state='completed' AND start_value+make_interval(mins=>duration_value)>now() THEN RAISE EXCEPTION 'Выполненная активность должна уже закончиться. Проверьте начало и длительность'; END IF;
    IF p_action='create' THEN
      INSERT INTO public.pet_activities(id,pet_id,household_id,kind,title,status,started_at,timezone,duration_minutes,distance_km,notes,created_by,author_name,updated_by,editor_name)
        VALUES(p_activity,p_pet,family,kind_value,title_value,state,start_value,zone,duration_value,distance_value,note,actor,coalesce(label,'Участник'),actor,coalesce(label,'Участник'));
    ELSE
      IF row.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Сначала восстановите запись из архива'; END IF;
      UPDATE public.pet_activities SET kind=kind_value,title=title_value,status=state,started_at=start_value,duration_minutes=duration_value,distance_km=distance_value,notes=note,updated_by=actor,editor_name=coalesce(label,'Участник'),updated_at=clock_timestamp() WHERE id=p_activity;
    END IF;
  ELSIF p_action IN ('archive','restore') THEN
    UPDATE public.pet_activities SET archived_at=CASE WHEN p_action='archive' THEN now() ELSE NULL END,updated_by=actor,editor_name=coalesce(label,'Участник'),updated_at=clock_timestamp() WHERE id=p_activity;
  ELSE RAISE EXCEPTION 'Неизвестное действие'; END IF;
  INSERT INTO public.activity_log(household_id,pet_id,actor_id,action,entity_type,entity_id,details)
    VALUES(family,p_pet,actor,'activity_'||p_action,'pet_activities',p_activity,jsonb_build_object('before',CASE WHEN row.id IS NOT NULL THEN to_jsonb(row) ELSE NULL END,'after',(SELECT to_jsonb(a) FROM public.pet_activities a WHERE id=p_activity)));
  RETURN p_activity;
END $$;
REVOKE ALL ON FUNCTION private.activity_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.activity_action(text,uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.activity_action(p_action text,p_pet uuid,p_activity uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.activity_action(p_action,p_pet,p_activity,p_values); $$;
REVOKE ALL ON FUNCTION public.activity_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activity_action(text,uuid,uuid,jsonb) TO authenticated;
