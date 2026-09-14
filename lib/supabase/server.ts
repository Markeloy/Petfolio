import {publicConfig} from '@/lib/config/public';
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();
  const {supabaseUrl:url,publishableKey}=publicConfig();

  if (!url || !publishableKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The root proxy refreshes sessions.
        }
      },
    },
  });
}
