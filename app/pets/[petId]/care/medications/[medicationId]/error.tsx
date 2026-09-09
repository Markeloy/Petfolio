'use client';
import {useT} from "@/lib/i18n/client";

export default function MedicationError({ retry }: { retry: () => void }) {
  const t=useT();
  return <main className="detailShell"><h1>{t("Не удалось загрузить приёмы")}</h1><p>{t("Отметки могли сохраниться. Загрузите страницу ещё раз, чтобы увидеть актуальные данные.")}</p><button className="primaryAction" onClick={retry}>{t("Попробовать снова")}</button></main>;
}
