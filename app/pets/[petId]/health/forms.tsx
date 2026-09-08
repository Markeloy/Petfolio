'use client';
import { useActionState,useState } from 'react';
import { healthKinds,healthStatuses,type HealthEvent } from '@/lib/health/types';
import type { Database } from '@/lib/supabase/database.types';
import { saveHealth,saveWeight,archiveRecord } from './actions';
export function HealthForm({petId,id,event,today,repeat}:{petId:string;id:string;event?:HealthEvent;today:string;repeat?:HealthEvent}) {
  const initial=event??repeat;
  const [values,setValues]=useState<Record<string,string>>({kind:initial?.kind??'vaccination',title:initial?.title??'',status:event?.status??(repeat?.next_due_on&&repeat.next_due_on>today?'planned':'completed'),event_on:event?.event_on??repeat?.next_due_on??today,next_due_on:event?.next_due_on??'',product:initial?.product??'',clinic:initial?.clinic??'',veterinarian:initial?.veterinarian??'',notes:event?.notes??''});
  const [state,action,pending]=useActionState(saveHealth.bind(null,petId,id,event?.updated_at??null,repeat?{id:repeat.id,version:repeat.updated_at}:null),{error:''});
  const field=(key:string)=>({value:values[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setValues(v=>({...v,[key]:e.target.value}))});
  return <form action={action} className="healthForm wizardFields">
    {repeat&&<p className="formNotice">Создаётся отдельная запись. После сохранения напоминание в предыдущей записи закроется, а её история останется.</p>}
    <label><span>Категория</span><select name="kind" {...field('kind')}>{Object.entries(healthKinds).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    <label><span>Название</span><input name="title" required maxLength={200} placeholder={values.kind==='symptom'?'Например, снизился аппетит':'Например, ежегодная вакцинация'} {...field('title')}/></label>
    <div className="splitFields">
      <label><span>Дата события</span><input name="event_on" type="date" required max={values.status==='completed'?today:undefined} {...field('event_on')}/></label>
      <label><span>Состояние</span><select name="status" {...field('status')}>{Object.entries(healthStatuses).filter(([key])=>!repeat||key!=='cancelled').map(([key,label])=><option value={key} key={key}>{values.kind==='symptom'&&key==='completed'?'Наблюдение записано':label}</option>)}</select></label>
    </div>
    <label><span>Следующая дата (необязательно)</span><input name="next_due_on" type="date" min={values.event_on} {...field('next_due_on')}/></label>
    <p className="formSectionHint">Укажите назначенную следующую дату, если она известна. Она появится в списке предстоящих событий.</p>
    <label><span>Препарат / вакцина (необязательно)</span><input name="product" maxLength={300} {...field('product')}/></label>
    <div className="splitFields">
      <label><span>Клиника</span><input name="clinic" maxLength={300} {...field('clinic')}/></label>
      <label><span>Ветеринар</span><input name="veterinarian" maxLength={300} {...field('veterinarian')}/></label>
    </div>
    <label><span>{values.kind==='symptom'?'Что заметили: проявления, длительность, изменения':'Результат, назначения или комментарий'}</span><textarea name="notes" rows={5} maxLength={5000} {...field('notes')}/></label>
    {state.error&&<p className="formNotice errorNotice" role="alert">{state.error}</p>}
    <button className="primaryAction" disabled={pending}>{pending?'Сохраняем…':event?'Сохранить изменения':'Добавить событие'}</button>
  </form>;
}
type Weight=Database['public']['Tables']['weight_records']['Row'];
export function WeightForm({petId,id,record,datetime,timezone}:{petId:string;id:string;record?:Weight;datetime:string;timezone:string}) {
  const [values,setValues]=useState({weight_kg:String(record?.weight_kg??''),measured_at:datetime,notes:record?.notes??''});
  const [state,action,pending]=useActionState(saveWeight.bind(null,petId,id,record?.updated_at??null),{error:''});
  const field=(key:keyof typeof values)=>({value:values[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setValues(v=>({...v,[key]:e.target.value}))});
  return <form action={action} className="healthForm wizardFields">
    <label><span>Вес, кг</span><input name="weight_kg" type="number" min="0.001" max="5000" step="0.001" inputMode="decimal" required {...field('weight_kg')}/></label>
    <label><span>Дата и время измерения</span><input name="measured_at" type="datetime-local" required {...field('measured_at')}/></label>
    <p className="formSectionHint">Часовой пояс: {timezone}</p>
    <label><span>Комментарий</span><textarea name="notes" rows={3} maxLength={5000} {...field('notes')}/></label>
    {state.error&&<p className="formNotice errorNotice" role="alert">{state.error}</p>}
    <button className="primaryAction" disabled={pending}>{pending?'Сохраняем…':record?'Исправить измерение':'Записать вес'}</button>
  </form>;
}
export function ArchiveControl({petId,id,version,table,archived}:{petId:string;id:string;version:string;table:'health_events'|'weight_records';archived:boolean}) {
  const [open,setOpen]=useState(false);
  const [state,action,pending]=useActionState(archiveRecord.bind(null,petId,id,version,table,archived),{error:''});
  return <div className="archiveControl">
    <button className="secondaryAction" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{archived?'Восстановить запись':'Убрать в архив'}</button>
    {open&&<form action={action}><p>{archived?'Вернуть запись в основной список?':'Запись будет скрыта из основного списка. Её можно восстановить из архива.'}</p><button className="secondaryAction" disabled={pending}>{pending?'Сохраняем…':'Подтвердить'}</button></form>}
    {state.error&&<p role="alert" className="formNotice errorNotice">{state.error}</p>}
  </div>;
}
