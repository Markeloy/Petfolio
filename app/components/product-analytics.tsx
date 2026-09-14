'use client';

import { useEffect, useRef } from 'react';
import { acquisitionProperties, getClientAnalyticsContext, trackClient } from '@/lib/analytics/client';
import type { AnalyticsEventName, AnalyticsIds, AnalyticsProperties } from '@/lib/analytics/events';

export function AnalyticsEvent<E extends AnalyticsEventName>({
  event,
  properties,
  ids,
}: {
  event: E;
  properties: AnalyticsProperties<E>;
  ids?: AnalyticsIds;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void trackClient(event, properties, ids);
  }, [event, ids, properties]);
  return null;
}

export function AnalyticsVisibilityEvent<E extends AnalyticsEventName>({
  event,
  properties,
  ids,
}: {
  event: E;
  properties: AnalyticsProperties<E>;
  ids?: AnalyticsIds;
}) {
  const marker = useRef<HTMLSpanElement | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const node = marker.current;
    if (!node || fired.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || fired.current) return;
      fired.current = true;
      observer.disconnect();
      void trackClient(event, properties, ids);
    }, { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [event, ids, properties]);
  return <span ref={marker} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }} />;
}

export function LoginAnalytics({ signupMode }: { signupMode: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void trackClient('landing_viewed', acquisitionProperties());
    if (signupMode) void trackClient('signup_started', {});
  }, [signupMode]);
  return null;
}

export function AnalyticsFormFields() {
  const anonymous = useRef<HTMLInputElement>(null);
  const session = useRef<HTMLInputElement>(null);
  const surface = useRef<HTMLInputElement>(null);
  const source = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const context = getClientAnalyticsContext();
      if (anonymous.current) anonymous.current.value = context.anonymousId ?? '';
      if (session.current) session.current.value = context.sessionId ?? '';
      if (surface.current) surface.current.value = context.surface;
      if (source.current) source.current.value = context.source;
    } catch {
      // Optional analytics context must never break form rendering or submission.
    }
  }, []);
  return <>
    <input ref={anonymous} type="hidden" name="analyticsAnonymousId" defaultValue="" />
    <input ref={session} type="hidden" name="analyticsSessionId" defaultValue="" />
    <input ref={surface} type="hidden" name="analyticsSurface" defaultValue="pwa" />
    <input ref={source} type="hidden" name="analyticsSource" defaultValue="direct" />
  </>;
}
