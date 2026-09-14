import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { AnalyticsFormContext } from './context';
import {
  ANALYTICS_APP_VERSION,
  analyticsEnvironment,
  type AnalyticsEventName,
  type AnalyticsIds,
  type AnalyticsProperties,
  type AnalyticsSource,
  type AnalyticsSurface,
} from './events';

type AnalyticsRpcArgs = {
  p_event_id: string;
  p_event_name: string;
  p_occurred_at: string;
  p_anonymous_id: string | null;
  p_household_id: string | null;
  p_pet_id: string | null;
  p_surface: AnalyticsSurface;
  p_app_version: string;
  p_environment: ReturnType<typeof analyticsEnvironment>;
  p_session_id: string | null;
  p_source: AnalyticsSource;
  p_properties: Json;
};

type AnalyticsRpcClient = {
  rpc(name: 'track_analytics_event', args: AnalyticsRpcArgs): Promise<{ error: { message?: string } | null }>;
};

export async function trackServer<E extends AnalyticsEventName>(
  supabase: SupabaseClient<Database>,
  event: E,
  properties: AnalyticsProperties<E>,
  options: AnalyticsIds & { context?: AnalyticsFormContext | null } = {},
) {
  try {
    const context = options.context;
    const client = supabase as unknown as AnalyticsRpcClient;
    await client.rpc('track_analytics_event', {
      p_event_id: randomUUID(),
      p_event_name: event,
      p_occurred_at: new Date().toISOString(),
      p_anonymous_id: context?.anonymousId ?? null,
      p_household_id: options.householdId ?? null,
      p_pet_id: options.petId ?? null,
      p_surface: context?.surface ?? 'pwa',
      p_app_version: ANALYTICS_APP_VERSION,
      p_environment: analyticsEnvironment(),
      p_session_id: context?.sessionId ?? null,
      p_source: context?.source ?? 'direct',
      p_properties: properties as Json,
    });
  } catch {
    // Analytics is deliberately best-effort: never roll back or block a product action.
  }
}
