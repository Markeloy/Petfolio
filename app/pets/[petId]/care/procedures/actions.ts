'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {feedingContext} from '@/lib/feeding/server';
import {parseProcedure} from '@/lib/procedures/types';
import type {Json} from '@/lib/supabase/database.types';
export type ProcedureState={error?:string;success?:string};
export async function saveProcedure(mode:string,petId:string,id:string,version:string,day:string,_state:ProcedureState,form:FormData):Promise<ProcedureState>{
 const {client,canEdit}=await feedingContext(petId);
 if(!canEdit)return {error:'Нет права изменять процедуры'};
 let values:Record<string,Json>={version};
 if(mode==='create'||mode==='edit'){try{values={...values,...parseProcedure(form)};}catch{return {error:'Проверьте поля процедуры'};}}
 else if(mode==='mark'){values={...values,day,status:String(form.get('status'))};}
 else if(mode==='archive'||mode==='restore'){if(form.get('confirm')!=='yes')return {error:'Подтвердите действие'};}
 else return {error:'Неизвестное действие'};
 const {error}=await client.rpc('procedure_action',{p_action:mode,p_pet:petId,p_id:id,p_values:values});
 if(error)return {error:error.code==='P0001'?error.message:'Не удалось сохранить. Обновите страницу и проверьте доступ'};
 revalidatePath('/');revalidatePath('/calendar');revalidatePath(`/pets/${petId}/care`,'layout');
 if(mode==='create'||mode==='edit')redirect(`/pets/${petId}/care/procedures/${id}`);
 return {success:'Сохранено'};
}
