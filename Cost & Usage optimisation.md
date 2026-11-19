# Cost & Usage Optimisation Log

**Objective:** Continuously audit, optimise, and document every architectural, infrastructure, AI, compute, bandwidth, and storage measure taken across **SmartPoster** (Express/Vite backend, Cloudflare Pages Functions, Web Dashboard, and Chrome Extension) to keep operating costs and third-party resource usage at an absolute minimum—enabling affordable tier pricing with sustainable unit economics.

---

## Summary of Cost Pillars

| Cost Pillar | Baseline Risk | Optimisation Strategy | Current Target Cost |
| :--- | :--- | :--- | :--- |
| **AI Inference (LLM Tokens)** | Unbounded server-side Gemini/OpenRouter token spend per user action | Pure **BYOK** (OpenRouter + personal Gemini API key) for all user-facing AI + zero-cost deterministic fallbacks | **$0 / user** on server |
| **Feed Polling & Discovery** | Server compute timeouts, datacenter IP rate-limits/blocks on Reddit/Google RSS | Offloaded RSS/HN/Google Alerts polling to **Chrome Extension browser IP** + auth-gated & cached server fallback | **Near $0** server compute |
| **Cloud Storage & Bandwidth** | Uncompressed multi-MB PNGs filling Supabase Storage & bloating JSONB rows | **Client-side WebP/JPEG canvas compression** (`<= ~320 KB`), **1.5 MB upload ceiling**, JSONB inline bloat stripping, and **tier quotas** | Bounded by tier (`15 MB` – `5 GB`) |
| **Database Payload Size (JSONB)** | Oversized `data:image/...` strings inside `public.brands.data` slowing sync & hitting row limits | Automatic `sanitizeBrandMediaPayloads` stripping inline images `> 250,000` chars (`~187 KB`) + remote object deletion on asset removal | Minimal row footprint |
| **BYOK Token Efficiency** | Overly verbose AI prompts wasting user tokens or hitting context limits | Structured, length-budgeted brand context builders & compact summaries for batch variation runs | Minimal token burn per call |

---

## Phase 1: Zero-Cost Infrastructure, Client RSS & Storage Quotas (Completed)

### 1. Pure BYOK AI Enforcement ($0 Server AI Cost)
- **Removed Server API Key Fallbacks for Regular Users:**
  - Audited all user-facing AI routes in `server.ts` and mirrored Cloudflare Workers handlers in `functions/api/ai/*` and `functions/api/research/suggest-opportunities.ts`:
    - `POST /api/ai/action`
    - `POST /api/ai/thread-suggestions`
    - `POST /api/ai/analyze-url` (`/api/ai/scan-url`)
    - `POST /api/ai/auto-generate-module`
    - `POST /api/ai/marketer-chat` (`/api/ai/assistant-chat`, `/api/ai-assistant/chat`)
    - `POST /api/ai/match-context`
    - `POST /api/research/suggest-opportunities`
  - Non-admin requests no longer fall back to `process.env.GEMINI_API_KEY` or `process.env.OPENROUTER_API_KEY`.
  - Server-side AI keys remain strictly isolated to authenticated admin testing (`POST /api/admin/prompts/test` guarded by `requireAdminAuth`).
- **Dual BYOK Provider Support:**
  - Supports user-supplied **OpenRouter API Key** (`openRouterKey`) and personal **Google Gemini API Key** (`geminiApiKey` via `callUserGeminiRest` / `callUserGeminiRestCf`).
  - Missing credentials return HTTP `401` with `{ success: false, needsApiKey: true }` so UI prompts users cleanly to configure their key in Settings.
- **Zero-Cost Deterministic Local Fallbacks:**
  - `/api/ai/auto-generate-module` falls back to `buildAutoGenerateFallback` (deterministic synthesis from brand copy) when no BYOK key is supplied.
  - `/api/ai/match-context` falls back to zero-cost keyword overlap scoring (`Keyword overlap alignment`) when no BYOK key is supplied.
  - `/api/research/suggest-opportunities` uses deterministic niche/category competitor & keyword extraction (`buildOpportunitySuggestionsFallback`) without requiring LLM spend.
  - `/api/config` explicitly reports `features: { aiAssistant: false, byokAi: true }`.

### 2. Client-Side Feed Polling (Chrome Extension Worker Offload)
- **Moved RSS / Alerts / Reddit / HN Fetching to User's Browser:**
  - Ported discovery logic into `extension/background.js` (`runBackgroundResearchStage`, `FETCH_RESEARCH_OPPORTUNITIES_STAGE`, `FETCH_RESEARCH_FEEDS`, `CANCEL_RESEARCH_FETCH`).
  - When the extension bridge is active, `public/js/dashboard.js` dispatches staged discovery requests (`alerts`, `reddit`, `hn`, `web_rss`) directly through `extension/background.js` on the user's residential/browser IP—eliminating server compute cycles and datacenter IP rate-limits.
- **Hardened & Cached Server Fallback:**
  - `POST /api/research/fetch-feeds` (in `server.ts` and `functions/api/research/fetch-feeds.ts`) requires `requireVerifiedAuth` (rejecting anonymous scraping with HTTP `401`).
  - Added an in-memory **10-minute TTL response cache** (`RESEARCH_FEED_CACHE_TTL_MS = 10 * 60 * 1000`, capped at 200 normalized keys) so repeated polls for identical parameters cost zero outbound requests.
- **Bounded HTML Scan Footprint:**
  - Website metadata/copy scanner (`readHtmlWithByteCap` in `server.ts`) streams at most **512 KB** (`maxBytes = 512 * 1024`) and cancels the body reader early rather than buffering huge HTML pages.

### 3. Client-Side Media Compression, Storage Quotas & Orphan Cleanup
- **Client-Side Canvas Compression (`public/js/dashboard.js` & `extension/sidebar.js`):**
  - Large raster uploads (JPG, PNG, WebP) are resized to max dimension **1280px** and compressed client-side to WebP/JPEG targeting **`<= 430,000` data-URL chars (~320 KB binary)** before network transfer.
  - Files `<= 30 KB`, SVGs, ICOs, and GIFs are left untouched to preserve vector sharpness or animation.
- **Server & Edge Upload Limits (`server-catalog.ts` & `functions/lib/workspace-auth.ts`):**
  - Enforces `MAX_SINGLE_MEDIA_BYTES = 1.5 MB` (`Math.floor(1.5 * 1024 * 1024)`) per upload.
  - Rejects oversized inline fallback strings above `MAX_INLINE_DATA_URL_CHARS = 250,000` (`~187 KB`) to prevent Supabase PostgreSQL JSONB row bloat.
  - `sanitizeBrandMediaPayloads` scrubs any oversized `data:image/...` strings before writing to `brands.data` or extension vaults.
- **Tiered Cloud Storage Quotas (`STORAGE_QUOTAS`):**
  - **Free / Basic:** `15 MB`
  - **Pro:** `250 MB`
  - **Studio / Growth:** `1 GB`
  - **Agency / Unlimited:** `5 GB`
  - Checked pre-upload against live Supabase Storage `brand-assets` bucket usage (`getUserStorageUsageBytes`); over-quota uploads return HTTP `413` with `{ quotaExceeded: true }` and usage breakdown.
- **Automatic Storage Reclamation:**
  - Deleting media from Gallery triggers `DELETE /api/user/media` (`deleteUserBrandMedia`) to remove the remote object from Supabase `brand-assets` immediately, freeing user quota and reducing S3/Supabase storage billing.

### 4. Sync & Payload Hygiene
- **Debounced Cloud Sync:** Extension and dashboard debounce saves (`3s` in background worker / scheduled save in dashboard) to minimize Supabase REST write volume.
- **Log Caps:** Audit logs in extension memory/sync (`traffic_builder_master_logs` capped at 5000 local, `200` master logs + `100` error logs synced) and bounded snippet lengths (`160`–`500` chars) prevent unbounded database growth.

---

## Phase 2: Brand Assets, Unified Gallery & Token-Budgeted AI Context (In Progress / Planned)

> *This section tracks cost & usage optimisations applied during Phase 2 implementation and will be updated upon completion.*

- **Zero Duplicate Media Uploads (Single Gallery Reference Pattern):**
  - Primary **Logo**, **Favicon**, and **OG Cover** displayed in **Brand Assets** (and **Directory**) reference existing objects already uploaded to the **Gallery** (`brand-assets` bucket) rather than duplicating upload workflows or storing separate copies per tab.
- **Compact Storage Meter Reuse:**
  - Uses lightweight `GET /api/user/media/usage` state already hydrated on login/upload/delete without polling storage APIs on every tab switch.
- **Token-Budgeted Enriched AI Context:**
  - As `buildFullBrandContextBlock` (Node & Cloudflare Workers), `buildDashboardFullBrandContext`, `summarizeBrandForVariation`, and `thread-suggestions` expand to include Brand Assets (pitches, features, benefits, founder story, competitor comparisons, proof/testimonials, links/videos, social handles, and AI tone rules), every section is **concisely formatted and character-capped** (e.g., top N items + slice limits) so BYOK users get rich product awareness without unnecessary prompt token inflation.
- **Backward-Compatible JSONB Normalization:**
  - Normalizing legacy campaign records in memory avoids unnecessary background database migrations or bulk write spikes across Supabase `public.brands`.

---

## Upcoming Phases Backlog (Future Cost Controls)

- **Phase 3 (Social Posts, Support & FAQs, Articles SEO):**
  - Keep batch variation & article generators token-budgeted; use extension client-side tab injection with zero server-side headless browser rendering.
  - Reuse structured Brand Assets / Knowledge Base excerpts selectively by module type instead of sending full KB dumps on short comment/social drafts.
- **Phase 4 (Subscription Billing, Quota Upgrades & Landing Refresh):**
  - Tie Dodo recurring webhook tier transitions directly to `STORAGE_QUOTAS` (`15 MB` / `250 MB` / `1 GB` / `5 GB`) without manual admin intervention.
  - Use static/cached pricing configuration and lightweight SVG/compressed assets on landing pages.

---

## Ongoing Review Checklist (For Every Release)
1. Are all non-admin AI routes strictly BYOK or zero-cost local deterministic?
2. Are all newly added media upload paths routed through client-side compression + `uploadUserBrandMedia` quota enforcement + `DELETE /api/user/media` cleanup?
3. Are newly added JSONB fields bounded in size and free of unstripped base64 images?
4. Are newly added external HTTP/RSS polls executed in `extension/background.js` first, with auth + caching on any server proxy?
5. Are AI system/user prompts character-budgeted to minimize BYOK token spend?
