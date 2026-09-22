'use server';
import {createClient} from '@/lib/supabase/server';
export type Receipt={notice_id:string;is_read:boolean;dismissed:boolean};
export async function noticeReceipts(household:string,ids:string[],action:'list'|'read'|'dismiss'|'clear_read'='list'):Promise<{rows:Receipt[];ok:boolean}>{
  if(!/^[0-9a-f-]{36}$/i.test(household)||!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=='string'||!id.length||id.length>499)||!['list','read','dismiss','clear_read'].includes(action))return {rows:[],ok:false};
  try{
    const db=await createClient();
    const {data:claims,error}=await db.auth.getClaims();
    if(error||!claims?.claims?.sub)return {rows:[],ok:false};
    const result=await db.rpc('update_notification_receipts',{p_household:household,p_ids:[...new Set(ids)],p_action:action});
    return {rows:result.data??[],ok:!result.error};
  }catch{return {rows:[],ok:false};}
}
