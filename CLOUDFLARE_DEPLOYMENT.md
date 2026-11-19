# Cloudflare Pages Deployment & Environment Configuration Guide

This repository is fully configured for continuous deployment to **Cloudflare Pages** using **GitHub** and **Vite**, with serverless edge functions (`/functions/api/*`) and dynamic environment variable injection for Supabase and Gemini.

---

## 1. Quick Overview

- **Build Tool**: Vite (`npm run build`)
- **Build Output Directory**: `dist`
- **Configuration Mode**: Option B — Managed directly via Cloudflare Pages Dashboard (Settings -> Variables and secrets) with zero repository config file conflicts.
- **Serverless API / Cloudflare Edge**:
  - Cloudflare Pages Functions: Located in `/functions/api/` (`onRequest*` handlers auto-routed by Cloudflare Pages)
  - `GET /api/config` — Provides dynamic public config to client & extension
  - `POST /api/auth/login` — Administrator authentication
  - `POST /api/ai/action` — Server-side AI outreach variation generator
  - `POST /api/ai/match-context` — Thread-to-variation context matcher
- **Local Dev Server**: `npm run dev` (`tsx server.ts` running Express + Vite on port 3000)

---

## 2. Deploying to Cloudflare Pages via GitHub

### Step 1: Push Code to GitHub
Ensure all files are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Configure Cloudflare Pages deployment and environment variables"
git push origin main
```

### Step 2: Create a Cloudflare Pages Project
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, navigate to **Workers & Pages** > **Create application** > **Pages** tab.
3. Click **Connect to Git** and authorize your GitHub account.
4. Select your repository.

### Step 3: Configure Build & Output Settings
Configure the build settings as follows:
- **Framework preset**: `Vite` (or None)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave blank or default)

### Step 4: Add Environment Variables in Cloudflare Pages
In the Cloudflare Pages project setup (or under **Project Settings** > **Environment variables**), add the following variables for both **Production** and **Preview**:

| Variable Name | Description | Example / Note |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project REST URL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGciOi...` |
| `SUPABASE_URL` | Supabase URL for Cloud Functions | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Anon Key for Functions | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Optional)* Supabase Service Role Key | For admin operations (never exposed to client) |
| `GEMINI_API_KEY` | *(Optional)* Google Gemini API Key | Powers live AI comment variations |
| `ADMIN_USERNAME` | *(Optional)* Admin portal username | Defaults to `admin` |
| `ADMIN_PASSWORD` | *(Optional)* Admin portal password | Defaults to `pass369` |

> **Security Note**: All hardcoded Supabase keys and project IDs have been removed from frontend files and the Chrome extension. Credentials are read strictly from environment variables via `/api/config` or client environment (`VITE_*`).

### Step 5: Deploy
Click **Save and Deploy**. Cloudflare Pages will clone the repo, run `npm run build`, mount the `/functions/api/*` endpoints, and give you a live URL (`https://<project-name>.pages.dev`).

---

## 3. How the Extension Connects to the Cloudflare Backend

The Chrome Extension (`extension/`) no longer has any hardcoded Supabase project IDs or API keys.

1. **Auto-Discovery**: On installation or startup, `background.js` checks `chrome.storage.local`. If no custom Supabase credentials are saved, it can automatically query `/api/config` from your hosted Cloudflare domain to configure synchronization.
2. **User / Pro Settings**: Users can also configure their Supabase credentials directly inside the Extension Settings modal, which persists to `chrome.storage.local`.
3. **Admin Dashboard**: The landing page's Admin Control Center dynamically fetches `/api/config` to verify the connected Supabase instance and AI engine status in real time.

---

## 4. Next Phase: Moving Extension Logic to Cloudflare Edge Functions

As you move more app logic to the cloud, use the existing `/functions/` directory:

1. **User Authentication & Tier Verification**:
   - Query Supabase Auth from `/functions/api/user/verify.ts` using JWT Bearer tokens to check whether a user has an active **Pro** membership.
2. **Comment Generation & Rate Limiting**:
   - Centralize AI comment generation in `/functions/api/ai/action.ts` so API keys are never bundled inside the extension code or exposed to the browser.
3. **Template Sync**:
   - Store and retrieve user templates via `/functions/api/templates.ts`, keeping the extension lightweight and safe from reverse engineering.
