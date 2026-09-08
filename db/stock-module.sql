CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
  category text NOT NULL CHECK(category IN ('food','medicine','supplies','other')),
  unit text NOT NULL CHECK(unit IN ('г','кг','мл','л','шт','табл','упак')),
  quantity numeric(14,3) NOT NULL CHECK(quantity BETWEEN 0 AND 1000000000),
  threshold numeric(14,3) NOT NULL DEFAULT 0 CHECK(threshold BETWEEN 0 AND 1000000000),
  is_low boolean GENERATED ALWAYS AS (quantity<=threshold) STORED,
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz
);
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.stock_items(id),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  delta numeric(14,3) NOT NULL,
  balance numeric(14,3) NOT NULL CHECK(balance BETWEEN 0 AND 1000000000),
  reason text NOT NULL CHECK(length(reason)<=500),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_items_household ON public.stock_items(household_id,archived_at,name,id);
CREATE INDEX stock_items_creator ON public.stock_items(created_by);
CREATE INDEX stock_movements_item ON public.stock_movements(item_id,created_at DESC,id);
CREATE INDEX stock_movements_household ON public.stock_movements(household_id);
CREATE INDEX stock_movements_actor ON public.stock_movements(actor_id);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_items_read ON public.stock_items FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
CREATE POLICY stock_movements_read ON public.stock_movements FOR SELECT TO authenticated USING ((SELECT private.is_household_member(household_id)));
REVOKE ALL ON public.stock_items,public.stock_movements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stock_items,public.stock_movements TO authenticated;

CREATE FUNCTION private.stock_action(p_action text,p_household uuid,p_item uuid,p_request uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=auth.uid(); item public.stock_items%ROWTYPE; movement public.stock_movements%ROWTYPE;
  amount numeric; minimum numeric; title text; category_value text; unit_value text; note text; reason_value text; actor_label text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.households WHERE id=p_household FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=p_household AND user_id=actor AND role IN ('owner','member')) THEN
    RAISE EXCEPTION 'Нет права изменять запасы этой семьи' USING ERRCODE='42501';
  END IF;
  IF p_item IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Не указан идентификатор операции'; END IF;
  SELECT coalesce(nullif(btrim(display_name),''),'Участник') INTO actor_label FROM public.profiles WHERE id=actor;
  SELECT * INTO item FROM public.stock_items WHERE id=p_item FOR UPDATE;
  IF item.id IS NOT NULL AND item.household_id<>p_household THEN RAISE EXCEPTION 'Запас недоступен' USING ERRCODE='42501'; END IF;
  IF p_action='create' AND item.id IS NOT NULL THEN
    IF item.created_by<>actor THEN RAISE EXCEPTION 'Запас недоступен' USING ERRCODE='42501'; END IF;
    RETURN item.id;
  END IF;
  IF p_action<>'create' AND item.id IS NULL THEN RAISE EXCEPTION 'Запас не найден'; END IF;
  IF p_action IN ('create','edit') THEN
    title:=btrim(p_values->>'name'); category_value:=p_values->>'category'; unit_value:=p_values->>'unit';
    minimum:=(p_values->>'threshold')::numeric; note:=coalesce(p_values->>'notes','');
    IF title IS NULL OR length(title) NOT BETWEEN 1 AND 100 OR category_value IS NULL OR category_value NOT IN ('food','medicine','supplies','other')
      OR minimum IS NULL OR minimum NOT BETWEEN 0 AND 1000000000 OR minimum<>round(minimum,3) OR length(note)>2000 THEN RAISE EXCEPTION 'Проверьте название, категорию и минимальный остаток'; END IF;
  END IF;
  IF p_action='create' THEN
    amount:=(p_values->>'quantity')::numeric;
    IF amount IS NULL OR amount NOT BETWEEN 0 AND 1000000000 OR amount<>round(amount,3)
      OR unit_value IS NULL OR unit_value NOT IN ('г','кг','мл','л','шт','табл','упак') THEN RAISE EXCEPTION 'Проверьте остаток и единицу измерения'; END IF;
    INSERT INTO public.stock_items(id,household_id,name,category,unit,quantity,threshold,notes,created_by)
      VALUES(p_item,p_household,title,category_value,unit_value,amount,minimum,note,actor);
    INSERT INTO public.stock_movements(id,item_id,household_id,delta,balance,reason,actor_id,actor_name)
      VALUES(p_request,p_item,p_household,amount,amount,'Начальный остаток',actor,coalesce(actor_label,'Участник'));
  ELSIF p_action='adjust' THEN
    amount:=(p_values->>'delta')::numeric; reason_value:=btrim(coalesce(p_values->>'reason',''));
    IF amount IS NULL OR amount=0 OR amount NOT BETWEEN -1000000000 AND 1000000000 OR amount<>round(amount,3) OR length(reason_value) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Укажите количество и причину изменения';
    END IF;
    SELECT * INTO movement FROM public.stock_movements WHERE id=p_request;
    IF movement.id IS NOT NULL THEN
      IF movement.item_id<>p_item OR movement.actor_id<>actor OR movement.delta<>amount OR movement.reason<>reason_value THEN
        RAISE EXCEPTION 'Операция уже использована с другими значениями';
      END IF;
      RETURN p_item;
    END IF;
    IF item.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Сначала восстановите запас из архива'; END IF;
    IF item.quantity+amount NOT BETWEEN 0 AND 1000000000 THEN RAISE EXCEPTION 'Недостаточно остатка или превышен допустимый объём'; END IF;
    UPDATE public.stock_items SET quantity=quantity+amount,updated_at=clock_timestamp() WHERE id=p_item;
    INSERT INTO public.stock_movements(id,item_id,household_id,delta,balance,reason,actor_id,actor_name)
      VALUES(p_request,p_item,p_household,amount,item.quantity+amount,reason_value,actor,coalesce(actor_label,'Участник'));
  ELSIF p_action IN ('edit','archive','restore') THEN
    IF p_values->>'version' IS NULL OR (p_values->>'version')::timestamptz<>item.updated_at THEN RAISE EXCEPTION 'Запас уже изменился. Обновите страницу'; END IF;
    IF p_action='edit' THEN
      IF item.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Сначала восстановите запас из архива'; END IF;
      UPDATE public.stock_items SET name=title,category=category_value,threshold=minimum,notes=note,updated_at=clock_timestamp() WHERE id=p_item;
    ELSE
      UPDATE public.stock_items SET archived_at=CASE WHEN p_action='archive' THEN now() ELSE NULL END,updated_at=clock_timestamp() WHERE id=p_item;
    END IF;
  ELSE RAISE EXCEPTION 'Неизвестное действие';
  END IF;
  INSERT INTO public.activity_log(household_id,actor_id,action,entity_type,entity_id,details)
    VALUES(p_household,actor,'stock_'||p_action,'stock_items',p_item,jsonb_build_object('request',p_request));
  RETURN p_item;
END $$;
REVOKE ALL ON FUNCTION private.stock_action(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.stock_action(text,uuid,uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.stock_action(p_action text,p_household uuid,p_item uuid,p_request uuid,p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.stock_action(p_action,p_household,p_item,p_request,p_values); $$;
REVOKE ALL ON FUNCTION public.stock_action(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stock_action(text,uuid,uuid,uuid,jsonb) TO authenticated;
