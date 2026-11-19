// Simple working content script
console.log('Content script loaded');

// Prevent multiple injections and prevent running in subframes/ads/trackers
if (window === window.top && typeof window.formBlasterInitialized === 'undefined') {
  window.formBlasterInitialized = true;

  // Centralized Error Logging System
  const logger = {
    log: (...args) => console.log('[CS]', ...args),
    warn: (...args) => console.warn('[CS WARN]', ...args),
    error: (msg, details = null) => {
      console.error('[CS ERROR]', msg, details);
      try {
        const errorRecord = {
          id: 'err-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          domain: window.location.hostname,
          source: 'content_script',
          message: typeof msg === 'string' ? msg : (msg?.message || String(msg)),
          details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
          stack: msg?.stack || (details instanceof Error ? details.stack : null)
        };
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['tb_error_logs'], (res) => {
            const logs = Array.isArray(res.tb_error_logs) ? res.tb_error_logs : [];
            logs.unshift(errorRecord);
            if (logs.length > 100) logs.pop();
            chrome.storage.local.set({ tb_error_logs: logs });
          });
        }
      } catch (_) {}
    }
  };

  // Phase C: Thin Actuator Recipe Cache (Non-executable JSON synced via /api/workspace/bootstrap)
  const DEFAULT_GENERIC_RECIPES = {
    version: '1.3.0',
    tier: 'generic',
    generic: {
      commentComposers: [
        '#comment',
        'textarea[name="comment"]',
        'form#commentform textarea',
        '.comment-form textarea',
        'textarea.comment-textarea',
        'textarea[id*="comment" i]',
        'textarea[name*="comment" i]',
        'textarea[placeholder*="comment" i]',
        'textarea[placeholder*="reply" i]',
        'textarea[placeholder*="thoughts" i]',
        'textarea[placeholder*="response" i]',
        'div[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      submitButtons: [
        '#submit',
        'input[type="submit"]',
        'button[type="submit"]',
        'button.comment-submit'
      ]
    },
    platforms: {},
    webmail: {},
    dm: {},
    directoryDetection: {
      knownHosts: []
    }
  };

  let cachedSelectorRecipes = DEFAULT_GENERIC_RECIPES;

  function normalizeSelectorRecipes(raw) {
    if (!raw || typeof raw !== 'object') return DEFAULT_GENERIC_RECIPES;
    return {
      version: raw.version || '1.3.0',
      tier: raw.tier || 'generic',
      generic: {
        commentComposers: Array.isArray(raw.generic?.commentComposers) && raw.generic.commentComposers.length
          ? raw.generic.commentComposers
          : DEFAULT_GENERIC_RECIPES.generic.commentComposers,
        submitButtons: Array.isArray(raw.generic?.submitButtons) && raw.generic.submitButtons.length
          ? raw.generic.submitButtons
          : DEFAULT_GENERIC_RECIPES.generic.submitButtons
      },
      platforms: raw.platforms && typeof raw.platforms === 'object' ? raw.platforms : {},
      webmail: raw.webmail && typeof raw.webmail === 'object' ? raw.webmail : {},
      dm: raw.dm && typeof raw.dm === 'object' ? raw.dm : {},
      directoryDetection: raw.directoryDetection && typeof raw.directoryDetection === 'object'
        ? { knownHosts: Array.isArray(raw.directoryDetection.knownHosts) ? raw.directoryDetection.knownHosts : [] }
        : { knownHosts: [] }
    };
  }

  function hostMatchesDomain(host, domain) {
    const cleanHost = String(host || '').toLowerCase().replace(/^www\./, '');
    const cleanDomain = String(domain || '').toLowerCase().replace(/^www\./, '').trim();
    if (!cleanHost || !cleanDomain) return false;
    if (cleanDomain.endsWith('.*')) {
      const prefix = cleanDomain.slice(0, -1); // e.g. 'pinterest.'
      return cleanHost.startsWith(prefix) || cleanHost.includes('.' + prefix);
    }
    return cleanHost === cleanDomain || cleanHost.endsWith('.' + cleanDomain);
  }

  function findRecipeByHost(groupMap, host) {
    if (!groupMap || typeof groupMap !== 'object' || !host) return null;
    const lowerHost = String(host).toLowerCase();
    for (const [key, recipe] of Object.entries(groupMap)) {
      const hosts = Array.isArray(recipe?.hosts) ? recipe.hosts : [];
      if (hosts.some((h) => hostMatchesDomain(lowerHost, h))) {
        return { key, recipe };
      }
    }
    return null;
  }

  function queryFirstSelector(selectors, scope = document) {
    if (!Array.isArray(selectors)) return null;
    for (const sel of selectors) {
      if (!sel) continue;
      try {
        const el = scope.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function queryFirstVisibleSelector(selectors, scope = document) {
    if (!Array.isArray(selectors)) return null;
    for (const sel of selectors) {
      if (!sel) continue;
      try {
        const els = scope.querySelectorAll(sel);
        for (const el of els) {
          if (el.type === 'hidden' || el.style?.display === 'none') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const str = (el.name || el.id || el.placeholder || el.getAttribute?.('aria-label') || '').toLowerCase();
            if (str.includes('search') || str.includes('query')) continue;
            return el;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  let autoVariationEnabled = false;
  let csRandomnessLevel = 3;
  let csRandomnessSynonyms = true;
  let csRandomnessDicts = `(app | tool | platform)\n(quick | fast | rapid)`;
  const _csAutoVariationHistory = new Map();
  const _csEngine = (typeof globalThis !== 'undefined' && globalThis.SmartPosterVariationEngine) || null;
  if (_csEngine && typeof _csEngine.hydrateHistory === 'function') {
    _csEngine.hydrateHistory();
  }

  const recipesReadyPromise = new Promise((resolve) => {
    const fallbackTimer = setTimeout(resolve, 150);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          ['sp_selector_recipes', 'tb_auto_variation', 'randomnessLevel', 'randomnessSynonyms', 'randomnessDicts', 'sp_randomness_v2_migrated'],
          (res) => {
            clearTimeout(fallbackTimer);
            if (res?.sp_selector_recipes) {
              cachedSelectorRecipes = normalizeSelectorRecipes(res.sp_selector_recipes);
            }
            if (res?.tb_auto_variation !== undefined) {
              autoVariationEnabled = Boolean(res.tb_auto_variation);
            }
            if (res?.randomnessLevel !== undefined) {
              csRandomnessLevel = _csEngine
                ? _csEngine.migrateLegacyRandomnessLevel(res.randomnessLevel, Boolean(res.sp_randomness_v2_migrated))
                : (Number(res.randomnessLevel) || 3);
            }
            if (res?.randomnessSynonyms !== undefined) {
              csRandomnessSynonyms = res.randomnessSynonyms !== false;
            }
            if (res?.randomnessDicts !== undefined && String(res.randomnessDicts).trim()) {
              csRandomnessDicts = String(res.randomnessDicts);
            }
            resolve();
          }
        );
      } else {
        clearTimeout(fallbackTimer);
        resolve();
      }
    } catch (_) {
      clearTimeout(fallbackTimer);
      resolve();
    }
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.sp_selector_recipes) {
        cachedSelectorRecipes = normalizeSelectorRecipes(changes.sp_selector_recipes.newValue);
      }
      if (area === 'local' && changes.tb_auto_variation !== undefined) {
        autoVariationEnabled = Boolean(changes.tb_auto_variation.newValue);
      }
      if (area === 'local' && changes.randomnessLevel !== undefined) {
        csRandomnessLevel = _csEngine
          ? _csEngine.normalizeLevel(changes.randomnessLevel.newValue, 3)
          : (Number(changes.randomnessLevel.newValue) || 3);
      }
      if (area === 'local' && changes.randomnessSynonyms !== undefined) {
        csRandomnessSynonyms = changes.randomnessSynonyms.newValue !== false;
      }
      if (area === 'local' && changes.randomnessDicts !== undefined) {
        csRandomnessDicts = String(changes.randomnessDicts.newValue || '');
      }
    });
  }

  // Bridge web authentication events from /auth/callback.html to extension storage
  let lastForwardedAuthToken = '';
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    const msgType = event.data.type;
    if (msgType !== 'AUTH_SUCCESS' && msgType !== 'CF_SUPABASE_AUTH_SUCCESS') return;

    const rawSession = event.data.session || (event.data.user ? {
      user: event.data.user,
      accessToken: event.data.token || event.data.accessToken || '',
      refreshToken: event.data.refreshToken || null
    } : null);

    if (!rawSession || !rawSession.user) return;
    const accessToken = rawSession.accessToken || rawSession.token || event.data.token || '';
    if (!accessToken || accessToken === lastForwardedAuthToken) return;
    lastForwardedAuthToken = accessToken;

    const entitlement = event.data.entitlement || rawSession.entitlement || null;
    const enrichedSession = {
      ...rawSession,
      accessToken,
      token: accessToken,
      ...(entitlement ? { entitlement } : {}),
      portalOrigin: rawSession.portalOrigin || event.data.portalOrigin || window.location.origin
    };

    logger.log('Received auth success event from web portal:', enrichedSession.user?.email);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'AUTH_SUCCESS',
        action: 'SAVE_AUTH_SESSION',
        session: enrichedSession,
        entitlement,
        token: accessToken,
        user: enrichedSession.user
      }).catch(() => {});
    }
  });

  // Simple form filler
  const formFiller = {
    findForms() {
      const forms = document.querySelectorAll('form');
      logger.log(`Found ${forms.length} forms`);
      
      const formData = [];
      forms.forEach((form, index) => {
        const fields = [];
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
          if (input.type !== 'hidden' && input.type !== 'submit' && input.type !== 'button') {
            fields.push({
              name: input.name || input.id || '',
              type: input.type || 'text',
              label: this.getFieldLabel(input),
              element: input
            });
          }
        });
        
        if (fields.length > 0) {
          formData.push({
            index: index,
            element: form,
            fields: fields
          });
        }
      });
      
      return formData;
    },

    getFieldLabel(input) {
      if (!input) return '';
      // 1. Standard HTML5 associated label
      if (input.labels && input.labels.length > 0) {
        const text = Array.from(input.labels).map(l => l.textContent || '').join(' ').trim();
        if (text) return text;
      }
      // 2. label[for=id]
      if (input.id) {
        try {
          const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (l && l.textContent) return l.textContent.trim();
        } catch (e) {}
      }
      // 3. aria-label or aria-labelledby
      if (input.getAttribute('aria-label')) {
        return input.getAttribute('aria-label').trim();
      }
      const labelledBy = input.getAttribute('aria-labelledby');
      if (labelledBy) {
        const ids = labelledBy.split(/\s+/);
        const text = ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
        if (text) return text;
      }
      // 4. Wrapping <label>
      const wrappingLabel = input.closest('label');
      if (wrappingLabel) {
        const clone = wrappingLabel.cloneNode(true);
        clone.querySelectorAll('input, textarea, select, button').forEach(n => n.remove());
        const t = clone.textContent.trim();
        if (t) return t;
      }
      // 5. Preceding sibling label or heading
      let prev = input.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'LABEL' || prev.classList?.contains('label') || prev.querySelector('label')) {
          const lbl = prev.tagName === 'LABEL' ? prev : prev.querySelector('label');
          if (lbl && lbl.textContent) return lbl.textContent.trim();
        }
        if (/^H[1-6]$/.test(prev.tagName) || (prev.matches && prev.matches('[class*="label"], [class*="title"], [class*="Label"]'))) {
          return prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
      }
      // 6. Preceding sibling of input wrappers across ancestor tree (Tailwind / React layouts)
      let curr = input.parentElement;
      let depth = 0;
      while (curr && depth < 4 && curr.tagName !== 'FORM' && curr.tagName !== 'BODY') {
        let p = curr.previousElementSibling;
        while (p) {
          if (p.tagName === 'LABEL' || p.querySelector('label')) {
            const lbl = p.tagName === 'LABEL' ? p : p.querySelector('label');
            if (lbl && lbl.textContent) return lbl.textContent.trim();
          }
          if (/^H[1-6]$/.test(p.tagName) || (p.matches && p.matches('[class*="label"], [class*="title"], [class*="Label"], [class*="header"]'))) {
            return p.textContent.trim();
          }
          p = p.previousElementSibling;
        }
        const candidateLabel = curr.querySelector('label, [class*="label"], [class*="title"], [class*="Label"]');
        if (candidateLabel && !candidateLabel.contains(input)) {
          const inputsInCurr = curr.querySelectorAll('input, textarea, select');
          if (inputsInCurr.length === 1 && candidateLabel.textContent) {
            return candidateLabel.textContent.trim();
          }
        }
        curr = curr.parentElement;
        depth++;
      }
      // 7. data-label, placeholder, name, or id
      return input.getAttribute('data-label') || input.placeholder || input.name || input.id || '';
    },

    async fillForm(form, formData) {
      logger.log('Filling form with data:', formData);
      
      let filledCount = 0;
      const errors = [];
      
      for (const field of form.fields) {
        try {
          const value = this.getFieldValue(field, formData);
          if (value) {
            const success = await this.setFieldValue(field.element, value);
            if (success) {
              filledCount++;
              logger.log(`✅ Filled ${field.name} with ${value}`);
            } else {
              errors.push(`Failed to set value for field: ${field.name}`);
            }
          }
        } catch (error) {
          errors.push(`Error filling ${field.name}: ${error.message}`);
        }
      }
      
      logger.log(`Fill Results: ${filledCount} filled, ${errors.length} errors out of ${form.fields.length} total`);
      if (errors.length > 0) {
        logger.warn('Errors encountered:', errors);
      }
      
      return {
        success: filledCount > 0,
        filled: filledCount,
        errors: errors,
        message: `Filled ${filledCount} fields successfully`
      };
    },

    getFieldValue(field, formData, isAiMode = false) {
      const fieldName = (field.name || '').toLowerCase();
      const fieldLabel = (field.label || '').toLowerCase();
      const fieldType = field.type;
      
      if (isAiMode) {
        return this.getAiFieldValue(field);
      }

      // Direct matches from custom data
      if (formData.name && (fieldName.includes('name') || fieldLabel.includes('name') || fieldName.includes('author') || fieldLabel.includes('author'))) {
        return formData.name;
      }
      if (formData.email && (fieldName.includes('email') || fieldLabel.includes('email') || fieldType === 'email')) {
        return formData.email;
      }
      if (formData.phone && (fieldName.includes('phone') || fieldLabel.includes('phone') || fieldName.includes('tel') || fieldLabel.includes('tel') || fieldType === 'tel')) {
        return formData.phone;
      }
      if (formData.company && (fieldName.includes('company') || fieldLabel.includes('company') || fieldName.includes('org') || fieldLabel.includes('org') || fieldName.includes('business'))) {
        return formData.company;
      }
      if (formData.website && (fieldName.includes('website') || fieldName.includes('url') || fieldLabel.includes('website') || fieldLabel.includes('url') || fieldType === 'url')) {
        return formData.website;
      }
      if (formData.message && (fieldName.includes('message') || fieldName.includes('comment') || fieldName.includes('inquiry') || fieldName.includes('note') || fieldType === 'textarea')) {
        return formData.message;
      }
      if (formData.subject && (fieldName.includes('subject') || fieldLabel.includes('subject') || fieldName.includes('topic') || fieldName.includes('title'))) {
        return formData.subject;
      }
      
      // Fallback for budget/calculator/number fields if financial detection is on
      if (fieldType === 'number' || fieldName.includes('amount') || fieldName.includes('income')) {
        return '50000';
      }

      return null;
    },

    getAiFieldValue(field) {
      const combined = ((field.name || '') + ' ' + (field.label || '')).toLowerCase();
      const type = field.type;
      if (type === 'email' || combined.includes('email')) return 'contact@outreachpartner.com';
      if (type === 'tel' || combined.includes('phone') || combined.includes('tel')) return '(555) 789-2041';
      if (combined.includes('company') || combined.includes('org') || combined.includes('business')) return 'Nexus Marketing Group';
      if (combined.includes('website') || combined.includes('url') || type === 'url') return 'https://nexusmarketing.example.com';
      if (combined.includes('subject') || combined.includes('title') || combined.includes('topic')) return 'Exploring Growth & Partnership Opportunities';
      if (type === 'textarea' || combined.includes('message') || combined.includes('comment') || combined.includes('inquiry')) {
        return 'Hi there, we would love to connect regarding potential collaboration opportunities and learn more about your services. Best regards!';
      }
      if (combined.includes('first') && combined.includes('name')) return 'Sarah';
      if (combined.includes('last') && combined.includes('name')) return 'Jenkins';
      if (combined.includes('name')) return 'Sarah Jenkins';
      if (combined.includes('income') || combined.includes('salary')) return '75000';
      if (combined.includes('expense') || combined.includes('cost')) return '2400';
      if (combined.includes('rate') || combined.includes('percent')) return '5.5';
      if (combined.includes('budget') || combined.includes('amount')) return '10000';
      if (type === 'number') return '1500';
      return 'Test Inquiry';
    },

    async safeSetRichTextContent(element, value, options = {}) {
      if (!element) return false;
      let strVal = String(value ?? '').trim();

      // Ensure spin syntax is resolved
      if (typeof universalEngine !== 'undefined' && universalEngine.spinText) {
        strVal = universalEngine.spinText(strVal);
      }

      // Hardcoded Posting Rules (managed in /POSTING_RULES.md):
      // - Universal Post/Fill Rules: trimmed string (above)
      // - Twitter / X: While commenting on Twitter, don't use 'https://' as domain.com works fine
      const host = window.location.hostname.toLowerCase();
      if (host.includes('twitter.com') || host.includes('x.com')) {
        strVal = strVal.replace(/https?:\/\/([^\s/$.?#].[^\s]*)/gi, '$1');
      }
      // - Pinterest: add hardcoded Pinterest rules from POSTING_RULES.md here

      let targetEl = element;

      // Lazy composer expansion via synced selector recipe (if current host has placeholders)
      const matchedRecipe = findRecipeByHost(cachedSelectorRecipes.platforms, host);
      if (matchedRecipe?.recipe && Array.isArray(matchedRecipe.recipe.placeholders) && matchedRecipe.recipe.placeholders.length > 0) {
        let recipeEditor = queryFirstSelector(matchedRecipe.recipe.composers);
        if (!recipeEditor) {
          const isPlaceholderTarget = matchedRecipe.recipe.placeholders.some((sel) => {
            try { return targetEl.matches?.(sel) || Boolean(targetEl.closest?.(sel)); } catch (_) { return false; }
          });
          const trigger = isPlaceholderTarget ? targetEl : queryFirstSelector(matchedRecipe.recipe.placeholders);
          if (trigger) {
            try {
              trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
              trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              trigger.click();
              trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              trigger.focus?.();
              for (let i = 0; i < 18; i++) {
                await new Promise(r => setTimeout(r, 100));
                recipeEditor = queryFirstSelector(matchedRecipe.recipe.composers);
                if (recipeEditor) break;
              }
            } catch (_) {}
          }
        }
        if (recipeEditor) targetEl = recipeEditor;
      }

      // Look for inner contenteditable if targetEl is a container
      if (!targetEl.isContentEditable && targetEl.tagName !== 'TEXTAREA' && targetEl.tagName !== 'INPUT') {
        const innerEditable = targetEl.querySelector?.('div[contenteditable="true"], span[contenteditable="true"], [contenteditable="true"], textarea, input[type="text"], [role="textbox"]');
        if (innerEditable) targetEl = innerEditable;
      }

      try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      try { targetEl.focus(); } catch (_) {}

      // Case 1: Standard Input / Textarea
      if (targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'INPUT') {
        try { targetEl.select(); } catch (_) {}

        const isTextarea = targetEl.tagName === 'TEXTAREA';
        const windowProto = isTextarea ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
        const nativeProtoSetter = windowProto ? Object.getOwnPropertyDescriptor(windowProto, 'value')?.set : null;
        const proto = Object.getPrototypeOf(targetEl);
        const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        const ownSetter = Object.getOwnPropertyDescriptor(targetEl, 'value')?.set;

        if (nativeProtoSetter) {
          nativeProtoSetter.call(targetEl, strVal);
        } else if (protoSetter && ownSetter !== protoSetter) {
          protoSetter.call(targetEl, strVal);
        } else if (ownSetter) {
          ownSetter.call(targetEl, strVal);
        } else {
          targetEl.value = strVal;
        }

        if (targetEl._valueTracker) {
          try { targetEl._valueTracker.setValue(''); } catch (_) {}
        }

        try {
          targetEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: strVal }));
        } catch (_) {
          targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
        targetEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        try { targetEl.focus(); } catch (_) {}
        return true;
      }

      // Case 2: ContentEditable (Twitter Draft.js, Pinterest Slate/React, YouTube Polymer, Reddit, Facebook/Instagram Lexical, etc.)
      targetEl.focus();

      const isDraftJsEditor = Boolean(
        targetEl.classList?.contains('public-DraftEditor-content') ||
        targetEl.closest?.('.public-DraftEditor-content, .DraftEditor-root') ||
        host.includes('twitter.com') ||
        host.includes('x.com')
      );

      // Dedicated Draft.js Atomic Clipboard Paste Handler:
      if (isDraftJsEditor) {
        const now = Date.now();
        if (window.__tbTwitterLastInsertTime && (now - window.__tbTwitterLastInsertTime < 1500)) {
          logger.log('[Draft.js Guard] Debounced duplicate insertion within 1500ms');
          this.findAndFocusSubmitButton(targetEl);
          return true;
        }
        window.__tbTwitterLastInsertTime = now;

        const recipeComposers = findRecipeByHost(cachedSelectorRecipes.platforms, host)?.recipe?.composers || [];
        const twEditable = targetEl.classList?.contains('public-DraftEditor-content')
          ? targetEl
          : (targetEl.querySelector?.('.public-DraftEditor-content[contenteditable="true"]') ||
             queryFirstSelector(recipeComposers, targetEl) ||
             (targetEl.isContentEditable ? targetEl : targetEl.querySelector?.('[contenteditable="true"]') || targetEl));

        try { twEditable.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        try { twEditable.focus(); } catch (_) {}

        // Step 1: Purge any raw unmanaged DOM text nodes (removes undeletable ghost text left by execCommand)
        try {
          Array.from(twEditable.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.remove();
            }
          });
        } catch (_) {}

        // Step 2: Select all existing content using Draft.js keyboard event + window selection
        // This ensures Draft.js's internal EditorState selection spans the entire document
        try {
          const isMac = (navigator.platform || '').toLowerCase().includes('mac');
          twEditable.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            keyCode: 65,
            which: 65,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          }));

          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(twEditable);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (_) {}

        // Step 3: Dispatch ONE single atomic ClipboardEvent('paste') with DataTransfer
        // Draft.js natively handles editOnPaste(): it replaces the entire selection cleanly inside
        // React's immutable ContentState, creates zero unmanaged DOM nodes, activates the Reply button,
        // formats link entities (e.g. focusgummies.co), and produces a single undoable, deletable block.
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', strVal);
          const pasteEvt = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          twEditable.dispatchEvent(pasteEvt);
        } catch (pasteErr) {
          logger.warn('Twitter synthetic paste error:', pasteErr);
        }

        // Strictly NO document.execCommand('insertText') and NO synthetic input/change events!
        // Draft.js's React state reconciles naturally in the next render frame.

        try { twEditable.focus(); } catch (_) {}
        this.findAndFocusSubmitButton(twEditable);
        return true;
      }

      // Check if burst-typing simulation is requested for other platforms (Phase 2: 3-5 word bursts with 80-180ms pauses)
      const shouldBurstType = Boolean(
        options.simulateKeystrokes ||
        options.burstTyping ||
        (typeof window !== 'undefined' && window.__traffic_builder_simulate_keystrokes)
      );

      if (shouldBurstType) {
        return await this.burstTypeIntoElement(targetEl, strVal);
      }

      // Clear any existing text cleanly via scoped range selection so we don't break Slate block wrappers
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}

      // Method 1: document.execCommand('insertText') for non-Twitter editors
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, strVal);
      } catch (_) {
        inserted = false;
      }

      // Method 2: Synthetic ClipboardEvent('paste') with DataTransfer (ideal for Slate.js / Pinterest / ProseMirror)
      if (!inserted) {
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', strVal);
          const pasteEvt = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          targetEl.dispatchEvent(pasteEvt);
          if (targetEl.innerText?.includes(strVal) || targetEl.textContent?.includes(strVal)) {
            inserted = true;
          }
        } catch (_) {}
      }

      // Method 3: beforeinput fallback
      if (!inserted) {
        try {
          const inputEvt = new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: strVal
          });
          targetEl.dispatchEvent(inputEvt);
        } catch (_) {}
      }

      // Dispatch lightweight input notification for generic framework listeners
      try {
        targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      } catch (_) {}

      // Place cursor at the end so text is immediately and comfortably editable
      try {
        const sel = window.getSelection();
        if (sel && targetEl) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}

      try { targetEl.focus(); } catch (_) {}
      this.findAndFocusSubmitButton(targetEl);
      return true;
    },

    async burstTypeIntoElement(targetEl, text) {
      if (!targetEl || !text) return false;
      try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      try { targetEl.focus(); } catch (_) {}

      // Handle standard inputs/textareas
      if (targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'INPUT') {
        try { targetEl.value = ''; } catch (_) {}
        const words = text.split(/(\s+)/);
        const bursts = [];
        let currentBurst = '';
        let wordCount = 0;
        let targetWords = Math.floor(Math.random() * 3) + 3; // 3-5 words

        for (let i = 0; i < words.length; i++) {
          const token = words[i];
          currentBurst += token;
          if (/\S+/.test(token)) wordCount++;
          if (wordCount >= targetWords || i === words.length - 1) {
            if (currentBurst) {
              bursts.push(currentBurst);
              currentBurst = '';
              wordCount = 0;
              targetWords = Math.floor(Math.random() * 3) + 3;
            }
          }
        }

        let accumulated = '';
        for (let i = 0; i < bursts.length; i++) {
          accumulated += bursts[i];
          targetEl.value = accumulated;
          targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          if (i < bursts.length - 1) {
            const pause = Math.floor(80 + Math.random() * 100);
            await new Promise(r => setTimeout(r, pause));
          }
        }
        targetEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        try { targetEl.focus(); } catch (_) {}
        this.findAndFocusSubmitButton(targetEl);
        return true;
      }

      // ContentEditable burst typing
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}

      const words = text.split(/(\s+)/);
      const bursts = [];
      let currentBurst = '';
      let wordCount = 0;
      let targetWords = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < words.length; i++) {
        const token = words[i];
        currentBurst += token;
        if (/\S+/.test(token)) wordCount++;
        if (wordCount >= targetWords || i === words.length - 1) {
          if (currentBurst) {
            bursts.push(currentBurst);
            currentBurst = '';
            wordCount = 0;
            targetWords = Math.floor(Math.random() * 3) + 3;
          }
        }
      }

      for (let i = 0; i < bursts.length; i++) {
        const burst = bursts[i];
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, burst);
        } catch (_) {
          inserted = false;
        }

        if (!inserted) {
          try {
            const dt = new DataTransfer();
            dt.setData('text/plain', burst);
            const pasteEvt = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dt
            });
            targetEl.dispatchEvent(pasteEvt);
          } catch (_) {}
        }

        try {
          targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        } catch (_) {}

        if (i < bursts.length - 1) {
          const pause = Math.floor(80 + Math.random() * 100); // 80ms - 180ms
          await new Promise(r => setTimeout(r, pause));
        }
      }

      // Keep cursor active at end of input box
      try {
        const sel = window.getSelection();
        if (sel && targetEl) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}

      try { targetEl.focus(); } catch (_) {}
      this.findAndFocusSubmitButton(targetEl);

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'markOpportunityInjected',
            url: window.location.href,
            variationUsed: String(value).substring(0, 100)
          }).catch(() => {});
        }
      } catch (_) {}

      return true;
    },

    findAndFocusSubmitButton(editorElement) {
      try {
        if (!editorElement) return null;
        const host = window.location.hostname.toLowerCase();
        let submitBtn = null;

        // 1. Recipe-driven platform submit/reply button selectors
        const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);
        if (matched?.recipe?.submitButtons?.length) {
          submitBtn = queryFirstSelector(matched.recipe.submitButtons);
        }

        // 2. Generic parent container search if recipe selector didn't match
        if (!submitBtn) {
          const container = editorElement.closest('form, [role="region"], article, div');
          if (container) {
            const btns = container.querySelectorAll('button[type="submit"], input[type="submit"], button, div[role="button"]');
            for (const b of btns) {
              if (b.type === 'hidden' || b.style.display === 'none') continue;
              const text = (b.textContent || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
              if (/^(reply|comment|post|send|submit|tweet|share)$/i.test(text) || text.includes('reply') || text.includes('comment') || text.includes('post')) {
                submitBtn = b;
                break;
              }
            }
          }
        }

        if (!submitBtn && cachedSelectorRecipes.generic?.submitButtons?.length) {
          submitBtn = queryFirstSelector(cachedSelectorRecipes.generic.submitButtons);
        }

        if (submitBtn) {
          // Human-in-the-loop: when user clicks native submit button, mark thread as posted
          submitBtn.addEventListener('click', () => {
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                  type: 'markOpportunityPosted',
                  url: window.location.href
                }).catch(() => {});
              }
            } catch (_) {}
          }, { once: true });

          setTimeout(() => {
            try {
              submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Apply gentle guiding pulse/glow
              const origBoxShadow = submitBtn.style.boxShadow;
              const origTransition = submitBtn.style.transition;
              submitBtn.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
              submitBtn.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.45)';
              submitBtn.style.borderColor = '#3b82f6';
              
              setTimeout(() => {
                try {
                  submitBtn.style.boxShadow = origBoxShadow;
                  submitBtn.style.transition = origTransition;
                  submitBtn.style.borderColor = '';
                } catch (_) {}
              }, 1800);
            } catch (_) {}
          }, 120);

          return submitBtn;
        }
      } catch (e) {
        logger.warn('Error focusing submit button:', e);
      }
      return null;
    },

    async setFieldValue(element, value) {
      try {
        if (!element || value === null || value === undefined) return false;

        // Focus field first
        try { element.focus(); } catch (e) {}

        if (element.tagName === 'SELECT') {
          const valLower = String(value).toLowerCase();
          let matched = false;
          for (let i = 0; i < element.options.length; i++) {
            const optText = (element.options[i].text || '').toLowerCase();
            const optVal = (element.options[i].value || '').toLowerCase();
            if (optText.includes(valLower) || valLower.includes(optText) || optVal === valLower) {
              element.selectedIndex = i;
              matched = true;
              break;
            }
          }
          if (!matched && element.options.length > 1) {
            // Pick first non-empty option if no exact match
            for (let i = 1; i < element.options.length; i++) {
              if (element.options[i].value) {
                element.selectedIndex = i;
                matched = true;
                break;
              }
            }
          }
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (element.type === 'checkbox' || element.type === 'radio') {
          const proto = Object.getPrototypeOf(element);
          const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
          if (setter) {
            setter.call(element, true);
          } else {
            element.checked = true;
          }
          element.dispatchEvent(new Event('click', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (element.type === 'file') {
          const valStr = String(value || '');
          if (!valStr.startsWith('data:')) return false;
          try {
            const arr = valStr.split(',');
            const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png';
            const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const filename = `asset.${ext === 'jpeg' ? 'jpg' : ext}`;
            const file = new File([u8arr], filename, { type: mime });
            const dt = new DataTransfer();
            dt.items.add(file);
            element.files = dt.files;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (fileErr) {
            logger.warn('File input DataTransfer failed:', fileErr);
            return false;
          }
        } else {
          await this.safeSetRichTextContent(element, value);
        }
        
        // Visual indicator on actual editable element
        const highlightEl = element.isContentEditable ? element : (element.querySelector?.('[contenteditable="true"]') || element);
        if (highlightEl && highlightEl.style) {
          highlightEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          highlightEl.style.borderColor = '#48bb78';
          highlightEl.style.boxShadow = '0 0 0 3px rgba(72, 187, 120, 0.35)';
          
          setTimeout(() => {
            if (highlightEl && highlightEl.style) {
              highlightEl.style.borderColor = '';
              highlightEl.style.boxShadow = '';
            }
          }, 2500);
        }

        return true;
      } catch (error) {
        logger.error('Error setting field value:', error);
        return false;
      }
    },

    cleanProductName(raw) {
      if (!raw) return 'MyProduct';
      // Strip emojis
      let clean = String(raw).replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');
      // Strip trailing slogans, dashes, pipes, bullets
      clean = clean.split(/\s*[-–—|:•]\s*/)[0].trim();
      return clean.substring(0, 40).trim();
    },

    truncateAtWord(str, maxLen) {
      if (!str || str.length <= maxLen) return str || '';
      const sub = str.substring(0, maxLen);
      const spaceIdx = sub.lastIndexOf(' ');
      if (spaceIdx > maxLen * 0.6) {
        return sub.substring(0, spaceIdx).trim();
      }
      return sub.trim();
    },

    detectFieldCharLimit(field) {
      const el = field.element;
      if (!el) return null;

      if (el.maxLength && el.maxLength > 0 && el.maxLength < 5000) {
        return el.maxLength;
      }
      const dataMax = el.getAttribute('data-max') || el.getAttribute('data-maxlength') || el.getAttribute('data-max-chars');
      if (dataMax && !isNaN(parseInt(dataMax, 10))) {
        return parseInt(dataMax, 10);
      }

      // Check label, placeholder, or parent text for limits (e.g. "max 40", "60 chars", "40/60", "75/40")
      const textToScan = `${field.label || ''} ${el.placeholder || ''} ${el.parentElement?.textContent || ''}`;
      const m = textToScan.match(/(\d+)\s*(?:chars?|characters?|max|limit)|\/(\d+)/i);
      if (m) {
        const val = parseInt(m[1] || m[2], 10);
        if (val > 0 && val < 2000) return val;
      }
      return null;
    },

    getDirectoryFieldValue(field, data) {
      const el = field.element;
      const fieldName = (field.name || el?.name || el?.id || '').toLowerCase();
      const rawLabel = (field.label || '').toLowerCase();
      // Clean label: remove asterisks, colons, required badges, counters like 637 / 1500
      const fieldLabel = rawLabel.replace(/\*|:|\([a-z\s]+\)|\d+\s*\/\s*\d+/gi, '').trim();
      const fieldType = (field.type || el?.type || '').toLowerCase();
      const fieldPlaceholder = (el?.placeholder || el?.getAttribute?.('placeholder') || '').toLowerCase();
      const ariaLabel = (el?.getAttribute?.('aria-label') || '').toLowerCase();
      const dataAttrs = `${el?.getAttribute?.('data-name') || ''} ${el?.getAttribute?.('data-field') || ''} ${el?.getAttribute?.('data-testid') || ''}`.toLowerCase();
      
      // Look only at immediate container text (if container has <= 1 input) to prevent false positives from neighboring fields
      let containerText = '';
      let parent = el?.parentElement;
      for (let i = 0; i < 3 && parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY'; i++) {
        const otherInputs = parent.querySelectorAll('input, textarea, select');
        if (otherInputs.length <= 1) {
          containerText = (parent.textContent || '').toLowerCase().substring(0, 150);
        } else {
          break;
        }
        parent = parent.parentElement;
      }
      containerText = containerText.replace(/\*|:|\([a-z\s]+\)|\d+\s*\/\s*\d+/gi, '').trim();

      const combined = `${fieldName} ${fieldLabel} ${fieldPlaceholder} ${ariaLabel} ${dataAttrs} ${containerText}`;

      const rawName = data.productName || data.name || 'ContactFormSubmitter';
      const cleanName = this.cleanProductName(rawName);

      // Intelligent multi-field rotation from enabled entries only:
      if (!this._dirRotations) this._dirRotations = { tagline: 0, pitch: 0, summary: 0, desc: 0 };
      const getRotatedValue = (items, fallback, key) => {
        if (Array.isArray(items) && items.length > 0) {
          const enabled = items.filter(i => i && i.enabled !== false && typeof i.text === 'string' && i.text.trim());
          if (enabled.length > 0) {
            const idx = (this._dirRotations[key] || 0) % enabled.length;
            return enabled[idx].text.trim();
          }
        }
        return fallback || '';
      };

      const tagline = getRotatedValue(data.taglines, data.tagline || data.elevatorPitch || 'Automated Outreach & Directory Submission Suite', 'tagline');
      const pitch = getRotatedValue(data.pitches, data.elevatorPitch || data.tagline || 'Intelligent form filler and directory submitter', 'pitch');
      const summary = getRotatedValue(data.summaries, data.mediumSummary || data.elevatorPitch || data.tagline || 'ContactFormSubmitter & Directory Suite is an all-in-one growth acceleration toolkit for startups.', 'summary');
      const desc = getRotatedValue(data.descriptions, data.longDescription || data.description || data.shortDescription || `${cleanName} helps founders and agencies blast contact forms and submit to top product directories.`, 'desc');

      let website = data.websiteUrl || data.website || (data.urls && data.urls.websiteUrl) || 'https://contact-form-site-mu.vercel.app';
      if (website && !website.startsWith('http://') && !website.startsWith('https://')) {
        website = `https://${website}`;
      }
      let demo = data.demoUrl || (data.urls && data.urls.demoUrl) || website;
      if (demo && !demo.startsWith('http://') && !demo.startsWith('https://')) {
        demo = `https://${demo}`;
      }

      const category = data.primaryCategory || data.category || 'Marketing & Sales';
      const pricing = data.pricingType || data.pricingModel || 'Freemium';
      const price = data.startingPrice || data.pricingStartsAt || '$29';
      const logo = data.logoUrl || (data.assets && data.assets.logoUrl) || 'https://contact-form-site-mu.vercel.app/logo.png';
      const favicon = data.faviconUrl || (data.assets && data.assets.faviconUrl) || 'https://contact-form-site-mu.vercel.app/favicon.png';
      const makerName = data.makerName || (data.maker && data.maker.name) || 'Founder';
      const makerEmail = data.makerEmail || (data.maker && data.maker.email) || data.email || 'founder@growthsuite.io';
      const makerTwitter = data.makerTwitter || (data.maker && data.maker.twitter) || '@growthsuite';

      // 1. SELECT elements: category & pricing
      if (field.element && field.element.tagName === 'SELECT') {
        const options = Array.from(field.element.options || []);
        if (combined.includes('category') || combined.includes('topic') || combined.includes('niche') || combined.includes('tag')) {
          const cat = (data.category || 'Marketing & Sales').toLowerCase();
          const matchedOpt = options.find(o => {
            const txt = (o.text || o.value || '').toLowerCase();
            return txt.includes(cat) || cat.includes(txt) ||
              (cat.includes('marketing') && (txt.includes('marketing') || txt.includes('sales') || txt.includes('growth'))) ||
              (cat.includes('ai') && (txt.includes('ai') || txt.includes('intelligence') || txt.includes('machine'))) ||
              (cat.includes('developer') && (txt.includes('dev') || txt.includes('code') || txt.includes('api'))) ||
              (cat.includes('saas') && (txt.includes('saas') || txt.includes('productivity') || txt.includes('software')));
          });
          if (matchedOpt) return matchedOpt.value;
        }
        if (combined.includes('pricing') || combined.includes('price') || combined.includes('model') || combined.includes('plan')) {
          const pr = (data.pricingModel || 'Freemium').toLowerCase();
          const matchedOpt = options.find(o => {
            const txt = (o.text || o.value || '').toLowerCase();
            return txt.includes(pr) || pr.includes(txt) ||
              (pr.includes('free') && txt.includes('free')) ||
              (pr.includes('paid') && txt.includes('paid'));
          });
          if (matchedOpt) return matchedOpt.value;
        }
      }

      // 2. CHECKBOX auto-agreement (terms, rules, maker confirmation)
      if (field.element && field.element.type === 'checkbox') {
        if (combined.includes('terms') || combined.includes('agree') || combined.includes('guidelines') ||
            combined.includes('maker') || combined.includes('rules') || combined.includes('policy') || combined.includes('consent')) {
          return true;
        }
      }

      // 3. TEXTAREA or ContentEditable -> Description / Pitch
      const isTextareaOrEditor = field.element.tagName === 'TEXTAREA' || field.element.isContentEditable || fieldType === 'textarea';
      if (isTextareaOrEditor) {
        if (combined.includes('tagline') || combined.includes('short_pitch') || combined.includes('one_liner') || combined.includes('headline')) {
          return tagline;
        }
        if (combined.includes('elevator') || combined.includes('short_desc') || (combined.includes('pitch') && !combined.includes('long'))) {
          return pitch;
        }
        if (combined.includes('summary') || combined.includes('synopsis')) {
          return summary;
        }
        // Default for any textarea in directory listing is full Description
        return desc;
      }

      // 4. Character Limit Intelligence
      const detectedLimit = this.detectFieldCharLimit(field);

      // 5. TOOL / PRODUCT NAME (Crucial for directory submissions)
      // Matches "Tool name", "Product name", "App name", "Startup name", "Listing name", "Title", "Name of Tool"
      const isExplicitName = /(?:^|[^a-z])(?:tool\s*name|product\s*name|app\s*name|software\s*name|listing\s*name|project\s*name|startup\s*name|brand\s*name|tool)(?:$|[^a-z])/i.test(combined) ||
        fieldLabel === 'tool name' || fieldLabel === 'product name' || fieldLabel === 'name' || fieldLabel === 'title' || fieldLabel === 'tool' ||
        ((combined.includes('name') || combined.includes('title')) && 
         !combined.includes('user') && !combined.includes('maker') && !combined.includes('founder') && 
         !combined.includes('author') && !combined.includes('first') && !combined.includes('last') && 
         !combined.includes('tagline') && !combined.includes('desc') && !combined.includes('pitch') && !combined.includes('url') && !combined.includes('website'));

      if (isExplicitName && fieldType !== 'url' && fieldType !== 'email') {
        if (detectedLimit && detectedLimit < cleanName.length) {
          return this.truncateAtWord(cleanName, detectedLimit);
        }
        return cleanName;
      }

      // 6. TAGLINE / ONE-LINER
      // Matches "Tagline", "Catchphrase", "Punchline", "One-liner", "Headline", "Short description", "Subtitle", "Slogan"
      const isTagline = combined.includes('tagline') || combined.includes('punchline') || combined.includes('headline') || 
        combined.includes('one_liner') || combined.includes('one liner') || combined.includes('oneliner') ||
        combined.includes('short_pitch') || combined.includes('short_desc') || combined.includes('slogan') ||
        combined.includes('short description') || combined.includes('subtitle') || combined.includes('sub title');

      if (isTagline && fieldType !== 'url') {
        const val = tagline;
        return detectedLimit && val.length > detectedLimit ? this.truncateAtWord(val, detectedLimit) : val;
      }

      // 7. CUSTOM ADDITIONAL LINKS (matched by user-defined label)
      const customLinks = Array.isArray(data.customLinks) ? data.customLinks : [];
      if (customLinks.length > 0 && fieldType !== 'email' && fieldType !== 'file') {
        const matchedCustom = customLinks.find(link => {
          const rawLabel = (link && link.label ? String(link.label) : '').trim().toLowerCase();
          const rawUrl = (link && link.url ? String(link.url) : '').trim();
          if (!rawLabel || !rawUrl) return false;
          if (combined.includes(rawLabel)) return true;
          const tokens = rawLabel.split(/[^a-z0-9]+/).filter(t => t.length >= 3 && t !== 'url' && t !== 'link' && t !== 'page');
          return tokens.length > 0 && tokens.every(tok => new RegExp(`(?:^|[^a-z0-9])${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i').test(combined));
        });
        if (matchedCustom && matchedCustom.url) {
          let customUrl = String(matchedCustom.url).trim();
          if (customUrl && !customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
            customUrl = `https://${customUrl}`;
          }
          return customUrl;
        }
      }

      // 8. WEBSITE URL / PRODUCT LINK
      // Matches "Website URL", "Website", "Site URL", "Product URL", "Homepage", "Landing page", type="url"
      const isUrlField = fieldType === 'url' || 
        /(?:^|[^a-z])(?:website\s*url|website|site\s*url|product\s*url|target\s*url|landing\s*page|homepage|app\s*url)(?:$|[^a-z])/i.test(combined) ||
        (fieldPlaceholder && (fieldPlaceholder.startsWith('http://') || fieldPlaceholder.startsWith('https://') || fieldPlaceholder.includes('acme.com') || fieldPlaceholder.includes('.io')));

      if (isUrlField && !combined.includes('twitter') && !combined.includes('linkedin') && !combined.includes('github') && !combined.includes('demo') && !combined.includes('logo') && !combined.includes('favicon')) {
        return website;
      }

      // 9. SOCIAL & DEMO URLS
      if (combined.includes('twitter') || combined.includes('x.com') || combined.includes('x_handle')) {
        return makerTwitter;
      }
      if (combined.includes('demo') || combined.includes('video') || combined.includes('youtube') || combined.includes('loom')) {
        return demo;
      }

      // 9. LOGO / FAVICON / SCREENSHOTS
      if (combined.includes('favicon')) {
        if (fieldType === 'file') return favicon.startsWith('data:') ? favicon : null;
        return favicon.startsWith('data:') ? null : favicon;
      }
      if (combined.includes('logo') || combined.includes('icon') || combined.includes('avatar') || combined.includes('badge')) {
        if (fieldType === 'file') return logo.startsWith('data:') ? logo : null;
        return logo.startsWith('data:') ? null : logo;
      }
      if (combined.includes('screenshot') || combined.includes('preview_img') || combined.includes('slider') || combined.includes('slide')) {
        const screens = (data.slides && data.slides.map(s => s.url)) || data.screenshotUrls || (data.assets && data.assets.screenshotUrls) || [];
        const picked = screens.length > 0 ? screens[0] : logo;
        if (fieldType === 'file') return picked && picked.startsWith('data:') ? picked : null;
        return picked && picked.startsWith('data:') ? null : picked;
      }

      // 10. MAKER / FOUNDER INFO
      if (combined.includes('maker') || combined.includes('founder') || combined.includes('creator') || combined.includes('author')) {
        if (combined.includes('email') || fieldType === 'email') return makerEmail;
        if (combined.includes('twitter') || combined.includes('x_handle')) return makerTwitter;
        return makerName;
      }

      // 11. GENERIC EMAIL
      if (fieldType === 'email' || combined.includes('email')) {
        return makerEmail;
      }

      // 12. PRICING & CATEGORY
      if (combined.includes('pricing') || combined.includes('price') || combined.includes('plan') || combined.includes('tier') || combined.includes('model') || combined.includes('cost')) {
        return field.element.tagName === 'SELECT' ? pricing : `${pricing} (${price})`;
      }
      if (combined.includes('category') || combined.includes('topic') || combined.includes('tag') || combined.includes('niche') || combined.includes('industry')) {
        return category;
      }

      // 13. ELEVATOR PITCH & SUMMARY
      if (combined.includes('elevator') || combined.includes('pitch') || combined.includes('brief')) {
        const val = pitch;
        return detectedLimit && val.length > detectedLimit ? this.truncateAtWord(val, detectedLimit) : val;
      }
      if (combined.includes('summary') || combined.includes('synopsis') || combined.includes('medium_desc')) {
        const val = summary;
        return detectedLimit && val.length > detectedLimit ? this.truncateAtWord(val, detectedLimit) : val;
      }

      // 14. Fallback by character limits for generic text inputs
      if (detectedLimit !== null && fieldType === 'text') {
        let chosen = '';
        if (detectedLimit <= 40) {
          chosen = cleanName;
        } else if (detectedLimit <= 80) {
          chosen = tagline;
        } else if (detectedLimit <= 160) {
          chosen = pitch;
        } else if (detectedLimit <= 300) {
          chosen = summary;
        } else {
          chosen = desc;
        }
        return chosen.length > detectedLimit ? this.truncateAtWord(chosen, detectedLimit) : chosen;
      }

      // 15. Description / About fallback
      if (combined.includes('description') || combined.includes('about') || combined.includes('overview') || combined.includes('details') || combined.includes('body')) {
        return desc;
      }

      return null;
    },

    async fillDirectoryPageFields(directoryData, options = {}) {
      const allInputs = Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"]')).filter(input => {
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'reset') return false;
        if (input.disabled || input.readOnly) return false;
        const inNav = input.closest('header, nav, .navbar, .nav');
        if (inNav && (input.type === 'search' || (input.name && input.name.toLowerCase().includes('search')))) return false;
        return true;
      });

      const targetFields = allInputs.map(input => ({
        name: input.name || input.id || '',
        type: input.type || (input.tagName === 'TEXTAREA' ? 'textarea' : (input.isContentEditable ? 'contenteditable' : 'text')),
        label: this.getFieldLabel(input),
        element: input
      }));

      if (targetFields.length === 0) {
        return { filledCount: 0, total: 0, targetFields, filledSummary: [], errors: [] };
      }

      let filledCount = 0;
      const errors = [];
      const filledSummary = [];
      const filledKeys = new Set();
      const shortCandidates = Array.isArray(options.candidates) ? options.candidates.map(c => (c && c.text) || c).filter(Boolean) : [];

      for (const field of targetFields) {
        try {
          let val = this.getDirectoryFieldValue(field, directoryData);
          if (typeof val === 'string' && field.element && field.element.maxLength > 0 && val.length > field.element.maxLength) {
            const max = field.element.maxLength;
            const fitting = shortCandidates.filter(t => typeof t === 'string' && t.trim().length > 0 && t.length <= max);
            val = fitting.length > 0 ? fitting[Math.floor(Math.random() * fitting.length)] : this.truncateAtWord(val, max);
          }
          if (val !== null && val !== undefined && val !== '') {
            const ok = await this.setFieldValue(field.element, val);
            if (ok) {
              filledCount++;
              const labelDesc = field.label || field.name || field.type || 'input';
              filledSummary.push(labelDesc);
              const lblLower = labelDesc.toLowerCase();
              if (lblLower.includes('name') || lblLower.includes('title')) filledKeys.add('name');
              if (lblLower.includes('tagline') || lblLower.includes('punchline') || lblLower.includes('headline')) filledKeys.add('tagline');
              if (lblLower.includes('desc') || field.element.tagName === 'TEXTAREA' || field.element.isContentEditable) filledKeys.add('desc');
              if (lblLower.includes('url') || lblLower.includes('website') || lblLower.includes('link') || field.element.type === 'url') filledKeys.add('website');
              await new Promise(r => setTimeout(r, 30));
            }
          }
        } catch (err) {
          errors.push(err.message);
        }
      }

      // Intelligent 2nd-Pass: Ensure core 4 listing fields (Name, Tagline, Description, Website) are NEVER missed
      const rawName = directoryData.productName || directoryData.name;
      const cleanName = this.cleanProductName(rawName);
      const rawTagline = (directoryData.taglines && directoryData.taglines.find(t => t && t.enabled !== false && t.active !== false)?.text) || directoryData.tagline || '';
      const rawDesc = (directoryData.descriptions && directoryData.descriptions.find(d => d && d.enabled !== false && d.active !== false)?.text) || directoryData.longDescription || directoryData.description || '';
      const rawWebsite = directoryData.websiteUrl || directoryData.website || '';

      if (!filledKeys.has('name') && cleanName) {
        const candidate = targetFields.find(f => {
          const el = f.element;
          if (el.tagName !== 'INPUT' || (el.type && el.type !== 'text')) return false;
          if (el.value && el.value.trim().length > 0) return false;
          const lbl = (f.label || '').toLowerCase();
          return !lbl.includes('url') && !lbl.includes('link') && !lbl.includes('email') && !lbl.includes('tagline') && !lbl.includes('price');
        });
        if (candidate) {
          const max = candidate.element.maxLength > 0 ? candidate.element.maxLength : 0;
          const valToSet = max && cleanName.length > max ? this.truncateAtWord(cleanName, max) : cleanName;
          const ok = await this.setFieldValue(candidate.element, valToSet);
          if (ok) {
            filledCount++;
            filledKeys.add('name');
            filledSummary.push('Tool Name (Auto-Detected)');
          }
        }
      }

      if (!filledKeys.has('tagline') && rawTagline) {
        const candidate = targetFields.find(f => {
          const el = f.element;
          if (el.tagName !== 'INPUT' || (el.type && el.type !== 'text')) return false;
          if (el.value && el.value.trim().length > 0) return false;
          const lbl = (f.label || '').toLowerCase();
          const pl = (el.placeholder || '').toLowerCase();
          return lbl.includes('tagline') || lbl.includes('headline') || lbl.includes('slogan') || lbl.includes('pitch') || lbl.includes('one line') || pl.includes('tagline') || pl.includes('ship');
        });
        if (candidate) {
          const max = candidate.element.maxLength > 0 ? candidate.element.maxLength : 0;
          const valToSet = max && rawTagline.length > max ? this.truncateAtWord(rawTagline, max) : rawTagline;
          const ok = await this.setFieldValue(candidate.element, valToSet);
          if (ok) {
            filledCount++;
            filledKeys.add('tagline');
            filledSummary.push('Tagline (Auto-Detected)');
          }
        }
      }

      if (!filledKeys.has('desc') && rawDesc) {
        const candidate = targetFields.find(f => {
          const el = f.element;
          const isEditor = el.tagName === 'TEXTAREA' || el.isContentEditable;
          if (!isEditor) return false;
          const curVal = el.isContentEditable ? (el.textContent || '') : (el.value || '');
          return curVal.trim().length === 0;
        });
        if (candidate) {
          const max = candidate.element.maxLength > 0 ? candidate.element.maxLength : 0;
          const valToSet = max && rawDesc.length > max ? this.truncateAtWord(rawDesc, max) : rawDesc;
          const ok = await this.setFieldValue(candidate.element, valToSet);
          if (ok) {
            filledCount++;
            filledKeys.add('desc');
            filledSummary.push('Description (Auto-Detected)');
          }
        }
      }

      if (!filledKeys.has('website') && rawWebsite) {
        const candidate = targetFields.find(f => {
          const el = f.element;
          if (el.value && el.value.trim().length > 0) return false;
          if (el.type === 'url') return true;
          const lbl = (f.label || '').toLowerCase();
          const pl = (el.placeholder || '').toLowerCase();
          return lbl.includes('url') || lbl.includes('website') || lbl.includes('product link') || pl.includes('http') || pl.includes('acme.com');
        });
        if (candidate) {
          const ok = await this.setFieldValue(candidate.element, rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`);
          if (ok) {
            filledCount++;
            filledKeys.add('website');
            filledSummary.push('Website URL (Auto-Detected)');
          }
        }
      }

      if (filledCount > 0 && this._dirRotations) {
        this._dirRotations.tagline = (this._dirRotations.tagline || 0) + 1;
        this._dirRotations.pitch = (this._dirRotations.pitch || 0) + 1;
        this._dirRotations.summary = (this._dirRotations.summary || 0) + 1;
        this._dirRotations.desc = (this._dirRotations.desc || 0) + 1;
      }

      return {
        filledCount,
        total: targetFields.length,
        targetFields,
        filledSummary,
        errors
      };
    }
  };

  // ==========================================
  // PHASE 5: UNIVERSAL CONTEXT SNIFFER & POST ENGINE
  // ==========================================
  const universalEngine = {
    showToast(message, type = 'success') {
      try {
        let toast = document.getElementById('tb-universal-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'tb-universal-toast';
          toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 2147483647;
            padding: 10px 14px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.25s ease;
            pointer-events: none;
            max-width: 360px;
          `;
          document.body.appendChild(toast);
        }

        const bg = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
        toast.style.background = bg;
        toast.style.color = '#ffffff';
        toast.innerHTML = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(() => {
          if (toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
          }
        }, 3500);
      } catch (e) {
        logger.warn('Could not display on-page toast:', e);
      }
    },

    manualContextOverride: null,

    detectContext(options = {}) {
      const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
      if (!options?.ignoreOverride && this.manualContextOverride) {
        return {
          ...this.manualContextOverride,
          domain: host,
          manual: true
        };
      }

      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const fullUrlPath = `${pathname}${search}${hash}`;
      const pageTitle = (document.title || '').toLowerCase();
      const h1Text = (document.querySelector('h1')?.textContent || '').toLowerCase().trim();

      const isElVisible = (el) => {
        if (!el || el.type === 'hidden') return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const hasVisibleSelector = (selectors) => {
        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              if (isElVisible(el)) return true;
            }
          } catch (_) {}
        }
        return false;
      };

      const isSocialHost = (domains) => domains.some((d) => hostMatchesDomain(host, d));

      const directorySubmitRegex = /(submit[-_/]?(a[-_/]?)?(your[-_/]?)?(site|website|tool|ai[-_]?tool|product|startup|app|saas|software|listing|directory)|add[-_/]?(a[-_/]?)?(your[-_/]?)?(site|tool|product|startup|app|listing)|list[-_/]?(your[-_/]?)?(site|tool|product|startup|app)|get[-_/]?listed|new[-_/]?listing|directory[-_/]?submit)/i;
      const isDirectorySubmitPathOrTitle = directorySubmitRegex.test(fullUrlPath) || directorySubmitRegex.test(pageTitle) || directorySubmitRegex.test(h1Text);

      // =========================================================================
      // 1. DIRECT MESSAGE (DM) DETECTION
      // =========================================================================
      const activeEl = document.activeElement;
      const isFocusedOnTwitterReply = Boolean(
        activeEl && activeEl.closest && activeEl.closest('[data-testid^="tweetTextarea"], [data-testid="reply"]')
      );
      const NON_DM_GENERIC_SELECTORS = new Set([
        'div[role="textbox"]',
        'div[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea',
        'textarea[name="text"]',
        'input'
      ]);

      // Check recipe-driven DM surfaces (strict host + DM path OR strictly DM-scoped composer match)
      for (const [key, recipe] of Object.entries(cachedSelectorRecipes.dm || {})) {
        const hosts = Array.isArray(recipe?.hosts) ? recipe.hosts : [];
        if (!hosts.some((h) => hostMatchesDomain(host, h))) continue;
        const matchesPath = recipe?.pathIncludes ? fullUrlPath.includes(String(recipe.pathIncludes).toLowerCase()) : false;
        const strictComposers = Array.isArray(recipe?.composers)
          ? recipe.composers.filter((s) => s && !NON_DM_GENERIC_SELECTORS.has(String(s).trim().toLowerCase()))
          : [];
        const matchesComposer = (!isFocusedOnTwitterReply && strictComposers.length > 0)
          ? hasVisibleSelector(strictComposers)
          : false;
        if (matchesPath || matchesComposer) {
          return { type: 'dm', subtype: key, badgeText: 'Context: 💬 Direct Message', domain: host };
        }
      }

      // Platform-specific DM routes & active chat drawers
      if (isSocialHost(['twitter.com', 'x.com'])) {
        const onTwitterDmRoute = pathname.startsWith('/messages') || fullUrlPath.includes('/i/chat');
        const hasVisibleTwitterDmBox = !isFocusedOnTwitterReply && hasVisibleSelector([
          '[data-testid="dmComposerTextInput"]',
          '[data-testid="DMDrawer"] [data-testid="dmComposerTextInput"]',
          'div[role="textbox"][aria-label*="direct message" i]',
          'div[role="textbox"][aria-label*="Start a new message" i]'
        ]);
        if (onTwitterDmRoute || hasVisibleTwitterDmBox) {
          return { type: 'dm', subtype: 'twitter', badgeText: 'Context: 💬 X/Twitter DM', domain: host };
        }
      }
      if (isSocialHost(['messenger.com']) || (isSocialHost(['facebook.com', 'fb.com']) && (pathname.startsWith('/messages') || hasVisibleSelector([
        'div[role="dialog"] div[role="textbox"][aria-label*="Message" i]',
        'div[aria-label*="Conversation" i] div[role="textbox"]',
        'div[role="textbox"][aria-label="Aa"]'
      ])))) {
        return { type: 'dm', subtype: 'facebook', badgeText: 'Context: 💬 Messenger / FB DM', domain: host };
      }
      if (isSocialHost(['instagram.com']) && (pathname.startsWith('/direct') || hasVisibleSelector([
        'textarea[placeholder*="Message..." i]',
        'div[role="textbox"][aria-label*="Message" i]'
      ]))) {
        return { type: 'dm', subtype: 'instagram', badgeText: 'Context: 💬 Instagram DM', domain: host };
      }
      if (isSocialHost(['pinterest.*']) && (pathname.startsWith('/messages') || pathname.startsWith('/inbox') || hasVisibleSelector([
        '[data-test-id*="chat" i] textarea',
        '[data-test-id*="message" i] textarea',
        'textarea[placeholder*="Send a message" i]'
      ]))) {
        return { type: 'dm', subtype: 'pinterest', badgeText: 'Context: 💬 Pinterest DM', domain: host };
      }
      if (isSocialHost(['tiktok.com']) && (pathname.startsWith('/messages') || hasVisibleSelector([
        'div[data-e2e="message-input"] [contenteditable="true"]',
        'div[contenteditable="true"][placeholder*="Send a message" i]'
      ]))) {
        return { type: 'dm', subtype: 'tiktok', badgeText: 'Context: 💬 TikTok DM', domain: host };
      }
      if (isSocialHost(['linkedin.com']) && (pathname.startsWith('/messaging') || hasVisibleSelector([
        '.msg-form__contenteditable',
        '.msg-overlay-conversation-bubble div[role="textbox"]'
      ]))) {
        return { type: 'dm', subtype: 'linkedin', badgeText: 'Context: 💬 LinkedIn DM', domain: host };
      }
      if (isSocialHost(['reddit.com', 'chat.reddit.com']) && (host === 'chat.reddit.com' || pathname.startsWith('/chat') || pathname.startsWith('/message/compose') || pathname.startsWith('/message/messages'))) {
        return { type: 'dm', subtype: 'reddit', badgeText: 'Context: 💬 Reddit DM', domain: host };
      }
      if (isSocialHost(['quora.com']) && (pathname.startsWith('/messages') || hasVisibleSelector([
        '.modal_content_inner div[contenteditable="true"][aria-label*="message" i]'
      ]))) {
        return { type: 'dm', subtype: 'quora', badgeText: 'Context: 💬 Quora DM', domain: host };
      }
      if (isSocialHost(['threads.net', 'threads.com']) && (pathname.startsWith('/direct') || pathname.startsWith('/messages'))) {
        return { type: 'dm', subtype: 'threads', badgeText: 'Context: 💬 Threads DM', domain: host };
      }
      if (isSocialHost(['discord.com', 'discordapp.com']) && pathname.startsWith('/channels')) {
        return { type: 'dm', subtype: 'discord', badgeText: 'Context: 💬 Discord Message', domain: host };
      }
      if (isSocialHost(['app.slack.com', 'web.whatsapp.com', 'web.telegram.org'])) {
        return { type: 'dm', subtype: 'chat', badgeText: 'Context: 💬 Direct Message', domain: host };
      }
      // Generic DM / chat composer detection (must clearly signal direct/private message and not be inside a multi-field contact form)
      const genericDmField = document.querySelector(
        'textarea[placeholder*="direct message" i], textarea[placeholder*="send a message" i], textarea[aria-label*="direct message" i], div[role="textbox"][aria-label*="direct message" i], div[role="textbox"][aria-label*="send a message" i], div[contenteditable="true"][aria-placeholder*="send a message" i]'
      );
      if (genericDmField && isElVisible(genericDmField)) {
        const parentForm = genericDmField.closest('form');
        const formEmailOrName = parentForm?.querySelector('input[type="email"], input[name*="email" i], input[name*="name" i]');
        if (!formEmailOrName) {
          return { type: 'dm', subtype: 'generic_dm', badgeText: 'Context: 💬 Direct Message', domain: host };
        }
      }

      // =========================================================================
      // 2. NEW POST / NEW ARTICLE / NEW THREAD DETECTION -> ARTICLE
      // =========================================================================
      const isDirectoryHostOrSubmit = isDirectorySubmitPathOrTitle || (
        isSocialHost(['producthunt.com']) && pathname.startsWith('/posts/new')
      );

      if (!isDirectoryHostOrSubmit) {
        const isWpNewPost = /\/wp-admin\/(post-new|post)\.php/i.test(pathname) || Boolean(document.querySelector('.block-editor-writing-flow, .edit-post-visual-editor, #wpbody-content #titlewrap #title'));
        const isMediumEditor = isSocialHost(['medium.com']) && (/^\/(new-story|p\/[^/]+\/edit)/.test(pathname) || Boolean(document.querySelector('[data-testid="storyTitle"], h3.graf--title[contenteditable="true"]')));
        const isSubstackEditor = isSocialHost(['substack.com']) && (/\/publish\/post/.test(pathname) || Boolean(document.querySelector('[data-testid="post-editor"], .ProseMirror.editor')));
        const isGhostEditor = /\/ghost\/#\/editor\/(post|page)/.test(fullUrlPath) || Boolean(document.querySelector('.gh-editor-title'));
        const isDevToEditor = isSocialHost(['dev.to']) && (/^\/new\b/.test(pathname) || Boolean(document.querySelector('#article-form-title')));
        const isHashnodeEditor = isSocialHost(['hashnode.com']) && (/^\/(create\/story|edit)\b/.test(pathname));
        const isBloggerEditor = isSocialHost(['blogger.com']) && /\/blog\/post\/edit/.test(pathname);
        const isLinkedInArticle = isSocialHost(['linkedin.com']) && (/^\/(pulse\/new|article\/new)/.test(pathname) || Boolean(document.querySelector('.article-editor-headline')));
        const isRedditNewPost = isSocialHost(['reddit.com']) && (/\/submit\/?$/i.test(pathname) || /\/submit\b/i.test(pathname));
        const isForumNewThread = /(post-thread|create-thread|new-thread|new-topic|create-topic|create-post|new-post|new-article|create-article|write-article|write-post|compose-article)/i.test(fullUrlPath) ||
          /^(create (a )?(new )?(post|article|thread|topic)|new (post|article|thread|topic)|write (an )?(article|story))$/i.test(h1Text);

        if (isWpNewPost || isMediumEditor || isSubstackEditor || isGhostEditor || isDevToEditor || isHashnodeEditor || isBloggerEditor || isLinkedInArticle || isRedditNewPost || isForumNewThread) {
          return { type: 'article', subtype: 'article', badgeText: 'Context: 📰 New Article / Post', domain: host };
        }

        // Generic article editor DOM heuristic: visible title field + rich editor (not on social comment feed or directory form)
        const hasTitleInput = hasVisibleSelector([
          'input[placeholder*="title" i]',
          'textarea[placeholder*="title" i]',
          'h1[contenteditable="true"]',
          '[data-testid*="storyTitle" i]',
          '#article-form-title',
          '.gh-editor-title'
        ]);
        const hasRichBodyEditor = hasVisibleSelector([
          '.ProseMirror',
          '.ql-editor',
          '.tox-edit-area',
          'div.CodeMirror',
          'textarea[placeholder*="write your article" i]',
          'textarea[placeholder*="tell your story" i]',
          'textarea[placeholder*="post content" i]',
          'div[contenteditable="true"][aria-placeholder*="tell your story" i]'
        ]);
        if (hasTitleInput && hasRichBodyEditor) {
          return { type: 'article', subtype: 'article', badgeText: 'Context: 📰 New Article / Post', domain: host };
        }
      }

      // =========================================================================
      // 2b. SUPPORT DESK & ISSUE REPLY DETECTION -> SUPPORT
      // =========================================================================
      const supportHosts = [
        { key: 'zendesk', domains: ['zendesk.com'], label: 'Zendesk Support' },
        { key: 'freshdesk', domains: ['freshdesk.com'], label: 'Freshdesk Support' },
        { key: 'intercom', domains: ['app.intercom.com', 'intercom.io'], label: 'Intercom Inbox' },
        { key: 'helpscout', domains: ['secure.helpscout.net'], label: 'Help Scout' },
        { key: 'crisp', domains: ['app.crisp.chat'], label: 'Crisp Chat' },
        { key: 'front', domains: ['app.frontapp.com'], label: 'Front Inbox' }
      ];
      for (const sh of supportHosts) {
        if (isSocialHost(sh.domains)) {
          return { type: 'support', subtype: sh.key, badgeText: `Context: 🛟 ${sh.label}`, domain: host };
        }
      }
      if (isSocialHost(['github.com']) && /\/(issues|discussions)(\/|$)/.test(pathname)) {
        return { type: 'support', subtype: 'github', badgeText: 'Context: 🛟 GitHub Support', domain: host };
      }

      // =========================================================================
      // 2c. TOP-LEVEL SOCIAL POST COMPOSER -> SOCIAL_POST (Never on /status/ or /comments/)
      // =========================================================================
      if (isSocialHost(['twitter.com', 'x.com']) && !/\/status\//.test(pathname)) {
        const onComposeRoute = pathname.startsWith('/compose/post') || pathname.startsWith('/compose/tweet');
        const hasReplyDialog = Boolean(document.querySelector('div[role="dialog"] article[data-testid="tweet"]'));
        const hasMainPostBox = !hasReplyDialog && hasVisibleSelector(['[data-testid="tweetTextarea_0"]']);
        if (onComposeRoute || (hasMainPostBox && (pathname === '/home' || pathname === '/'))) {
          return { type: 'social_post', subtype: 'twitter', badgeText: 'Context: 📢 X New Post', domain: host };
        }
      }
      if (isSocialHost(['linkedin.com']) && !pathname.startsWith('/messaging') && !/^\/(pulse\/new|article\/new)/.test(pathname)) {
        if (hasVisibleSelector(['.share-creation-state__text-editor .ql-editor', '.share-creation-state__text-editor div[role="textbox"]', '.share-creation-state__text-editor'])) {
          return { type: 'social_post', subtype: 'linkedin', badgeText: 'Context: 💼 LinkedIn Post', domain: host };
        }
      }
      if (isSocialHost(['threads.net', 'threads.com']) && !/\/post\//.test(pathname) && !pathname.startsWith('/direct') && !pathname.startsWith('/messages')) {
        if (hasVisibleSelector(['div[role="dialog"] div[role="textbox"][contenteditable="true"]', 'div[role="dialog"] div[contenteditable="true"]'])) {
          return { type: 'social_post', subtype: 'threads', badgeText: 'Context: 🧵 Threads Post', domain: host };
        }
      }

      // =========================================================================
      // 3. SOCIAL MEDIA PLATFORMS -> COMMENTS (AUTOMATIC)
      // =========================================================================
      const socialPlatforms = [
        { key: 'twitter', domains: ['twitter.com', 'x.com'], badge: 'Context: 🐦 X/Twitter Reply' },
        { key: 'tiktok', domains: ['tiktok.com'], badge: 'Context: 🎵 TikTok Comment' },
        { key: 'youtube', domains: ['youtube.com', 'youtu.be'], badge: 'Context: 🎬 YouTube Comment' },
        { key: 'instagram', domains: ['instagram.com'], badge: 'Context: 📷 Instagram Comment' },
        { key: 'facebook', domains: ['facebook.com', 'fb.com'], badge: 'Context: 👥 Facebook Comment' },
        { key: 'threads', domains: ['threads.net', 'threads.com'], badge: 'Context: 🧵 Threads Reply' },
        { key: 'pinterest', domains: ['pinterest.*'], badge: 'Context: 📌 Pinterest Comment' },
        { key: 'reddit', domains: ['reddit.com'], badge: 'Context: 💬 Reddit Comment' },
        { key: 'quora', domains: ['quora.com'], badge: 'Context: ❓ Quora Answer' },
        { key: 'linkedin', domains: ['linkedin.com'], badge: 'Context: 💼 LinkedIn Comment' },
        { key: 'medium', domains: ['medium.com'], badge: 'Context: 📝 Medium Comment' },
        { key: 'bluesky', domains: ['bsky.app', 'blueskyweb.xyz'], badge: 'Context: 🦋 Bluesky Reply' }
      ];

      for (const sp of socialPlatforms) {
        if (isSocialHost(sp.domains)) {
          return { type: 'social', subtype: sp.key, badgeText: sp.badge, domain: host };
        }
      }

      // Check additional recipe-driven social platforms strictly by host (never by generic textbox selector!)
      for (const [key, recipe] of Object.entries(cachedSelectorRecipes.platforms || {})) {
        const hosts = Array.isArray(recipe?.hosts) ? recipe.hosts : [];
        if (hosts.some((h) => hostMatchesDomain(host, h))) {
          return {
            type: 'social',
            subtype: key,
            badgeText: recipe.badgeText || `Context: 💬 ${key.charAt(0).toUpperCase() + key.slice(1)} Comment`,
            domain: host
          };
        }
      }

      // =========================================================================
      // 4. BLOG COMMENTING SECTIONS (WordPress, Disqus, Facebook Comments, etc.) -> COMMENTS
      // =========================================================================
      const hasWpComment = Boolean(document.querySelector(
        '#commentform, form[action*="wp-comments-post.php"], .comment-respond #comment, textarea#comment, .comment-form textarea'
      ));
      if (hasWpComment) {
        return { type: 'social', subtype: 'wordpress', badgeText: 'Context: 💬 Blog Comment', domain: host };
      }

      const hasDisqus = Boolean(document.querySelector(
        '#disqus_thread, iframe[src*="disqus.com"], #dsq-content'
      ));
      if (hasDisqus) {
        return { type: 'social', subtype: 'disqus', badgeText: 'Context: 💬 Disqus Comment', domain: host };
      }

      const hasFbComments = Boolean(document.querySelector(
        '.fb-comments, iframe[src*="facebook.com/plugins/comments"], iframe[src*="facebook.com/v"][src*="plugins/comments"]'
      ));
      if (hasFbComments) {
        return { type: 'social', subtype: 'facebook_comments', badgeText: 'Context: 💬 Facebook Comments', domain: host };
      }

      const hasThirdPartyBlogComments = Boolean(document.querySelector(
        'hyvor-talk-comments, #commento, .giscus, .giscus-frame, .utterances, #cusdis_thread, #remark42'
      ));
      if (hasThirdPartyBlogComments) {
        return { type: 'social', subtype: 'blog', badgeText: 'Context: 💬 Blog Comment', domain: host };
      }

      const hasGenericBlogComment = hasVisibleSelector([
        'textarea[name="comment"]',
        'textarea[id*="comment" i]',
        'textarea[placeholder*="leave a comment" i]',
        'textarea[placeholder*="write a comment" i]',
        'textarea[placeholder*="add a comment" i]',
        'textarea[placeholder*="post a comment" i]',
        'textarea[placeholder*="join the discussion" i]',
        'div[role="textbox"][aria-label*="comment" i]',
        'div[contenteditable="true"][aria-placeholder*="comment" i]'
      ]);
      if (hasGenericBlogComment) {
        return { type: 'social', subtype: 'blog', badgeText: 'Context: 💬 Blog Comment', domain: host };
      }

      // =========================================================================
      // 5. WEBMAIL CLIENTS (100+ PLATFORMS) -> EMAIL
      // =========================================================================
      const webmailClientList = [
        { key: 'gmail', label: 'Gmail', hosts: ['mail.google.com', 'inbox.google.com'] },
        { key: 'outlook', label: 'Outlook', hosts: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft', 'hotmail.com', 'live.com'] },
        { key: 'yahoo', label: 'Yahoo Mail', hosts: ['mail.yahoo.com', 'mail.yahoo.co.jp', 'mail.yahoo.co.uk'] },
        { key: 'proton', label: 'Proton Mail', hosts: ['mail.proton.me', 'mail.protonmail.com', 'proton.me'] },
        { key: 'zoho', label: 'Zoho Mail', hosts: ['mail.zoho.com', 'mail.zoho.eu', 'mail.zoho.in', 'mail.zoho.com.au', 'zohomail.com'] },
        { key: 'icloud', label: 'iCloud Mail', hosts: ['icloud.com'] },
        { key: 'aol', label: 'AOL Mail', hosts: ['mail.aol.com'] },
        { key: 'fastmail', label: 'Fastmail', hosts: ['fastmail.com', 'app.fastmail.com', 'fastmail.fm'] },
        { key: 'tuta', label: 'Tuta Mail', hosts: ['app.tuta.com', 'mail.tutanota.com'] },
        { key: 'hey', label: 'HEY Mail', hosts: ['app.hey.com'] },
        { key: 'gmx', label: 'GMX Mail', hosts: ['gmx.com', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch'] },
        { key: 'mailcom', label: 'Mail.com', hosts: ['mail.com'] },
        { key: 'webde', label: 'WEB.DE Mail', hosts: ['web.de'] },
        { key: 'yandex', label: 'Yandex Mail', hosts: ['mail.yandex.com', 'mail.yandex.ru'] },
        { key: 'mailru', label: 'Mail.ru', hosts: ['mail.ru', 'e.mail.ru', 'octavius.mail.ru'] },
        { key: 'titan', label: 'Titan Mail', hosts: ['app.titan.email', 'titan.email'] },
        { key: 'rackspace', label: 'Rackspace Webmail', hosts: ['apps.rackspace.com'] },
        { key: 'godaddy', label: 'GoDaddy Webmail', hosts: ['email.godaddy.com', 'secureserver.net'] },
        { key: 'namecheap', label: 'Namecheap Private Email', hosts: ['privateemail.com', 'webmail.namecheap.com'] },
        { key: 'hostinger', label: 'Hostinger Webmail', hosts: ['mail.hostinger.com'] },
        { key: 'dreamhost', label: 'DreamHost Webmail', hosts: ['webmail.dreamhost.com'] },
        { key: 'ionos', label: 'IONOS Webmail', hosts: ['mail.ionos.com', 'mail.ionos.co.uk', 'mail.ionos.de', 'webmail.ionos.com'] },
        { key: 'ovh', label: 'OVH Webmail', hosts: ['mail.ovh.net', 'pro1.mail.ovh.net'] },
        { key: 'infomaniak', label: 'Infomaniak Mail', hosts: ['mail.infomaniak.com', 'ksuite.infomaniak.com'] },
        { key: 'posteo', label: 'Posteo', hosts: ['posteo.de'] },
        { key: 'mailboxorg', label: 'mailbox.org', hosts: ['office.mailbox.org', 'mailbox.org'] },
        { key: 'runbox', label: 'Runbox', hosts: ['runbox.com'] },
        { key: 'startmail', label: 'StartMail', hosts: ['app.startmail.com', 'startmail.com'] },
        { key: 'hushmail', label: 'Hushmail', hosts: ['www.hushmail.com', 'hushmail.com'] },
        { key: 'mailfence', label: 'Mailfence', hosts: ['mailfence.com'] },
        { key: 'migadu', label: 'Migadu', hosts: ['webmail.migadu.com'] },
        { key: 'disroot', label: 'Disroot', hosts: ['webmail.disroot.org'] },
        { key: 'kolabnow', label: 'Kolab Now', hosts: ['apps.kolabnow.com'] },
        { key: 'soverin', label: 'Soverin', hosts: ['mail.soverin.net'] },
        { key: 'att', label: 'AT&T Mail', hosts: ['currently.att.yahoo.com', 'mail.att.net'] },
        { key: 'comcast', label: 'Xfinity Mail', hosts: ['connect.xfinity.com'] },
        { key: 'cox', label: 'Cox Webmail', hosts: ['webmail.cox.net'] },
        { key: 'spectrum', label: 'Spectrum Webmail', hosts: ['webmail.spectrum.net'] },
        { key: 'earthlink', label: 'EarthLink Webmail', hosts: ['webmail.earthlink.net'] },
        { key: 'bt', label: 'BT Mail', hosts: ['email.bt.com', 'webmail.bt.com'] },
        { key: 'virginmedia', label: 'Virgin Media Mail', hosts: ['mail2.virginmedia.com', 'mail.virginmedia.com'] },
        { key: 'sky', label: 'Sky Mail', hosts: ['mail.sky.com'] },
        { key: 'shaw', label: 'Shaw Webmail', hosts: ['webmail.shaw.ca'] },
        { key: 'telus', label: 'Telus Webmail', hosts: ['webmail.telus.net'] },
        { key: 'rogers', label: 'Rogers Mail', hosts: ['rogers.yahoo.com'] },
        { key: 'libero', label: 'Libero Mail', hosts: ['mail.libero.it', 'login.libero.it'] },
        { key: 'tiscali', label: 'Tiscali Mail', hosts: ['mail.tiscali.it'] },
        { key: 'virgilio', label: 'Virgilio Mail', hosts: ['mail.virgilio.it'] },
        { key: 'laposte', label: 'La Poste Mail', hosts: ['webmail.laposte.net', 'laposte.net'] },
        { key: 'orange', label: 'Orange Mail', hosts: ['mail.orange.fr', 'webmail.orange.fr'] },
        { key: 'freefr', label: 'Free.fr Webmail', hosts: ['webmail.free.fr', 'zimbra.free.fr'] },
        { key: 'sfr', label: 'SFR Mail', hosts: ['webmail.sfr.fr', 'mail.sfr.fr'] },
        { key: 'wppl', label: 'WP Poczta', hosts: ['poczta.wp.pl'] },
        { key: 'onetpl', label: 'Onet Poczta', hosts: ['poczta.onet.pl'] },
        { key: 'interiapl', label: 'Interia Poczta', hosts: ['poczta.interia.pl'] },
        { key: 'o2pl', label: 'o2 Poczta', hosts: ['poczta.o2.pl'] },
        { key: 'seznam', label: 'Seznam Email', hosts: ['email.seznam.cz'] },
        { key: 'centrum', label: 'Centrum Mail', hosts: ['mail.centrum.cz'] },
        { key: 'naver', label: 'Naver Mail', hosts: ['mail.naver.com'] },
        { key: 'daum', label: 'Daum Mail', hosts: ['mail.daum.net'] },
        { key: 'qq', label: 'QQ Mail', hosts: ['mail.qq.com', 'exmail.qq.com'] },
        { key: 'netease163', label: '163 Mail', hosts: ['mail.163.com'] },
        { key: 'netease126', label: '126 Mail', hosts: ['mail.126.com'] },
        { key: 'yeahnet', label: 'Yeah.net Mail', hosts: ['mail.yeah.net'] },
        { key: 'sina', label: 'Sina Mail', hosts: ['mail.sina.com', 'mail.sina.com.cn'] },
        { key: 'sohu', label: 'Sohu Mail', hosts: ['mail.sohu.com'] },
        { key: 'rediff', label: 'Rediffmail', hosts: ['mail.rediff.com', 'f4mail.rediff.com'] },
        { key: 'rambler', label: 'Rambler Mail', hosts: ['mail.rambler.ru'] },
        { key: 'ukrnet', label: 'Ukr.net Mail', hosts: ['mail.ukr.net'] },
        { key: 'abvbg', label: 'ABV Mail', hosts: ['mail.abv.bg', 'abv.bg'] },
        { key: 'webmail_sub', label: 'Webmail', hosts: [] }
      ];

      for (const wm of webmailClientList) {
        if (wm.hosts.length && wm.hosts.some((h) => hostMatchesDomain(host, h))) {
          if (wm.key === 'icloud' && !pathname.startsWith('/mail')) continue;
          return { type: 'webmail', subtype: wm.key, badgeText: `Context: ✉️ ${wm.label} Compose`, domain: host };
        }
      }

      // Subdomain & path-based webmail clients (cPanel Roundcube, Horde, SquirrelMail, Zimbra, SOGo, SnappyMail, RainLoop, webmail.*, mail.*, poczta.*)
      const isWebmailSubdomain = /^(webmail|mail|email|mymail|poczta|roundcube|horde|zimbra|sogo|snappymail|rainloop|squirrelmail)\./i.test(host);
      const isWebmailPath = /(\/roundcube|\/webmail|\/squirrelmail|\/horde|\/snappymail|\/rainloop|\/zimbra|\/sogo|\/?_task=mail|\/cpsess\d+\/.*webmail)/i.test(fullUrlPath);
      const hasRoundcubeHordeDom = Boolean(document.querySelector('#rcmcomposeform, #composebody, #messagetext, body.task-mail, #zimbra_app, #sogo-app'));

      if (isWebmailSubdomain || isWebmailPath || hasRoundcubeHordeDom) {
        return { type: 'webmail', subtype: 'webmail', badgeText: 'Context: ✉️ Webmail Compose', domain: host };
      }

      // Synced webmail recipes: require strict host match OR BOTH specific subject AND body fields (never bare div[role="textbox"]!)
      for (const [key, recipe] of Object.entries(cachedSelectorRecipes.webmail || {})) {
        const hosts = Array.isArray(recipe?.hosts) ? recipe.hosts : [];
        const matchesHost = hosts.some((h) => hostMatchesDomain(host, h));
        const hasSubj = Boolean(queryFirstSelector(recipe?.subject));
        const hasBody = Boolean(queryFirstSelector(recipe?.body));
        if (matchesHost || (hasSubj && hasBody)) {
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return { type: 'webmail', subtype: key, badgeText: `Context: ✉️ ${label} Compose`, domain: host };
        }
      }

      // Generic email compose window detection: must have BOTH recipient ('To'/'Cc') AND Subject field + editable body
      const hasComposeSubject = hasVisibleSelector(['input[name="subjectbox"]', 'input[name="subject" i]', 'input[aria-label*="Subject" i]', 'input[placeholder*="Subject" i]']);
      const hasComposeRecipient = hasVisibleSelector(['input[name="to" i]', 'input[aria-label*="To recipients" i]', 'input[aria-label="To" i]', 'input[placeholder*="Recipients" i]', '[data-testid*="recipient" i]']);
      const hasComposeBody = hasVisibleSelector(['div[role="textbox"][aria-label*="Message Body" i]', 'div[aria-label*="Message body" i]', 'div[contenteditable="true"]', 'textarea']);
      if (hasComposeSubject && hasComposeRecipient && hasComposeBody) {
        return { type: 'webmail', subtype: 'generic', badgeText: 'Context: ✉️ Email Compose', domain: host };
      }

      // =========================================================================
      // 6. DIRECTORY LISTING FORM DETECTION -> DIRECTORY
      // =========================================================================
      const knownHosts = Array.isArray(cachedSelectorRecipes.directoryDetection?.knownHosts)
        ? cachedSelectorRecipes.directoryDetection.knownHosts
        : [];
      const builtInDirHosts = [
        'producthunt.com', 'saashub.com', 'theresanaiforthat.com', 'toolify.ai',
        'futurepedia.io', 'betalist.com', 'startupstash.com', 'uneed.best',
        'indiehackers.com', 'alternativeto.net', 'g2.com', 'capterra.com',
        'getapp.com', 'launchingnext.com', 'microlaunch.net', 'tinystartups.com',
        'aitoolsdirectory.com', 'topai.tools', 'aidirectory.org'
      ];
      const allKnownDirHosts = [...new Set([...knownHosts, ...builtInDirHosts])];
      const isKnownDir = allKnownDirHosts.some((k) => hostMatchesDomain(host, k));

      const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'))
        .filter((el) => isElVisible(el));

      let dirFieldScore = 0;
      allInputs.forEach((el) => {
        const labelTxt = formFiller.getFieldLabel(el) || '';
        const idName = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('data-label') || '') + ' ' + labelTxt).toLowerCase();
        if (/tagline|elevator|pitch|slogan|one[- ]?liner/.test(idName)) dirFieldScore += 2;
        if (/pricing|price model|category|categories|demo url/.test(idName)) dirFieldScore += 1;
        if (/product name|tool name|startup name|app name|saas name|site name|listing title/.test(idName)) dirFieldScore += 2;
        if (el.type === 'file' && /logo|icon|thumbnail|screenshot|preview/.test(idName)) dirFieldScore += 1;
        if (el.tagName === 'TEXTAREA' && /description|overview|summary|about (the )?(tool|product|app|startup)/.test(idName)) dirFieldScore += 1;
      });

      if ((isDirectorySubmitPathOrTitle && allInputs.length >= 2) || (isKnownDir && allInputs.length >= 2) || dirFieldScore >= 3) {
        return { type: 'directory', subtype: 'directory', badgeText: 'Context: 📁 Directory Listing', domain: host };
      }

      // =========================================================================
      // 7. CONTACT FORM DETECTION -> CONTACT (SOPHISTICATED SCORER)
      // =========================================================================
      const forms = formFiller.findForms();
      const contactUrlOrTitle = /(contact|support|help|inquiry|enquiry|get[-_ ]?in[-_ ]?touch|reach[-_ ]?out|feedback|talk[-_ ]?to[-_ ]?(us|sales)|partnership|demo[-_ ]?request|quote)/i;
      const hasContactUrlOrHeading = contactUrlOrTitle.test(fullUrlPath) || contactUrlOrTitle.test(pageTitle) || contactUrlOrTitle.test(h1Text);

      const scoreContactForm = (f) => {
        const fields = (f.fields || []).filter((fld) => fld.element && isElVisible(fld.element));
        if (fields.length === 0) return 0;

        // Ignore single-input search or newsletter forms
        if (fields.length === 1) {
          const only = fields[0];
          const txt = ((only.name || '') + ' ' + (only.label || '') + ' ' + (only.type || '')).toLowerCase();
          if (only.type === 'search' || /search|query|subscribe|newsletter|promo|coupon/.test(txt)) return 0;
        }

        // Ignore login / password forms
        const hasPassword = fields.some((fld) => fld.type === 'password');
        if (hasPassword && fields.length <= 4) return 0;

        let score = hasContactUrlOrHeading ? 2 : 0;
        let hasEmail = false;
        let hasMessage = false;
        let hasName = false;

        for (const fld of fields) {
          const n = ((fld.name || '') + ' ' + (fld.label || '') + ' ' + (fld.element?.placeholder || '') + ' ' + (fld.type || '')).toLowerCase();
          if (fld.type === 'email' || /\be[-_ ]?mail\b/.test(n)) {
            hasEmail = true;
            score += 2;
          }
          if (fld.element?.tagName === 'TEXTAREA' || /\b(message|inquiry|enquiry|details|question|how can we help|tell us|comments?)\b/.test(n)) {
            hasMessage = true;
            score += 2;
          }
          if (/\b(name|full[-_ ]?name|first[-_ ]?name|your[-_ ]?name)\b/.test(n)) {
            hasName = true;
            score += 1;
          }
          if (/\b(subject|topic|reason)\b/.test(n)) score += 1;
          if (fld.type === 'tel' || /\b(phone|tel|mobile)\b/.test(n)) score += 1;
          if (/\b(company|organization|organisation|business|website)\b/.test(n)) score += 1;
        }

        // Require meaningful contact intent (e.g. email + message/name, or contact URL + email/message)
        if ((hasEmail && hasMessage) || (hasContactUrlOrHeading && (hasEmail || hasMessage)) || (hasName && hasEmail && fields.length >= 3)) {
          return score;
        }
        return 0;
      };

      const bestContactScore = forms.reduce((max, f) => Math.max(max, scoreContactForm(f)), 0);
      if (bestContactScore >= 3) {
        return { type: 'contact', subtype: 'contact', badgeText: 'Context: ⚡ Contact Form', domain: host };
      }

      // Check standalone contact fields outside <form>
      const standaloneEmail = allInputs.some((el) => el.type === 'email' || /email/i.test((el.name || '') + ' ' + (el.placeholder || '') + ' ' + formFiller.getFieldLabel(el)));
      const standaloneMsg = allInputs.some((el) => el.tagName === 'TEXTAREA');
      if (standaloneEmail && standaloneMsg) {
        return { type: 'contact', subtype: 'contact', badgeText: 'Context: ⚡ Contact Form', domain: host };
      }

      if (allInputs.length > 0 && hasContactUrlOrHeading) {
        return { type: 'contact', subtype: 'contact', badgeText: 'Context: ⚡ Contact Form', domain: host };
      }

      return { type: 'unknown', subtype: 'general', badgeText: 'Context: ⚡ Ready (Alt+S)', domain: host };
    },

    extractThreadContext() {
      const host = window.location.hostname.toLowerCase();
      const pathname = window.location.pathname || '';
      const href = window.location.href || '';

      const cleanReadableText = (el, maxLen = 1400) => {
        if (!el) return '';
        let raw = '';
        try {
          raw = typeof el.innerText === 'string' && el.innerText.trim()
            ? el.innerText
            : (el.textContent || '');
        } catch {
          raw = el.textContent || '';
        }
        return String(raw || '')
          .replace(/[\u200B-\u200D\uFEFF\uFFFC]/g, '')
          .replace(/\r\n/g, '\n')
          .split('\n')
          .map((line) => line.replace(/[ \t]+/g, ' ').trim())
          .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, maxLen);
      };

      const cleanSingleLine = (val, maxLen = 200) => String(val || '')
        .replace(/[\u200B-\u200D\uFEFF\uFFFC]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);

      let title = '';
      let body = '';
      let author = '';
      let authorHandle = '';
      let subreddit = '';
      let quotedText = '';
      let cardText = '';
      let mediaAltText = '';
      let existingReplies = [];
      let replyTargetText = '';
      let isReplyingToComment = false;
      let platform = 'generic';

      // 1. X / TWITTER
      if (host.includes('twitter.com') || host.includes('x.com')) {
        platform = 'twitter';
        const isPromoted = (art) => {
          if (!art) return true;
          const socialCtx = art.querySelector('[data-testid="socialContext"]');
          if (socialCtx && /\b(ad|promoted)\b/i.test(socialCtx.textContent || '')) return true;
          return Array.from(art.querySelectorAll('span')).some((s) => s.textContent?.trim() === 'Ad');
        };

        const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).filter((a) => isElVisible(a));
        const statusMatch = pathname.match(/\/status\/(\d+)/);
        const statusId = statusMatch ? statusMatch[1] : '';

        let focalArticle = null;
        // Prefer open reply modal's focal tweet if user clicked Reply
        const dialogTweet = document.querySelector('div[role="dialog"] article[data-testid="tweet"]');
        if (dialogTweet && isElVisible(dialogTweet)) {
          focalArticle = dialogTweet;
        }
        // Else match exact status ID in URL
        if (!focalArticle && statusId) {
          focalArticle = allArticles.find((art) => {
            const links = Array.from(art.querySelectorAll(`a[href*="/status/${statusId}"]`));
            return links.some((a) => !a.closest('div[role="link"]'));
          }) || null;
        }
        // Else first non-promoted visible tweet
        if (!focalArticle) {
          focalArticle = allArticles.find((art) => !isPromoted(art)) || allArticles[0] || null;
        }

        if (focalArticle) {
          const userNameWrap = focalArticle.querySelector('[data-testid="User-Name"]');
          if (userNameWrap) {
            const rawUser = cleanReadableText(userNameWrap, 160);
            const handleMatch = rawUser.match(/@[A-Za-z0-9_]{1,30}/);
            if (handleMatch) authorHandle = handleMatch[0];
            const firstLine = rawUser.split('\n').find((l) => l && !l.startsWith('@') && l !== '·') || '';
            author = cleanSingleLine(firstLine, 80);
          }

          const tweetTexts = Array.from(focalArticle.querySelectorAll('[data-testid="tweetText"]'));
          const mainTextEl = tweetTexts.find((el) => !el.closest('div[role="link"], [data-testid="quoteTweet"]')) || tweetTexts[0] || null;
          if (mainTextEl) {
            body = cleanReadableText(mainTextEl, 1400);
            title = body.split('\n')[0] || body;
          }

          const quoteEl = tweetTexts.find((el) => el !== mainTextEl) || focalArticle.querySelector('[data-testid="quoteTweet"]');
          if (quoteEl) {
            quotedText = cleanReadableText(quoteEl, 500);
          }

          const cardEl = focalArticle.querySelector('[data-testid="card.wrapper"]');
          if (cardEl) {
            cardText = cleanReadableText(cardEl, 350);
          }

          const photoAlts = Array.from(focalArticle.querySelectorAll('[data-testid="tweetPhoto"] img[alt]'))
            .map((img) => cleanSingleLine(img.getAttribute('alt') || '', 220))
            .filter((alt) => alt && !/^image$/i.test(alt));
          if (photoAlts.length > 0) {
            mediaAltText = photoAlts.join(' | ').slice(0, 300);
          }

          const focalIdx = allArticles.indexOf(focalArticle);
          if (focalIdx !== -1) {
            const replyArticles = allArticles.slice(focalIdx + 1).filter((a) => !isPromoted(a));
            for (const rep of replyArticles) {
              if (existingReplies.length >= 3) break;
              const repTextEl = rep.querySelector('[data-testid="tweetText"]');
              const repText = cleanSingleLine(cleanReadableText(repTextEl, 200), 180);
              if (!repText) continue;
              const repUserRaw = cleanReadableText(rep.querySelector('[data-testid="User-Name"]'), 100);
              const repHandle = (repUserRaw.match(/@[A-Za-z0-9_]{1,30}/) || [''])[0];
              if (authorHandle && repHandle === authorHandle) continue; // skip self-thread continuation unless needed
              existingReplies.push(repHandle ? `${repHandle}: ${repText}` : repText);
            }
          }
        }
      }
      // 2. REDDIT
      else if (host.includes('reddit.com')) {
        platform = 'reddit';
        const subMatch = pathname.match(/\/r\/([^/?#]+)/i);
        subreddit = subMatch ? `r/${subMatch[1]}` : cleanSingleLine(
          document.querySelector('shreddit-post')?.getAttribute('subreddit-prefixed-name') ||
          document.querySelector('[data-testid="subreddit-name"]')?.textContent || '',
          60
        );

        const shredditPost = document.querySelector('shreddit-post');
        author = cleanSingleLine(
          shredditPost?.getAttribute('author') ||
          document.querySelector('[data-testid="post_author_link"]')?.textContent || '',
          80
        );
        title = cleanSingleLine(
          shredditPost?.getAttribute('post-title') ||
          document.querySelector('h1[slot="title"]')?.textContent ||
          document.querySelector('h1')?.textContent || '',
          320
        );
        const bodyEl =
          document.querySelector('shreddit-post [slot="text-body"]') ||
          document.querySelector('[data-test-id="post-content"]') ||
          document.querySelector('[data-click-id="text"]') ||
          document.querySelector('.expando .usertext-body');
        body = cleanReadableText(bodyEl, 1500);

        // Check if active element is replying to a specific comment
        const activeEl = document.activeElement;
        const parentComment = activeEl?.closest?.('shreddit-comment, .Comment, .comment');
        if (parentComment) {
          const cAuthor = cleanSingleLine(parentComment.getAttribute('author') || parentComment.querySelector('[data-testid="comment_author_link"]')?.textContent || '', 60);
          const cBodyEl = parentComment.querySelector('[slot="comment"], [data-testid="comment"], .usertext-body');
          const cBody = cleanReadableText(cBodyEl, 500);
          if (cBody) {
            isReplyingToComment = true;
            replyTargetText = cAuthor ? `${cAuthor}: ${cBody}` : cBody;
          }
        }

        const commentNodes = Array.from(document.querySelectorAll('shreddit-comment [slot="comment"], .Comment [data-testid="comment"]'));
        for (const cNode of commentNodes) {
          if (existingReplies.length >= 3) break;
          const txt = cleanSingleLine(cleanReadableText(cNode, 200), 180);
          if (txt) existingReplies.push(txt);
        }
      }
      // 3. YOUTUBE
      else if (host.includes('youtube.com') || host.includes('youtu.be')) {
        platform = 'youtube';
        title = cleanSingleLine(
          document.querySelector('h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata h1, #title h1')?.textContent ||
          document.title.replace(/\s*-\s*YouTube$/i, ''),
          300
        );
        author = cleanSingleLine(
          document.querySelector('#owner #channel-name a, ytd-channel-name a')?.textContent || '',
          80
        );
        const descEl = document.querySelector('#description-inner, ytd-text-inline-expander #snippet-text, ytd-watch-metadata #description');
        body = cleanReadableText(descEl, 900);

        const activeEl = document.activeElement;
        const commentThread = activeEl?.closest?.('ytd-comment-replies-renderer, ytd-comment-thread-renderer');
        if (commentThread) {
          const cText = cleanReadableText(commentThread.querySelector('#content-text'), 400);
          if (cText && activeEl.closest('ytd-comment-replies-renderer')) {
            isReplyingToComment = true;
            replyTargetText = cText;
          }
        }

        const ytComments = Array.from(document.querySelectorAll('#comments ytd-comment-thread-renderer #content-text'));
        for (const cEl of ytComments) {
          if (existingReplies.length >= 3) break;
          const txt = cleanSingleLine(cleanReadableText(cEl, 200), 180);
          if (txt) existingReplies.push(txt);
        }
      }
      // 4. LINKEDIN
      else if (host.includes('linkedin.com')) {
        platform = 'linkedin';
        const activeEl = document.activeElement;
        const focalPost = activeEl?.closest?.('.feed-shared-update-v2') || document.querySelector('.feed-shared-update-v2');
        if (focalPost) {
          author = cleanSingleLine(
            focalPost.querySelector('.update-components-actor__title span[aria-hidden="true"], .update-components-actor__name')?.textContent || '',
            80
          );
          const liBodyEl = focalPost.querySelector('.feed-shared-update-v2__description, .update-components-text');
          body = cleanReadableText(liBodyEl, 1400);
          title = body.split('\n')[0] || body;

          const liComments = Array.from(focalPost.querySelectorAll('.comments-comment-item__main-content'));
          for (const cEl of liComments) {
            if (existingReplies.length >= 3) break;
            const txt = cleanSingleLine(cleanReadableText(cEl, 200), 180);
            if (txt) existingReplies.push(txt);
          }
        }
      }
      // 5. THREADS / RECIPE-DRIVEN PLATFORMS / GENERIC
      else {
        const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);
        if (matched) {
          platform = matched.key;
          const tc = matched.recipe?.threadContext;
          if (tc) {
            const titleEl = queryFirstSelector(tc.title);
            if (titleEl) title = cleanReadableText(titleEl, 400);
            const bodyEl = queryFirstSelector(tc.body);
            if (bodyEl) body = cleanReadableText(bodyEl, 1200);
            const authorEl = queryFirstSelector(tc.author);
            if (authorEl) author = cleanSingleLine(cleanReadableText(authorEl, 100), 80);
          }
        } else if (host.includes('threads.net') || host.includes('threads.com')) {
          platform = 'threads';
        } else if (host.includes('instagram.com')) {
          platform = 'instagram';
        } else if (host.includes('tiktok.com')) {
          platform = 'tiktok';
        } else if (host.includes('pinterest.com')) {
          platform = 'pinterest';
        } else if (host.includes('quora.com')) {
          platform = 'quora';
        }
      }

      // Generic fallbacks if platform-specific extraction left title/body empty
      if (!title) {
        const h1 = document.querySelector('h1');
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        title = cleanSingleLine(h1?.textContent || ogTitle || document.title || '', 320);
      }
      if (!body) {
        const article = document.querySelector('article, main, .post-content, .entry-content');
        const metaDesc =
          document.querySelector('meta[name="description"]')?.getAttribute('content') ||
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          '';
        body = cleanReadableText(article, 1200) || cleanSingleLine(metaDesc, 800);
      }

      return {
        platform,
        title: cleanSingleLine(title, 400) || cleanSingleLine(body.split('\n')[0] || '', 240),
        body: (body || '').slice(0, 1600),
        author: cleanSingleLine(author, 100),
        authorHandle: cleanSingleLine(authorHandle, 60),
        subreddit: cleanSingleLine(subreddit, 60),
        quotedText: (quotedText || '').slice(0, 500),
        cardText: (cardText || '').slice(0, 350),
        mediaAltText: cleanSingleLine(mediaAltText, 300),
        existingReplies: existingReplies.slice(0, 3),
        replyTargetText: (replyTargetText || '').slice(0, 500),
        isReplyingToComment,
        url: href
      };
    },

    extractPageCopy() {
      const threadContext = this.extractThreadContext();
      const detectedContext = this.detectContext();

      const getMeta = (names) => {
        for (const n of names) {
          const el = document.querySelector(`meta[name="${n}" i], meta[property="${n}" i]`);
          if (el && el.content) return el.content.trim();
        }
        return '';
      };

      const title =
        getMeta(['og:title', 'twitter:title']) ||
        document.title ||
        threadContext?.title ||
        window.location.hostname;

      const metaDescription = getMeta(['description', 'og:description', 'twitter:description']);

      const headings = [];
      const seenHeadings = new Set();
      document.querySelectorAll('h1, h2, h3').forEach((el) => {
        if (headings.length >= 12) return;
        const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && txt.length >= 3 && txt.length <= 220 && !seenHeadings.has(txt.toLowerCase())) {
          seenHeadings.add(txt.toLowerCase());
          headings.push(txt);
        }
      });

      const rootEl =
        document.querySelector('main, article, [role="main"], .post-content, .entry-content, .hero') ||
        document.body;

      const ctaTexts = [];
      const seenCtas = new Set();
      const ctaScope = rootEl || document.body;
      if (ctaScope) {
        ctaScope.querySelectorAll('button, a[href], [role="button"], input[type="submit"]').forEach((el) => {
          if (ctaTexts.length >= 8) return;
          if (el.closest('nav, footer')) return;
          const rawTxt = el.tagName === 'INPUT'
            ? (el.value || el.getAttribute('aria-label') || '')
            : (el.innerText || el.textContent || el.getAttribute('aria-label') || '');
          const txt = rawTxt.replace(/\s+/g, ' ').trim();
          if (txt && txt.length >= 2 && txt.length <= 60 && !seenCtas.has(txt.toLowerCase())) {
            seenCtas.add(txt.toLowerCase());
            ctaTexts.push(txt);
          }
        });
      }

      let copyText = '';
      if (rootEl) {
        try {
          const clone = rootEl.cloneNode(true);
          clone.querySelectorAll('script, style, noscript, svg, nav, footer').forEach((el) => el.remove());
          copyText = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
        } catch {
          copyText = (rootEl.innerText || rootEl.textContent || '').replace(/\s+/g, ' ').trim();
        }
      }

      if (!copyText && threadContext?.body) {
        copyText = threadContext.body;
      }

      const cleanTitle = (title || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const cleanDesc = (metaDescription || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      const cleanBody = copyText.slice(0, 3000);

      return {
        sourceType: 'tab',
        url: window.location.href,
        domain: window.location.hostname.replace(/^www\./, ''),
        title: cleanTitle,
        metaDescription: cleanDesc,
        description: cleanDesc,
        headings,
        ctaTexts,
        bodyCopy: cleanBody,
        copy: cleanBody,
        platform: threadContext?.platform || detectedContext?.subtype || 'web',
        threadContext,
        detectedContext,
        scannedAt: new Date().toISOString()
      };
    },

    async findUniversalCommentComposer() {
      await recipesReadyPromise;

      // 1. Check current active focused element
      const active = document.activeElement;
      if (active && (
        active.tagName === 'TEXTAREA' ||
        (active.tagName === 'INPUT' && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(active.type)) ||
        active.isContentEditable ||
        active.getAttribute('role') === 'textbox'
      )) {
        return active;
      }
      if (active && active.querySelector) {
        const innerEdit = active.querySelector('[contenteditable="true"], textarea, input[type="text"]');
        if (innerEdit) return innerEdit;
      }

      const host = window.location.hostname.toLowerCase();
      const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);

      // 2. Recipe-driven lazy activation if composer is collapsed
      if (matched?.recipe) {
        let editor = queryFirstVisibleSelector(matched.recipe.composers) || queryFirstSelector(matched.recipe.composers);
        if (!editor && Array.isArray(matched.recipe.placeholders) && matched.recipe.placeholders.length > 0) {
          if (Array.isArray(matched.recipe.sectionScroll) && matched.recipe.sectionScroll.length > 0) {
            const sectionEl = queryFirstSelector(matched.recipe.sectionScroll);
            if (sectionEl) {
              try { sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
            }
          }
          const trigger = queryFirstVisibleSelector(matched.recipe.placeholders) || queryFirstSelector(matched.recipe.placeholders);
          if (trigger) {
            try {
              trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const mouseOpts = { bubbles: true, cancelable: true, view: window };
              trigger.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
              trigger.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
              trigger.click();
              trigger.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
              trigger.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
              trigger.focus?.();
              for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 100));
                editor = queryFirstVisibleSelector(matched.recipe.composers) || queryFirstSelector(matched.recipe.composers);
                if (editor) break;
              }
            } catch (e) {
              logger.warn('Placeholder activation notice:', e);
            }
          }
        }
        if (editor) return editor;
      }

      // 3. Dynamic recipe selector matrix + generic fallback
      const selectorMatrix = [];
      if (matched?.recipe?.composers) {
        selectorMatrix.push(...matched.recipe.composers);
      }
      for (const recipe of Object.values(cachedSelectorRecipes.platforms || {})) {
        if (Array.isArray(recipe?.composers)) {
          selectorMatrix.push(...recipe.composers);
        }
      }
      if (Array.isArray(cachedSelectorRecipes.generic?.commentComposers)) {
        selectorMatrix.push(...cachedSelectorRecipes.generic.commentComposers);
      }

      return queryFirstVisibleSelector(selectorMatrix);
    },

    spinText(str, options = {}) {
      if (!str || typeof str !== 'string') return str;
      const engine = (typeof globalThis !== 'undefined' && globalThis.SmartPosterVariationEngine) || _csEngine;
      if (engine) {
        return engine.processSync(str, {
          level: csRandomnessLevel,
          synonymsEnabled: csRandomnessSynonyms,
          dictsText: csRandomnessDicts,
          brandName: options.brandName || '',
          autoVariation: false
        });
      }
      let res = str;
      let iterations = 0;
      while (/\{([^{}]+)\}/.test(res) && iterations < 30) {
        iterations++;
        res = res.replace(/\{([^{}]+)\}/, (_, choices) => {
          const arr = choices.split('|');
          return arr[Math.floor(Math.random() * arr.length)].trim();
        });
      }
      res = res.replace(/\(([a-zA-Z0-9_\s\-–—\.,'!?:/|]+)\)/g, (match, inner) => {
        if (inner.includes('|')) {
          const arr = inner.split('|').map(s => s.trim()).filter(Boolean);
          if (arr.length > 0) return arr[Math.floor(Math.random() * arr.length)];
        }
        return match;
      });
      return res;
    },

    applyAutoVariation(text, options = {}) {
      if (!text || typeof text !== 'string') return text;
      const engine = (typeof globalThis !== 'undefined' && globalThis.SmartPosterVariationEngine) || _csEngine;
      if (engine) {
        return engine.applyPresetVariation(text, {
          level: options.level ?? csRandomnessLevel,
          synonymsEnabled: csRandomnessSynonyms,
          dictsText: csRandomnessDicts,
          brandName: options.brandName || '',
          history: _csAutoVariationHistory
        });
      }
      return text;
    },

    async resolveAutoVariationAsync(rawTemplate, options = {}) {
      const sourceText = String(rawTemplate || '');
      if (!sourceText) return sourceText;
      const engine = (typeof globalThis !== 'undefined' && globalThis.SmartPosterVariationEngine) || _csEngine;
      const level = engine ? engine.normalizeLevel(options.level ?? csRandomnessLevel, 3) : (Number(options.level ?? csRandomnessLevel) || 3);
      const brandName = options.brandName || options.brand?.brandName || options.brand?.name || '';
      const fallbackSeed = options.spunText !== undefined
        ? String(options.spunText || '')
        : this.spinText(sourceText, { brandName });

      if (level <= 3) {
        return this.applyAutoVariation(fallbackSeed, { level, brandName });
      }

      const hasSpinSyntax = /\{[^{}]+\}/.test(sourceText) || /\([^()]*\|[^()]*\)/.test(sourceText);
      const templateForPool = hasSpinSyntax ? fallbackSeed : sourceText;

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const res = await new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                resolve(null);
              }
            }, 260);
            chrome.runtime.sendMessage({
              type: 'consumeAutoVariation',
              text: templateForPool,
              level,
              brand: options.brand || null,
              brandName,
              synonymsEnabled: csRandomnessSynonyms,
              dictsText: csRandomnessDicts
            }, (resp) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (chrome.runtime.lastError) {
                resolve(null);
                return;
              }
              resolve(resp || null);
            });
          });
          if (res && res.success && typeof res.text === 'string' && res.text.trim()) {
            return res.text;
          }
        } catch (_) {}
      }

      return this.applyAutoVariation(fallbackSeed, { level: 3, brandName });
    },

    async injectDirectMessage(messageText) {
      await recipesReadyPromise;
      if (!messageText) return { success: false, error: 'No DM text provided' };
      messageText = this.spinText(messageText);
      const host = window.location.hostname.toLowerCase();
      const matchedDm = findRecipeByHost(cachedSelectorRecipes.dm, host);
      let editor = matchedDm?.recipe?.composers ? (queryFirstVisibleSelector(matchedDm.recipe.composers) || queryFirstSelector(matchedDm.recipe.composers)) : null;
      if (!editor) {
        editor = queryFirstVisibleSelector([
          '[data-testid="dmComposerTextInput"]',
          '.msg-form__contenteditable',
          'div[data-e2e="message-input"] [contenteditable="true"]',
          'div[role="dialog"] div[role="textbox"][aria-label*="Message" i]',
          'div[role="textbox"][aria-label*="direct message" i]',
          'div[role="textbox"][aria-label*="Start a new message" i]',
          'div[role="textbox"][aria-label*="Write a message" i]',
          'div[role="textbox"][aria-label="Aa"]',
          'textarea[placeholder*="message" i]',
          'div[role="textbox"]',
          'div[contenteditable="true"]',
          'textarea'
        ]);
      }

      if (editor) {
        await formFiller.safeSetRichTextContent(editor, messageText);
        const msg = '💬 Injected Direct Message!';
        this.showToast(msg, 'success');
        return { success: true, context: 'dm', message: msg };
      } else {
        try {
          await navigator.clipboard.writeText(messageText);
          const copyMsg = '📋 DM copied to clipboard! Paste directly into message box.';
          this.showToast(copyMsg, 'warning');
          return { success: true, context: 'dm', copiedToClipboard: true, message: copyMsg };
        } catch (e) {
          return { success: false, context: 'dm', error: 'Could not inject or copy DM' };
        }
      }
    },

    async injectWebmail(subtype, emailVariation, brandData) {
      await recipesReadyPromise;
      const subject = emailVariation?.subject || (brandData?.directory?.tagline ? `${brandData.brandName}: ${brandData.directory.tagline}` : 'Outreach & Partnership Request');
      const body = emailVariation?.body || (brandData?.directory?.longDescription || brandData?.contact?.message || 'Hello,\n\nI would love to explore a partnership.');

      const host = window.location.hostname.toLowerCase();
      const recipe = cachedSelectorRecipes.webmail?.[subtype] || findRecipeByHost(cachedSelectorRecipes.webmail, host)?.recipe || null;

      let subjectField = recipe?.subject ? queryFirstSelector(recipe.subject) : null;
      let bodyField = recipe?.body ? queryFirstSelector(recipe.body) : null;

      if (!subjectField) {
        subjectField = document.querySelector('input[name*="subject" i], input[id*="subject" i], input[placeholder*="subject" i]');
      }
      if (!bodyField) {
        bodyField = document.querySelector('div[role="textbox"], textarea[name*="body" i], textarea[id*="body" i], div[contenteditable="true"]');
      }

      let injectedSubject = false;
      let injectedBody = false;

      if (subjectField) {
        await formFiller.setFieldValue(subjectField, subject);
        injectedSubject = true;
      }
      if (bodyField) {
        await formFiller.setFieldValue(bodyField, body);
        injectedBody = true;
      }

      if (injectedSubject || injectedBody) {
        const msg = injectedSubject && injectedBody
          ? '✉️ Injected Email Subject & Body into compose window!'
          : '✉️ Injected Email variation into composer!';
        this.showToast(msg, 'success');
        return {
          success: true,
          context: 'email',
          injected: { subject: injectedSubject, body: injectedBody },
          message: msg
        };
      }

      // If direct DOM fields not found, copy to clipboard with toast notification
      try {
        const fullClip = `Subject: ${subject}\n\n${body}`;
        await navigator.clipboard.writeText(fullClip);
        const copyMsg = '📋 Email variation copied to clipboard! Paste directly into webmail.';
        this.showToast(copyMsg, 'warning');
        return {
          success: true,
          context: 'email',
          copiedToClipboard: true,
          message: copyMsg
        };
      } catch (clipErr) {
        return {
          success: false,
          context: 'email',
          error: 'Could not inject or copy email variation'
        };
      }
    },

    async injectArticle(article = {}, format = 'text') {
      const title = article.title || '';
      const body = article.body || '';
      if (!title && !body) return { success: false, error: 'No article content provided' };

      let textToInject = body;
      if (format === 'markdown') {
        textToInject = article.markdown || (title ? `# ${title}\n\n${body}` : body);
      } else if (format === 'rich') {
        textToInject = article.richHtml || (title ? `<h2>${title}</h2>\n<p>${body.replace(/\n\n/g, '</p>\n<p>').replace(/\n/g, '<br/>')}</p>` : body);
      }

      const titleField = queryFirstVisibleSelector([
        '#article-form-title',
        '[data-testid="storyTitle"]',
        'h3.graf--title[contenteditable="true"]',
        '.gh-editor-title',
        '.editor-post-title__input',
        '#wpbody-content #titlewrap #title',
        'textarea[placeholder*="Title" i]',
        'input[name*="title" i]',
        'input[id*="title" i]',
        'input[placeholder*="title" i]',
        '[data-testid*="title" i]',
        '[aria-label*="title" i]',
        'h1[contenteditable="true"]'
      ]) || document.querySelector('input[name*="title" i], input[id*="title" i], input[placeholder*="title" i], [data-testid*="title" i], [aria-label*="title" i], h1[contenteditable="true"]');
      let injectedTitle = false;
      if (titleField && title) {
        await formFiller.setFieldValue(titleField, title);
        injectedTitle = true;
      }

      const bodyEditor = queryFirstVisibleSelector([
        'textarea#article_body_markdown',
        '[data-testid="post-editor"] .ProseMirror',
        '.koenig-editor__editor',
        '.block-editor-writing-flow .block-editor-rich-text__editable',
        '.ProseMirror',
        '.ql-editor',
        'div[contenteditable="true"]:not([aria-label*="title" i]):not(h1)',
        'div[role="textbox"]:not([aria-label*="title" i])',
        'textarea[name*="body" i]',
        'textarea[name*="content" i]',
        'textarea[id*="content" i]',
        'textarea'
      ]) || document.querySelector('.ProseMirror, .ql-editor, div[contenteditable="true"]:not([aria-label*="title" i]):not(h1), div[role="textbox"]:not([aria-label*="title" i]), textarea[name*="body" i], textarea[name*="content" i], textarea[id*="content" i], textarea');
      let injectedBody = false;

      if (bodyEditor) {
        if (format === 'rich' && bodyEditor.isContentEditable) {
          try {
            bodyEditor.focus();
            document.execCommand('insertHTML', false, textToInject);
            bodyEditor.dispatchEvent(new Event('input', { bubbles: true }));
            injectedBody = true;
          } catch (e) {
            await formFiller.setFieldValue(bodyEditor, textToInject);
            injectedBody = true;
          }
        } else {
          await formFiller.setFieldValue(bodyEditor, textToInject);
          injectedBody = true;
        }
      }

      if (article.metaDescription) {
        const metaField = queryFirstVisibleSelector([
          'textarea[name*="meta_description" i]',
          'input[name*="meta_description" i]',
          'textarea[placeholder*="meta description" i]',
          'input[placeholder*="meta description" i]'
        ]);
        if (metaField) {
          await formFiller.setFieldValue(metaField, String(article.metaDescription).slice(0, 160));
        }
      }

      if (injectedTitle || injectedBody) {
        const msg = `📰 Injected Article (${format.toUpperCase()})!`;
        this.showToast(msg, 'success');
        return { success: true, context: 'article', format, message: msg };
      } else {
        try {
          await navigator.clipboard.writeText(textToInject);
          const copyMsg = `📋 Article (${format.toUpperCase()}) copied to clipboard! Paste directly into editor.`;
          this.showToast(copyMsg, 'warning');
          return { success: true, context: 'article', copiedToClipboard: true, format, message: copyMsg };
        } catch (e) {
          return { success: false, context: 'article', error: 'Could not inject or copy article' };
        }
      }
    },

    async injectSocialPost(postPayload = '') {
      const rawText = typeof postPayload === 'string'
        ? postPayload
        : (postPayload?.text || [postPayload?.hook, postPayload?.body, postPayload?.ctaUrl].map(s => String(s || '').trim()).filter(Boolean).join('\n\n'));
      const rawImages = (postPayload && typeof postPayload === 'object' && Array.isArray(postPayload.images))
        ? postPayload.images.filter(Boolean).slice(0, 4)
        : [];
      if (!rawText && rawImages.length === 0) return { success: false, error: 'No social post content provided' };
      const postText = rawText ? this.spinText(rawText) : '';

      let editor = queryFirstVisibleSelector([
        '[data-testid="tweetTextarea_0"]',
        '.share-creation-state__text-editor .ql-editor',
        '.share-creation-state__text-editor div[role="textbox"]',
        'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
        'div[role="textbox"][aria-label*="post" i]',
        'textarea[placeholder*="what\'s happening" i]',
        'textarea[placeholder*="start a post" i]'
      ]);
      if (!editor) {
        editor = await this.findUniversalCommentComposer();
      }
      if (editor) {
        if (postText) {
          await formFiller.safeSetRichTextContent(editor, postText);
        }
        if (rawImages.length > 0) {
          try {
            const container = editor.closest('[role="dialog"], form, section, main') || document;
            const fileInput = container.querySelector('input[type="file"][data-testid="fileInput"], input[type="file"][accept*="image"]')
              || document.querySelector('input[type="file"][data-testid="fileInput"], input[type="file"][accept*="image"]');
            if (fileInput) {
              const dt = new DataTransfer();
              for (let idx = 0; idx < rawImages.length; idx++) {
                const src = String(rawImages[idx] || '');
                if (!src.startsWith('data:')) continue;
                const arr = src.split(',');
                const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png';
                const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                const filename = `social-post-${idx + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
                dt.items.add(new File([u8arr], filename, { type: mime }));
              }
              if (dt.files.length > 0) {
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          } catch (imgErr) {
            logger.warn('[SocialPost] Could not attach images to file input:', imgErr);
          }
        }
        const msg = '📢 Injected Social Post!';
        this.showToast(msg, 'success');
        return { success: true, context: 'social_post', message: msg };
      }
      try {
        if (postText) await navigator.clipboard.writeText(postText);
        const copyMsg = '📋 Social post copied to clipboard! Paste directly into composer.';
        this.showToast(copyMsg, 'warning');
        return { success: true, context: 'social_post', copiedToClipboard: true, message: copyMsg };
      } catch (e) {
        return { success: false, context: 'social_post', error: 'Could not inject or copy social post' };
      }
    },

    async injectSupportReply(replyPayload = '') {
      const rawText = typeof replyPayload === 'string'
        ? replyPayload
        : (replyPayload?.text || replyPayload?.body || replyPayload?.answer || '');
      if (!rawText) return { success: false, error: 'No support reply text provided' };
      const replyText = this.spinText(rawText);

      let editor = queryFirstVisibleSelector([
        '#new_comment_field',
        'textarea[name="comment[body]"]',
        '.zendesk-editor--rich-text-container [contenteditable="true"]',
        '[data-test-id="editor-view"] [contenteditable="true"]',
        '.intercom-composer textarea',
        '.intercom-composer [contenteditable="true"]',
        '.fr-element[contenteditable="true"]',
        '.c-reply__editor [contenteditable="true"]',
        'div[role="textbox"][aria-label*="reply" i]',
        'div[role="textbox"][contenteditable="true"]',
        'textarea[placeholder*="reply" i]',
        'textarea'
      ]);
      if (!editor) {
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable || active.getAttribute('role') === 'textbox')) {
          editor = active;
        }
      }
      if (!editor) {
        editor = await this.findUniversalCommentComposer();
      }
      if (editor) {
        await formFiller.safeSetRichTextContent(editor, replyText);
        const msg = '🛟 Injected Support Reply!';
        this.showToast(msg, 'success');
        return { success: true, context: 'support', message: msg };
      }
      try {
        await navigator.clipboard.writeText(replyText);
        const copyMsg = '📋 Support reply copied to clipboard! Paste into ticket box.';
        this.showToast(copyMsg, 'warning');
        return { success: true, context: 'support', copiedToClipboard: true, message: copyMsg };
      } catch (e) {
        return { success: false, context: 'support', error: 'Could not inject or copy support reply' };
      }
    },

    async execute(payload = {}) {
      if (this.isExecuting) {
        logger.warn('[Universal Post] Execution already in progress, skipping duplicate call');
        return { success: false, duplicate: true, message: 'Execution in progress' };
      }
      this.isExecuting = true;
      try {
        return await this._doExecute(payload);
      } finally {
        setTimeout(() => { this.isExecuting = false; }, 800);
      }
    },

    async _doExecute(payload = {}) {
      const brandData = payload.brandData || (payload.brandName || payload.brandId || payload.comments || payload.social ? payload : {});
      const suppressionList = brandData.suppressionList || payload.suppressionList || [];

      // 0. Suppression Check
      const currentUrl = window.location.href.toLowerCase();
      const currentDomain = window.location.hostname.toLowerCase();
      const isSuppressed = Array.isArray(suppressionList) && suppressionList.some(item => {
        if (!item) return false;
        const cleanDomain = (typeof item === 'object' ? (item.domain || item.url || '') : item).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        const cleanUrl = (typeof item === 'object' ? (item.url || item.domain || '') : item).trim().toLowerCase();
        return (cleanDomain && currentDomain.includes(cleanDomain)) || (cleanUrl && currentUrl.includes(cleanUrl));
      });

      if (isSuppressed) {
        const warnMsg = `🚫 Domain "${currentDomain}" is in your suppression list. Skipped.`;
        this.showToast(warnMsg, 'warning');
        return { success: false, isSuppressed: true, domain: currentDomain, message: warnMsg };
      }

      const detected = this.detectContext();
      logger.log('[Universal Post] Detected Context:', detected);

      // Branch A: Webmail (Gmail / Outlook / Yahoo)
      if (detected.type === 'webmail') {
        const rawEmails = Array.isArray(brandData.emails) ? brandData.emails : [];
        const activeEmails = rawEmails.filter(e => e.active !== false && e.enabled !== false && ((e.subject && e.subject.trim().length > 0) || (e.body && e.body.trim().length > 0)));

        if (activeEmails.length === 0) {
          const warnMsg = '⚠️ All email variations are currently deactivated. Please enable at least one email in the sidebar.';
          this.showToast(warnMsg, 'warning');
          return { success: false, context: 'email', domain: currentDomain, message: warnMsg };
        }

        const pickedEmail = activeEmails[Math.floor(Math.random() * activeEmails.length)];
        const res = await this.injectWebmail(detected.subtype, pickedEmail, brandData);
        res.domain = currentDomain;
        return res;
      }

      // Branch B: Direct Message (DM)
      if (detected.type === 'dm') {
        const rawDms = Array.isArray(brandData.dms) ? brandData.dms : [];
        const activeDms = rawDms.filter(d => d.active !== false && d.enabled !== false && (d.message && d.message.trim().length > 0));

        if (activeDms.length === 0) {
          const warnMsg = '⚠️ All DM templates are currently deactivated. Please enable at least one DM in the sidebar.';
          this.showToast(warnMsg, 'warning');
          return { success: false, context: 'dm', domain: currentDomain, message: warnMsg };
        }

        const pickedDm = activeDms[Math.floor(Math.random() * activeDms.length)];
        const res = await this.injectDirectMessage(pickedDm.message);
        res.domain = currentDomain;
        return res;
      }

      // Branch B2: New Post / New Article / New Thread -> Article
      if (detected.type === 'article') {
        const rawArticles = Array.isArray(brandData.articles) ? brandData.articles : [];
        const activeArticles = rawArticles.filter(a => a && a.active !== false && a.enabled !== false && ((a.title && a.title.trim().length > 0) || (a.body && a.body.trim().length > 0)));

        if (activeArticles.length === 0) {
          const warnMsg = '⚠️ All article templates are currently deactivated. Please add or enable an article in the sidebar.';
          this.showToast(warnMsg, 'warning');
          return { success: false, context: 'article', domain: currentDomain, message: warnMsg };
        }

        const pickedArticle = activeArticles[Math.floor(Math.random() * activeArticles.length)];
        const res = await this.injectArticle({
          ...pickedArticle,
          title: this.spinText(pickedArticle.title || ''),
          body: this.spinText(pickedArticle.body || '')
        }, 'text');
        res.domain = currentDomain;
        return res;
      }

      // Branch B3: Support Desk & Issue Reply -> Support FAQs & Macros (Pro)
      if (detected.type === 'support') {
        if (payload.isPro === false) {
          const warnMsg = '👑 Email Responses (Support & FAQs) is a Pro feature. Upgrade to Pro to unlock.';
          this.showToast(warnMsg, 'warning');
          return { success: false, context: 'support', domain: currentDomain, requiresUpgrade: true, message: warnMsg };
        }
        const macros = Array.isArray(brandData.support?.macros) ? brandData.support.macros : [];
        const faqs = Array.isArray(brandData.support?.faqs) ? brandData.support.faqs : [];
        const activeSupport = [
          ...macros.filter(m => m && m.enabled !== false && (m.body || '').trim()).map(m => m.body),
          ...faqs.filter(f => f && f.enabled !== false && (f.answer || '').trim()).map(f => f.answer)
        ];
        if (activeSupport.length > 0) {
          const pickedReply = activeSupport[Math.floor(Math.random() * activeSupport.length)];
          const res = await this.injectSupportReply(pickedReply);
          res.domain = currentDomain;
          return res;
        }
      }

      // Branch B4: Top-level Social Post Composer -> Social Posts
      if (detected.type === 'social_post') {
        const rawPosts = Array.isArray(brandData.socialPosts) ? brandData.socialPosts : [];
        const activePosts = rawPosts.filter(p => p && p.enabled !== false && ((p.hook && p.hook.trim()) || (p.body && p.body.trim())));
        if (activePosts.length > 0) {
          const pickedPost = activePosts[Math.floor(Math.random() * activePosts.length)];
          const res = await this.injectSocialPost(pickedPost);
          res.domain = currentDomain;
          return res;
        }
      }

      // Branch C: Directory Listing
      if (detected.type === 'directory') {
        const d = brandData.directory || {};
        const bInfo = brandData.brandInfo || {};
        const activeTaglines = (d.taglines || []).filter(t => t && t.active !== false && t.enabled !== false && (t.text || (typeof t === 'string' ? t : '')).trim().length > 0);
        const activePitches = (d.pitches || []).filter(p => p && p.active !== false && p.enabled !== false && (p.text || (typeof p === 'string' ? p : '')).trim().length > 0);
        const activeSummaries = (d.summaries || []).filter(s => s && s.active !== false && s.enabled !== false && (s.text || (typeof s === 'string' ? s : '')).trim().length > 0);
        const activeDescriptions = (d.descriptions || []).filter(de => de && de.active !== false && de.enabled !== false && (de.text || (typeof de === 'string' ? de : '')).trim().length > 0);

        const pickRandom = (arr, fallback = '') => {
          if (!arr || arr.length === 0) return fallback;
          const chosen = arr[Math.floor(Math.random() * arr.length)];
          return (typeof chosen === 'string' ? chosen : chosen.text) || fallback;
        };

        const payloadData = {
          productName: d.productName || d.name || bInfo.name || brandData.brandName || 'Listing',
          name: d.productName || d.name || bInfo.name || brandData.brandName || 'Listing',
          websiteUrl: d.websiteUrl || d.website || bInfo.url || '',
          demoUrl: d.demoUrl || '',
          category: d.category || d.primaryCategory || 'Marketing & Sales',
          pricingModel: d.pricingModel || d.pricingType || 'Freemium',
          startingPrice: d.startingPrice || 'Free',
          tagline: pickRandom(activeTaglines, bInfo.tagline || d.tagline || ''),
          elevatorPitch: pickRandom(activePitches, d.elevatorPitch || ''),
          mediumSummary: pickRandom(activeSummaries, d.mediumSummary || ''),
          longDescription: pickRandom(activeDescriptions, bInfo.description || d.longDescription || d.description || ''),
          description: pickRandom(activeDescriptions, bInfo.description || d.longDescription || d.description || ''),
          taglines: d.taglines || [],
          pitches: d.pitches || [],
          summaries: d.summaries || [],
          descriptions: d.descriptions || [],
          emails: brandData.emails || [],
          logoUrl: d.logoUrl || bInfo.logo || '',
          faviconUrl: d.faviconUrl || bInfo.favicon || '',
          makerName: d.makerName || (d.maker && d.maker.name) || '',
          makerEmail: d.makerEmail || (d.maker && d.maker.email) || '',
          makerTwitter: d.makerTwitter || (d.maker && d.maker.twitter) || bInfo.twitter || '',
          slides: d.slides || [],
          screenshotUrls: (d.slides || []).map(s => s.url)
        };

        const fillRes = await formFiller.fillDirectoryPageFields(payloadData, {
          candidates: [...activeTaglines, ...activePitches, ...activeSummaries]
        });

        if (fillRes.filledCount > 0) {
          const msg = `📁 Auto-filled ${fillRes.filledCount} directory listing fields!`;
          this.showToast(msg, 'success');
          return {
            success: true,
            context: 'directory',
            domain: currentDomain,
            fieldsFilled: fillRes.filledCount,
            message: msg
          };
        } else {
          const warnMsg = fillRes.total === 0
            ? '⚠️ No fillable form inputs found on this directory page.'
            : '⚠️ Directory detected, but no matching fields could be filled.';
          this.showToast(warnMsg, 'warning');
          return {
            success: false,
            context: 'directory',
            domain: currentDomain,
            fieldsFilled: 0,
            message: warnMsg
          };
        }
      }

      // Branch D: Social Comment
      if (detected.type === 'social') {
        const commentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
        const activePool = String(brandData?.activeCommentPool || 'all').trim() || 'all';
        const rawComments = Array.isArray(brandData.comments) && brandData.comments.length > 0
          ? brandData.comments
          : (Array.isArray(brandData.social?.comments) && brandData.social.comments.length > 0
              ? brandData.social.comments
              : []);

        const hasAnyEnabledComments = rawComments.some(c => {
          if (typeof c === 'string') return c.trim().length > 0;
          return c && c.active !== false && c.enabled !== false && (c.text && c.text.trim().length > 0);
        });

        let activeComments = commentUtils
          ? commentUtils.getCommentsForPostingPool(brandData, activePool)
          : rawComments.filter(c => {
              if (typeof c === 'string') return c.trim().length > 0;
              return c.active !== false && c.enabled !== false && (c.text && c.text.trim().length > 0);
            });

        if (activeComments.length === 0 && activePool.toLowerCase() !== 'all' && hasAnyEnabledComments) {
          const poolWarnMsg = `⚠️ No active comments found in pool "${activePool}". Add/enable a comment with this tag or switch your Posting Pool.`;
          this.showToast(poolWarnMsg, 'warning');
          return { success: false, context: 'social', domain: currentDomain, message: poolWarnMsg };
        }

        // Robust fallback: if activeComments is empty (no enabled comments anywhere in campaign), check brand marketing messages, taglines, or pitch
        if (activeComments.length === 0) {
          const fallbackCandidates = [
            brandData.brandInfo?.tagline,
            brandData.brandInfo?.description,
            brandData.directory?.tagline,
            brandData.directory?.elevatorPitch,
            brandData.contact?.message
          ].filter(Boolean);
          if (fallbackCandidates.length > 0) {
            activeComments = fallbackCandidates;
          }
        }

        if (activeComments.length === 0) {
          const warnMsg = '⚠️ All comment variations are currently deactivated. Please enable at least one comment in the sidebar.';
          this.showToast(warnMsg, 'warning');
          return { success: false, context: 'social', domain: currentDomain, message: warnMsg };
        }

        let picked = null;
        let matchedByAi = false;
        let matchedIndex = -1;

        const aiContextMatchingEnabled = (payload.settings?.aiContextMatching !== false) && (window.__traffic_builder_ai_matching !== false);
        if (aiContextMatchingEnabled && activeComments.length > 1) {
          try {
            const thread = this.extractThreadContext();
            if (thread.title || thread.body) {
              const variationsList = activeComments.map(c => typeof c === 'string' ? c : (c.text || ''));
              const matchRes = await new Promise((resolve) => {
                const timer = setTimeout(() => resolve(null), 3500);
                chrome.runtime.sendMessage({
                  type: 'matchThreadContext',
                  threadTitle: thread.title,
                  threadBody: thread.body,
                  variations: variationsList
                }, (resp) => {
                  clearTimeout(timer);
                  resolve(resp);
                });
              });

              if (matchRes && matchRes.success && typeof matchRes.bestIndex === 'number' && activeComments[matchRes.bestIndex]) {
                picked = activeComments[matchRes.bestIndex];
                matchedByAi = true;
                matchedIndex = matchRes.bestIndex;
              }
            }
          } catch (e) {
            logger.warn('AI context matching error, falling back:', e);
          }
        }

        if (!picked) {
          picked = activeComments[Math.floor(Math.random() * activeComments.length)];
        }

        const rawComment = typeof picked === 'string' ? picked : (picked.text || '');
        const activeBrandName = brandData?.brandName || brandData?.name || '';
        let activeComment = this.spinText(rawComment, { brandName: activeBrandName });
        if (autoVariationEnabled && !payload.settings?.autoVariatedComments) {
          activeComment = await this.resolveAutoVariationAsync(rawComment, {
            spunText: activeComment,
            brand: brandData,
            brandName: activeBrandName
          });
        }
        if (commentUtils && typeof commentUtils.applySafeDomainTransform === 'function') {
          activeComment = commentUtils.applySafeDomainTransform(activeComment, brandData);
        }
        if (currentDomain.includes('twitter.com') || currentDomain.includes('x.com')) {
          activeComment = activeComment.replace(/https?:\/\/([^\s/$.?#].[^\s]*)/gi, '$1');
        }

        let editor = await this.findUniversalCommentComposer();
        const matchedPlatformScroll = findRecipeByHost(cachedSelectorRecipes.platforms, currentDomain);
        if (!editor && matchedPlatformScroll?.recipe?.sectionScroll?.length) {
          const sectionEl = queryFirstSelector(matchedPlatformScroll.recipe.sectionScroll);
          if (sectionEl) {
            try { sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            await new Promise(r => setTimeout(r, 600));
            editor = await this.findUniversalCommentComposer();
          }
        }
        if (!editor) {
          const active = document.activeElement;
          if (active && (
            active.tagName === 'TEXTAREA' ||
            (active.tagName === 'INPUT' && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(active.type)) ||
            active.isContentEditable ||
            active.getAttribute('role') === 'textbox'
          )) {
            editor = active;
          }
        }

        if (editor) {
          const simKey = Boolean(payload.settings?.simulateKeystrokes || payload.brandData?.settings?.simulateKeystrokes);
          await formFiller.safeSetRichTextContent(editor, activeComment, { simulateKeystrokes: simKey });
          const msg = matchedByAi
            ? `🎯 AI matched variation #${matchedIndex + 1} to thread for "${brandData.brandName || 'brand'}"!`
            : (simKey ? `⌨️ Typed comment for "${brandData.brandName || 'brand'}"!` : `💬 Injected active comment for "${brandData.brandName || 'brand'}"!`);
          this.showToast(msg, 'success');
          return {
            success: true,
            context: 'social',
            subtype: detected.subtype || 'social',
            domain: currentDomain,
            matchedByAi,
            matchedIndex,
            message: msg
          };
        } else {
          try {
            await navigator.clipboard.writeText(activeComment);
            const copyMsg = matchedByAi
              ? `🎯 AI matched variation #${matchedIndex + 1} copied to clipboard! (Click comment box and press Ctrl+V)`
              : '📋 Comment copied to clipboard! Click comment box and press Ctrl+V to paste.';
            this.showToast(copyMsg, 'warning');
            return { success: true, context: 'social', domain: currentDomain, matchedByAi, matchedIndex, copiedToClipboard: true, message: copyMsg };
          } catch (e) {
            return { success: false, context: 'social', domain: currentDomain, error: 'Could not inject or copy comment' };
          }
        }
      }

      // Branch D: Contact Form
      const contactData = {
        name: brandData.contact?.senderName || brandData.contact?.name || 'Alex Vance',
        email: brandData.contact?.senderEmail || brandData.contact?.email || 'alex@focusgummies.co',
        phone: brandData.contact?.phone || '(415) 890-3421',
        company: brandData.contact?.company || brandData.brandName || 'Focus Gummies',
        website: brandData.contact?.website || brandData.directory?.websiteUrl || 'https://focusgummies.co',
        subject: this.spinText(brandData.contact?.subject || 'Partnership & Inquiry'),
        message: this.spinText(brandData.contact?.message || 'Hello, I came across your website and would love to explore a partnership.')
      };

      const forms = formFiller.findForms();
      if (forms.length > 0) {
        const targetForm = forms[0];
        let filledCount = 0;
        for (const field of targetForm.fields) {
          try {
            const val = formFiller.getFieldValue(field, contactData, false);
            if (val) {
              const ok = await formFiller.setFieldValue(field.element, val);
              if (ok) filledCount++;
            }
          } catch (err) {}
        }
        const msg = `⚡ Filled ${filledCount} contact form fields for "${brandData.brandName || 'brand'}"!`;
        this.showToast(msg, 'success');
        return {
          success: true,
          context: 'contact',
          domain: currentDomain,
          fieldsFilled: filledCount,
          message: msg
        };
      }

      // Ultimate universal fallback: find any editor or active focused element on the page
      let anyEditor = await this.findUniversalCommentComposer();
      if (!anyEditor) {
        const active = document.activeElement;
        if (active && (
          active.tagName === 'TEXTAREA' ||
          (active.tagName === 'INPUT' && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(active.type)) ||
          active.isContentEditable ||
          active.getAttribute('role') === 'textbox'
        )) {
          anyEditor = active;
        }
      }

      const fallbackCommentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
      const fallbackActivePool = String(brandData?.activeCommentPool || 'all').trim() || 'all';
      const rawComments = Array.isArray(brandData.comments) && brandData.comments.length > 0
        ? brandData.comments
        : (Array.isArray(brandData.social?.comments) && brandData.social.comments.length > 0
            ? brandData.social.comments
            : []);
      const activeComments = fallbackCommentUtils
        ? fallbackCommentUtils.getCommentsForPostingPool(brandData, fallbackActivePool)
        : rawComments.filter(c => typeof c === 'string' ? c.trim().length > 0 : (c.enabled !== false && (c.text || '').trim().length > 0));
      const picked = activeComments.length > 0
        ? (typeof activeComments[0] === 'string' ? activeComments[0] : (activeComments[0].text || ''))
        : (brandData.contact?.message || brandData.directory?.tagline || brandData.brandInfo?.tagline || '');
      let spun = this.spinText(picked, { brandName: brandData?.brandName || brandData?.name || '' });
      if (fallbackCommentUtils && typeof fallbackCommentUtils.applySafeDomainTransform === 'function') {
        spun = fallbackCommentUtils.applySafeDomainTransform(spun, brandData);
      }
      if (currentDomain.includes('twitter.com') || currentDomain.includes('x.com')) {
        spun = spun.replace(/https?:\/\/([^\s/$.?#].[^\s]*)/gi, '$1');
      }

      if (anyEditor) {
        await formFiller.safeSetRichTextContent(anyEditor, spun);
        const msg = `💬 Universal Post injected into composer on ${currentDomain}!`;
        this.showToast(msg, 'success');
        return {
          success: true,
          context: 'social',
          domain: currentDomain,
          fieldsFilled: 1,
          message: msg
        };
      }

      // If absolutely no editor is found, copy spun text to clipboard as safety net!
      if (spun) {
        try {
          await navigator.clipboard.writeText(spun);
          const copyMsg = '📋 Comment copied to clipboard! (Click on any input or comment field to paste)';
          this.showToast(copyMsg, 'warning');
          return {
            success: true,
            context: 'clipboard_fallback',
            domain: currentDomain,
            copiedToClipboard: true,
            message: copyMsg
          };
        } catch (e) {}
      }

      const noFormMsg = '⚠️ No supported forms or composers detected on this tab.';
      this.showToast(noFormMsg, 'warning');
      logger.warn(noFormMsg, { domain: currentDomain, url: window.location.href });
      return {
        success: false,
        context: 'unknown',
        domain: currentDomain,
        message: noFormMsg
      };
    }
  };

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.log('Received message:', message);

    if (message.type === 'detectContext') {
      if (window !== window.top) {
        const hasVisible = Boolean(document.querySelector('div[contenteditable="true"], textarea, form'));
        if (!hasVisible) {
          sendResponse({ success: false, inIframe: true });
          return false;
        }
      }
      const detected = universalEngine.detectContext();
      sendResponse({ success: true, context: detected });
      return true;
    }

    if (message.type === 'executeUniversalPost') {
      if (window !== window.top) {
        const hasTarget = Boolean(document.querySelector('div[contenteditable="true"], textarea, input:not([type="hidden"])'));
        if (!hasTarget) {
          sendResponse({ success: false, inIframe: true });
          return false;
        }
      }
      (async () => {
        try {
          const res = await universalEngine.execute(message);
          sendResponse(res);
        } catch (err) {
          logger.error('Universal post execution failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message.type === 'getThreadContext') {
      const threadCtx = universalEngine.extractThreadContext();
      sendResponse({ success: true, threadContext: threadCtx });
      return true;
    }

    if (message.type === 'extractPageCopy') {
      if (window !== window.top) {
        return false;
      }
      const pageContext = universalEngine.extractPageCopy();
      sendResponse({ success: true, pageContext });
      return true;
    }

    if (message.type === 'injectComment' || message.type === 'insertTwitterComment') {
      (async () => {
        const now = Date.now();
        if (window.__tbLastCommentInjectTime && now - window.__tbLastCommentInjectTime < 800) {
          sendResponse({ success: true, debounced: true });
          return;
        }
        window.__tbLastCommentInjectTime = now;

        const msgBrandName = message.brandName || '';
        const msgBrandData = message.brandData || window.__tbCompanionInstance?.activeBrand || null;
        const rawInput = message.text || '';
        let text = universalEngine.spinText(rawInput, { brandName: msgBrandName });
        if (autoVariationEnabled && message.isComment !== false && !message.autoVariated) {
          text = await universalEngine.resolveAutoVariationAsync(rawInput, {
            spunText: text,
            brand: msgBrandData,
            brandName: msgBrandName
          });
        }
        if (!message.postingRulesApplied) {
          const msgCommentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
          if (msgCommentUtils && typeof msgCommentUtils.applySafeDomainTransform === 'function' && msgBrandData) {
            text = msgCommentUtils.applySafeDomainTransform(text, msgBrandData);
          }
          const injectHost = String(window.location.hostname || '').toLowerCase();
          if (injectHost.includes('twitter.com') || injectHost.includes('x.com')) {
            text = text.replace(/https?:\/\/([^\s/$.?#].[^\s]*)/gi, '$1');
          }
        }
        const simulateKeystrokes = Boolean(message.simulateKeystrokes);
        let editor = await universalEngine.findUniversalCommentComposer();
        if (editor) {
          await formFiller.safeSetRichTextContent(editor, text, { simulateKeystrokes });
          formFiller.findAndFocusSubmitButton(editor);
          const toastMsg = simulateKeystrokes ? '⌨️ Comment typed into reply box!' : '💬 Comment inserted into reply box!';
          universalEngine.showToast(toastMsg, 'success');
          const detected = universalEngine.detectContext();
          sendResponse({
            success: true,
            context: 'social',
            subtype: detected.subtype || 'social',
            simulatedKeystrokes: simulateKeystrokes,
            message: toastMsg
          });
        } else {
          // If running inside a non-target iframe without a composer, exit silently
          if (window !== window.top) {
            sendResponse({ success: false, inIframe: true });
            return;
          }
          try {
            await navigator.clipboard.writeText(text);
            universalEngine.showToast('📋 Comment copied to clipboard!', 'warning');
            sendResponse({ success: true, copiedToClipboard: true });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        }
      })();
      return true;
    }

    if (message.type === 'injectEmail') {
      (async () => {
        try {
          const rawEmail = message.email || {};
          const email = {
            subject: universalEngine.spinText(rawEmail.subject || ''),
            body: universalEngine.spinText(rawEmail.body || '')
          };
          const res = await universalEngine.injectWebmail('general', email, {});
          sendResponse(res);
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (message.type === 'injectDm') {
      (async () => {
        try {
          const res = await universalEngine.injectDirectMessage(message.message || '');
          sendResponse(res);
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (message.type === 'injectArticle') {
      (async () => {
        try {
          const res = await universalEngine.injectArticle(message.article || {}, message.format || 'text');
          sendResponse(res);
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (message.type === 'injectSocialPost') {
      (async () => {
        try {
          const res = await universalEngine.injectSocialPost(message.post || message.text || '');
          sendResponse(res);
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (message.type === 'injectSupportReply') {
      (async () => {
        try {
          if (message.isPro === false) {
            const warnMsg = '👑 Email Responses (Support & FAQs) is a Pro feature. Upgrade to Pro to unlock.';
            universalEngine.showToast(warnMsg, 'warning');
            sendResponse({ success: false, requiresUpgrade: true, error: warnMsg });
            return;
          }
          const res = await universalEngine.injectSupportReply(message.text || '');
          sendResponse(res);
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (message.type === 'toggleDone') {
      if (window.__tbCompanionInstance && window.__tbCompanionInstance.toggleDone) {
        window.__tbCompanionInstance.toggleDone().then(res => sendResponse(res));
        return true;
      }
      sendResponse({ success: false, error: 'Companion not active' });
      return true;
    }

    if (message.type === 'activeBrandChanged') {
      if (window.__tbCompanionInstance && window.__tbCompanionInstance.onBrandChanged) {
        window.__tbCompanionInstance.onBrandChanged(message.activeBrandId, message.brandData);
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'completedUrlsUpdated') {
      if (window.__tbCompanionInstance && window.__tbCompanionInstance.onCompletedUrlsUpdated) {
        window.__tbCompanionInstance.onCompletedUrlsUpdated(message.completedUrls);
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'workspaceRecipesUpdated') {
      cachedSelectorRecipes = normalizeSelectorRecipes(message.selectorRecipes);
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'setFloatingWidgetEnabled' || message.type === 'updateCompanionSettings') {
      const enabled = message.type === 'setFloatingWidgetEnabled'
        ? Boolean(message.enabled)
        : (message.settings?.floatingWidgetEnabled ?? message.settings?.companionWidgetEnabled ?? message.enabled);
      if (!window.__tbCompanionInstance) {
        const comp = new FloatingCompanion();
        comp.settings.floatingWidgetEnabled = enabled;
        comp.init();
      } else if (window.__tbCompanionInstance.updateSettings) {
        window.__tbCompanionInstance.updateSettings(
          message.type === 'setFloatingWidgetEnabled'
            ? { floatingWidgetEnabled: enabled }
            : (message.settings || { floatingWidgetEnabled: enabled })
        );
      }
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'testSingleForm') {
      (async () => {
        try {
          logger.log('=== TEST SINGLE FORM ===');
          logger.log('Data source:', message.dataSource);
          
          // 0. URL Suppression Check
          const currentUrl = window.location.href.toLowerCase();
          const currentDomain = window.location.hostname.toLowerCase();
          let suppression = message.suppressionList;
          if (!suppression || !Array.isArray(suppression)) {
            try {
              const suppResp = await chrome.runtime.sendMessage({ type: 'getSuppressionList' });
              suppression = suppResp?.suppressionList || [];
            } catch (e) {
              suppression = [];
            }
          }
          const isSuppressed = Array.isArray(suppression) && suppression.some(item => {
            if (!item) return false;
            const cleanDomain = (typeof item === 'object' ? (item.domain || item.url || '') : item).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
            const cleanUrl = (typeof item === 'object' ? (item.url || item.domain || '') : item).trim().toLowerCase();
            return (cleanDomain && currentDomain.includes(cleanDomain)) || (cleanUrl && currentUrl.includes(cleanUrl));
          });
          if (isSuppressed) {
            sendResponse({
              success: false,
              isSuppressed: true,
              error: `⚠️ Domain "${currentDomain}" is in your suppression list. Skipped.`
            });
            return;
          }

          // Find forms
          const forms = formFiller.findForms();
          if (forms.length === 0) {
            sendResponse({ success: false, error: 'No forms found on this page' });
            return;
          }
          
          let dataToUse = {};
          const isAi = message.dataSource === 'ai';
          
          if (!isAi) {
            // Get form data from background script
            logger.log('Requesting form data...');
            const formDataResponse = await chrome.runtime.sendMessage({
              type: 'getCustomData'
            });
            dataToUse = formDataResponse?.customData || {};
            
            if (Object.keys(dataToUse).length === 0 || (!dataToUse.name && !dataToUse.email)) {
              // Fallback to default demo custom data so form testing works out of the box
              dataToUse = {
                name: 'Alex Rivera',
                email: 'alex.rivera@example.com',
                phone: '(555) 234-5678',
                company: 'Rivera Enterprises',
                website: 'https://riveraenterprises.com',
                subject: 'Outreach & Partnership Request',
                message: 'Hello! I noticed your website and would love to explore potential partnership and outreach collaboration.'
              };
            }
          }
          
          // Fill the form
          let filledCount = 0;
          const errors = [];
          const targetForm = forms[0];
          
          for (const field of targetForm.fields) {
            try {
              const val = formFiller.getFieldValue(field, dataToUse, isAi);
              if (val) {
                const ok = await formFiller.setFieldValue(field.element, val);
                if (ok) filledCount++;
              }
            } catch (err) {
              errors.push(err.message);
            }
          }
          
          const result = {
            success: filledCount > 0,
            filled: filledCount,
            total: targetForm.fields.length,
            errors,
            message: `Filled ${filledCount} of ${targetForm.fields.length} fields successfully`
          };
          
          // Submit if requested
          if ((message.formActionMode === 'fill-and-submit' || message.formActionMode === 'fill-submit') && result.success) {
            try {
              targetForm.element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              result.message += ' and submitted';
            } catch (error) {
              logger.warn('Could not submit form:', error);
            }
          }
          
          sendResponse({ success: true, result });
        } catch (error) {
          logger.error('Error in testSingleForm:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep message channel open
    }

    if (message.type === 'fillDirectoryForm') {
      (async () => {
        try {
          logger.log('=== FILL DIRECTORY FORM ===', 'mode:', message.formActionMode);

          // 1. URL Suppression Check
          const currentUrl = window.location.href.toLowerCase();
          const currentDomain = window.location.hostname.toLowerCase();
          const suppression = message.suppressionList || [];
          const isSuppressed = Array.isArray(suppression) && suppression.some(item => {
            if (!item) return false;
            const cleanDomain = (typeof item === 'object' ? (item.domain || item.url || '') : item).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
            const cleanUrl = (typeof item === 'object' ? (item.url || item.domain || '') : item).trim().toLowerCase();
            return (cleanDomain && currentDomain.includes(cleanDomain)) || (cleanUrl && currentUrl.includes(cleanUrl));
          });

          if (isSuppressed) {
            sendResponse({
              success: false,
              isSuppressed: true,
              error: `⚠️ Directory "${currentDomain}" is in your suppression list. Skipped to prevent duplicate listing.`
            });
            return;
          }

          let directoryData = message.directoryData;
          if (!directoryData || Object.keys(directoryData).length === 0) {
            const resp = await chrome.runtime.sendMessage({ type: 'getDirectoryData' });
            directoryData = resp?.directoryData || {};
          }

          // Fallback if no campaign data configured yet
          if (!directoryData.productName && !directoryData.name) {
            directoryData = {
              productName: 'ContactFormSubmitter & Directory Suite',
              tagline: 'Automate contact forms & submit your startup to 100+ directories in minutes',
              elevatorPitch: 'Zero-friction marketing automation suite for indie hackers and agencies to blast outreach and get listed across high-DR directories with verified client reporting.',
              longDescription: 'ContactFormSubmitter & Directory Suite is an all-in-one growth acceleration toolkit. It combines intelligent contact form outreach, automated Product Hunt-style directory submissions across 100+ platforms, white-label client proof reporting, and an X (Twitter) organic amplification engine.',
              category: 'Marketing & Sales',
              pricingModel: 'Freemium',
              startingPrice: '$29',
              websiteUrl: 'https://contact-form-site-mu.vercel.app',
              demoUrl: 'https://contact-form-site-mu.vercel.app/demo',
              faviconUrl: 'https://contact-form-site-mu.vercel.app/favicon.png',
              logoUrl: 'https://contact-form-site-mu.vercel.app/logo.png',
              makerName: 'Growth Engineering Team',
              makerEmail: 'founder@growthsuite.io',
              makerTwitter: '@growthsuite'
            };
          }

          // Find forms and interactive fields
          const forms = formFiller.findForms();
          const fillRes = await formFiller.fillDirectoryPageFields(directoryData);
          const targetFields = fillRes.targetFields;

          if (targetFields.length === 0) {
            sendResponse({ success: false, error: 'No form inputs found on this page' });
            return;
          }

          const filledCount = fillRes.filledCount;
          const errors = fillRes.errors;
          const filledSummary = fillRes.filledSummary;

          const isSubmitMode = message.formActionMode === 'fill-submit' || message.formActionMode === 'fill-and-submit' || message.actionMode === 'fill-submit';
          let submitted = false;
          let retryAttempts = 0;
          const maxRetries = message.retryCount || 3;

          if (isSubmitMode && filledCount > 0) {
            while (!submitted && retryAttempts < maxRetries) {
              retryAttempts++;
              try {
                // Check unfilled required fields and retry filling them
                for (const field of targetFields) {
                  const el = field.element;
                  const isReq = el.required || el.getAttribute('aria-required') === 'true' || el.classList.contains('required');
                  if (isReq && (!el.value || el.value.trim() === '')) {
                    const fallbackVal = formFiller.getDirectoryFieldValue(field, directoryData);
                    if (fallbackVal) await formFiller.setFieldValue(el, fallbackVal);
                  }
                }

                // Locate submit trigger
                let submitBtn = null;
                if (forms.length > 0) {
                  submitBtn = forms[0].element.querySelector('button[type="submit"], input[type="submit"]');
                }
                if (!submitBtn) {
                  const allBtns = Array.from(document.querySelectorAll('button, input[type="submit"], a.button, a.btn'));
                  submitBtn = allBtns.find(b => {
                    const txt = (b.textContent || b.value || '').toLowerCase();
                    return txt.includes('submit') || txt.includes('publish') || txt.includes('launch') || 
                           txt.includes('add product') || txt.includes('list product') || txt.includes('create listing');
                  });
                }

                if (submitBtn) {
                  submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  submitBtn.click();
                  submitted = true;
                } else if (forms.length > 0 && forms[0].element) {
                  forms[0].element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                  submitted = true;
                } else {
                  break;
                }
              } catch (retryErr) {
                logger.warn(`Submit attempt ${retryAttempts} failed:`, retryErr);
                await new Promise(r => setTimeout(r, 600));
              }
            }

            // Record proof report entry on submission
            if (submitted) {
              try {
                await chrome.runtime.sendMessage({
                  type: 'recordDirectoryProof',
                  directory: document.title.split(/[-|•]/)[0].trim() || window.location.hostname,
                  liveUrl: window.location.href,
                  status: 'Submitted (Pending Review)',
                  notes: `AI Auto-Fill & Submit (${filledCount} fields filled, ${retryAttempts} attempt(s))`,
                  filled: filledCount
                });
              } catch (e) {
                logger.warn('Could not auto-record proof:', e);
              }
            }
          }

          let messageText = '';
          if (isSubmitMode) {
            messageText = submitted 
              ? `🚀 Successfully filled ${filledCount} fields and submitted to directory! (Report logged)`
              : `⚡ Filled ${filledCount} fields. Form submit button not detected automatically.`;
          } else {
            messageText = filledCount > 0 
              ? `Successfully filled ${filledCount} directory fields!` 
              : 'Form detected but no matching fields found. Use Quick Copy pills to paste.';
          }

          const result = {
            success: filledCount > 0,
            filled: filledCount,
            total: targetFields.length,
            fields: filledSummary,
            submitted,
            retries: retryAttempts,
            mode: message.formActionMode || 'fill-only',
            errors,
            message: messageText
          };

          sendResponse({ success: true, result });
        } catch (error) {
          logger.error('Error in fillDirectoryForm:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep message channel open
    }

    // Commenter Engine: Scan Page for Comments
    if (message.type === 'scanCommentFields') {
      (async () => {
        try {
          await recipesReadyPromise;
          const host = window.location.hostname.toLowerCase();
          const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);
          let detectedPlatform = matched
            ? (matched.key.charAt(0).toUpperCase() + matched.key.slice(1))
            : 'Web Community';
          if (!matched) {
            if (document.querySelector('meta[name="generator"][content*="WordPress" i]') || document.querySelector('#commentform, .comment-form, #comment')) detectedPlatform = 'WordPress / Blog';
            else if (document.querySelector('.discourse, #discourse-modal, .d-editor-input')) detectedPlatform = 'Discourse Forum';
          }

          const commentSelectors = [
            ...(matched?.recipe?.composers || []),
            ...(cachedSelectorRecipes.generic?.commentComposers || [])
          ];
          const foundEditor = queryFirstVisibleSelector(commentSelectors);

        const authorField = document.querySelector('#author, input[name="author"], input[id*="author" i], form#commentform input[name*="name" i]');
        const emailField = document.querySelector('#email, input[name="email"], input[id*="email" i], input[type="email"]');
        const urlField = document.querySelector('#url, input[name="url"], input[id*="url" i], input[name*="website" i]');

        const hasEditor = Boolean(foundEditor);
        const details = {
          hasCommentBox: hasEditor,
          hasAuthorField: Boolean(authorField),
          hasEmailField: Boolean(emailField),
          hasUrlField: Boolean(urlField),
          platform: detectedPlatform,
          tag: foundEditor ? (foundEditor.tagName.toLowerCase() + (foundEditor.id ? '#' + foundEditor.id : '')) : 'None'
        };

        sendResponse({
          success: true,
          found: hasEditor,
          platform: detectedPlatform,
          details,
          message: hasEditor
            ? `Found comment input on ${detectedPlatform} (${details.tag})${authorField ? ' with author/email fields' : ''}!`
            : `No comment editor detected automatically on ${detectedPlatform}. Make sure the comment section is open.`
        });
        } catch (err) {
          logger.error('Error scanning comments:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // Commenter Engine: Insert Comment or Post Comment
    if (message.type === 'insertComment' || message.type === 'postComment') {
      (async () => {
        try {
          const rawComment = message.commentText || message.text || '';
          const commentText = universalEngine.spinText(rawComment);
          const authorName = message.authorName || message.brandName || '';
          const authorEmail = message.authorEmail || '';
          const authorWebsite = message.authorWebsite || message.backlinkUrl || '';
          const mode = message.mode || (message.type === 'postComment' ? 'submit' : 'draft'); // 'submit' | 'draft'
          const simulateTyping = message.simulateTyping !== false;

          await recipesReadyPromise;

          // Detect platform via synced recipe or generic fallback
          const host = window.location.hostname.toLowerCase();
          const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);
          const platform = matched
            ? (matched.key.charAt(0).toUpperCase() + matched.key.slice(1))
            : 'Generic / Web Blog';

          logger.log(`[Commenter] Processing comment injection for platform: ${platform}`, {
            mode,
            simulateTyping,
            length: commentText.length
          });

          const targetSelectors = [
            ...(matched?.recipe?.composers || []),
            ...(cachedSelectorRecipes.generic?.commentComposers || [])
          ];
          let editor = queryFirstVisibleSelector(targetSelectors);

          if (!editor) {
            editor = await universalEngine.findUniversalCommentComposer();
          }

          let fieldsFilled = 0;

          // Auto-fill author metadata if present (WordPress & Web blog comments)
          const authorField = document.querySelector('#author, input[name="author"], input[id*="author" i], form#commentform input[name*="name" i]');
          if (authorField && authorName) {
            formFiller.setFieldValue(authorField, authorName);
            fieldsFilled++;
          }

          const emailField = document.querySelector('#email, input[name="email"], input[id*="email" i], input[type="email"]');
          if (emailField && authorEmail) {
            formFiller.setFieldValue(emailField, authorEmail);
            fieldsFilled++;
          }

          const urlField = document.querySelector('#url, input[name="url"], input[id*="url" i], input[name*="website" i]');
          if (urlField && authorWebsite) {
            formFiller.setFieldValue(urlField, authorWebsite);
            fieldsFilled++;
          }

          if (editor) {
            // Scroll comment input into viewport and dispatch focus, click
            editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
            editor.focus();
            editor.click();

            const editableEl = editor.isContentEditable ? editor : (editor.querySelector('[contenteditable="true"]') || editor);
            await formFiller.safeSetRichTextContent(editableEl, commentText);

            // Dispatch reactive event suite for React / Vue / Angular / Custom web components (skip on Twitter as Draft.js already handled it)
            const isTwitterHost = host.includes('twitter.com') || host.includes('x.com');
            if (!isTwitterHost) {
              editableEl.dispatchEvent(new Event('input', { bubbles: true }));
              editableEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            try { editableEl.focus(); } catch (_) {}

            // Visual purple pulse glow
            editor.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            editor.style.borderColor = '#9333ea';
            editor.style.boxShadow = '0 0 0 3px rgba(147, 51, 234, 0.4)';
            setTimeout(() => {
              if (editor) {
                editor.style.borderColor = '';
                editor.style.boxShadow = '';
              }
            }, 3000);

            fieldsFilled++;

            let submitted = false;
            // If mode === 'submit', locate and click the respective submit/post button
            if (mode === 'submit') {
              const submitSelectors = [
                ...(matched?.recipe?.submitButtons || []),
                ...(cachedSelectorRecipes.generic?.submitButtons || [])
              ];

              for (const sSel of submitSelectors) {
                try {
                  const sBtn = document.querySelector(sSel);
                  if (sBtn && sBtn.offsetParent !== null && !sBtn.disabled) {
                    sBtn.click();
                    submitted = true;
                    logger.log('[Commenter] Clicked submit button:', sSel);
                    break;
                  }
                } catch (_) {}
              }

              // Text content heuristic search if not clicked yet
              if (!submitted) {
                const buttons = Array.from(document.querySelectorAll('button, a.button, input[type="button"]'));
                const btn = buttons.find(b => {
                  const t = (b.innerText || b.value || '').trim().toLowerCase();
                  return (t === 'comment' || t === 'post comment' || t === 'post' || t === 'submit comment' || t === 'reply') && b.offsetParent !== null && !b.disabled;
                });
                if (btn) {
                  btn.click();
                  submitted = true;
                  logger.log('[Commenter] Clicked text-matched submit button:', btn.innerText);
                }
              }
            }

            sendResponse({
              success: true,
              platform,
              url: window.location.href,
              fieldsFilled,
              submitted,
              mode,
              timestamp: Date.now(),
              message: submitted
                ? `🚀 Comment posted automatically to ${platform}!`
                : `✨ Comment successfully injected into ${platform} (${fieldsFilled} field${fieldsFilled > 1 ? 's' : ''} filled)`
            });
          } else {
            // Fallback: copy to clipboard
            try {
              await navigator.clipboard.writeText(commentText);
            } catch {}
            sendResponse({
              success: false,
              platform,
              url: window.location.href,
              copied: true,
              timestamp: Date.now(),
              message: `No active comment box detected on ${platform}. Comment copied to clipboard! Focus comment box and press Ctrl+V.`
            });
          }
        } catch (err) {
          logger.error('Error inserting comment:', err);
          sendResponse({ success: false, error: err.message, timestamp: Date.now() });
        }
      })();
      return true;
    }
  });

  // ============================================================
  // PHASE 2: IN-PAGE FLOATING COMPANION COCKPIT & SUPPRESSION
  // ============================================================
  class FloatingCompanion {
    constructor() {
      this.host = null;
      this.shadow = null;
      this.brandProfiles = [];
      this.activeBrandId = null;
      this.activeBrand = null;
      this.completedUrls = {};
      this.isProUser = false;
      this.settings = {
        floatingWidgetEnabled: true,
        floatingWidgetShortcuts: true
      };
      this.isCollapsed = false;
      this.variationIndex = 0;
      this.variationPool = [];
      this.lastComposer = null;
      this.dragOffset = { x: 0, y: 0 };
      this.isDragging = false;
    }

    static resolveIsProFromStorage(res = {}) {
      const isPaid = (val, roleVal) => {
        const r = String(roleVal || '').trim().toLowerCase();
        const t = String(val || '').trim().toLowerCase();
        if (r === 'admin') return true;
        return t === 'pro' || t === 'studio' || t === 'unlimited' || t === 'agency' || t === 'team' || t === 'ultra' || t === 'growth' || t === 'lifetime' || t === 'premium' || t.startsWith('pro') || t.startsWith('studio') || t.startsWith('unlimited');
      };
      const claim = res?.sp_entitlement_claim;
      const claimValid = claim && (!claim.expiresAt || Number(claim.expiresAt) > Date.now());
      if (claimValid && isPaid(claim.tier, claim.role)) return true;
      const boot = res?.sp_workspace_bootstrap;
      if (boot?.isPro === true || boot?.isUnlimited === true || isPaid(boot?.tier, boot?.role)) return true;
      const sesUser = (res?.authUserSession || res?.cf_auth_session)?.user;
      if (sesUser && isPaid(sesUser.tier || sesUser.plan, sesUser.role)) return true;
      return false;
    }

    isBlacklisted() {
      try {
        const proto = window.location.protocol;
        if (proto !== 'http:' && proto !== 'https:') return true;
        const host = window.location.hostname.toLowerCase();
        if (host === 'google.com' || host.endsWith('.google.com')) return true;
        if (host === 'gmail.com' || host.endsWith('.gmail.com') || host === 'mail.google.com') return true;
        return false;
      } catch (e) {
        return true;
      }
    }

    getPageTarget() {
      const href = window.location.href;
      const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
      const matched = findRecipeByHost(cachedSelectorRecipes.platforms, host);
      const isSocial = Boolean(matched);
      const category = matched
        ? (matched.key.charAt(0).toUpperCase() + matched.key.slice(1))
        : 'Outreach';

      if (isSocial) {
        let normUrl = href.split('#')[0].replace(/\/+$/, '').toLowerCase();
        if (href.includes('/watch')) {
          try {
            const urlObj = new URL(href);
            const v = urlObj.searchParams.get('v');
            if (v) normUrl = `${urlObj.origin}/watch?v=${v}`;
            else normUrl = normUrl.split('?')[0];
          } catch {}
        } else {
          normUrl = normUrl.split('?')[0];
        }

        return {
          type: 'url',
          id: normUrl,
          url: normUrl,
          domain: host,
          isSocial: true,
          category
        };
      } else {
        return {
          type: 'domain',
          id: host,
          url: href,
          domain: host,
          isSocial: false,
          category
        };
      }
    }

    async init() {
      if (this.isBlacklisted()) return;
      if (document.getElementById('tb-companion-host')) return;
      await recipesReadyPromise;

      // Load storage state
      try {
        const storageArea = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;
        if (storageArea) {
          const res = await new Promise(r => storageArea.get(['campaignProfiles', 'activeCampaignId', 'brandProfiles', 'activeBrandId', 'completed_urls', 'completedUrls', 'floatingWidgetEnabled', 'companionWidgetEnabled', 'floatingWidgetShortcuts', 'sp_entitlement_claim', 'sp_workspace_bootstrap', 'authUserSession', 'cf_auth_session'], r));
          this.brandProfiles = Array.isArray(res?.campaignProfiles) ? res.campaignProfiles : (Array.isArray(res?.brandProfiles) ? res.brandProfiles : []);
          this.activeBrandId = res?.activeCampaignId || res?.activeBrandId || (this.brandProfiles[0]?.campaignId || this.brandProfiles[0]?.brandId || 'brand-focus-gummies-sample');
          this.completedUrls = res?.completed_urls || res?.completedUrls || {};
          this.isProUser = FloatingCompanion.resolveIsProFromStorage(res);
          if (res?.floatingWidgetEnabled !== undefined) {
            this.settings.floatingWidgetEnabled = res.floatingWidgetEnabled;
          } else if (res?.companionWidgetEnabled !== undefined) {
            this.settings.floatingWidgetEnabled = res.companionWidgetEnabled;
          }
          if (res?.floatingWidgetShortcuts !== undefined) this.settings.floatingWidgetShortcuts = res.floatingWidgetShortcuts;
        }
      } catch (err) {
        logger.warn('Error loading storage in companion:', err);
      }

      this.resolveActiveBrand();
      this.rebuildVariationPool();

      // Check saved collapsed state
      try {
        this.isCollapsed = localStorage.getItem('tb_companion_collapsed') === 'true';
      } catch {}

      if (this.settings.floatingWidgetEnabled !== false) {
        this.renderWidget();
      }

      this.initShortcuts();
      this.initNavigationObserver();
      this.checkThreadDeduplication();
      window.__tbCompanionInstance = this;
    }

    resolveActiveBrand() {
      if (this.brandProfiles.length > 0) {
        this.activeBrand = this.brandProfiles.find(b => b.brandId === this.activeBrandId) || this.brandProfiles[0];
        if (this.activeBrand) this.activeBrandId = this.activeBrand.brandId;
      }
      if (!this.activeBrand) {
        this.activeBrand = {
          brandId: 'brand-focus-gummies-sample',
          brandName: 'Focus Gummies - Sample Product',
          brandInfo: { name: 'Focus Gummies', url: 'https://focusgummies.co' },
          contact: { message: 'Hello! We produce Focus Gummies and would love to explore a partnership.' },
          social: { comments: [{ text: 'Focus Gummies combine Lion\'s Mane & L-Theanine for calm, laser-sharp flow state.' }] }
        };
        this.activeBrandId = this.activeBrand.brandId;
      }
    }

    rebuildVariationPool() {
      const b = this.activeBrand;
      if (!b) {
        this.variationPool = [];
        return;
      }

      const detected = universalEngine.detectContext();
      let pool = [];

      const sortByStarred = (items) => {
        const arr = Array.isArray(items) ? [...items] : [];
        return arr.sort((x, y) => (y?.starred ? 1 : 0) - (x?.starred ? 1 : 0));
      };

      const commentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
      const activePool = String(b.activeCommentPool || 'all').trim() || 'all';

      if (detected.type === 'social') {
        const rawSorted = sortByStarred(b.social?.comments || b.comments || []);
        const pooled = commentUtils
          ? commentUtils.getCommentsForPostingPool({ ...b, social: { ...(b.social || {}), comments: rawSorted }, comments: rawSorted }, activePool)
          : rawSorted.filter(c => typeof c === 'string' || (c && c.enabled !== false && c.active !== false));
        pool = pooled
          .map(c => typeof c === 'string' ? c : (c.text || ''))
          .filter(Boolean);
      } else if (detected.type === 'dm') {
        const raw = b.dms || [];
        pool = raw.filter(d => d && d.enabled !== false).map(d => d.message).filter(Boolean);
      } else if (detected.type === 'article') {
        const raw = b.articles || [];
        pool = raw.filter(a => a && a.enabled !== false).map(a => a.body || a.title).filter(Boolean);
      } else if (detected.type === 'social_post') {
        const rawPosts = Array.isArray(b.socialPosts) ? b.socialPosts : [];
        pool = rawPosts
          .filter(p => p && p.enabled !== false)
          .map(p => [p.hook, p.body, p.ctaUrl].map(s => String(s || '').trim()).filter(Boolean).join('\n\n'))
          .filter(Boolean);
      } else if (detected.type === 'support') {
        if (this.isProUser === false) {
          pool = [];
        } else {
          const macros = Array.isArray(b.support?.macros) ? b.support.macros : [];
          const faqs = Array.isArray(b.support?.faqs) ? b.support.faqs : [];
          pool = [
            ...macros.filter(m => m && m.enabled !== false).map(m => m.body),
            ...faqs.filter(f => f && f.enabled !== false).map(f => f.answer)
          ].filter(Boolean);
        }
      } else if (detected.type === 'webmail') {
        const raw = b.emails || [];
        pool = raw.filter(e => e && e.enabled !== false).map(e => e.body).filter(Boolean);
      } else if (detected.type === 'directory') {
        const dir = b.directory || {};
        const taglines = (dir.taglines || []).map(t => t.text || t);
        const pitches = (dir.pitches || []).map(p => p.text || p);
        const summaries = (dir.summaries || []).map(s => s.text || s);
        pool = [...pitches, ...taglines, ...summaries].filter(Boolean);
      } else {
        // Contact Form or General
        const contactVars = Array.isArray(b.contact?.messages)
          ? b.contact.messages.filter(m => m && m.enabled !== false && m.active !== false).map(m => m.text || m).filter(Boolean)
          : [];
        const msg = b.contact?.message;
        const contactPool = contactVars.length > 0 ? contactVars : (msg ? [msg] : []);
        const rawSortedComms = sortByStarred(b.social?.comments || b.comments || []);
        const pooledComms = commentUtils
          ? commentUtils.getCommentsForPostingPool({ ...b, social: { ...(b.social || {}), comments: rawSortedComms }, comments: rawSortedComms }, activePool)
          : rawSortedComms;
        const comms = pooledComms.map(c => typeof c === 'string' ? c : (c.text || '')).filter(Boolean);
        const emails = (b.emails || []).map(e => e.body);
        pool = [...contactPool, ...comms, ...emails].filter(Boolean);
      }

      if (pool.length === 0) {
        const firstContactVar = Array.isArray(b.contact?.messages)
          ? (b.contact.messages.find(m => m && m.enabled !== false && (m.text || '').trim())?.text || '')
          : '';
        const fallback = firstContactVar || b.contact?.message || b.brandInfo?.description || b.brandInfo?.tagline || '';
        pool = fallback ? [fallback] : [];
      }

      this.variationPool = pool;
      if (this.variationIndex >= this.variationPool.length) {
        this.variationIndex = 0;
      }
    }

    renderWidget() {
      if (this.host) this.host.remove();

      this.host = document.createElement('div');
      this.host.id = 'tb-companion-host';
      this.host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; font-size: 12px; pointer-events: none;';
      this.shadow = this.host.attachShadow({ mode: 'open' });

      const target = this.getPageTarget();
      const isCompleted = Boolean(this.completedUrls[target.id]);
      const compRecord = this.completedUrls[target.id] || null;

      // Load saved positions: expanded supports free X/Y (top, left), collapsed stays right-edge docked (collapsedTop)
      let savedTop = 120;
      let savedLeft = null;
      let savedCollapsedTop = 120;
      try {
        const rawPos = localStorage.getItem('tb_companion_pos');
        if (rawPos) {
          const parsed = JSON.parse(rawPos);
          if (parsed && typeof parsed.top === 'number' && Number.isFinite(parsed.top)) savedTop = parsed.top;
          if (parsed && typeof parsed.left === 'number' && Number.isFinite(parsed.left)) savedLeft = parsed.left;
          if (parsed && typeof parsed.collapsedTop === 'number' && Number.isFinite(parsed.collapsedTop)) {
            savedCollapsedTop = parsed.collapsedTop;
          } else {
            savedCollapsedTop = savedTop;
          }
        }
      } catch {}

      this.expandedPos = { top: savedTop, left: savedLeft };
      this.collapsedTop = savedCollapsedTop;

      const posStyles = this.isCollapsed
        ? `top: ${savedCollapsedTop}px; right: 0px; left: auto;`
        : (savedLeft !== null ? `top: ${savedTop}px; left: ${savedLeft}px; right: auto;` : `top: ${savedTop}px; right: 12px; left: auto;`);

      const styleEl = document.createElement('style');
      styleEl.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .tb-widget-wrap {
          position: fixed;
          ${posStyles}
          pointer-events: auto;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          user-select: none;
          z-index: 2147483647;
        }
        /* Peeking Handle (Collapsed State - Neo-Brutalist, Right-Edge Docked) */
        .tb-peeking-handle {
          display: ${this.isCollapsed ? 'inline-flex' : 'none'};
          align-items: center;
          gap: 6px;
          background: #fdcb6e;
          color: #1e222a;
          padding: 7px 10px 7px 9px;
          border-radius: 10px 0 0 10px;
          box-shadow: -2px 2px 0px #2a2d36;
          cursor: pointer;
          border: 1.5px solid #2a2d36;
          border-right: none;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease;
        }
        .tb-peeking-handle:hover {
          transform: translateX(-3px);
          background: #f4be58;
        }
        .tb-handle-brand-text {
          font-size: 11px;
          font-weight: 700;
          color: #1e222a;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /* Expanded Card (Warm Cream Brutalist Surface + Hard Ink Offset Shadow) */
        .tb-companion-card {
          display: ${this.isCollapsed ? 'none' : 'flex'};
          flex-direction: column;
          width: 336px;
          margin-right: 0;
          background: #FCF9F2;
          border: 1.5px solid #2a2d36;
          border-radius: 10px;
          box-shadow: 3px 3px 0px #2a2d36;
          overflow: visible;
          padding: 9px 10px;
          gap: 8px;
        }
        /* Header Row */
        .tb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          width: 100%;
          cursor: grab;
        }
        .tb-header:active { cursor: grabbing; }
        .tb-drag-handle {
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 3px;
          color: #57606f;
          border-radius: 5px;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .tb-drag-handle:hover {
          background: #F2EBE0;
          color: #2a2d36;
        }
        .tb-drag-handle:active { cursor: grabbing; }
        .tb-brand-dropdown-container {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .tb-brand-trigger {
          width: 100%;
          height: 26px;
          background: #ffffff;
          border: 1px solid #2a2d36;
          border-radius: 6px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          gap: 6px;
          box-shadow: 1px 1px 0px rgba(42, 45, 54, 0.78);
          transition: background 0.14s ease, transform 0.12s ease, box-shadow 0.12s ease;
        }
        .tb-brand-trigger:hover {
          background: #FAF4EB;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 1.5px 1.5px 0px #2a2d36;
        }
        .tb-brand-trigger:active {
          transform: translate(0.5px, 0.5px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        .tb-brand-title {
          font-size: 11px;
          font-weight: 700;
          color: #1e222a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
          flex: 1;
        }
        .tb-brand-menu {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          width: 100%;
          background: #ffffff;
          border: 1.5px solid #2a2d36;
          border-radius: 8px;
          box-shadow: 3px 3px 0px #2a2d36;
          max-height: 160px;
          overflow-y: auto;
          z-index: 100;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tb-brand-item {
          padding: 5px 8px;
          font-size: 11px;
          color: #2a2d36;
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 600;
          transition: background 0.12s ease;
        }
        .tb-brand-item:hover {
          background: #FAF4EB;
          color: #1e222a;
        }
        .tb-brand-item.active {
          background: #fdcb6e;
          color: #1e222a;
          border: 1px solid #2a2d36;
          font-weight: 700;
        }
        .tb-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .tb-context-dropdown-container {
          position: relative;
          flex-shrink: 0;
        }
        .tb-context-pill {
          font-size: 9.5px;
          font-weight: 800;
          color: #1e222a;
          background: #fdcb6e;
          padding: 0 7px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 9999px;
          border: 1px solid #2a2d36;
          box-shadow: 1px 1px 0px rgba(42, 45, 54, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.14s ease, transform 0.12s ease, box-shadow 0.12s ease;
        }
        .tb-context-pill:hover {
          background: #f4be58;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 1.5px 1.5px 0px #2a2d36;
        }
        .tb-context-pill:active {
          transform: translate(0.5px, 0.5px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        .tb-context-pill.is-manual {
          background: #fde68a;
          border-color: #6c5ce7;
        }
        .tb-context-menu {
          position: absolute;
          top: calc(100% + 5px);
          right: 0;
          left: auto;
          min-width: 158px;
          background: #ffffff;
          border: 1.5px solid #2a2d36;
          border-radius: 8px;
          box-shadow: 3px 3px 0px #2a2d36;
          max-height: 220px;
          overflow-y: auto;
          z-index: 110;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tb-context-divider {
          height: 1px;
          background: #ede6d9;
          margin: 2px 4px;
        }
        .tb-context-item {
          padding: 5px 8px;
          font-size: 11px;
          color: #2a2d36;
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          transition: background 0.12s ease;
        }
        .tb-context-item:hover {
          background: #FAF4EB;
          color: #1e222a;
        }
        .tb-context-item.active {
          background: #fdcb6e;
          color: #1e222a;
          border: 1px solid #2a2d36;
          font-weight: 700;
        }
        .tb-context-item-tag {
          font-size: 9px;
          font-weight: 700;
          color: #6c5ce7;
          text-transform: uppercase;
        }
        .tb-btn-minimize,
        .tb-btn-close {
          width: 22px;
          height: 22px;
          background: #ffffff;
          border: 1px solid #2a2d36;
          border-radius: 5px;
          color: #2a2d36;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          box-shadow: 1px 1px 0px rgba(42, 45, 54, 0.72);
          transition: all 0.12s ease;
        }
        .tb-btn-minimize:hover {
          background: #FAF4EB;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 1.5px 1.5px 0px #2a2d36;
        }
        .tb-btn-close:hover {
          background: #fff1f2;
          color: #be123c;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 1.5px 1.5px 0px #2a2d36;
        }
        .tb-btn-minimize:active,
        .tb-btn-close:active {
          transform: translate(0.5px, 0.5px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        /* Action Row: [ ⚡ Post ] [ ◀ 1/N ▶ ] [ Save ] [ ✓ Mark Done ] */
        .tb-action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          width: 100%;
        }
        .tb-btn-fill {
          flex: 1 1 auto;
          height: 30px;
          background: #6c5ce7;
          color: #ffffff;
          border: 1.25px solid #2a2d36;
          border-radius: 7px;
          padding: 0 11px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          white-space: nowrap;
          box-shadow: 1.5px 1.5px 0px #2a2d36;
          transition: all 0.14s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tb-btn-fill:hover {
          background: #5b4bc4;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 2px 2px 0px #2a2d36;
        }
        .tb-btn-fill:active {
          transform: translate(1px, 1px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        /* Cycler Container */
        .tb-cycler {
          display: inline-flex;
          align-items: center;
          height: 30px;
          background: #ffffff;
          border: 1px solid #2a2d36;
          border-radius: 7px;
          padding: 2px;
          flex-shrink: 0;
          gap: 1px;
          box-shadow: 1.5px 1.5px 0px rgba(42, 45, 54, 0.82);
        }
        .tb-cycle-btn {
          background: transparent;
          border: none;
          color: #2a2d36;
          cursor: pointer;
          width: 20px;
          height: 24px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .tb-cycle-btn:hover {
          background: #fdcb6e;
          color: #1e222a;
        }
        .tb-cycle-btn:active {
          background: #f4be58;
        }
        .tb-cycle-badge {
          font-size: 10.5px;
          font-weight: 700;
          color: #1e222a;
          padding: 0 4px;
          min-width: 26px;
          text-align: center;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        /* Save for Later Bookmark Button */
        .tb-btn-save {
          flex-shrink: 0;
          height: 30px;
          background: #ffffff;
          color: #2a2d36;
          border: 1px solid #2a2d36;
          border-radius: 7px;
          padding: 0 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
          box-shadow: 1.5px 1.5px 0px rgba(42, 45, 54, 0.82);
          transition: all 0.14s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tb-btn-save svg {
          color: #6c5ce7;
        }
        .tb-btn-save:hover {
          background: #f1effe;
          color: #5b4bc4;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 2px 2px 0px #2a2d36;
        }
        .tb-btn-save:active {
          transform: translate(1px, 1px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        .tb-btn-save.is-saved {
          background: #6c5ce7;
          color: #ffffff;
          border-color: #2a2d36;
        }
        .tb-btn-save.is-saved svg {
          color: #ffffff;
        }
        /* Done Button */
        .tb-btn-done {
          flex-shrink: 0;
          height: 30px;
          background: #ffffff;
          color: #2a2d36;
          border: 1px solid #2a2d36;
          border-radius: 7px;
          padding: 0 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
          box-shadow: 1.5px 1.5px 0px rgba(42, 45, 54, 0.82);
          transition: all 0.14s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .tb-btn-done:hover {
          background: #FAF4EB;
          color: #1e222a;
          transform: translate(-0.5px, -0.5px);
          box-shadow: 2px 2px 0px #2a2d36;
        }
        .tb-btn-done:active {
          transform: translate(1px, 1px);
          box-shadow: 0.5px 0.5px 0px #2a2d36;
        }
        .tb-btn-done.is-done {
          background: #10b981;
          color: #ffffff;
          border-color: #2a2d36;
          box-shadow: 1.5px 1.5px 0px #2a2d36;
        }
        /* Tooltip */
        .tb-tooltip {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: #1e222a;
          color: #ffffff;
          font-size: 9.5px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 5px;
          border: 1px solid #2a2d36;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 2px 2px 0px rgba(42, 45, 54, 0.65);
          display: none;
          z-index: 200;
        }
        .tb-btn-done:hover .tb-tooltip { display: block; }
        /* Pool Selector & Safe Domain Indicator Row */
        .tb-pool-row {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .tb-pool-label {
          font-size: 9.5px;
          font-weight: 800;
          color: #57606f;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tb-pool-dropdown-container {
          position: relative;
          flex: 1 1 auto;
          min-width: 0;
        }
        .tb-pool-trigger {
          width: 100%;
          min-width: 0;
          height: 24px;
          background: #ffffff;
          color: #1e222a;
          border: 1px solid #2a2d36;
          border-radius: 6px;
          padding: 0 7px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 5px;
          box-shadow: 1px 1px 0px rgba(42, 45, 54, 0.78);
          transition: background 0.14s ease, border-color 0.14s ease, box-shadow 0.12s ease;
          box-sizing: border-box;
        }
        .tb-pool-trigger:hover {
          background: #FAF4EB;
        }
        .tb-pool-trigger.open {
          border-color: #6c5ce7;
          box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.18), 1px 1px 0px #2a2d36;
        }
        .tb-pool-trigger.is-filtered {
          background: #f1effe;
          color: #5b4bc4;
          border-color: #6c5ce7;
        }
        .tb-pool-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
          flex: 1;
          min-width: 0;
        }
        .tb-pool-menu {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          width: 100%;
          min-width: 160px;
          background: #ffffff;
          border: 1.5px solid #2a2d36;
          border-radius: 8px;
          box-shadow: 3px 3px 0px #2a2d36;
          max-height: 165px;
          overflow-y: auto;
          z-index: 120;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          box-sizing: border-box;
        }
        .tb-pool-item {
          padding: 5px 8px;
          font-size: 11px;
          color: #2a2d36;
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          transition: background 0.12s ease;
        }
        .tb-pool-item:hover {
          background: #FAF4EB;
          color: #1e222a;
        }
        .tb-pool-item.active {
          background: #fdcb6e;
          color: #1e222a;
          border: 1px solid #2a2d36;
          font-weight: 700;
        }
        .tb-safe-domain-pill {
          flex-shrink: 0;
          height: 22px;
          padding: 0 6px;
          border-radius: 5px;
          font-size: 9.5px;
          font-weight: 800;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #10b981;
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
        }
        /* Status feedback bar */
        .tb-status-bar {
          font-size: 10.5px;
          font-weight: 600;
          color: #065f46;
          background: #ecfdf5;
          border: 1px solid #2a2d36;
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow: 1px 1px 0px rgba(42, 45, 54, 0.72);
          display: none;
          text-align: center;
        }
      `;

      const wrap = document.createElement('div');
      wrap.className = 'tb-widget-wrap';
      wrap.id = 'tb-widget-wrap';

      const context = universalEngine.detectContext();
      const contextLabel = this.getContextPillLabel(context);

      const totalVariations = this.variationPool.length;
      const counterText = `${this.variationIndex + 1}/${totalVariations}`;

      const dateStr = compRecord?.completedAt
        ? new Date(compRecord.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : 'Recently';
      const tooltipText = isCompleted
        ? `Completed: ${compRecord?.brandName || this.activeBrand.brandName} • ${dateStr} • ${target.category}`
        : `Mark ${target.type === 'url' ? 'URL' : 'domain'} suppressed`;

      wrap.innerHTML = `
        <!-- Peeking Grab Handle (Collapsed State) -->
        <div class="tb-peeking-handle" id="tb-peeking-handle" title="Expand Smart Poster Companion (Alt+S)">
          <svg width="10" height="12" viewBox="0 0 10 12" fill="#2a2d36">
            <circle cx="2" cy="2" r="1.4"/><circle cx="8" cy="2" r="1.4"/>
            <circle cx="2" cy="6" r="1.4"/><circle cx="8" cy="6" r="1.4"/>
            <circle cx="2" cy="10" r="1.4"/><circle cx="8" cy="10" r="1.4"/>
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span class="tb-handle-brand-text" id="tb-handle-brand-text">${this.activeBrand.brandName}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1e222a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>

        <!-- Expanded Companion Card -->
        <div class="tb-companion-card" id="tb-companion-card">
          <!-- Header Row -->
          <div class="tb-header">
            <div class="tb-drag-handle" id="tb-drag-handle" title="Drag to reposition">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
              </svg>
            </div>

            <!-- Custom Brand Selector Dropdown -->
            <div class="tb-brand-dropdown-container">
              <button type="button" class="tb-brand-trigger" id="tb-brand-trigger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span class="tb-brand-title" id="tb-brand-title">${this.activeBrand.brandName}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2a2d36" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="tb-brand-menu" id="tb-brand-menu" style="display: none;"></div>
            </div>

            <div class="tb-header-actions">
              <div class="tb-context-dropdown-container">
                <button type="button" class="tb-context-pill" id="tb-context-trigger" title="Content Type — click to change manually">
                  <span id="tb-context-pill">${contextLabel}</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="tb-context-menu" id="tb-context-menu" style="display: none;"></div>
              </div>
              <button type="button" class="tb-btn-minimize" id="tb-btn-minimize" title="Minimize to edge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="tb-btn-close" id="tb-btn-close" title="Close widget (Re-open with Alt+S or in Settings)">✕</button>
            </div>
          </div>

          <!-- Active Comment Posting Pool Row -->
          <div class="tb-pool-row" id="tb-pool-row">
            <span class="tb-pool-label">Pool</span>
            <div class="tb-pool-dropdown-container" id="tb-pool-dropdown-container">
              <button type="button" class="tb-pool-trigger" id="tb-pool-trigger" title="Active Comment Posting Pool">
                <span class="tb-pool-title" id="tb-pool-title">All Tags (0)</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="tb-pool-menu" id="tb-pool-menu" style="display: none;"></div>
            </div>
            <span class="tb-safe-domain-pill" id="tb-safe-domain-pill" style="display: none;" title="Safe Domain replacement is active">Safe URL</span>
          </div>

          <!-- Action Row (side by side): [ ⚡ Post ] [ ◀ 1/N ▶ ] [ Save ] [ ✓ Mark Done ] -->
          <div class="tb-action-row">
            <!-- 1. Post button -->
            <button type="button" class="tb-btn-fill" id="tb-btn-fill" title="Fill page content (Alt+S) - Manual review mode, never submits">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Post</span>
            </button>

            <!-- 2. Variation Cycler [ ◀ 1/N ▶ ] -->
            <div class="tb-cycler">
              <button type="button" class="tb-cycle-btn" id="tb-cycle-prev" title="Previous variation">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span class="tb-cycle-badge" id="tb-cycler-badge">${counterText}</span>
              <button type="button" class="tb-cycle-btn" id="tb-cycle-next" title="Next variation">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            <!-- 3. Save for Later Bookmark Button -->
            <button type="button" class="tb-btn-save" id="tb-btn-save-thread" title="Save this thread to Product Opportunity Queue">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span id="tb-save-label">Save</span>
            </button>

            <!-- 4. Done / Mark Done button -->
            <button type="button" class="tb-btn-done ${isCompleted ? 'is-done' : ''}" id="tb-btn-done">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span id="tb-done-label">${isCompleted ? 'Done' : 'Mark Done'}</span>
              <div class="tb-tooltip" id="tb-done-tooltip">${tooltipText}</div>
            </button>
          </div>

          <!-- Status strip -->
          <div class="tb-status-bar" id="tb-status-bar"></div>
        </div>
      `;

      this.shadow.appendChild(styleEl);
      this.shadow.appendChild(wrap);

      try {
        if (this.settings.floatingWidgetEnabled === false || (this.settings.floatingWidgetEnabled !== true && localStorage.getItem('tb_companion_dismissed') === 'true')) {
          this.isDismissed = true;
          this.host.style.display = 'none';
        } else {
          this.isDismissed = false;
          this.host.style.display = 'block';
        }
      } catch {}

      document.documentElement.appendChild(this.host);

      this.wireWidgetEvents();
      this.applyWidgetPosition();
      this.renderPoolSelector();
    }

    wireWidgetEvents() {
      const root = this.shadow;
      if (!root) return;

      const card = root.getElementById('tb-companion-card');
      const handle = root.getElementById('tb-peeking-handle');
      const minimizeBtn = root.getElementById('tb-btn-minimize');
      const closeBtn = root.getElementById('tb-btn-close');
      const brandTrigger = root.getElementById('tb-brand-trigger');
      const brandMenu = root.getElementById('tb-brand-menu');
      const fillBtn = root.getElementById('tb-btn-fill');
      const prevBtn = root.getElementById('tb-cycle-prev');
      const nextBtn = root.getElementById('tb-cycle-next');
      const doneBtn = root.getElementById('tb-btn-done');
      const saveBtn = root.getElementById('tb-btn-save-thread');
      const dragHandle = root.getElementById('tb-drag-handle');

      // Close button (X): Disables the floating companion globally across all pages
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.isDismissed = true;
          this.settings.floatingWidgetEnabled = false;
          try {
            localStorage.setItem('tb_companion_dismissed', 'true');
          } catch {}
          if (this.host) this.host.style.display = 'none';

          // Persist disabled state globally in storage
          try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({
                floatingWidgetEnabled: false,
                companionWidgetEnabled: false
              });
            }
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
              chrome.storage.sync.set({
                floatingWidgetEnabled: false,
                companionWidgetEnabled: false
              });
            }
          } catch (_) {}

          // Notify extension header toggle and active views
          try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                type: 'floatingWidgetStateChanged',
                enabled: false
              }).catch(() => {});
            }
          } catch (_) {}
        });
      }

      // Minimize / Expand
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setCollapsed(true);
        });
      }
      if (handle) {
        handle.addEventListener('click', () => {
          if (this._suppressNextHandleClick) {
            this._suppressNextHandleClick = false;
            return;
          }
          this.setCollapsed(false);
        });
      }

      // Brand dropdown toggle (dynamically opens upward or downward based on viewport space)
      const contextTrigger = root.getElementById('tb-context-trigger');
      const contextMenu = root.getElementById('tb-context-menu');
      const poolTrigger = root.getElementById('tb-pool-trigger');
      const poolMenu = root.getElementById('tb-pool-menu');

      if (brandTrigger && brandMenu) {
        brandTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          if (contextMenu) contextMenu.style.display = 'none';
          if (poolMenu) poolMenu.style.display = 'none';
          if (poolTrigger) poolTrigger.classList.remove('open');
          const isOpen = brandMenu.style.display === 'flex';
          if (isOpen) {
            brandMenu.style.display = 'none';
          } else {
            this.renderBrandMenu(brandMenu);
            brandMenu.style.display = 'flex';
            this.positionDropdownMenu(brandTrigger, brandMenu);
          }
        });
      }

      // Content Type dropdown toggle (dynamically opens upward or downward based on viewport space)
      if (contextTrigger && contextMenu) {
        contextTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          if (brandMenu) brandMenu.style.display = 'none';
          if (poolMenu) poolMenu.style.display = 'none';
          if (poolTrigger) poolTrigger.classList.remove('open');
          const isOpen = contextMenu.style.display === 'flex';
          if (isOpen) {
            contextMenu.style.display = 'none';
          } else {
            this.renderContextMenu(contextMenu);
            contextMenu.style.display = 'flex';
            this.positionDropdownMenu(contextTrigger, contextMenu);
          }
        });
      }

      // Pool dropdown toggle (custom styled Shadow DOM dropdown)
      if (poolTrigger && poolMenu) {
        poolTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          if (brandMenu) brandMenu.style.display = 'none';
          if (contextMenu) contextMenu.style.display = 'none';
          const isOpen = poolMenu.style.display === 'flex';
          if (isOpen) {
            poolMenu.style.display = 'none';
            poolTrigger.classList.remove('open');
          } else {
            this.renderPoolSelector();
            poolMenu.style.display = 'flex';
            poolTrigger.classList.add('open');
            this.positionDropdownMenu(poolTrigger, poolMenu);
          }
        });
      }

      // Close all menus on outer click (both page document and shadow root)
      const closeAllMenus = () => {
        if (brandMenu) brandMenu.style.display = 'none';
        if (contextMenu) contextMenu.style.display = 'none';
        if (poolMenu) poolMenu.style.display = 'none';
        if (poolTrigger) poolTrigger.classList.remove('open');
      };
      document.addEventListener('click', closeAllMenus);
      root.addEventListener('click', closeAllMenus);

      // Fill Button
      if (fillBtn) {
        fillBtn.addEventListener('click', () => this.handlePostFill());
      }

      // Cycle Variation Arrows
      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.cycleVariation(-1));
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.cycleVariation(1));
      }

      // Done Button
      if (doneBtn) {
        doneBtn.addEventListener('click', () => this.toggleDone());
      }

      // Save for Later Button
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveCurrentThreadToQueue());
      }

      // Dragging: expanded widget moves freely anywhere (X & Y); collapsed peeking handle stays locked on right edge (Y only)
      const wrapEl = root.getElementById('tb-widget-wrap');
      const headerEl = root.querySelector('.tb-header');
      if (dragHandle && wrapEl) {
        this.makeDraggable(dragHandle, wrapEl, { mode: 'free' });
      }
      if (headerEl && wrapEl) {
        this.makeDraggable(headerEl, wrapEl, {
          mode: 'free',
          ignoreSelector: 'button, select, input, a, .tb-drag-handle, .tb-brand-dropdown-container, .tb-context-dropdown-container, .tb-pool-dropdown-container'
        });
      }
      if (handle && wrapEl) {
        this.makeDraggable(handle, wrapEl, { mode: 'right-edge-y' });
      }

      if (!this._resizeBound) {
        this._resizeBound = true;
        window.addEventListener('resize', () => this.applyWidgetPosition());
      }
    }

    saveWidgetPosition() {
      try {
        localStorage.setItem('tb_companion_pos', JSON.stringify({
          top: Math.round(Number(this.expandedPos?.top ?? 120)),
          left: (this.expandedPos && typeof this.expandedPos.left === 'number' && Number.isFinite(this.expandedPos.left))
            ? Math.round(this.expandedPos.left)
            : null,
          collapsedTop: Math.round(Number(this.collapsedTop ?? 120))
        }));
      } catch {}
    }

    applyWidgetPosition() {
      const wrap = this.shadow ? this.shadow.getElementById('tb-widget-wrap') : null;
      if (!wrap) return;

      if (this.isCollapsed) {
        const h = wrap.offsetHeight || 34;
        const maxTop = Math.max(8, window.innerHeight - h - 8);
        const top = Math.max(8, Math.min(maxTop, Number(this.collapsedTop ?? 120)));
        this.collapsedTop = Math.round(top);
        wrap.style.top = `${this.collapsedTop}px`;
        wrap.style.right = '0px';
        wrap.style.left = 'auto';
        wrap.style.bottom = 'auto';
        wrap.style.alignItems = 'flex-end';
      } else {
        const w = wrap.offsetWidth || 336;
        const h = wrap.offsetHeight || 110;
        const maxTop = Math.max(8, window.innerHeight - h - 8);
        const maxLeft = Math.max(8, window.innerWidth - w - 8);
        const top = Math.max(8, Math.min(maxTop, Number(this.expandedPos?.top ?? 120)));
        this.expandedPos = {
          ...(this.expandedPos || {}),
          top: Math.round(top)
        };
        if (typeof this.expandedPos.left === 'number' && Number.isFinite(this.expandedPos.left)) {
          const left = Math.max(8, Math.min(maxLeft, this.expandedPos.left));
          this.expandedPos.left = Math.round(left);
          wrap.style.left = `${this.expandedPos.left}px`;
          wrap.style.right = 'auto';
        } else {
          wrap.style.right = '12px';
          wrap.style.left = 'auto';
        }
        wrap.style.top = `${this.expandedPos.top}px`;
        wrap.style.bottom = 'auto';
        wrap.style.alignItems = 'flex-end';
      }
    }

    setCollapsed(collapsed) {
      this.isCollapsed = collapsed;
      try {
        localStorage.setItem('tb_companion_collapsed', String(collapsed));
      } catch {}
      const card = this.shadow.getElementById('tb-companion-card');
      const handle = this.shadow.getElementById('tb-peeking-handle');
      if (card && handle) {
        card.style.display = collapsed ? 'none' : 'flex';
        handle.style.display = collapsed ? 'inline-flex' : 'none';
      }
      this.applyWidgetPosition();
    }

    renderBrandMenu(menuEl) {
      if (!menuEl) return;
      menuEl.innerHTML = this.brandProfiles.map(b => {
        const isActive = b.brandId === this.activeBrandId;
        return `
          <div class="tb-brand-item ${isActive ? 'active' : ''}" data-id="${b.brandId}">
            ${b.brandName || 'Brand'}
          </div>
        `;
      }).join('');

      menuEl.querySelectorAll('.tb-brand-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = item.getAttribute('data-id');
          if (id) this.switchBrand(id);
          menuEl.style.display = 'none';
        });
      });
    }

    renderPoolSelector() {
      const root = this.shadow;
      if (!root || !this.activeBrand) return;
      const poolTrigger = root.getElementById('tb-pool-trigger');
      const poolTitle = root.getElementById('tb-pool-title');
      const poolMenu = root.getElementById('tb-pool-menu');
      const safePill = root.getElementById('tb-safe-domain-pill');
      const commentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;

      const safeCfg = this.activeBrand.safeDomain;
      if (safePill) {
        const safeActive = Boolean(safeCfg?.enabled && String(safeCfg?.value || '').trim());
        safePill.style.display = safeActive ? 'inline-flex' : 'none';
        if (safeActive) {
          safePill.title = `Safe Domain active: ${String(safeCfg.value).trim()}`;
        }
      }

      if (!poolTrigger || !poolTitle || !poolMenu) return;
      const availableTags = commentUtils
        ? commentUtils.getCampaignAvailableTags(this.activeBrand)
        : ['General'];
      const counts = commentUtils
        ? commentUtils.getCommentTagCounts(this.activeBrand, { enabledOnly: true })
        : {
            all: (this.activeBrand.social?.comments || this.activeBrand.comments || []).filter(
              (c) => typeof c === 'string' || (c && c.enabled !== false && c.active !== false && String(c.text || '').trim())
            ).length
          };

      const rawPool = String(this.activeBrand.activeCommentPool || 'all').trim() || 'all';
      const currentPool = rawPool.toLowerCase() === 'all'
        ? 'all'
        : (availableTags.find((t) => t.toLowerCase() === rawPool.toLowerCase()) || 'all');

      const escapeHtml = (val) => String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const items = [
        { value: 'all', label: `All Tags (${counts.all || 0})` },
        ...availableTags.map((tag) => ({
          value: String(tag),
          label: `${tag} (${counts[tag] || 0})`
        }))
      ];

      const activeItem = items.find((i) => i.value.toLowerCase() === currentPool.toLowerCase()) || items[0];
      poolTitle.textContent = activeItem ? activeItem.label : 'All Tags (0)';
      poolTrigger.classList.toggle('is-filtered', currentPool.toLowerCase() !== 'all');

      poolMenu.innerHTML = items.map((opt) => {
        const isActive = opt.value.toLowerCase() === currentPool.toLowerCase();
        return `
          <div class="tb-pool-item ${isActive ? 'active' : ''}" data-value="${escapeHtml(opt.value)}">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(opt.label)}</span>
            ${isActive ? '<span style="color: #6c5ce7; font-weight: 800; flex-shrink: 0;">✓</span>' : ''}
          </div>
        `;
      }).join('');

      poolMenu.querySelectorAll('.tb-pool-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = item.getAttribute('data-value') || 'all';
          poolMenu.style.display = 'none';
          poolTrigger.classList.remove('open');
          this.switchPool(val);
        });
      });
    }

    switchPool(poolTag) {
      if (!this.activeBrand) return;
      const nextPool = String(poolTag || 'all').trim() || 'all';
      this.activeBrand.activeCommentPool = nextPool;
      this.activeBrand.updatedAt = new Date().toISOString();

      const targetId = this.activeBrand.brandId || this.activeBrand.campaignId || this.activeBrandId;
      if (Array.isArray(this.brandProfiles)) {
        const idx = this.brandProfiles.findIndex((b) => (b.brandId === targetId || b.campaignId === targetId));
        if (idx >= 0) {
          this.brandProfiles[idx] = {
            ...this.brandProfiles[idx],
            activeCommentPool: nextPool,
            updatedAt: this.activeBrand.updatedAt
          };
        }
      }

      this.variationIndex = 0;
      this.rebuildVariationPool();
      this.renderPoolSelector();

      const badge = this.shadow ? this.shadow.getElementById('tb-cycler-badge') : null;
      if (badge) badge.textContent = `${this.variationIndex + 1}/${this.variationPool.length}`;

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'updateBrandActiveCommentPool',
            brandId: targetId,
            activeBrandId: targetId,
            activeCommentPool: nextPool
          }).catch(() => {});
        }
      } catch (_) {}

      this.showStatus(nextPool.toLowerCase() === 'all' ? 'Pool: All Tags' : `Pool: ${nextPool}`);
    }

    switchBrand(brandId) {
      this.activeBrandId = brandId;
      this.resolveActiveBrand();
      this.rebuildVariationPool();
      this.renderPoolSelector();

      // Save to chrome storage
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ activeBrandId: brandId });
        }
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'broadcastBrandChange',
            activeBrandId: brandId,
            brandData: this.activeBrand
          }).catch(() => {});
        }
      } catch (_) {}

      // Update UI labels
      const titleEl = this.shadow.getElementById('tb-brand-title');
      if (titleEl) titleEl.textContent = this.activeBrand.brandName;
      const handleText = this.shadow.getElementById('tb-handle-brand-text');
      if (handleText) handleText.textContent = this.activeBrand.brandName;
      const badge = this.shadow.getElementById('tb-cycler-badge');
      if (badge) badge.textContent = `${this.variationIndex + 1}/${this.variationPool.length}`;

      this.showStatus(`Active brand: ${this.activeBrand.brandName}`);
    }

    onBrandChanged(newBrandId, brandData) {
      const targetId = newBrandId || brandData?.brandId || brandData?.campaignId || this.activeBrandId;
      if (!targetId) return;

      if (brandData && typeof brandData === 'object') {
        const idx = this.brandProfiles.findIndex((b) => (b.brandId === targetId || b.campaignId === targetId));
        if (idx >= 0) this.brandProfiles[idx] = { ...this.brandProfiles[idx], ...brandData };
        else this.brandProfiles.push(brandData);
      }

      if (targetId !== this.activeBrandId || (brandData && typeof brandData === 'object')) {
        this.activeBrandId = targetId;
        this.resolveActiveBrand();
        this.rebuildVariationPool();
        this.renderPoolSelector();

        const titleEl = this.shadow ? this.shadow.getElementById('tb-brand-title') : null;
        if (titleEl) titleEl.textContent = this.activeBrand.brandName;
        const handleText = this.shadow ? this.shadow.getElementById('tb-handle-brand-text') : null;
        if (handleText) handleText.textContent = this.activeBrand.brandName;
        const badge = this.shadow ? this.shadow.getElementById('tb-cycler-badge') : null;
        if (badge) badge.textContent = `${this.variationIndex + 1}/${this.variationPool.length}`;
      }
    }

    onCompletedUrlsUpdated(updatedMap) {
      if (updatedMap) {
        this.completedUrls = updatedMap;
        this.refreshDoneButtonState();
      }
    }

    refreshDoneButtonState() {
      const target = this.getPageTarget();
      const isCompleted = Boolean(this.completedUrls[target.id]);
      const record = this.completedUrls[target.id] || null;

      const doneBtn = this.shadow ? this.shadow.getElementById('tb-btn-done') : null;
      const label = this.shadow ? this.shadow.getElementById('tb-done-label') : null;
      const tooltip = this.shadow ? this.shadow.getElementById('tb-done-tooltip') : null;

      if (doneBtn && label) {
        if (isCompleted) {
          doneBtn.classList.add('is-done');
          doneBtn.classList.remove('anim-saved');
          label.textContent = 'Done';
          const dateStr = record?.completedAt ? new Date(record.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recently';
          if (tooltip) tooltip.textContent = `Completed: ${record?.brandName || this.activeBrand?.brandName || ''} • ${dateStr} • ${target.category}`;
        } else {
          doneBtn.classList.remove('is-done', 'anim-saved');
          label.textContent = 'Mark Done';
          if (tooltip) tooltip.textContent = `Mark ${target.type === 'url' ? 'URL' : 'domain'} suppressed`;
        }
      }
    }

    getContextPillLabel(context) {
      if (!context) return '⚡ Ready';
      if (context.type === 'dm') return '💬 DM';
      if (context.type === 'article') return '📰 Article';
      if (context.type === 'social_post') return '📢 Social Post';
      if (context.type === 'support') return '🛟 Support';
      if (context.type === 'directory') return '📁 Directory';
      if (context.type === 'contact') return '⚡ Contact';
      if (context.type === 'webmail') return '✉️ Email';
      const sub = context.subtype || '';
      if (sub === 'twitter') return '🐦 Twitter';
      if (sub === 'reddit') return '💬 Reddit';
      if (sub === 'youtube') return '🎬 YouTube';
      if (sub === 'pinterest') return '📌 Pinterest';
      if (sub === 'instagram') return '📷 Instagram';
      if (sub === 'facebook' || sub === 'facebook_comments') return '👥 Facebook';
      if (sub === 'threads') return '🧵 Threads';
      if (sub === 'tiktok') return '🎵 TikTok';
      if (sub === 'bluesky') return '🦋 Bluesky';
      if (sub === 'linkedin') return '💼 LinkedIn';
      if (sub === 'quora') return '❓ Quora';
      if (sub === 'medium') return '📝 Medium';
      if (sub === 'disqus') return '💬 Disqus';
      if (sub === 'wordpress' || sub === 'blog') return '💬 Blog';
      if (context.type === 'social') return '💬 Comment';
      return '⚡ Ready';
    }

    positionDropdownMenu(triggerEl, menuEl) {
      if (!triggerEl || !menuEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const naturalHeight = Math.min(menuEl.scrollHeight || 170, 220);

      if (spaceBelow < naturalHeight + 12 && spaceAbove > spaceBelow) {
        menuEl.style.top = 'auto';
        menuEl.style.bottom = 'calc(100% + 5px)';
        menuEl.style.maxHeight = `${Math.max(96, Math.min(220, spaceAbove - 14))}px`;
      } else {
        menuEl.style.bottom = 'auto';
        menuEl.style.top = 'calc(100% + 5px)';
        menuEl.style.maxHeight = `${Math.max(96, Math.min(220, spaceBelow - 14))}px`;
      }
    }

    renderContextMenu(menuEl) {
      if (!menuEl) return;
      const autoCtx = universalEngine.detectContext({ ignoreOverride: true });
      const autoLabel = this.getContextPillLabel(autoCtx);
      const isAuto = !universalEngine.manualContextOverride;
      const currentType = universalEngine.manualContextOverride?.type || '';
      const socialSubtype = autoCtx?.type === 'social' ? (autoCtx.subtype || 'social') : 'social';

      const options = [
        { key: 'auto', label: `✨ Auto (${autoLabel})`, active: isAuto },
        { divider: true },
        { key: 'social', type: 'social', subtype: socialSubtype, label: '💬 Comment', active: !isAuto && currentType === 'social' },
        { key: 'social_post', type: 'social_post', subtype: 'social_post', label: '📢 Social Post', active: !isAuto && currentType === 'social_post' },
        { key: 'support', type: 'support', subtype: 'support', label: '🛟 Support', active: !isAuto && currentType === 'support' },
        { key: 'dm', type: 'dm', subtype: 'dm', label: '💬 DM', active: !isAuto && currentType === 'dm' },
        { key: 'webmail', type: 'webmail', subtype: 'webmail', label: '✉️ Email', active: !isAuto && currentType === 'webmail' },
        { key: 'directory', type: 'directory', subtype: 'directory', label: '📁 Directory', active: !isAuto && currentType === 'directory' },
        { key: 'contact', type: 'contact', subtype: 'contact', label: '⚡ Contact', active: !isAuto && currentType === 'contact' },
        { key: 'article', type: 'article', subtype: 'article', label: '📰 Article', active: !isAuto && currentType === 'article' }
      ];

      menuEl.innerHTML = options.map((opt) => {
        if (opt.divider) return '<div class="tb-context-divider"></div>';
        return `
          <div class="tb-context-item ${opt.active ? 'active' : ''}" data-key="${opt.key}" data-type="${opt.type || ''}" data-subtype="${opt.subtype || ''}">
            <span>${opt.label}</span>
            ${opt.active ? '<span class="tb-context-item-tag">✓</span>' : ''}
          </div>
        `;
      }).join('');

      menuEl.querySelectorAll('.tb-context-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = item.getAttribute('data-key');
          if (key === 'auto') {
            universalEngine.manualContextOverride = null;
            this.showStatus(`Auto-detected: ${autoLabel}`);
          } else {
            const type = item.getAttribute('data-type');
            const subtype = item.getAttribute('data-subtype') || type;
            const badgeText = `Context: ${item.querySelector('span')?.textContent || type}`;
            universalEngine.manualContextOverride = { type, subtype, badgeText };
            this.showStatus(`Switched content type: ${item.querySelector('span')?.textContent || type}`);
          }
          this.rebuildVariationPool();
          this.updateContextUI();
          menuEl.style.display = 'none';
        });
      });
    }

    updateContextUI() {
      const context = universalEngine.detectContext();
      const contextLabel = this.getContextPillLabel(context);

      const pill = this.shadow ? this.shadow.getElementById('tb-context-pill') : null;
      if (pill) pill.textContent = contextLabel;
      const trigger = this.shadow ? this.shadow.getElementById('tb-context-trigger') : null;
      if (trigger) trigger.classList.toggle('is-manual', Boolean(universalEngine.manualContextOverride));

      const total = this.variationPool.length;
      const badge = this.shadow ? this.shadow.getElementById('tb-cycler-badge') : null;
      if (badge) badge.textContent = `${this.variationIndex + 1}/${total}`;
    }

    initNavigationObserver() {
      this.lastObservedUrl = window.location.href;
      const handleUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastObservedUrl) {
          this.lastObservedUrl = currentUrl;
          this.lastComposer = null;
          universalEngine.manualContextOverride = null;
          this.rebuildVariationPool();
          this.refreshDoneButtonState();
          this.updateContextUI();
          this.checkThreadDeduplication();
        }
      };

      try {
        if (!window.__tbHistoryPatched) {
          window.__tbHistoryPatched = true;
          const origPush = history.pushState;
          history.pushState = function(...args) {
            const result = origPush.apply(this, args);
            window.dispatchEvent(new Event('tb-location-change'));
            return result;
          };
          const origReplace = history.replaceState;
          history.replaceState = function(...args) {
            const result = origReplace.apply(this, args);
            window.dispatchEvent(new Event('tb-location-change'));
            return result;
          };
        }
      } catch (_) {}

      window.addEventListener('popstate', handleUrlChange);
      window.addEventListener('hashchange', handleUrlChange);
      window.addEventListener('tb-location-change', handleUrlChange);
      window.addEventListener('yt-navigate-finish', handleUrlChange);
      window.addEventListener('yt-page-data-updated', handleUrlChange);
      setInterval(handleUrlChange, 600);
    }

    updateSettings(newSettings) {
      if (newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        if (newSettings.floatingWidgetEnabled !== undefined) {
          this.settings.floatingWidgetEnabled = Boolean(newSettings.floatingWidgetEnabled);
        } else if (newSettings.companionWidgetEnabled !== undefined) {
          this.settings.floatingWidgetEnabled = Boolean(newSettings.companionWidgetEnabled);
        }

        if (this.settings.floatingWidgetEnabled === false) {
          this.isDismissed = true;
          if (this.host) this.host.style.display = 'none';
        } else {
          this.isDismissed = false;
          try {
            localStorage.setItem('tb_companion_dismissed', 'false');
          } catch {}
          if (!this.host) {
            this.renderWidget();
          } else {
            if (!document.getElementById('tb-companion-host')) {
              document.documentElement.appendChild(this.host);
            }
            this.host.style.display = 'block';
          }
        }
      }
    }

    async findComposer() {
      if (this.lastComposer && document.body.contains(this.lastComposer)) {
        return this.lastComposer;
      }
      const el = await universalEngine.findUniversalCommentComposer();
      if (el) {
        this.lastComposer = el;
        return el;
      }
      return null;
    }

    async cycleVariation(step) {
      if (this.variationPool.length === 0) this.rebuildVariationPool();
      const total = this.variationPool.length;
      if (total === 0) return;

      this.variationIndex = (this.variationIndex + step + total) % total;

      const badge = this.shadow ? this.shadow.getElementById('tb-cycler-badge') : null;
      if (badge) badge.textContent = `${this.variationIndex + 1}/${total}`;

      const rawText = this.variationPool[this.variationIndex];
      const activeBrandName = this.activeBrand?.brandName || this.activeBrand?.name || '';
      let spunText = universalEngine.spinText(rawText, { brandName: activeBrandName });
      if (autoVariationEnabled) {
        spunText = await universalEngine.resolveAutoVariationAsync(rawText, {
          spunText,
          brand: this.activeBrand,
          brandName: activeBrandName
        });
      }
      const cycleCommentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
      if (cycleCommentUtils && typeof cycleCommentUtils.applySafeDomainTransform === 'function' && this.activeBrand) {
        spunText = cycleCommentUtils.applySafeDomainTransform(spunText, this.activeBrand);
      }
      const cycleHost = String(window.location.hostname || '').toLowerCase();
      if (cycleHost.includes('twitter.com') || cycleHost.includes('x.com')) {
        spunText = spunText.replace(/https?:\/\/([^\s/$.?#].[^\s]*)/gi, '$1');
      }

      const targetEl = await this.findComposer();
      if (!targetEl) {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(spunText);
          this.showStatus('📋 Variation copied to clipboard!');
        } catch {}
        return;
      }

      // Programmatically clear and replace in active composer
      this.lastComposer = targetEl;
      await formFiller.safeSetRichTextContent(targetEl, spunText);

      // Visual pulse
      targetEl.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
      targetEl.style.borderColor = '#10b981';
      targetEl.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.4)';
      setTimeout(() => {
        if (targetEl) {
          targetEl.style.borderColor = '';
          targetEl.style.boxShadow = '';
        }
      }, 1000);

      this.showStatus(`Injected variation ${this.variationIndex + 1}/${total}`);
    }

    async handlePostFill() {
      this.rebuildVariationPool();
      this.showStatus('Filling content...');

      try {
        // Execute Universal Post in manual mode (never submits)
        const res = await universalEngine.execute({
          brandData: this.activeBrand,
          executionMode: 'fill-only',
          manualMode: true,
          isPro: Boolean(this.isProUser)
        });

        await this.findComposer();

        if (res && res.success) {
          this.showStatus(res.message || '⚡ Injected! Manual review mode.');
        } else if (res && res.isSuppressed) {
          this.showStatus('🚫 Skipped: Suppressed');
        } else {
          this.showStatus(res?.message || res?.error || 'Could not fill fields');
        }
      } catch (err) {
        logger.error('[Companion] Post fill failed:', err);
        this.showStatus(`⚠️ ${err?.message || 'Fill failed'}`);
      }
    }

    async toggleDone() {
      const target = this.getPageTarget();
      const isAlreadyDone = Boolean(this.completedUrls[target.id]);
      const doneBtn = this.shadow.getElementById('tb-btn-done');
      const label = this.shadow.getElementById('tb-done-label');
      const tooltip = this.shadow.getElementById('tb-done-tooltip');

      if (!isAlreadyDone) {
        // Micro-animation: Saved!
        if (doneBtn && label) {
          doneBtn.classList.add('anim-saved');
          label.textContent = 'Saved!';
        }

        const record = {
          id: target.id,
          brandId: this.activeBrand.brandId,
          brandName: this.activeBrand.brandName,
          url: target.url,
          domain: target.domain,
          category: target.category,
          completedAt: new Date().toISOString()
        };

        this.completedUrls[target.id] = record;

        try {
          chrome.runtime.sendMessage({
            type: 'markUrlCompleted',
            record
          }).catch(() => {});
          chrome.runtime.sendMessage({
            type: 'markOpportunityPosted',
            url: window.location.href
          }).catch(() => {});
        } catch (_) {}

        setTimeout(() => {
          if (doneBtn && label) {
            doneBtn.classList.remove('anim-saved');
            doneBtn.classList.add('is-done');
            label.textContent = 'Done';
            if (tooltip) tooltip.textContent = `Completed: ${record.brandName} • Just now • ${target.category}`;
          }
        }, 750);

        this.showStatus(`✓ Marked Done (${target.domain})`);
        return { success: true, isDone: true, record };
      } else {
        // Unmark
        delete this.completedUrls[target.id];

        if (doneBtn && label) {
          doneBtn.classList.remove('is-done', 'anim-saved');
          label.textContent = 'Mark Done';
          if (tooltip) tooltip.textContent = `Mark ${target.type === 'url' ? 'URL' : 'domain'} suppressed`;
        }

        try {
          chrome.runtime.sendMessage({
            type: 'removeCompletedUrl',
            id: target.id
          }).catch(() => {});
        } catch (_) {}

        this.showStatus(`Unmarked (${target.domain})`);
        return { success: true, isDone: false };
      }
    }

    async saveCurrentThreadToQueue() {
      const saveBtn = this.shadow ? this.shadow.getElementById('tb-btn-save-thread') : null;
      const saveLabel = this.shadow ? this.shadow.getElementById('tb-save-label') : null;

      const target = this.getPageTarget();
      const currentUrl = window.location.href;
      const pageTitle = document.title || currentUrl;
      const platform = (target.category || 'web').toLowerCase();

      if (saveBtn && saveLabel) {
        saveLabel.textContent = '...';
      }

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'saveOpportunityToQueue',
            url: currentUrl,
            title: pageTitle,
            platform: platform,
            campaignId: this.activeBrand?.brandId
          }, (resp) => {
            if (saveBtn && saveLabel) {
              if (resp && resp.alreadyExists) {
                saveLabel.textContent = 'In Queue';
                this.showStatus('⚠️ Already in Opportunity Queue');
              } else if (resp && resp.success) {
                saveBtn.classList.add('is-saved');
                saveLabel.textContent = 'Saved!';
                this.showStatus('✅ Saved to Product Queue!');
              } else {
                saveLabel.textContent = 'Saved!';
                this.showStatus('✅ Thread saved to queue');
              }
              setTimeout(() => {
                if (saveLabel) saveLabel.textContent = 'Save';
              }, 2500);
            }
          });
        }
      } catch (err) {
        console.warn('saveCurrentThreadToQueue error:', err);
      }
    }

    async checkThreadDeduplication() {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
        chrome.storage.local.get(['campaignProfiles', 'brandProfiles'], (data) => {
          const brands = Array.isArray(data?.campaignProfiles) ? data.campaignProfiles : (Array.isArray(data?.brandProfiles) ? data.brandProfiles : []);
          const norm = window.location.href.split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
          for (const b of brands) {
            if (Array.isArray(b.queue)) {
              const item = b.queue.find(i => {
                const itemNorm = (i.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
                return itemNorm === norm && i.status === 'posted';
              });
              if (item) {
                const dateStr = item.postedAt ? new Date(item.postedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'recently';
                this.showStatus(`⚠️ Already posted to thread on ${dateStr} (${b.brandName || b.name})`);
                break;
              }
            }
          }
        });
      } catch (_) {}
    }

    showStatus(msg) {
      const bar = this.shadow ? this.shadow.getElementById('tb-status-bar') : null;
      if (!bar) return;
      bar.textContent = msg;
      bar.style.display = 'block';
      setTimeout(() => {
        if (bar) bar.style.display = 'none';
      }, 3000);
    }

    makeDraggable(handleEl, targetEl, options = {}) {
      const mode = options.mode || 'free';
      const ignoreSelector = options.ignoreSelector || '';

      handleEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (ignoreSelector && e.target && typeof e.target.closest === 'function' && e.target.closest(ignoreSelector)) {
          return;
        }

        e.preventDefault();
        this.isDragging = true;

        const rect = targetEl.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = rect.left;
        const startTop = rect.top;
        let moved = false;

        const onMouseMove = (moveEvent) => {
          if (!this.isDragging) return;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            moved = true;
          }

          const currentRect = targetEl.getBoundingClientRect();
          const w = targetEl.offsetWidth || currentRect.width || 336;
          const h = targetEl.offsetHeight || currentRect.height || 40;
          const maxTop = Math.max(8, window.innerHeight - h - 8);
          const clampedTop = Math.max(8, Math.min(maxTop, startTop + dy));

          if (mode === 'right-edge-y' || this.isCollapsed) {
            targetEl.style.top = `${clampedTop}px`;
            targetEl.style.right = '0px';
            targetEl.style.left = 'auto';
            targetEl.style.bottom = 'auto';
            this.collapsedTop = Math.round(clampedTop);
          } else {
            const maxLeft = Math.max(8, window.innerWidth - w - 8);
            const clampedLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
            targetEl.style.left = `${clampedLeft}px`;
            targetEl.style.top = `${clampedTop}px`;
            targetEl.style.right = 'auto';
            targetEl.style.bottom = 'auto';
            this.expandedPos = {
              left: Math.round(clampedLeft),
              top: Math.round(clampedTop)
            };
          }
        };

        const onMouseUp = () => {
          this.isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);

          if (moved && (mode === 'right-edge-y' || this.isCollapsed)) {
            this._suppressNextHandleClick = true;
            setTimeout(() => {
              this._suppressNextHandleClick = false;
            }, 60);
          }

          if (moved) {
            this.saveWidgetPosition();
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    initShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (!this.settings.floatingWidgetShortcuts) return;

        // Alt+S: Trigger Post / Fill (or restore widget if dismissed and enabled)
        if (e.altKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
          e.preventDefault();
          if (this.isDismissed && this.host && this.settings.floatingWidgetEnabled !== false) {
            this.isDismissed = false;
            try {
              localStorage.setItem('tb_companion_dismissed', 'false');
            } catch {}
            this.host.style.display = 'block';
            return;
          }
          if (this.isPostFilling || (typeof universalEngine !== 'undefined' && universalEngine.isExecuting)) return;
          this.handlePostFill();
        }

        // Alt+D: Toggle Done / Saved
        if (e.altKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
          e.preventDefault();
          this.toggleDone();
        }
      });
    }
  }

  // Initialize companion when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new FloatingCompanion().init();
    });
  } else {
    new FloatingCompanion().init();
  }

  // Listen for storage changes to keep companion widget state synced across tabs
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' || area === 'sync') {
        const val = changes.floatingWidgetEnabled?.newValue ?? changes.companionWidgetEnabled?.newValue;
        if (val !== undefined) {
          if (!window.__tbCompanionInstance && val) {
            const comp = new FloatingCompanion();
            comp.settings.floatingWidgetEnabled = Boolean(val);
            comp.init();
          } else if (window.__tbCompanionInstance && window.__tbCompanionInstance.updateSettings) {
            window.__tbCompanionInstance.updateSettings({ floatingWidgetEnabled: Boolean(val) });
          }
        }
        const inst = window.__tbCompanionInstance;
        if (inst && (changes.sp_entitlement_claim || changes.sp_workspace_bootstrap || changes.authUserSession || changes.cf_auth_session)) {
          try {
            chrome.storage.local.get(['sp_entitlement_claim', 'sp_workspace_bootstrap', 'authUserSession', 'cf_auth_session'], (authData) => {
              inst.isProUser = FloatingCompanion.resolveIsProFromStorage(authData || {});
              inst.rebuildVariationPool();
            });
          } catch (_) {}
        }
        if (inst && (changes.campaignProfiles?.newValue || changes.brandProfiles?.newValue || changes.activeCampaignId?.newValue || changes.activeBrandId?.newValue)) {
          const updatedProfiles = changes.campaignProfiles?.newValue || changes.brandProfiles?.newValue;
          if (Array.isArray(updatedProfiles) && updatedProfiles.length > 0) {
            inst.brandProfiles = updatedProfiles;
          }
          const nextActiveId = changes.activeCampaignId?.newValue || changes.activeBrandId?.newValue || inst.activeBrandId;
          if (nextActiveId) inst.activeBrandId = nextActiveId;
          inst.resolveActiveBrand();
          inst.rebuildVariationPool();
          inst.renderPoolSelector();
          if (inst.shadow && inst.activeBrand) {
            const titleEl = inst.shadow.getElementById('tb-brand-title');
            if (titleEl) titleEl.textContent = inst.activeBrand.brandName;
            const handleText = inst.shadow.getElementById('tb-handle-brand-text');
            if (handleText) handleText.textContent = inst.activeBrand.brandName;
            const badge = inst.shadow.getElementById('tb-cycler-badge');
            if (badge) badge.textContent = `${inst.variationIndex + 1}/${inst.variationPool.length}`;
          }
        }
      }
    });
  }

  // ============================================================================
  // DASHBOARD <-> EXTENSION LIVE BRIDGE (window.postMessage)
  // ============================================================================
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'SMART_POSTER_BRIDGE_REQ') return;
    const { requestId, action, payload } = event.data;

    const reply = (responsePayload) => {
      window.postMessage({
        type: 'SMART_POSTER_BRIDGE_RES',
        requestId,
        ...responsePayload
      }, window.location.origin);
    };

    if (action === 'PING') {
      let version = '1.3.0';
      try {
        version = chrome.runtime.getManifest()?.version || '1.3.0';
      } catch (_) {}
      reply({ success: true, installed: true, version });
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: action,
        payload: payload || {}
      }, (resp) => {
        if (chrome.runtime.lastError) {
          reply({ success: false, error: chrome.runtime.lastError.message });
        } else {
          reply(resp || { success: true });
        }
      });
    } else {
      reply({ success: false, error: 'Extension runtime unavailable' });
    }
  });

  // Notify open Web User Dashboard when extension storage updates
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    const syncKeys = new Set([
      'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId',
      'researchConfig', 'directoryPrefs', 'settings', 'apiKey', 'geminiApiKey', 'aiModel',
      'customModels', 'jevEnabled', 'jevModel', 'captchaApiKey', 'safetyDelay',
      'randomnessLevel', 'randomnessSynonyms', 'randomnessDicts',
      'floatingWidgetEnabled', 'companionWidgetEnabled', 'companionShortcutsEnabled',
      'aiContextMatching', 'tb_simulate_keystrokes', 'tb_auto_variation', 'autoSuppress',
      'completed_urls', 'completedUrls', 'ruleTwitterStripProtocol',
      'traffic_builder_master_logs', 'tb_error_logs', 'suppressionList',
      'savedUrlSets', 'templates', 'customData', 'defaultHome', 'navOrder',
      'deletedBrandTombstones', 'authUserSession', 'cf_auth_session', 'sp_entitlement_claim'
    ]);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' && area !== 'sync') return;
      const changedKeys = Object.keys(changes).filter(k => syncKeys.has(k) || k.startsWith('brandReports_'));
      if (changedKeys.length > 0 && window.location.pathname.includes('dashboard')) {
        window.postMessage({
          type: 'SMART_POSTER_BRIDGE_EVENT',
          event: 'STATE_UPDATED',
          changedKeys
        }, window.location.origin);
      }
    });
  }

  // Portal Local Vault Mirror (survives extension uninstall/reinstall on Smart Poster portal tabs)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    const isPortalOrigin = () => {
      try {
        if (/^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|(?:www\.)?smartposter\.pro|(?:www\.)?poster\.finola\.work|[^/]+\.run\.app|contactformsite\.pages\.dev)/i.test(window.location.origin)) {
          return true;
        }
        return Boolean(
          localStorage.getItem('sp_extension_vault_v1') ||
          localStorage.getItem('authUserSession') ||
          window.location.pathname.includes('dashboard')
        );
      } catch (_) {
        return false;
      }
    };

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.type) return false;
      if (msg.type === 'BACKUP_VAULT_TO_PORTAL') {
        if (!isPortalOrigin()) {
          sendResponse({ success: false, skipped: true });
          return false;
        }
        try {
          if (msg.vaultId) {
            localStorage.setItem('sp_vault_id', String(msg.vaultId));
          }
          if (msg.snapshot && typeof msg.snapshot === 'object') {
            localStorage.setItem('sp_extension_vault_v1', JSON.stringify(msg.snapshot));
          }
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err?.message });
        }
        return false;
      }
      if (msg.type === 'READ_PORTAL_VAULT') {
        if (!isPortalOrigin()) {
          sendResponse({ success: false, skipped: true });
          return false;
        }
        try {
          const safeJson = (key) => {
            try {
              const raw = localStorage.getItem(key);
              return raw ? JSON.parse(raw) : null;
            } catch (_) {
              return null;
            }
          };
          const vaultId = localStorage.getItem('sp_vault_id') || '';
          let snapshot = safeJson('sp_extension_vault_v1');
          const localBrands = safeJson('campaignProfiles') || safeJson('brandProfiles');
          const localSettings = safeJson('sp_settings');
          const localCompleted = safeJson('sp_completed_urls');
          const localLogs = safeJson('sp_master_logs');
          const localErrorLogs = safeJson('sp_error_logs');
          const localSuppression = safeJson('sp_suppression_list');
          const localResearch = safeJson('sp_research_config');
          const localDirPrefs = safeJson('sp_directory_prefs');
          const localTombstones = safeJson('sp_deleted_brand_tombstones');
          const localApiKey = localStorage.getItem('sp_api_key');
          const localGeminiApiKey = localStorage.getItem('sp_gemini_api_key');
          const localAiModel = localStorage.getItem('sp_ai_model');
          const localActiveBrand = localStorage.getItem('activeCampaignId') || localStorage.getItem('activeBrandId');

          if (!snapshot || typeof snapshot !== 'object') {
            snapshot = {
              schemaVersion: 2,
              updatedAt: localSettings?.updatedAt || new Date().toISOString(),
              brandProfiles: Array.isArray(localBrands) ? localBrands : [],
              activeBrandId: localActiveBrand || '',
              deletedBrandTombstones: localTombstones || {},
              settings: localSettings || undefined,
              apiKey: localApiKey !== null ? localApiKey : undefined,
              geminiApiKey: localGeminiApiKey !== null ? localGeminiApiKey : undefined,
              aiModel: localAiModel || undefined,
              suppressionList: Array.isArray(localSuppression) ? localSuppression : undefined,
              completedUrls: localCompleted || undefined,
              directoryPrefs: localDirPrefs || undefined,
              researchConfig: localResearch || undefined,
              masterLogs: Array.isArray(localLogs) ? localLogs : undefined,
              errorLogs: Array.isArray(localErrorLogs) ? localErrorLogs : undefined
            };
          } else if (Array.isArray(localBrands) && localBrands.length > 0 && (!Array.isArray(snapshot.brandProfiles) || snapshot.brandProfiles.length === 0)) {
            snapshot.brandProfiles = localBrands;
            snapshot.activeBrandId = snapshot.activeBrandId || localActiveBrand || '';
          }

          const authSession = safeJson('authUserSession') || safeJson('cf_auth_session');
          const entitlementClaim = safeJson('sp_entitlement_claim');
          sendResponse({
            success: true,
            vaultId,
            snapshot,
            authSession,
            entitlementClaim
          });
        } catch (err) {
          sendResponse({ success: false, error: err?.message });
        }
        return false;
      }
      if (msg.type === 'PORTAL_CLEAR_AUTH_SESSION') {
        if (!isPortalOrigin()) {
          sendResponse({ success: false, skipped: true });
          return false;
        }
        try {
          let shouldClear = Boolean(msg.explicit);
          if (!shouldClear && Array.isArray(msg.deadTokens) && msg.deadTokens.length > 0) {
            const safeRaw = localStorage.getItem('authUserSession') || localStorage.getItem('cf_auth_session');
            if (safeRaw) {
              const parsed = JSON.parse(safeRaw);
              const curTok = parsed?.accessToken || parsed?.token || '';
              if (curTok && msg.deadTokens.includes(curTok)) {
                shouldClear = true;
              }
            }
          }
          if (shouldClear) {
            localStorage.removeItem('authUserSession');
            localStorage.removeItem('cf_auth_session');
            localStorage.removeItem('sp_entitlement_claim');
            window.postMessage({
              type: 'SMART_POSTER_BRIDGE_EVENT',
              event: 'AUTH_CLEARED',
              changedKeys: ['authUserSession', 'cf_auth_session', 'sp_entitlement_claim']
            }, window.location.origin);
          }
          sendResponse({ success: true, cleared: shouldClear });
        } catch (err) {
          sendResponse({ success: false, error: err?.message });
        }
        return false;
      }
      if (msg.type === 'VAULT_RESTORED_TO_PAGE') {
        if (window.location.pathname.includes('dashboard')) {
          window.postMessage({
            type: 'SMART_POSTER_BRIDGE_EVENT',
            event: 'STATE_UPDATED',
            changedKeys: ['vaultRestored']
          }, window.location.origin);
        }
        sendResponse({ success: true });
        return false;
      }
      return false;
    });
  }

  // ============================================================================
  // GOOGLE ALERTS CAMPAIGN-SCOPED SYNC & BATCH ASSISTANT (google.com/alerts)
  // ============================================================================
  if (window.location.hostname.includes('google.') && window.location.pathname.startsWith('/alerts')) {
    const initGoogleAlertsHelper = async () => {
      if (window.__spGoogleAlertsHelperInit) return;
      window.__spGoogleAlertsHelperInit = true;

      const stateAlerts = {
        campaigns: [],
        selectedCampaignId: '',
        syncedUrlsByCampaign: new Map(),
        pendingSetup: null,
        knownFeedUrls: new Set(Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]')).map((a) => String(a.href || '').trim()).filter(Boolean)),
        collapsed: false,
      };

      const sendRuntimeMsg = (payload) => new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve({ success: false });
          return;
        }
        chrome.runtime.sendMessage(payload, (resp) => {
          if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
          else resolve(resp || { success: false });
        });
      });

      const getSelectedSyncedSet = () => {
        if (!stateAlerts.selectedCampaignId) return new Set();
        if (!stateAlerts.syncedUrlsByCampaign.has(stateAlerts.selectedCampaignId)) {
          stateAlerts.syncedUrlsByCampaign.set(stateAlerts.selectedCampaignId, new Set());
        }
        return stateAlerts.syncedUrlsByCampaign.get(stateAlerts.selectedCampaignId);
      };

      const getSelectedCampaignName = () => {
        const found = stateAlerts.campaigns.find((c) => c.id === stateAlerts.selectedCampaignId);
        return found ? found.name : 'Active Product';
      };

      const extractAlertRowQuery = (anchor) => {
        const row = anchor.closest('li.alert_instance, li, tr, [role="listitem"]') || anchor.parentElement?.parentElement?.parentElement;
        if (row) {
          const explicitQueryEl = row.querySelector('.query_div, .alert_query, .query, [data-query]');
          if (explicitQueryEl && explicitQueryEl.textContent) {
            const clean = explicitQueryEl.textContent.replace(/\s+/g, ' ').trim();
            if (clean) return clean;
          }
          try {
            const clone = row.cloneNode(true);
            clone.querySelectorAll('[data-sp-alert-ui], button, a[href*="/alerts/feeds/"], [role="button"], svg, .alert_buttons').forEach((n) => n.remove());
            const lines = (clone.innerText || clone.textContent || '')
              .split(/\r?\n/)
              .map((s) => s.replace(/\s+/g, ' ').trim())
              .filter((s) => s && !/^(rss|edit|delete|\+ sync to smart poster|synced ✓)$/i.test(s));
            if (lines.length > 0) return lines[0];
          } catch (_) {}
        }
        return '';
      };

      const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

      const waitForCondition = async (fn, timeoutMs = 4000, intervalMs = 120) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          try {
            const val = fn();
            if (val) return val;
          } catch (_) {}
          await waitMs(intervalMs);
        }
        return null;
      };

      const simulateUserClick = (el) => {
        if (!el) return;
        try {
          el.focus?.();
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } catch (_) {
          try { el.click?.(); } catch (_) {}
        }
      };

      const isElementVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
        return Boolean(el.offsetParent !== null || el.getClientRects().length > 0);
      };

      const findAlertQueryInput = () => (
        document.querySelector('#query_div input, input[aria-label*="Create an alert" i], #alert_query_input, .create_alert_input input[type="text"], input[type="text"]')
      );

      const findShowOptionsButton = () => (
        Array.from(document.querySelectorAll('span, button, a, [role="button"], .show_options')).find((el) =>
          isElementVisible(el) && /\bshow options\b/i.test((el.textContent || '').trim())
        )
      );

      const selectClosureDropdownWithRetry = async ({ labelRx, triggerHints, optionMatchers, verifyRx }) => {
        // 1. Check native <select> first
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
          const opt = Array.from(sel.options || []).find((o) => optionMatchers.some((rx) => rx.test((o.textContent || '').trim())));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }

        const findTrigger = () => {
          const allTriggers = Array.from(document.querySelectorAll('.goog-flat-menu-button, [role="listbox"], .delivery_select, [aria-haspopup="listbox"], [aria-haspopup="menu"]'))
            .filter(isElementVisible);
          // Try matching by enclosing row label first
          if (labelRx) {
            for (const trig of allTriggers) {
              const row = trig.closest('tr, .alert_option_row, .option_row, div');
              const rowText = (row?.textContent || '').trim();
              if (labelRx.test(rowText)) return trig;
            }
          }
          // Fallback to trigger text/aria-label hints
          return allTriggers.find((b) =>
            triggerHints.some((rx) => rx.test((b.textContent || b.getAttribute('aria-label') || '').trim()))
          ) || null;
        };

        for (let attempt = 0; attempt < 3; attempt++) {
          const trigger = findTrigger();
          if (!trigger) {
            await waitMs(220);
            continue;
          }
          const curTxt = (trigger.textContent || '').trim();
          if (verifyRx && verifyRx.test(curTxt)) return true;

          simulateUserClick(trigger);
          const matchingOption = await waitForCondition(() => {
            const items = Array.from(document.querySelectorAll('.goog-menuitem, .goog-menuitem-content, [role="menuitem"], [role="option"]'))
              .filter(isElementVisible);
            return items.find((el) => optionMatchers.some((rx) => rx.test((el.textContent || '').trim()))) || null;
          }, 1400, 90);

          if (matchingOption) {
            const clickTarget = matchingOption.closest('.goog-menuitem, [role="menuitem"], [role="option"]') || matchingOption;
            simulateUserClick(clickTarget);
            const verified = await waitForCondition(() => {
              const t = findTrigger();
              return t && (!verifyRx || verifyRx.test((t.textContent || '').trim()));
            }, 900, 90);
            if (verified) return true;
          }
          await waitMs(180);
        }

        const finalTrig = findTrigger();
        return Boolean(finalTrig && verifyRx && verifyRx.test((finalTrig.textContent || '').trim()));
      };

      const fillGoogleAlertForm = (queryText, freq = 'realtime', quality = 'all') => {
        const input = findAlertQueryInput();
        if (input && queryText) {
          input.focus();
          input.value = queryText;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const showOpts = findShowOptionsButton();
        if (showOpts) showOpts.click();

        setTimeout(async () => {
          await selectClosureDropdownWithRetry({
            labelRx: /deliver to/i,
            triggerHints: [/deliver to/i, /email/i, /rss/i, /@/],
            optionMatchers: [/^rss feed$/i, /\brss\b/i],
            verifyRx: /\brss\b/i
          });
          await selectClosureDropdownWithRetry({
            labelRx: /how often/i,
            triggerHints: [/how often/i, /once a day/i, /as-it-happens/i, /once a week/i],
            optionMatchers: freq === 'weekly' ? [/once a week/i] : (freq === 'daily' ? [/once a day/i] : [/as-it-happens/i]),
            verifyRx: freq === 'weekly' ? /once a week/i : (freq === 'daily' ? /once a day/i : /as-it-happens/i)
          });
          await selectClosureDropdownWithRetry({
            labelRx: /how many/i,
            triggerHints: [/how many/i, /only the best/i, /all results/i],
            optionMatchers: quality === 'best' ? [/only the best/i] : [/^all results$/i],
            verifyRx: quality === 'best' ? /only the best/i : /all results/i
          });
        }, 350);
      };

      const deleteManagedAlertRows = async (managedFeedUrls = []) => {
        const managedSet = new Set(
          (Array.isArray(managedFeedUrls) ? managedFeedUrls : [])
            .map((u) => String(u || '').trim())
            .filter(Boolean)
        );
        if (managedSet.size === 0) return 0;
        let deletedCount = 0;

        const anchors = Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]'));
        for (const anchor of anchors) {
          const href = String(anchor.href || '').trim();
          if (!href || !managedSet.has(href)) continue;
          const row = anchor.closest('li.alert_instance, li[data-alert-id], .alert_instance, tr, [role="listitem"]');
          if (!row) continue;
          const delBtn = row.querySelector('.delete_icon, [aria-label*="Delete" i], [title*="Delete" i], [data-tooltip*="Delete" i], span.delete_button, button[aria-label*="Remove" i]');
          if (!delBtn) continue;

          simulateUserClick(delBtn);
          await waitForCondition(() => !document.contains(anchor) || !document.contains(row), 3500, 120);
          deletedCount++;
          await waitMs(220);
        }
        return deletedCount;
      };

      const runAutoCreateManagedAlerts = async (payload = {}) => {
        window.__spAutoCreatingAlerts = true;
        try {
          if (window.location.hostname.includes('accounts.google.') || window.location.pathname.includes('/signin')) {
            return { success: false, code: 'GOOGLE_AUTH_REQUIRED', error: 'Sign in to Google to create Google Alerts.' };
          }

          // Wait up to 4s for either query input OR explicit sign-in link
          const readyState = await waitForCondition(() => {
            const inp = findAlertQueryInput();
            if (inp) return { signedIn: true };
            const signInLink = Array.from(document.querySelectorAll('a, button')).find((el) =>
              /sign in/i.test((el.textContent || '').trim()) &&
              (el.getAttribute('href') || '').includes('accounts.google.')
            );
            if (signInLink) return { signedIn: false };
            return null;
          }, 4000, 150);

          if (!readyState || !readyState.signedIn || !findAlertQueryInput()) {
            return { success: false, code: 'GOOGLE_AUTH_REQUIRED', error: 'Sign in to Google in the opened tab, then click Retry.' };
          }

          const queries = (Array.isArray(payload.queries) ? payload.queries : [])
            .map((q) => String(q || '').trim())
            .filter(Boolean);
          if (queries.length === 0) {
            return { success: false, error: 'No alert queries provided.' };
          }

          const frequency = payload.frequency || 'realtime';
          const quality = payload.quality || 'all';
          const deletedOldCount = payload.replaceOldManagedFeeds !== false
            ? await deleteManagedAlertRows(payload.managedFeedUrls || [])
            : 0;

          const capturedFeeds = [];

          for (let qi = 0; qi < queries.length; qi++) {
            const query = queries[qi];
            const beforeUrls = new Set(
              Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]'))
                .map((a) => String(a.href || '').trim())
                .filter(Boolean)
            );

            const input = await waitForCondition(() => findAlertQueryInput(), 3000, 100);
            if (!input) {
              return { success: false, error: 'Google Alerts query input became unavailable.' };
            }

            input.focus();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.value = query;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

            // Expand Show options if collapsed
            const showOpts = findShowOptionsButton();
            if (showOpts) {
              simulateUserClick(showOpts);
              await waitForCondition(() =>
                document.querySelectorAll('.goog-flat-menu-button, select, [role="listbox"]').length >= 2,
                2500,
                100
              );
            }
            await waitMs(180);

            // 1. Ensure RSS feed delivery (required)
            const rssSelected = await selectClosureDropdownWithRetry({
              labelRx: /deliver to/i,
              triggerHints: [/deliver to/i, /email/i, /rss/i, /@/],
              optionMatchers: [/^rss feed$/i, /\brss\b/i],
              verifyRx: /\brss\b/i
            });
            if (!rssSelected) {
              return {
                success: false,
                error: 'Could not switch "Deliver to" to RSS feed on Google Alerts. Please verify you are signed into Google.'
              };
            }

            // 2. Frequency (default As-it-happens)
            await selectClosureDropdownWithRetry({
              labelRx: /how often/i,
              triggerHints: [/how often/i, /once a day/i, /as-it-happens/i, /once a week/i],
              optionMatchers: frequency === 'weekly' ? [/once a week/i] : (frequency === 'daily' ? [/once a day/i] : [/as-it-happens/i]),
              verifyRx: frequency === 'weekly' ? /once a week/i : (frequency === 'daily' ? /once a day/i : /as-it-happens/i)
            });

            // 3. Quality (default All results)
            await selectClosureDropdownWithRetry({
              labelRx: /how many/i,
              triggerHints: [/how many/i, /only the best/i, /all results/i],
              optionMatchers: quality === 'best' ? [/only the best/i] : [/^all results$/i],
              verifyRx: quality === 'best' ? /only the best/i : /all results/i
            });

            // 4. Click Create Alert
            const createBtn = document.querySelector('#create_alert') ||
              Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).find((el) =>
                isElementVisible(el) && /^create alert$/i.test((el.textContent || el.value || '').trim())
              );
            if (!createBtn) {
              return { success: false, error: 'Create Alert button not found on Google Alerts page.' };
            }
            simulateUserClick(createBtn);

            // 5. Wait for newly created RSS feed link
            const newFeedAnchor = await waitForCondition(() => {
              const anchors = Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]'));
              return anchors.find((a) => {
                const href = String(a.href || '').trim();
                return href && !beforeUrls.has(href);
              }) || null;
            }, 9000, 150);

            if (newFeedAnchor) {
              const feedUrl = String(newFeedAnchor.href || '').trim();
              stateAlerts.knownFeedUrls.add(feedUrl);
              capturedFeeds.push({ feedUrl, query });
            } else {
              return {
                success: false,
                error: `Created alert for query ${qi + 1}/${queries.length}, but did not detect its RSS feed link.`
              };
            }

            await waitMs(350);
          }

          try {
            scanRssLinks();
            renderFloatingAssistant();
          } catch (_) {}

          return {
            success: true,
            feeds: capturedFeeds,
            deletedOldCount
          };
        } finally {
          window.__spAutoCreatingAlerts = false;
        }
      };

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          if (msg && msg.type === 'RUN_AUTO_CREATE_GOOGLE_ALERTS') {
            runAutoCreateManagedAlerts(msg.payload || {})
              .then((result) => sendResponse(result))
              .catch((err) => sendResponse({ success: false, error: err?.message || 'Automation failed' }));
            return true;
          }
          return false;
        });
      }

      const renderFloatingAssistant = () => {
        let bar = document.getElementById('sp-google-alerts-assistant');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'sp-google-alerts-assistant';
          bar.setAttribute('data-sp-alert-ui', 'true');
          bar.style.cssText = 'position:fixed;top:14px;right:16px;z-index:99999;width:360px;max-width:calc(100vw - 32px);background:#FCF9F2;border:1.5px solid #2a2d36;border-radius:12px;box-shadow:3px 3px 0px rgba(42,45,54,0.82);font-family:Inter,system-ui,-apple-system,sans-serif;color:#1e222a;overflow:hidden;';
          document.body.appendChild(bar);
        }

        const anchors = Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]'));
        const syncedSet = getSelectedSyncedSet();
        const syncedOnPage = anchors.filter((a) => syncedSet.has(String(a.href || '').trim())).length;
        const unsyncedOnPage = Math.max(0, anchors.length - syncedOnPage);

        const selectedCampaignObj = stateAlerts.campaigns.find((c) => c.id === stateAlerts.selectedCampaignId) || stateAlerts.campaigns[0] || null;
        const selectedCampaignLabel = selectedCampaignObj ? (selectedCampaignObj.name || 'Untitled') : 'Active Product';
        const escHtml = (val) => String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const campMenuHtml = stateAlerts.campaigns.length > 0
          ? stateAlerts.campaigns.map((c) => {
              const isAct = c.id === stateAlerts.selectedCampaignId;
              return `<div class="sp-alerts-campaign-item" data-value="${escHtml(c.id)}" style="padding:6px 8px;font-size:11.5px;font-weight:${isAct ? '700' : '600'};color:${isAct ? '#1e222a' : '#2a2d36'};background:${isAct ? '#fdcb6e' : 'transparent'};border:${isAct ? '1px solid #2a2d36' : '1px solid transparent'};border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name || 'Untitled')}</span>${isAct ? '<span style="color:#6c5ce7;font-weight:800;flex-shrink:0;">✓</span>' : ''}</div>`;
            }).join('')
          : '<div class="sp-alerts-campaign-item" data-value="" style="padding:6px 8px;font-size:11.5px;font-weight:700;color:#1e222a;background:#fdcb6e;border:1px solid #2a2d36;border-radius:5px;cursor:pointer;">Active Product</div>';

        const pending = stateAlerts.pendingSetup;
        const hasPending = Boolean(pending && (pending.query || (Array.isArray(pending.queries) && pending.queries.length > 0)));
        const totalBatch = Array.isArray(pending?.queries) && pending.queries.length > 0 ? pending.queries.length : (pending?.query ? 1 : 0);
        const curIdx = Number(pending?.currentIndex || 0);
        const curQuery = pending?.query || (Array.isArray(pending?.queries) ? pending.queries[curIdx] : '') || '';

        bar.innerHTML = `
          <div style="background:#fdcb6e;border-bottom:1.5px solid #2a2d36;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="font-size:12px;font-weight:800;color:#2a2d36;">Smart Poster • Google Alerts</div>
            <button type="button" id="sp-alerts-toggle-btn" style="background:#fff;border:1px solid #2a2d36;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:700;cursor:pointer;color:#2a2d36;">${stateAlerts.collapsed ? 'Expand' : 'Hide'}</button>
          </div>
          <div id="sp-alerts-body" style="padding:11px 12px;display:${stateAlerts.collapsed ? 'none' : 'flex'};flex-direction:column;gap:9px;">
            <div id="sp-alerts-campaign-dropdown" style="position:relative;">
              <label style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#57606f;margin-bottom:4px;">Save Alerts To Product</label>
              <button type="button" id="sp-alerts-campaign-trigger" style="width:100%;padding:6px 9px;border:1px solid #dfd8cc;border-radius:7px;background:#fff;font-size:12px;font-weight:600;color:#1e222a;display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:pointer;box-sizing:border-box;text-align:left;">
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;">${escHtml(selectedCampaignLabel)}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div id="sp-alerts-campaign-menu" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid #2a2d36;border-radius:8px;box-shadow:3px 3px 0px #2a2d36;max-height:170px;overflow-y:auto;padding:4px;z-index:200;flex-direction:column;gap:2px;">${campMenuHtml}</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#FAF4EB;border:1px solid #dfd8cc;border-radius:8px;padding:7px 9px;">
              <div style="font-size:11px;color:#57606f;">
                <strong style="color:#1e222a;">${syncedOnPage}</strong> synced · <strong style="color:#1e222a;">${unsyncedOnPage}</strong> unsynced
              </div>
              <button type="button" id="sp-alerts-sync-all-btn" ${unsyncedOnPage === 0 ? 'disabled' : ''} style="background:${unsyncedOnPage === 0 ? '#e2e8f0' : '#6c5ce7'};color:${unsyncedOnPage === 0 ? '#64748b' : '#fff'};border:1px solid ${unsyncedOnPage === 0 ? '#cbd5e1' : '#2a2d36'};border-radius:6px;padding:5px 9px;font-size:11px;font-weight:700;cursor:${unsyncedOnPage === 0 ? 'default' : 'pointer'};white-space:nowrap;">
                ${unsyncedOnPage === 0 ? 'All Synced ✓' : `+ Sync All (${unsyncedOnPage})`}
              </button>
            </div>
            ${hasPending ? `
              <div style="background:#f1effe;border:1px solid #d4cdfc;border-radius:8px;padding:9px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                  <span style="font-size:10.5px;font-weight:800;color:#5b4bc4;">${totalBatch > 1 ? `Batch Alert ${curIdx + 1} of ${totalBatch}` : 'Guided Alert Setup'}</span>
                  <button type="button" id="sp-alerts-stop-batch" style="background:transparent;border:none;color:#64748b;font-size:10.5px;font-weight:600;cursor:pointer;text-decoration:underline;">Stop</button>
                </div>
                <div style="font-size:11.5px;font-weight:600;color:#1e222a;background:#fff;border:1px solid #d4cdfc;border-radius:6px;padding:5px 8px;word-break:break-word;">${curQuery.replace(/</g, '&lt;')}</div>
                <div style="font-size:10.5px;color:#57606f;line-height:1.35;">Pre-filled with <strong>RSS feed</strong> delivery. Click <strong>Create Alert</strong> to capture automatically.</div>
                <div style="display:flex;gap:6px;">
                  <button type="button" id="sp-alerts-refill-btn" style="flex:1;background:#fff;border:1px solid #d4cdfc;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:600;color:#5b4bc4;cursor:pointer;">Refill Query &amp; RSS</button>
                  ${totalBatch > 1 ? `<button type="button" id="sp-alerts-skip-btn" style="background:#fff;border:1px solid #dfd8cc;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:600;color:#57606f;cursor:pointer;">Skip →</button>` : ''}
                </div>
              </div>
            ` : ''}
            <div id="sp-alerts-helper-status" style="font-size:11px;color:#57606f;line-height:1.35;">Click any <strong>+ Sync to Smart Poster</strong> button or <strong>Sync All</strong> to save feeds to the selected product.</div>
          </div>
        `;

        bar.querySelector('#sp-alerts-toggle-btn')?.addEventListener('click', () => {
          stateAlerts.collapsed = !stateAlerts.collapsed;
          renderFloatingAssistant();
        });

        const campTrigger = bar.querySelector('#sp-alerts-campaign-trigger');
        const campMenu = bar.querySelector('#sp-alerts-campaign-menu');
        if (campTrigger && campMenu) {
          campTrigger.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const isOpen = campMenu.style.display === 'flex';
            campMenu.style.display = isOpen ? 'none' : 'flex';
            campTrigger.style.borderColor = isOpen ? '#dfd8cc' : '#6c5ce7';
          });
          campMenu.querySelectorAll('.sp-alerts-campaign-item').forEach((item) => {
            item.addEventListener('click', (ev) => {
              ev.stopPropagation();
              stateAlerts.selectedCampaignId = item.getAttribute('data-value') || '';
              campMenu.style.display = 'none';
              updateAllRowButtons();
              renderFloatingAssistant();
            });
          });
          if (!bar.dataset.alertsDropdownBound) {
            bar.dataset.alertsDropdownBound = 'true';
            document.addEventListener('click', (ev) => {
              if (!ev.target.closest?.('#sp-alerts-campaign-dropdown')) {
                const m = bar.querySelector('#sp-alerts-campaign-menu');
                const t = bar.querySelector('#sp-alerts-campaign-trigger');
                if (m) m.style.display = 'none';
                if (t) t.style.borderColor = '#dfd8cc';
              }
            });
          }
        }

        bar.querySelector('#sp-alerts-sync-all-btn')?.addEventListener('click', async () => {
          const btn = bar.querySelector('#sp-alerts-sync-all-btn');
          const curSynced = getSelectedSyncedSet();
          const feedsToSync = [];
          document.querySelectorAll('a[href*="/alerts/feeds/"]').forEach((anchor) => {
            const url = String(anchor.href || '').trim();
            if (!url || curSynced.has(url)) return;
            const q = extractAlertRowQuery(anchor);
            feedsToSync.push({ feedUrl: url, query: q || 'Google Alert RSS' });
          });
          if (feedsToSync.length === 0) return;
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Syncing...';
          }
          const resp = await sendRuntimeMsg({
            type: 'CAPTURE_GOOGLE_ALERT_RSS',
            payload: { feeds: feedsToSync, campaignId: stateAlerts.selectedCampaignId }
          });
          if (resp?.success) {
            feedsToSync.forEach((f) => curSynced.add(f.feedUrl));
            updateAllRowButtons();
            renderFloatingAssistant();
            const statusEl = document.getElementById('sp-alerts-helper-status');
            if (statusEl) {
              statusEl.textContent = `Synced ${feedsToSync.length} alert(s) to ${getSelectedCampaignName()}!`;
              statusEl.style.color = '#15803d';
            }
          } else if (btn) {
            btn.disabled = false;
            btn.textContent = `+ Sync All (${feedsToSync.length})`;
          }
        });

        bar.querySelector('#sp-alerts-refill-btn')?.addEventListener('click', () => {
          if (curQuery) fillGoogleAlertForm(curQuery, pending?.frequency, pending?.quality);
        });

        bar.querySelector('#sp-alerts-skip-btn')?.addEventListener('click', async () => {
          const resUpd = await sendRuntimeMsg({ type: 'UPDATE_GOOGLE_ALERT_BATCH', currentIndex: curIdx + 1 });
          stateAlerts.pendingSetup = resUpd?.pendingSetup || null;
          renderFloatingAssistant();
          if (stateAlerts.pendingSetup?.query) {
            fillGoogleAlertForm(stateAlerts.pendingSetup.query, stateAlerts.pendingSetup.frequency, stateAlerts.pendingSetup.quality);
          }
        });

        bar.querySelector('#sp-alerts-stop-batch')?.addEventListener('click', async () => {
          await sendRuntimeMsg({ type: 'CLEAR_GOOGLE_ALERT_SETUP' });
          stateAlerts.pendingSetup = null;
          renderFloatingAssistant();
        });
      };

      const captureSingleFeed = async (feedUrl, queryHint = '', isFromCreation = false) => {
        const cleanUrl = String(feedUrl || '').trim();
        if (!cleanUrl) return;
        const cleanQuery = String(queryHint || '').trim() || 'Google Alert RSS';
        const targetCampId = stateAlerts.selectedCampaignId || stateAlerts.pendingSetup?.campaignId || '';

        const resp = await sendRuntimeMsg({
          type: 'CAPTURE_GOOGLE_ALERT_RSS',
          payload: { feedUrl: cleanUrl, query: cleanQuery, campaignId: targetCampId }
        });

        if (resp?.success) {
          const resolvedId = resp.campaignId || targetCampId;
          if (resolvedId) {
            stateAlerts.selectedCampaignId = resolvedId;
            if (!stateAlerts.syncedUrlsByCampaign.has(resolvedId)) {
              stateAlerts.syncedUrlsByCampaign.set(resolvedId, new Set());
            }
            stateAlerts.syncedUrlsByCampaign.get(resolvedId).add(cleanUrl);
          }
          stateAlerts.knownFeedUrls.add(cleanUrl);
          updateAllRowButtons();

          const statusEl = document.getElementById('sp-alerts-helper-status');
          if (statusEl) {
            statusEl.textContent = `Synced "${cleanQuery}" to ${getSelectedCampaignName()}!`;
            statusEl.style.color = '#15803d';
          }

          if (isFromCreation && stateAlerts.pendingSetup) {
            const p = stateAlerts.pendingSetup;
            const total = Array.isArray(p.queries) ? p.queries.length : 1;
            const nextIdx = Number(p.currentIndex || 0) + 1;
            if (total > 1 && nextIdx < total) {
              const resUpd = await sendRuntimeMsg({ type: 'UPDATE_GOOGLE_ALERT_BATCH', currentIndex: nextIdx });
              stateAlerts.pendingSetup = resUpd?.pendingSetup || null;
              renderFloatingAssistant();
              if (stateAlerts.pendingSetup?.query) {
                setTimeout(() => {
                  fillGoogleAlertForm(stateAlerts.pendingSetup.query, stateAlerts.pendingSetup.frequency, stateAlerts.pendingSetup.quality);
                }, 450);
              }
            } else {
              await sendRuntimeMsg({ type: 'CLEAR_GOOGLE_ALERT_SETUP' });
              stateAlerts.pendingSetup = null;
              renderFloatingAssistant();
            }
          } else {
            renderFloatingAssistant();
          }
        }
      };

      const styleSyncButton = (btn, isSynced) => {
        if (!btn) return;
        if (isSynced) {
          btn.textContent = 'Synced ✓';
          btn.style.background = '#dcfce7';
          btn.style.borderColor = '#86efac';
          btn.style.color = '#15803d';
        } else {
          btn.textContent = '+ Sync to Smart Poster';
          btn.style.background = '#eff6ff';
          btn.style.borderColor = '#bfdbfe';
          btn.style.color = '#1d4ed8';
        }
      };

      const updateAllRowButtons = () => {
        const syncedSet = getSelectedSyncedSet();
        document.querySelectorAll('button[data-sp-alert-btn="true"]').forEach((btn) => {
          const url = btn.getAttribute('data-feed-url') || '';
          styleSyncButton(btn, syncedSet.has(url));
        });
      };

      const scanRssLinks = () => {
        const syncedSet = getSelectedSyncedSet();
        document.querySelectorAll('a[href*="/alerts/feeds/"]').forEach((anchor) => {
          const feedUrl = String(anchor.href || '').trim();
          if (!feedUrl) return;
          if (anchor.dataset.spBound === 'true') {
            const existingBtn = anchor.parentNode?.querySelector(`button[data-sp-alert-btn="true"][data-feed-url="${CSS.escape(feedUrl)}"]`);
            if (existingBtn) styleSyncButton(existingBtn, syncedSet.has(feedUrl));
            return;
          }
          anchor.dataset.spBound = 'true';

          const syncBtn = document.createElement('button');
          syncBtn.type = 'button';
          syncBtn.setAttribute('data-sp-alert-ui', 'true');
          syncBtn.setAttribute('data-sp-alert-btn', 'true');
          syncBtn.setAttribute('data-feed-url', feedUrl);
          syncBtn.style.cssText = 'margin-left:8px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:4px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;cursor:pointer;';
          styleSyncButton(syncBtn, syncedSet.has(feedUrl));

          syncBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const labelText = extractAlertRowQuery(anchor);
            captureSingleFeed(feedUrl, labelText, false);
          });
          anchor.parentNode?.insertBefore(syncBtn, anchor.nextSibling);
        });

        // Detect email-mode alerts that lack an RSS link so users understand why RSS sync is unavailable
        document.querySelectorAll('li.alert_instance, li[data-alert-id], .alert_instance, tr').forEach((row) => {
          if (row.dataset.spEmailChecked === 'true') return;
          if (row.querySelector('a[href*="/alerts/feeds/"]')) return;
          if (row.querySelector('[data-sp-email-badge="true"]')) {
            row.dataset.spEmailChecked = 'true';
            return;
          }
          const hasQuery = Boolean(row.querySelector('.query_div, .alert_query, .query'));
          const hasEditDelete = Boolean(row.querySelector('.edit_icon, .delete_icon, [aria-label*="Edit"], [aria-label*="Delete"]'));
          if (!hasQuery && !hasEditDelete) return;
          row.dataset.spEmailChecked = 'true';

          const badge = document.createElement('span');
          badge.setAttribute('data-sp-alert-ui', 'true');
          badge.setAttribute('data-sp-email-badge', 'true');
          badge.textContent = 'Email mode (switch to RSS to sync)';
          badge.title = 'Click the pencil icon on this alert and change Deliver to -> RSS feed so Smart Poster can auto-capture its links.';
          badge.style.cssText = 'margin-left:8px;padding:2px 7px;font-size:10.5px;font-weight:600;border-radius:4px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;display:inline-block;vertical-align:middle;';
          const buttonsHost = row.querySelector('.alert_buttons') || row.querySelector('.query_div, .alert_query, .query')?.parentNode || row;
          if (buttonsHost && buttonsHost.firstChild && buttonsHost.classList?.contains('alert_buttons')) {
            buttonsHost.insertBefore(badge, buttonsHost.firstChild);
          } else {
            buttonsHost.appendChild(badge);
          }
        });
      };

      // Hydrate context from background
      const ctx = await sendRuntimeMsg({ type: 'GET_GOOGLE_ALERTS_CONTEXT' });
      if (ctx?.success) {
        stateAlerts.campaigns = Array.isArray(ctx.campaigns) ? ctx.campaigns : [];
        stateAlerts.campaigns.forEach((c) => {
          stateAlerts.syncedUrlsByCampaign.set(c.id, new Set(Array.isArray(c.feedUrls) ? c.feedUrls : []));
        });
        stateAlerts.pendingSetup = ctx.pendingSetup || null;
        stateAlerts.selectedCampaignId =
          (stateAlerts.pendingSetup?.campaignId && stateAlerts.campaigns.some((c) => c.id === stateAlerts.pendingSetup.campaignId))
            ? stateAlerts.pendingSetup.campaignId
            : (ctx.activeCampaignId || stateAlerts.campaigns[0]?.id || '');
      }

      const observer = new MutationObserver(() => {
        scanRssLinks();
        if (window.__spAutoCreatingAlerts) return;
        const currentAnchors = Array.from(document.querySelectorAll('a[href*="/alerts/feeds/"]'));
        const newAnchor = currentAnchors.find((a) => {
          const href = String(a.href || '').trim();
          return href && !stateAlerts.knownFeedUrls.has(href);
        });
        if (newAnchor) {
          const newUrl = String(newAnchor.href || '').trim();
          stateAlerts.knownFeedUrls.add(newUrl);
          if (stateAlerts.pendingSetup) {
            const rowQuery = extractAlertRowQuery(newAnchor);
            const fallbackQuery = stateAlerts.pendingSetup.query || '';
            captureSingleFeed(newUrl, rowQuery || fallbackQuery, true);
          } else {
            renderFloatingAssistant();
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      scanRssLinks();
      renderFloatingAssistant();

      if (stateAlerts.pendingSetup?.query) {
        setTimeout(() => {
          fillGoogleAlertForm(
            stateAlerts.pendingSetup.query,
            stateAlerts.pendingSetup.frequency,
            stateAlerts.pendingSetup.quality
          );
        }, 550);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGoogleAlertsHelper);
    } else {
      initGoogleAlertsHelper();
    }
  }

  logger.log('Content script initialized successfully');
}


