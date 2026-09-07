import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { doseKey, formatDose, formatMoment, todayOccurrence } from '@/lib/medications/schedule';
import { RefreshOnFocus } from '@/app/components/refresh-on-focus';
import { recordDose } from './actions';
import { DoseButtons } from './dose-buttons';
import { CourseActions } from './course-actions';
export const dynamic = 'force-dynamic';
const labels = { active: 'Активно', paused: 'На паузе', completed: 'Завершено', cancelled: 'Отменено' };
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export default async function MedicationPage({ params, searchParams }: {
  params: Promise<{ petId: string; medicationId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; course?: string; edited?: string; page?: string }>;
}) {
  const { petId, medicationId } = await params;
  const query = await searchParams;
  const page = Math.max(0, Math.min(100000, Math.floor(Number(query.page) || 0)));
  const path = `/pets/${petId}/care/medications/${medicationId}`;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');
  const [petResult, medicationResult] = await Promise.all([
    supabase.from('pets').select('id,name').eq('id', petId).is('archived_at', null).maybeSingle(),
    supabase.from('medications').select('*,medication_schedules(*)').eq('id', medicationId).eq('pet_id', petId).maybeSingle(),
  ]);
  if (petResult.error || medicationResult.error) throw new Error('Не удалось загрузить лекарство');
  const pet = petResult.data, medication = medicationResult.data;
  if (!pet || !medication) notFound();
  const schedules = medication.medication_schedules;
  const now = new Date();
  const today = schedules.flatMap(schedule => {
    const instant = todayOccurrence(schedule, medication, now);
    return instant ? [{ schedule, instant }] : [];
  }).sort((a, b) => Date.parse(a.instant) - Date.parse(b.instant));
  const ids = schedules.map(s => s.id);
  const todayResult = today.length ? await supabase.from('medication_doses').select('*').in('schedule_id', ids)
    .gte('scheduled_for', today[0].instant).lte('scheduled_for', today[today.length - 1].instant) : { data: [], error: null };
  const historyResult = ids.length ? await supabase.from('medication_doses').select('*').in('schedule_id', ids)
    .order('scheduled_for', { ascending: false }).order('id', { ascending: false }).range(page * 30, page * 30 + 30) : { data: [], error: null };
  if (todayResult.error || historyResult.error) throw new Error('Не удалось загрузить отметки приёмов');
  const marks = new Map((todayResult.data ?? []).map(d => [doseKey(d.schedule_id, d.scheduled_for), d]));
  const history = (historyResult.data ?? []).slice(0, 30);
  const authors = [...new Set([...(todayResult.data ?? []), ...history].map(d => d.recorded_by))];
  const profiles = authors.length ? await supabase.from('profiles').select('id,display_name').in('id', authors) : { data: [], error: null };
  if (profiles.error) throw new Error('Не удалось загрузить авторов отметок');
  const names = new Map((profiles.data ?? []).map(p => [p.id, p.display_name]));
  const author = (id: string) => id === auth.claims.sub ? (names.get(id) ? `${names.get(id)} (вы)` : 'Вы') : names.get(id) || 'Участник семьи';
  return <main className="detailShell">
    <RefreshOnFocus />
    <div className="detailTopBar"><Link href={`/pets/${petId}/care`} className="backButton" aria-label="Назад к уходу">‹</Link><div><p className="eyebrow">{pet.name}</p><h1>{medication.name}</h1></div><span className="detailTopSpacer" /></div>
    {query.error && <p className="formNotice errorNotice" role="alert">{query.error}</p>}
    {query.edited && <p className="formNotice" role="status">Изменения сохранены. История прежних приёмов не изменена.</p>}
    {query.saved && <p className="formNotice" role="status">{query.saved === 'existing' ? 'Этот приём уже отмечен. Ниже показано, кем и когда.' : 'Отметка сохранена и доступна семье.'}</p>}
    {query.course && <p className="formNotice" role="status">{{ active: 'Курс возобновлён.', paused: 'Курс поставлен на паузу.', completed: 'Курс завершён.' }[query.course] ?? 'Состояние курса изменено.'}</p>}
    <section className="formSectionCard medicationSummary">
      <p className="wizardEyebrow">{labels[medication.status]}</p><h2>{formatDose(medication.dose_amount, medication.dose_unit)}</h2>
      {medication.instructions && <p>{medication.instructions}</p>}
      <p>Курс: {medication.starts_on.split('-').reverse().join('.')} — {medication.ends_on?.split('-').reverse().join('.') || 'без даты окончания'}</p>
      {medication.notes && <p>{medication.notes}</p>}
      <h3>Расписание</h3>
      {schedules.length === 0 && <p>Расписание не задано. Приёмы и напоминания появятся после добавления времени.</p>}
      {schedules.map(s => <p key={s.id}>{s.schedule_type === 'daily_time' ? `${s.scheduled_time?.slice(0, 5)} · ${s.days_of_week.map(d => weekdays[d - 1]).join(', ')}` : s.schedule_type === 'interval' ? 'По интервалу — отметки пока недоступны' : 'По необходимости — отметки пока недоступны'}<br/><small>{s.timezone} · {s.is_active ? 'Действует' : 'Отключено'} с {s.active_from}{s.active_until ? ` по ${s.active_until}` : ''}</small></p>)}
      <CourseActions petId={petId} medicationId={medicationId} status={medication.status} />
      <Link className="secondaryAction inlineAction" href={`${path}/edit`}>Редактировать лекарство и расписание</Link>
    </section>
    <section className="careSection"><h2>Сегодня</h2><p className="formSectionHint">Время указано по часовому поясу расписания. Семья видит общие отметки.</p>
      {today.length === 0 && <div className="emptyStateCard">На сегодня нет запланированных приёмов. Проверьте дни недели, даты курса и его статус.</div>}
      <div className="medicationList">{today.map(({ schedule, instant }) => {
        const mark = marks.get(doseKey(schedule.id, instant));
        return <article className="medicationCard" key={schedule.id}>
          <div className="medicationCardTop"><strong><time dateTime={instant}>{formatMoment(instant, schedule.timezone)}</time></strong><span>{mark ? mark.status === 'given' ? 'Дано' : 'Пропущено' : Date.parse(instant) < now.getTime() ? 'Ожидает отметки' : 'Запланировано'}</span></div>
          <p>{formatDose(mark ? mark.dose_amount : medication.dose_amount, mark ? mark.dose_unit : medication.dose_unit)}</p>
          <small>{schedule.timezone}</small>
          {mark ? <p>{author(mark.recorded_by)} · отметка {formatMoment(mark.recorded_at, schedule.timezone)}{mark.administered_at && <><br/>Дано: {formatMoment(mark.administered_at, schedule.timezone)}</>}</p> : <form action={recordDose.bind(null, petId, medicationId, schedule.id, instant)}><DoseButtons /></form>}
        </article>;
      })}</div>
    </section>
    <section className="careSection"><h2>История приёмов</h2>
      {history.length === 0 && <div className="emptyStateCard">На этой странице пока нет отметок.</div>}
      <div className="medicationList">{history.map(dose => {
        const timezone = schedules.find(s => s.id === dose.schedule_id)!.timezone;
        return <article className="medicationCard" key={dose.id}>
          <div className="medicationCardTop"><strong>{dose.status === 'given' ? 'Дано' : 'Пропущено'}</strong><span>{formatDose(dose.dose_amount, dose.dose_unit)}</span></div>
          <p>По плану: {formatMoment(dose.scheduled_for, timezone)}<br/>{dose.administered_at ? `Дано: ${formatMoment(dose.administered_at, timezone)}` : 'Приём пропущен'}</p>
          <small>{author(dose.recorded_by)} · отметка {formatMoment(dose.recorded_at, timezone)} · {timezone}</small>
          {dose.notes && <p>{dose.notes}</p>}
        </article>;
      })}</div>
      <nav className="doseActions" aria-label="Страницы истории">{page > 0 && <Link className="secondaryAction" href={`${path}?page=${page - 1}`}>Более новые</Link>}{(historyResult.data?.length ?? 0) > 30 && <Link className="secondaryAction" href={`${path}?page=${page + 1}`}>Более ранние</Link>}</nav>
    </section>
  </main>;
}
