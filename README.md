<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fa5bb618-3a87-4d31-972d-098473e95762

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and populate your Supabase, Gemini, FreeAstrologyAPI, Dodo Payments, and Resend keys.
3. Run locally:
   `npm run dev`

## Deploy on Cloudflare via GitHub (Workers + Static Assets)

1. Push this repository to GitHub.
2. In the **Cloudflare Dashboard**, go to **Compute (Workers) → Create → Import a repository** and select your GitHub repo.
3. Configure the build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
4. Add **Build environment variables** (needed during `vite build`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WEB3FORMS_ACCESS_KEY` *(optional, for legacy contact form)*
5. Add **Runtime Worker Secrets** (in **Worker Settings → Variables and Secrets**):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENROUTER_API_KEY` *(optional: `OPENROUTER_CONSULTATION_MODEL`, `OPENROUTER_UTILITY_MODEL`)*
   - `FREE_ASTROLOGY_API_KEY`
   - `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - `SANITY_PROJECT_ID`, `SANITY_DATASET` *(optional)*
6. Note: Make sure to deploy via **Cloudflare Workers** (`Import a repository` under Workers — NOT Cloudflare Pages without build command), and use the **Workers Paid ($5/mo)** plan if running multi-pass Deep Research reports and on-demand PDF synthesis.
