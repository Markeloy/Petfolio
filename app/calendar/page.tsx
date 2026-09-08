import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { familyMemberships } from '@/lib/family/server';
import { calendarDate, monthDays } from '@/lib/calendar/dates';
import { allPages, calendarEntries } from '@/lib/calendar/data';
import { addDays, localDate } from '@/lib/medications/schedule';
import { dateLabel } from '@/lib/health/types';
import { BottomNav } from '@/app/components/petfolio-home';
import { RefreshOnFocus } from '@/app/components/refresh-on-focus';
import './calendar.css';

export const dynamic = 'force-dynamic';
export default async function CalendarPage({searchParams}: {searchParams: Promise<{date?: string; pet?: string}>}) {
  const query = await searchParams;
  const client = await createClient();
  const {data: claims, error: authError} = await client.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== 'string') redirect('/login');
  const {active:membership}=await familyMemberships(client,userId);
  if (!membership) redirect('/family');
  const [pets, profile] = await Promise.all([
    allPages((from, to) => client.from('pets').select('id,name').eq('household_id', membership.household_id).is('archived_at', null).order('id').range(from, to)),
    client.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
  ]);
  if (profile.error) throw new Error('Не удалось загрузить часовой пояс');
  if (!pets.length) redirect('/onboarding/pet');
  const timezone = profile.data?.timezone ?? 'Europe/Moscow';
  const now = new Date();
  const today = localDate(now, timezone);
  const day = calendarDate(query.date, today);
  const petId = pets.some(p => p.id === query.pet) ? query.pet! : '';
  const selected = petId ? pets.filter(p => p.id === petId) : pets;
  const entries = await calendarEntries(client, selected.map(p => p.id), day, timezone, now);
  const href = (date: string) => `/calendar?${new URLSearchParams({date, ...(petId ? {pet: petId} : {})})}`;
  const monthStart = `${day.slice(0,7)}-01`;
  const previous = addDays(monthStart, -1).slice(0,7) + '-01';
  const next = addDays(monthStart, 32).slice(0,7) + '-01';
  const monthLabel = new Intl.DateTimeFormat('ru-RU', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${monthStart}T12:00:00Z`));
  return <main className="appShell"><RefreshOnFocus/><div className="content calendarContent">
    <header><p className="eyebrow">Petfolio</p><h1>Календарь</h1><p>Лекарства и здоровье всех питомцев</p></header>
    <form className="calendarFilters" action="/calendar" key={`${day}:${petId}`}>
      <label>Питомец<select name="pet" defaultValue={petId}><option value="">Все питомцы</option>{pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Дата<input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={day} key={day}/></label>
      <button type="submit">Показать</button><Link href={href(today)}>Сегодня</Link>
    </form>
    <section className="calendarMonth" aria-label="Выбор дня">
      <div className="calendarMonthHeading">{previous >= '1900-01-01' ? <Link href={href(previous)} aria-label="Предыдущий месяц">‹</Link> : <span/>}<h2>{monthLabel}</h2>{next <= '2100-12-31' ? <Link href={href(next)} aria-label="Следующий месяц">›</Link> : <span/>}</div>
      <div className="calendarGrid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <span className="calendarWeekday" key={d}>{d}</span>)}{monthDays(day).map((date,i) => date ? <Link key={date} href={href(date)} className={`${date === day ? 'selected' : ''} ${date === today ? 'today' : ''}`} aria-label={`${dateLabel(date)}${date === today ? ', сегодня' : ''}`} aria-current={date === day ? 'date' : undefined}>{Number(date.slice(-2))}</Link> : <span key={`empty:${i}`}/>)}</div>
    </section>
    <section aria-labelledby="day-title"><h2 id="day-title">{dateLabel(day)}{day === today ? ' · Сегодня' : ''}</h2>
      <p className="calendarNote">Время приёмов: {timezone}. События здоровья — без указания времени.</p>
      {day < today && <p className="calendarNote">За прошлые дни показаны сохранённые отметки лекарств и записи здоровья. Отсутствие отметки не означает пропуск.</p>}
      {entries.length ? <><p className="calendarNote">Записей: {entries.length} · Открытых: {entries.filter(e => !e.done).length}</p><ul className="calendarEntries">{entries.map(entry => <li key={entry.id}><Link href={entry.href} className={entry.done ? 'calendarEntry done' : 'calendarEntry'}>
        <span className="calendarEntryTime">{entry.instant ? new Intl.DateTimeFormat('ru-RU', {timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(entry.instant)) : 'Весь день'}</span>
        <span><small>{pets.find(p => p.id === entry.petId)?.name}</small><strong>{entry.title}</strong><span>{entry.detail}</span><em>{entry.status}</em></span><span aria-hidden="true">›</span>
      </Link></li>)}</ul></> : <p className="calendarEmpty">На этот день записей нет.</p>}
      <p className="calendarNote">Откройте запись, чтобы посмотреть подробности. Приём лекарства можно отметить на экране лекарства в день приёма по его расписанию.</p>
    </section>
    <section className="calendarAdd"><h2>Добавить событие</h2>{selected.map(p => <div key={p.id}><strong>{p.name}</strong><Link href={`/pets/${p.id}/health/new`}>Запись здоровья</Link><Link href={`/pets/${p.id}/care`}>Лекарства</Link></div>)}</section>
  </div><BottomNav active="calendar"/></main>;
}
