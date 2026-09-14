'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { todayOccurrence } from '@/lib/medications/schedule';

import { trackServer } from '@/lib/analytics/server';
import { analyticsContextFromForm } from '@/lib/analytics/context';

type MedicationStatus = 'active' | 'paused' | 'completed';

export async function setMedicationStatus(petId: string, medicationId: string, formData: FormData) {
  const path = `/pets/${petId}/care/medications/${medicationId}`;
  const status = String(formData.get('status')) as MedicationStatus;
  if (!['active', 'paused', 'completed'].includes(status)) {
    redirect(`${path}?error=${encodeURIComponent('Неизвестное действие с курсом.')}`);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');

  const { data, error } = await supabase
    .from('medications')
    .update({ status })
    .eq('id', medicationId)
    .eq('pet_id', petId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    redirect(`${path}?error=${encodeURIComponent('Не удалось изменить состояние курса.')}`);
  }

  revalidatePath(path);
  revalidatePath('/calendar');
  revalidatePath(`/pets/${petId}/care`);
  revalidatePath('/');
  redirect(`${path}?course=${status}`);
}

export async function recordDose(petId: string, medicationId: string, scheduleId: string, scheduledFor: string, formData: FormData) {
  const path = `/pets/${petId}/care/medications/${medicationId}`;
  const fail = (message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
  const status = String(formData.get('status'));
  if (status !== 'given' && status !== 'skipped') fail('Выберите «Дано» или «Пропущено».');
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect('/login');
  const [{ data: pet }, { data: medication }, { data: schedule }] = await Promise.all([
    supabase.from('pets').select('id').eq('id', petId).is('archived_at', null).maybeSingle(),
    supabase.from('medications').select('*').eq('id', medicationId).eq('pet_id', petId).maybeSingle(),
    supabase.from('medication_schedules').select('*').eq('id', scheduleId).eq('medication_id', medicationId).maybeSingle(),
  ]);
  if (!pet || !medication || !schedule) fail('Лекарство недоступно. Обновите страницу.');
  const expected = todayOccurrence(schedule!, medication!);
  if (!expected || expected !== scheduledFor) fail('Расписание изменилось или наступил новый день. Проверьте актуальные приёмы.');
  // Author and dosage snapshot are set inside the invoker RPC, never by this form.
  const result = await supabase.rpc('record_medication_dose', {
    p_schedule_id: scheduleId, p_scheduled_for: expected!, p_status: status as 'given' | 'skipped',
  }).then(value => value, () => ({ data: null, error: { code: 'NETWORK' } }));
  const {data,error}=result;
  if (error || !data?.[0]?.id) {
    await trackServer(supabase, 'dose_record_failed', {
      error_code: error?.code === '42501' ? 'dose_access_denied' : error?.code === 'NETWORK' ? 'dose_network_failed' : 'dose_write_failed',
      failure_class: error?.code === '42501' ? 'rls' : error?.code === 'NETWORK' ? 'network' : 'server',
    }, { petId, context: analyticsContextFromForm(formData) });
    fail('Не удалось сохранить отметку. Обновите страницу и попробуйте снова.');
  }
  await trackServer(supabase, 'dose_recorded', {
    status: data![0].status,
    already_recorded: data![0].already_recorded,
    schedule_type: schedule!.schedule_type,
  }, { petId, context: analyticsContextFromForm(formData) });
  revalidatePath(path);
  revalidatePath('/calendar');
  revalidatePath(`/pets/${petId}/care`);
  revalidatePath('/');
  redirect(`${path}?saved=${data![0].already_recorded ? 'existing' : 'new'}`);
}
