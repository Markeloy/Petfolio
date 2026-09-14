'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { familyMemberships, selectFamily } from '@/lib/family/server';
import { invitationCode } from '@/lib/family/selection';
export type FamilyState={error?:string;message?:string;code?:string;expires?:string};
export async function familyAction(_state:FamilyState,form:FormData):Promise<FamilyState> {
  const client=await createClient();
  const {data:claims,error:authError}=await client.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(authError||typeof userId!=='string')return {error:'Войдите в аккаунт заново'};
  const action=String(form.get('action')??'');
  const household=String(form.get('household')??'');
  if(action==='switch') {
    const {memberships}=await familyMemberships(client,userId);
    if(!memberships.some(m=>m.household_id===household))return {error:'Семья больше недоступна'};
    await selectFamily(household);
  } else {
    if(!['join','create','revoke','remove','leave','transfer','rename'].includes(action))return {error:'Неизвестное действие'};
    if(['remove','leave','transfer'].includes(action)&&form.get('confirm')!=='yes')return {error:'Подтвердите действие'};
    const code=invitationCode(form.get('code'));
    if(action==='join'&&!code)return {error:'Вставьте код приглашения целиком'};
    const target=String(form.get('target')??'');
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(action!=='join'&&!uuid.test(household))return {error:'Семья недоступна'};
    if(target&&!uuid.test(target))return {error:'Запись недоступна'};
    const {data,error}=await client.rpc('family_action',{p_action:action,...(household?{p_household:household}:{}),...(code?{p_token:code}:{}),...(target?{p_target:target}:{}),...(action==='rename'?{p_name:String(form.get('name')??'').trim()}:{} )});
    if(error)return {error:error.code==='P0001'?error.message:'Не удалось выполнить действие. Обновите страницу и проверьте доступ к семье'};
    const result=data as {household_id?:string;code?:string;expires_at?:string};
    if(action==='join'&&result.household_id)await selectFamily(result.household_id);
    revalidatePath('/','layout');
    if(action==='create')return {code:result.code,expires:result.expires_at,message:'Приглашение создано'};
  }
  revalidatePath('/','layout');
  return {message:action==='join'?'Вы присоединились к семье':action==='switch'?'Семья выбрана':'Готово'};
}
