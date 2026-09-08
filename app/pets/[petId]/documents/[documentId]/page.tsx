import Link from 'next/link';
import {notFound} from 'next/navigation';
import {feedingContext as documentContext} from '@/lib/feeding/server';
import {documentCategories} from '@/lib/documents/types';
import {formatMoment} from '@/lib/medications/schedule';
import {DocumentForm} from '../forms';
export const dynamic='force-dynamic';
export default async function DocumentPage({params}:{params:Promise<{petId:string;documentId:string}>}) {
  const {petId,documentId}=await params;const {client,pet,canEdit,timezone}=await documentContext(petId);
  if(!/^[0-9a-f-]{36}$/i.test(documentId))notFound();
  const {data:doc,error}=await client.from('pet_documents').select('*').eq('id',documentId).eq('pet_id',petId).maybeSingle();
  if(error)throw new Error('Не удалось загрузить документ');if(!doc)notFound();
  const file=`/pets/${petId}/documents/${doc.id}/file`;
  return <div key={doc.id}><Link href={`/pets/${petId}/documents`}>← Документы</Link><p>{pet.name} · {documentCategories[doc.category]}</p><h1>{doc.title}</h1><p>{doc.original_name} · {(doc.file_size/1024/1024).toFixed(2)} МБ</p><p>{doc.author_name} · {formatMoment(doc.created_at,timezone)}</p>{doc.archived_at&&<p>В архиве</p>}{doc.notes&&<p className="documentNotes">{doc.notes}</p>}
    {doc.state==='ready'?<><nav className="documentLinks"><a href={file} target="_blank" rel="noopener noreferrer">Открыть файл</a><a href={`${file}?download=1`}>Скачать</a></nav>{doc.mime_type.startsWith('image/')&&<img className="documentPreview" src={file} alt={doc.title}/>} {canEdit&&<section><details><summary>Изменить карточку</summary><DocumentForm mode="edit" petId={petId} documentId={doc.id} document={doc} key={doc.updated_at}/></details><details><summary>{doc.archived_at?'Восстановить':'Убрать в архив'}</summary><DocumentForm mode={doc.archived_at?'restore':'archive'} petId={petId} documentId={doc.id} document={doc}/></details></section>}</>:<section><p>Передача файла ещё не подтверждена. Можно повторить проверку или выбрать исходный файл заново.</p><DocumentForm mode="finish" petId={petId} documentId={doc.id} document={doc}/><p><Link href={`/pets/${petId}/documents/new?resume=${doc.id}`}>Повторить загрузку файла</Link></p></section>}
  </div>;
}
