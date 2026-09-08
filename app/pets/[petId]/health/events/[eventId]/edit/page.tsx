import { notFound,redirect } from 'next/navigation';
import { healthContext } from '@/lib/health/server';
import { localDate } from '@/lib/medications/schedule';
import { HealthHeader } from '../../../components';
import { HealthForm } from '../../../forms';
export const dynamic='force-dynamic';
export default async function EditHealth({params}:{params:Promise<{petId:string;eventId:string}>}) {
  const {petId,eventId}=await params,{client,pet,timezone}=await healthContext(petId);
  const {data:event,error}=await client.from('health_events').select('*').eq('id',eventId).eq('pet_id',petId).maybeSingle();
  if(error)throw new Error('Не удалось открыть событие');if(!event)notFound();if(event.archived_at)redirect(`/pets/${petId}/health/events/${eventId}`);
  return <main className="detailShell healthShell"><HealthHeader petId={petId} name={pet.name} title="Изменить событие" back={`/pets/${petId}/health/events/${eventId}`}/><HealthForm petId={petId} id={eventId} event={event} today={localDate(new Date(),timezone)}/></main>;
}
