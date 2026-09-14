'use client';

import { useEffect, useRef, useState } from 'react';
import { acquisitionProperties, getClientAnalyticsContext, trackClient } from '@/lib/analytics/client';
import type { AnalyticsEventName, AnalyticsIds, AnalyticsProperties } from '@/lib/analytics/events';
import type { AnalyticsFormContext } from '@/lib/analytics/context';

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
  const [context, setContext] = useState<AnalyticsFormContext | null>(null);
  useEffect(() => setContext(getClientAnalyticsContext()), []);
  if (!context) return null;
  return <>
    <input type="hidden" name="analyticsAnonymousId" value={context.anonymousId ?? ''} />
    <input type="hidden" name="analyticsSessionId" value={context.sessionId ?? ''} />
    <input type="hidden" name="analyticsSurface" value={context.surface} />
    <input type="hidden" name="analyticsSource" value={context.source} />
  </>;
}
