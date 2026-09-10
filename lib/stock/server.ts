import { redirect,notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { familyMemberships } from '@/lib/family/server';
export async function stockContext(itemId?:string) {
  const client=await createClient();
  const {data:claims,error}=await client.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(error||typeof userId!=='string')redirect('/login');
  const {memberships,active}=await familyMemberships(client,userId);
  if(!active)redirect('/family');
  const result=itemId?await client.from('stock_items').select('*').eq('id',itemId).maybeSingle():null;
  if(result?.error)throw new Error('Не удалось загрузить запас');
  if(itemId&&!result?.data)notFound();
  const item=result?.data??null;
  const membership=item?memberships.find(m=>m.household_id===item.household_id):active;
  if(!membership)notFound();
  const {data:family,error:familyError}=await client.from('households').select('id,name').eq('id',membership.household_id).single();
  if(familyError)throw new Error('Не удалось загрузить семью');
  return {client,userId,item,family,canEdit:membership.role==='owner'||membership.role==='member'};
}
