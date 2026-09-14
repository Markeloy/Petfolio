'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {saveAppearance} from './appearance-actions';
import type {Locale,Theme} from '@/lib/i18n/core';
export function AppearanceForm({locale,theme}:{locale:Locale;theme:Theme}){
  const t=useT();
  const [selection,setSelection]=useState({locale,theme});
  const [state,action,pending]=useActionState(async (_previous:{saved?:boolean;error?:boolean},form:FormData):Promise<{saved?:boolean;error?:boolean}>=>{
    try{await saveAppearance(form);return {saved:true};}catch{return {error:true};}
  },{});
  return <form action={action} className="authForm"><h2>{t("Язык и оформление")}</h2><p>{t("Сохраняются в этом браузере. Имена питомцев и ваши записи не переводятся.")}</p>
    <label>{t("Язык")}<select name="locale" value={selection.locale} onChange={e=>setSelection({...selection,locale:e.target.value as Locale})}><option value="ru">{t("Русский")}</option><option value="en">English</option></select></label>
    <fieldset className="themeChoices"><legend>{t("Тема")}</legend>{([['system',t("Как на устройстве")],['light',t("Светлая")],['dark',t("Тёмная")]] as const).map(([value,label])=><label key={value}><input type="radio" name="theme" value={value} checked={selection.theme===value} onChange={()=>setSelection({...selection,theme:value})}/><span>{t(label)}</span></label>)}</fieldset>
    <button className="primaryAction" disabled={pending}>{pending?t("Применяем…"):t("Применить")}</button>{state.saved&&<p role="status">{t("Оформление сохранено")}</p>}{state.error&&<p role="alert">{t("Не удалось сохранить. Попробуйте снова.")}</p>}
  </form>;
}
