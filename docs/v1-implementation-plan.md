# LivinUp v1: Repository Audit and Implementation Plan

**Status:** Proposed, awaiting approval · 31 October 2026
**Specification:** [product-spec.md](product-spec.md)

**What was done to produce this:**

- Read-only inspection of the production and local databases.
- An import-graph analysis of all 183 source files.
- Text searches for indirect references.
- A full baseline run of the checks.

**What was not done:** no code was removed and no database was modified.

---

## 1. Baseline, before any cleanup

Every result below was run on 31 October 2026 against the current working tree, with uncommitted changes included.

| Check                | Command                                      | Result                                                                                                                                                                                  |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check           | `npm run typecheck`                          | **Pass**                                                                                                                                                                                |
| Lint                 | `npm run lint`                               | **Pass**, 1 warning (`canonicalizeTitle` unused in `services/normalization/normalize.ts`, which is retired code)                                                                        |
| Format               | `npm run format:check`                       | **Fail on 34 files.** All 34 pass with `--end-of-line auto`: they are Windows line endings in this checkout (`core.autocrlf=true`), not code-style problems. CI on Linux is unaffected. |
| Unit and integration | `npx vitest run`                             | **Pass: 22 files, 267 tests**                                                                                                                                                           |
| Production build     | `next build` with Supabase variables blanked | **Pass**, 17 routes                                                                                                                                                                     |
| End-to-end           | `npx playwright test`                        | **Pass: 8 tests** (4 journeys × desktop Chrome and Pixel 7)                                                                                                                             |

**Correction to earlier reports:** a Playwright suite does exist (`tests/e2e/journey.spec.ts`) and it passes. It covers only the old shopping journey plus the "signed-out visitors are redirected" check, so most of it will be replaced.

---

## 2. Database state

Verified read-only. Every query ran inside a read-only transaction, and no personal data was printed.

| Item                 | Production (Supabase, ap-south-1)                                                                                                                         | Local (`.livinup/pgdata`)                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Migrations applied   | `0001`–`0004` only                                                                                                                                        | `0001`–`0007`                                             |
| `0005_ingestion.sql` | **Not applied** (committed in git)                                                                                                                        | Applied                                                   |
| `0006`, `0007`       | Not applied; files are uncommitted                                                                                                                        | Applied                                                   |
| Accounts             | **3 Supabase Auth users** (all Gmail; 2 have signed in; 1 never confirmed)                                                                                | 7 local accounts: 6 from my automated checks, 1 yours     |
| Wardrobe tables      | Do not exist                                                                                                                                              | 22 items and 3 outfits, all from automated-check accounts |
| Catalogue            | 46 products, 104 USD listings, 3 fictional merchants, 3,120 price rows (all `seed`)                                                                       | Same, re-priced in INR                                    |
| User shopping data   | 0 saved, 0 likes, 1 rejection, 0 affiliate clicks                                                                                                         | Test data only                                            |
| Preferences          | 14 rows across 2 accounts                                                                                                                                 | 7 rows (one automated-check account)                      |
| Events               | 389 (202 anonymous; 196 are `landing_view`)                                                                                                               | Test data                                                 |
| Storage              | No buckets, no objects                                                                                                                                    | No storage                                                |
| App connection role  | `postgres`: bypasses RLS, can delete `auth.users`                                                                                                         | n/a                                                       |
| Public-role grants   | `anon` and `authenticated` hold `TRUNCATE`, `TRIGGER` and `REFERENCES` on all public tables except `local_auth_users`, from Supabase's default privileges | n/a                                                       |

**Stop condition (D13):** production has three accounts, not one. Nothing destructive runs until you confirm they are all yours.

---

## 3. Dependency map

The import graph resolves static imports, re-exports, dynamic `import()`, `require()` and the `@/` alias. It found no unresolved imports.

### 3.1 Hidden links from kept code into retired code

These have to be cut before the retired code can be deleted, or the build breaks.

| Kept file                                       | How it reaches retired code                                                                                                                                                    | Fix                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `lib/db/index.ts`                               | **Dynamic import** of `services/ingestion/seed-runner` when the embedded database first starts. This pulls in all of ingestion, normalization, pricing and the seed catalogue. | Stop seeding the catalogue; migrate only                                         |
| `scripts/db-seed.ts`, `scripts/db-reset.ts`     | Call `seedDatabase`                                                                                                                                                            | Reset migrates only; `db:seed` becomes local-only fixtures or is removed (U3)    |
| `app/(app)/profile/page.tsx`                    | `lib/engagement` → `lib/products` → `lib/deals/engine`, and `lib/preferences`                                                                                                  | Replace the page (milestone M4); interim version with no shopping stats          |
| `app/(app)/onboarding/*`                        | `lib/preferences` → `config/scoring`; writes style preferences                                                                                                                 | Interim welcome step, then username onboarding in M4                             |
| `app/(app)/wardrobe/actions.ts`                 | Imports the `ActionResult` type from `app/(app)/actions.ts` (the shopping actions file)                                                                                        | Move the type to `lib/actions/result.ts`                                         |
| `config/wardrobe.ts`                            | `COLORS` and `MATERIALS` from `config/taxonomy.ts`                                                                                                                             | Keep those two; delete the rest of the taxonomy                                  |
| `proxy.ts`                                      | Its matcher string names `api/product-image` and `go/`; its protected list names retired routes                                                                                | Update                                                                           |
| `next.config.ts`                                | `images.remotePatterns: '**'` exists for merchant images                                                                                                                       | Remove                                                                           |
| `app/not-found.tsx`, `app/error.tsx`            | Copy and links point to `/search` and "your feed"                                                                                                                              | Update                                                                           |
| `tests/helpers/db.ts`                           | Seeds the catalogue by default                                                                                                                                                 | Migrate only                                                                     |
| `tests/integration/rls.test.ts`                 | Inserts into `products` and `saved_products`                                                                                                                                   | Rewrite against wardrobe tables                                                  |
| `user_events.product_id`, `merchant_product_id` | Database foreign keys into catalogue tables (`on delete set null`)                                                                                                             | Stage 2 drops those constraints and keeps the columns, so event history survives |

### 3.2 External dependencies

**No npm package is used only by the shopping product,** so no package is removed. `sharp`, which photo processing needs, is already installed (0.35.4) as a Next.js optional dependency. It will be added to `dependencies` explicitly so the install doesn't depend on Next's optional dependencies.

---

## 4. Classification

Categories, as requested:

1. Obsolete and safe to remove.
2. Shared, or required by v1.
3. Reusable but needs refactoring.
4. Uncertain or needs approval.

### 4.1 Category 1: obsolete, safe to remove (Stage 1)

| Area                               | Files                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes                             | `app/(app)/search/page.tsx`, `app/(app)/saved/page.tsx`, `app/(app)/preferences/page.tsx`, `app/(app)/product/[id]/page.tsx`, `app/(app)/home/page.tsx` (the shopping feed; the `/home` URL is reused later), `app/go/[merchantProductId]/route.ts`, `app/api/cron/ingest/route.ts`, `app/api/product-image/[slug]/route.ts` |
| Server Actions                     | The product save, like, reject and undo actions and the preference actions in `app/(app)/actions.ts`, after the `ActionResult` type has moved                                                                                                                                                                                |
| Components                         | `components/products/*` (12 files), `components/search/*` (3), `components/preferences/*` (2)                                                                                                                                                                                                                                |
| Price tracking and deals           | `lib/deals/engine.ts`, `services/pricing/history.ts`, `types/deals.ts`                                                                                                                                                                                                                                                       |
| Discovery and ranking              | `lib/recommendations/*` (3), `lib/search/*` (4), `config/scoring.ts`, `types/discovery.ts`                                                                                                                                                                                                                                   |
| Catalogue and engagement           | `lib/products/repository.ts`, `lib/engagement/repository.ts`, `types/catalog.ts`                                                                                                                                                                                                                                             |
| Affiliate and ingestion            | `lib/affiliate/redirect.ts`, `lib/providers/types.ts`, `lib/merchants/provider.ts`, `services/ingestion/*` (10 files, including the Flipkart, Admitad and Cuelinks adapters), `services/normalization/*` (4), `config/catalog-filters.ts`, `scripts/ingest.ts`                                                               |
| Preferences code (P10)             | `lib/preferences/repository.ts`. **The `user_preferences` table and its rows stay.**                                                                                                                                                                                                                                         |
| Dummy catalogue                    | `supabase/seed/catalog.ts`                                                                                                                                                                                                                                                                                                   |
| Utilities                          | `lib/utils/random.ts`, `lib/utils/number.ts`; `formatMoney`, `formatDiscount` and `formatPercent` in `lib/utils/format.ts`; `validateRedirectTarget`, `hostMatches` and `hostOf` in `lib/utils/url.ts`; `DEFAULT_CURRENCY` in `config/app.ts`                                                                                |
| Taxonomy                           | Everything in `config/taxonomy.ts` except `COLORS` and `MATERIALS`: categories, subcategories, genders, price bands, preference attributes, availability                                                                                                                                                                     |
| Unused files                       | `components/ui/Section.tsx` (no importers anywhere), `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (Next.js template leftovers, no references)                                                                                                                                                      |
| Environment variables              | `INGESTION_CRON_SECRET`, `FLIPKART_AFFILIATE_TRACKING_ID`, `FLIPKART_AFFILIATE_TOKEN`, `FLIPKART_FEED_CATEGORIES`, `ADMITAD_FEEDS`, `CUELINKS_API_KEY`, `CUELINKS_CONVERT_URL`, and the unread `SUPABASE_SERVICE_ROLE_KEY` entry (from `config/env.server.ts` and `.env.example`)                                            |
| Uncommitted migration              | `supabase/migrations/0006_india_currency_defaults.sql`. It only changes defaults on tables being retired, was never committed, and was never applied in production.                                                                                                                                                          |
| Uncommitted rupee re-pricing       | The seed price edits, `retailRound`, and the `wholeUnits` option. They go with the seed catalogue.                                                                                                                                                                                                                           |
| Event types                        | The shopping event names in the `EventType` union. Rows already in `user_events` stay.                                                                                                                                                                                                                                       |
| Docs                               | `docs/product-data.md`, `docs/deal-engine.md`, `docs/recommendations.md`, and the ingestion, merchant and "re-seed in rupees" sections of `docs/deployment.md`                                                                                                                                                               |
| Tests that only cover removed code | `affiliate.test`, `catalog.test`, `ingestion-run.test`, `personalization.test`, `search.test`, `preference-batching.test`, `deal-engine.test`, `ingestion-providers.test`, `matching.test`, `price.test`, `recommendations.test`. Each is removed together with the code it tests and listed in the final report.            |

### 4.2 Category 2: shared or required by v1, kept

- **Auth:** `lib/auth/*`, `app/(auth)/*`, `app/auth/callback`, `config/auth.ts`.
- **Database:** `lib/db/*` (with the seeding change in 3.1); migrations `0001`–`0004` (`profiles`, `local_auth_users`, `user_preferences`, `user_events`, `livinup_current_user_id()`); `0005` stays in history, because it is committed.
- **Platform:** `lib/logging/logger.ts`, `lib/analytics/*`, `components/shared/AnalyticsIdentity.tsx`, `config/env.server.ts`, `config/env.public.ts`, `lib/utils/cn.ts`, `safeInternalPath`, `isSafeHttpUrl` and `parseUrl` in `lib/utils/url.ts`, `formatDate`, `formatRelativeTime` and `humanize` in `lib/utils/format.ts`.
- **UI:** `components/ui/{Button,Card,Container,Field,PageHeader,Skeleton,Badge,EmptyState}`. `Badge` and `EmptyState` are currently used only by retired screens but are needed for verified badges and empty states. `components/layout/{AppShell,AuthForm,Logo}`, `app/layout.tsx`, `app/globals.css`.
- **Tooling and tests:** CI workflow, Playwright and Vitest config, ESLint and Prettier config. Tests kept: `auth-actions`, `auth-callback-errors`, `auth-email-confirmation`, `env-config`, `db-data-dir`, `proxy-session-refresh`, `serverless-runtime`, `auth-provisioning`.

### 4.3 Category 3: reusable, needs refactoring

| Item                                                                                                                                   | Change                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wardrobe (uncommitted): `0007`, `lib/wardrobe`, `config/wardrobe.ts`, `types/wardrobe.ts`, `app/(app)/wardrobe`, `components/wardrobe` | Rewrite `0007` to the spec schema before its first commit. Replace slot rules with the zone model (spec 5.3). Add photos, archiving and the item detail page. Move outfits to `/outfits`. Retire the mannequin in `garments.tsx`; keep `GarmentIcon` for items without a photo. |
| `config/app.ts`                                                                                                                        | New navigation items; drop the currency                                                                                                                                                                                                                                         |
| `proxy.ts`                                                                                                                             | New protected and public routes; drop retired paths from the matcher                                                                                                                                                                                                            |
| `next.config.ts`                                                                                                                       | Remove `remotePatterns`; add `redirects()` for the retired URLs                                                                                                                                                                                                                 |
| `app/(app)/actions.ts`                                                                                                                 | Removed; `ActionResult` moves to `lib/actions/result.ts`                                                                                                                                                                                                                        |
| Onboarding, profile page                                                                                                               | Interim versions in M1, rebuilt in M4                                                                                                                                                                                                                                           |
| `app/not-found.tsx`, `app/error.tsx`                                                                                                   | Copy and links                                                                                                                                                                                                                                                                  |
| Landing page: `components/marketing/*`, `app/(marketing)/page.tsx`                                                                     | Remove `OutfitStudio` (AI styling), `GapFinder` (shopping) and `StylistBoard` and its data (stylist marketplace). Keep and update `WardrobeShowcase`, `BrandDiscovery` and `JourneyFlow`. Rewrite the copy to v1 scope.                                                         |
| `tests/unit/security.test.ts`                                                                                                          | Remove the `normalizeProduct` and redirect-allowlist cases; keep the session, password and path cases                                                                                                                                                                           |
| `tests/unit/format.test.ts`                                                                                                            | Remove the money cases; keep `humanize`                                                                                                                                                                                                                                         |
| `tests/integration/rls.test.ts`, `tests/helpers/db.ts`                                                                                 | Rewrite against the new tables; stop seeding the catalogue                                                                                                                                                                                                                      |
| `tests/e2e/journey.spec.ts`                                                                                                            | Replace the shopping journey with the v1 journeys (spec section 11); keep the signed-out redirect test                                                                                                                                                                          |
| `vitest.config.mts`                                                                                                                    | Coverage paths, once `services/` is gone                                                                                                                                                                                                                                        |
| Docs                                                                                                                                   | Rewrite `README.md`, `docs/architecture.md`, `docs/database.md`, `docs/analytics.md` and `docs/development.md`. In `docs/decisions.md`, mark ADR-0003, 0004, 0005, 0008, 0009, 0010, 0011, 0012, 0013 and 0014 "Superseded by v1", and update ADR-0017 if U2 is approved.       |

### 4.4 Category 4: uncertain or needs your approval

| #   | Item                                                       | Recommendation                                                                                                                                                    |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | Admitad and Cuelinks verification tags in `app/layout.tsx` | Remove them, but only if you are closing those publisher accounts                                                                                                 |
| U2  | Server-only Supabase secret key for storage (spec 7.3)     | Approve. It is needed for orphan cleanup, moderation removals and account deletion; reverses part of ADR-0017                                                     |
| U3  | Local development fixtures                                 | Replace the catalogue seed with one local-only script that creates two demo accounts with a few items, an outfit and a post. Refuses to run on a remote database. |
| U4  | `posthog-js`                                               | Keep. It is optional, off by default, and the only analytics mirror                                                                                               |
| U5  | `SENTRY_DSN`                                               | Keep. It is declared but not yet used; wired in M8                                                                                                                |
| U6  | Line-ending failures in the local format check             | Add `.gitattributes` with `* text=auto eol=lf`. This doesn't change any file content in git.                                                                      |
| U7  | A staging Supabase project                                 | Recommended, free tier. Migrations are rehearsed there before production, since production is currently the only shared database.                                 |

---

## 5. Risks

| #   | Risk                                                                        | Severity | Mitigation                                                                                                                                 |
| --- | --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | Production has 3 accounts, not the 1 expected                               | High     | Stop condition until you confirm (D13)                                                                                                     |
| K2  | Production is behind the repository: `0005` was never applied               | Medium   | Apply migrations in order, rehearsed on staging (U7). No retired code needs `0005` after Stage 1.                                          |
| K3  | The app's database role is `postgres`, which bypasses RLS                   | Medium   | It already exists; keep it server-only. Explicit `user_id` scoping stays mandatory. A least-privilege role is a later hardening item.      |
| K4  | Public roles hold `TRUNCATE`, `TRIGGER` and `REFERENCES` by default         | Low      | Supabase's API can't issue these, but the new migrations revoke them on new tables and a hardening migration revokes them on existing ones |
| K5  | `images.remotePatterns: '**'` makes the image optimizer fetch from any host | Medium   | Removed in M1                                                                                                                              |
| K6  | Wardrobe photos leaking through caches or guessable URLs                    | High     | `/media` checks access on every request; random ids; `private` caching for wardrobe images; tests W5 and M6                                |
| K7  | Orphaned files and incomplete account deletion                              | Medium   | `media_deletions` queue, daily cleanup job, account marked `deleting` until done (spec 7.3–7.4)                                            |
| K8  | Legal deadlines (2–3 hour takedowns) need staff, not just code              | High     | A launch requirement (spec 12), plus a lawyer's review                                                                                     |
| K9  | A large uncommitted working tree that can only be rolled back by hand       | Medium   | Local checkpoint commits at each milestone, if you approve (G6)                                                                            |
| K10 | Deleting tests could hide regressions                                       | Medium   | Only tests of removed code are deleted, each listed; tests of kept code are refactored                                                     |
| K11 | Interim screens (onboarding, profile, `/home`) between M1 and M4            | Low      | `/home` redirects to `/wardrobe` until the feed exists; no placeholder features                                                            |

---

## 6. Implementation plan

Each milestone ends with the full check run from section 1 plus its own acceptance criteria. Nothing is committed, pushed or applied to production without the matching approval in section 7.

| #   | Milestone                            | Contents                                                                                                                                                                                                                                                                                                                      | Database                                                                                                                            | Verification                                                                                                   |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| M1  | Stage 1: remove the shopping product | **(a)** Cut the hidden links in 3.1. **(b)** Delete everything in 4.1. **(c)** Redirect retired URLs; `/home` → `/wardrobe` for now; new navigation; interim onboarding and profile; fix not-found and error pages; landing copy rewrite. **(d)** Docs and ADR updates. **(e)** Delete `0006` and rebuild the local database. | No production change. Local rebuild only.                                                                                           | All checks; a search for retired identifiers comes back empty (R1); redirects (R2); E2E for sign-up → wardrobe |
| M2  | Wardrobe and photos                  | `0007` rewritten (wardrobe tables, `media`, `media_deletions`). `ImageStore` with local and Supabase implementations; upload route; `/media` route; resizing in the browser; `sharp` on the server; grid, batch add, item detail, archive                                                                                     | `0007` (local only)                                                                                                                 | W1–W8; storage tests                                                                                           |
| M3  | Outfits                              | Zone model, board builder, outfits list, reopen, edit, delete                                                                                                                                                                                                                                                                 | Part of `0007`                                                                                                                      | O1–O3                                                                                                          |
| M4  | Profiles and community core          | Username onboarding, profiles, follows, publish with preview, feeds, likes, comments, Explore toggle                                                                                                                                                                                                                          | `0008`: profile columns, `follows`, `posts`, `post_images`, `post_items`, `post_likes`, `comments`, `blocks`, revoke default grants | A3, S1–S5, C1–C8                                                                                               |
| M5  | Notifications, sharing, safety       | Notifications, link previews, share, report, block, admin queue and audit log, rate limits, invite codes                                                                                                                                                                                                                      | `0009`: `notifications`, `reports`, `moderation_actions`, `invite_codes`                                                            | N1–N3, X1–X2, M1–M7                                                                                            |
| M6  | Accounts                             | Password reset, Google sign-in, account deletion with the cleanup job, legal page templates (final text from a lawyer)                                                                                                                                                                                                        | none new                                                                                                                            | A1, A2, A4                                                                                                     |
| M7  | Brands                               | Admin brand creation and verification, brand profiles, directory, brand tags                                                                                                                                                                                                                                                  | `0010`: `brand_details`, `post_brand_tags`                                                                                          | B1–B2                                                                                                          |
| M8  | Beta readiness                       | Sentry, accessibility run, performance check (C8), full E2E on desktop and mobile, launch checklist                                                                                                                                                                                                                           | –                                                                                                                                   | Spec section 12                                                                                                |
| M9  | Production rollout                   | Back up production → apply `0005`–`0010` on staging, then production → create buckets → set environment variables → deploy → smoke test                                                                                                                                                                                       | Production                                                                                                                          | Smoke tests; RLS and grants checked on production; W5 and M7 rerun against production                          |
| M10 | Stage 2: drop retired tables         | Export to a dated dump → one migration drops the 11 retired tables and the `0005` columns, and keeps `user_events` history by dropping only its foreign keys                                                                                                                                                                  | Production, after a separate approval                                                                                               | Before and after row counts; restore rehearsed on staging                                                      |

### Rollback strategy

- **Code:** each milestone is one local checkpoint commit (if G6 is approved), so `git revert` or `git reset` to the previous checkpoint undoes it. Until then, the working tree is the only copy.
- **Local database:** throwaway; `npm run db:reset`.
- **Production migrations:** a backup before each run, plus a reviewed down-script for each additive migration. Stage 2 is reversible only by restoring the dump, which is why it gets its own approval and a rehearsal on staging.
- **Deploys:** redeploy the previous build in Vercel.

---

## 7. Approvals needed

Approve now, before work starts:

| #   | Approval                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| G1  | The product spec, including the proposed defaults P1–P11                                                                         |
| G2  | **D13:** confirm the three production accounts are yours or are test accounts                                                    |
| G3  | U2: a server-only Supabase secret key for storage                                                                                |
| G4  | Stage 1 removal of everything in section 4.1, including the listed tests                                                         |
| G5  | Deleting the uncommitted `0006`, rewriting the uncommitted `0007`, and rebuilding the local database (automated-check data only) |
| G6  | Local checkpoint commits at each milestone boundary (no push)                                                                    |
| G7  | Decisions U1, U3, U6 and U7                                                                                                      |

Approve later, when each is reached:

| #   | Approval                                                                   | When             |
| --- | -------------------------------------------------------------------------- | ---------------- |
| G8  | Push to the remote                                                         | Your call        |
| G9  | Back up production, then apply migrations `0005`–`0010` and create buckets | M9               |
| G10 | Stage 2: drop the retired production tables                                | M10              |
| G11 | Final legal text, and the named grievance officer                          | Before beta (M8) |
