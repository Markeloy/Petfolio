import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { chooseHousehold } from './selection';
export const FAMILY_COOKIE='petfolio-family';
export async function familyMemberships(client:SupabaseClient<Database>,userId:string) {
  const {data,error}=await client.from('household_members').select('household_id,role,joined_at').eq('user_id',userId).order('joined_at').order('household_id');
  if(error)throw new Error('Не удалось загрузить семьи');
  const memberships=data??[];
  return {memberships,active:chooseHousehold(memberships,(await cookies()).get(FAMILY_COOKIE)?.value)};
}
export async function selectFamily(householdId:string) {
  (await cookies()).set(FAMILY_COOKIE,householdId,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*365});
}
