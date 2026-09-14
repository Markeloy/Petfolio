'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {parseSettings} from '@/lib/auth/settings';
export async function saveSettings(version:string,_state:{error?:string},form:FormData):Promise<{error?:string}> {
  const client=await createClient();
  const {data,error:authError}=await client.auth.getClaims();
  if(authError||typeof data?.claims?.sub!=='string')redirect('/login');
  let values;
  try{values=parseSettings(form);}catch(error){return {error:error instanceof Error?error.message:'Проверьте поля'};}
  const result=await client.from('profiles').update({...values,updated_at:new Date().toISOString()}).eq('id',data.claims.sub).eq('updated_at',version).select('id').maybeSingle();
  if(result.error)return {error:'Не удалось сохранить настройки. Попробуйте снова'};
  if(!result.data)return {error:'Настройки изменились в другой вкладке. Обновите страницу'};
  revalidatePath('/','layout');redirect('/settings?saved=1');
}
