import { redirect } from "next/navigation";
import { PetfolioHome, type PetViewModel } from "@/app/components/petfolio-home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatAge(birthDate: string | null) {
  if (!birthDate) return "—";

  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;

  if (years > 0) {
    const lastTwo = years % 100;
    const last = years % 10;
    const word = lastTwo >= 11 && lastTwo <= 14 ? "лет" : last === 1 ? "год" : last >= 2 && last <= 4 ? "года" : "лет";
    return `${years} ${word}`;
  }

  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  const lastTwo = months % 100;
  const last = months % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? "месяцев" : last === 1 ? "месяц" : last >= 2 && last <= 4 ? "месяца" : "месяцев";
  return `${months} ${word}`;
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/auth/error?reason=household");
  }

  const { data: petRows, error: petsError } = await supabase
    .from("pets")
    .select("id, name, birth_date, avatar_url, created_at")
    .eq("household_id", membership.household_id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (petsError) {
    redirect("/auth/error?reason=pets");
  }

  if (!petRows || petRows.length === 0) {
    redirect("/onboarding/pet");
  }

  const petIds = petRows.map((pet) => pet.id);
  const { data: weightRows } = await supabase
    .from("weight_records")
    .select("pet_id, weight_kg, measured_at")
    .in("pet_id", petIds)
    .order("measured_at", { ascending: false });

  const latestWeights = new Map<string, number>();
  for (const row of weightRows ?? []) {
    if (!latestWeights.has(row.pet_id)) latestWeights.set(row.pet_id, Number(row.weight_kg));
  }

  const pets: PetViewModel[] = petRows.map((pet) => {
    const weight = latestWeights.get(pet.id);
    return {
      id: pet.id,
      name: pet.name,
      image: pet.avatar_url,
      stats: [
        [weight ? `${weight.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} кг` : "—", "Вес"],
        [formatAge(pet.birth_date), "Возраст"],
      ],
    };
  });

  return <PetfolioHome pets={pets} />;
}
