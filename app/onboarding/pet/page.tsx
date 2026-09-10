
import {getT} from "@/lib/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PetWizard } from "./pet-wizard";

export const dynamic = "force-dynamic";

export default async function AddPetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t=await getT();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { error } = await searchParams;

  return <main className="authShell petOnboardingShell">
    <section className="authCard petOnboardingCard">
      <div className="onboardingTop"><p className="authBrand">Petfolio</p><Link href="/" aria-label={t("Закрыть")}>×</Link></div>
      <p><Link href="/family">{t("Есть приглашение? Присоединиться к семье")}</Link></p>
      <PetWizard error={t(error)} />
    </section>
  </main>;
}
