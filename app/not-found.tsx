
import {getT} from "@/lib/i18n/server";
import Link from 'next/link';
export default async function NotFound() {
  const t=await getT();
  return <main className="authShell"><section className="authCard"><h1>{t("Запись недоступна")}</h1><p>{t("Возможно, ссылка устарела или у вас больше нет доступа к этой записи.")}</p><Link className="primaryAction" href="/">{t("На главную")}</Link></section></main>;
}
