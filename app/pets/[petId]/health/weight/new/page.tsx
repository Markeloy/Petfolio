
import {getT} from "@/lib/i18n/server";
import { randomUUID } from 'node:crypto';
import { healthContext } from '@/lib/health/server';
import { localDate } from '@/lib/medications/schedule';
import { HealthHeader } from '../../components';
import { WeightForm } from '../../forms';
export const dynamic='force-dynamic';
export default async function NewWeight({params}:{params:Promise<{petId:string}>}) {
  const t=await getT();
  const {petId}=await params,{pet,timezone}=await healthContext(petId),now=new Date();
  const datetime=`${localDate(now,timezone)}T${new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now)}`;
  return <main className="detailShell healthShell"><HealthHeader petId={petId} name={pet.name} title={t("Новое измерение")} back={`/pets/${petId}/health/weight`}/><WeightForm petId={petId} id={randomUUID()} datetime={datetime} timezone={timezone}/></main>;
}
