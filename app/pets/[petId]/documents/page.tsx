
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {feedingContext as documentContext} from '@/lib/feeding/server';
import {documentCategories} from '@/lib/documents/types';
import {pageIndex} from '@/lib/health/validation';
export const dynamic='force-dynamic';
export default async function DocumentsPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{state?:string;category?:string;q?:string;page?:string}>}) {
  const t=await getT();
  const {petId}=await params,query=await searchParams;const {client,pet,canEdit}=await documentContext(petId);
  const state=query.state==='archive'?'archive':query.state==='pending'?'pending':'active',page=pageIndex(query.page);
  const category=typeof query.category==='string'&&Object.hasOwn(documentCategories,query.category)?query.category:'';
  const search=typeof query.q==='string'?query.q.trim().slice(0,100):'';
  let request=client.from('pet_documents').select('*',{count:'exact'}).eq('pet_id',petId).eq('state',state==='pending'?'pending':'ready');
  request=state==='archive'?request.not('archived_at','is',null):request.is('archived_at',null);
  if(category)request=request.eq('category',category as keyof typeof documentCategories);
  if(search)request=request.ilike('title',`%${search.replace(/[\\%_]/g,'\\$&')}%`);
  const {data,error,count}=await request.order('created_at',{ascending:false}).order('id').range(page*30,page*30+29);
  if(error)throw new Error('Не удалось загрузить документы');
  const href=(n:number)=>`/pets/${petId}/documents?${new URLSearchParams({state,category,q:search,page:String(n)})}`;
  return <><Link href="/">{t("← Главная")}</Link><p>{pet.name}</p><h1>{t("Документы")}</h1>{canEdit&&<Link className="documentAction" href={`/pets/${petId}/documents/new`}>{t("Добавить документ")}</Link>}
    <form className="documentForm" key={`${state}:${category}:${search}`}><label>{t("Название")}<input name="q" defaultValue={search} maxLength={100}/></label><label>{t("Категория")}<select name="category" defaultValue={category}><option value="">{t("Все категории")}</option>{Object.entries(documentCategories).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label><label>{t("Показать")}<select name="state" defaultValue={state}><option value="active">{t("Активные")}</option><option value="archive">{t("Архив")}</option><option value="pending">{t("Незавершённые загрузки")}</option></select></label><button>{t("Показать")}</button></form>
    <p>{t("Найдено:")}{' '}{count??0}</p><ul className="documentList">{data?.map(doc=><li key={doc.id}><Link href={`/pets/${petId}/documents/${doc.id}`}><strong>{doc.title}</strong><span>{t(documentCategories[doc.category])} · {(doc.file_size/1024/1024).toFixed(2)} {' '}{t("МБ")}</span><small>{doc.state==='pending'?t("Загрузка не завершена"):doc.original_name}</small></Link></li>)}</ul>{!data?.length&&<p>{t("Документов по этим условиям нет.")}</p>}<nav className="documentLinks">{page>0&&<Link href={href(page-1)}>{t("← Назад")}</Link>}{(page+1)*30<(count??0)&&<Link href={href(page+1)}>{t("Далее →")}</Link>}</nav>
  </>;
}
