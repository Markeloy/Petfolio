import {procedureReminders} from '@/lib/procedures/server';
import { getReminders } from "@/lib/medications/reminders";
import { getHealthReminders } from "@/lib/health/reminders";
import { feedingReminders } from "@/lib/feeding/server";
import { activityReminders } from "@/lib/activity/server";
import { redirect } from "next/navigation";
import { PetfolioHome, type PetViewModel } from "@/app/components/petfolio-home";
import { createClient } from "@/lib/supabase/server";
import { familyMemberships } from "@/lib/family/server";
import {getT} from '@/lib/i18n/server';
import {allPages} from '@/lib/calendar/data';
import {stockNotices,type Notice} from '@/lib/notifications/model';

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
    .select("id, name, birth_date, avatar_url, created_at, weight_records(weight_kg, measured_at)")
    .is("weight_records.archived_at", null)
    .order("measured_at", {referencedTable:"weight_records", ascending:false})
    .order("created_at", {referencedTable:"weight_records", ascending:false})
    .order("id", {referencedTable:"weight_records", ascending:false})
    .limit(1, {referencedTable:"weight_records"})
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
  const avatarPaths=[...new Set(petRows.flatMap(p=>p.avatar_url?[p.avatar_url]:[]))];
  const avatarsPromise=avatarPaths.length
    ?supabase.storage.from('pet-avatars').createSignedUrls(avatarPaths,60*60)
    :Promise.resolve({data:[],error:null});
  const profilePromise=supabase.from('profiles').select('timezone').eq('id',userId).maybeSingle().then(result=>result);
  const now=new Date();
  const stockPromise=allPages((from,to)=>supabase.from('stock_items').select('id,name,quantity,threshold,unit,updated_at,archived_at').eq('household_id',membership.household_id).is('archived_at',null).eq('is_low',true).order('name').order('id').range(from,to)).catch(()=>null);
  const [lowStock,avatars,careReminders,reminders,healthReminders,foodReminders,walkReminders]=await Promise.all([
    stockPromise,avatarsPromise,
    procedureReminders(supabase,petIds,now,t),
    getReminders(supabase,petIds,now,t('ru-RU')),
    profilePromise.then(({data,error})=>error?null:getHealthReminders(supabase,petIds,data?.timezone??'Europe/Moscow',now,t)),
    feedingReminders(supabase,petIds,now,t('ru-RU')),
    profilePromise.then(({data,error})=>error?null:activityReminders(supabase,petIds,data?.timezone??'Europe/Moscow',now,t)),
  ]);
  const images=new Map((avatars.data??[]).map(item=>[item.path,item.signedUrl]));
  const latestWeights=new Map(petRows.map(p=>[p.id,p.weight_records[0]?.weight_kg]));
  const shopping=stockNotices(lowStock??[],t);
  const notices:Notice[]=[...shopping];
  for(const set of [reminders,healthReminders,foodReminders,walkReminders,careReminders])for(const [petId,event] of set??[]){
    notices.push({id:`care:${event.href}:${event.instant}`,kind:'care',title:event.name,detail:`${petRows.find(p=>p.id===petId)?.name??''} · ${event.dose} · ${event.when}`,href:event.href});
  }
  if(reminders&&careReminders)for(const [petId,event] of careReminders){const current=reminders.get(petId);if(!current||event.instant<current.instant)reminders.set(petId,event);}
  if(reminders&&healthReminders)for(const [petId,event] of healthReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }
  if(reminders&&foodReminders)for(const [petId,event] of foodReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }
  if(reminders&&walkReminders)for(const [petId,event] of walkReminders) {
    if(!reminders.has(petId)||Date.parse(event.instant)<Date.parse(reminders.get(petId)!.instant))reminders.set(petId,event);
  }

  const pets: PetViewModel[] = petRows.map(pet => {
    const weight = latestWeights.get(pet.id);
    const image = pet.avatar_url ? images.get(pet.avatar_url) ?? null : null;

    return {
      id: pet.id,
      name: pet.name,
      image,
      reminder: reminders?.get(pet.id) ?? null,
      reminderError: reminders === null || healthReminders === null || foodReminders === null || walkReminders === null || careReminders === null,
      stats: [
        [weight ? `${weight.toLocaleString(t('ru-RU'), { maximumFractionDigits: 3 })} ${t('кг')}` : "—", "Вес"],
        [formatAge(pet.birth_date,t), "Возраст"],
      ],
    };
  });

  const initialTab = 'home';
  return <PetfolioHome key={`${membership.household_id}:${initialTab}`} pets={pets} initialTab={initialTab} notices={notices} shopping={shopping} noticeScope={`${userId}:${membership.household_id}`} noticeError={lowStock===null||reminders===null||healthReminders===null||foodReminders===null||walkReminders===null||careReminders===null} />;
}
