import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {feedingContext as activityContext} from '@/lib/feeding/server';
import {localDate} from '@/lib/medications/schedule';
import {ActivityForm} from '../forms';
export const dynamic='force-dynamic';
export default async function NewActivity({params}:{params:Promise<{petId:string}>}) {
  const {petId}=await params,{pet,canEdit,timezone}=await activityContext(petId);const begin=new Date(new Date().getTime()-30*60000);
  const initialTime=localDate(begin,timezone)+'T'+new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(begin);
  return <><Link href={`/pets/${petId}/activity`}>← Активность</Link><h1>Новая активность</h1><p>{pet.name} · {timezone}</p>{canEdit?<ActivityForm mode="create" petId={petId} id={randomUUID()} initialTime={initialTime}/>:<p>У вас нет права изменять активность.</p>}</>;
}
