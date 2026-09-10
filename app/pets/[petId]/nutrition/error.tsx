'use client';
import {useT} from "@/lib/i18n/client";

export default function ErrorPage({retry}:{retry:()=>void}){
  const t=useT();return <><h1>{t("Питание")}</h1><p role="alert">{t("Не удалось загрузить записи.")}</p><button onClick={retry}>{t("Повторить")}</button></>;}
