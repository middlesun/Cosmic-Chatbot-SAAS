# Engineering & Design Rules for AI Agents

This document defines the strict UI/UX, styling, and architectural rules for this codebase. All AI agents and developers working on this project must adhere to these standards alongside [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

---

## RULE #1: Mandatory Custom Styled Dropdowns (NON-NEGOTIABLE)

> **"Anytime a dropdown is created, it must be created using the custom styled dropdown that matches the app, not the default ones. We always end up spending and wasting time redoing styling of dropdowns."**

### Requirements:
1. **Never use plain/unstyled `<select>` dropdowns.** Default browser/OS select controls look dated, render inconsistently across platforms (Windows vs macOS vs Linux), and break the sleek visual aesthetic of the app.
2. **Standard Dropdown Architecture**:
   - **Extension (`sidebar.html`)**: Uses `.custom-dropdown-container` / `.custom-dropdown-trigger` / `.custom-dropdown-menu` enhanced automatically via `enhanceAllDropdowns()`.
   - **Web Dashboard (`public/dashboard.html`)**: Uses `.sp-select-wrapper` / `.sp-select-trigger` / `.sp-select-menu` styled via `public/css/brand-theme.css`.
   ```html
   <div class="custom-dropdown-container">
       <button type="button" class="custom-dropdown-trigger" id="example-dropdown-trigger">
           <span class="custom-dropdown-label">Selected Option Text</span>
           <span class="dropdown-chevron">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                   <polyline points="6 9 12 15 18 9"></polyline>
               </svg>
           </span>
       </button>
       <select id="example-select" style="display: none;">
           <option value="val1">Option 1</option>
           <option value="val2">Option 2</option>
       </select>
       <div class="custom-dropdown-menu" id="example-dropdown-menu"></div>
   </div>
   ```
3. **Automated Dropdown Enhancement (`enhanceAllDropdowns()`)**:
   - Any `<select>` placed in the DOM is automatically transformed by `enhanceAllDropdowns()`.
   - `enhanceAllDropdowns()` must be called in `init()`, on tab switches, and on dynamic renders.
   - The enhancer attaches a `MutationObserver` to sync option changes dynamically.
4. **Unified Tier 2 Control Styling (see `DESIGN_SYSTEM.md`)**:
   - Rest state: `#ffffff` fill, `1px solid #dfd8cc` (`--sp-border-light`) border, `7px` radius (`--sp-radius-control`).
   - Focus / Open state: `#6c5ce7` (`--sp-purple`) border with `0 0 0 2.5px rgba(108, 92, 231, 0.15)` focus ring.

---

## RULE #2: Refined Tactile Segmented Controls & Hierarchy

All tab switchers and subtabs must adhere to the **Refined Tactile** system documented in `DESIGN_SYSTEM.md`:

### Tier 1 Primary Top Navigation (`#unified-top-nav`):
```css
background: var(--sp-track);       /* #F2EBE0 */
border: 1px solid var(--sp-ink);   /* #2a2d36 */
border-radius: var(--sp-radius-card);
padding: 3px;
display: flex;
gap: 4px;
box-shadow: var(--sp-shadow-sm);
```
- **Active Top Tab**: `background: var(--sp-yellow)` (`#fdcb6e`), `color: var(--sp-ink)`, `border: 1px solid var(--sp-ink)`, `box-shadow: var(--sp-shadow-sm)`, `font-weight: 700`.

### Tier 2 Subtab / Secondary Segmented Tracks (`.content-subtabs`, `#comments-submode-tabs`, `#thread-suggestions-tabs`):
```css
background: var(--sp-track);               /* #F2EBE0 */
border: 1px solid var(--sp-border-light);  /* #dfd8cc */
border-radius: 7px;
padding: 3px;
display: flex;
gap: 3px;
```
- **Active Subtab**: `background: #ffffff`, `color: var(--sp-ink)`, `font-weight: 600`, `box-shadow: 0 1px 2px rgba(42, 45, 54, 0.08)`.
- **Inactive Tab**: `background: transparent`, `color: var(--sp-text-muted)` (`#57606f`), `font-weight: 500`.

### Scope of Application:
- **Extension Unified Top Nav** (`#unified-top-nav`): `[ Poster | Research | Reports ]`
- **Extension Sub-Tracks**: Comments Submode (`Saved | Auto Comments`), Thread Suggestions filter tabs
- **Dashboard Content Sub-Tabs** (`.content-subtab` track): `[ Product Details | Directories Copy | Comments | Contact Form | Cold Email | DMs | Articles | Opportunity Queue | Suppression & Rules ]`

---

## RULE #3: Side-Panel-Only Extension Architecture (`sidebar.html`/`sidebar.js`)

The Chrome extension runs strictly in the browser Side Panel context (`sidebar.html` + `sidebar.js`). Legacy `popup.html`, `popup.js`, and `manifest-popup.json` have been retired.

1. **Unified Module Hierarchy:**
   - Modules (`contact`, `directory`, `twitter`), Contact subtabs (`Test`, `Data`, `Setup`, `Results`, `Settings`), and campaign stats grids (`forms-found`, `fields-filled`, `tabs-total`, `tabs-remaining`) live cleanly in `sidebar.html` / `sidebar.js`.
2. **Release Packaging (`npm run build:extension`):**
   - Always rebuild `public/downloads/smart-poster-extension-v1.3.0.zip` via `npm run build:extension` whenever extension runtime files change so the clean, allowlisted `.zip` stays synchronized.

---

## RULE #4: Layout Containment & Anti-Horizontal Overflow

1. **No Horizontal Scrolling**:
   `body`, `.container`, `.tab-content`, and `.dir-subtab-content` must have:
   `overflow-x: hidden; width: 100%; max-width: 100%; box-sizing: border-box;`
2. **Flex Containment**:
   All flex containers and flex items must include `min-width: 0;` to prevent text strings or input boxes from forcing horizontal expansion.
3. **Text Truncation**:
   Labels, URLs, and directory rows must truncate gracefully with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
4. **Sleek Custom Scrollbars**:
   No thick OS scrollbars. Use the 4px rounded scrollbar:
   ```css
   ::-webkit-scrollbar { width: 4px; height: 4px; }
   ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 9999px; }
   ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
   ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
   ```

---

## RULE #5: Multi-Length Directory Fields & Intelligent Autofill

1. **Dedicated Multi-Length Inputs**:
   - Product Name: strictly clean name, max 40 chars, no slogans, no emojis.
   - Short Tagline: max 60 chars.
   - Elevator Pitch: max 140 chars.
   - Medium Summary: max 250 chars.
   - Full Description: multi-paragraph detailed text.
   - Website URL & Demo URL: strictly validated `https://...` URLs.
2. **Autofill Injection Rules (`content.js`)**:
   - Inputs matching `type="url"` or regex `(url|website|site|link|homepage|product_url)` must inject **only** `websiteUrl` (never product name or title).
   - Character limit sniffing ($\le 40$, $41\text{--}80$, $81\text{--}160$, $161\text{--}300$, $> 300$) selects the appropriate length string and truncates safely at word boundaries.

---

## RULE #6: Twitter / X Integration Standards

1. **Local Base64 Image Attachments**:
   - Images are uploaded locally (`.png, .jpg, .webp`) and stored as Base64 data URLs in `chrome.storage`.
   - Never require external image hosting for attachments.
   - Previews render in a 4-slot grid with 1-click removal (`✕`).
2. **Single-Row Saved Comments Layout**:
   - Each canned comment is rendered as a clean single-row element with text and image badges on the left, and actions `[ 🚀 Insert ]`, `[ 📋 Copy ]`, and `[ 🗑️ Delete ]` on the right.
3. **1-Click Tweet Composer Injection**:
   - Targets `div[data-testid="tweetTextarea_0"]`, focuses, calls `document.execCommand('insertText', false, text)`, and dispatches `input` / `change` events.
   - Automatically falls back to clipboard copy if no Twitter compose box is detected on the active tab.

---

## RULE #7: Strict Change Control & Code Preservation (NON-NEGOTIABLE)

### Core Directives:
1. **Surgical Interventions**:
   - Make ONLY the changes strictly necessary to fulfill the user's specific request.
   - Use localized replacements (`replace_file_content` / `multi_replace_file_content`) rather than rewriting large sections of existing files.
   - Never refactor working routines or optimize working logic unless directly requested.
2. **Mandatory Content & Copy Lock**:
   - Do NOT invent, rewrite, rephrase, expand, shorten, or "improve" any sales copy, product descriptions, headings, taglines, CTAs, button labels, or legal text unless explicitly instructed to revise copy.
   - Content changes and design changes are separate tasks. Treat all existing text as intentional.
   - Do not invent marketing copy or filler content. If placeholder text is required for a new component, use exact text already provided or clearly identifiable standard tokens.
3. **Extension Architecture Consistency**:
   - Keep `extension/sidebar.html`, `extension/sidebar.js`, `extension/background.js`, and `extension/content.js` cleanly aligned; never reintroduce retired popup files or package non-runtime dev/doc files into release `.zip` archives.
4. **Logic & Schema Preservation**:
   - Preserve all existing features, functionality, and state behavior. Treat all current behavior as correct unless explicitly stated otherwise.
   - Do not rename variables, functions, files, or components.
   - Do not modify unrelated UI, layout, styling, or copy.
   - Do not introduce new dependencies, libraries, or frameworks unless explicitly required.
   - Preserve existing storage schemas in `chrome.storage` to prevent data loss.
5. **No Placeholders or Truncations**:
   - Never leave `// ... existing code ...` or placeholder comments in place of working code. Write complete, functional implementations on the first pass.
6. **Feature Freedom within Scope**:
   - When implementing an explicitly requested new feature or phase, the agent IS authorized to extend state schemas, register necessary event listeners, update background scripts, and insert corresponding UI cards without being blocked by preservation rules.
7. **Environment Stability**:
   - Keep the development server running on port 3000 (`0.0.0.0`). Do not modify build tools or configs.

---

## RULE #8: Mandatory Standard Line Icon Library (NON-NEGOTIABLE)

> **"All icon requirements across all sections of the application must strictly use the exact same Line icon library."**

### Requirements:
1. **Unified SVG Line Icon Format**:
   - Every button, card header, pill, trigger, and menu item across all modules (Contact Form, Directory Submitter, Twitter, Commenter, Home AI Hub, Drawer) must exclusively use clean, lightweight inline SVG line icons.
   - Standard SVG specifications:
     - `viewBox="0 0 24 24"`
     - `fill="none"`
     - `stroke="currentColor"` (or module theme color)
     - `stroke-width="2"` (or `2.5` for micro chevrons)
     - `stroke-linecap="round"`
     - `stroke-linejoin="round"`
2. **Zero Mixing of Icon Styles**:
   - Never use filled emojis or non-line icon assets for core UI buttons.
   - Keep stroke weights, padding, and alignments perfectly consistent across all modules.

---

## RULE #9: Ultra-Concise Button Labels (Single-Word Standard)

1. **Shortest Possible Labels**:
   - Button text labels across all modules must be as short as possible, strictly preferring a single word (e.g., `Save` instead of `Save Reply Comment` or `Save Draft`, `Comments` instead of `Saved comments`, `Insert` instead of `Insert Comment`, `Upload` instead of `Upload Local Images`).
2. **Icon-Only Where Appropriate**:
   - In toolbars and bulk-action headers (such as Toggle All, Expand All, or Delete), prefer compact icon-only buttons with standard SVG line icons and accessible `title` / `aria-label` tooltips.

---

## RULE #10: Zero Unsolicited Section Description Text

1. **No Filler Subtexts or Explanations**:
   - Do NOT add descriptive subtitles, explanatory paragraphs, or instructional helper text beneath section headers, card titles, or input labels unless explicitly instructed by the user.
2. **Lean & Clean SaaS Layout**:
   - Keep all cards and modules free of instructional clutter. Rely on clean typography, distinct section headings, and self-evident interactive controls.

---

## RULE #11: No Placeholder Texts on New Fields

1. **Omit Placeholders by Default**:
   - Do NOT add placeholder text attributes (`placeholder="..."`) to any new input fields, textareas, or dropdown search boxes unless explicitly requested by the user.
2. **Label-Driven Form Fields**:
   - Form fields must rely on clear, concise `<label>` elements rather than transitory or redundant placeholder strings.

---

## RULE #12: Mandatory Container Width Adherence & Anti-Overflow on All Inputs & Buttons (NON-NEGOTIABLE)

> **"Input fields must always be properly designed, the buttons and sections must always follow the width of the app. Else we keep wasting time on these fixes."**

### Requirements:
1. **Container Width Invariant**:
   - Every input, select, textarea, button, card header, and flex child inside the extension sidebar (`sidebar.html`) MUST strictly adhere to container boundaries.
   - All flex children containing text or form controls MUST include `min-width: 0; box-sizing: border-box;`.
2. **No Horizontal Spilling**:
   - Never allow buttons or input wrappers to set fixed pixel widths that exceed the extension container width (sidebar is 380px max-width; popup is 400px max-width).
   - Multi-button action rows must use `display: flex; gap: 6px; width: 100%; box-sizing: border-box;` with flex items shrinking properly.
3. **Concise Header Badges**:
   - Badges inside collapsible card headers must be concise (e.g. `<span class="pro-feature-badge">👑 Pro</span>`), never multi-line sentences or sales copy that push header actions or chevrons out of view.

---

## RULE #13: Mandatory Custom Styled Tooltips (NON-NEGOTIABLE)

> **"Every time a tooltip is added, IT MUST ALWAYS USE THE CUSTOM STYLED TOOLTIP AND NEVER USE DEFAULT SYSTEM STYLE."**

### Requirements:
1. **Never use default browser/OS system tooltips**:
   - Default browser `title="..."` tooltips render with dated OS rectangular boxes, delayed popups, and platform-inconsistent chrome that break the visual aesthetic of the application.
   - All tooltips must strictly use the application's custom styled tooltip component (`.app-custom-tooltip` / `data-tooltip`).
2. **Standard Custom Tooltip Aesthetic**:
   - Background: Deep slate (`#0f172a`) with subtle translucent border (`border: 1px solid rgba(255, 255, 255, 0.12)`).
   - Typography: Crisp white (`#f8fafc`), 11px font size, 500 medium weight, antialiased.
   - Container: 6px border radius, subtle drop shadow (`box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3)`), max-width 250px with graceful wrapping.
   - Micro-transitions: 150ms cubic-bezier fade and micro-scale entrance.
3. **Automated Conversion & Delegation**:
   - The universal tooltip engine (`initCustomTooltips()`) automatically converts any `title` attribute to `data-tooltip` via document-level delegation to prevent native browser tooltips from ever displaying.
   - Any new tooltips added to UI buttons, inputs, icons, or badges must use `data-tooltip="..."` or be handled by the custom tooltip system.


