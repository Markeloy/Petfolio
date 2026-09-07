'use client';
export default function MedicationError({ reset }: { reset: () => void }) {
  return <main className="detailShell"><h1>Не удалось загрузить приёмы</h1><p>Отметки могли сохраниться. Загрузите страницу ещё раз, чтобы увидеть актуальные данные.</p><button className="primaryAction" onClick={reset}>Попробовать снова</button></main>;
}
