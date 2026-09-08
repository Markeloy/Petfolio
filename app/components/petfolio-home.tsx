"use client";

import Link from "next/link";
import type { ReminderView } from "@/lib/medications/reminders";
import { RefreshOnFocus } from "./refresh-on-focus";
import { useRef, useState, type ReactNode, type UIEvent } from "react";

type IconName =
  | "bell"
  | "heart"
  | "calendar"
  | "bowl"
  | "file"
  | "paw"
  | "settings"
  | "home"
  | "stock"
  | "family"
  | "more"
  | "syringe";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    bowl: <><path d="M4 12h16c0 5-3.6 8-8 8s-8-3-8-8Z"/><path d="M7 8c1.3-2 3-2 5 0 2-2 3.7-2 5 0"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>,
    paw: <><ellipse cx="12" cy="15.5" rx="5" ry="4"/><circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="6" r="2"/><circle cx="14.5" cy="6" r="2"/><circle cx="18.5" cy="10" r="2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
    stock: <><path d="M5 8h14l-1 13H6Z"/><path d="M8 8V5a4 4 0 0 1 8 0v3M9 13h6M9 17h4"/></>,
    family: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21c0-4 2.4-7 6-7s6 3 6 7M14 15c4 0 7 2 7 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    syringe: <><path d="m15 3 6 6M17 7l-9 9M14 4l6 6M7 13l4 4M8 16l-4 4M3 21l2-2"/></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export type PetViewModel = {
  id: string;
  name: string;
  image: string | null;
  stats: [string, string][];
  reminder: ReminderView | null;
  reminderError: boolean;
};

const sections: { title: string; description: string; icon: IconName; tone: string; route?: "care" | "profile" | "health" | "nutrition" | "documents" }[] = [
  { title: "Здоровье", description: "Вакцинации, обработки, осмотры", icon: "heart", tone: "rose", route: "health" },
  { title: "Уход", description: "Лекарства, груминг, процедуры", icon: "calendar", tone: "lilac", route: "care" },
  { title: "Питание", description: "Рацион, нормы, корм", icon: "bowl", tone: "sand", route: "nutrition" },
  { title: "Документы", description: "Ветпаспорт, справки, анализы", icon: "file", tone: "blue", route: "documents" },
  { title: "Активность", description: "Прогулки, тренировки", icon: "paw", tone: "green" },
  { title: "Профиль", description: "Фото, дата рождения, вес", icon: "settings", tone: "gray", route: "profile" },
];

function TopBar() {
  return <header className="topBar"><p className="eyebrow">Petfolio</p><button className="iconButton" type="button" aria-label="Уведомления"><Icon name="bell"/></button></header>;
}

function PetProfile({ pet, showAdd }: { pet: PetViewModel; showAdd: boolean }) {
  return <article className="petSlide" aria-label={pet.name}>
    <div className="petHeading"><h1>{pet.name}</h1></div>
    <div className="petOverview">
      <div className="stats">{pet.stats.map(([value, label]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="petPhoto">{pet.image ? <img src={pet.image} alt={pet.name}/> : <span className="petPhotoPlaceholder" aria-label="Фото питомца пока не добавлено"><Icon name="paw" size={54}/></span>}</div>
      {showAdd ? <Link className="addPet" href="/onboarding/pet" aria-label="Добавить питомца"><span>＋</span><small>Добавить<br/>питомца</small></Link> : <div aria-hidden="true" />}
    </div>
  </article>;
}

function PetCarousel({ pets, activeIndex, onActiveIndexChange }: { pets: PetViewModel[]; activeIndex: number; onActiveIndexChange: (index: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const width = event.currentTarget.clientWidth;
    if (!width) return;
    const nextIndex = Math.min(pets.length - 1, Math.max(0, Math.round(event.currentTarget.scrollLeft / width)));
    if (nextIndex !== activeIndex) onActiveIndexChange(nextIndex);
  }

  return <section className="petCarousel" aria-label="Профили питомцев">
    <div className="petTrack" ref={trackRef} onScroll={handleScroll}>{pets.map((pet, index) => <PetProfile key={pet.id} pet={pet} showAdd={index === pets.length - 1}/>)}</div>
    <div className="carouselStatus" aria-hidden="true">{pets.map((pet, index) => <i className={index === activeIndex ? "active" : ""} key={pet.id}/>)}</div>
  </section>;
}

function SectionCard({ section, petId }: { section: (typeof sections)[number]; petId: string }) {
  const content = <><span className="cardArrow">↗</span><span className="cardIcon"><Icon name={section.icon}/></span><strong>{section.title}</strong><small>{section.description}</small></>;
  if (section.route) return <Link className={`sectionCard ${section.tone}`} href={`/pets/${petId}/${section.route}`}>{content}</Link>;
  return <button className={`sectionCard ${section.tone}`} type="button">{content}</button>;
}

function Reminder({ pet }: { pet: PetViewModel }) {
  if (pet.reminderError) return <div className="reminder" role="status"><span>Не удалось загрузить напоминание. Обновите страницу.</span></div>;
  const reminder = pet.reminder;
  if (reminder) return <Link className="reminder" href={reminder.href}><span className="reminderIcon"><Icon name={reminder.kind==='feeding'?'bowl':'syringe'}/></span><span><small>{reminder.kind==='health'?'Здоровье':reminder.kind==='feeding'?'Следующее кормление':'Следующий приём'} · {reminder.dose}</small><strong>{reminder.name}</strong><time dateTime={reminder.instant}>{reminder.when}</time></span><b>›</b></Link>;
  return <Link className="reminder" href={`/pets/${pet.id}/health/new`}><span className="reminderIcon"><Icon name="syringe"/></span><span><small>Следующее напоминание</small><strong>Пока ничего не запланировано</strong><small>Добавить событие здоровья</small></span><b>›</b></Link>;
}

type NavKey = "home" | "calendar" | "stock" | "family" | "more";

const navItems: { key: NavKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Главная", icon: "home" },
  { key: "calendar", label: "Календарь", icon: "calendar" },
  { key: "stock", label: "Запасы", icon: "stock" },
  { key: "family", label: "Семья", icon: "family" },
  { key: "more", label: "Ещё", icon: "more" },
];

const placeholderCopy: Record<"calendar" | "stock" | "family", { title: string; description: string }> = {
  calendar: { title: "Календарь", description: "Здесь появятся события всех питомцев" },
  stock: { title: "Запасы", description: "Здесь появятся запасы и расходники" },
  family: { title: "Семья", description: "Здесь будет совместный уход за питомцами" },
};

export function BottomNav({ active, onChange }: { active: NavKey; onChange?: (tab: NavKey) => void }) {
  return <nav className="bottomNav" aria-label="Основная навигация">{navItems.map((item) => ['calendar','family','stock'].includes(item.key) || !onChange ? <Link href={['calendar','family','stock'].includes(item.key) ? `/${item.key}` : `/?tab=${item.key}`} className={active === item.key ? 'active' : ''} key={item.key} aria-current={active === item.key ? 'page' : undefined}><Icon name={item.icon} size={22}/><span>{item.label}</span></Link> : <button className={active === item.key ? "active" : ""} type="button" key={item.key} onClick={() => onChange(item.key)} aria-current={active === item.key ? "page" : undefined}><Icon name={item.icon} size={22}/><span>{item.label}</span></button>)}</nav>;
}

function HomeContent({ pets, activePetIndex, onActivePetIndexChange }: { pets: PetViewModel[]; activePetIndex: number; onActivePetIndexChange: (index: number) => void }) {
  const activePet = pets[activePetIndex] ?? pets[0];
  return <><TopBar/><PetCarousel pets={pets} activeIndex={activePetIndex} onActiveIndexChange={onActivePetIndexChange}/><section className="sectionGrid" aria-label="Разделы питомца">{sections.map((section) => <SectionCard key={section.title} section={section} petId={activePet.id}/>)}</section><Reminder pet={activePet}/></>;
}

function PlaceholderScreen({ tab }: { tab: "calendar" | "stock" | "family" }) {
  const copy = placeholderCopy[tab];
  return <><TopBar/><section className="placeholderScreen"><span className="placeholderIcon"><Icon name={navItems.find((item) => item.key === tab)?.icon ?? "home"} size={30}/></span><h1>{copy.title}</h1><p>{copy.description}</p></section></>;
}

function MoreScreen() {
  return <><TopBar/><section className="placeholderScreen moreScreen"><span className="placeholderIcon"><Icon name="more" size={30}/></span><h1>Ещё</h1><p>Здесь будут профиль, настройки, уведомления, экспорт и подписка Petfolio.</p><form action="/auth/signout" method="post"><button className="secondaryAction" type="submit">Выйти из аккаунта</button></form></section></>;
}

export function PetfolioHome({ pets, initialTab = 'home' }: { pets: PetViewModel[]; initialTab?: NavKey }) {
  const [activeTab, setActiveTab] = useState<NavKey>(initialTab);
  const [activePetIndex, setActivePetIndex] = useState(0);

  return <main className="appShell"><RefreshOnFocus/><div className="content">{activeTab === "home" ? <HomeContent pets={pets} activePetIndex={activePetIndex} onActivePetIndexChange={setActivePetIndex}/> : activeTab === "more" ? <MoreScreen/> : <PlaceholderScreen tab={activeTab}/>}</div><BottomNav active={activeTab} onChange={setActiveTab}/></main>;
}
