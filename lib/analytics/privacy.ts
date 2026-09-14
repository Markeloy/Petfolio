// Categorical allowlist shared by browser and server adapters. SQL independently enforces it.
export const propertyRules: Record<string, Record<string, readonly (string | number)[] | 'boolean' | 'count'>> = {
  "app_error_seen": {
    "error_code": [
      "page_load_failed"
    ]
  },
  "critical_action_failed": {
    "error_code": [
      "medication_access_denied",
      "medication_create_failed",
      "medication_creation_failed",
      "pet_create_failed",
      "weight_write_failed",
      "medication_create_rls"
    ],
    "failure_class": [
      "validation",
      "rls",
      "network",
      "storage",
      "server",
      "unknown"
    ]
  },
  "dose_action_started": {
    "action": [
      "given",
      "skipped"
    ]
  },
  "dose_record_failed": {
    "error_code": [
      "dose_access_denied",
      "dose_write_failed",
      "dose_network_failed"
    ],
    "failure_class": [
      "validation",
      "rls",
      "network",
      "storage",
      "server",
      "unknown"
    ]
  },
  "dose_recorded": {
    "already_recorded": "boolean",
    "schedule_type": [
      "daily_time",
      "interval",
      "as_needed"
    ],
    "status": [
      "given",
      "skipped"
    ]
  },
  "health_event_created": {
    "event_type": [
      "vaccination",
      "parasite",
      "visit",
      "symptom",
      "weight",
      "other"
    ],
    "status": [
      "planned",
      "completed",
      "cancelled"
    ]
  },
  "landing_viewed": {},
  "login_completed": {
    "auth_method": [
      "password"
    ]
  },
  "medication_created": {
    "has_end_date": "boolean",
    "schedule_count": [
      1,
      2,
      3
    ],
    "schedule_type": [
      "daily_time",
      "interval",
      "as_needed"
    ]
  },
  "medication_detail_viewed": {
    "medication_status": [
      "active",
      "paused",
      "completed",
      "cancelled"
    ]
  },
  "medication_history_viewed": {
    "history_count_bucket": [
      "0",
      "1-2",
      "3-9",
      "10-29",
      "30+"
    ]
  },
  "parasite_treatment_recorded": {
    "has_next_due_date": "boolean"
  },
  "pet_created": {
    "is_first_pet": "boolean",
    "species": [
      "dog",
      "cat",
      "bird",
      "rodent",
      "reptile",
      "other"
    ]
  },
  "pet_creation_started": {
    "entry_point": [
      "onboarding",
      "home"
    ]
  },
  "pet_profile_updated": {
    "fields_changed_count": "count"
  },
  "signup_completed": {
    "auth_method": [
      "password"
    ]
  },
  "signup_started": {},
  "vaccination_recorded": {
    "has_next_due_date": "boolean"
  },
  "vet_visit_recorded": {
    "has_follow_up_date": "boolean"
  },
  "weight_recorded": {
    "is_first_weight": "boolean"
  }
};

export function validAnalyticsProperties(event: string, properties: unknown): boolean {
  const rules = propertyRules[event];
  if (!rules || !properties || typeof properties !== 'object' || Array.isArray(properties)) return false;
  const values = properties as Record<string, unknown>;
  if (Object.keys(values).length !== Object.keys(rules).length) return false;
  return Object.entries(rules).every(([key, rule]) => {
    const value = values[key];
    if (rule === 'boolean') return typeof value === 'boolean';
    if (rule === 'count') return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
    return rule.some(allowed => allowed === value);
  });
}
