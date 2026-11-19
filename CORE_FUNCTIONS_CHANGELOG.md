# Core Functions Changelog

This document records the architectural and core logic changes implemented in the Smart Poster Chrome Extension engine (`extension/content.js`, `extension/sidebar.js`, `extension/popup.js`, and `extension/background.js`). Cosmetic and UI layout edits are excluded.

---

## 1. Rich Text Insertion & Editor State Synchronization (`extension/content.js`)

### `formFiller.safeSetRichTextContent(element, value)`
* **Issue Addressed**: Comments inserted on Twitter / X duplicated text and URLs (`focusgummies.cofocusgummies.co`), and locked the Draft.js editor (preventing backspace, selection, and typing until a full page reload). Comments on Pinterest disappeared immediately because the editor collapsed upon insertion.
* **Core Logic Changes**:
  * **Draft.js / Twitter Single-Pass Insertion**: Removed the redundant synthetic `InputEvent('input', { data: strVal })` that was dispatched immediately after `document.execCommand('insertText', false, strVal)`. In Chromium, `execCommand('insertText')` already dispatches native `beforeinput` and `input` events; dispatching a second synthetic event with data forced Draft.js to append a second copy of the text and corrupted the internal block tree.
  * **Scoped Range Replacement**: Replaced global `document.execCommand('selectAll')` with localized `Range` selection bounded strictly to `element`. This prevents desynchronizing Draft.js entity keys and Slate.js selection anchors.
  * **Slate.js / Pinterest Simulated Paste**: Added a primary `ClipboardEvent('paste')` mechanism using `DataTransfer('text/plain')`. Modern rich-text editors (Slate, Lexical) treat this as a standard human paste operation, updating internal state without triggering synthetic event rejection.
  * **Suppression of Synthetic `change` Events on ContentEditables**: Rich-text contenteditable containers now only receive `input` events. Bubbling synthetic `change` events—which triggered Pinterest’s outside-click and unmount handlers—are strictly avoided.
  * **Focus Retention**: Explicitly keeps the editor focused at the end of the newly inserted text, preventing frameworks from treating the insertion as a blur event.

---

## 2. Universal Composer Discovery & Lazy Hydration (`extension/content.js`)

### `universalEngine.findUniversalCommentComposer()`
* **Issue Addressed**: Universal "Post/Fill" failed to detect comment boxes on YouTube (showing *"⚠️ No supported forms or composers detected on this tab"*) and failed on dynamic single-page applications where composers are lazily rendered.
* **Core Logic Changes**:
  * **Active Focused Element Inspection**: Prioritizes `document.activeElement` if the user has already clicked into any textarea, input, or contenteditable field (including checking for editable child nodes within focused container elements).
  * **YouTube Polymer Lazy Hydration**:
    * Automatically locates YouTube's collapsed `#placeholder-area` or `#simplebox-placeholder`.
    * Dispatches the full mouse and pointer event lifecycle (`pointerdown` → `mousedown` → `click` → `pointerup` → `mouseup` → `focus`).
    * Extends polling from 480ms (6 × 80ms) to **2,000ms (20 × 100ms)** to accommodate YouTube Polymer's asynchronous component rendering of `ytd-commentbox #contenteditable-root`.
  * **Pinterest Lazy Container Activation**:
    * Targeted triggers (`[data-test-id="activity-item-text-box"]`, `[data-test-id="rich-comment-box"]`) now scroll into view and trigger click without blurring out.
    * Increased container hydration timeout to 1,500ms (15 × 100ms).
  * **Multi-Platform Selector Matrix Expansion**:
    * Added comprehensive selector entries for YouTube Polymer, Pinterest Slate, Twitter Draft.js, Reddit Shreddit, Instagram, Threads, TikTok, LinkedIn (post & comment boxes), Quora, Disqus, Medium, WordPress, and Substack.
    * Strict bounding rectangle validation (`rect.width > 0 && rect.height > 0`) to bypass hidden or offscreen template nodes.

---

## 3. Universal Post Execution & Fallback Hierarchy (`extension/content.js`)

### `universalEngine._doExecute(payload)`
* **Issue Addressed**: Unhandled exceptions when brand comment structures were nested, failure when comments section was out of viewport, or complete halt on unknown web editors.
* **Core Logic Changes**:
  * **Resilient Brand Payload Unpacking**: Accepts payload whether passed as `{ brandData: { ... } }` or as a direct brand profile object.
  * **Comment Fallback Pipeline**: If `brandData.comments` is empty or all variations are disabled, the engine cascades down through:
    1. `brandData.comments`
    2. `brandData.social.comments`
    3. `brandData.brandInfo.tagline` / `brandData.brandInfo.description`
    4. `brandData.directory.tagline` / `brandData.directory.elevatorPitch`
    5. `brandData.contact.message`
  * **YouTube Out-of-Viewport Scroll Recovery**: If an editor is not immediately located on YouTube, the engine scrolls towards `ytd-comments, #comments` to trigger lazy-load hydration, waits 600ms, and re-queries.
  * **Zero-Failure Clipboard Safety Net**: If a page uses canvas-based inputs, deeply isolated iframes, or non-standard shadow roots where no DOM editor is reachable, the spun comment is copied to `navigator.clipboard` and a toast is displayed: `"📋 Comment copied to clipboard! (Click comment box and press Ctrl+V)"`. This prevents blocking errors and lets the user proceed without disruption.

---

## 4. Real-Time Tab & Context Synchronization (`extension/sidebar.js` & `extension/popup.js`)

### `SidebarManager.init()` & `PopupManager.init()`
* **Issue Addressed**: Side panel retained stale context (e.g., showing `Context: 📌 Pinterest Comment` even after switching to YouTube), causing the Universal Post button to search for the wrong platform's fields.
* **Core Logic Changes**:
  * Registered Chrome runtime tab lifecycle listeners:
    * `chrome.tabs.onActivated`: Triggers `sniffActiveContext()` immediately when the user switches browser tabs.
    * `chrome.tabs.onUpdated`: Triggers `sniffActiveContext()` when URL changes or navigation completes.
    * `chrome.windows.onFocusChanged`: Re-evaluates context when switching between browser windows.

### `SidebarManager.getActiveTab()` & `PopupManager.getActiveTab()`
* **Issue Addressed**: Side panel window was unable to find active browsing tab via `currentWindow: true`.
* **Core Logic Changes**:
  * Queries `chrome.tabs.query({ active: true, lastFocusedWindow: true })` first to target the user's primary browsing window.
  * Falls back to `chrome.tabs.query({ active: true, currentWindow: true })` and generic `{ active: true }`.

### `SidebarManager.sniffActiveContext()` & `PopupManager.sniffActiveContext()`
* **Issue Addressed**: Heuristic fallback was missing key platforms, defaulting to generic ready state.
* **Core Logic Changes**:
  * Added heuristics for YouTube (`youtube.com`, `youtu.be`), Pinterest (`pinterest.com`), Instagram, Threads, TikTok, LinkedIn, and Quora with distinct color-coded status badges.

### `SidebarManager.triggerUniversalPost()` & `PopupManager.triggerUniversalPost()`
* **Issue Addressed**: Dispatched payloads sometimes had empty comments due to storage key separation between `twitterComments` and `brand.comments`.
* **Core Logic Changes**:
  * Synchronized `brand.comments` from `this.twitterComments` or `brand.social.comments` prior to message dispatch.

---

## 5. Background Universal Shortcut Handler (`extension/background.js`)

### `chrome.commands.onCommand` ('universal-post')
* **Core Logic Changes**:
  * Replaced single `currentWindow: true` tab query with `lastFocusedWindow: true` fallback.
  * Pulls `twitterComments` from storage alongside `brandProfiles` to ensure brand comment variations are never empty when triggered via shortcut (Alt+S).

---

## 6. Social Spam Mitigation & Semi-Automated Insertion UX (`extension/content.js`, `extension/sidebar.js`, `extension/popup.js`)

### `formFiller.findAndFocusSubmitButton(editorElement)`
* **Issue Addressed**: After comments were injected, users had to hunt through long page feeds or complex thread layouts to locate the native "Reply" or "Submit" button, breaking the fluid semi-automated workflow.
* **Core Logic Changes**:
  * **Platform-Specific Submit Button Resolution**:
    * Twitter/X: `[data-testid="tweetButtonInline"]`, `[data-testid="tweetButton"]`
    * YouTube: `#submit-button button`, `ytd-button-renderer#submit-button`, `ytd-commentbox #submit-button`
    * Reddit: `shreddit-composer button[type="submit"]`, `faceplate-form button[type="submit"]`, `button[slot="submit-button"]`
    * Pinterest: `[data-test-id="activity-item-create-comment-button"]`, `button[aria-label*="Comment"]`
    * LinkedIn: `button.comments-comment-box__submit-button`, `button[type="submit"]`
    * Instagram: `form button[type="submit"]`, `div[role="button"]:has(span:contains("Post"))`
    * TikTok: `[data-e2e="comment-post"]`, `button[type="submit"]`
    * Threads: `div[role="button"]:has(span:contains("Post"))`, `button[type="submit"]`
  * **Scoped Parent Container Traversal**: If top-level selectors fail, the algorithm crawls up through ancestors (`form`, `[role="dialog"]`, `div:has(button)`, up to 7 parent levels) to locate the closest interactive submit button without false-positive matching of global site navigation.
  * **Smooth Viewport Auto-Scroll**: Uses `submitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` so both the comment editor and the native submit button remain visible.
  * **Visual Guiding Pulse**: Temporarily applies an animated 1.8s blue highlight pulse (`boxShadow: 0 0 0 3px rgba(37,99,235,0.45)`, `outline: 2px solid #2563eb`) to instantly direct the user's eyes to the exact button to click.
  * **Non-Destructive Focus**: The editor maintains its cursor and input selection; the submit button is scrolled into view and highlighted without robbing active focus from the input field.

### `PlatformVelocityTracker` (`extension/sidebar.js` & `extension/popup.js`)
* **Issue Addressed**: Repetitive rapid posting across social platforms triggers automated spam rate limits and shadowbans.
* **Core Logic Changes**:
  * **Date-Partitioned Storage Isolation**: Uses `tb_platform_velocity` in `chrome.storage.local` keyed by ISO date string (`YYYY-MM-DD`). Automatically resets counts every calendar day without background timers or server-side cron dependencies.
  * **Per-Platform Algorithmic Thresholds**:
    * Twitter / X: 25 safe / 35 caution
    * Reddit: 20 safe / 30 caution
    * YouTube: 30 safe / 40 caution
    * Pinterest / LinkedIn / Instagram / TikTok / Threads: 25 safe / 35 caution
  * **Rolling 60-Minute Hourly Frequency Meter**: Records high-resolution timestamps for every comment insertion. If an account generates **>= 15 submissions within a 60-minute window**, the meter shifts to a high-priority `SLOW DOWN` alert, warning the user to wait 3–5 minutes before commenting again.
  * **Real-Time UI Binding**: Automatically detects the active platform via tab sniffing, dynamically showing the target platform's icon, daily progress bar, and safety status badge (`SAFE`, `CAUTION`, `SLOW DOWN`) directly below the Universal Context badge.

