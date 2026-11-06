# LivinUp v1 go-live checklist

This is the step-by-step plan for releasing the v1 wardrobe and community app
(the uncommitted working tree) to livinup.in. The site currently runs git
`HEAD` 954368b (the shopping app). It builds on
`.livinup/workflow/migration-audit.md`, the read-only audit of production
migrations 0005–0008.

Rules for every step:

- Each step that changes production (backup aside) needs the owner's
  explicit approval first. That covers commits, pushes, deploys, migrations and
  data deletion.
- Never paste a secret value into a terminal command line, a chat, a ticket or
  this document. Refer to secrets by variable name only.
- `.env.local` on the owner's machine points `DATABASE_URL` at **production**,
  so `npm run db:migrate`, `npm run admin:grant` and `npm run db:backup` run
  locally act on the live database. Each script prints only the host it
  targets, never the password. Check that line before you continue.

---

## Open decisions and blockers

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Type                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| B1  | **Grievance officer (Indian IT Rules, 2021, as amended).** A named grievance officer with a working contact must be published before launch. The rules also set deadlines to acknowledge and resolve complaints. Public sources report that the February 2026 amendment cuts resolution from 15 days to 7, and they disagree on the acknowledgement deadline. A lawyer must confirm the deadlines that apply. Someone must be available to meet them, including about 2 hours for non-consensual intimate imagery (see `docs/product-spec.md` section 9).                    | **Blocker** for public launch        |
| B2  | **Legal texts are drafts.** `/terms`, `/privacy`, `/guidelines` and `/grievance` are templates. A qualified Indian lawyer must review them before launch. Until then, every one of these pages shows the notice "Draft pending review by a qualified lawyer". The 18+ policy and the DPDP points in spec sections 9 and 12 also need the lawyer's review.                                                                                                                                                                                                                    | **Blocker** for public launch        |
| B3  | **Urgent-report alerting is a log line only.** An urgent report (intimate image, child safety) writes `logger.error('URGENT report received…', { alert: 'moderation_urgent' })`. Nothing emails the grievance contact, although spec section 9 asks for that. Until it does, someone has to watch the logs: set up a Vercel log drain or alert on `moderation_urgent`, or check the admin queue on a rota.                                                                                                                                                                   | **Blocker** for the takedown windows |
| B4  | **Backups.** Check the Supabase plan and the backup/PITR status (Dashboard → Database → Backups). The Free plan has no automatic backups. Approve the `pg_dump` in step 2.                                                                                                                                                                                                                                                                                                                                                                                                   | Owner input needed before step 3     |
| B5  | **Removed site-verification meta tags.** At `HEAD`, `app/layout.tsx` served `mitgo-verification` (two tokens, Admitad/Mitgo publisher account) and `cuelinks-verification` (Cuelinks) through `metadata.verification.other`. The working tree removes them, consistent with dropping affiliate shopping (spec D9). If either affiliate network re-checks site ownership after the deploy, the check will fail. Decide: (a) leave them removed and close or park those publisher accounts, or (b) restore the `verification.other` block from `git show HEAD:app/layout.tsx`. | Owner decision before step 5         |
| B6  | **Commit, push and deploy approval.** The working tree (about 200 changed files, including the new `vercel.json`) is uncommitted.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owner approval at step 5             |
| B7  | **0008 approval.** Destructive. Only after step 7 passes and a fresh backup exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner approval at step 9             |

Not blockers, but worth knowing:

- `docs/deployment.md`, `docs/database.md`, `docs/analytics.md` and
  `docs/decisions.md` still describe the shopping tables and old migration
  numbers. This checklist supersedes them for the v1 release.
- Vercel cron jobs run only on the production deployment, not on previews.

---

## Vercel environment variables (Production)

Set these under Project → Settings → Environment Variables, scope
**Production**. A changed variable only takes effect after a redeploy.
`NEXT_PUBLIC_*` values are compiled into the build, so they need a fresh
build.

| Variable                               | Required     | Value / notes                                                                                                                  |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                         | Yes          | Already set for `HEAD`. Supabase pooler connection string.                                                                     |
| `LIVINUP_DB_DRIVER`                    | Yes          | `postgres`. `auto` is refused in production.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes          | Already set.                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes          | Already set. Public by design.                                                                                                 |
| `NEXT_PUBLIC_APP_URL`                  | Yes          | `https://livinup.in`. Used to build auth email links and the Google redirect (`lib/auth/site-url.ts`).                         |
| `SUPABASE_SECRET_KEY`                  | **New, yes** | Server-only. See below.                                                                                                        |
| `CRON_SECRET`                          | **New, yes** | Server-only. See below.                                                                                                        |
| `LIVINUP_MEDIA_DRIVER`                 | Recommended  | `supabase`. Makes a missing `SUPABASE_SECRET_KEY` fail loudly instead of silently using temporary disk (see below).            |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME`   | For launch   | Named officer (B1). Shown on `/grievance`.                                                                                     |
| `NEXT_PUBLIC_GRIEVANCE_EMAIL`          | For launch   | Officer contact (B1). Shown on `/grievance`.                                                                                   |
| `NEXT_PUBLIC_LEGAL_ENTITY`             | For launch   | Legal company name used in the Terms. Defaults to `LivinUp`.                                                                   |
| `LIVINUP_GOOGLE_AUTH`                  | Optional     | `1` only after Google is enabled in Supabase (see Optional features).                                                          |
| `LIVINUP_REQUIRE_INVITE`               | Optional     | `1` for the invite-only beta (see Optional features).                                                                          |
| `LIVINUP_LOG_LEVEL`                    | Optional     | `info`.                                                                                                                        |
| `SENTRY_DSN`                           | Optional     | Not wired yet; errors go to the structured logger.                                                                             |
| `INGESTION_CRON_SECRET`                | Remove       | Read only by `HEAD`'s `/api/cron/ingest`, which the new code deletes. Remove after the new deployment is verified, not before. |
| `LIVINUP_AUTH_SECRET`                  | No           | Only for the local auth provider. Production uses Supabase Auth.                                                               |

Never give any secret a `NEXT_PUBLIC_` prefix. Anything with that prefix is
compiled into the browser bundle.

### `SUPABASE_SECRET_KEY`

- **What it is:** the Supabase secret API key (Dashboard → Project Settings →
  API Keys → secret key, format `sb_secret_…`). A legacy service-role JWT also
  works, but prefer the new secret key.
- **Where it is used:** only in `lib/media/supabase-store.ts`, which makes
  Supabase Storage REST calls (`/storage/v1`): image uploads (`put`), reads
  behind `/media/[id]/[size]` (`get`) and deletes (`remove`). It is declared in
  `config/env.server.ts`, which imports `server-only`, so a Client Component
  that imports it fails the build. The key is never logged. It goes in the
  `apikey` header, plus `Authorization: Bearer` for legacy JWT keys. No
  database access uses it; the app reaches tables through `DATABASE_URL`.
- **Why it is needed:** Supabase does not allow deleting Storage objects with
  SQL. Cleanup, moderation removals and account deletion also run without a
  user session.
- **Buckets:** `wardrobe` and `public-content` (`lib/media/store.ts`
  `BUCKETS`). **The code creates them**: on the first upload in each server
  process, `ensureBuckets()` does `POST /storage/v1/bucket` for both with
  `public: false`, `file_size_limit` 6 MB and `allowed_mime_types:
['image/webp']`. It treats 400/409 ("already exists") as success. Production
  has no buckets yet (audit), so they appear on the first upload. Manual
  creation is optional. If you create them by hand, use exactly those
  settings: private, 6 MB limit, `image/webp` only. The code never updates an
  existing bucket's settings. Both buckets must stay **private**: every image
  is served through `/media`, which checks access first.
- **Failure mode to know:** with `LIVINUP_MEDIA_DRIVER` unset (`auto`) and the
  key missing, `resolveMediaDriver()` picks the **local** store. On Vercel that
  writes to the function's temp directory and logs no warning
  (`lib/media/local-store.ts` only warns off ephemeral hosts). Uploads seem to
  work, then the images disappear on the next cold start or another instance.
  Setting `LIVINUP_MEDIA_DRIVER=supabase` turns this into a clear
  `StorageUnavailableError`.
- **Verify without exposing it:**
  1. Vercel → Settings → Environment Variables: `SUPABASE_SECRET_KEY` is
     listed for Production. The value stays hidden. `vercel env ls production`
     shows names only.
  2. After the deploy, sign in, upload a wardrobe photo, and reload the
     wardrobe a few minutes later (or after a redeploy). The image still
     loads.
  3. Supabase Dashboard → Storage: both buckets exist, are marked private,
     and `wardrobe` contains objects under `<owner-uuid>/<media-uuid>/`.
  4. Vercel → Logs: none of `Image storage needs NEXT_PUBLIC_SUPABASE_URL and
SUPABASE_SECRET_KEY`, `could not create storage bucket`, `storage upload
failed`, `storage delete failed`.
  5. Delete the test item. After the next cleanup run, the objects are gone
     from the bucket.

### `CRON_SECRET`

- **What it is:** a random shared secret, at least 32 bytes. Generate it
  locally and paste it straight into Vercel:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Don't save it anywhere else.
- **How auth works** (`app/api/cron/cleanup/route.ts`): when the variable is
  set, Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on each run
  ([Vercel: Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)).
  The route compares the full header with `Bearer ${CRON_SECRET}` using
  `crypto.timingSafeEqual`, after a length check. If `CRON_SECRET` is unset
  or empty, **every** call gets `401 {"error":"unauthorised"}`. The endpoint
  fails closed and never runs unauthenticated. A wrong or missing header also
  gets 401.
- **Schedule** (`vercel.json`): `{"path": "/api/cron/cleanup", "schedule":
"30 21 * * *"}`, daily at 21:30 UTC (03:00 IST). On the Hobby plan Vercel
  may run it at any time within that hour. `maxDuration` is 60 s.
- **What a run does.** The four steps run in order and are independent, so a
  failing step is recorded and the next one still runs:
  1. `stalledDeletions` (`lib/account/delete.ts`
     `finishStalledDeletions`): re-runs account deletion for up to 50 profiles
     stuck in `status = 'deleting'`. That removes their files, profile and
     `auth.users` row.
  2. `orphanedMedia` (`lib/media/repository.ts` `deleteOrphanedMedia`): finds
     up to 500 `media` rows older than 24 h that no wardrobe item, post image
     or avatar references (abandoned uploads), deletes them and queues their
     files for removal.
  3. `deletionQueue` (`processDeletionQueue`): removes up to 200 queued
     files, every size variant, from Storage. On success the queue row is
     deleted. On failure `attempts` goes up and the file is retried the next
     day.
  4. `prunedNotifications` (`lib/community/notifications.ts`): deletes
     notifications older than 90 days (`NOTIFICATION_RETENTION_DAYS`).
     The run logs `cleanup finished` with a summary and returns `200 {"ok":
true, ...}`. A step that fails appears in the body as `{ "error": "<ref>" }`,
     so a 200 can still contain step errors. Read the body or the log line.
- **Verify without exposing it:**
  1. Vercel → Settings → Environment Variables: `CRON_SECRET` is listed for
     Production.
  2. Vercel → Settings → Cron Jobs: exactly one job, `/api/cron/cleanup`,
     `30 21 * * *`. There must be no `/api/cron/ingest`.
  3. `curl -i https://livinup.in/api/cron/cleanup` with no header returns
     **401**. That proves the endpoint rejects anonymous calls, but **not**
     that the secret is set (an unset secret also gives 401).
  4. To prove it is set: Cron Jobs → `/api/cron/cleanup` → **Run**. Vercel
     sends the secret itself. Then Vercel → Logs shows a `200` for
     `/api/cron/cleanup` and a `cleanup finished` line with no step errors.
     A `401` here means the variable is missing or the deployment predates
     it, so redeploy.

---

## Go-live sequence

Each step lists how to check it and how to roll it back. Don't start a step
until the one before it checks out.

### Step 0. Pre-flight (local, no production impact)

- [ ] `npm run format:check`, `npm run typecheck`, `npm run lint`,
      `npm test`, `npm run build` and the browser suite all pass on the final
      working tree.
- [ ] Decisions B4 and B5 made. B1–B3 are accepted as known launch blockers,
      or resolved if this is the public launch rather than a closed beta.
- [ ] Pick a low-traffic window, for example late night IST.

### Step 1. Put the secrets in Vercel (no effect on the live site)

- [ ] Add `SUPABASE_SECRET_KEY`, `CRON_SECRET` and `LIVINUP_MEDIA_DRIVER=supabase`
      (Production). Confirm `LIVINUP_DB_DRIVER=postgres` and
      `NEXT_PUBLIC_APP_URL=https://livinup.in` are present.
- [ ] Add the grievance variables if the officer is appointed (B1).
- Check: the variables are listed, values hidden. `HEAD` ignores all the new
  ones.
- Do **not** redeploy `HEAD` just for this, and do not remove
  `INGESTION_CRON_SECRET` yet.
- Rollback: delete the variables. No other effect.

### Step 2. Back up production

- [ ] Check the Supabase plan and the backup/PITR status (B4). On Pro, also
      note the time of the latest daily backup.
- [ ] Take a `pg_dump` with Docker's `postgres:17` image. Use the **session
      mode / direct** connection string (port 5432), not the 6543 transaction
      pooler. Pass it through an environment variable so it never shows up on
      the command line (PowerShell 7):

  ```powershell
  $env:PGURL = Read-Host 'Session-mode connection string' -MaskInput
  $out = "$HOME\livinup-backups\$(Get-Date -Format yyyyMMdd-HHmm)"
  New-Item -ItemType Directory -Force $out | Out-Null
  docker run --rm -e PGURL -v "${out}:/backup" postgres:17 `
    sh -c 'pg_dump "$PGURL" --schema=public --format=custom --file=/backup/public.dump && pg_dump "$PGURL" --schema=auth --data-only --format=custom --file=/backup/auth-data.dump'
  Remove-Item Env:PGURL
  ```

  `-e PGURL` without `=` copies the value from your shell, so it never
  appears in the command or in `docker inspect` output.

- [ ] Also run `npm run db:backup` for a readable JSON copy. It writes outside
      the repo, to `~/livinup-backups/<timestamp>/`. It is data-only for
      `public` and has no restore script, so it is not a replacement for the
      dump.
- [ ] Restore drill: restore `public.dump` into a scratch local container and
      compare row counts with the audit (profiles 3, user_events 428,
      products 46, price_history 3120, ...).
- Check: both dump files exist and are not empty. The restore drill counts
  match.
- Rollback: not applicable. Keep the backup outside the repo and never commit
  it.

### Step 3. Apply migrations 0005–0007 (live site keeps running `HEAD`)

- [ ] `npm run db:migrate -- --to=0007_community.sql`
- Check the `Migrating postgres at <host>/postgres up to 0007_community.sql`
  line (production host), then expect `Applied 3 migration(s):` with
  `+ 0005_ingestion.sql`, `+ 0006_wardrobe.sql`, `+ 0007_community.sql`
  within seconds. Each file runs in its own
  transaction together with its `schema_migrations` row.
- If it hangs for more than about 30 s (lock wait on `profiles`; the runner
  sets no `lock_timeout`), press Ctrl+C. The open transaction rolls back and
  earlier migrations stay applied. Find the blocking session and retry.
- Rollback: 0005–0007 are additive and the audit confirmed `HEAD` works with
  them. The default rollback is to **leave them in place**. Undo by hand only
  if something breaks. Do not re-grant the revoked privileges (see step 4).
  For a full undo, restore from step 2.

### Step 4. Verify grants and RLS (read-only)

Run these in the Supabase SQL editor inside `begin read only; ... rollback;`.

- [ ] Seven migrations recorded:

  ```sql
  select name from schema_migrations order by name;
  -- expect 0001 … 0007, no 0008
  ```

- [ ] No Data API access to user tables or the new tables. The only rows
      allowed are the 11 shopping tables, which 0008 removes later:

  ```sql
  select table_name, grantee, string_agg(privilege_type, ',') as privs
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
     and table_name not in ('affiliate_clicks','saved_products','product_likes',
       'product_rejections','price_history','product_images','product_variants',
       'merchant_products','products','merchants','ingestion_runs')
   group by 1, 2 order by 1, 2;
  -- expect 0 rows (profiles, user_preferences, user_events, local_auth_users
  -- and the 18 tables from 0006/0007 must not appear)
  ```

- [ ] RLS is on everywhere except the migrations ledger:

  ```sql
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  -- expect only schema_migrations
  ```

- The grants query is the check that matters. A `curl` to
  `/rest/v1/profiles` with only the publishable key proves nothing here:
  `anon` already had no `SELECT` on `profiles` before 0007. The revoke that
  counts is the one on `authenticated`, which the query above covers.

- [ ] livinup.in (still `HEAD`): sign in, browse, open a product, sign out.
      Everything works as before.
- Rollback: if `HEAD` breaks (not expected), redeploying is not needed. Find
  the failing query in the Vercel logs first. Re-granting 0004's privileges on
  `profiles` would let any signed-in user set `role = 'admin'` through the
  Data API, so restoring from the step 2 backup is the safer undo.

### Step 5. Commit, push and deploy the new code (owner approval: B5, B6)

- [ ] Resolve B5 (verification tags) first.
- [ ] Commit the working tree (check that no `.env*`, `.livinup/` or backup
      files are staged) and push. Vercel builds and promotes the production
      deployment from the main branch.
- [ ] Watch the build in Vercel. It must finish without errors, and the
      deployment must show the cron job from `vercel.json`.
- Rollback: Vercel → Deployments → the previous production deployment
  (`954368b`) → **Instant Rollback** / Promote. That is safe while 0008 has not
  run, because `HEAD` works on the 0005–0007 schema. Data written by the new
  code (wardrobe, posts) stays in its tables, invisible to `HEAD`. Storage
  objects stay in the buckets.

### Step 6. Verify secrets and cron on the new deployment

- [ ] `SUPABASE_SECRET_KEY` checks 2–5 above (an upload survives, buckets
      exist and are private, no storage errors in the logs).
- [ ] `CRON_SECRET` checks 2–4 above (exactly one cron job, anonymous 401, a
      manual Run returns 200 with `cleanup finished`).
- Rollback: fix the variable and redeploy. If storage cannot be fixed
  quickly, roll back as in step 5.

### Step 7. Smoke tests (desktop and phone)

- [ ] Landing page `/` loads with the hero and animation. `/signin` and
      `/signup` load.
- [ ] Sign up with a new email: the 18+ confirmation and terms checkbox are
      required. The confirmation email link comes back to
      `https://livinup.in/auth/callback` and lands on onboarding.
- [ ] Existing account sign-in: it goes through onboarding (username, consent)
      because the new profile fields are empty.
- [ ] Password reset email: the link works and leads to `/reset-password/new`.
- [ ] Wardrobe: add pieces with photos, open an item, edit, delete.
- [ ] Outfits: build on the board, save, reopen, edit, delete. On a phone
      there is no horizontal scroll, and tapping a piece selects it.
- [ ] Create a post from an outfit. The preview says what will be public.
      Publish, then see it at `/p/<id>` signed out and in Explore at `/home`.
- [ ] Profile `/u/<username>` works signed out. Follow, like, comment and a
      notification work between two test accounts.
- [ ] Report a post. Block an account.
- [ ] `/media/...` for a private wardrobe image is not served (no image
      returned) when signed out or signed in as someone else.
- [ ] `/terms`, `/privacy`, `/guidelines`, `/grievance` all show the
      "Draft pending review by a qualified lawyer" notice.
- [ ] Old shopping URLs (`/search`, `/product/...`, `/saved`, `/go/...`) give
      a 404, not a 500.
- [ ] Account deletion on a throwaway test account: the account can't sign in
      again and its files leave Storage after the next cleanup run.
- [ ] Vercel logs: no unexpected `error` level lines during the test.
- Rollback: as in step 5.

### Step 8. Grant the admin role

- [ ] The owner signs in to the new site once, so a profile exists.
- [ ] `npm run admin:grant -- --email=<owner email>` (from the owner's machine;
      check the printed target host). Use `--username=<name>` once a username
      exists, and `--revoke` to undo.
- [ ] The owner finishes onboarding. `requireAdmin` needs a username. Admins
      skip the invite requirement.
- [ ] `/admin` (reports queue), `/admin/brands`, `/admin/invites` load for the
      owner and return 404 for a non-admin account.
- Rollback: `npm run admin:grant -- --email=<owner email> --revoke`.

### Step 9. Apply 0008 (destructive; owner approval B7)

Only after steps 5–8 pass and the new deployment has run cleanly for long
enough that a rollback to `HEAD` is no longer wanted. **After 0008, Instant
Rollback to `954368b` breaks search, product pages and saves, because their
tables are gone.**

- [ ] Fresh backup, as in step 2 (new timestamped folder).
- [ ] `npm run db:migrate`, which applies only `0008_retire_shopping.sql`.
- [ ] Check: `schema_migrations` has 8 rows. None of the 11 tables exist
      (`select to_regclass('public.products')` returns null). `user_events`
      still has its rows. The smoke tests from step 7 pass again.
- [ ] Remove `INGESTION_CRON_SECRET` from Vercel.
- Data lost: the synthetic catalogue (3 merchants, 46 products, 104 listings,
  132 variants, 104 images, 3,120 price rows) and 1 `product_rejections` row.
- Rollback: restore the 11 tables from the step 9 backup
  (`pg_restore --schema=public -t <table> ...` into production, after a
  restore drill). The new code doesn't need them, so restoring is only for
  data recovery.

---

## Optional features

### Google sign-in

1. Google Cloud Console → create an OAuth client (Web). Authorised redirect
   URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase Dashboard → Authentication → Sign In / Providers → Google:
   enable it and enter the client ID and client secret. That secret is kept in
   Supabase, not Vercel.
3. Supabase → Authentication → URL Configuration: Site URL
   `https://livinup.in`. Redirect URLs must include
   `https://livinup.in/auth/callback`. The app sends
   `${NEXT_PUBLIC_APP_URL}/auth/callback?next=...` (`googleSignInAction` in
   `app/(auth)/actions.ts`), and `app/auth/callback/route.ts` exchanges the
   code for a session.
4. Vercel: `LIVINUP_GOOGLE_AUTH=1`, then redeploy. The "Continue with Google"
   button only appears when Supabase Auth is configured **and** this flag is
   on (`googleAuthEnabled()`). Setting the flag before step 2 shows a button
   that leads to an error.
5. Verify: sign in with Google on `/signin`. A new Google user goes through
   onboarding (18+ and terms, plus an invite code if the beta is invite-only).
   Rollback: unset the flag and redeploy.

### Invite-only beta

1. Grant the owner admin first (step 8). Admins skip the invite check, and
   only admins can reach `/admin/invites`.
2. Create codes at `/admin/invites`. Make one for each existing account too:
   the 3 existing profiles have no username or invite yet, so they will be
   asked for a code at onboarding.
3. Vercel: `LIVINUP_REQUIRE_INVITE=1`, then redeploy.
4. Effect: `/signup` requires a code (`app/(auth)/actions.ts`). Onboarding also
   requires one for any non-admin account without a stored code, which
   catches Google sign-ups (`app/(onboarding)/onboarding/page.tsx`,
   `actions.ts`). `/admin/invites` shows whether sign-up is open or
   invite-only.
5. Verify: sign-up without a code is refused, a valid code works, and a
   disabled code is refused. Rollback: unset the flag and redeploy (sign-up
   opens).

---

## Legal pages

- All four pages render through `components/legal/LegalPage.tsx`, which shows
  "Draft pending review by a qualified lawyer. This page is not yet final."
  while `LEGAL_REVIEWED` in `config/legal.ts` is `false`.
- The notice does **not** depend on the grievance variables. Setting
  `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` and `NEXT_PUBLIC_GRIEVANCE_EMAIL` only
  replaces "To be appointed before launch" on `/grievance` with the officer's
  name and email.
- Remove the notice only after the lawyer signs off, by setting
  `LEGAL_REVIEWED = true` in a reviewed commit, together with the lawyer's
  text changes and a new "Last updated" date.
- Grievance officer requirement (B1): a named person, a working contact (the
  email, plus any postal address or form the lawyer requires), published on
  `/grievance`. Acknowledgement and resolution deadlines must match the
  current IT Rules as confirmed by the lawyer (public sources: 7 days to
  resolve after the 2026 amendment, faster takedown windows for intimate
  imagery and lawful orders; the acknowledgement period is disputed). Someone
  must be available to meet them (B3).
