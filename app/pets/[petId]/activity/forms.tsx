'use client';
import {useActionState,useState} from 'react';
import {saveActivity} from './actions';
import {activityKinds,activityStatuses,type PetActivity} from '@/lib/activity/types';
export function ActivityForm({mode,petId,id,record,initialTime}:{mode:string;petId:string;id:string;record?:PetActivity;initialTime:string}) {
  const [stableId]=useState(id);
  const [state,submit,pending]=useActionState(saveActivity.bind(null,mode,petId,stableId,record?.updated_at??''),{});
  const [fields,setFields]=useState({kind:record?.kind??'walk',title:record?.title??'Прогулка',status:record?.status??'completed',started_at:initialTime,duration_minutes:String(record?.duration_minutes??30),distance_km:record?.distance_km===null||record?.distance_km===undefined?'':String(record.distance_km),notes:record?.notes??''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:e.target.value}))});
  return <form action={submit} className="activityForm">
    {(mode==='create'||mode==='edit')&&<><label>Тип<select name="kind" {...input('kind')}>{Object.entries(activityKinds).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Название<input name="title" required maxLength={100} {...input('title')}/></label><label>Состояние<select name="status" {...input('status')}>{Object.entries(activityStatuses).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Начало<input name="started_at" type="datetime-local" required {...input('started_at')}/></label><label>Длительность, минут<input name="duration_minutes" type="number" min={1} max={1440} step={1} required {...input('duration_minutes')}/></label><label>Расстояние, км — необязательно<input name="distance_km" inputMode="decimal" placeholder="Например, 2,5" {...input('distance_km')}/></label><label>Как прошло / примечание<textarea name="notes" rows={4} maxLength={2000} {...input('notes')}/></label><p>Для плана укажите ожидаемые значения. После прогулки или тренировки уточните их и выберите «Выполнено».</p></>}
    {(mode==='archive'||mode==='restore')&&<label className="activityConfirm"><input name="confirm" type="checkbox" value="yes" required/>{mode==='archive'?'Убрать запись из календаря и итогов. История сохранится.':'Восстановить запись в списке и итогах.'}</label>}
    <button disabled={pending}>{pending?'Сохраняем…':mode==='archive'?'В архив':mode==='restore'?'Восстановить':'Сохранить'}</button>{state.error&&<p className="activityError" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>;
}
