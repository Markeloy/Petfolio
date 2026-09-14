"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyticsContextFromForm } from "@/lib/analytics/context";
import { trackServer } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function medicationFormUrl(petId: string, params: Record<string, string>) {
  return `/pets/${petId}/care/medications/new?${new URLSearchParams(params).toString()}`;
}

type MedicationCourseRpc = {
  rpc(name: "create_medication_course", args: {
    p_pet_id: string;
    p_name: string;
    p_dose_amount: number | null;
    p_dose_unit: string | null;
    p_instructions: string | null;
    p_starts_on: string;
    p_ends_on: string | null;
    p_notes: string | null;
    p_timezone: string;
    p_days_of_week: number[];
    p_times: string[];
  }): Promise<{ data: string | null; error: { code?: string } | null }>;
};

export async function createMedication(petId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") redirect("/login");

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .is("archived_at", null)
    .maybeSingle();

  if (!pet) redirect("/auth/error?reason=pet");

  const analyticsContext = analyticsContextFromForm(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(medicationFormUrl(petId, { error: "Укажите название лекарства" }));

  const doseRaw = String(formData.get("doseAmount") ?? "").trim().replace(",", ".");
  const doseAmount = doseRaw ? Number(doseRaw) : null;
  if (doseAmount !== null && (!Number.isFinite(doseAmount) || doseAmount <= 0)) {
    redirect(medicationFormUrl(petId, { error: "Проверьте дозировку" }));
  }

  const startsOn = String(formData.get("startsOn") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const endsOn = optionalText(formData, "endsOn");
  const times = [...new Set(["time1", "time2", "time3"]
    .map((key) => String(formData.get(key) ?? "").trim())
    .filter(Boolean))];

  const timezone = String(formData.get("timezone") ?? "Europe/Moscow").trim();
  const daysOfWeek = [...new Set(formData.getAll("daysOfWeek").map(Number))];
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  let validationError = "";
  if (!validDate(startsOn) || (endsOn && !validDate(endsOn))) validationError = "Укажите корректные даты курса";
  else if (endsOn && endsOn < startsOn) validationError = "Окончание курса не может быть раньше начала";
  else if (!times.length || times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) validationError = "Укажите хотя бы одно корректное время приёма";
  else if (!daysOfWeek.length || daysOfWeek.some(day => !Number.isInteger(day) || day < 1 || day > 7)) validationError = "Выберите дни приёма";
  try { new Intl.DateTimeFormat("ru-RU", { timeZone: timezone }).format(); }
  catch { validationError = "Выберите корректный часовой пояс"; }
  if (validationError) redirect(medicationFormUrl(petId, { error: validationError }));

  const rpcClient = supabase as unknown as MedicationCourseRpc;
  const { data: medicationId, error: medicationError } = await rpcClient.rpc("create_medication_course", {
    p_pet_id: petId,
    p_name: name,
    p_dose_amount: doseAmount,
    p_dose_unit: optionalText(formData, "doseUnit"),
    p_instructions: optionalText(formData, "instructions"),
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_notes: optionalText(formData, "notes"),
    p_timezone: timezone,
    p_days_of_week: daysOfWeek,
    p_times: times,
  });

  if (medicationError || !medicationId) {
    await trackServer(supabase, "critical_action_failed", {
      error_code: medicationError?.code === "42501" ? "medication_create_rls" : "medication_create_failed",
      failure_class: medicationError?.code === "42501" ? "rls" : "server",
    }, { context: analyticsContext, petId });
    redirect(medicationFormUrl(petId, { error: "Не удалось сохранить лекарство" }));
  }

  await trackServer(supabase, "medication_created", {
    schedule_count: times.length,
    has_end_date: Boolean(endsOn),
    schedule_type: "daily_time",
  }, { context: analyticsContext, petId });

  revalidatePath('/calendar');
  revalidatePath('/');
  revalidatePath(`/pets/${petId}/care`);
  redirect(`/pets/${petId}/care/medications/${medicationId}`);
}
