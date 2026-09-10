'use client';
import {useT} from "@/lib/i18n/client";

import {useState,useActionState} from 'react';
import {saveDocument} from './actions';
import {documentCategories,MAX_DOCUMENT_SIZE,type PetDocument} from '@/lib/documents/types';
export function DocumentForm({mode,petId,documentId,document}:{mode:string;petId:string;documentId:string;document?:PetDocument}) {
  const t=useT();
  const [id]=useState(documentId),[file,setFile]=useState<File|null>(null),[fileError,setFileError]=useState('');
  const [fields,setFields]=useState({title:document?.title??'',category:document?.category??'other',notes:document?.notes??''});
  const [state,submit,pending]=useActionState(async(previous:{error?:string;success?:string},form:FormData)=>{if(file)form.set('file',file);return saveDocument(mode,petId,id,document?.updated_at??'',previous,form);},{});
  const field=(key:keyof typeof fields)=>({value:fields[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:e.target.value}))});
  return <form action={submit} className="documentForm">
    {(mode==='upload'||mode==='edit')&&<><label>{t("Название")}<input name="title" required maxLength={100} {...field('title')}/></label><label>{t("Категория")}<select name="category" {...field('category')}>{Object.entries(documentCategories).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><label>{t("Примечание")}<textarea name="notes" rows={3} maxLength={2000} {...field('notes')}/></label></>}
    {mode==='upload'&&<><label>{t("PDF, JPG, PNG или WebP — до 8 МБ")}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const selected=e.target.files?.[0]??null;if(selected&&selected.size>MAX_DOCUMENT_SIZE){setFile(null);setFileError(t("Файл больше 8 МБ"));e.target.value='';}else{setFile(selected);setFileError('');}}}/></label>{file&&<p>{t("Выбран файл:")}{' '}{file.name}</p>}{document&&<p>{t("Для продолжения выберите исходный файл:")}{' '}{document.original_name}{t(". Данные начатой загрузки должны совпадать.")}</p>}</>}
    {(mode==='archive'||mode==='restore')&&<label className="documentConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?t("Убрать документ в архив. Файл сохранится."):t("Вернуть документ в активный список.")}</label>}
    <button disabled={pending||Boolean(fileError)||(mode==='upload'&&!file)}>{pending?t("Сохраняем…"):mode==='upload'?t("Загрузить документ"):mode==='finish'?t("Проверить завершение загрузки"):mode==='archive'?t("В архив"):mode==='restore'?t("Восстановить"):t("Сохранить")}</button>
    {(state.error||fileError)&&<p role="alert" className="documentError">{t(fileError||state.error)}</p>}{state.success&&<p role="status">{t(state.success)}</p>}
  </form>;
}
