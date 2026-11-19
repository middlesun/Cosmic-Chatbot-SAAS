import { getSupabaseCreds, sanitizeBrandMediaPayloads } from './workspace-auth';

export function buildVaultCorsHeaders(request?: Request): Record<string, string> {
  const reqOrigin = request?.headers?.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': reqOrigin || '*',
    ...(reqOrigin ? { 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SP-Vault-Id',
    'Content-Type': 'application/json',
  };
}

export function getSupabaseRestContext(env: any, userToken?: string) {
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const configured = Boolean(url && (serviceKey || (anonKey && userToken)));
  const apiKey = serviceKey || anonKey;
  const authBearer = serviceKey || userToken || anonKey;
  return {
    url,
    anonKey,
    serviceKey,
    configured,
    baseHeaders: {
      apikey: apiKey,
      Authorization: `Bearer ${authBearer}`,
      'Content-Type': 'application/json',
    },
    upsertHeaders: {
      apikey: apiKey,
      Authorization: `Bearer ${authBearer}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
  };
}

async function parseErrorText(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    if (!raw) return `HTTP ${res.status} ${res.statusText}`;
    try {
      const json = JSON.parse(raw);
      return String(json?.message || json?.error || json?.hint || raw).slice(0, 300);
    } catch {
      return raw.slice(0, 300);
    }
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

export async function loadUserWorkspacePrefsCf(env: any, userId: string, userToken?: string) {
  const fallback = {
    user_id: userId,
    bookmarked_directory_ids: [] as string[],
    custom_directories: [] as any[],
    research_config: {} as Record<string, any>,
    updated_at: new Date().toISOString(),
  };

  const sb = getSupabaseRestContext(env, userToken);
  if (!sb.configured || !userId) return fallback;

  try {
    const res = await fetch(
      `${sb.url}/rest/v1/user_workspace_prefs?user_id=eq.${encodeURIComponent(userId)}&select=*`,
      { headers: sb.baseHeaders }
    );
    if (res.ok) {
      const rows: any = await res.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) {
        return {
          user_id: userId,
          bookmarked_directory_ids: Array.isArray(rows[0].bookmarked_directory_ids) ? rows[0].bookmarked_directory_ids : [],
          custom_directories: Array.isArray(rows[0].custom_directories) ? rows[0].custom_directories : [],
          research_config: rows[0].research_config && typeof rows[0].research_config === 'object' ? rows[0].research_config : {},
          updated_at: rows[0].updated_at || fallback.updated_at,
        };
      }
    }
  } catch {}
  return fallback;
}

const DEFAULT_RESEARCH_PLATFORMS_CF: Record<string, boolean> = {
  twitter: true,
  tiktok: false,
  youtube: true,
  instagram: false,
  facebook: false,
  threads: false,
  pinterest: false,
  linkedin: true,
  reddit: true,
  quora: true,
  medium: true,
  hackernews: true,
  web: true,
};

function toCfMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const ms = new Date(val).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function mergeResearchConfigCf(existingCfg: any, incomingCfg: any): Record<string, any> {
  const a = existingCfg && typeof existingCfg === 'object' ? existingCfg : {};
  const b = incomingCfg && typeof incomingCfg === 'object' ? incomingCfg : {};
  if (Object.keys(b).length === 0) return a;
  if (Object.keys(a).length === 0) return b;
  const aCid = String(a.campaignId || a._campaignId || '').trim();
  const bCid = String(b.campaignId || b._campaignId || '').trim();
  if (aCid && bCid && aCid !== bCid) {
    return b;
  }

  const aMs = toCfMs(a.updatedAt || a.lastPolledAt);
  const bMs = toCfMs(b.updatedAt || b.lastPolledAt);
  const newer = bMs >= aMs ? b : a;
  const older = bMs >= aMs ? a : b;

  const mergeTombstoneMap = (mapA: any, mapB: any, lowerKeys = false): Record<string, string> => {
    const out: Record<string, string> = {};
    [mapA, mapB].forEach((m) => {
      if (!m || typeof m !== 'object') return;
      Object.entries(m).forEach(([k, ts]) => {
        const clean = String(k || '').trim();
        const key = lowerKeys ? clean.toLowerCase() : clean;
        if (!key || !ts) return;
        if (!out[key] || toCfMs(ts) > toCfMs(out[key])) {
          out[key] = String(ts);
        }
      });
    });
    return out;
  };

  const deletedFeedUrls = mergeTombstoneMap(a.deletedFeedUrls, b.deletedFeedUrls, false);
  const deletedKeywords = mergeTombstoneMap(a.deletedKeywords, b.deletedKeywords, true);
  const deletedCompetitors = mergeTombstoneMap(a.deletedCompetitors, b.deletedCompetitors, true);
  const deletedSavedFeedIds = mergeTombstoneMap(a.deletedSavedFeedIds, b.deletedSavedFeedIds, false);

  const shouldKeepWithTombstone = (inA: boolean, inB: boolean, delMs: number) => {
    if (!delMs || delMs <= 0) return true;
    if (inA && aMs > delMs) return true;
    if (inB && bMs > delMs) return true;
    return false;
  };

  const genericTerms = new Set(['', 'google alert rss', 'custom alert rss']);
  const feedMap = new Map<string, any>();
  [
    ...(Array.isArray(older.alertFeeds) ? older.alertFeeds : []),
    ...(Array.isArray(newer.alertFeeds) ? newer.alertFeeds : []),
  ].forEach((rawFeed: any) => {
    if (!rawFeed || typeof rawFeed !== 'object') return;
    const url = String(rawFeed.url || '').trim();
    if (!url) return;
    const delMs = toCfMs(deletedFeedUrls[url]);
    const addedMs = toCfMs(rawFeed.addedAt);
    if (delMs > 0 && delMs >= addedMs) return;

    const existing = feedMap.get(url);
    if (!existing) {
      feedMap.set(url, {
        ...rawFeed,
        id: rawFeed.id || `gaf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url,
        term: String(rawFeed.term || 'Google Alert RSS').trim(),
        managedBySmartPoster: Boolean(rawFeed.managedBySmartPoster),
        signature: String(rawFeed.signature || ''),
        addedAt: rawFeed.addedAt || new Date().toISOString(),
      });
    } else {
      const exTerm = String(existing.term || '').trim();
      const nwTerm = String(rawFeed.term || '').trim();
      const exGeneric = genericTerms.has(exTerm.toLowerCase());
      const nwGeneric = genericTerms.has(nwTerm.toLowerCase());
      const chosenTerm = !nwGeneric && (exGeneric || nwTerm.length > exTerm.length) ? nwTerm : exTerm;
      const exAddMs = toCfMs(existing.addedAt);
      const nwAddMs = toCfMs(rawFeed.addedAt);
      const chosenAddedAt = nwAddMs > 0 && (exAddMs === 0 || nwAddMs < exAddMs) ? rawFeed.addedAt : existing.addedAt;
      feedMap.set(url, {
        ...existing,
        ...rawFeed,
        id: existing.id || rawFeed.id,
        url,
        term: chosenTerm || 'Google Alert RSS',
        managedBySmartPoster:
          rawFeed.managedBySmartPoster !== undefined
            ? Boolean(rawFeed.managedBySmartPoster)
            : Boolean(existing.managedBySmartPoster),
        signature: String(rawFeed.signature || existing.signature || ''),
        addedAt: chosenAddedAt,
      });
    }
  });

  const kwOrder: string[] = [];
  const kwSeen = new Set<string>();
  const aKwSet = new Set<string>();
  const bKwSet = new Set<string>();
  (Array.isArray(a.keywords) ? a.keywords : []).forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) aKwSet.add(clean.toLowerCase());
  });
  (Array.isArray(b.keywords) ? b.keywords : []).forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) bKwSet.add(clean.toLowerCase());
  });
  [...(Array.isArray(newer.keywords) ? newer.keywords : []), ...(Array.isArray(older.keywords) ? older.keywords : [])].forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (kwSeen.has(key)) return;
    const delMs = toCfMs(deletedKeywords[key]);
    if (!shouldKeepWithTombstone(aKwSet.has(key), bKwSet.has(key), delMs)) return;
    kwSeen.add(key);
    kwOrder.push(clean);
  });

  const compMap = new Map<string, any>();
  const aCompSet = new Set<string>();
  const bCompSet = new Set<string>();
  const normComp = (c: any) => {
    if (!c) return null;
    const name = String(typeof c === 'string' ? c : c.name || '').trim();
    if (!name) return null;
    const queries = Array.isArray(c.queries)
      ? c.queries.map((q: any) => ({ text: String(q?.text || '').trim(), enabled: q?.enabled !== false })).filter((q: any) => q.text)
      : [
          { text: `Alternative to ${name}`, enabled: true },
          { text: `Alternate to ${name}`, enabled: true },
          { text: `Best alternative to ${name}`, enabled: true },
          { text: `${name} vs`, enabled: true },
        ];
    return {
      id: typeof c === 'object' && c.id ? c.id : `comp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      queries,
      ...(typeof c === 'object' && c.orQuery ? { orQuery: String(c.orQuery).trim() } : {}),
      ...(typeof c === 'object' && c.mode ? { mode: String(c.mode) } : {}),
    };
  };
  (Array.isArray(a.competitors) ? a.competitors : []).forEach((c: any) => {
    const nc = normComp(c);
    if (nc) aCompSet.add(nc.name.toLowerCase());
  });
  (Array.isArray(b.competitors) ? b.competitors : []).forEach((c: any) => {
    const nc = normComp(c);
    if (nc) bCompSet.add(nc.name.toLowerCase());
  });
  [...(Array.isArray(newer.competitors) ? newer.competitors : []), ...(Array.isArray(older.competitors) ? older.competitors : [])].forEach((raw: any) => {
    const nc = normComp(raw);
    if (!nc) return;
    const key = nc.name.toLowerCase();
    const delMs = toCfMs(deletedCompetitors[key]);
    if (!shouldKeepWithTombstone(aCompSet.has(key), bCompSet.has(key), delMs)) return;
    if (!compMap.has(key)) {
      compMap.set(key, nc);
    } else {
      const existing = compMap.get(key);
      const qMap = new Map<string, any>();
      (existing.queries || []).forEach((q: any) => qMap.set(q.text.toLowerCase(), { ...q }));
      (nc.queries || []).forEach((q: any) => {
        const qk = q.text.toLowerCase();
        if (!qMap.has(qk)) qMap.set(qk, { ...q });
      });
      existing.queries = Array.from(qMap.values());
    }
  });

  const statusRank: Record<string, number> = { new: 1, dismissed: 2, queued: 3 };
  const threadMap = new Map<string, any>();
  [...(Array.isArray(a.discoveredThreads) ? a.discoveredThreads : []), ...(Array.isArray(b.discoveredThreads) ? b.discoveredThreads : [])].forEach((t: any) => {
    if (!t || typeof t !== 'object') return;
    const url = String(t.url || '').trim();
    if (!url) return;
    const existing = threadMap.get(url);
    const tStatus = t.status || 'new';
    if (!existing) {
      threadMap.set(url, { ...t, url, status: tStatus });
    } else {
      const exRank = statusRank[existing.status || 'new'] || 1;
      const tRank = statusRank[tStatus] || 1;
      const winnerStatus = tRank >= exRank ? tStatus : existing.status;
      const exTs = toCfMs(existing.publishedAt || existing.addedAt || existing.fetchedAt);
      const tTs = toCfMs(t.publishedAt || t.addedAt || t.fetchedAt);
      const base = tTs > exTs ? { ...existing, ...t } : { ...t, ...existing };
      threadMap.set(url, { ...base, url, id: existing.id || t.id, status: winnerStatus });
    }
  });
  const mergedThreads = Array.from(threadMap.values())
    .sort((x, y) => toCfMs(y.publishedAt || y.addedAt || y.fetchedAt) - toCfMs(x.publishedAt || x.addedAt || x.fetchedAt))
    .slice(0, 300);

  const savedFeedMap = new Map<string, any>();
  const normSavedFeedItems = (items: any[]) => {
    const out: any[] = [];
    const seenUrls = new Set<string>();
    (Array.isArray(items) ? items : []).forEach((it: any) => {
      if (!it || typeof it !== 'object') return;
      const url = String(it.url || '').trim();
      if (!url) return;
      const key = url.split('#')[0].replace(/\/+$/, '').toLowerCase();
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
      out.push({
        id: it.id || `sfi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: String(it.title || 'Saved Thread').trim(),
        url,
        platform: String(it.platform || 'web'),
        matchedTerm: String(it.matchedTerm || ''),
        publishedAt: it.publishedAt || '',
        source: String(it.source || ''),
        intentScore: typeof it.intentScore === 'number' ? it.intentScore : undefined,
        savedAt: it.savedAt || new Date().toISOString(),
      });
    });
    return out;
  };
  [
    { list: older.savedFeeds, cfgMs: bMs >= aMs ? aMs : bMs },
    { list: newer.savedFeeds, cfgMs: bMs >= aMs ? bMs : aMs },
  ].forEach(({ list, cfgMs }) => {
    (Array.isArray(list) ? list : []).forEach((rawSf: any) => {
      if (!rawSf || typeof rawSf !== 'object') return;
      const id = String(rawSf.id || '').trim();
      if (!id) return;
      const delMs = toCfMs(deletedSavedFeedIds[id]);
      const sfActivityMs = Math.max(toCfMs(rawSf.updatedAt), toCfMs(rawSf.createdAt)) || cfgMs;
      if (delMs > 0 && delMs >= sfActivityMs) return;

      const items = normSavedFeedItems(rawSf.items);
      const existing = savedFeedMap.get(id);
      if (!existing) {
        const createdAt = rawSf.createdAt || rawSf.updatedAt || new Date().toISOString();
        savedFeedMap.set(id, {
          ...rawSf,
          id,
          name: String(rawSf.name || 'Saved Feed').trim() || 'Saved Feed',
          items,
          createdAt,
          updatedAt: rawSf.updatedAt || createdAt,
        });
      } else {
        const mergedItems = normSavedFeedItems([...(existing.items || []), ...items]);
        const exUpMs = toCfMs(existing.updatedAt || existing.createdAt);
        const nwUpMs = toCfMs(rawSf.updatedAt || rawSf.createdAt);
        const winner = nwUpMs >= exUpMs ? rawSf : existing;
        const exCrMs = toCfMs(existing.createdAt);
        const nwCrMs = toCfMs(rawSf.createdAt);
        const createdAt = nwCrMs > 0 && (exCrMs === 0 || nwCrMs < exCrMs) ? rawSf.createdAt : existing.createdAt;
        savedFeedMap.set(id, {
          ...existing,
          ...rawSf,
          id,
          name: String(winner.name || existing.name || 'Saved Feed').trim() || 'Saved Feed',
          items: mergedItems,
          createdAt,
          updatedAt: nwUpMs >= exUpMs ? (rawSf.updatedAt || rawSf.createdAt) : existing.updatedAt,
        });
      }
    });
  });

  const normTimeframeVal = (tf: any) =>
    tf === '24h' || tf === 'week' || tf === 'month' || tf === 'all' ? tf : '';

  const aPollMs = toCfMs(a.lastPolledAt);
  const bPollMs = toCfMs(b.lastPolledAt);
  const lastPolledAt = bPollMs > aPollMs ? b.lastPolledAt : (a.lastPolledAt || b.lastPolledAt || null);
  const maxUpdatedMs = Math.max(aMs, bMs);
  const updatedAt = maxUpdatedMs > 0
    ? (bMs >= aMs ? (b.updatedAt || b.lastPolledAt) : (a.updatedAt || a.lastPolledAt))
    : null;
  const campaignId = bCid || aCid || undefined;

  return {
    ...(campaignId ? { campaignId } : {}),
    frequency: newer.frequency || older.frequency || 'daily',
    quality: newer.quality || older.quality || 'all',
    feedTimeframe: normTimeframeVal(newer.feedTimeframe) || normTimeframeVal(older.feedTimeframe) || 'week',
    platforms: {
      ...DEFAULT_RESEARCH_PLATFORMS_CF,
      ...(older.platforms || {}),
      ...(newer.platforms || {}),
    },
    keywords: kwOrder,
    competitors: Array.from(compMap.values()),
    alertFeeds: Array.from(feedMap.values()),
    discoveredThreads: mergedThreads,
    savedFeeds: Array.from(savedFeedMap.values()),
    deletedFeedUrls,
    deletedKeywords,
    deletedCompetitors,
    deletedSavedFeedIds,
    managedAlertSignature:
      newer.managedAlertSignature !== undefined
        ? String(newer.managedAlertSignature || '')
        : String(older.managedAlertSignature || ''),
    alertsActive: newer.alertsActive !== undefined ? newer.alertsActive !== false : older.alertsActive !== false,
    lastPolledAt: lastPolledAt || null,
    updatedAt: updatedAt || null,
  };
}

export async function saveUserWorkspacePrefsCf(
  env: any,
  userId: string,
  prefs: {
    bookmarked_directory_ids?: string[];
    custom_directories?: any[];
    research_config?: Record<string, any>;
    updated_at?: string;
  },
  userToken?: string
) {
  const existing = await loadUserWorkspacePrefsCf(env, userId, userToken);
  const record = {
    user_id: userId,
    bookmarked_directory_ids: Array.isArray(prefs.bookmarked_directory_ids)
      ? prefs.bookmarked_directory_ids
      : existing.bookmarked_directory_ids,
    custom_directories: Array.isArray(prefs.custom_directories)
      ? prefs.custom_directories
      : existing.custom_directories,
    research_config:
      prefs.research_config && typeof prefs.research_config === 'object'
        ? mergeResearchConfigCf(existing.research_config, prefs.research_config)
        : existing.research_config,
    updated_at: prefs.updated_at || new Date().toISOString(),
  };

  const sb = getSupabaseRestContext(env, userToken);
  if (!sb.configured) {
    throw new Error('Supabase is not configured on Cloudflare environment.');
  }

  const res = await fetch(`${sb.url}/rest/v1/user_workspace_prefs?on_conflict=user_id`, {
    method: 'POST',
    headers: sb.upsertHeaders,
    body: JSON.stringify([record]),
  });

  if (!res.ok) {
    const errMsg = await parseErrorText(res);
    throw new Error(`Failed to save workspace preferences: ${errMsg}`);
  }

  return record;
}

export async function loadUserCloudStateCf(env: any, userId: string, userToken?: string) {
  const sb = getSupabaseRestContext(env, userToken);
  if (!sb.configured || !userId) {
    return {
      source: 'unconfigured',
      brands: [],
      deletedBrandTombstones: {},
      userSettings: null,
      completedUrls: {},
      workspacePrefs: {
        user_id: userId,
        bookmarked_directory_ids: [],
        custom_directories: [],
        research_config: {},
        updated_at: new Date().toISOString(),
      },
      masterLogs: [],
      errorLogs: [],
    };
  }

  const [brandsRes, settingsRes, urlsRes, prefsRes, logsRes] = await Promise.all([
    fetch(`${sb.url}/rest/v1/brands?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers: sb.baseHeaders }),
    fetch(`${sb.url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers: sb.baseHeaders }),
    fetch(`${sb.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers: sb.baseHeaders }),
    fetch(`${sb.url}/rest/v1/user_workspace_prefs?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers: sb.baseHeaders }),
    fetch(`${sb.url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=300&select=*`, {
      headers: sb.baseHeaders,
    }),
  ]);

  const brands: any[] = [];
  const deletedBrandTombstones: Record<string, string> = {};
  if (brandsRes.ok) {
    const rows: any = await brandsRes.json().catch(() => []);
    (Array.isArray(rows) ? rows : []).forEach((row: any) => {
      if (row.deleted_at) {
        deletedBrandTombstones[row.id] = row.deleted_at;
        return;
      }
      const d = row.data || {};
      brands.push({
        ...d,
        brandId: row.id,
        campaignId: d.campaignId || row.id,
        brandName: row.name || d.brandName || d.campaignName || 'Brand',
        campaignName: d.campaignName || row.name || d.brandName || 'Brand',
        updatedAt: row.updated_at || d.updatedAt || new Date().toISOString(),
      });
    });
  }

  let userSettings: Record<string, any> | null = null;
  if (settingsRes.ok) {
    const rows: any = await settingsRes.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) {
      const s = { ...(rows[0].settings || {}) };
      delete s.__extensionVault;
      userSettings = {
        ...s,
        updatedAt: rows[0].updated_at || s.updatedAt || new Date().toISOString(),
      };
    }
  }

  const completedUrls: Record<string, any> = {};
  if (urlsRes.ok) {
    const rows: any = await urlsRes.json().catch(() => []);
    (Array.isArray(rows) ? rows : []).forEach((row: any) => {
      completedUrls[row.id] = {
        id: row.id,
        brandId: row.brand_id,
        brandName: row.brand_name,
        url: row.url,
        domain: row.domain,
        category: row.category,
        completedAt: row.completed_at,
      };
    });
  }

  let workspacePrefs: any = {
    user_id: userId,
    bookmarked_directory_ids: [],
    custom_directories: [],
    research_config: {},
    updated_at: new Date().toISOString(),
  };
  if (prefsRes.ok) {
    const rows: any = await prefsRes.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) {
      workspacePrefs = rows[0];
    }
  }

  const masterLogs: any[] = [];
  const errorLogs: any[] = [];
  if (logsRes.ok) {
    const rows: any = await logsRes.json().catch(() => []);
    (Array.isArray(rows) ? rows : []).forEach((row: any) => {
      const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
      if (row.status === 'error') {
        errorLogs.push({
          id: row.client_log_id || row.id,
          module: row.module || 'extension',
          url: row.target_url || '',
          domain: row.domain || '',
          message: row.error || row.content_snippet || 'Error',
          details: row.details || {},
          timestamp: ts,
        });
      } else {
        masterLogs.push({
          id: row.client_log_id || row.id,
          brandId: row.brand_id || undefined,
          module: row.module || 'contact',
          targetUrl: row.target_url || '',
          domain: row.domain || '',
          campaignName: row.campaign_name || 'Default',
          contentSnippet: row.content_snippet || '',
          status: row.status || 'success',
          statusCode: row.status_code ?? (row.status === 'success' ? 200 : 500),
          error: row.error || null,
          details: row.details || {},
          timestamp: ts,
        });
      }
    });
  }

  return {
    source: 'supabase',
    brands,
    deletedBrandTombstones,
    userSettings,
    completedUrls,
    workspacePrefs,
    masterLogs,
    errorLogs,
  };
}

async function upsertWithConflictFallback(
  endpointWithCompound: string,
  endpointWithSingle: string,
  headers: Record<string, string>,
  rows: any[]
): Promise<Response> {
  const res = await fetch(endpointWithCompound, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (res.ok) return res;

  // Retry on un-migrated schema missing composite unique constraint (Postgres 42P10)
  const txt = await res.clone().text().catch(() => '');
  if (txt.includes('42P10') || txt.includes('no unique or exclusion constraint')) {
    return fetch(endpointWithSingle, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows),
    });
  }
  return res;
}

export async function saveUserCloudStateCf(env: any, userId: string, payload: any, userToken?: string) {
  const nowIso = new Date().toISOString();
  const sb = getSupabaseRestContext(env, userToken);
  if (!sb.configured || !userId) {
    return { success: false, source: 'unconfigured', error: 'Supabase credentials not configured on Cloudflare.' };
  }

  const jobs: Array<{ label: string; promise: Promise<Response> }> = [];

  // 1. Brands + tombstones
  const brandRows: any[] = [];
  const safeBrands = Array.isArray(payload?.brands) ? sanitizeBrandMediaPayloads(payload.brands) : [];
  if (safeBrands.length > 0) {
    safeBrands.forEach((b: any) => {
      const id = String(b?.brandId || b?.campaignId || '').trim();
      if (!id) return;
      const name = String(b.campaignName || b.brandName || b.brandInfo?.name || 'Brand');
      const updatedAt = b.updatedAt || nowIso;
      brandRows.push({
        id,
        user_id: userId,
        name,
        data: { ...b, brandId: id, campaignId: b.campaignId || id, updatedAt },
        updated_at: updatedAt,
        deleted_at: b.deletedAt || null,
      });
    });
  }
  if (Array.isArray(payload?.deletedBrandIds)) {
    payload.deletedBrandIds.forEach((delId: any) => {
      const id = String(delId || '').trim();
      if (!id) return;
      brandRows.push({
        id,
        user_id: userId,
        name: 'Deleted Campaign',
        data: { brandId: id, deletedAt: nowIso, updatedAt: nowIso },
        updated_at: nowIso,
        deleted_at: nowIso,
      });
    });
  }
  if (brandRows.length > 0) {
    jobs.push({
      label: 'brands',
      promise: upsertWithConflictFallback(
        `${sb.url}/rest/v1/brands?on_conflict=user_id,id`,
        `${sb.url}/rest/v1/brands?on_conflict=id`,
        sb.upsertHeaders,
        brandRows
      ),
    });
  }

  // 2. User Settings (preserve __extensionVault if present in DB)
  if (payload?.userSettings && typeof payload.userSettings === 'object') {
    const updatedAt = payload.userSettings.updatedAt || nowIso;
    let existingVault: any = undefined;
    try {
      const curRes = await fetch(
        `${sb.url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&select=settings`,
        { headers: sb.baseHeaders }
      );
      if (curRes.ok) {
        const curRows: any = await curRes.json().catch(() => []);
        if (Array.isArray(curRows) && curRows[0]?.settings?.__extensionVault) {
          existingVault = curRows[0].settings.__extensionVault;
        }
      }
    } catch {}

    const nextSettings = {
      ...payload.userSettings,
      ...(existingVault ? { __extensionVault: existingVault } : {}),
      updatedAt,
    };
    jobs.push({
      label: 'user_settings',
      promise: fetch(`${sb.url}/rest/v1/user_settings?on_conflict=user_id`, {
        method: 'POST',
        headers: sb.upsertHeaders,
        body: JSON.stringify([{ user_id: userId, settings: nextSettings, updated_at: updatedAt }]),
      }),
    });
  }

  // 3. Completed URLs
  if (payload?.clearCompletedUrls) {
    jobs.push({
      label: 'completed_urls:clear',
      promise: fetch(`${sb.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: sb.baseHeaders,
      }),
    });
  } else if (Array.isArray(payload?.deletedCompletedIds) && payload.deletedCompletedIds.length > 0) {
    payload.deletedCompletedIds.forEach((delId: any) => {
      if (!delId) return;
      jobs.push({
        label: `completed_urls:delete:${delId}`,
        promise: fetch(
          `${sb.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(String(delId))}`,
          { method: 'DELETE', headers: sb.baseHeaders }
        ),
      });
    });
  }

  if (payload?.completedUrls && typeof payload.completedUrls === 'object' && !payload.clearCompletedUrls) {
    const urlRows = Object.entries(payload.completedUrls)
      .map(([k, item]: [string, any]) => {
        const rec = item || {};
        const id = String(rec.id || k || rec.url || rec.domain || '').trim();
        if (!id) return null;
        return {
          id: id.slice(0, 500),
          user_id: userId,
          brand_id: String(rec.brandId || 'brand-default'),
          brand_name: String(rec.brandName || 'Brand'),
          url: String(rec.url || ''),
          domain: String(rec.domain || ''),
          category: String(rec.category || 'outreach'),
          completed_at: rec.completedAt || nowIso,
        };
      })
      .filter(Boolean);
    if (urlRows.length > 0) {
      jobs.push({
        label: 'completed_urls',
        promise: fetch(`${sb.url}/rest/v1/completed_urls?on_conflict=user_id,id`, {
          method: 'POST',
          headers: sb.upsertHeaders,
          body: JSON.stringify(urlRows),
        }),
      });
    }
  }

  // 4. Workspace Prefs
  if (payload?.workspacePrefs && typeof payload.workspacePrefs === 'object') {
    const wp = payload.workspacePrefs;
    const existingPrefs = await loadUserWorkspacePrefsCf(env, userId, userToken).catch(() => null);
    const mergedResearchCfg = wp.research_config && typeof wp.research_config === 'object'
      ? mergeResearchConfigCf(existingPrefs?.research_config || {}, wp.research_config)
      : (existingPrefs?.research_config || {});
    jobs.push({
      label: 'user_workspace_prefs',
      promise: fetch(`${sb.url}/rest/v1/user_workspace_prefs?on_conflict=user_id`, {
        method: 'POST',
        headers: sb.upsertHeaders,
        body: JSON.stringify([
          {
            user_id: userId,
            bookmarked_directory_ids: Array.isArray(wp.bookmarked_directory_ids) ? wp.bookmarked_directory_ids : (existingPrefs?.bookmarked_directory_ids || []),
            custom_directories: Array.isArray(wp.custom_directories) ? wp.custom_directories : (existingPrefs?.custom_directories || []),
            research_config: mergedResearchCfg,
            updated_at: wp.updated_at || nowIso,
          },
        ]),
      }),
    });
  }

  // 5. Campaign Logs
  if (payload?.clearMasterLogs) {
    jobs.push({
      label: 'campaign_logs:clearMaster',
      promise: fetch(`${sb.url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&status=neq.error`, {
        method: 'DELETE',
        headers: sb.baseHeaders,
      }),
    });
  }
  if (payload?.clearErrorLogs) {
    jobs.push({
      label: 'campaign_logs:clearError',
      promise: fetch(`${sb.url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&status=eq.error`, {
        method: 'DELETE',
        headers: sb.baseHeaders,
      }),
    });
  }

  const logRows: any[] = [];
  const seenLogIds = new Set<string>();
  if (Array.isArray(payload?.masterLogs) && !payload.clearMasterLogs) {
    payload.masterLogs.slice(0, 200).forEach((l: any) => {
      if (!l) return;
      const clientId = String(l.id || `log_${l.timestamp || Date.now()}`);
      if (seenLogIds.has(clientId)) return;
      seenLogIds.add(clientId);
      logRows.push({
        user_id: userId,
        client_log_id: clientId,
        brand_id: l.brandId || null,
        module: String(l.module || 'contact'),
        target_url: String(l.targetUrl || l.url || l.domain || ''),
        domain: String(l.domain || ''),
        campaign_name: String(l.campaignName || 'Default'),
        content_snippet: String(l.contentSnippet || '').slice(0, 300),
        status: String(l.status || 'success'),
        status_code: Number.isFinite(Number(l.statusCode)) ? Number(l.statusCode) : null,
        error: l.error ? String(l.error).slice(0, 500) : null,
        details: l.details && typeof l.details === 'object' ? l.details : {},
        created_at: l.timestamp ? new Date(l.timestamp).toISOString() : nowIso,
      });
    });
  }
  if (Array.isArray(payload?.errorLogs) && !payload.clearErrorLogs) {
    payload.errorLogs.slice(0, 100).forEach((e: any) => {
      if (!e) return;
      const clientId = String(e.id || `err_${e.timestamp || Date.now()}`);
      if (seenLogIds.has(clientId)) return;
      seenLogIds.add(clientId);
      logRows.push({
        user_id: userId,
        client_log_id: clientId,
        brand_id: null,
        module: String(e.module || 'extension'),
        target_url: String(e.url || e.domain || ''),
        domain: String(e.domain || ''),
        campaign_name: '',
        content_snippet: String(e.message || 'Error').slice(0, 300),
        status: 'error',
        status_code: 500,
        error: String(e.message || 'Error').slice(0, 500),
        details: e.details && typeof e.details === 'object' ? e.details : {},
        created_at: e.timestamp ? new Date(e.timestamp).toISOString() : nowIso,
      });
    });
  }
  if (logRows.length > 0) {
    jobs.push({
      label: 'campaign_logs',
      promise: fetch(`${sb.url}/rest/v1/campaign_logs?on_conflict=user_id,client_log_id`, {
        method: 'POST',
        headers: sb.upsertHeaders,
        body: JSON.stringify(logRows),
      }),
    });
  }

  if (jobs.length === 0) {
    return { success: true, source: 'supabase', syncedAt: nowIso };
  }

  const results = await Promise.all(
    jobs.map(async (j) => {
      try {
        const res = await j.promise;
        if (!res.ok) {
          return { label: j.label, ok: false, error: await parseErrorText(res) };
        }
        return { label: j.label, ok: true, error: '' };
      } catch (err: any) {
        return { label: j.label, ok: false, error: err?.message || 'Network error' };
      }
    })
  );

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return {
      success: false,
      source: 'supabase',
      syncedAt: nowIso,
      error: failures.map((f) => `${f.label}: ${f.error}`).join('; '),
      failures,
    };
  }

  return { success: true, source: 'supabase', syncedAt: nowIso };
}
