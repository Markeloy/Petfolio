'use client';
import {useActionState,useState,useEffect} from 'react';
import {saveStock} from './actions';
import {categories,units,type StockItem} from '@/lib/stock/types';
export function StockForm({mode,household,itemId,requestId,item}:{mode:string;household:string;itemId:string;requestId:string;item?:StockItem}) {
  const [operation,setOperation]=useState({itemId,requestId});
  const [state,submit,pending]=useActionState(saveStock.bind(null,mode,household,operation.itemId,operation.requestId,item?.updated_at??''),{});
  const [fields,setFields]=useState({name:item?.name??'',category:item?.category??'food',notes:item?.notes??'',threshold:String(item?.threshold??0),quantity:mode==='create'?'0':'',unit:'г',direction:'add',reason:''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  useEffect(()=>{if(state.success&&mode==='adjust'){setFields(old=>({...old,quantity:'',reason:''}));setOperation(old=>({...old,requestId:crypto.randomUUID()}));}},[state,mode]);
  return <form action={submit} className="stockForm">
    {(mode==='create'||mode==='edit')&&<><label>Название<input name="name" required maxLength={100} {...input('name')}/></label><label>Категория<select name="category" {...input('category')}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {mode==='create'&&<><label>Единица измерения<select name="unit" {...input('unit')}>{units.map(unit=><option key={unit}>{unit}</option>)}</select></label><label>Начальный остаток<input name="quantity" inputMode="decimal" required {...input('quantity')}/></label></>}
      <label>Пора покупать при остатке<input name="threshold" inputMode="decimal" required {...input('threshold')}/></label><p className="stockNote">Остаток и порог указываются в одной единице{item?`: ${item.unit}`:''}. При остатке, равном порогу или ниже, появится отметка «Пора купить».</p><label>Примечание<textarea name="notes" maxLength={2000} rows={3} {...input('notes')}/></label></>}
    {mode==='adjust'&&<><label>Действие<select name="direction" {...input('direction')}><option value="add">Пополнить</option><option value="subtract">Списать</option></select></label><label>Количество, {item?.unit}<input name="quantity" inputMode="decimal" required {...input('quantity')}/></label><label>Причина<input name="reason" required maxLength={500} placeholder="Например: покупка, расход или исправление" {...input('reason')}/></label></>}
    {(mode==='archive'||mode==='restore')&&<label className="stockConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?'Убрать из активных запасов. Остаток и история сохранятся.':'Вернуть запас в активный список.'}</label>}
    <button disabled={pending} type="submit">{pending?'Сохраняем…':mode==='create'?'Добавить запас':mode==='archive'?'В архив':mode==='restore'?'Восстановить':'Сохранить'}</button>
    {state.error&&<p role="alert" className="stockError">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>;
}
