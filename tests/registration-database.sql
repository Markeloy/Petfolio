-- Live registration function body, exercised only in isolated PostgreSQL.
BEGIN;
ALTER TABLE auth.users ADD COLUMN email text;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare new_household_id uuid;
begin
 insert into public.profiles (id, display_name)
 values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
 insert into public.households (name, created_by)
 values ('Моя семья', new.id) returning id into new_household_id;
 insert into public.household_members (household_id, user_id, role)
 values (new_household_id, new.id, 'owner');
 return new;
end;
$$;
INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at)
 VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','fixture@example.com','{"name":"Beta fixture"}',now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','pending@example.com','{"name":"Pending fixture"}',null);
DO $$ BEGIN
 IF (SELECT count(*) FROM profiles WHERE id IN ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'))<>2
 OR (SELECT count(*) FROM households WHERE created_by IN ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'))<>2
 OR (SELECT count(*) FROM household_members WHERE user_id IN ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') AND role='owner')<>2
 THEN RAISE EXCEPTION 'registration scaffolding missing';END IF;
 IF (SELECT display_name FROM profiles WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')<>'Beta fixture'
 THEN RAISE EXCEPTION 'registration name lost';END IF;
END $$;
SELECT 'PASS: live registration trigger body creates one profile/household/owner membership with or without confirmed timestamp; isolated fixture only, not a GoTrue session test' AS result;
ROLLBACK;
