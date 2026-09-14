# Design, document feed and procedures — 2026-09-10

The home structure stays the same. Section cards now use restrained rose, lavender,
sand, blue, peach and slate accents. Dark mode retains neutral black backgrounds
with low-intensity card tints. System typography replaces serif headings, and
internal navigation uses a chevron instead of an external-link arrow.

Documents open as a feed. Category and state filters and sorting (newest, oldest,
title, largest file) are in a collapsible panel. Filters persist through pagination;
applying new filters resets the page. File access remains private. Feed cards do
not fetch previews or expose storage paths.

Care now supports grooming, baths, nail trims, ear cleaning, dental care, brushing
and custom procedures. Users set a date and optional repeat interval of 1–365 days.
Owners and members can create, edit, mark done/skipped, archive and restore.
Viewers can read. Marking is allowed on the scheduled date or later, in the stored
procedure timezone. A repeat advances from the actual marking day, including a
skip. A one-time procedure has no next date after marking. History retains the
original title, scheduled date, actor and recording time. A completed date cannot
be reused on the same procedure. The calendar shows the current scheduled date
and recorded history, not unbounded future projections.

Database changes: db/procedures-module.sql, applied to the connected project as
care_procedures. Tables have RLS, authenticated SELECT only, and no direct client
writes. The mutation RPC locks the household and procedure, validates role and
pet ownership, checks the edit version, and records immutable history and audit.
Repeated marking returns the existing result without overwriting the first mark.

Verification:
- Production build passed.
- 46 JavaScript tests passed, plus a subsequently added contrast test passed with
  the appearance suite (47 tests total in the repository).
- Isolated PostgreSQL suite passed, including procedure repeats, one-time care,
  duplicate requests, snapshot history, actors, future-date rejection, stale edits,
  archive/restore, direct-write rejection, viewer access and family isolation.
- Production HTTP smoke passed: RU/EN, three themes, 14 protected routes and the
  existing file/PWA checks. No production fixture accounts or data were created.
- ESLint: zero errors, three pre-existing image optimization warnings.
- Security advisor: no new procedure findings. Existing private invitation-table
  informational finding and disabled leaked-password protection remain. See
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Browser visual inspection could not run: the managed browser blocked the local
  app URL with ERR_BLOCKED_BY_CLIENT. Authenticated end-to-end browser workflows
  have not been tested in this release.
