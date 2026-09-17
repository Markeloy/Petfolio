# Private-beta stabilization — 2026-09-17

Scope: performance, immediate-session signup, stability verification. Baseline `d1feef33298544906873397b113fe88fe236e2fe`, branch `codex/-petfolio`. No redesign or production DDL.

## CODE BOTTLENECKS

- Home: N separate latest-weight requests; 2N health reminder requests; N activity reminder requests; 2N feeding requests; N sequentially delayed avatar-signing calls. Most within each group already ran in parallel, so request-count savings must not be interpreted as the same percentage latency saving.
- Home: timezone lookup unnecessarily gated medication/procedure/feeding requests; avatar signing started only after all reminders completed.
- Care: medication and procedure reads sequential. Medication detail: today's marks then history sequential (independent queries).
- Calendar: medication/health, feeding and activity loaders looped over pets sequentially. Schedule/dose batching remains necessary to bound URL filter length; now batches span the selected pets.
- Documents/Nutrition/Activity: context re-read the pet just to fetch household_id. Removed that duplicate by extending the first RLS-backed select. Membership/role checks remain.
- Family: families, members, invitations sequential. Now concurrent after membership selection; names still depend on members.
- Home cards (6), quick actions (4) and bottom nav (5) forced full dynamic prefetch. Default Next prefetch now loads eligible route shells instead; it does not eagerly request every linked complete page.
- RefreshOnFocus: both focus and visibilitychange could trigger refresh on the same return. Coalesced with a 30-second minimum; visible minute refresh remains. No refresh on initial mount.

## Implementation and safety

- Latest weight embedded in the pets query with per-relation `limit(1)`, same descending measured_at/created_at/id tie-breakers and archived filter. Pets without weights remain visible.
- Health reminder query embeds separately limited planned/repeat relations; activity embeds one earliest future planned activity per pet. These are ordinary PostgREST joins under existing RLS, not a new privileged aggregator RPC. Live anonymous query validation returned HTTP 200 for all three relation shapes; anonymous reads returned no user data. Non-empty behavior also covered by query-contract/unit and isolated ownership tests, but not a live authenticated PostgREST E2E.
- Feeding plans/logs fetched for selected pet IDs in two paginated reads. Calendar batches source data across selected pets, keeps history snapshots and timezone/day handling.
- Avatar signing uses one `createSignedUrls` batch, in parallel with reminders; no cross-request signed URL cache.
- Supabase client is memoized by React.cache within a server-render request only. No module-global user data cache, force-static, or shared authenticated fetch cache was introduced. Existing 30s browser router staleTimes preserved; writes/signout continue revalidation.
- Existing useLinkStatus indicators and persistent bottom nav retained. Added loading boundaries at `/pets/[petId]`, Care, medication detail, Settings and onboarding. Health, Documents, Nutrition, Activity, Calendar, Stock, Family and Home already had loading boundaries. Layouts for the section lists have no extra DB fetch.
- Health list requests already run together, author lookup correctly depends on returned rows. Stock is paginated and has no pet N+1. Document feed does not sign every document URL; file access stays private/on demand. Their remaining sequential access checks were not bypassed.
- Calculations/serialization inspected: UI receives view models, not full reminders/medical query rows. Timezone schedule computation remains unchanged and tested. No measured evidence here warrants replacing the scheduling architecture.

## Controlled measurements

Real production Next renderer, Node 24, same synthetic backend and fixed 40ms delay per HTTP request; 3 pets, one daily medication schedule, no dose/history entries, one photo per pet. Three complete HTTP requests per route, original build vs modified build. Counts exclude Auth and include Data API/RPC/Storage. The fixture's HS256 validation adds two Auth HTTP calls per route in both versions; production signing/JWKS behavior can differ.

| Route | Data/Storage requests before → after | Complete response median, ms | First response before → after, ms | Repeated response before → after, ms |
|---|---:|---:|---:|---:|
| `/` | 28 → 12 | 374 → 300 | 566 → 461 | 371 → 300 |
| `/pets/:pet/health` | 6 → 6 | 193 → 204 | 200 → 204 | 193 → 204 |
| `/pets/:pet/care` | 3 → 3 | 227 → 213 | 231 → 224 | 227 → 213 |
| `/pets/:pet/care/medications/:med` | 4 → 4 | 235 → 204 | 241 → 216 | 235 → 196 |
| `/calendar` | 22 → 12 | 406 → 348 | 413 → 374 | 403 → 334 |
| `/stock` | 3 → 3 | 228 → 234 | 228 → 239 | 227 → 222 |
| `/pets/:pet/documents` | 5 → 4 | 272 → 232 | 272 → 232 | 272 → 232 |
| `/pets/:pet/nutrition` | 6 → 5 | 270 → 237 | 269 → 235 | 270 → 270 |
| `/pets/:pet/activity` | 6 → 5 | 267 → 230 | 270 → 240 | 267 → 227 |
| `/family` | 5 → 5 | 311 → 228 | 314 → 234 | 311 → 228 |
| `/settings` | 1 → 1 | 142 → 139 | 147 → 149 | 138 → 139 |

With **one pet**, Home requests **14 → 12**, complete median **382 → 282ms**; Care **232 → 187ms**; medication detail **238 → 190ms**. Small run, controlled latency, not a production SLA. Health/Stock differences within this small sample are noise, not evidence of regressions or improvements. Three-pet first-byte medians stayed roughly 52–73ms thanks to streaming. Full latency includes page content completion, not just headers.

These are first/repeated **HTTP server responses**, not browser tap-to-content or the browser Router Cache. Actual first/repeated client navigation latency, mobile layout, Back and transition animation are **unmeasured** because the known deployed URL is unavailable. No synthetic number is presented as an Amvera/browser measurement.

Reproduce against a production build:

```sh
npm ci
npm run build
BENCH_PETS=3 BENCH_DELAY_MS=40 node tests/route-performance.mjs
BENCH_VERIFY_FLOWS=1 node tests/route-performance.mjs
```

For comparison, `BENCH_CWD` points to a separately built baseline checkout; `BENCH_OUTPUT` optionally writes synthetic measurements. Diagnostics run only in tests, no production verbose logging added.

## HOSTING BOTTLENECKS

The previously supplied `https://petfolio-markelos123.amvera.io` returned the Amvera **503 Service Unavailable** page in the browser twice on 2026-09-17. It may be the old Moscow application: a current Warsaw URL was never supplied or committed. Therefore this is evidence about that address only, not proof all testers are affected or that hosting capacity is insufficient.

## UNKNOWN / REQUIRES AMVERA METRICS

Current active domain/deployed SHA; server CPU, memory/OOM/restarts, cold starts, request concurrency/queueing, event-loop delay, container port and proxy buffering; Amvera→Supabase RTT/timeouts and regional connectivity. **No evidence-based recommendation to upgrade the tariff** is possible yet.

## Signup

- Form is name + email + password, name/email lengths bounded; no password repeat. Submit shows pending feedback and is disabled while the action runs. Existing safe Supabase signUp path, not admin/service-role.
- Successful `data.session` writes SSR cookies and redirects to `/onboarding/pet`; verified by actual production Server Action HTTP POST against synthetic Auth. Unit tests cover session/no-session/error branches and signup analytics only on authenticated success.
- Existing no-session message remains as a truthful fallback if confirmations are enabled again; not displayed on immediate-session signup. `/auth/confirm` unchanged.
- Live `/auth/v1/settings`: `disable_signup=false`, **`mailer_autoconfirm=false`**. Tools exposed here have no Auth-config mutation capability. Required operator action: **Supabase → Authentication → Providers → Email → Confirm email = OFF**.
- A new reserved test-email signup request against live public Auth returned HTTP 400 and no session/user ID; it did not verify a successful new account. No admin-created/auto-confirmed account was used to pretend this gate passed. Do not infer that ordinary tester emails fail from this test address.
- Live registration trigger inspected: inserts profiles, households, owner membership on auth.users INSERT independent of email confirmation. Its exact body tested in isolated PostgreSQL with confirmed and unconfirmed timestamps; one of each row created.
- Password-reset UI was already absent in the baseline; no recovery code removed or changed. `/auth/confirm` remains usable for supported OTP flows, but full recovery-email UI flow is not certified.
- Public launch hardening: **CAPTCHA / abuse protection should be reviewed**. Leaked-password protection also remains disabled.

## Verification results and limits

| Check | Result |
|---|---|
| npm ci / lint / typecheck | Passed locally; lint has 3 existing img warnings, exit 0 |
| Unit tests | 57 passed, including multi-pet batching and signup branches |
| Isolated PostgreSQL | All domain suites passed, plus registration trigger body |
| Medication anti-double-dose and household isolation | Existing isolated database tests passed, guard RPC unchanged |
| Production build | Passed after discarding stale local Turbopack cache; fresh baseline build also passed |
| Public HTTP smoke | Passed: RU/EN, three themes, protected-route redirects, private file 401/no-store, 404, manifest/icons/service worker |
| Authenticated HTTP render | 11 principal routes × 3 requests passed against controlled backend |
| Signup/session HTTP, onboarding + 8 creation forms, logout | Passed with synthetic Auth/data backend |
| Injected backend failure and subsequent recovery | Passed at HTTP level, no raw backend error exposed; browser retry click untested |
| Production browser | Blocked at known Amvera address: 503 |
| New real account → onboarding → care → logout/login persistence | Not completed; live confirmations still on, active URL required |
| Browser mobile/Back/refresh/nested/notification interaction/RU-EN/theme switch | Not completed; HTTP render/SSR preference checks do not substitute for interactions |

## Security

No migrations, permissions or RPC implementations changed. Existing create_medication_course/create_pet_with_weight and record_medication_dose retained. Public tables all have RLS; private buckets remain public=false. Direct authenticated reads of private analytics/invites remain revoked.

Live advisors: Security — 2 informational intentional private tables without policies, 1 warning leaked-password protection disabled. Performance — 23 informational unused indexes; none removed. No new index or permissive policy added.

## Release gate

Technical patch is reviewable and covered by CI. **Production acceptance remains incomplete** until the owner supplies the active URL, disables email confirmation and the requested real browser scenario passes. A green CI is not a claim that the updated Amvera deployment or the full live workflow has been verified.
