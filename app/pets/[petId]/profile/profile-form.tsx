'use client';
import {useT} from "@/lib/i18n/client";

import {useActionState,useState} from 'react';
import {savePetProfile} from './actions';
import {speciesLabels,sexLabels} from '@/lib/pets/validation';
import type {Tables} from '@/lib/supabase/database.types';
type Profile=Pick<Tables<'pets'>,'id'|'name'|'species'|'sex'|'birth_date'|'breed'|'color'|'microchip_number'|'passport_number'|'vet_clinic'|'veterinarian'|'notes'|'updated_at'>;
export function ProfileForm({pet,today}:{pet:Profile;today:string}) {
  const t=useT();
  const [fields,setFields]=useState(pet);
  const input=(key:keyof Profile)=>({value:fields[key]??'',onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  const [state,action,pending]=useActionState(savePetProfile.bind(null,pet.id,pet.updated_at),{});
  return <form action={action} className="medicationForm"><section className="formSectionCard wizardFields">
    <label>{t("Имя")}<input name="name" required maxLength={100} {...input('name')}/></label>
    <label>{t("Вид")}<select name="species" {...input('species')}>{Object.entries(speciesLabels).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label>{t("Пол")}<select name="sex" {...input('sex')}>{Object.entries(sexLabels).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label>{t("Дата рождения")}<input type="date" name="birth_date" max={today} {...input('birth_date')}/></label>
    {([['breed',t("Порода")],['color',t("Окрас")],['microchip_number',t("Микрочип")],['passport_number',t("Ветпаспорт")],['vet_clinic',t("Клиника")],['veterinarian',t("Ветеринар")]] as const).map(([key,label])=><label key={key}>{t(label)}<input name={key} maxLength={300} {...input(key)}/></label>)}
    <label>{t("Примечание")}<textarea name="notes" rows={4} maxLength={5000} {...input('notes')}/></label>
    <button type="submit" className="primaryAction" disabled={pending}>{pending?t("Сохраняем…"):t("Сохранить данные питомца")}</button>
    {state.error&&<p role="alert" className="formNotice errorNotice">{t(state.error)}</p>}
  </section></form>;
}
