'use client';
import {useT} from "@/lib/i18n/client";

import Link from 'next/link';
export default function ErrorPage({retry}:{retry:()=>void}) {
  const t=useT();return <main className="appShell"><div className="content"><h1>{t("Семья")}</h1><p role="alert">{t("Не удалось загрузить семью. Попробуйте ещё раз.")}</p><button onClick={retry}>{t("Повторить")}</button><p><Link href="/">{t("На главную")}</Link></p></div></main>;}
