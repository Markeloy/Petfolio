
import {getT} from "@/lib/i18n/server";
import { notFound } from 'next/navigation';
import { healthContext } from '@/lib/health/server';
import { localDate,formatMoment } from '@/lib/medications/schedule';
import { HealthHeader,AuditTrail } from '../../components';
import { WeightForm,ArchiveControl } from '../../forms';
export const dynamic='force-dynamic';
export default async function WeightDetail({params}:{params:Promise<{petId:string;recordId:string}>}) {
  const t=await getT();
  const {petId,recordId}=await params,{client,pet,timezone}=await healthContext(petId);
  const {data:record,error}=await client.from('weight_records').select('*').eq('pet_id',petId).eq('id',recordId).maybeSingle();
  if(error)throw new Error('Не удалось открыть измерение');if(!record)notFound();
  const time=new Date(record.measured_at),datetime=`${localDate(time,timezone)}T${new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(time)}`;
  return <main className="detailShell healthShell"><HealthHeader petId={petId} name={pet.name} title={record.archived_at?t("Измерение в архиве"):t("Измерение веса")} back={`/pets/${petId}/health/weight`}/>
    {record.archived_at?<section className="formSectionCard"><h2>{record.weight_kg.toLocaleString(t('ru-RU'))} {' '}{t("кг")}</h2><p>{formatMoment(record.measured_at,timezone,t('ru-RU'))}</p><p className="healthNotes">{record.notes}</p></section>:<WeightForm petId={petId} id={recordId} record={record} datetime={datetime} timezone={timezone}/>}
    <ArchiveControl petId={petId} id={recordId} version={record.updated_at} table="weight_records" archived={!!record.archived_at}/>
    <AuditTrail petId={petId} id={recordId} table="weight_records"/>
  </main>;
}
