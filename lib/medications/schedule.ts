// All calendar calculations use the schedule's timezone, never the server timezone.
export type Schedule = {
  id: string; medication_id: string; schedule_type: string; scheduled_time: string | null;
  days_of_week: number[]; timezone: string; active_from: string; active_until: string | null; is_active: boolean;
};
export type Course = { starts_on: string; ends_on: string | null; status: string };
export function localDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function wallParts(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
export function wallToInstant(date: string, time: string, timezone: string): string | null {
  const wall = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const nominal = Date.parse(`${wall}Z`);
  if (!Number.isFinite(nominal)) return null;
  // Sample offsets on both sides of DST transitions. Repeated wall times denote
  // one dose (the earlier instant); nonexistent times are not silently shifted.
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const probe = nominal + hours * 3600000;
    offsets.add(Date.parse(`${wallParts(new Date(probe), timezone)}Z`) - probe);
  }
  const candidates = [...offsets].map(offset => nominal - offset)
    .filter(ms => wallParts(new Date(ms), timezone) === wall).sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]).toISOString() : null;
}
export function occurrenceOn(schedule: Schedule, course: Course, date: string): string | null {
  if (!schedule.is_active || course.status !== 'active' || schedule.schedule_type !== 'daily_time' || !schedule.scheduled_time) return null;
  if (date < schedule.active_from || date < course.starts_on || (schedule.active_until && date > schedule.active_until) || (course.ends_on && date > course.ends_on)) return null;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  if (!schedule.days_of_week.includes(weekday)) return null;
  return wallToInstant(date, schedule.scheduled_time, schedule.timezone);
}
export function todayOccurrence(schedule: Schedule, course: Course, now = new Date()): string | null {
  return occurrenceOn(schedule, course, localDate(now, schedule.timezone));
}
export function doseKey(scheduleId: string, instant: string): string {
  return `${scheduleId}:${Date.parse(instant)}`;
}
export function nextOccurrence(schedule: Schedule, course: Course, recorded: Set<string>, now = new Date()): string | null {
  if (!schedule.is_active || course.status !== 'active' || schedule.schedule_type !== 'daily_time' || !schedule.scheduled_time || schedule.days_of_week.length === 0) return null;
  const start = [localDate(now, schedule.timezone), schedule.active_from, course.starts_on].sort().at(-1)!;
  // At most seven weekdays before an occurrence, plus one extra week for every
  // already-recorded future occurrence. No arbitrary horizon for future courses.
  for (let day = 0; day < 8 * (recorded.size + 1); day++) {
    const date = addDays(start, day);
    if ((course.ends_on && date > course.ends_on) || (schedule.active_until && date > schedule.active_until)) break;
    const instant = occurrenceOn(schedule, course, date);
    if (instant && Date.parse(instant) > now.getTime() && !recorded.has(doseKey(schedule.id, instant))) return instant;
  }
  return null;
}
export function formatMoment(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(instant));
}
export function formatDose(amount: number | null, unit: string | null): string {
  return amount === null ? 'Дозировка не указана' : `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}
