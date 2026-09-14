-- Extend the minimal isolated scaffold with the live pet profile columns.
CREATE TYPE public.pet_species AS ENUM ('dog','cat','bird','rodent','reptile','other');
CREATE TYPE public.pet_sex AS ENUM ('male','female','unknown');
ALTER TABLE public.pets ADD COLUMN species public.pet_species NOT NULL DEFAULT 'other',
 ADD COLUMN sex public.pet_sex NOT NULL DEFAULT 'unknown',ADD COLUMN birth_date date,
 ADD COLUMN breed text,ADD COLUMN color text,ADD COLUMN microchip_number text,
 ADD COLUMN passport_number text,ADD COLUMN vet_clinic text,ADD COLUMN veterinarian text,ADD COLUMN notes text;
