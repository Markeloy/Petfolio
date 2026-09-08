'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseMedicationEdit, validDate } from '@/lib/medications/edit-validation';

export type EditState = { error: string };

export async function saveMedication(petId: string, medicationId: string, version: string, _state: EditState, form: FormData): Promise<EditState> {
  let values;
  try { values = parseMedicationEdit(form); }
  catch (error) { return { error: error instanceof Error ? error.message : 'Проверьте поля.' }; }
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');
  const { data: pet } = await client.from('pets').select('id').eq('id',petId).is('archived_at',null).maybeSingle();
  if (!pet) return { error: 'Питомец недоступен.' };
  const { data, error } = await client.from('medications').update(values)
    .eq('id',medicationId).eq('pet_id',petId).eq('updated_at',version).select('id').maybeSingle();
  if (error) return { error: 'Не удалось сохранить. Введённые данные остались в форме.' };
  if (!data) return { error: 'Курс уже изменён другим участником. Обновите страницу перед повторным редактированием.' };
  revalidatePath('/'); revalidatePath('/calendar'); revalidatePath(`/pets/${petId}/care`);
  revalidatePath(`/pets/${petId}/care/medications/${medicationId}`);
  redirect(`/pets/${petId}/care/medications/${medicationId}?edited=1`);
}

export async function saveSchedule(petId: string, medicationId: string, scheduleId: string, version: string, _state: EditState, form: FormData): Promise<EditState> {
  const effective = String(form.get('effectiveOn') ?? '');
  const time = String(form.get('time') ?? '');
  const days = [...new Set(form.getAll('days').map(Number))];
  if (!validDate(effective) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !days.length || days.some(d=>!Number.isInteger(d)||d<1||d>7))
    return { error: 'Укажите дату, время и хотя бы один день недели.' };
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');
  const { data: medication } = await client.from('medications').select('id').eq('id',medicationId).eq('pet_id',petId).maybeSingle();
  const { data: schedule } = await client.from('medication_schedules').select('id').eq('id',scheduleId).eq('medication_id',medicationId).maybeSingle();
  if (!medication || !schedule) return { error: 'Расписание недоступно.' };
  const { error } = await client.rpc('revise_medication_schedule', {
    p_schedule_id: scheduleId, p_expected_updated_at: version, p_effective_on: effective, p_time: time, p_days: days,
  });
  if (error) return { error: error.code === '40001' ? 'Расписание уже изменилось. Обновите страницу.' :
    'Не удалось изменить расписание. Дата должна быть в будущем и в пределах курса; на неё не должно быть отметок или совпадающего расписания.' };
  revalidatePath('/'); revalidatePath('/calendar'); revalidatePath(`/pets/${petId}/care`);
  revalidatePath(`/pets/${petId}/care/medications/${medicationId}`);
  redirect(`/pets/${petId}/care/medications/${medicationId}?edited=1`);
}
