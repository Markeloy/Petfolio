CREATE TABLE public.care_procedures (
 id uuid PRIMARY KEY, pet_id uuid NOT NULL REFERENCES public.pets(id), household_id uuid NOT NULL REFERENCES public.households(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),
 kind text NOT NULL CHECK(kind IN ('grooming','bath','nails','ears','teeth','brushing','other')),
 next_on date CHECK(next_on BETWEEN DATE '1900-01-01' AND DATE '2100-12-31'),
 repeat_days integer CHECK(repeat_days BETWEEN 1 AND 365), timezone text NOT NULL,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), archived_at timestamptz
);
CREATE TABLE public.care_procedure_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), procedure_id uuid NOT NULL REFERENCES public.care_procedures(id),
 pet_id uuid NOT NULL REFERENCES public.pets(id), household_id uuid NOT NULL REFERENCES public.households(id),
 scheduled_on date NOT NULL, title text NOT NULL, status text NOT NULL CHECK(status IN ('done','skipped')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, actor_name text NOT NULL,
 UNIQUE(procedure_id,scheduled_on)
);
CREATE INDEX care_procedures_pet ON public.care_procedures(pet_id,next_on,id);
CREATE INDEX care_procedures_household ON public.care_procedures(household_id);
CREATE INDEX care_procedures_creator ON public.care_procedures(created_by);
CREATE INDEX care_procedure_logs_pet ON public.care_procedure_logs(pet_id,scheduled_on,id);
CREATE INDEX care_procedure_logs_household ON public.care_procedure_logs(household_id);
CREATE INDEX care_procedure_logs_actor ON public.care_procedure_logs(actor_id);
ALTER TABLE public.care_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_procedure_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_procedures_read ON public.care_procedures FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
CREATE POLICY care_procedure_logs_read ON public.care_procedure_logs FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
REVOKE ALL ON public.care_procedures,public.care_procedure_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.care_procedures,public.care_procedure_logs TO authenticated;
CREATE FUNCTION private.procedure_action(p_action text,p_pet uuid,p_id uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); family uuid; row public.care_procedures%ROWTYPE; zone text; label text; today date; title_value text; kind_value text; day_value date; repeat_value integer; note text; mark text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
 SELECT household_id INTO family FROM public.pets WHERE id=p_pet AND archived_at IS NULL;
 PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
 IF family IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=actor AND role IN ('owner','member')) THEN RAISE EXCEPTION 'Нет права изменять процедуры' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN RAISE EXCEPTION 'Не указана запись'; END IF;
 SELECT * INTO row FROM public.care_procedures WHERE id=p_id FOR UPDATE;
 IF row.id IS NOT NULL AND (row.pet_id<>p_pet OR row.household_id<>family) THEN RAISE EXCEPTION 'Запись недоступна' USING ERRCODE='42501'; END IF;
 IF p_action='create' AND row.id IS NOT NULL THEN
   IF row.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Запись недоступна' USING ERRCODE='42501'; END IF;
   RETURN row.id;
 END IF;
 IF p_action<>'create' AND row.id IS NULL THEN RAISE EXCEPTION 'Запись не найдена'; END IF;
 SELECT coalesce(timezone,'Europe/Moscow'),coalesce(nullif(btrim(display_name),''),'Участник') INTO zone,label FROM public.profiles WHERE id=actor;
 zone:=coalesce(row.timezone,zone,'Europe/Moscow'); today:=(now() AT TIME ZONE zone)::date;
 IF p_action='mark' AND EXISTS(SELECT 1 FROM public.care_procedure_logs WHERE procedure_id=p_id AND scheduled_on=(p_values->>'day')::date) THEN RETURN p_id; END IF;
 IF p_action<>'create' AND (p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz IS DISTINCT FROM row.updated_at) THEN RAISE EXCEPTION 'Запись изменена другим участником. Обновите страницу'; END IF;
 IF p_action IN ('create','edit') THEN
   title_value:=btrim(p_values->>'title');kind_value:=p_values->>'kind';day_value:=(p_values->>'next_on')::date;repeat_value:=nullif(p_values->>'repeat_days','')::integer;note:=coalesce(p_values->>'notes','');
   IF title_value IS NULL OR length(title_value) NOT BETWEEN 1 AND 100 OR kind_value IS NULL OR kind_value NOT IN ('grooming','bath','nails','ears','teeth','brushing','other') OR day_value IS NULL OR day_value NOT BETWEEN DATE '1900-01-01' AND DATE '2100-12-31' OR (repeat_value IS NOT NULL AND repeat_value NOT BETWEEN 1 AND 365) OR length(note)>2000 THEN RAISE EXCEPTION 'Проверьте поля процедуры'; END IF;
   IF EXISTS(SELECT 1 FROM public.care_procedure_logs WHERE procedure_id=p_id AND scheduled_on=day_value) THEN RAISE EXCEPTION 'Эта дата уже отмечена. Выберите другую'; END IF;
   IF p_action='create' THEN
     INSERT INTO public.care_procedures(id,pet_id,household_id,title,kind,next_on,repeat_days,timezone,notes,created_by) VALUES(p_id,p_pet,family,title_value,kind_value,day_value,repeat_value,zone,note,actor);
   ELSE
     IF row.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Сначала восстановите запись из архива'; END IF;
     UPDATE public.care_procedures SET title=title_value,kind=kind_value,next_on=day_value,repeat_days=repeat_value,notes=note,updated_at=clock_timestamp() WHERE id=p_id;
   END IF;
 ELSIF p_action='mark' THEN
   mark:=p_values->>'status';day_value:=(p_values->>'day')::date;
   IF row.archived_at IS NOT NULL OR row.next_on IS NULL OR day_value IS DISTINCT FROM row.next_on OR day_value>today OR mark IS NULL OR mark NOT IN ('done','skipped') THEN RAISE EXCEPTION 'Проверьте дату и состояние процедуры'; END IF;
   INSERT INTO public.care_procedure_logs(procedure_id,pet_id,household_id,scheduled_on,title,status,actor_id,actor_name) VALUES(p_id,p_pet,family,day_value,row.title,mark,actor,coalesce(label,'Участник'));
   UPDATE public.care_procedures SET next_on=CASE WHEN row.repeat_days IS NULL THEN NULL ELSE today+row.repeat_days END,updated_at=clock_timestamp() WHERE id=p_id;
 ELSIF p_action IN ('archive','restore') THEN
   UPDATE public.care_procedures SET archived_at=CASE WHEN p_action='archive' THEN now() ELSE NULL END,updated_at=clock_timestamp() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Неизвестное действие'; END IF;
 INSERT INTO public.activity_log(household_id,pet_id,actor_id,action,entity_type,entity_id,details) VALUES(family,p_pet,actor,'procedure_'||p_action,'care_procedures',p_id,jsonb_build_object('before',CASE WHEN row.id IS NOT NULL THEN to_jsonb(row) ELSE NULL END,'after',(SELECT to_jsonb(p) FROM public.care_procedures p WHERE id=p_id)));
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION private.procedure_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.procedure_action(text,uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.procedure_action(p_action text,p_pet uuid,p_id uuid,p_values jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.procedure_action(p_action,p_pet,p_id,p_values); $$;
REVOKE ALL ON FUNCTION public.procedure_action(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.procedure_action(text,uuid,uuid,jsonb) TO authenticated;
