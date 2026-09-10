export const categories={food:'Корм',medicine:'Лекарства',supplies:'Расходники',other:'Другое'} as const;
export const units=['г','кг','мл','л','шт','табл','упак'] as const;
export type StockItem={id:string;household_id:string;name:string;category:keyof typeof categories;unit:string;quantity:number;threshold:number;is_low:boolean;notes:string;created_by:string;created_at:string;updated_at:string;archived_at:string|null};
export type StockMovement={id:string;item_id:string;household_id:string;delta:number;balance:number;reason:string;actor_id:string|null;actor_name:string;created_at:string};
export function amountLabel(value:number,unit:string,locale='ru-RU'){return `${Number(value).toLocaleString(locale,{maximumFractionDigits:3})} ${unitLabel(unit,locale)}`;}
import {unitLabel} from '../i18n/units.ts';
