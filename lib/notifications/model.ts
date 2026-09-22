import {amountLabel} from '../stock/types.ts';
import type {StockItem} from '../stock/types.ts';
export type Notice={id:string;title:string;detail:string;href:string;kind:'stock'|'care'};
export type LowStock=Pick<StockItem,'id'|'name'|'quantity'|'threshold'|'unit'|'updated_at'|'archived_at'>;
export function stockNotices(items:LowStock[],t:(text:string)=>string):Notice[]{
  return items.filter(item=>!item.archived_at&&Number(item.quantity)<=Number(item.threshold)).map(item=>({
    id:`stock:${item.id}:${item.updated_at}`,title:item.name,kind:'stock',href:`/stock/${item.id}`,
    detail:`${t('Пора купить')} · ${t('Осталось:')} ${amountLabel(item.quantity,item.unit,t('ru-RU'))}`,
  }));
}
export function readIds(raw:string):string[]{
  try{const data:unknown=JSON.parse(raw);return Array.isArray(data)?data.filter((id):id is string=>typeof id==='string'&&id.length<500):[];}catch{return [];}
}
export function unreadCount(items:Notice[],read:ReadonlySet<string>){return items.filter(item=>!read.has(item.id)).length;}

export type NoticeReceipt={notice_id:string;is_read:boolean;dismissed:boolean};
// Receipts only move forward. A slower refresh must not revive a dismissed item.
export function mergeReceipts(previous:NoticeReceipt[],incoming:NoticeReceipt[]):NoticeReceipt[]{
  const result=new Map(previous.map(row=>[row.notice_id,row]));
  for(const row of incoming){const old=result.get(row.notice_id);result.set(row.notice_id,{notice_id:row.notice_id,is_read:row.is_read||!!old?.is_read,dismissed:row.dismissed||!!old?.dismissed});}
  return [...result.values()];
}
