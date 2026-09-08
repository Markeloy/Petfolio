'use client';
import {useState,useActionState} from 'react';
import {saveDocument} from './actions';
import {documentCategories,MAX_DOCUMENT_SIZE,type PetDocument} from '@/lib/documents/types';
export function DocumentForm({mode,petId,documentId,document}:{mode:string;petId:string;documentId:string;document?:PetDocument}) {
  const [id]=useState(documentId),[file,setFile]=useState<File|null>(null),[fileError,setFileError]=useState('');
  const [fields,setFields]=useState({title:document?.title??'',category:document?.category??'other',notes:document?.notes??''});
  const [state,submit,pending]=useActionState(async(previous:{error?:string;success?:string},form:FormData)=>{if(file)form.set('file',file);return saveDocument(mode,petId,id,document?.updated_at??'',previous,form);},{});
  const field=(key:keyof typeof fields)=>({value:fields[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:e.target.value}))});
  return <form action={submit} className="documentForm">
    {(mode==='upload'||mode==='edit')&&<><label>Название<input name="title" required maxLength={100} {...field('title')}/></label><label>Категория<select name="category" {...field('category')}>{Object.entries(documentCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Примечание<textarea name="notes" rows={3} maxLength={2000} {...field('notes')}/></label></>}
    {mode==='upload'&&<><label>PDF, JPG, PNG или WebP — до 8 МБ<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const selected=e.target.files?.[0]??null;if(selected&&selected.size>MAX_DOCUMENT_SIZE){setFile(null);setFileError('Файл больше 8 МБ');e.target.value='';}else{setFile(selected);setFileError('');}}}/></label>{file&&<p>Выбран файл: {file.name}</p>}{document&&<p>Для продолжения выберите исходный файл: {document.original_name}. Данные начатой загрузки должны совпадать.</p>}</>}
    {(mode==='archive'||mode==='restore')&&<label className="documentConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?'Убрать документ в архив. Файл сохранится.':'Вернуть документ в активный список.'}</label>}
    <button disabled={pending||Boolean(fileError)||(mode==='upload'&&!file)}>{pending?'Сохраняем…':mode==='upload'?'Загрузить документ':mode==='finish'?'Проверить завершение загрузки':mode==='archive'?'В архив':mode==='restore'?'Восстановить':'Сохранить'}</button>
    {(state.error||fileError)&&<p role="alert" className="documentError">{fileError||state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>;
}
