
import {getT} from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleFields } from "./schedule-fields";
import { SaveButton } from "./save-button";
import { createMedication } from "./actions";
import { localDate } from "@/lib/medications/schedule";

export const dynamic = "force-dynamic";

export default async function NewMedicationPage({ params, searchParams }: { params: Promise<{ petId: string }>; searchParams: Promise<{ error?: string }> }) {
  const t=await getT();
  const { petId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, name")
    .eq("id", petId)
    .is("archived_at", null)
    .maybeSingle();

  if (petError) redirect("/auth/error?reason=pet");
  if (!pet) notFound();

  const {data:profile,error:profileError}=await supabase.from("profiles").select("timezone").eq("id",claimsData.claims.sub).maybeSingle();
  if(profileError)throw new Error("Не удалось загрузить часовой пояс");
  const timezone=profile?.timezone||"Europe/Moscow";
  const today = localDate(new Date(),timezone);
  const zones=[...new Set([timezone,"Europe/Moscow","UTC",...Intl.supportedValuesOf("timeZone")])];
  const action = createMedication.bind(null, petId);

  return <main className="detailShell formDetailShell">
    <div className="detailTopBar">
      <Link href={`/pets/${petId}/care`} className="backButton" aria-label={t("Назад")}>‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>{t("Новое лекарство")}</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <form className="medicationForm" action={action}>
      {error ? <p className="formNotice errorNotice" role="alert">{t(error)}</p> : null}

      <section className="formSectionCard">
        <p className="wizardEyebrow">{t("Основное")}</p>
        <div className="wizardFields">
          <label><span>{t("Название лекарства")}</span><input name="name" type="text" placeholder={t("Например, Апоквел")} required /></label>
          <div className="splitFields">
            <label><span>{t("Дозировка")}</span><input name="doseAmount" type="number" step="0.001" min="0.001" inputMode="decimal" placeholder="1" /></label>
            <label><span>{t("Единица")}</span><input name="doseUnit" type="text" placeholder={t("таблетка / мл")} /></label>
          </div>
          <label><span>{t("Как давать")}</span><input name="instructions" type="text" placeholder={t("После еды, запить водой…")} /></label>
        </div>
      </section>

      <section className="formSectionCard">
        <p className="wizardEyebrow">{t("Курс")}</p>
        <div className="splitFields">
          <label><span>{t("Начало")}</span><input name="startsOn" type="date" defaultValue={today} required /></label>
          <label><span>{t("Окончание")}</span><input name="endsOn" type="date" /></label>
        </div>
      </section>

      <section className="formSectionCard">
        <p className="wizardEyebrow">{t("Время приёма")}</p>
        <p className="formSectionHint">{t("Можно указать до трёх приёмов в день. Оставьте лишние поля пустыми.")}</p>
        <div className="timeFields">
          <label><span>{t("Приём 1")}</span><input name="time1" type="time" required /></label>
          <label><span>{t("Приём 2")}</span><input name="time2" type="time" /></label>
          <label><span>{t("Приём 3")}</span><input name="time3" type="time" /></label>
        </div>
        <ScheduleFields initialTimezone={timezone} zones={zones}/>
      </section>

      <section className="formSectionCard">
        <label className="standaloneLabel"><span>{t("Комментарий")}</span><textarea name="notes" rows={3} placeholder={t("Любая важная информация о курсе")} /></label>
      </section>

      <SaveButton />
    </form>
  </main>;
}
