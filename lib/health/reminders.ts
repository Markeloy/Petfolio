import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReminderView } from '@/lib/medications/reminders';
import { localDate,wallToInstant } from '@/lib/medications/schedule';
import { dueDate,dateLabel,healthKinds } from './types';
export async function getHealthReminders(client:SupabaseClient<Database>,petIds:string[],timezone:string,now=new Date(),t:(text:string)=>string=text=>text) {
  const result=new Map<string,ReminderView>(),today=localDate(now,timezone);
  if(!petIds.length)return result;
  // Each embedded relation is limited independently per parent by PostgREST.
  const {data,error}=await client.from('pets')
    .select('id,planned:health_events(*),repeats:health_events(*)').in('id',petIds)
    .is('planned.archived_at',null).eq('planned.status','planned').gte('planned.event_on',today)
    .order('event_on',{referencedTable:'planned'}).order('id',{referencedTable:'planned'}).limit(1,{referencedTable:'planned'})
    .is('repeats.archived_at',null).eq('repeats.status','completed').gte('repeats.next_due_on',today)
    .order('next_due_on',{referencedTable:'repeats'}).order('id',{referencedTable:'repeats'}).limit(1,{referencedTable:'repeats'});
  if(error)return null;
  for(const pet of data??[])for(const event of [...pet.planned,...pet.repeats]) {
    const date=dueDate(event);if(!date)continue;
    const instant=wallToInstant(date,'00:00',timezone)??wallToInstant(date,'12:00',timezone);if(!instant)continue;
    if(result.has(event.pet_id)&&Date.parse(result.get(event.pet_id)!.instant)<=Date.parse(instant))continue;
    result.set(event.pet_id,{kind:'health',href:`/pets/${event.pet_id}/health/events/${event.id}`,name:event.title,dose:t(healthKinds[event.kind]),instant,
      when:`${date===today?t('Сегодня'):dateLabel(date,t('ru-RU'))}${event.status==='completed'?t(' · следующая дата'):''}`});
  }
  return result;
}
