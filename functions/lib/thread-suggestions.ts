export interface StructuredThreadContext {
  platform?: string;
  url?: string;
  author?: string;
  authorHandle?: string;
  subreddit?: string;
  title?: string;
  body?: string;
  quotedText?: string;
  cardText?: string;
  mediaAltText?: string;
  existingReplies?: string[];
  replyTargetText?: string;
  isReplyingToComment?: boolean;
}

export interface BrandRelevanceAssessment {
  isRelevant: boolean;
  reason: string;
}

export interface NormalizedThreadSuggestions {
  detectedIntent: string;
  topicSummary: string;
  brandRelevance: BrandRelevanceAssessment;
  organic: string[];
  promo: string[];
  trojan: string[];
}

function cleanSnippet(val: unknown, maxLen: number): string {
  return String(val || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

export function buildThreadSuggestionsPrompts(params: {
  platform: string;
  threadTitle?: string;
  threadBody?: string;
  threadContext?: StructuredThreadContext | null;
  brand?: Record<string, any>;
  organicGuidelines?: string;
  trojanGuidelines?: string;
  count?: number;
}) {
  const platform = String(params.platform || 'twitter').toLowerCase().trim() || 'twitter';
  const count = Math.max(3, Math.min(8, Number(params.count) || 6));
  const ctx = params.threadContext || {};
  const brand = params.brand || {};

  const brandName = String(
    brand.brandInfo?.name || brand.name || brand.brandName || brand.campaignName || ''
  ).trim();
  const brandTagline = String(brand.tagline || brand.brandInfo?.tagline || '').trim();
  const brandPitch = String(
    brand.pitch || brand.brandInfo?.description || brand.brandInfo?.pitch || ''
  ).trim();
  const brandWebsite = String(
    brand.website || brand.websiteUrl || brand.directory?.websiteUrl || brand.brandInfo?.url || ''
  ).trim();
  const domainClean = brandWebsite.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const activeUrl = platform === 'twitter' || platform === 'threads' ? domainClean : brandWebsite;

  const title = cleanSnippet(ctx.title || params.threadTitle, 500);
  const body = cleanSnippet(ctx.body || params.threadBody, 1800);
  const author = cleanSnippet(ctx.author, 120);
  const authorHandle = cleanSnippet(ctx.authorHandle, 80);
  const subreddit = cleanSnippet(ctx.subreddit, 80);
  const quotedText = cleanSnippet(ctx.quotedText, 600);
  const cardText = cleanSnippet(ctx.cardText, 400);
  const mediaAltText = cleanSnippet(ctx.mediaAltText, 300);
  const replyTargetText = cleanSnippet(ctx.replyTargetText, 600);
  const isReplyingToComment = Boolean(ctx.isReplyingToComment);
  const existingReplies = Array.isArray(ctx.existingReplies)
    ? ctx.existingReplies.map((r) => cleanSnippet(r, 220)).filter(Boolean).slice(0, 4)
    : [];

  let platformRules = '';
  if (platform === 'twitter' || platform === 'threads') {
    platformRules = `- PLATFORM (${platform.toUpperCase()}): Keep replies short, natural, and human — 1 to 2 punchy sentences (roughly 8 to 28 words; aim under 200 chars for organic and under 240 chars for promo).
- Casual punctuation is encouraged (contractions, natural phrasing). ZERO hashtags, ZERO corporate buzzwords, ZERO multi-paragraph essays.`;
  } else if (platform === 'reddit') {
    platformRules = `- PLATFORM (REDDIT${subreddit ? ` in ${subreddit}` : ''}): Peer-level, practical, candid tone matching subreddit culture. 15 to 55 words. Zero hype, zero emojis overload, zero salesy phrasing.`;
  } else if (platform === 'linkedin') {
    platformRules = `- PLATFORM (LINKEDIN): Concise, experience-led, thoughtful 1 to 3 sentences (15 to 45 words). No cringey single-line broetry or corporate clichés.`;
  } else if (platform === 'youtube' || platform === 'tiktok' || platform === 'instagram') {
    platformRules = `- PLATFORM (${platform.toUpperCase()}): Conversational viewer tone reacting to the specific video/post point. 8 to 30 words.`;
  } else {
    platformRules = `- PLATFORM (${platform.toUpperCase()}): Concise, natural, context-grounded replies (12 to 45 words).`;
  }

  const bannedPhrases = [
    'The biggest shift for me',
    'Really insightful perspective',
    'Completely agree',
    'Great post!',
    'Thanks for sharing',
    'I couldn\'t agree more',
    'game-changer',
    'highest-leverage',
    'isolating the highest-leverage',
    'As an AI',
    'love this!'
  ];

  const customOrganicNote = params.organicGuidelines ? `\nWorkspace Organic Style Note:\n${params.organicGuidelines}\n` : '';
  const customPromoNote = params.trojanGuidelines ? `\nWorkspace Promo Style Note:\n${params.trojanGuidelines}\n` : '';

  const systemPrompt = `You write high-signal, genuinely human social replies that sound like a real builder/user who actually read the post.

STEP 1 — ANALYZE POST CONTEXT & INTENT:
- Read every detail provided: author, post copy, bullet points, quoted post, link card text, image alt text, parent comment (if replying to a comment), and existing replies.
- Classify "detectedIntent" as one of: "launch", "question", "hot_take", "tutorial", "showcase", "discussion".
- Identify concrete nouns, product features, workflows, metrics, or pain points mentioned in the post. Every reply MUST reference or build directly on those specifics.
- Avoid repeating points already covered in "Existing Top Replies".

STEP 2 — GENERATE ${count} DISTINCT ORGANIC REPLIES ("organic"):
- ZERO product plugs, ZERO brand names, ZERO links, ZERO hashtags.
- Cover ${count} distinct angles across the array:
  1) Reaction to a specific feature, detail, or trade-off mentioned in the post
  2) Genuine, specific builder/practitioner follow-up question
  3) Relatable workflow or pain-point validation grounded in the post's topic
  4) Constructive nuance, edge case, or practical UX observation
  5) Short, punchy take or contrast
  6) Concrete use-case / example reaction
${customOrganicNote}
STEP 3 — ASSESS BRAND RELEVANCE & GENERATE ${count} PROMO / FOUNDER-ANGLE REPLIES ("promo"):
- Evaluate whether the Active Campaign ("${brandName || 'None'}") is genuinely relevant to what this specific post is discussing.
- Set "brandRelevance": { "isRelevant": true/false, "reason": "short 1-sentence explanation" }.
- IF isRelevant is TRUE (natural fit with the post's domain, audience, or workflow):
  Write ${count} varied, non-spammy replies weaving in ${brandName || 'the product'}${activeUrl ? ` (${activeUrl})` : ''} naturally across different angles (Founder parallel, Curated recommendation, Value-first micro-plug, Workflow bridge, Use-case comparison, Casual resource drop).
- IF isRelevant is FALSE (e.g., campaign is unrelated consumer product on a developer-tool tweet, or zero natural bridge):
  DO NOT force an off-topic product pitch or jarring link drop! Instead, write ${count} authentic founder-to-founder / builder-to-builder conversational replies (e.g., sharing a genuine product/distribution/UX perspective as a fellow maker without forcing an unrelated brand name or URL).
${customPromoNote}
STRICT QUALITY RULES:
${platformRules}
- NEVER use generic Mad-Libs filler or banned phrases: ${bannedPhrases.map((p) => `"${p}"`).join(', ')}.
- If replying to a specific comment ("replyTargetText"), reply directly to THAT comment while staying aware of the main post.
- Return ONLY valid JSON matching the exact schema.`;

  const ba = (brand.brandAssets && typeof brand.brandAssets === 'object') ? brand.brandAssets : {};
  const baPitch = cleanSnippet(ba.longPitch || ba.shortPitch || brandPitch, 1400);
  const baAudience = cleanSnippet(ba.targetAudience, 220);
  const baPricing = cleanSnippet(ba.pricingSummary, 220);
  const baFeatures = (Array.isArray(ba.features) ? ba.features : [])
    .map((f: any) => typeof f === 'string' ? f.trim() : [f?.title, f?.detail].filter(Boolean).join(': '))
    .filter(Boolean).slice(0, 4).join(' | ').slice(0, 320);
  const baCompetitors = (Array.isArray(ba.competitors) ? ba.competitors : [])
    .filter((c: any) => c?.name || c?.advantage)
    .slice(0, 3)
    .map((c: any) => `${c.name || ''}: ${c.advantage || ''}${c.recommendWhen ? ` (${c.recommendWhen})` : ''}`)
    .join(' || ').slice(0, 320);
  const baForbidden = cleanSnippet(ba.tone?.forbiddenWords, 160);

  const contextLines: string[] = [
    `Platform: ${platform}`,
    subreddit ? `Subreddit: ${subreddit}` : '',
    author || authorHandle ? `Author: ${[author, authorHandle].filter(Boolean).join(' ')}` : '',
    ctx.url ? `URL: ${ctx.url}` : '',
    title ? `Main Post / Title:\n${title}` : '',
    body && body !== title ? `Post Body / Details:\n${body}` : '',
    quotedText ? `Quoted Post:\n${quotedText}` : '',
    cardText ? `Link / Media Card Text:\n${cardText}` : '',
    mediaAltText ? `Image Alt Text:\n${mediaAltText}` : '',
    isReplyingToComment && replyTargetText ? `Specific Comment Being Replied To:\n${replyTargetText}` : '',
    existingReplies.length > 0 ? `Existing Top Replies (avoid repeating these):\n- ${existingReplies.join('\n- ')}` : '',
    '',
    `Active Campaign / Brand: ${brandName || '(None configured)'}`,
    brandTagline ? `Campaign Tagline: ${brandTagline}` : '',
    baPitch ? `Campaign Description: ${baPitch}` : '',
    baAudience ? `Target Audience: ${baAudience}` : '',
    baPricing ? `Pricing Summary: ${baPricing}` : '',
    baFeatures ? `Key Features: ${baFeatures}` : '',
    baCompetitors ? `Competitor Positioning: ${baCompetitors}` : '',
    baForbidden ? `Forbidden Words / Claims (NEVER USE): ${baForbidden}` : '',
    brandWebsite ? `Campaign URL: ${brandWebsite}` : '',
    '',
    `Return ONLY valid JSON with:`,
    `{`,
    `  "detectedIntent": "launch|question|hot_take|tutorial|showcase|discussion",`,
    `  "topicSummary": "concise <=12 word summary of the post",`,
    `  "brandRelevance": { "isRelevant": true, "reason": "short explanation" },`,
    `  "organic": ["reply1", "reply2", "reply3", "reply4", "reply5", "reply6"],`,
    `  "promo": ["reply1", "reply2", "reply3", "reply4", "reply5", "reply6"]`,
    `}`
  ].filter((line) => line !== '');

  return {
    systemPrompt,
    userPrompt: contextLines.join('\n'),
    count,
    hasBrand: Boolean(brandName || brandPitch)
  };
}

function toPlainString(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    return String(obj.text || obj.message || obj.reply || obj.content || '').trim();
  }
  return '';
}

export function parseThreadSuggestionsResponse(
  rawContent: string,
  count = 6
): NormalizedThreadSuggestions | null {
  const raw = String(rawContent || '').trim();
  if (!raw) return null;

  const tryParse = (candidate: string): any => {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed = tryParse(stripped);
  if (!parsed) {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first !== -1 && last > first) {
      parsed = tryParse(stripped.slice(first, last + 1));
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const organic = (Array.isArray(parsed.organic) ? parsed.organic : [])
    .map(toPlainString)
    .filter(Boolean)
    .slice(0, count);
  const rawPromo = Array.isArray(parsed.promo)
    ? parsed.promo
    : (Array.isArray(parsed.trojan) ? parsed.trojan : []);
  const promo = rawPromo.map(toPlainString).filter(Boolean).slice(0, count);

  if (organic.length === 0 && promo.length === 0) return null;

  const br = parsed.brandRelevance && typeof parsed.brandRelevance === 'object'
    ? parsed.brandRelevance
    : {};

  return {
    detectedIntent: String(parsed.detectedIntent || 'discussion').trim(),
    topicSummary: String(parsed.topicSummary || '').trim(),
    brandRelevance: {
      isRelevant: br.isRelevant !== false,
      reason: String(br.reason || '').trim(),
    },
    organic,
    promo,
    trojan: promo,
  };
}
