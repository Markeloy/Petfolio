"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const speciesValues = new Set(["dog", "cat", "bird", "rodent", "reptile", "other"]);
const sexValues = new Set(["male", "female", "unknown"]);
const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createPet(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) redirect("/auth/error?reason=household");

  const name = String(formData.get("name") ?? "").trim();
  const speciesRaw = String(formData.get("species") ?? "other");
  const sexRaw = String(formData.get("sex") ?? "unknown");
  const birthDate = optionalText(formData, "birthDate");
  const weightRaw = String(formData.get("weight") ?? "").trim().replace(",", ".");
  const weight = weightRaw ? Number(weightRaw) : null;
  const avatar = formData.get("avatar");

  if (!name) redirect("/onboarding/pet?error=Укажите имя питомца");

  const species = speciesValues.has(speciesRaw) ? speciesRaw as "dog" | "cat" | "bird" | "rodent" | "reptile" | "other" : "other";
  const sex = sexValues.has(sexRaw) ? sexRaw as "male" | "female" | "unknown" : "unknown";

  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 5000)) {
    redirect("/onboarding/pet?error=Проверьте значение веса");
  }

  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 8 * 1024 * 1024) redirect("/onboarding/pet?error=Фото должно быть не больше 8 МБ");
    if (!avatarMimeTypes.has(avatar.type)) redirect("/onboarding/pet?error=Используйте JPG, PNG, WebP, HEIC или HEIF");
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .insert({
      household_id: membership.household_id,
      created_by: userId,
      name,
      species,
      sex,
      birth_date: birthDate,
      breed: optionalText(formData, "breed"),
      color: optionalText(formData, "color"),
      microchip_number: optionalText(formData, "microchip"),
      passport_number: optionalText(formData, "passport"),
      vet_clinic: optionalText(formData, "clinic"),
      veterinarian: optionalText(formData, "veterinarian"),
      notes: optionalText(formData, "notes"),
    })
    .select("id")
    .single();

  if (petError || !pet) redirect("/onboarding/pet?error=Не удалось сохранить питомца");

  if (avatar instanceof File && avatar.size > 0) {
    const extension = avatarExtensions[avatar.type] ?? "jpg";
    const avatarPath = `${pet.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("pet-avatars").upload(avatarPath, avatar, {
      contentType: avatar.type,
      upsert: false,
    });

    if (!uploadError) {
      await supabase.from("pets").update({ avatar_url: avatarPath }).eq("id", pet.id);
    }
  }

  if (weight !== null) {
    const { error: weightError } = await supabase.from("weight_records").insert({
      pet_id: pet.id,
      weight_kg: weight,
      created_by: userId,
    });
    if (weightError) redirect("/?warning=Питомец сохранён, но вес пока не записан");
  }

  redirect("/");
}
