import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(request: NextRequest, value: string | null) {
  if (!value) return "/onboarding/pet";
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.origin === request.nextUrl.origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Invalid redirect values fall back to onboarding.
  }
  return "/onboarding/pet";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(request, request.nextUrl.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/auth/error?reason=confirmation", request.url));
}
