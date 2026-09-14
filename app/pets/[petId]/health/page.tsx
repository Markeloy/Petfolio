
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import { healthContext,authorNames } from '@/lib/health/server';
import { healthKinds,healthStatuses,dateLabel,dueDate,type HealthKind,type HealthStatus } from '@/lib/health/types';
import { pageIndex } from '@/lib/health/validation';
import { localDate } from '@/lib/medications/schedule';
import { HealthHeader } from './components';
import { RefreshOnFocus } from '@/app/components/refresh-on-focus';
export const dynamic='force-dynamic';
export default async function HealthPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{kind?:string;status?:string;archive?:string;page?:string}>}) {
  const t=await getT();
  const {petId}=await params,q=await searchParams;
  const {client,pet,timezone}=await healthContext(petId),page=pageIndex(q.page),archive=q.archive==='1';
  const kind=q.kind&&Object.hasOwn(healthKinds,q.kind)?q.kind as HealthKind:null;
  const status=q.status&&Object.hasOwn(healthStatuses,q.status)?q.status as HealthStatus:null;
  let query=client.from('health_events').select('*').eq('pet_id',petId);
  query=archive?query.not('archived_at','is',null):query.is('archived_at',null);
  if(kind)query=query.eq('kind',kind);if(status)query=query.eq('status',status);
  const [events,planned,repeat,weight]=await Promise.all([
    query.order('event_on',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20),
    client.from('health_events').select('*').eq('pet_id',petId).is('archived_at',null).eq('status','planned').order('event_on').order('id').limit(4),
    client.from('health_events').select('*').eq('pet_id',petId).is('archived_at',null).eq('status','completed').not('next_due_on','is',null).order('next_due_on').order('id').limit(4),
    client.from('weight_records').select('weight_kg,measured_at').eq('pet_id',petId).is('archived_at',null).order('measured_at',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1),
  ]);
  if(events.error||planned.error||repeat.error||weight.error)throw new Error('Не удалось загрузить здоровье');
  const rows=(events.data??[]).slice(0,20),names=await authorNames(client,rows.map(e=>e.created_by));
  const today=localDate(new Date(),timezone),upcoming=[...(planned.data??[]),...(repeat.data??[])].sort((a,b)=>dueDate(a)!.localeCompare(dueDate(b)!)).slice(0,4);
  const href=(n:number)=>`/pets/${petId}/health?${new URLSearchParams({...(kind?{kind}:{}),...(status?{status}:{}),...(archive?{archive:'1'}:{}),page:String(n)})}`;
  return <main className="detailShell healthShell"><RefreshOnFocus/><HealthHeader petId={petId} name={pet.name} title={t("Здоровье")}/>
    <div className="healthActions"><Link className="primaryAction inlineAction" href={`/pets/${petId}/health/new`}>{t("＋ Добавить событие")}</Link><Link className="secondaryAction inlineAction" href={`/pets/${petId}/health/weight`}>{weight.data?.[0]?`${t('Вес:')} ${weight.data[0].weight_kg.toLocaleString(t('ru-RU'))} ${t('кг')}`:t("Записать вес")}</Link></div>
    <section className="careSection"><h2>{t("Предстоящие события")}</h2>
      {!upcoming.length&&<p className="emptyStateCard">{t("Пока ничего не запланировано. Можно указать будущий визит или следующую дату вакцинации и обработки.")}</p>}
      <div className="medicationList">{upcoming.map(e=><Link className="medicationCard medicationLink" key={e.id} href={`/pets/${petId}/health/events/${e.id}`}><strong>{e.title}</strong><p>{e.status==='completed'?t("Следующая дата"):t("Запланировано")}: {dateLabel(dueDate(e)!,t('ru-RU'))} {dueDate(e)!<today?t("· Дата прошла"):dueDate(e)===today?t("· Сегодня"):''}</p></Link>)}</div>
    </section>
    <section className="careSection"><h2>{archive?t("Архив здоровья"):t("Журнал здоровья")}</h2>
      <form className="healthFilters wizardFields" method="get">
        <label><span>{t("Категория")}</span><select name="kind" defaultValue={kind??''}><option value="">{t("Все категории")}</option>{Object.entries(healthKinds).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
        <label><span>{t("Состояние")}</span><select name="status" defaultValue={status??''}><option value="">{t("Все состояния")}</option>{Object.entries(healthStatuses).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
        {archive&&<input type="hidden" name="archive" value="1"/>}<button className="secondaryAction">{t("Показать")}</button>
      </form>
      <p><Link href={`/pets/${petId}/health${archive?'':'?archive=1'}`}>{archive?t("Вернуться к журналу"):t("Открыть архив")}</Link></p>
      {!rows.length&&<p className="emptyStateCard">{t("Записей по выбранным условиям нет.")}</p>}
      <div className="medicationList">{rows.map(e=><Link className="medicationCard medicationLink" href={`/pets/${petId}/health/events/${e.id}`} key={e.id}>
        <small>{t(healthKinds[e.kind])} · {dateLabel(e.event_on,t('ru-RU'))}</small><h3>{e.title}</h3><p>{e.kind==='symptom'&&e.status==='completed'?t("Наблюдение записано"):t(healthStatuses[e.status])}</p><small>{t("Добавил(а):")}{' '}{names.get(e.created_by)}</small>
      </Link>)}</div>
      <nav className="doseActions" aria-label={t("Страницы журнала")}>{page>0&&<Link className="secondaryAction inlineAction" href={href(page-1)}>{t("Назад")}</Link>}{(events.data?.length??0)>20&&<Link className="secondaryAction inlineAction" href={href(page+1)}>{t("Далее")}</Link>}</nav>
    </section>
  </main>;
}
