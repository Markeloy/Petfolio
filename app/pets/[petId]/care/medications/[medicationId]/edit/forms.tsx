'use client';
import { useActionState, useState } from 'react';
import type { Database } from '@/lib/supabase/database.types';
import { saveMedication, saveSchedule } from './actions';
import { addDays, localDate } from '@/lib/medications/schedule';

type Medication = Database['public']['Tables']['medications']['Row'];
type Schedule = Database['public']['Tables']['medication_schedules']['Row'];
export function MedicationEditForm({ medication }: { medication: Medication }) {
  const [values, setValues] = useState<Record<string,string>>({name:medication.name,doseAmount:String(medication.dose_amount ?? ''),doseUnit:medication.dose_unit ?? '',instructions:medication.instructions ?? '',notes:medication.notes ?? '',startsOn:medication.starts_on,endsOn:medication.ends_on ?? ''});
  const field = (name: string) => ({ value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues(old=>({...old,[name]:event.target.value})) });
  const [state, action, pending] = useActionState(saveMedication.bind(null,medication.pet_id,medication.id,medication.updated_at),{error:''});
  return <form action={action} className="medicationForm">
    <section className="formSectionCard wizardFields">
      <h2>Лекарство и курс</h2>
      <p className="formSectionHint">Новая дозировка применяется к следующим отметкам. Уже записанные дозировки и авторы не изменятся. Даты отдельных расписаний редактируются отдельно.</p>
      <label><span>Название</span><input name="name" required maxLength={200} {...field('name')}/></label>
      <div className="splitFields">
        <label><span>Дозировка</span><input name="doseAmount" type="number" min="0.001" max="9999999.999" step="0.001" {...field('doseAmount')}/></label>
        <label><span>Единица</span><input name="doseUnit" {...field('doseUnit')}/></label>
      </div>
      <label><span>Как давать</span><input name="instructions" {...field('instructions')}/></label>
      <div className="splitFields">
        <label><span>Начало курса</span><input name="startsOn" type="date" required {...field('startsOn')}/></label>
        <label><span>Окончание курса</span><input name="endsOn" type="date" {...field('endsOn')}/></label>
      </div>
      <label><span>Комментарий</span><textarea name="notes" rows={3} {...field('notes')}/></label>
      {state.error && <p className="formNotice errorNotice" role="alert">{state.error}</p>}
      <button className="primaryAction" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить лекарство'}</button>
    </section>
  </form>;
}

export function ScheduleEditForm({ schedule, petId, now }: { schedule: Schedule; petId: string; now: string }) {
  const [state, action, pending] = useActionState(saveSchedule.bind(null,petId,schedule.medication_id,schedule.id,schedule.updated_at),{error:''});
  const earliest = [addDays(localDate(new Date(now),schedule.timezone),1),schedule.active_from].sort().at(-1)!;
  const [time, setTime] = useState(schedule.scheduled_time?.slice(0,5) ?? '');
  const [effective, setEffective] = useState(earliest);
  const [days, setDays] = useState(schedule.days_of_week);
  return <form action={action} className="formSectionCard wizardFields">
    <h3>Приём в {schedule.scheduled_time?.slice(0,5)}</h3>
    <p className="formSectionHint">{schedule.timezone}. До выбранной даты сохраняется прежнее расписание. Часовой пояс и история старых приёмов не меняются.</p>
    <div className="splitFields">
      <label><span>Новое время</span><input name="time" type="time" required value={time} onChange={event=>setTime(event.target.value)}/></label>
      <label><span>Применить с</span><input name="effectiveOn" type="date" required min={earliest} max={schedule.active_until ?? undefined} value={effective} onChange={event=>setEffective(event.target.value)}/></label>
    </div>
    <fieldset className="scheduleDays"><legend>Дни приёма</legend><div className="scheduleDayOptions">
      {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day,index)=><label key={day}><input type="checkbox" name="days" value={index+1} checked={days.includes(index+1)} onChange={event=>setDays(old=>event.target.checked?[...old,index+1]:old.filter(d=>d!==index+1))}/><span>{day}</span></label>)}
    </div></fieldset>
    {state.error && <p className="formNotice errorNotice" role="alert">{state.error}</p>}
    <button className="secondaryAction" disabled={pending}>{pending ? 'Сохраняем…' : 'Изменить этот приём'}</button>
  </form>;
}
