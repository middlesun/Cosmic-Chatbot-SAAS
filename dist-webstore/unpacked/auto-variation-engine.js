(function (root) {
  'use strict';

  const LEVEL_META = {
    1: {
      level: 1,
      key: 'strict',
      label: 'Strict',
      badge: '1 · Strict (Micro-tweaks)',
      summary: '1–2 safe word/punctuation tweaks (Instant)',
      isAi: false
    },
    2: {
      level: 2,
      key: 'light',
      label: 'Light',
      badge: '2 · Light (Natural swaps)',
      summary: '2–3 natural word & phrase swaps (Instant)',
      isAi: false
    },
    3: {
      level: 3,
      key: 'neutral',
      label: 'Neutral',
      badge: '3 · Neutral (3–5 edits)',
      summary: '3–5 phrase, framing & break edits (Instant)',
      isAi: false
    },
    4: {
      level: 4,
      key: 'distinct',
      label: 'Distinct',
      badge: '4 · Distinct (AI · Locked)',
      summary: 'AI fresh phrasing, pitch & links locked (Pre-warmed)',
      isAi: true
    },
    5: {
      level: 5,
      key: 'unique',
      label: 'Unique',
      badge: '5 · Unique (AI · Re-angle)',
      summary: 'AI bold re-angle & hook shift, pitch locked (Pre-warmed)',
      isAi: true
    }
  };

  function normalizeLevel(val, fallback = 3) {
    const n = parseInt(String(val ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    if (n < 1) return 1;
    if (n > 5) return 5;
    return n;
  }

  function migrateLegacyRandomnessLevel(rawVal, alreadyMigrated = false) {
    const n = parseInt(String(rawVal ?? ''), 10);
    if (!Number.isFinite(n)) return 3;
    if (alreadyMigrated) return normalizeLevel(n, 3);
    if (n <= 1) return 1;
    if (n === 2 || n === 3) return 3;
    return normalizeLevel(n, 3);
  }

  function getLevelMeta(level) {
    return LEVEL_META[normalizeLevel(level, 3)] || LEVEL_META[3];
  }

  function fnv1aHash(str) {
    const s = String(str || '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  function applyCase(original, replacement) {
    if (!original || !replacement) return replacement;
    if (original.length > 1 && original === original.toUpperCase() && /[A-Z]/.test(original)) {
      return replacement.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement.toLowerCase();
  }

  function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function maskProtectedTokens(text, extraProtected = []) {
    const protectedTokens = [];
    const maskToken = (match) => {
      const idx = protectedTokens.length;
      protectedTokens.push(match);
      return `\uE000TBPROT_${idx}\uE001`;
    };

    let masked = String(text || '')
      .replace(/https?:\/\/[^\s<>"'()]+/gi, maskToken)
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, maskToken)
      .replace(/\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz|me|us|uk|ca|de|fr|info|biz|tech|tools|site|online|store|shop|cloud|gg|so|to|ly|page|pages\.dev)(?:\/[^\s<>"'()]*)?\b/gi, maskToken)
      .replace(/(^|\s)([@#][A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g, (_, pre, sym) => `${pre}${maskToken(sym)}`)
      .replace(/\$\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g, maskToken);

    if (Array.isArray(extraProtected) && extraProtected.length > 0) {
      for (const term of extraProtected) {
        const clean = String(term || '').trim();
        if (clean.length < 2) continue;
        const re = new RegExp(`\\b${escapeRegex(clean)}\\b`, 'gi');
        masked = masked.replace(re, maskToken);
      }
    }

    const restore = (str) =>
      String(str || '').replace(/\uE000TBPROT_(\d+)\uE001/g, (_, idx) => protectedTokens[Number(idx)] ?? '');

    return { masked, protectedTokens, restore };
  }

  function extractProtectedTokens(text, brandName = '') {
    const tokens = [];
    const raw = String(text || '');
    const patterns = [
      /https?:\/\/[^\s<>"'()]+/gi,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      /\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz|me|us|uk|ca|de|fr|info|biz|tech|tools|site|online|store|shop|cloud|gg|so|to|ly|page|pages\.dev)(?:\/[^\s<>"'()]*)?\b/gi,
      /(?:^|\s)([@#][A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g,
      /\$\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(raw)) !== null) {
        const val = String(m[1] || m[0] || '').trim().replace(/[.,;:!?]+$/, '');
        if (!val) continue;
        if (!/^https?:\/\//i.test(val) && tokens.some(t => /^https?:\/\//i.test(t) && t.toLowerCase().includes(val.toLowerCase()))) {
          continue;
        }
        if (!tokens.some(t => t.toLowerCase() === val.toLowerCase())) tokens.push(val);
      }
    }
    const cleanBrand = String(brandName || '').trim();
    if (cleanBrand.length >= 2) {
      const brandRe = new RegExp(`\\b${escapeRegex(cleanBrand)}\\b`, 'i');
      if (brandRe.test(raw) && !tokens.some(t => t.toLowerCase() === cleanBrand.toLowerCase())) {
        tokens.push(cleanBrand);
      }
    }
    return tokens;
  }

  function parseDictionaryGroups(text) {
    if (!text) return [];
    return String(text)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const clean = line.replace(/^\s*[\(\{\[]\s*/, '').replace(/\s*[\)\}\]]\s*$/, '');
        return clean.split('|').map(s => s.trim()).filter(Boolean);
      })
      .filter(group => group.length > 1);
  }

  function parseSpinTax(text) {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    let iterations = 0;
    const spinRegex = /\{([^{}]+)\}/;
    while (spinRegex.test(result) && iterations < 30) {
      iterations++;
      result = result.replace(spinRegex, (_, choicesStr) => {
        const choices = choicesStr.split('|');
        if (choices.length === 0) return '';
        const picked = choices[Math.floor(Math.random() * choices.length)];
        return picked.trim();
      });
    }
    return result;
  }

  function parseInlineDicts(text) {
    if (!text || typeof text !== 'string') return text;
    const dictRegex = /\(([a-zA-Z0-9_\s\-–—\.,'!?:/|]+)\)/g;
    return text.replace(dictRegex, (match, inner) => {
      if (inner.includes('|')) {
        const choices = inner.split('|').map(s => s.trim()).filter(Boolean);
        if (choices.length > 0) {
          return choices[Math.floor(Math.random() * choices.length)];
        }
      }
      return match;
    });
  }

  function applyCustomDictionaries(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    const level = normalizeLevel(options.level, 3);
    let result = parseInlineDicts(text);
    if (level < 2) return result;

    const customDicts = Array.isArray(options.customDicts)
      ? options.customDicts
      : parseDictionaryGroups(options.dictsText || '');
    if (!customDicts || customDicts.length === 0) return result;

    const swapProbability = level >= 3 ? 0.72 : 0.45;
    const protectedTerms = options.brandName ? [options.brandName] : [];
    const { masked, restore } = maskProtectedTokens(result, protectedTerms);
    let out = masked;

    for (const group of customDicts) {
      for (const word of group) {
        if (!word) continue;
        const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
        out = out.replace(regex, (matched) => {
          if (Math.random() > swapProbability) return matched;
          const alternatives = group.filter(w => w.toLowerCase() !== matched.toLowerCase());
          if (alternatives.length === 0) return matched;
          const chosen = alternatives[Math.floor(Math.random() * alternatives.length)];
          return applyCase(matched, chosen);
        });
      }
    }
    return restore(out);
  }

  function applySynonyms(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    const level = normalizeLevel(options.level, 3);
    const synonymsEnabled = options.synonymsEnabled !== false;
    if (level < 2) return text;
    if (!synonymsEnabled && level < 3) return text;

    const synonymMap = {
      'great': ['awesome', 'solid', 'fantastic', 'stellar', 'superb'],
      'awesome': ['great', 'solid', 'fantastic', 'stellar'],
      'tool': ['app', 'platform', 'software', 'solution', 'utility'],
      'app': ['tool', 'platform', 'software', 'product'],
      'platform': ['tool', 'software', 'app', 'system'],
      'software': ['platform', 'app', 'tool'],
      'quick': ['fast', 'rapid', 'speedy'],
      'fast': ['quick', 'rapid', 'swift'],
      'rapid': ['fast', 'quick'],
      'founders': ['builders', 'creators', 'entrepreneurs', 'devs'],
      'founder': ['builder', 'creator', 'entrepreneur'],
      'builders': ['founders', 'creators', 'developers'],
      'builder': ['founder', 'creator', 'developer'],
      'help': ['assist', 'support', 'boost'],
      'check out': ['take a look at', 'have a look at', 'explore'],
      'built': ['created', 'developed', 'designed'],
      'created': ['built', 'developed', 'crafted'],
      'huge': ['massive', 'giant', 'major'],
      'simple': ['straightforward', 'easy', 'clean'],
      'best': ['top', 'finest', 'ideal'],
      'tired of': ['done with', 'exhausted by', 'frustrated with']
    };

    if (level >= 3 && synonymsEnabled) {
      synonymMap['thanks'] = ['thx', 'thank you', 'cheers'];
      synonymMap['definitely'] = ['100%', 'certainly', 'totally'];
    }

    const swapChance = level >= 3 ? 0.58 : 0.35;
    const protectedTerms = options.brandName ? [options.brandName] : [];
    const { masked, restore } = maskProtectedTokens(text, protectedTerms);
    let result = masked;

    for (const [key, alternatives] of Object.entries(synonymMap)) {
      const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, 'gi');
      result = result.replace(regex, (matched) => {
        if (Math.random() > swapChance) return matched;
        const chosen = alternatives[Math.floor(Math.random() * alternatives.length)];
        return applyCase(matched, chosen);
      });
    }

    return restore(result);
  }

  // Tiered deterministic rules for Levels 1, 2, and 3
  const LEVEL_1_MICRO_RULES = [
    { pattern: /\byou're\b/gi, alts: ['you are'] },
    { pattern: /\byou are\b/gi, alts: ["you're"] },
    { pattern: /\bit's\b/gi, alts: ['it is'] },
    { pattern: /\bit is\b/gi, alts: ["it's"] },
    { pattern: /\bthat's\b/gi, alts: ['that is'] },
    { pattern: /\bthat is\b/gi, alts: ["that's"] },
    { pattern: /\bwe're\b/gi, alts: ['we are'] },
    { pattern: /\bwe are\b/gi, alts: ["we're"] },
    { pattern: /\bthey're\b/gi, alts: ['they are'] },
    { pattern: /\bthey are\b/gi, alts: ["they're"] },
    { pattern: /\bdon't\b/gi, alts: ['do not'] },
    { pattern: /\bdo not\b/gi, alts: ["don't"] },
    { pattern: /\bcan't\b/gi, alts: ['cannot'] },
    { pattern: /\bcannot\b/gi, alts: ["can't"] },
    { pattern: /\bwon't\b/gi, alts: ['will not'] },
    { pattern: /\bisn't\b/gi, alts: ['is not'] },
    { pattern: /\baren't\b/gi, alts: ['are not'] },
    { pattern: /\bI'm\b/g, alts: ['I am'] },
    { pattern: /\bI am\b/g, alts: ["I'm"] },
    { pattern: /\bI've\b/g, alts: ['I have'] },
    { pattern: /\bI have\b/g, alts: ["I've"] },
    { pattern: /\bhelpful\b/gi, alts: ['useful'] },
    { pattern: /\buseful\b/gi, alts: ['helpful'] },
    { pattern: /\bquick\b/gi, alts: ['fast'] },
    { pattern: /\bfast\b/gi, alts: ['quick'] },
    { pattern: /\bsimple\b/gi, alts: ['easy', 'clean'] },
    { pattern: /\beasy\b/gi, alts: ['simple'] },
    { pattern: /\bthanks\b/gi, alts: ['thank you'] },
    { pattern: /\beveryone\b/gi, alts: ['everybody'] },
    { pattern: /\banyone\b/gi, alts: ['anybody'] },
    { pattern: /\bsomeone\b/gi, alts: ['somebody'] },
    { pattern: /\b1-click\b/gi, alts: ['one-click'] },
    { pattern: /\bone-click\b/gi, alts: ['1-click'] }
  ];

  const LEVEL_2_PHRASE_RULES = [
    { pattern: /\bcheck out\b/gi, alts: ['take a look at', 'have a look at', 'try out'] },
    { pattern: /\btake a look at\b/gi, alts: ['check out', 'try out'] },
    { pattern: /\bhelps you\b/gi, alts: ['lets you', 'makes it easy to'] },
    { pattern: /\bautomates\b/gi, alts: ['handles', 'streamlines', 'simplifies'] },
    { pattern: /\bcreated\b/gi, alts: ['built', 'made'] },
    { pattern: /\bmade\b/gi, alts: ['built', 'created'] },
    { pattern: /\bbuilt\b/gi, alts: ['made', 'created'] },
    { pattern: /\bamazing\b/gi, alts: ['awesome', 'solid'] },
    { pattern: /\bawesome\b/gi, alts: ['amazing', 'solid', 'great'] },
    { pattern: /\bgreat\b/gi, alts: ['awesome', 'solid', 'nice'] },
    { pattern: /\bgood\b/gi, alts: ['solid', 'nice', 'helpful'] },
    { pattern: /\bhuge\b/gi, alts: ['massive', 'big', 'major'] },
    { pattern: /\ba lot of\b/gi, alts: ['plenty of', 'lots of'] },
    { pattern: /\bright now\b/gi, alts: ['at the moment', 'currently', 'today'] },
    { pattern: /\btried\b/gi, alts: ['tested', 'tried out'] },
    { pattern: /\bactually\b/gi, alts: ['honestly', 'genuinely'] },
    { pattern: /\bhonestly\b/gi, alts: ['actually', 'truly'] },
    { pattern: /\breally\b/gi, alts: ['genuinely', 'pretty', 'truly'] },
    { pattern: /\bvery\b/gi, alts: ['really', 'pretty', 'quite'] },
    { pattern: /\busing\b/gi, alts: ['with', 'via'] },
    { pattern: /\bbecause\b/gi, alts: ['since'] },
    { pattern: /\bprobably\b/gi, alts: ['likely'] },
    { pattern: /\bjust\b/gi, alts: ['simply'] },
    { pattern: /\bworks great\b/gi, alts: ['works well', 'runs smoothly'] },
    { pattern: /\bhey\b/gi, alts: ['hi', 'hey there'] }
  ];

  const LEVEL_3_EXTRA_RULES = [
    { pattern: /\bI found\b/gi, alts: ['I came across', 'I stumbled on', 'I ran into'] },
    { pattern: /\bI've been using\b/gi, alts: ['Been using', 'I have been testing', 'I started using'] },
    { pattern: /\bworth checking out\b/gi, alts: ['worth a look', 'worth trying out', 'definitely worth a peek'] },
    { pattern: /\bcheck it out\b/gi, alts: ['give it a look', 'try it out', 'take a peek'] },
    { pattern: /\bsaves a ton of time\b/gi, alts: ['saves so much time', 'cuts out hours of manual work', 'speeds things up a lot'] },
    { pattern: /\ba few clicks\b/gi, alts: ['a couple clicks', 'just a couple clicks'] },
    { pattern: /\bone click\b/gi, alts: ['1-click', 'a single click'] },
    { pattern: /\bhave you\b/gi, alts: ['did you ever', 'have you ever'] },
    { pattern: /\bsuper\b/gi, alts: ['really', 'very', 'pretty'] },
    { pattern: /\bwithout\b/gi, alts: ['minus', 'w/o'] },
    { pattern: /\bwith\b/gi, alts: ['w/', 'using'] },
    { pattern: /\byour\b/gi, alts: ['ur'] },
    { pattern: /\bur\b/gi, alts: ['your'] },
    { pattern: /\b & \b/g, alts: [' and '] },
    { pattern: /\b and \b/gi, alts: [' & '] },
    { pattern: /\bWait\b/g, alts: ['Quick question', 'Btw', 'Wait'] },
    { pattern: /\bhelpful\b/gi, alts: ['useful', 'handy', 'solid'] },
    { pattern: /\bawesome\b/gi, alts: ['amazing', 'solid', 'fantastic', 'great'] },
    { pattern: /\bcheck out\b/gi, alts: ['take a look at', 'have a look at', 'peek at', 'try out'] },
    { pattern: /\bcreated\b/gi, alts: ['built', 'made', 'put together'] },
    { pattern: /\bbuilt\b/gi, alts: ['made', 'created', 'put together'] }
  ];

  function tokenizeNormalizedWords(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^a-z0-9']+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function countWordDiff(a, b) {
    const wa = tokenizeNormalizedWords(a);
    const wb = tokenizeNormalizedWords(b);
    if (wa.length === 0 && wb.length === 0) return 0;
    const freqA = new Map();
    for (const w of wa) freqA.set(w, (freqA.get(w) || 0) + 1);
    let overlap = 0;
    for (const w of wb) {
      const c = freqA.get(w) || 0;
      if (c > 0) {
        overlap++;
        freqA.set(w, c - 1);
      }
    }
    return Math.max(wa.length, wb.length) - overlap;
  }

  function computeLexicalSimilarity(a, b) {
    const wa = tokenizeNormalizedWords(a);
    const wb = tokenizeNormalizedWords(b);
    if (wa.length === 0 && wb.length === 0) return 1;
    if (wa.length === 0 || wb.length === 0) return 0;
    const setA = new Set(wa);
    const setB = new Set(wb);
    let inter = 0;
    for (const w of setA) if (setB.has(w)) inter++;
    const union = setA.size + setB.size - inter;
    const unigramJaccard = union > 0 ? inter / union : 0;

    if (wa.length < 3 || wb.length < 3) return unigramJaccard;
    const biA = new Set();
    const biB = new Set();
    for (let i = 0; i < wa.length - 1; i++) biA.add(`${wa[i]} ${wa[i + 1]}`);
    for (let i = 0; i < wb.length - 1; i++) biB.add(`${wb[i]} ${wb[i + 1]}`);
    let biInter = 0;
    for (const bg of biA) if (biB.has(bg)) biInter++;
    const biUnion = biA.size + biB.size - biInter;
    const bigramJaccard = biUnion > 0 ? biInter / biUnion : 0;
    return 0.55 * unigramJaccard + 0.45 * bigramJaccard;
  }

  // Persistent LRU variation history (backed by chrome.storage.local when available)
  const HISTORY_STORAGE_KEY = 'sp_variation_history_v1';
  const _inMemoryHistory = new Map();
  let _historyHydrated = false;
  let _historySaveTimer = null;

  function hydrateHistory() {
    if (_historyHydrated) return Promise.resolve();
    _historyHydrated = true;
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([HISTORY_STORAGE_KEY], (res) => {
            try {
              const raw = res && res[HISTORY_STORAGE_KEY];
              if (raw && typeof raw === 'object') {
                for (const [k, arr] of Object.entries(raw)) {
                  if (Array.isArray(arr)) _inMemoryHistory.set(k, new Set(arr.slice(-40)));
                }
              }
            } catch (_) {}
            resolve();
          });
          return;
        }
      } catch (_) {}
      resolve();
    });
  }

  function schedulePersistHistory() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    if (_historySaveTimer) clearTimeout(_historySaveTimer);
    _historySaveTimer = setTimeout(() => {
      try {
        const serialized = {};
        const entries = Array.from(_inMemoryHistory.entries()).slice(-100);
        for (const [k, set] of entries) {
          serialized[k] = Array.from(set).slice(-40);
        }
        chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: serialized });
      } catch (_) {}
    }, 350);
  }

  function applyPresetVariation(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    const rawTrimmed = text.trim();
    if (!rawTrimmed) return text;

    // Effective preset tier clamps 4/5 fallback down to upgraded Level 3
    const requestedLevel = normalizeLevel(options.level, 3);
    const presetLevel = Math.min(3, requestedLevel);
    const synonymsEnabled = options.synonymsEnabled !== false;
    const protectedTerms = options.brandName ? [options.brandName] : [];
    const { masked, restore } = maskProtectedTokens(text, protectedTerms);

    const isQuestion = /\?\s*(?:\uE000TBPROT_\d+\uE001\s*)?$/.test(masked.trim());
    const isMakerVoice = /\b(?:i built|i made|i created|i launched|we built|we made|we created|my tool|my app|our tool|our app|our platform)\b/i.test(text);
    const hasTrailingEmoji = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*(?:\uE000TBPROT_\d+\uE001\s*)?$/u.test(masked.trim());

    let activeRules = LEVEL_1_MICRO_RULES.slice();
    if (presetLevel >= 2) {
      activeRules = [...LEVEL_2_PHRASE_RULES, ...LEVEL_1_MICRO_RULES];
    }
    if (presetLevel >= 3) {
      const l3Filtered = synonymsEnabled
        ? LEVEL_3_EXTRA_RULES
        : LEVEL_3_EXTRA_RULES.filter(r => !/\byour\b|\bur\b/i.test(r.pattern.source));
      activeRules = [...l3Filtered, ...LEVEL_2_PHRASE_RULES, ...LEVEL_1_MICRO_RULES];
    }

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const buildCandidate = (attempt) => {
      let out = masked;
      let changed = false;

      const matches = [];
      for (const rule of activeRules) {
        const re = new RegExp(rule.pattern.source, rule.pattern.flags);
        let m;
        while ((m = re.exec(out)) !== null) {
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            matched: m[0],
            alts: rule.alts
          });
          if (!re.global) break;
        }
      }

      if (matches.length > 0) {
        const shuffled = matches.sort(() => Math.random() - 0.5);
        let targetCount = 1;
        if (presetLevel === 1) {
          targetCount = Math.min(shuffled.length, attempt < 6 ? 1 : 2);
        } else if (presetLevel === 2) {
          targetCount = Math.min(shuffled.length, 2 + (attempt >= 4 ? 1 : Math.floor(Math.random() * 2)));
        } else {
          targetCount = Math.min(shuffled.length, 3 + Math.floor(Math.random() * 3));
        }

        const chosen = [];
        for (const cand of shuffled) {
          if (chosen.some(c => !(cand.end <= c.start || cand.start >= c.end))) continue;
          chosen.push(cand);
          if (chosen.length >= targetCount) break;
        }
        chosen.sort((a, b) => b.start - a.start);
        for (const item of chosen) {
          const pickedAlt = pick(item.alts);
          const replacement = item.matched === ' & ' || pickedAlt === ' & ' || pickedAlt === ' and '
            ? pickedAlt
            : applyCase(item.matched, pickedAlt);
          out = out.slice(0, item.start) + replacement + out.slice(item.end);
          changed = true;
        }
      }

      // Greeting & ellipsis punctuation variance (Level 2+)
      if (presetLevel >= 2) {
        if (/(\.\.\.|\.\.|…)/.test(out) && (attempt > 2 || Math.random() < 0.6)) {
          const ellipForms = ['..', '...', '…', ','];
          out = out.replace(/(\.\.\.|\.\.|…)/g, (m) => {
            if (Math.random() < 0.65) {
              const choices = ellipForms.filter(f => f !== m);
              changed = true;
              return pick(choices);
            }
            return m;
          });
        } else if (/^(Hey|Hi|Yo|Hello)([,!.\s]+)/i.test(out) && (attempt > 1 || Math.random() < 0.5)) {
          out = out.replace(/^(Hey|Hi|Yo|Hello)(?:[,!.]*|\s*-\s*)?\s+/i, (_, g) => {
            const sep = presetLevel >= 3
              ? pick([' ', '.. ', '... ', ', ', '! ', ' — '])
              : pick([', ', ' — ', '! ', ' ']);
            changed = true;
            return `${g}${sep}`;
          });
        }

        if (/\s+—\s+|\s+-\s+/.test(out) && (attempt > 3 || Math.random() < 0.45)) {
          out = out.replace(/\s+(?:—|-)\s+/, (m) => {
            const sep = pick([' — ', ' - ', ', ']);
            if (sep !== m) changed = true;
            return sep;
          });
        }
      }

      // Line-break / paragraph rhythm variance (Level 3 only)
      if (presetLevel >= 3) {
        if (/[a-zA-Z0-9][.!]\s+[A-Z]/.test(out) && (attempt > 2 || Math.random() < 0.42)) {
          out = out.replace(/([a-zA-Z0-9])([.!])\s+([A-Z])/, (_, prev, punc, next) => {
            const bridge = pick([`${punc} `, `${punc}\n`, `${punc}\n\n`, '.. ']);
            changed = true;
            return `${prev}${bridge}${next}`;
          });
        } else if (/\n\n/.test(out) && Math.random() < 0.45) {
          out = out.replace(/\n\n/, '\n');
          changed = true;
        }
      }

      // Trailing punctuation micro-tweak (preserving trailing newline + URL block)
      const endSplitMatch = out.match(/^([\s\S]*?)(\n+\s*\uE000TBPROT_\d+\uE001\s*)$/);
      let bodyPart = endSplitMatch ? endSplitMatch[1] : out;
      const tailPart = endSplitMatch ? endSplitMatch[2] : '';

      if (!isQuestion && (presetLevel >= 2 || !changed || attempt > 3)) {
        const trimmedBody = bodyPart.replace(/\s+$/, '');
        if (!/\uE001$/.test(trimmedBody) && /(\.\.\.|\.\.|…|[.!])?$/.test(trimmedBody)) {
          const currentEndMatch = trimmedBody.match(/(\.\.\.|\.\.|…|[.!])$/);
          const currentEnd = currentEndMatch ? currentEndMatch[1] : '';
          const endPool = presetLevel === 1
            ? ['.', '!']
            : (presetLevel === 2 ? ['.', '!', '...'] : ['.', '!', '..', '...', '…', '']);
          const endForms = endPool.filter(f => f !== currentEnd);
          if (endForms.length > 0 && (attempt > 2 || Math.random() < 0.45 || !changed)) {
            bodyPart = trimmedBody.slice(0, trimmedBody.length - currentEnd.length) + pick(endForms);
            changed = true;
          }
        }
      } else if (isQuestion && presetLevel >= 2 && (attempt > 2 || Math.random() < 0.35)) {
        const trimmedBody = bodyPart.replace(/\s+$/, '');
        if (/\?$/.test(trimmedBody)) {
          const qForm = pick(['?', '??', '..?']);
          if (qForm !== '?') {
            bodyPart = trimmedBody.slice(0, -1) + qForm;
            changed = true;
          }
        }
      }

      // Level 3 only: Natural opener OR closer (~50% chance, NEVER double-stacked on both ends)
      if (presetLevel >= 3) {
        const shouldAddFraming = attempt >= 5 || !changed || Math.random() < 0.5;
        if (shouldAddFraming) {
          let addedFraming = false;
          const tryOpener = Math.random() < 0.5;

          if (tryOpener && !/^(Hey|Hi|Yo|Hello|Btw|Quick|Honestly|FWIW|Curious)/i.test(bodyPart.trim())) {
            const openers = isQuestion
              ? ['Curious — ', 'Quick question — ', 'Btw — ', 'Honestly — ']
              : ['Btw — ', 'Quick note — ', 'Honestly — ', 'FWIW — '];
            const pickedOpener = pick(openers);
            bodyPart = `${pickedOpener}${bodyPart.trimStart()}`;
            addedFraming = true;
            changed = true;
          }

          if (!addedFraming) {
            if (isQuestion) {
              const qClosers = ['Just wondering', 'Curious how it worked for you', 'Worth asking'];
              const pickedQ = pick(qClosers);
              if (!bodyPart.toLowerCase().includes(pickedQ.toLowerCase())) {
                bodyPart = `${bodyPart.trim()} (${pickedQ})`;
                addedFraming = true;
                changed = true;
              }
            } else if (!isMakerVoice) {
              const closers = ['Pretty solid', 'Super helpful', 'Worth a look', 'So clean', 'Really handy'];
              const pickedCloser = pick(closers);
              if (!bodyPart.toLowerCase().includes(pickedCloser.toLowerCase())) {
                const sep = /[.!?…]$/.test(bodyPart.trim()) ? ' ' : '. ';
                const closerPunct = pick(['.', '!', '']);
                bodyPart = `${bodyPart.trim()}${sep}${pickedCloser}${closerPunct}`;
                addedFraming = true;
                changed = true;
              }
            } else {
              const makerClosers = ['Worth checking out', 'Hope this helps', 'Happy to share', 'Built to save time'];
              const pickedCloser = pick(makerClosers);
              if (!bodyPart.toLowerCase().includes(pickedCloser.toLowerCase())) {
                const sep = /[.!?…]$/.test(bodyPart.trim()) ? ' ' : '. ';
                const closerPunct = pick(['.', '!', '']);
                bodyPart = `${bodyPart.trim()}${sep}${pickedCloser}${closerPunct}`;
                addedFraming = true;
                changed = true;
              }
            }
          }

          // Optional light emoji accent only when framing wasn't added or on later attempts
          if (!hasTrailingEmoji && (!addedFraming && Math.random() < 0.35)) {
            const emojiPool = isQuestion
              ? ['🤔', '👀', '💭', '✨']
              : ['🙌', '✨', '💡', '👌', '⚡'];
            const emoji = pick(emojiPool);
            if (!bodyPart.includes(emoji)) {
              bodyPart = `${bodyPart.trimEnd()} ${emoji}`;
              changed = true;
            }
          }
        }
      }

      return restore(`${bodyPart}${tailPart}`);
    };

    const historyMap = options.history instanceof Map ? options.history : _inMemoryHistory;
    const historyKey = `${fnv1aHash(rawTrimmed)}:L${presetLevel}`;
    let seenSet = historyMap.get(historyKey);
    if (!seenSet) {
      seenSet = new Set();
      historyMap.set(historyKey, seenSet);
    }

    const origWordsCount = tokenizeNormalizedWords(rawTrimmed).length;
    const minWordDiff = presetLevel >= 3 && origWordsCount >= 5
      ? 2
      : (presetLevel >= 2 && origWordsCount >= 4 ? 1 : 0);

    let finalVariation = text;
    let bestFallback = '';
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = buildCandidate(attempt);
      const normCand = candidate.trim();
      if (!normCand || normCand === rawTrimmed) continue;
      if (!bestFallback) bestFallback = candidate;

      if (seenSet.has(normCand)) continue;

      const diff = countWordDiff(rawTrimmed, normCand);
      if (attempt < 16 && minWordDiff > 0 && diff < minWordDiff) {
        continue;
      }

      finalVariation = candidate;
      break;
    }

    if (finalVariation === text && bestFallback) {
      finalVariation = bestFallback;
    }

    if (seenSet.size >= 40) {
      const firstVal = seenSet.values().next().value;
      if (firstVal !== undefined) seenSet.delete(firstVal);
    }
    seenSet.add(finalVariation.trim());
    if (historyMap === _inMemoryHistory) {
      schedulePersistHistory();
    }
    return finalVariation;
  }

  function processSync(text, options = {}) {
    if (!text || typeof text !== 'string') return text;
    const level = normalizeLevel(options.level, 3);
    const synonymsEnabled = options.synonymsEnabled !== false;
    const customDicts = Array.isArray(options.customDicts)
      ? options.customDicts
      : parseDictionaryGroups(options.dictsText || '');
    const brandName = options.brandName || '';

    let out = parseSpinTax(text);
    if (level >= 2) {
      out = applyCustomDictionaries(out, { level, customDicts, brandName });
    } else {
      out = parseInlineDicts(out);
    }
    if (level >= 2 && (synonymsEnabled || level >= 3)) {
      out = applySynonyms(out, { level, synonymsEnabled, brandName });
    }
    if (options.autoVariation) {
      out = applyPresetVariation(out, {
        level,
        synonymsEnabled,
        customDicts,
        brandName,
        history: options.history
      });
    }
    return out;
  }

  // Deterministic Gate for AI variations (used by background pool in Phase 3 & tests)
  function validateAiCandidate(original, candidate, options = {}) {
    const orig = String(original || '').trim();
    const cand = String(candidate || '').trim();
    if (!cand || cand.length < 3) return { ok: false, reason: 'empty' };
    if (cand.toLowerCase() === orig.toLowerCase()) return { ok: false, reason: 'identical' };

    // Strip unwanted surrounding quotes if model returned quoted string
    const unquoted = cand.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    if (!unquoted) return { ok: false, reason: 'empty_unquoted' };

    // Reject obvious LLM wrapper/slop artifacts
    if (/^(here(?:'s| are)|sure[,!]|certainly[,!]|variation\s*\d+[:\-])/i.test(unquoted)) {
      return { ok: false, reason: 'llm_wrapper' };
    }
    if (!orig.includes('**') && /\*\*[^*]+\*\*/.test(unquoted)) {
      return { ok: false, reason: 'markdown_bold' };
    }

    // Protected token lock: URLs, bare domains, emails, @mentions, #hashtags, prices, brandName
    const protectedTokens = extractProtectedTokens(orig, options.brandName || '');
    const candLower = unquoted.toLowerCase();
    for (const tok of protectedTokens) {
      if (/^https?:\/\//i.test(tok)) {
        const stripped = tok.replace(/^https?:\/\//i, '');
        if (!candLower.includes(tok.toLowerCase()) && !candLower.includes(stripped.toLowerCase())) {
          return { ok: false, reason: `missing_url:${tok}` };
        }
      } else if (!candLower.includes(tok.toLowerCase())) {
        return { ok: false, reason: `missing_token:${tok}` };
      }
    }

    // Length guard
    const origWords = tokenizeNormalizedWords(orig);
    const candWords = tokenizeNormalizedWords(unquoted);
    if (origWords.length >= 8) {
      const ratio = candWords.length / origWords.length;
      const level = normalizeLevel(options.level, 4);
      const minRatio = level === 4 ? 0.65 : 0.55;
      const maxRatio = level === 4 ? 1.40 : 1.65;
      if (ratio < minRatio || ratio > maxRatio) {
        return { ok: false, reason: `length_ratio:${ratio.toFixed(2)}` };
      }
    }

    // Minimum distance vs original & existing pool items
    if (computeLexicalSimilarity(orig, unquoted) > 0.84) {
      return { ok: false, reason: 'too_similar_to_original' };
    }
    const existingPool = Array.isArray(options.existingPool) ? options.existingPool : [];
    for (const prev of existingPool) {
      if (computeLexicalSimilarity(prev, unquoted) > 0.78) {
        return { ok: false, reason: 'too_similar_to_pool' };
      }
    }

    // Level 5 opening hook diversity guard
    if (normalizeLevel(options.level, 4) === 5 && existingPool.length > 0 && candWords.length >= 4) {
      const candHook = candWords.slice(0, 3).join(' ');
      const lastPrev = existingPool[existingPool.length - 1];
      const prevHook = tokenizeNormalizedWords(lastPrev).slice(0, 3).join(' ');
      if (candHook && prevHook && candHook === prevHook) {
        return { ok: false, reason: 'repeated_opening_hook' };
      }
    }

    return { ok: true, text: unquoted };
  }

  const DEFAULT_COMMENT_TAG = 'General';
  const ALL_COMMENT_POOL = 'all';

  function cleanTagName(tag) {
    return String(tag || '').replace(/\s+/g, ' ').trim();
  }

  function canonicalizeTagName(tag) {
    const cleaned = cleanTagName(tag);
    if (!cleaned) return '';
    if (cleaned.toLowerCase() === 'general') return DEFAULT_COMMENT_TAG;
    return cleaned;
  }

  function normalizeCommentTags(tags) {
    const rawList = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' && tags.trim() ? tags.split(',') : []);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < rawList.length; i += 1) {
      const canonical = canonicalizeTagName(rawList[i]);
      if (!canonical) continue;
      const lower = canonical.toLowerCase();
      if (lower === ALL_COMMENT_POOL) continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        out.push(canonical);
      }
    }
    return out.length > 0 ? out : [DEFAULT_COMMENT_TAG];
  }

  // Option #1:
  // - Untapped/untagged comments default to ['General']
  // - Adding a custom tag automatically removes 'General' if only ['General'] was present
  // - Re-checking 'General' alongside custom tags preserves both
  // - Removing all custom tags automatically restores ['General']
  function applyTagToggleToComment(commentOrTags, tagName, isChecked) {
    const rawTags = Array.isArray(commentOrTags)
      ? commentOrTags
      : (commentOrTags && typeof commentOrTags === 'object' ? commentOrTags.tags : []);
    const current = normalizeCommentTags(rawTags);
    const target = canonicalizeTagName(tagName);
    if (!target || target.toLowerCase() === ALL_COMMENT_POOL) {
      return current;
    }

    const targetLower = target.toLowerCase();
    const isGeneralTarget = targetLower === 'general';
    const hasCustomTags = current.some((t) => t.toLowerCase() !== 'general');

    let next;
    if (isChecked) {
      if (!isGeneralTarget && !hasCustomTags) {
        next = [target];
      } else {
        const exists = current.some((t) => t.toLowerCase() === targetLower);
        if (exists) {
          next = [...current];
        } else if (isGeneralTarget) {
          next = [DEFAULT_COMMENT_TAG, ...current];
        } else {
          next = [...current, target];
        }
      }
    } else {
      next = current.filter((t) => t.toLowerCase() !== targetLower);
      if (next.length === 0) {
        next = [DEFAULT_COMMENT_TAG];
      }
    }

    if (commentOrTags && typeof commentOrTags === 'object' && !Array.isArray(commentOrTags)) {
      commentOrTags.tags = next;
    }
    return next;
  }

  function getRawBrandComments(brand) {
    if (!brand || typeof brand !== 'object') return [];
    if (Array.isArray(brand.social?.comments) && brand.social.comments.length > 0) {
      return brand.social.comments;
    }
    if (Array.isArray(brand.comments) && brand.comments.length > 0) {
      return brand.comments;
    }
    return Array.isArray(brand.social?.comments) ? brand.social.comments : [];
  }

  function getCampaignAvailableTags(brand) {
    const out = [DEFAULT_COMMENT_TAG];
    const seen = new Set(['general']);
    const pushTag = (raw) => {
      const canonical = canonicalizeTagName(raw);
      if (!canonical) return;
      const lower = canonical.toLowerCase();
      if (lower === ALL_COMMENT_POOL || seen.has(lower)) return;
      seen.add(lower);
      out.push(canonical);
    };

    if (Array.isArray(brand?.commentTags)) {
      brand.commentTags.forEach(pushTag);
    }
    const comments = getRawBrandComments(brand);
    comments.forEach((c) => {
      if (c && typeof c === 'object' && Array.isArray(c.tags)) {
        c.tags.forEach(pushTag);
      }
    });
    return out;
  }

  function mergeCommentTagLists(loserTags, winnerTags, equalOrMissingTimestamp = false, extraInUseTags = []) {
    const out = [DEFAULT_COMMENT_TAG];
    const seen = new Set(['general']);
    const pushTag = (raw) => {
      const canonical = canonicalizeTagName(raw);
      if (!canonical) return;
      const lower = canonical.toLowerCase();
      if (lower === ALL_COMMENT_POOL || seen.has(lower)) return;
      seen.add(lower);
      out.push(canonical);
    };

    const wArr = Array.isArray(winnerTags) ? winnerTags : [];
    const lArr = Array.isArray(loserTags) ? loserTags : [];
    wArr.forEach(pushTag);
    if (equalOrMissingTimestamp || wArr.length === 0) {
      lArr.forEach(pushTag);
    }
    if (Array.isArray(extraInUseTags)) {
      extraInUseTags.forEach(pushTag);
    }
    return out;
  }

  function getCommentTagCounts(brand, options = {}) {
    const enabledOnly = Boolean(options?.enabledOnly);
    const available = getCampaignAvailableTags(brand);
    const counts = { all: 0 };
    available.forEach((t) => {
      counts[t] = 0;
    });

    const comments = getRawBrandComments(brand);
    comments.forEach((c) => {
      const isStr = typeof c === 'string';
      const text = isStr ? c : String(c?.text || '');
      const isEnabled = isStr ? text.trim().length > 0 : (c && c.enabled !== false && c.active !== false);
      if (enabledOnly && (!isEnabled || !text.trim())) return;

      counts.all += 1;
      const itemTags = isStr ? [DEFAULT_COMMENT_TAG] : normalizeCommentTags(c?.tags);
      itemTags.forEach((tag) => {
        const matchKey = available.find((a) => a.toLowerCase() === tag.toLowerCase()) || tag;
        counts[matchKey] = (counts[matchKey] || 0) + 1;
      });
    });

    return counts;
  }

  function getCommentsForPostingPool(brand, poolTag) {
    const requested = cleanTagName(poolTag !== undefined && poolTag !== null ? poolTag : (brand?.activeCommentPool || ALL_COMMENT_POOL));
    const activePool = requested || ALL_COMMENT_POOL;
    const activeLower = activePool.toLowerCase();

    const comments = getRawBrandComments(brand);
    const enabledComments = comments.filter((c) => {
      if (typeof c === 'string') return c.trim().length > 0;
      return Boolean(c && c.active !== false && c.enabled !== false && String(c.text || '').trim().length > 0);
    });

    if (activeLower === ALL_COMMENT_POOL) {
      return enabledComments;
    }

    return enabledComments.filter((c) => {
      const itemTags = typeof c === 'string' ? [DEFAULT_COMMENT_TAG] : normalizeCommentTags(c?.tags);
      return itemTags.some((t) => t.toLowerCase() === activeLower);
    });
  }

  function escapeRegexChars(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractHostFromUrl(rawUrl) {
    let val = String(rawUrl || '').trim();
    if (!val) return '';
    val = val.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    val = val.split(/[/?#]/)[0].trim();
    val = val.replace(/:\d+$/, '');
    if (!val || !val.includes('.')) return '';
    return val;
  }

  function getDefaultSafeDomainValue(brand) {
    const candidates = [
      brand?.brandInfo?.url,
      brand?.directory?.websiteUrl,
      brand?.contact?.website
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const host = extractHostFromUrl(candidates[i]);
      if (host) {
        const lastDot = host.lastIndexOf('.');
        if (lastDot > 0) {
          return `${host.slice(0, lastDot)} .${host.slice(lastDot + 1)}`;
        }
        return host;
      }
    }
    return '';
  }

  function applySafeDomainTransform(text, brand) {
    if (text === undefined || text === null) return '';
    let result = String(text);
    const safeCfg = brand?.safeDomain;
    if (!safeCfg || safeCfg.enabled !== true) return result;
    const replacement = String(safeCfg.value || '').trim();
    if (!replacement) return result;

    // 1. Replace explicit {url} / {{url}} / {domain} / {{domain}} placeholders
    result = result.replace(/\{\{\s*(?:url|domain)\s*\}\}|\{\s*(?:url|domain)\s*\}/gi, replacement);

    // 2. Replace full or bare campaign URLs while keeping email addresses (@domain) and other unrelated URLs intact
    const hosts = [];
    const seenHosts = new Set();
    [brand?.brandInfo?.url, brand?.directory?.websiteUrl, brand?.contact?.website].forEach((raw) => {
      const host = extractHostFromUrl(raw);
      if (host && !seenHosts.has(host.toLowerCase())) {
        seenHosts.add(host.toLowerCase());
        hosts.push(host);
      }
    });

    // Sort longest hosts first so subdomains replace before parent domains if both exist
    hosts.sort((a, b) => b.length - a.length);
    hosts.forEach((host) => {
      const escapedHost = escapeRegexChars(host);
      const urlRe = new RegExp(
        `(^|[^\\w@./-])(?:https?:\\/\\/)?(?:www\\.)?${escapedHost}(?![\\w-]|\\.[a-z0-9])(?:\\/[^\\s<>"')\\]}]*[^\\s<>"')\\]}.,!?;:]|\\/)?`,
        'gi'
      );
      result = result.replace(urlRe, (_, prefix) => `${prefix}${replacement}`);
    });

    return result;
  }

  function normalizeEntityTags(rawTags, fallbackTags = null) {
    const out = [];
    const seen = new Set();
    const arr = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' && rawTags.trim() ? [rawTags] : []);
    arr.forEach((raw) => {
      const canonical = canonicalizeTagName(raw);
      if (!canonical) return;
      const lower = canonical.toLowerCase();
      if (lower === ALL_COMMENT_POOL || seen.has(lower)) return;
      seen.add(lower);
      out.push(canonical);
    });
    if (out.length > 0) return out;
    if (Array.isArray(fallbackTags) && fallbackTags.length > 0) {
      const fbOut = [];
      const fbSeen = new Set();
      fallbackTags.forEach((raw) => {
        const canonical = canonicalizeTagName(raw);
        if (!canonical) return;
        const lower = canonical.toLowerCase();
        if (lower === ALL_COMMENT_POOL || fbSeen.has(lower)) return;
        fbSeen.add(lower);
        fbOut.push(canonical);
      });
      if (fbOut.length > 0) return fbOut;
    }
    return [DEFAULT_COMMENT_TAG];
  }

  function getEntityAvailableTags(items = [], brandTags = []) {
    const out = [DEFAULT_COMMENT_TAG];
    const seen = new Set(['general']);
    const pushTag = (raw) => {
      const canonical = canonicalizeTagName(raw);
      if (!canonical) return;
      const lower = canonical.toLowerCase();
      if (lower === ALL_COMMENT_POOL || seen.has(lower)) return;
      seen.add(lower);
      out.push(canonical);
    };
    if (Array.isArray(brandTags)) brandTags.forEach(pushTag);
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item && typeof item === 'object' && Array.isArray(item.tags)) {
          item.tags.forEach(pushTag);
        }
      });
    }
    return out;
  }

  function getEntityTagCounts(items = [], availableTags = [DEFAULT_COMMENT_TAG], isEnabledFn = null) {
    const available = Array.isArray(availableTags) && availableTags.length > 0 ? availableTags : [DEFAULT_COMMENT_TAG];
    const counts = { all: 0 };
    available.forEach((t) => { counts[t] = 0; });
    if (!Array.isArray(items)) return counts;
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (typeof isEnabledFn === 'function' && !isEnabledFn(item)) return;
      counts.all += 1;
      const itemTags = normalizeEntityTags(item.tags);
      itemTags.forEach((tag) => {
        const matchKey = available.find((a) => a.toLowerCase() === tag.toLowerCase()) || tag;
        counts[matchKey] = (counts[matchKey] || 0) + 1;
      });
    });
    return counts;
  }

  root.SmartPosterCommentUtils = {
    DEFAULT_COMMENT_TAG,
    ALL_COMMENT_POOL,
    cleanTagName,
    canonicalizeTagName,
    normalizeCommentTags,
    normalizeEntityTags,
    applyTagToggleToComment,
    getRawBrandComments,
    getCampaignAvailableTags,
    getEntityAvailableTags,
    mergeCommentTagLists,
    getCommentTagCounts,
    getEntityTagCounts,
    getCommentsForPostingPool,
    getDefaultSafeDomainValue,
    applySafeDomainTransform
  };

  root.SmartPosterVariationEngine = {
    LEVEL_META,
    normalizeLevel,
    migrateLegacyRandomnessLevel,
    getLevelMeta,
    fnv1aHash,
    applyCase,
    maskProtectedTokens,
    extractProtectedTokens,
    parseDictionaryGroups,
    parseSpinTax,
    parseInlineDicts,
    applyCustomDictionaries,
    applySynonyms,
    applyPresetVariation,
    processSync,
    validateAiCandidate,
    countWordDiff,
    computeLexicalSimilarity,
    hydrateHistory
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
