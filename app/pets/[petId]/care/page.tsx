import {allPages} from '@/lib/calendar/data';
import {dateLabel} from '@/lib/health/types';
import {procedureKinds} from '@/lib/procedures/types';

import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
import {formatDose} from '@/lib/medications/schedule';
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CarePage({ params }: { params: Promise<{ petId: string }> }) {
  const t=await getT();
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

  const procedures=await allPages((from,to)=>supabase.from('care_procedures').select('*').eq('pet_id',petId).order('next_on',{nullsFirst:false}).order('id').range(from,to));
  const activeMedications = (medications ?? []).filter((medication) => medication.status === "active" || medication.status === "paused");

  return <main className="detailShell">
    <div className="detailTopBar">
      <Link href="/" className="backButton" aria-label={t("Назад")}>‹</Link>
      <div><p className="eyebrow">{pet.name}</p><h1>{t("Уход")}</h1></div>
      <span className="detailTopSpacer" aria-hidden="true" />
    </div>

    <section className="careHero">
      <p className="wizardEyebrow">{t("Уход за питомцем")}</p>
      <h2>{t("Лекарства, процедуры и регулярный уход")}</h2>
      <p>{t("Расписание и история ухода для")}{' '}{pet.name}{t(": приём лекарств, груминг и другие процедуры.")}</p>
    </section>

    <section className="careSection">
      <div className="sectionHeadingRow">
        <div><p className="wizardEyebrow">{t("Лекарства")}</p><h2>{t("Текущие курсы")}</h2></div>
        <Link className="compactAction" href={`/pets/${petId}/care/medications/new`}>{t("＋ Добавить")}</Link>
      </div>

      {activeMedications.length === 0 ? (
        <div className="emptyStateCard">
          <strong>{t("Лекарств пока нет")}</strong>
          <p>{t("Добавьте курс, дозировку и время приёма. Откройте лекарство, чтобы отметить приём и посмотреть историю семьи.")}</p>
          <Link className="primaryAction inlineAction" href={`/pets/${petId}/care/medications/new`}>{t("Добавить лекарство")}</Link>
        </div>
      ) : (
        <div className="medicationList">
          {activeMedications.map((medication) => {
            const scheduleTimes = medication.medication_schedules
              .filter((schedule) => schedule.is_active && schedule.scheduled_time)
              .map((schedule) => schedule.scheduled_time?.slice(0, 5))
              .filter(Boolean);
            const dose=formatDose(medication.dose_amount,medication.dose_unit,t('ru-RU'));

            return <Link className="medicationCard medicationLink" href={`/pets/${petId}/care/medications/${medication.id}`} key={medication.id}>
              <div className="medicationCardTop"><strong>{medication.name}</strong><span>{medication.status === "paused" ? t("На паузе") : t("Активно")}</span></div>
              <p>{dose}</p>
              {scheduleTimes.length > 0 ? <div className="scheduleChips">{scheduleTimes.map((time) => <span key={time}>{time}</span>)}</div> : <small>{t("Без фиксированного времени")}</small>}
              {medication.instructions ? <small>{medication.instructions}</small> : null}
            <span className="medicationOpen">{t("Приёмы и история →")}</span></Link>;
          })}
        </div>
      )}
    </section>

    <section className="careSection">
      <h2>{t("Завершённые курсы")}</h2>
      <p className="formSectionHint">{t("История остаётся доступной после завершения курса.")}</p>
      <div className="medicationList">{(medications ?? []).filter(m => m.status === 'completed' || m.status === 'cancelled').map(m =>
        <Link className="medicationCard medicationLink" href={`/pets/${petId}/care/medications/${m.id}`} key={m.id}>
          <strong>{m.name}</strong><p>{m.status === 'completed' ? t("Завершено") : t("Отменено")} {' '}{t("· Приёмы и история →")}</p>
        </Link>
      )}</div>
    </section>

    <section className="careSection">
      <div className="sectionHeadingRow"><h2>{t('Груминг и процедуры')}</h2><Link className="compactAction" href={`/pets/${petId}/care/procedures/new`}>{t('＋ Добавить')}</Link></div>
      {!procedures.length&&<p>{t('Запланируйте купание, стрижку когтей или другую процедуру. Отметки и история доступны всей семье.')}</p>}
      <div className="medicationList">{procedures.filter(p=>!p.archived_at).map(p=><Link className="medicationCard medicationLink" key={p.id} href={`/pets/${petId}/care/procedures/${p.id}`}><div className="medicationCardTop"><strong>{p.title}</strong><span>{t(procedureKinds[p.kind])}</span></div><p>{p.next_on?dateLabel(p.next_on,t('ru-RU')):t('Следующая процедура не запланирована')}</p><span className="medicationOpen">{t('Отметки и история →')}</span></Link>)}</div>
      {procedures.some(p=>p.archived_at)&&<details><summary>{t('Архив')}</summary><div className="medicationList">{procedures.filter(p=>p.archived_at).map(p=><Link className="medicationCard medicationLink" key={p.id} href={`/pets/${petId}/care/procedures/${p.id}`}>{p.title}</Link>)}</div></details>}
    </section>
  </main>;
}
