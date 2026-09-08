-- Minimal local Auth/application scaffold. No external services or credentials.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,private TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TYPE public.household_role AS ENUM ('owner','member','viewer');
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),display_name text,timezone text DEFAULT 'Europe/Moscow');
CREATE TABLE public.households(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text DEFAULT 'Моя семья',created_by uuid REFERENCES auth.users(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.household_members(household_id uuid REFERENCES public.households(id),user_id uuid REFERENCES auth.users(id),role public.household_role DEFAULT 'member',joined_at timestamptz DEFAULT now(),PRIMARY KEY(household_id,user_id));
CREATE TABLE public.pets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),household_id uuid REFERENCES public.households(id),name text,created_by uuid REFERENCES auth.users(id),archived_at timestamptz);
CREATE TABLE public.activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),household_id uuid REFERENCES public.households(id),pet_id uuid REFERENCES public.pets(id),actor_id uuid REFERENCES auth.users(id),action text,entity_type text,entity_id uuid,details jsonb,created_at timestamptz DEFAULT clock_timestamp());
CREATE FUNCTION private.is_household_member(target_household_id uuid,target_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=target_household_id AND user_id=target_user_id);
$$;
CREATE FUNCTION private.is_household_owner(target_household_id uuid,target_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=target_household_id AND user_id=target_user_id AND role='owner');
$$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE family uuid;
BEGIN
  INSERT INTO public.profiles(id,display_name) VALUES(new.id,new.raw_user_meta_data->>'name');
  INSERT INTO public.households(created_by) VALUES(new.id) RETURNING id INTO family;
  INSERT INTO public.household_members(household_id,user_id,role) VALUES(family,new.id,'owner');
  RETURN new;
END $$;
CREATE TRIGGER create_local_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
GRANT SELECT ON public.profiles,public.households,public.household_members,public.pets,public.activity_log TO authenticated;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON public.household_members FOR SELECT TO authenticated USING(private.is_household_member(household_id));
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY pets_read ON public.pets FOR SELECT TO authenticated USING(private.is_household_member(household_id));
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON public.activity_log FOR SELECT TO authenticated USING(private.is_household_member(household_id));
