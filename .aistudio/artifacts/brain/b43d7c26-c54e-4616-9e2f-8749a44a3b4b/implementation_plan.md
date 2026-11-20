# Cosmic Council — Admin Panel Overhaul, Workspace Scroll Fix & Natural Chat Experience

This blueprint fixes the broken page-level sidebar scrolling across all non-chat workspace views, eliminates repetitive `"Hello <Name>,"` openings so consultations feel like a genuine conversation, adds an admin-only shortcut in the workspace sidebar, and transforms `/app/admin` into a dedicated, independently scrollable **Admin panel** with 9 modular sections built to scale to hundreds of composable prompts, dynamic AI/pricing controls, live chatbot testing, and support ticket management.

> [!IMPORTANT]
> **Confirmed Decisions from Planning Alignment**
> - **Admin Shell Architecture:** Dedicated standalone Admin shell on `/app/admin/*` that replaces the main workspace sidebar with its own fixed Admin sidebar and a one-click **Back to Chat** return link.
> - **Prompt Library & Recipes:** Scalable library supporting hundreds of categorized prompts (`system`, `expert`, `analysis`, `modifier`, `mode`, `output`, `language`, `tool`, `report_step`) that stack as ordered **Composable Recipes** for Chatbot Modes and Deep Research Reports.
> - **Persistence & Security:** All dynamic Admin configurations (Chatbot controls, AI Settings with encrypted OpenRouter API key override + environment fallback, Pricing & Plans, Prompt Recipes, and Support Tickets) are stored in Supabase via one clean, idempotent SQL migration.
> - **Delivery Strategy:** Phased rollout across **4 shippable, self-contained milestones** so every phase compiles, deploys, and can be verified independently—or handed cleanly to any engineer or coding agent.

---

## 1. Overview & Core Concept

- **What It Delivers:**
  1. **Viewport-Locked Workspace Shell (All Pages):** Fixes the layout defect where scrolling Dashboard, Profiles, Reports, Billing, Settings, or Admin scrolled the entire browser document and pushed the left sidebar off-screen. Every workspace page now behaves like a native desktop app: left sidebar stays permanently anchored; only the right main pane scrolls.
  2. **Admin-Only Workspace Switcher:** When an authenticated account has `is_admin = true`, an **Admin** link appears in the main workspace navigation (desktop sidebar and mobile drawer). Non-admin members never see or access this link.
  3. **Natural Conversational Flow:** Removes the formal email-letter pattern (`"Hello Chris,"` on every reply) from prompt assembly so the astrologer speaks naturally across multi-turn conversations, while exposing conversational rules directly to the Admin for live tuning.
  4. **Dedicated 9-Section `Admin panel`:** Replaces the current flat tabbed console and verbose header (`"Administrator Observatory Console / Platform Governance & Prompt IP"`) with a clean **`Admin panel`** workspace featuring its own fixed sidebar covering:
     - **Admin dash**
     - **User management**
     - **Prompt Library**
     - **Chatbot**
     - **Reports manager**
     - **AI settings**
     - **Pricing & Plans**
     - **Support**
     - **Platform** *(anchored at the bottom of the Admin sidebar)*
- **Target Persona:** Platform owner / chief astrologer managing users, hundreds of modular Jyotish prompts, AI models/costs, multi-currency pricing, and customer support tickets without editing code or redeploying.
- **Key Value:** Turns Cosmic Council from a code-configured SaaS into a fully live-governed platform while immediately fixing everyday UX friction in both user scrolling and chatbot tone.

---

## 2. User Experience & Visual Design

### Key User & Admin Flows

1. **Workspace Scrolling & Admin Switching:**
   - Logged-in regular user navigates across Home (Chat), Profiles, Reports, Dashboard, and Credits → left sidebar stays permanently locked to the viewport height (`100dvh`), right content pane scrolls smoothly with warm hairline scrollbars, and zero Admin links appear.
   - Logged-in admin (`fintasticapps@gmail.com` or any promoted admin) sees a subtle **Admin** entry in the left sidebar → clicking it opens `/app/admin` in the dedicated Admin shell → clicking **Back to Chat** returns immediately to `/app/chat`.
2. **Natural Multi-Turn Chat Experience:**
   - Turn 1 may warmly acknowledge a user once only if natural (e.g., if they greet first), while direct astrology questions jump straight into clear answers without `"Hello <Name>,"` headers.
   - Turn 2+ continues the dialogue naturally like a live astrologer sitting across the table—referencing prior points seamlessly without restarting with formal salutations or repeating boilerplate titles.
3. **Admin Panel Navigation & Workflows:**
   - **Admin dash:** Instant executive view of Members, Charts, Consultations, Questions, Report Orders, Credits Circulating, Revenue by Currency, Tier Breakdown, and Open Support Tickets with one-click deep links into each section.
   - **User management:** Searchable member table with tier selector, account active/suspended toggle, admin role toggle (primary admin protected), atomic credit grant/deduct modal, anti-abuse IP-cluster & duplicate-chart flags, plus a clean **Legacy Client CSV Import** sub-view.
   - **Prompt Library (100s-Scale + Composable Recipes):** Split-pane master-detail studio. Left pane supports live full-text search, category filter tabs (`All`, `System`, `Expert`, `Analysis`, `Modifier`, `Mode`, `Output`, `Language`, `Tool`, `Report Step`), tag filters, and compact row density (`40px` rows). Right pane offers the editor (display name, slug, category, tags, model override, active toggle, markdown prompt body, version history rollback, and live Sandbox tester) plus a **Recipes** view where admins stack ordered prompt blocks from the library into named recipes.
   - **Chatbot:** Single control hub organized into crisp panels:
     - *Experience & Welcome Copy:* Customize the minimal empty-chat title (`"I'm ready"`), General Chart acknowledgement copy, composer placeholder, and toggleable UI controls (Voice Dictation, Quick Tools, Attachments, One-Tap Listen, WhatsApp Share).
     - *Experts & Ordering:* Enable/disable experts and reorder their display sequence (Up/Down controls) reflected live in user chat selectors.
     - *Modes, Languages & Defaults:* Assign Composable Prompt Recipes to each Mode, toggle Languages, and set global defaults (Tone: Friendly vs. Technical, Response Length: Short vs. Detailed, Default Expert, Default Language).
     - *Conversational Rules:* Live-editable system rules governing greeting behavior (no repetitive `"Hello <Name>,"`), conversational continuity, and citation style.
     - *Live Chatbot Preview Toggle:* Top-right button toggles a live interactive test chat pane (split view on desktop, modal/tab on mobile) wired directly to the real streaming consultation endpoint using the admin's latest saved configuration—allowing immediate verification without leaving `/app/admin`.
   - **Reports manager:** Create/edit Deep Research Reports (Name, Category, Rich Markdown description, Credit price, Sort order, Model override, Active toggle) and build sequential multi-pass pipelines where each pass can pull one or more reusable prompts/recipes from the Prompt Library plus pass-specific focus instructions.
   - **AI settings:**
     - *OpenRouter Connection:* Shows key source (`Database Override` vs. `Environment Secret`), masked key preview (`sk-or-v1-••••••1234`), secure input to save/rotate an encrypted key override, a **Test Connection** verification button, and a **Revert to Environment Key** action.
     - *Model Registry:* Configure Default Consultation Model, Default Utility Model, and add/remove **Custom OpenRouter Model IDs** (with optional label & notes) that automatically populate every model selector across Prompt Library, Chatbot, and Reports Manager.
     - *Token Limits:* Configure `max_tokens` caps for Short chat replies, Detailed chat replies, Deep Research report passes, Utility tools, and conversation context history turn limit.
   - **Pricing & Plans:** Edit all Credit Packs (name, subtitle, credits granted, highlight tag, active toggle, INR/USD/AED/EUR prices, Dodo product IDs), Membership Tiers (`Personal`, `Pro`, `Guru` — profile limits, monthly included credits, multi-currency prices, features list), Signup Welcome Credits, Referral Reward Credits, and Chat Credit Calculation weights (minimum/maximum credits per message and token weight multipliers).
   - **Support:** Ticket inbox showing status filters (`Open`, `In Progress`, `Resolved`, `All`), category filters, search, member context (tier, credits, email), full message thread, internal admin notes, status selector, and a **Reply via Email** action powered by Resend.
   - **Platform (Lower Sidebar Section):** Environment integration readiness grid (Supabase Admin, Supabase Client Auth, OpenRouter AI, FreeAstrologyAPI, Dodo Payments, Resend Email, Sanity Blog CMS), schema readiness diagnostics (detecting whether migration `004` tables are active), and one-click server cache invalidation.

### Visual Identity & Theme

- **Locked Brand Continuity ("Oura Warmth × Observatory Precision"):** Preserves Cosmic Council's established linen/parchment/umber identity paired with clean enterprise SaaS console discipline:
  - *Canvas:* Warm Ivory `#FAF7F2` (right scrollable workbench)
  - *Admin Sidebar:* Muted Oat `#F1ECE3` (`256px` fixed desktop rail, collapsible mobile slide-over drawer) with hairline border `rgba(61, 56, 48, 0.12)`
  - *Elevated Workbench Surfaces & Inputs:* Soft Parchment `#FDFBF7` with flat `1px` borders (single-elevation depth; no cards nested inside cards)
  - *Observatory Night Accents:* `#1F2229` → `#292D36` gradient reserved strictly for the executive KPI band in **Admin dash** with `#F4EFE6` ink and `#B8965A` aged brass accents
  - *Ink & Semantic States:* Deep Umber `#3D3830` headings, Warm Earth `#5C5449` body, Sandstone Taupe `#8B8275` quiet metadata, Primary Fill `#4A453D` (hover `#38342E`), Emerald `#2D6A4F` (`Configured` / `Active` / `Resolved`), Aged Brass `#8B7355` (`In Progress` / `Draft`), Terracotta `#7A3E36` (`Missing` / `Suspended` / `Error`) — always paired with explicit text labels, never color alone.
- **Typography & Density Discipline:**
  - *Page Title:* Clean `Cormorant Garamond` (`Admin panel` in sidebar header + crisp section heading per route).
  - *Navigation, Forms & Dense Tables:* `Plus Jakarta Sans` at compact `13px–14px` with `40px–44px` interactive row heights and single-line `whitespace-nowrap` controls.
  - *Numeric Alignment:* All credits, prices, token limits, counts, and timestamps strictly use `JetBrains Mono` / `tabular-nums`.
  - *Zero-Pill Restraint:* Static metadata (categories, statuses, timestamps, counts) renders as clean unboxed inline text separated by `·`; interactive filter tabs use crisp segmented button rails.

### Interactive Feedback & Motion

- **Instant Switching & Zero Layout Jump:** Switching Admin sidebar sections preserves the fixed rail and smoothly updates the right pane with compact skeleton rows matching final table height.
- **Explicit Save Feedback:** Every Admin form provides inline dirty-state indicators, loading button spinners, and concise Emerald confirmation / Terracotta error banners settling within `150–200ms`.
- **Safe Destructive Actions:** Deleting prompts/models, suspending users, or clearing API key overrides always use inline two-step confirmation—never browser `window.alert` or `window.confirm`.

---

## 3. Key Product Decisions & Trade-Offs

1. **Viewport-Locked Desktop Flex Shell (`h-[100dvh] overflow-hidden`) vs. CSS `position: sticky`**
   - *Chosen Approach:* Apply `md:h-[100dvh] md:overflow-hidden` to the outer workspace shell across ALL authenticated routes (not just Chat), with `<aside>` fixed to `h-full` and the right main column set to `flex-1 min-w-0 h-full overflow-y-auto`. Update floating scroll-to-top/bottom controls to accept or detect the scrollable container instead of relying exclusively on `window.scrollY`.
   - *Why:* `position: sticky` silently fails whenever any ancestor applies `overflow-x: hidden`. Locking the flex viewport eliminates the blank-space scroll bug on every current and future page permanently.
   - *Alternative Rejected:* Removing `overflow-x-hidden` and keeping document scroll—this risks horizontal overflow regressions on wide tables and still lets headers/sidebars jitter across browsers.

2. **Dedicated Admin Shell (`/app/admin/*`) vs. Nested Dual Sidebar**
   - *Chosen Approach:* Mount `/app/admin` (and optional sub-section state/paths like `/app/admin/prompts`, `/app/admin/chatbot`, etc.) inside a dedicated `AdminLayout` shell with its own fixed `256px` sidebar (8 primary items + lower-anchored `Platform` + top `Back to Chat` button). Keep the main workspace sidebar showing a clean `Admin` link strictly for `is_admin = true` accounts.
   - *Why:* With 9 exhaustive management sections—several requiring master-detail split panes (Prompt Library, Chatbot + Live Preview, Support)—nesting two sidebars wastes ~260px of horizontal desktop width and crowds tables.

3. **Encrypted Database Override for OpenRouter API Key (`AES-256-GCM`) with Env Fallback**
   - *Chosen Approach:* Store admin-entered OpenRouter API key in `platform_settings` encrypted server-side using Web Crypto / Node `crypto` AES-256-GCM with an encryption key derived via SHA-256 from `ADMIN_ENCRYPTION_SECRET || SUPABASE_SERVICE_ROLE_KEY`. Never return the plaintext key to the browser—only return `{ configured: true, source: 'database' | 'env', maskedPreview: 'sk-or-v1-••••1234' }`. If cleared or unset, runtime transparently falls back to `process.env.OPENROUTER_API_KEY`.
   - *Why:* Allows instant zero-downtime key rotation directly from **Admin → AI settings** without storing plaintext secrets in Postgres or exposing keys in API responses, while keeping Cloudflare Worker secrets as a safe fallback.

4. **Composable Prompt Recipes Architecture (100s-Scale Prompt Library)**
   - *Chosen Approach:* Extend `system_prompts` with expanded categories (`system`, `expert`, `analysis`, `modifier`, `mode`, `output`, `language`, `tool`, `report_step`, `learn`), `tags text[]`, and `sort_order integer`. Introduce `prompt_recipes` (`id`, `slug`, `name`, `target_type` `'mode' | 'report_pass' | 'preset'`, `target_slug`, `steps_json` ordered array of `{ prompt_slug, enabled, weight_note? }`, `is_active`). During consultation or report generation, the orchestrator resolves the active recipe's ordered prompt slugs (falling back cleanly to single-slug resolution if no multi-block recipe is attached).
   - *Why:* Scales effortlessly to hundreds of reusable building blocks (e.g., stacking *BPHS Dignity Check* + *KP Sub-Lord Filter* + *Timing Window Verifier* + *Calm Journal Output Modifier* into one Career Mode or Marriage Report pass) without duplicating prompt text across dozens of places.

5. **Natural Conversational Prompting (Fixing `"Hello Chris,"` Repetitions)**
   - *Chosen Approach:* Remove the rigid letter-opening pressure from system assembly by: (a) passing turn-index awareness (`historyMessages.length`) into the system instruction, (b) explicitly instructing the model **never** to open responses with email salutations (`"Hello <Name>,"`, `"Dear <Name>,"`, `"Hi <Name>,"`)—especially on follow-up turns—and to only weave the user's call name organically inside prose occasionally, (c) updating the default `detailed` output format so it feels like a warm, structured conversation rather than a memo/letter, and (d) exposing these **Conversational Rules** directly in **Admin → Chatbot** so the admin can tweak them live.
   - *Why:* Solves the immediate robotic feel while giving the admin total editorial control over how conversational vs. formal the astrologer sounds.

6. **Single-Layer Memory Caching with Immediate Admin Invalidation (Near-Zero Supabase Egress)**
   - *Chosen Approach:* Cache `platform_settings`, `prompt_recipes`, `pricing_catalog`, and `system_prompts` in server memory (5-minute TTL) and call explicit cache invalidation hooks whenever any Admin `POST`/`PATCH`/`DELETE` write succeeds.
   - *Why:* Keeps user chat requests, billing views, and chat config fetches near-zero database overhead while ensuring every Admin tweak reflects immediately in live chat and the Live Chatbot Preview.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Shell Topology

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATED APP ROUTER                           │
├─────────────────────────────────┬──────────────────────────────────────────┤
│   MAIN WORKSPACE SHELL          │   DEDICATED ADMIN SHELL (/app/admin/*)   │
│   (md:h-[100dvh] overflow-hidden)│   (h-[100dvh] overflow-hidden)          │
│ ┌─────────────┬───────────────┐ │ ┌──────────────────┬───────────────────┐ │
│ │ Fixed Rail  │ Scrollable    │ │ │ Fixed Admin Rail │ Scrollable Admin  │ │
│ │ (Steady)    │ Right Pane    │ │ │ (256px, Steady)  │ Workbench Pane    │ │
│ │ • Home      │ (overflow-y-  │ │ │ ┌──────────────┐ │                   │ │
│ │ • Profiles  │  auto h-full) │ │ │ │ Admin panel  │ │ Active Section:   │ │
│ │ • Reports   │               │ │ │ │ ← Back to App│ │ • Admin dash      │ │
│ │ • Dashboard │ Views:        │ │ │ ├──────────────┤ │ • User management │ │
│ │ • Credits   │ • Chat        │ │ │ │ Admin dash   │ │ • Prompt Library  │ │
│ │ • Support   │ • Profiles    │ │ │ │ User mgmt    │ │   (100s + Recipes)│ │
│ │ • Admin*    │ • Reports     │ │ │ │ Prompt Lib   │ │ • Chatbot + Live  │ │
│ │ ─────────── │ • Dashboard   │ │ │ │ Chatbot      │ │   Preview Toggle  │ │
│ │ • Profile   │ • Credits     │ │ │ │ Reports mgr  │ │ • Reports manager │ │
│ │ • Settings  │ • Settings    │ │ │ │ AI settings  │ │ • AI settings     │ │
│ │ • Backup    │               │ │ │ │ Pricing/Plans│ │ • Pricing & Plans │ │
│ │ • Sign Out  │               │ │ │ │ Support      │ │ • Support Desk    │ │
│ └─────────────┴───────────────┘ │ │ ├──────────────┤ │ • Platform Health │ │
│ *Shown ONLY if is_admin = true  │ │ │ Platform     │ │                   │ │
│                                 │ │ └──────────────┘ └───────────────────┘ │
└─────────────────────────────────┴──────────────────────────────────────────┘
                                      │
                                      ▼  Bearer Token + requireAdmin
┌────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS / CLOUDFLARE WORKER API                        │
├──────────────────────┬──────────────────────┬──────────────────────────────┤
│ Runtime Config Layer │ Prompt & Recipe Eng. │ Operations & Support Routes  │
│ (5-min TTL Cache +   │ • system_prompts     │ • /api/admin/overview        │
│  Admin Invalidation) │   (tags, sort_order) │ • /api/admin/users (+CSV)    │
│ • OpenRouter Key     │ • prompt_recipes     │ • /api/admin/settings/*      │
│   (AES-256-GCM DB    │   (ordered stacks)   │ • /api/admin/pricing         │
│    or ENV fallback)  │ • Conversational     │ • /api/admin/support-tickets │
│ • Model Registry &   │   Rules + Turn Count │ • /api/admin/platform/health │
│   Token Limits       │   (no "Hello Chris") │ • /api/admin/cache/flush     │
│ • Chatbot Config     │ • Live Streaming     │ • /api/app/support (persists │
│ • Pricing Catalog    │   Consultation SSE   │   to DB + sends Resend mail) │
└──────────────────────┴──────────────────────┴──────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE POSTGRES (Migration 004)                    │
│ • platform_settings  • prompt_recipes  • support_tickets  • system_prompts │
│   (RLS: service-role only for sensitive/admin tables; zero client reads)   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Database Schema & Single Idempotent SQL Migration Blueprint (`004`)

All new persistence lives in **one idempotent Supabase migration** (safe to run multiple times, zero destructive drops, graceful server fallbacks if a table isn't migrated yet):

1. **`public.platform_settings`** *(Key-value typed JSONB store — RLS enabled with zero anon/authenticated policies; Service Role only)*:
   - `key text primary key` — well-defined namespaces:
     - `'ai_config'`: `{ encrypted_openrouter_key, key_iv, key_tag, key_last4, consultation_model, utility_model, custom_models: [{ id, label, notes }], token_limits: { chat_short, chat_detailed, report_pass, utility, max_history_turns } }`
     - `'chatbot_config'`: `{ welcome_title, general_ready_message, composer_placeholder, default_tone, default_response_length, default_expert, default_language, expert_order: string[], mode_order: string[], language_order: string[], conversational_rules: string, features: { voice_input, listen_tts, whatsapp_share, attachments, quick_tools, followups } }`
     - `'pricing_config'`: `{ credit_packs: [...], membership_tiers: [...], signup_welcome_credits, referral_reward_credits, chat_billing: { min_credits, max_credits, output_token_weight, input_token_weight } }`
   - `value_json jsonb not null default '{}'::jsonb`
   - `updated_by uuid references public.users(id) on delete set null`
   - `updated_at timestamptz not null default now()`

2. **`public.system_prompts` Extensions** *(Alter existing table safely)*:
   - Drop/replace category check constraint to support full scalable library taxonomy:
     `'system' | 'expert' | 'analysis' | 'modifier' | 'mode' | 'output' | 'language' | 'tool' | 'report_step' | 'learn'`
   - Add columns if not exists:
     - `tags text[] not null default '{}'::text[]`
     - `sort_order integer not null default 100`
     - `description text` (admin internal usage note separate from user-facing `subtitle`)
   - Add GIN index on `tags` and B-tree index on `(category, sort_order, is_active)`.

3. **`public.prompt_recipes`** *(Composable ordered stacks of Prompt Library entries — Service Role only)*:
   - `id uuid primary key default gen_random_uuid()`
   - `slug text unique not null`
   - `name text not null`
   - `description text`
   - `target_type text not null check (target_type in ('mode', 'report_pass', 'custom'))`
   - `target_slug text` *(optional binding to a Chatbot Mode slug or reusable identifier)*
   - `steps_json jsonb not null default '[]'::jsonb` *(ordered array: `[{ prompt_slug: string, label?: string, enabled: boolean, inline_override?: string }]`)*
   - `model_id text` *(optional recipe-level OpenRouter override)*
   - `is_active boolean not null default true`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

4. **`public.support_tickets`** *(Persistent customer support inbox — RLS: users can view/insert own rows; admin manages all via Service Role)*:
   - `id uuid primary key default gen_random_uuid()`
   - `user_id uuid references public.users(id) on delete set null`
   - `from_name text not null`
   - `from_email text not null`
   - `category text not null default 'General Support'`
   - `subject text not null`
   - `message text not null`
   - `status text not null default 'open' check (status in ('open', 'in_progress', 'resolved'))`
   - `priority text not null default 'normal' check (priority in ('low', 'normal', 'high'))`
   - `admin_notes text`
   - `admin_reply_text text`
   - `replied_at timestamptz`
   - `replied_by uuid references public.users(id) on delete set null`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - Index on `(status, created_at desc)` and `(user_id, created_at desc)`.

---

### Backend API & Runtime Integration Contract

| Endpoint | Purpose & Behavior |
| :--- | :--- |
| `GET /api/chat/config` *(Public-safe authenticated)* | Returns cached active Experts (in `expert_order`), Modes (in `mode_order`), Outputs, Languages, Tools, PLUS safe UI fields from `chatbot_config` (`welcome_title`, `general_ready_message`, `composer_placeholder`, `default_tone`, `default_response_length`, `features`). Never leaks prompt bodies or secrets. |
| `GET /api/payments/catalog` *(Authenticated)* | Reads live `pricing_config` (cached 5m, falling back to hardcoded defaults if unset) so Admin price/credit edits immediately update Billing & Credits and Dodo Checkout amounts. |
| `POST /api/app/support` *(Authenticated)* | Persists ticket row into `public.support_tickets` AND triggers Resend email notification (succeeding cleanly even if Resend isn't configured). |
| `GET /api/admin/settings/ai` & `PUT /api/admin/settings/ai` | Returns masked key status + model registry + token limits. Saving encrypts a new OpenRouter key via AES-256-GCM (or preserves existing encrypted key when left blank), updates models/limits, and flushes runtime AI cache. |
| `POST /api/admin/settings/ai/test` | Executes a lightweight OpenRouter models/ping call using the currently active key (DB override or ENV) and returns latency + validity. |
| `DELETE /api/admin/settings/ai/key` | Removes the DB-stored OpenRouter API key override and reverts immediately to `process.env.OPENROUTER_API_KEY`. |
| `GET /api/admin/settings/chatbot` & `PUT /api/admin/settings/chatbot` | Reads/updates `chatbot_config` (feature flags, expert/mode/language ordering, welcome copy, defaults, conversational rules) and invalidates `/api/chat/config` + prompt caches immediately. |
| `GET /api/admin/settings/pricing` & `PUT /api/admin/settings/pricing` | Reads/updates `pricing_config` (Credit Packs, Tiers, Welcome/Referral bonuses, Chat credit billing weights) and invalidates pricing cache. |
| `GET/POST/PATCH/DELETE /api/admin/recipes` | Full CRUD for `prompt_recipes` (stacking ordered prompt slugs from `system_prompts`), with cache invalidation on write. |
| `GET /api/admin/support` & `PATCH /api/admin/support/:id` & `POST /api/admin/support/:id/reply` | Lists/filters support tickets with user tier/credit metadata, updates status/priority/notes, and optionally emails a reply via Resend while recording `admin_reply_text` and `replied_at`. |
| `GET /api/admin/platform/health` & `POST /api/admin/platform/cache-flush` | Returns integration checks (including whether OpenRouter is using DB override vs. Env), Supabase schema table verification for migration `004`, and flushes all in-memory server caches on demand. |

---

### 4-Phase Shippable Implementation Plan *(Agent-Portable Execution Guide)*

Each phase is self-contained, builds cleanly (`tsc --noEmit` + `vite build`), and delivers immediate user-visible value without breaking existing functionality.

#### Phase 1 — Core Layout Fix, Natural Chat Flow & Dedicated Admin Shell
- **Goal:** Fix the two highest-priority everyday bugs immediately and stand up the new dedicated `Admin panel` shell with its 9-item sidebar.
- **Concrete Deliverables:**
  1. **Workspace Viewport Scroll Fix:** Refactor the main authenticated layout container on desktop (`md:h-[100dvh] md:overflow-hidden`) so the left sidebar remains permanently anchored across Dashboard, Profiles, Reports, Credits, Settings, and Chat, while ONLY the right content pane (`overflow-y-auto`) scrolls. Update floating scroll-to-top/bottom controls to bind to the active scroll container smoothly.
  2. **Admin-Only Sidebar Link:** Render a clean **Admin** navigation entry (icon + label) in the main workspace sidebar and mobile drawer strictly gated by `appUser?.is_admin === true`.
  3. **Natural Conversational Greeting Fix:** Update consultation prompt assembly so:
     - Turn count (`historyMessages.length`) is tracked cleanly.
     - Formal letter salutations (`"Hello <Name>,"`, `"Dear <Name>,"`) are explicitly prohibited on ongoing turns and discouraged on direct analytical questions; `preferred_call_name` is framed for occasional, organic mid-sentence warmth only.
     - Default `detailed` output instructions emphasize clear conversational flow rather than formal memo openings.
  4. **Dedicated `Admin panel` Shell (`/app/admin/*`):**
     - Route `/app/admin` and `/app/admin/*` outside the user workspace sidebar into a dedicated `AdminLayout` (`h-[100dvh] overflow-hidden`) featuring a fixed `256px` left Admin sidebar (mobile slide-over drawer on small screens) + scrollable right workbench.
     - Title header cleanly reads **`Admin panel`** (removing `"Administrator Observatory Console"` and `"Platform Governance & Prompt IP"`).
     - Sidebar top includes **Back to Chat** (`/app/chat`), followed by all 8 primary items (**Admin dash**, **User management**, **Prompt Library**, **Chatbot**, **Reports manager**, **AI settings**, **Pricing & Plans**, **Support**) and lower-anchored **Platform**.
     - Wire existing functionality immediately into **Admin dash** (KPIs + shortcuts), **User management** (User directory + Legacy Client CSV Import sub-tab), **Prompt Library** (existing prompt editor), **Reports manager** (existing report chains), and **Platform** (existing Environment Readiness checks).
- **Phase 1 Verification Criteria:**
  - Scrolling Profiles, Dashboard, Reports, Billing, and Admin never moves the left sidebar and leaves zero blank gaps below the rail.
  - Non-admin account sees no Admin link; `fintasticapps@gmail.com` sees **Admin** and switches cleanly between Chat and Admin panel.
  - Multi-turn chat replies no longer start with `"Hello Chris,"` on every response.

#### Phase 2 — Supabase Migration (`004`), AI Settings, Pricing & Plans, and Support Desk
- **Goal:** Add unified Supabase persistence and ship three complete, live-wired operational Admin modules (**AI settings**, **Pricing & Plans**, **Support**).
- **Concrete Deliverables:**
  1. **Single Idempotent SQL Migration (`004_admin_console_and_recipes.sql`):** Creates `platform_settings`, `prompt_recipes`, `support_tickets`, extends `system_prompts` (`tags`, `sort_order`, `description`, expanded `category` check), sets strict RLS policies, and creates lookup indexes.
  2. **Runtime Settings & Crypto Service:** Builds a cached server service (5-minute TTL + invalidation) reading `platform_settings` with graceful fallback to environment variables / code defaults if migration `004` hasn't been applied yet. Implements AES-256-GCM encryption/decryption for the OpenRouter API key override.
  3. **Admin → AI settings:** Full UI + API to save/rotate/test/clear the encrypted OpenRouter API key, pick Default Consultation & Utility Models, add/remove Custom OpenRouter Model IDs (propagated dynamically to all dropdowns), and set Token Limits (Short, Detailed, Report Pass, Utility, History Window). Wire `openrouter.ts`, `geminiOrchestrator.ts`, and `reportGenerator.ts` to read active key, models, and `max_tokens` dynamically.
  4. **Admin → Pricing & Plans:** Full UI + API to edit Credit Packs (all 4 currencies, credits, highlight, active toggle), Membership Tiers (Personal/Pro/Guru limits, monthly credits, multi-currency prices, features), Signup/Referral Bonus Credits, and Chat Credit Billing weights. Wire `/api/payments/catalog`, checkout creation, signup bonus grant, and chat credit calculation to read live `pricing_config`.
  5. **Admin → Support & Platform Health:** Upgrade `POST /api/app/support` to persist every inquiry in `support_tickets` alongside Resend delivery. Build **Admin → Support** inbox (status/category filters, search, detail drawer, internal notes, status updates, and Resend email reply). Upgrade **Admin → Platform** with migration `004` table checks, OpenRouter key source indicator, and one-click **Flush Server Caches** button.
- **Phase 2 Verification Criteria:**
  - Saving a custom OpenRouter model in **AI settings** immediately makes it selectable across Prompts and Reports; **Test Connection** confirms key validity without exposing plaintext secrets.
  - Editing a Credit Pack price or credit count in **Pricing & Plans** immediately reflects on `/app/billing`.
  - Submitting a message in user **Support** modal appears immediately in **Admin → Support**, where status can be updated and replies sent.

#### Phase 3 — Scalable Prompt Library (100s of Prompts), Composable Recipe Engine & Upgraded Reports Manager
- **Goal:** Upgrade Prompt Library and Reports Manager so hundreds of prompts stay fast, organized, searchable, and composable as reusable recipes.
- **Concrete Deliverables:**
  1. **100s-Scale Prompt Library UI:** Replace the flat dropdown/list layout with a fast two-pane workbench:
     - Left pane: instant search (name, slug, tags, body preview), category filter rail (`All`, `System`, `Expert`, `Analysis`, `Modifier`, `Mode`, `Output`, `Language`, `Tool`, `Report Step`), tag filter chips (interactive buttons), active/inactive toggle filter, and compact scrollable list.
     - Right pane: prompt metadata (`display_name`, `slug`, `category`, `tags`, `sort_order`, `subtitle`, internal `description`, dynamic OpenRouter model selector pulling from AI Settings), markdown body editor, version history + one-click rollback, duplicate/clone action, and live Prompt Sandbox.
  2. **Composable Recipe Builder (`prompt_recipes`):**
     - Dedicated **Recipes** view inside Prompt Library where admins create ordered stacks of prompts (e.g., `System Core` → `Analysis Framework A` → `Analysis Framework B` → `Modifier` → `Output Style`), reorder blocks up/down, enable/disable individual steps, bind recipes to Modes or reuse them in Reports, and inspect the live assembled preview text.
     - Wire consultation orchestrator (`geminiOrchestrator.ts`) so when a Mode has an active Recipe, it automatically assembles the ordered recipe blocks in sequence (with seamless fallback to single-prompt mode when no recipe is bound).
  3. **Upgraded Reports manager:** Enhance each sequential pass inside a report chain so admins can attach one or more reusable Prompt Library items / Recipes directly to a pass (or write custom pass text), set per-report or per-pass model overrides from the dynamic Model Registry, and manage credit pricing cleanly in sync with Pricing & Plans.
- **Phase 3 Verification Criteria:**
  - Filtering/searching across dozens or hundreds of prompts feels instantaneous with zero UI clutter.
  - Stacking 3 prompt blocks into a Mode recipe visibly governs the live consultation assembly and updates immediately on save.
  - A Report pass referencing Prompt Library blocks executes seamlessly in multi-pass report synthesis.

#### Phase 4 — Chatbot Control Center & Live Test Preview
- **Goal:** Give the admin complete visual control over every detail of the chat experience—and let them test changes live without leaving the Admin panel.
- **Concrete Deliverables:**
  1. **Admin → Chatbot Control Center:** Clean, organized sub-tabs/panels:
     - *Welcome & Micro-Copy:* Edit the New Chat ready title (default `"I'm ready"`), General Chart response text, and composer placeholder.
     - *Feature Toggles:* Toggle Voice Dictation, One-Tap Listen (TTS), Share on WhatsApp, Attachments (Images/PDFs), Quick Tools (Question Generator / Expander / Optimizer), and Suggested Follow-Ups.
     - *Experts & Display Order:* Enable/disable experts, rename display titles/subtitles, and reorder Experts with Up/Down buttons—persisted to `chatbot_config.expert_order` and reflected live in user chat dropdowns.
     - *Modes, Languages & Defaults:* Reorder Modes/Languages, attach Composable Recipes to Modes, and set global defaults (Tone: Friendly vs. Technical, Response Length: Short vs. Detailed, Default Expert, Default Language).
     - *Conversational Rules:* Live editor for global conversation & greeting rules (seeded with the natural, non-repetitive dialogue rules from Phase 1) plus a one-click "Reset to Recommended Defaults".
  2. **Live Chatbot Preview Toggle:**
     - Prominent **`Test Live Chatbot`** toggle in the **Admin → Chatbot** header.
     - When toggled on, opens an interactive split-screen (desktop) or full-height panel (mobile) embedding the real live chat experience (loaded with the latest saved `chatbot_config`, active Experts/Modes order, Welcome copy, Conversational Rules, AI Settings model/tokens, and optional test birth profile selection) with a one-click **Reload Preview** button after saving any edit.
  3. **User Chat Wiring:** Update user-facing Chat Workspace, Message Thread empty state, and Composer to honor all live `chatbot_config` settings from `/api/chat/config` (with safe local defaults so zero loading flicker occurs).
- **Phase 4 Verification Criteria:**
  - Reordering Experts or editing `"I'm ready"` copy in **Admin → Chatbot** and clicking Save immediately updates both the embedded **Live Chatbot Preview** and `/app/chat`.
  - Toggling off a feature (e.g., Quick Tools or WhatsApp Share) cleanly hides it in the live chat UI and preview.
  - Editing Conversational Rules immediately changes how the astrologer responds inside the Live Chatbot Preview.

---

### Portable Handoff Checklist *(For Any Coding Agent Executing Future Phases)*

Before executing any phase, verify:
1. Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) after completing the phase.
2. Preserve strict Cosmic Council design tokens (`#FAF7F2`, `#F1ECE3`, `#FDFBF7`, `#3D3830`, `#5C5449`, `#8B8275`, `#4A453D`, `#2D6A4F`, `#7A3E36`, `#B8965A`) and custom form controls (`CustomSelect`, `CustomDatePicker`, custom `Tooltip` — never raw `<select>`, `<input type="date">`, `window.alert`, or `window.confirm`).
3. Maintain near-zero Supabase egress: never `select('*')` on heavy `chart_json` / `chart_text_context` / `final_markdown` columns in list endpoints, and always invalidate server caches on Admin writes.
4. Keep `system_prompts`, `prompt_recipes`, and `platform_settings` strictly inaccessible via client Supabase anon keys (zero client RLS read policies; admin routes protected by `requireAuth` + `requireAdmin`).
5. Preserve all unrelated marketing copy, landing pages, and existing user workflows untouched.
