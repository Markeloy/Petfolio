import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
import type {ReminderView} from '@/lib/medications/reminders';
import {allPages,type CalendarEntry} from '@/lib/calendar/data';
import {addDays,localDate,formatMoment} from '@/lib/medications/schedule';
import {activityKinds,activityStatuses} from './types';
export async function activityCalendar(client:SupabaseClient<Database>,petIds:string[],day:string,timezone:string,t:(text:string)=>string=text=>text):Promise<CalendarEntry[]> {
  const result:CalendarEntry[]=[];
  if(!petIds.length)return result;
  const rows=await allPages((from,to)=>client.from('pet_activities').select('*').in('pet_id',petIds).is('archived_at',null).gte('started_at',`${addDays(day,-1)}T00:00:00Z`).lt('started_at',`${addDays(day,2)}T00:00:00Z`).order('id').range(from,to));
  for(const row of rows)if(localDate(new Date(row.started_at),timezone)===day)result.push({id:`activity:${row.id}`,petId:row.pet_id,title:row.title,detail:`${t(activityKinds[row.kind])} · ${row.duration_minutes} ${t('мин')}`,status:activityStatuses[row.status],done:row.status!=='planned',instant:row.started_at,href:`/pets/${row.pet_id}/activity/${row.id}`});
  return result;
}
export async function activityReminders(client:SupabaseClient<Database>,petIds:string[],timezone:string,now=new Date(),t:(text:string)=>string=text=>text) {
  const result=new Map<string,ReminderView>();
  if(!petIds.length)return result;
  const {data,error}=await client.from('pets').select('id,pet_activities(*)').in('id',petIds)
    .is('pet_activities.archived_at',null).eq('pet_activities.status','planned').gt('pet_activities.started_at',now.toISOString())
    .order('started_at',{referencedTable:'pet_activities'}).order('id',{referencedTable:'pet_activities'}).limit(1,{referencedTable:'pet_activities'});
  if(error)return null;
  for(const pet of data??[])for(const row of pet.pet_activities)result.set(pet.id,{kind:'activity',href:`/pets/${pet.id}/activity/${row.id}`,name:row.title,dose:`${t(activityKinds[row.kind])} · ${row.duration_minutes} ${t('мин')}`,instant:row.started_at,when:`${formatMoment(row.started_at,timezone,t('ru-RU'))} · ${timezone}`});
  return result;
}
