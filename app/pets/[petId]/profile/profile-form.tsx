'use client';
import {useActionState,useState} from 'react';
import {savePetProfile} from './actions';
import {speciesLabels,sexLabels} from '@/lib/pets/validation';
import type {Tables} from '@/lib/supabase/database.types';
type Profile=Pick<Tables<'pets'>,'id'|'name'|'species'|'sex'|'birth_date'|'breed'|'color'|'microchip_number'|'passport_number'|'vet_clinic'|'veterinarian'|'notes'|'updated_at'>;
export function ProfileForm({pet,today}:{pet:Profile;today:string}) {
  const [fields,setFields]=useState(pet);
  const input=(key:keyof Profile)=>({value:fields[key]??'',onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFields(old=>({...old,[key]:event.target.value}))});
  const [state,action,pending]=useActionState(savePetProfile.bind(null,pet.id,pet.updated_at),{});
  return <form action={action} className="medicationForm"><section className="formSectionCard wizardFields">
    <label>Имя<input name="name" required maxLength={100} {...input('name')}/></label>
    <label>Вид<select name="species" {...input('species')}>{Object.entries(speciesLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Пол<select name="sex" {...input('sex')}>{Object.entries(sexLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Дата рождения<input type="date" name="birth_date" max={today} {...input('birth_date')}/></label>
    {([['breed','Порода'],['color','Окрас'],['microchip_number','Микрочип'],['passport_number','Ветпаспорт'],['vet_clinic','Клиника'],['veterinarian','Ветеринар']] as const).map(([key,label])=><label key={key}>{label}<input name={key} maxLength={300} {...input(key)}/></label>)}
    <label>Примечание<textarea name="notes" rows={4} maxLength={5000} {...input('notes')}/></label>
    <button type="submit" className="primaryAction" disabled={pending}>{pending?'Сохраняем…':'Сохранить данные питомца'}</button>
    {state.error&&<p role="alert" className="formNotice errorNotice">{state.error}</p>}
  </section></form>;
}
