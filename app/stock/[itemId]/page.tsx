
import {getT} from "@/lib/i18n/server";
import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {stockContext} from '@/lib/stock/server';
import {categories,amountLabel} from '@/lib/stock/types';
import {pageIndex} from '@/lib/health/validation';
import {formatMoment} from '@/lib/medications/schedule';
import {StockForm} from '../forms';
export const dynamic='force-dynamic';
export default async function StockDetail({params,searchParams}:{params:Promise<{itemId:string}>;searchParams:Promise<{page?:string}>}) {
  const t=await getT();
  const {itemId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(itemId))notFound();
  const {client,userId,item,family,canEdit}=await stockContext(itemId);
  if(!item)notFound();
  const page=pageIndex((await searchParams).page);
  const [history,profile]=await Promise.all([client.from('stock_movements').select('*',{count:'exact'}).eq('item_id',item.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*30,page*30+29),client.from('profiles').select('timezone').eq('id',userId).maybeSingle()]);
  if(history.error||profile.error)throw new Error('Не удалось загрузить историю');
  const timezone=profile.data?.timezone??'Europe/Moscow';
  return <div key={item.id}><Link href="/stock">{t("← Запасы")}</Link><p className="eyebrow">{family.name} · {t(categories[item.category])}</p><h1>{item.name}</h1>
    <section><p className="stockBalance">{amountLabel(item.quantity,item.unit,t('ru-RU'))}</p><p>{item.archived_at?t("В архиве"):item.is_low?t("Пора купить"):t("Запаса достаточно")}</p><p>{t("Порог покупки:")}{' '}{amountLabel(item.threshold,item.unit,t('ru-RU'))}</p>{item.notes&&<p className="stockNotes">{item.notes}</p>}</section>
    {canEdit&&!item.archived_at&&<section><h2>{t("Изменить остаток")}</h2><StockForm mode="adjust" household={family.id} itemId={item.id} requestId={randomUUID()} item={item}/><p className="stockNote">{t("Для исправления остатка пополните или спишите разницу и укажите причину. Приёмы лекарств пока не списывают запас автоматически.")}</p></section>}
    {canEdit&&<section>{!item.archived_at&&<details><summary>{t("Изменить описание и порог покупки")}</summary><StockForm mode="edit" household={family.id} itemId={item.id} requestId={randomUUID()} item={item} key={item.updated_at}/></details>}<details><summary>{item.archived_at?t("Восстановить"):t("Убрать в архив")}</summary><StockForm mode={item.archived_at?'restore':'archive'} household={family.id} itemId={item.id} requestId={randomUUID()} item={item}/></details></section>}
    <section><h2>{t("История изменений")}</h2><p className="stockNote">{t("Время:")}{' '}{timezone}</p><ul className="stockHistory">{history.data?.map(m=><li key={m.id}><strong>{Number(m.delta)>0?'+':''}{amountLabel(m.delta,item.unit,t('ru-RU'))}</strong><span>{t("Остаток:")}{' '}{amountLabel(m.balance,item.unit,t('ru-RU'))}</span><p>{m.reason}</p><small>{m.actor_name} · {formatMoment(m.created_at,timezone,t('ru-RU'))}</small></li>)}</ul>{!history.data?.length&&<p>{t("На этой странице записей нет.")}</p>}<nav className="stockPages" aria-label={t("Страницы истории")}>{page>0&&<Link href={`/stock/${item.id}?page=${page-1}`}>{t("← Назад")}</Link>}{(page+1)*30<(history.count??0)&&<Link href={`/stock/${item.id}?page=${page+1}`}>{t("Далее →")}</Link>}</nav></section>
  </div>;
}
