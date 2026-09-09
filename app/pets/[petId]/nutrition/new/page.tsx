
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {feedingContext} from '@/lib/feeding/server';
import {allPages} from '@/lib/calendar/data';
import {FeedingForm} from '../forms';
export const dynamic='force-dynamic';
export default async function NewFeeding({params}:{params:Promise<{petId:string}>}) {
  const t=await getT();
  const {petId}=await params;const {client,pet,householdId,canEdit,timezone}=await feedingContext(petId);
  const stocks=await allPages((from,to)=>client.from('stock_items').select('*').eq('household_id',householdId).eq('category','food').is('archived_at',null).order('id').range(from,to));
  return <><Link href={`/pets/${petId}/nutrition`}>{t("← Питание")}</Link><h1>{t("Новое кормление")}</h1><p>{pet.name} · {timezone}</p><p>{t("Одна запись — одно ежедневное кормление. Для утра и вечера добавьте две записи.")}</p>{canEdit?<FeedingForm mode="create" petId={petId} planId={randomUUID()} requestId={randomUUID()} stocks={stocks}/>:<p>{t("У вас нет права изменять рацион.")}</p>}</>;
}
