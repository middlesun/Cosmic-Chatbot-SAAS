import { corsHeaders, extractBearerToken, verifyBearerToken } from '../../lib/workspace-auth';
import { runResearchDiscovery } from '../../lib/research';

const RESEARCH_FEED_CACHE_TTL_MS = 10 * 60 * 1000;
const cfResearchFeedCache = new Map<string, { expiresAt: number; payload: any }>();

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    const auth = await verifyBearerToken(context.env, token);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error, threads: [] }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const body: any = await context.request.json().catch(() => ({}));
    const { keywords, competitorQueries, platforms, alertFeeds, quality, timeframe } = body || {};
    const validTimeframe = timeframe === '24h' || timeframe === 'week' || timeframe === 'month' || timeframe === 'all' ? timeframe : 'week';
    const validQuality = quality === 'all' ? 'all' : 'best';
    const normKeywords = Array.isArray(keywords) ? keywords : [];
    const normCompetitorQueries = Array.isArray(competitorQueries) ? competitorQueries : [];
    const normPlatforms = platforms && typeof platforms === 'object' ? platforms : {};
    const normAlertFeeds = Array.isArray(alertFeeds) ? alertFeeds : [];

    const cacheKey = JSON.stringify({
      keywords: normKeywords.map((k: any) => String(k || '').trim().toLowerCase()).sort(),
      competitorQueries: normCompetitorQueries.map((q: any) => String(q || '').trim().toLowerCase()).sort(),
      platforms: normPlatforms,
      alertFeeds: normAlertFeeds.map((f: any) => String(f?.url || f || '').trim()).sort(),
      quality: validQuality,
      timeframe: validTimeframe,
    });

    const cached = cfResearchFeedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(
        JSON.stringify({ ...cached.payload, cached: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' },
        }
      );
    }

    const result = await runResearchDiscovery({
      keywords: normKeywords,
      competitorQueries: normCompetitorQueries,
      platforms: normPlatforms,
      alertFeeds: normAlertFeeds,
      quality: validQuality,
      timeframe: validTimeframe,
    });

    const payload = { success: true, ...result };
    cfResearchFeedCache.set(cacheKey, {
      expiresAt: Date.now() + RESEARCH_FEED_CACHE_TTL_MS,
      payload,
    });
    if (cfResearchFeedCache.size > 150) {
      const oldestKey = cfResearchFeedCache.keys().next().value;
      if (oldestKey) cfResearchFeedCache.delete(oldestKey);
    }

    return new Response(
      JSON.stringify(payload),
      {
        status: 200,
        headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Feed fetch failed', threads: [] }),
      { status: 500, headers: corsHeaders }
    );
  }
}
