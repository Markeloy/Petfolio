-- Owner and membership are verified by this invoker function and existing RLS.
CREATE OR REPLACE FUNCTION public.create_pet_with_weight(p_household_id uuid,p_values jsonb,p_weight numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); pet public.pets; pet_id uuid; k text;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=p_household_id AND user_id=actor AND role IN ('owner','member')) THEN
  RAISE EXCEPTION 'Household unavailable' USING ERRCODE='42501';
 END IF;
 IF p_values IS NULL OR jsonb_typeof(p_values)<>'object' THEN RAISE EXCEPTION 'Invalid pet values' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_values) LOOP
  IF k NOT IN ('name','species','sex','birth_date','breed','color','microchip_number','passport_number','vet_clinic','veterinarian','notes') THEN RAISE EXCEPTION 'Invalid pet field' USING ERRCODE='22023'; END IF;
 END LOOP;
 pet:=jsonb_populate_record(null::public.pets,p_values);
 IF pet.name IS NULL OR length(btrim(pet.name)) NOT BETWEEN 1 AND 100 OR pet.species IS NULL OR pet.sex IS NULL
 OR (pet.birth_date IS NOT NULL AND (NOT isfinite(pet.birth_date) OR pet.birth_date>(now() AT TIME ZONE coalesce((SELECT timezone FROM public.profiles WHERE id=actor),'UTC'))::date))
 THEN RAISE EXCEPTION 'Invalid pet profile' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_values) LOOP
  IF length(p_values->>k)>(CASE WHEN k='notes' THEN 5000 ELSE 300 END) THEN RAISE EXCEPTION 'Pet field too long' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_weight IS NOT NULL AND (p_weight::text IN ('NaN','Infinity','-Infinity') OR p_weight<0.001 OR p_weight>5000 OR round(p_weight,3)<>p_weight) THEN
  RAISE EXCEPTION 'Invalid weight' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.pets(household_id,created_by,name,species,sex,birth_date,breed,color,microchip_number,passport_number,vet_clinic,veterinarian,notes)
 VALUES(p_household_id,actor,btrim(pet.name),pet.species,pet.sex,pet.birth_date,pet.breed,pet.color,pet.microchip_number,pet.passport_number,pet.vet_clinic,pet.veterinarian,pet.notes) RETURNING id INTO pet_id;
 IF p_weight IS NOT NULL THEN INSERT INTO public.weight_records(pet_id,weight_kg,measured_at,created_by) VALUES(pet_id,p_weight,now(),actor); END IF;
 RETURN pet_id;
END $$;
REVOKE ALL ON FUNCTION public.create_pet_with_weight(uuid,jsonb,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_pet_with_weight(uuid,jsonb,numeric) TO authenticated;
