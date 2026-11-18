# Cosmic Council PRO — SaaS Roadmap & Phased Implementation Guide

> **Purpose of this file:** A complete, self-contained project blueprint and 6-phase engineering roadmap for transitioning Cosmic Council PRO (`cosmiccouncil.pro` + `app.cosmiccouncil.pro`) into an AI-powered Vedic Astrology consultation platform. Any coding agent or engineer can pick up any phase cleanly from here.

---

## 1. Objective Brief & Core Architecture

- **Product Vision:** An Oura-inspired, warm, scientifically grounded Vedic Astrology AI platform ("Modern Observatory Journal" aesthetic) offering multi-system consultations (Parashari, KP, Jaimini, Nadi), automated AstroSage-calibrated chart generation, credit-based usage, sequential Deep Research Reports, and a full Admin Console.
- **Preservation Rule:** Keep the existing marketing landing page at `/` untouched until Phase 6. Build all SaaS application views under `/app/*` (`/app/login`, `/app/dashboard`, `/app/chat`, `/app/reports`, `/app/billing`, `/app/settings`, `/app/admin`).
- **Frontend Stack:** React 19, TypeScript, Vite, React Router DOM, Tailwind CSS, `lucide-react`, `react-markdown` + `remark-gfm` (added in Phase 3).
- **Backend Stack:** Express (`server.ts`) running on port `3000` (`0.0.0.0`) with `vite.middlewares` in dev (`"dev": "tsx server.ts"`). All AI keys, astrology API keys, system prompts, and payment webhooks stay strictly server-side.
- **Database & Auth:** Supabase (PostgreSQL + RLS + Google/Gmail OAuth + Email/Password + Password Reset). Credit mutations use atomic Postgres RPCs (`SELECT ... FOR UPDATE`) to prevent race conditions.
- **AI Engine (`@google/genai`):**
  - `gemini-4-argon` — Primary consultation & report-chain reasoning engine (optional `gemini-4-carbon` for ultra-deep mode).
  - `gemini-4-hydrogen` — Fast utility engine (3 Quick Tools, 5–6 JSON follow-ups, Profile Memory summaries, Daily/Monthly cached briefs, chat titling).
  - **Gemini Context Caching** for 3,000–4,000 word prompts + static natal chart context.
- **Astrology Engine:** FreeAstrologyAPI (cached permanently per profile at activation, queued at `1 req/sec` on free tier) + local deterministic `jyotishMath.ts` for KP Placidus cusps/249 sub-lords, Jaimini Chara Karakas, Ashtakavarga, and Vimshottari Pratyantardasha + global daily Gochar transit cache.
- **Payments, Email & Blog:** Dodo Payments (webhook-verified, idempotent), Resend (transactional user emails + Supabase custom SMTP), Sanity CMS (strictly `/blog` SEO articles).
- **Credits & Tiers:** User-facing balance is always **Credits** (min top-up ₹1,000 = 10,000 Credits; INR, USD, AED, EUR). Referrals reward +5,000 Credits to both parties **only after** the referred user completes their first real payment/activation.

---

## 2. Design & Aesthetic Constitution

- **Unified Single-Brand System (Oura-Inspired Warmth × Observatory Precision):**
  - **Primary Light Canvas:** `#FAF7F2` (Warm Ivory) and `#F1ECE3` (Muted Oat Sidebar)
  - **Frosted Header / Floating Surfaces:** `rgba(234, 227, 215, 0.72)` with `backdrop-blur-md`
  - **Ink Scale (No pure `#000000`):** Display `#3D3830` (Deep Umber), Body `#5C5449` (Warm Earth), Muted `#8B8275` (Sandstone Taupe), Primary CTA `#4A453D`
  - **Observatory Night Accent Surface:** `#1F2229` -> `#292D36` with `#F4EFE6` text (used for Timing Radar cards & interactive Birth Chart inspection)
  - **Typography:** `Cormorant Garamond` (Display/Editorial headings), `Plus Jakarta Sans` (UI & readable body), `JetBrains Mono` (`tabular-nums` for degrees, dates, and credits)

---

## 3. Existing Codebase Map

- `package.json` — Scripts and dependencies
- `server.ts` — Express + Vite middleware full-stack entry point (Phase 1)
- `App.tsx` — Root router (`/` legacy landing + `/app/*` SaaS routes)
- `types.ts` & `constants.tsx` — Legacy catalog/currency types (reused as seed reference for Report Store)
- `supabase/migrations/001_initial_schema.sql` — Complete database schema, RLS, and atomic credit RPCs (Phase 1)
- `lib/supabaseClient.ts` & `server/lib/supabaseAdmin.ts` — Browser & Admin Supabase clients (Phase 1)
- `components/app/*` — SaaS UI components (Phases 1–5)
- `components/admin/*` — Admin Console components (Phase 6)

---

## 4. Phased Implementation Tracker

### Phase 1: Backend Server, Supabase Schema & Authentication *(Complete)*
- **Files:** `server.ts`, `package.json`, `.env.example`, `supabase/migrations/001_initial_schema.sql`, `lib/supabaseClient.ts`, `server/lib/supabaseAdmin.ts`, `server/middleware/auth.ts`, `components/app/AuthContext.tsx`, `components/app/AuthPage.tsx`, `components/app/SetPasswordModal.tsx`, `components/app/AppLayout.tsx`, `components/app/AppDashboardHome.tsx`, `App.tsx`, `index.html`.
- **Scope:** Express + Vite dev server, full Supabase Postgres schema + RLS + atomic credit RPCs, Gmail OAuth + Password Reset + Old-client forced `must_change_password` modal, referral capture, and Oura-styled `/app/*` layout shell.

### Phase 2: Ephemeris Engine & Profile Activation *(Complete)*
- **Files:** `server/services/astrologyApi.ts`, `server/services/jyotishMath.ts`, `server/services/chartCompiler.ts`, `server/routes/profiles.ts`, `server/scripts/verifyAstroSage.ts`, `components/app/ProfileManager.tsx`, `components/app/ChartViewer.tsx`.
- **Prompt Summary:** Rate-limited (`1 req/sec`) FreeAstrologyAPI client (Geo, DST Timezone, Planets Extended, Vargas D2–D60, Vimsottari, Shad Bala) + global `daily_transits` cache + local deterministic KP Placidus cusps/sub-lords, Jaimini Chara Karakas, Ashtakavarga, and Pratyantardasha + atomic activation credit deduction + 3-chart AstroSage verification script + interactive North/South Indian SVG chart viewer.

### Phase 3: Server-Side Gemini Consultation Engine & Chatbot Workspace *(Complete)*
- **Files:** `server/services/promptDefaults.ts`, `server/services/geminiOrchestrator.ts`, `server/services/memoryArchivist.ts`, `server/routes/chat.ts`, `components/app/chatTypes.ts`, `components/app/ChatWorkspace.tsx`, `components/app/ChatSidebar.tsx`, `components/app/ChatComposer.tsx`, `components/app/MessageThread.tsx`, `components/app/QuickToolsModal.tsx`, `components/app/MyPromptsModal.tsx`.
- **Prompt Summary:** Install `react-markdown` + `remark-gfm`. Server-side `@google/genai` streaming (`gemini-4-hydrogen` / configurable `GEMINI_CONSULTATION_MODEL`) with context caching support, live Gochar + Profile Memory injection, SSE AbortController stop generation, atomic credit deduction, Profile-grouped sidebar folders (+ `General` / `Learn Astrology`, search, bookmark pin, delete, lock, sort Newest / Longest word count), mid-chat Expert/Mode/Output/Language switching, 10 custom My Prompts, Voice Input, 3 Quick Tools (`gemini-4-hydrogen`), Reply-to-Message (`parent_message_id`), Star to Favorites, Delete/Exclude from context, and 5–6 clickable & numeric (`1`–`6` + Enter) follow-up questions.

### Phase 4: Timing Radar Dashboard, Dodo Payments, Referrals & Resend Emails *(Complete)*
- **Files:** `server/services/timingRadar.ts`, `server/services/email.ts`, `server/services/referralReward.ts`, `server/routes/payments.ts`, `server/routes/radar.ts`, `components/app/TimingRadarDashboard.tsx`, `components/app/BillingCredits.tsx`, `components/app/SettingsPage.tsx`.
- **Prompt Summary:** Active Dasha progress bars, upcoming slow-planet transit shifts, Dasha+Transit convergence windows, cached daily/monthly briefs (`gemini-4-hydrogen`), Dodo Payments checkout + HMAC-verified idempotent webhook handler, INR/USD/AED/EUR switcher, Personal/Professional/Guru tiers, payment-gated +5,000 referral bonus, Resend transactional emails, user defaults settings.

### Phase 5: Sequential Deep Research Reports Store + Report-to-Chat *(Complete)*
- **Files:** `server/services/reportDefaults.ts`, `server/workers/reportWorker.ts`, `server/services/pdfGenerator.ts`, `server/routes/reports.ts`, `components/app/ReportsStore.tsx`, `components/app/ReportOrderDetail.tsx`.
- **Prompt Summary:** 2–5 min async 4-pass sequential prompt chain worker (`gemini-4-hydrogen` / `GEMINI_CONSULTATION_MODEL`), live step progress UI, branded typeset PDF generation (`pdfkit`) + Supabase Storage upload + Resend notification email, automatic credit refund on failure, and automatic Report-to-Chat interactive follow-up thread creation (preserving `audio_url` schema hook for future conversational audio).

### Phase 6: Admin Panel, Old-Client CSV Bulk Import, Sanity Blog & New Landing Rollout *(Complete)*
- **Files:** `server/routes/admin.ts`, `components/admin/AdminPanel.tsx`, `components/admin/PromptChainEditor.tsx`, `components/admin/UserAnalytics.tsx`, `components/admin/ClientBulkImport.tsx`, `lib/sanity.ts`.
- **Prompt Summary:** Admin-protected user analytics (location, credits, questions, status), credit/tier pricing manager, 50–60 prompt & rule editor with version rollback + test sandbox, report catalog manager, CSV bulk client importer (`must_change_password = true` + Resend invite), Sanity headless `/blog`, and final brand/landing portal integration at `/`.
