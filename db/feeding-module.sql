CREATE TABLE public.feeding_plans (
  id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id),
  household_id uuid NOT NULL REFERENCES public.households(id),
  food text NOT NULL CHECK(length(btrim(food)) BETWEEN 1 AND 100),
  amount numeric(14,3) NOT NULL CHECK(amount>0 AND amount<=1000000000),
  unit text NOT NULL CHECK(unit IN ('г','кг','мл','л','шт','упак')),
  scheduled_time time NOT NULL CHECK(extract(second FROM scheduled_time)=0),
  timezone text NOT NULL,
  active_from date NOT NULL,
  active_until date,
  stock_item_id uuid REFERENCES public.stock_items(id),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  replaces_id uuid UNIQUE REFERENCES public.feeding_plans(id),
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(active_until IS NULL OR active_until>=active_from)
);
CREATE TABLE public.feeding_logs (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.feeding_plans(id),
  pet_id uuid NOT NULL REFERENCES public.pets(id),
  household_id uuid NOT NULL REFERENCES public.households(id),
  planned_on date NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('fed','skipped')),
  food text NOT NULL,
  amount numeric(14,3) NOT NULL,
  unit text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  stock_movement_id uuid REFERENCES public.stock_movements(id),
  UNIQUE(plan_id,planned_on)
);
CREATE INDEX feeding_plans_pet ON public.feeding_plans(pet_id,active_from);
CREATE INDEX feeding_plans_household ON public.feeding_plans(household_id);
CREATE INDEX feeding_plans_stock ON public.feeding_plans(stock_item_id);
CREATE INDEX feeding_plans_creator ON public.feeding_plans(created_by);
CREATE INDEX feeding_logs_pet ON public.feeding_logs(pet_id,scheduled_for DESC,id);
CREATE INDEX feeding_logs_household ON public.feeding_logs(household_id);
CREATE INDEX feeding_logs_actor ON public.feeding_logs(actor_id);
CREATE INDEX feeding_logs_stock ON public.feeding_logs(stock_movement_id);
ALTER TABLE public.feeding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeding_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY feeding_plans_read ON public.feeding_plans FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
CREATE POLICY feeding_logs_read ON public.feeding_logs FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
REVOKE ALL ON public.feeding_plans,public.feeding_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.feeding_plans,public.feeding_logs TO authenticated;

CREATE FUNCTION private.feeding_action(p_action text,p_pet uuid,p_plan uuid,p_request uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=auth.uid(); family uuid; pet_label text; plan public.feeding_plans%ROWTYPE;
  previous public.feeding_logs%ROWTYPE; today date; zone text; title text; portion numeric; unit_value text;
  clock_value time; stock_id uuid; note text; day date; stamp timestamptz; status_value text; actor_label text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
  SELECT household_id,name INTO family,pet_label FROM public.pets WHERE id=p_pet AND archived_at IS NULL;
  PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
  IF family IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=actor AND role IN ('owner','member')) THEN
    RAISE EXCEPTION 'Нет доступа к питанию питомца' USING ERRCODE='42501';
  END IF;
  IF p_plan IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Не указана операция'; END IF;
  SELECT * INTO plan FROM public.feeding_plans WHERE id=p_plan FOR UPDATE;
  IF plan.id IS NOT NULL AND (plan.pet_id<>p_pet OR plan.household_id<>family) THEN RAISE EXCEPTION 'Рацион недоступен' USING ERRCODE='42501'; END IF;
  IF p_action='create' AND plan.id IS NOT NULL THEN
    IF plan.created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Рацион недоступен' USING ERRCODE='42501'; END IF;
    RETURN p_plan;
  END IF;
  IF p_action<>'create' AND plan.id IS NULL THEN RAISE EXCEPTION 'Рацион не найден'; END IF;
  zone:=CASE WHEN p_action='create' THEN coalesce((SELECT timezone FROM public.profiles WHERE id=actor),'Europe/Moscow') ELSE plan.timezone END;
  today:=(now() AT TIME ZONE zone)::date;
  IF p_action IN ('create','revise') THEN
    title:=btrim(p_values->>'food'); portion:=(p_values->>'amount')::numeric; unit_value:=p_values->>'unit';
    clock_value:=(p_values->>'time')::time; stock_id:=nullif(p_values->>'stock_id','')::uuid; note:=coalesce(p_values->>'notes','');
    IF title IS NULL OR length(title) NOT BETWEEN 1 AND 100 OR portion IS NULL OR portion<=0 OR portion>1000000000 OR portion<>round(portion,3)
      OR unit_value IS NULL OR unit_value NOT IN ('г','кг','мл','л','шт','упак') OR clock_value IS NULL OR clock_value>='24:00'::time OR extract(second FROM clock_value)<>0 OR length(note)>2000 THEN
      RAISE EXCEPTION 'Проверьте корм, порцию, единицу и время';
    END IF;
    IF stock_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.stock_items WHERE id=stock_id AND household_id=family AND archived_at IS NULL AND category='food' AND unit=unit_value) THEN
      RAISE EXCEPTION 'Выберите активный корм этой семьи с такой же единицей измерения';
    END IF;
    IF p_action='revise' THEN
      IF EXISTS(SELECT 1 FROM public.feeding_plans WHERE id=p_request AND replaces_id=p_plan AND created_by=actor) THEN RETURN p_request; END IF;
      IF plan.archived_at IS NOT NULL OR (plan.active_until IS NOT NULL AND plan.active_until<today)
        OR p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz<>plan.updated_at THEN RAISE EXCEPTION 'Рацион изменился. Обновите страницу'; END IF;
      IF plan.active_from>today THEN
        UPDATE public.feeding_plans SET archived_at=now(),updated_at=clock_timestamp() WHERE id=p_plan;
      ELSE
        UPDATE public.feeding_plans SET active_until=today,updated_at=clock_timestamp() WHERE id=p_plan;
      END IF;
    END IF;
    INSERT INTO public.feeding_plans(id,pet_id,household_id,food,amount,unit,scheduled_time,timezone,active_from,stock_item_id,notes,replaces_id,created_by)
      VALUES(CASE WHEN p_action='create' THEN p_plan ELSE p_request END,p_pet,family,title,portion,unit_value,clock_value,zone,
        CASE WHEN p_action='create' THEN today ELSE today+1 END,stock_id,note,CASE WHEN p_action='revise' THEN p_plan ELSE NULL END,actor);
  ELSIF p_action IN ('archive','restore') THEN
    IF p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz<>plan.updated_at THEN RAISE EXCEPTION 'Рацион изменился. Обновите страницу'; END IF;
    IF p_action='restore' AND EXISTS(SELECT 1 FROM public.feeding_plans WHERE replaces_id=p_plan) THEN RAISE EXCEPTION 'У этого рациона есть новая версия'; END IF;
    UPDATE public.feeding_plans SET archived_at=CASE WHEN p_action='archive' THEN now() ELSE NULL END,updated_at=clock_timestamp() WHERE id=p_plan;
  ELSIF p_action='mark' THEN
    day:=(p_values->>'day')::date; stamp:=(p_values->>'instant')::timestamptz; status_value:=p_values->>'status';
    IF day IS NULL OR stamp IS NULL OR day<>today OR status_value IS NULL OR status_value NOT IN ('fed','skipped')
      OR (stamp AT TIME ZONE zone)::date<>day OR (stamp AT TIME ZONE zone)::time<>plan.scheduled_time THEN RAISE EXCEPTION 'Отметить можно только сегодняшнее кормление по расписанию'; END IF;
    SELECT * INTO previous FROM public.feeding_logs WHERE plan_id=p_plan AND planned_on=day;
    IF previous.id IS NOT NULL THEN RETURN previous.id; END IF;
    IF plan.archived_at IS NOT NULL OR day<plan.active_from OR (plan.active_until IS NOT NULL AND day>plan.active_until) THEN RAISE EXCEPTION 'Расписание больше не действует'; END IF;
    IF status_value='fed' AND plan.stock_item_id IS NOT NULL THEN
      PERFORM private.stock_action('adjust',family,plan.stock_item_id,p_request,
        jsonb_build_object('delta',-plan.amount,'reason',left('Кормление: '||pet_label||' — '||plan.food,500)));
    END IF;
    SELECT coalesce(nullif(btrim(display_name),''),'Участник') INTO actor_label FROM public.profiles WHERE id=actor;
    INSERT INTO public.feeding_logs(id,plan_id,pet_id,household_id,planned_on,scheduled_for,status,food,amount,unit,actor_id,actor_name,stock_movement_id)
      VALUES(p_request,p_plan,p_pet,family,day,stamp,status_value,plan.food,plan.amount,plan.unit,actor,coalesce(actor_label,'Участник'),
        CASE WHEN status_value='fed' AND plan.stock_item_id IS NOT NULL THEN p_request ELSE NULL END);
  ELSE RAISE EXCEPTION 'Неизвестное действие';
  END IF;
  INSERT INTO public.activity_log(household_id,pet_id,actor_id,action,entity_type,entity_id,details)
    VALUES(family,p_pet,actor,'feeding_'||p_action,'feeding_plans',p_plan,jsonb_build_object('request',p_request));
  RETURN CASE WHEN p_action IN ('mark','revise') THEN p_request ELSE p_plan END;
END $$;
REVOKE ALL ON FUNCTION private.feeding_action(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.feeding_action(text,uuid,uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.feeding_action(p_action text,p_pet uuid,p_plan uuid,p_request uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.feeding_action(p_action,p_pet,p_plan,p_request,p_values); $$;
REVOKE ALL ON FUNCTION public.feeding_action(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.feeding_action(text,uuid,uuid,uuid,jsonb) TO authenticated;
