import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function healthContext(petId:string) {
  const client=await createClient();
  const {data:auth,error}=await client.auth.getClaims();
  if(error||typeof auth?.claims?.sub!=='string') redirect('/login');
  const userId=auth.claims.sub;
  const [pet,profile]=await Promise.all([
    client.from('pets').select('id,name').eq('id',petId).is('archived_at',null).maybeSingle(),
    client.from('profiles').select('timezone').eq('id',userId).maybeSingle(),
  ]);
  if(pet.error||profile.error) throw new Error('Не удалось загрузить данные питомца');
  if(!pet.data) notFound();
  return {client,pet:pet.data,userId,timezone:profile.data?.timezone||'Europe/Moscow'};
}
export async function authorNames(client:Awaited<ReturnType<typeof createClient>>,ids:string[]) {
  if(!ids.length) return new Map<string,string>();
  const {data,error}=await client.from('profiles').select('id,display_name').in('id',[...new Set(ids)]);
  if(error) throw new Error('Не удалось загрузить авторов');
  return new Map((data??[]).map(p=>[p.id,p.display_name||'Участник семьи']));
}
