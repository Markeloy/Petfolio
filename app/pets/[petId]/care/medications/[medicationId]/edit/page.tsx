import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { localDate } from '@/lib/medications/schedule';
import { MedicationEditForm, ScheduleEditForm } from './forms';
export const dynamic = 'force-dynamic';

export default async function EditPage({ params }: { params: Promise<{petId:string;medicationId:string}> }) {
  const { petId, medicationId } = await params;
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');
  const [pet, medication] = await Promise.all([
    client.from('pets').select('id,name').eq('id',petId).is('archived_at',null).maybeSingle(),
    client.from('medications').select('*,medication_schedules(*)').eq('id',medicationId).eq('pet_id',petId).maybeSingle(),
  ]);
  if (pet.error || medication.error) throw new Error('Не удалось загрузить лекарство');
  if (!pet.data || !medication.data) notFound();
  const now = new Date();
  const schedules = medication.data.medication_schedules.filter(s=>s.is_active && s.schedule_type==='daily_time'
    && (!s.active_until || s.active_until>localDate(now,s.timezone)));
  return <main className="detailShell formDetailShell">
    <div className="detailTopBar"><Link className="backButton" aria-label="Назад к лекарству" href={`/pets/${petId}/care/medications/${medicationId}`}>‹</Link><div><p className="eyebrow">{pet.data.name}</p><h1>Редактирование</h1></div></div>
    <MedicationEditForm medication={medication.data}/>
    <section className="careSection"><h2>Расписание</h2>
      <p className="formSectionHint">Каждый приём сохраняется отдельно. Смена времени доступна с завтрашнего дня в пределах курса и расписания.</p>
      {schedules.map(s=><ScheduleEditForm key={s.id} schedule={s} petId={petId} now={now.toISOString()}/>)}
      {!schedules.length && <p className="emptyStateCard">Нет действующих ежедневных расписаний с будущими приёмами.</p>}
    </section>
  </main>;
}
