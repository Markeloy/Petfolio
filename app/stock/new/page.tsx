
import {getT} from "@/lib/i18n/server";
import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {stockContext} from '@/lib/stock/server';
import {StockForm} from '../forms';
export const dynamic='force-dynamic';
export default async function NewStock(){
  const t=await getT();const {family,canEdit}=await stockContext();return <><Link href="/stock">{t("← Запасы")}</Link><h1>{t("Новый запас")}</h1><p>{family.name}</p>{canEdit?<StockForm key={family.id} mode="create" household={family.id} itemId={randomUUID()} requestId={randomUUID()}/>:<p>{t("У вас нет права изменять запасы.")}</p>}</>;}
