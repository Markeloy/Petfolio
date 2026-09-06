import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
        <h1>{signupMode ? "Создать аккаунт" : "Добро пожаловать"}</h1>
        <p>{signupMode ? "Начните вести здоровье и уход за питомцами всей семьёй." : "Войдите, чтобы открыть Petfolio вашей семьи."}</p>
      </div>

      {params.error ? <p className="formNotice errorNotice" role="alert">{params.error}</p> : null}
      {params.message ? <p className="formNotice successNotice">{params.message}</p> : null}

      <form className="authForm" action={signupMode ? signup : login}>
        {signupMode ? <label><span>Имя</span><input name="name" type="text" autoComplete="name" placeholder="Маша" required /></label> : null}
        <label><span>Email</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
        <label><span>Пароль</span><input name="password" type="password" autoComplete={signupMode ? "new-password" : "current-password"} minLength={8} required /></label>
        {signupMode ? <label><span>Повторите пароль</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required /></label> : null}
        <button className="primaryAction" type="submit">{signupMode ? "Создать аккаунт" : "Войти"}</button>
      </form>

      <p className="authSwitch">{signupMode ? "Уже есть аккаунт?" : "Впервые в Petfolio?"} <Link href={signupMode ? "/login" : "/login?mode=signup"}>{signupMode ? "Войти" : "Создать аккаунт"}</Link></p>
    </section>
  </main>;
}
