"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {revalidatePath} from 'next/cache';
import {feedingContext as petContext} from '@/lib/feeding/server';
import {parsePetProfile} from '@/lib/pets/validation';
import {localDate} from '@/lib/medications/schedule';

export async function savePetProfile(petId:string,version:string,_state:{error?:string},form:FormData):Promise<{error?:string}> {
  const {client,canEdit,timezone}=await petContext(petId);
  if(!canEdit)return {error:'У вас нет права изменять профиль'};
  let values;
  try {values=parsePetProfile(form,localDate(new Date(),timezone));}
  catch(error){return {error:error instanceof Error?error.message:'Проверьте поля'};}
  const {data,error}=await client.from('pets').update({...values,updated_at:new Date().toISOString()}).eq('id',petId).eq('updated_at',version).is('archived_at',null).select('id').maybeSingle();
  if(error)return {error:'Не удалось сохранить профиль. Попробуйте снова'};
  if(!data)return {error:'Профиль уже изменился. Обновите страницу, чтобы не затереть изменения семьи'};
  revalidatePath('/','layout');
  redirect(`/pets/${petId}/profile?saved=profile`);
}

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function profileRedirect(petId: string, key: "error" | "saved", value: string): never {
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

  if (uploadError) {
    console.error("Pet avatar upload failed", {
      message: uploadError.message,
      name: uploadError.name,
      statusCode: "statusCode" in uploadError ? uploadError.statusCode : undefined,
      petId,
      mimeType: avatar.type,
      size: avatar.size,
    });
    profileRedirect(petId, "error", `Не удалось загрузить фотографию: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase.from("pets").update({ avatar_url: avatarPath }).eq("id", petId);
  if (updateError) {
    console.error("Pet avatar profile update failed", { message: updateError.message, petId });
    profileRedirect(petId, "error", "Фото загружено, но профиль не обновился");
  }

  profileRedirect(petId, "saved", "1");
}
