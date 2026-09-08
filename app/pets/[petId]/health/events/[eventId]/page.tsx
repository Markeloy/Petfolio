import Link from 'next/link';
import { notFound } from 'next/navigation';
import { healthContext,authorNames } from '@/lib/health/server';
import { healthKinds,healthStatuses,dateLabel } from '@/lib/health/types';
import { HealthHeader,AuditTrail } from '../../components';
import { ArchiveControl } from '../../forms';
export const dynamic='force-dynamic';
export default async function EventPage({params,searchParams}:{params:Promise<{petId:string;eventId:string}>;searchParams:Promise<{saved?:string}>}) {
  const {petId,eventId}=await params,{saved}=await searchParams,{client,pet}=await healthContext(petId);
  const {data:event,error}=await client.from('health_events').select('*').eq('id',eventId).eq('pet_id',petId).maybeSingle();
  if(error)throw new Error('Не удалось открыть событие');if(!event)notFound();
  const names=await authorNames(client,[event.created_by,...(event.updated_by?[event.updated_by]:[])]);
  return <main className="detailShell healthShell"><HealthHeader petId={petId} name={pet.name} title={event.title} back={`/pets/${petId}/health`}/>
    {saved&&<p className="formNotice" role="status">Сохранено. Запись доступна семье.</p>}
    <article className="formSectionCard"><p>{healthKinds[event.kind]} · {dateLabel(event.event_on)}</p><h2>{event.archived_at?'В архиве':event.kind==='symptom'&&event.status==='completed'?'Наблюдение записано':healthStatuses[event.status]}</h2>
      {event.next_due_on&&<p>Следующая дата: {dateLabel(event.next_due_on)}</p>}
      {event.product&&<p>Препарат: {event.product}</p>}{event.clinic&&<p>Клиника: {event.clinic}</p>}{event.veterinarian&&<p>Ветеринар: {event.veterinarian}</p>}
      {event.notes&&<p className="healthNotes">{event.notes}</p>}<p>Добавил(а): {names.get(event.created_by)}</p>
    </article>
    {!event.archived_at&&<Link className="primaryAction inlineAction" href={`/pets/${petId}/health/events/${eventId}/edit`}>{event.status==='planned'?'Отметить выполнение / редактировать':'Редактировать'}</Link>}
    {!event.archived_at&&event.status==='completed'&&event.next_due_on&&<p><Link className="secondaryAction inlineAction" href={`/pets/${petId}/health/new?repeat=${event.id}`}>Записать повторное событие</Link></p>}
    <ArchiveControl petId={petId} id={eventId} version={event.updated_at} table="health_events" archived={!!event.archived_at}/>
    <AuditTrail petId={petId} id={eventId} table="health_events"/>
  </main>;
}
