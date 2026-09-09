'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {saveFeeding} from './actions';
import {foodUnits,type FeedingPlan} from '@/lib/feeding/types';
import type {StockItem} from '@/lib/stock/types';
export function FeedingForm({mode,petId,planId,requestId,plan,stocks=[],day='',instant=''}:{mode:string;petId:string;planId:string;requestId:string;plan?:FeedingPlan;stocks?:StockItem[];day?:string;instant?:string}) {
  const t=useT();
  const [ids]=useState({planId,requestId});
  const [state,submit,pending]=useActionState(saveFeeding.bind(null,mode,petId,ids.planId,ids.requestId,plan?.updated_at??'',day,instant),{});
  const [fields,setFields]=useState({food:plan?.food??'',amount:plan?String(plan.amount):'',unit:plan?.unit??'г',time:plan?.scheduled_time.slice(0,5)??'08:00',stock_id:plan?.stock_item_id??'',notes:plan?.notes??''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  return <form action={submit} className="feedingForm">
    {(mode==='create'||mode==='revise')&&<><label>{t("Корм / блюдо")}<input name="food" required maxLength={100} {...input('food')}/></label><label>{t("Порция на одно кормление")}<input name="amount" required inputMode="decimal" {...input('amount')}/></label><label>{t("Единица")}<select name="unit" {...input('unit')}>{foodUnits.map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label><label>{t("Каждый день в")}<input type="time" name="time" required {...input('time')}/></label><label>{t("Списывать из запасов")}<select name="stock_id" {...input('stock_id')}><option value="">{t("Не списывать автоматически")}</option>{stocks.map(stock=><option key={stock.id} value={stock.id} >{stock.name} · {stock.quantity} {t(stock.unit)}{stock.unit!==fields.unit?t(" · другая единица"):''}</option>)}{fields.stock_id&&!stocks.some(s=>s.id===fields.stock_id)&&<option value={fields.stock_id}>{t("Прежний запас недоступен — выберите другой")}</option>}</select></label><p>{t("Для списания единицы порции и запаса должны совпадать. Порцию задаёте вы — приложение не рассчитывает норму питания.")}</p><label>{t("Примечание")}<textarea name="notes" rows={3} maxLength={2000} {...input('notes')}/></label>{mode==='revise'&&<p>{t("Новые порция и время начнут действовать завтра. Сегодняшнее расписание и история сохранятся.")}</p>}<button disabled={pending}>{pending?t("Сохраняем…"):mode==='create'?t("Добавить кормление"):t("Сохранить с завтрашнего дня")}</button></>}
    {mode==='mark'&&<div className="feedingButtons"><button name="status" value="fed" disabled={pending}>{t("Покормил")}</button><button name="status" value="skipped" disabled={pending}>{t("Пропущено")}</button></div>}
    {(mode==='archive'||mode==='restore')&&<><label className="feedingConfirm"><input type="checkbox" name="confirm" value="yes" required/>{mode==='archive'?t("Остановить это расписание. История останется."):t("Восстановить расписание.")}</label><button disabled={pending}>{mode==='archive'?t("В архив"):t("Восстановить")}</button></>}
    {state.error&&<p role="alert" className="feedingError">{t(state.error)}</p>}{state.success&&<p role="status">{t(state.success)}</p>}
  </form>;
}
