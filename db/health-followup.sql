CREATE FUNCTION public.record_health_followup(p_source_id uuid,p_expected_updated_at timestamptz,p_new_id uuid,p_values jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE source public.health_events%rowtype; existing public.health_events%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO source FROM public.health_events WHERE id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='42501'; END IF;
  IF p_new_id IS NULL OR p_new_id=source.id THEN RAISE EXCEPTION 'Invalid new identity' USING ERRCODE='22023'; END IF;
  SELECT * INTO existing FROM public.health_events WHERE id=p_new_id;
  IF FOUND THEN
    IF existing.pet_id=source.pet_id AND existing.created_by=auth.uid() THEN RETURN existing.id; END IF;
    RAISE EXCEPTION 'Identity already used' USING ERRCODE='42501';
  END IF;
  IF p_expected_updated_at IS NULL OR source.updated_at<>p_expected_updated_at THEN
    RAISE EXCEPTION 'Source changed' USING ERRCODE='40001';
  END IF;
  IF source.archived_at IS NOT NULL OR source.status<>'completed' OR source.next_due_on IS NULL
    OR (p_values->>'event_on')::date<source.event_on OR p_values->>'status' NOT IN ('planned','completed') THEN
    RAISE EXCEPTION 'Invalid follow-up' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.health_events(id,pet_id,kind,title,event_on,status,next_due_on,product,clinic,veterinarian,notes,created_by)
    VALUES(p_new_id,source.pet_id,p_values->>'kind',p_values->>'title',(p_values->>'event_on')::date,p_values->>'status',
      (p_values->>'next_due_on')::date,p_values->>'product',p_values->>'clinic',p_values->>'veterinarian',p_values->>'notes',auth.uid());
  UPDATE public.health_events SET next_due_on=NULL WHERE id=source.id;
  RETURN p_new_id;
END $$;
REVOKE ALL ON FUNCTION public.record_health_followup(uuid,timestamptz,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_health_followup(uuid,timestamptz,uuid,jsonb) TO authenticated;
