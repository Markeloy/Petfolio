import type { AnalyticsSource, AnalyticsSurface } from './events';

export type AnalyticsFormContext = {
  anonymousId: string | null;
  sessionId: string | null;
  surface: AnalyticsSurface;
  source: AnalyticsSource;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sources = new Set<AnalyticsSource>(['direct','telegram','vk','referral','rustore','organic','other']);
const surfaces = new Set<AnalyticsSurface>(['pwa','android_rustore','web_desktop']);

export function safeUuid(value: FormDataEntryValue | string | null | undefined) {
  const text = typeof value === 'string' ? value.trim() : '';
  return uuidPattern.test(text) ? text : null;
}

export function safeSource(value: FormDataEntryValue | string | null | undefined): AnalyticsSource {
  const text = typeof value === 'string' ? value.trim() as AnalyticsSource : 'direct';
  return sources.has(text) ? text : 'direct';
}

export function safeSurface(value: FormDataEntryValue | string | null | undefined): AnalyticsSurface {
  const text = typeof value === 'string' ? value.trim() as AnalyticsSurface : 'pwa';
  return surfaces.has(text) ? text : 'pwa';
}

export function analyticsContextFromForm(formData: FormData): AnalyticsFormContext {
  return {
    anonymousId: safeUuid(formData.get('analyticsAnonymousId')),
    sessionId: safeUuid(formData.get('analyticsSessionId')),
    surface: safeSurface(formData.get('analyticsSurface')),
    source: safeSource(formData.get('analyticsSource')),
  };
}
