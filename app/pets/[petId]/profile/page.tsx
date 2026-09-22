
import {getT} from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePetPhoto } from "./actions";
import {ProfileForm} from './profile-form';
import {feedingContext as petContext} from '@/lib/feeding/server';
import {localDate} from '@/lib/medications/schedule';

export const dynamic = "force-dynamic";

export default async function PetProfilePage({ params, searchParams }: { params: Promise<{ petId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const t=await getT();
  const { petId } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, name, species, birth_date, breed, sex, color, avatar_url, microchip_number, passport_number, vet_clinic, veterinarian, notes, updated_at")
    .eq("id", petId)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) redirect("/auth/error?reason=pet");
  if (!pet) notFound();
  const {canEdit,timezone}=await petContext(petId);

  let image: string | null = null;
  if (pet.avatar_url) {
    const { data } = await supabase.storage.from("pet-avatars").createSignedUrl(pet.avatar_url, 60 * 60);
    image = data?.signedUrl ?? null;
  }

  const action = updatePetPhoto.bind(null, petId);
  const sexLabel = pet.sex === "male" ? "Самец" : pet.sex === "female" ? "Самка" : "Не указан";

  return <main className="detailShell formDetailShell">
    <div className="detailTopBar">
      <Link href="/" className="backButton" aria-label={t("Назад")}>‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>{t("Профиль")}</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <section className="profilePhotoCard">
      <div className="profilePhotoPreview">
        {image ? <img src={image} alt={pet.name} /> : <span aria-hidden="true">🐾</span>}
      </div>
      <div>
        <p className="wizardEyebrow">{t("Фото питомца")}</p>
        <h2>{image ? t("Обновить фотографию") : t("Добавить фотографию")}</h2>
        <p>{t("Фото хранится в закрытом хранилище Petfolio и доступно только вашей семье.")}</p>
      </div>
    </section>

    <form className="medicationForm" action={action}>
      {error ? <p className="formNotice errorNotice" role="alert">{t(error)}</p> : null}
      {saved ? <p className="formNotice successNotice" role="status">{saved==='profile'?t("Данные питомца сохранены"):t("Фотография обновлена")}</p> : null}
      <section className="formSectionCard">
        <label className="standaloneLabel"><span>{t("Выберите фото")}</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required /><small className="fieldHint">{t("JPG, PNG, WebP или фото с iPhone, до 8 МБ")}</small></label>
      </section>
      <button className="primaryAction" type="submit">{t("Сохранить фото")}</button>
    </form>

    <section className="careSection profileInfoSection">
      <div><p className="wizardEyebrow">{t("Данные питомца")}</p><h2>{t("Основная информация")}</h2></div>
      <dl className="profileDataList">
        <div><dt>{t("Дата рождения")}</dt><dd>{pet.birth_date ?? t("Не указана")}</dd></div>
        <div><dt>{t("Порода")}</dt><dd>{pet.breed ?? t("Не указана")}</dd></div>
        <div><dt>{t("Пол")}</dt><dd>{t(sexLabel)}</dd></div>
        <div><dt>{t("Окрас")}</dt><dd>{pet.color ?? t("Не указан")}</dd></div>
        <div><dt>{t("Микрочип")}</dt><dd>{pet.microchip_number ?? t("Не указан")}</dd></div>
        <div><dt>{t("Ветпаспорт")}</dt><dd>{pet.passport_number ?? t("Не указан")}</dd></div>
        <div><dt>{t("Клиника")}</dt><dd>{pet.vet_clinic ?? t("Не указана")}</dd></div>
        <div><dt>{t("Ветеринар")}</dt><dd>{pet.veterinarian ?? t("Не указан")}</dd></div>
      </dl>
      {pet.notes ? <p className="profileNotes">{pet.notes}</p> : null}
      <p><Link href={`/pets/${petId}/health/weight`}>{t("Вес и история измерений →")}</Link></p>
      {canEdit&&<details><summary>{t("Изменить данные питомца")}</summary><ProfileForm pet={pet} today={localDate(new Date(),timezone)} key={pet.updated_at}/></details>}
    </section>
  </main>;
}
