
import {getT} from "@/lib/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t=await getT();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims?.sub) redirect("/");

  const params = await searchParams;
  const signupMode = params.mode === "signup";

  return <main className="authShell">
    <section className="authCard">
      <p className="authBrand">Petfolio</p>
      <div className="authIntro">
        <span className="authPaw">🐾</span>
        <h1>{signupMode ? t("Создать аккаунт") : t("Добро пожаловать")}</h1>
        <p>{signupMode ? t("Начните вести здоровье и уход за питомцами всей семьёй.") : t("Войдите, чтобы открыть Petfolio вашей семьи.")}</p>
      </div>

      {params.error ? <p className="formNotice errorNotice" role="alert">{t(params.error)}</p> : null}
      {params.message ? <p className="formNotice successNotice">{t(params.message)}</p> : null}

      <form className="authForm" action={signupMode ? signup : login}>
        {signupMode ? <label><span>{t("Имя")}</span><input name="name" type="text" autoComplete="name" placeholder={t("Маша")} required /></label> : null}
        <label><span>Email</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
        <label><span>{t("Пароль")}</span><input name="password" type="password" autoComplete={signupMode ? "new-password" : "current-password"} minLength={8} required /></label>
        {signupMode ? <label><span>{t("Повторите пароль")}</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required /></label> : null}
        <button className="primaryAction" type="submit">{signupMode ? t("Создать аккаунт") : t("Войти")}</button>
      </form>

      <p className="authSwitch">{signupMode ? t("Уже есть аккаунт?") : t("Впервые в Petfolio?")} <Link href={signupMode ? "/login" : "/login?mode=signup"}>{signupMode ? t("Войти") : t("Создать аккаунт")}</Link></p>
    </section>
  </main>;
}
