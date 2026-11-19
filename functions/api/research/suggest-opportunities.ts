import { callUserGeminiRestCf, corsHeaders } from '../../lib/workspace-auth';
import { fetchWebsiteCopy, isPublicHttpUrl } from '../../lib/url-analyzer';
import { buildOpportunitySuggestionsFallback } from '../../lib/research';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function firstNonEmptyText(arr: any[]): string {
  if (!Array.isArray(arr)) return '';
  for (const item of arr) {
    const txt = String(typeof item === 'string' ? item : item?.text || '').trim();
    if (txt) return txt;
  }
  return '';
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const {
      brand = {},
      seedNiche = '',
      existingKeywords = [],
      existingCompetitors = [],
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
    } = body || {};

    const brandName = String(
      brand?.name || brand?.brandName || brand?.directory?.productName || ''
    ).trim();
    const rawBrandUrl = String(
      brand?.url ||
      brand?.website ||
      brand?.websiteUrl ||
      brand?.directory?.websiteUrl ||
      brand?.contact?.website ||
      brand?.directory?.demoUrl ||
      ''
    ).trim();
    const parsedBrandUrl = rawBrandUrl ? isPublicHttpUrl(rawBrandUrl) : null;
    const brandUrl = parsedBrandUrl ? parsedBrandUrl.href : rawBrandUrl;

    const brandTagline = String(
      brand?.tagline ||
      firstNonEmptyText(brand?.directory?.taglines) ||
      firstNonEmptyText(brand?.directory?.pitches) ||
      ''
    ).trim();
    const brandDescription = String(
      brand?.description ||
      brand?.pitch ||
      firstNonEmptyText(brand?.directory?.descriptions) ||
      firstNonEmptyText(brand?.directory?.summaries) ||
      firstNonEmptyText(brand?.contact?.messages) ||
      brand?.contact?.message ||
      ''
    ).trim();
    const brandCategory = String(brand?.category || brand?.directory?.category || '').trim();
    const cleanSeed = String(seedNiche || '').trim();

    let landing = {
      metaTitle: '',
      metaDescription: '',
      heroHeadline: '',
      heroText: '',
      headings: [] as string[],
      bodyCopy: '',
    };

    if (parsedBrandUrl && (!brandTagline || !brandDescription)) {
      try {
        const scanned = await fetchWebsiteCopy(parsedBrandUrl.href);
        if (scanned.success && scanned.context) {
          landing = {
            metaTitle: String(scanned.context.metaTitle || scanned.context.title || '').trim(),
            metaDescription: String(scanned.context.metaDescription || scanned.context.description || '').trim(),
            heroHeadline: String(scanned.context.heroHeadline || '').trim(),
            heroText: String(scanned.context.heroText || '').trim(),
            headings: Array.isArray(scanned.context.headings) ? scanned.context.headings.slice(0, 10) : [],
            bodyCopy: String(scanned.context.bodyCopy || '').trim(),
          };
        }
      } catch {}
    }

    const hasSignal = Boolean(
      brandName ||
      brandUrl ||
      brandTagline ||
      brandDescription ||
      cleanSeed ||
      landing.metaTitle ||
      landing.metaDescription
    );

    if (!hasSignal) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Add a Product Website URL, Description, or Niche Seed first so AI can discover keywords and competitors.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const existingKwSet = new Set(
      (Array.isArray(existingKeywords) ? existingKeywords : [])
        .map((k: any) => String(k || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const existingCompSet = new Set(
      (Array.isArray(existingCompetitors) ? existingCompetitors : [])
        .map((c: any) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const contextBrief = [
      `CAMPAIGN PROFILE:`,
      `- Product / Brand Name: ${brandName || 'N/A'}`,
      `- Website URL: ${brandUrl || 'N/A'}`,
      `- Category: ${brandCategory || 'N/A'}`,
      `- Tagline: ${brandTagline || 'N/A'}`,
      `- Description: ${brandDescription || 'N/A'}`,
      cleanSeed ? `- User Niche / Focus Seed: ${cleanSeed}` : '',
      ``,
      `WEBSITE CONTEXT:`,
      `- Meta Title: ${landing.metaTitle || 'N/A'}`,
      `- Meta Description: ${landing.metaDescription || 'N/A'}`,
      `- Hero Headline: ${landing.heroHeadline || 'N/A'}`,
      `- Hero Copy: ${landing.heroText || 'N/A'}`,
      `- Body Excerpt: ${landing.bodyCopy ? landing.bodyCopy.slice(0, 1600) : 'N/A'}`,
      existingKwSet.size ? `\nALREADY SAVED KEYWORDS (do not repeat): ${Array.from(existingKwSet).slice(0, 20).join(', ')}` : '',
      existingCompSet.size ? `\nALREADY SAVED COMPETITORS (do not repeat): ${Array.from(existingCompSet).slice(0, 15).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemInstruction = `You are a practical buyer-intent research strategist helping a founder find live discussions and Google Alert feeds where ideal customers ask for recommendations, compare alternatives, or talk about problems this product solves.

Generate:
1. nicheSummary: Short 3-7 word description of the niche/market.
2. keywords: 10 specific, high-intent search phrases (2-6 words each) that real buyers/users type or post on Reddit, X/Twitter, YouTube, and forums (e.g. pain points, "best tool for ...", "how to ...", tool category requests). Do NOT include quotes, boolean operators (no site: or OR), or the user's own brand name. Do NOT repeat already saved keywords.
3. competitors: 6 to 8 real, well-known competing products, direct alternatives, or popular websites/tools in this exact niche. Each item must have "name" (clean product/brand name only, never the user's own brand) and "reason" (concise 3-7 word explanation of why it competes or overlaps). Do NOT repeat already saved competitors.

Return strictly valid JSON matching the schema: { "nicheSummary": "...", "keywords": ["..."], "competitors": [{ "name": "...", "reason": "..." }] }.`;

    const effectiveOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    let parsed: any = null;
    let source = 'local-niche-synthesis';

    if (effectiveOrKey) {
      try {
        const orModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveOrKey}`,
            'HTTP-Referer': 'https://smartposter.pro',
            'X-Title': 'Smart Poster Opportunities Fetch',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: `${contextBrief}\n\nReturn ONLY JSON: { "nicheSummary": "...", "keywords": ["..."], "competitors": [{ "name": "...", "reason": "..." }] }`,
              },
            ],
            temperature: 0.6,
            max_tokens: 1400,
          }),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const raw = String(orData?.choices?.[0]?.message?.content || '').trim();
          const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const slice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(slice);
          if (candidate && typeof candidate === 'object') {
            parsed = candidate;
            source = `openrouter (${orModel})`;
          }
        }
      } catch {}
    }

    if (!parsed && userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRestCf({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction,
          prompt: `${contextBrief}\n\nGenerate niche keywords and competitors JSON now.`,
          temperature: 0.6,
          maxOutputTokens: 1600,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          const clean = gemRes.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const slice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(slice);
          if (candidate && typeof candidate === 'object') {
            parsed = candidate;
            source = `gemini (${gemRes.model})`;
          }
        }
      } catch {}
    }

    if (!parsed) {
      parsed = buildOpportunitySuggestionsFallback({
        brandName,
        brandUrl,
        brandTagline,
        brandDescription,
        brandCategory,
        seedNiche: cleanSeed,
        landingTitle: landing.metaTitle,
        landingDescription: landing.metaDescription,
      });
      source = 'local-niche-synthesis';
    }

    const brandLower = brandName.toLowerCase();
    const seenKw = new Set<string>(existingKwSet);
    const cleanKeywords: string[] = [];
    for (const rawKw of Array.isArray(parsed.keywords) ? parsed.keywords : []) {
      const kw = String(rawKw || '').replace(/^["'\s-]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
      const lower = kw.toLowerCase();
      if (!kw || kw.length < 3 || seenKw.has(lower)) continue;
      seenKw.add(lower);
      cleanKeywords.push(kw);
      if (cleanKeywords.length >= 12) break;
    }

    const seenComp = new Set<string>(existingCompSet);
    if (brandLower) seenComp.add(brandLower);
    const cleanCompetitors: Array<{ name: string; reason: string }> = [];
    for (const rawComp of Array.isArray(parsed.competitors) ? parsed.competitors : []) {
      const name = String(typeof rawComp === 'string' ? rawComp : rawComp?.name || '').replace(/\s+/g, ' ').trim();
      const reason = String(typeof rawComp === 'object' ? rawComp?.reason || '' : '').replace(/\s+/g, ' ').trim() || 'Niche competitor';
      const lower = name.toLowerCase();
      if (!name || name.length < 2 || seenComp.has(lower)) continue;
      seenComp.add(lower);
      cleanCompetitors.push({ name, reason });
      if (cleanCompetitors.length >= 8) break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        nicheSummary: String(parsed.nicheSummary || cleanSeed || brandCategory || brandName || 'Niche Opportunities').trim(),
        keywords: cleanKeywords,
        competitors: cleanCompetitors,
        source,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed to suggest niche opportunities' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
