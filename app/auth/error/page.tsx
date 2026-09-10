
import {getT} from "@/lib/i18n/server";
import Link from "next/link";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const t=await getT();
  const { reason } = await searchParams;
  const message = reason === "household"
    ? "Не удалось открыть данные семьи. Попробуйте войти снова."
    : reason === "pets"
      ? "Не удалось загрузить питомцев. Повторите попытку чуть позже."
      : reason === "confirmation"
        ? "Ссылка подтверждения недействительна или уже использована."
        : "Не удалось выполнить действие.";

  return <main className="authShell"><section className="authCard compactAuthCard"><p className="authBrand">Petfolio</p><div className="authIntro"><span className="authPaw">🐾</span><h1>{t("Что-то пошло не так")}</h1><p>{message}</p></div><Link className="primaryAction linkAction" href="/login">{t("Вернуться ко входу")}</Link></section></main>;
}
