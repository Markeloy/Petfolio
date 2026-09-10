import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
import {allPages,type CalendarEntry} from '@/lib/calendar/data';
import type {ReminderView} from '@/lib/medications/reminders';
import {wallToInstant,localDate} from '@/lib/medications/schedule';
import {dateLabel} from '@/lib/health/types';
import {procedureKinds} from './types';
export async function procedureReminders(client:SupabaseClient<Database>,petIds:string[],now=new Date(),t:(text:string)=>string=text=>text){
 const result=new Map<string,ReminderView>();if(!petIds.length)return result;
 try{const plans=await allPages((from,to)=>client.from('care_procedures').select('*').in('pet_id',petIds).is('archived_at',null).not('next_on','is',null).order('id').range(from,to));
 for(const p of plans){if(!p.next_on)continue;const instant=wallToInstant(p.next_on,'12:00',p.timezone);if(!instant)continue;const current=result.get(p.pet_id);if(current&&current.instant<=instant)continue;result.set(p.pet_id,{href:`/pets/${p.pet_id}/care/procedures/${p.id}`,name:p.title,dose:t(procedureKinds[p.kind]),when:`${p.next_on<localDate(now,p.timezone)?t('Просрочено')+' · ':''}${dateLabel(p.next_on,t('ru-RU'))}`,instant,kind:'procedure'});}return result;
 }catch{return null;}
}
export async function procedureCalendar(client:SupabaseClient<Database>,petIds:string[],day:string,t:(text:string)=>string=text=>text):Promise<CalendarEntry[]>{
 if(!petIds.length)return [];const [plans,logs]=await Promise.all([allPages((from,to)=>client.from('care_procedures').select('*').in('pet_id',petIds).is('archived_at',null).eq('next_on',day).order('id').range(from,to)),allPages((from,to)=>client.from('care_procedure_logs').select('*').in('pet_id',petIds).eq('scheduled_on',day).order('id').range(from,to))]);
 return [...plans.map(p=>({id:`procedure:${p.id}:${day}`,petId:p.pet_id,title:p.title,detail:t(procedureKinds[p.kind]),status:'По расписанию',done:false,instant:null,href:`/pets/${p.pet_id}/care/procedures/${p.id}`})),...logs.map(l=>({id:`procedure-log:${l.id}`,petId:l.pet_id,title:l.title,detail:t('Процедура'),status:l.status==='done'?'Выполнено':'Пропущено',done:true,instant:null,href:`/pets/${l.pet_id}/care/procedures/${l.procedure_id}`}))];
}
