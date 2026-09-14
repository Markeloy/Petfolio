-- Fix correlated column resolution: the path belongs to storage.objects, not pets.
DROP POLICY IF EXISTS "household members can read pet avatars" ON storage.objects;
CREATE POLICY "household members can read pet avatars" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='pet-avatars' AND EXISTS(SELECT 1 FROM public.pets p WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND private.is_household_member(p.household_id,(SELECT auth.uid()))));
DROP POLICY IF EXISTS "household members can upload pet avatars" ON storage.objects;
CREATE POLICY "household members can upload pet avatars" ON storage.objects FOR INSERT TO authenticated

WITH CHECK (bucket_id='pet-avatars' AND EXISTS(SELECT 1 FROM public.pets p WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND private.is_household_member(p.household_id,(SELECT auth.uid()))));
DROP POLICY IF EXISTS "household members can update pet avatars" ON storage.objects;
CREATE POLICY "household members can update pet avatars" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='pet-avatars' AND EXISTS(SELECT 1 FROM public.pets p WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND private.is_household_member(p.household_id,(SELECT auth.uid()))))
WITH CHECK (bucket_id='pet-avatars' AND EXISTS(SELECT 1 FROM public.pets p WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND private.is_household_member(p.household_id,(SELECT auth.uid()))));
DROP POLICY IF EXISTS "household owners can delete pet avatars" ON storage.objects;
CREATE POLICY "household owners can delete pet avatars" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='pet-avatars' AND EXISTS(SELECT 1 FROM public.pets p WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND private.is_household_owner(p.household_id,(SELECT auth.uid()))));
