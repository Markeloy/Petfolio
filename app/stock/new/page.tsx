import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {stockContext} from '@/lib/stock/server';
import {StockForm} from '../forms';
export const dynamic='force-dynamic';
export default async function NewStock(){const {family,canEdit}=await stockContext();return <><Link href="/stock">← Запасы</Link><h1>Новый запас</h1><p>{family.name}</p>{canEdit?<StockForm key={family.id} mode="create" household={family.id} itemId={randomUUID()} requestId={randomUUID()}/>:<p>У вас нет права изменять запасы.</p>}</>;}
