# Product analytics, schema 1

Implementation: `lib/analytics/{events,context,privacy,client,server}.ts`, `app/components/product-analytics.tsx`, `db/analytics-module.sql`.

- Provider-neutral event contract; Supabase is an adapter, not part of the event vocabulary.
- UUID event IDs, timestamptz/UTC occurrence, environment, surface, source, app version, anonymous/session IDs, authenticated actor and optional household/pet IDs.
- Database derives user_id from auth.uid(), verifies household/pet membership, deduplicates event_id, stores schema version 1. Clients cannot SELECT or INSERT the private table.
- Public SECURITY INVOKER wrapper calls a validated private SECURITY DEFINER function with empty search_path. The private function is callable only through roles that still undergo the same validation. No permissive table policy is needed.
- Both adapters and SQL enforce per-event categorical property keys AND values. URLs, UTM values, referrer hostnames, raw errors, names, medical values, filenames, notes and tokens are not payload fields.
- Only categorical acquisition source is retained. Unknown campaign sources become other.
- Reserved future event names stay in the type contract but are rejected by ingestion until their property schema and instrumentation are implemented.
- Analytics failure is swallowed. Server writes wait at most 1 second for each best-effort analytics call. A timeout can lose telemetry; business writes remain committed.
- Hidden form context is populated through refs after mount, without effect state updates or hydration differences. Blocked browser storage does not prevent submitting the form.
- View components suppress Strict Mode effect replay within a mount. Detail/history observers remount for a different medication. Separate navigations remain separate views.

## Instrumented events

landing_viewed, signup_started, signup_completed, login_completed, pet_creation_started, pet_created, weight_recorded, medication_created, medication_detail_viewed, dose_action_started, dose_recorded, dose_record_failed, medication_history_viewed, critical_action_failed (medication creation), app_error_seen.

Health creation additionally emits health_event_created with categorical kind and planned/completed/cancelled status. Existing health edits/follow-ups and procedure completions are represented authoritatively in business history and the metric SQL, not claimed to have full client funnel instrumentation.

Signup completion is emitted after a confirmed session, the confirmation callback, or the next successful login. SQL derives its timestamp from Auth email_confirmed_at and a deterministic event UUID from auth.uid(), so repeated logins do not create another signup milestone. No anonymous completed-signup event is accepted. Failed analytics can be recovered at the next login.

Dose outcomes follow the database result, including the original status for an already-recorded occurrence. The requested button action must not replace the first recorded status. Failure events contain an allowlisted internal code and category only. No event reports a write as successful before the database succeeds.

## Trust and metrics

Authenticated actor and household boundaries are trusted; source, surface, environment and view/intent telemetry remain client-reported. An authenticated person can manually submit otherwise valid product events for their own pet. Telemetry is not an audit/security ledger or billing source.

`db/analytics-metrics.sql` calculates Setup Activation, Value Activation and WAAP from confirmed signup cohorts plus actual medication/weight/health/procedure rows and health audit transitions. This avoids treating a forged dose event as proof of care. It returns only aggregate counts, never medical content. Run only through an operator connection; do not expose it to app clients.

Definitions in that query:
- Cohort: unique production confirmed-signup users, default last 30 days. Configure cohort_start for the beta.
- Setup: pet creation and medication/weight/health setup both within 24 hours of confirmed signup.
- Value: a subsequent actual care action, strictly after setup, within 7 days of signup. The initial setup weight does not by itself count twice as value activation.
- WAAP: distinct assisted pet IDs per UTC calendar week, restricted to cohort-owned pets; given and skipped doses count, completed procedures count, planned/cancelled health events do not. Historical entry time is the assisted action time, not a backdated medical date.
- Push/reminder completion is not yet implemented; when it exists, add its authoritative completion rows to the query.
- Exclude developer/owner test accounts from the real beta cohort. Preserve environment separation; use development locally and staging for deployment rehearsal.
- Best-effort ingestion can undercount funnels. Reconcile cohorts with Auth if an account never produces signup telemetry. There is no claim of exactly-once delivery, only event-ID deduplication.

## Validation

CI runs JS privacy validation, actual dose-action tests with failed/rejected/timed-out analytics, and isolated PostgreSQL checks for categorical validation, private access, auth identity, signup deduplication, event deduplication and household isolation.
