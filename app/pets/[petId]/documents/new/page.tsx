
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {feedingContext as documentContext} from '@/lib/feeding/server';
import {DocumentForm} from '../forms';
export const dynamic='force-dynamic';
export default async function NewDocument({params,searchParams}:{params:Promise<{petId:string}>;searchParams:Promise<{resume?:string}>}) {
  const t=await getT();
  const {petId}=await params,{resume}=await searchParams;const {client,pet,userId,canEdit}=await documentContext(petId);
  if(resume&&!/^[0-9a-f-]{36}$/i.test(resume))notFound();
  const draft=resume?await client.from('pet_documents').select('*').eq('id',resume).eq('pet_id',petId).eq('created_by',userId).eq('state','pending').maybeSingle():null;
  if(draft?.error)throw new Error('Не удалось загрузить черновик');if(resume&&!draft?.data)notFound();
  return <><Link href={`/pets/${petId}/documents`}>{t("← Документы")}</Link><h1>{resume?t("Продолжить загрузку"):t("Новый документ")}</h1><p>{pet.name}</p>{canEdit?<DocumentForm mode="upload" petId={petId} documentId={resume??randomUUID()} document={draft?.data??undefined} key={resume??'new'}/>:<p>{t("У вас нет права загружать документы.")}</p>}</>;
}
