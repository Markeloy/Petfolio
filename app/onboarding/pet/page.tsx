import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PetWizard } from "./pet-wizard";

export const dynamic = "force-dynamic";

export default async function AddPetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { error } = await searchParams;

  return <main className="authShell petOnboardingShell">
    <section className="authCard petOnboardingCard">
      <div className="onboardingTop"><p className="authBrand">Petfolio</p><Link href="/" aria-label="Закрыть">×</Link></div>
      <PetWizard error={error} />
    </section>
  </main>;
}
