import Link from 'next/link';
import { healthContext,authorNames } from '@/lib/health/server';
import { formatMoment } from '@/lib/medications/schedule';
import { pageIndex } from '@/lib/health/validation';
import { HealthHeader } from '../components';
import { RefreshOnFocus } from '@/app/components/refresh-on-focus';
export const dynamic='force-dynamic';
export default async function WeightPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{archive?:string;page?:string;saved?:string}>}) {
  const {petId}=await params,q=await searchParams,{client,pet,timezone}=await healthContext(petId),page=pageIndex(q.page),archive=q.archive==='1';
  let query=client.from('weight_records').select('*').eq('pet_id',petId);
  query=archive?query.not('archived_at','is',null):query.is('archived_at',null);
  const [records,latest]=await Promise.all([
    query.order('measured_at',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20),
    client.from('weight_records').select('weight_kg,measured_at').eq('pet_id',petId).is('archived_at',null).order('measured_at',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(2),
  ]);
  if(records.error||latest.error)throw new Error('Не удалось загрузить вес');
  const rows=(records.data??[]).slice(0,20),names=await authorNames(client,rows.map(r=>r.created_by)),current=latest.data?.[0],previous=latest.data?.[1];
  const change=current&&previous?Number((current.weight_kg-previous.weight_kg).toFixed(3)):null;
  const link=(p:number)=>`/pets/${petId}/health/weight?page=${p}${archive?'&archive=1':''}`;
  return <main className="detailShell healthShell"><RefreshOnFocus/><HealthHeader petId={petId} name={pet.name} title="Вес" back={`/pets/${petId}/health`}/>
    {q.saved&&<p className="formNotice" role="status">Изменения сохранены.</p>}
    <section className="formSectionCard"><h2>{current?`${current.weight_kg.toLocaleString('ru-RU')} кг`:'Измерений пока нет'}</h2>
      {current&&<p>{formatMoment(current.measured_at,timezone)}</p>}
      {change!==null&&<p>С предыдущего измерения: {change>0?'+':''}{change.toLocaleString('ru-RU')} кг</p>}
      <Link className="primaryAction inlineAction" href={`/pets/${petId}/health/weight/new`}>＋ Записать вес</Link>
    </section>
    <section className="careSection"><h2>{archive?'Архив измерений':'История измерений'}</h2><p><Link href={`/pets/${petId}/health/weight${archive?'':'?archive=1'}`}>{archive?'К истории':'Открыть архив'}</Link></p>
      {!rows.length&&<p className="emptyStateCard">На этой странице нет измерений.</p>}
      <div className="medicationList">{rows.map(r=><Link key={r.id} className="medicationCard medicationLink" href={`/pets/${petId}/health/weight/${r.id}`}><strong>{r.weight_kg.toLocaleString('ru-RU')} кг</strong><p>{formatMoment(r.measured_at,timezone)}</p>{r.notes&&<p className="healthNotes">{r.notes}</p>}<small>{names.get(r.created_by)}</small></Link>)}</div>
      <nav className="doseActions" aria-label="Страницы веса">{page>0&&<Link className="secondaryAction inlineAction" href={link(page-1)}>Назад</Link>}{(records.data?.length??0)>20&&<Link className="secondaryAction inlineAction" href={link(page+1)}>Далее</Link>}</nav>
    </section>
  </main>;
}
