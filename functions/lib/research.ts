export type ResearchTimeframe = '24h' | 'week' | 'month' | 'all';

export interface DiscoveredThread {
  id: string;
  title: string;
  url: string;
  snippet: string;
  platform: string;
  matchedTerm: string;
  publishedAt: string;
  source: string;
  intentScore?: number;
  status: 'new' | 'queued' | 'dismissed';
}

function toWebBase64Id(input: string): string {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `thr-${btoa(binary).replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`;
  } catch {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `thr-${(hash >>> 0).toString(36)}`;
  }
}

export function cleanPlainText(str: string): string {
  let text = String(str || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
      .replace(/&rsquo;|&lsquo;/gi, "'")
      .replace(/&rdquo;|&ldquo;/gi, '"')
      .replace(/&ndash;|&mdash;/gi, '-')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_m, dec) => {
        const code = Number(dec);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      });
    if (decoded === text) break;
    text = decoded;
  }
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXmlEntities(str: string): string {
  return cleanPlainText(str);
}

function extractTag(xmlBlock: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? match[1] : '';
}

function unwrapGoogleRedirectUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('google.') && u.pathname === '/url') {
      const inner = u.searchParams.get('url') || u.searchParams.get('q');
      if (inner && inner.startsWith('http')) return inner;
    }
  } catch {}
  return rawUrl;
}

export function detectPlatformFromUrl(url: string): string {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('reddit.com')) return 'reddit';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'facebook';
  if (lower.includes('threads.net') || lower.includes('threads.com')) return 'threads';
  if (lower.includes('pinterest.')) return 'pinterest';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('quora.com')) return 'quora';
  if (lower.includes('medium.com')) return 'medium';
  if (lower.includes('news.ycombinator.com')) return 'hackernews';
  return 'web';
}

function computeThreadIntentScore(opts: {
  title: string;
  snippet: string;
  platform: string;
  publishedAt: string;
  source: string;
  commentsCount?: number;
}): number {
  let score = 25;
  const hay = `${opts.title} ${opts.snippet}`.toLowerCase();
  if (/\b(alternative|alternatives|alternate|competitor|vs\.?|versus|switch(?:ing)? from|replace)\b/.test(hay)) score += 28;
  if (/\b(recommend|recommendation|looking for|anyone know|anyone use|anyone tried|what(?:'s| is) the best|best tool|best app|best software|suggest)\b/.test(hay)) score += 25;
  if (hay.includes('?')) score += 8;
  if (opts.platform === 'reddit' || opts.platform === 'twitter' || opts.platform === 'quora' || opts.platform === 'threads') score += 15;
  else if (opts.platform === 'hackernews') score += 13;
  else if (opts.platform === 'youtube' || opts.platform === 'linkedin' || opts.platform === 'tiktok' || opts.platform === 'instagram' || opts.platform === 'facebook' || opts.platform === 'medium') score += 8;
  if (String(opts.source || '').toLowerCase().includes('google alerts')) score += 10;
  if (typeof opts.commentsCount === 'number' && opts.commentsCount >= 5) score += 6;
  const pubMs = Date.parse(opts.publishedAt || '');
  if (Number.isFinite(pubMs)) {
    const ageHours = Math.max(0, (Date.now() - pubMs) / 3600000);
    if (ageHours <= 24) score += 15;
    else if (ageHours <= 72) score += 9;
    else if (ageHours <= 168) score += 4;
  }
  return Math.max(0, Math.min(100, score));
}

function normalizeTimeframe(raw?: string): ResearchTimeframe {
  if (raw === '24h' || raw === 'week' || raw === 'month' || raw === 'all') return raw;
  return 'week';
}

function getTimeframeCutoffMs(timeframe: ResearchTimeframe): number {
  const now = Date.now();
  if (timeframe === '24h') return now - 24 * 3600 * 1000;
  if (timeframe === 'week') return now - 7 * 24 * 3600 * 1000;
  if (timeframe === 'month') return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function getGoogleWhenToken(timeframe: ResearchTimeframe): string {
  if (timeframe === '24h') return 'when:1d';
  if (timeframe === 'week') return 'when:7d';
  if (timeframe === 'month') return 'when:30d';
  return '';
}

function buildGoogleNewsRssUrl(query: string, timeframe: ResearchTimeframe): string {
  const whenToken = getGoogleWhenToken(timeframe);
  const fullQuery = whenToken ? `${query} ${whenToken}` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=en-US&gl=US&ceid=US:en`;
}

function wrapTermForBooleanQuery(term: string): string {
  const clean = String(term || '').trim();
  if (!clean) return '';
  if (/[()"]|\bOR\b|\bAND\b|site:/i.test(clean)) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return `(${clean})`;
  return words.length > 1 ? `"${clean}"` : clean;
}

function buildCompactOrChunks(terms: string[], maxTermsPerChunk = 4, maxCharsPerChunk = 190): string[] {
  const cleaned = Array.from(new Set(terms.map((t) => wrapTermForBooleanQuery(t)).filter(Boolean)));
  const chunks: string[] = [];
  let current: string[] = [];
  for (const expr of cleaned) {
    const wrapped = expr.startsWith('(') && expr.endsWith(')') ? expr : `(${expr})`;
    const candidate = [...current, wrapped].join(' OR ');
    if (current.length > 0 && (current.length >= maxTermsPerChunk || candidate.length > maxCharsPerChunk)) {
      chunks.push(current.length === 1 ? current[0] : `(${current.join(' OR ')})`);
      current = [wrapped];
    } else {
      current.push(wrapped);
    }
  }
  if (current.length > 0) {
    chunks.push(current.length === 1 ? current[0] : `(${current.join(' OR ')})`);
  }
  return chunks;
}

interface TermCandidate {
  label: string;
  tokens: string[];
  words: string[];
}

function buildTermCandidates(keywords: string[], compQueries: string[]): TermCandidate[] {
  const out: TermCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (raw: string, isCompetitor = false) => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    const stripped = clean
      .replace(/^"|"$/g, '')
      .replace(/\s*\((?:alternative|alternate|vs|site:[^)]+)[^)]*\)\s*/gi, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    const hadCompGroup = /\([^)]*\b(?:alternative|alternate|vs)\b[^)]*\)/i.test(clean);
    const label = isCompetitor && stripped && (hadCompGroup || !/\b(?:alternative|alternate|vs)\b/i.test(clean))
      ? `${stripped} (alt/vs)`
      : (stripped || clean);
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const baseLower = stripped.toLowerCase();
    const tokens = baseLower.length >= 2 ? [baseLower] : [];
    const words = baseLower.split(/\s+/).filter((w) => w.length >= 3);
    out.push({ label, tokens, words });
  };
  keywords.forEach((k) => addCandidate(k, false));
  compQueries.forEach((c) => addCandidate(c, true));
  return out;
}

function resolveMatchedTerm(
  title: string,
  snippet: string,
  url: string,
  fallbackTerm: string,
  candidates: TermCandidate[]
): string {
  if (!candidates || candidates.length === 0) return fallbackTerm;
  const hay = `${title} ${snippet} ${url}`.toLowerCase();
  for (const cand of candidates) {
    if (cand.tokens.some((tok) => hay.includes(tok))) {
      return cand.label;
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const cand of candidates) {
    if (!cand.words || cand.words.length < 2) continue;
    const hits = cand.words.filter((w) => hay.includes(w)).length;
    const ratio = hits / cand.words.length;
    if (hits >= 2 && ratio >= 0.6 && ratio > bestScore) {
      bestScore = ratio;
      best = cand.label;
    }
  }
  return best || fallbackTerm;
}

export function parseRssOrAtomXml(
  xmlText: string,
  matchedTerm: string,
  sourceLabel: string,
  termCandidates: TermCandidate[] = []
): DiscoveredThread[] {
  const items: DiscoveredThread[] = [];
  if (!xmlText || typeof xmlText !== 'string') return items;

  const entryBlocks = xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks.slice(0, 50)) {
    const rawTitle = extractTag(block, 'title');
    const title = decodeXmlEntities(rawTitle) || 'Untitled Discussion';
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    let link = linkMatch ? linkMatch[1] : decodeXmlEntities(extractTag(block, 'link'));
    link = unwrapGoogleRedirectUrl(link.replace(/&amp;/g, '&'));
    if (!link || !link.startsWith('http')) continue;

    const rawContent = extractTag(block, 'content') || extractTag(block, 'summary');
    const snippet = decodeXmlEntities(rawContent).slice(0, 240);
    const publishedAt =
      decodeXmlEntities(extractTag(block, 'published')) ||
      decodeXmlEntities(extractTag(block, 'updated')) ||
      new Date().toISOString();
    const platform = detectPlatformFromUrl(link);
    const resolvedTerm = resolveMatchedTerm(title, snippet, link, matchedTerm, termCandidates);

    items.push({
      id: toWebBase64Id(link),
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel,
      intentScore: computeThreadIntentScore({ title, snippet, platform, publishedAt, source: sourceLabel }),
      status: 'new',
    });
  }

  if (items.length > 0) return items;

  const rssBlocks = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of rssBlocks.slice(0, 50)) {
    const title = decodeXmlEntities(extractTag(block, 'title')) || 'Untitled Result';
    let link = decodeXmlEntities(extractTag(block, 'link'));
    link = unwrapGoogleRedirectUrl(link);
    if (!link || !link.startsWith('http')) continue;
    const snippet = decodeXmlEntities(extractTag(block, 'description')).slice(0, 240);
    const publishedAt = decodeXmlEntities(extractTag(block, 'pubDate')) || new Date().toISOString();
    const platform = detectPlatformFromUrl(link);
    const resolvedTerm = resolveMatchedTerm(title, snippet, link, matchedTerm, termCandidates);

    items.push({
      id: toWebBase64Id(link),
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel,
      intentScore: computeThreadIntentScore({ title, snippet, platform, publishedAt, source: sourceLabel }),
      status: 'new',
    });
  }

  return items;
}

export async function fetchFeedSafe(
  feedUrl: string,
  matchedTerm: string,
  sourceLabel: string,
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartPosterResearch/1.3; +https://smartposter.pro)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });
      if (!res.ok) return [];
      const text = await res.text();
      return parseRssOrAtomXml(text, matchedTerm, sourceLabel, termCandidates);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

async function fetchRedditSearchWithFallback(
  term: string,
  sort: 'new' | 'comments' = 'new',
  timeframe: ResearchTimeframe = 'week',
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  const tParam = timeframe === '24h' ? 'day' : timeframe;
  const jsonUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=${sort}&t=${tParam}&limit=25`;
  const rssUrl = `https://www.reddit.com/search.rss?q=${encodeURIComponent(term)}&sort=${sort}&t=${tParam}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const res = await fetch(jsonUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartPosterResearch/1.3; +https://smartposter.pro)',
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        const children = Array.isArray(data?.data?.children) ? data.data.children : [];
        if (children.length > 0) {
          return children
            .map((child: any) => child?.data)
            .filter((post: any) => post && post.permalink)
            .map((post: any) => {
              const url = `https://www.reddit.com${post.permalink}`;
              const title = cleanPlainText(post.title || 'Reddit Discussion') || 'Reddit Discussion';
              const selftext = cleanPlainText(post.selftext || '');
              const sub = post.subreddit ? `r/${post.subreddit}` : '';
              const commentsCount = Number(post.num_comments || 0);
              const snippet = (selftext || `${sub} · ${commentsCount} comments`).slice(0, 240);
              const publishedAt = post.created_utc ? new Date(Number(post.created_utc) * 1000).toISOString() : new Date().toISOString();
              const resolvedTerm = /[()]|\bOR\b/i.test(term)
                ? resolveMatchedTerm(title, snippet, url, term, termCandidates)
                : term;
              return {
                id: toWebBase64Id(url),
                title,
                url,
                snippet,
                platform: 'reddit',
                matchedTerm: resolvedTerm,
                publishedAt,
                source: 'Reddit Live Search',
                intentScore: computeThreadIntentScore({
                  title,
                  snippet,
                  platform: 'reddit',
                  publishedAt,
                  source: 'Reddit Live Search',
                  commentsCount,
                }),
                status: 'new' as const,
              };
            });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {}
  return fetchFeedSafe(rssUrl, term, 'Reddit Live Feed', termCandidates);
}

async function fetchHackerNewsSafe(
  term: string,
  timeframe: ResearchTimeframe = 'week',
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const cutoffMs = getTimeframeCutoffMs(timeframe);
      const numericFilter = cutoffMs > 0 ? `&numericFilters=created_at_i>${Math.floor(cutoffMs / 1000)}` : '';
      const hnQuery = term
        .replace(/\([^)]*\b(?:alternative|alternate|vs)\b[^)]*\)/gi, ' alternative')
        .replace(/[()"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!hnQuery) return [];
      const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hnQuery)}&tags=(story,ask_hn,show_hn)${numericFilter}&hitsPerPage=20`;
      const res = await fetch(hnUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data: any = await res.json().catch(() => null);
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      return hits
        .filter((h: any) => h && (h.objectID || h.url))
        .map((h: any) => {
          const discussionUrl = h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : String(h.url || '');
          const title = cleanPlainText(h.title || h.story_title || 'Hacker News Discussion') || 'Hacker News Discussion';
          const commentsCount = Number(h.num_comments || 0);
          const snippet = cleanPlainText(h.story_text || '').slice(0, 240)
            || `${Number(h.points || 0)} points · ${commentsCount} comments on Hacker News`;
          const publishedAt = h.created_at || (h.created_at_i ? new Date(Number(h.created_at_i) * 1000).toISOString() : new Date().toISOString());
          const resolvedTerm = resolveMatchedTerm(title, snippet, discussionUrl, hnQuery, termCandidates);
          return {
            id: toWebBase64Id(discussionUrl),
            title,
            url: discussionUrl,
            snippet,
            platform: 'hackernews',
            matchedTerm: resolvedTerm,
            publishedAt,
            source: 'Hacker News Live',
            intentScore: computeThreadIntentScore({
              title,
              snippet,
              platform: 'hackernews',
              publishedAt,
              source: 'Hacker News Live',
              commentsCount,
            }),
            status: 'new' as const,
          };
        });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

async function runInBatches<T>(tasks: Array<() => Promise<T>>, batchSize = 8): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const slice = tasks.slice(i, i + batchSize);
    const chunk = await Promise.all(slice.map((fn) => fn().catch(() => ([] as unknown as T))));
    results.push(...chunk);
  }
  return results;
}

const SITE_RSS_PLATFORMS: Array<{ key: string; label: string; siteExpr: string }> = [
  { key: 'twitter', label: 'X / Twitter Index RSS', siteExpr: '(site:x.com OR site:twitter.com)' },
  { key: 'youtube', label: 'YouTube Index RSS', siteExpr: 'site:youtube.com' },
  { key: 'linkedin', label: 'LinkedIn Index RSS', siteExpr: 'site:linkedin.com' },
  { key: 'quora', label: 'Quora Index RSS', siteExpr: 'site:quora.com' },
  { key: 'medium', label: 'Medium Index RSS', siteExpr: 'site:medium.com' },
];

export async function runResearchDiscovery(params: {
  keywords?: string[];
  competitorQueries?: string[];
  platforms?: Record<string, boolean>;
  alertFeeds?: { url: string; term?: string; label?: string }[];
  quality?: 'best' | 'all';
  timeframe?: ResearchTimeframe;
}): Promise<{ threads: DiscoveredThread[]; feedsChecked: number; timeframe: ResearchTimeframe }> {
  const keywords = (params.keywords || []).map((k) => String(k || '').trim()).filter(Boolean);
  const compQueries = (params.competitorQueries || []).map((q) => String(q || '').trim()).filter(Boolean);
  const allTerms = Array.from(new Set([...keywords, ...compQueries])).slice(0, 25);
  const timeframe = normalizeTimeframe(params.timeframe);
  const rawPlatforms = params.platforms && typeof params.platforms === 'object' ? params.platforms : {};
  const platforms: Record<string, boolean> = Object.keys(rawPlatforms).length > 0
    ? rawPlatforms
    : {
        reddit: true,
        twitter: true,
        youtube: true,
        linkedin: true,
        web: true,
        hackernews: true,
        quora: true,
        medium: true,
      };
  const alertFeeds = (params.alertFeeds || []).filter((f) => f && f.url && f.url.startsWith('http'));
  const termCandidates = buildTermCandidates(keywords, compQueries);
  const defaultFallbackLabel = termCandidates[0]?.label || keywords[0] || 'Opportunity';

  const tasks: Array<() => Promise<DiscoveredThread[]>> = [];
  let feedsChecked = 0;

  for (const feed of alertFeeds.slice(0, 35)) {
    feedsChecked++;
    tasks.push(() => fetchFeedSafe(feed.url, feed.term || feed.label || 'Google Alert', 'Google Alerts RSS', termCandidates));
  }

  if (allTerms.length > 0) {
    if (platforms.reddit === true) {
      const redditChunks = buildCompactOrChunks(allTerms, 4, 190).slice(0, 6);
      for (const chunk of redditChunks) {
        feedsChecked++;
        tasks.push(() => fetchRedditSearchWithFallback(chunk, 'new', timeframe, termCandidates));
      }
    }

    if (platforms.hackernews === true) {
      for (const term of allTerms.slice(0, 10)) {
        feedsChecked++;
        tasks.push(() => fetchHackerNewsSafe(term, timeframe, termCandidates));
      }
    }

    const webChunks = buildCompactOrChunks(allTerms, 4, 180).slice(0, 6);
    const activeSiteExprs = SITE_RSS_PLATFORMS
      .filter((sp) => platforms[sp.key] === true)
      .map((sp) => sp.siteExpr);

    if (activeSiteExprs.length > 0) {
      const siteGroupExpr = activeSiteExprs.length === 1 ? activeSiteExprs[0] : `(${activeSiteExprs.join(' OR ')})`;
      for (const chunk of webChunks) {
        feedsChecked++;
        const rss = buildGoogleNewsRssUrl(`${chunk} ${siteGroupExpr}`, timeframe);
        tasks.push(() => fetchFeedSafe(rss, defaultFallbackLabel, 'Platform Index RSS', termCandidates));
      }
    }

    if (platforms.web === true) {
      for (const chunk of webChunks) {
        feedsChecked++;
        const webRss = buildGoogleNewsRssUrl(chunk, timeframe);
        tasks.push(() => fetchFeedSafe(webRss, defaultFallbackLabel, 'Web Discovery RSS', termCandidates));
      }
    }
  }

  const results = await runInBatches(tasks, 6);
  const flat = results.flat();
  const cutoffMs = getTimeframeCutoffMs(timeframe);

  const seen = new Set<string>();
  const deduped: DiscoveredThread[] = [];
  for (const item of flat) {
    if (!item || !item.url) continue;
    if (cutoffMs > 0) {
      const pubMs = Date.parse(item.publishedAt || '');
      if (Number.isFinite(pubMs) && pubMs > 0 && pubMs < cutoffMs) continue;
    }
    const normUrl = item.url.split('#')[0].replace(/\/+$/, '').toLowerCase();
    if (seen.has(normUrl)) continue;
    seen.add(normUrl);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const timeDiff = (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0);
    if (Math.abs(timeDiff) > 3600000) return timeDiff;
    return Number(b.intentScore || 0) - Number(a.intentScore || 0);
  });

  const limit = params.quality === 'best' ? 150 : 300;
  return { threads: deduped.slice(0, limit), feedsChecked, timeframe };
}

export function buildOpportunitySuggestionsFallback(opts: {
  brandName: string;
  brandUrl: string;
  brandTagline: string;
  brandDescription: string;
  brandCategory: string;
  seedNiche: string;
  landingTitle: string;
  landingDescription: string;
}) {
  const {
    brandName,
    brandTagline,
    brandDescription,
    brandCategory,
    seedNiche,
    landingTitle,
    landingDescription,
  } = opts;

  const rawText = [seedNiche, brandTagline, landingTitle, brandDescription, landingDescription, brandCategory]
    .filter(Boolean)
    .join(' ');
  const cleanTitle = String(seedNiche || brandTagline || landingTitle || brandCategory || brandName || 'productivity software')
    .replace(/https?:\/\/\S+/gi, '')
    .split(/[|—–]/)[0]
    .trim();
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'our', 'all', 'get',
    'into', 'more', 'how', 'what', 'best', 'tool', 'tools', 'app', 'software', 'platform', 'site',
    'com', 'www', 'http', 'https', 'without', 'using', 'make', 'build', 'built', 'help', 'helps',
    'will', 'can', 'just', 'like', 'than', 'have', 'has', 'about', 'over', 'very',
  ]);
  const tokens = rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));
  const freq: Record<string, { count: number; firstIdx: number }> = {};
  tokens.forEach((t, idx) => {
    if (!freq[t]) freq[t] = { count: 0, firstIdx: idx };
    freq[t].count += 1;
  });
  const topTerms = Object.entries(freq)
    .sort((a, b) => (b[1].count - a[1].count) || (a[1].firstIdx - b[1].firstIdx))
    .slice(0, 6)
    .sort((a, b) => a[1].firstIdx - b[1].firstIdx)
    .map(([w]) => w);

  const coreTopic = (seedNiche || topTerms.slice(0, 2).join(' ') || brandCategory || 'workflow automation').trim();
  const secondaryTopic = topTerms.slice(2, 4).join(' ') || coreTopic;

  const keywords = Array.from(new Set([
    `best ${coreTopic} tool`,
    `${coreTopic} recommendation`,
    `looking for ${coreTopic} software`,
    `how to improve ${coreTopic}`,
    `${coreTopic} alternatives`,
    `${coreTopic} workflow tips`,
    secondaryTopic && secondaryTopic !== coreTopic ? `best ${secondaryTopic} tools` : `top ${coreTopic} apps`,
    `anyone using ${coreTopic}`,
    `${coreTopic} vs manual workflow`,
    `free ${coreTopic} tool`,
  ].map((k) => k.replace(/\s+/g, ' ').trim()).filter((k) => k.length > 4)));

  const catLower = `${brandCategory} ${rawText}`.toLowerCase();
  let competitors: Array<{ name: string; reason: string }> = [];
  if (/(pomodoro|focus|timer|deep work|productivity|task|todo|habit|time track)/.test(catLower)) {
    competitors = [
      { name: 'Forest', reason: 'Popular gamified focus timer' },
      { name: 'Pomofocus', reason: 'Minimal web Pomodoro timer' },
      { name: 'Toggl Track', reason: 'Time tracking & work blocks' },
      { name: 'Centered', reason: 'Flow-state focus sessions' },
      { name: 'Sunsama', reason: 'Daily planning & focus rituals' },
      { name: 'Motion', reason: 'Automated calendar scheduling' },
    ];
  } else if (/(outreach|cold email|lead gen|contact form|directory|marketing|seo|backlink|growth|social)/.test(catLower)) {
    competitors = [
      { name: 'Instantly', reason: 'Cold email outreach automation' },
      { name: 'Smartlead', reason: 'Multi-inbox outreach platform' },
      { name: 'Apollo.io', reason: 'B2B lead & outreach database' },
      { name: 'Lemlist', reason: 'Personalized outbound sequences' },
      { name: 'GummySearch', reason: 'Reddit audience & lead discovery' },
      { name: 'Syften', reason: 'Social keyword alert monitoring' },
    ];
  } else if (/(finance|stock|trading|invest|crypto|chart|portfolio)/.test(catLower)) {
    competitors = [
      { name: 'TradingView', reason: 'Market charting & community' },
      { name: 'Seeking Alpha', reason: 'Stock research & analysis' },
      { name: 'Finviz', reason: 'Stock screener & market maps' },
      { name: 'Simply Wall St', reason: 'Visual equity research' },
      { name: 'Koyfin', reason: 'Market analytics dashboard' },
      { name: 'Yahoo Finance', reason: 'Retail portfolio tracking' },
    ];
  } else {
    competitors = [
      { name: 'Product Hunt', reason: 'Launch & discovery community' },
      { name: 'AlternativeTo', reason: 'Software comparison directory' },
      { name: 'G2', reason: 'Buyer software reviews' },
      { name: 'Capterra', reason: 'SaaS category comparisons' },
      { name: 'Zapier', reason: 'Workflow automation ecosystem' },
      { name: 'Notion', reason: 'All-in-one team workspace' },
    ];
  }

  const brandLower = String(brandName || '').toLowerCase();
  competitors = competitors.filter((c) => c.name.toLowerCase() !== brandLower);

  return {
    nicheSummary: cleanTitle.slice(0, 72) || 'Niche Discovery',
    keywords: keywords.slice(0, 10),
    competitors: competitors.slice(0, 6),
  };
}
