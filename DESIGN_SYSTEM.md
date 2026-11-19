# Smart Poster — Refined Tactile Design System

This document is the single source of truth for the locked **Refined Tactile** visual system across the **ContactFormSubmitter.pro / Smart Poster** product suite:

- **Marketing Landing (`index.html`, `about.html`)** — Editorial Warm Cream + bold tactile hero accents
- **Chrome Extension (`extension/theme.css`, `extension/sidebar.html`, `extension/popup.html`)** — Locked Reference Implementation
- **Web App (`public/css/brand-theme.css`, `public/dashboard.html`, `public/login.html`, `public/admin.html`)** — Web Dashboard & Auth surfaces

---

## 1. Design Principles & 3-Tier Hierarchy

To keep narrow browser panels and dense SaaS dashboards uncluttered while preserving the brand's signature tactile edge from `index.html`, every UI element belongs to one of three visual tiers:

| Tier | Purpose | Border | Shadow | Fill / Accent |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 — Brand Signature Chrome** | Top bars, active navigation chrome, primary global CTAs, modals | `1px`–`1.5px solid var(--sp-ink)` (`#2a2d36`) | Light offset (`--sp-shadow-btn` / `--sp-shadow-sm` / `--sp-shadow-card`) | Amber (`#fdcb6e`) or Brand Purple (`#6c5ce7`) |
| **Tier 2 — Unified Controls & Cards** | Cards, collapsible sections, `<input>`, `<textarea>`, `<select>`, `.sp-select-*`, `.custom-dropdown-*` | `1px solid var(--sp-border-light)` (`#dfd8cc`) | Soft ambient (`--sp-shadow-soft`) or `none` | `#ffffff` cards on `#FCF9F2` / `#FAF4EB` warm cream canvas |
| **Tier 3 — Repeated Row Actions & Ghost Icons** | List row buttons (`Insert`, `Copy`, `Save`), icon actions (Clone, Delete, Expand), micro-pills | Hairline (`1px solid #dfd8cc` or `--sp-purple-border`) or `transparent` (ghost) | `none` | Quiet `#ffffff`, `--sp-purple-light`, or transparent hover tint |

---

## 2. Color & Surface Tokens

```css
:root {
  /* Typography */
  --sp-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --sp-font-heading: 'Sora', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --sp-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Core Brand Tokens */
  --sp-yellow: #fdcb6e;
  --sp-yellow-hover: #f4be58;
  --sp-yellow-light: #fef7e7;
  --sp-purple: #6c5ce7;
  --sp-purple-hover: #5b4bc4;
  --sp-purple-light: #f1effe;
  --sp-purple-border: #d4cdfc;

  /* Warm Cream Surfaces & Canvas */
  --sp-bg: #FCF9F2;                 /* Page / viewport canvas */
  --sp-surface: #FAF4EB;            /* Tray / recessed section surface */
  --sp-surface-elevated: #ffffff;   /* Primary card & input surface */
  --sp-track: #F2EBE0;              /* Segmented track / muted divider */

  /* Typography & Softened Ink / Hairline Borders */
  --sp-text-main: #1e222a;          /* Primary body & heading text */
  --sp-text-muted: #57606f;         /* Secondary labels & descriptions */
  --sp-text-dim: #747d8c;           /* Metadata & timestamps */
  --sp-ink: #2a2d36;                /* Tier 1 softened tactile border ink */
  --sp-border-light: #dfd8cc;       /* Tier 2 card & control hairline */
  --sp-border-hover: #bfb6a6;       /* Tier 2 hover border */

  /* Semantic Accents */
  --sp-success: #059669;
  --sp-success-bg: #ecfdf5;
  --sp-success-border: #a7f3d0;
  --sp-danger: #dc2626;
  --sp-danger-bg: #fef2f2;
  --sp-danger-border: #fecaca;
  --sp-warning: #d97706;
  --sp-warning-bg: #fffbeb;
  --sp-warning-border: #fde68a;

  /* Tactile Shadows & Radii */
  --sp-shadow-btn: 1.5px 1.5px 0px rgba(42, 45, 54, 0.82);
  --sp-shadow-card: 2.5px 2.5px 0px rgba(42, 45, 54, 0.78);
  --sp-shadow-sm: 1px 1px 0px rgba(42, 45, 54, 0.72);
  --sp-shadow-soft: 0 1px 2px rgba(42, 45, 54, 0.05);
  --sp-shadow-menu: 0 12px 28px -6px rgba(30, 34, 42, 0.14), 0 4px 10px -4px rgba(30, 34, 42, 0.08);

  --sp-radius-card: 10px;
  --sp-radius-control: 7px;
  --sp-radius-btn: 6px;
  --sp-radius-pill: 9999px;
}
```

---

## 3. Typography Rules

- **Display & Headings (`h1`–`h4`, `.font-display`, modal titles, active primary tabs, hero CTAs)**:
  - Font: `'Sora', 'Inter', sans-serif`
  - Letter spacing: `-0.02em` to `-0.025em`
  - Weight: `700`–`800`
- **UI & Body (`body`, labels, form fields, buttons, descriptions)**:
  - Font: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
  - Weight: `400`–`600`
- **Tabular & Code (`font-mono-tabular`, URLs, metrics, DR, counts)**:
  - Font: `'JetBrains Mono', ui-monospace, monospace`
  - `font-variant-numeric: tabular-nums;`

---

## 4. Component Specifications & Interaction States

### 4.1 Primary Tactile CTA (Tier 1)
- **Rest**: `background: var(--sp-purple)`, `color: #ffffff`, `border: 1px solid var(--sp-ink)`, `box-shadow: var(--sp-shadow-btn)`, `border-radius: var(--sp-radius-control)` (or `9999px` for full-width hero pill CTAs)
- **Hover**: `background: var(--sp-purple-hover)`, `transform: translate(-0.5px, -0.5px)`, `box-shadow: 2px 2px 0px rgba(42, 45, 54, 0.85)`
- **Active**: `transform: translate(1px, 1px)`, `box-shadow: 0.5px 0.5px 0px rgba(42, 45, 54, 0.85)`
- **Disabled**: `opacity: 0.55`, `cursor: not-allowed`, `transform: none`

### 4.2 Amber Highlight CTA / Active Nav Pill (Tier 1)
- **Rest**: `background: var(--sp-yellow)`, `color: var(--sp-ink)`, `border: 1px solid var(--sp-ink)`, `box-shadow: var(--sp-shadow-sm)`, `font-weight: 700`
- **Hover**: `background: var(--sp-yellow-hover)`
- **Active**: `transform: translate(0.5px, 0.5px)`, `box-shadow: 0.5px 0.5px 0px rgba(42, 45, 54, 0.72)`

### 4.3 Secondary Hairline Button (Tier 2 / Tier 3)
- **Rest**: `background: #ffffff`, `color: var(--sp-text-main)`, `border: 1px solid var(--sp-border-light)`, `border-radius: var(--sp-radius-btn)`, `box-shadow: none`, `font-weight: 600`
- **Hover**: `background: var(--sp-surface)`, `color: var(--sp-ink)`, `border-color: var(--sp-border-hover)`
- **Active**: `transform: scale(0.98)`

### 4.4 Subtle Purple Action Button (`Insert`, AI Actions)
- **Rest**: `background: var(--sp-purple-light)`, `color: var(--sp-purple-hover)`, `border: 1px solid var(--sp-purple-border)`, `box-shadow: none`
- **Hover**: `background: var(--sp-purple)`, `color: #ffffff`, `border-color: var(--sp-purple)`

### 4.5 Ghost Icon Buttons (Row Clone / Delete / Collapse)
- **Rest**: `background: transparent`, `border: 1px solid transparent`, `color: var(--sp-text-muted)` (or `#dc2626` for destructive delete)
- **Hover**: `background: var(--sp-track)`, `color: var(--sp-ink)` (or `#fee2e2` / `#b91c1c` for delete)

### 4.6 Form Inputs, Textareas, Native & Custom Dropdowns (Tier 2)
- **Rest**: `background: #ffffff`, `color: var(--sp-text-main)`, `border: 1px solid var(--sp-border-light)`, `border-radius: var(--sp-radius-control)`, `box-shadow: none`
- **Hover**: `border-color: var(--sp-border-hover)`
- **Focus / Open**: `outline: none`, `background: #ffffff`, `border-color: var(--sp-purple)`, `box-shadow: 0 0 0 2.5px rgba(108, 92, 231, 0.15)`
- **Custom Dropdown Menu (`.custom-dropdown-menu`, `.sp-select-menu`)**:
  - `background: #ffffff`, `border: 1px solid var(--sp-border-light)`, `border-radius: var(--sp-radius-card)`, `box-shadow: var(--sp-shadow-menu)`
  - Option Hover: `background: var(--sp-surface)`, `color: var(--sp-text-main)`
  - Option Selected: `background: var(--sp-purple-light)`, `color: var(--sp-purple-hover)`, `font-weight: 600`

### 4.7 Cards, Collapsibles & Tables
- **Outer Card**: `background: #ffffff`, `border: 1px solid var(--sp-border-light)`, `border-radius: var(--sp-radius-card)`, `box-shadow: var(--sp-shadow-soft)`
- **Recessed Tray / Table Header / Inner Strip**: `background: var(--sp-surface)` (`#FAF4EB`) or `var(--sp-bg)` (`#FCF9F2`) with `1px solid var(--sp-border-light)` dividers
- **Segmented Control Track**: `background: var(--sp-track)`, `border: 1px solid var(--sp-border-light)`, `border-radius: var(--sp-radius-control)`, `padding: 3px`
  - **Active Segment**: `background: #ffffff` (inside subtabs) or `var(--sp-yellow)` (top Tier 1 nav), `color: var(--sp-ink)`, `font-weight: 700`

---

## 5. Cross-Surface Mapping

| Surface | Stylesheet / Mechanism | Notes |
| :--- | :--- | :--- |
| **Chrome Extension (`sidebar.html`, `popup.html`)** | `extension/theme.css` | Compact 340–400px density, sticky Tier 1 Amber/Track nav, flattened white cards + cream collapsible trays |
| **User Dashboard (`public/dashboard.html`)** | `public/css/brand-theme.css` + Tailwind | Warm Cream `#FCF9F2` viewport, crisp white left rail & top bar with `#fdcb6e` / `#6c5ce7` active & primary accents, `.sp-select-*` matching Tier 2 tokens |
| **Login (`public/login.html`)** | `public/css/brand-theme.css` + Tailwind | Warm Cream canvas, Tier 1 tactile card (`1.5px solid var(--sp-ink)` + `--sp-shadow-card`), Amber brand mark, Purple/Ink Google CTA |
| **Landing Page (`index.html`, `about.html`)** | Inline Tailwind + root vars | Shares `#fdcb6e` Amber, `#6c5ce7` Purple, `Sora` + `Inter`, and tactile borders |
