-- Privileged operations are isolated from the exposed API schema and check auth.uid().
CREATE TABLE private.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz
);
ALTER TABLE private.family_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.family_invites FROM PUBLIC, anon, authenticated;
CREATE INDEX family_invites_household ON private.family_invites(household_id,created_at DESC);
CREATE INDEX family_invites_creator ON private.family_invites(created_by);
CREATE INDEX family_invites_recipient ON private.family_invites(accepted_by);

-- All membership mutations go through the checked, serialized operations below.
-- Registration runs as the database owner and remains unaffected.
REVOKE INSERT, UPDATE, DELETE ON public.household_members FROM anon, authenticated;

CREATE FUNCTION private.family_action(p_action text, p_household uuid DEFAULT NULL, p_token text DEFAULT NULL, p_target uuid DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid(); family uuid := p_household; actor_role public.household_role;
  invite private.family_invites%ROWTYPE; code text; result jsonb := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт' USING ERRCODE='42501'; END IF;
  IF p_action='join' THEN
    IF p_token IS NULL OR p_token !~ '^[a-f0-9]{48}$' THEN RAISE EXCEPTION 'Проверьте код приглашения'; END IF;
    SELECT household_id INTO family FROM private.family_invites WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
    IF family IS NULL THEN RAISE EXCEPTION 'Приглашение недействительно'; END IF;
  END IF;
  -- Common lock order: household, invitation, memberships. Serializes joins/removals/transfers.
  PERFORM 1 FROM public.households WHERE id=family FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Семья недоступна' USING ERRCODE='42501'; END IF;
  SELECT role INTO actor_role FROM public.household_members WHERE household_id=family AND user_id=actor;
  IF p_action='join' THEN
    SELECT * INTO invite FROM private.family_invites WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') FOR UPDATE;
    IF invite.accepted_by=actor AND actor_role IS NOT NULL AND invite.revoked_at IS NULL THEN RETURN jsonb_build_object('household_id',family); END IF;
    IF invite.accepted_by IS NOT NULL OR invite.revoked_at IS NOT NULL OR invite.expires_at<=now()
      OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=family AND user_id=invite.created_by AND role='owner') THEN
      RAISE EXCEPTION 'Приглашение использовано, отменено или истекло';
    END IF;
    IF actor_role IS NOT NULL THEN RAISE EXCEPTION 'Вы уже состоите в этой семье'; END IF;
    INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,actor,'member');
    UPDATE private.family_invites SET accepted_by=actor,accepted_at=now() WHERE id=invite.id;
    result:=jsonb_build_object('household_id',family);
  ELSE
    IF actor_role IS NULL THEN RAISE EXCEPTION 'Нет доступа к семье' USING ERRCODE='42501'; END IF;
    IF p_action='invites' THEN
      IF actor_role<>'owner' THEN RETURN '[]'::jsonb; END IF;
      RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT id,created_at,expires_at,accepted_at,revoked_at FROM private.family_invites WHERE household_id=family ORDER BY created_at DESC,id LIMIT 20
      ) x),'[]'::jsonb);
    END IF;
    IF p_action='leave' THEN
      IF actor_role='owner' AND (SELECT count(*) FROM public.household_members WHERE household_id=family AND role='owner')<=1 THEN
        RAISE EXCEPTION 'Сначала передайте управление другому участнику';
      END IF;
      DELETE FROM public.household_members WHERE household_id=family AND user_id=actor;
      UPDATE private.family_invites SET revoked_at=now() WHERE household_id=family AND created_by=actor AND revoked_at IS NULL AND accepted_at IS NULL;
    ELSE
      IF actor_role<>'owner' THEN RAISE EXCEPTION 'Это действие доступно владельцу' USING ERRCODE='42501'; END IF;
      CASE p_action
      WHEN 'create' THEN
        IF (SELECT count(*) FROM private.family_invites WHERE household_id=family AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>now())>=10
          OR (SELECT count(*) FROM private.family_invites WHERE household_id=family AND created_at>now()-interval '1 hour')>=20 THEN
          RAISE EXCEPTION 'Слишком много приглашений. Отмените ненужные или попробуйте позже';
        END IF;
        code:=encode(extensions.gen_random_bytes(24),'hex');
        INSERT INTO private.family_invites(household_id,token_hash,created_by) VALUES(family,encode(extensions.digest(code,'sha256'),'hex'),actor) RETURNING * INTO invite;
        result:=jsonb_build_object('code',code,'expires_at',invite.expires_at);
      WHEN 'revoke' THEN
        UPDATE private.family_invites SET revoked_at=coalesce(revoked_at,now()) WHERE id=p_target AND household_id=family AND accepted_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'Приглашение уже использовано или недоступно'; END IF;
      WHEN 'remove' THEN
        DELETE FROM public.household_members WHERE household_id=family AND user_id=p_target AND role<>'owner' AND user_id<>actor;
        IF NOT FOUND THEN RAISE EXCEPTION 'Участник недоступен или является владельцем'; END IF;
        UPDATE private.family_invites SET revoked_at=now() WHERE household_id=family AND created_by=p_target AND revoked_at IS NULL AND accepted_at IS NULL;
      WHEN 'transfer' THEN
        IF p_target IS NULL OR p_target=actor THEN RAISE EXCEPTION 'Выберите другого участника'; END IF;
        UPDATE public.household_members SET role='owner' WHERE household_id=family AND user_id=p_target AND role<>'owner';
        IF NOT FOUND THEN RAISE EXCEPTION 'Участник недоступен или уже владелец'; END IF;
        UPDATE public.household_members SET role='member' WHERE household_id=family AND user_id=actor;
        UPDATE private.family_invites SET revoked_at=now() WHERE household_id=family AND created_by=actor AND revoked_at IS NULL AND accepted_at IS NULL;
      WHEN 'rename' THEN
        IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Название должно содержать от 1 до 80 символов'; END IF;
        UPDATE public.households SET name=btrim(p_name) WHERE id=family;
      ELSE RAISE EXCEPTION 'Неизвестное действие';
      END CASE;
    END IF;
  END IF;
  INSERT INTO public.activity_log(household_id,actor_id,action,entity_type,entity_id,details)
    VALUES(family,actor,'family_'||p_action,'households',family,jsonb_build_object('target',p_target));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.family_action(text,uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.family_action(text,uuid,text,uuid,text) TO authenticated;
CREATE FUNCTION public.family_action(p_action text, p_household uuid DEFAULT NULL, p_token text DEFAULT NULL, p_target uuid DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.family_action(p_action,p_household,p_token,p_target,p_name);
$$;
REVOKE ALL ON FUNCTION public.family_action(text,uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_action(text,uuid,text,uuid,text) TO authenticated;
