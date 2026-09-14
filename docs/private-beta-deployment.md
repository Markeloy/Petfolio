# Private beta deployment handoff

No hosting deployment was performed in this session. Deploy **codex/-petfolio**, not main, only after its latest full CI succeeds.

Petfolio is a server-rendered Next.js application with Server Actions; use a Node.js server host. A static-files-only deployment is insufficient. Node 24 is the version exercised by CI.

## Build and start contract

Build:
```sh
npm ci
npm run build
```

Run:
```sh
npm run start -- --hostname 0.0.0.0 --port 3000
```

Configure the host's public HTTPS ingress to the selected port. Store uploads in the existing private Supabase Storage buckets; do not make local application files an upload store.

Before building, set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_ENV (staging for rehearsal; production for the real cohort), NEXT_PUBLIC_APP_VERSION (numeric x.y.z), and NEXT_PUBLIC_APP_SURFACE=pwa. Make the Supabase URL/key available at runtime too. NEXT_PUBLIC values are baked into the browser build: changing only runtime variables is not sufficient. Never use a service-role key as a publishable key.

In Supabase Auth set the real Site URL and allow the deployed /auth/confirm redirect. Configure the confirmation template to use the application's token_hash confirmation callback with type=signup or type=email. Test the actual email/link; the repository cannot verify dashboard configuration or delivery. Do not add unbounded wildcard redirect hosts.

Amvera is a possible Node/Docker host, but no Amvera account/project/domain is connected here and its deployment has not been verified. Choose its current Node deployment flow and apply the build/start contract above; review provider-specific environment/port settings in the [official Amvera documentation](https://docs.amvera.ru/). No new database, native rewrite or Android shell is needed to host this PWA. Next.js describes its [Node/Docker deployment options](https://nextjs.org/docs/app/getting-started/deploying).

Applied DB migration: 20260914154626_beta_atomic_creation_and_private_analytics_v1. Do not rerun old non-idempotent db/* module creation scripts against the existing project. The exact new migration is recorded in db/migrations.

Acceptance gate: docs/beta-readiness-2026-09-14.md. Use real account/browser testing on the HTTPS domain before inviting users.

## Updating the owner's existing Windows checkout

First stop the dev server with Ctrl+C. Inspect git status; preserve any local changes rather than overwriting them. Then:

```powershell
cd C:\Users\coolm\Petfolio\Petfolio
git fetch origin
git merge origin/codex/-petfolio
npm.cmd ci
npm.cmd run build
npm.cmd run start
```

Open http://localhost:3000 for a production-build preview. Existing .env.local stays on the owner's machine. Set NEXT_PUBLIC_APP_ENV=development locally before rebuilding so checks do not enter the production cohort.

If merge reports local/untracked files, stop and resolve that concrete conflict; do not use reset --hard or delete files blindly. This local preview is not a hosted beta URL and cannot replace the HTTPS mobile acceptance test.
