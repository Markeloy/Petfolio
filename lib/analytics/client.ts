'use client';
import {publicConfig} from '../config/public.ts';
import { validAnalyticsProperties } from './privacy';

import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import {
  ANALYTICS_APP_VERSION,
  ANALYTICS_SCHEMA_VERSION,
  analyticsEnvironment,
  type AnalyticsEventName,
  type AnalyticsIds,
  type AnalyticsProperties,
  type AnalyticsSource,
  type AnalyticsSurface,
} from './events';
import type { AnalyticsFormContext } from './context';

const anonymousKey = 'petfolio-anonymous-id';
const sessionKey = 'petfolio-session-id';
const sourceKey = 'petfolio-acquisition-source';

function newUuid() {
  return crypto.randomUUID();
}

function storageUuid(getStorage: () => Storage, key: string) {
  try {
    const storage = getStorage();
    const current = storage.getItem(key);
    if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
    const next = newUuid();
    storage.setItem(key, next);
    return next;
  } catch {
    return newUuid();
  }
}

function mapSource(raw: string | null): AnalyticsSource | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'telegram' || value === 'tg' || value === 't.me') return 'telegram';
  if (value === 'vk' || value === 'vkontakte') return 'vk';
  if (value === 'referral' || value === 'refer' || value === 'friend') return 'referral';
  if (value === 'rustore') return 'rustore';
  if (value === 'organic') return 'organic';
  if (value === 'direct') return 'direct';
  return 'other';
}

function acquisitionSource(): AnalyticsSource {
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = mapSource(params.get('utm_source') ?? params.get('source'));
    if (explicit) {
      localStorage.setItem(sourceKey, explicit);
      return explicit;
    }
    const saved = mapSource(localStorage.getItem(sourceKey));
    if (saved) return saved;
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) return 'organic';
    }
  } catch {
    return 'direct';
  }
  return 'direct';
}

function surface(): AnalyticsSurface {
  const configured = publicConfig().surface;
  if (configured === 'android_rustore' || configured === 'pwa' || configured === 'web_desktop') return configured;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return 'pwa';
  return 'web_desktop';
}

export function getClientAnalyticsContext(): AnalyticsFormContext {
  return {
    anonymousId: storageUuid(() => localStorage, anonymousKey),
    sessionId: storageUuid(() => sessionStorage, sessionKey),
    surface: surface(),
    source: acquisitionSource(),
  };
}

// Acquisition is represented only by the categorical source. Never retain URLs or UTM text.
export function acquisitionProperties(): Record<string, never> { return {}; }

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

export async function trackClient<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsProperties<E>,
  ids: AnalyticsIds = {},
) {
  try {
    if (!validAnalyticsProperties(event, properties)) return;
    const context = getClientAnalyticsContext();
    const client = createClient() as unknown as AnalyticsRpcClient;
    const { error } = await client.rpc('track_analytics_event', {
      p_event_id: newUuid(),
      p_event_name: event,
      p_occurred_at: new Date().toISOString(),
      p_anonymous_id: context.anonymousId,
      p_household_id: ids.householdId ?? null,
      p_pet_id: ids.petId ?? null,
      p_surface: context.surface,
      p_app_version: ANALYTICS_APP_VERSION,
      p_environment: analyticsEnvironment(),
      p_session_id: context.sessionId,
      p_source: context.source,
      p_properties: properties as Json,
    });
    if (error && process.env.NODE_ENV !== 'production') console.warn('Petfolio analytics event failed');
  } catch {
    // Product analytics must never block the user's core action.
  }
}

export { ANALYTICS_SCHEMA_VERSION };
