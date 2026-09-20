# Product data

## Current status

**No affiliate account has been approved and no provider credentials exist in
this project**, so the live catalogue is still the hand-authored seed. What has
changed is that the real-data path is now built end to end: provider adapters,
the catalogue filter, the run orchestrator, the run log, a CLI and a scheduled
endpoint. Supplying credentials is the only remaining step.

| Provider               | Kind               | Status                                                      |
| ---------------------- | ------------------ | ----------------------------------------------------------- |
| Flipkart Affiliate API | catalogue          | Adapter written. Needs an approved affiliate account.       |
| Admitad                | catalogue          | Adapter written. Needs an account and per-advertiser feeds. |
| Cuelinks               | **deeplinks only** | Adapter written. Publishes no product catalogue.            |
| Seed                   | development        | Working, unchanged, and never used in production.           |

Check what is configured at any time:

```bash
npm run ingest -- --status
```

Everything downstream — normalization, matching, deal scoring, ranking, search —
is production code operating on whatever the source supplies.

See [Real providers](#real-providers) and
[What is needed from you](#what-is-needed-from-you).

## The pipeline

```
MerchantProvider.getProducts()      raw, merchant-shaped
        │
        ▼
normalizeProduct()                  validate → map → derive
        │                           (services/normalization)
        ├── reject with reasons ────► counted, logged, never silently dropped
        ▼
buildMatchKey()                     deterministic identity
        │
        ▼
persistProduct()                    upsert canonical product
        │                           upsert variants
        │                           upsert merchant listing
        ▼                           record price observation
    PostgreSQL
```

Run by `services/ingestion/pipeline.ts`. Failures are per-product: one malformed
listing in a feed of ten thousand must not abort the run, but it must also never
disappear quietly, so every rejection is counted and sampled into the run
summary.

## MerchantProvider

```ts
interface MerchantProvider {
  readonly id: string
  descriptor(): MerchantDescriptor
  getProducts(options?): Promise<ProductPage>
  getProduct(externalId): Promise<RawMerchantProduct | null>
  getPrices(externalIds): Promise<RawPrice[]>
  getAvailability(externalIds): Promise<RawAvailability[]>
  getAffiliateUrl(product, context): Promise<string | null>
}
```

Providers return **raw** data. They do not normalise, do not decide identity, and
do not touch the database. Keeping them dumb is what makes adding a merchant a
small, testable change.

Prices and availability are separate methods from `getProducts` because they are
re-polled far more often than the catalogue is re-crawled.

### The seed provider

`services/ingestion/providers/seed-provider.ts` is a full implementation, not a
stub. It paginates, and it deliberately emits _messy_ data — different category
vocabularies per merchant ("Apparel" / "Women > Clothing" / "Ready to Wear"),
string prices with currency symbols from one merchant and numbers from another,
inconsistent attribute key casing (`Colour` vs `color`), and marketing noise in
titles.

That matters: a seed provider that emitted clean data would leave the
normalization layer untested, and the first real feed would be the first time it
ran for real.

Not every merchant stocks every product (a deterministic ~72% per merchant), so
offer comparison is meaningful rather than every product having three identical
offers.

## Normalization

`services/normalization/` maps merchant vocabulary onto the controlled
vocabulary in `config/taxonomy.ts`. Entirely deterministic — a lookup table plus
whole-word matching. No model is consulted.

An unrecognised term returns `null` and records a warning. **A product with an
unknown colour is far better than a product confidently tagged the wrong
colour.**

What is normalised: category, subcategory, gender, colour, material, fit, style,
size, availability, price, currency, images.

Hard rejections — the product does not enter the catalogue:

| Rejection                             | Why                                                           |
| ------------------------------------- | ------------------------------------------------------------- |
| Missing/unparseable price             | A fabricated price is the worst possible error                |
| Missing brand                         | Brand anchors identity; guessing it merges unrelated products |
| Category cannot be mapped             | An unclassifiable product cannot be ranked or filtered        |
| `productUrl` is not absolute http(s)  | `javascript:` in an href is stored XSS                        |
| Title too short to establish identity | Better no product than a wrong merge                          |

Warnings — the product enters, the field does not:

- An "original price" at or below the current price (not a discount, bad data).
- An original price more than 20× the current price (usually a major/minor
  units mix-up).
- Image URLs with unsafe schemes.
- Unrecognised colour, material, fit or subcategory.

Unrecognised availability maps to `out_of_stock`, not `in_stock`. Showing
someone something they cannot buy is worse than hiding something they could.

### Prices

`services/normalization/price.ts` handles `"1,299.00"`, `"1.299,00"`,
`"1299,00"`, `"$45.99"`, `"USD 30"` and plain numbers, and **refuses ambiguity**
rather than guessing. It rejects negatives, non-finite values, and anything above
a plausibility ceiling.

Nothing here is ever produced by a language model. See
[AI usage](#ai-usage).

## Product matching

Identity is decided by `buildMatchKey()`, stored on `products.match_key` with a
unique constraint. Three strategies, in descending order of trust:

| Strategy                                         | Key                     | Confidence |
| ------------------------------------------------ | ----------------------- | ---------- |
| Valid GTIN/EAN/UPC (mod-10 check digit verified) | `gtin:<digits>`         | High       |
| Brand + manufacturer part number (≥4 chars)      | `mpn:<brand>:<mpn>`     | High       |
| Brand + canonicalised title                      | `title:<brand>:<title>` | Medium     |

The strategy name is part of the key, so a product identified by GTIN can never
collide with one identified by title.

Title canonicalisation strips marketing noise, colour and size tokens, and the
brand name, then normalises common spelling variants, so that:

```
"NEW! Aera Boxy Cotton Tee - Olive - M"   ┐
                                           ├─► title:aera:boxy-cotton-tshirt
"Aera Boxy Cotton T-Shirt (Olive)"        ┘
```

There is **no fuzzy matching**, no similarity threshold, and no embedding
comparison. Every rule is an exact match on a deterministic key.

> **Incorrect matching is worse than incomplete matching.** A user shown "3
> merchants" for products that are not actually the same is being actively
> misinformed about price.

This is not theoretical. During development `findMpn` accepted a bare `style`
attribute key; feeds commonly send `style: "minimal"`, so every minimal-styled
product from a brand collapsed into one canonical product — 36 products where
there should have been 46. Caught by asserting that no canonical product can
have more listings than there are merchants. That assertion is now a permanent
test, and `findMpn` accepts `styleCode`/`styleNumber` but never bare `style`.

## AI usage

AI may be used for extracting attributes from unstructured descriptions,
interpreting free text, and future natural-language search.

AI is **never** the source of truth for:

- prices, discounts, historical prices
- availability
- product identity or merchant identity
- any financial calculation

No part of the current pipeline calls a model. If that changes, output must be
validated against `config/taxonomy.ts` before persistence, exactly as merchant
data is.

## Real providers

### The two seams

Phase 1 modelled one source as one merchant (`MerchantProvider`). That is the
right shape for a direct merchant API and the wrong shape for an affiliate
network, where one credential fronts hundreds of advertisers. There are now two
interfaces in `lib/providers/types.ts`, split along what these services actually
are:

```
CatalogProvider    supplies products, each attributed to its own merchant
DeeplinkProvider   turns a destination URL into a tracked affiliate URL
```

A provider implements either or both. The distinction is not academic: **of the
three networks evaluated, Cuelinks publishes no product catalogue at all** — its
API covers campaign discovery, URL-to-tracked-link conversion, transactions and
reporting. Modelling it as a source of products would have meant building an
adapter for an endpoint that does not exist.

### The run

```
CatalogProvider.getProducts()      raw, provider-shaped
        │
        ▼
normalizeProduct()                 validate → map → derive
        ├── reject ───────────────► counted, sampled, never silently dropped
        ▼
evaluateFilters()                  catalogue policy (config/catalog-filters.ts)
        ├── filter ───────────────► counted separately from rejections
        ▼
buildMatchKey()                    deterministic identity
        ▼
persistProduct()                   upsert merchant, product, variants, listing
        ▼                          record ONE real price observation
    PostgreSQL + ingestion_runs
```

Run by `services/ingestion/catalog-run.ts`. The seed path
(`services/ingestion/pipeline.ts`) is unchanged and shares the normalizer, the
matcher and `services/ingestion/persist.ts`, so both write rows identically.

**Filtered is not rejected.** A rejected product is broken; a filtered one is
perfectly good and simply not what LivinUp stocks. The summary counts them
separately because they say completely different things about a feed.

### Failure policy

| Scope   | Failure                         | Behaviour                                             |
| ------- | ------------------------------- | ----------------------------------------------------- |
| Product | Malformed, unpriced, unmappable | Counted, sampled, skipped. The run continues.         |
| Product | Persistence error               | Counted as rejected. The run continues.               |
| Run     | Auth rejected                   | Run ends, marked `failed`. **Catalogue untouched.**   |
| Run     | Rate limited                    | Run ends; `retryAfterSeconds` recorded when supplied. |
| Run     | Timeout / 5xx / network         | Run ends, marked `failed`. **Catalogue untouched.**   |

Nothing is ever deleted, deactivated or marked stale because a provider had a
bad morning. A provider outage is not evidence about the products we already
have.

Errors are summarised **by class, not by message**. An unknown error's text is
deliberately not recorded: an HTTP client may helpfully embed the request URL,
and a feed URL can carry a token in its query string.

### Filtering configuration

`config/catalog-filters.ts`, expressed as data:

```
allowedCategories   excludedCategories
allowedBrands       excludedBrands       // case-insensitive; exclude wins
minPrice            maxPrice
allowedCurrencies   allowedGenders
requireImage        requireInStock
maxAcceptedPerRun                        // hard ceiling per run
```

Defaults: fashion categories only (`clothing`, `shoes`, `accessories`), a price
band of 15–2000, images and stock required, ceiling of 2,000 accepted listings
per run.

**The brand lists are intentionally empty.** Which premium brands are reachable
depends on the advertiser programmes each account is approved for, and that is
not yet known. An empty allowlist means "no brand restriction"; names go into
`allowedBrands` the moment the approved programmes are known. Per-provider
overrides live in `PROVIDER_CATALOG_FILTERS`.

### Price history

Real ingestion records **one observation per run, of the price actually
observed**, written `source = 'sync'`. Nothing manufactures history.

A provider that supplies only a current price therefore produces exactly one
observation per run, and the deal engine reports thin evidence honestly until
enough runs accumulate — `DealBadge` renders "Not enough price history" instead
of a band, and `MIN_OBSERVATIONS_FOR_AVERAGE` gates typical-price claims. That
is the correct outcome and must not be "fixed" by backfilling.

Observations are written only when the price **changed**, so history stays a
change log rather than a poll log.

Synthetic history stays `source = 'seed'` forever, and seed listings carry
`provider = 'seed'`. A given listing is one or the other, never a mix, so no
deal claim is ever computed from a blend of real and synthetic prices.

### Running an ingestion

```bash
npm run ingest -- --status                                   # what is configured
npm run ingest -- --provider=flipkart --limit=200 --dry-run
npm run ingest -- --provider=flipkart --limit=500
npm run ingest -- --provider=admitad
```

`--dry-run` fetches, normalises and filters but writes nothing — the way to see
what a provider would contribute before letting it near the catalogue.

Expected output:

```
Ingestion summary:
  status               completed
  fetched              1843
  accepted             612
  filtered             1208
  rejected             23
  inserted             589
  updated              23
  unchanged            0
  duplicates           0
  priceObservations    612
  warnings             141

Filtered out by rule:
  category_not_allowed     902
  below_min_price          214
  missing_image             92
```

Every run also writes a row to `ingestion_runs` carrying the same counters, so
"what did last night's run actually do" is a query rather than a log search.

### Scheduled execution

`GET /api/cron/ingest` runs every ready provider; `?provider=flipkart` runs one.
It requires `Authorization: Bearer $INGESTION_CRON_SECRET`, compared in constant
time, and returns 503 when no secret is set — **the endpoint is disabled rather
than left open**, because an unauthenticated ingestion trigger is a free way to
burn an affiliate rate limit. Work happens after the response is sent, so a slow
feed cannot become a platform request timeout mid-write.

No Vercel configuration is added by this work. To schedule it, add the cron to
`vercel.json` and set `INGESTION_CRON_SECRET` in the project environment:

```json
{ "crons": [{ "path": "/api/cron/ingest", "schedule": "0 3 * * *" }] }
```

**No user request ever calls a provider.** The frontend reads the database and
only the database.

### Adding another provider

1. Implement `CatalogProvider` (or `DeeplinkProvider`) in
   `services/ingestion/providers/`.
2. Read credentials via `serverEnv()` and report absence through `readiness()` —
   never throw for a missing credential; that is a normal state.
3. Register it in `services/ingestion/registry.ts`.
4. Add its variables to `config/env.server.ts` and `.env.example`.
5. Add the merchant's hostnames to `allowedHosts` — redirects fail closed.
6. Add a mapping test built from the provider's published documentation.

Nothing else changes. The pipeline, filter, matcher and persistence are shared.

## Adding a real merchant

1. Implement `MerchantProvider` in `services/ingestion/providers/`.
2. Add its hostnames to the merchant's `allowed_hosts` — outbound redirects are
   refused otherwise, and this fails closed.
3. Add its image hostnames to `images.remotePatterns` in `next.config.ts`.
4. Register it in the ingestion runner.
5. Add a normalization test with real sample rows from the feed.

Nothing else changes. The rest of the application does not know where a product
came from.

**Do not scrape.** Only use feeds and APIs the source's terms permit.

## What is needed from you

The code is ready. Every remaining blocker is an account or a permission, and
none of them is something LivinUp can obtain for itself.

### 1. Flipkart Affiliate API

- Apply for and get approval on a Flipkart affiliate account.
- Provide the **tracking ID** and **API token** from the affiliate dashboard.
- Choose which feed categories to ingest (ids come from the affiliate listing
  endpoint) and set `FLIPKART_FEED_CATEGORIES`.

Documented behaviour the adapter is written against: `Fk-Affiliate-Id` and
`Fk-Affiliate-Token` request headers; feed at
`/affiliate/1.0/feeds/<trackingId>/category/<category>.json`; pagination by
`nextUrl` at 500 products per page; envelope of
`{ nextUrl, validTill, productInfoList: [{ productBaseInfoV1 }] }`.

> **Verify before enabling.** Flipkart's public affiliate API changelog has not
> been revised since 2016. Both the programme's current availability to new
> publishers and the exact live envelope need confirming against a real account.
> The adapter parses defensively and skips anything it cannot read, but it has
> never run against a live response.

### 2. Admitad

- Get an approved Admitad publisher account.
- Join the specific advertiser programmes whose products LivinUp should carry.
- Provide the **feed URL** issued per advertiser and set `ADMITAD_FEEDS`.

Admitad distributes product data as per-advertiser feed **files** (CSV, XML, YML
or Google Merchant), with five mandatory columns (`category_name`, `offer_id`,
`url`, `price`, `currencyId`), refreshed roughly every six hours. Its REST API
covers campaigns, deeplinks and statistics; ingestion does not use it, so no
OAuth client is held and no additional credential is stored.

### 3. Cuelinks

- Generate an API key (Resource Centre → API Key).
- Confirm the link-conversion endpoint from your account's own API reference and
  set `CUELINKS_CONVERT_URL`.

Cuelinks supplies **no products**. It is useful only for monetising links to
merchants whose catalogue came from somewhere else.

### 4. Terms of use — needs explicit confirmation

These are assumptions the implementation rests on, and **none has been verified**
against a signed agreement:

- That each programme permits **storing and caching** product data in our own
  database rather than calling their API per page view.
- That each programme permits **retaining and displaying price history** derived
  from repeated observations.
- That the intended use — a personalised shopping-discovery feed that ranks and
  compares offers — is within the publisher terms.
- That displaying a merchant's **brand name and product imagery** is permitted.

Please confirm these per programme before the first production run.

Nothing here scrapes. Only documented feeds and APIs are used, and no anti-bot
measure, rate limit or `robots.txt` is bypassed.

Until then the seed catalogue is the development and demonstration dataset, and
every price in it is synthetic. Price history rows generated for it are written
with `source = 'seed'` so they remain distinguishable from real observations
forever, and can be deleted wholesale when real data arrives.
