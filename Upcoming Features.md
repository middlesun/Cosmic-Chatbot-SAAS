# Upcoming Features & Architectural Blueprint

This document captures architectural decisions, feasibility analyses, edge cases, and strategic roadmaps discussed for upcoming iterations of the platform.

---

## 1. Product Strategy: Why "Manual Power Assist" Precedes "Unattended Autopilot"

### The Strategic Decision
Attempting to build 100% unattended background Autopilot across hundreds of third-party domains upfront introduces severe real-world failure points (CAPTCHAs, login walls, paywalls, anti-bot heuristics, account shadowbans).

**The Phased Approach:**
1. **Phase 1 (Immediate Focus — High ROI):**
   - **Manual Power Assist (1-Click Fill):** The user browses or opens tabs, clicks the universal **"Post / Fill"** button or uses `Alt+S`, and the bot intelligently sniffs the page and fills 100% of the inputs in under 500ms without submitting.
   - **Suppression List Management:** Granular domain-level and URL-level exclusion to prevent duplicate outreach.
   - **AI Content Generator & Spin-Tax Engine:** Contextual comment/DM generation, length-aware summaries, and variation generator.
   - **Cloud Sync (e.g., Supabase / Cloud Database):** Seamless cross-browser and cross-device profile syncing, eliminating manual JSON import/export.
   - **Edge-Case Collection:** Logging real-world form structures, directory wizards, and validation quirks to build bulletproof heuristics.

2. **Phase 2 (Future Focus):**
   - **Driver-Based Unattended Autopilot:** Gradual rollout of background automated execution using the edge-case data collected in Phase 1.

---

## 2. Autopilot Campaigns: Technical Blueprint & Edge Cases

### A. Tri-Box URL Routing Architecture
Instead of dumping mixed, ambiguous links into a single bucket, the Autopilot queue accepts three distinct URL input channels:
1. **Comments / Social URLs:** Posts, tweets, Reddit threads, YouTube videos.
2. **Directory Submission URLs:** Submission wizards, product directories, startup listing sites.
3. **Contact Form URLs:** `/contact`, `/get-in-touch`, B2B agency support forms.

This separation eliminates guesswork for the bot and allows the queue runner to invoke dedicated engine rules for each category.

---

### B. Module 1: Social Media Commenting Engine

#### 1. Technical Mechanics:
- Modern SPAs (X/Twitter, Reddit, Facebook, YouTube) do not use standard `<textarea>` elements. They rely on ContentEditable rich text composers (Lexical, ProseMirror, Polymer).
- Generic `element.value = "..."` fails because the underlying React/Vue component state does not register standard DOM assignments.
- **Solution (Driver-Based Input Simulation):**
  1. Focus the contenteditable element.
  2. Dispatch synthetic `beforeinput` / `InputEvent` or `document.execCommand('insertText', false, commentText)`.
  3. Dispatch bubbled `input` and `change` events.
  4. Wait for the platform's debounce timer to activate the submit button (e.g., X’s `aria-disabled="false"`).
  5. Dispatch simulated `mousedown`, `mouseup`, and `click` or `Ctrl+Enter`.

#### 2. Submission Verification & Accuracy:
- **DOM Mutation Checking:** Verify that the comment input clears and a newly created comment node matching the text appears in the thread.
- **Network Request Sniffing:** Monitor outgoing GraphQL/REST endpoints (e.g., `/api/comments`, `/create_reply`) for HTTP 200/201 response codes vs. HTTP 429 (rate-limited) or 403 (blocked/thread locked).

#### 3. Edge Cases & Risks:
- **Shadowbanning:** On platforms like Reddit, X, and YouTube, comments with URLs or repetitive text may be silently hidden from other users.
- **Account Action Blocks:** High-volume automated commenting on one account triggers anti-spam thresholds. Safe limit: 20–40 high-trust comments per account per day with human typing delays (35ms–95ms jitter).

---

### C. Module 2: Contact Form Submissions

#### 1. Technical Mechanics:
- Semantic mapping using regex and field attribute sniffing (`name`, `id`, `placeholder`, `aria-label`) accurately fills Name, Business Email, Phone, Company, Website, Subject, and Message.
- In manual mode, it only fills the fields. In automated mode, it locates the submit button and executes submission.

#### 2. Common Blockers & Solutions:
- **Math & Text CAPTCHAs:** Simple text-based math challenges (`3 + 4 = ?`) can easily be identified via DOM sniffing and evaluated inline via lightweight regex calculation.
- **Complex CAPTCHAs (reCAPTCHA v2/v3, Turnstile, hCaptcha):** Cannot be solved natively without paid third-party solver APIs (2Captcha/CapSolver). In hybrid mode, the bot pauses and alerts the user to click the checkbox.
- **Phone Number / Business Email Validation:** Forms rejecting free domains (`@gmail.com`) or requiring specific international phone formatting (`+1...`).

---

### D. Module 3: Directory Submissions

#### 1. Technical Mechanics:
- **Google OAuth Login Flow:**
  - Directories frequently require Google/Gmail authentication before showing submission forms.
  - Using Chrome Extension `host_permissions: ["https://accounts.google.com/*"]`, the extension can monitor OAuth popups, select the user's active Chrome profile card (`[data-email]`), and complete the login cycle automatically.
- **Submit Link Discovery:**
  - Ranked keyword matching scans header/navigation links for patterns: `/submit`, `/add-tool`, `/submit-product`, `List Your Tool`.
  - Fallback: Directly probes common endpoint patterns (`domain.com/submit`, `domain.com/add`).
- **Multi-Length Text Adaptation:**
  - Match short taglines (≤60 chars), pitches (≤140 chars), summaries (≤250 chars), and detailed markdown descriptions based on field `maxlength` or label heuristics.
- **Image & Asset Uploads:**
  - Programmatic upload via native browser `DataTransfer` and `File` APIs. Converts Base64 brand assets (logos, favicons, screenshots) stored in extension storage into binary `File` objects and injects them into `<input type="file">` and drag-and-drop dropzones.

#### 2. Key Friction Points:
- **Paginated / Multi-Step Wizards:** Step 1 (Enter URL -> Scrape metadata) -> Step 2 (Review scraped info & upload screenshots) -> Step 3 (Select category) -> Step 4 (Submit). Requires asynchronous state watchers to detect when step loaders finish.
- **Paywalls & Upsells:** Modern directories display paid tier upsells ($19–$99) vs. Free options ("Skip to free queue", "No thanks"). Requires deterministic button prioritization to select the free tier.
- **Category Taxonomy Discrepancies:** Every directory uses unique category taxonomies (e.g., "AI Marketing" vs "SaaS Growth" vs "Productivity Tools"). Requires semantic similarity matching to pick the closest dropdown match.

---

## 3. Anti-Detection & Natural Behavior Standards

When automated background runs are enabled in the future, they must adhere to these four core rules:

1. **Gaussian Timing Jitter:**
   - Never use static timers (e.g., exactly 2 minutes).
   - Use randomized intervals (e.g., 8–15 minutes) with micro-jitter between individual field interactions (50ms–200ms).
2. **Idle Breaks ("Coffee Break" Pattern):**
   - Insert longer pauses (20–45 minutes) every 5–8 completed submissions to mimic human behavior.
3. **Single-Worker Tab Execution:**
   - Never open multiple submission tabs concurrently. Always maintain a single active worker tab: `Open Tab -> Wait for Load -> Fill/Submit -> Verify -> Close Tab -> Sleep -> Next`.
4. **Honeypot Evasion:**
   - Inspect element bounding boxes and computed styles (`offsetHeight > 0`, `display !== 'none'`, `visibility !== 'hidden'`) to avoid filling hidden honeypot traps planted by anti-spam firewalls.

---

## 4. Current Roadmap & Near-Term Priorities

1. **Brand Profile Enhancements:**
   - Multi-asset storage (Favicons, Logos, Screenshots) ready for programmatic injection.
   - Categorized taglines, pitches, and custom questions ("Are you the founder?", "Pricing model").
2. **AI Content Studio:**
   - Contextual comment paraphrasing and spin-tax generation.
   - Multi-length summary expansion and compression.
3. **Supabase / Cloud Integration:**
   - Centralized database for cross-device brand sync, campaign templates, and real-time team collaboration.
4. **Suppression & Analytics Overhaul:**
   - Unified domain blacklist, auto-suppression on fill, and detailed exportable submission history.

---

## 5. Automated Lead & URL Discovery ("The Harvester")

### The Discovery Problem
Finding what to comment on is 70% of the friction. If an app solves both **Discovery** and **Insertion**, it transforms from a simple form-filler into an end-to-end inbound customer acquisition engine.

### A. Free & Low-Cost Platform Scrapers

| Platform | Recommended Discovery Technique | Cost / Friction |
| :--- | :--- | :--- |
| **Reddit** | **Native Subreddit RSS Feeds & Search Feeds**: Reddit provides free RSS for any search or subreddit! (e.g., `reddit.com/r/startups/search.rss?q=traffic&sort=new`). Zero API keys required. | **Free & 100% Legal** |
| **Twitter / X** | **Targeted Search Bookmarks & RSS / Nitter Bridges**: Query bookmarks like `"tired of" + keyword min_faves:5` or using low-cost scrapers (e.g., Apify Twitter Scraper: ~$5/month). | **Negligible ($1–5/mo)** |
| **YouTube** | **YouTube Data API v3 (Search endpoint)**: Google provides 10,000 free quota units per day, allowing daily retrieval of hundreds of new videos matching keywords like "how to build app" or "SaaS marketing". | **Free** |
| **LinkedIn & TikTok** | **Google Dorking Alerts**: Query Google Search index: `site:linkedin.com/posts "recommend a tool" [keyword]` filtered by "Past 24 Hours". | **Free** |
| **New Launchpads** | RSS scraping of Uneed.best, BetaList, ProductHunt, LaunchingNext, and Toolify. | **Free** |

### B. The "High-Intent" Filtering Algorithm (Crucial)
Searching for generic broad keywords (e.g. `"gummies"` or `"coding"`) returns 90% irrelevant noise. The Harvester requires an **Intent Modifier Matrix**:

1. **Pain / Frustration Triggers**:
   - `"tired of"`, `"hate when"`, `"struggling with"`, `"why is it so hard to"`, `"waste of time"`.
2. **Recommendation Requests**:
   - `"any recommendations for"`, `"what tool do you use for"`, `"alternative to [Competitor]"`, `"looking for an app that"`.
3. **Question / Advice Triggers**:
   - `"how do you guys manage"`, `"best way to"`, `"is there a tool that"`.

**Example Result:**
Instead of finding 500 random posts mentioning "SEO", the bot surfaces 12 threads where high-intent buyers specifically asked: *"Is there an alternative to Ahrefs for early-stage builders? Can't afford $199/mo."* That is a 90% conversion rate comment opportunity.

---

## 6. The "Multi-Tab Hopper" (Assembly-Line Commenting Mode)

### The Dream UX
1. The user opens 10 target tweets or Reddit threads in background tabs (either manually or via 1-click launch from a Campaign queue).
2. On the first tab, a floating pill widget appears: **`[ Fill & Next Tab (Alt+N) ]`**.
3. When clicked:
   - It inserts the best/next unique variation into Tab 1.
   - Automatically switches the browser to **Tab 2**.
   - Tab 2 is immediately filled with a fresh variation and focused.
4. The user simply glances, hits native "Reply", taps `Alt+N`, and moves down the line. **10 high-intent comments placed in under 90 seconds.**

