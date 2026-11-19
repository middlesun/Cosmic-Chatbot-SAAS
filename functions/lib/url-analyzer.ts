export interface ExtractedBrandProfile {
  name?: string;
  tagline?: string;
  shortPitch?: string;
  shortPitches?: string[];
  longPitch?: string;
  targetAudience?: string;
  pricingSummary?: string;
  pricingModel?: string;
  startingPrice?: string;
  founderStory?: string;
  ogCoverUrl?: string;
  logoUrl?: string;
  features?: Array<{ title: string; detail: string }>;
  benefits?: Array<{ title: string; detail: string }>;
  competitors?: Array<{ name: string; advantage: string; recommendWhen?: string }>;
  links?: {
    pricingUrl?: string;
    docsUrl?: string;
    bookingUrl?: string;
  };
  videos?: {
    demoUrl?: string;
    explainerUrl?: string;
    onboardingUrl?: string;
  };
  customLinks?: Array<{ name: string; url: string }>;
  handles?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
    youtube?: string;
    productHunt?: string;
  };
  testimonials?: Array<{ quote: string; author: string }>;
}

export interface ScannedPageContext {
  sourceType: 'tab' | 'url' | 'brand';
  url: string;
  domain: string;
  title: string;
  metaTitle?: string;
  metaDescription: string;
  description: string;
  heroHeadline?: string;
  heroText?: string;
  headings: string[];
  ctaTexts: string[];
  bodyCopy: string;
  copy: string;
  logoUrl?: string;
  ogCoverUrl?: string;
  faviconUrl?: string;
  twitter?: string;
  brandProfile?: ExtractedBrandProfile;
  platform?: string;
  scannedAt?: string;
}

export function isPublicHttpUrl(rawUrl: string): URL | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^0\./.test(host) ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
      /^(fe80|fc00|fd00|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|::ffff:169\.254\.|::ffff:172\.(1[6-9]|2\d|3[0-1])\.)/i.test(host)
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code < 65535 ? String.fromCharCode(code) : ' ';
    });
}

function stripTagsAndNormalize(htmlFragment: string): string {
  return decodeHtmlEntities(String(htmlFragment || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) {
      const cleaned = decodeHtmlEntities(m[1]).replace(/\s+/g, ' ').trim();
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function resolveAbsoluteUrl(raw: string, baseOrigin: string): string {
  const cleaned = decodeHtmlEntities(String(raw || '').trim());
  if (!cleaned || cleaned.startsWith('#') || /^(?:javascript|mailto|tel|data):/i.test(cleaned)) return '';
  try {
    return new URL(cleaned, baseOrigin).href;
  } catch {
    return '';
  }
}

function extractFaviconUrl(html: string, urlObj: URL): string {
  const m =
    html.match(/<link[^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["']/i);
  if (m && m[1]) {
    const resolved = resolveAbsoluteUrl(m[1], urlObj.origin);
    if (resolved) return resolved;
  }
  return `${urlObj.origin}/favicon.ico`;
}

function extractRichBrandProfileFromHtml(
  safeHtml: string,
  urlObj: URL,
  base: {
    siteName: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    heroHeadline: string;
    heroText: string;
    headings: string[];
    bodyCopy: string;
    ogCoverUrl: string;
    twitter: string;
  }
): ExtractedBrandProfile {
  const handles: NonNullable<ExtractedBrandProfile['handles']> = {};
  if (base.twitter) handles.twitter = base.twitter.replace(/^@/, '');

  const links: NonNullable<ExtractedBrandProfile['links']> = {};
  const videos: NonNullable<ExtractedBrandProfile['videos']> = {};
  const customLinks: Array<{ name: string; url: string }> = [];
  const seenCustomUrls = new Set<string>();
  const videoCandidates: Array<{ url: string; kind: 'demo' | 'explainer' | 'onboarding' | 'any' }> = [];
  const pushVideo = (url: string, label = '') => {
    if (!url || videoCandidates.some(v => v.url === url)) return;
    const low = `${url} ${label}`.toLowerCase();
    const kind = /onboard|getting.?started|setup|tutorial|walkthrough/.test(low)
      ? 'onboarding'
      : /explain|overview|intro|how.?it.?works/.test(low)
        ? 'explainer'
        : /demo|watch|preview/.test(low)
          ? 'demo'
          : 'any';
    videoCandidates.push({ url, kind });
  };

  let ldName = '';
  let ldDesc = '';
  let ldTagline = '';
  let ldLogo = '';
  let ldAudience = '';
  let ldPrice = '';
  const ldFeatureStrings: string[] = [];
  const ldScriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldm: RegExpExecArray | null;
  const flattenLd = (node: any): any[] => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(flattenLd);
    if (Array.isArray(node['@graph'])) return [node, ...flattenLd(node['@graph'])];
    return [node];
  };
  const sameAsUrls: string[] = [];
  while ((ldm = ldScriptRe.exec(safeHtml)) !== null) {
    try {
      const parsed = JSON.parse(ldm[1].trim());
      for (const item of flattenLd(parsed)) {
        const typ = String(item?.['@type'] || '').toLowerCase();
        if (!ldName && item?.name && typeof item.name === 'string' && !/breadcrumb|webpage|list/i.test(typ)) {
          ldName = item.name.trim();
        }
        if (!ldDesc && item?.description && typeof item.description === 'string') {
          ldDesc = item.description.trim();
        }
        if (!ldTagline && item?.slogan && typeof item.slogan === 'string') {
          ldTagline = item.slogan.trim();
        }
        const logoCandidate = typeof item?.logo === 'string' ? item.logo : (item?.logo?.url || '');
        if (!ldLogo && logoCandidate) {
          ldLogo = resolveAbsoluteUrl(logoCandidate, urlObj.origin) || logoCandidate;
        }
        if (!ldAudience && item?.audience) {
          ldAudience = typeof item.audience === 'string'
            ? item.audience
            : (item.audience.audienceType || item.audience.name || '');
        }
        if (item?.offers) {
          const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const off of offers) {
            if (off?.price !== undefined && off?.price !== '') {
              const cur = off.priceCurrency === 'USD' || !off.priceCurrency ? '$' : `${off.priceCurrency} `;
              const pr = Number(off.price) === 0 ? 'Free' : `${cur}${off.price}`;
              if (!ldPrice) ldPrice = pr;
            }
          }
        }
        if (Array.isArray(item?.featureList)) {
          for (const f of item.featureList) {
            if (typeof f === 'string' && f.trim()) ldFeatureStrings.push(f.trim());
          }
        }
        if (Array.isArray(item?.sameAs)) {
          for (const u of item.sameAs) {
            if (typeof u === 'string') sameAsUrls.push(u.trim());
          }
        } else if (typeof item?.sameAs === 'string') {
          sameAsUrls.push(item.sameAs.trim());
        }
      }
    } catch {}
  }

  const classifyHref = (rawHref: string, labelText = '') => {
    const abs = resolveAbsoluteUrl(rawHref, urlObj.origin);
    if (!abs) return;
    let u: URL;
    try {
      u = new URL(abs);
    } catch {
      return;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    const lowLabel = labelText.toLowerCase();

    if ((host === 'twitter.com' || host === 'x.com') && path && !/^\/(?:intent|share|home|search|hashtag|i|explore)\b/i.test(path)) {
      const h = path.split('/').filter(Boolean)[0];
      if (h && !handles.twitter) handles.twitter = h.replace(/^@/, '');
      return;
    }
    if (host === 'instagram.com' && path && !/^\/(?:p|reel|stories|explore|accounts)\b/i.test(path)) {
      const h = path.split('/').filter(Boolean)[0];
      if (h && !handles.instagram) handles.instagram = h.replace(/^@/, '');
      return;
    }
    if (host.endsWith('linkedin.com') && /^\/(?:company|in|showcase)\//i.test(path)) {
      if (!handles.linkedin) handles.linkedin = path.slice(1);
      return;
    }
    if (host === 'github.com' && path && !/^\/(?:features|pricing|sponsors|topics|explore|login|signup|settings)\b/i.test(path)) {
      const segs = path.split('/').filter(Boolean).slice(0, 2);
      if (segs.length && !handles.github) handles.github = segs.join('/');
      return;
    }
    if ((host === 'youtube.com' || host === 'm.youtube.com') && /^\/(?:@|c\/|channel\/|user\/)/i.test(path)) {
      if (!handles.youtube) handles.youtube = path.replace(/^\/@?/, '@').replace(/^@@/, '@');
      return;
    }
    if (host === 'producthunt.com' && path) {
      if (!handles.productHunt && (/^\/(?:posts|products)\//i.test(path) || path.startsWith('/@'))) {
        handles.productHunt = path.slice(1);
      }
      return;
    }

    if (
      host === 'youtube.com' ||
      host === 'youtu.be' ||
      host.includes('loom.com') ||
      host.includes('vimeo.com') ||
      /\.(?:mp4|webm)(?:\?|$)/i.test(abs)
    ) {
      pushVideo(abs, labelText);
      return;
    }

    if (
      /cal\.com|calendly\.com|tidycal\.com|savvycal\.com|meetings\.hubspot\.com/i.test(host) ||
      (/book|schedule|demo.?call/i.test(`${path} ${lowLabel}`) && /demo|call|meeting|consult/i.test(lowLabel))
    ) {
      if (!links.bookingUrl) links.bookingUrl = abs;
      return;
    }

    const baseHost = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const isSameSite = host === baseHost || host.endsWith(`.${baseHost}`);
    if (isSameSite || /docs\.|help\.|blog\.|status\.|chromewebstore\.google\.com|chrome\.google\.com\/webstore|apps\.apple\.com|play\.google\.com/i.test(host + abs)) {
      if (!links.pricingUrl && (/\/(?:pricing|plans|plan)(?:\/|$)/i.test(path) || /^pricing(?:\s|$)/i.test(lowLabel))) {
        links.pricingUrl = abs;
        return;
      }
      if (!links.docsUrl && (/\/(?:docs|documentation|changelog|guides|api|help|kb)(?:\/|$)/i.test(path) || /^(?:docs|documentation|changelog|guides|api)$/i.test(lowLabel) || /^docs\./i.test(host))) {
        links.docsUrl = abs;
        return;
      }
      const normKey = `${u.origin}${path}`;
      const rootKey = `${urlObj.origin}`;
      if (
        normKey !== rootKey &&
        normKey !== `${rootKey}/` &&
        !seenCustomUrls.has(normKey) &&
        customLinks.length < 8 &&
        !/\/(?:login|signin|sign-in|signup|sign-up|register|auth|cart|checkout|logout|cdn-cgi)\b/i.test(path)
      ) {
        let niceName = labelText.replace(/\s+/g, ' ').trim();
        if (!niceName || niceName.length < 2 || niceName.length > 36) {
          const seg = path.split('/').filter(Boolean).pop() || '';
          niceName = seg ? seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
        }
        if (niceName && niceName.length >= 2 && niceName.length <= 36) {
          seenCustomUrls.add(normKey);
          customLinks.push({ name: niceName, url: abs });
        }
      }
    }
  };

  for (const sUrl of sameAsUrls) classifyHref(sUrl, '');

  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(safeHtml)) !== null) {
    classifyHref(am[1], stripTagsAndNormalize(am[2]));
  }

  const embedRe = /<(?:iframe|video|source)\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let em: RegExpExecArray | null;
  while ((em = embedRe.exec(safeHtml)) !== null) {
    const abs = resolveAbsoluteUrl(em[1], urlObj.origin);
    if (abs && (/youtube\.com|youtu\.be|loom\.com|vimeo\.com|wistia|\.(?:mp4|webm)(?:\?|$)/i.test(abs))) {
      pushVideo(abs, em[0]);
    }
  }
  for (const v of videoCandidates) {
    if (v.kind === 'demo' && !videos.demoUrl) videos.demoUrl = v.url;
    else if (v.kind === 'explainer' && !videos.explainerUrl) videos.explainerUrl = v.url;
    else if (v.kind === 'onboarding' && !videos.onboardingUrl) videos.onboardingUrl = v.url;
  }
  for (const v of videoCandidates) {
    if (!videos.demoUrl) videos.demoUrl = v.url;
    else if (!videos.explainerUrl && v.url !== videos.demoUrl) videos.explainerUrl = v.url;
    else if (!videos.onboardingUrl && v.url !== videos.demoUrl && v.url !== videos.explainerUrl) videos.onboardingUrl = v.url;
  }

  let detectedLogoImg = ldLogo;
  if (!detectedLogoImg) {
    const imgRe = /<img\b([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(safeHtml)) !== null) {
      const attrs = im[1];
      const srcM = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcM || !srcM[1]) continue;
      if (/(?:logo|brand|wordmark)/i.test(attrs)) {
        const resolved = resolveAbsoluteUrl(srcM[1], urlObj.origin);
        if (resolved && !/1x1|pixel|spacer|tracking/i.test(resolved)) {
          detectedLogoImg = resolved;
          break;
        }
      }
    }
  }

  const bodyHtml = safeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  const strippedMain = bodyHtml
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const paragraphs: string[] = [];
  const seenParas = new Set<string>();
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(strippedMain)) !== null && paragraphs.length < 30) {
    const t = stripTagsAndNormalize(pm[1]);
    if (t && t.length >= 25 && t.length <= 500 && !seenParas.has(t.toLowerCase())) {
      seenParas.add(t.toLowerCase());
      paragraphs.push(t);
    }
  }

  const resolvedName = (ldName || base.siteName || (base.title || '').split(/[-|—]/)[0] || '').trim().slice(0, 80);
  let tagline = ldTagline || '';
  if (!tagline && (base.title.includes('|') || base.title.includes('—') || base.title.includes(' - '))) {
    const part = base.title.split(/\s*[|—]\s*|\s+-\s+/).slice(1).join(' — ').trim();
    if (part && part.length >= 4 && part.toLowerCase() !== resolvedName.toLowerCase()) tagline = part;
  }
  if (!tagline && base.heroHeadline && base.heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) {
    tagline = base.heroHeadline;
  }
  if (!tagline && base.metaDescription) {
    tagline = base.metaDescription.split(/[.!?]/)[0].trim();
  }
  tagline = tagline.slice(0, 100);

  const fitShortPitch140 = (raw: string): string => {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= 140) return s;
    const sentences = s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
    if (sentences[0] && sentences[0].length >= 45 && sentences[0].length <= 140) {
      return sentences[0];
    }
    const sliced = s.slice(0, 140);
    const lastSpace = sliced.lastIndexOf(' ');
    return (lastSpace > 75 ? sliced.slice(0, lastSpace) : sliced)
      .replace(/[,;:\-–—&+]+$/, '')
      .trim();
  };

  const shortPitchCandidates = [
    base.metaDescription,
    ldDesc,
    paragraphs.find(p => p.length >= 45 && p.length <= 220) || '',
    base.heroHeadline && base.heroText && base.heroText !== base.heroHeadline ? base.heroText : '',
    ...paragraphs.slice(0, 4),
    tagline && resolvedName ? `${resolvedName}: ${tagline}` : ''
  ];
  const shortPitches: string[] = [];
  const seenShortPrefixes = new Set<string>();
  for (const cand of shortPitchCandidates) {
    const fitted = fitShortPitch140(cand || '');
    if (!fitted || fitted.length < 25) continue;
    const key = fitted.toLowerCase().slice(0, 45);
    if (seenShortPrefixes.has(key) || shortPitches.some(x => x.toLowerCase() === fitted.toLowerCase())) continue;
    seenShortPrefixes.add(key);
    shortPitches.push(fitted);
    if (shortPitches.length >= 3) break;
  }
  const shortPitch = shortPitches[0] || '';

  let targetAudience = ldAudience.trim();
  if (!targetAudience) {
    const audSource = [base.metaDescription, base.heroText, ...paragraphs, ...base.headings].join(' . ');
    const audMatch = audSource.match(/\b(?:built for|designed for|made for|ideal for|perfect for|for)\s+((?:[a-z0-9,&\-\/]+\s+){1,10}(?:founders?|makers?|creators?|teams?|agencies?|marketers?|developers?|engineers?|designers?|startups?|businesses?|companies|freelancers?|solopreneurs?|educators?|students?|recruiters?|writers?|podcasters?|stores?|brands?|saas|builders?))/i);
    if (audMatch && audMatch[1]) {
      targetAudience = audMatch[1].trim().replace(/[.,;:]+$/, '');
    }
  }
  targetAudience = targetAudience.slice(0, 220);

  const priceTokens: string[] = [];
  const fullText = `${base.bodyCopy} ${stripTagsAndNormalize(bodyHtml)}`;
  if (/\bfree\s+(?:forever|plan|tier|starter|trial)\b|\$0\b/i.test(fullText)) {
    priceTokens.push('Free plan available');
  }
  const tierPriceRe = /(?:([A-Za-z][A-Za-z0-9+ ]{1,16})\s*[:\-–]?\s*)?(\$\s?\d{1,4}(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat|one[- ]time|lifetime))?)/gi;
  let tpm: RegExpExecArray | null;
  const seenPrices = new Set<string>();
  while ((tpm = tierPriceRe.exec(fullText)) !== null && priceTokens.length < 4) {
    const priceStr = tpm[2].replace(/\s+/g, '');
    if (priceStr === '$0' || seenPrices.has(priceStr)) continue;
    seenPrices.add(priceStr);
    const tierLabel = tpm[1] ? tpm[1].trim() : '';
    const skipWords = /^(?:save|only|just|from|for|to|at|or|and|with|under|over|about|up|per|get)$/i;
    priceTokens.push(tierLabel && !skipWords.test(tierLabel) ? `${tierLabel} ${priceStr}` : priceStr);
  }
  if (!priceTokens.length && ldPrice) priceTokens.push(ldPrice);
  const pricingSummary = priceTokens.join(', ').slice(0, 180);
  const startingPrice = ldPrice || (Array.from(seenPrices)[0] || '');
  const pricingModel = /\bfree\s+forever\b/i.test(fullText) && seenPrices.size === 0
    ? 'Free'
    : /\bfree\b/i.test(fullText) && seenPrices.size > 0
      ? 'Freemium'
      : /one[- ]time|lifetime/i.test(fullText)
        ? 'One-time'
        : seenPrices.size > 0
          ? 'Subscription'
          : '';

  let founderStory = '';
  const storyHeadingRe = /<h[2-4][^>]*>[^<]*(?:our story|founder|why we built|about us|the mission|why i built|origin)[^<]*<\/h[2-4]>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/i;
  const storyM = strippedMain.match(storyHeadingRe);
  if (storyM && storyM[1]) {
    founderStory = stripTagsAndNormalize(storyM[1]).slice(0, 400);
  } else {
    const storyPara = paragraphs.find(p => /\b(?:i built|we built|we started|our mission|frustrated with|started this|founded)\b/i.test(p));
    if (storyPara) founderStory = storyPara.slice(0, 400);
  }

  const features: Array<{ title: string; detail: string }> = [];
  const benefits: Array<{ title: string; detail: string }> = [];
  const seenFeatTitles = new Set<string>();

  for (const lf of ldFeatureStrings) {
    if (features.length >= 6) break;
    const parts = lf.split(/:\s+|\s+-\s+/);
    const t = parts[0].trim().slice(0, 80);
    if (t && !seenFeatTitles.has(t.toLowerCase())) {
      seenFeatTitles.add(t.toLowerCase());
      features.push({ title: t, detail: parts.slice(1).join(' - ').trim().slice(0, 220) });
    }
  }

  const cardPairRe = /<(h[34]|strong|b)[^>]*>([\s\S]{3,100}?)<\/\1>(?:\s|<[^>]{0,80}>){0,4}<p[^>]*>([\s\S]{15,320}?)<\/p>/gi;
  let cpm: RegExpExecArray | null;
  while ((cpm = cardPairRe.exec(strippedMain)) !== null && (features.length < 6 || benefits.length < 5)) {
    const title = stripTagsAndNormalize(cpm[2]);
    const detail = stripTagsAndNormalize(cpm[3]);
    if (!title || title.length < 3 || title.length > 75 || !detail || detail.length < 15) continue;
    if (/cookie|privacy|copyright|subscribe|sign up|log in/i.test(`${title} ${detail}`)) continue;
    const low = `${title} ${detail}`.toLowerCase();
    if (seenFeatTitles.has(title.toLowerCase())) continue;
    seenFeatTitles.add(title.toLowerCase());
    if (/\b(?:save|faster|hours|boost|increase|reduce|never miss|peace of mind|roi|revenue|effortless|without)\b/i.test(low) && benefits.length < 5) {
      benefits.push({ title: title.slice(0, 80), detail: detail.slice(0, 220) });
    } else if (features.length < 6) {
      features.push({ title: title.slice(0, 80), detail: detail.slice(0, 220) });
    }
  }

  if (features.length < 4) {
    const liRe = /<li[^>]*>([\s\S]{10,240}?)<\/li>/gi;
    let lim: RegExpExecArray | null;
    while ((lim = liRe.exec(strippedMain)) !== null && features.length < 6) {
      const txt = stripTagsAndNormalize(lim[1]);
      if (!txt || txt.length < 12 || txt.length > 180) continue;
      if (/^(?:home|pricing|docs|blog|login|sign in|about|privacy|terms|contact)$/i.test(txt)) continue;
      const splitM = txt.match(/^([^:—\-]{3,55})\s*[:—\-]\s*(.+)$/);
      const fTitle = (splitM ? splitM[1] : txt.split(' ').slice(0, 5).join(' ')).trim();
      const fDetail = (splitM ? splitM[2] : txt).trim();
      if (fTitle && !seenFeatTitles.has(fTitle.toLowerCase())) {
        seenFeatTitles.add(fTitle.toLowerCase());
        features.push({ title: fTitle.slice(0, 80), detail: fDetail.slice(0, 220) });
      }
    }
  }

  const competitors: Array<{ name: string; advantage: string; recommendWhen?: string }> = [];
  const vsRe = /\b(?:alternative to|better than|compared to|instead of|vs\.?)\s+([A-Z][A-Za-z0-9.+ ]{1,28})/g;
  let vm: RegExpExecArray | null;
  const seenComps = new Set<string>();
  while ((vm = vsRe.exec(fullText)) !== null && competitors.length < 4) {
    const name = vm[1].trim().replace(/[.,;:!?]+$/, '');
    if (name && name.toLowerCase() !== resolvedName.toLowerCase() && !seenComps.has(name.toLowerCase())) {
      seenComps.add(name.toLowerCase());
      const snippet = fullText.slice(Math.max(0, vm.index - 20), vm.index + 160).trim();
      competitors.push({ name, advantage: snippet, recommendWhen: '' });
    }
  }

  const testimonials: Array<{ quote: string; author: string }> = [];
  const bqRe = /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi;
  let bm: RegExpExecArray | null;
  while ((bm = bqRe.exec(strippedMain)) !== null && testimonials.length < 3) {
    const txt = stripTagsAndNormalize(bm[1]);
    if (txt.length >= 20 && txt.length <= 320) {
      const splitA = txt.match(/^["“]?([\s\S]+?)["”]?\s*(?:—|--|-)\s*([^—]{2,60})$/);
      testimonials.push({
        quote: (splitA ? splitA[1] : txt).replace(/^["“]|["”]$/g, '').trim(),
        author: splitA ? splitA[2].trim() : ''
      });
    }
  }

  const countWords = (s: string): number => String(s || '').replace(/•/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const trimToMaxWords = (s: string, maxW: number): string => {
    const words = String(s || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxW) return words.join(' ');
    const clipped = words.slice(0, maxW).join(' ').replace(/[,;:\-–—]+$/, '');
    return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
  };
  const ensureSentence = (s: string): string => {
    const t = String(s || '').trim();
    if (!t) return '';
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };
  const leadParts: string[] = [];
  if (base.heroHeadline && base.heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) leadParts.push(ensureSentence(base.heroHeadline));
  const mainLeadPara = ldDesc || base.metaDescription || paragraphs[0] || '';
  if (mainLeadPara && !leadParts.some(x => x.toLowerCase().includes(mainLeadPara.toLowerCase().slice(0, 30)))) {
    leadParts.push(ensureSentence(mainLeadPara));
  }
  const secondLeadPara = paragraphs.find(p => p && p.toLowerCase() !== mainLeadPara.toLowerCase() && p.length >= 45);
  if (secondLeadPara && countWords(leadParts.join(' ')) < 42) {
    leadParts.push(ensureSentence(secondLeadPara));
  }
  let introBlock = leadParts.join(' ').replace(/\s+/g, ' ').trim();
  if (countWords(introBlock) > 62) introBlock = trimToMaxWords(introBlock, 55);

  const bulletPool: string[] = [];
  const seenBullet = new Set<string>();
  const addBullet = (rawLine: string) => {
    const clean = String(rawLine || '').replace(/\s+/g, ' ').replace(/^[•\-*]\s*/, '').trim();
    if (!clean || countWords(clean) < 4) return;
    const low = clean.toLowerCase();
    const key = low.slice(0, 40);
    if (seenBullet.has(key) || (introBlock && introBlock.toLowerCase().includes(key))) return;
    if (bulletPool.some(ex => {
      const exLow = ex.toLowerCase();
      return exLow.includes(low.slice(0, 35)) || low.includes(exLow.replace(/^•\s*/, '').slice(0, 35));
    })) return;
    seenBullet.add(key);
    bulletPool.push(`• ${trimToMaxWords(clean, 26)}`);
  };
  for (const b of benefits) addBullet(b.detail ? `${b.title}: ${b.detail}` : b.title);
  for (const f of features) addBullet(f.detail ? `${f.title}: ${f.detail}` : f.title);
  for (const p of paragraphs) {
    if (bulletPool.length >= 10) break;
    addBullet(p);
  }
  for (const h of base.headings) {
    if (bulletPool.length >= 10) break;
    if (h.toLowerCase() !== resolvedName.toLowerCase() && h.toLowerCase() !== (base.heroHeadline || '').toLowerCase()) {
      addBullet(h);
    }
  }

  const chosenBullets: string[] = [];
  for (const bul of bulletPool) {
    const candidateStr = [introBlock, chosenBullets.concat(bul).join('\n')].filter(Boolean).join('\n\n');
    if (countWords(candidateStr) <= 192 || chosenBullets.length < 3) {
      chosenBullets.push(bul);
    }
    if (countWords(candidateStr) >= 165 && chosenBullets.length >= 4) break;
  }

  let longPitch = [introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n').trim();
  if (countWords(longPitch) < 150) {
    const extraSentences = paragraphs
      .filter(p => !longPitch.toLowerCase().includes(p.toLowerCase().slice(0, 35)))
      .slice(0, 4);
    for (const ep of extraSentences) {
      if (countWords(longPitch) >= 155) break;
      const room = 195 - countWords(longPitch);
      if (room < 10) break;
      longPitch = `${longPitch}\n\n${trimToMaxWords(ep, Math.min(room, 40))}`.trim();
    }
    if (countWords(longPitch) < 150 && base.bodyCopy) {
      const bodySents = base.bodyCopy.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 30);
      const normLP = longPitch.toLowerCase().replace(/[:;,.!?•]+/g, ' ').replace(/\s+/g, ' ');
      const closingChunks: string[] = [];
      for (const s of bodySents) {
        const normS = s.toLowerCase().replace(/[:;,.!?•]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (normLP.includes(normS.slice(0, 30))) continue;
        const proj = countWords(`${longPitch}\n\n${closingChunks.concat(s).join(' ')}`);
        if (proj <= 196) closingChunks.push(s);
        if (proj >= 165) break;
      }
      if (closingChunks.length) longPitch = `${longPitch}\n\n${closingChunks.join(' ')}`.trim();
    }
  }
  if (countWords(longPitch) > 200) {
    while (chosenBullets.length > 3 && countWords([introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n')) > 200) {
      chosenBullets.pop();
    }
    longPitch = [introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n').trim();
    if (countWords(longPitch) > 200) {
      longPitch = longPitch
        .split('\n')
        .reduce((acc: string[], line: string) => {
          const cur = acc.join('\n');
          if (!line.trim()) { acc.push(line); return acc; }
          if (countWords(`${cur}\n${line}`) <= 200) { acc.push(line); return acc; }
          const rem = 200 - countWords(cur);
          if (rem >= 8) acc.push(trimToMaxWords(line, rem));
          return acc;
        }, [])
        .join('\n')
        .trim();
    }
  }
  if (!longPitch) longPitch = trimToMaxWords(base.bodyCopy, 195);

  return {
    name: resolvedName || undefined,
    tagline: tagline || undefined,
    shortPitch: shortPitch || undefined,
    shortPitches: shortPitches.length ? shortPitches : undefined,
    longPitch: longPitch || undefined,
    targetAudience: targetAudience || undefined,
    pricingSummary: pricingSummary || undefined,
    pricingModel: pricingModel || undefined,
    startingPrice: startingPrice || undefined,
    founderStory: founderStory || undefined,
    ogCoverUrl: base.ogCoverUrl || undefined,
    logoUrl: detectedLogoImg || base.ogCoverUrl || undefined,
    features: features.length ? features : undefined,
    benefits: benefits.length ? benefits : undefined,
    competitors: competitors.length ? competitors : undefined,
    links: Object.keys(links).length ? links : undefined,
    videos: Object.keys(videos).length ? videos : undefined,
    customLinks: customLinks.length ? customLinks : undefined,
    handles: Object.keys(handles).length ? handles : undefined,
    testimonials: testimonials.length ? testimonials : undefined,
  };
}

export function extractWebsiteCopyFromHtml(html: string, urlObj: URL): ScannedPageContext {
  const safeHtml = String(html || '').slice(0, 400000);
  const titleMatch = safeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const docTitle = stripTagsAndNormalize(titleMatch ? titleMatch[1] : '');
  const ogTitle = extractMetaContent(safeHtml, ['og:title', 'twitter:title']);
  const siteName = extractMetaContent(safeHtml, ['og:site_name', 'application-name']);
  const metaTitle = (docTitle || ogTitle || urlObj.hostname).slice(0, 240);
  const title = (ogTitle || docTitle || urlObj.hostname).slice(0, 240);
  const metaDescription = extractMetaContent(safeHtml, ['description', 'og:description', 'twitter:description']);
  const rawOgImage = extractMetaContent(safeHtml, ['og:image', 'twitter:image', 'og:image:url']);
  const ogCoverUrl = rawOgImage ? (resolveAbsoluteUrl(rawOgImage, urlObj.origin) || rawOgImage) : '';
  const twitter = extractMetaContent(safeHtml, ['twitter:site', 'twitter:creator']).replace(/^@/, '');
  const faviconUrl = extractFaviconUrl(safeHtml, urlObj);

  const h1Match = safeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = stripTagsAndNormalize(h1Match ? h1Match[1] : '');

  const headings: string[] = [];
  const seenHeadings = new Set<string>();
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRegex.exec(safeHtml)) !== null && headings.length < 12) {
    const text = stripTagsAndNormalize(hm[1]);
    if (text && text.length >= 3 && text.length <= 220 && !seenHeadings.has(text.toLowerCase())) {
      seenHeadings.add(text.toLowerCase());
      headings.push(text);
    }
  }

  const strippedForBody = safeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const heroSectionMatch =
    strippedForBody.match(/<(?:section|div|header)[^>]+(?:id|class)=["'][^"']*hero[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div|header)>/i) ||
    strippedForBody.match(/<main[^>]*>\s*<(?:section|div)[^>]*>([\s\S]*?)<\/(?:section|div)>/i) ||
    strippedForBody.match(/<section[^>]*>([\s\S]*?)<\/section>/i);

  const heroRaw = stripTagsAndNormalize(heroSectionMatch ? heroSectionMatch[1] : '');
  const heroHeadline = (h1Text || headings[0] || '').slice(0, 220);

  const ctaTexts: string[] = [];
  const seenCtas = new Set<string>();
  const ctaRegex = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = ctaRegex.exec(strippedForBody)) !== null && ctaTexts.length < 8) {
    const text = stripTagsAndNormalize(cm[1]);
    if (text && text.length >= 2 && text.length <= 60 && !seenCtas.has(text.toLowerCase())) {
      seenCtas.add(text.toLowerCase());
      ctaTexts.push(text);
    }
  }

  const mainMatch =
    strippedForBody.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    strippedForBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    strippedForBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const rawCopy = stripTagsAndNormalize(mainMatch ? mainMatch[1] : strippedForBody);
  const bodyCopy = rawCopy.slice(0, 3500);
  const heroFallback = heroHeadline && !bodyCopy.toLowerCase().startsWith(heroHeadline.toLowerCase().slice(0, 24))
    ? `${heroHeadline}. ${bodyCopy.slice(0, 600)}`
    : bodyCopy.slice(0, 600);
  const heroText = (heroRaw && heroRaw.length >= 20 ? heroRaw : heroFallback).trim().slice(0, 900);
  const cleanTitle = title.slice(0, 240);
  const cleanDesc = metaDescription.slice(0, 500);

  const brandProfile = extractRichBrandProfileFromHtml(safeHtml, urlObj, {
    siteName,
    title: cleanTitle,
    metaTitle,
    metaDescription: cleanDesc,
    heroHeadline,
    heroText,
    headings,
    bodyCopy,
    ogCoverUrl,
    twitter,
  });

  const resolvedLogoUrl = brandProfile.logoUrl || ogCoverUrl || '';

  return {
    sourceType: 'url',
    url: urlObj.href,
    domain: urlObj.hostname.replace(/^www\./, ''),
    title: cleanTitle,
    metaTitle,
    metaDescription: cleanDesc,
    description: cleanDesc,
    heroHeadline,
    heroText,
    headings,
    ctaTexts,
    bodyCopy,
    copy: bodyCopy,
    logoUrl: resolvedLogoUrl || undefined,
    ogCoverUrl: ogCoverUrl || undefined,
    faviconUrl: faviconUrl || undefined,
    twitter: brandProfile.handles?.twitter || twitter || undefined,
    brandProfile,
    scannedAt: new Date().toISOString(),
  };
}

async function readHtmlWithByteCap(resp: Response, maxBytes = 512 * 1024): Promise<string> {
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    const full = await resp.text();
    return full.slice(0, maxBytes);
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - totalBytes;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      totalBytes += slice.byteLength;
      if (totalBytes >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

export async function fetchWebsiteCopy(
  rawUrl: string
): Promise<{ success: true; context: ScannedPageContext } | { success: false; url: string; error: string }> {
  const urlObj = isPublicHttpUrl(rawUrl);
  if (!urlObj) {
    return { success: false, url: String(rawUrl || ''), error: 'Invalid or non-public HTTP/HTTPS URL.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(urlObj.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return { success: false, url: urlObj.href, error: `HTTP ${resp.status} while fetching website.` };
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
      return { success: false, url: urlObj.href, error: `Unsupported content type: ${contentType}` };
    }

    const html = await readHtmlWithByteCap(resp, 512 * 1024);
    const context = extractWebsiteCopyFromHtml(html, urlObj);
    return { success: true, context };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      success: false,
      url: urlObj.href,
      error: err?.name === 'AbortError' ? 'Website scan timed out.' : (err?.message || 'Failed to fetch website.'),
    };
  }
}

export function extractUrlsFromText(text: string): string[] {
  const input = String(text || '');
  const found: string[] = [];
  const seenDomains = new Set<string>();

  const pushCandidate = (candidate: string) => {
    const cleaned = candidate.replace(/[),.;:!?'"`]+$/g, '').trim();
    const parsed = isPublicHttpUrl(cleaned);
    if (!parsed) return;
    const key = `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
    if (!seenDomains.has(key) && found.length < 2) {
      seenDomains.add(key);
      found.push(parsed.href);
    }
  };

  const fullUrlRe = /https?:\/\/[^\s<>"'`]+/gi;
  let m: RegExpExecArray | null;
  while ((m = fullUrlRe.exec(input)) !== null) {
    pushCandidate(m[0]);
  }

  const bareDomainRe = /(^|[\s(])((?:[a-z0-9-]+\.)+(?:com|io|co|ai|app|org|net|dev|xyz|so|me|us|uk|ca|de|fr|in|tech|pro|gg|club|store|shop|site|online|blog|info|biz)(?:\/[^\s<>"'`]*)?)/gi;
  while ((m = bareDomainRe.exec(input)) !== null) {
    const startIdx = m.index + (m[1] ? m[1].length : 0);
    if (startIdx > 0 && input[startIdx - 1] === '@') continue;
    pushCandidate(m[2]);
  }

  return found;
}
