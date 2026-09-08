import Link from 'next/link';
import {feedingContext as documentContext} from '@/lib/feeding/server';
import {documentCategories} from '@/lib/documents/types';
import {pageIndex} from '@/lib/health/validation';
export const dynamic='force-dynamic';
export default async function DocumentsPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{state?:string;category?:string;q?:string;page?:string}>}) {
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
  return <><Link href="/">← Главная</Link><p>{pet.name}</p><h1>Документы</h1>{canEdit&&<Link className="documentAction" href={`/pets/${petId}/documents/new`}>Добавить документ</Link>}
    <form className="documentForm" key={`${state}:${category}:${search}`}><label>Название<input name="q" defaultValue={search} maxLength={100}/></label><label>Категория<select name="category" defaultValue={category}><option value="">Все категории</option>{Object.entries(documentCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Показать<select name="state" defaultValue={state}><option value="active">Активные</option><option value="archive">Архив</option><option value="pending">Незавершённые загрузки</option></select></label><button>Показать</button></form>
    <p>Найдено: {count??0}</p><ul className="documentList">{data?.map(doc=><li key={doc.id}><Link href={`/pets/${petId}/documents/${doc.id}`}><strong>{doc.title}</strong><span>{documentCategories[doc.category]} · {(doc.file_size/1024/1024).toFixed(2)} МБ</span><small>{doc.state==='pending'?'Загрузка не завершена':doc.original_name}</small></Link></li>)}</ul>{!data?.length&&<p>Документов по этим условиям нет.</p>}<nav className="documentLinks">{page>0&&<Link href={href(page-1)}>← Назад</Link>}{(page+1)*30<(count??0)&&<Link href={href(page+1)}>Далее →</Link>}</nav>
  </>;
}
