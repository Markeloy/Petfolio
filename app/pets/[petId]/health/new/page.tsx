
import {getT} from "@/lib/i18n/server";
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { healthContext } from '@/lib/health/server';
import { localDate } from '@/lib/medications/schedule';
import { HealthHeader } from '../components';
import { HealthForm } from '../forms';
import { healthKinds,type HealthKind } from '@/lib/health/types';
export const dynamic='force-dynamic';
export default async function NewHealth({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{repeat?:string;kind?:string}>}) {
  const t=await getT();
  const {petId}=await params,{repeat:id,kind}=await searchParams,{client,pet,timezone}=await healthContext(petId);
  const initialKind=kind&&Object.hasOwn(healthKinds,kind)?kind as HealthKind:undefined;
  let repeat;
  if(id) {
    const {data,error}=await client.from('health_events').select('*').eq('pet_id',petId).eq('id',id).eq('status','completed').is('archived_at',null).not('next_due_on','is',null).maybeSingle();
    if(error)throw new Error('Не удалось загрузить исходное событие');if(!data)notFound();repeat=data;
  }
  return <main className="detailShell healthShell"><HealthHeader petId={petId} name={pet.name} title={repeat?t("Повторное событие"):t("Новое событие")} back={`/pets/${petId}/health`}/><HealthForm petId={petId} id={randomUUID()} repeat={repeat} initialKind={initialKind} today={localDate(new Date(),timezone)}/></main>;
}
