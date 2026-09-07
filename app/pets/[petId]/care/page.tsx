import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CarePage({ params }: { params: Promise<{ petId: string }> }) {
  const { petId } = await params;
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

  const { data: medications, error: medicationsError } = await supabase
    .from("medications")
    .select("id, name, dose_amount, dose_unit, instructions, starts_on, ends_on, status, medication_schedules(id, scheduled_time, is_active)")
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });

  if (medicationsError) redirect("/auth/error?reason=medications");

  const activeMedications = (medications ?? []).filter((medication) => medication.status === "active" || medication.status === "paused");

  return <main className="detailShell">
    <div className="detailTopBar">
      <Link href="/" className="backButton" aria-label="Назад">‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>Уход</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <section className="careHero">
      <p className="wizardEyebrow">Уход за питомцем</p>
      <h2>Лекарства, процедуры и регулярный уход</h2>
      <p>Здесь постепенно соберём всё, что семья делает для {pet.name}: приём лекарств, груминг и другие процедуры.</p>
    </section>

    <section className="careSection">
      <div className="sectionHeadingRow">
        <div><p className="wizardEyebrow">Лекарства</p><h2>Текущие курсы</h2></div>
        <Link className="compactAction" href={`/pets/${petId}/care/medications/new`}>＋ Добавить</Link>
      </div>

      {activeMedications.length === 0 ? (
        <div className="emptyStateCard">
          <strong>Лекарств пока нет</strong>
          <p>Добавьте курс, дозировку и время приёма. Откройте лекарство, чтобы отметить приём и посмотреть историю семьи.</p>
          <Link className="primaryAction inlineAction" href={`/pets/${petId}/care/medications/new`}>Добавить лекарство</Link>
        </div>
      ) : (
        <div className="medicationList">
          {activeMedications.map((medication) => {
            const scheduleTimes = medication.medication_schedules
              .filter((schedule) => schedule.is_active && schedule.scheduled_time)
              .map((schedule) => schedule.scheduled_time?.slice(0, 5))
              .filter(Boolean);
            const dose = medication.dose_amount && medication.dose_unit ? `${medication.dose_amount} ${medication.dose_unit}` : "Дозировка не указана";

            return <Link className="medicationCard medicationLink" href={`/pets/${petId}/care/medications/${medication.id}`} key={medication.id}>
              <div className="medicationCardTop"><strong>{medication.name}</strong><span>{medication.status === "paused" ? "На паузе" : "Активно"}</span></div>
              <p>{dose}</p>
              {scheduleTimes.length > 0 ? <div className="scheduleChips">{scheduleTimes.map((time) => <span key={time}>{time}</span>)}</div> : <small>Без фиксированного времени</small>}
              {medication.instructions ? <small>{medication.instructions}</small> : null}
            <span className="medicationOpen">Приёмы и история →</span></Link>;
          })}
        </div>
      )}
    </section>

    <section className="careSection mutedCareSection">
      <div><p className="wizardEyebrow">Скоро</p><h2>Груминг и процедуры</h2></div>
      <p>Этот блок будет следующим: стрижка когтей, купание, чистка ушей и любые собственные процедуры.</p>
    </section>
  </main>;
}
