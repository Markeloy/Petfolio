"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

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

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/pets/${petId}/care/medications/new?error=Укажите название лекарства`);

  const doseRaw = String(formData.get("doseAmount") ?? "").trim().replace(",", ".");
  const doseAmount = doseRaw ? Number(doseRaw) : null;
  if (doseAmount !== null && (!Number.isFinite(doseAmount) || doseAmount <= 0)) {
    redirect(`/pets/${petId}/care/medications/new?error=Проверьте дозировку`);
  }

  const startsOn = String(formData.get("startsOn") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const endsOn = optionalText(formData, "endsOn");
  const times = [...new Set(["time1", "time2", "time3"]
    .map((key) => String(formData.get(key) ?? "").trim())
    .filter(Boolean))];

  const { data: medication, error: medicationError } = await supabase
    .from("medications")
    .insert({
      pet_id: petId,
      name,
      dose_amount: doseAmount,
      dose_unit: optionalText(formData, "doseUnit"),
      instructions: optionalText(formData, "instructions"),
      starts_on: startsOn,
      ends_on: endsOn,
      notes: optionalText(formData, "notes"),
      created_by: userId,
    })
    .select("id")
    .single();

  if (medicationError || !medication) {
    redirect(`/pets/${petId}/care/medications/new?error=Не удалось сохранить лекарство`);
  }

  if (times.length > 0) {
    const scheduleRows = times.map((time) => ({
      medication_id: medication.id,
      scheduled_time: time,
      active_from: startsOn,
      active_until: endsOn,
      created_by: userId,
    }));

    const { error: scheduleError } = await supabase.from("medication_schedules").insert(scheduleRows);
    if (scheduleError) {
      redirect(`/pets/${petId}/care?warning=Лекарство сохранено, но расписание нужно проверить`);
    }
  }

  redirect(`/pets/${petId}/care/medications/${medication.id}`);
}
