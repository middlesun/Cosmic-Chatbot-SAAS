# Smart Poster — Supabase Database & Cloud Persistence Specification (`SUPABASE.md`)

> **Audit Status:** Partial / Incomplete — Core Auth, Profiles, Admin Catalogs, and Workspace Preferences are wired, **but full end-to-end cloud saving has critical schema and sync gaps** that must be resolved before relying on Supabase as the source of truth across Web Dashboard and Chrome Extension.

---

## 1. Executive Audit: Is Supabase Saving In Place?

### ✅ What IS Working / Wired Today
| Area | Table(s) | Where Implemented | Current Behavior |
|---|---|---|---|
| **Google OAuth & Auth Session** | `auth.users`, `public.profiles` | `public/login.html`, `public/auth/callback.html`, `server.ts`, `functions/lib/workspace-auth.ts` | Google OAuth redirects via Supabase Auth; `handle_new_user()` trigger auto-creates `public.profiles` row on signup; server verifies Bearer JWT against `/auth/v1/user` and resolves `tier` & `role`. |
| **Admin User Management & Payments** | `public.profiles` | `server.ts`, `functions/api/admin/users.ts`, `functions/api/webhooks/dodo.ts` | Admin panel lists users, toggles `basic`/`pro`, updates `role`, deletes profiles; Dodo webhook upgrades `tier = 'pro'`. |
| **Admin Catalogs & Prompt Studio** | `public.directories`, `public.extension_releases`, `public.changelog_entries`, `public.ai_prompt_templates` | `server-catalog.ts`, `functions/api/admin/prompts.ts`, `public/admin.html` | Reads/upserts/deletes via PostgREST when Supabase env vars are set; falls back to `.smartposter-catalog-store.json` / in-memory defaults offline. |
| **Web Workspace Preferences** | `public.user_workspace_prefs` | `public/js/dashboard.js` (`/api/user/workspace`), `server-catalog.ts` | Web Dashboard loads on init and auto-saves (600ms debounce) `bookmarked_directory_ids`, `custom_directories`, and `research_config`. |
| **Extension 3-Table Sync (Partial)** | `public.brands`, `public.completed_urls`, `public.user_settings` | `extension/supabase-client.js`, `extension/background.js` (`syncSupabaseData`) | Extension pulls on startup, pushes 3s after `chrome.storage.local` changes, and two-way syncs every 5 minutes via `chrome.alarms`. |

---

### ❌ Critical Gaps & Bugs Found (Not Yet Properly Saving)

1. **Missing Tables in `supabase/schema.sql` (`completed_urls`, `user_settings`)**
   - `extension/supabase-client.js` calls `/rest/v1/completed_urls` and `/rest/v1/user_settings`, **neither of which exists in `supabase/schema.sql`**. Every sync attempt for completed URLs and user settings returns HTTP `404` / PostgREST `PGRST205` on a database provisioned from `schema.sql`.
2. **Missing `role` Column on `public.profiles` in `supabase/schema.sql`**
   - `server.ts`, `functions/lib/workspace-auth.ts`, `public/js/dashboard.js`, `public/auth/callback.html`, and `extension/supabase-client.js` all query and update `profiles.role`, **but `supabase/schema.sql` does not define a `role` column**. Any `SELECT ... role` or `PATCH { role }` fails with PostgreSQL `42703` (`column profiles.role does not exist`).
3. **Cross-User Primary Key Collisions on `public.brands` and `public.completed_urls`**
   - `public.brands` defines `id TEXT PRIMARY KEY` globally instead of scoping by `user_id` (e.g., composite `(user_id, id)`). Because new users get default IDs like `brand-focus-gummies-sample`, User B upserting that ID collides with User A's row and triggers an RLS violation (`42501`).
   - `extension/supabase-client.js` `upsertCompletedUrls` uses `id: item.id || item.url || item.domain`. Two users marking the same directory URL (e.g. `https://www.producthunt.com/posts/new`) completed will collide on `id` and fail RLS.
4. **Web Dashboard (`/dashboard`) Does Not Save Campaigns, Settings, Suppression, or Completed URLs to Supabase**
   - In `public/js/dashboard.js`, `persistStateToBridgeAndLocal()` only saves to browser `localStorage`, forwards to the Chrome Extension bridge (`SAVE_EXTENSION_BRIDGE_STATE`), and calls `/api/user/workspace` (which **only** saves `bookmarked_directory_ids`, `custom_directories`, and `research_config`).
   - In **Web Mode** (without the extension installed), campaigns (`brandProfiles`), settings, AI model/key config, suppression lists, completed URLs, and logs are **never saved to Supabase**.
5. **`public.campaign_logs` Table Is Unused (Orphaned)**
   - `supabase/schema.sql` defines `public.campaign_logs`, **but zero files in `server.ts`, `public/js/dashboard.js`, or `extension/` read from or write to it**. All audit/error/submission logs remain local-only (`traffic_builder_master_logs`, `tb_error_logs`, `testResults`, `directorySubmissions`, `commenterHistory`).
6. **Extension Does Not Sync `user_workspace_prefs` (`researchConfig`, `directoryPrefs`)**
   - The Web Dashboard saves `research_config`, `bookmarked_directory_ids`, and `custom_directories` via `/api/user/workspace`, **but the Chrome Extension (`background.js` / `sidebar.js`) never syncs with `user_workspace_prefs`**. Research alerts/keywords edited inside the extension do not reach Supabase unless the dashboard tab is open.
7. **Timestamp & Storage-Key Mismatches in Extension Sync (`extension/background.js`)**
   - `syncSupabaseData` reads `brandProfiles`, while `sidebar.js` and `dashboard.js` treat `campaignProfiles` as primary (`campaignProfiles || brandProfiles`).
   - `syncSupabaseData` compares `localSettings.updatedAt` vs `remoteSettingsRes.updatedAt`, **but neither `background.js` nor `dashboard.js` writes `updatedAt` onto `settings` on save**, so `localTime` evaluates to `0` and remote settings silently overwrite unsaved local edits.
   - `sidebar.js` and `background.js` store many settings (`apiKey`, `aiModel`, `customModels`, `jevEnabled`, `jevModel`, `captchaApiKey`, `safetyDelay`, `randomnessLevel`, `randomnessSynonyms`, `randomnessDicts`, `companionWidgetEnabled`, `companionShortcutsEnabled`, `aiContextMatching`, `simulateKeystrokes`, `autoSuppress`, `suppressionList`, `ruleTwitterStripProtocol`, `activeBrandId`) in separate `chrome.storage.local` / `chrome.storage.sync` keys rather than inside the `settings` object pushed to `user_settings`.
8. **Base64 Media Blobs Inside `brands.data` JSONB**
   - `dashboard.js` and `sidebar.js` store uploaded Logos, Favicons, Directory Slides, Gallery images, and Comment image attachments as base64 Data URLs inside `brandProfiles`. Storing multi-MB base64 strings inside `public.brands.data` JSONB causes large PostgREST payloads, slow 5-minute syncs, and browser quota pressure.
9. **Cloudflare `functions/` Route Parity Gap**
   - `server.ts` implements `/api/user/workspace`, `/api/releases`, `/api/changelog`, `/api/admin/directories`, `/api/admin/releases`, `/api/admin/changelog`, and `/api/research/fetch-feeds`, whereas `worker.ts` / `functions/` only implements a subset.

---

## 2. Complete Inventory of All Items That Need to Be Saved

Every piece of state across the **Web Dashboard**, **Chrome Extension**, and **Admin Portal** is cataloged below, including its local keys, target Supabase table, sync owner, and save timing.

### A. User Account, Auth & Entitlements
| Item | Fields | Target Table | Sync / Save Timing |
|---|---|---|---|
| **User Profile & Plan Tier** | `id` (UUID from `auth.users`), `email`, `full_name`, `avatar_url`, `tier` (`'basic' \| 'pro'`), `role` (`'user' \| 'admin'`), `created_at`, `updated_at` | `public.profiles` | Auto-created on OAuth signup (`handle_new_user()` trigger); read on login, `/api/auth/entitlement`, and startup; updated by Admin or Dodo Payments webhook. |
| **Signed Entitlement Claim** | `{ userId, email, tier, role, issuedAt, expiresAt, signature }` | Derived on-the-fly by server from `public.profiles` (cached locally in `sp_entitlement_claim`, 24h TTL) | Refreshed on login, dashboard load, and extension startup. **Never trust client copy as authoritative.** |

### B. Campaigns / Brand Profiles (`brandProfiles` / `campaignProfiles`)
*Note: Each campaign object is currently stored locally under `campaignProfiles` & `brandProfiles`.*

| Item | Sub-Fields to Persist | Target Table | Sync / Save Timing |
|---|---|---|---|
| **Campaign Metadata** | `brandId`, `campaignId`, `brandName`, `campaignName`, `isDefault`, `createdAt`, `updatedAt` | `public.brands` | Immediate debounced push (350ms–3s) on create/rename/clone/delete/edit; two-way merge on startup & every 5 min. |
| **Brand Core Info (`brandInfo`)** | `name`, `url`, `tagline`, `description`, `twitter`, `instagram` | `public.brands.data` | Debounced save on edit. |
| **Directory Copy (`directory`)** | `productName`, `websiteUrl`, `demoUrl`, `category`, `pricingModel`, `startingPrice`, `taglines[]`, `pitches[]`, `summaries[]`, `descriptions[]` | `public.brands.data` | Debounced save on edit. |
| **Directory & Gallery Media** | `directory.logoUrl`, `directory.faviconUrl`, `directory.slides[]`, `gallery[]`, `social.comments[].images[]` | **Recommended:** Supabase Storage bucket (`brand-assets/{user_id}/{brand_id}/...`) storing object URLs inside `brands.data` (temporary fallback: small base64) | On file upload / delete; avoids bloating `brands.data` JSONB. |
| **Contact Form Profile (`contact`)** | `senderName`, `senderEmail`, `phone`, `company`, `website`, `subject`, `message` | `public.brands.data` | Debounced save on edit. |
| **Social Comments (`social.comments[]`)** | `{ id, text, enabled, isExpanded, images[] }` | `public.brands.data` | Immediate on Add/Save/Delete/Toggle/Clone; debounced on typing. |
| **Cold Emails (`emails[]`)** | `{ id, subject, body, enabled }` | `public.brands.data` | Immediate on Add/Delete; debounced on edit. |
| **Direct Messages (`dms[]`)** | `{ id, platform, message, enabled }` | `public.brands.data` | Immediate on Add/Delete; debounced on edit. |
| **Long-Form Articles (`articles[]`)** | `{ id, title, category, body, enabled }` | `public.brands.data` | Immediate on Add/Delete; debounced on edit. |
| **Opportunity Queue (`queue[]` / `opportunityQueue[]`)** | `{ id, url, title, platform, status ('queued' \| 'injected' \| 'posted'), addedAt }` | `public.brands.data` | Immediate on queue add / status change / clear posted. |
| **Campaign Posting Rules & Suppression** | `suppressionList[]`, `postingRules.twitterStripProtocol`, `savedKeywordStacks[]`, `keywords[]` | `public.brands.data` | Immediate on add/remove/toggle. |
| **Campaign Deletion Tombstones** | Deleted `brandId` or `deleted_at` timestamp | `public.brands.deleted_at` (soft delete) | **Important:** Without soft deletes (`deleted_at`), a two-way pull resurrects deleted campaigns from the server! |

### C. User Settings & AI Configuration (`user_settings`)
All global user preferences currently split across `settings`, `chrome.storage.sync`, `chrome.storage.local`, and `localStorage`:

| Item | Fields | Target Table | Sync / Save Timing |
|---|---|---|---|
| **Active Workspace Selection** | `activeBrandId` / `activeCampaignId`, `defaultHome` | `public.user_settings.settings` | Immediate on campaign switch. |
| **Form & Automation Controls** | `formActionMode` (`fill-only` / `fill-submit`), `slowMode`, `financialDetection`, `skipFileInputs`, `skipPasswordFields`, `safetyDelay`, `simulateKeystrokes`, `autoSuppress`, `ruleTwitterStripProtocol`, `antiBanWindowDays` | `public.user_settings.settings` | Immediate / 300ms debounced on toggle or change; stamped with `updatedAt`. |
| **Companion Widget & Shortcuts** | `companionWidgetEnabled` (`floatingWidgetEnabled`), `companionShortcutsEnabled`, `aiContextMatching` | `public.user_settings.settings` | Immediate on toggle. |
| **Spin-Tax & Randomness Engine** | `randomnessLevel` (1–3), `randomnessSynonyms` (bool), `randomnessDicts` (text) | `public.user_settings.settings` | Debounced 300ms on edit. |
| **AI Provider & Model Config** | `aiModel`, `customModels[]`, `autoThreadSuggestions`, `jevEnabled`, `jevModel`, *(optional user-encrypted/opt-in)* `apiKey` (OpenRouter BYOK), `captchaApiKey`, `apiTimeout` | `public.user_settings.settings` | Immediate on save; **security note:** consider keeping `apiKey` & `captchaApiKey` local-only or explicitly opt-in encrypted if user prefers not to store third-party keys in DB. |
| **Global Suppression List** | `suppressionList[]` (global domains/URLs blocked across all campaigns) | `public.user_settings.settings` (or dedicated JSONB column `suppression_list`) | Immediate on add/remove/clear. |
| **Legacy / Module Presets** | `customData`, `templates`, `directoryActionMode`, `commenterPresets`, `commenterSettings` | `public.user_settings.settings` | On change / backup import. |

### D. Workspace Preferences, Directories & Research (`user_workspace_prefs`)
| Item | Fields | Target Table | Sync / Save Timing |
|---|---|---|---|
| **Bookmarked Directories** | `bookmarked_directory_ids` (`string[]`) | `public.user_workspace_prefs` | Immediate / 600ms debounced on star toggle. |
| **User Custom Directories** | `custom_directories` (`[{ id, name, url, category, domain_rating, description, pricing_type, created_at }]`) | `public.user_workspace_prefs` | Immediate on add/edit/delete. |
| **Research & Alerts Config** | `research_config`: `frequency`, `quality`, `platforms`, `keywords[]`, `competitors[]`, `alertFeeds[]`, `discoveredThreads[]` (capped ~120 items), `alertsActive`, `lastPolledAt` | `public.user_workspace_prefs` | On config change & after 30-min periodic RSS poll (`researchPeriodicPoll`). |

### E. Completed URLs & Outreach Activity Logs (`completed_urls` & `campaign_logs`)
| Item | Fields | Target Table | Sync / Save Timing |
|---|---|---|---|
| **Completed / Submitted URLs** | `id` (scoped per user), `user_id`, `brand_id`, `brand_name`, `url`, `domain`, `category` (`comment \| directory \| contact \| email \| dm \| outreach`), `completed_at` | `public.completed_urls` | Immediate on mark-completed / auto-complete after fill; deleted on remove/clear-all (requires explicit `DELETE` call, not just upsert!). |
| **Master Audit Logs (`masterLogs`)** | `id`, `user_id`, `brand_id`, `module` (`contact \| directory \| commenter \| email \| dm`), `target_url`, `domain`, `campaign_name`, `content_snippet`, `status` (`success \| failed \| suppressed`), `status_code`, `error`, `details` (JSONB), `created_at` | `public.campaign_logs` | Immediate / batched push on every blast/post/fill; retained up to e.g. 5,000 entries locally, synced incrementally to Supabase. |
| **Error Logs (`tb_error_logs`)** | Error timestamp, module, url, message, stack/context | `public.campaign_logs` (`status = 'error'`) | On extension error capture. |

### F. Admin-Managed Global Catalogs (Shared Read, Admin Write)
| Item | Fields | Target Table | Sync / Save Timing |
|---|---|---|---|
| **Master Directory Database** | `id`, `name`, `url`, `category`, `domain_rating`, `description`, `pricing_type`, `is_active`, `created_at`, `updated_at` | `public.directories` | Managed in `/admin`; read by `/api/directories` and `/api/workspace/bootstrap` (6-item preview for Basic, full list for Pro). |
| **Extension Releases** | `id`, `version`, `title`, `summary`, `download_url`, `file_size`, `is_latest`, `released_at` | `public.extension_releases` | Managed in `/admin`; read by `/api/releases`. |
| **Product Changelog** | `id`, `version`, `title`, `category` (`feature \| improvement \| fix`), `description`, `published_at` | `public.changelog_entries` | Managed in `/admin`; read by `/api/changelog`. |
| **Dynamic AI Prompt Templates** | `id` (`organic \| trojan \| spintax`), `name`, `system_instruction`, `temperature`, `updated_at`, `updated_by` | `public.ai_prompt_templates` | Managed in `/admin` Prompt Studio; read by AI endpoints & Pro `/api/workspace/bootstrap`. |

---

## 3. Recommended Database Schema Fixes & Additions

Before running `supabase/schema.sql` (or migrating an existing Supabase project), the following SQL updates are required so every code path succeeds cleanly with RLS enabled:

### 3.1 Add `role` Column to `public.profiles`
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));
```

### 3.2 Fix `public.brands` Primary Key & Add Soft Delete
Change PK from `(id)` to `(user_id, id)` so default/sample IDs like `brand-focus-gummies-sample` never collide across users, and add `deleted_at` so deleted campaigns stay deleted across two-way sync:
```sql
-- For fresh installs: PRIMARY KEY (user_id, id)
-- For existing table migration:
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_pkey;
ALTER TABLE public.brands ADD PRIMARY KEY (user_id, id);
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_user_updated ON public.brands (user_id, updated_at DESC);
```
*(Client upsert must pass `?on_conflict=user_id,id` in the PostgREST URL when using `Prefer: resolution=merge-duplicates`.)*

### 3.3 Create Missing `public.completed_urls` Table
```sql
CREATE TABLE IF NOT EXISTS public.completed_urls (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id TEXT DEFAULT 'brand-default',
    brand_name TEXT DEFAULT 'Brand',
    url TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'outreach',
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

ALTER TABLE public.completed_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own completed urls" ON public.completed_urls;
CREATE POLICY "Users manage own completed urls"
ON public.completed_urls FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on completed_urls" ON public.completed_urls;
CREATE POLICY "Service role full access on completed_urls"
ON public.completed_urls FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_completed_urls_user ON public.completed_urls (user_id, completed_at DESC);
```

### 3.4 Create Missing `public.user_settings` Table
```sql
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings"
ON public.user_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_settings" ON public.user_settings;
CREATE POLICY "Service role full access on user_settings"
ON public.user_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### 3.5 Expand `public.campaign_logs` for Master Audit & Error Logs
```sql
ALTER TABLE public.campaign_logs
  ADD COLUMN IF NOT EXISTS client_log_id TEXT,
  ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'outreach',
  ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS campaign_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_snippet TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_logs_user_client_id
  ON public.campaign_logs (user_id, client_log_id)
  WHERE client_log_id IS NOT NULL;
```

---

## 4. Sync Architecture, Timings & Conflict Resolution

### Current Sync Triggers & Timings
| Trigger | Component | Action | Interval / Debounce |
|---|---|---|---|
| **Extension Startup** | `extension/background.js` | `refreshStoredUserProfile()` + `syncSupabaseData('pull')` + `bootstrapWorkspaceModules()` | Immediate on boot; workspace cache TTL = 6h (client) / 12h (server) |
| **Storage Mutation** | `extension/background.js` | `chrome.storage.onChanged` → `scheduleSupabasePush()` → `syncSupabaseData('push')` | **3,000 ms** debounce |
| **Periodic Background Sync** | `extension/background.js` | `chrome.alarms` (`supabasePeriodicSync`) → `syncSupabaseData('two-way')` | Every **5 minutes** |
| **Periodic Research Poll** | `extension/background.js` | `chrome.alarms` (`researchPeriodicPoll`) → `/api/research/fetch-feeds` | Every **30 minutes** |
| **Web Dashboard Edit** | `public/js/dashboard.js` | `persistStateToBridgeAndLocal()` → Extension bridge + `/api/user/workspace` | **350 ms** (content), **300 ms** (settings), **600 ms** (workspace prefs) |
| **Auth Token Cache** | `server.ts` | SHA-256 hash cache of verified Supabase JWTs | **60 seconds** (invalidated on admin tier/role/ban or Dodo webhook) |
| **Entitlement Claim** | `server.ts` (`/api/auth/entitlement`) | HMAC-SHA256 signed claim (`sp_entitlement_claim`) | **24 hours** TTL |
| **Download Token** | `server.ts` (`/api/auth/download-token`) | Short-lived HMAC `?dt=` token for extension `.zip` | **5 minutes** TTL |

### Conflict Resolution Rules (Required)
1. **Campaigns (`public.brands`)**: Last-write-wins using ISO `updated_at` / `updatedAt`. Every mutation in `sidebar.js`, `dashboard.js`, and `background.js` **must** stamp `brand.updatedAt = new Date().toISOString()`. Deletions must record `deleted_at` (or issue an authenticated `DELETE`) so pulled remote rows don't resurrect deleted campaigns.
2. **Settings (`public.user_settings`)**: Consolidate all global settings + `suppressionList` + `aiModel` + `activeBrandId` into one payload stamped with `settings.updatedAt = new Date().toISOString()` on every change.
3. **Completed URLs (`public.completed_urls`)**: Set-union on upsert (`(user_id, id)`), plus explicit `DELETE /rest/v1/completed_urls?user_id=eq.{uid}&id=eq.{id}` (or bulk delete on clear-all) so removed items stay removed across devices.
4. **Master Logs (`public.campaign_logs`)**: Append-only deduplicated by `(user_id, client_log_id)`.
5. **JWT Expiry Handling**: Both `extension/background.js` (`refreshSupabaseJwtToken`) and `public/js/dashboard.js` (`refreshDashboardSupabaseToken`) refresh expired access tokens via `/auth/v1/token?grant_type=refresh_token`. `extension/supabase-client.js` should also retry once on `401` using the refreshed token so background 5-minute syncs never silently stall after 1 hour.

---

## 5. Environment Variables, Auth & Security Checklist

### Required Environment Variables
| Variable | Scope | Purpose |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Server & `/api/config` | Project URL (`https://<ref>.supabase.co`), exposed safely to clients via `/api/config`. |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Server & `/api/config` | Public anon key used with user Bearer JWT under RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server ONLY** | Admin operations (`public.profiles` updates via `/api/admin/*` and Dodo webhook, admin catalog writes). Never expose to browser or extension. |
| `ENTITLEMENT_SIGNING_SECRET` | **Server ONLY** | HMAC-SHA256 signing key for entitlement claims, admin session tokens (`sp_adm.*`), and `.zip` download tokens. |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_PRODUCT_ID`, `DODO_PAYMENTS_MODE` | **Server ONLY** | `$9` Lifetime Pro checkout and webhook verification. |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | **Server ONLY** | Server-hosted AI actions for verified Pro/Admin users. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | **Server ONLY** | Fallback credentials for `/admin` login. |

### Supabase Dashboard Configuration Checklist
- **Authentication → Providers → Google**: Enabled, with Client ID & Secret configured.
- **Authentication → URL Configuration**: Add every active app origin callback URL to **Redirect URLs**, e.g.:
  - `http://localhost:3000/auth/callback.html`
  - `https://<your-production-domain>/auth/callback.html`
  - `https://<ai-studio-dev-or-pre-url>/auth/callback.html`
- **Row Level Security (RLS)**: Must remain enabled on all 10 tables:
  - User-owned (`auth.uid() = user_id` / `auth.uid() = id`): `profiles`, `brands`, `completed_urls`, `user_settings`, `user_workspace_prefs`, `campaign_logs`.
  - Public-read / Service-role-write: `directories`, `extension_releases`, `changelog_entries`, `ai_prompt_templates`.
- **Fallback Warning**: When `SUPABASE_URL` / `SUPABASE_ANON_KEY` are unset, catalog endpoints fall back to `.smartposter-catalog-store.json` (which is **ephemeral** in container/serverless runtimes).

---

## 6. Recommended Implementation Order (Before Launch)

1. **Update `supabase/schema.sql`** with `profiles.role`, composite PK `(user_id, id)` + `deleted_at` on `brands`, and the missing `completed_urls`, `user_settings`, and expanded `campaign_logs` definitions.
2. **Add Web Mode Cloud Sync Endpoints** in `server.ts` (and `public/js/dashboard.js`)—or reuse Supabase PostgREST directly from `dashboard.js`—so Web Dashboard edits to `brands`, `user_settings`, `completed_urls`, and `campaign_logs` persist even when the Chrome Extension is not installed.
3. **Fix `extension/supabase-client.js` & `extension/background.js`**:
   - Pass `?on_conflict=user_id,id` on `brands` and `completed_urls` upserts.
   - Support `DELETE` for deleted brands, completed URLs, and cleared logs.
   - Stamp `updatedAt` on every `brand` and `settings` mutation; unify `campaignProfiles` / `brandProfiles` keys and include all settings keys inside `user_settings`.
   - Sync `user_workspace_prefs` (`researchConfig`, `directoryPrefs`) from the extension too.
   - Add 401 token-refresh retry inside `SupabaseClient`.
4. **Add Supabase Storage Bucket (`brand-assets`)** for Logos, Favicons, Slides, Gallery, and Comment images so large base64 strings don't bloat `public.brands.data`.
