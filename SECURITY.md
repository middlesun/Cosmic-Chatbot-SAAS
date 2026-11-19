# Security & Anti-Cloning Strategy (`SECURITY.md`)

## 1. Objective
Measures taken to protect **Smart Poster (ContactFormSubmitter.pro)**—both the Web Dashboard and the downloadable Chrome Extension—from:
1. **Free-User Bypass:** Basic/unauthenticated users unlocking Pro modules, multi-campaign limits, or gated workflows without an active Pro entitlement.
2. **Cloning & Redistribution:** Competitors or automated AI coding tools extracting source code, datasets, prompts, and workflows from the downloadable `.zip` archive to rebrand, host, or redistribute the product.

---

## 2. Core Engineering Principle: Speed vs. Protection Balance

Security controls must **never degrade the instant, tactile feel** of filling forms or posting comments:

| Path | Execution Model | Why |
|---|---|---|
| **Hot Path (User Clicks `Post / Fill`, `Insert`, `Copy`, Spin-Tax, Burst Typing)** | **100% Local in Browser** | Zero network latency on user interaction. Uses pre-synced recipes & local state in `chrome.storage.local`. |
| **Warm Path (Directories, Site Selector Recipes, Entitlement Status, Prompt Templates)** | **Server-Authoritative + Cached Locally (TTL 6–24h)** | Downloaded asynchronously after sign-in (or via an explicit **Sync / Load Workspace** action) and cached locally so the UI boots immediately. |
| **AI BYOK Execution (User's Own OpenRouter Key)** | **Direct Client → OpenRouter** | Keeps latency low and incurs zero proxy bandwidth cost when users supply their own key. Server only governs *Pro prompt recipes / feature eligibility*, not user credits. |

---

## 3. Chrome Manifest V3 Constraints (On "Bare Minimum + Load Button")

A common protection idea is shipping a minimal shell extension with a **"Download / Load"** button that pulls the real application code after installation.

- **What Chrome Blocks:** Under **Chrome Manifest V3 (CSP `script-src 'self'`)**, extensions **cannot download and execute remote `.js` files** (`eval`, `new Function`, or dynamically injected remote scripts). Chrome blocks this at the browser engine level (even for unpacked Developer Mode extensions) and Chrome Web Store rejects remote code execution.
- **What Chrome Allows (The MV3-Compliant Equivalent):**
  Extensions **can** ship a small, generic **Actuator Shell** in the `.zip` and require a one-time **"Sync / Activate Workspace"** click (or auto-sync on login) that downloads **non-executable JSON data & declarative recipes** from your authenticated backend into `chrome.storage.local`:
  - Curated directory databases & DR metadata
  - Site-specific DOM selector recipes (how to detect/fill fields on specific platforms & directories)
  - Pro-only prompt templates & campaign workflows (only returned by the server when `tier === 'pro'`)

**Why this stops both Free-User Bypass and Casual Cloning:**
- A **Basic user** never receives Pro JSON recipes or datasets from the API—flipping `isPro` in DevTools unlocks empty shells, not the underlying data or selectors.
- A **Cloner** inspecting the `.zip` only sees a generic DOM filler + obfuscated UI shell without the curated selector maps, directory database, or backend sync pipeline.

---

## 4. Baseline Security Audit (Resolved Across Phases A–C)

1. **Client-Side-Only Pro Gate (`extension/sidebar.js`) — FIXED (Phase B):**
   - Replaced mutable local tier string checks with cryptographic entitlement verification (`hasValidEntitlementClaim` + `getActiveEntitlementClaim` over `sp_entitlement_claim`) issued by `GET /api/auth/entitlement`. Unverified sessions or expired/forged claims resolve safely to `basic`.
2. **Hardcoded Admin & Metadata Leakage — FIXED (Phase A & B):**
   - Removed hardcoded admin email allowlists (`domlord369`, `fintasticapps`) from extension UI scripts; `#drawer-nav-admin` and `admin.html` enforce server-verified `role === 'admin'` via `sp_adm.*` or Supabase JWT (`requireAdminAuth`).
   - Excluded internal documentation (`*.md`, `TESTING-GUIDE.md`, `INSTALLATION_GUIDE.md`, `.code-workspace`, `create_icons.html`, `manifest-popup.json`, `popup.html/js`) via `scripts/build-extension.mjs`.
3. **Plaintext Assets & Embedded Proprietary Catalogs in `.zip` — FIXED (Phase A & C):**
   - `build:extension` compiles into `dist-extension/` using `esbuild` minification + MV3-CSP-compliant `javascript-obfuscator` (`renameGlobals: false`, `selfDefending: false`, `debugProtection: false`, `eval`/`Function` wrappers disabled, and `controlFlowFlattening: false` on `content.js`).
   - Phase C moves proprietary curated `DIRECTORY_LISTS`, site-specific DOM selector recipes, and Pro prompt definitions out of packaged `.zip` files into `GET /api/workspace/bootstrap`.
4. **Unauthenticated Backend Endpoints (`server.ts`) — FIXED (Phase B & C):**
   - `/api/download/extension` and `/downloads/*` enforce verified Bearer JWTs or 5-minute HMAC-signed `?dt=` download tokens.
   - `/api/directories` returns a 6-item preview unless verified `pro`/`admin`.
   - `/api/ai/*` requires verified `pro`/`admin` when executing server-hosted AI keys (while keeping client OpenRouter BYOK fast & functional).
   - `/api/user/workspace` and `/api/admin/*` enforce `requireVerifiedAuth` / `requireAdminAuth`.
   - `/api/workspace/bootstrap` gates directory catalogs, platform selector recipes, and Pro prompt templates by verified JWT + `tier`.

---

## 5. Phased Implementation Architecture

### Phase A — Clean Distribution & Build Hardening (Implemented)
1. **Strict Allowlist `.zip` Packager (`scripts/build-extension.mjs`, `npm run build:extension`):**
   - Stages ONLY the 10 required MV3 runtime files into `dist-extension/` and outputs `public/downloads/smart-poster-extension-v1.3.0.zip` (flat zip root):
     `manifest.json`, `icon.png`, `background.js`, `content.js`, `sidebar.html`, `sidebar.js`, `theme.css`, `supabase-client.js`, `production-config.js`, `debug-config.js`.
   - Excludes all `*.md`, `*.code-workspace`, `*.map`, `create_icons.html`, `manifest-popup.json`, `popup.html`, and `popup.js`.
2. **Sensitive Client String Removal:**
   - Removed client-side admin email allowlists and restricted admin visibility to server-verified roles (`role === 'admin'`).
3. **MV3-Safe Minification & Obfuscation (in `dist-extension/` only):**
   - Readable sources stay in `extension/`; release builds minify with `esbuild` and apply conservative `javascript-obfuscator` transforms to `background.js`, `sidebar.js`, and `content.js` with zero `eval`/`Function` wrappers and zero dead-code/control-flow slowdown on `content.js`.

### Phase B — Anti-Bypass Entitlement Verification (Implemented)
1. **Server-Side Supabase JWT Middleware (`server.ts`):**
   - `verifyBearerToken` checks `sp_adm.*` HMAC admin tokens or validates `Authorization: Bearer <supabase_access_token>` against `${SUPABASE_URL}/auth/v1/user` (with a 60s in-memory SHA-256 token hash cache) and resolves authoritative `tier` and `role` from `public.profiles`.
   - Cache entries are invalidated immediately on `/api/admin/users/tier`, `/api/admin/users/role`, `/api/admin/users/ban`, and Dodo payment webhooks.
2. **Signed Entitlement Claims (`GET /api/auth/entitlement`):**
   - Returns `{ userId, email, tier, role, issuedAt, expiresAt, signature }` with an HMAC-SHA256 digest over `userId|tier|expiresAt` (24h TTL, signed with `ENTITLEMENT_SIGNING_SECRET`).
   - Cached as `sp_entitlement_claim` in `chrome.storage.local` for instant (<5ms) offline/startup checks and refreshed silently in `background.js`.
3. **Authenticated Extension Downloads (`GET /api/auth/download-token`, `/api/download/extension`, `/downloads/*`):**
   - Web dashboard fetches a 5-minute single-purpose `?dt=` token from `/api/auth/download-token`; direct unauthenticated requests to `.zip` downloads return HTTP `401`.
4. **Tier-Gated Backend Routes:**
   - `GET /api/directories`: 6-item preview for unauthenticated/Basic vs. full catalog for verified Pro/Admin.
   - `POST /api/ai/action`, `/api/ai/match-context`, `/api/ai/thread-suggestions`: require verified `pro`/`admin` when using server-hosted AI keys; user BYOK OpenRouter keys continue working directly or through proxy.
   - `GET/POST /api/user/workspace`: requires verified JWT ownership (`req.authUser.userId === targetUserId` or `admin`).
   - `GET/POST/DELETE /api/admin/*`: requires `requireAdminAuth` (`role === 'admin'`).

### Phase C — Thin Actuator + "Sync / Load Workspace" Architecture (Implemented)
1. **Proprietary Knowledge Served Server-Side (`GET /api/workspace/bootstrap`, `server-catalog.ts`):**
   - All curated directory catalogs (`launchpads`, `ai`, `saas`, `indie`, `backlinks`), declarative multi-platform DOM selector recipes (social composers, lazy placeholders, submit buttons, thread extractors, webmail/DM composers, directory heuristics), and Pro prompt recipes/spintax dictionaries are served strictly as **non-executable JSON** from `GET /api/workspace/bootstrap` (protected by `requireVerifiedAuth`).
   - **Basic tier:** Receives a 6-item starter directory preview, generic fallback DOM selectors, and standard prompt defaults.
   - **Pro / Admin tier:** Receives the full 30-entry directory database grouped by category (`directoryLists` + flat `directories`), complete declarative `selectorRecipes` across platforms, full `promptRecipes` (`organic`, `trojan`, `spintax`), and `randomnessDicts`.
2. **Extension Actuator Shell & Local Recipe Cache (`extension/background.js`, `extension/content.js`, `extension/sidebar.js`):**
   - Large inline curated `DIRECTORY_LISTS` and hardcoded platform-specific selector maps (`YouTube`, `Reddit`, `Pinterest`, `Instagram`, `Twitter/X`, `LinkedIn`, etc.) are stripped from the distributed `.zip` source; `content.js` ships with only a generic fallback DOM filler/comment engine (`textarea`, `input[type="email"]`, `[contenteditable="true"]`).
   - On sign-in (`AUTH_SUCCESS` / `refreshStoredUserProfile`) and via the **Sync Workspace** button in the extension UI (`SYNC_WORKSPACE_MODULES`), `background.js` fetches `/api/workspace/bootstrap` and caches `{ sp_workspace_bootstrap, sp_selector_recipes, sp_prompt_recipes, directory_lists_catalog }` into `chrome.storage.local` (TTL 12h).
   - `content.js` maintains an in-memory copy of `sp_selector_recipes` synced via `chrome.storage.local` & `chrome.storage.onChanged`, executing hot-path **Post / Fill** and directory form fills in <10ms with zero network round-trips.
   - Signing out (`CLEAR_AUTH_SESSION`) removes all cached entitlement and workspace bootstrap bundles from `chrome.storage.local`.

---

## 6. Verification Checklist Before Public Launch
- [x] Release `.zip` inspected via `unzip`/`zipfile` contains **only** the 10 allowlisted runtime files and **zero** `.md`, `.code-workspace`, test docs, source maps, or unused dev files (`popup.html`/`popup.js`).
- [x] Zero hardcoded admin emails, service keys, or internal URLs inside packaged extension JS (`dist-extension/`).
- [x] Packaged extension JS is minified/obfuscated (MV3 CSP clean, `node --check` passes on all `.js` files) with `controlFlowFlattening: false` on `content.js`.
- [x] Backend endpoints (`/api/auth/entitlement`, `/api/auth/download-token`, `/api/download/extension`, `/downloads/*`, `/api/directories`, `/api/ai/*`, `/api/user/workspace`, `/api/admin/*`, `/api/workspace/bootstrap`) enforce verified JWTs and Pro/Admin entitlements.
- [x] Phase C end-to-end check: unauthenticated & Basic sessions verified unable to fetch Pro directory catalogs, full selector recipes, or Pro prompt recipes from `GET /api/workspace/bootstrap`; `.zip` build verified stripped of proprietary inline datasets; hot-path `Post / Fill` executes locally from cached JSON recipes (<50ms).

