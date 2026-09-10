'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {saveSettings} from './actions';
export function SettingsForm({name,timezone,version,zones}:{name:string;timezone:string;version:string;zones:string[]}) {
  const t=useT();
  const [fields,setFields]=useState({name,timezone});
  const [state,action,pending]=useActionState(saveSettings.bind(null,version),{});
  return <form className="authForm" action={action}>
    <label>{t("Ваше имя")}<input name="display_name" required maxLength={100} value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
    <label>{t("Часовой пояс")}<select name="timezone" value={fields.timezone} onChange={e=>setFields({...fields,timezone:e.target.value})}>{zones.map(zone=><option key={zone}>{zone}</option>)}</select></label>
    <button className="primaryAction" disabled={pending}>{pending?t("Сохраняем…"):t("Сохранить настройки")}</button>
    {state.error&&<p role="alert" className="formNotice errorNotice">{t(state.error)}</p>}
  </form>;
}
