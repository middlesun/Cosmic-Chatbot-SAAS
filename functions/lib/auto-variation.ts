export type AiCreativityLevel = 4 | 5;

export interface AutoVaryBatchParams {
  text: string;
  creativityLevel?: unknown;
  variationCount?: number;
  brand?: Record<string, any>;
  brandContextBlock?: string;
  moduleType?: string;
  protectedTokens?: string[];
  existingTexts?: string[];
}

export interface AutoVaryValidationResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

const BANNED_SLOP_OPENERS =
  /^(here(?:'s| are)|sure[,!]|certainly[,!]|of course[,!]|variation\s*\d+[:\-]|option\s*\d+[:\-])/i;

function escapeRegex(str: string): string {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeNormalizedWords(str: string): string[] {
  return String(str || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeCreativityLevel(val: unknown): AiCreativityLevel {
  const n = parseInt(String(val ?? '4'), 10);
  return Number.isFinite(n) && n >= 5 ? 5 : 4;
}

export function extractProtectedTokens(
  text: string,
  brandName = '',
  explicitTokens: string[] = []
): string[] {
  const tokens: string[] = [];
  const addToken = (raw: string) => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    if (!tokens.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      tokens.push(clean);
    }
  };

  if (Array.isArray(explicitTokens)) {
    for (const tok of explicitTokens) addToken(tok);
  }

  const raw = String(text || '');
  const patterns: RegExp[] = [
    /https?:\/\/[^\s<>"'()]+/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    /\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz|me|us|uk|ca|de|fr|info|biz|tech|tools|site|online|store|shop|cloud|gg|so|to|ly|page|pages\.dev)(?:\/[^\s<>"'()]*)?\b/gi,
    /(?:^|\s)([@#][A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g,
    /\$\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const candidate = String(m[1] || m[0] || '').trim().replace(/[.,;:!?]+$/, '');
      if (!candidate) continue;
      // Skip bare domain token if already covered by an extracted full http(s) URL
      if (!/^https?:\/\//i.test(candidate) && tokens.some((t) => /^https?:\/\//i.test(t) && t.toLowerCase().includes(candidate.toLowerCase()))) {
        continue;
      }
      addToken(candidate);
    }
  }

  const cleanBrand = String(brandName || '').trim();
  if (cleanBrand.length >= 2) {
    const brandRe = new RegExp(`\\b${escapeRegex(cleanBrand)}\\b`, 'i');
    if (brandRe.test(raw)) {
      addToken(cleanBrand);
    }
  }

  return tokens;
}

export function computeLexicalSimilarity(a: string, b: string): number {
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

  const biA = new Set<string>();
  const biB = new Set<string>();
  for (let i = 0; i < wa.length - 1; i++) biA.add(`${wa[i]} ${wa[i + 1]}`);
  for (let i = 0; i < wb.length - 1; i++) biB.add(`${wb[i]} ${wb[i + 1]}`);

  let biInter = 0;
  for (const bg of biA) if (biB.has(bg)) biInter++;
  const biUnion = biA.size + biB.size - biInter;
  const bigramJaccard = biUnion > 0 ? biInter / biUnion : 0;

  return 0.55 * unigramJaccard + 0.45 * bigramJaccard;
}

export function parseVariationsJsonOrList(rawOutput: string, expectedCount: number): string[] {
  const cleaned = String(rawOutput || '').trim();
  if (!cleaned) return [];

  const tryJson = (candidate: string): string[] => {
    try {
      const parsed = JSON.parse(candidate);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.variations)
          ? parsed.variations
          : [];
      return arr
        .map((x: unknown) => {
          if (typeof x === 'string') return x.trim();
          if (x && typeof x === 'object') {
            const obj = x as Record<string, unknown>;
            return String(obj.text || obj.variation || obj.content || '').trim();
          }
          return '';
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const unfenced = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let items = tryJson(unfenced);
  if (items.length === 0) {
    const jsonMatch = unfenced.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) items = tryJson(jsonMatch[0]);
  }
  if (items.length === 0) {
    items = unfenced
      .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s+)/)
      .map((s) => s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').replace(/^["'“”]|["'“”]$/g, '').trim())
      .filter(Boolean);
  }
  if (items.length === 0 && expectedCount <= 1) {
    items = [cleaned];
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.slice(0, Math.max(1, expectedCount));
}

export function validateAutoVariationCandidate(
  original: string,
  candidate: string,
  options: {
    level?: AiCreativityLevel;
    brandName?: string;
    protectedTokens?: string[];
    existingPool?: string[];
  } = {}
): AutoVaryValidationResult {
  const orig = String(original || '').trim();
  const cand = String(candidate || '').trim();
  if (!cand || cand.length < 3) return { ok: false, reason: 'empty' };

  const unquoted = cand.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!unquoted) return { ok: false, reason: 'empty_unquoted' };
  if (unquoted.toLowerCase() === orig.toLowerCase()) {
    return { ok: false, reason: 'identical' };
  }

  if (BANNED_SLOP_OPENERS.test(unquoted)) {
    return { ok: false, reason: 'llm_wrapper' };
  }
  if (!orig.includes('**') && /\*\*[^*]+\*\*/.test(unquoted)) {
    return { ok: false, reason: 'markdown_bold' };
  }

  const protectedTokens = extractProtectedTokens(orig, options.brandName || '', options.protectedTokens || []);
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

  const level = normalizeCreativityLevel(options.level ?? 4);
  const origWords = tokenizeNormalizedWords(orig);
  const candWords = tokenizeNormalizedWords(unquoted);
  if (origWords.length >= 8) {
    const ratio = candWords.length / origWords.length;
    const minRatio = level === 4 ? 0.65 : 0.55;
    const maxRatio = level === 4 ? 1.40 : 1.65;
    if (ratio < minRatio || ratio > maxRatio) {
      return { ok: false, reason: `length_ratio:${ratio.toFixed(2)}` };
    }
  }

  if (origWords.length >= 5 && computeLexicalSimilarity(orig, unquoted) > 0.84) {
    return { ok: false, reason: 'too_similar_to_original' };
  }

  const existingPool = Array.isArray(options.existingPool) ? options.existingPool : [];
  for (const prev of existingPool) {
    if (candWords.length >= 5 && computeLexicalSimilarity(prev, unquoted) > 0.78) {
      return { ok: false, reason: 'too_similar_to_pool' };
    }
    if (unquoted.toLowerCase() === String(prev || '').trim().toLowerCase()) {
      return { ok: false, reason: 'duplicate_in_pool' };
    }
  }

  if (level === 5 && existingPool.length > 0 && candWords.length >= 4) {
    const candHook = candWords.slice(0, 3).join(' ');
    const lastPrev = existingPool[existingPool.length - 1];
    const prevHook = tokenizeNormalizedWords(lastPrev).slice(0, 3).join(' ');
    if (candHook && prevHook && candHook === prevHook) {
      return { ok: false, reason: 'repeated_opening_hook' };
    }
  }

  return { ok: true, text: unquoted };
}

export function filterValidatedAutoVariations(
  original: string,
  rawCandidates: string[],
  options: {
    level?: AiCreativityLevel;
    brandName?: string;
    protectedTokens?: string[];
    existingTexts?: string[];
    maxCount?: number;
  } = {}
): { valid: string[]; rejectedCount: number; protectedTokens: string[] } {
  const level = normalizeCreativityLevel(options.level ?? 4);
  const brandName = String(options.brandName || '').trim();
  const protectedTokens = extractProtectedTokens(original, brandName, options.protectedTokens || []);
  const existingPool: string[] = Array.isArray(options.existingTexts)
    ? options.existingTexts.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const maxCount = Math.max(1, Math.min(10, Number(options.maxCount || 6)));

  const valid: string[] = [];
  let rejectedCount = 0;

  for (const candidate of rawCandidates) {
    const res = validateAutoVariationCandidate(original, candidate, {
      level,
      brandName,
      protectedTokens,
      existingPool: [...existingPool, ...valid],
    });
    if (res.ok && res.text) {
      valid.push(res.text);
      if (valid.length >= maxCount) break;
    } else {
      rejectedCount++;
    }
  }

  return { valid, rejectedCount, protectedTokens };
}

function summarizeBrandForVariation(brand: Record<string, any> | undefined, fallbackBlock = ''): string {
  if (!brand || typeof brand !== 'object') {
    return fallbackBlock ? fallbackBlock.slice(0, 900) : 'No extra brand metadata provided; rely solely on the source template.';
  }

  const lines: string[] = [];
  const push = (label: string, val: unknown, maxLen = 300) => {
    const s = String(val || '').trim();
    if (s) lines.push(`${label}: ${s.slice(0, maxLen)}`);
  };

  push('Brand / Product Name', brand.name || brand.brandName, 120);
  push('One-Line Tagline', brand.tagline, 200);
  push('Core Pitch / Value Prop', brand.pitch || brand.description, 500);
  push('Website', brand.website || brand.url, 180);
  push('Category', brand.directory?.category || brand.category, 80);

  if (lines.length === 0 && fallbackBlock) {
    return fallbackBlock.slice(0, 900);
  }
  return lines.length > 0 ? lines.join('\n') : 'No extra brand metadata provided; rely solely on the source template.';
}

export function buildAutoVaryBatchPrompts(params: AutoVaryBatchParams) {
  const creativityLevel = normalizeCreativityLevel(params.creativityLevel ?? 4);
  const parsedCount = Math.max(1, Math.min(10, parseInt(String(params.variationCount || 6), 10) || 6));
  const brand = params.brand || {};
  const brandName = String(brand?.name || brand?.brandName || '').trim();
  const protectedTokens = extractProtectedTokens(params.text, brandName, params.protectedTokens || []);
  const excludeList = Array.isArray(params.existingTexts)
    ? params.existingTexts.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const brandSummary = summarizeBrandForVariation(brand, params.brandContextBlock);
  const modNote = params.moduleType ? `Channel / Format: ${String(params.moduleType).trim()}` : 'Channel / Format: Social Comment / Outreach Template';

  const protectedBlock = protectedTokens.length > 0
    ? `PROTECTED TOKENS (MUST appear verbatim in EVERY variation — never alter, drop, or reword):\n${protectedTokens.map((t) => `- ${t}`).join('\n')}`
    : 'PROTECTED TOKENS: Preserve any URLs, brand names, handles, hashtags, and prices verbatim if present.';

  const avoidBlock = excludeList.length > 0
    ? `\n\nALREADY USED / EXISTING VARIATIONS TO AVOID REPEATING:\n${excludeList.map((s, i) => `${i + 1}. ${s.slice(0, 220)}`).join('\n')}`
    : '';

  const levelGuidance = creativityLevel === 4
    ? [
        'CREATIVITY LEVEL 4 — DISTINCT (Structural Rephrasing):',
        '- Keep the EXACT same persona/voice (first-person maker vs user vs peer), core pitch, and CTA.',
        '- Rewrite sentence structure, transitions, and vocabulary so every variation reads naturally fresh without feeling templated.',
        '- Maintain approximate length parity (~70% to ~135% of original word count).',
        '- Ensure no two variations share the same opening phrase or repetitive sentence rhythm.',
      ].join('\n')
    : [
        'CREATIVITY LEVEL 5 — UNIQUE (Bold Re-Angle & Hook Diversity):',
        '- Keep 100% of the core pitch, CTA, brand facts, and protected tokens locked, while boldly varying the angle, hook style, clause ordering, and pacing.',
        '- Spread the batch across genuinely different hook archetypes (never repeat the same opening 3 words across variations):',
        '  1) Direct practical tip or takeaway lead',
        '  2) Personal workflow / experience observation',
        '  3) Relatable pain-point or friction lead',
        '  4) Conversational question-led hook (where natural)',
        '  5) Short, punchy contrast / micro-story',
        '  6) Peer-to-peer recommendation or quick summary',
        '- Keep length natural (~60% to ~160% of original word count); never pad with fluff or generic hype.',
      ].join('\n');

  const systemInstruction = [
    'You are an expert human social & outreach copywriter generating standalone template variations for Smart Poster.',
    '',
    'NON-NEGOTIABLE RULES:',
    '1. CORE PITCH LOCK: Every variation MUST preserve the exact core pitch, value proposition, and intent of the source template.',
    '2. TEMPLATE-ONLY: Do NOT assume or reference any external thread, post title, or fake conversation.',
    '3. PROTECTED TOKEN LOCK: Every URL, domain, @mention, #hashtag, price, percentage, and brand name listed in PROTECTED TOKENS must appear verbatim in EVERY variation.',
    '4. BRAND CONGRUENCE: Use the Active Brand Context strictly to keep product wording accurate. NEVER invent features, stats, testimonials, discounts, or URLs not present in the source or brand context.',
    '5. ZERO AI SLOP: Write authentic, conversational human prose. No markdown bolding (**...**), no surrounding quotes, no labels like "Variation 1:", no robotic filler ("game-changer", "unlock", "revolutionize", "As an AI").',
    `6. STRICT JSON OUTPUT: Return ONLY valid JSON matching {"variations": ["...", "..."]} with EXACTLY ${parsedCount} distinct string variations.`,
  ].join('\n');

  const prompt = [
    modNote,
    '',
    levelGuidance,
    '',
    'Active Brand Context (for tone & terminology congruence only):',
    brandSummary,
    '',
    protectedBlock,
    '',
    'Source Comment Template to Vary:',
    params.text.trim(),
    avoidBlock,
    '',
    `Return ONLY valid JSON: {"variations": ["...", ...]} with EXACTLY ${parsedCount} distinct variations.`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return {
    systemInstruction,
    prompt,
    creativityLevel,
    protectedTokens,
    temperature: creativityLevel === 5 ? 0.92 : 0.78,
  };
}

function maskProtectedInText(text: string, tokens: string[]) {
  const stored: string[] = [];
  let masked = String(text || '');
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const tok of sorted) {
    const clean = String(tok || '').trim();
    if (!clean) continue;
    const isUrlOrSymbol = /[:/.@#%$]/.test(clean);
    const re = isUrlOrSymbol
      ? new RegExp(escapeRegex(clean), 'gi')
      : new RegExp(`\\b${escapeRegex(clean)}\\b`, 'gi');
    masked = masked.replace(re, (m) => {
      const idx = stored.length;
      stored.push(m);
      return `\uE000VARPROT_${idx}\uE001`;
    });
  }
  const restore = (s: string) =>
    String(s || '').replace(/\uE000VARPROT_(\d+)\uE001/g, (_, idx) => stored[Number(idx)] ?? '');
  return { masked, restore };
}

function applySafeCase(matched: string, alt: string): string {
  if (!matched || !alt) return alt;
  if (matched[0] === matched[0].toUpperCase() && matched[0] !== matched[0].toLowerCase()) {
    return alt.charAt(0).toUpperCase() + alt.slice(1);
  }
  return alt.toLowerCase();
}

export function buildAutoVaryLocalFallback(params: {
  text: string;
  creativityLevel?: unknown;
  count?: number;
  brandName?: string;
  protectedTokens?: string[];
  existingTexts?: string[];
}): string[] {
  const raw = String(params.text || '').trim();
  if (!raw) return [];

  const level = normalizeCreativityLevel(params.creativityLevel ?? 4);
  const count = Math.max(1, Math.min(10, Number(params.count || 6)));
  const brandName = String(params.brandName || '').trim();
  const protectedTokens = extractProtectedTokens(raw, brandName, params.protectedTokens || []);
  const { masked, restore } = maskProtectedInText(raw, protectedTokens);

  const phraseBanks: Array<[RegExp, string[]]> = [
    [/\bI've been using\b/gi, ['Been relying on', 'I started using', 'Lately I have been using', 'Using']],
    [/\bI found\b/gi, ['I came across', 'I stumbled onto', 'Ran into', 'Recently spotted']],
    [/\bcheck out\b/gi, ['take a look at', 'give a try to', 'explore', 'have a peek at']],
    [/\bworth checking out\b/gi, ['worth a look', 'worth trying out', 'definitely worth exploring']],
    [/\bhelps you\b/gi, ['lets you', 'makes it easy to', 'helps teams']],
    [/\bsaves a ton of time\b/gi, ['cuts out hours of manual work', 'saves serious time', 'speeds up the workflow']],
    [/\bawesome\b/gi, ['super helpful', 'solid', 'genuinely useful', 'great']],
    [/\bgreat\b/gi, ['solid', 'effective', 'handy', 'helpful']],
    [/\bhelpful\b/gi, ['useful', 'practical', 'handy']],
    [/\bquick\b/gi, ['fast', 'speedy', 'streamlined']],
    [/\bsimple\b/gi, ['straightforward', 'clean', 'easy']],
    [/\bright now\b/gi, ['these days', 'currently', 'today']],
    [/\bwithout\b/gi, ['minus', 'skipping']],
  ];

  const l4Leads = ['Quick note — ', 'Worth mentioning: ', 'In practice, ', 'Honestly, ', 'FWIW — ', ''];
  const l5Hooks = [
    'Real talk: ',
    'Quick tip — ',
    'If you are tackling this workflow: ',
    'Small workflow win: ',
    'Sharing what worked here — ',
    'Side note — ',
    'For anyone stuck on this: ',
    'One thing that helped us: ',
  ];

  const candidates: string[] = [];
  const baseBody = masked.replace(/^(Hey|Hi|Hello|Yo)[,!.\s]+/i, '').trim() || masked;
  const sentences = baseBody
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < Math.max(count * 3, 14); i++) {
    let working = i % 2 === 0 ? masked : baseBody;

    // Apply rotating lexical/phrase substitutions
    for (let rIdx = 0; rIdx < phraseBanks.length; rIdx++) {
      const [re, alts] = phraseBanks[rIdx];
      working = working.replace(re, (m) => {
        const picked = alts[(i + rIdx) % alts.length];
        return applySafeCase(m, picked);
      });
    }

    // Reorder clauses safely on multi-sentence templates when appropriate
    if (sentences.length >= 2 && (level === 5 || i % 3 === 1)) {
      const reordered = sentences
        .slice(1)
        .concat(sentences[0])
        .join(level === 5 && i % 2 === 1 ? '\n\n' : ' ');
      let reorderedMutated = reordered;
      for (let rIdx = 0; rIdx < phraseBanks.length; rIdx++) {
        const [re, alts] = phraseBanks[rIdx];
        reorderedMutated = reorderedMutated.replace(re, (m) => applySafeCase(m, alts[(i + rIdx) % alts.length]));
      }
      working = reorderedMutated;
    }

    const hookPool = level === 5 ? l5Hooks : l4Leads;
    const hook = hookPool[i % hookPool.length];
    if (hook && !working.toLowerCase().startsWith(hook.trim().toLowerCase())) {
      const cleanStart = working.trimStart();
      const adjustedStart =
        hook.endsWith('— ') || hook.endsWith(': ')
          ? cleanStart
          : cleanStart.charAt(0).toLowerCase() + cleanStart.slice(1);
      working = `${hook}${adjustedStart}`;
    }

    const restored = restore(working).replace(/[ \t]{2,}/g, ' ').trim();
    if (restored && restored.toLowerCase() !== raw.toLowerCase()) {
      candidates.push(restored);
    }
  }

  const filtered = filterValidatedAutoVariations(raw, candidates, {
    level,
    brandName,
    protectedTokens,
    existingTexts: params.existingTexts || [],
    maxCount: count,
  });

  if (filtered.valid.length >= count) {
    return filtered.valid.slice(0, count);
  }

  // Last-resort relaxation for ultra-short templates: still enforce 100% protected tokens & uniqueness
  const out = [...filtered.valid];
  const seen = new Set(
    [raw, ...(params.existingTexts || []), ...out].map((s) => String(s || '').trim().toLowerCase())
  );

  for (const cand of candidates) {
    if (out.length >= count) break;
    const norm = cand.trim().toLowerCase();
    if (seen.has(norm)) continue;
    const tokenOk = protectedTokens.every((tok) => {
      if (/^https?:\/\//i.test(tok)) {
        const bare = tok.replace(/^https?:\/\//i, '').toLowerCase();
        return norm.includes(tok.toLowerCase()) || norm.includes(bare);
      }
      return norm.includes(tok.toLowerCase());
    });
    if (tokenOk) {
      seen.add(norm);
      out.push(cand);
    }
  }

  return out.slice(0, count);
}
