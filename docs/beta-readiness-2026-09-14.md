# Petfolio private-beta readiness — 2026-09-14

Scope: repository Markeloy/Petfolio, branch codex/-petfolio, starting commit b81c5c841e304847d6014f05fbc764b6cd18cec9. DOCX was not used. The approved Home structure, five-item bottom navigation, colors and existing product scope remain intact.

**PRIVATE BETA: NO-GO for inviting users today.** The code checks pass; a deployed real-account/browser test and publication preparation have not been performed. READY below means implemented and supported by the stated automated evidence, not certification of a browser journey.

## Findings and fixes

1. Fixed AnalyticsFormFields effect state update using uncontrolled hidden input refs; no lint rule was disabled.
2. Removed raw UTM/referrer capture. Added matching TypeScript and SQL per-event categorical key/value validation. SQL continues to derive auth identity and enforce pet/household membership. Private tables and Storage remain private.
3. Completed actual dose outcomes after record_medication_dose, including original status/already_recorded and stable failure codes. Database anti-double-dose, schedule revisions and history were not replaced or weakened.
4. Analytics failures and a one-second analytics timeout cannot cancel a business write. Tests exercise the actual dose server action with success, existing mark, RLS failure, network rejection and analytics rejection.
5. Preserved create_medication_course signature, added finite/precision/text/date validation, checked atomically created schedules and auth-derived authors. A forced second-schedule failure rolls back the medication, first schedule and audit entries.
6. Found another partial write: onboarding inserted a pet before initial weight. Added create_pet_with_weight and a forced weight failure test proving no orphan pet remains.
7. Signup completion now requires a confirmed Auth identity, uses its confirmation time and a deterministic event ID. Confirmation callback and login recover the milestone without duplicate signup events.
8. Added ordinary weight and initial health creation telemetry, app error telemetry, pet context for dose intent, and session context in health/weight forms. Fixed signup-mode view tracking and medication navigation view keys.
9. Restored Care subtitle to “Лекарства, груминг, процедуры”. Fixed an untranslated health-status option. No redesign.
10. Added 192/512 PNG manifest icons and an Apple icon using the existing paw; HTTP checks verify PNG signatures and dimensions.
11. Added aggregate activation/WAAP SQL based on authoritative business writes rather than trusting client-reported care events.

## Verification evidence

Full push CI at commit 254f2940272ee535e6224cd2899bf72a2fad826a:
https://github.com/Markeloy/Petfolio/actions/runs/34864130017

npm ci, lint, typecheck, 50 JS tests, isolated PostgreSQL tests, production build and HTTP smoke all passed. No tests were skipped to obtain green. Final documentation/context fixes are also submitted to the same full workflow; use the latest successful run on this branch when deploying.

Database tests cover medications, atomic course creation, atomic pet/weight creation, analytics privacy/identity/deduplication, health/weight, feeding and stock atomicity, procedures, activity, calendar, family roles/isolation, private document metadata and avatar path policies. Test fixtures run in isolated PGlite transactions; no production test users or care records were created.

HTTP smoke verifies production startup, RU/EN login rendering, light/dark/system SSR, 14 protected routes, private document 401/no-store, 404, manifest/service worker and PNG icons. It does **not** test authenticated browser interactions, email delivery, real Storage uploads or physical-device installation. Existing database duplicate protections are tested; this run is not a new two-connection production race test.

## Database changes

Applied Supabase migration **20260914154626_beta_atomic_creation_and_private_analytics_v1** on project ubzfaghzucrrdbjwktoa:

- public.create_medication_course: existing compatible signature, SECURITY INVOKER, authenticated only, validation hardened.
- public.create_pet_with_weight: new atomic onboarding RPC, SECURITY INVOKER, authenticated only.
- public.track_analytics_event: SECURITY INVOKER wrapper retained.
- private.track_analytics_event: validated SECURITY DEFINER implementation, empty search_path, per-event categories, verified signup milestone.
- private.analytics_events: RLS and revoked direct client table access retained.

Exact applied SQL is under db/migrations. Executable function/module sources are also used by isolated CI. No migration was applied to business data, no service-role key was added, and record_medication_dose was unchanged.

Read-only production verification confirmed all public tables have RLS, both Storage buckets are non-public, and anon/authenticated lack direct SELECT/INSERT on the two private tables.

## Advisors after DDL

Security Advisor:
- 2 INFO: RLS enabled/no policy for private.family_invites and private.analytics_events. Intentional revoked private tables behind validated functions; no permissive policy added.
- 1 WARN: leaked-password protection disabled. Enable before public launch in Supabase Auth. This is not a claim that RLS is broken.
- Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Password setting: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Performance Advisor:
- 23 INFO unused indexes, no WARN/ERROR returned. No indexes removed. A low-traffic test database is insufficient evidence to delete them.
- Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Domain audit

| Domain | Status | Evidence / remaining limit |
|---|---|---|
| Auth | PARTIAL | Login/signup and safe confirmation redirects implemented; live email/session journey not verified; password recovery UI absent |
| Onboarding | READY | Pet and initial weight atomic, authors/membership checked, forced rollback tested |
| Pet profile | READY | Validated edits, stale-write conflict handling, private avatar path tests; real upload belongs to browser gate |
| Home | READY | Real data, six approved cards, four quick actions, five nav links, selected pet and low stock |
| Health | READY | Categories, planned/completed states, follow-ups, archive/history and isolation tested |
| Weight | READY | Validation, history, archive/conflicts and successful-write analytics; initial weight atomic |
| Medications | READY | Daily/weekday courses, timezone, revision/history, marks and duplicate protection; atomic creation tested |
| Care/procedures | READY | One-off/repeating procedures, marks, history and access tests |
| Feeding | READY | Plans, marks, history and atomic stock consumption tests |
| Documents | PARTIAL | Private upload/finalization/retry, filters/sort and archive implemented; actual file round-trip not exercised |
| Activity | READY | Plan/completion, history, validation and isolation tests |
| Calendar | READY | Pet/day/month views, combined domain data and historical mark semantics tested |
| Stock | READY | Fractional adjustments, idempotency, threshold/low-stock notices and atomic movements |
| Family | READY | Existing invite/role/revoke/transfer flows tested; premium gating/billing intentionally absent |
| Notifications | READY | In-app sheet/unread badge/current reminders; read receipts device-local, no closed-app delivery guarantee |
| Localization | PARTIAL | RU/EN and date/unit formatting implemented, automated rendered screens pass; full mobile copy review not performed |
| Themes | READY | Existing light/dark/system modes, SSR checks pass |
| PWA | PARTIAL | Manifest, service worker, PNG/Apple icons; install/launch on real devices still required |
| Analytics | READY | P0 contract/instrumentation, privacy checks, outcomes, signup dedupe and aggregate SQL; best-effort limitations documented |
| Security/RLS | PARTIAL | Isolation and private grants verified; leaked-password protection remains pre-public-launch work |
| Error states | PARTIAL | Forms retain most errors, retries/idempotence/stale-write guards tested; medication/onboarding redirects do not preserve every entered field |
| Deployment readiness | BLOCKER | Production build/start passes; no hosted beta URL, configured email redirects or host acceptance test in this session |
| Billing/native/push/offline-first | POST-BETA | Explicitly excluded from this task |

## Remaining invitation blockers (3)

1. Deploy the tested branch to an HTTPS beta URL, set the build/runtime public environment and Supabase Auth Site URL/redirect allowlist, verify connectivity and confirmation mail.
2. Run the real-account browser checklist below on that deployed build, including private Storage and installation. This session has no authenticated browser result.
3. Publish product privacy/beta terms and a real contact/deletion-request channel. Owner/operator identity, contact and retention/deletion decisions have not been supplied; do not publish invented legal text. These are launch tasks, not a claim of legal compliance.

Leaked-password protection is separately required before public launch. Premium, billing, native Android and full push/offline support are not invitation blockers.

## Owner acceptance checklist after deployment

Use a fresh beta account and non-sensitive fixture content. Run on mobile Chromium/Android and Safari/iPhone if available.

1. Register, follow confirmation email on the deployed domain, sign out and sign in. Repeat login must not create a second signup milestone.
2. Create one pet with initial weight. Home shows the pet and weight. Reload and reopen the app: both persist.
3. Create a daily medication with two distinct times today, valid timezone and selected weekdays. Detail opens; Home/Calendar/Care update.
4. Mark one occurrence Given and the other Skipped. Reload: status, author, time and history persist. Use two tabs for the same occurrence: exactly one first mark remains.
5. Edit the schedule; pause/resume/complete the course. Previous dose history and dosage snapshots remain unchanged.
6. Record weight from Quick add. Add planned vet visit and completed vaccination with a next date; check Home, health history and calendar. Enter an invalid value, correct it and retry.
7. Complete a procedure. Add feeding tied to stock; repeat a feeding mark and verify stock is consumed once. Cross a configured low-stock threshold and open the Home shopping notice.
8. Upload an ordinary PDF/image, open it, test filters/sort, archive/restore. A signed-out browser must not open the protected file route.
9. Record an activity; confirm its date/status in calendar. Check all five bottom-nav entries.
10. Open notifications, mark one/all read, reload. Switch RU/EN and light/dark/system; check usable controls at mobile width.
11. Install the PWA and launch from the home screen over HTTPS. Confirm the icon and signed-in session. Do not expect offline writes or closed-app push.
12. With a second unrelated account, verify the first account's pet URL and files are inaccessible. If testing family, verify a shared member sees the original dose author.
13. Disconnect network during a save, reconnect, then inspect history before retrying: no duplicated dose, stock movement or completed procedure.
14. Operator checks aggregate analytics: production events have the correct user/pet and categorical properties, signup is deduplicated; query contains no fixture accounts. Never paste medical text into analytics.

Only after this checklist and publication tasks pass should the first 20–30 owners be invited.

## Changed files

The full list is in the branch diff against b81c5c841e304847d6014f05fbc764b6cd18cec9. Main groups:
- Analytics adapters/context UI: lib/analytics/*, app/components/product-analytics.tsx.
- Auth/onboarding: app/login/actions.ts, app/auth/confirm/route.ts, app/onboarding/pet/actions.ts.
- Dose flow: medication detail actions/page/dose-buttons.
- Health: actions.ts and forms.tsx; global app/error.tsx; approved Home card subtitle.
- PWA: app/manifest.ts, app/apple-icon.tsx, app/icons/*, lib/pwa/icon.tsx, proxy.ts.
- DB: analytics module/metrics, atomic creation functions, exact migration.
- Tests: analytics privacy/outcomes, atomic medication/pet SQL, analytics SQL, isolated scaffold/runner, HTTP smoke.
- Documentation and .env.example.

## Deployment follow-up

Amvera runtime preparation is now implemented: amvera.yml, the production launcher and explicit public runtime configuration. The earlier requirement to supply NEXT_PUBLIC values during build is superseded; Amvera provides environment variables at launch only. CI now builds without Supabase settings and starts with runtime settings, checking their safe delivery in HTML. See the updated Russian deployment guide.

An RU/EN /about page is linked from login and settings. It describes actual data handling, beta limitations and a configurable organiser/contact. It is an informational surface, not a claim that operator identity, retention/deletion policy and jurisdiction-specific legal terms have been finalised. Set real organiser/contact details before inviting testers.

Hosting configuration is ready for the owner's deployment; a real Amvera deployment and authenticated/mobile acceptance remain unverified. No database change was needed in this follow-up.
