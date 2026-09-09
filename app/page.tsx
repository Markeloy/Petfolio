import { getReminders } from "@/lib/medications/reminders";
import { getHealthReminders } from "@/lib/health/reminders";
import { feedingReminders } from "@/lib/feeding/server";
import { activityReminders } from "@/lib/activity/server";
import { redirect } from "next/navigation";
import { PetfolioHome, type PetViewModel } from "@/app/components/petfolio-home";
import { createClient } from "@/lib/supabase/server";
import { familyMemberships } from "@/lib/family/server";
import {getT} from '@/lib/i18n/server';

export const dynamic = "force-dynamic";

function formatAge(birthDate: string | null,t:(text:string)=>string) {
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
    return `${years} ${t('ru-RU')==='en-US'?(years===1?'year':'years'):word}`;
  }

  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  const lastTwo = months % 100;
  const last = months % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? "месяцев" : last === 1 ? "месяц" : last >= 2 && last <= 4 ? "месяца" : "месяцев";
  return `${months} ${t('ru-RU')==='en-US'?(months===1?'month':'months'):word}`;
}

export default async function HomePage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
  const t=await getT();
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
  if(tab==='more')return <PetfolioHome pets={[]} initialTab="more"/>;

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
  const weightsPromise = Promise.all(petIds.map(petId=>supabase
    .from("weight_records").select("pet_id, weight_kg, measured_at").eq("pet_id",petId)
    .is("archived_at",null).order("measured_at",{ascending:false})
    .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1)));
  const [weightResults,[reminders,healthReminders,foodReminders,walkReminders]]=await Promise.all([weightsPromise,(async()=>{
    const {data:profile,error:profileError}=await supabase.from('profiles').select('timezone').eq('id',userId).maybeSingle();
    const now=new Date();
    return Promise.all([
      getReminders(supabase,petIds,now,t('ru-RU')),
      profileError?Promise.resolve(null):getHealthReminders(supabase,petIds,profile?.timezone??'Europe/Moscow',now,t),
      feedingReminders(supabase,petIds,now,t('ru-RU')),
      profileError?Promise.resolve(null):activityReminders(supabase,petIds,profile?.timezone??'Europe/Moscow',now,t),
    ]);
  })()]);
  if(weightResults.some(r=>r.error))throw new Error('Не удалось загрузить вес');
  const latestWeights=new Map(weightResults.flatMap(r=>r.data??[]).map(row=>[row.pet_id,Number(row.weight_kg)]));
  if(reminders&&healthReminders)for(const [petId,event] of healthReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }
  if(reminders&&foodReminders)for(const [petId,event] of foodReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }
  if(reminders&&walkReminders)for(const [petId,event] of walkReminders) {
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
      reminderError: reminders === null || healthReminders === null || foodReminders === null || walkReminders === null,
      stats: [
        [weight ? `${weight.toLocaleString(t('ru-RU'), { maximumFractionDigits: 3 })} ${t('кг')}` : "—", "Вес"],
        [formatAge(pet.birth_date,t), "Возраст"],
      ],
    };
  }));

  const initialTab = 'home';
  return <PetfolioHome key={`${membership.household_id}:${initialTab}`} pets={pets} initialTab={initialTab} />;
}
