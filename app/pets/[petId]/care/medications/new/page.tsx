import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleFields } from "./schedule-fields";
import { SaveButton } from "./save-button";
import { createMedication } from "./actions";
import { localDate } from "@/lib/medications/schedule";

export const dynamic = "force-dynamic";

export default async function NewMedicationPage({ params, searchParams }: { params: Promise<{ petId: string }>; searchParams: Promise<{ error?: string }> }) {
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
      <Link href={`/pets/${petId}/care`} className="backButton" aria-label="Назад">‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>Новое лекарство</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <form className="medicationForm" action={action}>
      {error ? <p className="formNotice errorNotice" role="alert">{error}</p> : null}

      <section className="formSectionCard">
        <p className="wizardEyebrow">Основное</p>
        <div className="wizardFields">
          <label><span>Название лекарства</span><input name="name" type="text" placeholder="Например, Апоквел" required /></label>
          <div className="splitFields">
            <label><span>Дозировка</span><input name="doseAmount" type="number" step="0.001" min="0.001" inputMode="decimal" placeholder="1" /></label>
            <label><span>Единица</span><input name="doseUnit" type="text" placeholder="таблетка / мл" /></label>
          </div>
          <label><span>Как давать</span><input name="instructions" type="text" placeholder="После еды, запить водой…" /></label>
        </div>
      </section>

      <section className="formSectionCard">
        <p className="wizardEyebrow">Курс</p>
        <div className="splitFields">
          <label><span>Начало</span><input name="startsOn" type="date" defaultValue={today} required /></label>
          <label><span>Окончание</span><input name="endsOn" type="date" /></label>
        </div>
      </section>

      <section className="formSectionCard">
        <p className="wizardEyebrow">Время приёма</p>
        <p className="formSectionHint">Можно указать до трёх приёмов в день. Оставьте лишние поля пустыми.</p>
        <div className="timeFields">
          <label><span>Приём 1</span><input name="time1" type="time" required /></label>
          <label><span>Приём 2</span><input name="time2" type="time" /></label>
          <label><span>Приём 3</span><input name="time3" type="time" /></label>
        </div>
        <ScheduleFields initialTimezone={timezone} zones={zones}/>
      </section>

      <section className="formSectionCard">
        <label className="standaloneLabel"><span>Комментарий</span><textarea name="notes" rows={3} placeholder="Любая важная информация о курсе" /></label>
      </section>

      <SaveButton />
    </form>
  </main>;
}
