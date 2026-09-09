
import {getT} from "@/lib/i18n/server";
export default async function Loading(){
  const t=await getT();return <p role="status">{t("Загружаем документы…")}</p>;}
