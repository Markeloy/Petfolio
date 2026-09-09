'use client';
import {useT} from "@/lib/i18n/client";

import Link from 'next/link';
export default function ErrorPage({retry}:{retry:()=>void}){
  const t=useT();return <><h1>{t("Запасы")}</h1><p role="alert">{t("Не удалось загрузить записи.")}</p><button onClick={retry}>{t("Повторить")}</button><p><Link href="/stock">{t("К списку запасов")}</Link></p></>;}
