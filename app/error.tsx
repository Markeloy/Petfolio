'use client';
import {useT} from "@/lib/i18n/client";

import Link from 'next/link';
export default function ApplicationError({retry}:{retry:()=>void}) {
  const t=useT();
  return <main className="authShell"><section className="authCard">
    <h1>{t("Не удалось открыть страницу")}</h1>
    <p role="alert">{t("Проверьте подключение к интернету и попробуйте ещё раз. Если ошибка возникла при сохранении, сначала проверьте историю записи.")}</p>
    <button className="primaryAction" onClick={retry}>{t("Попробовать снова")}</button>
    <p><Link href="/">{t("На главную")}</Link> · <Link href="/login">{t("Войти в аккаунт")}</Link></p>
  </section></main>;
}
