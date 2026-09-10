'use client';
import {useT} from "@/lib/i18n/client";

export default function HealthError({retry}:{retry:()=>void}) {
  const t=useT();return <main className="detailShell healthShell"><h1>{t("Не удалось загрузить здоровье")}</h1><p>{t("Попробуйте ещё раз. Если вы сохраняли запись, после загрузки проверьте журнал.")}</p><button className="primaryAction" onClick={retry}>{t("Загрузить снова")}</button></main>;}
