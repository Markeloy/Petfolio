type IconName =
  | "bell" | "heart" | "calendar" | "bowl" | "file" | "paw" | "settings"
  | "home" | "pets" | "more" | "syringe";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    bowl: <><path d="M4 12h16c0 5-3.6 8-8 8s-8-3-8-8Z"/><path d="M7 8c1.3-2 3-2 5 0 2-2 3.7-2 5 0"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>,
    paw: <><ellipse cx="12" cy="15.5" rx="5" ry="4"/><circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="6" r="2"/><circle cx="14.5" cy="6" r="2"/><circle cx="18.5" cy="10" r="2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
    pets: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2"/><path d="M3 20c0-4 2-7 5-7s5 3 5 7M14 13c3 0 5 2 5 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    syringe: <><path d="m15 3 6 6M17 7l-9 9M14 4l6 6M7 13l4 4M8 16l-4 4M3 21l2-2"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const pet = {
  name: "Марли",
  breed: "Французский бульдог",
  image: "/marley.svg",
  stats: [["12.4 кг", "Вес"], ["2 года", "Возраст"], ["Кобель", "Пол"], ["Компактный", "Размер"]],
};

const sections: { title: string; description: string; icon: IconName; tone: string }[] = [
  { title: "Здоровье", description: "Вакцинации, осмотры, анализы", icon: "heart", tone: "rose" },
  { title: "Напоминания", description: "Лекарства, процедуры, уход", icon: "calendar", tone: "lilac" },
  { title: "Кормление", description: "Рацион, нормы, график", icon: "bowl", tone: "sand" },
  { title: "Документы", description: "Паспорт, вет. справки", icon: "file", tone: "blue" },
  { title: "Активности", description: "Прогулки, игры, тренировки", icon: "paw", tone: "green" },
  { title: "Настройки", description: "Профиль, параметры", icon: "settings", tone: "gray" },
];

function Header() {
  return <header className="header"><div><p className="eyebrow">Мой питомец</p><h1>{pet.name}</h1><p className="breed">{pet.breed}</p></div><button className="iconButton" aria-label="Уведомления"><Icon name="bell"/></button></header>;
}

function PetOverview() {
  return <section className="petOverview" aria-label="Информация о питомце">
    <div className="stats">{pet.stats.map(([value, label]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="petPhoto"><img src={pet.image} alt="Французский бульдог Марли"/></div>
    <button className="addPet" type="button"><span>＋</span><small>Добавить<br/>питомца</small></button>
  </section>;
}

function SectionCard({ title, description, icon, tone }: (typeof sections)[number]) {
  return <button className={`sectionCard ${tone}`} type="button"><span className="cardArrow">↗</span><span className="cardIcon"><Icon name={icon}/></span><strong>{title}</strong><small>{description}</small></button>;
}

function Reminder() {
  return <button className="reminder" type="button"><span className="reminderIcon"><Icon name="syringe"/></span><span><small>Следующее напоминание</small><strong>Вакцинация</strong><time dateTime="2024-10-12">12 октября 2024</time></span><b>›</b></button>;
}

const navItems: { label: string; icon: IconName }[] = [{ label: "Главная", icon: "home" }, { label: "Мои питомцы", icon: "pets" }, { label: "Здоровье", icon: "heart" }, { label: "Ещё", icon: "more" }];
function BottomNav() {
  return <nav className="bottomNav" aria-label="Основная навигация">{navItems.map((item, index) => <button className={index === 0 ? "active" : ""} type="button" key={item.label}><Icon name={item.icon} size={22}/><span>{item.label}</span></button>)}</nav>;
}

export default function Home() {
  return <main className="appShell"><div className="content"><Header/><PetOverview/><section className="sectionGrid" aria-label="Разделы">{sections.map(section => <SectionCard key={section.title} {...section}/>)}</section><Reminder/></div><BottomNav/></main>;
}
