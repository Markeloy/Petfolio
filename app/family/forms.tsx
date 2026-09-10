'use client';
import {useT} from "@/lib/i18n/client";

import { useActionState,useState,type ReactNode } from 'react';
import { familyAction } from './actions';
export function FamilyForm({action,household,target,label,children,confirm}:{action:string;household?:string;target?:string;label:string;children?:ReactNode;confirm?:string}) {
  const t=useT();
  const [state,submit,pending]=useActionState(familyAction,{});
  const [copied,setCopied]=useState(false);
  const [copyError,setCopyError]=useState(false);
  return <form action={submit} className="familyForm" onSubmit={()=>{setCopied(false);setCopyError(false);}}>
    <input type="hidden" name="action" value={action}/>{household&&<input type="hidden" name="household" value={household}/>} {target&&<input type="hidden" name="target" value={target}/>}
    {children}
    {confirm&&<label className="familyConfirm"><input type="checkbox" name="confirm" value="yes" required/>{confirm}</label>}
    <button disabled={pending} type="submit">{pending?t("Сохраняем…"):label}</button>
    {state.error&&<p role="alert" className="familyError">{t(state.error)}</p>}
    {state.message&&<p role="status">{t(state.message)}</p>}
    {state.code&&<div className="familyCode"><label>{t("Код приглашения")}<input readOnly value={state.code} onFocus={e=>e.currentTarget.select()} aria-label={t("Код приглашения")}/></label><p>{t("Код показывается здесь один раз. Передайте его человеку, которому хотите открыть доступ к питомцам семьи. Действует 7 дней.")}</p><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(state.code!);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}}>{copied?t("Скопировано"):t("Скопировать код")}</button>{copyError&&<p role="status">{t("Выделите код в поле и скопируйте вручную.")}</p>}</div>}
  </form>;
}
