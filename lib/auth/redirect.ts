/** Resolve first: URL normalizes protocol-relative paths and backslashes. */
export function safeRedirect(value: string | null, origin: string, fallback = "/onboarding/pet") {
  if (!value) return fallback;
  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin === base.origin && !target.username && !target.password) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Invalid destinations use the application's default page.
  }
  return fallback;
}
