import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
import type {ReminderView} from '@/lib/medications/reminders';
import {allPages,type CalendarEntry} from '@/lib/calendar/data';
import {addDays,localDate,formatMoment} from '@/lib/medications/schedule';
import {activityKinds,activityStatuses} from './types';
export async function activityCalendar(client:SupabaseClient<Database>,petIds:string[],day:string,timezone:string,t:(text:string)=>string=text=>text):Promise<CalendarEntry[]> {
  const result:CalendarEntry[]=[];
  for(const petId of petIds) {
    const rows=await allPages((from,to)=>client.from('pet_activities').select('*').eq('pet_id',petId).is('archived_at',null).gte('started_at',`${addDays(day,-1)}T00:00:00Z`).lt('started_at',`${addDays(day,2)}T00:00:00Z`).order('id').range(from,to));
    for(const row of rows)if(localDate(new Date(row.started_at),timezone)===day)result.push({id:`activity:${row.id}`,petId,title:row.title,detail:`${t(activityKinds[row.kind])} · ${row.duration_minutes} ${t('мин')}`,status:activityStatuses[row.status],done:row.status!=='planned',instant:row.started_at,href:`/pets/${petId}/activity/${row.id}`});
  }
  return result;
}
export async function activityReminders(client:SupabaseClient<Database>,petIds:string[],timezone:string,now=new Date(),t:(text:string)=>string=text=>text) {
  const result=new Map<string,ReminderView>();
  const states=await Promise.all(petIds.map(async petId=>{
    const {data,error}=await client.from('pet_activities').select('*').eq('pet_id',petId).is('archived_at',null).eq('status','planned').gt('started_at',now.toISOString()).order('started_at').order('id').limit(1).maybeSingle();
    if(error)return false;
    if(data)result.set(petId,{kind:'activity',href:`/pets/${petId}/activity/${data.id}`,name:data.title,dose:`${t(activityKinds[data.kind])} · ${data.duration_minutes} ${t('мин')}`,instant:data.started_at,when:`${formatMoment(data.started_at,timezone,t('ru-RU'))} · ${timezone}`});
    return true;
  }));
  return states.every(Boolean)?result:null;
}
