
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {feedingContext} from '@/lib/feeding/server';
import {allPages} from '@/lib/calendar/data';
import {localDate,formatMoment} from '@/lib/medications/schedule';
import {feedingOn} from '@/lib/feeding/schedule';
import {amountLabel} from '@/lib/stock/types';
import {pageIndex} from '@/lib/health/validation';
export const dynamic='force-dynamic';
export default async function NutritionPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{archive?:string;page?:string}>}) {
  const t=await getT();
  const {petId}=await params,{archive,page:rawPage}=await searchParams;
  const {client,pet,canEdit,timezone}=await feedingContext(petId),now=new Date(),page=pageIndex(rawPage);
  const [plans,history]=await Promise.all([
    allPages((from,to)=>client.from('feeding_plans').select('*').eq('pet_id',petId).order('scheduled_time').order('id').range(from,to)),
    client.from('feeding_logs').select('*',{count:'exact'}).eq('pet_id',petId).order('scheduled_for',{ascending:false}).order('id',{ascending:false}).range(page*30,page*30+29),
  ]);
  if(history.error)throw new Error('Не удалось загрузить историю кормлений');
  const totals=new Map<string,number>();
  for(const plan of plans)if(feedingOn(plan,localDate(now,plan.timezone)))totals.set(plan.unit,(totals.get(plan.unit)??0)+Number(plan.amount));
  const visible=plans.filter(plan=>archive==='1'?Boolean(plan.archived_at)||(plan.active_until!==null&&plan.active_until<localDate(now,plan.timezone)):!plan.archived_at&&(!plan.active_until||plan.active_until>=localDate(now,plan.timezone)));
  const href=(next:number)=>`/pets/${petId}/nutrition?${new URLSearchParams({page:String(next),archive:archive==='1'?'1':'0'})}`;
  return <><Link href="/">{t("← Главная")}</Link><p>{pet.name}</p><h1>{t("Питание")}</h1>{canEdit&&<Link className="feedingAction" href={`/pets/${petId}/nutrition/new`}>{t("Добавить кормление")}</Link>}
    <section><h2>{t("План на сегодня")}</h2>{totals.size?<p>{[...totals].map(([unit,amount])=>amountLabel(amount,unit,t('ru-RU'))).join(' · ')}</p>:<p>{t("Кормления не запланированы.")}</p>}<p>{t("Сумма порций из вашего расписания. Это план, а не фактически съеденное количество.")}</p></section>
    <section><nav className="feedingLinks"><Link href={`/pets/${petId}/nutrition`} aria-current={archive!=='1'?'page':undefined}>{t("Действующие")}</Link><Link href={`/pets/${petId}/nutrition?archive=1`} aria-current={archive==='1'?'page':undefined}>{t("Архив и прошлые версии")}</Link></nav>
      <ul className="feedingList">{visible.map(plan=><li key={plan.id}><Link href={`/pets/${petId}/nutrition/${plan.id}`}><strong>{plan.scheduled_time.slice(0,5)} · {plan.food}</strong><span>{amountLabel(plan.amount,plan.unit,t('ru-RU'))} · {plan.timezone}</span><span>{plan.archived_at?t("В архиве"):plan.active_from>localDate(now,plan.timezone)?`${t('Начало:')} ${plan.active_from}`:plan.active_until?`${t('Действует до')} ${plan.active_until}`:t("Каждый день")}</span>{plan.stock_item_id&&<small>{t("Со списанием из запасов")}</small>}</Link></li>)}</ul>{!visible.length&&<p>{t("В этом списке пока ничего нет.")}</p>}</section>
    <section><h2>{t("История кормлений")}</h2><p>{t("Время:")}{' '}{timezone}</p><ul className="feedingList">{history.data?.map(log=><li key={log.id}><Link href={`/pets/${petId}/nutrition/${log.plan_id}`}><strong>{log.status==='fed'?t("Покормил"):t("Пропущено")} · {log.food}</strong><span>{t("Порция по плану:")}{' '}{amountLabel(log.amount,log.unit,t('ru-RU'))}</span><span>{t("По расписанию:")}{' '}{formatMoment(log.scheduled_for,timezone,t('ru-RU'))}</span><small>{log.actor_name} {' '}{t("· отметил")}{' '}{formatMoment(log.recorded_at,timezone,t('ru-RU'))}</small></Link></li>)}</ul>{!history.data?.length&&<p>{t("На этой странице отметок нет.")}</p>}<nav className="feedingLinks">{page>0&&<Link href={href(page-1)}>{t("← Назад")}</Link>}{(page+1)*30<(history.count??0)&&<Link href={href(page+1)}>{t("Далее →")}</Link>}</nav></section>
  </>;
}
