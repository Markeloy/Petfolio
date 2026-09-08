import {notFound} from 'next/navigation';
import {healthContext} from '@/lib/health/server';
import {allPages,type CalendarEntry} from '@/lib/calendar/data';
import {addDays,localDate,formatMoment} from '@/lib/medications/schedule';
import {amountLabel} from '@/lib/stock/types';
import {feedingOn} from './schedule';
import type {ReminderView} from '@/lib/medications/reminders';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/database.types';
export async function feedingContext(petId:string) {
  const context=await healthContext(petId);
  const {data:pet,error}=await context.client.from('pets').select('household_id').eq('id',petId).single();
  if(error)throw new Error('Не удалось загрузить питомца');
  const {data:member,error:memberError}=await context.client.from('household_members').select('role').eq('household_id',pet.household_id).eq('user_id',context.userId).maybeSingle();
  if(memberError)throw new Error('Не удалось проверить доступ');
  if(!member)notFound();
  return {...context,householdId:pet.household_id,canEdit:member.role==='owner'||member.role==='member'};
}
export async function feedingCalendar(client:SupabaseClient<Database>,petIds:string[],day:string,timezone:string,now=new Date()):Promise<CalendarEntry[]> {
  const entries:CalendarEntry[]=[];
  for(const petId of petIds) {
    const [plans,logs]=await Promise.all([
      allPages((from,to)=>client.from('feeding_plans').select('*').eq('pet_id',petId).order('id').range(from,to)),
      allPages((from,to)=>client.from('feeding_logs').select('*').eq('pet_id',petId).gte('scheduled_for',`${addDays(day,-1)}T00:00:00Z`).lt('scheduled_for',`${addDays(day,2)}T00:00:00Z`).order('id').range(from,to)),
    ]);
    const recorded=new Set<string>();
    for(const log of logs) {
      if(localDate(new Date(log.scheduled_for),timezone)!==day)continue;
      recorded.add(`${log.plan_id}:${log.planned_on}`);
      entries.push({id:`feeding:${log.id}`,petId,title:log.food,detail:`Кормление · ${amountLabel(log.amount,log.unit)}`,status:log.status==='fed'?'Покормил':'Пропущено',done:true,instant:log.scheduled_for,href:`/pets/${petId}/nutrition/${log.plan_id}`});
    }
    if(day<localDate(now,timezone))continue;
    for(const plan of plans)for(let offset=-2;offset<=2;offset++) {
      const date=addDays(day,offset),instant=feedingOn(plan,date);
      if(!instant||localDate(new Date(instant),timezone)!==day||recorded.has(`${plan.id}:${date}`))continue;
      entries.push({id:`feeding:${plan.id}:${date}`,petId,title:plan.food,detail:`Кормление · ${amountLabel(plan.amount,plan.unit)}`,status:Date.parse(instant)<=now.getTime()?'Не отмечено':'По расписанию',done:false,instant,href:`/pets/${petId}/nutrition/${plan.id}`});
    }
  }
  return entries;
}
export async function feedingReminders(client:SupabaseClient<Database>,petIds:string[],now=new Date()) {
  const result=new Map<string,ReminderView>();
  try {
    for(const petId of petIds) {
      const plans=await allPages((from,to)=>client.from('feeding_plans').select('*').eq('pet_id',petId).is('archived_at',null).order('id').range(from,to));
      const logs=await allPages((from,to)=>client.from('feeding_logs').select('plan_id,planned_on').eq('pet_id',petId).gt('scheduled_for',now.toISOString()).order('id').range(from,to));
      const recorded=new Set(logs.map(log=>`${log.plan_id}:${log.planned_on}`));
      for(const plan of plans) {
        const start=[localDate(now,plan.timezone),plan.active_from].sort().at(-1)!;
        for(let offset=0;offset<3;offset++) {
          const day=addDays(start,offset),instant=feedingOn(plan,day);
          if(!instant||Date.parse(instant)<=now.getTime()||recorded.has(`${plan.id}:${day}`))continue;
          if(!result.has(petId)||Date.parse(instant)<Date.parse(result.get(petId)!.instant))result.set(petId,{kind:'feeding',name:plan.food,dose:amountLabel(plan.amount,plan.unit),instant,when:`${formatMoment(instant,plan.timezone)} · ${plan.timezone}`,href:`/pets/${petId}/nutrition/${plan.id}`});
          break;
        }
      }
    }
    return result;
  }catch{return null;}
}
