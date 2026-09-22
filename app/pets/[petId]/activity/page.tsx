
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {feedingContext as activityContext} from '@/lib/feeding/server';
import {activityKinds,activityStatuses,activitySummary} from '@/lib/activity/types';
import {allPages} from '@/lib/calendar/data';
import {addDays,localDate,formatMoment} from '@/lib/medications/schedule';
import {pageIndex} from '@/lib/health/validation';
export const dynamic='force-dynamic';
export default async function ActivityPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{kind?:string;status?:string;archive?:string;page?:string}>}) {
  const t=await getT();
  const {petId}=await params,query=await searchParams;const {client,pet,canEdit,timezone}=await activityContext(petId);
  const kind=typeof query.kind==='string'&&Object.hasOwn(activityKinds,query.kind)?query.kind:'',status=typeof query.status==='string'&&Object.hasOwn(activityStatuses,query.status)?query.status:'';
  const archived=query.archive==='1',page=pageIndex(query.page),today=localDate(new Date(),timezone),start=addDays(today,-6);
  let request=client.from('pet_activities').select('*',{count:'exact'}).eq('pet_id',petId);
  request=archived?request.not('archived_at','is',null):request.is('archived_at',null);
  if(kind)request=request.eq('kind',kind as keyof typeof activityKinds);if(status)request=request.eq('status',status as keyof typeof activityStatuses);
  const [list,week]=await Promise.all([request.order('started_at',{ascending:false}).order('id').range(page*30,page*30+29),allPages((from,to)=>client.from('pet_activities').select('*').eq('pet_id',petId).eq('status','completed').is('archived_at',null).gte('started_at',`${addDays(start,-1)}T00:00:00Z`).lt('started_at',`${addDays(today,2)}T00:00:00Z`).order('id').range(from,to))]);
  if(list.error)throw new Error('Не удалось загрузить активность');
  const summary=activitySummary(week.filter(row=>{const day=localDate(new Date(row.started_at),timezone);return day>=start&&day<=today;}));
  const href=(n:number)=>`/pets/${petId}/activity?${new URLSearchParams({kind,status,archive:archived?'1':'0',page:String(n)})}`;
  return <><Link href="/">{t("← Главная")}</Link><p>{pet.name}</p><h1>{t("Активность")}</h1>{canEdit&&<Link className="activityAction" href={`/pets/${petId}/activity/new`}>{t("Добавить активность")}</Link>}
    <section><h2>{t("Последние 7 дней")}</h2><p>{start} — {today} · {timezone}</p><div className="activityTotals"><strong>{summary.count}<span>{t("выполнено")}</span></strong><strong>{summary.minutes}<span>{t("минут")}</span></strong><strong>{summary.distanceCount?summary.km.toLocaleString(t('ru-RU'),{maximumFractionDigits:3}):'—'}<span>{t("км")}</span></strong></div><p>{t("Все виды активности. Расстояние указано в")}{' '}{summary.distanceCount} {' '}{t("записях. Каждая активность относится ко дню её начала.")}</p></section>
    <form className="activityForm" key={`${kind}:${status}:${archived}`}><label>{t("Тип")}<select name="kind" defaultValue={kind}><option value="">{t("Все")}</option>{Object.entries(activityKinds).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Состояние")}<select name="status" defaultValue={status}><option value="">{t("Все")}</option>{Object.entries(activityStatuses).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Список")}<select name="archive" defaultValue={archived?'1':'0'}><option value="0">{t("Активные записи")}</option><option value="1">{t("Архив")}</option></select></label><button>{t("Показать")}</button></form>
    <p>{t("Найдено:")}{' '}{list.count??0}</p><ul className="activityList">{list.data?.map(row=><li key={row.id}><Link href={`/pets/${petId}/activity/${row.id}`}><strong>{row.title}</strong><span>{t(activityKinds[row.kind])} · {t(activityStatuses[row.status])}</span><span>{formatMoment(row.started_at,timezone,t('ru-RU'))} · {row.duration_minutes} {' '}{t("мин")}{row.distance_km!==null?` · ${Number(row.distance_km).toLocaleString(t('ru-RU'))} ${t('км')}`:''}</span>{row.status==='planned'&&Date.parse(row.started_at)<new Date().getTime()&&<small>{t("Ожидает отметки о выполнении")}</small>}</Link></li>)}</ul>{!list.data?.length&&<p>{t("Записей по этим условиям нет.")}</p>}<nav className="activityLinks">{page>0&&<Link href={href(page-1)}>{t("← Назад")}</Link>}{(page+1)*30<(list.count??0)&&<Link href={href(page+1)}>{t("Далее →")}</Link>}</nav>
  </>;
}
