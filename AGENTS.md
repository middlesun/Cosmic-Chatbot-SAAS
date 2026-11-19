# AGENTS.md — Cosmic Council Project Constitution

> **Audience:** Every AI coding agent and engineer working on this repository. Read this file completely before planning or modifying any code. These design tokens, product values, architectural rules, and security boundaries are foundational and non-negotiable.

---

## 1. Product Identity & Core Values

- **Product Name:** Cosmic Council (`cosmiccouncil.chat`)
- **Mission:** Make authentic, multi-system Vedic Astrology (Parashari, KP, Jaimini, Nadi) effortless, calm, and deeply loved by **everyday, non-technical users** — especially on mobile.
- **Voice & Philosophy (Strict):**
  - Grounded, calm, empathetic strategic counsel ("Modern Observatory Journal" sensibility).
  - **Zero fear-mongering, zero superstition, zero expensive ritual upsells**, and no medical, legal, or guaranteed financial claims.
  - Pair authentic Jyotish terms (`Mahadasha`, `Gochar`, `Navamsa`, `KP Sub-Lord`) with quiet plain-English meaning whenever surfaced in user-facing UI so beginners never feel intimidated.
- **Mobile-First Imperative:**
  - Assume **>95% mobile usage**. Every view — especially Chat — must feel like a native mobile app (`100dvh` viewport lock inside Chat, zero horizontal scroll, generous tap targets, slide-over drawer navigation).
- **Strict Content Preservation:**
  - Never rewrite, invent, paraphrase, or remove existing marketing copy, labels, or product pricing unless explicitly instructed.

---

## 2. Locked Aesthetic Constitution ("Oura Warmth × Observatory Precision")

- **Light Canvas & Surfaces:**
  - App Background Canvas: `#FAF7F2` (Warm Ivory)
  - Secondary Surface / Sidebar: `#F1ECE3` (Muted Oat)
  - Elevated Cards / Inputs: `#FDFBF7` (Soft Parchment)
  - Frosted Glass Header / Drawer: `rgba(234, 227, 215, 0.75)` (`#EAE3D7`) with `backdrop-blur-md`
  - Hairline Borders: `rgba(61, 56, 48, 0.10)`–`0.15`
- **Ink Palette (Never use pure `#000000`):**
  - Display / Headings: `#3D3830` (Deep Umber)
  - Body Copy: `#5C5449` (Warm Earth)
  - Muted Labels / Metadata: `#8B8275` (Sandstone Taupe)
  - Primary CTA Fill: `#4A453D` (hover `#38342E`) with `#FAF7F2` text
  - Semantic Accents: Emerald Success `#2D6A4F`, Terracotta Warning `#7A3E36` / `#A94438`
- **Observatory Night Surface (Charts, Timing Radar, Dark Telemetry):**
  - Surface Gradient: `#1F2229` -> `#292D36`
  - Ink: `#F4EFE6`
  - Celestial Accent: `#B8965A` (Aged Brass)
- **Typography:**
  - Display / Headings: `'Cormorant Garamond', serif`
  - UI & Body: `'Plus Jakarta Sans', sans-serif`
  - Numbers, Credits, Dates, Ephemeris Degrees: `'JetBrains Mono', monospace` with `tabular-nums`
- **Bespoke Form & Scroll Controls (No Raw OS Clutter):**
  - Never use raw browser `<select>` elements — always use `components/app/CustomSelect.tsx`.
  - Never use raw OS `<input type="date">` — use a custom branded date/calendar component matching the linen/umber aesthetic with fast Year & Month navigation.
  - Scrollbars across the entire app must be subtle, thin, and styled in warm `#EAE3D7` / `#B8B0A4` tones (`index.html`).
  - Prefer quiet typography and subtle border cards (`rounded-2xl` / `rounded-3xl`) over noisy pills or badge clutter.

---

## 3. Architecture & Runtime Environment

- **Frontend:** React 19, TypeScript, Vite (`vite.config.ts`), React Router DOM (`App.tsx` + `components/app/AppRoutes.tsx`), Tailwind CSS, `lucide-react`, `react-markdown` + `remark-gfm`.
- **Backend / Deployment:**
  - Local / Node Dev: Express (`server.ts` + `server/app.ts`) on port `3000` with `vite.middlewares`.
  - Production Edge: Cloudflare Workers (`worker.ts` + `wrangler.jsonc` with `"keep_vars": true` to preserve dashboard secrets across Git deployments).
- **Database & Auth:** Supabase (`lib/supabaseClient.ts`, `server/lib/supabaseAdmin.ts`, `supabase/migrations/`). Atomic credit mutations run via Postgres `SELECT ... FOR UPDATE` RPCs (`deduct_user_credits`, `grant_user_credits`).
- **AI & Astrology Services (100% Server-Side):**
  - OpenRouter (`server/services/openrouter.ts`, `server/services/geminiOrchestrator.ts`) — model configurable via env defaults (`OPENROUTER_CONSULTATION_MODEL`, `OPENROUTER_UTILITY_MODEL`) and per-module Admin overrides.
  - Ephemeris (`server/services/astrologyApi.ts`, `jyotishMath.ts`, `chartCompiler.ts`) — FreeAstrologyAPI (`1 req/sec` rate-limited) + deterministic KP Placidus cusps/sub-lords, Jaimini Karakas, Ashtakavarga, Vimshottari Pratyantardasha, and global `daily_transits` table (max 1 fetch/day platform-wide).
- **Payments, Email & CMS:**
  - Dodo Payments (`server/routes/payments.ts`) — HMAC-SHA256 webhook verification, idempotent grants, INR/USD/AED/EUR currency support.
  - Resend (`server/services/email.ts`) — transactional emails.
  - Sanity CMS (`lib/sanity.ts`) — headless `/blog` articles only.

---

## 4. Critical Product & UX Rules

1. **Gmail-First Authentication & Seamless Preview:**
   - Primary CTA on landing (`components/NewLandingPage.tsx`) is `Login with Gmail` -> `/app/login`; header button is `Login`.
   - `AuthPage.tsx` spotlights `Continue with Gmail` above a collapsed `Use email & password instead` toggle and a clean footer `Preview without login` button.
   - Public Supabase URL + Anon Key must work even if Cloudflare Build variables weren't injected at Vite compile time (back up with public runtime config fallback); never leave `Continue with Gmail` silently dead.
   - In Design Preview mode, sending a message must prompt login (`"This is a preview, login to start chatting"`) rather than running unauthenticated consultations.
2. **Strict Separation of User Workspace vs. Hidden Admin:**
   - User-facing navigation (`AppLayout.tsx`) shows **Overview, Chat, Profiles, Reports, Credits** (`Chat Studio` is renamed to `Chat` everywhere).
   - **Never** display `Admin` links in menus and **never** show developer/backend status cards (e.g., `Platform Environment Readiness`) on the user Dashboard (`AppDashboardHome.tsx`).
   - `/app/admin` (`AdminPanel.tsx`) is direct-URL only and strictly gated by `users.is_admin = true` on client & `requireAdmin` middleware on server.
3. **Profiles ("You" Default + Short Name):**
   - Users can mark one profile as `is_default = true` (treated as `"You"` — the user's own chart) and give any profile a `short_name` for quick recognition across Overview toggles (`[ You | Name1 | Name2 ]`), Sidebar folders, and Chat headers.
4. **Chat Studio Contracts:**
   - Default expert display name is **Vedic astrologer** (slug `council_synthesis`).
   - Focus / Area of Life list starts with **General** (first & default), followed by `Life & Dharma`, `Career & Vocation`, etc.
   - **Context Integrity Lock:** Profile, Astrology Expert/System, and Area of Life are chosen for a consultation and **locked once the conversation starts** (switching person or life focus cleanly happens via a new thread). Only **Output Format** and **Language** may be changed mid-chat — tucked cleanly inside a collapsible control drawer/popover so the composer remains calm and distraction-free.
   - Composer primary button is **Send**, with **Voice** right beside it.
   - Top-right Chat **Settings modal** controls Font Size, Default Astrologer, Default Language, and Personal Name ("What should we call you?"), all persisted in Supabase `users`.
   - Sidebar hides numeric word counts (`w`) and uses bolder, subtly tinted folder headers.
   - Thread UX includes: Desktop `rounded-3xl` framing, mobile `100dvh` native shell, smart floating Scroll-to-Top / Scroll-to-Bottom, in-conversation keyword Search, and subtle micro-animations.
5. **Dynamic Admin Governance:**
   - Admin must manage all active **Experts**, **Modes**, **Tools** (`Question Generator`, `Prompt Expander`, `Prompt Optimizer`), and **Reports Catalog** (Name, Category, Rich-Text/Markdown Description, Credit Price, Multi-Pass Prompt Chain steps, Active status, and **OpenRouter Model override per item**) directly from `/app/admin`, updating live user dropdowns without code deploys.

---

## 5. Non-Negotiable Engineering, Egress & Security Standards

- **Near-Zero Supabase Egress & Bandwidth:**
  - Never use `select('*')` on heavy JSON/text tables (`profiles.chart_json`, `profiles.chart_text_context`, `report_orders.step_outputs_json`, `report_orders.final_markdown`) in list, sidebar, or polling routes.
  - Paginate `messages` fetches cleanly and use lightweight polling payloads for async report status checks.
  - Cache read-mostly config (`/api/chat/config`), `system_prompts`, `report_catalog`, and `daily_transits` in memory with short TTL + explicit cache invalidation on Admin writes.
- **Anti-Abuse & Duplicate Chart Protection:**
  - Read real client IP from Cloudflare `cf-connecting-ip` (with fallback to `x-forwarded-for`). Store hashed IP metadata on user/profile activity.
  - Compute a fuzzy birth-chart fingerprint `(birth_date, rounded geographic coordinates/city, birth_time bucketed within ±30–45 min)` to flag/prevent multi-account free-tier farming across the same IP without blocking legitimate paying (`pro` / `guru`) users or paid activations.
- **Prompt IP & Anti-Extraction Shield:**
  - `system_prompts` has zero RLS client read access and is never returned in full to non-admin endpoints.
  - Enforce multi-layer anti-extraction: Constitution rules + server-side pre-flight detection of prompt-leak probes + output sanity filter ensuring system prompt fragments never stream to clients.
- **Verification Discipline:**
  - Always run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) cleanly before wrapping any phase.
