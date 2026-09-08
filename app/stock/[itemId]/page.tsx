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
  const {itemId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(itemId))notFound();
  const {client,userId,item,family,canEdit}=await stockContext(itemId);
  if(!item)notFound();
  const page=pageIndex((await searchParams).page);
  const [history,profile]=await Promise.all([client.from('stock_movements').select('*',{count:'exact'}).eq('item_id',item.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*30,page*30+29),client.from('profiles').select('timezone').eq('id',userId).maybeSingle()]);
  if(history.error||profile.error)throw new Error('Не удалось загрузить историю');
  const timezone=profile.data?.timezone??'Europe/Moscow';
  return <div key={item.id}><Link href="/stock">← Запасы</Link><p className="eyebrow">{family.name} · {categories[item.category]}</p><h1>{item.name}</h1>
    <section><p className="stockBalance">{amountLabel(item.quantity,item.unit)}</p><p>{item.archived_at?'В архиве':item.is_low?'Пора купить':'Запаса достаточно'}</p><p>Порог покупки: {amountLabel(item.threshold,item.unit)}</p>{item.notes&&<p className="stockNotes">{item.notes}</p>}</section>
    {canEdit&&!item.archived_at&&<section><h2>Изменить остаток</h2><StockForm mode="adjust" household={family.id} itemId={item.id} requestId={randomUUID()} item={item}/><p className="stockNote">Для исправления остатка пополните или спишите разницу и укажите причину. Приёмы лекарств пока не списывают запас автоматически.</p></section>}
    {canEdit&&<section>{!item.archived_at&&<details><summary>Изменить описание и порог покупки</summary><StockForm mode="edit" household={family.id} itemId={item.id} requestId={randomUUID()} item={item} key={item.updated_at}/></details>}<details><summary>{item.archived_at?'Восстановить':'Убрать в архив'}</summary><StockForm mode={item.archived_at?'restore':'archive'} household={family.id} itemId={item.id} requestId={randomUUID()} item={item}/></details></section>}
    <section><h2>История изменений</h2><p className="stockNote">Время: {timezone}</p><ul className="stockHistory">{history.data?.map(m=><li key={m.id}><strong>{Number(m.delta)>0?'+':''}{amountLabel(m.delta,item.unit)}</strong><span>Остаток: {amountLabel(m.balance,item.unit)}</span><p>{m.reason}</p><small>{m.actor_name} · {formatMoment(m.created_at,timezone)}</small></li>)}</ul>{!history.data?.length&&<p>На этой странице записей нет.</p>}<nav className="stockPages" aria-label="Страницы истории">{page>0&&<Link href={`/stock/${item.id}?page=${page-1}`}>← Назад</Link>}{(page+1)*30<(history.count??0)&&<Link href={`/stock/${item.id}?page=${page+1}`}>Далее →</Link>}</nav></section>
  </div>;
}
