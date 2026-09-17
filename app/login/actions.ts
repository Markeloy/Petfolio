"use server";

import { redirect } from "next/navigation";
import { analyticsContextFromForm } from "@/lib/analytics/context";
import { trackServer } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

function authUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/login?${search.toString()}`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const analyticsContext = analyticsContextFromForm(formData);

  if (!email || !password) {
    redirect(authUrl({ error: "Введите email и пароль" }));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(authUrl({ error: "Не удалось войти. Проверьте email и пароль" }));
  }

  // Idempotent in the database; also covers confirmation links that use type=email.
  await trackServer(supabase, "signup_completed", { auth_method: "password" }, { context: analyticsContext });
  await trackServer(supabase, "login_completed", { auth_method: "password" }, { context: analyticsContext });
  redirect("/");
}

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const analyticsContext = analyticsContextFromForm(formData);

  if (!name || name.length > 100 || !email || email.length > 254 || !password) {
    redirect(authUrl({ mode: "signup", error: "Заполните обязательные поля" }));
  }

  if (password.length < 8) {
    redirect(authUrl({ mode: "signup", error: "Пароль должен содержать минимум 8 символов" }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    redirect(authUrl({ mode: "signup", error: "Не удалось создать аккаунт. Возможно, этот email уже используется" }));
  }

  if (data.session) {
    await trackServer(supabase, "signup_completed", { auth_method: "password" }, { context: analyticsContext });
    redirect("/onboarding/pet");
  }

  redirect(authUrl({ message: "Аккаунт создан. Подтвердите email по ссылке в письме, затем войдите" }));
}
