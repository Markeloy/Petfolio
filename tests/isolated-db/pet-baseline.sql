-- Extend the minimal isolated scaffold with the live pet profile columns.
CREATE TYPE public.pet_species AS ENUM ('dog','cat','bird','rodent','reptile','other');
CREATE TYPE public.pet_sex AS ENUM ('male','female','unknown');
ALTER TABLE public.pets ADD COLUMN species public.pet_species NOT NULL DEFAULT 'other',
 ADD COLUMN sex public.pet_sex NOT NULL DEFAULT 'unknown',ADD COLUMN birth_date date,
 ADD COLUMN breed text,ADD COLUMN color text,ADD COLUMN microchip_number text,
 ADD COLUMN passport_number text,ADD COLUMN vet_clinic text,ADD COLUMN veterinarian text,ADD COLUMN notes text;

-- Mirror the existing production INSERT grant/policy, not a production policy change.
GRANT INSERT ON public.pets TO authenticated;
CREATE POLICY pets_insert_member ON public.pets FOR INSERT TO authenticated
 WITH CHECK(created_by=(SELECT auth.uid()) AND (SELECT private.is_household_member(household_id)));
