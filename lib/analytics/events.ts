export const analyticsEventNames = [
  'landing_viewed',
  'signup_started',
  'signup_completed',
  'login_completed',
  'pet_creation_started',
  'pet_created',
  'pet_profile_updated',
  'weight_recorded',
  'medication_created',
  'medication_detail_viewed',
  'dose_action_started',
  'dose_recorded',
  'dose_record_failed',
  'medication_history_viewed',
  'reminder_created',
  'notification_permission_prompted',
  'notification_permission_result',
  'reminder_delivery_attempted',
  'reminder_delivered',
  'reminder_opened',
  'reminder_completed',
  'reminder_snoozed',
  'reminder_disabled',
  'health_event_created',
  'vaccination_recorded',
  'parasite_treatment_recorded',
  'vet_visit_recorded',
  'calendar_viewed',
  'calendar_item_opened',
  'family_invite_started',
  'family_invite_sent',
  'family_invite_accepted',
  'premium_trigger_reached',
  'paywall_viewed',
  'trial_started',
  'subscription_started',
  'subscription_renewed',
  'subscription_cancelled',
  'subscription_expired',
  'critical_action_failed',
  'app_error_seen',
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];
export type AnalyticsSurface = 'pwa' | 'android_rustore' | 'web_desktop';
export type AnalyticsEnvironment = 'production' | 'staging' | 'development';
export type AnalyticsSource = 'direct' | 'telegram' | 'vk' | 'referral' | 'rustore' | 'organic' | 'other';
export type FailureClass = 'validation' | 'rls' | 'network' | 'storage' | 'server' | 'unknown';

export type AnalyticsEventMap = {
  landing_viewed: Record<string, never>;
  signup_started: Record<string, never>;
  signup_completed: { auth_method: 'password' };
  login_completed: { auth_method: 'password' };
  pet_creation_started: { entry_point: 'onboarding' | 'home' };
  pet_created: { species: 'dog' | 'cat' | 'bird' | 'rodent' | 'reptile' | 'other'; is_first_pet: boolean };
  pet_profile_updated: { fields_changed_count: number };
  weight_recorded: { is_first_weight: boolean };
  medication_created: { schedule_count: number; has_end_date: boolean; schedule_type: 'daily_time' | 'interval' | 'as_needed' };
  medication_detail_viewed: { medication_status: 'active' | 'paused' | 'completed' | 'cancelled' };
  dose_action_started: { action: 'given' | 'skipped' };
  dose_recorded: { status: 'given' | 'skipped'; already_recorded: boolean; schedule_type: 'daily_time' | 'interval' | 'as_needed' };
  dose_record_failed: { error_code: string; failure_class: FailureClass };
  medication_history_viewed: { history_count_bucket: '0' | '1-2' | '3-9' | '10-29' | '30+' };
  reminder_created: { reminder_type: 'medication' | 'vaccination' | 'treatment' | 'visit' | 'feeding' | 'stock' | 'custom'; channel_eligible: boolean };
  notification_permission_prompted: Record<string, never>;
  notification_permission_result: { result: 'granted' | 'denied' | 'dismissed' | 'unsupported' };
  reminder_delivery_attempted: { channel: 'web_push' | 'native_push' | 'in_app'; reminder_type: string };
  reminder_delivered: { channel: 'web_push' | 'native_push' | 'in_app'; reminder_type: string };
  reminder_opened: { channel: 'web_push' | 'native_push' | 'in_app'; reminder_type: string };
  reminder_completed: { reminder_type: string; completion_type: string };
  reminder_snoozed: { minutes: number };
  reminder_disabled: { reminder_type: string; reason_bucket?: string };
  health_event_created: { event_type: 'vaccination' | 'parasite' | 'visit' | 'symptom' | 'weight' | 'other'; status: 'planned' | 'completed' | 'cancelled' };
  vaccination_recorded: { has_next_due_date: boolean };
  parasite_treatment_recorded: { has_next_due_date: boolean };
  vet_visit_recorded: { has_follow_up_date: boolean };
  calendar_viewed: { period_view: string };
  calendar_item_opened: { item_type: string };
  family_invite_started: { entry_point: string };
  family_invite_sent: { channel: string };
  family_invite_accepted: { role: 'owner' | 'member' | 'viewer' };
  premium_trigger_reached: { trigger_type: string };
  paywall_viewed: { trigger_type: string; offer_variant: string };
  trial_started: { offer_variant: string };
  subscription_started: { plan: string; billing_period: 'monthly' | 'annual'; price_bucket: string };
  subscription_renewed: { plan: string };
  subscription_cancelled: { reason_bucket?: string };
  subscription_expired: { plan: string };
  critical_action_failed: { error_code: string; failure_class: FailureClass };
  app_error_seen: { error_code: string };
};

export type AnalyticsProperties<E extends AnalyticsEventName> = AnalyticsEventMap[E];

export type AnalyticsIds = {
  householdId?: string | null;
  petId?: string | null;
};

export const ANALYTICS_SCHEMA_VERSION = 1 as const;
export const ANALYTICS_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';

export function analyticsEnvironment(): AnalyticsEnvironment {
  const configured = process.env.NEXT_PUBLIC_APP_ENV;
  if (configured === 'production' || configured === 'staging' || configured === 'development') return configured;
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}
