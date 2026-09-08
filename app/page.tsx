import { getReminders } from "@/lib/medications/reminders";
import { getHealthReminders } from "@/lib/health/reminders";
import { redirect } from "next/navigation";
import { PetfolioHome, type PetViewModel } from "@/app/components/petfolio-home";
import { createClient } from "@/lib/supabase/server";
import { familyMemberships } from "@/lib/family/server";

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

export default async function HomePage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
  const {tab} = await searchParams;
  if (tab === 'calendar') redirect('/calendar');
  if (tab === 'family') redirect('/family');
  if (tab === 'stock') redirect('/stock');
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const {active:membership} = await familyMemberships(supabase,userId);
  if (!membership) redirect('/family');

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
  const weightResults = await Promise.all(petIds.map(petId=>supabase
    .from("weight_records").select("pet_id, weight_kg, measured_at").eq("pet_id",petId)
    .is("archived_at",null).order("measured_at",{ascending:false})
    .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1)));
  if(weightResults.some(r=>r.error))throw new Error('Не удалось загрузить вес');
  const weightRows = weightResults.flatMap(r=>r.data??[]);

  const latestWeights = new Map<string, number>();
  for (const row of weightRows ?? []) {
    if (!latestWeights.has(row.pet_id)) latestWeights.set(row.pet_id, Number(row.weight_kg));
  }

  const {data:profile,error:profileError}=await supabase.from('profiles').select('timezone').eq('id',userId).maybeSingle();
  const [reminders,healthReminders]=await Promise.all([
    getReminders(supabase,petIds),
    profileError?Promise.resolve(null):getHealthReminders(supabase,petIds,profile?.timezone??'Europe/Moscow'),
  ]);
  if(reminders&&healthReminders)for(const [petId,event] of healthReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }

  const pets: PetViewModel[] = await Promise.all(petRows.map(async (pet) => {
    const weight = latestWeights.get(pet.id);
    let image: string | null = null;

    if (pet.avatar_url) {
      const { data } = await supabase.storage.from("pet-avatars").createSignedUrl(pet.avatar_url, 60 * 60);
      image = data?.signedUrl ?? null;
    }

    return {
      id: pet.id,
      name: pet.name,
      image,
      reminder: reminders?.get(pet.id) ?? null,
      reminderError: reminders === null || healthReminders === null,
      stats: [
        [weight ? `${weight.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} кг` : "—", "Вес"],
        [formatAge(pet.birth_date), "Возраст"],
      ],
    };
  }));

  const initialTab = tab === 'more' ? tab : 'home';
  return <PetfolioHome key={`${membership.household_id}:${initialTab}`} pets={pets} initialTab={initialTab} />;
}
