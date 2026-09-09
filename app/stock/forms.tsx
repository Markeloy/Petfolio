'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {saveStock} from './actions';
import {categories,units,type StockItem} from '@/lib/stock/types';
export function StockForm({mode,household,itemId,requestId,item}:{mode:string;household:string;itemId:string;requestId:string;item?:StockItem}) {
  const t=useT();
  const [operation,setOperation]=useState({itemId,requestId});
  const [fields,setFields]=useState({name:item?.name??'',category:item?.category??'food',notes:item?.notes??'',threshold:String(item?.threshold??0),quantity:mode==='create'?'0':'',unit:'г',direction:'add',reason:''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  const [state,submit,pending]=useActionState(async (previous:import('./actions').StockState,form:FormData)=>{
    const result=await saveStock(mode,household,operation.itemId,operation.requestId,item?.updated_at??'',previous,form);
    if(result.success&&mode==='adjust'){
      setFields(old=>({...old,quantity:'',reason:''}));
      setOperation(old=>({...old,requestId:crypto.randomUUID()}));
    }
    return result;
  },{});
  return <form action={submit} className="stockForm">
    {(mode==='create'||mode==='edit')&&<><label>{t("Название")}<input name="name" required maxLength={100} {...input('name')}/></label><label>{t("Категория")}<select name="category" {...input('category')}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
      {mode==='create'&&<><label>{t("Единица измерения")}<select name="unit" {...input('unit')}>{units.map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label><label>{t("Начальный остаток")}<input name="quantity" inputMode="decimal" required {...input('quantity')}/></label></>}
      <label>{t("Пора покупать при остатке")}<input name="threshold" inputMode="decimal" required {...input('threshold')}/></label><p className="stockNote">{t("Остаток и порог указываются в одной единице")}{item?`: ${t(item.unit)}`:''}{t(". При остатке, равном порогу или ниже, появится отметка «Пора купить».")}</p><label>{t("Примечание")}<textarea name="notes" maxLength={2000} rows={3} {...input('notes')}/></label></>}
    {mode==='adjust'&&<><label>{t("Действие")}<select name="direction" {...input('direction')}><option value="add">{t("Пополнить")}</option><option value="subtract">{t("Списать")}</option></select></label><label>{t("Количество,")}{' '}{t(item?.unit)}<input name="quantity" inputMode="decimal" required {...input('quantity')}/></label><label>{t("Причина")}<input name="reason" required maxLength={500} placeholder={t("Например: покупка, расход или исправление")} {...input('reason')}/></label></>}
    {(mode==='archive'||mode==='restore')&&<label className="stockConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?t("Убрать из активных запасов. Остаток и история сохранятся."):t("Вернуть запас в активный список.")}</label>}
    <button disabled={pending} type="submit">{pending?t("Сохраняем…"):mode==='create'?t("Добавить запас"):mode==='archive'?t("В архив"):mode==='restore'?t("Восстановить"):t("Сохранить")}</button>
    {state.error&&<p role="alert" className="stockError">{t(state.error)}</p>}{state.success&&<p role="status">{t(state.success)}</p>}
  </form>;
}
