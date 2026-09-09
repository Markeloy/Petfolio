
import {getT} from "@/lib/i18n/server";
export default async function Loading(){
  const t=await getT();return <main className="detailShell healthShell"><p role="status">{t("Загружаем записи здоровья…")}</p></main>;}
