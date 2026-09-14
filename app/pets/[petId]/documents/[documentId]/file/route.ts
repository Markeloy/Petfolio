import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{petId:string;documentId:string}>}) {
  const {petId,documentId}=await params;
  const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
  if(!/^[0-9a-f-]{36}$/i.test(petId)||!/^[0-9a-f-]{36}$/i.test(documentId))return new Response('Не найдено',{status:404,headers});
  const client=await createClient();
  const {data:auth,error:authError}=await client.auth.getClaims();
  if(authError||!auth?.claims?.sub)return new Response('Войдите в аккаунт',{status:401,headers});
  const {data:doc,error}=await client.from('pet_documents').select('*').eq('id',documentId).eq('pet_id',petId).eq('state','ready').maybeSingle();
  if(error)return new Response('Не удалось загрузить документ',{status:503,headers});
  if(!doc)return new Response('Документ недоступен',{status:404,headers});
  const file=await client.storage.from('pet-documents').download(doc.storage_path);
  if(file.error)return new Response('Не удалось загрузить файл. Повторите попытку',{status:503,headers});
  const disposition=new URL(request.url).searchParams.get('download')==='1'?'attachment':'inline';
  return new Response(file.data,{headers:{...headers,'Content-Type':doc.mime_type,'Content-Length':String(file.data.size),'Content-Disposition':`${disposition}; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.original_name).replace(/'/g,'%27')}`,'Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
}
