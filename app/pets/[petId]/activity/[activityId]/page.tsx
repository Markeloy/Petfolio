
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {feedingContext as activityContext} from '@/lib/feeding/server';
import {activityKinds,activityStatuses} from '@/lib/activity/types';
import {formatMoment,localDate} from '@/lib/medications/schedule';
import {ActivityForm} from '../forms';
export const dynamic='force-dynamic';
export default async function ActivityDetail({params}:{params:Promise<{petId:string;activityId:string}>}) {
  const t=await getT();
  const {petId,activityId}=await params,{client,pet,canEdit}=await activityContext(petId);
  if(!/^[0-9a-f-]{36}$/i.test(activityId))notFound();
  const {data:record,error}=await client.from('pet_activities').select('*').eq('pet_id',petId).eq('id',activityId).maybeSingle();
  if(error)throw new Error('Не удалось загрузить запись');if(!record)notFound();
  const instant=new Date(record.started_at),initialTime=localDate(instant,record.timezone)+'T'+new Intl.DateTimeFormat('en-GB',{timeZone:record.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant);
  const {data:audit,error:auditError}=await client.from('activity_log').select('id,action,created_at').eq('entity_type','pet_activities').eq('entity_id',record.id).order('created_at',{ascending:false}).order('id').limit(10);
  if(auditError)throw new Error('Не удалось загрузить историю изменений');
  return <div key={record.id}><Link href={`/pets/${petId}/activity`}>{t("← Активность")}</Link><p>{pet.name} · {t(activityKinds[record.kind])}</p><h1>{record.title}</h1><p>{t(activityStatuses[record.status])}{record.archived_at?t(" · В архиве"):''}</p><p>{formatMoment(record.started_at,record.timezone,t('ru-RU'))} · {record.timezone}</p><p>{record.duration_minutes} {' '}{t("минут")}{record.distance_km!==null?` · ${Number(record.distance_km).toLocaleString(t('ru-RU'))} ${t('км')}`:''}</p>{record.notes&&<p className="activityNotes">{record.notes}</p>}<p>{t("Добавил:")}{' '}{record.author_name}{t(". Последнее изменение:")}{' '}{record.editor_name}, {formatMoment(record.updated_at,record.timezone,t('ru-RU'))}.</p>
    {canEdit&&<section>{!record.archived_at&&<details open={record.status==='planned'}><summary>{record.status==='planned'?t("Отметить выполнение или изменить план"):t("Изменить запись")}</summary><ActivityForm mode="edit" petId={petId} id={record.id} record={record} initialTime={initialTime} key={record.updated_at}/></details>}<details><summary>{record.archived_at?t("Восстановить"):t("Убрать в архив")}</summary><ActivityForm mode={record.archived_at?'restore':'archive'} petId={petId} id={record.id} record={record} initialTime={initialTime}/></details></section>}
    <section><h2>{t("Последние изменения")}</h2><ul className="activityList">{audit?.map(row=><li key={row.id}>{({activity_create:t("Создано"),activity_edit:t("Изменено"),activity_archive:t("В архив"),activity_restore:t("Восстановлено")} as Record<string,string>)[row.action]??t("Изменение")} · {formatMoment(row.created_at,record.timezone,t('ru-RU'))}</li>)}</ul></section>
  </div>;
}
