-- ---------------------------------------------------------------------------
-- LivinUp 0006 — media and the private wardrobe
-- ---------------------------------------------------------------------------
-- media              one row per stored image (its files live in an ImageStore)
-- media_deletions    files still to remove from storage; survives account deletion
-- wardrobe_items     clothes a user owns. Private to the owner, always.
-- outfits            a named look built from wardrobe items
-- outfit_items       which items make up each outfit
--
-- Access model: the application server reads and writes these tables. No
-- client-facing role (anon, authenticated) is granted anything, so the public
-- Supabase key cannot reach them through the Data API. RLS is enabled with
-- owner-only policies as a second layer. See docs/product-spec.md 3.3 and 7.2.
-- ---------------------------------------------------------------------------

create table if not exists media (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles (id) on delete cascade,
  purpose      text not null check (purpose in ('wardrobe', 'post', 'avatar')),
  -- 'wardrobe' is owner-only; 'public-content' holds published copies.
  bucket       text not null check (bucket in ('wardrobe', 'public-content')),
  -- Prefix for the stored variants: <storage_key>/{sm,md,lg}.webp
  storage_key  text not null unique,
  width        integer not null check (width > 0),
  height       integer not null check (height > 0),
  bytes        integer not null check (bytes > 0),
  sha256       text not null check (length(sha256) = 64),
  created_at   timestamptz not null default now()
);

create index if not exists media_owner_time_idx on media (owner_id, created_at desc);

create table if not exists media_deletions (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null,
  storage_key  text not null,
  attempts     integer not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  constraint media_deletions_object_key unique (bucket, storage_key)
);

create table if not exists wardrobe_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles (id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 80),
  -- A config/wardrobe.ts type id; its zones are derived from it.
  item_type         text not null check (length(item_type) between 1 and 40),
  color             text not null check (length(color) between 1 and 20),
  secondary_color   text check (secondary_color is null or length(secondary_color) between 1 and 20),
  material          text check (material is null or length(material) between 1 and 20),
  brand_text        text check (brand_text is null or length(trim(brand_text)) between 1 and 60),
  brand_profile_id  uuid references profiles (id) on delete set null,
  notes             text check (notes is null or length(notes) <= 500),
  media_id          uuid references media (id) on delete set null,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists wardrobe_items_user_time_idx
  on wardrobe_items (user_id, created_at desc);

create trigger wardrobe_items_set_updated_at
  before update on wardrobe_items
  for each row execute function public.livinup_set_updated_at();

create table if not exists outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  occasions   text[] not null default '{}' check (cardinality(occasions) <= 10),
  notes       text check (notes is null or length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists outfits_user_time_idx on outfits (user_id, created_at desc);

create trigger outfits_set_updated_at
  before update on outfits
  for each row execute function public.livinup_set_updated_at();

-- Deleting an item removes it from every outfit; deleting an outfit leaves
-- the items alone.
create table if not exists outfit_items (
  outfit_id  uuid not null references outfits (id) on delete cascade,
  item_id    uuid not null references wardrobe_items (id) on delete cascade,
  position   smallint not null default 0,
  primary key (outfit_id, item_id)
);

create index if not exists outfit_items_item_idx on outfit_items (item_id);

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------
alter table media enable row level security;
alter table media_deletions enable row level security;
alter table wardrobe_items enable row level security;
alter table outfits enable row level security;
alter table outfit_items enable row level security;

drop policy if exists media_own on media;
create policy media_own on media for all to authenticated
  using (owner_id = public.livinup_current_user_id())
  with check (owner_id = public.livinup_current_user_id());

drop policy if exists wardrobe_items_own on wardrobe_items;
create policy wardrobe_items_own on wardrobe_items for all to authenticated
  using (user_id = public.livinup_current_user_id())
  with check (user_id = public.livinup_current_user_id());

drop policy if exists outfits_own on outfits;
create policy outfits_own on outfits for all to authenticated
  using (user_id = public.livinup_current_user_id())
  with check (user_id = public.livinup_current_user_id());

-- A link is visible only through an outfit the user owns, and may only attach
-- an item the same user owns.
drop policy if exists outfit_items_own on outfit_items;
create policy outfit_items_own on outfit_items for all to authenticated
  using (exists (select 1 from outfits o
                  where o.id = outfit_id and o.user_id = public.livinup_current_user_id()))
  with check (
    exists (select 1 from outfits o
             where o.id = outfit_id and o.user_id = public.livinup_current_user_id())
    and exists (select 1 from wardrobe_items i
                 where i.id = item_id and i.user_id = public.livinup_current_user_id())
  );

-- media_deletions: RLS on, no policy — server only.

-- Supabase grants anon/authenticated TRUNCATE, TRIGGER, REFERENCES and
-- MAINTAIN on new tables by default. None of these tables is meant to be
-- reachable with the public key, so take everything back.
revoke all on media, media_deletions, wardrobe_items, outfits, outfit_items
  from anon, authenticated;
