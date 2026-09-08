'use client';
export default function HealthError({reset}:{reset:()=>void}) {return <main className="detailShell healthShell"><h1>Не удалось загрузить здоровье</h1><p>Попробуйте ещё раз. Если вы сохраняли запись, после загрузки проверьте журнал.</p><button className="primaryAction" onClick={reset}>Загрузить снова</button></main>;}
