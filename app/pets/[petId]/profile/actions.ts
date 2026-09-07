"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function profileRedirect(petId: string, key: "error" | "saved", value: string) {
  const params = new URLSearchParams({ [key]: value });
  redirect(`/pets/${petId}/profile?${params.toString()}`);
}

export async function updatePetPhoto(petId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .is("archived_at", null)
    .maybeSingle();
  if (!pet) redirect("/auth/error?reason=pet");

  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || avatar.size === 0) {
    profileRedirect(petId, "error", "Выберите фотографию");
  }
  if (avatar.size > 8 * 1024 * 1024) {
    profileRedirect(petId, "error", "Фото должно быть не больше 8 МБ");
  }
  if (!avatarMimeTypes.has(avatar.type)) {
    profileRedirect(petId, "error", "Используйте JPG, PNG, WebP, HEIC или HEIF");
  }

  const extension = avatarExtensions[avatar.type] ?? "jpg";
  const avatarPath = `${petId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("pet-avatars").upload(avatarPath, avatar, {
    contentType: avatar.type,
    upsert: false,
  });

  if (uploadError) profileRedirect(petId, "error", "Не удалось загрузить фотографию");

  const { error: updateError } = await supabase.from("pets").update({ avatar_url: avatarPath }).eq("id", petId);
  if (updateError) profileRedirect(petId, "error", "Фото загружено, но профиль не обновился");

  profileRedirect(petId, "saved", "1");
}
