import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePetPhoto } from "./actions";
import {ProfileForm} from './profile-form';
import {feedingContext as petContext} from '@/lib/feeding/server';
import {localDate} from '@/lib/medications/schedule';

export const dynamic = "force-dynamic";

export default async function PetProfilePage({ params, searchParams }: { params: Promise<{ petId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
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
      <Link href="/" className="backButton" aria-label="Назад">‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>Профиль</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <section className="profilePhotoCard">
      <div className="profilePhotoPreview">
        {image ? <img src={image} alt={pet.name} /> : <span aria-hidden="true">🐾</span>}
      </div>
      <div>
        <p className="wizardEyebrow">Фото питомца</p>
        <h2>{image ? "Обновить фотографию" : "Добавить фотографию"}</h2>
        <p>Фото хранится в закрытом хранилище Petfolio и доступно только вашей семье.</p>
      </div>
    </section>

    <form className="medicationForm" action={action}>
      {error ? <p className="formNotice errorNotice" role="alert">{error}</p> : null}
      {saved ? <p className="formNotice successNotice" role="status">{saved==='profile'?'Данные питомца сохранены':'Фотография обновлена'}</p> : null}
      <section className="formSectionCard">
        <label className="standaloneLabel"><span>Выберите фото</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required /><small className="fieldHint">JPG, PNG, WebP или фото с iPhone, до 8 МБ</small></label>
      </section>
      <button className="primaryAction" type="submit">Сохранить фото</button>
    </form>

    <section className="careSection profileInfoSection">
      <div><p className="wizardEyebrow">Данные питомца</p><h2>Основная информация</h2></div>
      <dl className="profileDataList">
        <div><dt>Дата рождения</dt><dd>{pet.birth_date ?? "Не указана"}</dd></div>
        <div><dt>Порода</dt><dd>{pet.breed ?? "Не указана"}</dd></div>
        <div><dt>Пол</dt><dd>{sexLabel}</dd></div>
        <div><dt>Окрас</dt><dd>{pet.color ?? "Не указан"}</dd></div>
        <div><dt>Микрочип</dt><dd>{pet.microchip_number ?? "Не указан"}</dd></div>
        <div><dt>Ветпаспорт</dt><dd>{pet.passport_number ?? "Не указан"}</dd></div>
        <div><dt>Клиника</dt><dd>{pet.vet_clinic ?? "Не указана"}</dd></div>
        <div><dt>Ветеринар</dt><dd>{pet.veterinarian ?? "Не указан"}</dd></div>
      </dl>
      {pet.notes ? <p className="profileNotes">{pet.notes}</p> : null}
      <p><Link href={`/pets/${petId}/health/weight`}>Вес и история измерений →</Link></p>
      {canEdit&&<details><summary>Изменить данные питомца</summary><ProfileForm pet={pet} today={localDate(new Date(),timezone)} key={pet.updated_at}/></details>}
    </section>
  </main>;
}
