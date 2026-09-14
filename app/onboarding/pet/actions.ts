"use server";

import type { Json } from "@/lib/supabase/database.types";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { analyticsContextFromForm } from "@/lib/analytics/context";
import { trackServer } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";
import { familyMemberships } from "@/lib/family/server";

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

function onboardingUrl(params: Record<string, string>) {
  return `/onboarding/pet?${new URLSearchParams(params).toString()}`;
}


export async function createPet(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") redirect("/login");

  const {active:membership}=await familyMemberships(supabase,userId);
  if (!membership) redirect('/family');

  const analyticsContext = analyticsContextFromForm(formData);
  const name = String(formData.get("name") ?? "").trim();
  const speciesRaw = String(formData.get("species") ?? "other");
  const sexRaw = String(formData.get("sex") ?? "unknown");
  const birthDate = optionalText(formData, "birthDate");
  const weightRaw = String(formData.get("weight") ?? "").trim().replace(",", ".");
  const weight = weightRaw ? Number(weightRaw) : null;
  const avatar = formData.get("avatar");

  if (!name) redirect(onboardingUrl({ error: "Укажите имя питомца" }));

  const species = speciesValues.has(speciesRaw) ? speciesRaw as "dog" | "cat" | "bird" | "rodent" | "reptile" | "other" : "other";
  const sex = sexValues.has(sexRaw) ? sexRaw as "male" | "female" | "unknown" : "unknown";

  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 5000)) {
    redirect(onboardingUrl({ error: "Проверьте значение веса" }));
  }

  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 8 * 1024 * 1024) redirect(onboardingUrl({ error: "Фото должно быть не больше 8 МБ" }));
    if (!avatarMimeTypes.has(avatar.type)) redirect(onboardingUrl({ error: "Используйте JPG, PNG, WebP, HEIC или HEIF" }));
  }

  const { count: existingPetCount } = await supabase
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("household_id", membership.household_id)
    .is("archived_at", null);

  const rpc = supabase as unknown as {
    rpc(name:'create_pet_with_weight',args:{p_household_id:string;p_values:Json;p_weight:number|null}):Promise<{data:string|null;error:unknown}>;
  };
  const {data:petId,error:petError}=await rpc.rpc('create_pet_with_weight',{
    p_household_id:membership.household_id,p_weight:weight,p_values:{
      name,species,sex,birth_date:birthDate,
      breed:optionalText(formData,'breed'),color:optionalText(formData,'color'),
      microchip_number:optionalText(formData,'microchip'),passport_number:optionalText(formData,'passport'),
      vet_clinic:optionalText(formData,'clinic'),veterinarian:optionalText(formData,'veterinarian'),notes:optionalText(formData,'notes'),
    },
  });
  const pet=petId?{id:petId}:null;

  if (petError || !pet) redirect(onboardingUrl({ error: "Не удалось сохранить питомца" }));

  await trackServer(supabase, "pet_created", {
    species,
    is_first_pet: (existingPetCount ?? 0) === 0,
  }, { context: analyticsContext, householdId: membership.household_id, petId: pet.id });

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
    await trackServer(supabase, "weight_recorded", { is_first_weight: true }, {
      context: analyticsContext,
      householdId: membership.household_id,
      petId: pet.id,
    });
  }

  redirect("/");
}
