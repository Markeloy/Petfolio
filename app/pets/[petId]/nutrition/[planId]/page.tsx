import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {feedingContext} from '@/lib/feeding/server';
import {allPages} from '@/lib/calendar/data';
import {localDate,formatMoment} from '@/lib/medications/schedule';
import {feedingOn} from '@/lib/feeding/schedule';
import {amountLabel} from '@/lib/stock/types';
import {FeedingForm} from '../forms';
export const dynamic='force-dynamic';
export default async function FeedingDetail({params}:{params:Promise<{petId:string;planId:string}>}) {
  const {petId,planId}=await params;const {client,pet,householdId,canEdit}=await feedingContext(petId);
  if(!/^[0-9a-f-]{36}$/i.test(planId))notFound();
  const {data:plan,error}=await client.from('feeding_plans').select('*').eq('id',planId).eq('pet_id',petId).maybeSingle();
  if(error)throw new Error('Не удалось загрузить расписание');if(!plan)notFound();
  const day=localDate(new Date(),plan.timezone),instant=feedingOn(plan,day);
  const [mark,successor,stocks]=await Promise.all([
    client.from('feeding_logs').select('*').eq('plan_id',plan.id).eq('planned_on',day).maybeSingle(),
    client.from('feeding_plans').select('id').eq('replaces_id',plan.id).maybeSingle(),
    allPages((from,to)=>client.from('stock_items').select('*').eq('household_id',householdId).eq('category','food').is('archived_at',null).order('id').range(from,to)),
  ]);
  if(mark.error||successor.error)throw new Error('Не удалось загрузить отметки');
  const stock=stocks.find(s=>s.id===plan.stock_item_id);
  return <div key={plan.id}><Link href={`/pets/${petId}/nutrition`}>← Питание</Link><p>{pet.name}</p><h1>{plan.food}</h1><p>Каждый день в {plan.scheduled_time.slice(0,5)} · {plan.timezone}</p><p className="feedingAmount">{amountLabel(plan.amount,plan.unit)}</p><p>С {plan.active_from}{plan.active_until?` по ${plan.active_until}`:''}{plan.archived_at?' · В архиве':''}</p>{plan.notes&&<p className="feedingNotes">{plan.notes}</p>}
    {plan.stock_item_id?<p><Link href={`/stock/${plan.stock_item_id}`}>Запас корма</Link>: {stock?amountLabel(stock.quantity,stock.unit):'недоступен или в архиве'}. При отметке «Покормил» спишется {amountLabel(plan.amount,plan.unit)}.</p>:<p>Автоматическое списание не подключено.</p>}
    <section><h2>Сегодня · {day}</h2>{mark.data?<><strong>{mark.data.status==='fed'?'Покормил':'Пропущено'}</strong><p>{mark.data.actor_name} · {formatMoment(mark.data.recorded_at,plan.timezone)}</p></>:instant?<><p>По расписанию: {formatMoment(instant,plan.timezone)}</p>{canEdit&&<FeedingForm mode="mark" petId={petId} planId={plan.id} requestId={randomUUID()} plan={plan} day={day} instant={instant} key={day}/>}</>:<p>На сегодня действующего кормления нет.</p>}</section>
    {successor.data&&<p><Link href={`/pets/${petId}/nutrition/${successor.data.id}`}>Открыть следующую версию расписания</Link></p>}
    {canEdit&&!successor.data&&(!plan.active_until||plan.active_until>=day)&&<section>{!plan.archived_at&&<details><summary>Изменить рацион с завтрашнего дня</summary><FeedingForm mode="revise" petId={petId} planId={plan.id} requestId={randomUUID()} plan={plan} stocks={stocks} key={plan.updated_at}/></details>}<details><summary>{plan.archived_at?'Восстановить расписание':'Остановить расписание'}</summary><FeedingForm mode={plan.archived_at?'restore':'archive'} petId={petId} planId={plan.id} requestId={randomUUID()} plan={plan}/></details></section>}
    <p><Link href={`/pets/${petId}/nutrition`}>История всех кормлений питомца</Link></p>
  </div>;
}
