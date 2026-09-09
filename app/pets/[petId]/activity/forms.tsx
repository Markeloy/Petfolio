'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {saveActivity} from './actions';
import {activityKinds,activityStatuses,type PetActivity} from '@/lib/activity/types';
export function ActivityForm({mode,petId,id,record,initialTime}:{mode:string;petId:string;id:string;record?:PetActivity;initialTime:string}) {
  const t=useT();
  const [stableId]=useState(id);
  const [state,submit,pending]=useActionState(saveActivity.bind(null,mode,petId,stableId,record?.updated_at??''),{});
  const [fields,setFields]=useState({kind:record?.kind??'walk',title:record?.title??'Прогулка',status:record?.status??'completed',started_at:initialTime,duration_minutes:String(record?.duration_minutes??30),distance_km:record?.distance_km===null||record?.distance_km===undefined?'':String(record.distance_km),notes:record?.notes??''});
  const input=(key:keyof typeof fields)=>({value:fields[key],onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:e.target.value}))});
  return <form action={submit} className="activityForm">
    {(mode==='create'||mode==='edit')&&<><label>{t("Тип")}<select name="kind" {...input('kind')}>{Object.entries(activityKinds).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Название")}<input name="title" required maxLength={100} {...input('title')}/></label><label>{t("Состояние")}<select name="status" {...input('status')}>{Object.entries(activityStatuses).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t("Начало")}<input name="started_at" type="datetime-local" required {...input('started_at')}/></label><label>{t("Длительность, минут")}<input name="duration_minutes" type="number" min={1} max={1440} step={1} required {...input('duration_minutes')}/></label><label>{t("Расстояние, км — необязательно")}<input name="distance_km" inputMode="decimal" placeholder={t("Например, 2,5")} {...input('distance_km')}/></label><label>{t("Как прошло / примечание")}<textarea name="notes" rows={4} maxLength={2000} {...input('notes')}/></label><p>{t("Для плана укажите ожидаемые значения. После прогулки или тренировки уточните их и выберите «Выполнено».")}</p></>}
    {(mode==='archive'||mode==='restore')&&<label className="activityConfirm"><input name="confirm" type="checkbox" value="yes" required/>{mode==='archive'?t("Убрать запись из календаря и итогов. История сохранится."):t("Восстановить запись в списке и итогах.")}</label>}
    <button disabled={pending}>{pending?t("Сохраняем…"):mode==='archive'?t("В архив"):mode==='restore'?t("Восстановить"):t("Сохранить")}</button>{state.error&&<p className="activityError" role="alert">{t(state.error)}</p>}{state.success&&<p role="status">{t(state.success)}</p>}
  </form>;
}
