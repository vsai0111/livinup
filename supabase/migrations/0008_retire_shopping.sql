-- ---------------------------------------------------------------------------
-- LivinUp 0008 — retire the shopping and price-tracking product (Stage 2)
-- ---------------------------------------------------------------------------
-- Drops the catalogue, price history, affiliate and shopping-engagement tables
-- that no v1 code reads or writes.
--
-- Justification (verified 31 October 2026, see docs/product-spec.md 0.3):
-- the production catalogue was entirely synthetic seed data (fictional
-- merchants, source = 'seed' price history), and the only user rows in these
-- tables were one product rejection by the owner's own test account.
--
-- Kept, with no change: profiles, local_auth_users, user_preferences and every
-- row of user_events. user_events only loses its foreign keys into the dropped
-- tables; its product_id / merchant_product_id values remain as history.
--
-- Run only after a backup, and only once no deployed code still reads these
-- tables. Reversible solely by restoring that backup.
-- ---------------------------------------------------------------------------

alter table user_events drop constraint if exists user_events_product_id_fkey;
alter table user_events drop constraint if exists user_events_merchant_product_id_fkey;

drop table if exists affiliate_clicks;
drop table if exists saved_products;
drop table if exists product_likes;
drop table if exists product_rejections;
drop table if exists price_history;
drop table if exists product_images;
drop table if exists product_variants;
drop table if exists merchant_products;
drop table if exists products;
drop table if exists merchants;
drop table if exists ingestion_runs;
