'use client';
import {useActionState,useState} from 'react';
import {saveFeeding} from './actions';
import {foodUnits,type FeedingPlan} from '@/lib/feeding/types';
import type {StockItem} from '@/lib/stock/types';
export function FeedingForm({mode,petId,planId,requestId,plan,stocks=[],day='',instant=''}:{mode:string;petId:string;planId:string;requestId:string;plan?:FeedingPlan;stocks?:StockItem[];day?:string;instant?:string}) {
  const [ids]=useState({planId,requestId});
  const [state,submit,pending]=useActionState(saveFeeding.bind(null,mode,petId,ids.planId,ids.requestId,plan?.updated_at??'',day,instant),{});
  const [fields,setFields]=useState({food:plan?.food??'',amount:plan?String(plan.amount):'',unit:plan?.unit??'г',time:plan?.scheduled_time.slice(0,5)??'08:00',stock_id:plan?.stock_item_id??'',notes:plan?.notes??''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  return <form action={submit} className="feedingForm">
    {(mode==='create'||mode==='revise')&&<><label>Корм / блюдо<input name="food" required maxLength={100} {...input('food')}/></label><label>Порция на одно кормление<input name="amount" required inputMode="decimal" {...input('amount')}/></label><label>Единица<select name="unit" {...input('unit')}>{foodUnits.map(unit=><option key={unit}>{unit}</option>)}</select></label><label>Каждый день в<input type="time" name="time" required {...input('time')}/></label><label>Списывать из запасов<select name="stock_id" {...input('stock_id')}><option value="">Не списывать автоматически</option>{stocks.map(stock=><option key={stock.id} value={stock.id} >{stock.name} · {stock.quantity} {stock.unit}{stock.unit!==fields.unit?' · другая единица':''}</option>)}{fields.stock_id&&!stocks.some(s=>s.id===fields.stock_id)&&<option value={fields.stock_id}>Прежний запас недоступен — выберите другой</option>}</select></label><p>Для списания единицы порции и запаса должны совпадать. Порцию задаёте вы — приложение не рассчитывает норму питания.</p><label>Примечание<textarea name="notes" rows={3} maxLength={2000} {...input('notes')}/></label>{mode==='revise'&&<p>Новые порция и время начнут действовать завтра. Сегодняшнее расписание и история сохранятся.</p>}<button disabled={pending}>{pending?'Сохраняем…':mode==='create'?'Добавить кормление':'Сохранить с завтрашнего дня'}</button></>}
    {mode==='mark'&&<div className="feedingButtons"><button name="status" value="fed" disabled={pending}>Покормил</button><button name="status" value="skipped" disabled={pending}>Пропущено</button></div>}
    {(mode==='archive'||mode==='restore')&&<><label className="feedingConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?'Остановить это расписание. История останется.':'Восстановить расписание.'}</label><button disabled={pending}>{mode==='archive'?'В архив':'Восстановить'}</button></>}
    {state.error&&<p role="alert" className="feedingError">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>;
}
