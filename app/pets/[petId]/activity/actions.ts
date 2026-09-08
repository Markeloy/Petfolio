'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {feedingContext as activityContext} from '@/lib/feeding/server';
import {parseActivity} from '@/lib/activity/types';
import {wallToInstant} from '@/lib/medications/schedule';
import type {Json} from '@/lib/supabase/database.types';
export type ActivityState={error?:string;success?:string};
export async function saveActivity(mode:string,petId:string,id:string,version:string,_state:ActivityState,form:FormData):Promise<ActivityState> {
  const {client,timezone}=await activityContext(petId);
  let values:Record<string,Json>={version};
  if(mode==='create'||mode==='edit') {
    let zone=timezone;
    if(mode==='edit') {
      const {data,error}=await client.from('pet_activities').select('timezone').eq('id',id).eq('pet_id',petId).maybeSingle();
      if(error||!data)return {error:'Запись недоступна'};zone=data.timezone;
    }
    try {
      const parsed=parseActivity(form),instant=wallToInstant(parsed.datetime.slice(0,10),parsed.datetime.slice(11),zone);
      if(!instant)throw new Error('Такого местного времени нет из-за перевода часов. Укажите другое время');
      if(parsed.status==='completed'&&Date.parse(instant)+parsed.duration_minutes*60000>Date.now())throw new Error('Активность ещё не закончилась. Проверьте начало и длительность или выберите «Запланировано»');
      const {datetime:_,...data}=parsed;values={...values,...data,started_at:instant};
    }catch(error){return {error:error instanceof Error?error.message:'Проверьте поля'};}
  }else if(mode==='archive'||mode==='restore') {
    if(form.get('confirm')!=='yes')return {error:'Подтвердите действие'};
  }else return {error:'Неизвестное действие'};
  const {error}=await client.rpc('activity_action',{p_action:mode,p_pet:petId,p_activity:id,p_values:values});
  if(error)return {error:error.code==='P0001'?error.message:'Не удалось сохранить. Обновите страницу и проверьте доступ'};
  revalidatePath('/');revalidatePath('/calendar');revalidatePath(`/pets/${petId}/activity`,'layout');
  if(mode==='create'||mode==='edit')redirect(`/pets/${petId}/activity/${id}`);
  return {success:'Сохранено'};
}
