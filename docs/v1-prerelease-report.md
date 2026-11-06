# LivinUp v1 pre-release report

Date: 3 Nov 2026. Live site: git `HEAD` 954368b (the shopping app). Candidate:
the uncommitted working tree (213 entries in `git status`).

Nothing was committed, pushed or deployed. No production migration was
applied and no production data was changed. The only production access in this
whole effort was the read-only migration audit (Appendix A). Secrets are
referred to by variable name only.

The step-by-step go-live plan with checks and rollbacks is in
`docs/deployment-v1-checklist.md`. This report summarises the results and
keeps the migration audit (Appendix A), because the working folders it came
from have been deleted.

---

## 1. Browser tests

### Playwright suite (`tests/e2e/journey.spec.ts`)

Run through the keep-awake wrapper against a fresh production build
(`next start` on port 3100, PGlite, local auth, Supabase variables blanked by
`playwright.config.ts`). It was the last Playwright run, after all edits.

| #   | Project            | Test                                                      | Result |
| --- | ------------------ | --------------------------------------------------------- | ------ |
| 1   | chromium (desktop) | landing page describes the wardrobe product, not shopping | pass   |
| 2   | chromium           | sign-up requires the 18+ and terms confirmations          | pass   |
| 3   | chromium           | retired shopping URLs redirect instead of 404ing          | pass   |
| 4   | chromium           | wardrobe to public post, privacy, and account deletion    | pass   |
| 5   | mobile (Pixel 7)   | landing page                                              | pass   |
| 6   | mobile             | sign-up 18+ and terms                                     | pass   |
| 7   | mobile             | retired shopping URLs                                     | pass   |
| 8   | mobile             | wardrobe to public post, privacy, and account deletion    | pass   |

Result: **8 passed, 0 failed, 29.3 s**, exit code 0. The port-3100 server was
stopped afterwards (verified: nothing listening on 3100).

The earlier fixes behind this result (from the fix phase): the outfit
builder's horizontal overflow on mobile, reliable tapping of clothing pieces
without the tap landing on the board, and the desktop test no longer
deselecting an already-selected photo.

### Manual-style walkthrough at both sizes

A scripted walkthrough of the critical flows against the dev server
(`npm run dev:local`, http://localhost:3000). Each step has hard assertions.
Console errors, page errors, 5xx responses and horizontal overflow fail the
run. Final runs, after the last edit:

| Step                                                                                | Desktop 1366x900 | Phone (Pixel 7) |
| ----------------------------------------------------------------------------------- | ---------------- | --------------- |
| Sign in                                                                             | pass             | pass            |
| Wardrobe: add photographed piece                                                    | pass             | pass            |
| Wardrobe: add piece without photo (overflow 0)                                      | pass             | pass            |
| Builder: saree + blouse valid (2 on board, no swap)                                 | pass             | pass            |
| Builder: dress replaces top + bottom (swap message)                                 | pass             | pass            |
| Builder: top replaces dress (swap message, overflow 0)                              | pass             | pass            |
| Builder: save outfit                                                                | pass             | pass            |
| Post: share, preview, publish (overflow 0)                                          | pass             | pass            |
| Post: like + comment                                                                | pass             | pass            |
| Signed out: post visible, post image 200, wardrobe image 404, overflow 0            | pass             | pass            |
| `/home`, `/notifications`, `/settings`, `/u/vsai`, `/brands`, `/` (200, overflow 0) | pass             | pass            |
| Phone drawer: Home, Outfits, Wardrobe                                               | n/a              | pass            |
| **Total**                                                                           | **16/16**        | **17/17**       |
| Console errors / page errors / 5xx                                                  | none             | none            |

Honest note: the first desktop attempt in this final round failed at
"post: share, preview, publish" with a 60 s navigation timeout. The dev log
shows the publish itself succeeded (`POST /create` 200 at 14:30:31,
`GET /p/<id>` 200 at 14:30:35), about 14 s after the script stopped waiting.
The delay was dev-mode compilation (one `/media` request spent 45 s in
`next.js` time while Google Fonts downloads were failing and falling back).
An immediate re-run passed 16/16, then the phone run passed 17/17. The same
flow passes in the production build (Playwright test 4/8, 29 s total). This is
dev-server latency on this laptop, not an app defect. Dev-mode timings this
round were slow in general (for example 129 s for the first photo upload on
desktop); production-build timings are what Playwright measures.

The legal pages `/terms`, `/privacy`, `/guidelines` and `/grievance` each
returned 200 on the dev server and showed "Draft pending review by a qualified
lawyer".

## 2. Format check

- `npm run format:check` (plain `prettier --check .`): **initially failed on 27
  files**. The cause was line endings only: with `core.autocrlf=true` those
  working-copy files had CRLF, while Prettier expects LF.
  `npx prettier --check --end-of-line auto .` passed on the same tree, which
  confirmed nothing else was wrong.
- Fix: `npx prettier --write` on exactly those 27 files. `git diff` on them was
  byte-identical before and after (the index already stores LF), so there is no
  content change. `git ls-files --eol` shows `i/lf w/lf` for all 27.
  Side effect: `git status` now lists a few of these files as modified even
  though `git diff` shows nothing for them. Staging them records no change.
- After the fix: `npm run format:check` **passes** ("All matched files use
  Prettier code style!"), and `npx prettier --check --end-of-line auto .`
  **passes**.

## 3. Other checks after the final edit

The last edit was the Prettier line-ending fix. Every check below ran after it.

| Check                                                                       | Result                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run typecheck` (`next typegen && tsc --noEmit`)                        | pass, exit 0                                                                         |
| `npm run lint` (`eslint`)                                                   | pass, exit 0, no warnings                                                            |
| `npx vitest run`                                                            | **121/121 passed**, 14/14 files, 59 s                                                |
| Production build (`build-clean.mjs`: `next build` with Supabase vars blank) | pass, exit 0. Compiled in 34 s, 27/27 static pages generated                         |
| `npx prettier --check --end-of-line auto .`                                 | pass                                                                                 |
| `npm run format:check`                                                      | pass (after the line-ending fix above)                                               |
| Playwright (8 tests, desktop + mobile)                                      | **8/8 passed**, 29.3 s                                                               |
| Walkthrough                                                                 | desktop 16/16, phone 17/17 (after one dev-latency timeout on desktop, see section 1) |

## 4. Hydration and stall findings

### Stall: machine sleep, not a server hang

The earlier `GET /wardrobe 200 in 37.4min` came from Windows Modern Standby.
The Kernel-Power log shows event 506 (entering Modern Standby) at 2 Nov
19:05:40 and 507 (exiting) at 19:43:03, a gap of 37 min 23 s, which matches
the logged request time. With the machine kept awake (`SetThreadExecutionState`
in the run wrappers), every run finished; `/wardrobe` stayed at 3.8 s or less
in the fix phase. Today's standby events (12:48–14:06) fell between commands,
not during any browser run. The Playwright config also has hard ceilings
(60 s per test, 20 min global, 20 s per action).

### Hydration warning `style={{caret-color:"transparent"}}`

Caused by Playwright, not the app. With its default `caret: 'hide'`,
`page.screenshot()` sets `caret-color: transparent !important` on every input,
textarea and contenteditable for the duration of the capture
(`playwright-core/lib/coreBundle.js` around line 21588). If React hydrates in
that window it logs this attribute mismatch. The app contains no `caret`
styling. Reproduced deterministically; zero warnings with no screenshots, and
zero warnings in a plain Edge session driven over raw CDP at both sizes.
Harmless for real users. The walkthrough now screenshots with
`caret: 'initial'`.

## 5. Production migration risk assessment (summary)

Full evidence is in Appendix A. Production has 0001–0004 applied
(2026-09-09), and none of 0005–0008.

**`schema_migrations` checksums:** 0001 `88f427e18d1a714b`, 0002
`8c2ff08e3aa55425`, 0003 `d3ef1c1a3248755c`, 0004 `6f9537d8df382ffa`. All four
match the local files (LF). 0001–0005 are unchanged against `HEAD`. The runner
will record 0005 `acbd50f9bcfe1adb`, 0006 `f28caf43fa1883c0`, 0007
`f401aeccd5085c7f`, 0008 `71752160d05ae44e`.

| Migration            | What it does                                                                                                                                                                         | Live (`HEAD`) compatible                                              | Reversible                                                                       | Risk                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| 0005_ingestion       | Adds 3 columns to `merchant_products`, swaps its unique key to include `provider`, creates `ingestion_runs`                                                                          | Yes, additive (`HEAD`'s unscheduled ingest code actually needs it)    | By hand; 0008 drops it all anyway                                                | Low                                |
| 0006_wardrobe        | Creates `media`, `media_deletions`, `wardrobe_items`, `outfits`, `outfit_items`, RLS on, owner policies, revokes Data API access                                                     | Yes, purely additive                                                  | Drop the 5 tables (before users write data)                                      | Low                                |
| 0007_community       | Adds community columns to `profiles`, creates 13 community tables, **revokes all on `profiles`, `user_preferences`, `user_events`, `local_auth_users` from `anon`, `authenticated`** | Yes, see below                                                        | New objects droppable; do **not** re-grant (would allow self-promotion to admin) | Low; brief `profiles` lock         |
| 0008_retire_shopping | Drops 2 FKs on `user_events`, then drops the 11 shopping tables                                                                                                                      | **No.** Breaks `HEAD`'s search, product pages, saves, recommendations | Only from backup                                                                 | High if run out of order; deferred |

**0007 revoke vs the currently deployed app.** `HEAD` reaches every table
through `lib/db` over `DATABASE_URL` with the `postgres` driver. The audited
role is `postgres` (table owner, `rolbypassrls`), so grants to `anon` and
`authenticated` never apply to it. `HEAD` has no supabase-js `.from()`/`.rpc()`
calls, no browser Supabase client, and no `rest/v1`, `graphql/v1`, `storage/v1`
or realtime use. Its Supabase usage is GoTrue auth only, which does not depend
on `public` grants. Production has no `auth.users` trigger, no functions
touching the kept tables, no views, pg_cron jobs or webhooks. Profile, event
and preference inserts at `HEAD` still work because every new column is
nullable or has a default. Conclusion: compatible, and a security fix.
Caveat: the role behind Vercel's `DATABASE_URL` could not be read; it was
inferred from the local `.env.local` value and from the fact that `HEAD`
already does cross-user queries that `anon`/`authenticated` cannot.

**Lock risk (0005–0007).** The runner sets no `lock_timeout`. The `ALTER`s on
`profiles` (3 rows) take sub-second locks, but if another long transaction
holds `profiles`, the migration waits and queues sign-ins behind it. Run at low
traffic; if it hangs over about 30 s, press Ctrl+C (the transaction rolls back).

**0008 dependencies (must stay deferred).** In production, only
`user_events_product_id_fkey` and `user_events_merchant_product_id_fkey` point
into the 11 tables, and 0008 drops them first. No views, functions, rules,
publications, pg_cron jobs or DB webhooks depend on them. In the new code, the
only reference is `tests/integration/rls.test.ts`, which asserts they are gone.
`/api/cron/ingest` and every shopping page and library are deleted. The new
`vercel.json` schedules only `/api/cron/cleanup`; `HEAD` has no `vercel.json`.
Some docs (`docs/database.md`, `docs/deployment.md`, `docs/analytics.md`,
`docs/decisions.md`) still describe the old tables; that is documentation
drift only. Data lost by 0008: the synthetic seed catalogue and 1
`product_rejections` row; `user_events` (428 rows) is kept.

**Backup and recovery.** `npm run db:backup` writes a JSON copy of `public`
data only (no schema, no `auth`, no Storage, no restore script, not a single
snapshot). It is a convenience copy, not a recovery plan. Supabase Free has no
automatic backups; Pro keeps 7 daily backups; PITR is a paid add-on. The plan
and PITR status could not be seen from here. Recommended: a `pg_dump` (Docker
`postgres:17`, session-mode or direct connection on port 5432, URL passed via
an env var) of `public` plus a data-only dump of `auth`, before 0005–0007 and
again before 0008, with a restore drill into a scratch container. Exact
commands are in the checklist, step 2.

## 6. Exact deployment sequence

Each step needs the owner's explicit go-ahead where it touches production.
Full checks and rollbacks: `docs/deployment-v1-checklist.md`.

0. Pre-flight (done locally, section 3). Decide B4 (backups) and B5
   (verification tags). Pick a low-traffic window (late night IST).
1. Vercel, Production scope: add `SUPABASE_SECRET_KEY`, `CRON_SECRET`,
   `LIVINUP_MEDIA_DRIVER=supabase`; confirm `LIVINUP_DB_DRIVER=postgres` and
   `NEXT_PUBLIC_APP_URL=https://livinup.in`. Do not redeploy `HEAD`; keep
   `INGESTION_CRON_SECRET` for now.
2. Back up production: check plan/PITR, `pg_dump` (public schema+data, auth
   data), `npm run db:backup`, restore drill.
3. `npm run db:migrate -- --to=0007_community.sql` (applies 0005, 0006, 0007,
   each in its own transaction). Confirm the printed host is production.
4. Verify read-only: `schema_migrations` has 0001–0007; no
   SELECT/INSERT/UPDATE/DELETE for `anon`/`authenticated` outside the 11
   shopping tables; RLS on everywhere except `schema_migrations`; livinup.in
   (still `HEAD`) signs in and browses normally.
5. Commit and push the working tree (no `.env*`, `.livinup/` or backups
   staged). Vercel builds and promotes. Rollback: Instant Rollback to 954368b
   (safe until 0008).
6. Verify secrets and cron: an uploaded photo survives a reload/redeploy;
   buckets `wardrobe` and `public-content` exist and are private; Cron Jobs
   lists only `/api/cron/cleanup` (`30 21 * * *`); an anonymous call gets 401;
   a manual Run from Vercel gets 200 with `cleanup finished`.
7. Smoke tests on desktop and phone (checklist step 7).
8. Owner signs in, `npm run admin:grant -- --email=<owner email>`, finishes
   onboarding; `/admin` works for the owner and 404s for others.
9. Later, with separate approval: fresh backup, then `npm run db:migrate`
   (0008 only), verify, then remove `INGESTION_CRON_SECRET`. After this,
   rolling back to 954368b no longer works.

## 7. Remaining blockers and decisions

| #   | Item                                                                                                                                                                                                               | Needed before |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | Approval to commit, push and deploy about 200 uncommitted files, including the new `vercel.json`                                                                                                                   | Step 5        |
| 2   | `SUPABASE_SECRET_KEY` and `CRON_SECRET` set in Vercel (Production), plus `LIVINUP_MEDIA_DRIVER=supabase`                                                                                                           | Step 5        |
| 3   | Supabase plan/PITR check and approval of the `pg_dump`                                                                                                                                                             | Step 3        |
| 4   | 0008 stays deferred until the new deployment is verified; separate approval and a fresh backup                                                                                                                     | Step 9        |
| 5   | Legal review of `/terms`, `/privacy`, `/guidelines`, `/grievance`, the 18+ policy and DPDP points by a qualified Indian lawyer. The pages show the draft notice until `LEGAL_REVIEWED = true` in `config/legal.ts` | Public launch |
| 6   | Named grievance officer with a working contact (`NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME`, `NEXT_PUBLIC_GRIEVANCE_EMAIL`), and a lawyer-confirmed set of response deadlines someone can meet                            | Public launch |
| 7   | Urgent reports (intimate imagery, child safety) only write a `moderation_urgent` log line; nothing emails the grievance contact yet. Needs a log alert or an admin-queue rota                                      | Public launch |
| 8   | Decide on the removed Admitad/Mitgo and Cuelinks verification tags (leave removed or restore)                                                                                                                      | Step 5        |
| 9   | Google sign-in, only if wanted: Google OAuth client, Supabase provider and redirect URLs, then `LIVINUP_GOOGLE_AUTH=1`                                                                                             | Optional      |
| 10  | Invite-only beta, only if wanted: grant admin first, create codes for the other 2 existing accounts, then `LIVINUP_REQUIRE_INVITE=1`                                                                               | Optional      |

---

## Appendix A. Production migration audit (verbatim)

Copied from the read-only audit so it survives cleanup of the working folders.
References to `.livinup/diag/` scripts and `.livinup/workflow/` describe files
that have since been deleted.

### Production migration audit: 0005, 0006, 0007, 0008

Read-only audit. Nothing was applied, committed, deployed or backed up against
production. Secrets are named by variable only.

#### How the evidence was gathered

- Live code = git `HEAD` 954368b (= `origin/main`, what livinup.in serves).
  Inspected with `git show HEAD:<path>`, `git grep ... HEAD`, `git ls-tree HEAD`,
  `git log --all -- vercel.json`.
- New code = the uncommitted working tree.
- Production = Supabase Postgres via `DATABASE_URL` from `.env.local`
  (transaction pooler). Two scripts in `.livinup/diag/` (git-ignored):
  `prod-audit.mjs`, `prod-audit2.mjs`. Every query ran inside
  `sql.begin('read only', ...)`; the session reported `transaction_read_only = on`.
  (The `default_transaction_read_only` startup parameter was also requested but
  Supavisor does not forward it, so it showed `off`; the explicit read-only
  transaction is what enforced it.) Only `SELECT`s against tables and the
  catalogue were issued. Output was checked for connection strings and keys
  (none present).
- Production: PostgreSQL 17.6. Connected role `current_user = postgres`
  (`rolbypassrls = true`, owner of every public table).

#### Production migration state (finding d)

`select name, checksum, applied_at from schema_migrations order by name`:

| name                | prod checksum    | local checksum (LF-normalised) | match |
| ------------------- | ---------------- | ------------------------------ | ----- |
| 0001_foundation.sql | 88f427e18d1a714b | 88f427e18d1a714b               | yes   |
| 0002_catalog.sql    | 8c2ff08e3aa55425 | 8c2ff08e3aa55425               | yes   |
| 0003_engagement.sql | d3ef1c1a3248755c | d3ef1c1a3248755c               | yes   |
| 0004_rls.sql        | 6f9537d8df382ffa | 6f9537d8df382ffa               | yes   |

All four applied 2026-09-09 10:53:43Z. No rows for 0005-0008. All local
migration files are LF on disk; the runner's CRLF fallback is not needed.
Checksums the runner will record for the pending ones: 0005 `acbd50f9bcfe1adb`,
0006 `f28caf43fa1883c0`, 0007 `f401aeccd5085c7f`, 0008 `71752160d05ae44e`.
0001-0005 are unchanged against HEAD (`git status` clean for them; 0006-0008
are untracked new files).

None of the objects 0006/0007 create already exist in production
(`media`, `posts`, `comments`, `follows`, ... all absent). The helper functions
they rely on (`livinup_set_updated_at`, `livinup_current_user_id`) exist.
`profiles` currently has only `id, display_name, onboarding_completed,
created_at, updated_at`. None of 0007's constraint names exist yet;
`merchant_products_external_unique` (which 0005 drops) does exist.

Current row counts:

| table              | rows                      | table            | rows |
| ------------------ | ------------------------- | ---------------- | ---- |
| products           | 46                        | profiles         | 3    |
| merchants          | 3                         | user_preferences | 14   |
| merchant_products  | 104                       | user_events      | 428  |
| product_variants   | 132                       | local_auth_users | 0    |
| product_images     | 104                       |                  |      |
| price_history      | 3120                      |                  |      |
| saved_products     | 0                         |                  |      |
| product_likes      | 0                         |                  |      |
| product_rejections | 1                         |                  |      |
| affiliate_clicks   | 0                         |                  |      |
| ingestion_runs     | absent (0005 not applied) |                  |      |

Every table is a few hundred KB at most (largest: `price_history`, ~680 KB).

#### Per-migration analysis

The runner (`lib/db/migrate.ts`) applies each file inside one transaction
together with its `schema_migrations` row, so each migration is all-or-nothing.
`npm run db:migrate -- --to=0007_community.sql` stops after 0007.
The runner sets no `lock_timeout`; see the lock notes.

##### 0005_ingestion.sql

Contents:

- `merchant_products`: adds `provider text not null default 'seed'`,
  `external_listing_id text`, `content_hash text`.
- Drops constraint `merchant_products_external_unique (merchant_id, external_product_id)`;
  creates unique index `merchant_products_provider_external_unique
(merchant_id, provider, external_product_id)` and index `merchant_products_provider_idx`.
- Creates `ingestion_runs` with RLS enabled, no policies.
- No grants or revokes. Note: production's default ACL gives anon/authenticated
  `TRUNCATE, REFERENCES, TRIGGER, MAINTAIN` on new tables, and 0005 does not
  revoke them on `ingestion_runs`. No `SELECT`/DML is granted and RLS has no
  policy, so it is not readable via the Data API. The table is dropped by 0008.

Reversibility: reversible by hand (drop the two indexes, `ingestion_runs` and the
three columns, re-add the old unique constraint). No data is removed. 0008 drops
all of it anyway.

Lock/runtime: `ADD COLUMN` with a constant default is a catalogue-only change in
PG 11+. Index builds and the constraint swap take ACCESS EXCLUSIVE / SHARE locks
on `merchant_products` (104 rows) for milliseconds. The new unique index cannot
fail: existing rows are already unique on `(merchant_id, external_product_id)`
and all get `provider = 'seed'`.

Live-code compatibility (finding b): additive. HEAD reads the catalogue with
explicit column lists; extra columns do not affect it. HEAD's ingestion code
(`services/ingestion/persist.ts` uses `on conflict (merchant_id, provider,
external_product_id)` and writes `content_hash`, `external_listing_id`;
`services/ingestion/catalog-run.ts` writes `ingestion_runs`) actually requires 0005. Today that code path is broken in production but unreachable: it runs only
from `/api/cron/ingest`, which is not scheduled (see c) and fails closed without
`INGESTION_CRON_SECRET`. After 0005 a manual authorised call would work and
would write catalogue rows. HEAD's `/api/cron/ingest` is the only HEAD path that
references `ingestion_runs`.

New-code compatibility: the new code does not reference any 0005 object.

Verdict: safe to apply. Low risk.

##### 0006_wardrobe.sql

Contents:

- Creates `media`, `media_deletions`, `wardrobe_items`, `outfits`,
  `outfit_items`, with indexes, FKs to `profiles` (cascade) and `media`
  (set null), and two `before update` triggers using the existing
  `livinup_set_updated_at()`.
- Enables RLS on all five; owner-only policies on four (`media_deletions` none).
- `revoke all ... from anon, authenticated` on all five (removes the
  default-ACL `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN`). service_role keeps those
  same default privileges, no `SELECT`/DML.
- Alters nothing that exists.

Reversibility: fully reversible before use (`drop table` the five new tables).
After users upload, dropping loses wardrobe data, and Storage objects would need
separate cleanup.

Lock/runtime: new tables only, plus a brief FK-creation lock (SHARE ROW
EXCLUSIVE) on `profiles` (3 rows). Milliseconds.

Live-code compatibility: purely additive. HEAD contains no reference to these
tables.

Verdict: safe to apply. Low risk.

##### 0007_community.sql

Contents:

- `profiles`: adds `username, bio, avatar_media_id (FK media, set null),
account_type default 'member', role default 'member', status default 'active',
explore_visible default true, age_confirmed_at, terms_accepted_at,
invite_code (FK invite_codes, set null)`; adds check constraints
  `profiles_username_format`, `profiles_bio_length`, `profiles_account_type_check`,
  `profiles_role_check`, `profiles_status_check`; unique index
  `profiles_username_key on lower(username) where username is not null`.
- Creates `posts, post_images, post_items, brand_details, post_brand_tags,
follows, post_likes, comments, blocks, notifications, reports,
moderation_actions, invite_codes`, all RLS-on with no policies, and
  `revoke all ... from anon, authenticated` on them.
- `revoke all on profiles, user_preferences, user_events, local_auth_users
from anon, authenticated`.
- Depends on 0006 (`media`, `outfits`). The runner's ordering guarantees this.

Reversibility: new tables and columns can be dropped by hand (losing any
community data written after). The revokes can be undone by re-running 0004's
grant statements. Re-granting is not recommended once `role`/`status` exist on
`profiles`: 0004's `profiles_update_own` policy would then let a signed-in user
set `role = 'admin'` through the Data API. That is the reason for the revoke.

Lock/runtime: `ADD COLUMN` with constant defaults is catalogue-only. `ADD
CONSTRAINT CHECK` and the two FKs validate `profiles` (3 rows) under ACCESS
EXCLUSIVE / SHARE ROW EXCLUSIVE locks held until the migration commits.
Sub-second in total. Risk: the runner sets no `lock_timeout`. If a long-running
transaction holds a lock on `profiles`, the `ALTER` waits and every later query
on `profiles` (sign-in, every page that loads the profile) queues behind it.
At the time of the audit there were no locks on these tables and only idle
connections (PostgREST, Supavisor, pg_net, exporter). Mitigation: run at low
traffic and watch it. The command should return within seconds; if it hangs,
cancel it and the transaction rolls back.

Grants currently in production on the four kept tables (finding e), from
`information_schema.role_table_grants`:

| table            | anon                        | authenticated                                           | service_role                |
| ---------------- | --------------------------- | ------------------------------------------------------- | --------------------------- |
| profiles         | REFERENCES,TRIGGER,TRUNCATE | INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE        | REFERENCES,TRIGGER,TRUNCATE |
| user_preferences | REFERENCES,TRIGGER,TRUNCATE | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE | REFERENCES,TRIGGER,TRUNCATE |
| user_events      | REFERENCES,TRIGGER,TRUNCATE | INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE               | REFERENCES,TRIGGER,TRUNCATE |
| local_auth_users | none                        | none                                                    | REFERENCES,TRIGGER,TRUNCATE |

RLS is enabled (not forced) on all four. Policies (`pg_policies`):
`profiles_select_own / _update_own / _insert_own` (authenticated),
`user_preferences_own` (ALL, authenticated), `user_events_insert_own /
_select_own` (authenticated), none on `local_auth_users`. 0007 leaves the
policies in place (harmless once grants are gone) and does not touch
service_role.

(a) Compatibility with the currently deployed app (HEAD 954368b):

- All application data access goes through `lib/db` over `DATABASE_URL` with the
  `postgres` driver (`git show HEAD:lib/db/connect.ts`,
  `HEAD:lib/db/driver-postgres.ts`). As connected for this audit, that role is
  `postgres`: table owner, `rolbypassrls = true`. Grants to anon/authenticated
  do not apply to it. Caveat: I verified the role behind the `DATABASE_URL` in
  `.env.local`. I could not read Vercel's value. The live app writes profiles
  today, so its role either owns the tables or has `bypassrls`. Either way it
  is not `anon`/`authenticated`, because 0004 gives those roles nothing that
  would allow HEAD's cross-user queries.
- `git grep -E "\.from\(|\.rpc\(|createBrowserClient|createClient\(" HEAD`: no
  supabase-js `.from()` / `.rpc()` call anywhere. The only `.from(` hits are
  `Array.from` / `Buffer.from`. No `createBrowserClient`. No
  `rest/v1`, `graphql/v1`, `storage/v1` or realtime usage at HEAD.
- Supabase clients at HEAD are server-only and auth-only:
  `lib/auth/supabase-client.ts` (`createServerClient`, `import 'server-only'`),
  `lib/auth/supabase-provider.ts` (`auth.signUp`, `auth.signInWithPassword`,
  `auth.signOut`, `auth.getUser`), `app/auth/callback/route.ts`
  (`auth.exchangeCodeForSession`, `auth.verifyOtp`), and `proxy.ts`
  (`auth.getUser()` for session refresh). These call GoTrue (`auth` schema), not
  PostgREST on `public`.
- None of the 11 `'use client'` files at HEAD mention supabase.
- Profile creation at HEAD is server SQL (`HEAD:lib/auth/index.ts:68`
  `insert into profiles (id, display_name)`), and it still works after 0007
  because every new column is nullable or has a default. Same for
  `user_events` (`HEAD:lib/analytics/events.ts:61`) and `user_preferences`
  (`HEAD:lib/preferences/repository.ts`).
- Production has no trigger on `auth.users` (no `handle_new_user`-style hook)
  and no public function references the kept tables. Only
  `livinup_current_user_id` and `livinup_set_updated_at` exist, both
  SECURITY INVOKER. Nothing in GoTrue's sign-up path depends on
  anon/authenticated grants on `public`.
- No views, rules or publications in `public`. No pg_cron jobs (the `cron`
  schema does not exist). No database webhooks (`supabase_functions` absent).

Conclusion: the revoke removes access only for Data API callers holding the
publishable key, and neither HEAD nor the new code is such a caller. Compatible.
The new code's Supabase usage is also auth-only, plus Storage via
`SUPABASE_SECRET_KEY` (`lib/media/supabase-store.ts`, Storage HTTP API, which is
not affected by table grants).

Verdict: safe to apply while HEAD is live. It is a security improvement (it
closes the self-promote-to-admin path that would otherwise open once `role`
exists). Low risk. It must be applied before the new code is deployed, because
the new code writes the new columns and tables.

##### 0008_retire_shopping.sql (deferred)

Contents: drops FKs `user_events_product_id_fkey` and
`user_events_merchant_product_id_fkey` (the column values stay as history), then
`drop table if exists` (no CASCADE) `affiliate_clicks, saved_products,
product_likes, product_rejections, price_history, product_images,
product_variants, merchant_products, products, merchants, ingestion_runs`.
Their policies, triggers and indexes go with them.

Reversibility: destructive. Recoverable only from a backup. Data lost: synthetic
catalogue (3 merchants, 46 products, 104 listings, 132 variants, 104 images,
3,120 price rows, all seed) and the one `product_rejections` row from the
owner's test account. `user_events` (428 rows) is kept.

Lock/runtime: ACCESS EXCLUSIVE on each dropped table and briefly on
`user_events` (FK drop). Tiny tables, so milliseconds. Same no-`lock_timeout`
caveat as 0007.

(c) Dependencies on the 11 tables:

- Production catalogue (read-only queries):
  - FKs into the 11 from outside the set: only
    `user_events_merchant_product_id_fkey` and `user_events_product_id_fkey`,
    both dropped first by 0008. All other FKs are between the 11 tables, and the
    drop order (children before parents) satisfies them without CASCADE.
  - Dependent views (via `pg_depend`/`pg_rewrite`): none. No materialised views.
    The only views in the database are `extensions.pg_stat_statements*` and
    `vault.decrypted_secrets`.
  - Triggers on the 11: only `*_set_updated_at` on `merchants`, `products`,
    `product_variants`, `merchant_products`. They are dropped with their tables.
    The shared function `livinup_set_updated_at` stays (used by `profiles`,
    `user_preferences`, `local_auth_users` and the new 0006 tables).
  - Functions referencing them: none. The two public functions mention none of
    the 11 tables.
  - No rules, no publications, no pg_cron jobs, no DB webhooks. Event triggers
    are Supabase's standard `pgrst_*`/graphql/pg_net ones and are not affected.
- New code (working tree, excluding docs and migrations): the only references
  are in `tests/integration/rls.test.ts`, which asserts these tables do not
  exist. No reference to `products` by name, `product_id`,
  `merchant_product_id`, `/api/cron/ingest` or `INGESTION_CRON_SECRET` in
  app/lib/config/scripts/tests. `app/api/cron/ingest/route.ts`,
  `app/go/[merchantProductId]`, the product, search and saved pages, and the
  shopping libs are deleted. Docs (`docs/analytics.md`, `docs/database.md`,
  `docs/deployment.md`, `docs/decisions.md`) still describe the old tables.
  That is documentation drift, not a runtime dependency.
- Scheduled jobs: working-tree `vercel.json` has only
  `{"path": "/api/cron/cleanup", "schedule": "30 21 * * *"}`.
  `git log --all -- vercel.json` is empty and `git show HEAD:vercel.json` fails,
  so the live deployment has no `vercel.json` and no Vercel cron from the repo.
  HEAD's `/api/cron/ingest` exists only as an unscheduled endpoint. Its own
  comment says no Vercel config was added, and it returns 503 without
  `INGESTION_CRON_SECRET`. I could not inspect the Vercel dashboard. Check the
  project's Cron Jobs tab: it should list only `/api/cron/cleanup` after the new
  deploy.
- Live HEAD code depends heavily on the 11 tables. `git grep` at HEAD finds them
  in `app/(app)/product/[id]/page.tsx`, `lib/affiliate/redirect.ts`,
  `lib/engagement/repository.ts`, `lib/products/repository.ts`,
  `lib/recommendations/*`, `lib/search/postgres-provider.ts`,
  `services/ingestion/*`, `services/normalization/*` and
  `services/pricing/history.ts`. Applying 0008 while HEAD is live would break
  search, product pages, saves and recommendations, and any manual call to
  `/api/cron/ingest`.

Verdict: correct and dependency-clean for the new code. Must not run until the
new code is deployed, verified, and a fresh backup is taken. High risk only if
run out of order.

#### Backup and recovery (finding e)

`scripts/db-backup.ts` (`npm run db:backup`, optional `-- --out=<dir>`):
reads every `public` base table with `select *` and writes one JSON file per
table to `~/livinup-backups/<timestamp>/`. It refuses to write inside the repo.
I did not run it against production.

Limitations:

- Logical JSON of `public` data only. No DDL, constraints, indexes, policies,
  grants, functions, triggers or sequences.
- Does not include the `auth` schema (`auth.users`, identities, sessions). The
  3 Supabase Auth accounts are not in it, and neither is Storage.
- Tables are read one query at a time outside a single snapshot, so the copy is
  not point-in-time consistent (low impact at current traffic).
- There is no restore script. Restoring means hand-written inserts from JSON,
  with type fidelity issues (numeric/timestamptz/jsonb/arrays come back as JSON
  strings or values to be re-cast).
- Loads each table fully into memory. Fine at today's sizes.

Supabase platform backups, per [Supabase docs: Database Backups](https://supabase.com/docs/guides/platform/backups)
and the [free-plan FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups):
Pro projects get daily backups kept 7 days (Team 14, Enterprise 30), restored
from the dashboard. Free-plan projects get no automatic backups. PITR is a
paid hourly add-on. I could not see the project's plan or whether PITR is on;
the owner should check Dashboard → Database → Backups. Content was rephrased for
compliance with licensing restrictions.

Recommendation: yes, take a `pg_dump` before 0005-0007 and again before 0008.
It is the only restorable, schema-complete copy if the project is on the Free
plan, and a quick undo path even on Pro. `pg_dump` is not installed on this
machine. Docker is available, so the `postgres:17` image's `pg_dump` works.
Point it at the session-mode or direct connection (port 5432), not the 6543
transaction pooler. Pass the URL via an env var, never on a logged command line.
Dump `public` (schema and data, `--no-owner --no-privileges` optional) plus a
data-only dump of `auth`, or use `supabase db dump`. Keep the output outside the
repo. Run `npm run db:backup` as well for a quick readable copy. Restore drill:
restore the dump into a scratch database (local Docker) and spot-check row
counts before relying on it.

#### Other observations (not blockers)

- `schema_migrations` has RLS disabled. anon/authenticated hold only the
  default-ACL `REFERENCES, TRIGGER, TRUNCATE` on it. That gives no `SELECT`,
  and PostgREST exposes no TRUNCATE. Optional tidy-up in a future migration:
  revoke all from anon, authenticated.
- service_role keeps default-ACL `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN` on every
  table, but no `SELECT`/DML on public tables. The new code uses
  `SUPABASE_SECRET_KEY` only for the Storage API, so this is fine.
- Production has no Storage buckets yet. `lib/media/supabase-store.ts` creates
  the private `wardrobe` and `public-content` buckets on first upload, which
  needs `SUPABASE_SECRET_KEY` set in Vercel.
- PostgREST is running (`authenticator` connection seen), so the Data API is
  live. That is why 0007's revoke matters.

#### Recommended sequence

1. Owner confirms the Supabase plan and backup/PITR status in the dashboard.
2. Take a `pg_dump` backup (and `npm run db:backup`) outside the repo.
3. `npm run db:migrate -- --to=0007_community.sql` at low traffic. This applies
   0005, 0006 and 0007, each in its own transaction. HEAD keeps working.
4. Verify: `schema_migrations` has 7 rows. anon/authenticated have no grants on
   the four kept tables or the 18 new ones. RLS is on. livinup.in (HEAD) still
   signs in and serves pages.
5. Deploy the new code with `SUPABASE_SECRET_KEY` and `CRON_SECRET`. Verify the
   critical flows. Confirm Vercel Cron lists only `/api/cron/cleanup`.
6. With explicit owner approval: take a fresh backup, then `npm run db:migrate`
   (applies 0008 only).

Blockers: none in the SQL or code. Pending owner input: the Supabase plan and
PITR status, a `pg_dump` taken before step 3, and a check of Vercel's Cron Jobs
tab, none of which I can see from here.
