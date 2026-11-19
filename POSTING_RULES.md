# Posting Rules

This document is the single source of truth for natural-language posting rules in **Smart Poster**.
Add or update rules here in plain English; every active rule listed below is **hardcoded directly in the extension engine** (`extension/sidebar.js` & `extension/content.js`) with no frontend UI toggles required.

---

## General Posting Rules

- Resolve spin syntax (`{option A|option B}`) into a single randomized variation before copying or inserting content.
- Respect campaign and global **Suppression List** entries to skip suppressed domains or thread URLs automatically.

---

## Universal Post/Fill Rules

- Preserve formatting and line breaks cleanly when injecting text into target editors or form fields.
- Strip leading/trailing whitespace before inserting into comments, DMs, emails, or contact forms.

---

## Individual Platform-Based Rules

### Twitter / X (`twitter.com`, `x.com`)

- **[ACTIVE — Hardcoded]** `[Rule: While commenting on Twitter, don't use 'https://' as domain.com works fine]`
  - Automatically strip `https://` and `http://` prefixes from URLs when commenting, inserting, or copying for Twitter / X so links post cleanly as `domain.com` without duplicate URL glitches.

### Pinterest (`pinterest.com`)

- _Add Pinterest-specific natural-language posting rules here to be hardcoded into the extension engine._

### Other Platforms (Template)

- **Platform Name (`example.com`)**:
  - Describe the rule in plain English (what to transform, strip, format, or safeguard when posting on this platform).
