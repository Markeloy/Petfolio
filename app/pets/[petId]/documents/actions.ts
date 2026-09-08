'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {documentCategories,detectedMime,MAX_DOCUMENT_SIZE} from '@/lib/documents/types';
import type {Json} from '@/lib/supabase/database.types';
export type DocumentState={error?:string;success?:string};
export async function saveDocument(mode:string,petId:string,documentId:string,version:string,_state:DocumentState,form:FormData):Promise<DocumentState> {
  const client=await createClient();
  let values:Record<string,Json>={version},file:File|null=null;
  if(mode==='upload'||mode==='edit') {
    const title=String(form.get('title')??'').trim(),category=String(form.get('category')??''),notes=String(form.get('notes')??'').trim();
    if(!title||title.length>100||!Object.hasOwn(documentCategories,category)||notes.length>2000)return {error:'Проверьте название, категорию и примечание'};
    values={...values,title,category,notes};
  }
  if(mode==='upload') {
    const input=form.get('file');
    if(!(input instanceof File)||input.size===0||input.size>MAX_DOCUMENT_SIZE)return {error:'Выберите файл размером до 8 МБ'};
    file=input;
    const mime=detectedMime(new Uint8Array(await file.slice(0,12).arrayBuffer()));
    if(!mime)return {error:'Поддерживаются PDF, JPG, PNG и WebP. Формат файла не распознан'};
    const filename=file.name.replace(/[\\/\r\n]/g,'_').slice(0,255)||'Документ';
    values={...values,mime_type:mime,file_size:file.size,original_name:filename};
    const start=await client.rpc('document_action',{p_action:'init',p_pet:petId,p_document:documentId,p_values:values});
    if(start.error)return {error:start.error.code==='P0001'?start.error.message:'Не удалось начать загрузку. Проверьте доступ к семье'};
    const result=start.data as {path:string;state:string};
    if(result.state!=='ready') {
      const upload=await client.storage.from('pet-documents').upload(result.path,await file.arrayBuffer(),{contentType:mime,upsert:false,cacheControl:'0'});
      if(upload.error&&String((upload.error as {statusCode?:string}).statusCode)!=='409')return {error:'Не удалось передать файл. Повторите загрузку с тем же файлом; запись сохранена в «Незавершённых»'};
    }
    mode='finish';
  }
  if(!['finish','edit','archive','restore'].includes(mode))return {error:'Неизвестное действие'};
  if((mode==='archive'||mode==='restore')&&form.get('confirm')!=='yes')return {error:'Подтвердите действие'};
  const {error}=await client.rpc('document_action',{p_action:mode,p_pet:petId,p_document:documentId,p_values:values});
  if(error)return {error:error.code==='P0001'?error.message:'Не удалось сохранить. Обновите страницу и проверьте доступ'};
  revalidatePath(`/pets/${petId}/documents`,'layout');
  if(mode==='finish')redirect(`/pets/${petId}/documents/${documentId}`);
  return {success:'Сохранено'};
}
