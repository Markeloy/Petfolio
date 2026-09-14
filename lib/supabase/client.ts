import {publicConfig} from '@/lib/config/public';
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  const {supabaseUrl:url,publishableKey}=publicConfig();

  if (!url || !publishableKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createBrowserClient<Database>(url, publishableKey);
}
