import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { doseKey, formatDose, formatMoment, nextOccurrence } from './schedule';
export type ReminderView = { href: string; name: string; dose: string; when: string; instant: string; kind?: 'health'|'feeding'|'activity' };
export async function getReminders(client: SupabaseClient<Database>, petIds: string[], now = new Date(),locale="ru-RU") {
  const { data: medications, error } = await client.from('medications').select('*,medication_schedules(*)').in('pet_id', petIds).eq('status', 'active');
  if (error) return null;
  const ids = (medications ?? []).flatMap(m => m.medication_schedules.map(s => s.id));
  const recorded = new Set<string>();
  if (ids.length) {
    // Page through future marks so a recorded dose never reappears as a reminder.
    for (let offset = 0; ; offset += 500) {
      const { data, error: dosesError } = await client.from('medication_doses').select('id,schedule_id,scheduled_for')
        .in('schedule_id', ids).gt('scheduled_for', now.toISOString()).order('id').range(offset, offset + 499);
      if (dosesError) return null;
      for (const dose of data ?? []) recorded.add(doseKey(dose.schedule_id, dose.scheduled_for));
      if (!data || data.length < 500) break;
    }
  }
  const result = new Map<string, ReminderView>();
  for (const medication of medications ?? []) {
    for (const schedule of medication.medication_schedules) {
      const instant = nextOccurrence(schedule, medication, recorded, now);
      if (!instant || (result.has(medication.pet_id) && Date.parse(result.get(medication.pet_id)!.instant) <= Date.parse(instant))) continue;
      result.set(medication.pet_id, {
        href: `/pets/${medication.pet_id}/care/medications/${medication.id}`, name: medication.name,
        dose: formatDose(medication.dose_amount, medication.dose_unit,locale), instant,
        when: `${formatMoment(instant, schedule.timezone,locale)} · ${schedule.timezone}`,
      });
    }
  }
  return result;
}
