'use client';
export default function HealthError({retry}:{retry:()=>void}) {return <main className="detailShell healthShell"><h1>Не удалось загрузить здоровье</h1><p>Попробуйте ещё раз. Если вы сохраняли запись, после загрузки проверьте журнал.</p><button className="primaryAction" onClick={retry}>Загрузить снова</button></main>;}
