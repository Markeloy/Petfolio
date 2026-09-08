'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { healthContext } from '@/lib/health/server';
import { localDate,wallToInstant } from '@/lib/medications/schedule';
import { parseHealth,parseWeight } from '@/lib/health/validation';
export type FormState={error:string};
function invalidate(petId:string) {revalidatePath('/');revalidatePath('/calendar');revalidatePath(`/pets/${petId}/health`,'layout');}
const conflict='Запись уже изменена другим участником. Обновите страницу перед повторным редактированием.';

export async function saveHealth(petId:string,id:string,version:string|null,source:{id:string;version:string}|null,_state:FormState,form:FormData):Promise<FormState> {
  const {client,timezone,userId}=await healthContext(petId);
  let values;try{values=parseHealth(form,localDate(new Date(),timezone));}catch(e){return {error:e instanceof Error?e.message:'Проверьте поля.'};}
  if(source) {
    const {data:original}=await client.from('health_events').select('id').eq('id',source.id).eq('pet_id',petId).maybeSingle();
    if(!original)return {error:'Исходная запись недоступна.'};
    const {error}=await client.rpc('record_health_followup',{p_source_id:source.id,p_expected_updated_at:source.version,p_new_id:id,p_values:values});
    if(error)return {error:error.code==='40001'?conflict:'Не удалось записать повтор. Проверьте дату и состояние исходного события.'};
  } else if(version) {
    const {data,error}=await client.from('health_events').update(values).eq('id',id).eq('pet_id',petId).eq('updated_at',version).is('archived_at',null).select('id').maybeSingle();
    if(error) return {error:'Не удалось сохранить изменения. Поля сохранены в форме.'};
    if(!data) return {error:conflict};
  } else {
    const {error}=await client.from('health_events').insert({...values,id,pet_id:petId,created_by:userId});
    if(error) {
      if(error.code!=='23505') return {error:'Не удалось сохранить событие. Попробуйте снова.'};
      const {data:existing}=await client.from('health_events').select('id').eq('id',id).eq('pet_id',petId).eq('created_by',userId).maybeSingle();
      if(!existing) return {error:'Не удалось сохранить событие.'};
    }
  }
  invalidate(petId);redirect(`/pets/${petId}/health/events/${id}?saved=1`);
}

export async function saveWeight(petId:string,id:string,version:string|null,_state:FormState,form:FormData):Promise<FormState> {
  const {client,userId,timezone}=await healthContext(petId);
  let values;
  try {
    const parsed=parseWeight(form);
    const instant=wallToInstant(parsed.datetime.slice(0,10),parsed.datetime.slice(11),timezone);
    if(!instant||Date.parse(instant)>Date.now()) throw new Error('Измерение должно быть в прошлом или сейчас. Проверьте время.');
    values={weight_kg:parsed.weight_kg,notes:parsed.notes,measured_at:instant};
  } catch(e){return {error:e instanceof Error?e.message:'Проверьте поля.'};}
  if(version) {
    const {data,error}=await client.from('weight_records').update(values).eq('id',id).eq('pet_id',petId).eq('updated_at',version).is('archived_at',null).select('id').maybeSingle();
    if(error)return {error:'Не удалось сохранить измерение.'};if(!data)return {error:conflict};
  } else {
    const {error}=await client.from('weight_records').insert({...values,id,pet_id:petId,created_by:userId});
    if(error) {
      if(error.code!=='23505')return {error:'Не удалось записать вес. Попробуйте снова.'};
      const {data:existing}=await client.from('weight_records').select('id').eq('id',id).eq('pet_id',petId).eq('created_by',userId).maybeSingle();
      if(!existing)return {error:'Не удалось записать вес.'};
    }
  }
  invalidate(petId);redirect(`/pets/${petId}/health/weight?saved=1`);
}

export async function archiveRecord(petId:string,id:string,version:string,table:'health_events'|'weight_records',restore:boolean,_state:FormState):Promise<FormState> {
  if(!['health_events','weight_records'].includes(table))return {error:'Неизвестная запись.'};
  const {client}=await healthContext(petId);
  const {data,error}=await client.from(table).update({archived_at:restore?null:new Date().toISOString()}).eq('id',id).eq('pet_id',petId).eq('updated_at',version).select('id').maybeSingle();
  if(error)return {error:'Не удалось изменить архив.'};if(!data)return {error:conflict};
  invalidate(petId);
  redirect(table==='health_events'?`/pets/${petId}/health/events/${id}?saved=1`:`/pets/${petId}/health/weight?saved=1`);
}
