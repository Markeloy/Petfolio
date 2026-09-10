import {getT} from '@/lib/i18n/server';
import Link from 'next/link';
import Form from 'next/form';
import {feedingContext as documentContext} from '@/lib/feeding/server';
import {documentCategories} from '@/lib/documents/types';
import {pageIndex} from '@/lib/health/validation';
import {dateLabel} from '@/lib/health/types';
import {documentSorts,documentSort} from '@/lib/documents/feed';
export const dynamic='force-dynamic';
export default async function DocumentsPage({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{state?:string;category?:string;sort?:string;page?:string}>}) {
 const t=await getT();const {petId}=await params,query=await searchParams;const {client,pet,canEdit}=await documentContext(petId);
 const state=query.state==='archive'?'archive':query.state==='pending'?'pending':'active',page=pageIndex(query.page),sort=documentSort(query.sort);
 const category=typeof query.category==='string'&&Object.hasOwn(documentCategories,query.category)?query.category:'';
 let request=client.from('pet_documents').select('*',{count:'exact'}).eq('pet_id',petId).eq('state',state==='pending'?'pending':'ready');
 request=state==='archive'?request.not('archived_at','is',null):request.is('archived_at',null);
 if(category)request=request.eq('category',category as keyof typeof documentCategories);
 const ordering=documentSorts[sort];const {data,error,count}=await request.order(ordering.column,{ascending:ordering.ascending}).order('id').range(page*30,page*30+29);
 if(error)throw new Error('Не удалось загрузить документы');
 const href=(n:number)=>`/pets/${petId}/documents?${new URLSearchParams({state,category,sort,page:String(n)})}`;
 return <><Link href="/">{t('← Главная')}</Link><p className="eyebrow">{pet.name}</p><div className="documentFeedHeading"><div><h1>{t('Документы')}</h1><p>{t('Всё важное — в одной ленте')}</p></div>{canEdit&&<Link className="documentAction" href={`/pets/${petId}/documents/new`}>{t('Добавить документ')}</Link>}</div>
 <details className="documentFilters" key={`${state}:${category}:${sort}`}><summary>{t('Фильтры и сортировка')}<span>{category?t(documentCategories[category as keyof typeof documentCategories]):t('Все категории')} · {t(ordering.label)}</span></summary><Form action={`/pets/${petId}/documents`} className="documentForm"><label>{t('Категория')}<select name="category" defaultValue={category}><option value="">{t('Все категории')}</option>{Object.entries(documentCategories).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label><label>{t('Показать')}<select name="state" defaultValue={state}><option value="active">{t('Активные')}</option><option value="archive">{t('Архив')}</option><option value="pending">{t('Незавершённые загрузки')}</option></select></label><label>{t('Сортировка')}<select name="sort" defaultValue={sort}>{Object.entries(documentSorts).map(([key,value])=><option key={key} value={key}>{t(value.label)}</option>)}</select></label><div className="documentLinks"><button>{t('Применить')}</button><Link href={`/pets/${petId}/documents`}>{t('Сбросить')}</Link></div></Form></details>
 <p className="documentFeedCount">{t(state==='archive'?'Архив':state==='pending'?'Незавершённые загрузки':'Документы')} · {count??0}</p>
 <ul className="documentFeed">{data?.map(doc=><li key={doc.id}><Link href={`/pets/${petId}/documents/${doc.id}`}><div className={`documentFileIcon ${doc.mime_type==='application/pdf'?'pdfFile':'imageFile'}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z M14 3v6h5 M8 13h8 M8 17h5"/></svg><small>{doc.mime_type==='application/pdf'?'PDF':doc.mime_type.split('/')[1]?.toUpperCase()}</small></div><div className="documentFeedBody"><span>{t(documentCategories[doc.category])} · {dateLabel(doc.created_at.slice(0,10),t('ru-RU'))}</span><h2>{doc.title}</h2><p>{doc.state==='pending'?t('Загрузка не завершена'):doc.original_name}</p><small>{(doc.file_size/1024/1024).toLocaleString(t('ru-RU'),{maximumFractionDigits:2})} {t('МБ')}</small></div><span aria-hidden="true">›</span></Link></li>)}</ul>
 {!data?.length&&<div className="documentFeedEmpty"><h2>{t('Здесь пока нет документов')}</h2><p>{category||state!=='active'?t('Измените фильтры, чтобы увидеть другие документы.'):t('Добавьте паспорт, результаты анализов или назначение — они появятся в этой ленте.')}</p></div>}<nav className="documentLinks">{page>0&&<Link href={href(page-1)}>{t('← Назад')}</Link>}{(page+1)*30<(count??0)&&<Link href={href(page+1)}>{t('Далее →')}</Link>}</nav></>;
}
