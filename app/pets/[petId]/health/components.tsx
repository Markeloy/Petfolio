import Link from 'next/link';
import { authorNames,healthContext } from '@/lib/health/server';
import { formatMoment } from '@/lib/medications/schedule';
export function HealthHeader({petId,name,title,back}:{petId:string;name:string;title:string;back?:string}) {
  return <><div className="detailTopBar"><Link className="backButton" href={back??'/'} aria-label="Назад">‹</Link><div><p className="eyebrow">{name}</p><h1>{title}</h1></div></div>
    <nav className="healthTabs" aria-label="Разделы здоровья"><Link href={`/pets/${petId}/health`}>События</Link><Link href={`/pets/${petId}/health/weight`}>Вес</Link></nav></>;
}
export async function AuditTrail({petId,id,table}:{petId:string;id:string;table:string}) {
  const {client,timezone}=await healthContext(petId);
  const {data,error}=await client.from('activity_log').select('id,actor_id,action,created_at').eq('pet_id',petId).eq('entity_id',id).eq('entity_type',table).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(10);
  if(error)throw new Error('Не удалось загрузить историю изменений');
  const names=await authorNames(client,(data??[]).flatMap(r=>r.actor_id?[r.actor_id]:[]));
  const labels:Record<string,string>={created:'Добавлено',updated:'Изменено',archived:'Убрано в архив',restored:'Восстановлено'};
  return <section className="careSection"><h2>Последние изменения</h2>
    {!data?.length&&<p>Для этой записи ещё нет журнала изменений.</p>}
    <ul className="healthAudit">{data?.map(row=><li key={row.id}>{labels[row.action]??'Изменено'} · {names.get(row.actor_id??'')??'Участник семьи'}<br/><small>{formatMoment(row.created_at,timezone)}</small></li>)}</ul>
  </section>;
}
