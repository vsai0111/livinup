-- ---------------------------------------------------------------------------
-- LivinUp 0007 — profiles, community, moderation, brands
-- ---------------------------------------------------------------------------
-- Additive only. Code written before this migration (which inserts profiles
-- with just id and display_name) keeps working, which matters because the
-- previous release may still be serving while this is applied.
--
-- Access model: as 0006. The application server is the only reader and writer;
-- no client-facing role is granted anything on these tables.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists username text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_media_id uuid references media (id) on delete set null;
alter table profiles add column if not exists account_type text not null default 'member';
alter table profiles add column if not exists role text not null default 'member';
alter table profiles add column if not exists status text not null default 'active';
alter table profiles add column if not exists explore_visible boolean not null default true;
alter table profiles add column if not exists age_confirmed_at timestamptz;
alter table profiles add column if not exists terms_accepted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z][a-z0-9._]{2,29}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length') then
    alter table profiles add constraint profiles_bio_length
      check (bio is null or length(bio) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_account_type_check') then
    alter table profiles add constraint profiles_account_type_check
      check (account_type in ('member', 'brand'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles add constraint profiles_role_check
      check (role in ('member', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_status_check') then
    alter table profiles add constraint profiles_status_check
      check (status in ('active', 'suspended', 'deleting'));
  end if;
end $$;

-- Usernames are stored lower-case; the index also refuses case-only variants.
create unique index if not exists profiles_username_key
  on profiles (lower(username)) where username is not null;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references profiles (id) on delete cascade,
  -- The outfit it was shared from, if any. A post is a snapshot and does not
  -- depend on the outfit still existing.
  outfit_id       uuid references outfits (id) on delete set null,
  caption         text not null default '' check (length(caption) <= 1000),
  occasions       text[] not null default '{}' check (cardinality(occasions) <= 10),
  status          text not null default 'published' check (status in ('published', 'removed')),
  removed_reason  text,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz
);

create index if not exists posts_author_time_idx on posts (author_id, created_at desc, id desc);
create index if not exists posts_published_time_idx on posts (created_at desc, id desc)
  where status = 'published';

-- Images are copies made at publish time, in the public-content bucket.
create table if not exists post_images (
  post_id   uuid not null references posts (id) on delete cascade,
  media_id  uuid not null unique references media (id) on delete cascade,
  position  smallint not null check (position between 1 and 4),
  alt_text  text not null default '' check (length(alt_text) <= 200),
  primary key (post_id, position)
);

-- "What I'm wearing": copied text, never a link back into the wardrobe.
create table if not exists post_items (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references posts (id) on delete cascade,
  position  smallint not null default 0,
  label     text not null check (length(label) between 1 and 60),
  color     text check (color is null or length(color) <= 20),
  brand     text check (brand is null or length(brand) <= 60)
);

create index if not exists post_items_post_idx on post_items (post_id, position);

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table if not exists brand_details (
  profile_id   uuid primary key references profiles (id) on delete cascade,
  website_url  text check (website_url is null or website_url ~ '^https?://'),
  verified_at  timestamptz,
  verified_by  uuid references profiles (id) on delete set null
);

create table if not exists post_brand_tags (
  post_id   uuid not null references posts (id) on delete cascade,
  brand_id  uuid not null references profiles (id) on delete cascade,
  primary key (post_id, brand_id)
);

create index if not exists post_brand_tags_brand_idx on post_brand_tags (brand_id);

-- ---------------------------------------------------------------------------
-- social graph and interactions
-- ---------------------------------------------------------------------------
create table if not exists follows (
  follower_id  uuid not null references profiles (id) on delete cascade,
  followee_id  uuid not null references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on follows (followee_id, created_at desc);

create table if not exists post_likes (
  user_id     uuid not null references profiles (id) on delete cascade,
  post_id     uuid not null references posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists post_likes_post_idx on post_likes (post_id);

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts (id) on delete cascade,
  author_id   uuid not null references profiles (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 500),
  status      text not null default 'visible' check (status in ('visible', 'removed')),
  created_at  timestamptz not null default now()
);

create index if not exists comments_post_time_idx on comments (post_id, created_at);
create index if not exists comments_author_time_idx on comments (author_id, created_at desc);

create table if not exists blocks (
  blocker_id  uuid not null references profiles (id) on delete cascade,
  blocked_id  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on blocks (blocked_id);

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles (id) on delete cascade,
  actor_id      uuid not null references profiles (id) on delete cascade,
  -- content_removed / report_resolved come from moderation; the actor is the
  -- admin, who is never named in the UI.
  type          text not null check (type in (
                  'follow', 'like', 'comment', 'content_removed', 'report_resolved')),
  post_id       uuid references posts (id) on delete cascade,
  comment_id    uuid references comments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

create index if not exists notifications_recipient_time_idx
  on notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- moderation
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  -- Kept if the reporter later deletes their account.
  reporter_id      uuid references profiles (id) on delete set null,
  target_type      text not null check (target_type in ('post', 'comment', 'profile')),
  target_id        uuid not null,
  reason           text not null check (reason in (
                     'intimate_image', 'child_safety', 'harassment', 'hate',
                     'violence', 'impersonation', 'spam', 'copyright', 'other')),
  details          text check (details is null or length(details) <= 1000),
  priority         text not null check (priority in ('urgent', 'normal')),
  status           text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now(),
  resolved_by      uuid references profiles (id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text check (resolution_note is null or length(resolution_note) <= 1000)
);

create index if not exists reports_queue_idx on reports (status, priority, created_at);
create index if not exists reports_reporter_time_idx on reports (reporter_id, created_at desc);

-- Append-only audit log.
create table if not exists moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references profiles (id) on delete set null,
  action       text not null check (action in (
                 'remove_post', 'remove_comment', 'suspend', 'unsuspend', 'dismiss_report',
                 'make_brand', 'verify_brand', 'unverify_brand', 'create_invite', 'disable_invite')),
  target_type  text not null,
  target_id    text not null,
  report_id    uuid references reports (id) on delete set null,
  reason       text not null check (length(trim(reason)) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index if not exists moderation_actions_time_idx on moderation_actions (created_at desc);

create table if not exists invite_codes (
  code         text primary key check (code ~ '^[A-Z0-9-]{6,32}$'),
  max_uses     integer not null default 1 check (max_uses > 0),
  uses         integer not null default 0 check (uses >= 0),
  expires_at   timestamptz,
  disabled_at  timestamptz,
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------
alter table posts enable row level security;
alter table post_images enable row level security;
alter table post_items enable row level security;
alter table brand_details enable row level security;
alter table post_brand_tags enable row level security;
alter table follows enable row level security;
alter table post_likes enable row level security;
alter table comments enable row level security;
alter table blocks enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table moderation_actions enable row level security;
alter table invite_codes enable row level security;

-- No policies: these are reachable only by the application server, which
-- applies blocks, suspensions and removals that a bare policy could not.
revoke all on posts, post_images, post_items, brand_details, post_brand_tags, follows,
  post_likes, comments, blocks, notifications, reports, moderation_actions, invite_codes
  from anon, authenticated;

-- The invite a member joined with, during the closed beta.
alter table profiles add column if not exists invite_code text
  references invite_codes (code) on delete set null;

-- ---------------------------------------------------------------------------
-- Tighten the tables kept from the first release
-- ---------------------------------------------------------------------------
-- 0004 let a signed-in user insert and update their own profile row through
-- the Data API. With `role` and `status` now on that row, that grant would let
-- anyone holding the public key promote themselves to admin or lift their own
-- suspension. The application never uses the Data API, so every client grant
-- on the kept tables is withdrawn.
revoke all on profiles, user_preferences, user_events, local_auth_users
  from anon, authenticated;
