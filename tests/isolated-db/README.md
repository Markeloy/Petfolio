# Isolated database tests

Run `npm ci --prefix tests/isolated-db` and `npm test --prefix tests/isolated-db` from the repository root.

The database exists only in local memory. No Supabase URL, API key, or live account is used. `bootstrap.sql` supplies a minimal local model of Auth and the existing household tables; it does not emulate Auth networking, Storage, or all production triggers. `activity.mjs` loads the actual family/activity SQL and runs the activity regression scenario. PGlite uses one connection; this test does not simulate concurrent network requests.
