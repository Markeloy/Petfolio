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
    redirect(`/pets/${petId}/profile?error=Выберите фотографию`);
  }
  if (avatar.size > 8 * 1024 * 1024) {
    redirect(`/pets/${petId}/profile?error=Фото должно быть не больше 8 МБ`);
  }
  if (!avatarMimeTypes.has(avatar.type)) {
    redirect(`/pets/${petId}/profile?error=Используйте JPG, PNG, WebP, HEIC или HEIF`);
  }

  const extension = avatarExtensions[avatar.type] ?? "jpg";
  const avatarPath = `${petId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("pet-avatars").upload(avatarPath, avatar, {
    contentType: avatar.type,
    upsert: false,
  });

  if (uploadError) redirect(`/pets/${petId}/profile?error=Не удалось загрузить фотографию`);

  const { error: updateError } = await supabase.from("pets").update({ avatar_url: avatarPath }).eq("id", petId);
  if (updateError) redirect(`/pets/${petId}/profile?error=Фото загружено, но профиль не обновился`);

  redirect(`/pets/${petId}/profile?saved=1`);
}
