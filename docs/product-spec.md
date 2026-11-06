# LivinUp v1 Product Specification

|                 |                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Status**      | Proposed final draft, awaiting approval                                                                                          |
| **Version**     | 1.0-rc1, 31 October 2026                                                                                                         |
| **Authority**   | This is the single authoritative product specification. Where any other document in `docs/` disagrees with it, this one wins.    |
| **Companion**   | [v1-implementation-plan.md](v1-implementation-plan.md) holds the repository audit, the cleanup classification and the build plan |
| **Legal notes** | Sections 9 and 12 summarise public sources. They are items for an Indian lawyer to confirm, not legal advice or settled facts.   |

---

## 0. Decision log

### 0.1 Decided by the product owner

| #   | Decision                   | Outcome                                                                                                                                                                                                                                                                    |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | Outfit builder             | Outfits are built from the user's own clothing photos arranged on a board of zones. The drawn mannequin is retired. Outfit rules support Indian clothing and do not assume a top and a bottom (section 5.3). Outfits can be created, saved, reopened, edited and deleted.  |
| D6  | Minimum age                | 18+ is the product policy for v1. An Indian lawyer must verify the legal requirements and the implementation needed for a photo-sharing platform. The age rule alone is not evidence of legal compliance.                                                                  |
| D9  | Brand product listings     | Excluded from v1. Brand profiles and brand posts only. No catalogue, cart, checkout, payments, affiliate shopping, EMI or marketplace.                                                                                                                                     |
| D12 | Retiring shopping features | Two stages. Stage 1 removes the shopping features from the product and makes the obsolete workflows unusable. Stage 2 audits dependencies, backups and retention before any structure is permanently removed. Waiting periods are review points, not permission to delete. |
| D13 | Existing production users  | The owner knows of one test account. Real counts must be verified before anything destructive. Unexpected users or data stop the work until reviewed. **Verification found three accounts, see 0.3.**                                                                      |

### 0.2 Proposed defaults, pending approval

| #   | Question                        | Proposed default                                                                                                            |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P1  | Is a photo required per item?   | Optional. An item without a photo shows a plain colour tile with its type icon.                                             |
| P2  | Batch upload                    | Yes, up to 10 photos at a time.                                                                                             |
| P3  | Post visibility                 | Public. No followers-only posts and no private accounts in v1.                                                              |
| P4  | Privacy settings                | Blocked accounts, "Show my posts in Explore" on/off, and account deletion. The wardrobe is always private.                  |
| P5  | Signed-out access               | Shared post and profile links open read-only. Comments need sign-in.                                                        |
| P6  | Sign-in methods                 | Email and password, plus Google sign-in through Supabase Auth. No phone OTP.                                                |
| P7  | Notification channels           | In-app only.                                                                                                                |
| P8  | Brand account creation          | Admin-created, invite-only, verified badge.                                                                                 |
| P9  | Beta access                     | Invite codes during the closed beta, then open sign-up.                                                                     |
| P10 | Style preferences (old feature) | Remove the code. Keep the `user_preferences` table and its rows untouched.                                                  |
| P11 | Age confirmation                | A required "I am 18 or older" confirmation, stored with a timestamp. No date of birth stored. Subject to legal review (D6). |

### 0.3 Verified facts that affect these decisions

Checked on 31 October 2026, read-only.

**Production database** (the Supabase project in `.env.local`, region ap-south-1):

- **Three** auth accounts, all Gmail. Two have signed in; one was never confirmed. All three have profiles. **This does not match "one test account" and needs the owner's confirmation before any destructive step (D13).**
- Only migrations `0001`–`0004` are applied. `0005_ingestion.sql` is committed in the repository but has never been applied to production. The new `0006` and `0007` are not applied there either. No wardrobe tables exist.
- The catalogue is entirely synthetic: 46 products, 104 listings in USD, 3 fictional merchants, and 3,120 price observations, all `source = 'seed'`.
- User data:
  - 14 preference rows (6 and 8 for two accounts).
  - 1 product rejection.
  - 0 saved products, 0 likes, 0 affiliate clicks.
  - 389 events, of which 202 are anonymous funnel events.
- No storage buckets or objects exist.
- The app connects as the `postgres` role. That role bypasses row-level security and can delete rows in `auth.users`.

**Local database** (`.livinup/pgdata`): seven local accounts.

- Six were created by my automated browser checks. They hold the 22 wardrobe items and 3 outfits.
- The owner's local account has no wardrobe data.
- Nothing local needs preserving.

---

## 1. Goals and target users

### 1.1 What v1 must prove

Whether people will:

1. add their clothes to a digital wardrobe,
2. create and save outfits from them,
3. publish outfits or other fashion posts,
4. interact with other people's posts, and
5. come back and keep using the product.

The wardrobe must be worth using with an empty social feed. Everything else in v1 serves that test.

### 1.2 Non-goals

Revenue, AI features, shopping, price intelligence, and growth from fake or seeded engagement.

### 1.3 Target users (assumptions to validate)

| Segment  | Description                                                                                              | Role                                   |
| -------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Primary  | Adults in India, roughly 18–35, mostly urban, who wear both Indian and Western clothes, mostly on phones | Main users                             |
| Creators | People who already post outfits elsewhere                                                                | Recruited so the beta feed isn't empty |
| Brands   | Small and direct-to-consumer Indian fashion labels                                                       | 3–5 recruited for the beta             |

**Platform:** responsive web, designed mobile-first, English only. No native apps in v1.

---

## 2. Scope

### 2.1 In v1

| Area          | Included                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Accounts      | Sign-up, sign-in, password reset, Google sign-in (P6), username, settings, account deletion                                       |
| Profiles      | Display name, username, bio, avatar, public profile page with posts, follower and following lists                                 |
| Wardrobe      | Photo upload (single and batch), Indian and Western clothing types, edit, archive, delete. Private, with no way to make it public |
| Outfits       | Build from the board, name, occasion tags, notes, save, reopen, edit, delete                                                      |
| Posts         | Publish from an outfit or new photos: 1–4 images, caption, occasion tags, brand tags, optional "What I'm wearing" list            |
| Interactions  | Follow, like, comment (flat), delete own comment, post author removes comments on their post                                      |
| Discovery     | Following feed and Explore feed (newest first), occasion filter, find people and brands by name                                   |
| Sharing       | Public post and profile links with link previews; a share button                                                                  |
| Notifications | In-app: new follower, like, comment; unread badge                                                                                 |
| Safety        | Report, block, admin moderation queue, audit log, rate limits, legal pages, grievance contact                                     |
| Brands        | Admin-created verified brand accounts, brand profile with website link, brand posts, brands directory, brand tags on posts        |

### 2.2 Excluded from v1

Direct messages · AI of any kind (stylist, auto-tagging, background removal, generated images) · visual similarity search · product listings, catalogues, cart, checkout, payments · affiliate links and retailer APIs · price tracking, price history, price-drop alerts · human stylist marketplace · EMI and financing · email and push notifications · stories and video · @mentions and free hashtags · reposts · saved posts · private accounts · public wardrobes · ranked feeds · native apps · languages other than English.

None of these may exist as partly built features in the codebase. They are recorded in section 15 only.

---

## 3. Roles, permissions and privacy

### 3.1 Roles

- **Visitor:** not signed in.
- **Member:** a signed-in person.
- **Brand:** a member account with `account_type = brand`. It is created and verified by an admin, and shows a badge and website link.
- **Admin:** LivinUp staff, with moderation and brand management.
- **Suspended:** can sign in, read, and delete their account. Cannot post, comment, like or follow. Their content is hidden from everyone else.

### 3.2 Permission matrix

✓ allowed · ✗ refused · "own" = only the user's own records. Every rule is enforced on the server, regardless of what the UI shows.

| Action                                             | Visitor       | Member / Brand                 | Author / owner  | Admin                        |
| -------------------------------------------------- | ------------- | ------------------------------ | --------------- | ---------------------------- |
| View landing, legal pages, brands directory        | ✓             | ✓                              | –               | ✓                            |
| View a profile and its posts                       | ✓             | ✓ unless blocked               | ✓               | ✓                            |
| View a post                                        | ✓ no comments | ✓ unless blocked               | ✓               | ✓ including removed          |
| View wardrobe items, item photos, outfits          | ✗             | ✗                              | own             | ✗ (no admin screen for them) |
| Create, edit, archive, delete items and outfits    | ✗             | own                            | own             | ✗                            |
| Publish a post                                     | ✗             | ✓                              | –               | ✓                            |
| Edit caption, delete post                          | ✗             | ✗                              | ✓               | remove only                  |
| Like, comment                                      | ✗             | ✓ unless blocked by the author | ✓               | ✓                            |
| Delete a comment                                   | ✗             | own                            | any on own post | ✓                            |
| Follow, block, report                              | ✗             | ✓ (not self)                   | –               | ✓                            |
| Create and verify brands, resolve reports, suspend | ✗             | ✗                              | ✗               | ✓                            |

### 3.3 Privacy rules

1. **Wardrobe items, item photos and outfits are visible only to their owner.** This is enforced in the database queries and in storage access, not only in the UI.
2. **Nothing becomes public without an explicit publish step.** That step shows a preview of exactly what will be public.
3. **A post is a snapshot.** Its images are separate copies made at publish time, and the "What I'm wearing" list is copied text. Later changes to the wardrobe never change a post.
4. **Publishing an outfit never exposes other wardrobe items**, their photos, or the item notes.
5. **Blocking** hides each account's profile, posts and comments from the other. It stops follows, likes and comments in both directions and removes existing follows both ways. The blocked person is not notified.
6. Like counts are public. Who liked a post is visible only to its author, through notifications.
7. A member who turns off "Show my posts in Explore" still appears on their profile and in their followers' feeds.

---

## 4. Navigation and routes

**Sidebar (signed in):**

- Home, Wardrobe, Outfits, Create (+), Notifications (with badge), Brands, Profile.
- The footer holds Settings and Sign out. Admin appears only for admins.
- The existing collapsible sidebar and mobile drawer are kept.

| Route                                             | Who      | Purpose                                         |
| ------------------------------------------------- | -------- | ----------------------------------------------- |
| `/`                                               | All      | Landing page; signed-in users go to `/home`     |
| `/signup`, `/signin`, `/reset-password`           | Visitors | Account access                                  |
| `/u/[username]`                                   | All      | Profile (members and brands)                    |
| `/p/[postId]`                                     | All      | Post                                            |
| `/brands`                                         | All      | Brands directory                                |
| `/terms`, `/privacy`, `/guidelines`, `/grievance` | All      | Legal and grievance                             |
| `/onboarding`                                     | Members  | First-run setup                                 |
| `/home`                                           | Members  | Following and Explore feeds                     |
| `/wardrobe`, `/wardrobe/[itemId]`                 | Owner    | Wardrobe and item detail                        |
| `/outfits`, `/outfits/new`, `/outfits/[id]`       | Owner    | Saved outfits and the builder                   |
| `/create`                                         | Members  | Publish a post                                  |
| `/notifications`                                  | Members  | Notifications                                   |
| `/settings/*`                                     | Members  | Profile, account, privacy, delete account       |
| `/admin/*`                                        | Admins   | Reports, brands, invite codes                   |
| `/media/[id]/[size]`                              | Varies   | Image delivery with access checks (section 7.3) |

The retired routes (`/search`, `/saved`, `/preferences`, `/product/*`, `/go/*`, `/api/cron/ingest`, `/api/product-image/*`) are removed and their URLs redirect to `/home`.

---

## 5. Screens and behaviour

### 5.1 Public screens

| Screen                      | Requirements                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Landing** `/`             | Explains v1: build your wardrobe, make outfits, share and discover. It must not present AI styling, stylists or shopping as available. Calls to action: sign up, sign in.                                                                                                                                                                                     |
| **Sign up**                 | Email, password (minimum 8 characters), Google (P6), invite code (P9), required 18+ confirmation (P11), agreement to Terms and Privacy Policy with links. Uses the existing email-confirmation handling.                                                                                                                                                      |
| **Sign in**                 | Existing form, plus "Forgot password?". After sign-in, returns to the page that was requested.                                                                                                                                                                                                                                                                |
| **Reset password**          | Request by email, then set a new password from the emailed link. The confirmation message is the same whether or not the address exists.                                                                                                                                                                                                                      |
| **Profile** `/u/[username]` | Avatar, display name, @username, bio (up to 160 characters), brand badge and website, follower and following counts, posts grid (newest first). Signed-in viewers get Follow and a menu with Share, Report and Block. The owner gets Edit profile. It never shows the wardrobe or outfits. Blocked or suspended accounts show "This account isn't available". |
| **Post** `/p/[postId]`      | Image carousel (1–4, with alt text), author, caption, occasion tags, brand tags linking to brand profiles, optional "What I'm wearing" list, like and comment counts. Comments (signed in only), like, comment, share, report. The author can edit the caption or delete the post. Has link-preview metadata. A removed post shows "This post was removed".   |
| **Brands** `/brands`        | Verified brands: logo, name, short bio, filter by name.                                                                                                                                                                                                                                                                                                       |
| **Legal pages**             | Terms, Privacy Policy, Community Guidelines, and a Grievance page with the grievance officer's name and contact and a complaint form. Text drafted with a lawyer.                                                                                                                                                                                             |

### 5.2 Signed-in screens

| Screen                           | Requirements                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding**                   | Three steps. (1) Username and display name, required. Usernames are 3–30 characters from `a–z 0–9 . _`, start with a letter, are unique regardless of case, and reserved words are refused. (2) Add first pieces, skippable. (3) Follow suggestions from recruited creators and brands, skippable and hidden when there are none. Ends on `/wardrobe`.                      |
| **Home**                         | Following and Explore tabs, newest first, "Load more". Explore has an occasion filter. Cards show the first image, author, caption excerpt, counts and a like button. An empty Following tab explains following and points to Explore and to the wardrobe.                                                                                                                  |
| **Wardrobe**                     | Item grid with category tabs: All, Tops, Bottoms, Full outfits, Layers, Drapes, Footwear, Accessories, Archived. Colour filter and a text filter on name and brand. A permanent "Only you can see your wardrobe" note. Add pieces (batch) and Add without photo. An empty wardrobe gets a guided first add.                                                                 |
| **Add pieces** (dialog)          | Pick 1–10 photos, then go through them one at a time. Each can be rotated. Required: type and colour. Optional: second colour, material, brand (free text, with suggestions from verified brands), name (defaults to e.g. "Olive kurta"), notes. Save, skip or discard each. A failed upload keeps what was entered and offers retry.                                       |
| **Item detail** `/wardrobe/[id]` | Large photo, fields, and the outfits that use the item. Edit, replace photo, archive ("I don't own this any more"), unarchive, delete with confirmation, use in a new outfit.                                                                                                                                                                                               |
| **Outfits** `/outfits`           | Saved outfits as cards (collage of the item photos), filtered by occasion, and a New outfit button.                                                                                                                                                                                                                                                                         |
| **Outfit builder**               | The board (section 5.3) with zone slots filled by item photos, and a picker grid with a category rail. Name, occasion tags, notes. Save, delete, "Share as post". Reopening restores every item in its zone. Archived items stay in existing outfits but aren't offered for new ones.                                                                                       |
| **Create post** `/create`        | (1) **Images:** choose from the outfit's item photos and/or upload new photos; 1–4, ordered, optional alt text. (2) **Details:** caption (up to 1,000 characters), occasions, up to 5 brand tags, "What I'm wearing" toggle (off by default; shows type, colour and brand only, never notes). (3) **Preview** labelled "This is exactly what will be public", then Publish. |
| **Notifications**                | New follower, like (grouped per post), comment. Unread items are highlighted and marked read on view. The sidebar badge shows up to "9+". Nothing for your own actions or from blocked accounts.                                                                                                                                                                            |
| **Settings**                     | Edit profile; account (email, change password); privacy (blocked accounts, Explore toggle); delete account (type the username to confirm; effects explained first); legal links.                                                                                                                                                                                            |
| **Admin**                        | Reports queue by priority and status, with the reported content and its history. Actions: dismiss, remove content, suspend account, each with a required reason and recorded in the audit log. Brands: create by invite, verify, edit website. Invite codes: create and disable.                                                                                            |

### 5.3 Wardrobe vocabulary and outfit rules

Each clothing type declares which **zones** it occupies. Outfit rules follow from those zones, so nothing assumes an outfit is a top plus a bottom.

| Zone            | Limit | Types (new ones in bold)                                                                                        |
| --------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Top             | 1     | T-shirt, shirt, kurta, sweater, activewear top, **blouse / choli**                                              |
| Bottom          | 1     | Trousers, jeans, shorts, skirt, **salwar / churidar**, **palazzo**, **lehenga skirt**                           |
| Top + Bottom    | –     | Dress, **jumpsuit**, **anarkali**, **salwar suit set**, **lehenga set**                                         |
| Bottom (draped) | –     | Saree occupies the bottom zone and leaves the top zone free for a blouse                                        |
| Layer           | 2     | Jacket, coat, **Nehru jacket**, **sherwani**, **shrug**                                                         |
| Drape           | 1     | **Dupatta**, **stole / shawl**                                                                                  |
| Footwear        | 1     | Sneakers, running shoes, boots, sandals, loafers, formal shoes, **juttis / mojaris**, **kolhapuris**, **heels** |
| Accessories     | 6     | Bag, belt, watch, sunglasses, scarf, jewellery                                                                  |

**Outfit rules:**

1. An outfit needs at least one item. No zone is required.
2. Adding an item replaces whatever already occupies its zones. A dress replaces both the top and the bottom, and adding a top replaces a dress.
3. A saree replaces only the bottom, so "saree + blouse + dupatta + juttis + jewellery" is a valid outfit.
4. The limits are enforced on the server as well as in the UI.

**Occasions:** everyday, work, college, party, date night, festive, wedding, travel, gym, lounge.

Colours and materials come from the existing taxonomy lists.

---

## 6. Key user flows

| #   | Flow                | Steps and branches                                                                                                                                                                                                                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Sign up and onboard | Sign up (invite code, 18+ confirmation) → confirm email → choose username → add pieces or skip → follow suggestions or skip → Wardrobe                                                                                                                                                                                   |
| F2  | Add pieces          | Choose photos → the browser resizes and re-encodes each → the server validates and stores each (section 7.3) → enter details for each → save                                                                                                                                                                             |
| F3  | Manage an item      | Edit, replace photo, archive, or delete. Deleting removes the item from outfits, deletes outfits left with no items, and leaves published posts unchanged.                                                                                                                                                               |
| F4  | Build an outfit     | New outfit → tap items into zones (section 5.3) → name and tag → save → reopen later with every item restored → edit → save, or delete                                                                                                                                                                                   |
| F5  | Publish             | Outfit → Share as post (or Create) → images → details → preview → Publish. Leaving before Publish saves nothing.                                                                                                                                                                                                         |
| F6  | Browse and interact | Home → Following or Explore → post → like or comment → author's profile → Follow                                                                                                                                                                                                                                         |
| F7  | Share externally    | Share → device share sheet, or copy link → recipient opens a read-only page with a sign-up prompt                                                                                                                                                                                                                        |
| F8  | Notifications       | Someone follows, likes or comments → the badge updates → Notifications → tap through                                                                                                                                                                                                                                     |
| F9  | Report              | Menu → Report → reason → confirmation to the reporter. The report enters the queue. "Intimate image shared without consent" and "child safety" are marked urgent and alert the grievance contact at once.                                                                                                                |
| F10 | Block               | Profile menu → Block → the rules in section 3.3 (5) apply at once. Unblock from Settings.                                                                                                                                                                                                                                |
| F11 | Brand onboarding    | Admin creates the account and sends the invite → brand sets a password → adds logo, bio and website → admin verifies → badge appears and the brand is listed in the directory                                                                                                                                            |
| F12 | Password reset      | Forgot password → email → new password → signed in                                                                                                                                                                                                                                                                       |
| F13 | Delete account      | Settings → read the effects → type username → the account is marked "deleting" and hidden → files deleted through the storage API → all rows deleted in one transaction, ending with the auth user → signed out. If file deletion fails it is retried by a cleanup job; the account stays hidden and unusable meanwhile. |
| F14 | Moderation          | Admin opens a report → reviews → remove, suspend or dismiss with a reason → the author is told their content was removed, and the reporter is told the report was handled                                                                                                                                                |

---

## 7. Backend architecture and data

### 7.1 Architecture kept as it is

- **One Next.js app:** Server Components for reads, Server Actions for mutations, route handlers where an HTTP endpoint is required.
- **Data:** the `Db` interface (Supabase Postgres in production, embedded PGlite locally and in tests) and the forward-only migration runner with checksums.
- **Access control:** every query scoped by `user_id` explicitly, plus row-level security as a second layer.
- **Auth and events:** both auth providers behind `AuthProvider`, with `requireUser()` as the authorisation boundary, and the `user_events` table as the analytics record.

### 7.2 Schema

**Existing tables kept:** `profiles`, `local_auth_users`, `user_preferences` (data kept, no code reads it in v1), `user_events`, `schema_migrations`.

**New and changed tables:**

| Table                                          | Key columns and rules                                                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles` (changed)                           | + `username` (unique on lower case), `bio`, `avatar_media_id`, `account_type` (member/brand), `role` (member/admin), `status` (active/suspended/deleting), `explore_visible`, `age_confirmed_at`, `terms_accepted_at` |
| `media`                                        | `id`, `owner_id`, `purpose` (wardrobe/post/avatar), `bucket`, `storage_key`, `width`, `height`, `bytes`, `sha256`, `created_at`                                                                                       |
| `media_deletions`                              | Queue of storage objects still to delete, with attempt counts. Used by account deletion, post deletion and orphan cleanup.                                                                                            |
| `wardrobe_items` (0007, revised before commit) | `name`, `item_type`, `color`, `secondary_color`, `material`, `brand_text`, `brand_profile_id`, `notes`, `media_id`, `archived_at`. Zones derive from `item_type`.                                                     |
| `outfits` (0007, revised before commit)        | `name`, `occasions` (text[] from the fixed list), `notes`                                                                                                                                                             |
| `outfit_items` (0007, revised before commit)   | (`outfit_id`, `item_id`) and `position`. Zone limits checked on the server.                                                                                                                                           |
| `posts`                                        | `author_id`, `outfit_id` (set null if the outfit is deleted), `caption`, `occasions`, `status` (published/removed), `created_at`, `edited_at`                                                                         |
| `post_images`                                  | `post_id`, `media_id` (a separate copy), `position` 1–4, `alt_text`                                                                                                                                                   |
| `post_items`                                   | Snapshot text rows: zone, type, colour, brand                                                                                                                                                                         |
| `post_brand_tags`                              | `post_id`, `brand_profile_id`, at most 5                                                                                                                                                                              |
| `follows`                                      | Primary key (`follower_id`, `followee_id`), no self-follow                                                                                                                                                            |
| `post_likes`                                   | Primary key (`user_id`, `post_id`)                                                                                                                                                                                    |
| `comments`                                     | `post_id`, `author_id`, `body` (up to 500 characters), `status`, `created_at`                                                                                                                                         |
| `notifications`                                | `recipient_id`, `actor_id`, `type`, `post_id`, `comment_id`, `created_at`, `read_at`; kept for 90 days                                                                                                                |
| `blocks`                                       | Primary key (`blocker_id`, `blocked_id`)                                                                                                                                                                              |
| `reports`                                      | `reporter_id`, `target_type`, `target_id`, `reason`, `details`, `priority`, `status`, `acknowledged_at`, `resolved_by`, `resolved_at`                                                                                 |
| `moderation_actions`                           | Append-only audit log of admin actions                                                                                                                                                                                |
| `brand_details`                                | `profile_id`, `website_url`, `verified_at`, `verified_by`                                                                                                                                                             |
| `invite_codes`                                 | `code`, `max_uses`, `uses`, `expires_at`, `disabled_at`                                                                                                                                                               |

**Rules for every new table:**

- RLS is enabled.
- Wardrobe tables have own-rows-only policies.
- Social and moderation tables grant **nothing** to the public `anon` and `authenticated` roles, so the public Supabase key cannot read them or get around blocks.
- Each migration also revokes the `TRUNCATE`, `TRIGGER` and `REFERENCES` privileges that Supabase grants those roles by default (verified on production in section 0.3).

### 7.3 Photo storage (resolves T1)

**Storage.** An `ImageStore` interface with two implementations: local disk in development and tests (`.livinup/media`), and Supabase Storage in production.

**Credential.** The production store uses a **server-only Supabase secret key**, read by one module guarded with `server-only` and never placed in a `NEXT_PUBLIC_*` variable. This needs approval, because ADR-0017 currently says no elevated key is read. The reasons for it:

- **SQL can't delete files.** Supabase now rejects direct SQL deletes on storage tables, so files can only be removed through the Storage API.
- **Background work has no user session.** Orphan cleanup, retrying deletions, moderation removals and account deletion all run without one.
- **The trust boundary doesn't change.** The server's database connection is already the `postgres` role, which bypasses RLS.

**Buckets.** Both are private. Wardrobe originals live under `wardrobe/<user_id>/…`. Post and avatar images are copies under `public-content/<user_id>/…`. Nothing in either bucket is publicly readable directly.

**Upload pipeline:**

1. **In the browser:** decode the photo (applying its rotation), resize the long edge to at most 2,048 px, re-encode as JPEG or WebP. This removes location and camera metadata.
2. **Upload:** through a route handler, limited to 4 MB per file, under Vercel's 4.5 MB request limit. Server Actions accept only 1 MB by default.
3. **On the server:**
   - Require a session.
   - Check the type from the file's bytes and accept only JPEG, PNG and WebP.
   - Check the dimensions.
   - Re-encode with `sharp`, which is already installed with Next.js, stripping all metadata.
   - Make 320 px and 1,080 px versions, store them, and write the `media` row.
   - Apply per-account rate limits (section 7.6).
4. **HEIC (iPhone) photos** work where the browser can decode them. Otherwise the user is asked for JPEG.

**Serving.** `/media/[id]/[size]` looks up the `media` row and checks access:

- Wardrobe images go only to their owner, with `Cache-Control: private`.
- Post and avatar images go to anyone allowed to see the post or profile. They are publicly cacheable for at most 1 hour, so a takedown takes effect inside the legal windows in section 9.
- Anything else gets 404.
- The Next.js image optimizer is not used for these images, and `images.remotePatterns: '**'` in `next.config.ts` is removed.

**Orphaned files.** A daily job deletes stored objects with no `media` row older than 24 hours, and `media` rows not referenced by any item, post or profile older than 24 hours. It retries everything in `media_deletions`.

### 7.4 Account deletion (resolves T2)

The app's existing database connection can delete `auth.users` rows, and `profiles` already cascades from `auth.users`. No new database credential is needed.

The order is:

1. Mark the profile `deleting`. This hides the account and blocks sign-in.
2. Queue every one of the account's storage objects in `media_deletions` and delete them through the Storage API.
3. Delete the database rows in one transaction, ending with the `auth.users` row, which cascades.
4. Anything the Storage API failed to delete is retried by the cleanup job.

For local auth, the transaction deletes the `local_auth_users` row.

Backups expire on the provider's normal schedule. The privacy policy must say how long that is.

### 7.5 Feeds, counts and notifications

- **Feeds:** cursor pagination on (`created_at`, `id`), 20 per page. No ranking.
- **Counts:** indexed aggregate queries. Stored counters only if measurements show they're needed.
- **Notifications:** one row per event, grouped when displayed, no fan-out.

### 7.6 Rate limits

Counted in Postgres, with no new service. Per account:

- 20 posts per day
- 60 comments per hour
- 200 follows per day
- 100 uploads per day
- 20 reports per day

### 7.7 Room for later features, without building them

- Full-size re-encoded originals are kept privately with stable ids and content hashes.
- Item attributes use the fixed vocabulary.
- No AI tables, columns or interfaces are added in v1.

### 7.8 Analytics events

`item_added`, `item_archived`, `item_deleted`, `outfit_saved`, `outfit_deleted`, `post_published`, `post_deleted`, `post_liked`, `comment_added`, `follow_added`, `profile_viewed`, `brand_profile_viewed` (with source), `share_clicked`, `report_submitted`, `notification_opened`.

They are recorded in `user_events`. Old event types remain in the table as history. PostHog stays switched off.

---

## 8. Data preservation and migration strategy

1. **Back up the production database before every production migration.** Supabase dashboard backup, plus a `pg_dump` of the `public` schema kept outside Supabase.
2. **Never rewrite a migration that has been applied to a shared database.**
   - `0001`–`0004` are applied in production.
   - `0005` is committed but not applied in production; it stays in history.
   - `0006` and `0007` were never committed and never applied in production, so they can be changed before their first commit. The plan drops `0006` (it only changes defaults on tables being retired) and rewrites `0007` to this schema. The local development database is rebuilt; it holds only automated-check data.
3. **Stage 1 (D12)** removes every route, action and service of the shopping product. The app stops reading and writing the catalogue tables. No data is deleted.
4. **Stage 2 (D12)**, only after Stage 1 has run cleanly and the owner gives explicit approval: one migration drops the retired tables and the obsolete columns from `0005`.
   - Retired tables: `products`, `product_variants`, `product_images`, `merchant_products`, `price_history`, `merchants`, `saved_products`, `product_likes`, `product_rejections`, `affiliate_clicks`, `ingestion_runs`.
   - Justification: production's catalogue is entirely synthetic seed data, and its user rows are one rejection and no saves or likes.
   - Before dropping: export everything to a dated SQL dump.
5. **Preserved with no change:** auth accounts, `profiles`, `local_auth_users`, `user_preferences` (14 rows), `user_events` (389 rows), and all new wardrobe and outfit data.
6. **Stop if anything is unexpected.** No destructive step runs while section 0.3's third account is unconfirmed, or if any count differs from what was verified.
7. **Rollback:**
   - Application changes roll back by redeploying the previous build.
   - Additive migrations are paired with a written down-script that is reviewed but not run automatically.
   - Stage 2 is undone by restoring from the dump.

---

## 9. Moderation and legal readiness

**Workflow:**

1. A report gets an acknowledgement time and a priority. Urgent covers intimate images without consent and child safety; everything else is normal.
2. Urgent reports alert the grievance contact immediately by email.
3. An admin can remove content in one action.
4. The removal stops `/media` from serving the image at once, and caches expire within 1 hour.
5. Every action is logged with who, when and why.

**Legal points to verify with an Indian lawyer before launch.** These come from public sources, not settled conclusions.

| Topic                       | What public sources report                                                                                                                                                                                                                                                                                                                   | Product impact                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| IT Rules, 2021 (as amended) | A February 2026 amendment, reported in force from 20 February 2026, shortened several deadlines: about 3 hours for certain lawful takedown orders, about 2 hours for non-consensual intimate imagery, and grievance resolution cut from 15 days to 7. Sources differ on the acknowledgement deadline. A grievance officer must be published. | A named grievance officer, a staffed moderation rota covering those windows, an urgent queue, and a takedown path within the cache limit  |
| IT Rules, AI content        | The same amendment adds duties for synthetically generated content                                                                                                                                                                                                                                                                           | No effect on v1. Must be planned before any AI feature                                                                                    |
| DPDP Act 2023 and Rules     | The Rules were notified on 13 November 2025. The main duties (notice, consent, children's data, erasure, rights) are reported to apply from 13 May 2027. Breach notification within 72 hours is reported. The Act treats under-18s as children and needs verifiable parental consent for them.                                               | Privacy notice and consent at sign-up, account deletion, a data-access request route before May 2027, 18+ policy (D6), a breach procedure |

Sources: [Lexology, IT Rules 2026](https://www.lexology.com/library/detail.aspx?g=0a8590c3-5e52-4130-a20f-b965bec9668e); [Times of India](https://timesofindia.indiatimes.com/india/3-hr-takedown-ai-labels-govt-cracks-down-on-deepfakes/articleshow/128176527.cms); [Policy Circle](https://www.policycircle.org/policy/it-rules-amendment-3-hour/); [Deloitte](https://www.deloitte.com/content/dam/assets-zone1/in/en/docs/services/tax/2026/in-tax-it-amendment-rules-2026.pdf); [DSCI FAQ](https://www.dsci.in/files/content/documents/2025/FAQs-on-Children-and-PwD-personal-data.pdf); [Thales brief](https://cpl.thalesgroup.com/sites/default/files/content/compliance_brief/india-dpdp-rules-2025-compliance-guide-cb.pdf); [EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025); [Supabase, deleting objects](https://supabase.com/docs/guides/storage/management/delete-objects). Content was rephrased for compliance with licensing restrictions.

---

## 10. Acceptance criteria

Each criterion becomes at least one automated test unless marked _(manual)_.

**Accounts (A)**

- A1. Password reset works and never reveals whether an address has an account.
- A2. Sign-up requires the 18+ confirmation and agreement to the terms, and records both with timestamps.
- A3. Usernames follow the section 5.2 rules, are unique regardless of case, and refuse reserved words.
- A4. Deleting an account removes its files, posts, comments, likes, follows, notifications, wardrobe and outfits. The account can't sign in again. A failed file deletion is retried and never leaves the account usable.

**Wardrobe (W)**

- W1. A member adds an item with photo, type and colour, and it appears under the right category.
- W2. Up to 10 photos can be added at once. Each needs a type and colour before it is saved.
- W3. Stored images contain no location or camera metadata.
- W4. A non-image file renamed `.jpg` is refused, and so is a file over 4 MB.
- W5. Another member, a visitor and an admin all get 404 for a wardrobe item, its `/media` URL, and its edit and delete actions. Checked by requesting each id directly.
- W6. Archived items leave the main grid, stay in existing outfits, and aren't offered in the builder.
- W7. Deleting an item removes it from outfits, deletes outfits left with no items, and leaves posts unchanged.
- W8. The wardrobe works fully with no follows, posts or notifications.

**Outfits (O)**

- O1. The zone rules in section 5.3 hold, including saree + blouse, dress replacing top and bottom, 2 layers, 1 drape and 6 accessories.
- O2. A saved outfit reopens with every item in its zone, and edits save correctly.
- O3. A save with zero items, another member's items, or broken zone limits is refused, including forged requests.

**Posts and privacy (S)**

- S1. The published post matches its preview exactly.
- S2. Nothing from the wardrobe is visible to anyone else without a completed publish.
- S3. Post images are copies. Deleting the source item or outfit leaves the post intact.
- S4. Deleting or removing a post stops its images being served at once, and cached copies expire within 1 hour.
- S5. Only the author can edit the caption or delete the post.

**Community (C)**

- C1. Following updates both accounts' counts and lists. You can't follow yourself or a blocked account.
- C2. Liking twice keeps one like. Unliking removes it.
- C3. Comments over 500 characters are refused, and links in comments aren't clickable.
- C4. A commenter can delete their own comment, and a post's author can delete any comment on it.
- C5. Visitors see counts but not comments.
- C6. The Following feed shows followed accounts and your own posts, newest first, with no duplicates across pages.
- C7. Explore respects blocks, removals, suspensions and the Explore toggle.
- C8. Feeds respond in under 1 second at the 95th percentile with 10,000 posts of test data.

**Notifications (N)**

- N1. A follow, like or comment creates exactly one notification for the right person and none for yourself.
- N2. Likes are grouped per post. The badge is correct, caps at "9+" and clears when the page is viewed.
- N3. No notifications are created between accounts that have blocked each other.

**Sharing (X)**

- X1. A post URL opens for a visitor without sign-in, with a link preview image and text.
- X2. The share button uses the device share sheet where available, and copies the link otherwise.

**Safety (M)**

- M1. Posts, comments and profiles can be reported, and each report appears in the queue.
- M2. Urgent reports are marked urgent and send an immediate alert.
- M3. An admin can remove content or suspend an account in under a minute _(manual timing)_, and each action is in the audit log.
- M4. Blocking applies all the rules in section 3.3 (5) at once.
- M5. Each rate limit refuses the excess with a clear message.
- M6. Every route, Server Action and media URL refuses another account's ids. One test per endpoint.
- M7. The new social tables can't be read with the public Supabase key.

**Brands (B)**

- B1. Only admins can create and verify brands. A verified brand shows a badge and website and appears in the directory.
- B2. Brand tags link to the brand profile, and brand profile visits are recorded with where they came from.

**Cleanup (R)**

- R1. No route, component, service, test, script, environment variable or document for the retired shopping product remains (verified by the audit in the implementation plan).
- R2. Retired URLs redirect to `/home`.

---

## 11. Testing strategy

| Layer                                       | What it covers                                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                                        | Zone rules, username rules, notification grouping, rate limits, validation, file-type detection                                                                                                          |
| Integration (real Postgres via PGlite)      | Every repository function; RLS and grants on every new table; feed pagination; blocks; account deletion; the media access check                                                                          |
| Storage                                     | Metadata stripping, type spoofing, size limits, private access, deletion and the retry queue (local `ImageStore` in CI)                                                                                  |
| End-to-end (Playwright, desktop and mobile) | Sign-up → add pieces → outfit → reopen and edit → publish. A second user follows, likes and comments; the first sees notifications. Report → admin removal. Block. Delete account. Signed-out post link. |
| Security                                    | The per-endpoint other-account check (M6); the public-key check (M7)                                                                                                                                     |
| Accessibility                               | Keyboard-only run of the main flows, image alt text, focus and contrast                                                                                                                                  |

**Rules:**

- CI keeps its current order: typecheck, lint, format check, unit and integration tests, build, then end-to-end.
- No failing test is deleted to get a green run. Tests that exist only for retired code are removed together with that code, and each removal is listed in the final report.

---

## 12. Deployment and launch requirements

**Technical**

- Every acceptance criterion passes and CI is green.
- No open critical or high-severity bugs.
- Sentry or an equivalent is connected.
- A production backup has been restored successfully as a test.
- Production migrations are applied in order, with a backup taken first.
- Storage buckets exist with the settings in section 7.3.
- `images.remotePatterns` is narrowed, and no secret is in a `NEXT_PUBLIC_*` variable.

**Legal and operational** (all to be confirmed with a lawyer)

- Terms, Privacy Policy, Community Guidelines and the grievance page are published.
- A grievance officer is named.
- A moderation rota covers the takedown windows in section 9.
- An incident and breach procedure is written down.

**Community**

- At least 20 recruited creators have posted real outfits, and at least 3 brand profiles are live before the beta opens. These numbers are to be agreed.
- No fake accounts or fake engagement.

**Beta**

- Closed beta with invite codes: 50–200 recruited users, including creators and 3–5 brands, for 4–6 weeks.
- Public launch is decided against section 13.

---

## 13. Success metrics (hypotheses)

**These are hypotheses to test, not benchmarks.** They should be revised once real data exists.

| Question                      | Metric                                                                  | Starting hypothesis |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------- |
| Do people add clothes?        | % of new users adding 5+ items within 7 days                            | 40%                 |
| Is the wardrobe useful alone? | % of users with 5+ items who return in week 2, whether or not they post | 30%                 |
| Do they create outfits?       | % of users with 5+ items saving an outfit within 14 days                | 50%                 |
| Do they publish?              | % of users with 5+ items publishing within 30 days                      | 15%                 |
| Do they interact?             | % of posts with a like or comment from someone else within 48 hours     | 50%                 |
| Do they return?               | Week-4 retention of users with 5+ items                                 | 20%                 |
| Are brands discovered?        | % of weekly active users visiting a brand profile, by source            | 10%                 |

All of these can be answered with SQL on `user_events`. What gets built after v1 is decided from these results, not from the roadmap.

---

## 14. Glossary

- **Zone:** the part of an outfit an item occupies (section 5.3).
- **Snapshot:** a post's own copy of images and text, independent of the wardrobe.
- **Stage 1 / Stage 2:** the two retirement steps in D12 and section 8.

## 15. Future roadmap

Not part of v1. Each item needs a revised, approved spec before work starts.

| Item                                        | Trigger to revisit                                                    |
| ------------------------------------------- | --------------------------------------------------------------------- |
| AI stylist (Google Gemini or another model) | Beta shows people want help choosing; AI-content rules reviewed first |
| Visual similarity search                    | Enough outfit images exist for useful matches                         |
| Brand product cards                         | Brands in the beta ask for them                                       |
| Shopping marketplace and catalogue          | Product discovery and demand are validated                            |
| Checkout, payments, EMI                     | A commerce phase is justified; regulatory review                      |
| Human stylist marketplace                   | Enough users and stylists                                             |
| Email digest, push notifications            | Retention data shows a need                                           |
| Private accounts, followers-only posts      | Users ask for them                                                    |
| Download my data                            | Before 13 May 2027 (DPDP)                                             |

Universal price tracking and price history are no longer on the roadmap.
