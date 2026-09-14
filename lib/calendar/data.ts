import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { addDays, doseKey, formatDose, localDate, occurrencesInDay } from '@/lib/medications/schedule';
import { healthKinds, healthStatuses } from '@/lib/health/types';

export type CalendarEntry = { id: string; petId: string; title: string; detail: string; status: string; href: string; instant: string | null; done: boolean };
// Stable paging avoids silently dropping rows at the Data API's response limit.
export async function allPages<T>(query: (from: number, to: number) => PromiseLike<{data: T[] | null; error: unknown}>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query(offset, offset + 499);
    if (result.error) throw new Error('Не удалось загрузить календарь');
    rows.push(...result.data ?? []);
    if (!result.data || result.data.length < 500) return rows;
  }
}
export async function calendarEntries(client: SupabaseClient<Database>, petIds: string[], day: string, timezone: string, now = new Date(),t:(text:string)=>string=text=>text): Promise<CalendarEntry[]> {
  const entries: CalendarEntry[] = [];
  for (const petId of petIds) {
    const [medications, health] = await Promise.all([
      allPages((from, to) => client.from('medications').select('*').eq('pet_id', petId).order('id').range(from, to)),
      allPages((from, to) => client.from('health_events').select('*').eq('pet_id', petId).is('archived_at', null)
        .or(`event_on.eq.${day},and(status.eq.completed,next_due_on.eq.${day})`).order('id').range(from, to)),
    ]);
    for (const event of health) {
      const base = {petId, title: event.title, href: `/pets/${petId}/health/events/${event.id}`, instant: null};
      if (event.event_on === day) entries.push({...base, id: `health:${event.id}`, detail: t(healthKinds[event.kind]), status: healthStatuses[event.status], done: event.status !== 'planned'});
      if (event.status === 'completed' && event.next_due_on === day) entries.push({...base, id: `repeat:${event.id}`, detail: t(healthKinds[event.kind]), status: 'Повтор по плану', done: false});
    }
    for (let offset = 0; offset < medications.length; offset += 100) {
      const batch = medications.slice(offset, offset + 100);
      const schedules = await allPages((from, to) => client.from('medication_schedules').select('*').in('medication_id', batch.map(m => m.id)).order('id').range(from, to));
      for (let start = 0; start < schedules.length; start += 100) {
        const selected = schedules.slice(start, start + 100);
        const doses = await allPages((from, to) => client.from('medication_doses').select('*').in('schedule_id', selected.map(s => s.id))
          .gte('scheduled_for', `${addDays(day, -1)}T00:00:00Z`).lt('scheduled_for', `${addDays(day, 2)}T00:00:00Z`).order('id').range(from, to));
        const recorded = new Set<string>();
        for (const dose of doses) {
          if (localDate(new Date(dose.scheduled_for), timezone) !== day) continue;
          recorded.add(doseKey(dose.schedule_id, dose.scheduled_for));
          const schedule = selected.find(s => s.id === dose.schedule_id)!;
          const medication = batch.find(m => m.id === schedule.medication_id)!;
          entries.push({id: `dose:${dose.id}`, petId, title: medication.name, detail: formatDose(dose.dose_amount, dose.dose_unit,t('ru-RU')),
            status: dose.status === 'given' ? 'Дано' : 'Пропущено', done: true, instant: dose.scheduled_for, href: `/pets/${petId}/care/medications/${medication.id}`});
        }
        // Past unrecorded schedules are not historical facts: status and dose can have changed.
        if (day < localDate(now, timezone)) continue;
        for (const schedule of selected) {
          const medication = batch.find(m => m.id === schedule.medication_id)!;
          for (const instant of occurrencesInDay(schedule, medication, day, timezone)) {
            if (recorded.has(doseKey(schedule.id, instant))) continue;
            entries.push({id: doseKey(schedule.id, instant), petId, title: medication.name, detail: formatDose(medication.dose_amount, medication.dose_unit,t('ru-RU')),
              status: Date.parse(instant) <= now.getTime() ? 'Не отмечено' : 'По расписанию', done: false, instant, href: `/pets/${petId}/care/medications/${medication.id}`});
          }
        }
      }
    }
  }
  return entries.sort((a,b) => (a.instant ?? '').localeCompare(b.instant ?? '') || a.title.localeCompare(b.title, 'ru') || a.id.localeCompare(b.id));
}
