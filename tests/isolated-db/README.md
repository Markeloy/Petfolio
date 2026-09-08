# Isolated database tests

Run `npm ci --prefix tests/isolated-db` and `npm test --prefix tests/isolated-db` from the repository root.

The database exists only in local memory. No Supabase URL, API key, or live account is used. `bootstrap.sql` supplies a minimal local model of Auth, household tables, weights and Storage metadata; it does not emulate Auth networking, actual file uploads or all production triggers. `medication-baseline.sql` captures the existing medication columns, policies and audit functions from a read-only schema inspection; it is not a deployment migration or complete database backup.

The runner loads the actual module SQL and runs ten regression scenarios: medication marking, schedule revision, calendar history, avatar permissions, family invitations, activity, stock, feeding, document metadata and health. The pgcrypto extension runs locally for invitation hashing. Storage tests exercise RLS and metadata finalization, not file bytes. PGlite uses one connection; these tests do not simulate concurrent network requests. Never run the fixture SQL files on production.
