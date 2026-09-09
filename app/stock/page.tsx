
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {stockContext} from '@/lib/stock/server';
import {categories,amountLabel} from '@/lib/stock/types';
import {pageIndex} from '@/lib/health/validation';
export const dynamic='force-dynamic';
export default async function StockPage({searchParams}:{searchParams:Promise<{category?:string;status?:string;q?:string;page?:string}>}) {
  const t=await getT();
  const query=await searchParams;
  const {client,family,canEdit}=await stockContext();
  const category=typeof query.category==='string'&&Object.hasOwn(categories,query.category)?query.category:'';
  const status=query.status==='archive'?'archive':query.status==='low'?'low':'active';
  const search=typeof query.q==='string'?query.q.trim().slice(0,100):'';
  const page=pageIndex(query.page);
  let request=client.from('stock_items').select('*',{count:'exact'}).eq('household_id',family.id);
  request=status==='archive'?request.not('archived_at','is',null):request.is('archived_at',null);
  if(status==='low')request=request.eq('is_low',true);
  if(category)request=request.eq('category',category as keyof typeof categories);
  if(search)request=request.ilike('name',`%${search.replace(/[\\%_]/g,'\\$&')}%`);
  const {data,error,count}=await request.order('name').order('id').range(page*30,page*30+29);
  if(error)throw new Error('Не удалось загрузить запасы');
  const href=(next:number)=>`/stock?${new URLSearchParams({category,status,q:search,page:String(next)})}`;
  return <><header><p className="eyebrow">{family.name}</p><h1>{t("Запасы")}</h1><p>{t("Общий запас корма, лекарств и расходников семьи")}</p>{canEdit&&<Link className="stockAction" href="/stock/new">{t("Добавить запас")}</Link>}</header>
    <form className="stockForm stockFilters" action="/stock"><label>{t("Название")}<input name="q" defaultValue={search} maxLength={100}/></label><label>{t("Категория")}<select name="category" defaultValue={category}><option value="">{t("Все категории")}</option>{Object.entries(categories).map(([key,label])=><option value={key} key={key}>{t(label)}</option>)}</select></label><label>{t("Показать")}<select name="status" defaultValue={status}><option value="active">{t("Активные")}</option><option value="low">{t("Пора купить")}</option><option value="archive">{t("Архив")}</option></select></label><button>{t("Показать")}</button></form>
    <p className="stockNote">{t("Найдено:")}{' '}{count??0}</p><ul className="stockList">{data?.map(item=><li key={item.id}><Link href={`/stock/${item.id}`}><span>{t(categories[item.category])}</span><strong>{item.name}</strong><b>{amountLabel(item.quantity,item.unit,t('ru-RU'))}</b>{item.is_low&&!item.archived_at&&<em>{t("Пора купить")}</em>}</Link></li>)}</ul>
    {!data?.length&&<p className="stockEmpty">{page?t("На этой странице записей нет."):status==='low'?t("Запасов с низким остатком нет."):t("Запасов по этим условиям нет.")} {page>0&&<Link href={href(0)}>{t("К началу списка")}</Link>}</p>}
    <nav className="stockPages" aria-label={t("Страницы списка")}>{page>0&&<Link href={href(page-1)}>{t("← Назад")}</Link>}{(page+1)*30<(count??0)&&<Link href={href(page+1)}>{t("Далее →")}</Link>}</nav>
  </>;
}
