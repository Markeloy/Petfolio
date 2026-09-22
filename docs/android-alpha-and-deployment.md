# Android alpha and deployment

Working branch: `codex/-petfolio`. Never develop on `amvera-deploy` or deploy `main`.

## Notifications

Dismiss and read state is private to each authenticated user and household, saved in
`notification_receipts`. It contains occurrence identifiers and two booleans only.
No care/health/medication/stock source record is changed. Late read requests cannot
resurrect dismissed occurrences. Clear read is checked in the database, not trusted
from a client flag. Updated stock / a later scheduled occurrence is a new notice.
Old device read receipts are imported when Home loads. Failure leaves notices visible
with an error; destructive controls require successful state loading.

Check: create a low-stock reminder, open the bell, dismiss it, reload, log out/in;
it stays hidden, stock remains. Read another reminder then Clear read: unread stays.
Check another member sees their own independent inbox. Badge excludes dismissed items.

## Android alpha installation

CI artifact: `petfolio-android-alpha-<commit SHA>` in the successful Petfolio CI run.
Inside the downloaded ZIP: `app-debug.apk`.
Build path: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

1. Download the artifact ZIP, extract `app-debug.apk`, transfer it to the Android phone.
2. Open the APK. If Android asks, allow installation from this particular browser/file manager.
3. Install **Petfolio Alpha**, then disable that installation permission again.
4. Open Petfolio and sign in. It uses the existing production account and records.

Package: `com.markeloy.petfolio.alpha`; minimum Android 7 / API 24, updated System WebView.
Debug alpha only, not a signed store release. CI debug certificates can differ between
builds: updating may require uninstalling the previous alpha. Server data remains;
local login/session is removed on uninstall. Never commit signing keys.

HTTPS production web source is intentional for this alpha: Next.js Server Components,
Server Actions and Supabase SSR cannot be bundled as a working static export.
It requires internet and inherits production updates/outages. This is not an offline app.
No FCM/VAPID/push, native camera integration or deep-link routing. Only INTERNET is
requested. Existing HTML file picker uses Android's document chooser; camera capture
is not promised. Download/view documents and manufacturer-specific pickers need device QA.

Native Back closes an open dialog, then uses WebView history; Home/Login background
the app. SystemBars uses native safe-area insets and system bar appearance. Splash and
launcher share a neutral paw icon. The web light/dark setting is independent of the
Android system bar theme. Unknown external destinations open outside the trusted WebView;
no wildcard allowNavigation, cleartext or mixed content. No extra native plugins.

Local build: JDK 21 + Android SDK 36, then `npm ci --prefix mobile` and
`npm run build --prefix mobile`. Gradle wrapper is committed. CI builds and lints Android.
A compiled APK is not proof of a real-device UX test. Test Back, keyboard, file picker,
rotation, offline/retry, relaunch/session and light/dark on a physical device.

## Promotion to Amvera

Petfolio CI verifies JS, DB isolation, lint/types, production build, HTTP smoke and
Android assembly/lint. Only a successful PUSH on `codex/-petfolio` can promote its exact
SHA to `amvera-deploy`. PRs and main cannot deploy. Promotion is serialized, skips stale
runs and permits only fast-forward: any manual divergence fails rather than overwriting
or silently publishing it. Do not manually edit the deployment branch.

Amvera tracks `amvera-deploy` because its webhook handler truncated names containing `/`.
The external push webhook must report actual application of changes, not merely HTTP 200.
GITHUB_TOKEN promotion does not start a second GitHub Actions run: the promoted SHA has
already passed the working-branch run. Amvera keeps its own merge commit/configuration.
Check Amvera build/start success and public signup after release; green CI alone does not
prove deployment success. If provider webhook delivery fails, redeliver that exact
`amvera-deploy` push in GitHub Webhooks; never switch to main or force-push divergent code.
