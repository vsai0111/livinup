-- ---------------------------------------------------------------------------
-- LivinUp 0005 — real-provider ingestion
-- ---------------------------------------------------------------------------
-- Phase 1 ran on a single synthetic source, so a listing's identity was
-- (merchant, merchant's own id). Real data arrives through affiliate networks,
-- where the same merchant can be reachable through more than one provider and
-- each provider issues its own identifiers. This migration adds the provider
-- dimension and a run log, and nothing else: the existing catalogue tables
-- already model merchants, canonical products, listings, variants, images and
-- price history correctly, so they are reused as they stand.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- merchant_products — where a listing came from
-- ---------------------------------------------------------------------------

-- Which adapter produced this listing: 'seed', 'flipkart', 'admitad', ...
-- Existing rows are all synthetic, so 'seed' is the correct backfill and the
-- correct default for the seed pipeline that still writes them.
alter table merchant_products
  add column if not exists provider text not null default 'seed';

-- The provider's own identifier for the offer, when it differs from the
-- merchant's product id (affiliate networks commonly issue both). Nullable:
-- a direct merchant API has only one id, and inventing a second would be noise.
alter table merchant_products
  add column if not exists external_listing_id text;

-- Hash of the normalised source record. Lets a re-run skip untouched listings
-- instead of rewriting every row and bumping updated_at across the catalogue.
alter table merchant_products
  add column if not exists content_hash text;

-- Identity is (merchant, provider, provider's product id). Without the provider
-- column, the same merchant ingested through two networks would collide on
-- whichever id space happened to overlap.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'merchant_products_external_unique'
  ) then
    alter table merchant_products drop constraint merchant_products_external_unique;
  end if;
end $$;

create unique index if not exists merchant_products_provider_external_unique
  on merchant_products (merchant_id, provider, external_product_id);

create index if not exists merchant_products_provider_idx
  on merchant_products (provider);

-- ---------------------------------------------------------------------------
-- ingestion_runs — one row per ingestion attempt
-- ---------------------------------------------------------------------------
-- A failed or partial run must be visible after the fact. The counters mirror
-- the pipeline's own summary so "what did last night's run actually do" is a
-- query rather than a log search.
create table if not exists ingestion_runs (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  status              text not null default 'running'
                        check (status in ('running', 'completed', 'failed')),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,

  -- Funnel counters, in pipeline order.
  fetched             integer not null default 0,
  filtered            integer not null default 0,
  rejected            integer not null default 0,
  inserted            integer not null default 0,
  updated             integer not null default 0,
  unchanged           integer not null default 0,
  duplicates          integer not null default 0,
  price_observations  integer not null default 0,

  -- Why a run stopped, and a capped sample of per-product problems. Sampled
  -- rather than complete: a feed with ten thousand malformed rows should not
  -- put ten thousand rows in here to say so.
  error               text,
  details             jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now()
);

create index if not exists ingestion_runs_provider_time_idx
  on ingestion_runs (provider, started_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Ingestion is server-side only and runs with the database owner or the
-- service role. No client role is granted anything here, so enabling RLS with
-- no policy means "deny to everyone else" — which is exactly right for a table
-- that records operational internals.
alter table ingestion_runs enable row level security;
