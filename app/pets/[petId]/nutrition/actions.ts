'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {quantity} from '@/lib/stock/validation';
import {foodUnits} from '@/lib/feeding/types';
import type {Json} from '@/lib/supabase/database.types';
export type FeedingState={error?:string;success?:string};
export async function saveFeeding(mode:string,petId:string,planId:string,requestId:string,version:string,day:string,instant:string,_state:FeedingState,form:FormData):Promise<FeedingState> {
  let values:Record<string,Json>={version};
  try {
    if(mode==='create'||mode==='revise') {
      const food=String(form.get('food')??'').trim(),unit=String(form.get('unit')??''),time=String(form.get('time')??''),stock_id=String(form.get('stock_id')??''),notes=String(form.get('notes')??'').trim();
      if(!food||food.length>100||!foodUnits.includes(unit as typeof foodUnits[number])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||notes.length>2000)throw new Error('Проверьте название корма, время и единицу измерения');
      if(stock_id&&!/^[0-9a-f-]{36}$/i.test(stock_id))throw new Error('Выберите корм из списка запасов');
      values={...values,food,unit,time,stock_id,notes,amount:quantity(form.get('amount'),true)};
    } else if(mode==='mark') {
      const status=String(form.get('status')??'');
      if(status!=='fed'&&status!=='skipped')throw new Error('Выберите отметку');
      values={day,instant,status};
    } else if(mode==='archive'||mode==='restore') {
      if(form.get('confirm')!=='yes')throw new Error('Подтвердите действие');
    } else throw new Error('Неизвестное действие');
  }catch(error){return {error:error instanceof Error?error.message:'Проверьте поля'};}
  const client=await createClient();
  const {data,error}=await client.rpc('feeding_action',{p_action:mode,p_pet:petId,p_plan:planId,p_request:requestId,p_values:values});
  if(error)return {error:error.code==='P0001'?error.message:'Не удалось сохранить. Обновите страницу и проверьте доступ'};
  revalidatePath('/');revalidatePath('/calendar');revalidatePath('/stock','layout');revalidatePath(`/pets/${petId}/nutrition`,'layout');
  if(mode==='create'||mode==='revise')redirect(`/pets/${petId}/nutrition/${data}`);
  return {success:'Сохранено. Если кормление уже отмечено, первая отметка сохранена.'};
}
