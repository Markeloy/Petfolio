import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReminderView } from '@/lib/medications/reminders';
import { localDate,wallToInstant } from '@/lib/medications/schedule';
import { dueDate,dateLabel,healthKinds } from './types';
export async function getHealthReminders(client:SupabaseClient<Database>,petIds:string[],timezone:string,now=new Date(),t:(text:string)=>string=text=>text) {
  const result=new Map<string,ReminderView>(),today=localDate(now,timezone);
  // Per-pet limited queries do not lose a pet's reminder behind another pet's history.
  const sets=await Promise.all(petIds.map(async petId=>{
    const [plan,repeat]=await Promise.all([
      client.from('health_events').select('*').eq('pet_id',petId).is('archived_at',null).eq('status','planned').gte('event_on',today).order('event_on').order('id').limit(1),
      client.from('health_events').select('*').eq('pet_id',petId).is('archived_at',null).eq('status','completed').gte('next_due_on',today).order('next_due_on').order('id').limit(1),
    ]);
    if(plan.error||repeat.error)return null;
    return [...(plan.data??[]),...(repeat.data??[])];
  }));
  if(sets.some(s=>s===null))return null;
  for(const events of sets)for(const event of events??[]) {
    const date=dueDate(event);if(!date)continue;
    const instant=wallToInstant(date,'00:00',timezone)??wallToInstant(date,'12:00',timezone);if(!instant)continue;
    if(result.has(event.pet_id)&&Date.parse(result.get(event.pet_id)!.instant)<=Date.parse(instant))continue;
    result.set(event.pet_id,{kind:'health',href:`/pets/${event.pet_id}/health/events/${event.id}`,name:event.title,dose:t(healthKinds[event.kind]),instant,
      when:`${date===today?t('Сегодня'):dateLabel(date,t('ru-RU'))}${event.status==='completed'?t(' · следующая дата'):''}`});
  }
  return result;
}
