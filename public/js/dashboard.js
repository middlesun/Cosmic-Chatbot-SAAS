// ============================================================================
// Smart Poster: Left-Hand User Dashboard Controller
// Handles 8 Views, Live Chrome Extension Bridge, Supabase Workspace Sync,
// Automated Competitor & Keyword Research Alerts, and Directories Table.
// ============================================================================

const state = {
  activeSection: 'account',
  activeContentSubtab: 'product',
  activeOpportunitiesSubtab: 'keywords',
  galleryCategoryFilter: 'all',
  galleryUploadCategory: 'marketing',
  socialPostPlatformFilter: 'all',
  supportActiveView: 'faqs',
  supportSearchQuery: '',
  supportCategoryFilter: 'all',
  articleAutoPreset: 'problem-solution',
  articleAutoKeyword: '',
  user: null,
  session: null,
  entitlement: null,
  isPro: false,
  isStudio: false,
  isUnlimited: false,
  storageUsedBytes: 0,
  storageLimitBytes: 15 * 1024 * 1024,
  extInstalled: false,
  extVersion: '',
  brandProfiles: [],
  activeBrandId: '',
  adminDirectories: [],
  directoriesPreview: false,
  directoriesTotalCount: 0,
  directoryPrefs: {
    bookmarkedIds: [],
    customDirectories: [],
  },
  dirTagFilter: 'all',
  dirBookmarkedOnly: false,
  dirSort: 'dr-desc',
  releases: [],
  changelog: [],
  changelogFilter: 'all',
  reportsFilter: 'all',
  masterLogs: [],
  errorLogs: [],
  suppressionList: [],
  completedUrls: {},
  ruleTwitterStripProtocol: true,
  deletedBrandTombstones: {},
  settings: {
    formActionMode: 'fill-only',
    slowMode: false,
    financialDetection: true,
    customModels: [],
    jevEnabled: false,
    jevModel: 'typesafe/jev-1.14',
    captchaApiKey: '',
    safetyDelay: 3,
    randomnessLevel: 3,
    sp_randomness_v2_migrated: true,
    randomnessSynonyms: true,
    randomnessDicts: `(app | tool | platform | software | utility)\n(founders | builders | creators | entrepreneurs | developers)\n(great | awesome | solid | fantastic | incredible)\n(quick | fast | rapid | instant)\n(laptop | mac | desktop | computer)`,
    companionWidgetEnabled: true,
    companionShortcutsEnabled: true,
    aiContextMatching: true,
    simulateKeystrokes: false,
    autoVariation: false,
    autoSuppress: true,
    updatedAt: null,
  },
  apiKey: '',
  geminiApiKey: '',
  aiModel: 'anthropic/claude-3.5-haiku',
  commentsSubMode: 'saved',
  autoCommentsFilter: 'organic',
  autoCommentsTopic: '',
  autoCommentsSuggestions: { organic: [], promo: [] },
  autoCommentsLoading: false,
  autoThreadSuggestions: true,
  commentsMgmtTagFilter: 'all',
  commentsSort: 'default',
  selectedCommentIds: new Set(),
  openDashboardTagPopoverId: null,
  renamingCampaignTag: '',
  bulkTagTarget: '',
  researchConfig: {
    frequency: 'realtime',
    quality: 'all',
    feedTimeframe: 'week',
    platforms: {
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
    },
    keywords: [],
    competitors: [],
    alertFeeds: [],
    discoveredThreads: [],
    savedFeeds: [],
    deletedFeedUrls: {},
    deletedKeywords: {},
    deletedCompetitors: {},
    deletedSavedFeedIds: {},
    managedAlertSignature: '',
    alertsActive: true,
    lastPolledAt: null,
    updatedAt: null,
  },
};

let isApplyingRemoteCloudState = false;
let cloudStateSaveTimer = null;
let pendingCloudPatch = null;

function toMsTimestamp(isoOrNum) {
  if (!isoOrNum) return 0;
  if (typeof isoOrNum === 'number') return Number.isFinite(isoOrNum) ? isoOrNum : 0;
  const ms = new Date(isoOrNum).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

const DEFAULT_RESEARCH_PLATFORMS = {
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

function normalizeResearchTimeframe(raw) {
  return raw === '24h' || raw === 'week' || raw === 'month' || raw === 'all' ? raw : 'week';
}

function normalizeContactFormSearchMode(mode) {
  const clean = String(mode || '').trim().toLowerCase();
  if (clean === 'max' || clean === 'strict' || clean === 'wide') return clean;
  return 'wide';
}

function createDefaultResearchConfig(overrides = {}) {
  const base = {
    frequency: 'realtime',
    quality: 'all',
    feedTimeframe: 'week',
    platforms: { ...DEFAULT_RESEARCH_PLATFORMS },
    keywords: [],
    competitors: [],
    contactFormSearchMode: 'wide',
    contactFormSearches: [],
    alertFeeds: [],
    discoveredThreads: [],
    savedFeeds: [],
    deletedFeedUrls: {},
    deletedKeywords: {},
    deletedCompetitors: {},
    deletedContactFormSearchKeys: {},
    deletedSavedFeedIds: {},
    managedAlertSignature: '',
    alertsActive: true,
    lastPolledAt: null,
    updatedAt: null,
  };
  if (!overrides || typeof overrides !== 'object') return base;
  return {
    ...base,
    ...overrides,
    feedTimeframe: normalizeResearchTimeframe(overrides.feedTimeframe),
    platforms: { ...DEFAULT_RESEARCH_PLATFORMS, ...(overrides.platforms || {}) },
    keywords: Array.isArray(overrides.keywords) ? [...overrides.keywords] : [],
    competitors: Array.isArray(overrides.competitors) ? JSON.parse(JSON.stringify(overrides.competitors)) : [],
    contactFormSearchMode: normalizeContactFormSearchMode(overrides.contactFormSearchMode),
    contactFormSearches: Array.isArray(overrides.contactFormSearches) ? JSON.parse(JSON.stringify(overrides.contactFormSearches)) : [],
    alertFeeds: Array.isArray(overrides.alertFeeds) ? JSON.parse(JSON.stringify(overrides.alertFeeds)) : [],
    discoveredThreads: Array.isArray(overrides.discoveredThreads) ? JSON.parse(JSON.stringify(overrides.discoveredThreads)) : [],
    savedFeeds: Array.isArray(overrides.savedFeeds) ? JSON.parse(JSON.stringify(overrides.savedFeeds)) : [],
    deletedFeedUrls: overrides.deletedFeedUrls && typeof overrides.deletedFeedUrls === 'object' ? { ...overrides.deletedFeedUrls } : {},
    deletedKeywords: overrides.deletedKeywords && typeof overrides.deletedKeywords === 'object' ? { ...overrides.deletedKeywords } : {},
    deletedCompetitors: overrides.deletedCompetitors && typeof overrides.deletedCompetitors === 'object' ? { ...overrides.deletedCompetitors } : {},
    deletedContactFormSearchKeys: overrides.deletedContactFormSearchKeys && typeof overrides.deletedContactFormSearchKeys === 'object' ? { ...overrides.deletedContactFormSearchKeys } : {},
    deletedSavedFeedIds: overrides.deletedSavedFeedIds && typeof overrides.deletedSavedFeedIds === 'object' ? { ...overrides.deletedSavedFeedIds } : {},
    managedAlertSignature: String(overrides.managedAlertSignature || ''),
  };
}

function hasResearchConfigData(rc) {
  if (!rc || typeof rc !== 'object') return false;
  return (
    (Array.isArray(rc.keywords) && rc.keywords.length > 0) ||
    (Array.isArray(rc.competitors) && rc.competitors.length > 0) ||
    (Array.isArray(rc.contactFormSearches) && rc.contactFormSearches.length > 0) ||
    (Array.isArray(rc.alertFeeds) && rc.alertFeeds.length > 0) ||
    (Array.isArray(rc.discoveredThreads) && rc.discoveredThreads.length > 0) ||
    (Array.isArray(rc.savedFeeds) && rc.savedFeeds.length > 0) ||
    Boolean(rc.lastPolledAt)
  );
}

function mergeResearchConfig(localCfg, remoteCfg) {
  const a = localCfg && typeof localCfg === 'object' ? localCfg : {};
  const b = remoteCfg && typeof remoteCfg === 'object' ? remoteCfg : {};
  const aMs = toMsTimestamp(a.updatedAt || a.lastPolledAt);
  const bMs = toMsTimestamp(b.updatedAt || b.lastPolledAt);
  const newer = bMs > aMs ? b : a;
  const older = bMs > aMs ? a : b;

  const mergeTombstoneMap = (mapA, mapB, lowerKeys = false) => {
    const out = {};
    [mapA, mapB].forEach((m) => {
      if (!m || typeof m !== 'object') return;
      Object.entries(m).forEach(([k, ts]) => {
        const clean = String(k || '').trim();
        const key = lowerKeys ? clean.toLowerCase() : clean;
        if (!key || !ts) return;
        if (!out[key] || toMsTimestamp(ts) > toMsTimestamp(out[key])) {
          out[key] = ts;
        }
      });
    });
    return out;
  };

  const deletedFeedUrls = mergeTombstoneMap(a.deletedFeedUrls, b.deletedFeedUrls, false);
  const deletedKeywords = mergeTombstoneMap(a.deletedKeywords, b.deletedKeywords, true);
  const deletedCompetitors = mergeTombstoneMap(a.deletedCompetitors, b.deletedCompetitors, true);
  const deletedContactFormSearchKeys = mergeTombstoneMap(a.deletedContactFormSearchKeys, b.deletedContactFormSearchKeys, true);
  const deletedSavedFeedIds = mergeTombstoneMap(a.deletedSavedFeedIds, b.deletedSavedFeedIds, false);

  const shouldKeepWithTombstone = (inA, inB, delMs) => {
    if (!delMs || delMs <= 0) return true;
    if (inA && aMs > delMs) return true;
    if (inB && bMs > delMs) return true;
    return false;
  };

  // Merge alertFeeds by trimmed URL
  const genericTerms = new Set(['', 'google alert rss', 'custom alert rss']);
  const feedMap = new Map();
  [
    ...(Array.isArray(older.alertFeeds) ? older.alertFeeds : []),
    ...(Array.isArray(newer.alertFeeds) ? newer.alertFeeds : []),
  ].forEach((rawFeed) => {
    if (!rawFeed || typeof rawFeed !== 'object') return;
    const url = String(rawFeed.url || '').trim();
    if (!url) return;
    const delMs = toMsTimestamp(deletedFeedUrls[url]);
    const addedMs = toMsTimestamp(rawFeed.addedAt);
    if (delMs > 0 && delMs >= addedMs) return;

    const existing = feedMap.get(url);
    if (!existing) {
      feedMap.set(url, {
        ...rawFeed,
        id: rawFeed.id || 'gaf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
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
      const chosenTerm = (!nwGeneric && (exGeneric || nwTerm.length > exTerm.length)) ? nwTerm : exTerm;
      const exAddMs = toMsTimestamp(existing.addedAt);
      const nwAddMs = toMsTimestamp(rawFeed.addedAt);
      const chosenAddedAt = (nwAddMs > 0 && (exAddMs === 0 || nwAddMs < exAddMs)) ? rawFeed.addedAt : existing.addedAt;
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

  // Merge keywords (case-insensitive union)
  const kwOrder = [];
  const kwMap = new Map();
  const aKwSet = new Set();
  const bKwSet = new Set();
  (Array.isArray(a.keywords) ? a.keywords : []).forEach((k) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) aKwSet.add(clean.toLowerCase());
  });
  (Array.isArray(b.keywords) ? b.keywords : []).forEach((k) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) bKwSet.add(clean.toLowerCase());
  });
  [...(Array.isArray(newer.keywords) ? newer.keywords : []), ...(Array.isArray(older.keywords) ? older.keywords : [])].forEach((k) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (kwMap.has(key)) return;
    const delMs = toMsTimestamp(deletedKeywords[key]);
    if (!shouldKeepWithTombstone(aKwSet.has(key), bKwSet.has(key), delMs)) return;
    kwMap.set(key, clean);
    kwOrder.push(clean);
  });

  // Merge competitors by lowercase name
  const compMap = new Map();
  const aCompSet = new Set();
  const bCompSet = new Set();
  const normComp = (c) => {
    if (!c) return null;
    const name = String(typeof c === 'string' ? c : c.name || '').trim();
    if (!name) return null;
    const queries = Array.isArray(c.queries)
      ? c.queries.map((q) => ({ text: String(q?.text || '').trim(), enabled: q?.enabled !== false })).filter((q) => q.text)
      : buildCompetitorCombinations(name);
    return {
      id: (typeof c === 'object' && c.id) ? c.id : 'comp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      queries,
      ...(typeof c === 'object' && c.orQuery ? { orQuery: String(c.orQuery).trim() } : {}),
      ...(typeof c === 'object' && c.mode ? { mode: String(c.mode) } : {}),
      ...(typeof c === 'object' && (c.starred || c.bookmarked) ? { starred: true } : {}),
    };
  };
  (Array.isArray(a.competitors) ? a.competitors : []).forEach((c) => {
    const nc = normComp(c);
    if (nc) aCompSet.add(nc.name.toLowerCase());
  });
  (Array.isArray(b.competitors) ? b.competitors : []).forEach((c) => {
    const nc = normComp(c);
    if (nc) bCompSet.add(nc.name.toLowerCase());
  });
  [...(Array.isArray(newer.competitors) ? newer.competitors : []), ...(Array.isArray(older.competitors) ? older.competitors : [])].forEach((raw) => {
    const nc = normComp(raw);
    if (!nc) return;
    const key = nc.name.toLowerCase();
    const delMs = toMsTimestamp(deletedCompetitors[key]);
    if (!shouldKeepWithTombstone(aCompSet.has(key), bCompSet.has(key), delMs)) return;
    if (!compMap.has(key)) {
      compMap.set(key, nc);
    } else {
      const existing = compMap.get(key);
      const qMap = new Map();
      (existing.queries || []).forEach((q) => qMap.set(q.text.toLowerCase(), { ...q }));
      (nc.queries || []).forEach((q) => {
        const qk = q.text.toLowerCase();
        if (!qMap.has(qk)) qMap.set(qk, { ...q });
      });
      existing.queries = Array.from(qMap.values());
    }
  });

  // Merge discoveredThreads (status priority queued > dismissed > new, sorted newest-first, cap 300)
  const statusRank = { new: 1, dismissed: 2, queued: 3 };
  const threadMap = new Map();
  [...(Array.isArray(a.discoveredThreads) ? a.discoveredThreads : []), ...(Array.isArray(b.discoveredThreads) ? b.discoveredThreads : [])].forEach((t) => {
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
      const exTs = toMsTimestamp(existing.publishedAt || existing.addedAt || existing.fetchedAt);
      const tTs = toMsTimestamp(t.publishedAt || t.addedAt || t.fetchedAt);
      const base = tTs > exTs ? { ...existing, ...t } : { ...t, ...existing };
      threadMap.set(url, { ...base, url, id: existing.id || t.id, status: winnerStatus });
    }
  });
  const mergedThreads = Array.from(threadMap.values())
    .sort((x, y) => toMsTimestamp(y.publishedAt || y.addedAt || y.fetchedAt) - toMsTimestamp(x.publishedAt || x.addedAt || x.fetchedAt))
    .slice(0, 300);

  // Merge savedFeeds by ID with deletedSavedFeedIds tombstones
  const savedFeedMap = new Map();
  const normSavedFeedItems = (items) => {
    const out = [];
    const seenUrls = new Set();
    (Array.isArray(items) ? items : []).forEach((it) => {
      if (!it || typeof it !== 'object') return;
      const url = String(it.url || '').trim();
      if (!url) return;
      const key = url.split('#')[0].replace(/\/+$/, '').toLowerCase();
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
      out.push({
        id: it.id || 'sfi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
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
  const olderMs = bMs > aMs ? aMs : bMs;
  const newerMs = bMs > aMs ? bMs : aMs;
  [
    { list: older.savedFeeds, cfgMs: olderMs },
    { list: newer.savedFeeds, cfgMs: newerMs },
  ].forEach(({ list, cfgMs }) => {
    (Array.isArray(list) ? list : []).forEach((rawSf) => {
      if (!rawSf || typeof rawSf !== 'object') return;
      const id = String(rawSf.id || '').trim();
      if (!id) return;
      const delMs = toMsTimestamp(deletedSavedFeedIds[id]);
      const sfActivityMs = Math.max(toMsTimestamp(rawSf.updatedAt), toMsTimestamp(rawSf.createdAt)) || cfgMs;
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
        const exUpMs = toMsTimestamp(existing.updatedAt || existing.createdAt);
        const nwUpMs = toMsTimestamp(rawSf.updatedAt || rawSf.createdAt);
        const winner = nwUpMs >= exUpMs ? rawSf : existing;
        const exCrMs = toMsTimestamp(existing.createdAt);
        const nwCrMs = toMsTimestamp(rawSf.createdAt);
        const createdAt = (nwCrMs > 0 && (exCrMs === 0 || nwCrMs < exCrMs)) ? rawSf.createdAt : existing.createdAt;
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

  const normTf = (tf) => (tf === '24h' || tf === 'week' || tf === 'month' || tf === 'all' ? tf : '');

  const aPollMs = toMsTimestamp(a.lastPolledAt);
  const bPollMs = toMsTimestamp(b.lastPolledAt);
  const lastPolledAt = bPollMs > aPollMs ? b.lastPolledAt : (a.lastPolledAt || b.lastPolledAt || null);
  const maxUpdatedMs = Math.max(aMs, bMs);
  const updatedAt = maxUpdatedMs > 0
    ? (bMs >= aMs ? (b.updatedAt || b.lastPolledAt) : (a.updatedAt || a.lastPolledAt))
    : null;

  const resolvedCfMode = normalizeContactFormSearchMode(newer.contactFormSearchMode || older.contactFormSearchMode);
  const cfMap = new Map();
  const aCfSet = new Set();
  const bCfSet = new Set();
  const normCf = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const keyword = String(entry.keyword || '').replace(/"/g, '').trim();
    if (!keyword) return null;
    const location = String(entry.location || '').replace(/"/g, '').trim();
    const key = `${keyword.toLowerCase()}||${location.toLowerCase()}`;
    const query = buildContactFormSearchQuery(keyword, location, resolvedCfMode);
    return {
      id: String(entry.id || `cfk-${key.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`),
      keyword,
      location,
      query,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
  };
  (Array.isArray(a.contactFormSearches) ? a.contactFormSearches : []).forEach((it) => {
    const n = normCf(it);
    if (n) aCfSet.add(`${n.keyword.toLowerCase()}||${n.location.toLowerCase()}`);
  });
  (Array.isArray(b.contactFormSearches) ? b.contactFormSearches : []).forEach((it) => {
    const n = normCf(it);
    if (n) bCfSet.add(`${n.keyword.toLowerCase()}||${n.location.toLowerCase()}`);
  });
  [...(Array.isArray(newer.contactFormSearches) ? newer.contactFormSearches : []), ...(Array.isArray(older.contactFormSearches) ? older.contactFormSearches : [])].forEach((raw) => {
    const n = normCf(raw);
    if (!n) return;
    const key = `${n.keyword.toLowerCase()}||${n.location.toLowerCase()}`;
    if (cfMap.has(key)) return;
    const delMs = toMsTimestamp(deletedContactFormSearchKeys[key]);
    if (!shouldKeepWithTombstone(aCfSet.has(key), bCfSet.has(key), delMs)) return;
    cfMap.set(key, n);
  });

  return {
    frequency: newer.frequency || older.frequency || 'realtime',
    quality: newer.quality || older.quality || 'all',
    feedTimeframe: normTf(newer.feedTimeframe) || normTf(older.feedTimeframe) || 'week',
    platforms: {
      ...DEFAULT_RESEARCH_PLATFORMS,
      ...(older.platforms || {}),
      ...(newer.platforms || {}),
    },
    keywords: kwOrder,
    competitors: Array.from(compMap.values()),
    contactFormSearchMode: resolvedCfMode,
    contactFormSearches: Array.from(cfMap.values()),
    alertFeeds: Array.from(feedMap.values()),
    discoveredThreads: mergedThreads,
    savedFeeds: Array.from(savedFeedMap.values()),
    deletedFeedUrls,
    deletedKeywords,
    deletedCompetitors,
    deletedContactFormSearchKeys,
    deletedSavedFeedIds,
    managedAlertSignature:
      newer.managedAlertSignature !== undefined
        ? String(newer.managedAlertSignature || '')
        : String(older.managedAlertSignature || ''),
    alertsActive: newer.alertsActive !== undefined ? newer.alertsActive !== false : (older.alertsActive !== false),
    lastPolledAt: lastPolledAt || null,
    updatedAt: updatedAt || null,
  };
}

function mergeNestedRecordSafe(loserObj, winnerObj) {
  if (!loserObj || typeof loserObj !== 'object') return winnerObj;
  if (!winnerObj || typeof winnerObj !== 'object') return loserObj;
  const out = { ...loserObj, ...winnerObj };
  Object.keys(loserObj).forEach((k) => {
    const lv = loserObj[k];
    const wv = winnerObj[k];
    if (wv === undefined || wv === null) {
      out[k] = lv;
    } else if (Array.isArray(lv) && Array.isArray(wv) && wv.length === 0 && lv.length > 0 && winnerObj[k] === undefined) {
      out[k] = lv;
    } else if (typeof lv === 'string' && lv.trim() && typeof wv === 'string' && !wv.trim() && !(k in winnerObj)) {
      out[k] = lv;
    }
  });
  return out;
}

function mergeBrandRecords(existingBrand, incomingBrand) {
  if (!existingBrand) return incomingBrand;
  if (!incomingBrand) return existingBrand;
  const exMs = toMsTimestamp(existingBrand.updatedAt);
  const inMs = toMsTimestamp(incomingBrand.updatedAt);
  const incomingWins = inMs >= exMs;
  const winner = incomingWins ? incomingBrand : existingBrand;
  const loser = incomingWins ? existingBrand : incomingBrand;
  const equalOrMissingTimestamp = exMs === 0 || inMs === 0 || exMs === inMs;

  const mergedRc = mergeResearchConfig(existingBrand.researchConfig, incomingBrand.researchConfig);
  const maxMs = Math.max(exMs, inMs, toMsTimestamp(mergedRc?.updatedAt));

  const merged = { ...loser, ...winner };
  ['brandInfo', 'brandAssets', 'directory', 'contact', 'social', 'support', 'autopilot', 'postingRules', 'customData', 'safeDomain'].forEach((sectionKey) => {
    if (loser[sectionKey] || winner[sectionKey]) {
      merged[sectionKey] = mergeNestedRecordSafe(loser[sectionKey], winner[sectionKey]);
    }
  });

  if (loser.support || winner.support) {
    const lSup = loser.support || {};
    const wSup = winner.support || {};
    const sup = { ...(merged.support || {}) };
    ['faqs', 'macros'].forEach((sKey) => {
      const wArr = Array.isArray(wSup[sKey]) ? wSup[sKey] : null;
      const lArr = Array.isArray(lSup[sKey]) ? lSup[sKey] : null;
      if (!wArr && lArr) sup[sKey] = lArr;
      else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) sup[sKey] = lArr;
    });
    merged.support = sup;
  }

  if (loser.brandAssets || winner.brandAssets) {
    const lBa = loser.brandAssets || {};
    const wBa = winner.brandAssets || {};
    const ba = { ...(merged.brandAssets || {}) };
    ['links', 'videos', 'handles', 'proof', 'tone', 'mediaRoles'].forEach((subKey) => {
      if (lBa[subKey] || wBa[subKey]) {
        ba[subKey] = mergeNestedRecordSafe(lBa[subKey], wBa[subKey]);
      }
    });
    ['features', 'benefits', 'competitors', 'galleryCategories', 'customLinks', 'customSections', 'shortPitches'].forEach((arrKey) => {
      const wArr = Array.isArray(wBa[arrKey]) ? wBa[arrKey] : null;
      const lArr = Array.isArray(lBa[arrKey]) ? lBa[arrKey] : null;
      if (!wArr && lArr) ba[arrKey] = lArr;
      else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) ba[arrKey] = lArr;
    });
    if (lBa.proof || wBa.proof) {
      ba.proof = { ...(ba.proof || {}) };
      ['testimonials'].forEach((pKey) => {
        const wArr = Array.isArray(wBa.proof?.[pKey]) ? wBa.proof[pKey] : null;
        const lArr = Array.isArray(lBa.proof?.[pKey]) ? lBa.proof[pKey] : null;
        if (!wArr && lArr) ba.proof[pKey] = lArr;
        else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) ba.proof[pKey] = lArr;
      });
    }
    merged.brandAssets = ba;
  }

  ['emails', 'dms', 'articles', 'socialPosts', 'savedKeywordStacks', 'keywords', 'savedUrlSets', 'gallery', 'suppressionList'].forEach((arrKey) => {
    const wArr = Array.isArray(winner[arrKey]) ? winner[arrKey] : null;
    const lArr = Array.isArray(loser[arrKey]) ? loser[arrKey] : null;
    if (!wArr && lArr) {
      merged[arrKey] = lArr;
    } else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) {
      merged[arrKey] = lArr;
    }
  });

  const wComments = Array.isArray(winner.social?.comments) ? winner.social.comments : (Array.isArray(winner.comments) ? winner.comments : null);
  const lComments = Array.isArray(loser.social?.comments) ? loser.social.comments : (Array.isArray(loser.comments) ? loser.comments : null);
  if ((!wComments || (equalOrMissingTimestamp && wComments.length === 0)) && lComments && lComments.length > 0) {
    merged.social = { ...(merged.social || {}), comments: lComments };
    merged.comments = lComments;
  } else if (wComments) {
    merged.social = { ...(merged.social || {}), comments: wComments };
  }

  const inUseTags = [];
  (Array.isArray(merged.social?.comments) ? merged.social.comments : []).forEach((c) => {
    if (c && typeof c === 'object' && Array.isArray(c.tags)) {
      c.tags.forEach((t) => inUseTags.push(t));
    }
  });
  merged.commentTags = mergeCommentTagLists(loser.commentTags, winner.commentTags, equalOrMissingTimestamp, inUseTags);
  merged.activeCommentPool = String(winner.activeCommentPool || loser.activeCommentPool || 'all').trim() || 'all';

  ['taglines', 'pitches', 'summaries', 'descriptions', 'slides'].forEach((dirArrKey) => {
    const wArr = Array.isArray(winner.directory?.[dirArrKey]) ? winner.directory[dirArrKey] : null;
    const lArr = Array.isArray(loser.directory?.[dirArrKey]) ? loser.directory[dirArrKey] : null;
    if ((!wArr || (equalOrMissingTimestamp && wArr.length === 0)) && lArr && lArr.length > 0) {
      merged.directory = { ...(merged.directory || {}), [dirArrKey]: lArr };
    }
  });

  if (winner.isUntouchedDefault && (!loser.isUntouchedDefault || maxMs > 0)) {
    delete merged.isUntouchedDefault;
  }

  const mergedQueue = Array.isArray(winner.queue)
    ? winner.queue
    : (Array.isArray(winner.opportunityQueue)
        ? winner.opportunityQueue
        : (Array.isArray(loser.queue) ? loser.queue : []));

  merged.queue = mergedQueue;
  merged.researchConfig = mergedRc;
  if (maxMs > 0) {
    merged.updatedAt = new Date(maxMs).toISOString();
  }
  return merged;
}

const DEFAULT_COMMENT_TAG = 'General';

function cleanCommentTagName(tag) {
  return String(tag || '').replace(/\s+/g, ' ').trim();
}

function canonicalizeCommentTagName(tag) {
  const cleaned = cleanCommentTagName(tag);
  if (!cleaned) return '';
  return cleaned.toLowerCase() === 'general' ? DEFAULT_COMMENT_TAG : cleaned;
}

function normalizeCommentTags(tags) {
  const rawList = Array.isArray(tags)
    ? tags
    : (typeof tags === 'string' && tags.trim() ? tags.split(',') : []);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < rawList.length; i += 1) {
    const canonical = canonicalizeCommentTagName(rawList[i]);
    if (!canonical) continue;
    const lower = canonical.toLowerCase();
    if (lower === 'all' || seen.has(lower)) continue;
    seen.add(lower);
    out.push(canonical);
  }
  return out.length > 0 ? out : [DEFAULT_COMMENT_TAG];
}

function applyTagToggleToComment(commentOrTags, tagName, isChecked) {
  const rawTags = Array.isArray(commentOrTags)
    ? commentOrTags
    : (commentOrTags && typeof commentOrTags === 'object' ? commentOrTags.tags : []);
  const current = normalizeCommentTags(rawTags);
  const target = canonicalizeCommentTagName(tagName);
  if (!target || target.toLowerCase() === 'all') return current;

  const targetLower = target.toLowerCase();
  const isGeneralTarget = targetLower === 'general';
  const hasCustomTags = current.some((t) => t.toLowerCase() !== 'general');

  let next;
  if (isChecked) {
    if (!isGeneralTarget && !hasCustomTags) {
      next = [target];
    } else if (current.some((t) => t.toLowerCase() === targetLower)) {
      next = [...current];
    } else if (isGeneralTarget) {
      next = [DEFAULT_COMMENT_TAG, ...current];
    } else {
      next = [...current, target];
    }
  } else {
    next = current.filter((t) => t.toLowerCase() !== targetLower);
    if (next.length === 0) next = [DEFAULT_COMMENT_TAG];
  }

  if (commentOrTags && typeof commentOrTags === 'object' && !Array.isArray(commentOrTags)) {
    commentOrTags.tags = next;
  }
  return next;
}

function mergeCommentTagLists(loserTags, winnerTags, equalOrMissingTimestamp = false, extraInUseTags = []) {
  const out = [DEFAULT_COMMENT_TAG];
  const seen = new Set(['general']);
  const pushTag = (raw) => {
    const canonical = canonicalizeCommentTagName(raw);
    if (!canonical) return;
    const lower = canonical.toLowerCase();
    if (lower === 'all' || seen.has(lower)) return;
    seen.add(lower);
    out.push(canonical);
  };
  const wArr = Array.isArray(winnerTags) ? winnerTags : [];
  const lArr = Array.isArray(loserTags) ? loserTags : [];
  wArr.forEach(pushTag);
  if (equalOrMissingTimestamp || wArr.length === 0) lArr.forEach(pushTag);
  (Array.isArray(extraInUseTags) ? extraInUseTags : []).forEach(pushTag);
  return out;
}

function getCampaignAvailableTags(brand) {
  const comments = Array.isArray(brand?.social?.comments) ? brand.social.comments : (Array.isArray(brand?.comments) ? brand.comments : []);
  const inUse = [];
  comments.forEach((c) => {
    if (c && typeof c === 'object' && Array.isArray(c.tags)) {
      c.tags.forEach((t) => inUse.push(t));
    }
  });
  return mergeCommentTagLists([], brand?.commentTags, false, inUse);
}

function getCommentTagCounts(brand, options = {}) {
  const enabledOnly = Boolean(options?.enabledOnly);
  const available = getCampaignAvailableTags(brand);
  const counts = { all: 0 };
  available.forEach((t) => { counts[t] = 0; });
  const comments = Array.isArray(brand?.social?.comments) ? brand.social.comments : (Array.isArray(brand?.comments) ? brand.comments : []);
  comments.forEach((c) => {
    const isStr = typeof c === 'string';
    const text = isStr ? c : String(c?.text || '');
    const isEnabled = isStr ? text.trim().length > 0 : (c && c.enabled !== false && c.active !== false);
    if (enabledOnly && (!isEnabled || !text.trim())) return;
    counts.all += 1;
    const tags = isStr ? [DEFAULT_COMMENT_TAG] : normalizeCommentTags(c?.tags);
    tags.forEach((tag) => {
      const key = available.find((a) => a.toLowerCase() === tag.toLowerCase()) || tag;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

function extractHostFromUrlForSafeDomain(rawUrl) {
  let val = String(rawUrl || '').trim();
  if (!val) return '';
  val = val.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  val = val.split(/[/?#]/)[0].trim().replace(/:\d+$/, '');
  if (!val || !val.includes('.')) return '';
  return val;
}

function getDefaultSafeDomainValue(brand) {
  const candidates = [brand?.brandInfo?.url, brand?.directory?.websiteUrl, brand?.contact?.website];
  for (let i = 0; i < candidates.length; i += 1) {
    const val = extractHostFromUrlForSafeDomain(candidates[i]);
    if (val) {
      const lastDot = val.lastIndexOf('.');
      return lastDot > 0 ? `${val.slice(0, lastDot)} .${val.slice(lastDot + 1)}` : val;
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

  result = result.replace(/\{\{\s*(?:url|domain)\s*\}\}|\{\s*(?:url|domain)\s*\}/gi, replacement);

  const hosts = [];
  const seenHosts = new Set();
  [brand?.brandInfo?.url, brand?.directory?.websiteUrl, brand?.contact?.website].forEach((raw) => {
    const host = extractHostFromUrlForSafeDomain(raw);
    if (host && !seenHosts.has(host.toLowerCase())) {
      seenHosts.add(host.toLowerCase());
      hosts.push(host);
    }
  });

  hosts.sort((a, b) => b.length - a.length);
  hosts.forEach((host) => {
    const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const urlRe = new RegExp(
      `(^|[^\\w@./-])(?:https?:\\/\\/)?(?:www\\.)?${escapedHost}(?![\\w-]|\\.[a-z0-9])(?:\\/[^\\s<>"')\\]}]*[^\\s<>"')\\]}.,!?;:]|\\/)?`,
      'gi'
    );
    result = result.replace(urlRe, (_, prefix) => `${prefix}${replacement}`);
  });

  return result;
}

function ensureDashboardBrandCommentsNormalized(brand) {
  if (!brand || typeof brand !== 'object') return [];
  if (!brand.social || typeof brand.social !== 'object') brand.social = { comments: [] };
  const rawList = Array.isArray(brand.social.comments)
    ? brand.social.comments
    : (Array.isArray(brand.comments) ? brand.comments : []);
  const seenIds = new Set();
  const baseStamp = Date.now();
  brand.social.comments = rawList.map((c, i) => {
    const obj = typeof c === 'string'
      ? { id: `comm-${baseStamp}-${i}`, text: c, tags: [DEFAULT_COMMENT_TAG], images: [], enabled: true, starred: false, isExpanded: true }
      : { enabled: true, starred: false, isExpanded: true, ...c };
    let cid = String(obj.id || '').trim() || `comm-${baseStamp}-${i}`;
    while (seenIds.has(cid)) {
      cid = `${cid}-${i}-${Math.random().toString(36).slice(2, 5)}`;
    }
    seenIds.add(cid);
    obj.id = cid;
    obj.tags = normalizeCommentTags(obj.tags);
    obj.images = Array.isArray(obj.images) ? obj.images : [];
    obj.enabled = obj.enabled !== false && obj.active !== false;
    obj.starred = Boolean(obj.starred);
    obj.isExpanded = obj.isExpanded !== false;
    return obj;
  });
  brand.comments = brand.social.comments;
  brand.commentTags = getCampaignAvailableTags(brand);

  const curPool = cleanCommentTagName(brand.activeCommentPool || 'all') || 'all';
  if (curPool.toLowerCase() === 'all') {
    brand.activeCommentPool = 'all';
  } else {
    const matchedPool = brand.commentTags.find((t) => t.toLowerCase() === curPool.toLowerCase());
    brand.activeCommentPool = matchedPool || 'all';
  }

  if (!brand.safeDomain || typeof brand.safeDomain !== 'object') {
    brand.safeDomain = { enabled: false, value: getDefaultSafeDomainValue(brand) };
  } else {
    brand.safeDomain = {
      enabled: Boolean(brand.safeDomain.enabled),
      value: typeof brand.safeDomain.value === 'string'
        ? brand.safeDomain.value
        : getDefaultSafeDomainValue(brand),
    };
  }

  const curFilter = cleanCommentTagName(state.commentsMgmtTagFilter || 'all') || 'all';
  if (curFilter.toLowerCase() === 'all') {
    state.commentsMgmtTagFilter = 'all';
  } else {
    state.commentsMgmtTagFilter = brand.commentTags.find((t) => t.toLowerCase() === curFilter.toLowerCase()) || 'all';
  }

  if (state.selectedCommentIds instanceof Set && state.selectedCommentIds.size > 0) {
    Array.from(state.selectedCommentIds).forEach((id) => {
      if (!seenIds.has(id)) state.selectedCommentIds.delete(id);
    });
  }
  return brand.social.comments;
}

function resetDashboardCommentUiState() {
  state.commentsMgmtTagFilter = 'all';
  if (state.selectedCommentIds instanceof Set) {
    state.selectedCommentIds.clear();
  } else {
    state.selectedCommentIds = new Set();
  }
  state.openDashboardTagPopoverId = null;
  state.renamingCampaignTag = '';
  state.bulkTagTarget = '';
}

function getCampaignResearchConfig(brandOrId = null) {
  let brand = null;
  if (brandOrId && typeof brandOrId === 'object') {
    brand = brandOrId;
  } else if (typeof brandOrId === 'string' && brandOrId) {
    brand = (state.brandProfiles || []).find((b) => b.brandId === brandOrId || b.campaignId === brandOrId) || null;
  } else {
    brand = getActiveBrand();
  }
  if (!brand) {
    if (!state.researchConfig || typeof state.researchConfig !== 'object') {
      state.researchConfig = createDefaultResearchConfig();
    }
    return state.researchConfig;
  }
  if (!brand.researchConfig || typeof brand.researchConfig !== 'object') {
    brand.researchConfig = createDefaultResearchConfig();
  } else {
    brand.researchConfig.frequency = brand.researchConfig.frequency || 'realtime';
    brand.researchConfig.quality = brand.researchConfig.quality || 'all';
    brand.researchConfig.feedTimeframe = normalizeResearchTimeframe(brand.researchConfig.feedTimeframe);
    brand.researchConfig.platforms = { ...DEFAULT_RESEARCH_PLATFORMS, ...(brand.researchConfig.platforms || {}) };
    if (!Array.isArray(brand.researchConfig.keywords)) brand.researchConfig.keywords = [];
    if (!Array.isArray(brand.researchConfig.competitors)) brand.researchConfig.competitors = [];
    if (!Array.isArray(brand.researchConfig.alertFeeds)) brand.researchConfig.alertFeeds = [];
    if (!Array.isArray(brand.researchConfig.discoveredThreads)) brand.researchConfig.discoveredThreads = [];
    if (!Array.isArray(brand.researchConfig.savedFeeds)) brand.researchConfig.savedFeeds = [];
    if (!brand.researchConfig.deletedFeedUrls || typeof brand.researchConfig.deletedFeedUrls !== 'object') brand.researchConfig.deletedFeedUrls = {};
    if (!brand.researchConfig.deletedKeywords || typeof brand.researchConfig.deletedKeywords !== 'object') brand.researchConfig.deletedKeywords = {};
    if (!brand.researchConfig.deletedCompetitors || typeof brand.researchConfig.deletedCompetitors !== 'object') brand.researchConfig.deletedCompetitors = {};
    if (!brand.researchConfig.deletedSavedFeedIds || typeof brand.researchConfig.deletedSavedFeedIds !== 'object') brand.researchConfig.deletedSavedFeedIds = {};
    brand.researchConfig.managedAlertSignature = String(brand.researchConfig.managedAlertSignature || '');
  }
  return brand.researchConfig;
}

function syncActiveResearchConfigMirror() {
  const rc = getCampaignResearchConfig();
  state.researchConfig = rc;
  return rc;
}

function getMirroredResearchPayload(brand = getActiveBrand()) {
  const rc = getCampaignResearchConfig(brand);
  const id = brand?.brandId || brand?.campaignId || state.activeBrandId || '';
  return { ...rc, ...(id ? { campaignId: id } : {}) };
}

function touchActiveResearchConfig(rc) {
  const nowIso = new Date().toISOString();
  const activeBrand = getActiveBrand();
  if (rc && typeof rc === 'object') rc.updatedAt = nowIso;
  if (activeBrand) {
    activeBrand.researchConfig = rc || getCampaignResearchConfig(activeBrand);
    activeBrand.updatedAt = nowIso;
    delete activeBrand.isUntouchedDefault;
  }
  state.researchConfig = rc || getCampaignResearchConfig(activeBrand);
  return nowIso;
}

function migrateLegacyResearchConfigToCampaigns(legacyCfg) {
  if (!legacyCfg || typeof legacyCfg !== 'object' || !hasResearchConfigData(legacyCfg)) return false;
  const brands = Array.isArray(state.brandProfiles) ? state.brandProfiles : [];
  if (brands.length === 0) return false;

  const taggedId = legacyCfg.campaignId || legacyCfg._campaignId || '';
  if (taggedId) {
    const target = brands.find((b) => b.brandId === taggedId || b.campaignId === taggedId);
    if (target) {
      target.researchConfig = mergeResearchConfig(target.researchConfig, legacyCfg);
      syncActiveResearchConfigMirror();
      return true;
    }
    return false;
  }

  // Pre-Phase-1 un-tagged legacy researchConfig: migrate only if NO campaign has researchConfig data yet
  const anyBrandHasResearch = brands.some((b) => hasResearchConfigData(b?.researchConfig));
  if (anyBrandHasResearch) return false;

  const target = brands.find((b) => !isUntouchedSampleCampaign(b)) || getActiveBrand() || brands[0];
  if (!target) return false;
  target.researchConfig = mergeResearchConfig(target.researchConfig, legacyCfg);
  if (!isUntouchedSampleCampaign(target) || hasResearchConfigData(legacyCfg)) {
    target.updatedAt = target.updatedAt || legacyCfg.updatedAt || legacyCfg.lastPolledAt || new Date().toISOString();
  }
  syncActiveResearchConfigMirror();
  return true;
}

const pendingBridgeRequests = new Map();

function bridgeCall(action, payload = {}, timeoutMs = 2200) {
  return new Promise((resolve) => {
    const requestId = 'spb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const timer = setTimeout(() => {
      pendingBridgeRequests.delete(requestId);
      resolve({ success: false, timeout: true });
    }, timeoutMs);

    pendingBridgeRequests.set(requestId, (resp) => {
      clearTimeout(timer);
      resolve(resp);
    });

    window.postMessage({
      type: 'SMART_POSTER_BRIDGE_REQ',
      requestId,
      action,
      payload,
    }, window.location.origin);
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.type === 'SMART_POSTER_BRIDGE_RES' && event.data.requestId) {
    const cb = pendingBridgeRequests.get(event.data.requestId);
    if (cb) {
      pendingBridgeRequests.delete(event.data.requestId);
      cb(event.data);
    }
  } else if (event.data.type === 'SMART_POSTER_BRIDGE_EVENT' && event.data.event === 'STATE_UPDATED') {
    syncFromExtensionBridge(true);
  } else if (event.data.type === 'SMART_POSTER_BRIDGE_EVENT' && event.data.event === 'AUTH_CLEARED') {
    clearDashboardAuthSession();
  }
});

// ============================================================================
// Initialization & Persistence
// ============================================================================
function setCampaignSyncingIndicator(isSyncing) {
  state.isHydratingCampaigns = Boolean(isSyncing);
  const badge = document.getElementById('global-campaign-sync-badge');
  if (badge) {
    badge.classList.toggle('hidden', !state.isHydratingCampaigns);
  }
}

async function initDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    const planParam = (urlParams.get('plan') || '').toLowerCase();
    const intervalParam = (urlParams.get('interval') || '').toLowerCase();
    const cycleText = intervalParam === 'yearly' ? 'Annual ' : '';
    const titleEl = document.getElementById('payment-success-title');
    const descEl = document.getElementById('payment-success-desc');
    if (planParam === 'unlimited' || planParam === 'agency') {
      if (titleEl) titleEl.textContent = `Payment Successful! Your ${cycleText}Agency Plan is Active`;
      if (descEl) descEl.textContent = 'Unlimited custom Products, 5 GB cloud media storage, and all 10 Product modules are unlocked across your devices.';
    } else if (planParam === 'studio') {
      if (titleEl) titleEl.textContent = `Payment Successful! Your ${cycleText}Studio Plan is Active`;
      if (descEl) descEl.textContent = 'Up to 15 custom Products, 1 GB cloud media storage, and all 10 Product modules are unlocked across your devices.';
    } else if (planParam === 'pro') {
      if (titleEl) titleEl.textContent = `Payment Successful! Your ${cycleText}Pro Plan is Active`;
      if (descEl) descEl.textContent = 'Up to 5 custom Products, 250 MB cloud media storage, and all 10 Product modules are unlocked across your devices.';
    }
    document.getElementById('payment-success-banner')?.classList.remove('hidden');
  }

  loadLocalFallbackState();
  renderGlobalCampaignSelectors();
  enhanceAllSelects();
  setupAuthListeners();

  const rawHash = window.location.hash.replace(/^#/, '');
  let initialSection = rawHash;
  let initialOppSubtab = null;
  if (rawHash === 'settings') {
    initialSection = 'ai-settings';
  } else if (rawHash === 'campaigns') {
    initialSection = 'content';
  } else if (rawHash === 'opportunities') {
    initialSection = 'research';
  } else if (rawHash.startsWith('opportunities/')) {
    initialSection = 'research';
    initialOppSubtab = rawHash.slice('opportunities/'.length);
  } else if (rawHash === 'directories') {
    initialSection = 'research';
    initialOppSubtab = 'directories';
  } else if (rawHash === 'assistant' || rawHash === 'ai') {
    initialSection = 'ai-assistant';
  }
  const validSections = ['account', 'content', 'ai-assistant', 'research', 'reports', 'ai-settings', 'download', 'new-features', 'contact', 'suggest-feature'];
  if (initialOppSubtab) {
    switchOpportunitiesSubtab(initialOppSubtab, false);
  }
  switchSection(validSections.includes(initialSection) ? initialSection : 'account', false);

  setCampaignSyncingIndicator(true);

  const refreshProgressiveCampaignUI = () => {
    renderAccountUI();
    renderGlobalCampaignSelectors();
    renderContentEditor();
    renderAiAssistantSection();
    renderResearchSection();
    renderReportsView();
    enhanceAllSelects();
  };

  try {
    await loadAuthSession({ redirectIfUnauthenticated: false });
    if (!state.user || !hasValidDashboardAuthSession(state.session)) {
      await syncFromExtensionBridge(false).catch(() => {});
    }

    if (!state.user || !hasValidDashboardAuthSession(state.session)) {
      redirectToDashboardLogin();
      return;
    }

    state._authGateCleared = true;
    document.getElementById('dashboard-auth-gate-cloak')?.remove();
    renderAll();

    // Fire non-campaign background catalogs without blocking campaign hydration
    loadDirectoriesCatalog().then(() => { renderDirectoriesTable(); }).catch(() => {});
    loadReleasesCatalog().then(() => { updateVersionNotificationUI(); renderDownloadSection(); }).catch(() => {});
    loadChangelogCatalog().then(() => { renderChangelogSection(); }).catch(() => {});

    loadDashboardStorageUsage().catch(() => {});
    renderAccountUI();

    await loadBrowserVaultFallback().catch(() => {});
    refreshProgressiveCampaignUI();

    const bridgeTask = syncFromExtensionBridge(false)
      .then(() => { refreshProgressiveCampaignUI(); })
      .catch(() => {});

    const prefsTask = loadCloudWorkspacePrefs()
      .then(() => { refreshProgressiveCampaignUI(); })
      .catch(() => {});

    const cloudTask = loadCloudUserState()
      .then(() => { refreshProgressiveCampaignUI(); })
      .catch(() => {});

    await Promise.all([bridgeTask, prefsTask, cloudTask]);
  } finally {
    setCampaignSyncingIndicator(false);
    if (state._authGateCleared) {
      renderAll();
    }
  }
}

// ============================================================================
// Custom Styled Dropdown Controller (Replaces OS default <select> popups)
// ============================================================================
function closeAllCustomSelects(exceptWrapper = null) {
  document.querySelectorAll('.sp-select-wrapper.open').forEach((wrap) => {
    if (wrap !== exceptWrapper) {
      wrap.classList.remove('open');
      wrap.querySelector('.sp-select-menu')?.classList.add('hidden');
    }
  });
}

function buildCustomSelectOptions(selectEl, wrapper) {
  const labelEl = wrapper.querySelector('.sp-select-label');
  const menuEl = wrapper.querySelector('.sp-select-menu');
  if (!labelEl || !menuEl) return;

  const opts = Array.from(selectEl.options || []);
  const selectedOpt = opts.find((o) => o.value === selectEl.value) || opts.find((o) => o.selected) || opts[0];
  if (selectedOpt && selectEl.value !== selectedOpt.value) {
    selectEl.value = selectedOpt.value;
  }
  labelEl.textContent = selectedOpt ? selectedOpt.textContent : 'Select...';

  menuEl.innerHTML = opts.map((opt) => {
    const isSel = opt.value === selectEl.value;
    return `
      <button type="button" class="sp-select-option ${isSel ? 'selected' : ''}" data-value="${escapeHtml(opt.value)}">
        <span class="truncate">${escapeHtml(opt.textContent)}</span>
        ${isSel ? '<i class="fas fa-check text-[10px] text-[#6c5ce7] flex-shrink-0"></i>' : ''}
      </button>
    `;
  }).join('');

  menuEl.querySelectorAll('.sp-select-option').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.dataset.value;
      if (selectEl.value !== val) {
        selectEl.value = val;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncCustomSelect(selectEl);
      closeAllCustomSelects();
    });
  });
}

function initCustomSelect(selectEl) {
  if (!selectEl || selectEl.dataset.spEnhanced === 'true') return;
  selectEl.dataset.spEnhanced = 'true';

  const variant = selectEl.dataset.variant || 'default';
  const alignRight = selectEl.dataset.align === 'right';
  const origClasses = selectEl.className || '';
  selectEl.classList.add('sr-only');

  const wrapper = document.createElement('div');
  wrapper.className = variant === 'topbar'
    ? 'sp-select-wrapper min-w-[140px] max-w-[195px]'
    : `sp-select-wrapper ${origClasses.includes('w-full') ? 'w-full' : ''} ${origClasses.includes('min-w-') ? (origClasses.match(/min-w-\[[^\]]+\]/)?.[0] || '') : ''}`.trim();

  const triggerClass = variant === 'topbar'
    ? 'sp-select-trigger bg-transparent border-0 px-1 py-0.5 text-xs font-semibold text-[#1e222a] rounded'
    : 'sp-select-trigger w-full px-3 py-2 bg-white border border-[#dfd8cc] hover:border-[#bfb6a6] rounded-lg text-xs font-semibold text-[#1e222a]';

  wrapper.innerHTML = `
    <button type="button" class="${triggerClass}" data-variant="${escapeHtml(variant)}" aria-haspopup="listbox">
      <span class="sp-select-label truncate"></span>
      <svg class="sp-select-chevron w-3.5 h-3.5 text-[#6c5ce7]" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 8l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="sp-select-menu hidden ${alignRight ? 'align-right' : ''}" role="listbox"></div>
  `;

  selectEl.insertAdjacentElement('afterend', wrapper);
  wrapper._targetSelect = selectEl;
  selectEl._spWrapper = wrapper;

  const triggerBtn = wrapper.querySelector('.sp-select-trigger');
  const menuEl = wrapper.querySelector('.sp-select-menu');

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = wrapper.classList.contains('open');
    closeAllCustomSelects();
    if (!wasOpen) {
      buildCustomSelectOptions(selectEl, wrapper);
      wrapper.classList.add('open');
      menuEl.classList.remove('hidden');
    }
  });

  selectEl.addEventListener('change', () => buildCustomSelectOptions(selectEl, wrapper));
  buildCustomSelectOptions(selectEl, wrapper);
}

function syncCustomSelect(selectOrId) {
  const el = typeof selectOrId === 'string' ? document.getElementById(selectOrId) : selectOrId;
  if (!el) return;
  if (el.dataset.spEnhanced === 'true' && (!el._spWrapper || !el._spWrapper.isConnected)) {
    delete el.dataset.spEnhanced;
    el._spWrapper = null;
  }
  if (el.dataset.spEnhanced !== 'true') {
    initCustomSelect(el);
  } else if (el._spWrapper) {
    buildCustomSelectOptions(el, el._spWrapper);
  }
}

function enhanceAllSelects(root = document) {
  root.querySelectorAll('select').forEach((sel) => {
    if (sel.dataset.spEnhanced !== 'true') {
      initCustomSelect(sel);
    } else {
      syncCustomSelect(sel);
    }
  });
}

if (!window._spCustomSelectListenersBound) {
  window._spCustomSelectListenersBound = true;
  document.addEventListener('click', () => closeAllCustomSelects());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllCustomSelects();
  });
}

function decodeJwtPayloadDash(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64));
  } catch (_) {
    return null;
  }
}

function isJwtExpiredDash(token, leewaySeconds = 30) {
  const payload = decodeJwtPayloadDash(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return Date.now() >= (payload.exp - leewaySeconds) * 1000;
}

function getDashSessionTimestampMs(session) {
  if (!session || typeof session !== 'object') return 0;
  const ts = session.updatedAt || session.loggedInAt || session.user?.updatedAt || 0;
  const parsed = toMsTimestamp(ts);
  if (parsed > 0) return parsed;
  const tok = session.accessToken || session.token || '';
  const payload = decodeJwtPayloadDash(tok);
  if (payload && typeof payload.iat === 'number') return payload.iat * 1000;
  return 0;
}

function hasValidDashboardAuthSession(session) {
  if (!session || typeof session !== 'object' || !session.user) return false;
  const token = session.accessToken || session.token || '';
  if (!token) return false;
  if (isJwtExpiredDash(token, 0) && !session.refreshToken) return false;
  return true;
}

function redirectToDashboardLogin() {
  if (window._spRedirectingToLogin) return;
  window._spRedirectingToLogin = true;
  const nextUrl = `${window.location.pathname || '/dashboard.html'}${window.location.search || ''}${window.location.hash || ''}`;
  window.location.replace(`/login.html?next=${encodeURIComponent(nextUrl)}`);
}

function clearDashboardAuthSession(options = {}) {
  try {
    localStorage.removeItem('authUserSession');
    localStorage.removeItem('cf_auth_session');
    localStorage.removeItem('sp_entitlement_claim');
  } catch (_) {}
  state.user = null;
  state.session = null;
  state.entitlement = null;
  state.isPro = false;
  state.isUnlimited = false;
  if (options.redirectIfUnauthenticated !== false && state._authGateCleared) {
    redirectToDashboardLogin();
    return;
  }
  renderGuestUI();
}

function notifyExtensionAuthCleared(reason, failedToken = '') {
  if (!state.extInstalled) return;
  bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', {
    clearAuthSession: true,
    reason: reason || 'auth_invalidated',
    failedToken: failedToken || '',
  }).catch(() => {});
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('authUserSession') || localStorage.getItem('cf_auth_session');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

const DASHBOARD_ADMIN_EMAILS = ['fintasticapps@gmail.com', 'domlord369@gmail.com'];

function normalizeDashboardTier(rawTier, rawRole = 'user', email = '') {
  const emailLower = String(email || '').trim().toLowerCase();
  const isAdmin = String(rawRole || '').toLowerCase() === 'admin' || DASHBOARD_ADMIN_EMAILS.includes(emailLower);
  if (isAdmin) return 'unlimited';
  const t = String(rawTier || 'basic').trim().toLowerCase();
  if (
    t === 'unlimited' ||
    t === 'unlimited_lifetime' ||
    t === 'unlimited-lifetime' ||
    t === 'agency' ||
    t === 'team' ||
    t === 'ultra' ||
    t.startsWith('unlimited')
  ) {
    return 'unlimited';
  }
  if (t === 'studio' || t === 'growth' || t.startsWith('studio')) {
    return 'studio';
  }
  if (t === 'pro' || t === 'pro_lifetime' || t === 'pro-lifetime' || t === 'lifetime' || t === 'premium' || t.startsWith('pro')) {
    return 'pro';
  }
  return 'basic';
}

function getStorageQuotaBytesForTier(tier) {
  if (tier === 'unlimited') return 5 * 1024 * 1024 * 1024;
  if (tier === 'studio') return 1024 * 1024 * 1024;
  if (tier === 'pro') return 250 * 1024 * 1024;
  return 15 * 1024 * 1024;
}

function getDashboardConfiguredKeys() {
  const openRouterKey = (state.apiKey || document.getElementById('ai-setting-apikey')?.value || '').trim();
  const geminiApiKey = (state.geminiApiKey || document.getElementById('ai-setting-gemini-apikey')?.value || '').trim();
  return { openRouterKey, geminiApiKey };
}

function hasDashboardAiKey() {
  const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
  return Boolean(openRouterKey || geminiApiKey);
}

function getCustomCampaignsCount() {
  const list = state.brandProfiles || [];
  return list.filter((c) => {
    if (!c || c.isDefault) return false;
    const id = c.brandId || c.campaignId || '';
    const name = (c.brandName || c.campaignName || '').toLowerCase();
    if (id === 'brand-focus-gummies-sample' || name.includes('focus gummies')) return false;
    return true;
  }).length;
}

function hasValidDashboardEntitlement(claim, expectedUserId, expectedEmail = '') {
  if (!claim || typeof claim !== 'object') return false;
  if (!claim.signature || !/^[a-f0-9]{64}$/i.test(String(claim.signature))) return false;
  if (!claim.expiresAt || Number(claim.expiresAt) <= Date.now()) return false;
  if (claim.issuedAt && Number(claim.issuedAt) > Date.now() + 60000) return false;
  if (expectedUserId && claim.userId && claim.userId !== expectedUserId) {
    const claimEmail = String(claim.email || '').trim().toLowerCase();
    const userEmail = String(expectedEmail || '').trim().toLowerCase();
    const isAdminClaimMatch = String(claim.userId).startsWith('admin-') && claimEmail && userEmail && claimEmail === userEmail;
    if (!isAdminClaimMatch) return false;
  }
  return true;
}

function getStoredEntitlementClaim(expectedUserId, expectedEmail = '') {
  try {
    const raw = localStorage.getItem('sp_entitlement_claim');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (hasValidDashboardEntitlement(parsed, expectedUserId, expectedEmail)) return parsed;
    }
  } catch (_) {}
  return null;
}

async function loadAuthSession(options = {}) {
  const session = getStoredSession();
  if (hasValidDashboardAuthSession(session)) {
    state.session = session;
    state.user = session.user;
    state.entitlement = hasValidDashboardEntitlement(session.entitlement, session.user.id, session.user.email)
      ? session.entitlement
      : getStoredEntitlementClaim(session.user.id, session.user.email);
    renderAccountUI();
    await checkFreshUserTier(session);
  } else {
    clearDashboardAuthSession({ redirectIfUnauthenticated: options.redirectIfUnauthenticated });
  }
}

let activeDashRefreshPromise = null;
async function refreshDashboardSupabaseToken(session, supabaseUrl, anonKey) {
  if (!session?.refreshToken || !supabaseUrl || !anonKey) return null;
  if (activeDashRefreshPromise) return activeDashRefreshPromise;
  activeDashRefreshPromise = (async () => {
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          return { rejected: true, status: res.status };
        }
        return null;
      }
      const data = await res.json().catch(() => null);
      if (!data?.access_token) return null;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || session.refreshToken,
      };
    } catch (_) {
      return null;
    }
  })();
  try {
    return await activeDashRefreshPromise;
  } finally {
    activeDashRefreshPromise = null;
  }
}

async function checkFreshUserTier(session) {
  let token = session?.accessToken || session?.token || '';
  if (!token) {
    clearDashboardAuthSession();
    return;
  }

  let configCache = null;
  const loadSupabaseCfg = async () => {
    if (configCache) return configCache;
    try {
      const configRes = await fetch('/api/config');
      const ct = (configRes.headers.get('content-type') || '').toLowerCase();
      configCache = (configRes.ok && ct.includes('application/json')) ? await configRes.json() : {};
    } catch (_) {
      configCache = {};
    }
    return configCache;
  };

  const applyAndSyncRefreshed = (refreshed) => {
    token = refreshed.accessToken;
    session.accessToken = token;
    session.token = token;
    session.refreshToken = refreshed.refreshToken;
    session.updatedAt = new Date().toISOString();
    if (state.session && state.session.user?.id === session.user?.id) {
      state.session = session;
    }
    localStorage.setItem('authUserSession', JSON.stringify(session));
    localStorage.setItem('cf_auth_session', JSON.stringify(session));
    if (state.extInstalled) {
      bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', { authSession: session }).catch(() => {});
    }
  };

  try {
    // 0. Proactively refresh expired JWT before hitting protected endpoints
    if (isJwtExpiredDash(token, 30)) {
      if (!session?.refreshToken) {
        clearDashboardAuthSession();
        notifyExtensionAuthCleared('expired_no_refresh', token);
        return;
      }
      const cfg = await loadSupabaseCfg();
      const refreshed = await refreshDashboardSupabaseToken(session, cfg?.supabase?.url, cfg?.supabase?.anonKey);
      if (refreshed?.accessToken) {
        applyAndSyncRefreshed(refreshed);
      } else if (refreshed?.rejected) {
        clearDashboardAuthSession();
        notifyExtensionAuthCleared('refresh_rejected', token);
        return;
      } else {
        return;
      }
    }

    // 1. Fetch authoritative signed entitlement from backend
    let entRes = await fetch('/api/auth/entitlement', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (entRes.status === 401 && session?.refreshToken) {
      const cfg = await loadSupabaseCfg();
      const supabaseUrl = cfg?.supabase?.url?.replace(/\/+$/, '');
      const anonKey = cfg?.supabase?.anonKey;
      const refreshed = await refreshDashboardSupabaseToken(session, supabaseUrl, anonKey);
      if (refreshed?.accessToken) {
        applyAndSyncRefreshed(refreshed);
        entRes = await fetch('/api/auth/entitlement', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else if (refreshed?.rejected) {
        clearDashboardAuthSession();
        notifyExtensionAuthCleared('refresh_rejected', token);
        return;
      }
    }
    const entCt = (entRes.headers.get('content-type') || '').toLowerCase();
    if (entRes.status === 401 && entCt.includes('application/json')) {
      const errBody = await entRes.json().catch(() => ({}));
      const errMsg = String(errBody?.error || '').toLowerCase();
      const isServerUnconfigured = errMsg.includes('not configured') || errMsg.includes('unavailable');
      if (!isServerUnconfigured) {
        const failedToken = token;
        clearDashboardAuthSession();
        notifyExtensionAuthCleared('dashboard_401', failedToken);
        return;
      }
    }
    if (entRes.ok && entCt.includes('application/json')) {
      const entData = await entRes.json().catch(() => null);
      if (entData?.success && entData.entitlement) {
        state.entitlement = entData.entitlement;
        session.entitlement = entData.entitlement;
        const emailLower = String(entData.entitlement.email || session.user?.email || '').trim().toLowerCase();
        const claimRole = (String(entData.entitlement.role || 'user').toLowerCase() === 'admin' || DASHBOARD_ADMIN_EMAILS.includes(emailLower)) ? 'admin' : 'user';
        session.user.tier = normalizeDashboardTier(entData.entitlement.tier, claimRole, emailLower);
        session.user.role = claimRole;
        if (typeof entData.entitlement.storageUsedBytes === 'number') {
          state.storageUsedBytes = Math.max(0, entData.entitlement.storageUsedBytes);
        }
        if (typeof entData.entitlement.storageLimitBytes === 'number' && entData.entitlement.storageLimitBytes > 0) {
          state.storageLimitBytes = entData.entitlement.storageLimitBytes;
        } else {
          state.storageLimitBytes = getStorageQuotaBytesForTier(session.user.tier);
        }
        localStorage.setItem('sp_entitlement_claim', JSON.stringify(entData.entitlement));
        localStorage.setItem('authUserSession', JSON.stringify(session));
        localStorage.setItem('cf_auth_session', JSON.stringify(session));
        state.user = session.user;
        renderAccountUI();
        if (state.extInstalled) {
          bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', { entitlementClaim: entData.entitlement }).catch(() => {});
        }
      }
    }
  } catch (_) {}

  // 2. Also sync display profile metadata (and tier/role if Supabase is available)
  try {
    const config = await loadSupabaseCfg();
    const supabaseUrl = config.supabase?.url?.replace(/\/+$/, '');
    const anonKey = config.supabase?.anonKey;
    if (!supabaseUrl || !anonKey || (!session.user?.id && !session.user?.email)) return;

    const filter = session.user?.id
      ? `id=eq.${encodeURIComponent(session.user.id)}`
      : `email=eq.${encodeURIComponent(String(session.user.email).toLowerCase())}`;
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?${filter}&select=full_name,avatar_url,tier,role,email`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (profileRes.ok) {
      let profiles = await profileRes.json();
      if ((!profiles || profiles.length === 0) && session.user?.email && !filter.startsWith('email=')) {
        const byEmailRes = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(String(session.user.email).toLowerCase())}&select=full_name,avatar_url,tier,role,email`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        });
        if (byEmailRes.ok) profiles = await byEmailRes.json();
      }
      if (profiles && profiles[0]) {
        const p = profiles[0];
        const emailLower = String(p.email || session.user.email || '').trim().toLowerCase();
        session.user.fullName = p.full_name || session.user.fullName;
        session.user.avatarUrl = p.avatar_url || session.user.avatarUrl;
        if (!state.entitlement) {
          const dbRole = (String(p.role || 'user').toLowerCase() === 'admin' || DASHBOARD_ADMIN_EMAILS.includes(emailLower)) ? 'admin' : 'user';
          session.user.role = dbRole;
          session.user.tier = normalizeDashboardTier(p.tier, dbRole, emailLower);
        }
        localStorage.setItem('authUserSession', JSON.stringify(session));
        localStorage.setItem('cf_auth_session', JSON.stringify(session));
        state.user = session.user;
        renderAccountUI();
      }
    }
  } catch (_) {}
}

function createSampleCampaign() {
  return {
    brandId: 'brand-focus-gummies-sample',
    campaignId: 'brand-focus-gummies-sample',
    brandName: 'Focus Gummies - Sample Campaign',
    campaignName: 'Focus Gummies - Sample Campaign',
    isDefault: true,
    isUntouchedDefault: true,
    savedKeywordStacks: [
      { id: 'stack-default-nootropics', name: 'Daily Nootropics Search', query: 'nootropics for coding', platforms: { twitter: true, reddit: true, youtube: true, linkedin: true } },
    ],
    brandInfo: {
      name: 'Focus Gummies',
      url: 'https://focusgummies.co',
      tagline: 'Clean brain fuel for peak focus and deep work',
      description: 'Sugar-free nootropic chewable gummies formulated with Lion\'s Mane and L-Theanine.',
      twitter: '@focusgummies',
      instagram: '@focusgummies',
    },
    brandAssets: {
      shortPitch: 'Sugar-free nootropic chewable gummies formulated with Lion\'s Mane and L-Theanine.',
      longPitch: 'Focus Gummies delivers scientifically backed cognitive performance without pills, bitter powders, or afternoon caffeine crashes. Built for founders, builders, and deep-work makers.',
      founderStory: 'Built after years of jittery espresso crashes during long coding sprints.',
      pricingSummary: '$29/bottle (30-day supply), 20% off monthly subscribe & save',
      targetAudience: 'Software engineers, indie founders, designers, and remote knowledge workers',
      features: [
        { id: 'fg-feat-1', title: 'Dual-Extract Lion\'s Mane + L-Theanine', detail: 'Calms jittery energy while supporting sustained concentration' },
        { id: 'fg-feat-2', title: 'Zero Sugar & Portable Chewables', detail: 'No shaker bottles, capsules, or afternoon crash' },
      ],
      benefits: [
        { id: 'fg-ben-1', title: 'Calm 6+ Hour Flow State', detail: 'Stay locked into deep creative and technical work longer' },
      ],
      competitors: [
        { id: 'fg-comp-1', name: 'Energy Drinks / Espresso', advantage: 'Zero sugar crash or heart-racing jitters', recommendWhen: 'Audience mentions caffeine crashes or afternoon brain fog' },
      ],
      links: { pricingUrl: 'https://focusgummies.co/pricing', docsUrl: '', bookingUrl: '', utmSource: 'community', utmMedium: 'organic', utmCampaign: 'launch' },
      videos: { demoUrl: '', explainerUrl: '', onboardingUrl: '' },
      handles: { twitter: '@focusgummies', linkedin: '', github: '', youtube: '', productHunt: '', instagram: '@focusgummies' },
      proof: {
        metrics: ['4.9/5 average rating across 1,200+ makers'],
        testimonials: [{ id: 'fg-test-1', quote: 'Replaced my 2pm double espresso and killed my afternoon slump.', author: 'Maya R., Indie SaaS Founder' }],
      },
      tone: { style: 'Practical, founder-to-founder, low-hype', forbiddenWords: 'miracle, cure, medical advice' },
      mediaRoles: { logoGalleryId: '', faviconGalleryId: '', ogCoverGalleryId: '' },
    },
    directory: {
      productName: 'Focus Gummies',
      websiteUrl: 'https://focusgummies.co',
      demoUrl: 'https://focusgummies.co/how-it-works',
      category: 'Health & Wellness',
      pricingModel: 'Paid',
      startingPrice: '$29',
      taglines: [{ id: 'fg-tag-1', text: 'Clean brain fuel for peak focus', enabled: true }],
      pitches: [{ id: 'fg-pitch-1', text: 'Focus Gummies combine Lion\'s Mane & L-Theanine for calm, laser-sharp flow state in 15 mins.', enabled: true }],
      summaries: [{ id: 'fg-sum-1', text: 'Clinically dosed nootropics in delicious chewable gummies.', enabled: true }],
      descriptions: [{ id: 'fg-desc-1', text: 'Focus Gummies delivers scientifically backed cognitive performance without pills or bitter powders.', enabled: true }],
    },
    contact: {
      senderName: 'Alex Vance',
      senderEmail: 'alex@focusgummies.co',
      phone: '(415) 890-3421',
      company: 'Focus Gummies Co.',
      website: 'https://focusgummies.co',
      subject: '{Partnership & Retail Inquiry|Product sample for your team}',
      message: 'Hello team,\n\nWe produce Focus Gummies — clean nootropic chewables for deep work. Would love to connect!',
    },
    social: {
      comments: [
        { id: 'fg-comm-1', text: '{Founders|Builders}, if afternoon brain fog is slowing your output, we built Focus Gummies to replace jittery coffee: https://focusgummies.co', tags: ['General'], enabled: true },
      ],
    },
    commentTags: ['General'],
    activeCommentPool: 'all',
    safeDomain: { enabled: false, value: 'focusgummies .co' },
    emails: [
      { id: 'fg-email-1', subject: 'Quick partnership idea with Focus Gummies', body: 'Hey team, love your work. Would love to send a complimentary box to test!', enabled: true },
    ],
    dms: [
      { id: 'fg-dm-1', platform: 'Twitter', message: 'Hey! Loved your recent thread on deep work routines.', enabled: true },
    ],
    articles: [
      { id: 'fg-art-1', title: 'How Tech Founders Sustain 8-Hour Deep Work Blocks Naturally', category: 'Productivity', preset: 'how-to', targetKeyword: 'nootropics for deep work', slug: 'how-tech-founders-sustain-8-hour-deep-work-blocks-naturally', metaDescription: 'Replacing afternoon caffeine crashes with clean Lion\'s Mane and L-Theanine for deep focus.', body: 'Replacing afternoon caffeine crashes with clean Lion\'s Mane + L-Theanine...', enabled: true },
    ],
    socialPosts: [],
    support: { faqs: [], macros: [] },
    keywords: [{ id: 'kw-sample-gummies', text: 'gummies', bookmarked: false }],
    researchConfig: createDefaultResearchConfig({
      keywords: ['nootropics for coding'],
    }),
    gallery: [],
    queue: [],
    suppressionList: ['google.com', 'youtube.com'],
    postingRules: { twitterStripProtocol: true },
  };
}

function normalizeSampleCampaignNames(brands) {
  if (!Array.isArray(brands)) return brands;
  brands.forEach((b) => {
    if (!b || typeof b !== 'object') return;
    const id = b.brandId || b.campaignId || '';
    const isSampleId = id === 'brand-focus-gummies-sample';
    const hasOldName = b.brandName === 'Focus Gummies - Reddit Launch' || b.campaignName === 'Focus Gummies - Reddit Launch';
    if (isSampleId && (b.isUntouchedDefault || !b.updatedAt || hasOldName)) {
      b.brandName = 'Focus Gummies - Sample Campaign';
      b.campaignName = 'Focus Gummies - Sample Campaign';
    }
  });
  return brands;
}

function loadLocalFallbackState() {
  try {
    const savedBrands = JSON.parse(localStorage.getItem('campaignProfiles') || localStorage.getItem('brandProfiles') || 'null');
    if (Array.isArray(savedBrands) && savedBrands.length > 0) {
      state.brandProfiles = normalizeSampleCampaignNames(savedBrands);
      state.activeBrandId = localStorage.getItem('activeCampaignId') || localStorage.getItem('activeBrandId') || savedBrands[0].brandId;
    } else {
      const sample = createSampleCampaign();
      state.brandProfiles = [sample];
      state.activeBrandId = sample.brandId;
    }

    const savedRes = JSON.parse(localStorage.getItem('sp_research_config') || 'null');
    if (savedRes && typeof savedRes === 'object') {
      migrateLegacyResearchConfigToCampaigns(savedRes);
    }
    syncActiveResearchConfigMirror();

    const savedDirPrefs = JSON.parse(localStorage.getItem('sp_directory_prefs') || 'null');
    if (savedDirPrefs) state.directoryPrefs = { ...state.directoryPrefs, ...savedDirPrefs };

    const savedLogs = JSON.parse(localStorage.getItem('sp_master_logs') || 'null');
    if (Array.isArray(savedLogs)) state.masterLogs = savedLogs;

    const savedErrLogs = JSON.parse(localStorage.getItem('sp_error_logs') || 'null');
    if (Array.isArray(savedErrLogs)) state.errorLogs = savedErrLogs;

    const savedTombs = JSON.parse(localStorage.getItem('sp_deleted_brand_tombstones') || 'null');
    if (savedTombs && typeof savedTombs === 'object') state.deletedBrandTombstones = savedTombs;

    const savedSup = JSON.parse(localStorage.getItem('sp_suppression_list') || 'null');
    if (Array.isArray(savedSup)) state.suppressionList = savedSup;

    const savedCompleted = JSON.parse(localStorage.getItem('sp_completed_urls') || 'null');
    if (savedCompleted && typeof savedCompleted === 'object') state.completedUrls = savedCompleted;

    const savedSettings = JSON.parse(localStorage.getItem('sp_settings') || 'null');
    if (savedSettings && typeof savedSettings === 'object') {
      state.settings = { ...state.settings, ...savedSettings };
    }

    const savedTwStrip = localStorage.getItem('sp_rule_twitter_strip_protocol');
    if (savedTwStrip !== null) state.ruleTwitterStripProtocol = savedTwStrip !== 'false';

    const savedApiKey = localStorage.getItem('sp_api_key');
    if (savedApiKey !== null) state.apiKey = savedApiKey;

    const savedGeminiKey = localStorage.getItem('sp_gemini_api_key');
    if (savedGeminiKey !== null) state.geminiApiKey = savedGeminiKey;

    const savedAiModel = localStorage.getItem('sp_ai_model');
    if (savedAiModel) state.aiModel = savedAiModel;
  } catch (_) {}
}

function isUntouchedSampleCampaign(b) {
  if (!b || typeof b !== 'object') return false;
  const id = b.brandId || b.campaignId || '';
  if (id !== 'brand-focus-gummies-sample') return false;
  const name = String(b.brandName || b.campaignName || '').trim();
  const isDefaultName =
    !name ||
    name === 'Focus Gummies - Sample Campaign' ||
    name === 'Focus Gummies - Reddit Launch' ||
    name === 'FocusGummies - reddit launch';
  const infoUrl = String(b.brandInfo?.url || '').trim();
  const isDefaultUrl = !infoUrl || infoUrl === 'https://focusgummies.co';
  if (!isDefaultName || !isDefaultUrl) return false;
  if (b.brandInfo?.name && b.brandInfo.name !== 'Focus Gummies') return false;
  if (b.isUntouchedDefault) return true;
  if (!b.updatedAt) return true;
  return false;
}

function hasMeaningfulDashboardSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return false;
  const brands = Array.isArray(snap.brandProfiles) ? snap.brandProfiles : [];
  if (brands.some((b) => b && !isUntouchedSampleCampaign(b))) return true;
  if (brands.some((b) => b && !isUntouchedSampleCampaign(b) && hasResearchConfigData(b.researchConfig))) return true;
  if (snap.completedUrls && Object.keys(snap.completedUrls).length > 0) return true;
  if (Array.isArray(snap.masterLogs) && snap.masterLogs.length > 0) return true;
  if (Array.isArray(snap.suppressionList) && snap.suppressionList.length > 0) return true;
  if ((snap.apiKey && String(snap.apiKey).trim()) || (snap.geminiApiKey && String(snap.geminiApiKey).trim())) return true;
  if (snap.directoryPrefs && ((snap.directoryPrefs.bookmarkedIds?.length || 0) > 0 || (snap.directoryPrefs.customDirectories?.length || 0) > 0)) return true;
  if (snap.researchConfig && ((snap.researchConfig.keywords?.length || 0) > 0 || (snap.researchConfig.competitors?.length || 0) > 0 || (snap.researchConfig.alertFeeds?.length || 0) > 0)) return true;
  return false;
}

function buildDashboardVaultSnapshot() {
  return {
    schemaVersion: 2,
    updatedAt: state.settings?.updatedAt || new Date().toISOString(),
    brandProfiles: Array.isArray(state.brandProfiles) ? state.brandProfiles : [],
    activeBrandId: state.activeBrandId || '',
    deletedBrandTombstones: state.deletedBrandTombstones || {},
    settings: buildConsolidatedDashboardSettings(),
    apiKey: state.apiKey || '',
    geminiApiKey: state.geminiApiKey || '',
    aiModel: state.aiModel || 'deepseek/deepseek-chat',
    suppressionList: Array.isArray(state.suppressionList) ? state.suppressionList : [],
    ruleTwitterStripProtocol: state.ruleTwitterStripProtocol !== false,
    completedUrls: state.completedUrls || {},
    directoryPrefs: state.directoryPrefs || { bookmarkedIds: [], customDirectories: [] },
    researchConfig: getMirroredResearchPayload(),
    masterLogs: Array.isArray(state.masterLogs) ? state.masterLogs : [],
    errorLogs: Array.isArray(state.errorLogs) ? state.errorLogs : [],
  };
}

let browserVaultSaveTimer = null;
function scheduleServerVaultBackup() {
  const snapshot = buildDashboardVaultSnapshot();
  if (!hasMeaningfulDashboardSnapshot(snapshot)) return;
  clearTimeout(browserVaultSaveTimer);
  browserVaultSaveTimer = setTimeout(async () => {
    try {
      const vaultId = localStorage.getItem('sp_vault_id') || '';
      const res = await fetch('/api/extension/vault', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(vaultId ? { 'X-SP-Vault-Id': vaultId } : {}),
        },
        body: JSON.stringify({ snapshot }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.vaultId) localStorage.setItem('sp_vault_id', data.vaultId);
      }
    } catch (_) {}
  }, 500);
}

async function loadBrowserVaultFallback() {
  try {
    const localSnap = buildDashboardVaultSnapshot();
    const localHasReal = hasMeaningfulDashboardSnapshot(localSnap);
    const storedVaultRaw = localStorage.getItem('sp_extension_vault_v1');
    if (!localHasReal && storedVaultRaw) {
      const parsed = JSON.parse(storedVaultRaw);
      if (hasMeaningfulDashboardSnapshot(parsed)) {
        if (Array.isArray(parsed.brandProfiles) && parsed.brandProfiles.length > 0) {
          state.brandProfiles = normalizeSampleCampaignNames(parsed.brandProfiles);
          state.activeBrandId = parsed.activeBrandId || parsed.brandProfiles[0].brandId;
        }
        if (parsed.deletedBrandTombstones) state.deletedBrandTombstones = parsed.deletedBrandTombstones;
        if (parsed.settings) state.settings = { ...state.settings, ...parsed.settings };
        if (parsed.apiKey) state.apiKey = parsed.apiKey;
        if (parsed.geminiApiKey) state.geminiApiKey = parsed.geminiApiKey;
        if (parsed.aiModel) state.aiModel = parsed.aiModel;
        if (Array.isArray(parsed.suppressionList)) state.suppressionList = parsed.suppressionList;
        if (parsed.completedUrls) state.completedUrls = parsed.completedUrls;
        if (parsed.directoryPrefs) state.directoryPrefs = parsed.directoryPrefs;
        if (parsed.researchConfig) migrateLegacyResearchConfigToCampaigns(parsed.researchConfig);
        if (Array.isArray(parsed.masterLogs)) state.masterLogs = parsed.masterLogs;
        if (Array.isArray(parsed.errorLogs)) state.errorLogs = parsed.errorLogs;
        syncActiveResearchConfigMirror();
        persistAllLocalStateKeys();
      }
    }

    const vaultId = localStorage.getItem('sp_vault_id') || '';
    const res = await fetch('/api/extension/vault', {
      method: 'GET',
      credentials: 'include',
      headers: vaultId ? { 'X-SP-Vault-Id': vaultId } : {},
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.success) return;
    if (data.vaultId) localStorage.setItem('sp_vault_id', data.vaultId);
    if (!hasMeaningfulDashboardSnapshot(buildDashboardVaultSnapshot()) && data.snapshot && hasMeaningfulDashboardSnapshot(data.snapshot)) {
      const s = data.snapshot;
      if (Array.isArray(s.brandProfiles) && s.brandProfiles.length > 0) {
        state.brandProfiles = normalizeSampleCampaignNames(s.brandProfiles);
        state.activeBrandId = s.activeBrandId || s.brandProfiles[0].brandId;
      }
      if (s.deletedBrandTombstones) state.deletedBrandTombstones = s.deletedBrandTombstones;
      if (s.settings) state.settings = { ...state.settings, ...s.settings };
      if (s.apiKey) state.apiKey = s.apiKey;
      if (s.geminiApiKey) state.geminiApiKey = s.geminiApiKey;
      if (s.aiModel) state.aiModel = s.aiModel;
      if (Array.isArray(s.suppressionList)) state.suppressionList = s.suppressionList;
      if (s.completedUrls) state.completedUrls = s.completedUrls;
      if (s.directoryPrefs) state.directoryPrefs = s.directoryPrefs;
      if (s.researchConfig) migrateLegacyResearchConfigToCampaigns(s.researchConfig);
      if (Array.isArray(s.masterLogs)) state.masterLogs = s.masterLogs;
      if (Array.isArray(s.errorLogs)) state.errorLogs = s.errorLogs;
      syncActiveResearchConfigMirror();
      persistAllLocalStateKeys();
    } else if (hasMeaningfulDashboardSnapshot(buildDashboardVaultSnapshot()) && !data.snapshot) {
      scheduleServerVaultBackup();
    }
  } catch (_) {}
}

let isPushingBackToExt = false;
async function syncFromExtensionBridge(isUpdateEvent = false) {
  const ping = await bridgeCall('PING', {}, 1200);
  const dot = document.getElementById('ext-bridge-dot');
  const label = document.getElementById('ext-bridge-label');
  const sub = document.getElementById('ext-bridge-sub');
  const statExt = document.getElementById('stat-ext-sync');

  if (!ping || !ping.installed) {
    state.extInstalled = false;
    state.extVersion = '';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500 flex-shrink-0';
    if (label) label.textContent = 'Web Mode Active';
    if (sub) sub.textContent = 'Install extension to auto-sync';
    if (statExt) {
      statExt.textContent = 'Web / Cloud Only';
      statExt.className = 'text-base font-bold text-amber-600 mt-0.5 block';
    }
    document.getElementById('alerts-ext-recommended-banner')?.classList.remove('hidden');
    updateVersionNotificationUI();
    return;
  }

  state.extInstalled = true;
  state.extVersion = String(ping.version || '1.3.0').replace(/^v/i, '');
  if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0';
  if (label) label.textContent = `Extension v${state.extVersion}`;
  if (sub) sub.textContent = 'Live two-way Chrome sync';
  if (statExt) {
    statExt.textContent = `Live (v${state.extVersion})`;
    statExt.className = 'text-base font-bold text-emerald-600 mt-0.5 block';
  }
  document.getElementById('alerts-ext-recommended-banner')?.classList.add('hidden');
  updateVersionNotificationUI();

  const res = await bridgeCall('GET_EXTENSION_BRIDGE_STATE', {}, 2500);
  if (res && res.success && res.state) {
    const s = res.state;
    const pushBackPayload = {};
    let needsPushBack = false;

    const mergedTombstones = { ...(state.deletedBrandTombstones || {}) };
    if (s.deletedBrandTombstones && typeof s.deletedBrandTombstones === 'object') {
      Object.entries(s.deletedBrandTombstones).forEach(([id, delAt]) => {
        if (!mergedTombstones[id] || toMsTimestamp(delAt) > toMsTimestamp(mergedTombstones[id])) {
          mergedTombstones[id] = delAt;
        }
      });
    }
    state.deletedBrandTombstones = mergedTombstones;

    const extBrands = normalizeSampleCampaignNames((Array.isArray(s.brandProfiles) ? s.brandProfiles : []).map((bp) => {
      if (!Array.isArray(bp.queue) && Array.isArray(bp.opportunityQueue)) {
        return { ...bp, queue: bp.opportunityQueue };
      }
      return bp;
    }));
    const localBrands = Array.isArray(state.brandProfiles) ? state.brandProfiles : [];
    const extHasReal = extBrands.some((b) => b && !isUntouchedSampleCampaign(b));
    const localHasReal = localBrands.some((b) => b && !isUntouchedSampleCampaign(b));

    if (extHasReal && !localHasReal) {
      state.brandProfiles = extBrands.filter((b) => {
        const id = b?.brandId || b?.campaignId;
        if (!id) return false;
        const tombMs = mergedTombstones[id] ? toMsTimestamp(mergedTombstones[id]) : 0;
        return !(tombMs > toMsTimestamp(b.updatedAt));
      });
      if (state.brandProfiles.length === 0) state.brandProfiles = extBrands;
      state.activeBrandId = s.activeBrandId || state.brandProfiles[0]?.brandId || '';
    } else if (!extHasReal && localHasReal) {
      // Freshly reinstalled extension only has untouched default sample; push dashboard campaigns back into extension
      pushBackPayload.brandProfiles = state.brandProfiles;
      pushBackPayload.activeBrandId = state.activeBrandId;
      needsPushBack = true;
    } else if (extHasReal && localHasReal) {
      let extBroughtNewData = false;
      const mergedMap = new Map();
      extBrands.forEach((eb) => {
        const id = eb?.brandId || eb?.campaignId;
        if (!id || isUntouchedSampleCampaign(eb)) return;
        const tombMs = mergedTombstones[id] ? toMsTimestamp(mergedTombstones[id]) : 0;
        if (tombMs >= toMsTimestamp(eb.updatedAt) && tombMs > 0) return;
        mergedMap.set(id, eb);
      });
      localBrands.forEach((lb) => {
        const id = lb?.brandId || lb?.campaignId;
        if (!id || isUntouchedSampleCampaign(lb)) return;
        const tombMs = mergedTombstones[id] ? toMsTimestamp(mergedTombstones[id]) : 0;
        if (tombMs >= toMsTimestamp(lb.updatedAt) && tombMs > 0) return;
        const existing = mergedMap.get(id);
        if (!existing) {
          mergedMap.set(id, lb);
          needsPushBack = true;
        } else {
          const mergedBrand = mergeBrandRecords(existing, lb);
          mergedMap.set(id, mergedBrand);
          if (JSON.stringify(mergedBrand.researchConfig) !== JSON.stringify(lb.researchConfig)) {
            extBroughtNewData = true;
          }
          if (toMsTimestamp(lb.updatedAt) > toMsTimestamp(existing.updatedAt) || JSON.stringify(mergedBrand.researchConfig) !== JSON.stringify(existing.researchConfig)) {
            needsPushBack = true;
          }
        }
      });
      const mergedList = Array.from(mergedMap.values());
      if (mergedList.length > 0) {
        state.brandProfiles = mergedList;
        if (!state.brandProfiles.some((b) => (b.brandId || b.campaignId) === state.activeBrandId)) {
          state.activeBrandId = s.activeBrandId || state.brandProfiles[0]?.brandId || '';
        }
        if (needsPushBack) {
          pushBackPayload.brandProfiles = state.brandProfiles;
          pushBackPayload.activeBrandId = state.activeBrandId;
        }
        if (extBroughtNewData && isUpdateEvent && state.user) {
          scheduleCloudStateSave({
            brandProfiles: state.brandProfiles,
            activeBrandId: state.activeBrandId,
            researchConfig: getMirroredResearchPayload(),
          });
        }
      }
    }

    if (s.researchConfig && typeof s.researchConfig === 'object') {
      const migratedFromBridge = migrateLegacyResearchConfigToCampaigns(s.researchConfig);
      if (migratedFromBridge) {
        pushBackPayload.brandProfiles = state.brandProfiles;
        needsPushBack = true;
      }
    }
    syncActiveResearchConfigMirror();
    const activeRc = getMirroredResearchPayload();
    const extResHas = hasResearchConfigData(s.researchConfig);
    const localResHas = hasResearchConfigData(activeRc);
    if (localResHas && (!extResHas || toMsTimestamp(activeRc.updatedAt) > toMsTimestamp(s.researchConfig?.updatedAt))) {
      pushBackPayload.researchConfig = activeRc;
      needsPushBack = true;
    }
    if (s.directoryPrefs) {
      const extBook = Array.isArray(s.directoryPrefs.bookmarkedIds) ? s.directoryPrefs.bookmarkedIds : [];
      const extCust = Array.isArray(s.directoryPrefs.customDirectories) ? s.directoryPrefs.customDirectories : [];
      const localBook = Array.isArray(state.directoryPrefs?.bookmarkedIds) ? state.directoryPrefs.bookmarkedIds : [];
      const localCust = Array.isArray(state.directoryPrefs?.customDirectories) ? state.directoryPrefs.customDirectories : [];
      state.directoryPrefs = {
        bookmarkedIds: Array.from(new Set([...localBook, ...extBook])),
        customDirectories: extCust.length >= localCust.length ? extCust : localCust,
      };
      if ((localBook.length > extBook.length || localCust.length > extCust.length) && extBook.length === 0 && extCust.length === 0) {
        pushBackPayload.directoryPrefs = state.directoryPrefs;
        needsPushBack = true;
      }
    }
    if (Array.isArray(s.masterLogs) && s.masterLogs.length > 0) {
      const logMap = new Map();
      [...s.masterLogs, ...(state.masterLogs || [])].forEach((l) => {
        if (!l) return;
        const k = l.id || `${l.timestamp || 0}_${l.targetUrl || ''}_${l.module || ''}`;
        if (!logMap.has(k)) logMap.set(k, l);
      });
      state.masterLogs = Array.from(logMap.values())
        .sort((a, b) => toMsTimestamp(b.timestamp) - toMsTimestamp(a.timestamp))
        .slice(0, 200);
    } else if (Array.isArray(state.masterLogs) && state.masterLogs.length > 0) {
      pushBackPayload.masterLogs = state.masterLogs;
      needsPushBack = true;
    }
    if (Array.isArray(s.errorLogs) && s.errorLogs.length > 0) {
      const errMap = new Map();
      [...s.errorLogs, ...(state.errorLogs || [])].forEach((e) => {
        if (!e) return;
        const k = e.id || `${e.timestamp || 0}_${e.url || e.domain || ''}_${e.message || ''}`;
        if (!errMap.has(k)) errMap.set(k, e);
      });
      state.errorLogs = Array.from(errMap.values())
        .sort((a, b) => toMsTimestamp(b.timestamp) - toMsTimestamp(a.timestamp))
        .slice(0, 100);
    } else if (Array.isArray(state.errorLogs) && state.errorLogs.length > 0) {
      pushBackPayload.errorLogs = state.errorLogs;
      needsPushBack = true;
    }
    if (Array.isArray(s.suppressionList) && s.suppressionList.length > 0) {
      state.suppressionList = Array.from(new Set([...(state.suppressionList || []), ...s.suppressionList]));
      localStorage.setItem('sp_suppression_list', JSON.stringify(state.suppressionList));
    } else if (Array.isArray(state.suppressionList) && state.suppressionList.length > 0) {
      pushBackPayload.suppressionList = state.suppressionList;
      needsPushBack = true;
    }
    if (s.completedUrls && typeof s.completedUrls === 'object' && Object.keys(s.completedUrls).length > 0) {
      state.completedUrls = { ...(state.completedUrls || {}), ...s.completedUrls };
      localStorage.setItem('sp_completed_urls', JSON.stringify(state.completedUrls));
    } else if (state.completedUrls && Object.keys(state.completedUrls).length > 0) {
      pushBackPayload.completedUrls = state.completedUrls;
      needsPushBack = true;
    }
    if (s.settings && typeof s.settings === 'object') {
      const extSetTs = toMsTimestamp(s.settings.updatedAt);
      const localSetTs = toMsTimestamp(state.settings?.updatedAt);
      if (extSetTs >= localSetTs || !state.settings?.updatedAt) {
        state.settings = {
          ...state.settings,
          ...s.settings,
          customModels: Array.isArray(s.settings.customModels) && s.settings.customModels.length > 0 ? s.settings.customModels : (state.settings.customModels || []),
        };
        if (!state.settings.randomnessDicts) {
          state.settings.randomnessDicts = `(app | tool | platform | software | utility)\n(founders | builders | creators | entrepreneurs | developers)\n(great | awesome | solid | fantastic | incredible)\n(quick | fast | rapid | instant)\n(laptop | mac | desktop | computer)`;
        }
        localStorage.setItem('sp_settings', JSON.stringify(state.settings));
      } else if (localSetTs > extSetTs) {
        pushBackPayload.settings = state.settings;
        needsPushBack = true;
      }
    }
    if (s.apiKey && String(s.apiKey).trim()) {
      state.apiKey = s.apiKey;
      localStorage.setItem('sp_api_key', state.apiKey);
    } else if (state.apiKey && String(state.apiKey).trim()) {
      pushBackPayload.apiKey = state.apiKey;
      needsPushBack = true;
    }
    if (s.geminiApiKey && String(s.geminiApiKey).trim()) {
      state.geminiApiKey = s.geminiApiKey;
      localStorage.setItem('sp_gemini_api_key', state.geminiApiKey);
    } else if (state.geminiApiKey && String(state.geminiApiKey).trim()) {
      pushBackPayload.geminiApiKey = state.geminiApiKey;
      needsPushBack = true;
    }
    if (s.aiModel) {
      if (!state.aiModel || extHasReal) {
        state.aiModel = s.aiModel;
        localStorage.setItem('sp_ai_model', state.aiModel);
      } else if (state.aiModel && state.aiModel !== s.aiModel && !extHasReal && localHasReal) {
        pushBackPayload.aiModel = state.aiModel;
        needsPushBack = true;
      }
    }
    if (s.ruleTwitterStripProtocol !== undefined) {
      state.ruleTwitterStripProtocol = s.ruleTwitterStripProtocol !== false;
    }

    const extHasValidAuth = Boolean(s.authSession && hasValidDashboardAuthSession(s.authSession));
    const localHasValidAuth = Boolean(state.session && hasValidDashboardAuthSession(state.session));
    const extAuthTs = extHasValidAuth ? getDashSessionTimestampMs(s.authSession) : 0;
    const localAuthTs = localHasValidAuth ? getDashSessionTimestampMs(state.session) : 0;
    const extTokenChanged = extHasValidAuth && localHasValidAuth &&
      (s.authSession.accessToken || s.authSession.token) !== (state.session.accessToken || state.session.token) &&
      extAuthTs >= localAuthTs;

    if (extHasValidAuth && (!localHasValidAuth || extTokenChanged)) {
      const prevUserId = state.user?.id || null;
      state.session = s.authSession;
      state.user = s.authSession.user;
      localStorage.setItem('authUserSession', JSON.stringify(s.authSession));
      localStorage.setItem('cf_auth_session', JSON.stringify(s.authSession));
      const bridgeClaim = hasValidDashboardEntitlement(s.entitlementClaim, s.authSession.user.id, s.authSession.user.email)
        ? s.entitlementClaim
        : (hasValidDashboardEntitlement(s.authSession.entitlement, s.authSession.user.id, s.authSession.user.email) ? s.authSession.entitlement : null);
      if (bridgeClaim) {
        state.entitlement = bridgeClaim;
        localStorage.setItem('sp_entitlement_claim', JSON.stringify(bridgeClaim));
      }
      renderAccountUI();
      if (!prevUserId || extTokenChanged) {
        checkFreshUserTier(s.authSession).catch(() => {});
      }
    } else if (localHasValidAuth && (!extHasValidAuth || (extAuthTs < localAuthTs && (s.authSession?.accessToken || s.authSession?.token) !== (state.session.accessToken || state.session.token)))) {
      pushBackPayload.authSession = state.session;
      if (state.entitlement) pushBackPayload.entitlementClaim = state.entitlement;
      needsPushBack = true;
    } else if (s.entitlementClaim && state.user && hasValidDashboardEntitlement(s.entitlementClaim, state.user.id, state.user.email)) {
      state.entitlement = s.entitlementClaim;
      state.user.role = String(s.entitlementClaim.role || state.user.role || 'user').toLowerCase() === 'admin' ? 'admin' : (state.user.role || 'user');
      state.user.tier = normalizeDashboardTier(s.entitlementClaim.tier, state.user.role, state.user.email);
      localStorage.setItem('sp_entitlement_claim', JSON.stringify(s.entitlementClaim));
      renderAccountUI();
    }

    persistAllLocalStateKeys();
    if (needsPushBack && !isPushingBackToExt) {
      isPushingBackToExt = true;
      bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', pushBackPayload, 2500)
        .catch(() => {})
        .finally(() => {
          setTimeout(() => { isPushingBackToExt = false; }, 800);
        });
    }

    if (isUpdateEvent) renderAll();
  }
}

async function authedDashboardFetch(url, options = {}) {
  let token = state.session?.accessToken || state.session?.token || '';
  const buildHeaders = (tk) => ({
    ...(options.headers || {}),
    ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
  });

  if (token && isJwtExpiredDash(token, 30)) {
    if (!state.session?.refreshToken) {
      clearDashboardAuthSession();
      notifyExtensionAuthCleared('expired_no_refresh', token);
      token = '';
    } else {
      try {
        const cfgRes = await fetch('/api/config');
        const cfg = cfgRes.ok ? await cfgRes.json().catch(() => ({})) : {};
        const refreshed = await refreshDashboardSupabaseToken(state.session, cfg?.supabase?.url, cfg?.supabase?.anonKey);
        if (refreshed?.accessToken) {
          token = refreshed.accessToken;
          state.session.accessToken = token;
          state.session.token = token;
          state.session.refreshToken = refreshed.refreshToken;
          state.session.updatedAt = new Date().toISOString();
          localStorage.setItem('authUserSession', JSON.stringify(state.session));
          localStorage.setItem('cf_auth_session', JSON.stringify(state.session));
          if (state.extInstalled) {
            bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', { authSession: state.session }).catch(() => {});
          }
        } else if (refreshed?.rejected) {
          clearDashboardAuthSession();
          notifyExtensionAuthCleared('refresh_rejected', token);
          token = '';
        }
      } catch (_) {}
    }
  }

  let res = await fetch(url, { ...options, headers: buildHeaders(token) });
  if (res.status === 401 && state.session?.refreshToken) {
    try {
      const cfgRes = await fetch('/api/config');
      const cfg = cfgRes.ok ? await cfgRes.json().catch(() => ({})) : {};
      const refreshed = await refreshDashboardSupabaseToken(state.session, cfg?.supabase?.url, cfg?.supabase?.anonKey);
      if (refreshed?.accessToken) {
        token = refreshed.accessToken;
        state.session.accessToken = token;
        state.session.token = token;
        state.session.refreshToken = refreshed.refreshToken;
        state.session.updatedAt = new Date().toISOString();
        localStorage.setItem('authUserSession', JSON.stringify(state.session));
        localStorage.setItem('cf_auth_session', JSON.stringify(state.session));
        if (state.extInstalled) {
          bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', { authSession: state.session }).catch(() => {});
        }
        res = await fetch(url, { ...options, headers: buildHeaders(token) });
      } else if (refreshed?.rejected) {
        clearDashboardAuthSession();
        notifyExtensionAuthCleared('refresh_rejected', token);
      }
    } catch (_) {}
  }

  if (res.status === 401 && token && state.session) {
    try {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const errBody = await res.clone().json().catch(() => ({}));
        const errMsg = String(errBody?.error || '').toLowerCase();
        const isServerUnconfigured = errMsg.includes('not configured') || errMsg.includes('unavailable');
        if (!isServerUnconfigured) {
          clearDashboardAuthSession();
          notifyExtensionAuthCleared('dashboard_401', token);
        }
      }
    } catch (_) {}
  }
  return res;
}

function buildConsolidatedDashboardSettings() {
  return {
    ...(state.settings || {}),
    apiKey: state.apiKey || '',
    geminiApiKey: state.geminiApiKey || '',
    aiModel: state.aiModel || 'anthropic/claude-3.5-haiku',
    suppressionList: Array.isArray(state.suppressionList) ? state.suppressionList : [],
    ruleTwitterStripProtocol: state.ruleTwitterStripProtocol !== false,
    activeBrandId: state.activeBrandId || '',
    updatedAt: state.settings?.updatedAt || new Date().toISOString(),
  };
}

function persistAllLocalStateKeys() {
  try {
    syncActiveResearchConfigMirror();
    localStorage.setItem('campaignProfiles', JSON.stringify(state.brandProfiles || []));
    localStorage.setItem('brandProfiles', JSON.stringify(state.brandProfiles || []));
    if (state.activeBrandId) {
      localStorage.setItem('activeCampaignId', state.activeBrandId);
      localStorage.setItem('activeBrandId', state.activeBrandId);
    }
    localStorage.setItem('sp_deleted_brand_tombstones', JSON.stringify(state.deletedBrandTombstones || {}));
    localStorage.setItem('sp_research_config', JSON.stringify(getMirroredResearchPayload()));
    localStorage.setItem('sp_directory_prefs', JSON.stringify(state.directoryPrefs || {}));
    localStorage.setItem('sp_master_logs', JSON.stringify(state.masterLogs || []));
    localStorage.setItem('sp_error_logs', JSON.stringify(state.errorLogs || []));
    localStorage.setItem('sp_suppression_list', JSON.stringify(state.suppressionList || []));
    localStorage.setItem('sp_completed_urls', JSON.stringify(state.completedUrls || {}));
    localStorage.setItem('sp_settings', JSON.stringify(state.settings || {}));
    localStorage.setItem('sp_api_key', state.apiKey || '');
    localStorage.setItem('sp_gemini_api_key', state.geminiApiKey || '');
    localStorage.setItem('sp_ai_model', state.aiModel || 'anthropic/claude-3.5-haiku');
    localStorage.setItem('sp_rule_twitter_strip_protocol', String(state.ruleTwitterStripProtocol !== false));
    const snap = buildDashboardVaultSnapshot();
    if (hasMeaningfulDashboardSnapshot(snap)) {
      localStorage.setItem('sp_extension_vault_v1', JSON.stringify(snap));
    }
  } catch (_) {}
}

async function persistStateToBridgeAndLocal(partial = {}) {
  try {
    syncActiveResearchConfigMirror();
    if (partial.brandProfiles || partial.researchConfig) {
      localStorage.setItem('campaignProfiles', JSON.stringify(state.brandProfiles));
      localStorage.setItem('brandProfiles', JSON.stringify(state.brandProfiles));
    }
    if (partial.activeBrandId) {
      localStorage.setItem('activeCampaignId', state.activeBrandId);
      localStorage.setItem('activeBrandId', state.activeBrandId);
    }
    if (partial.deletedBrandTombstones || partial.deletedBrandIds) {
      localStorage.setItem('sp_deleted_brand_tombstones', JSON.stringify(state.deletedBrandTombstones || {}));
    }
    if (partial.researchConfig || partial.activeBrandId) {
      localStorage.setItem('sp_research_config', JSON.stringify(getMirroredResearchPayload()));
    }
    if (partial.directoryPrefs) {
      localStorage.setItem('sp_directory_prefs', JSON.stringify(state.directoryPrefs));
    }
    if (partial.masterLogs !== undefined) {
      localStorage.setItem('sp_master_logs', JSON.stringify(state.masterLogs || []));
    }
    if (partial.errorLogs !== undefined) {
      localStorage.setItem('sp_error_logs', JSON.stringify(state.errorLogs || []));
    }
    if (partial.suppressionList !== undefined) {
      localStorage.setItem('sp_suppression_list', JSON.stringify(state.suppressionList));
    }
    if (partial.completedUrls !== undefined) {
      localStorage.setItem('sp_completed_urls', JSON.stringify(state.completedUrls || {}));
    }
    if (partial.settings !== undefined) {
      localStorage.setItem('sp_settings', JSON.stringify(state.settings || {}));
    }
    if (partial.apiKey !== undefined) {
      localStorage.setItem('sp_api_key', state.apiKey || '');
    }
    if (partial.geminiApiKey !== undefined) {
      localStorage.setItem('sp_gemini_api_key', state.geminiApiKey || '');
    }
    if (partial.aiModel !== undefined) {
      localStorage.setItem('sp_ai_model', state.aiModel || 'anthropic/claude-3.5-haiku');
    }
    if (partial.ruleTwitterStripProtocol !== undefined) {
      localStorage.setItem('sp_rule_twitter_strip_protocol', String(partial.ruleTwitterStripProtocol !== false));
    }
    const snap = buildDashboardVaultSnapshot();
    if (hasMeaningfulDashboardSnapshot(snap)) {
      localStorage.setItem('sp_extension_vault_v1', JSON.stringify(snap));
    }
  } catch (_) {}

  if (state.extInstalled) {
    await bridgeCall('SAVE_EXTENSION_BRIDGE_STATE', partial);
  }
  scheduleServerVaultBackup();
  saveCloudWorkspacePrefs();
  scheduleCloudStateSave(partial);
}

async function loadCloudUserState() {
  if (!state.user?.id) return;
  const token = state.session?.accessToken || state.session?.token || '';
  if (!token) return;

  try {
    const res = await authedDashboardFetch(`/api/user/cloud-state?userId=${encodeURIComponent(state.user.id)}`);
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.success) return;

    isApplyingRemoteCloudState = true;
    try {
      // 1. Merge deleted brand tombstones
      const mergedTombstones = { ...(state.deletedBrandTombstones || {}) };
      if (data.deletedBrandTombstones && typeof data.deletedBrandTombstones === 'object') {
        Object.entries(data.deletedBrandTombstones).forEach(([id, delAt]) => {
          if (!mergedTombstones[id] || toMsTimestamp(delAt) > toMsTimestamp(mergedTombstones[id])) {
            mergedTombstones[id] = delAt;
          }
        });
      }
      state.deletedBrandTombstones = mergedTombstones;

      // 2. Merge Brands (LWW by updatedAt, respecting tombstones & untouched default sample)
      const remoteBrands = Array.isArray(data.brands) ? data.brands : [];
      const localBrands = Array.isArray(state.brandProfiles) ? state.brandProfiles : [];
      const localIsUntouchedSample =
        localBrands.length === 1 &&
        isUntouchedSampleCampaign(localBrands[0]);

      const brandMap = new Map();
      if (!(localIsUntouchedSample && remoteBrands.length > 0)) {
        localBrands.forEach((b) => {
          const id = b?.brandId || b?.campaignId;
          if (!id) return;
          if (mergedTombstones[id] && toMsTimestamp(mergedTombstones[id]) >= toMsTimestamp(b.updatedAt)) return;
          brandMap.set(id, b);
        });
      }
      remoteBrands.forEach((rb) => {
        const id = rb?.brandId || rb?.campaignId;
        if (!id) return;
        if (mergedTombstones[id] && toMsTimestamp(mergedTombstones[id]) >= toMsTimestamp(rb.updatedAt)) return;
        const normalizedRemote = {
          ...rb,
          queue: Array.isArray(rb.queue) ? rb.queue : (Array.isArray(rb.opportunityQueue) ? rb.opportunityQueue : []),
        };
        const existing = brandMap.get(id);
        if (!existing) {
          brandMap.set(id, normalizedRemote);
        } else {
          brandMap.set(id, mergeBrandRecords(existing, normalizedRemote));
        }
      });

      const mergedBrands = normalizeSampleCampaignNames(Array.from(brandMap.values()));
      if (mergedBrands.length > 0) {
        state.brandProfiles = mergedBrands;
      }

      // 3. Merge User Settings (LWW by updatedAt)
      if (data.userSettings && typeof data.userSettings === 'object') {
        const rs = data.userSettings;
        const remoteTs = toMsTimestamp(rs.updatedAt);
        const localTs = toMsTimestamp(state.settings?.updatedAt);
        if (remoteTs >= localTs || !state.settings?.updatedAt) {
          if (rs.apiKey !== undefined) state.apiKey = String(rs.apiKey || '');
          if (rs.geminiApiKey !== undefined) state.geminiApiKey = String(rs.geminiApiKey || '');
          if (rs.aiModel) state.aiModel = String(rs.aiModel);
          if (Array.isArray(rs.suppressionList)) state.suppressionList = rs.suppressionList;
          if (rs.ruleTwitterStripProtocol !== undefined) state.ruleTwitterStripProtocol = rs.ruleTwitterStripProtocol !== false;
          state.settings = {
            ...(state.settings || {}),
            formActionMode: rs.formActionMode || state.settings.formActionMode || 'fill-only',
            slowMode: rs.slowMode !== undefined ? Boolean(rs.slowMode) : Boolean(state.settings.slowMode),
            financialDetection: rs.financialDetection !== undefined ? rs.financialDetection !== false : state.settings.financialDetection !== false,
            customModels: Array.isArray(rs.customModels) ? rs.customModels : (state.settings.customModels || []),
            jevEnabled: rs.jevEnabled !== undefined ? Boolean(rs.jevEnabled) : Boolean(state.settings.jevEnabled),
            jevModel: rs.jevModel || state.settings.jevModel || 'typesafe/jev-1.14',
            captchaApiKey: rs.captchaApiKey !== undefined ? String(rs.captchaApiKey || '') : (state.settings.captchaApiKey || ''),
            safetyDelay: rs.safetyDelay !== undefined ? Number(rs.safetyDelay) : (state.settings.safetyDelay ?? 3),
            randomnessLevel: rs.randomnessLevel !== undefined
              ? migrateDashboardRandomnessLevel(rs.randomnessLevel, Boolean(rs.sp_randomness_v2_migrated))
              : migrateDashboardRandomnessLevel(state.settings.randomnessLevel ?? 3, Boolean(state.settings.sp_randomness_v2_migrated)),
            sp_randomness_v2_migrated: true,
            randomnessSynonyms: rs.randomnessSynonyms !== undefined ? rs.randomnessSynonyms !== false : state.settings.randomnessSynonyms !== false,
            randomnessDicts: rs.randomnessDicts || state.settings.randomnessDicts || DEFAULT_RANDOMNESS_DICTS,
            companionWidgetEnabled: rs.companionWidgetEnabled !== undefined ? rs.companionWidgetEnabled !== false : (rs.floatingWidgetEnabled !== undefined ? rs.floatingWidgetEnabled !== false : state.settings.companionWidgetEnabled !== false),
            companionShortcutsEnabled: rs.companionShortcutsEnabled !== undefined ? rs.companionShortcutsEnabled !== false : state.settings.companionShortcutsEnabled !== false,
            aiContextMatching: rs.aiContextMatching !== undefined ? rs.aiContextMatching !== false : state.settings.aiContextMatching !== false,
            simulateKeystrokes: rs.simulateKeystrokes !== undefined ? Boolean(rs.simulateKeystrokes) : Boolean(state.settings.simulateKeystrokes),
            autoVariation: rs.autoVariation !== undefined ? Boolean(rs.autoVariation) : Boolean(state.settings.autoVariation),
            autoSuppress: rs.autoSuppress !== undefined ? rs.autoSuppress !== false : state.settings.autoSuppress !== false,
            postingModuleOrder: Array.isArray(rs.postingModuleOrder) ? rs.postingModuleOrder : state.settings.postingModuleOrder,
            disabledPostingModules: Array.isArray(rs.disabledPostingModules) ? rs.disabledPostingModules : state.settings.disabledPostingModules,
            updatedAt: rs.updatedAt || new Date().toISOString(),
          };
          if (rs.activeBrandId && state.brandProfiles.some((b) => b.brandId === rs.activeBrandId || b.campaignId === rs.activeBrandId)) {
            state.activeBrandId = rs.activeBrandId;
          }
        }
      }

      if (!state.brandProfiles.some((b) => b.brandId === state.activeBrandId || b.campaignId === state.activeBrandId)) {
        state.activeBrandId = state.brandProfiles[0]?.brandId || state.brandProfiles[0]?.campaignId || '';
      }

      // 4. Merge Completed URLs
      if (data.completedUrls && typeof data.completedUrls === 'object') {
        state.completedUrls = { ...data.completedUrls, ...(state.completedUrls || {}) };
      }

      // 5. Merge Workspace Prefs
      if (data.workspacePrefs && typeof data.workspacePrefs === 'object') {
        const p = data.workspacePrefs;
        if (Array.isArray(p.bookmarked_directory_ids) && p.bookmarked_directory_ids.length) {
          state.directoryPrefs.bookmarkedIds = Array.from(new Set([...(state.directoryPrefs.bookmarkedIds || []), ...p.bookmarked_directory_ids]));
        }
        if (Array.isArray(p.custom_directories) && p.custom_directories.length && (!state.directoryPrefs.customDirectories || state.directoryPrefs.customDirectories.length === 0)) {
          state.directoryPrefs.customDirectories = p.custom_directories;
        }
        if (p.research_config && typeof p.research_config === 'object' && Object.keys(p.research_config).length > 0) {
          migrateLegacyResearchConfigToCampaigns(p.research_config);
        }
      }
      syncActiveResearchConfigMirror();

      // 6. Merge Master & Error Logs
      if (Array.isArray(data.masterLogs) && data.masterLogs.length > 0) {
        const logMap = new Map();
        [...data.masterLogs, ...(state.masterLogs || [])].forEach((l) => {
          if (!l) return;
          const k = l.id || `${l.timestamp || 0}_${l.targetUrl || ''}_${l.module || ''}`;
          if (!logMap.has(k)) logMap.set(k, l);
        });
        state.masterLogs = Array.from(logMap.values())
          .sort((a, b) => toMsTimestamp(b.timestamp) - toMsTimestamp(a.timestamp))
          .slice(0, 200);
      }
      if (Array.isArray(data.errorLogs) && data.errorLogs.length > 0) {
        const errMap = new Map();
        [...data.errorLogs, ...(state.errorLogs || [])].forEach((e) => {
          if (!e) return;
          const k = e.id || `${e.timestamp || 0}_${e.url || e.domain || ''}_${e.message || ''}`;
          if (!errMap.has(k)) errMap.set(k, e);
        });
        state.errorLogs = Array.from(errMap.values())
          .sort((a, b) => toMsTimestamp(b.timestamp) - toMsTimestamp(a.timestamp))
          .slice(0, 100);
      }

      persistAllLocalStateKeys();
    } finally {
      isApplyingRemoteCloudState = false;
    }
  } catch (_) {}
}

function scheduleCloudStateSave(partial = {}) {
  if (!state.user?.id || isApplyingRemoteCloudState) return;
  const token = state.session?.accessToken || state.session?.token || '';
  if (!token) return;

  if (!pendingCloudPatch) pendingCloudPatch = { userId: state.user.id };
  pendingCloudPatch.userId = state.user.id;

  if (partial.brandProfiles || partial.deletedBrandIds || partial.researchConfig !== undefined) {
    pendingCloudPatch.brands = state.brandProfiles || [];
  }
  if (Array.isArray(partial.deletedBrandIds) && partial.deletedBrandIds.length > 0) {
    pendingCloudPatch.deletedBrandIds = Array.from(new Set([...(pendingCloudPatch.deletedBrandIds || []), ...partial.deletedBrandIds]));
  }
  if (
    partial.settings !== undefined ||
    partial.apiKey !== undefined ||
    partial.geminiApiKey !== undefined ||
    partial.aiModel !== undefined ||
    partial.suppressionList !== undefined ||
    partial.ruleTwitterStripProtocol !== undefined ||
    partial.activeBrandId !== undefined
  ) {
    pendingCloudPatch.userSettings = buildConsolidatedDashboardSettings();
  }
  if (partial.clearCompletedUrls) {
    pendingCloudPatch.clearCompletedUrls = true;
    delete pendingCloudPatch.completedUrls;
    delete pendingCloudPatch.deletedCompletedIds;
  } else {
    if (Array.isArray(partial.deletedCompletedIds) && partial.deletedCompletedIds.length > 0 && !pendingCloudPatch.clearCompletedUrls) {
      pendingCloudPatch.deletedCompletedIds = Array.from(new Set([...(pendingCloudPatch.deletedCompletedIds || []), ...partial.deletedCompletedIds]));
    }
    if (partial.completedUrls !== undefined && !pendingCloudPatch.clearCompletedUrls) {
      pendingCloudPatch.completedUrls = state.completedUrls || {};
    }
  }
  if (partial.directoryPrefs !== undefined || partial.researchConfig !== undefined || partial.activeBrandId !== undefined) {
    pendingCloudPatch.workspacePrefs = {
      bookmarked_directory_ids: state.directoryPrefs?.bookmarkedIds || [],
      custom_directories: state.directoryPrefs?.customDirectories || [],
      research_config: getMirroredResearchPayload(),
      updated_at: new Date().toISOString(),
    };
  }
  if (partial.clearMasterLogs) {
    pendingCloudPatch.clearMasterLogs = true;
    delete pendingCloudPatch.masterLogs;
  } else if (partial.masterLogs !== undefined && !pendingCloudPatch.clearMasterLogs) {
    pendingCloudPatch.masterLogs = state.masterLogs || [];
  }
  if (partial.clearErrorLogs) {
    pendingCloudPatch.clearErrorLogs = true;
    delete pendingCloudPatch.errorLogs;
  } else if (partial.errorLogs !== undefined && !pendingCloudPatch.clearErrorLogs) {
    pendingCloudPatch.errorLogs = state.errorLogs || [];
  }

  clearTimeout(cloudStateSaveTimer);
  cloudStateSaveTimer = setTimeout(async () => {
    const patchToSend = pendingCloudPatch;
    pendingCloudPatch = null;
    if (!patchToSend) return;
    try {
      const saveRes = await authedDashboardFetch('/api/user/cloud-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchToSend),
      });
      const saveData = await saveRes.json().catch(() => null);
      if (saveData && typeof saveData.storageUsedBytes === 'number') {
        state.storageUsedBytes = Math.max(0, saveData.storageUsedBytes);
        if (typeof saveData.storageLimitBytes === 'number' && saveData.storageLimitBytes > 0) {
          state.storageLimitBytes = saveData.storageLimitBytes;
        }
        renderStorageUsageMeter();
      }
      if (!saveRes.ok) {
        console.warn('[Dashboard] Cloud state save failed:', saveData?.error || `HTTP ${saveRes.status}`);
        if (saveRes.status === 413 && saveData?.quotaExceeded) {
          showToast(saveData.error || 'Storage quota exceeded. Clear old chats, Vault drafts, or images.', 'error');
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Cloud state save error:', err?.message || err);
    }
  }, 450);
}

async function loadCloudWorkspacePrefs() {
  if (!state.user?.id) return;
  try {
    const res = await authedDashboardFetch(`/api/user/workspace?userId=${encodeURIComponent(state.user.id)}`);
    const data = await res.json();
    if (data.success && data.prefs) {
      const p = data.prefs;
      if (Array.isArray(p.bookmarked_directory_ids) && p.bookmarked_directory_ids.length) {
        state.directoryPrefs.bookmarkedIds = Array.from(new Set([...state.directoryPrefs.bookmarkedIds, ...p.bookmarked_directory_ids]));
      }
      if (Array.isArray(p.custom_directories) && p.custom_directories.length && state.directoryPrefs.customDirectories.length === 0) {
        state.directoryPrefs.customDirectories = p.custom_directories;
      }
      if (p.research_config && typeof p.research_config === 'object' && Object.keys(p.research_config).length > 0) {
        migrateLegacyResearchConfigToCampaigns(p.research_config);
      }
      syncActiveResearchConfigMirror();
    }
  } catch (_) {}
}

let cloudSaveTimer = null;
function saveCloudWorkspacePrefs() {
  if (!state.user?.id || isApplyingRemoteCloudState) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      await authedDashboardFetch('/api/user/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: state.user.id,
          bookmarked_directory_ids: state.directoryPrefs.bookmarkedIds,
          custom_directories: state.directoryPrefs.customDirectories,
          research_config: getMirroredResearchPayload(),
        }),
      });
    } catch (_) {}
  }, 600);
}

// ============================================================================
// Navigation & Shared UI Helpers
// ============================================================================
const SECTION_LABELS = {
  account: 'Account',
  content: 'Products',
  'ai-assistant': 'AI Assistant',
  research: 'Opportunities',
  directories: 'Opportunities',
  reports: 'Reports & Activity',
  'ai-settings': 'Settings',
  download: 'Download Extension',
  'new-features': 'New Features',
  contact: 'Contact Support',
  'suggest-feature': 'Suggest a Feature',
};

const VALID_OPPORTUNITIES_SUBTABS = ['keywords', 'alerts', 'directories', 'contact-form'];

function normalizeOpportunitiesSubtab(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'directories') return 'directories';
  if (clean === 'contact-form' || clean === 'contactform' || clean === 'contact-forms') return 'contact-form';
  if (clean === 'alerts' || clean === 'feed' || clean === 'threads' || clean === 'google-alerts' || clean === 'search' || clean === 'commenting') {
    return 'alerts';
  }
  if (clean === 'keywords' || clean === 'competitors') return 'keywords';
  return 'keywords';
}

function switchOpportunitiesSubtab(subtab, updateHash = false) {
  const nextTab = normalizeOpportunitiesSubtab(subtab);
  state.activeOpportunitiesSubtab = nextTab;

  document.querySelectorAll('.opp-subtab[data-otab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.otab === nextTab);
  });

  const keywordsPanel = document.getElementById('opp-panel-keywords');
  const alertsPanel = document.getElementById('opp-panel-feed');
  const directoriesPanel = document.getElementById('opp-panel-directories');
  const contactFormPanel = document.getElementById('opp-panel-contact-form');
  if (keywordsPanel) keywordsPanel.classList.toggle('hidden', nextTab !== 'keywords');
  if (alertsPanel) alertsPanel.classList.toggle('hidden', nextTab !== 'alerts');
  if (directoriesPanel) directoriesPanel.classList.toggle('hidden', nextTab !== 'directories');
  if (contactFormPanel) contactFormPanel.classList.toggle('hidden', nextTab !== 'contact-form');

  if (updateHash && state.activeSection === 'research') {
    history.replaceState(null, '', nextTab === 'keywords' ? '#opportunities' : `#opportunities/${nextTab}`);
  }

  if (nextTab === 'directories') {
    renderDirectoriesTable();
  } else {
    renderResearchSection();
  }
}

function switchSection(sectionId, updateHash = true) {
  let normalizedId = sectionId;
  if (normalizedId === 'campaigns') normalizedId = 'content';
  if (normalizedId === 'assistant' || normalizedId === 'ai') normalizedId = 'ai-assistant';
  if (normalizedId === 'opportunities') normalizedId = 'research';
  if (normalizedId === 'directories') {
    normalizedId = 'research';
    state.activeOpportunitiesSubtab = 'directories';
  }

  state.activeSection = normalizedId;
  document.querySelectorAll('.dashboard-section').forEach((s) => s.classList.add('hidden'));
  const target = document.getElementById(`section-${normalizedId}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === normalizedId);
  });

  const bc = document.getElementById('topbar-breadcrumb-current');
  if (bc) bc.textContent = SECTION_LABELS[normalizedId] || normalizedId;

  if (updateHash) {
    history.replaceState(null, '', `#${normalizedId}`);
  }
  toggleMobileSidebar(false);

  if (normalizedId === 'content') {
    renderGlobalCampaignSelectors();
    renderContentEditor();
  }
  else if (normalizedId === 'ai-assistant') {
    renderGlobalCampaignSelectors();
    renderAiAssistantSection();
  }
  else if (normalizedId === 'research') {
    renderGlobalCampaignSelectors();
    switchOpportunitiesSubtab(state.activeOpportunitiesSubtab || 'keywords', false);
    renderDirectoriesTable();
  }
  else if (normalizedId === 'reports') renderReportsView();
  else if (normalizedId === 'ai-settings') renderAiSettingsView();
  else if (normalizedId === 'download') renderDownloadSection();
  else if (normalizedId === 'new-features') renderChangelogSection();
  else if (normalizedId === 'contact' || normalizedId === 'suggest-feature') renderContactAndFeatureForms();
}

function toggleMobileSidebar(open) {
  const aside = document.getElementById('dashboard-sidebar');
  const backdrop = document.getElementById('mobile-sidebar-backdrop');
  if (!aside) return;
  if (open) {
    aside.classList.remove('-translate-x-full');
    backdrop?.classList.remove('hidden');
  } else {
    aside.classList.add('-translate-x-full');
    backdrop?.classList.add('hidden');
  }
}

function renderAll() {
  renderAccountUI();
  renderGlobalCampaignSelectors();
  renderContentEditor();
  renderAiAssistantSection();
  renderResearchSection();
  renderDirectoriesTable();
  renderReportsView();
  renderAiSettingsView();
  renderDownloadSection();
  renderChangelogSection();
  renderContactAndFeatureForms();
  updateVersionNotificationUI();
  enhanceAllSelects();
}

function showToast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast-enter px-4 py-2.5 rounded-lg text-xs font-bold text-white shadow-lg flex items-center gap-2 ${type === 'error' ? 'bg-red-600' : 'bg-[#2a2d36] border border-[#2a2d36]'}`;
  el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i><span>${escapeHtml(message)}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 1. Account & Auth UI
// ============================================================================
function setupAuthListeners() {
  document.getElementById('btn-login-trigger')?.addEventListener('click', () => {
    window.location.href = '/login.html';
  });
  document.getElementById('btn-signout')?.addEventListener('click', () => {
    clearDashboardAuthSession();
    if (state.extInstalled) {
      bridgeCall('CLEAR_AUTH_SESSION', { reason: 'explicit_signout' }).catch(() => {});
    }
  });
  document.getElementById('btn-refresh-status')?.addEventListener('click', async () => {
    const s = getStoredSession();
    if (s) await checkFreshUserTier(s);
    await syncFromExtensionBridge(false);
    await loadCloudUserState();
    await loadDirectoriesCatalog();
    renderAll();
    showToast('Workspace & license synced!');
  });
  if (!state.billingInterval) state.billingInterval = 'monthly';
  const triggerCheckout = (plan = 'pro', interval = state.billingInterval || 'monthly') => {
    const email = state.user?.email || '';
    const userId = state.user?.id || '';
    const resolvedPlan = plan === 'agency' || plan === 'unlimited' ? 'agency' : (plan === 'studio' ? 'studio' : 'pro');
    const resolvedInterval = interval === 'yearly' ? 'yearly' : 'monthly';
    const returnUrl = encodeURIComponent(`${window.location.origin}/dashboard?payment=success&plan=${resolvedPlan}&interval=${resolvedInterval}`);
    window.location.href = `/api/dodo/checkout?plan=${resolvedPlan}&interval=${resolvedInterval}&email=${encodeURIComponent(email)}&userId=${encodeURIComponent(userId)}&returnUrl=${returnUrl}`;
  };
  document.getElementById('btn-hero-checkout')?.addEventListener('click', () => triggerCheckout('pro'));
  document.getElementById('btn-banner-checkout')?.addEventListener('click', () => triggerCheckout('pro'));
  document.getElementById('btn-hero-studio-checkout')?.addEventListener('click', () => triggerCheckout('studio'));
  document.getElementById('btn-banner-studio-checkout')?.addEventListener('click', () => triggerCheckout('studio'));
  document.getElementById('btn-hero-unlimited-checkout')?.addEventListener('click', () => triggerCheckout('agency'));
  document.getElementById('btn-banner-unlimited-checkout')?.addEventListener('click', () => triggerCheckout('agency'));
  updateDashboardPricingLabels();
}

function updateDashboardPricingLabels() {
  const isYearly = state.billingInterval === 'yearly';
  const mBtn = document.getElementById('btn-dash-interval-monthly');
  const yBtn = document.getElementById('btn-dash-interval-yearly');
  if (mBtn && yBtn) {
    mBtn.className = !isYearly
      ? 'px-3 py-1.5 rounded-md text-xs font-bold bg-[#fdcb6e] text-black transition'
      : 'px-3 py-1.5 rounded-md text-xs font-bold text-slate-200 hover:text-white transition';
    yBtn.className = isYearly
      ? 'px-3 py-1.5 rounded-md text-xs font-bold bg-[#fdcb6e] text-black transition'
      : 'px-3 py-1.5 rounded-md text-xs font-bold text-slate-200 hover:text-white transition';
  }
  const proPrice = isYearly ? '$69/yr' : '$9/mo';
  const studioPrice = isYearly ? '$239/yr' : '$29/mo';
  const agencyPrice = isYearly ? '$489/yr' : '$59/mo';

  const heroProSpan = document.querySelector('#btn-hero-checkout span');
  if (heroProSpan) heroProSpan.textContent = `👑 Upgrade Pro (${proPrice})`;
  const heroStudioSpan = document.querySelector('#btn-hero-studio-checkout span');
  if (heroStudioSpan) heroStudioSpan.textContent = `⚡ Upgrade Studio (${studioPrice})`;
  const heroAgencySpan = document.querySelector('#btn-hero-unlimited-checkout span');
  if (heroAgencySpan) heroAgencySpan.textContent = `🚀 Go Agency (${agencyPrice})`;

  const bannerPro = document.getElementById('label-banner-pro');
  if (bannerPro) bannerPro.textContent = `Pro (${proPrice} • 5 Products • 250 MB)`;
  const bannerStudio = document.getElementById('label-banner-studio');
  if (bannerStudio) bannerStudio.textContent = `⚡ Studio (${studioPrice} • 15 Products • 1 GB)`;
  const bannerAgency = document.getElementById('label-banner-agency');
  if (bannerAgency) bannerAgency.textContent = `🚀 Agency (${agencyPrice} • 50 Products • 5 GB)`;
}

window.setDashboardBillingInterval = function (interval) {
  state.billingInterval = interval === 'yearly' ? 'yearly' : 'monthly';
  updateDashboardPricingLabels();
};

function formatBytesHuman(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

function renderStorageUsageMeter() {
  const used = Math.max(0, Number(state.storageUsedBytes) || 0);
  const resolvedTier = state.isUnlimited ? 'unlimited' : (state.isStudio ? 'studio' : (state.isPro ? 'pro' : 'basic'));
  const limit = Math.max(1, Number(state.storageLimitBytes) || getStorageQuotaBytesForTier(resolvedTier));
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const text = `${formatBytesHuman(used)} / ${formatBytesHuman(limit)}`;

  const statEl = document.getElementById('stat-storage-meter');
  const barEl = document.getElementById('stat-storage-bar');
  const galEl = document.getElementById('gallery-storage-meter');
  if (statEl) statEl.textContent = text;
  if (barEl) {
    barEl.style.width = `${pct}%`;
    barEl.className = pct >= 90
      ? 'h-full bg-red-600 rounded-full transition-all'
      : (pct >= 75 ? 'h-full bg-amber-500 rounded-full transition-all' : 'h-full bg-[#6c5ce7] rounded-full transition-all');
  }
  if (galEl) {
    galEl.textContent = `Storage: ${text} (${pct}%)`;
  }
}

async function loadDashboardStorageUsage() {
  const token = state.session?.accessToken || state.session?.token || '';
  if (!token) return;
  try {
    const res = await authedDashboardFetch('/api/user/media/usage');
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.success) {
      if (typeof data.storageUsedBytes === 'number') state.storageUsedBytes = Math.max(0, data.storageUsedBytes);
      if (typeof data.storageLimitBytes === 'number' && data.storageLimitBytes > 0) state.storageLimitBytes = data.storageLimitBytes;
      renderStorageUsageMeter();
    }
  } catch (_) {}
}

function renderAccountUI() {
  const user = state.user;
  const customCount = getCustomCampaignsCount();
  const campCountEl = document.getElementById('stat-campaigns');

  if (!user) {
    state.isPro = false;
    state.isStudio = false;
    state.isUnlimited = false;
    state.storageLimitBytes = getStorageQuotaBytesForTier('basic');
    if (campCountEl) campCountEl.textContent = `${customCount} / 1 Custom`;
    renderStorageUsageMeter();
    renderGuestUI();
    return;
  }

  const claim = hasValidDashboardEntitlement(state.entitlement, user.id)
    ? state.entitlement
    : (hasValidDashboardEntitlement(state.session?.entitlement, user.id) ? state.session.entitlement : null);
  const resolvedTier = claim
    ? normalizeDashboardTier(claim.tier, claim.role, user.email)
    : normalizeDashboardTier(user.tier, user.role, user.email);

  state.isUnlimited = resolvedTier === 'unlimited';
  state.isStudio = resolvedTier === 'studio';
  state.isPro = resolvedTier === 'pro' || resolvedTier === 'studio' || resolvedTier === 'unlimited';
  if (!state.storageLimitBytes || claim?.storageLimitBytes) {
    state.storageLimitBytes = Number(claim?.storageLimitBytes || 0) || getStorageQuotaBytesForTier(resolvedTier);
  }
  if (typeof claim?.storageUsedBytes === 'number') {
    state.storageUsedBytes = Math.max(0, claim.storageUsedBytes);
  }

  if (campCountEl) {
    const isAdminUser = String(user.role || '').toLowerCase() === 'admin' || DASHBOARD_ADMIN_EMAILS.includes(String(user.email || '').trim().toLowerCase());
    campCountEl.textContent = isAdminUser
      ? `${state.brandProfiles.length} Unlimited`
      : (state.isUnlimited
        ? `${customCount} / 50 Custom`
        : (state.isStudio
          ? `${customCount} / 15 Custom`
          : (state.isPro ? `${customCount} / 5 Custom` : `${customCount} / 1 Custom`)));
  }

  document.getElementById('btn-login-trigger')?.classList.add('hidden');
  document.getElementById('nav-user-profile')?.classList.remove('hidden');
  document.getElementById('nav-user-name').textContent = user.fullName || user.email?.split('@')[0] || 'User';
  document.getElementById('nav-user-email').textContent = user.email || '';

  const initials = (user.fullName || user.email || 'U').charAt(0).toUpperCase();
  document.getElementById('nav-user-avatar-fallback').textContent = initials;
  document.getElementById('hero-avatar-fallback').textContent = initials;

  if (user.avatarUrl) {
    ['nav-user-avatar', 'hero-user-avatar'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) { img.src = user.avatarUrl; img.classList.remove('hidden'); }
    });
    document.getElementById('nav-user-avatar-fallback')?.classList.add('hidden');
    document.getElementById('hero-avatar-fallback')?.classList.add('hidden');
  }

  document.getElementById('hero-user-name').textContent = user.fullName || user.email?.split('@')[0] || 'Customer';
  document.getElementById('hero-user-email').textContent = user.email || '';

  const heroBadge = document.getElementById('hero-plan-badge');
  const heroCheckout = document.getElementById('btn-hero-checkout');
  const heroStudioCheckout = document.getElementById('btn-hero-studio-checkout');
  const heroUnlimitedCheckout = document.getElementById('btn-hero-unlimited-checkout');
  const banner = document.getElementById('upgrade-pitch-banner');
  const bannerProBtn = document.getElementById('btn-banner-checkout');
  const bannerStudioBtn = document.getElementById('btn-banner-studio-checkout');
  const bannerUnlimitedBtn = document.getElementById('btn-banner-unlimited-checkout');
  const bannerTitle = document.getElementById('upgrade-banner-title');
  const bannerDesc = document.getElementById('upgrade-banner-desc');

  if (state.isUnlimited) {
    heroBadge.className = 'badge-pro inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold';
    heroBadge.textContent = 'Agency Plan (50 Products) 🚀';
    document.getElementById('stat-tier').textContent = 'Agency (50 Products • 5 GB)';
    document.getElementById('stat-modules').textContent = 'All 10 Modules';
    heroCheckout?.classList.add('hidden');
    heroStudioCheckout?.classList.add('hidden');
    heroUnlimitedCheckout?.classList.add('hidden');
    banner?.classList.add('hidden');
  } else if (state.isStudio) {
    heroBadge.className = 'badge-pro inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold';
    heroBadge.textContent = 'Studio Plan (15 Products) ⚡';
    document.getElementById('stat-tier').textContent = 'Studio (15 Products • 1 GB)';
    document.getElementById('stat-modules').textContent = 'All 10 Modules';
    heroCheckout?.classList.add('hidden');
    heroStudioCheckout?.classList.add('hidden');
    heroUnlimitedCheckout?.classList.remove('hidden');
    banner?.classList.remove('hidden');
    bannerProBtn?.classList.add('hidden');
    bannerStudioBtn?.classList.add('hidden');
    bannerUnlimitedBtn?.classList.remove('hidden');
    if (bannerTitle) bannerTitle.textContent = 'Need 50 Products & 5 GB Media Storage?';
    if (bannerDesc) bannerDesc.textContent = 'Your Studio plan includes 15 custom Products and 1 GB cloud media storage. Upgrade to Agency ($59/mo) for up to 50 Products & 5 GB media storage.';
  } else if (state.isPro) {
    heroBadge.className = 'badge-pro inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold';
    heroBadge.textContent = 'Pro Plan (5 Products) 👑';
    document.getElementById('stat-tier').textContent = 'Pro (5 Products • 250 MB)';
    document.getElementById('stat-modules').textContent = 'All 10 Modules';
    heroCheckout?.classList.add('hidden');
    heroStudioCheckout?.classList.remove('hidden');
    heroUnlimitedCheckout?.classList.remove('hidden');
    banner?.classList.remove('hidden');
    bannerProBtn?.classList.add('hidden');
    bannerStudioBtn?.classList.remove('hidden');
    bannerUnlimitedBtn?.classList.remove('hidden');
    if (bannerTitle) bannerTitle.textContent = 'Scale Beyond 5 Products with Studio ($29/mo) or Agency ($59/mo)';
    if (bannerDesc) bannerDesc.textContent = 'Your Pro plan includes 5 custom Products and 250 MB media storage. Upgrade to Studio (15 Products · 1 GB) or Agency (50 Products · 5 GB).';
  } else {
    heroBadge.className = 'badge-basic inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold';
    heroBadge.textContent = 'Free Starter (1 Product)';
    document.getElementById('stat-tier').textContent = 'Free Starter (15 MB)';
    document.getElementById('stat-modules').textContent = 'Core Modules';
    heroCheckout?.classList.remove('hidden');
    heroStudioCheckout?.classList.add('hidden');
    heroUnlimitedCheckout?.classList.add('hidden');
    banner?.classList.remove('hidden');
    bannerProBtn?.classList.remove('hidden');
    bannerStudioBtn?.classList.remove('hidden');
    bannerUnlimitedBtn?.classList.remove('hidden');
    if (bannerTitle) bannerTitle.textContent = 'Unlock All 10 Product Modules & Up to 5 Products with Pro ($9/mo)';
    if (bannerDesc) bannerDesc.textContent = 'Unlock DMs, Cold Email, Long-Form Articles, Contact Form Auto-filler, 250 MB media storage & 5 Products with Pro ($9/mo), scale to 15 Products & 1 GB on Studio ($29/mo), or get up to 50 Products & 5 GB on Agency ($59/mo).';
  }

  updateDashboardPricingLabels();
  renderStorageUsageMeter();
}

function renderGuestUI() {
  document.getElementById('btn-login-trigger')?.classList.remove('hidden');
  document.getElementById('nav-user-profile')?.classList.add('hidden');
  document.getElementById('btn-hero-checkout')?.classList.remove('hidden');
  document.getElementById('btn-hero-studio-checkout')?.classList.add('hidden');
  document.getElementById('btn-hero-unlimited-checkout')?.classList.add('hidden');
  document.getElementById('upgrade-pitch-banner')?.classList.remove('hidden');
  document.getElementById('btn-banner-checkout')?.classList.remove('hidden');
  document.getElementById('btn-banner-studio-checkout')?.classList.remove('hidden');
  document.getElementById('btn-banner-unlimited-checkout')?.classList.remove('hidden');
}

// ============================================================================
// 2. Campaign Content Editor (NO Insert Buttons)
// ============================================================================
function getActiveBrand() {
  return state.brandProfiles.find((b) => b.brandId === state.activeBrandId || b.campaignId === state.activeBrandId) || state.brandProfiles[0];
}

function renderGlobalCampaignSelectors() {
  if (!Array.isArray(state.brandProfiles) || state.brandProfiles.length === 0) {
    const sample = createSampleCampaign();
    state.brandProfiles = [sample];
    state.activeBrandId = sample.brandId;
  }
  const hasMatch = state.brandProfiles.some((b) => (b.brandId || b.campaignId || b.id) === state.activeBrandId);
  if (!hasMatch) {
    const first = state.brandProfiles[0];
    state.activeBrandId = first?.brandId || first?.campaignId || first?.id || '';
  }
  const options = state.brandProfiles.map((b) => {
    const id = b.brandId || b.campaignId || b.id || '';
    const selected = id === state.activeBrandId ? 'selected' : '';
    return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(b.campaignName || b.brandName || b.brandInfo?.name || 'Untitled')}</option>`;
  }).join('');
  ['global-campaign-select', 'content-campaign-select', 'opportunities-campaign-select', 'ai-assistant-campaign-select'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = options;
      if (state.activeBrandId) el.value = state.activeBrandId;
      syncCustomSelect(el);
    }
  });
}

function handleGlobalCampaignChange(newId) {
  state.activeBrandId = newId;
  state.settings.updatedAt = new Date().toISOString();
  if (typeof selectedThreadIds !== 'undefined') selectedThreadIds.clear();
  if (typeof selectedKeywordKeys !== 'undefined') selectedKeywordKeys.clear();
  if (typeof selectedDirectoryIds !== 'undefined') selectedDirectoryIds.clear();
  if (typeof dashSelectedNetworkTabs !== 'undefined') dashSelectedNetworkTabs.clear();
  if (typeof dashExcludedFeedTerms !== 'undefined') dashExcludedFeedTerms.clear();
  if (typeof dashActiveSavedGroupId !== 'undefined') dashActiveSavedGroupId = '';
  if (typeof dashPendingSaveThreads !== 'undefined') dashPendingSaveThreads = [];
  if (typeof dashRenamingGroupId !== 'undefined') dashRenamingGroupId = '';
  if (typeof visibleThreadsLimit !== 'undefined') visibleThreadsLimit = 50;
  resetDashboardCommentUiState();
  syncActiveResearchConfigMirror();
  renderGlobalCampaignSelectors();
  renderContentEditor();
  renderAiAssistantSection();
  renderResearchSection();
  renderDirectoriesTable();
  persistStateToBridgeAndLocal({
    activeBrandId: newId,
    settings: state.settings,
    researchConfig: getMirroredResearchPayload(),
  });
}

function canCreateAnotherCampaign() {
  const customCount = getCustomCampaignsCount();
  const isAdminUser = String(state.user?.role || '').toLowerCase() === 'admin' || DASHBOARD_ADMIN_EMAILS.includes(String(state.user?.email || '').trim().toLowerCase());
  if (isAdminUser) return true;
  if (state.isUnlimited) {
    if (customCount >= 50) {
      showToast('Agency includes up to 50 Products (5 GB storage).', 'error');
      return false;
    }
    return true;
  }
  if (state.isStudio) {
    if (customCount >= 15) {
      showToast('Studio includes up to 15 Products (1 GB storage). Upgrade to Agency ($59/mo) for 50 Products.', 'error');
      document.getElementById('upgrade-pitch-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }
  if (state.isPro) {
    if (customCount >= 5) {
      showToast('Pro includes up to 5 Products (250 MB storage). Upgrade to Studio ($29/mo) or Agency ($59/mo) for more Products.', 'error');
      document.getElementById('upgrade-pitch-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }
  if (customCount >= 1) {
    showToast('Free Starter allows 1 custom Product (15 MB storage). Upgrade to Pro ($9/mo) for 5 Products.', 'error');
    document.getElementById('upgrade-pitch-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

function createNewCampaignPrompt() {
  if (!canCreateAnotherCampaign()) return;
  const name = prompt('Enter new Product name:', `Product ${state.brandProfiles.length + 1}`);
  if (!name) return;
  const id = 'campaign-' + Date.now();
  const blank = createSampleCampaign();
  blank.brandId = id;
  blank.campaignId = id;
  blank.brandName = name.trim();
  blank.campaignName = name.trim();
  blank.isDefault = false;
  delete blank.isUntouchedDefault;
  blank.brandInfo = { name: name.trim(), url: '', tagline: '', description: '', twitter: '', instagram: '' };
  blank.commentTags = ['General'];
  blank.activeCommentPool = 'all';
  blank.safeDomain = { enabled: false, value: '' };
  blank.queue = [];
  blank.keywords = [];
  blank.savedKeywordStacks = [];
  blank.researchConfig = createDefaultResearchConfig();
  blank.updatedAt = new Date().toISOString();
  state.brandProfiles.push(blank);
  state.activeBrandId = id;
  state.settings.updatedAt = blank.updatedAt;
  resetDashboardCommentUiState();
  syncActiveResearchConfigMirror();
  renderGlobalCampaignSelectors();
  renderContentEditor();
  renderResearchSection();
  renderAccountUI();
  saveCampaignChanges(true);
}

function renameActiveCampaignPrompt() {
  const b = getActiveBrand();
  if (!b) return;
  const next = prompt('Rename product:', b.campaignName || b.brandName);
  if (!next || !next.trim()) return;
  b.campaignName = next.trim();
  b.brandName = next.trim();
  b.updatedAt = new Date().toISOString();
  renderGlobalCampaignSelectors();
  saveCampaignChanges(true);
}

function cloneActiveCampaign() {
  if (!canCreateAnotherCampaign()) return;
  const b = getActiveBrand();
  if (!b) return;
  const cloned = JSON.parse(JSON.stringify(b));
  const id = 'campaign-' + Date.now();
  cloned.brandId = id;
  cloned.campaignId = id;
  cloned.campaignName = `${b.campaignName || b.brandName} (Copy)`;
  cloned.brandName = cloned.campaignName;
  cloned.isDefault = false;
  delete cloned.isUntouchedDefault;
  cloned.updatedAt = new Date().toISOString();
  cloned.researchConfig = createDefaultResearchConfig({
    ...(cloned.researchConfig || {}),
    updatedAt: cloned.updatedAt,
  });
  state.brandProfiles.push(cloned);
  state.activeBrandId = id;
  state.settings.updatedAt = cloned.updatedAt;
  resetDashboardCommentUiState();
  syncActiveResearchConfigMirror();
  renderGlobalCampaignSelectors();
  renderContentEditor();
  renderResearchSection();
  renderAccountUI();
  saveCampaignChanges(true);
}

function deleteActiveCampaign() {
  if (state.brandProfiles.length <= 1) {
    showToast('At least one product is required.', 'error');
    return;
  }
  const b = getActiveBrand();
  if (!b || !confirm(`Delete "${b.campaignName || b.brandName}"?`)) return;
  const deletedId = b.brandId || b.campaignId;
  const deletedAt = new Date().toISOString();
  if (deletedId) {
    if (!state.deletedBrandTombstones || typeof state.deletedBrandTombstones !== 'object') {
      state.deletedBrandTombstones = {};
    }
    state.deletedBrandTombstones[deletedId] = deletedAt;
  }
  state.brandProfiles = state.brandProfiles.filter((item) => item.brandId !== b.brandId);
  state.activeBrandId = state.brandProfiles[0].brandId;
  state.settings.updatedAt = deletedAt;
  resetDashboardCommentUiState();
  syncActiveResearchConfigMirror();
  renderGlobalCampaignSelectors();
  renderContentEditor();
  renderResearchSection();
  persistStateToBridgeAndLocal({
    brandProfiles: state.brandProfiles,
    activeBrandId: state.activeBrandId,
    settings: state.settings,
    researchConfig: getMirroredResearchPayload(),
    deletedBrandIds: deletedId ? [deletedId] : [],
    deletedBrandTombstones: state.deletedBrandTombstones,
  });
  const badge = document.getElementById('content-save-badge');
  if (badge) badge.textContent = 'Synced ✓';
  showToast('Product deleted & synced');
}

function switchContentSubtab(subtab) {
  const aliasMap = {
    'brand-assets': 'product',
    'social-posts': 'social',
    'directories-copy': 'directories',
    'support-faqs': 'support',
    'suppression': 'rules',
  };
  const resolved = aliasMap[subtab] || subtab || 'product';
  state.activeContentSubtab = resolved;
  document.querySelectorAll('.content-subtab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.ctab === resolved);
  });
  renderContentEditor();
}

let contentSaveDebounce = null;
function scheduleCampaignSave() {
  const b = getActiveBrand();
  if (b) b.updatedAt = new Date().toISOString();
  const badge = document.getElementById('content-save-badge');
  if (badge) badge.textContent = 'Saving...';
  clearTimeout(contentSaveDebounce);
  contentSaveDebounce = setTimeout(() => saveCampaignChanges(false), 350);
}

async function saveCampaignChanges(showFeedback = false) {
  const b = getActiveBrand();
  if (b && !b.updatedAt) b.updatedAt = new Date().toISOString();
  await persistStateToBridgeAndLocal({
    brandProfiles: state.brandProfiles,
    activeBrandId: state.activeBrandId,
  });
  const badge = document.getElementById('content-save-badge');
  if (badge) badge.textContent = 'Synced ✓';
  if (showFeedback) showToast('Product saved & synced with extension!');
}

async function saveActiveCampaign(showFeedback = false) {
  const b = getActiveBrand();
  if (b) b.updatedAt = new Date().toISOString();
  return saveCampaignChanges(showFeedback);
}

function getDashboardAiActionIconSvg(type) {
  const base = 'width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"';
  switch (type) {
    case 'generate':
      return `<svg ${base}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/></svg>`;
    case 'regenerate':
      return `<svg ${base}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
    case 'rewrite':
      return `<svg ${base}><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
    case 'refine':
      return `<svg ${base}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
    case 'add_emojis':
      return `<svg ${base}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
    case 'custom':
    default:
      return `<svg ${base}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
  }
}

function renderDashboardAiDropdownHtml(domKey, moduleType, field, idx) {
  const safeField = escapeHtml(field || '');
  return `
    <div class="relative inline-block shrink-0" onclick="event.stopPropagation()">
      <button type="button" onclick="toggleDashboardAiMenu(event, '${domKey}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition" title="AI Actions">
        <span>AI</span>
        <i class="fas fa-chevron-down text-[9px]"></i>
      </button>
      <div id="dash-ai-menu-${domKey}" class="dash-ai-menu hidden absolute right-0 mt-1 w-44 bg-white border border-[#dfd8cc] rounded-lg shadow-lg py-1 z-30">
        <button type="button" onclick="runDashboardAiAction('${moduleType}', '${safeField}', ${idx}, 'generate', '', '${domKey}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('generate')}</span> Generate</button>
        <button type="button" onclick="runDashboardAiAction('${moduleType}', '${safeField}', ${idx}, 'regenerate', '', '${domKey}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('regenerate')}</span> Regenerate</button>
        <button type="button" onclick="runDashboardAiAction('${moduleType}', '${safeField}', ${idx}, 'rewrite', '', '${domKey}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('rewrite')}</span> Rewrite</button>
        <button type="button" onclick="runDashboardAiAction('${moduleType}', '${safeField}', ${idx}, 'refine', '', '${domKey}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('refine')}</span> Refine</button>
        <button type="button" onclick="runDashboardAiAction('${moduleType}', '${safeField}', ${idx}, 'add_emojis', '', '${domKey}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('add_emojis')}</span> Add emojis</button>
        <div class="my-1 border-t border-[#F2EBE0]"></div>
        <button type="button" onclick="openDashboardCustomAiPrompt('${domKey}')" class="w-full text-left px-3 py-1.5 text-xs font-semibold text-[#5b4bc4] hover:bg-[#f1effe] flex items-center gap-2"><span class="text-[#5b4bc4] flex items-center">${getDashboardAiActionIconSvg('custom')}</span> Custom</button>
      </div>
    </div>
  `;
}

function renderDashboardCustomAiBoxHtml(domKey, moduleType, field, idx) {
  const safeField = escapeHtml(field || '');
  const countOptions = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === 1 ? ' selected' : ''}>${n}</option>`)
    .join('');
  return `
    <div id="dash-ai-custom-box-${domKey}" class="hidden mt-2 p-2.5 bg-[#f5f3ff] border border-[#d4cdfc] rounded-lg space-y-2" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5b4bc4]">${getDashboardAiActionIconSvg('custom')}<span>Custom variation</span></span>
        <button type="button" onclick="closeDashboardCustomAiPrompt('${domKey}')" class="text-[11px] text-[#747d8c] hover:text-[#1e222a] px-1" title="Close">✕</button>
      </div>
      <textarea id="dash-ai-custom-input-${domKey}" rows="2" placeholder="e.g. Create a professional version of this comment..." onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitDashboardCustomAiPrompt('${domKey}','${moduleType}','${safeField}',${idx});}else if(event.key==='Escape'){closeDashboardCustomAiPrompt('${domKey}');}" class="w-full px-2.5 py-1.5 bg-white border border-[#d4cdfc] rounded-md text-xs text-[#1e222a] focus:outline-none focus:border-[#6c5ce7] resize-y min-h-[54px]"></textarea>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <label for="dash-ai-custom-count-${domKey}" class="text-[11px] font-semibold text-[#5b4bc4] whitespace-nowrap">Variations</label>
          <select id="dash-ai-custom-count-${domKey}" class="min-w-[68px] px-2 py-1 bg-white border border-[#d4cdfc] rounded-md text-xs font-semibold text-[#1e222a]">
            ${countOptions}
          </select>
        </div>
        <button type="button" onclick="submitDashboardCustomAiPrompt('${domKey}','${moduleType}','${safeField}',${idx})" class="sp-btn-primary px-3 py-1.5 rounded-md text-xs whitespace-nowrap">Apply</button>
      </div>
    </div>
  `;
}

const BRAND_GALLERY_CATEGORIES = [
  { key: 'brand', label: 'Brand', builtIn: true },
  { key: 'marketing', label: 'Marketing', builtIn: true },
  { key: 'social', label: 'Social', builtIn: true },
  { key: 'more', label: 'More', builtIn: true },
];

function getDashboardGalleryCategories(brand = null) {
  const b = brand || (typeof getActiveBrand === 'function' ? getActiveBrand() : null);
  const seen = new Set(BRAND_GALLERY_CATEGORIES.map((c) => c.key));
  const rawCustom = Array.isArray(b?.brandAssets?.galleryCategories) ? b.brandAssets.galleryCategories : [];
  const custom = [];
  rawCustom.forEach((c) => {
    const label = String(c?.label || c?.name || c || '').trim().slice(0, 24);
    if (!label) return;
    const key = String(c?.key || label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!key || key === 'all' || seen.has(key)) return;
    seen.add(key);
    custom.push({ key, label, builtIn: false });
  });
  return [...BRAND_GALLERY_CATEGORIES, ...custom];
}

function normalizeGalleryCategoryKey(cat, brand = null) {
  const raw = String(cat || '').trim().toLowerCase();
  const b = brand || (typeof getActiveBrand === 'function' ? getActiveBrand() : null);
  const custom = Array.isArray(b?.brandAssets?.galleryCategories) ? b.brandAssets.galleryCategories : [];
  const customMatch = custom.find((c) =>
    String(c?.key || '').trim().toLowerCase() === raw ||
    String(c?.label || '').trim().toLowerCase() === raw
  );
  if (customMatch?.key) return String(customMatch.key).trim().toLowerCase();
  if (raw === 'brand' || raw === 'logos' || raw === 'logo' || raw === 'icons' || raw === 'team' || raw === 'founder' || raw === 'founders') return 'brand';
  if (raw === 'marketing' || raw === 'screenshots' || raw === 'screenshot' || raw === 'product' || raw === 'promo') return 'marketing';
  if (raw === 'social') return 'social';
  if (raw === 'more' || raw === 'other' || raw === 'others') return 'more';
  return 'marketing';
}

function getGalleryCategoryLabel(cat, brand = null) {
  const key = normalizeGalleryCategoryKey(cat, brand);
  return getDashboardGalleryCategories(brand).find((c) => c.key === key)?.label || 'Marketing';
}

function ensureDashboardGalleryNormalized(brand) {
  if (!brand || typeof brand !== 'object') return [];
  normalizeBrandAssets(brand);
  if (!Array.isArray(brand.gallery)) brand.gallery = [];
  brand.gallery = brand.gallery
    .filter((item) => item && typeof item === 'object' && String(item.url || '').trim())
    .map((item, idx) => ({
      ...item,
      id: item.id || `gal-${idx}-${String(item.url || '').slice(-8)}`,
      category: normalizeGalleryCategoryKey(item.category, brand),
    }));
  return brand.gallery;
}

function normalizeBrandAssets(brand) {
  if (!brand || typeof brand !== 'object') return {};
  const info = brand.brandInfo || (brand.brandInfo = {});
  const dir = brand.directory || (brand.directory = {});
  const rawBa = (brand.brandAssets && typeof brand.brandAssets === 'object') ? brand.brandAssets : {};
  const legacyDesc = String(info.description || '').trim();

  const normalizeRowList = (arr, prefix) => (Array.isArray(arr) ? arr : []).map((row, i) => {
    if (typeof row === 'string') return { id: `${prefix}-${i}`, title: row, detail: '' };
    return {
      id: row?.id || `${prefix}-${i}`,
      title: String(row?.title || row?.name || '').trim(),
      detail: String(row?.detail || row?.description || '').trim(),
    };
  });

  const normalizeCompList = (arr) => (Array.isArray(arr) ? arr : []).map((row, i) => ({
    id: row?.id || `comp-${i}`,
    name: String(row?.name || '').trim(),
    advantage: String(row?.advantage || row?.diff || '').trim(),
    recommendWhen: String(row?.recommendWhen || row?.when || '').trim(),
  }));

  const normalizeTestimonials = (arr) => (Array.isArray(arr) ? arr : []).map((row, i) => {
    if (typeof row === 'string') return { id: `test-${i}`, quote: row, author: '' };
    return {
      id: row?.id || `test-${i}`,
      quote: String(row?.quote || row?.text || '').trim(),
      author: String(row?.author || row?.role || '').trim(),
    };
  });

  const reservedCatKeys = new Set(['all', 'brand', 'marketing', 'social', 'more']);
  const seenCustomCatKeys = new Set();
  const galleryCategories = (Array.isArray(rawBa.galleryCategories) ? rawBa.galleryCategories : [])
    .map((c) => {
      const label = String(c?.label || c?.name || c || '').trim().slice(0, 24);
      if (!label) return null;
      const rawKey = String(c?.key || label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!rawKey || reservedCatKeys.has(rawKey) || seenCustomCatKeys.has(rawKey)) return null;
      seenCustomCatKeys.add(rawKey);
      return { key: rawKey, label };
    })
    .filter(Boolean);

  const normalizeCustomLinks = (arr) => (Array.isArray(arr) ? arr : []).map((row, i) => ({
    id: row?.id || `clink-${i}`,
    name: String(row?.name || row?.label || row?.title || '').trim(),
    url: String(row?.url || '').trim(),
  }));

  const normalizeCustomSections = (arr) => (Array.isArray(arr) ? arr : []).map((row, i) => ({
    id: row?.id || `csec-${i}`,
    title: String(row?.title || row?.name || '').trim(),
    content: String(row?.content || row?.text || row?.detail || ''),
  }));

  const rawLinks = (rawBa.links && typeof rawBa.links === 'object') ? rawBa.links : {};
  const rawVideos = (rawBa.videos && typeof rawBa.videos === 'object') ? rawBa.videos : {};
  const rawHandles = (rawBa.handles && typeof rawBa.handles === 'object') ? rawBa.handles : {};
  const rawProof = (rawBa.proof && typeof rawBa.proof === 'object') ? rawBa.proof : {};
  const rawTone = (rawBa.tone && typeof rawBa.tone === 'object') ? rawBa.tone : {};
  const rawMediaRoles = (rawBa.mediaRoles && typeof rawBa.mediaRoles === 'object') ? rawBa.mediaRoles : {};

  let defaultShort = String(rawBa.shortPitch ?? '').trim();
  let defaultLong = String(rawBa.longPitch ?? '').trim();
  if (!defaultShort && !defaultLong && legacyDesc) {
    if (legacyDesc.length <= 150) defaultShort = legacyDesc;
    defaultLong = legacyDesc;
  }

  let shortPitches = (Array.isArray(rawBa.shortPitches) ? rawBa.shortPitches : [])
    .map((item, i) => ({
      id: item?.id || `sp-${i}`,
      text: typeof item === 'string' ? item : String(item?.text || item?.value || ''),
    }));
  const resolvedShort = rawBa.shortPitch !== undefined ? String(rawBa.shortPitch) : defaultShort;
  if (shortPitches.length === 0) {
    shortPitches = [{ id: 'sp-0', text: resolvedShort }];
  }
  const primaryShort = shortPitches.find((s) => s.text.trim())?.text ?? resolvedShort;

  const normalized = {
    shortPitch: primaryShort,
    shortPitches,
    longPitch: rawBa.longPitch !== undefined ? String(rawBa.longPitch) : defaultLong,
    founderStory: String(rawBa.founderStory || ''),
    pricingSummary: String(rawBa.pricingSummary || dir.startingPrice || ''),
    targetAudience: String(rawBa.targetAudience || ''),
    features: normalizeRowList(rawBa.features, 'feat'),
    benefits: normalizeRowList(rawBa.benefits, 'ben'),
    competitors: normalizeCompList(rawBa.competitors),
    customLinks: normalizeCustomLinks(rawBa.customLinks),
    customSections: normalizeCustomSections(rawBa.customSections),
    galleryCategories,
    links: {
      pricingUrl: String(rawLinks.pricingUrl || ''),
      docsUrl: String(rawLinks.docsUrl || ''),
      bookingUrl: String(rawLinks.bookingUrl || ''),
      utmSource: String(rawLinks.utmSource || ''),
      utmMedium: String(rawLinks.utmMedium || ''),
      utmCampaign: String(rawLinks.utmCampaign || ''),
    },
    videos: {
      demoUrl: String(rawVideos.demoUrl || dir.demoUrl || ''),
      explainerUrl: String(rawVideos.explainerUrl || ''),
      onboardingUrl: String(rawVideos.onboardingUrl || ''),
    },
    handles: {
      twitter: String(rawHandles.twitter || info.twitter || ''),
      linkedin: String(rawHandles.linkedin || ''),
      github: String(rawHandles.github || ''),
      youtube: String(rawHandles.youtube || ''),
      productHunt: String(rawHandles.productHunt || ''),
      instagram: String(rawHandles.instagram || info.instagram || ''),
    },
    proof: {
      testimonials: normalizeTestimonials(rawProof.testimonials),
    },
    tone: {
      forbiddenWords: String(rawTone.forbiddenWords || ''),
    },
    mediaRoles: {
      logoGalleryId: String(rawMediaRoles.logoGalleryId || ''),
      faviconGalleryId: String(rawMediaRoles.faviconGalleryId || ''),
      ogCoverGalleryId: String(rawMediaRoles.ogCoverGalleryId || ''),
    },
  };

  if (!info.twitter && normalized.handles.twitter) info.twitter = normalized.handles.twitter;
  if (!info.instagram && normalized.handles.instagram) info.instagram = normalized.handles.instagram;

  brand.brandAssets = normalized;
  return normalized;
}

const SOCIAL_POST_PLATFORMS = ['X / Twitter', 'LinkedIn', 'Reddit', 'Threads', 'Bluesky', 'Instagram', 'Product Hunt', 'Hacker News'];
const SOCIAL_POST_FORMATS = [
  { key: 'single', label: 'Single Post' },
  { key: 'thread', label: 'Thread' },
  { key: 'carousel', label: 'Carousel' },
  { key: 'story', label: 'Story / Short' },
  { key: 'launch', label: 'Launch Post' },
];
const SUPPORT_CATEGORIES = ['General', 'Pricing & Billing', 'Onboarding', 'Technical', 'Bug Report', 'Feature Request'];
const ARTICLE_SEO_PRESETS = [
  { key: 'problem-solution', label: 'Problem -> Solution' },
  { key: 'how-to', label: 'How-To Playbook' },
  { key: 'comparison', label: 'Comparison / Alternative' },
  { key: 'launch-story', label: 'Founder Launch Story' },
  { key: 'changelog', label: 'Release / Changelog' },
];

function slugifyDashboardSeo(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function ensureDashboardSocialPosts(brand) {
  if (!brand || typeof brand !== 'object') return [];
  if (!Array.isArray(brand.socialPosts)) brand.socialPosts = [];
  brand.socialPosts = brand.socialPosts
    .filter((p) => p && typeof p === 'object')
    .map((p, idx) => ({
      id: p.id || `sp-${Date.now()}-${idx}`,
      platform: String(p.platform || 'X / Twitter'),
      format: String(p.format || 'single'),
      hook: String(p.hook || ''),
      body: String(p.body || ''),
      ctaUrl: String(p.ctaUrl || ''),
      mediaGalleryIds: Array.isArray(p.mediaGalleryIds) ? p.mediaGalleryIds.map((id) => String(id)) : [],
      enabled: p.enabled !== false,
      createdAt: p.createdAt || new Date().toISOString(),
      isAutoGenerated: Boolean(p.isAutoGenerated),
    }));
  return brand.socialPosts;
}

function ensureDashboardSupport(brand) {
  if (!brand || typeof brand !== 'object') return { faqs: [], macros: [] };
  if (!brand.support || typeof brand.support !== 'object') brand.support = { faqs: [], macros: [] };
  brand.support.faqs = (Array.isArray(brand.support.faqs) ? brand.support.faqs : [])
    .filter((f) => f && typeof f === 'object')
    .map((f, idx) => ({
      id: f.id || `faq-${Date.now()}-${idx}`,
      category: String(f.category || 'General'),
      question: String(f.question || ''),
      answer: String(f.answer || ''),
      enabled: f.enabled !== false,
    }));
  brand.support.macros = (Array.isArray(brand.support.macros) ? brand.support.macros : [])
    .filter((m) => m && typeof m === 'object')
    .map((m, idx) => ({
      id: m.id || `macro-${Date.now()}-${idx}`,
      category: String(m.category || 'General'),
      title: String(m.title || ''),
      body: String(m.body || ''),
      enabled: m.enabled !== false,
    }));
  return brand.support;
}

function getPrimaryBrandMedia(brand) {
  const gallery = ensureDashboardGalleryNormalized(brand);
  const ba = normalizeBrandAssets(brand);
  const info = brand?.brandInfo || {};
  const dir = brand?.directory || {};
  const byId = (id) => (id ? gallery.find((g) => g.id === id) : null);

  const logoItem = byId(ba.mediaRoles.logoGalleryId);
  const favItem = byId(ba.mediaRoles.faviconGalleryId);
  const ogItem = byId(ba.mediaRoles.ogCoverGalleryId);

  return {
    logoUrl: logoItem?.url || info.logo || dir.logoUrl || '',
    faviconUrl: favItem?.url || info.favicon || dir.faviconUrl || '',
    ogCoverUrl: ogItem?.url || info.ogCoverUrl || '',
    logoGalleryId: logoItem?.id || '',
    faviconGalleryId: favItem?.id || '',
    ogCoverGalleryId: ogItem?.id || '',
  };
}

function buildBrandUtmUrl(brand) {
  const ba = normalizeBrandAssets(brand);
  const rawBase = String(brand?.brandInfo?.url || brand?.directory?.websiteUrl || '').trim();
  if (!rawBase) return '';
  const hasProto = /^https?:\/\//i.test(rawBase);
  const src = String(ba.links.utmSource || '').trim();
  const med = String(ba.links.utmMedium || '').trim();
  const camp = String(ba.links.utmCampaign || '').trim();
  if (!src && !med && !camp) return rawBase;
  try {
    const parsed = new URL(hasProto ? rawBase : `https://${rawBase}`);
    if (src) parsed.searchParams.set('utm_source', src);
    if (med) parsed.searchParams.set('utm_medium', med);
    if (camp) parsed.searchParams.set('utm_campaign', camp);
    return hasProto ? parsed.toString() : parsed.toString().replace(/^https:\/\//i, '');
  } catch (_) {
    return rawBase;
  }
}

function renderContentEditor() {
  const container = document.getElementById('content-editor-body');
  const brand = getActiveBrand();
  if (!container || !brand) return;
  const tab = state.activeContentSubtab;

  if (tab === 'product') {
    const info = brand.brandInfo || (brand.brandInfo = {});
    const ba = normalizeBrandAssets(brand);
    const primaryMedia = getPrimaryBrandMedia(brand);
    const utmPreview = buildBrandUtmUrl(brand);
    const taglineLen = (info.tagline || '').length;
    const shortPitchLen = (ba.shortPitch || '').length;
    const longPitchLen = (ba.longPitch || '').length;

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F2EBE0]">
          <div>
            <h3 class="text-sm font-bold text-[#1e222a]">Brand Assets — Single Source of Truth</h3>
            <p class="text-xs text-[#57606f] mt-0.5">Structured identity, pitches, competitor positioning, proof, links, and brand tone shared automatically with BYOK AI &amp; every posting module.</p>
          </div>
          <button type="button" onclick="switchContentSubtab('directories')" class="sp-btn-secondary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap self-start">Directory Copy &rarr;</button>
        </div>

        <!-- 1. Core Identity & Copy -->
        <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-4">
          <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Core Identity &amp; Copy</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Product / Brand Name</label>
              <input type="text" value="${escapeHtml(info.name || '')}" oninput="updateBrandField('brandInfo.name', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Website URL</label>
              <input type="url" value="${escapeHtml(info.url || '')}" oninput="updateBrandField('brandInfo.url', this.value); const p=document.getElementById('dash-ba-utm-preview'); if(p) p.textContent=buildBrandUtmUrl(getActiveBrand())||'Enter a Website URL above to preview UTM links';" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
            <div class="sm:col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-semibold text-[#57606f]">One-Line Tagline</label>
                <span id="dash-ba-tagline-count" class="text-[11px] font-mono ${taglineLen > 60 ? 'text-amber-600 font-bold' : 'text-[#747d8c]'}">${taglineLen}/60 chars</span>
              </div>
              <input type="text" maxlength="100" value="${escapeHtml(info.tagline || '')}" oninput="updateBrandField('brandInfo.tagline', this.value); const el=document.getElementById('dash-ba-tagline-count'); if(el){el.textContent=this.value.length+'/60 chars'; el.className='text-[11px] font-mono '+(this.value.length>60?'text-amber-600 font-bold':'text-[#747d8c]');}" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs" placeholder="Crisp 60-char headline positioning what your product does">
            </div>
            <div class="sm:col-span-2 space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[#57606f]">Short Pitch (~140c · ${(ba.shortPitches || []).length} variation${(ba.shortPitches || []).length === 1 ? '' : 's'})</label>
                <button type="button" onclick="addBrandShortPitch()" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add Variation</button>
              </div>
              <div class="space-y-2">
                ${(ba.shortPitches || [{ id: 'sp-0', text: ba.shortPitch || '' }]).map((sp, idx) => `
                  <div class="bg-white border border-[#dfd8cc] rounded-lg p-2 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-mono text-[#747d8c]" id="dash-ba-shortpitch-count-${idx}">${(sp.text || '').length} chars (140c target)</span>
                      ${(ba.shortPitches || []).length > 1 ? `<button type="button" onclick="removeBrandShortPitch(${idx})" class="text-[#747d8c] hover:text-red-600 text-xs px-1" title="Remove variation"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                    <textarea rows="2" oninput="updateBrandShortPitch(${idx}, this.value); const el=document.getElementById('dash-ba-shortpitch-count-${idx}'); if(el){el.textContent=this.value.length+' chars (140c target)';}" class="w-full px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs" placeholder="Concise ~140-character elevator pitch...">${escapeHtml(sp.text || '')}</textarea>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="sm:col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-semibold text-[#57606f]">Long Pitch / Full Description (150–200 words)</label>
                <span id="dash-ba-longpitch-count" class="text-[11px] font-mono text-[#747d8c]">${String(ba.longPitch || '').trim() ? String(ba.longPitch || '').trim().split(/\s+/).length : 0} words</span>
              </div>
              <textarea rows="5" oninput="updateBrandField('brandAssets.longPitch', this.value); const el=document.getElementById('dash-ba-longpitch-count'); if(el){const w=this.value.trim()?this.value.trim().split(/\s+/).length:0; el.textContent=w+' words';}" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs leading-relaxed" placeholder="Summarised sales pitch with bullet points matching your landing page's tone and language...">${escapeHtml(ba.longPitch || '')}</textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Target Audience (ICP)</label>
              <textarea rows="2" oninput="updateBrandField('brandAssets.targetAudience', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs leading-relaxed" placeholder="e.g. Solo SaaS founders, DevOps leads, B2B agencies">${escapeHtml(ba.targetAudience || '')}</textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Pricing &amp; Offer Summary</label>
              <textarea rows="2" oninput="updateBrandField('brandAssets.pricingSummary', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs leading-relaxed" placeholder="e.g. Free tier, Pro $9/mo, 14-day trial">${escapeHtml(ba.pricingSummary || '')}</textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Founder Story &amp; Why We Built It</label>
              <textarea rows="2" oninput="updateBrandField('brandAssets.founderStory', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs" placeholder="Origin story or specific frustration that led to building this product...">${escapeHtml(ba.founderStory || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- 2. Compact Visual Preview Strip (linked to Gallery) -->
        <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Primary Visual Identity (Selected from Gallery)</div>
              <p class="text-[11px] text-[#747d8c] mt-0.5">Assign primary Logo, Favicon, and OG Cover inside Gallery without duplicating files.</p>
            </div>
            <button type="button" onclick="switchContentSubtab('gallery')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition whitespace-nowrap self-start">Manage / Upload in Gallery &rarr;</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${[
              { role: 'logo', label: 'Primary Logo', url: primaryMedia.logoUrl, filename: 'logo.png', imgClass: 'w-12 h-12 object-contain' },
              { role: 'favicon', label: 'Favicon', url: primaryMedia.faviconUrl, filename: 'favicon.png', imgClass: 'w-10 h-10 object-contain' },
              { role: 'ogCover', label: 'OG Cover / Banner', url: primaryMedia.ogCoverUrl, filename: 'og-cover.png', imgClass: 'w-16 h-10 object-cover' },
            ].map((slot) => `
              <div class="flex items-center justify-between gap-2.5 bg-white border border-[#dfd8cc] rounded-lg p-2.5">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${slot.url ? `
                    <img src="${escapeHtml(slot.url)}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, '${slot.filename}')" class="${slot.imgClass} rounded border border-[#dfd8cc] bg-[#FCF9F2] cursor-grab flex-shrink-0" title="Drag image onto webpage upload field">
                  ` : `
                    <div class="w-10 h-10 rounded border border-dashed border-[#dfd8cc] bg-[#FAF4EB] flex items-center justify-center text-[10px] text-[#747d8c] flex-shrink-0">None</div>
                  `}
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-[#1e222a]">${slot.label}</div>
                    <div class="text-[10px] text-[#747d8c] truncate">${slot.url ? 'Ready (drag in extension)' : 'Assign in Gallery'}</div>
                  </div>
                </div>
                ${slot.url ? `<button type="button" onclick="clearBrandPrimaryMediaRole('${slot.role}')" class="text-xs text-[#747d8c] hover:text-red-600 px-1.5 py-1 rounded" title="Unassign ${slot.label}">&times;</button>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. Features & Benefits -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${[
            { key: 'features', heading: 'Key Features', placeholderTitle: 'Feature name', placeholderDetail: 'What it does' },
            { key: 'benefits', heading: 'Core Benefits', placeholderTitle: 'Outcome / Benefit', placeholderDetail: 'Why users care' },
          ].map((sec) => {
            const list = ba[sec.key] || [];
            return `
            <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-[#57606f]">${sec.heading} (${list.length})</span>
                <button type="button" onclick="addBrandAssetRow('${sec.key}')" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add ${sec.key === 'features' ? 'Feature' : 'Benefit'}</button>
              </div>
              ${list.length === 0 ? `<div class="text-xs text-[#747d8c] italic py-2">No ${sec.key} added yet.</div>` : `
                <div class="space-y-2">
                  ${list.map((row, idx) => `
                    <div class="bg-white border border-[#dfd8cc] rounded-lg p-2.5 space-y-1.5">
                      <div class="flex items-center gap-2">
                        <input type="text" value="${escapeHtml(row.title || '')}" placeholder="${sec.placeholderTitle}" oninput="updateBrandAssetRow('${sec.key}', ${idx}, 'title', this.value)" class="flex-1 px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-semibold">
                        <button type="button" onclick="removeBrandAssetRow('${sec.key}', ${idx})" class="text-[#747d8c] hover:text-red-600 p-1 text-xs" title="Remove"><i class="fas fa-trash"></i></button>
                      </div>
                      <textarea rows="2" placeholder="${sec.placeholderDetail}" oninput="updateBrandAssetRow('${sec.key}', ${idx}, 'detail', this.value)" class="w-full px-2.5 py-1.5 bg-white border border-[#dfd8cc] rounded text-xs leading-relaxed">${escapeHtml(row.detail || '')}</textarea>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
            `;
          }).join('')}
        </div>

        <!-- 4. Competitor Comparisons -->
        <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Competitor Comparisons (${ba.competitors.length})</div>
              <p class="text-[11px] text-[#747d8c]">Give AI clear differentiation points when replying to comparison or alternative threads.</p>
            </div>
            <button type="button" onclick="addBrandAssetRow('competitors')" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add Competitor</button>
          </div>
          ${ba.competitors.length === 0 ? `<div class="text-xs text-[#747d8c] italic py-2">No competitor comparisons added yet.</div>` : `
            <div class="space-y-2.5">
              ${ba.competitors.map((comp, idx) => `
                <div class="bg-white border border-[#dfd8cc] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                  <div class="sm:col-span-3">
                    <label class="block text-[10px] font-bold uppercase text-[#747d8c] mb-1">Competitor</label>
                    <input type="text" value="${escapeHtml(comp.name || '')}" placeholder="e.g. Buffer / Jasper" oninput="updateBrandAssetRow('competitors', ${idx}, 'name', this.value)" class="w-full px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-semibold">
                  </div>
                  <div class="sm:col-span-4">
                    <label class="block text-[10px] font-bold uppercase text-[#747d8c] mb-1">How We Differ / Advantage</label>
                    <textarea rows="2" placeholder="e.g. $0 AI cost via BYOK + $9/mo flat" oninput="updateBrandAssetRow('competitors', ${idx}, 'advantage', this.value)" class="w-full px-2.5 py-1.5 bg-white border border-[#dfd8cc] rounded text-xs leading-relaxed">${escapeHtml(comp.advantage || '')}</textarea>
                  </div>
                  <div class="sm:col-span-4">
                    <label class="block text-[10px] font-bold uppercase text-[#747d8c] mb-1">When to Recommend Us</label>
                    <textarea rows="2" placeholder="e.g. Solo founders wanting predictable pricing" oninput="updateBrandAssetRow('competitors', ${idx}, 'recommendWhen', this.value)" class="w-full px-2.5 py-1.5 bg-white border border-[#dfd8cc] rounded text-xs leading-relaxed">${escapeHtml(comp.recommendWhen || '')}</textarea>
                  </div>
                  <div class="sm:col-span-1 flex sm:justify-end sm:pt-5">
                    <button type="button" onclick="removeBrandAssetRow('competitors', ${idx})" class="text-[#747d8c] hover:text-red-600 p-1.5 text-xs" title="Remove competitor"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 5. Links, UTM Generator, Videos & Handles -->
        <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-4">
          <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Links, UTM Builder, Videos &amp; Social Handles</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Pricing URL</label>
              <input type="url" value="${escapeHtml(ba.links.pricingUrl || '')}" placeholder="https://.../pricing" oninput="updateBrandField('brandAssets.links.pricingUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Docs / Changelog URL</label>
              <input type="url" value="${escapeHtml(ba.links.docsUrl || '')}" placeholder="https://.../docs" oninput="updateBrandField('brandAssets.links.docsUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Booking / Demo Call URL</label>
              <input type="url" value="${escapeHtml(ba.links.bookingUrl || '')}" placeholder="https://cal.com/..." oninput="updateBrandField('brandAssets.links.bookingUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
          </div>

          <!-- Quick UTM Preset Generator -->
          <div class="bg-white border border-[#dfd8cc] rounded-lg p-3 space-y-2.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="text-xs font-bold text-[#1e222a]">Quick UTM Preset Generator</span>
              <button type="button" onclick="copyBrandUtmLink()" class="px-2.5 py-1 rounded text-[11px] font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc]">Copy UTM Link</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input type="text" value="${escapeHtml(ba.links.utmSource || '')}" placeholder="utm_source (e.g. reddit)" oninput="updateBrandUtmField('utmSource', this.value)" class="px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-mono">
              <input type="text" value="${escapeHtml(ba.links.utmMedium || '')}" placeholder="utm_medium (e.g. comment)" oninput="updateBrandUtmField('utmMedium', this.value)" class="px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-mono">
              <input type="text" value="${escapeHtml(ba.links.utmCampaign || '')}" placeholder="utm_campaign (e.g. launch)" oninput="updateBrandUtmField('utmCampaign', this.value)" class="px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-mono">
            </div>
            <div id="dash-ba-utm-preview" class="text-[11px] font-mono text-[#57606f] bg-[#FAF4EB] border border-[#F2EBE0] rounded px-2.5 py-1.5 break-all">${escapeHtml(utmPreview || 'Enter a Website URL above to preview UTM links')}</div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Demo Video URL</label>
              <input type="url" value="${escapeHtml(ba.videos.demoUrl || '')}" placeholder="https://youtu.be/..." oninput="updateBrandField('brandAssets.videos.demoUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Explainer Video URL</label>
              <input type="url" value="${escapeHtml(ba.videos.explainerUrl || '')}" placeholder="https://loom.com/..." oninput="updateBrandField('brandAssets.videos.explainerUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Onboarding Video URL</label>
              <input type="url" value="${escapeHtml(ba.videos.onboardingUrl || '')}" placeholder="https://..." oninput="updateBrandField('brandAssets.videos.onboardingUrl', this.value)" class="w-full px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono">
            </div>
          </div>

          <div class="bg-white border border-[#dfd8cc] rounded-lg p-3 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#1e222a]">Custom Links &amp; Videos (${(ba.customLinks || []).length})</span>
              <button type="button" onclick="addBrandCustomLink()" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add Link</button>
            </div>
            ${(ba.customLinks || []).length === 0 ? `<div class="text-xs text-[#747d8c] italic">Add any custom named links, videos, or UTM URLs.</div>` : `
              <div class="space-y-2">
                ${(ba.customLinks || []).map((cl, idx) => `
                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input type="text" value="${escapeHtml(cl.name || '')}" placeholder="Link name (e.g. Case Study, Loom, G2)" oninput="updateBrandCustomLink(${idx}, 'name', this.value)" class="sm:col-span-4 px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-semibold">
                    <input type="url" value="${escapeHtml(cl.url || '')}" placeholder="https://..." oninput="updateBrandCustomLink(${idx}, 'url', this.value)" class="sm:col-span-7 px-2.5 py-1.5 bg-white border border-[#dfd8cc] rounded text-xs font-mono">
                    <div class="sm:col-span-1 flex sm:justify-end">
                      <button type="button" onclick="removeBrandCustomLink(${idx})" class="text-[#747d8c] hover:text-red-600 p-1 text-xs" title="Remove link"><i class="fas fa-trash"></i></button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            ${[
              { key: 'twitter', label: 'X / Twitter', ph: '@handle' },
              { key: 'linkedin', label: 'LinkedIn', ph: '/in/ or company' },
              { key: 'github', label: 'GitHub', ph: 'org/repo' },
              { key: 'youtube', label: 'YouTube', ph: '@channel' },
              { key: 'productHunt', label: 'Product Hunt', ph: '@product' },
              { key: 'instagram', label: 'Instagram', ph: '@handle' },
            ].map((h) => `
              <div>
                <label class="block text-[11px] font-semibold text-[#57606f] mb-1">${h.label}</label>
                <input type="text" value="${escapeHtml(ba.handles[h.key] || '')}" placeholder="${h.ph}" oninput="updateBrandField('brandAssets.handles.${h.key}', this.value)" class="w-full px-2.5 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 6. Testimonials & Voice Guardrails -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Testimonials / Mini Case Studies (${ba.proof.testimonials.length})</span>
              <button type="button" onclick="addBrandTestimonial()" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add Testimonial</button>
            </div>
            ${ba.proof.testimonials.length === 0 ? `<div class="text-xs text-[#747d8c] italic">No testimonials added yet.</div>` : `
              <div class="space-y-2">
                ${ba.proof.testimonials.map((t, idx) => `
                  <div class="bg-white border border-[#dfd8cc] rounded-lg p-2.5 space-y-1.5">
                    <div class="flex items-start gap-2">
                      <textarea rows="2" placeholder="Customer quote or mini case study..." oninput="updateBrandTestimonial(${idx}, 'quote', this.value)" class="flex-1 px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs">${escapeHtml(t.quote || '')}</textarea>
                      <button type="button" onclick="removeBrandTestimonial(${idx})" class="text-[#747d8c] hover:text-red-600 p-1 text-xs"><i class="fas fa-trash"></i></button>
                    </div>
                    <input type="text" value="${escapeHtml(t.author || '')}" placeholder="Author & role (e.g. Alex P., Founder at Acme)" oninput="updateBrandTestimonial(${idx}, 'author', this.value)" class="w-full px-2.5 py-1 bg-white border border-[#dfd8cc] rounded text-xs">
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
            <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Voice Guardrails</div>
            <p class="text-[11px] text-[#747d8c]">Tone and language are automatically matched to your landing page copy.</p>
            <div>
              <label class="block text-xs font-semibold text-[#57606f] mb-1">Forbidden Words / Claims to Never Use</label>
              <textarea rows="3" placeholder="Comma-separated words or compliance rules (e.g. revolutionary, guarantee, #1 rated)" oninput="updateBrandField('brandAssets.tone.forbiddenWords', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(ba.tone.forbiddenWords || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- 7. Additional Custom Sections (Unlimited) -->
        <div class="border border-[#dfd8cc] rounded-xl p-4 bg-[#FAF4EB]/40 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Additional Sections (${(ba.customSections || []).length})</div>
              <p class="text-[11px] text-[#747d8c]">Add unlimited custom notes, FAQs, positioning pillars, or compliance details.</p>
            </div>
            <button type="button" onclick="addBrandCustomSection()" class="text-xs font-bold text-[#6c5ce7] hover:underline">+ Add more</button>
          </div>
          ${(ba.customSections || []).length === 0 ? `<div class="text-xs text-[#747d8c] italic py-1">Click "+ Add more" to create a custom section.</div>` : `
            <div class="space-y-3">
              ${(ba.customSections || []).map((sec, idx) => `
                <div class="bg-white border border-[#dfd8cc] rounded-lg p-3 space-y-2">
                  <div class="flex items-center gap-2">
                    <input type="text" value="${escapeHtml(sec.title || '')}" placeholder="Section title" oninput="updateBrandCustomSection(${idx}, 'title', this.value)" class="flex-1 px-2.5 py-1.5 bg-[#FCF9F2] border border-[#dfd8cc] rounded text-xs font-semibold">
                    <button type="button" onclick="removeBrandCustomSection(${idx})" class="text-[#747d8c] hover:text-red-600 p-1 text-xs" title="Remove section"><i class="fas fa-trash"></i></button>
                  </div>
                  <textarea rows="3" placeholder="Details..." oninput="updateBrandCustomSection(${idx}, 'content', this.value)" class="w-full px-3 py-2 bg-white border border-[#dfd8cc] rounded-lg text-xs leading-relaxed">${escapeHtml(sec.content || '')}</textarea>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  } else if (tab === 'social') {
    const posts = ensureDashboardSocialPosts(brand);
    const gallery = ensureDashboardGalleryNormalized(brand);
    const platformFilter = state.socialPostPlatformFilter || 'all';
    const filteredPosts = posts
      .map((post, idx) => ({ post, idx }))
      .filter(({ post }) => platformFilter === 'all' || String(post.platform || '') === platformFilter);

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 class="text-sm font-bold text-[#1e222a]">Social Posts (${posts.length})</h3>
            <p class="text-[11px] text-[#57606f] mt-0.5">Platform-native posts, launch threads &amp; hooks linked with existing Gallery visuals.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="autoGenerateDashboardModule('social', this)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition whitespace-nowrap">✨ Auto Generate</button>
            <button type="button" onclick="addSocialPostTemplate()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">+ Add Post</button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <button type="button" onclick="state.socialPostPlatformFilter='all'; renderContentEditor();" class="px-2.5 py-1 rounded-md text-[11px] font-bold border ${platformFilter === 'all' ? 'bg-[#6c5ce7] text-white border-[#6c5ce7]' : 'bg-white text-[#57606f] border-[#dfd8cc] hover:bg-[#FAF4EB]'}">All (${posts.length})</button>
          ${SOCIAL_POST_PLATFORMS.map((plat) => {
            const cnt = posts.filter((p) => p.platform === plat).length;
            if (cnt === 0 && platformFilter !== plat) return '';
            const active = platformFilter === plat;
            return `<button type="button" onclick="state.socialPostPlatformFilter='${escapeHtml(plat)}'; renderContentEditor();" class="px-2.5 py-1 rounded-md text-[11px] font-semibold border ${active ? 'bg-[#6c5ce7] text-white border-[#6c5ce7] font-bold' : 'bg-white text-[#57606f] border-[#dfd8cc] hover:bg-[#FAF4EB]'}">${escapeHtml(plat)} (${cnt})</button>`;
          }).join('')}
        </div>

        ${filteredPosts.length === 0 ? `
          <div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">
            No social posts${platformFilter !== 'all' ? ` for ${escapeHtml(platformFilter)}` : ''} yet. Click <strong>✨ Auto Generate</strong> or <strong>+ Add Post</strong>.
          </div>
        ` : `
          <div class="space-y-3">
            ${filteredPosts.map(({ post, idx }) => {
              const domKey = `social_post-${idx}`;
              const combinedLen = `${post.hook ? post.hook + '\n\n' : ''}${post.body || ''}`.trim().length;
              const isX = String(post.platform || '').includes('Twitter') || String(post.platform || '').startsWith('X');
              const overLimit = isX && combinedLen > 280;
              return `
                <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-bold text-[#747d8c]">#${idx + 1}</span>
                      <select onchange="updateSocialPostTemplate(${idx}, 'platform', this.value); renderContentEditor();" class="px-2.5 py-1 border border-[#dfd8cc] rounded-lg text-xs font-bold bg-white">
                        ${SOCIAL_POST_PLATFORMS.map((pl) => `<option value="${escapeHtml(pl)}" ${post.platform === pl ? 'selected' : ''}>${escapeHtml(pl)}</option>`).join('')}
                      </select>
                      <select onchange="updateSocialPostTemplate(${idx}, 'format', this.value)" class="px-2.5 py-1 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-[#FAF4EB]">
                        ${SOCIAL_POST_FORMATS.map((fmt) => `<option value="${fmt.key}" ${post.format === fmt.key ? 'selected' : ''}>${escapeHtml(fmt.label)}</option>`).join('')}
                      </select>
                      <span id="dash-sp-len-${idx}" class="text-[11px] font-mono px-2 py-0.5 rounded border ${overLimit ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}">${combinedLen}${isX ? '/280' : 'c'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57606f] cursor-pointer">
                        <input type="checkbox" ${post.enabled !== false ? 'checked' : ''} onchange="toggleSocialPostEnabled(${idx})" class="rounded border-[#dfd8cc] text-[#6c5ce7]">
                        <span>Active</span>
                      </label>
                      <button type="button" onclick="removeSocialPostTemplate(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-[#57606f] mb-1">Opening Hook / Title</label>
                    <input type="text" value="${escapeHtml(post.hook || '')}" placeholder="Punchy first line to stop the scroll..." oninput="updateSocialPostTemplate(${idx}, 'hook', this.value); updateSocialPostLengthBadge(${idx});" class="w-full px-3 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-white">
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-[#57606f] mb-1">Post Body</label>
                    <textarea id="dash-sp-body-${idx}" rows="4" placeholder="Write the post body, thread points, or launch update..." oninput="updateSocialPostTemplate(${idx}, 'body', this.value); updateSocialPostLengthBadge(${idx});" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(post.body || '')}</textarea>
                  </div>

                  <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input type="url" id="dash-sp-cta-${idx}" value="${escapeHtml(post.ctaUrl || '')}" placeholder="Optional CTA or UTM link (https://...)" oninput="updateSocialPostTemplate(${idx}, 'ctaUrl', this.value)" class="flex-1 px-3 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-mono bg-white">
                    <button type="button" onclick="fillSocialPostUtmUrl(${idx})" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#FAF4EB] border border-[#dfd8cc] text-[#57606f] hover:bg-[#F2EBE0] whitespace-nowrap">Use Brand UTM URL</button>
                  </div>

                  ${gallery.length > 0 ? `
                    <div class="pt-1 border-t border-[#F2EBE0]">
                      <div class="text-[11px] font-semibold text-[#57606f] mb-1.5">Attached Gallery Visuals (${post.mediaGalleryIds.length} selected — references Gallery Hub)</div>
                      <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
                        ${gallery.slice(0, 12).map((gItem) => {
                          const isSelected = post.mediaGalleryIds.includes(gItem.id);
                          return `
                            <button type="button" onclick="toggleSocialPostGalleryMedia(${idx}, '${escapeHtml(gItem.id)}')" title="${escapeHtml(getGalleryCategoryLabel(gItem.category))}" class="relative flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 ${isSelected ? 'border-[#6c5ce7] ring-2 ring-[#6c5ce7]/25' : 'border-[#dfd8cc] opacity-75 hover:opacity-100'} transition">
                              <img src="${escapeHtml(gItem.url)}" alt="" class="w-full h-full object-cover">
                              ${isSelected ? `<span class="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#6c5ce7] text-white text-[9px] flex items-center justify-center font-bold">✓</span>` : ''}
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <div class="flex items-center justify-end gap-2 pt-1">
                    <button type="button" onclick="copyDashboardSocialPost(${idx}, this)" class="px-2.5 py-1.5 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] text-[#1e222a] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"><i class="far fa-copy text-[11px]"></i><span>Copy Post</span></button>
                    ${renderDashboardAiDropdownHtml(domKey, 'social_post', '', idx)}
                  </div>
                  ${renderDashboardCustomAiBoxHtml(domKey, 'social_post', '', idx)}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  } else if (tab === 'support') {
    const sup = ensureDashboardSupport(brand);
    const activeView = state.supportActiveView === 'macros' ? 'macros' : 'faqs';
    const q = String(state.supportSearchQuery || '').trim().toLowerCase();
    const catFilter = state.supportCategoryFilter || 'all';

    const filteredFaqs = sup.faqs
      .map((faq, idx) => ({ item: faq, idx }))
      .filter(({ item }) => {
        if (catFilter !== 'all' && item.category !== catFilter) return false;
        if (!q) return true;
        return (`${item.question} ${item.answer} ${item.category}`).toLowerCase().includes(q);
      });

    const filteredMacros = sup.macros
      .map((mac, idx) => ({ item: mac, idx }))
      .filter(({ item }) => {
        if (catFilter !== 'all' && item.category !== catFilter) return false;
        if (!q) return true;
        return (`${item.title} ${item.body} ${item.category}`).toLowerCase().includes(q);
      });

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 class="text-sm font-bold text-[#1e222a]">Support &amp; FAQs (${sup.faqs.length} FAQs · ${sup.macros.length} Macros)</h3>
            <p class="text-[11px] text-[#57606f] mt-0.5">Searchable FAQ knowledge base and canned customer support macros ready to copy or insert in helpdesks.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="autoGenerateDashboardModule('support', this)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition whitespace-nowrap">✨ Auto Generate</button>
            <button type="button" onclick="${activeView === 'faqs' ? 'addSupportFaq()' : 'addSupportMacro()'}" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">${activeView === 'faqs' ? '+ Add FAQ' : '+ Add Macro'}</button>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="inline-flex rounded-lg border border-[#dfd8cc] bg-[#FAF4EB] p-0.5 self-start">
            <button type="button" onclick="setDashboardSupportView('faqs')" class="px-3 py-1 rounded-md text-xs font-bold transition ${activeView === 'faqs' ? 'bg-white text-[#1e222a] shadow-sm' : 'text-[#57606f] hover:text-[#1e222a]'}">FAQs (${sup.faqs.length})</button>
            <button type="button" onclick="setDashboardSupportView('macros')" class="px-3 py-1 rounded-md text-xs font-bold transition ${activeView === 'macros' ? 'bg-white text-[#1e222a] shadow-sm' : 'text-[#57606f] hover:text-[#1e222a]'}">Support Macros (${sup.macros.length})</button>
          </div>

          <div class="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
            <input type="text" value="${escapeHtml(state.supportSearchQuery || '')}" placeholder="Search FAQs &amp; macros..." oninput="state.supportSearchQuery=this.value; renderContentEditor();" class="flex-1 px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs">
            <select onchange="state.supportCategoryFilter=this.value; renderContentEditor();" class="px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-white">
              <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Categories</option>
              ${SUPPORT_CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}" ${catFilter === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
            </select>
          </div>
        </div>

        ${activeView === 'faqs' ? (
          filteredFaqs.length === 0 ? `
            <div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">
              No FAQs match this filter yet. Click <strong>✨ Auto Generate</strong> or <strong>+ Add FAQ</strong>.
            </div>
          ` : `
            <div class="space-y-3">
              ${filteredFaqs.map(({ item, idx }) => {
                const domKey = `support_faq-${idx}`;
                return `
                  <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#747d8c]">FAQ #${idx + 1}</span>
                        <select onchange="updateSupportFaq(${idx}, 'category', this.value)" class="px-2.5 py-1 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-[#FAF4EB]">
                          ${SUPPORT_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="flex items-center gap-2">
                        <label class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57606f] cursor-pointer">
                          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleSupportFaqEnabled(${idx})" class="rounded border-[#dfd8cc] text-[#6c5ce7]">
                          <span>Active</span>
                        </label>
                        <button type="button" onclick="removeSupportFaq(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
                      </div>
                    </div>
                    <input type="text" value="${escapeHtml(item.question || '')}" placeholder="Customer Question..." oninput="updateSupportFaq(${idx}, 'question', this.value)" class="w-full px-3 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-bold bg-white">
                    <textarea rows="3" placeholder="Clear, accurate answer grounded in your Brand Assets..." oninput="updateSupportFaq(${idx}, 'answer', this.value)" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(item.answer || '')}</textarea>
                    <div class="flex items-center justify-end gap-2">
                      <button type="button" onclick="copyDashboardSupportFaq(${idx}, this)" class="px-2.5 py-1.5 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] text-[#1e222a] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"><i class="far fa-copy text-[11px]"></i><span>Copy Answer</span></button>
                      ${renderDashboardAiDropdownHtml(domKey, 'support_faq', '', idx)}
                    </div>
                    ${renderDashboardCustomAiBoxHtml(domKey, 'support_faq', '', idx)}
                  </div>
                `;
              }).join('')}
            </div>
          `
        ) : (
          filteredMacros.length === 0 ? `
            <div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">
              No Support Macros match this filter yet. Click <strong>✨ Auto Generate</strong> or <strong>+ Add Macro</strong>.
            </div>
          ` : `
            <div class="space-y-3">
              ${filteredMacros.map(({ item, idx }) => {
                const domKey = `support_macro-${idx}`;
                return `
                  <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-[#747d8c]">Macro #${idx + 1}</span>
                        <select onchange="updateSupportMacro(${idx}, 'category', this.value)" class="px-2.5 py-1 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-[#FAF4EB]">
                          ${SUPPORT_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="flex items-center gap-2">
                        <label class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#57606f] cursor-pointer">
                          <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="toggleSupportMacroEnabled(${idx})" class="rounded border-[#dfd8cc] text-[#6c5ce7]">
                          <span>Active</span>
                        </label>
                        <button type="button" onclick="removeSupportMacro(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
                      </div>
                    </div>
                    <input type="text" value="${escapeHtml(item.title || '')}" placeholder="Macro Title (e.g. Refund Policy / Onboarding Help)" oninput="updateSupportMacro(${idx}, 'title', this.value)" class="w-full px-3 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-bold bg-white">
                    <textarea rows="4" placeholder="Write the reusable support reply template..." oninput="updateSupportMacro(${idx}, 'body', this.value)" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(item.body || '')}</textarea>
                    <div class="flex items-center justify-end gap-2">
                      <button type="button" onclick="copyDashboardSupportMacro(${idx}, this)" class="px-2.5 py-1.5 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] text-[#1e222a] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"><i class="far fa-copy text-[11px]"></i><span>Copy Macro</span></button>
                      ${renderDashboardAiDropdownHtml(domKey, 'support_macro', '', idx)}
                    </div>
                    ${renderDashboardCustomAiBoxHtml(domKey, 'support_macro', '', idx)}
                  </div>
                `;
              }).join('')}
            </div>
          `
        )}
      </div>
    `;
  } else if (tab === 'directories') {
    const dir = brand.directory || (brand.directory = {});
    ['taglines', 'pitches', 'summaries', 'descriptions', 'slides'].forEach((k) => { if (!Array.isArray(dir[k])) dir[k] = []; });
    const dirMaxLens = { taglines: 60, pitches: 140, summaries: 250, descriptions: null };
    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 class="text-sm font-bold text-[#1e222a]">Directory Submission Copy (Multi-Length)</h3>
        <button type="button" onclick="prefillDirectoryFromBrandAssets()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition whitespace-nowrap self-start">Pre-fill from Brand Assets</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Directory Product Name</label>
          <input type="text" value="${escapeHtml(dir.productName || '')}" oninput="updateBrandField('directory.productName', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Category</label>
          <input type="text" value="${escapeHtml(dir.category || '')}" oninput="updateBrandField('directory.category', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Pricing Model &amp; Price</label>
          <input type="text" value="${escapeHtml(dir.startingPrice || '')}" oninput="updateBrandField('directory.startingPrice', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
      </div>

      <div class="mb-5 pb-5 border-b border-[#F2EBE0]">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Media Assets (Local Upload — Drag &amp; Drop in Extension)</label>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div class="border border-[#dfd8cc] rounded-xl p-3 bg-[#FAF4EB]/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-[#1e222a]">Logo</span>
              <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition">
                <span>+ Upload Logo</span>
                <input type="file" accept="image/*" class="hidden" onchange="handleDashboardDirAssetUpload('logoUrl', this)">
              </label>
            </div>
            ${dir.logoUrl ? `
              <div class="flex items-center justify-between gap-3 bg-white border border-[#dfd8cc] rounded-lg p-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <img src="${escapeHtml(dir.logoUrl)}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, 'logo.png')" class="w-10 h-10 object-contain rounded border border-[#dfd8cc] bg-white cursor-grab flex-shrink-0" title="Drag onto webpage upload field">
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-[#1e222a] truncate">Logo Ready</div>
                    <div class="text-[10px] text-[#747d8c]">Drag image to upload field</div>
                  </div>
                </div>
                <button type="button" onclick="clearDashboardDirAsset('logoUrl')" class="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded" title="Remove logo"><i class="fas fa-trash"></i></button>
              </div>
            ` : `<div class="text-xs text-[#747d8c] italic py-2">No logo uploaded yet.</div>`}
          </div>

          <div class="border border-[#dfd8cc] rounded-xl p-3 bg-[#FAF4EB]/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-[#1e222a]">Favicon</span>
              <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition">
                <span>+ Upload Favicon</span>
                <input type="file" accept="image/*,.ico" class="hidden" onchange="handleDashboardDirAssetUpload('faviconUrl', this)">
              </label>
            </div>
            ${dir.faviconUrl ? `
              <div class="flex items-center justify-between gap-3 bg-white border border-[#dfd8cc] rounded-lg p-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <img src="${escapeHtml(dir.faviconUrl)}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, 'favicon.png')" class="w-10 h-10 object-contain rounded border border-[#dfd8cc] bg-white cursor-grab flex-shrink-0" title="Drag onto webpage upload field">
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-[#1e222a] truncate">Favicon Ready</div>
                    <div class="text-[10px] text-[#747d8c]">Drag image to upload field</div>
                  </div>
                </div>
                <button type="button" onclick="clearDashboardDirAsset('faviconUrl')" class="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded" title="Remove favicon"><i class="fas fa-trash"></i></button>
              </div>
            ` : `<div class="text-xs text-[#747d8c] italic py-2">No favicon uploaded yet.</div>`}
          </div>
        </div>

        <div class="border border-[#dfd8cc] rounded-xl p-3 bg-[#FAF4EB]/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-[#1e222a]">Screenshots / Slides (${dir.slides.length})</span>
            <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition">
              <span>+ Upload Slides</span>
              <input type="file" accept="image/*" multiple class="hidden" onchange="handleDashboardDirSlidesUpload(this)">
            </label>
          </div>
          ${dir.slides.length === 0 ? `<div class="text-xs text-[#747d8c] italic py-2">No slides uploaded yet. Upload local screenshots to sync with the extension.</div>` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${dir.slides.map((s, idx) => `
                <div class="flex items-center justify-between gap-2.5 bg-white border border-[#dfd8cc] rounded-lg p-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-[11px] font-bold text-[#747d8c]">#${idx + 1}</span>
                    <img src="${escapeHtml(s.url || '')}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, '${escapeHtml(s.name || `slide-${idx + 1}.png`)}')" class="w-12 h-9 object-cover rounded border border-[#dfd8cc] cursor-grab flex-shrink-0" title="Drag onto webpage upload field">
                    <div class="min-w-0">
                      <div class="text-xs font-semibold text-[#1e222a] truncate">${escapeHtml(s.name || `Slide #${idx + 1}`)}</div>
                      <div class="text-[10px] text-[#747d8c]">Drag to upload field</div>
                    </div>
                  </div>
                  <button type="button" onclick="removeDashboardDirSlide(${idx})" class="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded flex-shrink-0" title="Remove slide"><i class="fas fa-trash"></i></button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      ${['taglines', 'pitches', 'summaries', 'descriptions'].map((field) => {
        const maxLen = dirMaxLens[field];
        return `
        <div class="mb-5 pb-5 border-b border-[#F2EBE0] last:border-0">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-bold uppercase tracking-wider text-[#57606f]">${escapeHtml(field)}${maxLen ? ` <span class="font-normal text-[#747d8c]">(max ${maxLen} chars)</span>` : ''}</label>
            <button type="button" onclick="addDirectoryCopyVariation('${field}')" class="text-xs font-semibold text-[#6c5ce7] hover:text-[#5b4bc4] hover:underline">+ Add variation</button>
          </div>
          <div class="space-y-2.5">
            ${dir[field].length === 0 ? `<div class="text-xs text-[#747d8c] italic">No ${field} added yet. Click <strong>+ Add variation</strong>.</div>` : dir[field].map((item, idx) => {
              const txt = item.text || '';
              const domKey = `dir-${field}-${idx}`;
              return `
              <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-3 bg-white space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold text-[#747d8c]">#${idx + 1}</span>
                  <div class="flex items-center gap-2">
                    <span id="dash-dir-char-${field}-${idx}" class="text-[11px] font-mono text-[#747d8c]">${maxLen ? `${txt.length}/${maxLen}` : `Char: ${txt.length}`}</span>
                    <button type="button" onclick="removeDirectoryVariation('${field}', ${idx})" class="text-[#747d8c] hover:text-red-600 p-1 text-xs"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
                <textarea rows="${field === 'descriptions' ? 3 : 2}" ${maxLen ? `maxlength="${maxLen}"` : ''} oninput="updateDirectoryVariation('${field}', ${idx}, this.value); const el=document.getElementById('dash-dir-char-${field}-${idx}'); if(el) el.textContent=${maxLen ? `this.value.length+'/${maxLen}'` : `'Char: '+this.value.length`};" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs leading-relaxed">${escapeHtml(txt)}</textarea>
                <div class="flex items-center justify-end gap-2">
                  ${renderDashboardAiDropdownHtml(domKey, 'directory', field, idx)}
                </div>
                ${renderDashboardCustomAiBoxHtml(domKey, 'directory', field, idx)}
              </div>
              `;
            }).join('')}
          </div>
        </div>
        `;
      }).join('')}
    `;
  } else if (tab === 'comments') {
    const comments = ensureDashboardBrandCommentsNormalized(brand);
    const subMode = state.commentsSubMode === 'auto' ? 'auto' : 'saved';

    // Ensure Auto comments default suggestions are populated for active brand
    if ((!state.autoCommentsSuggestions.organic || state.autoCommentsSuggestions.organic.length === 0) &&
        (!state.autoCommentsSuggestions.promo || state.autoCommentsSuggestions.promo.length === 0)) {
      state.autoCommentsSuggestions = buildLocalAutoCommentsForBrand(brand, state.autoCommentsTopic);
    }

    const activeFilter = state.autoCommentsFilter === 'promo' ? 'promo' : 'organic';
    const autoList = activeFilter === 'promo'
      ? (state.autoCommentsSuggestions.promo || [])
      : (state.autoCommentsSuggestions.organic || []);

    const availableTags = getCampaignAvailableTags(brand);
    const tagCounts = getCommentTagCounts(brand, { enabledOnly: false });
    const { visibleEntries } = getFilteredSortedDashboardComments(brand);
    const activeMgmtFilter = state.commentsMgmtTagFilter || 'all';
    const activeSort = state.commentsSort || 'default';
    const selectedSet = state.selectedCommentIds instanceof Set ? state.selectedCommentIds : (state.selectedCommentIds = new Set());
    const selectedCount = selectedSet.size;
    const customTagsOnly = availableTags.filter((t) => t.toLowerCase() !== 'general');
    const safeCfg = brand.safeDomain || { enabled: false, value: '' };
    const defaultSafePreview = getDefaultSafeDomainValue(brand) || 'yourdomain .com';
    const defaultBulkTag = (state.bulkTagTarget && availableTags.some((t) => t.toLowerCase() === String(state.bulkTagTarget).toLowerCase()))
      ? availableTags.find((t) => t.toLowerCase() === String(state.bulkTagTarget).toLowerCase())
      : (customTagsOnly[0] || DEFAULT_COMMENT_TAG);
    state.bulkTagTarget = defaultBulkTag;

    if (state.openDashboardTagPopoverId && !visibleEntries.some((entry) => entry.c.id === state.openDashboardTagPopoverId)) {
      state.openDashboardTagPopoverId = null;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Segmented Toggle: Saved Comments | Auto Comments -->
        <div class="inline-flex w-full sm:w-auto p-1 bg-[#F2EBE0] border border-[#dfd8cc] rounded-xl gap-1">
          <button type="button" onclick="switchDashboardCommentsSubMode('saved')" class="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs transition ${subMode === 'saved' ? 'bg-white text-[#1e222a] font-bold shadow-sm' : 'text-[#57606f] font-semibold hover:text-[#1e222a]'}">Saved Comments (${comments.length})</button>
          <button type="button" onclick="switchDashboardCommentsSubMode('auto')" class="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs transition ${subMode === 'auto' ? 'bg-white text-[#5b4bc4] font-bold shadow-sm' : 'text-[#57606f] font-semibold hover:text-[#1e222a]'}">Auto Comments</button>
        </div>

        ${subMode === 'saved' ? `
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="max-w-md">
              <h3 class="text-sm font-bold text-[#1e222a]">Saved Comments (Spin-Tax Supported)</h3>
              <p class="text-xs text-[#57606f] mt-1 leading-relaxed">Use <code class="font-mono bg-[#FAF4EB] border border-[#dfd8cc] px-1 rounded">{option A|option B}</code> syntax for natural rotation. Editing &amp; management only — select the Active Posting Pool inside the Chrome Side Panel when posting.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3 shrink-0 self-start">
              <label class="inline-flex items-center gap-1.5 text-xs text-[#57606f] cursor-pointer select-none" title="Sync Auto-Variation with Chrome Side Panel">
                <input type="checkbox" ${state.settings?.autoVariation ? 'checked' : ''} onchange="toggleDashboardAutoVariation(this.checked)" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
                <span class="font-medium">Auto-variation</span>
              </label>
              <div class="inline-flex items-center p-0.5 bg-[#F2EBE0] border border-[#dfd8cc] rounded-lg gap-0.5 ${state.settings?.autoVariation ? '' : 'opacity-65'}" title="Auto-Variation Creativity Level (1–5)">
                ${[1, 2, 3, 4, 5].map((lvl) => {
                  const cur = migrateDashboardRandomnessLevel(state.settings?.randomnessLevel ?? 3, Boolean(state.settings?.sp_randomness_v2_migrated));
                  const active = cur === lvl;
                  const lbl = lvl >= 4 ? `${lvl}✦` : `${lvl}`;
                  return `<button type="button" onclick="setDashboardRandomnessLevel(${lvl}, true)" class="px-2 py-0.5 rounded-md text-[11px] font-bold transition ${active ? 'bg-white text-[#5b4bc4] shadow-sm border border-[#d4cdfc]' : 'text-[#57606f] hover:text-[#1e222a]'}">${lbl}</button>`;
                }).join('')}
              </div>
              <label class="inline-flex items-center gap-1.5 text-xs text-[#57606f] cursor-pointer select-none" title="Sync burst typing simulation with Chrome Side Panel">
                <input type="checkbox" ${state.settings?.simulateKeystrokes ? 'checked' : ''} onchange="toggleDashboardBurstTyping(this.checked)" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
                <span class="font-medium">Burst Typing</span>
              </label>
              <button type="button" onclick="addSocialComment()" class="sp-btn-primary px-3.5 py-2 rounded-lg text-xs whitespace-nowrap">+ Add variation</button>
            </div>
          </div>

          <!-- Safe Domain Row (Directly below Auto-variation row) -->
          <div class="bg-[#FAF4EB] border border-[#dfd8cc] rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-3">
            <label class="inline-flex items-center gap-2 text-xs font-bold text-[#1e222a] cursor-pointer select-none shrink-0" title="Replace clickable URLs with a safe plain-text domain format for strict platforms">
              <input type="checkbox" id="dash-safe-domain-toggle" ${safeCfg.enabled ? 'checked' : ''} onchange="toggleDashboardSafeDomain(this.checked)" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
              <span>Safe domain</span>
            </label>
            <div class="flex-1 min-w-[200px] flex items-center gap-2">
              <input type="text" id="dash-safe-domain-input" value="${escapeHtml(safeCfg.value || '')}" oninput="updateDashboardSafeDomainValue(this.value)" placeholder="Alternative domain (e.g. ${escapeHtml(defaultSafePreview)})" class="flex-1 px-3 py-1.5 bg-white border border-[#dfd8cc] rounded-lg text-xs font-mono text-[#1e222a]">
              <button type="button" onclick="autoFillDashboardSafeDomain()" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap" title="Auto-suggest from campaign URL">Auto</button>
            </div>
            <span class="text-[11px] text-[#747d8c]">Replaces <code class="font-mono bg-white px-1 rounded border border-[#dfd8cc]">{url}</code> &amp; campaign domain when enabled</span>
          </div>

          <!-- Campaign Tag Manager -->
          <div class="bg-white border border-[#dfd8cc] rounded-xl p-3 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-[#1e222a]">Campaign Tags</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FAF4EB] text-[#57606f] border border-[#dfd8cc]">Campaign-specific • New comments default to General</span>
              </div>
              <div class="flex items-center gap-1.5">
                <input type="text" id="dash-campaign-new-tag-input" placeholder="+ New tag (e.g. YouTube)" onkeydown="if(event.key==='Enter'){event.preventDefault();createDashboardCampaignTagFromInput();}" class="w-40 sm:w-48 px-2.5 py-1 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">
                <button type="button" onclick="createDashboardCampaignTagFromInput()" class="sp-btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold">Add Tag</button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="setDashboardCommentsTagFilter('all')" class="dash-tag-chip ${activeMgmtFilter === 'all' ? 'active' : ''}">
                <span>All</span>
                <span class="dash-tag-chip-count">(${tagCounts.all || 0})</span>
              </button>
              ${availableTags.map((tag) => {
                const isGeneral = tag.toLowerCase() === 'general';
                const isActive = activeMgmtFilter.toLowerCase() === tag.toLowerCase();
                const isRenaming = !isGeneral && state.renamingCampaignTag && state.renamingCampaignTag.toLowerCase() === tag.toLowerCase();
                const safeTag = escapeHtml(tag);
                if (isRenaming) {
                  return `
                    <div class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#6c5ce7] bg-[#f1effe]">
                      <input type="text" id="dash-campaign-rename-tag-input" value="${safeTag}" data-old-tag="${safeTag}" onkeydown="if(event.key==='Enter'){event.preventDefault();commitRenameDashboardCampaignTag(this.dataset.oldTag, this.value);}else if(event.key==='Escape'){event.preventDefault();cancelRenameDashboardCampaignTag();}" class="w-28 px-1.5 py-0.5 text-[11px] bg-white border border-[#d4cdfc] rounded">
                      <button type="button" data-old-tag="${safeTag}" onclick="commitRenameDashboardCampaignTag(this.dataset.oldTag, document.getElementById('dash-campaign-rename-tag-input')?.value)" class="text-[11px] font-bold text-[#5b4bc4] px-1 hover:underline">Save</button>
                      <button type="button" onclick="cancelRenameDashboardCampaignTag()" class="text-[11px] text-[#747d8c] px-1 hover:text-[#1e222a]">✕</button>
                    </div>
                  `;
                }
                return `
                  <div class="dash-tag-chip ${isActive ? 'active' : ''}">
                    <button type="button" data-tag="${safeTag}" onclick="setDashboardCommentsTagFilter(this.dataset.tag)" class="inline-flex items-center gap-1 cursor-pointer">
                      ${isGeneral ? `<i class="fas fa-lock text-[9px] opacity-60" title="Default tag (locked)"></i>` : ''}
                      <span>${safeTag}</span>
                      <span class="dash-tag-chip-count">(${tagCounts[tag] || 0})</span>
                    </button>
                    ${!isGeneral ? `
                      <button type="button" data-tag="${safeTag}" onclick="startRenameDashboardCampaignTag(this.dataset.tag)" title="Rename tag" class="dash-tag-chip-action">
                        <i class="fas fa-pen text-[9px]"></i>
                      </button>
                      <button type="button" data-tag="${safeTag}" onclick="deleteDashboardCampaignTag(this.dataset.tag)" title="Delete tag" class="dash-tag-chip-action danger">
                        <i class="fas fa-times text-[10px]"></i>
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Management Controls Bar (Filter + Sort + Select Visible) -->
          <div class="flex flex-wrap items-center justify-between gap-2.5 px-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57606f] cursor-pointer select-none">
                <input type="checkbox" id="dash-comments-select-all" onchange="toggleSelectAllVisibleComments(this.checked)" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
                <span>Select visible (${visibleEntries.length})</span>
              </label>
              <div class="w-44">
                <select id="dash-comments-tag-filter" onchange="setDashboardCommentsTagFilter(this.value)" class="w-full text-xs">
                  <option value="all" ${activeMgmtFilter === 'all' ? 'selected' : ''}>All Tags (${tagCounts.all || 0})</option>
                  ${availableTags.map((tag) => {
                    const safeTag = escapeHtml(tag);
                    const sel = activeMgmtFilter.toLowerCase() === tag.toLowerCase() ? 'selected' : '';
                    return `<option value="${safeTag}" ${sel}>${safeTag} (${tagCounts[tag] || 0})</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="w-44">
                <select id="dash-comments-sort" onchange="setDashboardCommentsSort(this.value)" class="w-full text-xs">
                  <option value="default" ${activeSort === 'default' ? 'selected' : ''}>Sort: Priority Order</option>
                  <option value="starred" ${activeSort === 'starred' ? 'selected' : ''}>Sort: Starred First</option>
                  <option value="enabled" ${activeSort === 'enabled' ? 'selected' : ''}>Sort: Active First</option>
                  <option value="alpha" ${activeSort === 'alpha' ? 'selected' : ''}>Sort: A → Z</option>
                  <option value="tag" ${activeSort === 'tag' ? 'selected' : ''}>Sort: By Tag Group</option>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2 text-xs text-[#747d8c]">
              <span>Showing <strong class="text-[#1e222a]">${visibleEntries.length}</strong> of ${comments.length}</span>
              ${activeMgmtFilter !== 'all' ? `<button type="button" onclick="setDashboardCommentsTagFilter('all')" class="text-[#6c5ce7] font-bold hover:underline">Clear filter</button>` : ''}
            </div>
          </div>

          ${selectedCount > 0 ? `
            <!-- Bulk Tagging & Batch Actions Bar -->
            <div class="bg-[#f1effe] border border-[#6c5ce7]/45 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
              <div class="flex items-center gap-2.5">
                <span class="text-xs font-extrabold text-[#5b4bc4]">${selectedCount} selected</span>
                <button type="button" onclick="clearDashboardCommentSelection()" class="text-[11px] font-semibold text-[#57606f] hover:text-[#1e222a] underline">Clear</button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <div class="w-36">
                  <select id="dash-bulk-tag-select" onchange="state.bulkTagTarget = this.value" class="w-full text-xs">
                    ${availableTags.map((tag) => {
                      const safeTag = escapeHtml(tag);
                      const sel = defaultBulkTag.toLowerCase() === tag.toLowerCase() ? 'selected' : '';
                      return `<option value="${safeTag}" ${sel}>${safeTag}</option>`;
                    }).join('')}
                  </select>
                </div>
                <button type="button" onclick="applyBulkCommentTagAction('add')" class="sp-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap">+ Add Tag</button>
                <button type="button" onclick="applyBulkCommentTagAction('remove')" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap">- Remove Tag</button>
                <span class="h-4 w-px bg-[#d4cdfc] hidden sm:inline-block"></span>
                <button type="button" onclick="applyBulkCommentStatus(true)" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-700">Enable</button>
                <button type="button" onclick="applyBulkCommentStatus(false)" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] text-[#57606f]">Disable</button>
                <button type="button" onclick="deleteBulkSelectedComments()" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white text-red-600 border border-red-200 hover:bg-red-50 transition">Delete</button>
              </div>
            </div>
          ` : ''}

          <div class="space-y-3">
            ${comments.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">No saved comments yet. Click <strong>+ Add variation</strong> or save one from <strong>Auto Comments</strong>.</div>` : visibleEntries.length === 0 ? `
              <div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg space-y-2">
                <div>No comments tagged <strong>${escapeHtml(activeMgmtFilter)}</strong> yet.</div>
                <button type="button" onclick="setDashboardCommentsTagFilter('all')" class="sp-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold">Show All Tags</button>
              </div>
            ` : visibleEntries.map(({ c, origIdx }) => {
              const isEnabled = c.enabled !== false;
              const isStarred = Boolean(c.starred);
              const isExpanded = c.isExpanded !== false;
              const isSelected = selectedSet.has(c.id);
              const text = c.text || '';
              const images = Array.isArray(c.images) ? c.images : [];
              const cleanPreview = escapeHtml(text.trim().replace(/\s+/g, ' ') || '(Empty comment)');
              const domKey = `comment-${origIdx}`;
              const safeId = escapeHtml(c.id);
              const tagStripHtml = renderDashboardCommentTagStripHtml(c, origIdx);
              const footerHtml = renderDashboardCommentFooterHtml(c, origIdx, availableTags, renderDashboardAiDropdownHtml(domKey, 'comment', '', origIdx));
              return `
                <div class="dash-comment-card border ${isSelected ? 'border-[#6c5ce7] ring-1 ring-[#6c5ce7]/20' : 'border-[#dfd8cc]'} ${isStarred ? 'is-starred' : ''} rounded-xl p-3.5 bg-white space-y-2.5 transition ${isEnabled ? '' : 'opacity-60'}" id="dash-comment-card-${origIdx}" data-comment-id="${safeId}">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <input type="checkbox" ${isSelected ? 'checked' : ''} data-comment-id="${safeId}" onchange="toggleDashboardCommentSelected(this.dataset.commentId, this.checked)" title="Select for bulk tagging" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded cursor-pointer">
                      <span class="text-[11px] font-bold text-[#747d8c] min-w-[20px]">#${origIdx + 1}</span>
                      <button type="button" onclick="toggleSocialCommentEnabled(${origIdx})" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}">
                        <span class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-[#747d8c]'}"></span>
                        ${isEnabled ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span id="dash-comment-char-${origIdx}" class="text-[11px] font-mono text-[#747d8c] px-1">Char: ${text.length}</span>
                      <button type="button" onclick="toggleDashboardCommentStarred(${origIdx})" title="${isStarred ? 'Unstar favorite' : 'Star as favorite'}" class="dash-btn-star-comment ${isStarred ? 'is-starred' : ''} w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#dfd8cc] bg-white hover:bg-[#FAF4EB] text-[#747d8c] transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      </button>
                      <button type="button" onclick="cloneSocialComment(${origIdx})" title="Duplicate / Clone comment" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#dfd8cc] bg-white hover:bg-[#FAF4EB] text-[#57606f] transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/><line x1="14.5" y1="11.5" x2="14.5" y2="17.5"/><line x1="11.5" y1="14.5" x2="17.5" y2="14.5"/></svg>
                      </button>
                      <button type="button" onclick="removeSocialComment(${origIdx})" title="Delete comment" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-600 transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                      <button type="button" onclick="toggleSocialCommentExpanded(${origIdx})" title="${isExpanded ? 'Collapse' : 'Expand'}" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#dfd8cc] bg-white hover:bg-[#FAF4EB] text-[#57606f] transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.15s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>
                  ${isExpanded ? `
                    <textarea id="dash-comment-textarea-${origIdx}" rows="3" oninput="updateSocialComment(${origIdx}, this.value)" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs leading-relaxed">${escapeHtml(text)}</textarea>
                    <div class="p-2.5 bg-[#FAF4EB]/70 border border-[#dfd8cc] rounded-lg space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-semibold text-[#57606f]">Images (${images.length}/4) — drag to webpage or sync to extension</span>
                        <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#f1effe] transition">
                          <span>+ Upload Image</span>
                          <input type="file" accept="image/*" multiple class="hidden" onchange="handleDashboardCommentImageUpload(${origIdx}, this)">
                        </label>
                      </div>
                      ${images.length > 0 ? `
                        <div class="flex flex-wrap gap-2">
                          ${images.map((img, imgIdx) => `
                            <div class="relative w-12 h-12 rounded-lg border border-[#dfd8cc] bg-white">
                              <img src="${escapeHtml(img)}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, 'comment-attachment-${imgIdx + 1}.png')" class="w-full h-full object-cover rounded-lg cursor-grab" title="Drag image onto webpage upload zone">
                              <button type="button" onclick="removeDashboardCommentImage(${origIdx}, ${imgIdx})" title="Remove image" class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none flex items-center justify-center border border-white hover:bg-red-700">✕</button>
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  ` : `
                    <div onclick="toggleSocialCommentExpanded(${origIdx})" title="Click to expand" class="sp-line-clamp-2 cursor-pointer px-3 py-2 bg-[#FAF4EB] border border-[#dfd8cc] rounded-lg text-xs text-[#57606f] leading-relaxed hover:border-[#bfb6a6]">${cleanPreview}</div>
                    ${images.length > 0 ? `
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${images.map((img, imgIdx) => `
                          <img src="${escapeHtml(img)}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, 'comment-attachment-${imgIdx + 1}.png')" class="w-7 h-7 object-cover rounded border border-[#dfd8cc] cursor-grab" title="Drag image onto webpage upload zone">
                        `).join('')}
                        <span class="text-[10px] text-[#747d8c]">${images.length} image(s)</span>
                      </div>
                    ` : ''}
                  `}
                  ${tagStripHtml}
                  ${footerHtml}
                  ${renderDashboardCustomAiBoxHtml(domKey, 'comment', '', origIdx)}
                </div>
              `;
            }).join('')}
            <button type="button" onclick="addSocialComment()" class="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[#8b5cf6] bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#5b4bc4] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer">
              <i class="fas fa-plus text-[11px]"></i>
              <span>Add variation</span>
            </button>
          </div>
        ` : `
          <!-- Auto Comments Panel (Dashboard Parity, no Insert button) -->
          <div class="border border-[#d4cdfc] bg-[#f1effe]/60 rounded-xl p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-star text-[#6c5ce7] text-xs"></i>
                <h3 class="text-sm font-bold text-[#1e222a]">Auto comments</h3>
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">${escapeHtml(brand.brandInfo?.name || brand.brandName || 'Product')}</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" onclick="refreshDashboardAutoComments()" class="sp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[#d4cdfc] text-[#5b4bc4] hover:bg-[#f1effe] text-xs font-bold">
                  <i class="fas fa-sync-alt ${state.autoCommentsLoading ? 'fa-spin' : ''} text-[11px]"></i>
                  <span>Refresh</span>
                </button>
                <label class="inline-flex items-center gap-1.5 text-xs text-[#1e222a] font-semibold cursor-pointer">
                  <input type="checkbox" ${state.autoThreadSuggestions !== false ? 'checked' : ''} onchange="state.autoThreadSuggestions = this.checked" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
                  <span>Auto</span>
                </label>
              </div>
            </div>

            <div class="flex gap-2">
              <input type="text" id="dash-auto-comments-topic" value="${escapeHtml(state.autoCommentsTopic || '')}" oninput="state.autoCommentsTopic = this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();refreshDashboardAutoComments();}" placeholder="Optional: Paste a tweet, Reddit post title, or discussion topic to tailor Auto comments..." class="flex-1 px-3 py-2 bg-white border border-[#d4cdfc] rounded-lg text-xs">
              <button type="button" onclick="refreshDashboardAutoComments()" class="sp-btn-primary px-3.5 py-2 rounded-lg text-xs whitespace-nowrap">Generate</button>
            </div>

            <!-- 2-Tier Filter Tabs: Organic | Promotional -->
            <div class="flex p-1 bg-[#e5e0fc] rounded-lg gap-1">
              <button type="button" onclick="switchDashboardAutoCommentsFilter('organic')" class="flex-1 py-1.5 px-3 rounded-md text-xs transition ${activeFilter === 'organic' ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'text-[#57606f] font-semibold hover:bg-white/60'}">🌿 Organic</button>
              <button type="button" onclick="switchDashboardAutoCommentsFilter('promo')" class="flex-1 py-1.5 px-3 rounded-md text-xs transition ${activeFilter === 'promo' ? 'bg-white text-[#5b4bc4] font-bold shadow-sm' : 'text-[#57606f] font-semibold hover:bg-white/60'}">🎯 Promotional</button>
            </div>

            <div class="space-y-2.5">
              ${autoList.map((txt, sIdx) => `
                <div class="rounded-lg p-3 border ${activeFilter === 'organic' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-[#d4cdfc]'} space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${activeFilter === 'organic' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]'}">
                      ${activeFilter === 'organic' ? '🌿 Organic' : '🎯 Promo'}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <button type="button" onclick="saveAutoCommentToLibrary('${activeFilter}', ${sIdx}, this)" title="Save to Saved Comments" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#dfd8cc] bg-white hover:bg-[#FAF4EB] text-[#57606f] transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      </button>
                      <button type="button" onclick="copyAutoCommentText('${activeFilter}', ${sIdx}, this)" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#dfd8cc] bg-white hover:bg-[#FAF4EB] text-[#57606f] transition">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-[#1e222a] leading-relaxed">${escapeHtml(txt)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
    `;
  } else if (tab === 'contact') {
    const c = brand.contact || (brand.contact = {});
    const contactMsgs = ensureDashboardContactMessages(c);
    container.innerHTML = `
      <h3 class="text-sm font-bold text-[#1e222a] mb-4">Contact Form Profile</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Sender Name</label>
          <input type="text" value="${escapeHtml(c.senderName || '')}" oninput="updateBrandField('contact.senderName', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Sender Email</label>
          <input type="email" value="${escapeHtml(c.senderEmail || '')}" oninput="updateBrandField('contact.senderEmail', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Phone</label>
          <input type="text" value="${escapeHtml(c.phone || '')}" oninput="updateBrandField('contact.phone', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Company</label>
          <input type="text" value="${escapeHtml(c.company || '')}" oninput="updateBrandField('contact.company', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-[#57606f] mb-1">Default Subject</label>
          <input type="text" value="${escapeHtml(c.subject || '')}" oninput="updateBrandField('contact.subject', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs">
        </div>
      </div>

      <div class="pt-4 border-t border-[#F2EBE0] space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h4 class="text-xs font-bold text-[#1e222a]">Contact Form Message Variations (${contactMsgs.length})</h4>
            <p class="text-[11px] text-[#747d8c]">Create &amp; save multiple outreach message variations for contact forms.</p>
          </div>
          <button type="button" onclick="addContactMessageVariation()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">+ Add variation</button>
        </div>
        <div class="space-y-3">
          ${contactMsgs.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-6 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">No message variations yet. Click <strong>+ Add variation</strong>.</div>` : contactMsgs.map((item, idx) => {
            const isEnabled = item.enabled !== false;
            const text = item.text || '';
            const domKey = `contact-${idx}`;
            return `
              <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-3.5 bg-white space-y-2.5 transition ${isEnabled ? '' : 'opacity-60'}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-bold text-[#747d8c] min-w-[20px]">#${idx + 1}</span>
                    <button type="button" onclick="toggleContactMessageEnabled(${idx})" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}">
                      <span class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-[#747d8c]'}"></span>
                      ${isEnabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span id="dash-contact-char-${idx}" class="text-[11px] font-mono text-[#747d8c] px-1">Char: ${text.length}</span>
                    <button type="button" onclick="removeContactMessageVariation(${idx})" class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-600 transition">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                <textarea id="dash-contact-textarea-${idx}" rows="4" oninput="updateContactMessageVariation(${idx}, this.value)" placeholder="Write contact form message..." class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs leading-relaxed">${escapeHtml(text)}</textarea>
                <div class="flex items-center justify-between gap-2 pt-0.5">
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="copyDashboardContactMessage(${idx}, this)" class="sp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                      <span>Copy</span>
                    </button>
                    <button type="button" onclick="saveSingleDashboardContactMessage(${idx}, this)" class="sp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      <span>Save</span>
                    </button>
                  </div>
                  ${renderDashboardAiDropdownHtml(domKey, 'contact', '', idx)}
                </div>
                ${renderDashboardCustomAiBoxHtml(domKey, 'contact', '', idx)}
              </div>
            `;
          }).join('')}
          <button type="button" onclick="addContactMessageVariation()" class="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[#8b5cf6] bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#5b4bc4] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer">
            <i class="fas fa-plus text-[11px]"></i>
            <span>Add variation</span>
          </button>
        </div>
      </div>
    `;
  } else if (tab === 'email') {
    const emails = brand.emails || (brand.emails = []);
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-[#1e222a]">Cold Email Templates</h3>
        <button type="button" onclick="addEmailTemplate()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs">+ Add variation</button>
      </div>
      <div class="space-y-4">
        ${emails.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">No email variations yet. Click <strong>+ Add variation</strong>.</div>` : emails.map((em, idx) => {
          const domKey = `email-${idx}`;
          const isEnabled = em.enabled !== false;
          const bodyText = em.body || '';
          return `
          <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white ${isEnabled ? '' : 'opacity-60'}">
            <div class="flex justify-between items-center gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-[#1e222a]">Email #${idx + 1}</span>
                <button type="button" onclick="toggleEmailTemplateEnabled(${idx})" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}">
                  <span class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-[#747d8c]'}"></span>
                  ${isEnabled ? 'Active' : 'Disabled'}
                </button>
              </div>
              <div class="flex items-center gap-2">
                <span id="dash-email-char-${idx}" class="text-[11px] font-mono text-[#747d8c]">Char: ${bodyText.length}</span>
                <button type="button" onclick="removeEmailTemplate(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            </div>
            <input type="text" value="${escapeHtml(em.subject || '')}" placeholder="Subject line" oninput="updateEmailTemplate(${idx}, 'subject', this.value)" class="w-full px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs font-semibold">
            <textarea id="dash-email-body-${idx}" rows="5" placeholder="Email body..." oninput="updateEmailTemplate(${idx}, 'body', this.value); const el=document.getElementById('dash-email-char-${idx}'); if(el) el.textContent='Char: '+this.value.length;" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(bodyText)}</textarea>
            <div class="flex items-center justify-end gap-2">
              ${renderDashboardAiDropdownHtml(domKey, 'email', '', idx)}
            </div>
            ${renderDashboardCustomAiBoxHtml(domKey, 'email', '', idx)}
          </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (tab === 'dm') {
    const dms = brand.dms || (brand.dms = []);
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-[#1e222a]">Direct Messages (Twitter / LinkedIn)</h3>
        <button type="button" onclick="addDmTemplate()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs">+ Add variation</button>
      </div>
      <div class="space-y-3">
        ${dms.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">No DM variations yet. Click <strong>+ Add variation</strong>.</div>` : dms.map((dm, idx) => {
          const domKey = `dm-${idx}`;
          const isEnabled = dm.enabled !== false;
          const msgText = dm.message || '';
          return `
          <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white ${isEnabled ? '' : 'opacity-60'}">
            <div class="flex justify-between items-center gap-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-[#747d8c]">#${idx + 1}</span>
                <input type="text" value="${escapeHtml(dm.platform || 'Twitter')}" oninput="updateDmTemplate(${idx}, 'platform', this.value)" class="px-2.5 py-1 border border-[#dfd8cc] rounded text-xs font-bold w-32">
                <button type="button" onclick="toggleDmTemplateEnabled(${idx})" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}">
                  <span class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-[#747d8c]'}"></span>
                  ${isEnabled ? 'Active' : 'Disabled'}
                </button>
              </div>
              <div class="flex items-center gap-2">
                <span id="dash-dm-char-${idx}" class="text-[11px] font-mono text-[#747d8c]">Char: ${msgText.length}</span>
                <button type="button" onclick="removeDmTemplate(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            </div>
            <textarea id="dash-dm-message-${idx}" rows="3" oninput="updateDmTemplate(${idx}, 'message', this.value); const el=document.getElementById('dash-dm-char-${idx}'); if(el) el.textContent='Char: '+this.value.length;" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(msgText)}</textarea>
            <div class="flex items-center justify-end gap-2">
              ${renderDashboardAiDropdownHtml(domKey, 'dm', '', idx)}
            </div>
            ${renderDashboardCustomAiBoxHtml(domKey, 'dm', '', idx)}
          </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (tab === 'articles') {
    const articles = brand.articles || (brand.articles = []);
    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h3 class="text-sm font-bold text-[#1e222a]">Articles &amp; Blogs (${articles.length})</h3>
          <p class="text-[11px] text-[#57606f] mt-0.5">Long-form SEO posts with target keywords, URL slugs, meta descriptions &amp; format presets.</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <select onchange="state.articleAutoPreset=this.value" class="px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-white">
            ${ARTICLE_SEO_PRESETS.map((p) => `<option value="${p.key}" ${(state.articleAutoPreset || 'problem-solution') === p.key ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
          </select>
          <input type="text" value="${escapeHtml(state.articleAutoKeyword || '')}" placeholder="Target SEO keyword (optional)" oninput="state.articleAutoKeyword=this.value" class="px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs bg-white w-44">
          <button type="button" onclick="autoGenerateDashboardModule('articles', this)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc] hover:bg-[#e5e0fc] transition whitespace-nowrap">✨ Auto Generate</button>
          <button type="button" onclick="addArticleTemplate()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">+ Add variation</button>
        </div>
      </div>
      <div class="space-y-4">
        ${articles.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-8 border border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-lg">No article variations yet. Click <strong>✨ Auto Generate</strong> or <strong>+ Add variation</strong>.</div>` : articles.map((art, idx) => {
          const domKey = `article-${idx}`;
          const bodyText = art.body || '';
          const wordCount = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;
          const metaLen = String(art.metaDescription || '').length;
          return `
          <div id="dash-card-${domKey}" class="border border-[#dfd8cc] rounded-xl p-4 space-y-2.5 bg-white">
            <div class="flex flex-wrap justify-between items-center gap-2">
              <span class="text-xs font-bold text-[#747d8c]">#${idx + 1}</span>
              <select onchange="updateArticleTemplate(${idx}, 'preset', this.value)" class="px-2 py-1 border border-[#dfd8cc] rounded-lg text-[11px] font-semibold bg-[#FAF4EB]">
                ${ARTICLE_SEO_PRESETS.map((p) => `<option value="${p.key}" ${(art.preset || 'problem-solution') === p.key ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
              </select>
              <input type="text" value="${escapeHtml(art.title || '')}" placeholder="Article Title" oninput="updateArticleTemplate(${idx}, 'title', this.value)" class="flex-1 min-w-[200px] px-3 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-bold">
              <span id="dash-article-char-${idx}" class="text-[11px] font-mono text-[#747d8c] whitespace-nowrap">${wordCount}w / ${bodyText.length}c</span>
              <button type="button" onclick="removeArticleTemplate(${idx})" class="text-xs text-red-600 hover:underline">Remove</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-semibold text-[#57606f] mb-0.5">Target SEO Keyword</label>
                <input type="text" value="${escapeHtml(art.targetKeyword || '')}" placeholder="e.g. cold outreach automation" oninput="updateArticleTemplate(${idx}, 'targetKeyword', this.value)" class="w-full px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs bg-white">
              </div>
              <div>
                <div class="flex items-center justify-between mb-0.5">
                  <label class="text-[11px] font-semibold text-[#57606f]">URL Slug</label>
                  <button type="button" onclick="autoFillArticleSlug(${idx})" class="text-[10px] font-semibold text-[#6c5ce7] hover:underline">From title</button>
                </div>
                <input id="dash-article-slug-${idx}" type="text" value="${escapeHtml(art.slug || '')}" placeholder="article-url-slug" oninput="updateArticleTemplate(${idx}, 'slug', this.value)" class="w-full px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-mono bg-white">
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="text-[11px] font-semibold text-[#57606f]">SEO Meta Description</label>
                <span id="dash-article-meta-len-${idx}" class="text-[10px] font-mono ${metaLen > 160 ? 'text-red-600 font-bold' : 'text-[#747d8c]'}">${metaLen}/160</span>
              </div>
              <input type="text" value="${escapeHtml(art.metaDescription || '')}" placeholder="Concise summary under 160 characters for search &amp; social cards..." oninput="updateArticleTemplate(${idx}, 'metaDescription', this.value); const el=document.getElementById('dash-article-meta-len-${idx}'); if(el){el.textContent=this.value.length+'/160'; el.className='text-[10px] font-mono '+(this.value.length>160?'text-red-600 font-bold':'text-[#747d8c]');}" class="w-full px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs bg-white">
            </div>

            <textarea id="dash-article-body-${idx}" rows="6" oninput="updateArticleTemplate(${idx}, 'body', this.value); const el=document.getElementById('dash-article-char-${idx}'); if(el){const w=this.value.trim()?this.value.trim().split(/\\s+/).length:0; el.textContent=w+'w / '+this.value.length+'c';}" class="w-full px-3 py-2 bg-[#FCF9F2] border border-[#dfd8cc] rounded-lg text-xs">${escapeHtml(bodyText)}</textarea>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" onclick="copyDashboardArticle(${idx}, 'text', this)" class="px-2.5 py-1 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] rounded-lg text-[11px] font-semibold text-[#1e222a]">Copy Text</button>
                <button type="button" onclick="copyDashboardArticle(${idx}, 'rich', this)" class="px-2.5 py-1 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] rounded-lg text-[11px] font-semibold text-[#2563eb]">Copy Rich</button>
                <button type="button" onclick="copyDashboardArticle(${idx}, 'markdown', this)" class="px-2.5 py-1 bg-white border border-[#dfd8cc] hover:bg-[#FAF4EB] rounded-lg text-[11px] font-semibold text-[#7c3aed]">Copy MD</button>
              </div>
              ${renderDashboardAiDropdownHtml(domKey, 'article', '', idx)}
            </div>
            ${renderDashboardCustomAiBoxHtml(domKey, 'article', '', idx)}
          </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (tab === 'gallery') {
    const ba = normalizeBrandAssets(brand);
    const gallery = ensureDashboardGalleryNormalized(brand);
    const cats = getDashboardGalleryCategories(brand);
    const validCatKeys = new Set(cats.map((c) => c.key));
    const primaryMedia = getPrimaryBrandMedia(brand);
    if (state.galleryCategoryFilter !== 'all' && !validCatKeys.has(state.galleryCategoryFilter)) {
      state.galleryCategoryFilter = 'all';
    }
    if (!validCatKeys.has(state.galleryUploadCategory)) {
      state.galleryUploadCategory = 'marketing';
    }
    const activeCat = state.galleryCategoryFilter || 'all';
    const uploadCat = activeCat !== 'all' ? activeCat : (state.galleryUploadCategory || 'marketing');
    const filteredEntries = gallery
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => activeCat === 'all' || normalizeGalleryCategoryKey(item.category, brand) === activeCat);

    const used = Math.max(0, Number(state.storageUsedBytes) || 0);
    const resolvedTier = state.isUnlimited ? 'unlimited' : (state.isStudio ? 'studio' : (state.isPro ? 'pro' : 'basic'));
    const limit = Math.max(1, Number(state.storageLimitBytes) || getStorageQuotaBytesForTier(resolvedTier));
    const pct = Math.min(100, Math.round((used / limit) * 100));

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h3 class="text-sm font-bold text-[#1e222a]">Unified Visual Media Hub (${gallery.length})</h3>
              <span id="gallery-storage-meter" class="text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#dfd8cc] text-[#57606f]">Storage: ${formatBytesHuman(used)} / ${formatBytesHuman(limit)} (${pct}%)</span>
            </div>
            <div class="w-56 h-1.5 rounded-full bg-[#F2EBE0] overflow-hidden">
              <div class="h-full ${pct >= 90 ? 'bg-red-600' : (pct >= 75 ? 'bg-amber-500' : 'bg-[#6c5ce7]')} transition-all" style="width:${pct}%"></div>
            </div>
            <p class="text-xs text-[#57606f]">Organize brand visuals by category, assign primary Logo / Favicon / OG Cover for Brand Assets, and drag-and-drop into any page via the Extension.</p>
          </div>
          <div class="flex items-center gap-2 self-start flex-wrap">
            <select onchange="state.galleryUploadCategory=this.value;" data-align="right" class="px-2.5 py-2 border border-[#dfd8cc] rounded-lg text-xs font-semibold bg-white">
              ${cats.map((c) => `<option value="${escapeHtml(c.key)}" ${uploadCat === c.key ? 'selected' : ''}>Upload to: ${escapeHtml(c.label)}</option>`).join('')}
            </select>
            <label class="cursor-pointer sp-btn-primary px-3.5 py-2 rounded-lg text-xs whitespace-nowrap inline-flex items-center gap-1.5">
              <span>+ Upload Images</span>
              <input type="file" accept="image/*" multiple class="hidden" onchange="handleDashboardGalleryUpload(this)">
            </label>
          </div>
        </div>

        <!-- Category Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5 pb-1">
          <button type="button" onclick="switchDashboardGalleryCategory('all')" class="px-3 py-1.5 rounded-lg text-xs font-semibold border ${activeCat === 'all' ? 'bg-[#6c5ce7] text-white border-[#6c5ce7]' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc] hover:bg-[#F2EBE0]'}">All (${gallery.length})</button>
          ${cats.map((c) => {
            const count = gallery.filter((g) => normalizeGalleryCategoryKey(g.category, brand) === c.key).length;
            const isActive = activeCat === c.key;
            const delBtn = !c.builtIn
              ? `<span onclick="event.stopPropagation(); removeDashboardGalleryCategory('${escapeHtml(c.key)}')" title="Remove category" class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/15 text-[11px] leading-none">&times;</span>`
              : '';
            return `<button type="button" onclick="switchDashboardGalleryCategory('${escapeHtml(c.key)}')" class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${isActive ? 'bg-[#6c5ce7] text-white border-[#6c5ce7]' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc] hover:bg-[#F2EBE0]'}">${escapeHtml(c.label)} (${count})${delBtn}</button>`;
          }).join('')}
          <button type="button" onclick="toggleDashboardNewGalleryCategory(true)" class="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-[#bfb6a6] bg-white text-[#6c5ce7] hover:bg-[#f1effe]/60">+ Category</button>
        </div>
        <div id="dash-gallery-new-cat-row" class="hidden items-center gap-2 max-w-sm">
          <input type="text" id="dash-gallery-new-cat-input" maxlength="24" placeholder="Category name (e.g. Others)..." onkeydown="if(event.key==='Enter'){event.preventDefault();addDashboardGalleryCategory();}else if(event.key==='Escape'){toggleDashboardNewGalleryCategory(false);}" class="flex-1 px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-semibold text-[#1e222a] bg-white">
          <button type="button" onclick="addDashboardGalleryCategory()" class="sp-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold">Add</button>
          <button type="button" onclick="toggleDashboardNewGalleryCategory(false)" class="px-2.5 py-1.5 border border-[#dfd8cc] bg-[#FAF4EB] text-[#57606f] rounded-lg text-xs font-semibold">Cancel</button>
        </div>

        <div id="dash-gallery-dropzone" ondragover="event.preventDefault(); this.classList.add('border-[#6c5ce7]', 'bg-[#f1effe]/60');" ondragleave="this.classList.remove('border-[#6c5ce7]', 'bg-[#f1effe]/60');" ondrop="handleDashboardGalleryDrop(event)" onclick="this.querySelector('input')?.click()" class="border-2 border-dashed border-[#dfd8cc] bg-[#FAF4EB]/50 rounded-xl p-5 text-center cursor-pointer transition hover:border-[#bfb6a6]">
          <input type="file" accept="image/*" multiple class="hidden" onchange="handleDashboardGalleryUpload(this)">
          <div class="text-xs font-bold text-[#1e222a]">Click or drag &amp; drop images into <span class="text-[#6c5ce7]">${escapeHtml(getGalleryCategoryLabel(uploadCat, brand))}</span></div>
          <div class="text-[11px] text-[#747d8c] mt-1">PNG, JPG, WebP, GIF &bull; Client-compressed before upload &bull; Synced to Extension Media Hub</div>
        </div>

        ${filteredEntries.length === 0 ? `<div class="text-xs text-[#747d8c] text-center py-6 border border-[#dfd8cc] rounded-xl bg-white">No images in ${activeCat === 'all' ? 'this product gallery' : escapeHtml(getGalleryCategoryLabel(activeCat, brand))} yet.</div>` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${filteredEntries.map(({ item, idx }) => {
              const isLogo = (ba.mediaRoles.logoGalleryId && ba.mediaRoles.logoGalleryId === item.id) || (primaryMedia.logoUrl && primaryMedia.logoUrl === item.url);
              const isFavicon = (ba.mediaRoles.faviconGalleryId && ba.mediaRoles.faviconGalleryId === item.id) || (primaryMedia.faviconUrl && primaryMedia.faviconUrl === item.url);
              const isOgCover = (ba.mediaRoles.ogCoverGalleryId && ba.mediaRoles.ogCoverGalleryId === item.id) || (primaryMedia.ogCoverUrl && primaryMedia.ogCoverUrl === item.url);
              return `
              <div class="border border-[#dfd8cc] rounded-xl p-3 bg-white space-y-2.5">
                <div class="relative aspect-video rounded-lg overflow-hidden border border-[#dfd8cc] bg-[#FAF4EB]">
                  <img src="${escapeHtml(item.url || '')}" draggable="true" ondragstart="handleDashboardAssetDragStart(event, '${escapeHtml(item.name || `asset-${idx + 1}.png`)}')" class="w-full h-full object-cover cursor-grab" title="Drag image onto webpage upload zone">
                  <div class="absolute top-2 left-2 flex flex-wrap gap-1">
                    ${isLogo ? `<span class="px-1.5 py-0.5 rounded bg-[#6c5ce7] text-white text-[10px] font-bold shadow-sm">LOGO</span>` : ''}
                    ${isFavicon ? `<span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow-sm">FAVICON</span>` : ''}
                    ${isOgCover ? `<span class="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold shadow-sm">OG COVER</span>` : ''}
                  </div>
                  <button type="button" onclick="removeDashboardGalleryItem(${idx})" title="Remove image" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white text-xs flex items-center justify-center border border-white shadow-sm">&#10005;</button>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  <input type="text" value="${escapeHtml(item.label || item.name || '')}" placeholder="Image label" oninput="updateDashboardGalleryLabel(${idx}, this.value)" class="px-2.5 py-1.5 border border-[#dfd8cc] rounded-lg text-xs font-semibold text-[#1e222a]">
                  <select onchange="updateDashboardGalleryCategory(${idx}, this.value)" data-align="right" class="px-2 py-1.5 border border-[#dfd8cc] rounded-lg text-[11px] font-semibold bg-[#FAF4EB] text-[#1e222a]">
                    ${cats.map((c) => `<option value="${escapeHtml(c.key)}" ${normalizeGalleryCategoryKey(item.category, brand) === c.key ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="flex flex-wrap gap-1 pt-0.5">
                  <button type="button" onclick="assignGalleryPrimaryRole(${idx}, 'logo')" class="px-2 py-1 rounded text-[10px] font-bold border ${isLogo ? 'bg-[#6c5ce7] text-white border-[#6c5ce7]' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc] hover:bg-[#F2EBE0]'}">${isLogo ? '✓ Primary Logo' : 'Set Logo'}</button>
                  <button type="button" onclick="assignGalleryPrimaryRole(${idx}, 'favicon')" class="px-2 py-1 rounded text-[10px] font-bold border ${isFavicon ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc] hover:bg-[#F2EBE0]'}">${isFavicon ? '✓ Favicon' : 'Set Favicon'}</button>
                  <button type="button" onclick="assignGalleryPrimaryRole(${idx}, 'ogCover')" class="px-2 py-1 rounded text-[10px] font-bold border ${isOgCover ? 'bg-amber-600 text-white border-amber-600' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc] hover:bg-[#F2EBE0]'}">${isOgCover ? '✓ OG Cover' : 'Set OG Cover'}</button>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  } else if (tab === 'queue') {
    const q = brand.queue || (brand.queue = Array.isArray(brand.opportunityQueue) ? brand.opportunityQueue : []);
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-[#1e222a]">Opportunity Queue (${q.length})</h3>
            <p class="text-xs text-[#57606f]">Queue target threads here or send them from the Research tab. Launch &amp; auto-fill directly from your Chrome Side Panel.</p>
          </div>
          <button type="button" onclick="clearPostedQueueItems()" class="text-xs font-semibold text-red-600 hover:underline">Clear Posted</button>
        </div>
        <div class="flex gap-2">
          <textarea id="dash-queue-bulk-input" rows="2" placeholder="Paste target URLs (one per line)..." class="flex-1 px-3 py-2 border border-[#dfd8cc] rounded-lg text-xs font-mono"></textarea>
          <button type="button" onclick="addBulkQueueUrls()" class="sp-btn-primary px-4 py-2 rounded-lg text-xs self-end">+ Add URLs</button>
        </div>
        <div class="divide-y divide-[#F2EBE0] border border-[#dfd8cc] rounded-lg bg-white">
          ${q.length === 0 ? `<div class="py-8 text-center text-xs text-[#747d8c]">Opportunity Queue is empty.</div>` : q.map((item, idx) => `
            <div class="p-3 flex items-center justify-between gap-3 hover:bg-[#FAF4EB]">
              <div class="min-w-0 flex-1">
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-mono text-[#6c5ce7] hover:underline truncate block">${escapeHtml(item.url)}</a>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <select onchange="updateQueueItemStatus(${idx}, this.value)" data-align="right" class="px-2 py-1 border border-[#dfd8cc] rounded text-[11px] font-semibold bg-white min-w-[105px]">
                  <option value="queued" ${item.status === 'queued' ? 'selected' : ''}>Queued</option>
                  <option value="injected" ${item.status === 'injected' ? 'selected' : ''}>Injected</option>
                  <option value="posted" ${item.status === 'posted' ? 'selected' : ''}>Posted</option>
                </select>
                <button type="button" onclick="removeQueueItem(${idx})" class="text-[#747d8c] hover:text-red-600 text-xs p-1"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (tab === 'rules') {
    const sup = brand.suppressionList || (brand.suppressionList = []);
    const rules = brand.postingRules || (brand.postingRules = { twitterStripProtocol: true });
    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-[#1e222a]">Campaign Suppression List (${sup.length})</h3>
            ${sup.length > 0 ? `<button type="button" onclick="clearCampaignSuppression()" class="text-[11px] font-semibold text-red-600 hover:underline">Clear All</button>` : ''}
          </div>
          <div class="space-y-2">
            <textarea id="camp-sup-input" rows="5" placeholder="Paste one or multiple domains or thread URLs (one per line or comma-separated):&#10;google.com&#10;youtube.com&#10;https://reddit.com/r/example/..." class="w-full px-3 py-2.5 border border-[#dfd8cc] rounded-lg text-xs font-mono leading-relaxed"></textarea>
            <div class="flex items-center justify-between gap-3">
              <span class="text-[11px] text-[#747d8c]">Bulk paste domains or exact thread URLs separated by line breaks or commas.</span>
              <button type="button" onclick="addCampaignSuppression()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shrink-0">+ Suppress URLs</button>
            </div>
          </div>
          <div class="space-y-1.5 max-h-60 overflow-y-auto pt-1">
            ${sup.length === 0 ? `<div class="text-xs text-[#747d8c]">No suppressed domains for this campaign.</div>` : sup.map((d, idx) => `
              <div class="flex items-center justify-between px-3 py-1.5 bg-[#FAF4EB] border border-[#dfd8cc] rounded-lg text-xs font-mono text-[#1e222a]">
                <span class="truncate">${escapeHtml(typeof d === 'string' ? d : d.url || d.domain)}</span>
                <button type="button" onclick="removeCampaignSuppression(${idx})" class="text-red-600 hover:underline ml-2 shrink-0">Remove</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="text-sm font-bold text-[#1e222a]">Platform Posting Rules</h3>
          <label class="flex items-start gap-3 p-4 border border-[#dfd8cc] rounded-xl bg-[#FAF4EB] cursor-pointer">
            <input type="checkbox" ${(state.ruleTwitterStripProtocol !== false && rules.twitterStripProtocol !== false) ? 'checked' : ''} onchange="updateTwitterStripRule(this.checked)" class="mt-0.5 accent-[#6c5ce7]">
            <div>
              <div class="text-xs font-bold text-[#1e222a]">Twitter / X: Clean Domain URLs</div>
              <div class="text-[11px] text-[#57606f] mt-1">Automatically strips <code class="font-mono">https://</code> when commenting on X/Twitter so links post cleanly without duplication glitches.</div>
            </div>
          </label>
        </div>
      </div>
    `;
  }
  enhanceAllSelects(container);
  if (tab === 'comments' && state.commentsSubMode !== 'auto') {
    const { visibleEntries } = getFilteredSortedDashboardComments(brand);
    const selectAllEl = document.getElementById('dash-comments-select-all');
    if (selectAllEl) {
      const selectedSet = state.selectedCommentIds instanceof Set ? state.selectedCommentIds : new Set();
      const visSelected = visibleEntries.filter((e) => selectedSet.has(e.c.id)).length;
      selectAllEl.checked = visibleEntries.length > 0 && visSelected === visibleEntries.length;
      selectAllEl.indeterminate = visSelected > 0 && visSelected < visibleEntries.length;
    }
    if (state.openDashboardTagPopoverId) {
      const cardEl = container.querySelector(`.dash-comment-card[data-comment-id="${CSS?.escape ? CSS.escape(state.openDashboardTagPopoverId) : state.openDashboardTagPopoverId}"]`);
      const popEl = cardEl?.querySelector('.dash-tag-popover');
      const trigEl = cardEl?.querySelector('.dash-btn-tag-trigger');
      if (popEl && trigEl) positionDashboardTagPopover(popEl, trigEl);
    }
    if (state.renamingCampaignTag) {
      const renameInput = document.getElementById('dash-campaign-rename-tag-input');
      if (renameInput) {
        setTimeout(() => { renameInput.focus(); renameInput.select?.(); }, 10);
      }
    }
  }
}

function updateBrandField(dotPath, value) {
  const brand = getActiveBrand();
  if (!brand) return;
  const parts = dotPath.split('.');
  let obj = brand;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;

  if (dotPath === 'brandAssets.shortPitch' || dotPath === 'brandAssets.longPitch') {
    if (!brand.brandInfo) brand.brandInfo = {};
    brand.brandInfo.description = String(brand.brandAssets?.longPitch || brand.brandAssets?.shortPitch || '').trim();
  } else if (dotPath === 'brandAssets.handles.twitter') {
    if (!brand.brandInfo) brand.brandInfo = {};
    brand.brandInfo.twitter = value;
  } else if (dotPath === 'brandAssets.handles.instagram') {
    if (!brand.brandInfo) brand.brandInfo = {};
    brand.brandInfo.instagram = value;
  } else if (dotPath === 'brandInfo.twitter') {
    const ba = normalizeBrandAssets(brand);
    ba.handles.twitter = value;
  } else if (dotPath === 'brandInfo.instagram') {
    const ba = normalizeBrandAssets(brand);
    ba.handles.instagram = value;
  }
  scheduleCampaignSave();
}

function addBrandAssetRow(sectionKey) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (!Array.isArray(ba[sectionKey])) ba[sectionKey] = [];
  if (sectionKey === 'competitors') {
    ba.competitors.push({ id: `comp-${Date.now()}`, name: '', advantage: '', recommendWhen: '' });
  } else {
    ba[sectionKey].push({ id: `${sectionKey}-${Date.now()}`, title: '', detail: '' });
  }
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandAssetRow(sectionKey, idx, fieldKey, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (ba[sectionKey]?.[idx]) {
    ba[sectionKey][idx][fieldKey] = val;
    scheduleCampaignSave();
  }
}

function removeBrandAssetRow(sectionKey, idx) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (Array.isArray(ba[sectionKey])) {
    ba[sectionKey].splice(idx, 1);
    renderContentEditor();
    scheduleCampaignSave();
  }
}

function addBrandCustomLink() {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (!Array.isArray(ba.customLinks)) ba.customLinks = [];
  ba.customLinks.push({ id: `clink-${Date.now()}`, name: '', url: '' });
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandCustomLink(idx, fieldKey, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (ba.customLinks?.[idx]) {
    ba.customLinks[idx][fieldKey] = val;
    scheduleCampaignSave();
  }
}

function removeBrandCustomLink(idx) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (Array.isArray(ba.customLinks)) {
    ba.customLinks.splice(idx, 1);
    renderContentEditor();
    scheduleCampaignSave();
  }
}

function addBrandCustomSection() {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (!Array.isArray(ba.customSections)) ba.customSections = [];
  ba.customSections.push({ id: `csec-${Date.now()}`, title: '', content: '' });
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandCustomSection(idx, fieldKey, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (ba.customSections?.[idx]) {
    ba.customSections[idx][fieldKey] = val;
    scheduleCampaignSave();
  }
}

function removeBrandCustomSection(idx) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (Array.isArray(ba.customSections)) {
    ba.customSections.splice(idx, 1);
    renderContentEditor();
    scheduleCampaignSave();
  }
}

function addBrandShortPitch() {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (!Array.isArray(ba.shortPitches)) ba.shortPitches = [];
  ba.shortPitches.push({ id: `sp-${Date.now()}`, text: '' });
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandShortPitch(idx, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (ba.shortPitches?.[idx]) {
    ba.shortPitches[idx].text = val;
    ba.shortPitch = ba.shortPitches.find((s) => String(s.text || '').trim())?.text ?? val;
    if (!b.brandInfo) b.brandInfo = {};
    b.brandInfo.description = String(ba.longPitch || ba.shortPitch || '').trim();
    scheduleCampaignSave();
  }
}

function removeBrandShortPitch(idx) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (Array.isArray(ba.shortPitches) && ba.shortPitches.length > 1) {
    ba.shortPitches.splice(idx, 1);
    ba.shortPitch = ba.shortPitches.find((s) => String(s.text || '').trim())?.text ?? '';
    renderContentEditor();
    scheduleCampaignSave();
  }
}

function addBrandTestimonial() {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  ba.proof.testimonials.push({ id: `test-${Date.now()}`, quote: '', author: '' });
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandTestimonial(idx, fieldKey, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (ba.proof.testimonials[idx]) {
    ba.proof.testimonials[idx][fieldKey] = val;
    scheduleCampaignSave();
  }
}

function removeBrandTestimonial(idx) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  ba.proof.testimonials.splice(idx, 1);
  renderContentEditor();
  scheduleCampaignSave();
}

function updateBrandUtmField(fieldKey, val) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  ba.links[fieldKey] = val;
  const preview = document.getElementById('dash-ba-utm-preview');
  if (preview) {
    preview.textContent = buildBrandUtmUrl(b) || 'Enter a Website URL above to preview UTM links';
  }
  scheduleCampaignSave();
}

async function copyBrandUtmLink() {
  const b = getActiveBrand();
  if (!b) return;
  const url = buildBrandUtmUrl(b);
  if (!url) {
    showToast('Add a Website URL first', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('UTM link copied');
  } catch (_) {
    showToast(url);
  }
}

function clearBrandPrimaryMediaRole(role) {
  const b = getActiveBrand();
  if (!b) return;
  const ba = normalizeBrandAssets(b);
  if (!b.brandInfo) b.brandInfo = {};
  if (!b.directory) b.directory = {};
  if (role === 'logo') {
    ba.mediaRoles.logoGalleryId = '';
    b.brandInfo.logo = '';
    b.directory.logoUrl = '';
  } else if (role === 'favicon') {
    ba.mediaRoles.faviconGalleryId = '';
    b.brandInfo.favicon = '';
    b.directory.faviconUrl = '';
  } else if (role === 'ogCover') {
    ba.mediaRoles.ogCoverGalleryId = '';
    b.brandInfo.ogCoverUrl = '';
  }
  renderContentEditor();
  scheduleCampaignSave();
}

function switchDashboardGalleryCategory(cat) {
  state.galleryCategoryFilter = cat || 'all';
  if (cat && cat !== 'all') state.galleryUploadCategory = cat;
  renderContentEditor();
}

function toggleDashboardNewGalleryCategory(show) {
  const row = document.getElementById('dash-gallery-new-cat-row');
  const inp = document.getElementById('dash-gallery-new-cat-input');
  if (!row) return;
  if (show) {
    row.classList.remove('hidden');
    row.classList.add('flex');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 10);
    }
  } else {
    row.classList.remove('flex');
    row.classList.add('hidden');
    if (inp) inp.value = '';
  }
}

function addDashboardGalleryCategory() {
  const b = getActiveBrand();
  const inp = document.getElementById('dash-gallery-new-cat-input');
  const label = String(inp?.value || '').trim().slice(0, 24);
  if (!b || !label) return;
  const ba = normalizeBrandAssets(b);
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cat-${Date.now().toString(36)}`;
  const existing = getDashboardGalleryCategories(b).find((c) => c.key === key || c.label.toLowerCase() === label.toLowerCase());
  if (existing) {
    state.galleryCategoryFilter = existing.key;
    state.galleryUploadCategory = existing.key;
    renderContentEditor();
    return;
  }
  if (!Array.isArray(ba.galleryCategories)) ba.galleryCategories = [];
  ba.galleryCategories.push({ key, label });
  state.galleryCategoryFilter = key;
  state.galleryUploadCategory = key;
  renderContentEditor();
  scheduleCampaignSave();
  showToast(`Added "${label}" category`);
}

function removeDashboardGalleryCategory(key) {
  const b = getActiveBrand();
  if (!b || !key) return;
  const ba = normalizeBrandAssets(b);
  if (!Array.isArray(ba.galleryCategories)) return;
  ba.galleryCategories = ba.galleryCategories.filter((c) => c.key !== key);
  if (Array.isArray(b.gallery)) {
    b.gallery.forEach((item) => {
      if (String(item.category || '').toLowerCase() === key) {
        item.category = 'more';
      }
    });
  }
  if (state.galleryCategoryFilter === key) state.galleryCategoryFilter = 'all';
  if (state.galleryUploadCategory === key) state.galleryUploadCategory = 'marketing';
  renderContentEditor();
  scheduleCampaignSave();
}

function updateDashboardGalleryCategory(idx, cat) {
  const b = getActiveBrand();
  if (!b?.gallery?.[idx]) return;
  b.gallery[idx].category = normalizeGalleryCategoryKey(cat, b);
  renderContentEditor();
  scheduleCampaignSave();
}

function assignGalleryPrimaryRole(idx, role) {
  const b = getActiveBrand();
  const item = b?.gallery?.[idx];
  if (!b || !item) return;
  const ba = normalizeBrandAssets(b);
  if (!b.brandInfo) b.brandInfo = {};
  if (!b.directory) b.directory = {};

  if (role === 'logo') {
    const already = ba.mediaRoles.logoGalleryId === item.id || (b.brandInfo.logo && b.brandInfo.logo === item.url);
    ba.mediaRoles.logoGalleryId = already ? '' : item.id;
    b.brandInfo.logo = already ? '' : item.url;
    b.directory.logoUrl = already ? '' : item.url;
  } else if (role === 'favicon') {
    const already = ba.mediaRoles.faviconGalleryId === item.id || (b.brandInfo.favicon && b.brandInfo.favicon === item.url);
    ba.mediaRoles.faviconGalleryId = already ? '' : item.id;
    b.brandInfo.favicon = already ? '' : item.url;
    b.directory.faviconUrl = already ? '' : item.url;
  } else if (role === 'ogCover') {
    const already = ba.mediaRoles.ogCoverGalleryId === item.id || (b.brandInfo.ogCoverUrl && b.brandInfo.ogCoverUrl === item.url);
    ba.mediaRoles.ogCoverGalleryId = already ? '' : item.id;
    b.brandInfo.ogCoverUrl = already ? '' : item.url;
  }
  renderContentEditor();
  scheduleCampaignSave();
  showToast('Primary visual role updated');
}

function prefillDirectoryFromBrandAssets() {
  const b = getActiveBrand();
  if (!b) return;
  const info = b.brandInfo || {};
  const ba = normalizeBrandAssets(b);
  const media = getPrimaryBrandMedia(b);
  if (!b.directory) b.directory = {};
  const dir = b.directory;
  ['taglines', 'pitches', 'summaries', 'descriptions', 'slides'].forEach((k) => { if (!Array.isArray(dir[k])) dir[k] = []; });

  let changed = 0;
  const setIfEmpty = (key, val) => {
    if (!String(dir[key] || '').trim() && String(val || '').trim()) {
      dir[key] = String(val).trim();
      changed++;
    }
  };
  setIfEmpty('productName', info.name || b.brandName);
  setIfEmpty('websiteUrl', info.url);
  setIfEmpty('startingPrice', ba.pricingSummary);
  setIfEmpty('demoUrl', ba.videos.demoUrl || ba.links.bookingUrl);
  setIfEmpty('logoUrl', media.logoUrl);
  setIfEmpty('faviconUrl', media.faviconUrl);

  const pushUniqueText = (arr, rawText, maxLen = 0) => {
    const txt = String(rawText || '').trim();
    if (!txt) return;
    const clipped = maxLen > 0 && txt.length > maxLen ? `${txt.slice(0, maxLen - 1).trim()}…` : txt;
    if (!arr.some((x) => String(x?.text || x || '').trim().toLowerCase() === clipped.toLowerCase())) {
      arr.push({ id: `prefill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: clipped, enabled: true });
      changed++;
    }
  };

  if (info.tagline) pushUniqueText(dir.taglines, info.tagline, 60);
  if (ba.shortPitch) pushUniqueText(dir.pitches, ba.shortPitch, 140);
  const sumSeed = ba.shortPitch || ba.longPitch;
  if (sumSeed) pushUniqueText(dir.summaries, sumSeed, 250);

  const featureBullets = (ba.features || [])
    .filter((f) => f.title)
    .slice(0, 4)
    .map((f) => `• ${f.title}${f.detail ? `: ${f.detail}` : ''}`)
    .join('\n');
  const fullDesc = [ba.longPitch || info.description, featureBullets ? `\nKey Features:\n${featureBullets}` : '', ba.pricingSummary ? `\nPricing: ${ba.pricingSummary}` : ''].filter(Boolean).join('\n').trim();
  if (fullDesc) pushUniqueText(dir.descriptions, fullDesc);

  renderContentEditor();
  if (changed > 0) {
    scheduleCampaignSave();
    showToast(`Pre-filled ${changed} Directory item(s) from Brand Assets`);
  } else {
    showToast('Directory fields already populated');
  }
}
function addDirectoryCopyVariation(field) {
  const b = getActiveBrand();
  if (!b) return;
  if (!b.directory) b.directory = {};
  if (!Array.isArray(b.directory[field])) b.directory[field] = [];
  b.directory[field].push({ id: `${field}-${Date.now()}`, text: '', enabled: true });
  renderContentEditor();
  scheduleCampaignSave();
}
function updateDirectoryVariation(field, idx, value) {
  const b = getActiveBrand();
  if (b?.directory?.[field]?.[idx]) {
    b.directory[field][idx].text = value;
    scheduleCampaignSave();
  }
}
function removeDirectoryVariation(field, idx) {
  const b = getActiveBrand();
  if (b?.directory?.[field]) {
    b.directory[field].splice(idx, 1);
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function switchDashboardCommentsSubMode(mode) {
  state.commentsSubMode = mode === 'auto' ? 'auto' : 'saved';
  renderContentEditor();
}

function switchDashboardAutoCommentsFilter(filter) {
  state.autoCommentsFilter = filter === 'promo' ? 'promo' : 'organic';
  renderContentEditor();
}

function toggleDashboardBurstTyping(checked) {
  state.settings.simulateKeystrokes = Boolean(checked);
  const el = document.getElementById('setting-simulate-keystrokes');
  if (el) el.checked = Boolean(checked);
  scheduleSettingsSync();
}

function buildLocalAutoCommentsForBrand(brand, topic = '') {
  const bName = brand?.brandInfo?.name || brand?.brandName || 'Focus Gummies';
  const bWebsite = brand?.brandInfo?.url || brand?.directory?.websiteUrl || 'https://focusgummies.com';
  const cleanUrl = bWebsite.replace(/^https?:\/\//i, '');
  const snippet = (topic || '').trim() ? `"${topic.trim().slice(0, 48)}"` : 'this workflow';
  return {
    organic: [
      `The biggest shift for me when dealing with ${snippet} was establishing a hard cutoff time and protecting morning deep work blocks. How long have you been testing this approach?`,
      `Really insightful perspective. Most people overlook how much compounding mental friction comes from context switching. Focusing on 1–2 high-priority tasks per day works way better.`,
      `Completely agree. What specifically made you decide to take this approach over the standard workflow?`
    ],
    promo: [
      `Ran into this exact bottleneck when building ${bName}. We solved it by replacing afternoon caffeine spikes with clean nootropics for sustained focus: ${cleanUrl}`,
      `If midday brain fog is slowing your output on ${snippet}, take a look at ${bName} — built specifically for deep work without the jittery crash: ${cleanUrl}`,
      `100% agree — protecting cognitive bandwidth is crucial. That's the exact principle behind ${bName} so builders stay locked in for 6+ hours: ${cleanUrl}`
    ]
  };
}

async function refreshDashboardAutoComments() {
  const brand = getActiveBrand();
  if (!brand) return;
  state.autoCommentsLoading = true;
  renderContentEditor();
  try {
    const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
    if (!openRouterKey && !geminiApiKey) {
      state.autoCommentsSuggestions = buildLocalAutoCommentsForBrand(brand, state.autoCommentsTopic);
      return;
    }
    const token = state.session?.accessToken || state.session?.token || '';
    const res = await fetch('/api/ai/thread-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        threadTitle: (state.autoCommentsTopic || '').trim() || (brand.brandInfo?.tagline || brand.brandInfo?.name || 'Discussion'),
        threadBody: brand.brandAssets?.longPitch || brand.brandInfo?.description || '',
        platform: 'twitter',
        brand: buildDashboardFullBrandContext(brand),
        openRouterKey,
        geminiApiKey,
        aiModel: state.aiModel || ''
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.suggestions) {
        const toPlain = (x) => (typeof x === 'string' ? x : (x?.text || x?.message || ''));
        state.autoCommentsSuggestions = {
          organic: (json.suggestions.organic || []).map(toPlain).filter(Boolean).slice(0, 3),
          promo: (json.suggestions.promo || json.suggestions.trojan || []).map(toPlain).filter(Boolean).slice(0, 3)
        };
        return;
      }
    }
    state.autoCommentsSuggestions = buildLocalAutoCommentsForBrand(brand, state.autoCommentsTopic);
  } catch (_) {
    state.autoCommentsSuggestions = buildLocalAutoCommentsForBrand(brand, state.autoCommentsTopic);
  } finally {
    state.autoCommentsLoading = false;
    renderContentEditor();
  }
}

async function saveAutoCommentToLibrary(type, idx, btn) {
  const brand = getActiveBrand();
  if (!brand) return;
  const list = type === 'promo' ? state.autoCommentsSuggestions.promo : state.autoCommentsSuggestions.organic;
  const text = list?.[idx];
  if (!text) return;
  const comments = ensureDashboardBrandCommentsNormalized(brand);
  const exists = comments.some((c) => (typeof c === 'string' ? c : c.text || '').trim() === text.trim());
  if (!exists) {
    const activeFilter = cleanCommentTagName(state.commentsMgmtTagFilter || 'all');
    const initialTags = activeFilter && activeFilter.toLowerCase() !== 'all'
      ? normalizeCommentTags([activeFilter])
      : [DEFAULT_COMMENT_TAG];
    comments.unshift({ id: `comm-${Date.now()}`, text, tags: initialTags, images: [], enabled: true, starred: false, isExpanded: true });
    brand.comments = brand.social.comments;
    brand.commentTags = getCampaignAvailableTags(brand);
    await saveActiveCampaign();
  }
  if (btn) {
    btn.classList.add('bg-emerald-50', 'border-emerald-300', 'text-emerald-700');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  }
  showToast('Saved to Saved Comments');
}

async function copyAutoCommentText(type, idx, btn) {
  const brand = getActiveBrand();
  const list = type === 'promo' ? state.autoCommentsSuggestions.promo : state.autoCommentsSuggestions.organic;
  let text = list?.[idx] || '';
  if (!text) return;
  if (brand) text = applySafeDomainTransform(text, brand);
  try { await navigator.clipboard.writeText(text); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.classList.add('bg-emerald-50', 'border-emerald-300', 'text-emerald-700');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove('bg-emerald-50', 'border-emerald-300', 'text-emerald-700');
      btn.innerHTML = orig;
    }, 1400);
  }
}

function addSocialComment() {
  const b = getActiveBrand();
  if (!b) return;
  const comments = ensureDashboardBrandCommentsNormalized(b);
  const activeFilter = cleanCommentTagName(state.commentsMgmtTagFilter || 'all');
  const initialTags = activeFilter && activeFilter.toLowerCase() !== 'all'
    ? normalizeCommentTags([activeFilter])
    : [DEFAULT_COMMENT_TAG];
  comments.push({
    id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text: '',
    tags: initialTags,
    images: [],
    enabled: true,
    starred: false,
    isExpanded: true,
  });
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);
  renderContentEditor();
  scheduleCampaignSave();
}
function optimizeDashboardLocalImage(file, { maxDim = 1280, preserveTransparency = false } = {}) {
  const MAX_TARGET_DATA_URL_LEN = 430_000; // ~320 KB binary
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = (evt) => {
      const raw = evt.target?.result;
      if (!raw || typeof raw !== 'string') return reject(new Error('Empty file'));
      const lowerType = (file.type || '').toLowerCase();
      const lowerName = (file.name || '').toLowerCase();
      if (
        lowerType.includes('svg') ||
        lowerType.includes('icon') ||
        lowerType.includes('gif') ||
        lowerName.endsWith('.ico') ||
        lowerName.endsWith('.svg') ||
        file.size <= 30 * 1024
      ) {
        return resolve(raw);
      }
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) return resolve(raw);
          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }
          const tryEncode = (width, height, mime, quality) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL(mime, quality);
          };

          const primaryMime = preserveTransparency || lowerType === 'image/png' ? 'image/webp' : 'image/jpeg';
          const fallbackMime = 'image/jpeg';
          const qualities = [0.84, 0.72, 0.60, 0.48];
          let best = '';
          const pickBest = (candidate) => {
            if (!candidate || !candidate.startsWith('data:image/')) return;
            if (!best || candidate.length < best.length) best = candidate;
          };

          for (const q of qualities) {
            const c1 = tryEncode(w, h, primaryMime, q);
            pickBest(c1);
            if (primaryMime !== fallbackMime && (!c1 || !c1.startsWith(`data:${primaryMime}`))) {
              pickBest(tryEncode(w, h, fallbackMime, q));
            }
            if (best && best.length <= MAX_TARGET_DATA_URL_LEN) break;
          }

          if ((!best || best.length > MAX_TARGET_DATA_URL_LEN) && Math.max(w, h) > 640) {
            const sw = Math.max(1, Math.round(w * 0.75));
            const sh = Math.max(1, Math.round(h * 0.75));
            for (const q of [0.72, 0.56]) {
              pickBest(tryEncode(sw, sh, primaryMime, q));
              if (best && best.length <= MAX_TARGET_DATA_URL_LEN) break;
            }
          }

          if (best && (best.length < raw.length || raw.length > MAX_TARGET_DATA_URL_LEN)) {
            return resolve(best);
          }
          resolve(raw);
        } catch (_) {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
function handleDashboardAssetDragStart(e, defaultFilename) {
  const img = e.currentTarget;
  const src = img?.getAttribute('src') || img?.src || '';
  if (!src || !e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';
  try {
    if (src.startsWith('data:')) {
      const arr = src.split(',');
      const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const file = new File([u8arr], defaultFilename || 'image.png', { type: mime });
      if (e.dataTransfer.items && e.dataTransfer.items.add) e.dataTransfer.items.add(file);
      e.dataTransfer.setData('DownloadURL', `${mime}:${defaultFilename || 'image.png'}:${src}`);
    } else {
      e.dataTransfer.setData('text/plain', src);
      e.dataTransfer.setData('text/uri-list', src);
    }
  } catch (_) {}
}
async function uploadDashboardMediaOrInline(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  if (!state.user?.id) {
    if (dataUrl.length > 250_000) {
      const err = new Error('Sign in with Google to upload media assets larger than 180 KB.');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }
    return dataUrl;
  }
  const res = await authedDashboardFetch('/api/user/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: state.user.id,
      dataUrl,
      filename: filename || `asset-${Date.now()}.webp`,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (typeof json.storageUsedBytes === 'number') {
    state.storageUsedBytes = Math.max(0, json.storageUsedBytes);
  }
  if (typeof json.storageLimitBytes === 'number' && json.storageLimitBytes > 0) {
    state.storageLimitBytes = json.storageLimitBytes;
  }
  if (res.status === 413 || !res.ok || !json?.success || !json?.url) {
    renderStorageUsageMeter();
    const err = new Error(json?.error || (res.status === 413 ? 'Storage limit exceeded. Delete unused media or upgrade your plan.' : 'Media upload failed.'));
    err.code = res.status === 413 ? 'QUOTA_EXCEEDED' : 'UPLOAD_FAILED';
    throw err;
  }
  renderStorageUsageMeter();
  return json.url;
}

function deleteDashboardRemoteMedia(url) {
  if (!url || typeof url !== 'string' || !url.includes('/brand-assets/') || !state.user?.id) return;
  authedDashboardFetch('/api/user/media', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.success && typeof data.storageUsedBytes === 'number') {
        state.storageUsedBytes = Math.max(0, data.storageUsedBytes);
        if (typeof data.storageLimitBytes === 'number' && data.storageLimitBytes > 0) {
          state.storageLimitBytes = data.storageLimitBytes;
        }
        renderStorageUsageMeter();
      }
    })
    .catch(() => {});
}

async function handleDashboardDirAssetUpload(fieldKey, inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const b = getActiveBrand();
  if (!b) return;
  try {
    const dataUrl = await optimizeDashboardLocalImage(file, {
      maxDim: fieldKey === 'faviconUrl' ? 128 : 512,
      preserveTransparency: true
    });
    const uploadedUrl = await uploadDashboardMediaOrInline(dataUrl, file.name || `${fieldKey}.png`);
    if (!b.directory) b.directory = {};
    b.directory[fieldKey] = uploadedUrl;
    b.updatedAt = new Date().toISOString();
    renderContentEditor();
    scheduleCampaignSave();
    showToast(fieldKey === 'faviconUrl' ? 'Favicon uploaded & synced' : 'Logo uploaded & synced');
  } catch (err) {
    showToast(err?.message || 'Failed to upload image file', 'error');
  } finally {
    inputEl.value = '';
  }
}
function clearDashboardDirAsset(fieldKey) {
  const b = getActiveBrand();
  if (!b?.directory) return;
  if (b.directory[fieldKey]) deleteDashboardRemoteMedia(b.directory[fieldKey]);
  b.directory[fieldKey] = '';
  b.updatedAt = new Date().toISOString();
  renderContentEditor();
  scheduleCampaignSave();
}
async function handleDashboardDirSlidesUpload(inputEl) {
  const files = Array.from(inputEl?.files || []);
  if (files.length === 0) return;
  const b = getActiveBrand();
  if (!b) return;
  if (!b.directory) b.directory = {};
  if (!Array.isArray(b.directory.slides)) b.directory.slides = [];
  let uploadedCount = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const dataUrl = await optimizeDashboardLocalImage(f, { maxDim: 1280, preserveTransparency: false });
      const uploadedUrl = await uploadDashboardMediaOrInline(dataUrl, f.name || `slide-${i + 1}.jpg`);
      b.directory.slides.push({
        id: `slide-${Date.now()}-${i}`,
        url: uploadedUrl,
        name: f.name || `Slide #${b.directory.slides.length + 1}`
      });
      uploadedCount++;
    }
    if (uploadedCount > 0) {
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
      showToast(`${uploadedCount} slide(s) uploaded & synced`);
    }
  } catch (err) {
    if (uploadedCount > 0) {
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
    }
    showToast(err?.message || 'Failed to upload slide image', 'error');
  } finally {
    inputEl.value = '';
  }
}
function removeDashboardDirSlide(slideIdx) {
  const b = getActiveBrand();
  if (b?.directory?.slides) {
    const removed = b.directory.slides[slideIdx];
    if (removed?.url) deleteDashboardRemoteMedia(removed.url);
    b.directory.slides.splice(slideIdx, 1);
    b.updatedAt = new Date().toISOString();
    renderContentEditor();
    scheduleCampaignSave();
  }
}
async function handleDashboardCommentImageUpload(idx, inputEl) {
  const files = Array.from(inputEl?.files || []);
  const b = getActiveBrand();
  const c = b?.social?.comments?.[idx];
  if (!c || files.length === 0) return;
  if (!Array.isArray(c.images)) c.images = [];
  const remaining = 4 - c.images.length;
  if (remaining <= 0) {
    showToast('Maximum 4 images allowed per comment', 'error');
    inputEl.value = '';
    return;
  }
  let uploadedCount = 0;
  try {
    for (const f of files.slice(0, remaining)) {
      const dataUrl = await optimizeDashboardLocalImage(f, { maxDim: 1280, preserveTransparency: false });
      const uploadedUrl = await uploadDashboardMediaOrInline(dataUrl, f.name || 'comment-image.jpg');
      c.images.push(uploadedUrl);
      uploadedCount++;
    }
    if (uploadedCount > 0) {
      b.comments = b.social.comments;
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
      showToast('Comment image(s) uploaded & synced');
    }
  } catch (err) {
    if (uploadedCount > 0) {
      b.comments = b.social.comments;
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
    }
    showToast(err?.message || 'Failed to upload comment image', 'error');
  } finally {
    inputEl.value = '';
  }
}
function removeDashboardCommentImage(idx, imgIdx) {
  const b = getActiveBrand();
  const c = b?.social?.comments?.[idx];
  if (c && Array.isArray(c.images)) {
    const removedUrl = c.images[imgIdx];
    if (removedUrl) deleteDashboardRemoteMedia(removedUrl);
    c.images.splice(imgIdx, 1);
    b.comments = b.social.comments;
    b.updatedAt = new Date().toISOString();
    renderContentEditor();
    scheduleCampaignSave();
  }
}
async function handleDashboardGalleryFiles(files) {
  const b = getActiveBrand();
  if (!b) return;
  ensureDashboardGalleryNormalized(b);
  const uploadCategory = state.galleryCategoryFilter && state.galleryCategoryFilter !== 'all'
    ? state.galleryCategoryFilter
    : normalizeGalleryCategoryKey(state.galleryUploadCategory, b);
  const imageFiles = Array.from(files || []).filter((f) => !f.type || f.type.startsWith('image/'));
  if (imageFiles.length === 0) return;
  let uploadedCount = 0;
  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i];
      const dataUrl = await optimizeDashboardLocalImage(f, { maxDim: 1280, preserveTransparency: true });
      const uploadedUrl = await uploadDashboardMediaOrInline(dataUrl, f.name || `promo-${b.gallery.length + 1}.png`);
      const cleanLabel = (f.name || `Asset ${b.gallery.length + 1}`).replace(/\.[^.]+$/, '');
      b.gallery.unshift({
        id: `gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: uploadedUrl,
        name: f.name || `asset-${b.gallery.length + 1}.png`,
        label: cleanLabel,
        category: uploadCategory,
        createdAt: new Date().toISOString()
      });
      uploadedCount++;
    }
    if (uploadedCount > 0) {
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
      showToast(`${uploadedCount} image(s) saved to ${getGalleryCategoryLabel(uploadCategory, b)}`);
    }
  } catch (err) {
    if (uploadedCount > 0) {
      b.updatedAt = new Date().toISOString();
      renderContentEditor();
      scheduleCampaignSave();
    }
    showToast(err?.message || 'Failed to upload gallery image', 'error');
  }
}
function handleDashboardGalleryUpload(inputEl) {
  const files = Array.from(inputEl?.files || []);
  if (files.length > 0) handleDashboardGalleryFiles(files);
  if (inputEl) inputEl.value = '';
}
function handleDashboardGalleryDrop(e) {
  e.preventDefault();
  e.currentTarget?.classList?.remove('border-[#6c5ce7]', 'bg-[#f1effe]/60');
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) handleDashboardGalleryFiles(files);
}
function updateDashboardGalleryLabel(idx, val) {
  const b = getActiveBrand();
  if (b?.gallery?.[idx]) {
    b.gallery[idx].label = val;
    scheduleCampaignSave();
  }
}
function removeDashboardGalleryItem(idx) {
  const b = getActiveBrand();
  if (b && Array.isArray(b.gallery)) {
    const removed = b.gallery[idx];
    const ba = normalizeBrandAssets(b);
    if (removed?.url) deleteDashboardRemoteMedia(removed.url);
    if (removed) {
      if (ba.mediaRoles.logoGalleryId === removed.id || (removed.url && b.brandInfo?.logo === removed.url)) {
        ba.mediaRoles.logoGalleryId = '';
        if (b.brandInfo) b.brandInfo.logo = '';
        if (b.directory) b.directory.logoUrl = '';
      }
      if (ba.mediaRoles.faviconGalleryId === removed.id || (removed.url && b.brandInfo?.favicon === removed.url)) {
        ba.mediaRoles.faviconGalleryId = '';
        if (b.brandInfo) b.brandInfo.favicon = '';
        if (b.directory) b.directory.faviconUrl = '';
      }
      if (ba.mediaRoles.ogCoverGalleryId === removed.id || (removed.url && b.brandInfo?.ogCoverUrl === removed.url)) {
        ba.mediaRoles.ogCoverGalleryId = '';
        if (b.brandInfo) b.brandInfo.ogCoverUrl = '';
      }
    }
    b.gallery.splice(idx, 1);
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function updateSocialComment(idx, value) {
  const b = getActiveBrand();
  if (b?.social?.comments?.[idx]) {
    b.social.comments[idx].text = value;
    b.comments = b.social.comments;
    const charEl = document.getElementById(`dash-comment-char-${idx}`);
    if (charEl) charEl.textContent = `Char: ${value.length}`;
    scheduleCampaignSave();
  }
}
function toggleSocialCommentEnabled(idx) {
  const b = getActiveBrand();
  if (b?.social?.comments?.[idx]) {
    b.social.comments[idx].enabled = b.social.comments[idx].enabled === false;
    b.comments = b.social.comments;
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function toggleSocialCommentExpanded(idx) {
  const b = getActiveBrand();
  if (b?.social?.comments?.[idx]) {
    b.social.comments[idx].isExpanded = b.social.comments[idx].isExpanded === false;
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function getFilteredSortedDashboardComments(brand) {
  const comments = ensureDashboardBrandCommentsNormalized(brand);
  const filter = cleanCommentTagName(state.commentsMgmtTagFilter || 'all') || 'all';
  const filterLower = filter.toLowerCase();
  const sortMode = state.commentsSort || 'default';

  const mapped = comments.map((c, origIdx) => ({ c, origIdx }));
  const filtered = filterLower === 'all'
    ? mapped
    : mapped.filter(({ c }) => normalizeCommentTags(c.tags).some((t) => t.toLowerCase() === filterLower));

  if (sortMode === 'starred') {
    filtered.sort((a, b) => ((b.c.starred ? 1 : 0) - (a.c.starred ? 1 : 0)) || (a.origIdx - b.origIdx));
  } else if (sortMode === 'enabled') {
    filtered.sort((a, b) => ((b.c.enabled !== false ? 1 : 0) - (a.c.enabled !== false ? 1 : 0)) || (a.origIdx - b.origIdx));
  } else if (sortMode === 'alpha') {
    filtered.sort((a, b) => String(a.c.text || '').trim().localeCompare(String(b.c.text || '').trim()) || (a.origIdx - b.origIdx));
  } else if (sortMode === 'tag') {
    const primaryKey = (c) => {
      const tags = normalizeCommentTags(c.tags);
      const custom = tags.find((t) => t.toLowerCase() !== 'general');
      return custom ? `0:${custom.toLowerCase()}` : `1:general`;
    };
    filtered.sort((a, b) => primaryKey(a.c).localeCompare(primaryKey(b.c)) || (a.origIdx - b.origIdx));
  }

  return { allComments: comments, visibleEntries: filtered };
}

function renderDashboardCommentTagStripHtml(c, origIdx) {
  const tags = normalizeCommentTags(c?.tags);
  if (tags.length === 1 && tags[0].toLowerCase() === 'general') return '';
  return `
    <div class="dash-comment-tag-strip">
      ${tags.map((tag) => {
        const isGeneral = tag.toLowerCase() === 'general';
        const safeTag = escapeHtml(tag);
        return `
          <span class="dash-comment-tag-pill ${isGeneral ? 'is-general-mixed' : ''}">
            <span>${safeTag}</span>
            <button type="button" class="dash-comment-tag-pill-remove" data-orig-idx="${origIdx}" data-tag="${safeTag}" onclick="removeDashboardCommentTagFromPill(this, event)" title="Remove tag ${safeTag}" aria-label="Remove tag ${safeTag}">×</button>
          </span>
        `;
      }).join('')}
    </div>
  `;
}

function renderDashboardCommentFooterHtml(c, origIdx, availableTags, aiDropdownHtml) {
  const itemTags = normalizeCommentTags(c?.tags);
  const customTags = itemTags.filter((t) => t.toLowerCase() !== 'general');
  const hasCustom = customTags.length > 0;
  const isOpen = state.openDashboardTagPopoverId === c.id;
  const safeId = escapeHtml(c.id);
  const triggerLabel = hasCustom ? `Tag (${customTags.length})` : 'Tag';

  const optionsHtml = (availableTags || [DEFAULT_COMMENT_TAG]).map((tag) => {
    const safeTag = escapeHtml(tag);
    const isChecked = itemTags.some((t) => t.toLowerCase() === tag.toLowerCase());
    return `
      <label class="dash-tag-popover-option">
        <span class="inline-flex items-center gap-2 min-w-0">
          <input type="checkbox" ${isChecked ? 'checked' : ''} data-orig-idx="${origIdx}" data-tag="${safeTag}" onchange="handleDashboardTagPopoverCheckbox(this)" class="w-3.5 h-3.5 accent-[#6c5ce7] rounded">
          <span class="truncate">${safeTag}</span>
        </span>
        ${tag.toLowerCase() === 'general' ? '<span class="text-[9.5px] text-[#747d8c]">default</span>' : ''}
      </label>
    `;
  }).join('');

  return `
    <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#F2EBE0]">
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="copyDashboardComment(${origIdx}, this)" title="Copy comment (applies spin-tax &amp; Safe Domain)" aria-label="Copy comment" class="sp-btn-secondary w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
        </button>
        <button type="button" onclick="saveSingleDashboardComment(${origIdx}, this)" title="Save &amp; sync product" aria-label="Save comment" class="sp-btn-primary w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        </button>
        <div class="dash-tag-popover-wrap" data-comment-id="${safeId}" onclick="event.stopPropagation()">
          <button type="button" data-comment-id="${safeId}" onclick="toggleDashboardTagPopover(event, this.dataset.commentId)" title="Assign comment tags" class="dash-btn-tag-trigger inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold border transition ${hasCustom ? 'bg-[#f1effe] text-[#5b4bc4] border-[#d4cdfc] hover:bg-[#e5e0fc]' : 'bg-white text-[#57606f] border-[#dfd8cc] hover:bg-[#FAF4EB]'}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <span>${triggerLabel}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dash-tag-popover ${isOpen ? '' : 'hidden'}" data-comment-id="${safeId}">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#747d8c] px-1 pb-1.5 mb-1 border-b border-[#F2EBE0]">Comment Tags</div>
            <div class="dash-tag-popover-list">${optionsHtml}</div>
            <div class="flex items-center gap-1.5 pt-1.5 border-t border-[#F2EBE0]">
              <input type="text" placeholder="New tag..." onkeydown="if(event.key==='Enter'){event.preventDefault();event.stopPropagation();addCustomTagFromDashboardPopover(${origIdx}, this);}" class="dash-tag-popover-new-input flex-1 min-w-0 px-2 py-1 bg-[#FCF9F2] border border-[#dfd8cc] rounded-md text-[11px]">
              <button type="button" onclick="addCustomTagFromDashboardPopover(${origIdx}, this.closest('.dash-tag-popover-wrap')?.querySelector('.dash-tag-popover-new-input'))" class="sp-btn-primary px-2 py-1 rounded-md text-[11px]">Add</button>
            </div>
          </div>
        </div>
      </div>
      ${aiDropdownHtml}
    </div>
  `;
}

function positionDashboardTagPopover(popoverEl, triggerEl) {
  if (!popoverEl || !triggerEl) return;
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < 240 && spaceAbove > spaceBelow) {
    popoverEl.classList.add('open-upward');
  } else {
    popoverEl.classList.remove('open-upward');
  }
}

function toggleDashboardTagPopover(event, commentId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const willOpen = state.openDashboardTagPopoverId !== commentId;
  document.querySelectorAll('.dash-tag-popover').forEach((p) => p.classList.add('hidden'));
  state.openDashboardTagPopoverId = willOpen ? commentId : null;
  if (willOpen) {
    const wraps = document.querySelectorAll('.dash-tag-popover-wrap');
    wraps.forEach((w) => {
      if (w.dataset.commentId === commentId) {
        const pop = w.querySelector('.dash-tag-popover');
        const trig = w.querySelector('.dash-btn-tag-trigger');
        if (pop) {
          pop.classList.remove('hidden');
          positionDashboardTagPopover(pop, trig);
        }
      }
    });
  }
}

function toggleDashboardSafeDomain(checked) {
  const b = getActiveBrand();
  if (!b) return;
  if (!b.safeDomain || typeof b.safeDomain !== 'object') {
    b.safeDomain = { enabled: false, value: '' };
  }
  b.safeDomain.enabled = Boolean(checked);
  if (b.safeDomain.enabled && !String(b.safeDomain.value || '').trim()) {
    const autoVal = getDefaultSafeDomainValue(b);
    if (autoVal) {
      b.safeDomain.value = autoVal;
      const inp = document.getElementById('dash-safe-domain-input');
      if (inp) inp.value = autoVal;
    }
  }
  scheduleCampaignSave();
}

function updateDashboardSafeDomainValue(value) {
  const b = getActiveBrand();
  if (!b) return;
  if (!b.safeDomain || typeof b.safeDomain !== 'object') {
    b.safeDomain = { enabled: false, value: '' };
  }
  b.safeDomain.value = String(value || '');
  scheduleCampaignSave();
}

function autoFillDashboardSafeDomain() {
  const b = getActiveBrand();
  if (!b) return;
  const autoVal = getDefaultSafeDomainValue(b);
  if (!autoVal) {
    showToast('Add a Product Website URL in Product Details first to auto-generate a Safe Domain.', 'error');
    return;
  }
  if (!b.safeDomain || typeof b.safeDomain !== 'object') {
    b.safeDomain = { enabled: true, value: autoVal };
  } else {
    b.safeDomain.value = autoVal;
  }
  const inp = document.getElementById('dash-safe-domain-input');
  if (inp) inp.value = autoVal;
  scheduleCampaignSave();
  showToast(`Suggested Safe Domain: ${autoVal}`);
}

function setDashboardCommentsTagFilter(tagVal) {
  const clean = cleanCommentTagName(tagVal || 'all') || 'all';
  state.commentsMgmtTagFilter = clean.toLowerCase() === 'all' ? 'all' : clean;
  state.openDashboardTagPopoverId = null;
  renderContentEditor();
}

function setDashboardCommentsSort(sortVal) {
  state.commentsSort = sortVal || 'default';
  state.openDashboardTagPopoverId = null;
  renderContentEditor();
}

function createDashboardCampaignTagFromInput() {
  const input = document.getElementById('dash-campaign-new-tag-input');
  const raw = cleanCommentTagName(input?.value || '');
  if (!raw || raw.toLowerCase() === 'all') {
    if (raw.toLowerCase() === 'all') showToast('"All" is reserved as a filter.', 'error');
    return;
  }
  const b = getActiveBrand();
  if (!b) return;
  ensureDashboardBrandCommentsNormalized(b);
  const canonical = canonicalizeCommentTagName(raw);
  if (!canonical) return;
  if (!b.commentTags.some((t) => t.toLowerCase() === canonical.toLowerCase())) {
    b.commentTags.push(canonical);
    scheduleCampaignSave();
    showToast(`Created tag "${canonical}"`);
  } else {
    showToast(`Tag "${canonical}" already exists`);
  }
  if (input) input.value = '';
  renderContentEditor();
}

function startRenameDashboardCampaignTag(tagName) {
  const clean = canonicalizeCommentTagName(tagName);
  if (!clean || clean.toLowerCase() === 'general') return;
  state.renamingCampaignTag = clean;
  renderContentEditor();
}

function cancelRenameDashboardCampaignTag() {
  state.renamingCampaignTag = '';
  renderContentEditor();
}

function commitRenameDashboardCampaignTag(oldTag, newRawTag) {
  const b = getActiveBrand();
  if (!b) return;
  const oldClean = canonicalizeCommentTagName(oldTag);
  const nextClean = canonicalizeCommentTagName(newRawTag);
  if (!oldClean || oldClean.toLowerCase() === 'general') {
    state.renamingCampaignTag = '';
    renderContentEditor();
    return;
  }
  if (!nextClean || nextClean.toLowerCase() === 'all' || nextClean.toLowerCase() === 'general') {
    showToast('Enter a valid custom tag name.', 'error');
    return;
  }

  ensureDashboardBrandCommentsNormalized(b);
  const oldLower = oldClean.toLowerCase();
  const nextLower = nextClean.toLowerCase();
  if (oldLower === nextLower && oldClean === nextClean) {
    state.renamingCampaignTag = '';
    renderContentEditor();
    return;
  }

  b.commentTags = mergeCommentTagLists([], b.commentTags.map((t) => (t.toLowerCase() === oldLower ? nextClean : t)), false, []);
  b.social.comments.forEach((c) => {
    const tags = normalizeCommentTags(c.tags);
    const updated = tags.map((t) => (t.toLowerCase() === oldLower ? nextClean : t));
    c.tags = normalizeCommentTags(updated);
  });
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);

  if (String(b.activeCommentPool || '').toLowerCase() === oldLower) {
    b.activeCommentPool = nextClean;
  }
  if (String(state.commentsMgmtTagFilter || '').toLowerCase() === oldLower) {
    state.commentsMgmtTagFilter = nextClean;
  }
  if (String(state.bulkTagTarget || '').toLowerCase() === oldLower) {
    state.bulkTagTarget = nextClean;
  }
  state.renamingCampaignTag = '';
  renderContentEditor();
  scheduleCampaignSave();
  showToast(`Renamed "${oldClean}" to "${nextClean}"`);
}

function deleteDashboardCampaignTag(tagName) {
  const b = getActiveBrand();
  if (!b) return;
  const target = canonicalizeCommentTagName(tagName);
  if (!target || target.toLowerCase() === 'general') {
    showToast('"General" cannot be deleted.', 'error');
    return;
  }
  ensureDashboardBrandCommentsNormalized(b);
  const targetLower = target.toLowerCase();
  const counts = getCommentTagCounts(b, { enabledOnly: false });
  const usedBy = counts[target] || 0;
  if (usedBy > 0 && !confirm(`Delete tag "${target}" from this product? ${usedBy} comment(s) will have it removed (untagged comments automatically return to General).`)) {
    return;
  }

  b.commentTags = (b.commentTags || []).filter((t) => t.toLowerCase() !== targetLower);
  b.social.comments.forEach((c) => {
    const hasTag = normalizeCommentTags(c.tags).some((t) => t.toLowerCase() === targetLower);
    if (hasTag) {
      applyTagToggleToComment(c, target, false);
    }
  });
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);

  if (String(b.activeCommentPool || '').toLowerCase() === targetLower) {
    b.activeCommentPool = 'all';
  }
  if (String(state.commentsMgmtTagFilter || '').toLowerCase() === targetLower) {
    state.commentsMgmtTagFilter = 'all';
  }
  if (String(state.bulkTagTarget || '').toLowerCase() === targetLower) {
    state.bulkTagTarget = '';
  }
  renderContentEditor();
  scheduleCampaignSave();
  showToast(`Deleted tag "${target}"`);
}

function toggleDashboardCommentSelected(commentId, isChecked) {
  if (!commentId) return;
  if (!(state.selectedCommentIds instanceof Set)) state.selectedCommentIds = new Set();
  if (isChecked) {
    state.selectedCommentIds.add(commentId);
  } else {
    state.selectedCommentIds.delete(commentId);
  }
  renderContentEditor();
}

function toggleSelectAllVisibleComments(isChecked) {
  const b = getActiveBrand();
  if (!b) return;
  if (!(state.selectedCommentIds instanceof Set)) state.selectedCommentIds = new Set();
  const { visibleEntries } = getFilteredSortedDashboardComments(b);
  visibleEntries.forEach(({ c }) => {
    if (isChecked) {
      state.selectedCommentIds.add(c.id);
    } else {
      state.selectedCommentIds.delete(c.id);
    }
  });
  renderContentEditor();
}

function clearDashboardCommentSelection() {
  if (state.selectedCommentIds instanceof Set) state.selectedCommentIds.clear();
  renderContentEditor();
}

function applyBulkCommentTagAction(mode) {
  const b = getActiveBrand();
  if (!b) return;
  const comments = ensureDashboardBrandCommentsNormalized(b);
  const selectedSet = state.selectedCommentIds instanceof Set ? state.selectedCommentIds : new Set();
  if (selectedSet.size === 0) return;

  const selEl = document.getElementById('dash-bulk-tag-select');
  const tagName = canonicalizeCommentTagName(selEl?.value || state.bulkTagTarget || DEFAULT_COMMENT_TAG);
  if (!tagName || tagName.toLowerCase() === 'all') return;

  const isAdding = mode === 'add';
  let changed = 0;
  comments.forEach((c) => {
    if (selectedSet.has(c.id)) {
      applyTagToggleToComment(c, tagName, isAdding);
      changed += 1;
    }
  });
  if (changed === 0) return;
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);
  renderContentEditor();
  scheduleCampaignSave();
  showToast(`${isAdding ? 'Added' : 'Removed'} "${tagName}" ${isAdding ? 'to' : 'from'} ${changed} comment(s)`);
}

function applyBulkCommentStatus(enableFlag) {
  const b = getActiveBrand();
  if (!b) return;
  const comments = ensureDashboardBrandCommentsNormalized(b);
  const selectedSet = state.selectedCommentIds instanceof Set ? state.selectedCommentIds : new Set();
  if (selectedSet.size === 0) return;
  let changed = 0;
  comments.forEach((c) => {
    if (selectedSet.has(c.id)) {
      c.enabled = Boolean(enableFlag);
      changed += 1;
    }
  });
  if (changed === 0) return;
  b.comments = b.social.comments;
  renderContentEditor();
  scheduleCampaignSave();
  showToast(`${enableFlag ? 'Enabled' : 'Disabled'} ${changed} comment(s)`);
}

function deleteBulkSelectedComments() {
  const b = getActiveBrand();
  if (!b) return;
  const comments = ensureDashboardBrandCommentsNormalized(b);
  const selectedSet = state.selectedCommentIds instanceof Set ? state.selectedCommentIds : new Set();
  if (selectedSet.size === 0) return;
  if (!confirm(`Delete ${selectedSet.size} selected comment(s)? This cannot be undone.`)) return;
  b.social.comments = comments.filter((c) => !selectedSet.has(c.id));
  b.comments = b.social.comments;
  selectedSet.clear();
  state.openDashboardTagPopoverId = null;
  b.commentTags = getCampaignAvailableTags(b);
  renderContentEditor();
  scheduleCampaignSave();
  showToast('Deleted selected comments');
}

function toggleDashboardCommentStarred(origIdx) {
  const b = getActiveBrand();
  const c = b?.social?.comments?.[origIdx];
  if (!c) return;
  c.starred = !c.starred;
  b.comments = b.social.comments;
  renderContentEditor();
  scheduleCampaignSave();
}

function toggleDashboardCommentTag(origIdx, tagName, isChecked, keepPopoverOpen = false) {
  const b = getActiveBrand();
  const c = b?.social?.comments?.[origIdx];
  if (!b || !c) return;
  applyTagToggleToComment(c, tagName, isChecked);
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);

  const f = String(state.commentsMgmtTagFilter || 'all').toLowerCase();
  const staysVisible = f === 'all' || normalizeCommentTags(c.tags).some((t) => t.toLowerCase() === f);
  state.openDashboardTagPopoverId = (keepPopoverOpen && staysVisible) ? c.id : null;
  renderContentEditor();
  scheduleCampaignSave();
}

function handleDashboardTagPopoverCheckbox(cb) {
  const origIdx = parseInt(cb?.dataset?.origIdx ?? '-1', 10);
  const tagName = cb?.dataset?.tag || '';
  if (!Number.isFinite(origIdx) || origIdx < 0 || !tagName) return;
  toggleDashboardCommentTag(origIdx, tagName, Boolean(cb.checked), true);
}

function removeDashboardCommentTagFromPill(btn, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const origIdx = parseInt(btn?.dataset?.origIdx ?? '-1', 10);
  const tagName = btn?.dataset?.tag || '';
  if (!Number.isFinite(origIdx) || origIdx < 0 || !tagName) return;
  toggleDashboardCommentTag(origIdx, tagName, false, false);
}

function addCustomTagFromDashboardPopover(origIdx, inputEl) {
  const b = getActiveBrand();
  const c = b?.social?.comments?.[origIdx];
  if (!b || !c || !inputEl) return;
  const raw = cleanCommentTagName(inputEl.value);
  if (!raw || raw.toLowerCase() === 'all') {
    if (raw.toLowerCase() === 'all') showToast('"All" is reserved as a filter.', 'error');
    return;
  }
  const canonical = canonicalizeCommentTagName(raw);
  if (!canonical || canonical.toLowerCase() === 'all') return;

  ensureDashboardBrandCommentsNormalized(b);
  if (!b.commentTags.some((t) => t.toLowerCase() === canonical.toLowerCase())) {
    b.commentTags.push(canonical);
  }
  applyTagToggleToComment(c, canonical, true);
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);

  const f = String(state.commentsMgmtTagFilter || 'all').toLowerCase();
  const staysVisible = f === 'all' || normalizeCommentTags(c.tags).some((t) => t.toLowerCase() === f);
  state.openDashboardTagPopoverId = staysVisible ? c.id : null;
  renderContentEditor();
  scheduleCampaignSave();
}

function cloneSocialComment(idx) {
  const b = getActiveBrand();
  const src = b?.social?.comments?.[idx];
  if (!src) return;
  b.social.comments.splice(idx + 1, 0, {
    id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: src.text || '',
    tags: normalizeCommentTags(src.tags),
    images: Array.isArray(src.images) ? [...src.images] : [],
    enabled: src.enabled !== false,
    starred: Boolean(src.starred),
    isExpanded: true
  });
  b.comments = b.social.comments;
  b.commentTags = getCampaignAvailableTags(b);
  renderContentEditor();
  scheduleCampaignSave();
  showToast('Comment duplicated');
}
function removeSocialComment(idx) {
  const b = getActiveBrand();
  if (b?.social?.comments) {
    const removed = b.social.comments[idx];
    if (removed?.id && state.selectedCommentIds instanceof Set) {
      state.selectedCommentIds.delete(removed.id);
    }
    if (removed?.id && state.openDashboardTagPopoverId === removed.id) {
      state.openDashboardTagPopoverId = null;
    }
    b.social.comments.splice(idx, 1);
    b.comments = b.social.comments;
    b.commentTags = getCampaignAvailableTags(b);
    renderContentEditor();
    scheduleCampaignSave();
  }
}
async function copyDashboardComment(idx, btn) {
  const b = getActiveBrand();
  const c = b?.social?.comments?.[idx];
  if (!c) return;
  let out = resolveSpinTextForDashboard(c.text || '');
  out = applySafeDomainTransform(out, b);
  if (state.ruleTwitterStripProtocol !== false) {
    out = out.replace(/https?:\/\//gi, '');
  }
  try { await navigator.clipboard.writeText(out); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.classList.add('border-emerald-300', 'bg-emerald-50', 'text-emerald-700');
    btn.innerHTML = `<i class="fas fa-check text-emerald-600 text-[12px]"></i>`;
    setTimeout(() => {
      btn.classList.remove('border-emerald-300', 'bg-emerald-50', 'text-emerald-700');
      btn.innerHTML = orig;
    }, 1400);
  }
}
async function saveSingleDashboardComment(idx, btn) {
  const ta = document.getElementById(`dash-comment-textarea-${idx}`);
  const b = getActiveBrand();
  if (ta && b?.social?.comments?.[idx]) {
    b.social.comments[idx].text = ta.value;
    b.comments = b.social.comments;
  }
  await saveActiveCampaign();
  if (btn) {
    const orig = btn.innerHTML;
    btn.classList.remove('sp-btn-primary');
    btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'text-white', 'border', 'border-emerald-700');
    btn.innerHTML = `<i class="fas fa-check text-[12px]"></i>`;
    setTimeout(() => {
      btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'text-white', 'border', 'border-emerald-700');
      btn.classList.add('sp-btn-primary');
      btn.innerHTML = orig;
    }, 1500);
  }
}

function toggleDashboardAiMenu(event, domKey) {
  event.stopPropagation();
  const target = document.getElementById(`dash-ai-menu-${domKey}`);
  const wasHidden = target?.classList.contains('hidden');
  document.querySelectorAll('.dash-ai-menu').forEach((m) => m.classList.add('hidden'));
  if (wasHidden && target) target.classList.remove('hidden');
}

function toggleDashboardCommentAiMenu(event, idx) {
  toggleDashboardAiMenu(event, `comment-${idx}`);
}

function openDashboardCustomAiPrompt(domKey) {
  document.querySelectorAll('.dash-ai-menu').forEach((m) => m.classList.add('hidden'));
  const box = document.getElementById(`dash-ai-custom-box-${domKey}`);
  if (!box) return;
  box.classList.remove('hidden');
  syncCustomSelect(`dash-ai-custom-count-${domKey}`);
  const input = document.getElementById(`dash-ai-custom-input-${domKey}`);
  if (input) {
    setTimeout(() => {
      input.focus();
      input.select?.();
    }, 20);
  }
}

function closeDashboardCustomAiPrompt(domKey) {
  const box = document.getElementById(`dash-ai-custom-box-${domKey}`);
  if (box) box.classList.add('hidden');
}

function submitDashboardCustomAiPrompt(domKey, moduleType, field, idx) {
  const input = document.getElementById(`dash-ai-custom-input-${domKey}`);
  const customPrompt = (input?.value || '').trim();
  if (!customPrompt) {
    showToast('Please enter a custom variation instruction', 'error');
    if (input) input.focus();
    return;
  }
  const countEl = document.getElementById(`dash-ai-custom-count-${domKey}`);
  const variationCount = Math.min(Math.max(parseInt(countEl?.value || '1', 10) || 1, 1), 10);
  closeDashboardCustomAiPrompt(domKey);
  runDashboardAiAction(moduleType, field, idx, 'custom', customPrompt, domKey, variationCount);
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('.dash-ai-menu').forEach((m) => m.classList.add('hidden'));
  if (state.openDashboardTagPopoverId && !e.target?.closest?.('.dash-tag-popover-wrap')) {
    state.openDashboardTagPopoverId = null;
    document.querySelectorAll('.dash-tag-popover').forEach((p) => p.classList.add('hidden'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.openDashboardTagPopoverId) {
    state.openDashboardTagPopoverId = null;
    document.querySelectorAll('.dash-tag-popover').forEach((p) => p.classList.add('hidden'));
  }
});

function showDashboardApiKeyPrompt() {
  document.getElementById('dash-api-key-prompt-modal')?.classList.remove('hidden');
}
function closeDashboardApiKeyPrompt() {
  document.getElementById('dash-api-key-prompt-modal')?.classList.add('hidden');
}
function goToDashboardAiApiKeySetting() {
  closeDashboardApiKeyPrompt();
  switchSection('ai-settings');
  const aiCard = document.getElementById('dash-card-ai');
  if (aiCard) {
    const body = aiCard.querySelector('.settings-card-body');
    const chevron = aiCard.querySelector('.settings-chevron');
    if (body?.classList.contains('hidden')) {
      body.classList.remove('hidden');
      chevron?.classList.add('rotate-180');
    }
  }
  setTimeout(() => {
    const input = document.getElementById('ai-setting-apikey');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 120);
}

function buildDashboardFullBrandContext(b) {
  if (!b) return {};
  const ba = normalizeBrandAssets(b);
  const firstNonEmpty = (arr) => {
    if (!Array.isArray(arr)) return '';
    for (const item of arr) {
      const txt = String(typeof item === 'string' ? item : item?.text || '').trim();
      if (txt) return txt;
    }
    return '';
  };
  const resolvedWebsite = String(
    b.brandInfo?.url ||
    b.directory?.websiteUrl ||
    b.contact?.website ||
    b.url ||
    b.website ||
    b.websiteUrl ||
    b.directory?.demoUrl ||
    ''
  ).trim();
  const resolvedTagline = String(
    b.brandInfo?.tagline ||
    firstNonEmpty(b.directory?.taglines) ||
    firstNonEmpty(b.directory?.pitches) ||
    ''
  ).trim();
  const resolvedDescription = String(
    ba.longPitch ||
    b.brandInfo?.description ||
    ba.shortPitch ||
    firstNonEmpty(b.directory?.descriptions) ||
    firstNonEmpty(b.directory?.summaries) ||
    firstNonEmpty(b.contact?.messages) ||
    b.contact?.message ||
    ''
  ).trim();
  return {
    name: b.brandInfo?.name || b.brandName || b.directory?.productName || 'Brand',
    brandName: b.brandName || b.brandInfo?.name || b.directory?.productName || 'Brand',
    website: resolvedWebsite,
    url: resolvedWebsite,
    tagline: resolvedTagline,
    shortPitch: ba.shortPitch || '',
    longPitch: ba.longPitch || resolvedDescription,
    pitch: ba.shortPitch || resolvedDescription,
    description: resolvedDescription,
    targetAudience: ba.targetAudience || '',
    pricing: ba.pricingSummary || b.directory?.startingPrice || b.directory?.pricingModel || '',
    pricingSummary: ba.pricingSummary || '',
    founderStory: ba.founderStory || '',
    twitter: ba.handles.twitter || b.brandInfo?.twitter || '',
    instagram: ba.handles.instagram || b.brandInfo?.instagram || '',
    brandAssets: {
      shortPitch: ba.shortPitch || '',
      shortPitches: (ba.shortPitches || []).filter((s) => s?.text).slice(0, 12),
      longPitch: ba.longPitch || '',
      founderStory: (ba.founderStory || '').slice(0, 1200),
      pricingSummary: (ba.pricingSummary || '').slice(0, 800),
      targetAudience: (ba.targetAudience || '').slice(0, 800),
      features: (ba.features || []).filter((f) => f.title || f.detail).slice(0, 16),
      benefits: (ba.benefits || []).filter((f) => f.title || f.detail).slice(0, 16),
      competitors: (ba.competitors || []).filter((c) => c.name || c.advantage).slice(0, 12),
      customLinks: (ba.customLinks || []).filter((l) => l.name && l.url).slice(0, 16),
      customSections: (ba.customSections || []).filter((s) => s.title || s.content).slice(0, 12),
      links: ba.links,
      videos: ba.videos,
      handles: ba.handles,
      proof: {
        testimonials: (ba.proof?.testimonials || []).filter((t) => t.quote).slice(0, 10),
      },
      tone: { forbiddenWords: ba.tone?.forbiddenWords || '' },
    },
    directory: {
      productName: b.directory?.productName || '',
      category: b.directory?.category || '',
      pricingModel: b.directory?.pricingModel || '',
      startingPrice: b.directory?.startingPrice || '',
      demoUrl: b.directory?.demoUrl || ba.videos?.demoUrl || '',
      taglines: (b.directory?.taglines || []).slice(0, 12).map((x) => x?.text || x).filter(Boolean),
      pitches: (b.directory?.pitches || []).slice(0, 12).map((x) => x?.text || x).filter(Boolean),
      summaries: (b.directory?.summaries || []).slice(0, 10).map((x) => x?.text || x).filter(Boolean),
      descriptions: (b.directory?.descriptions || []).slice(0, 8).map((x) => x?.text || x).filter(Boolean),
    },
    contact: {
      senderName: b.contact?.senderName || '',
      company: b.contact?.company || '',
      subject: b.contact?.subject || '',
      message: b.contact?.message || '',
      messages: (b.contact?.messages || []).slice(0, 15).map((x) => x?.text || x).filter(Boolean),
    },
    comments: (b.social?.comments || []).slice(0, 25).map((x) => (typeof x === 'string' ? x : x?.text || '')).filter(Boolean),
    socialPosts: ensureDashboardSocialPosts(b).slice(0, 15).map((p) => ({ platform: p.platform, format: p.format, hook: p.hook, body: (p.body || '').slice(0, 600), ctaUrl: p.ctaUrl || '' })),
    support: {
      faqs: ensureDashboardSupport(b).faqs.slice(0, 15).map((f) => ({ category: f.category, question: f.question, answer: (f.answer || '').slice(0, 450) })),
      macros: ensureDashboardSupport(b).macros.slice(0, 15).map((m) => ({ category: m.category, title: m.title, body: (m.body || '').slice(0, 450) })),
    },
    emails: (b.emails || []).slice(0, 15).map((e) => ({ subject: e?.subject || '', body: (e?.body || '').slice(0, 1000) })),
    dms: (b.dms || []).slice(0, 15).map((d) => ({ platform: d?.platform || '', message: (d?.message || '').slice(0, 600) })),
    articles: (b.articles || []).slice(0, 10).map((a) => ({ title: a?.title || '', body: (a?.body || '').slice(0, 1200) })),
    contentVault: (Array.isArray(b.contentVault) ? b.contentVault : []).slice(0, 20).map((v) => ({
      title: v?.title || '',
      suggestedModule: v?.suggestedModule || 'idea',
      platform: v?.platform || '',
      body: (v?.body || '').slice(0, 500),
    })),
  };
}

async function runDashboardAiAction(moduleType, field, idx, action, customPrompt = '', domKey = '', variationCountArg = 1) {
  document.querySelectorAll('.dash-ai-menu').forEach((m) => m.classList.add('hidden'));
  const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
  if (!openRouterKey && !geminiApiKey) {
    showDashboardApiKeyPrompt();
    return;
  }
  const b = getActiveBrand();
  if (!b) return;

  let currentText = '';
  let sourceObj = null;
  let apiModuleType = moduleType;
  let cardId = `dash-card-${domKey}`;
  let existingTexts = [];

  if (moduleType === 'comment') {
    sourceObj = b.social?.comments?.[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.text || '').trim();
    cardId = `dash-comment-card-${idx}`;
    existingTexts = (b.social?.comments || []).map((c) => (typeof c === 'string' ? c : c?.text || '').trim()).filter(Boolean);
  } else if (moduleType === 'directory') {
    sourceObj = b.directory?.[field]?.[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.text || '').trim();
    apiModuleType = `directory-${field}`;
    existingTexts = (b.directory?.[field] || []).map((x) => (x?.text || '').trim()).filter(Boolean);
  } else if (moduleType === 'contact') {
    const msgs = ensureDashboardContactMessages(b.contact || (b.contact = {}));
    sourceObj = msgs[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.text || '').trim();
    apiModuleType = 'contact_message';
    existingTexts = msgs.map((m) => (m?.text || '').trim()).filter(Boolean);
  } else if (moduleType === 'email') {
    sourceObj = b.emails?.[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.body || '').trim();
    existingTexts = (b.emails || []).map((e) => (e?.body || '').trim()).filter(Boolean);
  } else if (moduleType === 'dm') {
    sourceObj = b.dms?.[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.message || '').trim();
    existingTexts = (b.dms || []).map((d) => (d?.message || '').trim()).filter(Boolean);
  } else if (moduleType === 'social_post') {
    const posts = ensureDashboardSocialPosts(b);
    sourceObj = posts[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.body || sourceObj.hook || '').trim();
    apiModuleType = 'social_post';
    existingTexts = posts.map((p) => (p?.body || p?.hook || '').trim()).filter(Boolean);
  } else if (moduleType === 'support_faq') {
    const sup = ensureDashboardSupport(b);
    sourceObj = sup.faqs[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.answer || sourceObj.question || '').trim();
    apiModuleType = 'support_faq';
    existingTexts = sup.faqs.map((f) => (f?.answer || '').trim()).filter(Boolean);
  } else if (moduleType === 'support_macro') {
    const sup = ensureDashboardSupport(b);
    sourceObj = sup.macros[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.body || '').trim();
    apiModuleType = 'support_macro';
    existingTexts = sup.macros.map((m) => (m?.body || '').trim()).filter(Boolean);
  } else if (moduleType === 'article') {
    sourceObj = b.articles?.[idx];
    if (!sourceObj) return;
    currentText = (sourceObj.body || '').trim();
    existingTexts = (b.articles || []).map((a) => (a?.body || '').trim()).filter(Boolean);
  }

  if (!currentText && ['rewrite', 'refine', 'add_emojis'].includes(action)) {
    showToast(`Enter text before choosing "${action.replace('_', ' ')}"`, 'error');
    return;
  }
  if (action === 'custom' && !String(customPrompt || '').trim()) {
    showToast('Please enter a custom variation instruction', 'error');
    return;
  }

  const variationCount = action === 'custom'
    ? Math.min(Math.max(parseInt(variationCountArg || '1', 10) || 1, 1), 10)
    : 1;

  const card = document.getElementById(cardId);
  if (card) card.classList.add('opacity-70', 'pointer-events-none');

  try {
    const token = state.session?.accessToken || state.session?.token || '';
    const res = await fetch('/api/ai/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action,
        text: currentText,
        customPrompt: String(customPrompt || '').trim(),
        moduleType: apiModuleType,
        variationCount,
        existingTexts,
        brand: buildDashboardFullBrandContext(b),
        openRouterKey,
        geminiApiKey,
        aiModel: state.aiModel || 'anthropic/claude-3.5-haiku'
      })
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && json?.needsApiKey) {
      showDashboardApiKeyPrompt();
      return;
    }
    const rawList = Array.isArray(json.variations) && json.variations.length
      ? json.variations
      : (json.text ? [json.text] : []);
    const dirMaxLens = { taglines: 60, pitches: 140, summaries: 250 };
    const variations = rawList
      .map((item) => {
        let t = String(item || '').trim();
        if (moduleType === 'directory' && dirMaxLens[field] && t.length > dirMaxLens[field]) {
          t = t.slice(0, dirMaxLens[field]).replace(/\s+\S*$/, '').trim() || t.slice(0, dirMaxLens[field]);
        }
        return t;
      })
      .filter(Boolean);

    if (res.ok && json.success && variations.length > 0) {
      const shouldReplaceInPlace = action === 'regenerate' || ((action === 'generate' || action === 'custom') && !currentText);
      const firstText = variations[0];
      const extraTexts = shouldReplaceInPlace ? variations.slice(1) : variations;

      if (moduleType === 'comment') {
        if (shouldReplaceInPlace) {
          sourceObj.text = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `cv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: t,
            tags: normalizeCommentTags(sourceObj.tags),
            enabled: sourceObj.enabled !== false,
            starred: false,
            isExpanded: true,
            ...(Array.isArray(sourceObj.images) ? { images: [...sourceObj.images] } : {}),
          }));
          b.social.comments.splice(idx + 1, 0, ...newItems);
        }
        b.comments = b.social.comments;
      } else if (moduleType === 'directory') {
        if (shouldReplaceInPlace) {
          sourceObj.text = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `${field.slice(0, -1)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: t,
            enabled: true,
          }));
          b.directory[field].splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'contact') {
        const msgs = ensureDashboardContactMessages(b.contact);
        if (shouldReplaceInPlace) {
          sourceObj.text = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: t,
            enabled: sourceObj.enabled !== false,
          }));
          msgs.splice(idx + 1, 0, ...newItems);
        }
        syncPrimaryContactMessage(b.contact);
      } else if (moduleType === 'email') {
        if (shouldReplaceInPlace) {
          sourceObj.body = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            subject: sourceObj.subject || '',
            body: t,
            enabled: sourceObj.enabled !== false,
          }));
          b.emails.splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'dm') {
        if (shouldReplaceInPlace) {
          sourceObj.message = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            platform: sourceObj.platform || 'Twitter',
            message: t,
            enabled: sourceObj.enabled !== false,
          }));
          b.dms.splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'social_post') {
        const posts = ensureDashboardSocialPosts(b);
        if (shouldReplaceInPlace) {
          sourceObj.body = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            platform: sourceObj.platform || 'X / Twitter',
            format: sourceObj.format || 'single',
            hook: sourceObj.hook || '',
            body: t,
            ctaUrl: sourceObj.ctaUrl || '',
            mediaGalleryIds: Array.isArray(sourceObj.mediaGalleryIds) ? [...sourceObj.mediaGalleryIds] : [],
            enabled: sourceObj.enabled !== false,
            createdAt: new Date().toISOString(),
          }));
          posts.splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'support_faq') {
        const sup = ensureDashboardSupport(b);
        if (shouldReplaceInPlace) {
          sourceObj.answer = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: sourceObj.category || 'General',
            question: sourceObj.question ? `${sourceObj.question} (Alt)` : 'Product FAQ',
            answer: t,
            enabled: sourceObj.enabled !== false,
          }));
          sup.faqs.splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'support_macro') {
        const sup = ensureDashboardSupport(b);
        if (shouldReplaceInPlace) {
          sourceObj.body = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: sourceObj.category || 'General',
            title: sourceObj.title ? `${sourceObj.title} (Alt)` : 'Support Reply',
            body: t,
            enabled: sourceObj.enabled !== false,
          }));
          sup.macros.splice(idx + 1, 0, ...newItems);
        }
      } else if (moduleType === 'article') {
        if (shouldReplaceInPlace) {
          sourceObj.body = firstText;
        }
        if (extraTexts.length > 0) {
          const newItems = extraTexts.map((t) => ({
            id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: sourceObj.title ? `${sourceObj.title} (Copy)` : 'AI Article',
            category: sourceObj.category || 'Blog',
            preset: sourceObj.preset || 'problem-solution',
            targetKeyword: sourceObj.targetKeyword || '',
            slug: sourceObj.slug ? `${sourceObj.slug}-copy` : '',
            metaDescription: sourceObj.metaDescription || '',
            body: t,
            enabled: sourceObj.enabled !== false,
          }));
          b.articles.splice(idx + 1, 0, ...newItems);
        }
      }

      renderContentEditor();
      scheduleCampaignSave();
      if (variations.length > 1) {
        showToast(`Generated ${variations.length} variations with AI`);
      } else if (action === 'regenerate') {
        showToast('Regenerated variation with AI');
      } else if (shouldReplaceInPlace) {
        showToast('Generated variation with AI');
      } else {
        showToast('Created new variation with AI changes');
      }
    } else {
      showToast(json.error || 'AI action failed. Check your API key in Settings.', 'error');
    }
  } catch (err) {
    showToast('AI request failed: ' + (err.message || String(err)), 'error');
  } finally {
    const refreshedCard = document.getElementById(cardId);
    if (refreshedCard) refreshedCard.classList.remove('opacity-70', 'pointer-events-none');
  }
}

async function runDashboardCommentAiAction(idx, action) {
  return runDashboardAiAction('comment', '', idx, action, '', `comment-${idx}`);
}

function ensureDashboardContactMessages(c) {
  if (!c) return [];
  if (!Array.isArray(c.messages)) {
    c.messages = [{
      id: `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: c.message || '',
      enabled: true
    }];
  }
  return c.messages;
}
function syncPrimaryContactMessage(c) {
  if (!c || !Array.isArray(c.messages)) return;
  const active = c.messages.find((m) => m && m.enabled !== false && (m.text || '').trim()) || c.messages[0];
  c.message = active ? (active.text || '') : '';
}
function addContactMessageVariation() {
  const b = getActiveBrand();
  if (!b) return;
  const c = b.contact || (b.contact = {});
  const msgs = ensureDashboardContactMessages(c);
  msgs.push({ id: `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', enabled: true });
  syncPrimaryContactMessage(c);
  renderContentEditor();
  scheduleCampaignSave();
}
function updateContactMessageVariation(idx, val) {
  const b = getActiveBrand();
  const c = b?.contact;
  const msgs = ensureDashboardContactMessages(c);
  if (msgs[idx]) {
    msgs[idx].text = val;
    syncPrimaryContactMessage(c);
    const charEl = document.getElementById(`dash-contact-char-${idx}`);
    if (charEl) charEl.textContent = `Char: ${val.length}`;
    scheduleCampaignSave();
  }
}
function toggleContactMessageEnabled(idx) {
  const b = getActiveBrand();
  const c = b?.contact;
  const msgs = ensureDashboardContactMessages(c);
  if (msgs[idx]) {
    msgs[idx].enabled = msgs[idx].enabled === false;
    syncPrimaryContactMessage(c);
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function removeContactMessageVariation(idx) {
  const b = getActiveBrand();
  const c = b?.contact;
  const msgs = ensureDashboardContactMessages(c);
  if (msgs.length <= 1) {
    if (msgs[0]) msgs[0].text = '';
  } else {
    msgs.splice(idx, 1);
  }
  syncPrimaryContactMessage(c);
  renderContentEditor();
  scheduleCampaignSave();
}
async function copyDashboardContactMessage(idx, btn) {
  const b = getActiveBrand();
  const msgs = ensureDashboardContactMessages(b?.contact);
  const item = msgs[idx];
  if (!item) return;
  const out = resolveSpinTextForDashboard(item.text || '');
  try { await navigator.clipboard.writeText(out); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check text-emerald-600 text-[11px]"></i><span class="text-emerald-600">Copied!</span>`;
    setTimeout(() => { btn.innerHTML = orig; }, 1400);
  }
}
async function saveSingleDashboardContactMessage(idx, btn) {
  const ta = document.getElementById(`dash-contact-textarea-${idx}`);
  const b = getActiveBrand();
  if (ta && b?.contact) {
    const msgs = ensureDashboardContactMessages(b.contact);
    if (msgs[idx]) msgs[idx].text = ta.value;
    syncPrimaryContactMessage(b.contact);
  }
  await saveActiveCampaign();
  if (btn) {
    const orig = btn.innerHTML;
    btn.classList.remove('sp-btn-primary');
    btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'text-white', 'border', 'border-emerald-700', 'font-bold');
    btn.innerHTML = `<i class="fas fa-check text-[11px]"></i><span>Saved!</span>`;
    setTimeout(() => {
      btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'text-white', 'border', 'border-emerald-700', 'font-bold');
      btn.classList.add('sp-btn-primary');
      btn.innerHTML = orig;
    }, 1500);
  }
}

function addEmailTemplate() {
  const b = getActiveBrand();
  if (!b) return;
  if (!Array.isArray(b.emails)) b.emails = [];
  b.emails.push({ id: `email-${Date.now()}`, subject: '', body: '', enabled: true });
  renderContentEditor();
  scheduleCampaignSave();
}
function toggleEmailTemplateEnabled(idx) {
  const b = getActiveBrand();
  if (b?.emails?.[idx]) { b.emails[idx].enabled = b.emails[idx].enabled === false; renderContentEditor(); scheduleCampaignSave(); }
}
function updateEmailTemplate(idx, field, val) {
  const b = getActiveBrand();
  if (b?.emails?.[idx]) { b.emails[idx][field] = val; scheduleCampaignSave(); }
}
function removeEmailTemplate(idx) {
  const b = getActiveBrand();
  if (b?.emails) { b.emails.splice(idx, 1); renderContentEditor(); scheduleCampaignSave(); }
}
function addDmTemplate() {
  const b = getActiveBrand();
  if (!b) return;
  if (!Array.isArray(b.dms)) b.dms = [];
  b.dms.push({ id: `dm-${Date.now()}`, platform: 'Twitter', message: '', enabled: true });
  renderContentEditor();
  scheduleCampaignSave();
}
function toggleDmTemplateEnabled(idx) {
  const b = getActiveBrand();
  if (b?.dms?.[idx]) { b.dms[idx].enabled = b.dms[idx].enabled === false; renderContentEditor(); scheduleCampaignSave(); }
}
function updateDmTemplate(idx, field, val) {
  const b = getActiveBrand();
  if (b?.dms?.[idx]) { b.dms[idx][field] = val; scheduleCampaignSave(); }
}
function removeDmTemplate(idx) {
  const b = getActiveBrand();
  if (b?.dms) { b.dms.splice(idx, 1); renderContentEditor(); scheduleCampaignSave(); }
}
function addArticleTemplate() {
  const b = getActiveBrand();
  if (!b) return;
  if (!Array.isArray(b.articles)) b.articles = [];
  b.articles.push({
    id: `art-${Date.now()}`,
    title: 'New Article',
    category: 'Blog',
    preset: state.articleAutoPreset || 'problem-solution',
    targetKeyword: state.articleAutoKeyword || '',
    slug: 'new-article',
    metaDescription: '',
    body: '',
    enabled: true
  });
  renderContentEditor();
  scheduleCampaignSave();
}
function updateArticleTemplate(idx, field, val) {
  const b = getActiveBrand();
  if (b?.articles?.[idx]) { b.articles[idx][field] = val; scheduleCampaignSave(); }
}
function autoFillArticleSlug(idx) {
  const b = getActiveBrand();
  const art = b?.articles?.[idx];
  if (!art) return;
  art.slug = slugifyDashboardSeo(art.title || b.brandName || 'article');
  const el = document.getElementById(`dash-article-slug-${idx}`);
  if (el) el.value = art.slug;
  scheduleCampaignSave();
}
async function copyDashboardArticle(idx, format = 'text', btn = null) {
  const b = getActiveBrand();
  const art = b?.articles?.[idx];
  if (!art) return;
  const title = String(art.title || '').trim();
  const body = String(art.body || '').trim();
  let textOut = title ? `${title}\n\n${body}` : body;
  if (format === 'markdown') {
    textOut = title ? `# ${title}\n\n${body}` : body;
  } else if (format === 'rich') {
    const html = (title ? `<h2>${escapeHtml(title)}</h2>\n` : '') + `<p>${escapeHtml(body).replace(/\n\n/g, '</p>\n<p>').replace(/\n/g, '<br/>')}</p>`;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([textOut], { type: 'text/plain' }),
          }),
        ]);
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1300);
        }
        return;
      }
    } catch (_) {}
    textOut = html;
  }
  try { await navigator.clipboard.writeText(textOut); } catch (_) {}
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1300);
  }
}
function removeArticleTemplate(idx) {
  const b = getActiveBrand();
  if (b?.articles) { b.articles.splice(idx, 1); renderContentEditor(); scheduleCampaignSave(); }
}

function addSocialPostTemplate() {
  const b = getActiveBrand();
  if (!b) return;
  const posts = ensureDashboardSocialPosts(b);
  const plat = state.socialPostPlatformFilter && state.socialPostPlatformFilter !== 'all'
    ? state.socialPostPlatformFilter
    : 'X / Twitter';
  posts.unshift({
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    platform: plat,
    format: 'single',
    hook: '',
    body: '',
    ctaUrl: buildBrandUtmUrl(b) || b.brandInfo?.url || '',
    mediaGalleryIds: [],
    enabled: true,
    createdAt: new Date().toISOString(),
  });
  renderContentEditor();
  scheduleCampaignSave();
}
function updateSocialPostTemplate(idx, field, val) {
  const b = getActiveBrand();
  const posts = ensureDashboardSocialPosts(b);
  if (posts[idx]) { posts[idx][field] = val; scheduleCampaignSave(); }
}
function toggleSocialPostEnabled(idx) {
  const b = getActiveBrand();
  const posts = ensureDashboardSocialPosts(b);
  if (posts[idx]) { posts[idx].enabled = posts[idx].enabled === false; renderContentEditor(); scheduleCampaignSave(); }
}
function removeSocialPostTemplate(idx) {
  const b = getActiveBrand();
  const posts = ensureDashboardSocialPosts(b);
  posts.splice(idx, 1);
  renderContentEditor();
  scheduleCampaignSave();
}
function toggleSocialPostGalleryMedia(idx, galleryId) {
  const b = getActiveBrand();
  const posts = ensureDashboardSocialPosts(b);
  const post = posts[idx];
  if (!post || !galleryId) return;
  const list = Array.isArray(post.mediaGalleryIds) ? post.mediaGalleryIds : [];
  const exists = list.includes(galleryId);
  post.mediaGalleryIds = exists ? list.filter((x) => x !== galleryId) : [...list, galleryId].slice(0, 4);
  renderContentEditor();
  scheduleCampaignSave();
}
function fillSocialPostUtmUrl(idx) {
  const b = getActiveBrand();
  const posts = ensureDashboardSocialPosts(b);
  const utm = buildBrandUtmUrl(b) || b?.brandInfo?.url || '';
  if (!utm) {
    showToast('Add Website URL in Brand Assets first', 'error');
    return;
  }
  if (posts[idx]) {
    posts[idx].ctaUrl = utm;
    const el = document.getElementById(`dash-sp-cta-${idx}`);
    if (el) el.value = utm;
    scheduleCampaignSave();
  }
}
function updateSocialPostLengthBadge(idx) {
  const b = getActiveBrand();
  const post = ensureDashboardSocialPosts(b)[idx];
  const badge = document.getElementById(`dash-sp-len-${idx}`);
  if (!post || !badge) return;
  const len = `${post.hook ? post.hook + '\n\n' : ''}${post.body || ''}`.trim().length;
  const isX = String(post.platform || '').includes('Twitter') || String(post.platform || '').startsWith('X');
  badge.textContent = `${len}${isX ? '/280' : 'c'}`;
  badge.className = `text-[11px] font-mono px-2 py-0.5 rounded border ${isX && len > 280 ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'bg-[#FAF4EB] text-[#57606f] border-[#dfd8cc]'}`;
}
async function copyDashboardSocialPost(idx, btn) {
  const b = getActiveBrand();
  const post = ensureDashboardSocialPosts(b)[idx];
  if (!post) return;
  const isX = String(post.platform || '').includes('Twitter') || String(post.platform || '').startsWith('X');
  let out = [post.hook, post.body, post.ctaUrl].filter((s) => String(s || '').trim()).join('\n\n');
  out = resolveSpinTextForDashboard(out);
  if (isX && state.ruleTwitterStripProtocol !== false) {
    out = out.replace(/https?:\/\//gi, '');
  }
  try { await navigator.clipboard.writeText(out); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check text-emerald-600 text-[11px]"></i><span class="text-emerald-600">Copied!</span>`;
    setTimeout(() => { btn.innerHTML = orig; }, 1400);
  }
}

function setDashboardSupportView(view) {
  state.supportActiveView = view === 'macros' ? 'macros' : 'faqs';
  renderContentEditor();
}
function addSupportFaq() {
  const b = getActiveBrand();
  if (!b) return;
  const sup = ensureDashboardSupport(b);
  sup.faqs.unshift({
    id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: state.supportCategoryFilter && state.supportCategoryFilter !== 'all' ? state.supportCategoryFilter : 'General',
    question: '',
    answer: '',
    enabled: true,
  });
  state.supportActiveView = 'faqs';
  renderContentEditor();
  scheduleCampaignSave();
}
function updateSupportFaq(idx, field, val) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  if (sup.faqs[idx]) { sup.faqs[idx][field] = val; scheduleCampaignSave(); }
}
function toggleSupportFaqEnabled(idx) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  if (sup.faqs[idx]) { sup.faqs[idx].enabled = sup.faqs[idx].enabled === false; renderContentEditor(); scheduleCampaignSave(); }
}
function removeSupportFaq(idx) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  sup.faqs.splice(idx, 1);
  renderContentEditor();
  scheduleCampaignSave();
}
async function copyDashboardSupportFaq(idx, btn) {
  const b = getActiveBrand();
  const item = ensureDashboardSupport(b).faqs[idx];
  if (!item) return;
  const out = resolveSpinTextForDashboard(item.answer || item.question || '');
  try { await navigator.clipboard.writeText(out); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check text-emerald-600 text-[11px]"></i><span class="text-emerald-600">Copied!</span>`;
    setTimeout(() => { btn.innerHTML = orig; }, 1400);
  }
}
function addSupportMacro() {
  const b = getActiveBrand();
  if (!b) return;
  const sup = ensureDashboardSupport(b);
  sup.macros.unshift({
    id: `macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: state.supportCategoryFilter && state.supportCategoryFilter !== 'all' ? state.supportCategoryFilter : 'General',
    title: '',
    body: '',
    enabled: true,
  });
  state.supportActiveView = 'macros';
  renderContentEditor();
  scheduleCampaignSave();
}
function updateSupportMacro(idx, field, val) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  if (sup.macros[idx]) { sup.macros[idx][field] = val; scheduleCampaignSave(); }
}
function toggleSupportMacroEnabled(idx) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  if (sup.macros[idx]) { sup.macros[idx].enabled = sup.macros[idx].enabled === false; renderContentEditor(); scheduleCampaignSave(); }
}
function removeSupportMacro(idx) {
  const b = getActiveBrand();
  const sup = ensureDashboardSupport(b);
  sup.macros.splice(idx, 1);
  renderContentEditor();
  scheduleCampaignSave();
}
async function copyDashboardSupportMacro(idx, btn) {
  const b = getActiveBrand();
  const item = ensureDashboardSupport(b).macros[idx];
  if (!item) return;
  const out = resolveSpinTextForDashboard(item.body || '');
  try { await navigator.clipboard.writeText(out); } catch (_) {}
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check text-emerald-600 text-[11px]"></i><span class="text-emerald-600">Copied!</span>`;
    setTimeout(() => { btn.innerHTML = orig; }, 1400);
  }
}

async function autoGenerateDashboardModule(mod, triggerBtn) {
  const b = getActiveBrand();
  if (!b) return;
  const brandCtx = buildDashboardFullBrandContext(b);
  if (!brandCtx.name && !brandCtx.url && !brandCtx.tagline && !brandCtx.description) {
    showToast('Fill out Brand Assets (Name, URL, or Pitch) first', 'error');
    return;
  }
  const origHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '⏳ Generating...';
  }
  try {
    const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
    const token = state.session?.accessToken || state.session?.token || '';
    const res = await fetch('/api/ai/auto-generate-module', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        module: mod,
        brand: brandCtx,
        landingContext: b.brandInfo?.landingContext || null,
        ...(mod === 'articles' ? {
          articlePreset: state.articleAutoPreset || 'problem-solution',
          targetKeyword: state.articleAutoKeyword || '',
        } : {}),
        ...(openRouterKey ? { openRouterKey } : {}),
        ...(geminiApiKey ? { geminiApiKey } : {}),
        aiModel: state.aiModel || '',
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.data) {
      showToast(json?.error || 'Auto-generate failed', 'error');
      return;
    }
    const data = json.data;
    const now = Date.now();
    if (mod === 'social' && Array.isArray(data.socialPosts)) {
      const existing = ensureDashboardSocialPosts(b).filter((p) => !p.isAutoGenerated && (p.hook || p.body));
      const generated = data.socialPosts.map((p, idx) => ({
        id: `sp-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        platform: String(p.platform || 'X / Twitter'),
        format: String(p.format || 'single'),
        hook: String(p.hook || ''),
        body: String(p.body || ''),
        ctaUrl: String(p.ctaUrl || b.brandInfo?.url || ''),
        mediaGalleryIds: [],
        enabled: true,
        createdAt: new Date().toISOString(),
        isAutoGenerated: true,
      }));
      b.socialPosts = [...generated, ...existing];
    } else if (mod === 'support') {
      const sup = ensureDashboardSupport(b);
      if (Array.isArray(data.faqs)) {
        const existingFaqs = sup.faqs.filter((f) => !f.isAutoGenerated && (f.question || f.answer));
        const genFaqs = data.faqs.map((f, idx) => ({
          id: `faq-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          category: String(f.category || 'General'),
          question: String(f.question || ''),
          answer: String(f.answer || ''),
          enabled: true,
          isAutoGenerated: true,
        }));
        sup.faqs = [...genFaqs, ...existingFaqs];
      }
      if (Array.isArray(data.macros)) {
        const existingMacros = sup.macros.filter((m) => !m.isAutoGenerated && (m.title || m.body));
        const genMacros = data.macros.map((m, idx) => ({
          id: `macro-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          category: String(m.category || 'General'),
          title: String(m.title || ''),
          body: String(m.body || ''),
          enabled: true,
          isAutoGenerated: true,
        }));
        sup.macros = [...genMacros, ...existingMacros];
      }
    } else if (mod === 'articles' && Array.isArray(data.articles)) {
      const existing = (b.articles || []).filter((a) => !a.isAutoGenerated && a.id !== 'art-default' && (a.title || a.body));
      const generated = data.articles.map((a, idx) => ({
        id: `art-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        title: String(a.title || `Article ${idx + 1}`),
        category: 'Blog Post',
        preset: String(a.preset || state.articleAutoPreset || 'problem-solution'),
        targetKeyword: String(a.targetKeyword || state.articleAutoKeyword || ''),
        slug: String(a.slug || slugifyDashboardSeo(a.title || `article-${idx + 1}`)),
        metaDescription: String(a.metaDescription || '').slice(0, 160),
        body: String(a.body || ''),
        enabled: true,
        isAutoGenerated: true,
      }));
      b.articles = [...generated, ...existing];
    }
    renderContentEditor();
    scheduleCampaignSave();
    showToast(`Auto-generated ${mod === 'social' ? 'Social Posts' : (mod === 'support' ? 'Support FAQs & Macros' : 'SEO Articles')}`);
  } catch (err) {
    showToast('Auto-generate failed: ' + (err.message || String(err)), 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = origHtml;
    }
  }
}
function addBulkQueueUrls() {
  const b = getActiveBrand();
  const input = document.getElementById('dash-queue-bulk-input');
  if (!b || !input) return;
  const lines = input.value.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.startsWith('http'));
  if (!Array.isArray(b.queue)) b.queue = [];
  lines.forEach((url) => {
    if (!b.queue.some((i) => i.url === url)) {
      b.queue.unshift({ id: 'opp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), url, title: url, status: 'queued', savedAt: new Date().toISOString() });
    }
  });
  input.value = '';
  renderContentEditor();
  scheduleCampaignSave();
}
function updateQueueItemStatus(idx, status) {
  const b = getActiveBrand();
  if (b?.queue?.[idx]) { b.queue[idx].status = status; scheduleCampaignSave(); }
}
function removeQueueItem(idx) {
  const b = getActiveBrand();
  if (b?.queue) { b.queue.splice(idx, 1); renderContentEditor(); scheduleCampaignSave(); }
}
function clearPostedQueueItems() {
  const b = getActiveBrand();
  if (b?.queue) {
    b.queue = b.queue.filter((i) => i.status !== 'posted');
    renderContentEditor();
    scheduleCampaignSave();
  }
}
function addCampaignSuppression() {
  const b = getActiveBrand();
  const input = document.getElementById('camp-sup-input');
  if (!b || !input || !input.value.trim()) return;
  if (!Array.isArray(b.suppressionList)) b.suppressionList = [];

  const entries = input.value
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const existing = new Set(
    b.suppressionList.map((d) => String(typeof d === 'string' ? d : d.url || d.domain || '').trim().toLowerCase())
  );

  let added = 0;
  entries.reverse().forEach((entry) => {
    const key = entry.toLowerCase();
    if (!existing.has(key)) {
      existing.add(key);
      b.suppressionList.unshift(entry);
      added++;
    }
  });

  input.value = '';
  renderContentEditor();
  scheduleCampaignSave();
  if (added > 0) {
    showToast(`Added ${added} ${added === 1 ? 'URL' : 'URLs'} to suppression list`);
  } else {
    showToast('All entered URLs are already in the suppression list', 'error');
  }
}
function clearCampaignSuppression() {
  const b = getActiveBrand();
  if (!b || !Array.isArray(b.suppressionList) || b.suppressionList.length === 0) return;
  if (!confirm(`Clear all ${b.suppressionList.length} suppressed URLs for this product?`)) return;
  b.suppressionList = [];
  renderContentEditor();
  scheduleCampaignSave();
}
function removeCampaignSuppression(idx) {
  const b = getActiveBrand();
  if (b?.suppressionList) { b.suppressionList.splice(idx, 1); renderContentEditor(); scheduleCampaignSave(); }
}
function updateTwitterStripRule(checked) {
  state.ruleTwitterStripProtocol = checked;
  state.settings.updatedAt = new Date().toISOString();
  const b = getActiveBrand();
  if (b) {
    if (!b.postingRules) b.postingRules = {};
    b.postingRules.twitterStripProtocol = checked;
    b.updatedAt = state.settings.updatedAt;
  }
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, ruleTwitterStripProtocol: checked, settings: state.settings });
}

// ============================================================================
// 3. Research & Automated Alerts (Zero API Key)
// ============================================================================
const RESEARCH_PLATFORMS_META = [
  { key: 'reddit', label: 'Reddit' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'hackernews', label: 'Hacker News' },
  { key: 'quora', label: 'Quora' },
  { key: 'medium', label: 'Medium' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'threads', label: 'Threads' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'web', label: 'Web / Blogs' },
];

const RESEARCH_ALERT_SITE_MAP = {
  reddit: 'site:reddit.com',
  twitter: 'site:x.com',
  youtube: 'site:youtube.com',
  linkedin: 'site:linkedin.com',
  hackernews: 'site:news.ycombinator.com',
  quora: 'site:quora.com',
  medium: 'site:medium.com',
  tiktok: 'site:tiktok.com',
  instagram: 'site:instagram.com',
  facebook: 'site:facebook.com',
  threads: 'site:threads.net',
  pinterest: 'site:pinterest.com',
};

let dashFeedInboxMode = 'live';
let dashKwTypeFilter = 'all';
let dashFeedTermsPreset = 'all';
let dashAlertsDrawerOpen = false;
let dashActiveFetchJob = null;
const dashSelectedNetworkTabs = new Set();
const dashExcludedFeedTerms = new Set();
let dashActiveSavedGroupId = '';
let dashPendingSaveThreads = [];
let dashAlertsCollapsed = true;
let dashRenamingGroupId = '';

function buildCompetitorCombinations(name) {
  const clean = String(name || '').trim();
  return [
    { text: `Alternative to ${clean}`, enabled: true },
    { text: `Alternate to ${clean}`, enabled: true },
    { text: `Best alternative to ${clean}`, enabled: true },
    { text: `${clean} vs`, enabled: true },
  ];
}

function formatCompetitorOrQuery(comp) {
  const raw = typeof comp === 'string' ? comp : (comp?.orQuery || comp?.name || '');
  const clean = String(raw || '').trim();
  if (!clean) return '';
  if (typeof comp === 'object' && comp?.orQuery) return String(comp.orQuery).trim();
  const safe = clean.replace(/["()]/g, '').trim();
  if (!safe) return '';
  return `"${safe}" (alternative OR alternate OR vs)`;
}

function countQueryWords(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

function buildGroupedGoogleAlertQueries(rc = {}, opts = {}) {
  const selectedOnly = Boolean(opts?.selectedOnly);
  const fmtKw = (raw) => {
    const clean = String(raw || '').replace(/"/g, '').trim();
    if (!clean) return '';
    if (/[()]|\bOR\b|\bAND\b|site:/i.test(clean)) return `(${clean})`;
    return `"${clean}"`;
  };

  const termExprs = [];
  const seen = new Set();
  (Array.isArray(rc.keywords) ? rc.keywords : []).forEach((k) => {
    const raw = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (selectedOnly && dashExcludedFeedTerms.has(`kw:${key}`)) return;
    if (seen.has(key)) return;
    seen.add(key);
    const expr = fmtKw(raw);
    if (expr) termExprs.push(expr);
  });
  (Array.isArray(rc.competitors) ? rc.competitors : []).forEach((c) => {
    const nameKey = String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase();
    if (selectedOnly && (!nameKey || dashExcludedFeedTerms.has(`comp:${nameKey}`))) return;
    const orQ = formatCompetitorOrQuery(c);
    if (!orQ) return;
    const key = orQ.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    termExprs.push(`(${orQ})`);
  });
  if (termExprs.length === 0) return [];

  const p = rc.platforms || {};
  const siteTokens = [];
  if (p.web !== true) {
    Object.entries(RESEARCH_ALERT_SITE_MAP).forEach(([platKey, siteExpr]) => {
      if (p[platKey] === true) siteTokens.push(siteExpr);
    });
  }

  const siteGroups = [];
  if (siteTokens.length === 0) {
    siteGroups.push('');
  } else {
    let curSites = [];
    siteTokens.forEach((tok) => {
      const candidate = [...curSites, tok];
      const candidateExpr = `(${candidate.join(' OR ')})`;
      if (curSites.length > 0 && countQueryWords(candidateExpr) > 13) {
        siteGroups.push(`(${curSites.join(' OR ')})`);
        curSites = [tok];
      } else {
        curSites = candidate;
      }
    });
    if (curSites.length > 0) siteGroups.push(`(${curSites.join(' OR ')})`);
  }

  const packed = [];
  const maxWords = 27;
  siteGroups.forEach((siteSuffix) => {
    const suffixWords = siteSuffix ? countQueryWords(siteSuffix) : 0;
    const budget = Math.max(4, maxWords - suffixWords);
    let chunk = [];
    const flush = () => {
      if (chunk.length === 0) return;
      const termsPart = (chunk.length === 1 && !siteSuffix) ? chunk[0] : `(${chunk.join(' OR ')})`;
      packed.push(siteSuffix ? `${termsPart} ${siteSuffix}` : termsPart);
      chunk = [];
    };
    termExprs.forEach((expr) => {
      const candidate = [...chunk, expr];
      if (chunk.length > 0 && countQueryWords(`(${candidate.join(' OR ')})`) > budget) {
        flush();
      }
      chunk.push(expr);
    });
    flush();
  });

  return packed;
}

function computeManagedAlertSignature(rc = {}) {
  const p = rc?.platforms || {};
  const platKeys = Object.keys(DEFAULT_RESEARCH_PLATFORMS).filter((k) => p[k] === true).sort();
  const kwList = (Array.isArray(rc?.keywords) ? rc.keywords : [])
    .map((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const compList = (Array.isArray(rc?.competitors) ? rc.competitors : [])
    .map((c) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return JSON.stringify({
    k: kwList,
    c: compList,
    p: platKeys,
    f: String(rc?.frequency || 'realtime'),
    q: String(rc?.quality || 'all'),
  });
}

function saveResearchConfigFromUI() {
  const rc = getCampaignResearchConfig();
  rc.frequency = rc.frequency || 'realtime';
  rc.quality = rc.quality || 'all';
  const nextPlatforms = { ...DEFAULT_RESEARCH_PLATFORMS, ...(rc.platforms || {}) };
  RESEARCH_PLATFORMS_META.forEach((m) => {
    const cb = document.getElementById(`res-plat-${m.key}`);
    if (cb) nextPlatforms[m.key] = Boolean(cb.checked);
  });
  rc.platforms = nextPlatforms;
  touchActiveResearchConfig(rc);
  renderGoogleAlertsSourcesBar(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function setKeywordTypeFilter(type) {
  dashKwTypeFilter = (type === 'niche' || type === 'competitor' || type === 'favourites') ? type : 'all';
  const addTypeEl = document.getElementById('res-kw-add-type');
  if (addTypeEl && (dashKwTypeFilter === 'niche' || dashKwTypeFilter === 'competitor')) {
    addTypeEl.value = dashKwTypeFilter;
    syncCustomSelect(addTypeEl);
  }
  renderResearchSection();
}

function addResearchTerm() {
  const input = document.getElementById('res-kw-input');
  const typeVal = document.getElementById('res-kw-add-type')?.value || 'niche';
  const val = (input?.value || '').trim();
  if (!val) return;
  const rc = getCampaignResearchConfig();
  const valLower = val.toLowerCase();

  if (typeVal === 'competitor') {
    if (rc.deletedCompetitors && rc.deletedCompetitors[valLower]) delete rc.deletedCompetitors[valLower];
    const exists = (rc.competitors || []).some((c) => (typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === valLower);
    if (!exists) {
      rc.competitors.unshift({
        id: 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: val,
        orQuery: formatCompetitorOrQuery(val),
        queries: buildCompetitorCombinations(val),
      });
    }
  } else {
    if (rc.deletedKeywords && rc.deletedKeywords[valLower]) delete rc.deletedKeywords[valLower];
    if (!rc.keywords.some((k) => String(k || '').trim().toLowerCase() === valLower)) {
      rc.keywords.unshift(val);
    }
    const b = getActiveBrand();
    if (b) {
      if (!Array.isArray(b.keywords)) b.keywords = [];
      if (!b.keywords.some((k) => (typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() === valLower)) {
        b.keywords.unshift({ id: 'kw-' + Date.now(), text: val, bookmarked: false });
      }
    }
  }

  if (input) input.value = '';
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function removeResearchKeyword(idx) {
  const rc = getCampaignResearchConfig();
  const removed = rc.keywords[idx];
  if (removed) {
    const cleanLower = String(removed).trim().toLowerCase();
    if (!rc.deletedKeywords || typeof rc.deletedKeywords !== 'object') rc.deletedKeywords = {};
    rc.deletedKeywords[cleanLower] = new Date().toISOString();
    const b = getActiveBrand();
    if (b && Array.isArray(b.keywords)) {
      b.keywords = b.keywords.filter((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() !== cleanLower);
    }
  }
  rc.keywords.splice(idx, 1);
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function removeResearchCompetitor(idx) {
  const rc = getCampaignResearchConfig();
  const removed = rc.competitors[idx];
  if (removed) {
    const name = typeof removed === 'string' ? removed : removed.name;
    if (name) {
      if (!rc.deletedCompetitors || typeof rc.deletedCompetitors !== 'object') rc.deletedCompetitors = {};
      rc.deletedCompetitors[String(name).trim().toLowerCase()] = new Date().toISOString();
    }
  }
  rc.competitors.splice(idx, 1);
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

const oppFetchState = {
  isOpen: false,
  isLoading: false,
  focusMode: 'all',
  campaignId: '',
  cacheSignature: '',
  nicheSummary: '',
  source: '',
  keywords: [],
  competitors: [],
};

function openFetchOpportunitiesModal(focusMode = 'all') {
  const modal = document.getElementById('opp-fetch-modal');
  const b = getActiveBrand();
  if (!modal || !b) {
    showToast('Select or create a product first.', 'error');
    return;
  }

  oppFetchState.isOpen = true;
  oppFetchState.focusMode = focusMode || 'all';
  const nameEl = document.getElementById('opp-fetch-campaign-name');
  if (nameEl) nameEl.textContent = b.campaignName || b.brandInfo?.name || b.brandName || 'Product';

  modal.classList.remove('hidden');

  const activeCampaignId = b.brandId || b.campaignId || b.id || '';
  const fullCtx = buildDashboardFullBrandContext(b);
  const cacheSignature = `${activeCampaignId}|${fullCtx.website || ''}|${fullCtx.tagline || ''}|${fullCtx.description || ''}|${fullCtx.directory?.category || ''}`;
  const isSameCampaignAndContext = Boolean(activeCampaignId) && oppFetchState.campaignId === activeCampaignId && oppFetchState.cacheSignature === cacheSignature;
  const hasCached = isSameCampaignAndContext && (oppFetchState.keywords.length > 0 || oppFetchState.competitors.length > 0);

  if (!isSameCampaignAndContext) {
    oppFetchState.campaignId = activeCampaignId;
    oppFetchState.cacheSignature = cacheSignature;
    oppFetchState.nicheSummary = '';
    oppFetchState.source = '';
    oppFetchState.keywords = [];
    oppFetchState.competitors = [];
    const seedEl = document.getElementById('opp-fetch-seed-input');
    if (seedEl) seedEl.value = '';
  }

  if (hasCached) {
    renderOppFetchModalLists();
  } else {
    runFetchOpportunitySuggestions();
  }
}

function closeFetchOpportunitiesModal() {
  const modal = document.getElementById('opp-fetch-modal');
  if (modal) modal.classList.add('hidden');
  oppFetchState.isOpen = false;
}

async function runFetchOpportunitySuggestions() {
  const b = getActiveBrand();
  const rc = getCampaignResearchConfig();
  if (!b) return;

  const loadingEl = document.getElementById('opp-fetch-loading');
  const resultsEl = document.getElementById('opp-fetch-results');
  const bannerEl = document.getElementById('opp-fetch-niche-banner');
  const rerunBtn = document.getElementById('btn-opp-fetch-rerun');
  const saveBtn = document.getElementById('btn-opp-fetch-save');
  const saveAlertsBtn = document.getElementById('btn-opp-fetch-save-alerts');
  const seedVal = (document.getElementById('opp-fetch-seed-input')?.value || '').trim();

  oppFetchState.isLoading = true;
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');
  if (bannerEl) bannerEl.classList.add('hidden');
  if (rerunBtn) {
    rerunBtn.disabled = true;
    rerunBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Fetching...</span>`;
  }
  if (saveBtn) saveBtn.disabled = true;
  if (saveAlertsBtn) saveAlertsBtn.disabled = true;

  try {
    const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
    const token = state.session?.accessToken || state.session?.token || '';
    const fullCtx = buildDashboardFullBrandContext(b);
    const activeCampaignId = b.brandId || b.campaignId || b.id || '';
    const cacheSignature = `${activeCampaignId}|${fullCtx.website || ''}|${fullCtx.tagline || ''}|${fullCtx.description || ''}|${fullCtx.directory?.category || ''}`;
    const res = await fetch('/api/research/suggest-opportunities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        brand: {
          ...fullCtx,
          url: fullCtx.website || '',
          category: fullCtx.directory?.category || '',
        },
        seedNiche: seedVal,
        existingKeywords: rc.keywords || [],
        existingCompetitors: (rc.competitors || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean),
        openRouterKey,
        geminiApiKey,
        aiModel: state.aiModel || '',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      showToast(data.error || `Failed to fetch suggestions (HTTP ${res.status})`, 'error');
      const seedEl = document.getElementById('opp-fetch-seed-input');
      if (seedEl) seedEl.focus();
      return;
    }

    oppFetchState.campaignId = activeCampaignId;
    oppFetchState.cacheSignature = cacheSignature;
    oppFetchState.nicheSummary = data.nicheSummary || '';
    oppFetchState.source = data.source || 'ai';
    oppFetchState.keywords = (Array.isArray(data.keywords) ? data.keywords : []).map((kw, i) => ({
      id: `fkw-${Date.now()}-${i}`,
      text: String(kw || '').trim(),
      selected: true,
    })).filter((item) => item.text);

    oppFetchState.competitors = (Array.isArray(data.competitors) ? data.competitors : []).map((c, i) => ({
      id: `fcomp-${Date.now()}-${i}`,
      name: String(typeof c === 'string' ? c : c?.name || '').trim(),
      reason: String(typeof c === 'object' ? c?.reason || '' : '').trim() || 'Niche tool',
      selected: true,
    })).filter((item) => item.name);

    renderOppFetchModalLists();
  } catch (err) {
    showToast('Failed to fetch niche suggestions: ' + (err?.message || 'Network error'), 'error');
  } finally {
    oppFetchState.isLoading = false;
    if (loadingEl) loadingEl.classList.add('hidden');
    if (rerunBtn) {
      rerunBtn.disabled = false;
      rerunBtn.innerHTML = `<i class="fas fa-sync-alt"></i><span>Fetch Ideas</span>`;
    }
    updateOppFetchSelectionSummary();
  }
}

function renderOppFetchModalLists() {
  const resultsEl = document.getElementById('opp-fetch-results');
  const bannerEl = document.getElementById('opp-fetch-niche-banner');
  const nicheTextEl = document.getElementById('opp-fetch-niche-text');
  const sourceBadgeEl = document.getElementById('opp-fetch-source-badge');
  const kwListEl = document.getElementById('opp-fetch-keywords-list');
  const compListEl = document.getElementById('opp-fetch-competitors-list');

  if (bannerEl) {
    bannerEl.classList.toggle('hidden', !oppFetchState.nicheSummary);
    if (nicheTextEl) nicheTextEl.textContent = oppFetchState.nicheSummary || 'Niche Discovery';
    if (sourceBadgeEl) {
      const src = String(oppFetchState.source || '').toLowerCase();
      sourceBadgeEl.textContent = src.includes('gemini') ? 'Gemini AI' : (src.includes('openrouter') ? 'OpenRouter AI' : 'Smart Match');
    }
  }

  if (resultsEl) resultsEl.classList.remove('hidden');

  if (kwListEl) {
    kwListEl.innerHTML = oppFetchState.keywords.length === 0
      ? `<div class="text-xs text-[#747d8c] py-6 text-center">No new keywords left to add — add custom ones below or refine your niche focus.</div>`
      : oppFetchState.keywords.map((item, idx) => `
        <div class="flex items-center gap-2 p-2 rounded-lg border ${item.selected ? 'bg-[#FAF4EB] border-[#dfd8cc]' : 'bg-slate-50 border-slate-200 opacity-65'}">
          <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleOppFetchKeyword(${idx}, this.checked)" class="accent-[#6c5ce7] shrink-0 cursor-pointer">
          <input type="text" value="${escapeHtml(item.text)}" oninput="editOppFetchKeyword(${idx}, this.value)" class="flex-1 min-w-0 px-2 py-1 bg-white border border-[#dfd8cc] rounded text-xs font-semibold text-[#1e222a]">
          <button type="button" onclick="removeOppFetchKeyword(${idx})" title="Remove" class="text-[#747d8c] hover:text-red-600 p-1 text-xs shrink-0"><i class="fas fa-times"></i></button>
        </div>
      `).join('');
  }

  if (compListEl) {
    compListEl.innerHTML = oppFetchState.competitors.length === 0
      ? `<div class="text-xs text-[#747d8c] py-6 text-center">No new competitors suggested — add any tool or domain below.</div>`
      : oppFetchState.competitors.map((item, idx) => `
        <div class="flex items-start gap-2 p-2 rounded-lg border ${item.selected ? 'bg-[#FAF4EB] border-[#dfd8cc]' : 'bg-slate-50 border-slate-200 opacity-65'}">
          <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleOppFetchCompetitor(${idx}, this.checked)" class="accent-[#6c5ce7] mt-1.5 shrink-0 cursor-pointer">
          <div class="flex-1 min-w-0 space-y-1">
            <input type="text" value="${escapeHtml(item.name)}" oninput="editOppFetchCompetitor(${idx}, this.value)" class="w-full px-2 py-1 bg-white border border-[#dfd8cc] rounded text-xs font-bold text-[#1e222a]">
            ${item.reason ? `<div class="text-[10px] text-[#57606f] truncate px-0.5">${escapeHtml(item.reason)}</div>` : ''}
            ${String(item.name || '').trim() ? `<div class="text-[10px] text-[#5b4bc4]/90 font-medium truncate px-0.5">Expands to: Alternative to ${escapeHtml(item.name.trim())} · ${escapeHtml(item.name.trim())} vs</div>` : ''}
          </div>
          <button type="button" onclick="removeOppFetchCompetitor(${idx})" title="Remove" class="text-[#747d8c] hover:text-red-600 p-1 text-xs shrink-0 mt-0.5"><i class="fas fa-times"></i></button>
        </div>
      `).join('');
  }

  updateOppFetchSelectionSummary();
}

function updateOppFetchSelectionSummary() {
  const kwCount = oppFetchState.keywords.filter((k) => k.selected && String(k.text || '').trim()).length;
  const compCount = oppFetchState.competitors.filter((c) => c.selected && String(c.name || '').trim()).length;
  const summaryEl = document.getElementById('opp-fetch-selection-summary');
  if (summaryEl) {
    summaryEl.textContent = `${kwCount} keyword${kwCount === 1 ? '' : 's'} · ${compCount} competitor${compCount === 1 ? '' : 's'} selected`;
  }
  const hasAny = (kwCount + compCount) > 0 && !oppFetchState.isLoading;
  const saveBtn = document.getElementById('btn-opp-fetch-save');
  const saveAlertsBtn = document.getElementById('btn-opp-fetch-save-alerts');
  if (saveBtn) saveBtn.disabled = !hasAny;
  if (saveAlertsBtn) saveAlertsBtn.disabled = !hasAny;
}

function toggleOppFetchKeyword(idx, checked) {
  if (!oppFetchState.keywords[idx]) return;
  oppFetchState.keywords[idx].selected = Boolean(checked);
  renderOppFetchModalLists();
}

function editOppFetchKeyword(idx, val) {
  if (!oppFetchState.keywords[idx]) return;
  oppFetchState.keywords[idx].text = String(val || '');
  updateOppFetchSelectionSummary();
}

function removeOppFetchKeyword(idx) {
  oppFetchState.keywords.splice(idx, 1);
  renderOppFetchModalLists();
}

function toggleAllOppFetchKeywords() {
  const allSelected = oppFetchState.keywords.length > 0 && oppFetchState.keywords.every((k) => k.selected);
  oppFetchState.keywords.forEach((k) => { k.selected = !allSelected; });
  renderOppFetchModalLists();
}

function addCustomOppFetchKeyword() {
  const input = document.getElementById('opp-fetch-add-kw-input');
  const val = (input?.value || '').trim();
  if (!val) return;
  oppFetchState.keywords.unshift({
    id: `fkw-custom-${Date.now()}`,
    text: val,
    selected: true,
  });
  input.value = '';
  renderOppFetchModalLists();
}

function toggleOppFetchCompetitor(idx, checked) {
  if (!oppFetchState.competitors[idx]) return;
  oppFetchState.competitors[idx].selected = Boolean(checked);
  renderOppFetchModalLists();
}

function editOppFetchCompetitor(idx, val) {
  if (!oppFetchState.competitors[idx]) return;
  oppFetchState.competitors[idx].name = String(val || '');
  updateOppFetchSelectionSummary();
}

function removeOppFetchCompetitor(idx) {
  oppFetchState.competitors.splice(idx, 1);
  renderOppFetchModalLists();
}

function toggleAllOppFetchCompetitors() {
  const allSelected = oppFetchState.competitors.length > 0 && oppFetchState.competitors.every((c) => c.selected);
  oppFetchState.competitors.forEach((c) => { c.selected = !allSelected; });
  renderOppFetchModalLists();
}

function addCustomOppFetchCompetitor() {
  const input = document.getElementById('opp-fetch-add-comp-input');
  const val = (input?.value || '').trim();
  if (!val) return;
  oppFetchState.competitors.unshift({
    id: `fcomp-custom-${Date.now()}`,
    name: val,
    reason: 'Added manually',
    selected: true,
  });
  input.value = '';
  renderOppFetchModalLists();
}

async function confirmFetchOpportunities(launchAlertsAfter = false) {
  const b = getActiveBrand();
  if (!b) return;
  const rc = getCampaignResearchConfig(b);

  const selectedKeywords = oppFetchState.keywords
    .filter((k) => k.selected)
    .map((k) => String(k.text || '').trim())
    .filter(Boolean);
  const selectedCompetitors = oppFetchState.competitors
    .filter((c) => c.selected)
    .map((c) => String(c.name || '').trim())
    .filter(Boolean);

  if (selectedKeywords.length === 0 && selectedCompetitors.length === 0) {
    showToast('Select at least one keyword or competitor to save.', 'error');
    return;
  }

  let addedKw = 0;
  let addedComp = 0;

  if (!Array.isArray(rc.keywords)) rc.keywords = [];
  if (!Array.isArray(b.keywords)) b.keywords = [];
  selectedKeywords.forEach((kw) => {
    const lower = kw.toLowerCase();
    if (rc.deletedKeywords && rc.deletedKeywords[lower]) {
      delete rc.deletedKeywords[lower];
    }
    if (!rc.keywords.some((existing) => String(existing || '').trim().toLowerCase() === lower)) {
      rc.keywords.push(kw);
      addedKw += 1;
    }
    if (!b.keywords.some((k) => (typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() === lower)) {
      b.keywords.push({ id: `kw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: kw, bookmarked: false });
    }
  });

  if (!Array.isArray(rc.competitors)) rc.competitors = [];
  selectedCompetitors.forEach((name) => {
    const lower = name.toLowerCase();
    if (rc.deletedCompetitors && rc.deletedCompetitors[lower]) {
      delete rc.deletedCompetitors[lower];
    }
    const exists = rc.competitors.some((c) => (typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === lower);
    if (!exists) {
      rc.competitors.push({
        id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        orQuery: formatCompetitorOrQuery(name),
        queries: buildCompetitorCombinations(name),
      });
      addedComp += 1;
    }
  });

  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  await persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });

  oppFetchState.keywords = [];
  oppFetchState.competitors = [];
  closeFetchOpportunitiesModal();

  showToast(`Saved ${addedKw} keyword(s) and ${addedComp} competitor(s) to ${b.brandInfo?.name || b.brandName || 'product'}!`);

  if (launchAlertsAfter) {
    switchOpportunitiesSubtab('alerts', true);
    toggleGoogleAlertsDrawer(true);
  }
}

function toggleGoogleAlertsDrawer(forceOpen) {
  dashAlertsDrawerOpen = typeof forceOpen === 'boolean' ? forceOpen : !dashAlertsDrawerOpen;
  dashAlertsCollapsed = !dashAlertsDrawerOpen;
  const drawerEl = document.getElementById('res-google-alerts-drawer');
  if (drawerEl) drawerEl.classList.toggle('hidden', !dashAlertsDrawerOpen);
  if (dashAlertsDrawerOpen) {
    renderGoogleAlertsDrawer(getCampaignResearchConfig());
  }
}

function toggleGoogleAlertsSourcesBody() {
  toggleGoogleAlertsDrawer();
}

function copyGeneratedAlertQuery(btnEl) {
  const query = btnEl?.getAttribute('data-query') || '';
  if (!query) return;
  navigator.clipboard?.writeText(query).catch(() => {});
  const labelEl = btnEl.querySelector('span');
  if (labelEl) {
    const prev = labelEl.textContent;
    labelEl.textContent = 'Copied ✓';
    setTimeout(() => { labelEl.textContent = prev || 'Copy Query'; }, 1400);
  }
  showToast('Search query copied — paste it into Google Alerts!');
}

async function autoCreateManagedGoogleAlerts() {
  const rc = getCampaignResearchConfig();
  const extWarningEl = document.getElementById('res-alerts-ext-warning');
  const authWarningEl = document.getElementById('res-alerts-auth-warning');
  if (extWarningEl) extWarningEl.classList.add('hidden');
  if (authWarningEl) authWarningEl.classList.add('hidden');

  const queries = buildGroupedGoogleAlertQueries(rc);
  if (queries.length === 0) {
    showToast('Add at least one keyword or competitor first (or click Fetch Keywords & Competitors).', 'error');
    return;
  }

  if (!state.extInstalled) {
    if (extWarningEl) extWarningEl.classList.remove('hidden');
    dashAlertsCollapsed = false;
    const bodyEl = document.getElementById('res-alerts-body');
    const chevEl = document.getElementById('res-alerts-chevron');
    if (bodyEl) bodyEl.classList.remove('hidden');
    if (chevEl) chevEl.className = 'fas fa-chevron-up text-[10px]';
    showToast('Chrome Extension not connected — enable the extension or paste an RSS URL below.', 'error');
    return;
  }

  const btn = document.getElementById('btn-auto-create-alerts');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Creating Alerts...</span>`;
  }

  try {
    const frequency = rc.frequency || 'realtime';
    const quality = rc.quality || 'all';
    const signature = computeManagedAlertSignature({ ...rc, frequency, quality });
    const resp = await bridgeCall('AUTO_CREATE_MANAGED_GOOGLE_ALERTS', {
      campaignId: state.activeBrandId,
      queries,
      signature,
      frequency,
      quality,
      platforms: rc.platforms,
      replaceOldManagedFeeds: true,
    }, 90000);

    if (!resp?.success) {
      if (resp?.code === 'GOOGLE_AUTH_REQUIRED') {
        if (authWarningEl) authWarningEl.classList.remove('hidden');
        showToast('Sign in to Google in the opened tab, then click Retry Auto-Create.', 'error');
      } else {
        showToast(resp?.error || (resp?.timeout ? 'Google Alerts setup timed out. Please retry.' : 'Could not auto-create Google Alerts.'), 'error');
      }
      return;
    }

    if (authWarningEl) authWarningEl.classList.add('hidden');
    if (Array.isArray(resp.alertFeeds)) {
      rc.alertFeeds = resp.alertFeeds;
    }
    rc.managedAlertSignature = resp.managedAlertSignature || signature;
    rc.frequency = frequency;
    rc.quality = quality;
    rc.alertsActive = true;
    touchActiveResearchConfig(rc);
    renderResearchSection();
    await persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
    showToast(`Synced ${resp.createdCount || queries.length} grouped Google Alert RSS feed(s)!`);
  } catch (err) {
    showToast('Google Alerts auto-create failed: ' + (err?.message || 'Error'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-bolt"></i><span>Auto-Create Alerts (Extension)</span>`;
    }
  }
}

async function connectGoogleAlert(queryText, isCompetitor = false) {
  const rc = getCampaignResearchConfig();
  const clean = String(queryText || '').replace(/"/g, '').trim();
  const formatted = isCompetitor ? formatCompetitorOrQuery(clean) : `"${clean}"`;
  const p = rc.platforms || {};
  const sites = [];
  if (p.web !== true) {
    Object.entries(RESEARCH_ALERT_SITE_MAP).forEach(([k, siteExpr]) => {
      if (p[k] === true) sites.push(siteExpr);
    });
  }
  const scoped = (sites.length > 0 && sites.length <= 6) ? `(${formatted}) (${sites.join(' OR ')})` : formatted;

  if (state.extInstalled) {
    await bridgeCall('LAUNCH_GOOGLE_ALERT_SETUP', {
      query: scoped,
      queries: [scoped],
      campaignId: state.activeBrandId,
      frequency: rc.frequency || 'realtime',
      quality: rc.quality || 'all',
    });
    showToast('Opening Google Alerts pre-filled! Click "Create Alert" to auto-sync.');
  } else {
    navigator.clipboard?.writeText(scoped).catch(() => {});
    window.open(`https://www.google.com/alerts#1:1:${encodeURIComponent(scoped)}`, '_blank', 'noopener,noreferrer');
    showToast('Query copied! Paste it into Google Alerts and choose Delivery: RSS feed.');
  }
}

async function openGoogleAlertsHomepage() {
  const rc = getCampaignResearchConfig();
  if (state.extInstalled) {
    await bridgeCall('LAUNCH_GOOGLE_ALERT_SETUP', {
      query: '',
      queries: [],
      campaignId: state.activeBrandId,
      frequency: rc.frequency || 'realtime',
      quality: rc.quality || 'all',
    });
    showToast('Opening Google Alerts — click "+ Sync All" to import feeds into this campaign.');
  } else {
    window.open('https://www.google.com/alerts', '_blank', 'noopener,noreferrer');
  }
}

async function pollSingleAlertFeed(idx) {
  const rc = getCampaignResearchConfig();
  const feed = (rc.alertFeeds || [])[idx];
  if (!feed || !feed.url) return;
  const timeframe = normalizeResearchTimeframe(rc.feedTimeframe);
  try {
    let data = null;
    if (state.extInstalled) {
      data = await bridgeCall('FETCH_RESEARCH_OPPORTUNITIES_STAGE', {
        jobId: `poll-feed-${Date.now()}`,
        stage: 'alerts',
        keywords: rc.keywords || [],
        competitorQueries: (rc.competitors || []).map((c) => formatCompetitorOrQuery(c)).filter(Boolean),
        platforms: rc.platforms || DEFAULT_RESEARCH_PLATFORMS,
        alertFeeds: [feed],
        quality: rc.quality || 'all',
        timeframe,
      }, 30000);
      if (!data?.success || !Array.isArray(data.threads)) {
        showToast(data?.error || 'Feed poll failed in extension.', 'error');
        return;
      }
    } else {
      const res = await authedDashboardFetch('/api/research/fetch-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: [],
          competitorQueries: [],
          platforms: rc.platforms,
          alertFeeds: [feed],
          quality: rc.quality || 'all',
          timeframe,
        }),
      });
      data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('Sign in required or install the Chrome Extension for zero-limit browser-IP alerts.', 'error');
        return;
      }
      if (!res.ok || !data?.success || !Array.isArray(data.threads)) {
        showToast(data?.error || `Feed poll failed (HTTP ${res.status})`, 'error');
        return;
      }
    }
    const incomingRc = { ...rc, discoveredThreads: data.threads, lastPolledAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const mergedRc = mergeResearchConfig(rc, incomingRc);
    const b = getActiveBrand();
    if (b) {
      b.researchConfig = mergedRc;
      b.updatedAt = mergedRc.updatedAt;
      delete b.isUntouchedDefault;
    }
    state.researchConfig = mergedRc;
    await persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
    renderResearchSection();
    showToast(`Polled "${feed.term || 'Google Alert'}" — ${data.threads.length} result(s) found!`);
  } catch (err) {
    showToast('Feed poll failed: ' + err.message, 'error');
  }
}

function addManualRssFeed() {
  const input = document.getElementById('res-manual-rss-input');
  const url = (input?.value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    showToast('Please enter a valid RSS feed URL starting with https://', 'error');
    return;
  }
  const rc = getCampaignResearchConfig();
  if (!Array.isArray(rc.alertFeeds)) rc.alertFeeds = [];
  if (rc.deletedFeedUrls && rc.deletedFeedUrls[url]) {
    delete rc.deletedFeedUrls[url];
  }
  if (!rc.alertFeeds.some((f) => String(f.url || '').trim() === url)) {
    rc.alertFeeds.unshift({
      id: 'feed-' + Date.now(),
      url,
      term: 'Custom Alert RSS',
      addedAt: new Date().toISOString(),
    });
  }
  if (input) input.value = '';
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast('RSS feed linked! Click Fetch Opportunities to pull results.');
}

function removeLinkedFeed(idx) {
  const rc = getCampaignResearchConfig();
  const removed = rc.alertFeeds[idx];
  if (removed?.url) {
    if (!rc.deletedFeedUrls || typeof rc.deletedFeedUrls !== 'object') rc.deletedFeedUrls = {};
    rc.deletedFeedUrls[String(removed.url).trim()] = new Date().toISOString();
  }
  rc.alertFeeds.splice(idx, 1);
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function updateFeedTimeframe(val) {
  const rc = getCampaignResearchConfig();
  rc.feedTimeframe = normalizeResearchTimeframe(val);
  touchActiveResearchConfig(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function toggleFeedPlatform(platKey, checked) {
  const rc = getCampaignResearchConfig();
  if (!rc.platforms || typeof rc.platforms !== 'object') rc.platforms = { ...DEFAULT_RESEARCH_PLATFORMS };
  rc.platforms[platKey] = Boolean(checked);
  touchActiveResearchConfig(rc);
  renderFeedBuilderControls(rc);
  renderGoogleAlertsSourcesBar(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function toggleAllFeedPlatforms() {
  const rc = getCampaignResearchConfig();
  if (!rc.platforms || typeof rc.platforms !== 'object') rc.platforms = { ...DEFAULT_RESEARCH_PLATFORMS };
  const allOn = RESEARCH_PLATFORMS_META.every((m) => rc.platforms[m.key] === true);
  RESEARCH_PLATFORMS_META.forEach((m) => {
    rc.platforms[m.key] = !allOn;
  });
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function resolveFeedTermsPresetState(rc) {
  const kwKeys = (rc.keywords || []).map((k) => `kw:${String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase()}`).filter((k) => k !== 'kw:');
  const compKeys = (rc.competitors || [])
    .map((c) => `comp:${String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase()}`)
    .filter((k) => k !== 'comp:');
  if (kwKeys.length === 0 && compKeys.length === 0) return dashFeedTermsPreset;
  const kwAllOn = kwKeys.every((k) => !dashExcludedFeedTerms.has(k));
  const kwAllOff = kwKeys.every((k) => dashExcludedFeedTerms.has(k));
  const compAllOn = compKeys.every((k) => !dashExcludedFeedTerms.has(k));
  const compAllOff = compKeys.every((k) => dashExcludedFeedTerms.has(k));
  if (kwAllOff && compAllOff) return 'none';
  if (kwAllOn && compAllOn) return 'all';
  if (kwKeys.length > 0 && kwAllOn && compAllOff) return 'niche';
  if (compKeys.length > 0 && compAllOn && kwAllOff) return 'competitor';
  return 'custom';
}

function toggleFeedTermKey(termKey) {
  if (!termKey) return;
  if (dashExcludedFeedTerms.has(termKey)) dashExcludedFeedTerms.delete(termKey);
  else dashExcludedFeedTerms.add(termKey);
  const rc = getCampaignResearchConfig();
  dashFeedTermsPreset = resolveFeedTermsPresetState(rc);
  renderFeedBuilderControls(rc);
}

function selectFeedTermsPreset(mode) {
  const rc = getCampaignResearchConfig();
  const kwKeys = (rc.keywords || []).map((k) => `kw:${String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase()}`).filter((k) => k !== 'kw:');
  const compKeys = (rc.competitors || [])
    .map((c) => `comp:${String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase()}`)
    .filter((k) => k !== 'comp:');
  dashExcludedFeedTerms.clear();
  if (mode === 'niche') {
    compKeys.forEach((k) => dashExcludedFeedTerms.add(k));
  } else if (mode === 'competitor') {
    kwKeys.forEach((k) => dashExcludedFeedTerms.add(k));
  } else if (mode === 'none') {
    kwKeys.forEach((k) => dashExcludedFeedTerms.add(k));
    compKeys.forEach((k) => dashExcludedFeedTerms.add(k));
  }
  dashFeedTermsPreset = mode || 'all';
  renderFeedBuilderControls(rc);
}

function setFeedFetchUiRunning(isRunning, progressText = '') {
  const fetchBtn = document.getElementById('btn-fetch-feed-now');
  const stopBtn = document.getElementById('btn-stop-fetch-feed');
  const progWrap = document.getElementById('res-fetch-progress-text');
  const progLabel = document.getElementById('res-fetch-progress-label');
  if (fetchBtn) {
    fetchBtn.classList.toggle('hidden', isRunning);
    fetchBtn.disabled = isRunning;
  }
  if (stopBtn) {
    stopBtn.classList.toggle('hidden', !isRunning);
    stopBtn.disabled = false;
  }
  if (progWrap) progWrap.classList.toggle('hidden', !isRunning);
  if (progLabel && progressText) progLabel.textContent = progressText;
}

function filterThreadsForBuilderSelections(threads, rc, selectedKeywords, selectedCompNames) {
  const p = rc?.platforms || {};
  const enabledPlatforms = new Set(Object.keys(p).filter((k) => p[k] === true));
  const termWordsList = [...selectedKeywords, ...selectedCompNames]
    .map((t) => String(t || '').toLowerCase().trim())
    .filter(Boolean);
  const termsNarrowed = dashExcludedFeedTerms.size > 0;

  return (Array.isArray(threads) ? threads : []).filter((t) => {
    if (!t || !t.url) return false;
    const plat = String(t.platform || 'web').toLowerCase();
    if (enabledPlatforms.size > 0 && !enabledPlatforms.has(plat)) return false;

    const isAlertItem = String(t.source || '').toLowerCase().includes('google alerts');
    if (isAlertItem && termsNarrowed) {
      if (termWordsList.length === 0) return false;
      const hay = `${t.title || ''} ${t.snippet || ''} ${t.matchedTerm || ''} ${t.url || ''}`.toLowerCase();
      const matchesAny = termWordsList.some((phrase) => {
        if (hay.includes(phrase)) return true;
        const words = phrase.split(/\s+/).filter((w) => w.length >= 3);
        if (words.length < 2) return false;
        const hitCount = words.filter((w) => hay.includes(w)).length;
        return hitCount >= Math.min(2, words.length);
      });
      if (!matchesAny) return false;
    }
    return true;
  });
}

async function stopLiveFeedFetch() {
  const job = dashActiveFetchJob;
  if (!job) return;
  job.aborted = true;
  if (job.abortController) {
    try { job.abortController.abort(); } catch (_) {}
  }
  if (state.extInstalled && job.jobId) {
    bridgeCall('CANCEL_RESEARCH_FETCH', { jobId: job.jobId }).catch(() => {});
  }
  setFeedFetchUiRunning(false);
  showToast('Stopped fetching opportunities.');
}

async function fetchLiveFeed() {
  if (dashActiveFetchJob && !dashActiveFetchJob.aborted) return;

  saveResearchConfigFromUI();
  const rc = getCampaignResearchConfig();
  const timeframe = normalizeResearchTimeframe(document.getElementById('res-feed-timeframe')?.value || rc.feedTimeframe);
  rc.feedTimeframe = timeframe;
  rc.alertsActive = true;

  const selectedKeywords = (rc.keywords || [])
    .map((k) => String(typeof k === 'string' ? k : k?.text || '').trim())
    .filter((k) => k && !dashExcludedFeedTerms.has(`kw:${k.toLowerCase()}`));

  const selectedCompetitors = (rc.competitors || [])
    .filter((c) => {
      const name = String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase();
      return name && !dashExcludedFeedTerms.has(`comp:${name}`);
    });
  const selectedCompNames = selectedCompetitors
    .map((c) => String(typeof c === 'string' ? c : c?.name || '').trim())
    .filter(Boolean);
  const selectedCompetitorQueries = selectedCompetitors
    .map((c) => formatCompetitorOrQuery(c))
    .filter(Boolean);

  const alertFeeds = Array.isArray(rc.alertFeeds) ? rc.alertFeeds.filter((f) => f?.url) : [];
  const hasTerms = selectedKeywords.length > 0 || selectedCompetitorQueries.length > 0;
  if (!hasTerms && alertFeeds.length === 0) {
    showToast('Select at least one keyword/competitor or link a Google Alert RSS feed first.', 'error');
    return;
  }

  const platforms = rc.platforms || DEFAULT_RESEARCH_PLATFORMS;
  const enabledPlatCount = RESEARCH_PLATFORMS_META.filter((m) => platforms[m.key] === true).length;
  if (enabledPlatCount === 0 && alertFeeds.length === 0) {
    showToast('Select at least one platform to fetch opportunities.', 'error');
    return;
  }

  const jobId = `dash-fetch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const abortController = new AbortController();
  const job = { jobId, aborted: false, abortController };
  dashActiveFetchJob = job;

  const b = getActiveBrand();
  const queuedUrlSet = new Set(
    (Array.isArray(b?.queue) ? b.queue : [])
      .map((i) => normalizeTargetUrlForMatch(i?.url))
      .filter(Boolean)
  );

  const commitCollectedThreads = async (collectedList) => {
    const scoped = filterThreadsForBuilderSelections(collectedList, rc, selectedKeywords, selectedCompNames);
    const nowIso = new Date().toISOString();
    rc.discoveredThreads = scoped.map((t) => {
      const norm = normalizeTargetUrlForMatch(t?.url);
      return {
        ...t,
        status: norm && queuedUrlSet.has(norm) ? 'queued' : (t?.status || 'new'),
      };
    });
    rc.lastPolledAt = nowIso;
    rc.updatedAt = nowIso;
    selectedThreadIds.clear();
    dashSelectedNetworkTabs.clear();
    visibleThreadsLimit = 50;
    dashFeedInboxMode = 'live';
    touchActiveResearchConfig(rc, b);
    await persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
    renderResearchSection();
  };

  setFeedFetchUiRunning(true, 'Preparing search...');

  try {
    if (state.extInstalled) {
      const stages = [];
      if (alertFeeds.length > 0) {
        stages.push({ stage: 'alerts', label: `Checking ${alertFeeds.length} Google Alert feed(s)...` });
      }
      if (hasTerms && platforms.reddit === true) {
        stages.push({ stage: 'reddit', label: 'Searching Reddit discussions...' });
      }
      if (hasTerms && platforms.hackernews === true) {
        stages.push({ stage: 'hn', label: 'Searching Hacker News...' });
      }
      const hasWebIndexPlat = platforms.web === true || ['twitter', 'youtube', 'linkedin', 'quora', 'medium'].some((k) => platforms[k] === true);
      if (hasTerms && hasWebIndexPlat) {
        stages.push({ stage: 'web_rss', label: 'Searching Web & Social indexes...' });
      }

      if (stages.length === 0) {
        showToast('No active live sources for your selected platforms. Checking Google Alert feeds only requires linked RSS.', 'error');
        return;
      }

      const dedupedByUrl = new Map();
      let totalFeedsChecked = 0;

      for (let i = 0; i < stages.length; i++) {
        if (job.aborted) break;
        const st = stages[i];
        setFeedFetchUiRunning(true, `${st.label} (${i + 1}/${stages.length})`);
        const resp = await bridgeCall('FETCH_RESEARCH_OPPORTUNITIES_STAGE', {
          jobId,
          stage: st.stage,
          keywords: selectedKeywords,
          competitorQueries: selectedCompetitorQueries,
          platforms,
          alertFeeds,
          quality: rc.quality || 'all',
          timeframe,
        }, 45000);

        if (job.aborted) break;
        if (resp?.success && Array.isArray(resp.threads)) {
          totalFeedsChecked += Number(resp.feedsChecked || 0);
          resp.threads.forEach((t) => {
            if (!t?.url) return;
            const norm = normalizeTargetUrlForMatch(t.url);
            if (norm && !dedupedByUrl.has(norm)) {
              dedupedByUrl.set(norm, t);
            }
          });
          await commitCollectedThreads(Array.from(dedupedByUrl.values()));
        }
      }

      if (!job.aborted) {
        await commitCollectedThreads(Array.from(dedupedByUrl.values()));
        showToast(`Fetched ${rc.discoveredThreads.length} discussion(s) from ${totalFeedsChecked} source(s)!`);
      }
    } else {
      setFeedFetchUiRunning(true, 'Fetching opportunities...');
      const res = await authedDashboardFetch('/api/research/fetch-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          keywords: selectedKeywords,
          competitorQueries: selectedCompetitorQueries,
          platforms,
          alertFeeds,
          quality: rc.quality || 'all',
          timeframe,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (job.aborted) return;
      if (res.status === 401) {
        showToast('Sign in required or install the Chrome Extension for zero-limit browser-IP alerts.', 'error');
      } else if (!res.ok || !data?.success) {
        showToast(data?.error || `Feed fetch failed (HTTP ${res.status})`, 'error');
      } else if (Array.isArray(data.threads)) {
        await commitCollectedThreads(data.threads);
        showToast(`Fetched ${rc.discoveredThreads.length} discussion(s) from ${data.feedsChecked || 0} feed(s)!`);
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError' && !job.aborted) {
      showToast('Feed fetch failed: ' + err.message, 'error');
    }
  } finally {
    if (dashActiveFetchJob === job) {
      dashActiveFetchJob = null;
    }
    setFeedFetchUiRunning(false);
  }
}
const activateAndFetchResearch = fetchLiveFeed;

function switchFeedInboxMode(mode) {
  dashFeedInboxMode = mode === 'saved' ? 'saved' : 'live';
  const liveBtn = document.getElementById('btn-feed-mode-live');
  const savedBtn = document.getElementById('btn-feed-mode-saved');
  const livePane = document.getElementById('res-feed-pane-live');
  const savedPane = document.getElementById('res-saved-feeds-panel');

  if (liveBtn) {
    liveBtn.className = dashFeedInboxMode === 'live'
      ? 'px-3 py-1 rounded-md text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36]'
      : 'px-3 py-1 rounded-md text-xs font-semibold text-[#57606f] hover:text-[#1e222a]';
  }
  if (savedBtn) {
    savedBtn.className = dashFeedInboxMode === 'saved'
      ? 'px-3 py-1 rounded-md text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] inline-flex items-center gap-1.5'
      : 'px-3 py-1 rounded-md text-xs font-semibold text-[#57606f] hover:text-[#1e222a] inline-flex items-center gap-1.5';
  }
  if (livePane) livePane.classList.toggle('hidden', dashFeedInboxMode !== 'live');
  if (savedPane) savedPane.classList.toggle('hidden', dashFeedInboxMode !== 'saved');

  if (dashFeedInboxMode === 'saved') {
    renderSavedFeedsPanel(getCampaignResearchConfig());
  }
}

function toggleNetworkFilterTab(net) {
  if (!net || net === 'all') {
    dashSelectedNetworkTabs.clear();
  } else if (dashSelectedNetworkTabs.has(net)) {
    dashSelectedNetworkTabs.delete(net);
  } else {
    dashSelectedNetworkTabs.add(net);
  }
  visibleThreadsLimit = 50;
  renderDiscoveredThreads();
}

function sendThreadToQueue(threadId) {
  const rc = getCampaignResearchConfig();
  const thread = (rc.discoveredThreads || []).find((t) => t.id === threadId);
  const b = getActiveBrand();
  if (!thread || !b) return;
  if (!Array.isArray(b.queue)) b.queue = [];
  if (!b.queue.some((i) => i.url === thread.url)) {
    b.queue.unshift({
      id: 'opp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: thread.url,
      title: thread.title || thread.url,
      platform: thread.platform || 'web',
      status: 'queued',
      savedAt: new Date().toISOString(),
    });
  }
  thread.status = 'queued';
  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast('Added thread to Opportunity Queue!');
}

function dismissThread(threadId) {
  const rc = getCampaignResearchConfig();
  const thread = (rc.discoveredThreads || []).find((t) => t.id === threadId);
  if (thread) {
    thread.status = 'dismissed';
    selectedThreadIds.delete(threadId);
    touchActiveResearchConfig(rc);
    renderResearchSection();
    persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  }
}

const selectedThreadIds = new Set();

function clearDismissedThreads() {
  const rc = getCampaignResearchConfig();
  rc.discoveredThreads = [];
  selectedThreadIds.clear();
  dashSelectedNetworkTabs.clear();
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function openDashboardSaveFeedBar(overrideThreadId = '') {
  const rc = getCampaignResearchConfig();
  const { filtered } = getFilteredSortedThreads();
  let items = [];
  if (overrideThreadId) {
    const single = (rc.discoveredThreads || []).find((t) => t.id === overrideThreadId);
    if (single) items = [single];
  } else if (selectedThreadIds.size > 0) {
    items = filtered.filter((t) => selectedThreadIds.has(t.id));
  } else {
    items = filtered;
  }

  if (items.length === 0) {
    showToast('No results to save. Fetch a feed or adjust filters first.', 'error');
    return;
  }

  dashPendingSaveThreads = items;
  const bar = document.getElementById('res-save-feed-bar');
  const summaryEl = document.getElementById('res-save-feed-summary');
  const input = document.getElementById('res-save-group-input');
  const chipsEl = document.getElementById('res-save-existing-group-chips');
  if (bar) bar.classList.remove('hidden');
  if (summaryEl) summaryEl.textContent = `Save ${items.length} link(s) to a Saved Feeds group:`;

  const groups = Array.isArray(rc.savedFeeds) ? rc.savedFeeds : [];
  if (chipsEl) {
    chipsEl.innerHTML = groups.length === 0
      ? ''
      : `<span class="text-[11px] font-semibold text-[#57606f] self-center">Existing groups:</span>` +
        groups.map((g) => `<button type="button" data-group-name="${escapeHtml(g.name)}" onclick="pickExistingSavedGroupName(this)" class="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-[#dfd8cc] hover:border-[#6c5ce7] text-[#1e222a]">${escapeHtml(g.name)} (${(g.items || []).length})</button>`).join('');
  }
  if (input) {
    if (!input.value.trim()) {
      const existingGroup = groups.find((g) => g.id === dashActiveSavedGroupId) || groups[0];
      input.value = existingGroup?.name || `Feed Batch ${new Date().toLocaleDateString()}`;
    }
    input.focus();
  }
}

function pickExistingSavedGroupName(btn) {
  const name = btn?.getAttribute('data-group-name') || '';
  const input = document.getElementById('res-save-group-input');
  if (input && name) input.value = name;
}

function closeDashboardSaveFeedBar() {
  dashPendingSaveThreads = [];
  const bar = document.getElementById('res-save-feed-bar');
  if (bar) bar.classList.add('hidden');
}

function confirmDashboardSaveToGroup() {
  const input = document.getElementById('res-save-group-input');
  const groupName = (input?.value || '').trim();
  if (!groupName) {
    showToast('Enter a Saved Feeds group name.', 'error');
    return;
  }
  const items = Array.isArray(dashPendingSaveThreads) ? dashPendingSaveThreads : [];
  if (items.length === 0) {
    closeDashboardSaveFeedBar();
    return;
  }

  const rc = getCampaignResearchConfig();
  if (!Array.isArray(rc.savedFeeds)) rc.savedFeeds = [];
  const nowIso = new Date().toISOString();
  let group = rc.savedFeeds.find((g) => String(g.name || '').trim().toLowerCase() === groupName.toLowerCase());
  if (!group) {
    group = {
      id: 'sf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: groupName,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    rc.savedFeeds.unshift(group);
  }
  if (!Array.isArray(group.items)) group.items = [];
  const seenUrls = new Set(group.items.map((it) => normalizeTargetUrlForMatch(it?.url)).filter(Boolean));
  let addedCount = 0;
  items.forEach((it) => {
    const url = String(it?.url || '').trim();
    const norm = normalizeTargetUrlForMatch(url);
    if (!url || !norm || seenUrls.has(norm)) return;
    seenUrls.add(norm);
    group.items.unshift({
      id: 'sfi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: String(it.title || url).trim(),
      url,
      platform: String(it.platform || 'web'),
      matchedTerm: String(it.matchedTerm || ''),
      publishedAt: it.publishedAt || '',
      source: String(it.source || ''),
      intentScore: typeof it.intentScore === 'number' ? it.intentScore : undefined,
      savedAt: nowIso,
    });
    addedCount++;
  });
  group.updatedAt = nowIso;
  dashActiveSavedGroupId = group.id;

  closeDashboardSaveFeedBar();
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Saved ${addedCount} link(s) to "${group.name}"!`);
}

function createDashboardSavedGroup() {
  const input = document.getElementById('res-new-saved-group-input');
  const name = (input?.value || '').trim();
  if (!name) return;
  const rc = getCampaignResearchConfig();
  if (!Array.isArray(rc.savedFeeds)) rc.savedFeeds = [];
  const existing = rc.savedFeeds.find((g) => String(g.name || '').trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    dashActiveSavedGroupId = existing.id;
  } else {
    const nowIso = new Date().toISOString();
    const group = {
      id: 'sf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    rc.savedFeeds.unshift(group);
    dashActiveSavedGroupId = group.id;
  }
  if (input) input.value = '';
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function selectDashboardSavedGroup(groupId) {
  dashActiveSavedGroupId = groupId || '';
  dashRenamingGroupId = '';
  renderSavedFeedsPanel(getCampaignResearchConfig());
}

function startRenameDashboardSavedGroup(groupId) {
  dashRenamingGroupId = groupId || '';
  renderSavedFeedsPanel(getCampaignResearchConfig());
  setTimeout(() => document.getElementById('res-rename-saved-group-input')?.focus(), 20);
}

function cancelRenameDashboardSavedGroup() {
  dashRenamingGroupId = '';
  renderSavedFeedsPanel(getCampaignResearchConfig());
}

function saveRenameDashboardSavedGroup(groupId) {
  const rc = getCampaignResearchConfig();
  const group = (rc.savedFeeds || []).find((g) => g.id === groupId);
  const nextName = (document.getElementById('res-rename-saved-group-input')?.value || '').trim();
  if (!group || !nextName) {
    dashRenamingGroupId = '';
    renderSavedFeedsPanel(rc);
    return;
  }
  group.name = nextName;
  group.updatedAt = new Date().toISOString();
  dashRenamingGroupId = '';
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Renamed group to "${nextName}".`);
}

function deleteDashboardSavedGroup(groupId) {
  const rc = getCampaignResearchConfig();
  if (!Array.isArray(rc.savedFeeds)) return;
  const nowIso = new Date().toISOString();
  if (!rc.deletedSavedFeedIds || typeof rc.deletedSavedFeedIds !== 'object') rc.deletedSavedFeedIds = {};
  rc.deletedSavedFeedIds[groupId] = nowIso;
  rc.savedFeeds = rc.savedFeeds.filter((g) => g.id !== groupId);
  if (dashActiveSavedGroupId === groupId) {
    dashActiveSavedGroupId = rc.savedFeeds[0]?.id || '';
  }
  dashRenamingGroupId = '';
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast('Deleted Saved Feeds group.');
}

function removeSavedFeedItem(groupId, idx) {
  const rc = getCampaignResearchConfig();
  const group = (rc.savedFeeds || []).find((g) => g.id === groupId);
  if (!group || !Array.isArray(group.items)) return;
  group.items.splice(idx, 1);
  group.updatedAt = new Date().toISOString();
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function queueSingleSavedFeedItem(groupId, idx) {
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const group = (rc.savedFeeds || []).find((g) => g.id === groupId);
  const it = group?.items?.[idx];
  if (!it || !it.url || !b) return;
  if (!Array.isArray(b.queue)) b.queue = [];
  const norm = normalizeTargetUrlForMatch(it.url);
  if (!b.queue.some((q) => normalizeTargetUrlForMatch(q?.url) === norm)) {
    b.queue.unshift({
      id: 'opp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: it.url,
      title: it.title || it.url,
      platform: it.platform || 'web',
      status: 'queued',
      savedAt: new Date().toISOString(),
    });
  }
  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast('Added link to Opportunity Queue!');
}

function queueSavedFeedGroupAll(groupId) {
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const group = (rc.savedFeeds || []).find((g) => g.id === groupId);
  if (!group || !Array.isArray(group.items) || !b) return;
  if (!Array.isArray(b.queue)) b.queue = [];
  const existing = new Set(b.queue.map((q) => normalizeTargetUrlForMatch(q?.url)).filter(Boolean));
  let added = 0;
  group.items.forEach((it) => {
    const norm = normalizeTargetUrlForMatch(it?.url);
    if (!it?.url || !norm || existing.has(norm)) return;
    existing.add(norm);
    b.queue.unshift({
      id: 'opp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: it.url,
      title: it.title || it.url,
      platform: it.platform || 'web',
      status: 'queued',
      savedAt: new Date().toISOString(),
    });
    added++;
  });
  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Added ${added} link(s) from "${group.name}" to Opportunity Queue!`);
}

function openNextSavedFeedTabs(groupId, limit = 5) {
  const rc = getCampaignResearchConfig();
  const group = (rc.savedFeeds || []).find((g) => g.id === groupId);
  const urls = (group?.items || []).map((it) => it?.url).filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, limit);
  if (urls.length === 0) {
    showToast('No links to open in this group.', 'error');
    return;
  }
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
    showToast(`Opened ${urls.length} tab(s)!`);
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
    showToast(`Opened ${urls.length} tab(s)!`);
  }
}

function getDashSocialIconSvg(platform) {
  switch (platform) {
    case 'google':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>';
    case 'youtube':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
    case 'twitter':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    case 'facebook':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
    case 'pinterest':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 0 0-4.37 23.17c-.07-.98-.13-2.48.03-3.55.14-.98.94-6.07.94-6.07s-.24-.48-.24-1.2c0-1.12.65-1.96 1.46-1.96.69 0 1.02.52 1.02 1.14 0 .7-.44 1.74-.67 2.7-.19.81.4 1.46 1.2 1.46 1.44 0 2.55-1.52 2.55-3.71 0-1.94-1.4-3.3-3.39-3.3-2.48 0-3.93 1.86-3.93 3.78 0 .75.29 1.55.65 1.99.07.09.08.16.06.25-.07.28-.22.9-.25 1.02-.04.17-.14.21-.32.13-1.19-.55-1.93-2.29-1.93-3.68 0-3 2.18-5.75 6.28-5.75 3.3 0 5.86 2.35 5.86 5.49 0 3.28-2.07 5.92-4.94 5.92-.96 0-1.87-.5-2.18-1.09l-.59 2.26c-.22.83-.8 1.87-1.19 2.51A12 12 0 1 0 12 0z"/></svg>';
    case 'instagram':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';
    case 'threads':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.035 0C5.395 0 0 5.395 0 12.035c0 6.64 5.395 12.035 12.035 12.035 6.64 0 12.035-5.395 12.035-12.035C24.07 5.395 18.675 0 12.035 0zm0 18.528c-3.59 0-6.493-2.903-6.493-6.493 0-3.59 2.903-6.493 6.493-6.493 3.59 0 6.493 2.903 6.493 6.493 0 1.223-.34 2.368-.934 3.344-.45.74-1.076 1.34-1.815 1.753l-1.065-1.57c.504-.282.93-.69 1.238-1.192.408-.667.643-1.45.643-2.335 0-2.463-1.99-4.453-4.56-4.453-2.57 0-4.56 1.99-4.56 4.453 0 2.463 1.99 4.453 4.56 4.453 1.15 0 2.2-.42 3.003-1.118l1.328 1.488c-1.197 1.04-2.736 1.67-4.331 1.67z"/></svg>';
    case 'tiktok':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
    case 'reddit':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702zM9.25 12C8.56 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-4.966 4.382a.375.375 0 0 0-.25.641c.883.884 2.45.928 2.466.928s1.583-.044 2.466-.928a.375.375 0 0 0-.53-.53c-.637.637-1.687.702-1.936.708-.25-.006-1.3-.07-1.936-.708a.37.37 0 0 0-.28-.111z"/></svg>';
    case 'linkedin':
      return '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>';
    default:
      return '';
  }
}

function getDashSocialSearchUrl(platform, query, isCompetitor = false) {
  const clean = String(query || '').trim();
  if (!clean) return 'https://www.google.com';
  const q = isCompetitor ? `"${clean.replace(/["()]/g, '')}" (alternative OR vs)` : clean;
  switch (platform) {
    case 'google':
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAI%253D`;
    case 'twitter':
      return `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
    case 'facebook':
      return `https://www.facebook.com/search/top?q=${encodeURIComponent(q)}`;
    case 'pinterest':
      return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
    case 'instagram':
      return `https://www.google.com/search?q=${encodeURIComponent('site:instagram.com ' + q)}`;
    case 'threads':
      return `https://www.threads.net/search?q=${encodeURIComponent(q)}`;
    case 'tiktok':
      return `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`;
    case 'reddit':
      return `https://www.reddit.com/search/?q=${encodeURIComponent(q)}&sort=new`;
    case 'linkedin':
      return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }
}

function handleKeywordRocketClick(el) {
  const query = el?.getAttribute('data-query') || '';
  const isCompetitor = el?.getAttribute('data-comp') === '1';
  if (!query) return;
  const rocketPlatforms = ['google', 'youtube', 'twitter', 'instagram', 'tiktok', 'reddit'];
  const urls = rocketPlatforms.map((plat) => getDashSocialSearchUrl(plat, query, isCompetitor));
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
    showToast(`Opened 6 search tabs for "${query}"!`);
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
    showToast(`Opened 6 search tabs for "${query}"!`);
  }
}

function handleKeywordPlatformClick(el, platform) {
  const query = el?.getAttribute('data-query') || '';
  const isCompetitor = el?.getAttribute('data-comp') === '1';
  if (!query) return;
  const url = getDashSocialSearchUrl(platform, query, isCompetitor);
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls: [url] });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function handleKeywordConnectAlertClick(el) {
  const query = el?.getAttribute('data-query') || '';
  const isCompetitor = el?.getAttribute('data-comp') === '1';
  if (!query) return;
  connectGoogleAlert(query, isCompetitor);
}

function renderGoogleAlertsDrawer(rc) {
  const feeds = Array.isArray(rc.alertFeeds) ? rc.alertFeeds : [];
  const countEl = document.getElementById('res-feeds-count');
  if (countEl) countEl.textContent = `${feeds.length} linked`;

  const selectedQueries = buildGroupedGoogleAlertQueries(rc, { selectedOnly: true });
  const queriesCountEl = document.getElementById('res-alerts-queries-count');
  if (queriesCountEl) queriesCountEl.textContent = `${selectedQueries.length} quer${selectedQueries.length === 1 ? 'y' : 'ies'}`;

  const queriesEl = document.getElementById('res-alerts-generated-queries');
  if (queriesEl) {
    queriesEl.innerHTML = selectedQueries.length === 0
      ? `<div class="text-xs text-[#747d8c] py-3 px-3.5 bg-[#FAF4EB]/60 rounded-lg border border-dashed border-[#dfd8cc]">Select at least one platform and keyword/competitor above to generate Search Queries for Google Alerts.</div>`
      : selectedQueries.map((q, idx) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#FAF4EB] border border-[#dfd8cc]">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-bold uppercase tracking-wider text-[#57606f] mb-0.5">Query ${idx + 1}</div>
            <div class="text-xs font-mono text-[#1e222a] break-all">${escapeHtml(q)}</div>
          </div>
          <button type="button" data-query="${escapeHtml(q)}" onclick="copyGeneratedAlertQuery(this)" class="sp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 self-start sm:self-center">
            <i class="fas fa-copy text-[11px]"></i>
            <span>Copy Query</span>
          </button>
        </div>
      `).join('');
  }

  const feedsEl = document.getElementById('res-feeds-list');
  if (feedsEl) {
    feedsEl.innerHTML = feeds.length === 0
      ? `<div class="text-xs text-[#747d8c] py-3 text-center bg-white rounded-lg border border-dashed border-[#dfd8cc]">No Google Alert RSS feeds linked yet. Copy a query above, create an RSS alert on Google Alerts, then paste its RSS URL above.</div>`
      : feeds.map((f, idx) => {
        const shortUrl = String(f.url || '').replace(/^https?:\/\/(www\.)?/i, '').slice(0, 56);
        const addedLabel = f.addedAt ? new Date(f.addedAt).toLocaleDateString() : '';
        return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-[#dfd8cc]">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <i class="fas fa-rss text-amber-500 text-xs shrink-0"></i>
              <span class="text-xs font-bold text-[#1e222a] truncate">${escapeHtml(f.term || 'Google Alert RSS')}</span>
              ${f.managedBySmartPoster ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">Auto</span>` : ''}
            </div>
            <div class="text-[11px] text-[#747d8c] font-mono truncate mt-0.5">
              <a href="${escapeHtml(f.url || '#')}" target="_blank" rel="noopener noreferrer" class="hover:text-[#6c5ce7] hover:underline">${escapeHtml(shortUrl)}${String(f.url || '').length > 64 ? '...' : ''}</a>
              ${addedLabel ? `<span class="font-sans"> · Added ${escapeHtml(addedLabel)}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="pollSingleAlertFeed(${idx})" class="sp-btn-secondary px-2.5 py-1 rounded text-[11px]">Poll</button>
            <button type="button" onclick="removeLinkedFeed(${idx})" title="Remove feed" class="text-[#747d8c] hover:text-red-600 p-1 text-xs"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
      }).join('');
  }
}

function renderGoogleAlertsSourcesBar(rc) {
  renderGoogleAlertsDrawer(rc);
}

function renderFeedBuilderControls(rc) {
  const tfEl = document.getElementById('res-feed-timeframe');
  if (tfEl) {
    tfEl.value = normalizeResearchTimeframe(rc.feedTimeframe);
    syncCustomSelect(tfEl);
  }

  const allPlatSelected = RESEARCH_PLATFORMS_META.every((m) => rc.platforms?.[m.key] === true);
  const selectAllPlatsBtn = document.getElementById('btn-feed-select-all-platforms');
  if (selectAllPlatsBtn) {
    selectAllPlatsBtn.textContent = allPlatSelected ? 'Deselect all' : 'Select all';
  }

  const platGrid = document.getElementById('res-feed-platforms-grid');
  if (platGrid) {
    platGrid.innerHTML = RESEARCH_PLATFORMS_META.map((m) => {
      const checked = rc.platforms?.[m.key] === true;
      return `
        <label class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${checked ? 'bg-[#f1effe] border-[#6c5ce7] text-[#1e222a]' : 'bg-white border-[#dfd8cc] text-[#57606f] hover:bg-[#FAF4EB]'}">
          <input type="checkbox" id="res-plat-${escapeHtml(m.key)}" ${checked ? 'checked' : ''} onchange="toggleFeedPlatform('${escapeHtml(m.key)}', this.checked)" class="accent-[#6c5ce7] cursor-pointer">
          <span>${escapeHtml(m.label)}</span>
        </label>
      `;
    }).join('');
  }

  const effectivePreset = resolveFeedTermsPresetState(rc);
  const presetActiveCls = 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36]';
  const presetInactiveCls = 'px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#57606f] hover:text-[#1e222a]';
  const presetButtons = {
    all: document.getElementById('res-kw-preset-all'),
    niche: document.getElementById('res-kw-preset-niche'),
    competitor: document.getElementById('res-kw-preset-competitor'),
    none: document.getElementById('res-kw-preset-none'),
  };
  Object.entries(presetButtons).forEach(([mode, btnEl]) => {
    if (btnEl) btnEl.className = effectivePreset === mode ? presetActiveCls : presetInactiveCls;
  });

  const chipsEl = document.getElementById('res-feed-terms-chips');
  if (chipsEl) {
    const entries = [
      ...(Array.isArray(rc.keywords) ? rc.keywords : []).map((k) => {
        const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
        return { key: `kw:${clean.toLowerCase()}`, label: clean, isComp: false };
      }).filter((x) => x.label),
      ...(Array.isArray(rc.competitors) ? rc.competitors : []).map((c) => {
        const name = String(typeof c === 'string' ? c : c?.name || '').trim();
        return { key: `comp:${name.toLowerCase()}`, label: `${name} (alt/vs)`, isComp: true };
      }).filter((x) => x.key !== 'comp:'),
    ];
    if (entries.length === 0) {
      chipsEl.innerHTML = `<span class="text-xs text-[#747d8c]">No keywords or competitors added yet. Switch to the <button type="button" onclick="switchOpportunitiesSubtab('keywords', true)" class="text-[#6c5ce7] font-bold hover:underline">Keywords</button> tab to add or fetch terms.</span>`;
    } else {
      chipsEl.innerHTML = entries.map((t) => {
        const active = !dashExcludedFeedTerms.has(t.key);
        return `
          <button type="button" data-term-key="${escapeHtml(t.key)}" onclick="toggleFeedTermKey(this.getAttribute('data-term-key'))" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${active ? 'bg-[#fdcb6e]/35 border-[#2a2d36] text-[#1e222a]' : 'bg-white border-[#dfd8cc] text-[#747d8c] line-through opacity-70'}">
            ${t.isComp ? '<i class="fas fa-chess-knight text-[10px] text-[#6c5ce7]"></i>' : ''}
            <span>${escapeHtml(t.label)}</span>
          </button>
        `;
      }).join('');
    }
  }

  if (dashAlertsDrawerOpen) {
    renderGoogleAlertsDrawer(rc);
  }
}

function renderSavedFeedsPanel(rc) {
  const groups = Array.isArray(rc.savedFeeds) ? rc.savedFeeds : [];
  const totalSaved = groups.reduce((sum, g) => sum + (Array.isArray(g?.items) ? g.items.length : 0), 0);
  const countBadge = document.getElementById('res-saved-feeds-count-badge');
  if (countBadge) countBadge.textContent = String(totalSaved);

  if (!dashActiveSavedGroupId || !groups.some((g) => g.id === dashActiveSavedGroupId)) {
    dashActiveSavedGroupId = groups[0]?.id || '';
  }

  const barEl = document.getElementById('res-saved-groups-bar');
  const detailEl = document.getElementById('res-saved-group-detail');

  if (barEl) {
    barEl.innerHTML = groups.length === 0
      ? `<span class="text-xs text-[#747d8c]">No Saved Feeds groups yet. Save links from Live Feed or create a group above.</span>`
      : groups.map((g) => {
        const isActive = g.id === dashActiveSavedGroupId;
        return `
          <div class="inline-flex items-center rounded-lg border overflow-hidden ${isActive ? 'bg-[#fdcb6e] border-[#2a2d36] text-[#2a2d36]' : 'bg-white border-[#dfd8cc] text-[#57606f]'}">
            <button type="button" data-gid="${escapeHtml(g.id)}" onclick="selectDashboardSavedGroup(this.getAttribute('data-gid'))" class="px-3 py-1.5 text-xs font-bold">${escapeHtml(g.name)} (${(g.items || []).length})</button>
            <button type="button" data-gid="${escapeHtml(g.id)}" onclick="deleteDashboardSavedGroup(this.getAttribute('data-gid'))" title="Delete group" class="px-2 py-1.5 text-[11px] hover:text-red-600 border-l ${isActive ? 'border-[#2a2d36]/25' : 'border-[#F2EBE0]'}"><i class="fas fa-times"></i></button>
          </div>
        `;
      }).join('');
  }

  if (detailEl) {
    const activeGroup = groups.find((g) => g.id === dashActiveSavedGroupId) || null;
    if (!activeGroup) {
      detailEl.innerHTML = `<div class="py-10 text-center text-xs text-[#747d8c] border border-dashed border-[#dfd8cc] rounded-xl bg-[#FAF4EB]/50">Select or create a Saved Feeds group to organize curated discussion links.</div>`;
      return;
    }

    const items = Array.isArray(activeGroup.items) ? activeGroup.items : [];
    const b = getActiveBrand();
    const queuedUrls = new Set((Array.isArray(b?.queue) ? b.queue : []).map((q) => normalizeTargetUrlForMatch(q?.url)).filter(Boolean));
    const { completedUrlsSet } = getActiveSuppressionAndCompletedSets();
    const isRenaming = dashRenamingGroupId === activeGroup.id;

    const headerHtml = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#FAF4EB] border border-[#dfd8cc]">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${isRenaming
            ? `<input type="text" id="res-rename-saved-group-input" value="${escapeHtml(activeGroup.name)}" class="px-2.5 py-1 bg-white border border-[#dfd8cc] rounded-md text-xs font-bold flex-1 max-w-xs" onkeydown="if(event.key==='Enter'){event.preventDefault();saveRenameDashboardSavedGroup('${escapeHtml(activeGroup.id)}');}">
               <button type="button" onclick="saveRenameDashboardSavedGroup('${escapeHtml(activeGroup.id)}')" class="sp-btn-primary px-2.5 py-1 rounded text-[11px]">Save</button>
               <button type="button" onclick="cancelRenameDashboardSavedGroup()" class="sp-btn-secondary px-2.5 py-1 rounded text-[11px]">Cancel</button>`
            : `<h4 class="text-xs font-extrabold text-[#1e222a] truncate">${escapeHtml(activeGroup.name)}</h4>
               <span class="text-[11px] font-mono-tabular text-[#57606f]">(${items.length})</span>
               <button type="button" onclick="startRenameDashboardSavedGroup('${escapeHtml(activeGroup.id)}')" title="Rename group" class="text-[#747d8c] hover:text-[#6c5ce7] p-1 text-xs"><i class="fas fa-pen"></i></button>`}
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onclick="openNextSavedFeedTabs('${escapeHtml(activeGroup.id)}', 5)" class="sp-btn-amber px-3 py-1.5 rounded-lg text-[11px]">Open Next 5</button>
          <button type="button" onclick="queueSavedFeedGroupAll('${escapeHtml(activeGroup.id)}')" class="sp-btn-primary px-3 py-1.5 rounded-lg text-[11px]">+ Queue All</button>
        </div>
      </div>
    `;

    if (items.length === 0) {
      detailEl.innerHTML = `${headerHtml}<div class="py-8 text-center text-xs text-[#747d8c] border border-[#dfd8cc] rounded-xl bg-white">No links saved in "${escapeHtml(activeGroup.name)}" yet.</div>`;
      return;
    }

    const rowsHtml = items.map((it, idx) => {
      const norm = normalizeTargetUrlForMatch(it.url);
      const isQueued = norm && queuedUrls.has(norm);
      const isCompleted = norm && completedUrlsSet.has(norm);
      return `
        <div class="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#FAF4EB]/70 bg-white">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">${escapeHtml(it.platform || 'web')}</span>
              ${isCompleted ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Already Posted ✓</span>` : ''}
              ${it.matchedTerm ? `<span class="text-[11px] font-medium text-[#57606f]">Matched: <strong class="text-[#1e222a]">${escapeHtml(it.matchedTerm)}</strong></span>` : ''}
              <span class="text-[11px] text-[#747d8c]">${it.publishedAt ? new Date(it.publishedAt).toLocaleDateString() : ''}</span>
            </div>
            <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-[#1e222a] hover:text-[#6c5ce7] block truncate">${escapeHtml(it.title || it.url)}</a>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px]">Open</a>
            ${isQueued
              ? `<span class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Queue ✓</span>`
              : `<button type="button" onclick="queueSingleSavedFeedItem('${escapeHtml(activeGroup.id)}', ${idx})" class="sp-btn-primary px-3 py-1.5 rounded-lg text-[11px]">+ Opportunity Queue</button>`}
            <button type="button" onclick="removeSavedFeedItem('${escapeHtml(activeGroup.id)}', ${idx})" title="Remove from group" class="text-[#747d8c] hover:text-red-600 p-1.5 text-xs"><i class="fas fa-times"></i></button>
          </div>
        </div>
      `;
    }).join('');

    detailEl.innerHTML = `${headerHtml}<div class="divide-y divide-[#F2EBE0] border border-[#dfd8cc] rounded-xl overflow-hidden">${rowsHtml}</div>`;
  }
}

const selectedKeywordKeys = new Set();
const DASH_SOCIAL_PLATFORMS = ['google', 'youtube', 'twitter', 'facebook', 'pinterest', 'instagram', 'threads', 'tiktok', 'reddit', 'linkedin'];

function getKeywordSelectionKey(kind, text) {
  return `${kind}:${String(text || '').trim().toLowerCase()}`;
}

function getFilteredKeywordItems(rc, b) {
  const brandKeywords = Array.isArray(b?.keywords) ? b.keywords : [];
  const starredNicheSet = new Set();
  brandKeywords.forEach((k) => {
    if (k && typeof k === 'object' && (k.bookmarked || k.starred)) {
      const lower = String(k.text || '').trim().toLowerCase();
      if (lower) starredNicheSet.add(lower);
    }
  });

  const nicheItems = (rc.keywords || []).map((kw, idx) => {
    const text = String(typeof kw === 'string' ? kw : kw?.text || '').trim();
    const lower = text.toLowerCase();
    const starred = starredNicheSet.has(lower) || Boolean(kw && typeof kw === 'object' && (kw.bookmarked || kw.starred));
    return {
      kind: 'niche',
      idx,
      text,
      key: getKeywordSelectionKey('niche', text),
      starred,
    };
  }).filter((item) => item.text);

  const compItems = (rc.competitors || []).map((c, idx) => {
    const text = String(typeof c === 'string' ? c : c?.name || '').trim();
    const starred = Boolean(c && typeof c === 'object' && (c.starred || c.bookmarked));
    return {
      kind: 'competitor',
      idx,
      text,
      key: getKeywordSelectionKey('competitor', text),
      starred,
    };
  }).filter((item) => item.text);

  let items = [];
  if (dashKwTypeFilter === 'niche') items = nicheItems;
  else if (dashKwTypeFilter === 'competitor') items = compItems;
  else if (dashKwTypeFilter === 'favourites') items = [...nicheItems, ...compItems].filter((item) => item.starred);
  else items = [...nicheItems, ...compItems];

  const searchQ = (document.getElementById('res-kw-search')?.value || '').trim().toLowerCase();
  if (searchQ) {
    items = items.filter((item) => item.text.toLowerCase().includes(searchQ));
  }

  return { nicheItems, compItems, items };
}

function updateKeywordBulkToolbar(visibleItems) {
  const visibleMap = new Map(visibleItems.map((it) => [it.key, it]));
  Array.from(selectedKeywordKeys).forEach((k) => {
    if (!visibleMap.has(k)) selectedKeywordKeys.delete(k);
  });

  const selectedItems = visibleItems.filter((it) => selectedKeywordKeys.has(it.key));
  const count = selectedItems.length;
  const countEl = document.getElementById('res-kw-selected-count');
  if (countEl) countEl.textContent = `${count} selected`;

  const selectAllEl = document.getElementById('res-kw-select-all');
  if (selectAllEl) {
    selectAllEl.checked = visibleItems.length > 0 && visibleItems.every((it) => selectedKeywordKeys.has(it.key));
  }

  const hasNiche = selectedItems.some((it) => it.kind === 'niche');
  const hasComp = selectedItems.some((it) => it.kind === 'competitor');
  const toNicheBtn = document.getElementById('btn-kw-bulk-to-niche');
  const toCompBtn = document.getElementById('btn-kw-bulk-to-comp');
  const deleteBtn = document.getElementById('btn-kw-bulk-delete');
  if (toNicheBtn) toNicheBtn.disabled = !hasComp;
  if (toCompBtn) toCompBtn.disabled = !hasNiche;
  if (deleteBtn) deleteBtn.disabled = count === 0;

  const socialBar = document.getElementById('res-kw-bulk-social-btns');
  if (socialBar) {
    const disAttr = count === 0 ? 'disabled' : '';
    const disCls = count === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-95';
    const platDisCls = count === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:text-[#6c5ce7] hover:border-[#6c5ce7]';
    socialBar.innerHTML = `
      <button type="button" ${disAttr} onclick="bulkLaunchKeywordsRocket()" class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] transition ${disCls}">
        <i class="fas fa-rocket text-[11px]"></i>
      </button>
      ${DASH_SOCIAL_PLATFORMS.map((plat) => `
        <button type="button" ${disAttr} onclick="bulkLaunchKeywordsPlatform('${plat}')" class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white text-[#57606f] border border-[#dfd8cc] transition ${platDisCls}">
          ${getDashSocialIconSvg(plat)}
        </button>
      `).join('')}
    `;
  }
}

function toggleKeywordSelection(el) {
  const key = el?.getAttribute('data-kw-key') || '';
  if (!key) return;
  if (el.checked) selectedKeywordKeys.add(key);
  else selectedKeywordKeys.delete(key);
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const { items } = getFilteredKeywordItems(rc, b);
  updateKeywordBulkToolbar(items);
}

function toggleSelectAllVisibleKeywords(checked) {
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const { items } = getFilteredKeywordItems(rc, b);
  if (checked) {
    items.forEach((it) => selectedKeywordKeys.add(it.key));
  } else {
    selectedKeywordKeys.clear();
  }
  renderUnifiedKeywordsList(rc);
}

function toggleKeywordStar(el) {
  const kind = el?.getAttribute('data-kind') || 'niche';
  const text = (el?.getAttribute('data-text') || '').trim();
  if (!text) return;
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const lower = text.toLowerCase();

  if (kind === 'competitor') {
    if (!Array.isArray(rc.competitors)) rc.competitors = [];
    const idx = rc.competitors.findIndex((c) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === lower);
    if (idx === -1) return;
    const raw = rc.competitors[idx];
    const obj = typeof raw === 'object' && raw
      ? { ...raw }
      : {
          id: 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          name: text,
          orQuery: formatCompetitorOrQuery(text),
          queries: buildCompetitorCombinations(text),
        };
    const nextStar = !Boolean(obj.starred || obj.bookmarked);
    if (nextStar) {
      obj.starred = true;
    } else {
      delete obj.starred;
      delete obj.bookmarked;
    }
    rc.competitors[idx] = obj;
  } else if (b) {
    if (!Array.isArray(b.keywords)) b.keywords = [];
    const idx = b.keywords.findIndex((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() === lower);
    if (idx === -1) {
      b.keywords.unshift({ id: 'kw-' + Date.now(), text, bookmarked: true });
    } else {
      const raw = b.keywords[idx];
      const obj = typeof raw === 'object' && raw ? { ...raw } : { id: 'kw-' + Date.now(), text };
      obj.bookmarked = !Boolean(obj.bookmarked || obj.starred);
      delete obj.starred;
      b.keywords[idx] = obj;
    }
  }

  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
}

function getSelectedKeywordItemsForAction() {
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  const { items } = getFilteredKeywordItems(rc, b);
  return { rc, b, selected: items.filter((it) => selectedKeywordKeys.has(it.key)) };
}

function bulkDeleteSelectedKeywords() {
  const { rc, b, selected } = getSelectedKeywordItemsForAction();
  if (selected.length === 0) return;
  const nowIso = new Date().toISOString();
  const delNiche = new Set();
  const delComp = new Set();

  selected.forEach((it) => {
    const lower = it.text.toLowerCase();
    if (it.kind === 'competitor') {
      delComp.add(lower);
      if (!rc.deletedCompetitors || typeof rc.deletedCompetitors !== 'object') rc.deletedCompetitors = {};
      rc.deletedCompetitors[lower] = nowIso;
    } else {
      delNiche.add(lower);
      if (!rc.deletedKeywords || typeof rc.deletedKeywords !== 'object') rc.deletedKeywords = {};
      rc.deletedKeywords[lower] = nowIso;
    }
  });

  if (delNiche.size > 0) {
    rc.keywords = (rc.keywords || []).filter((k) => !delNiche.has(String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase()));
    if (b && Array.isArray(b.keywords)) {
      b.keywords = b.keywords.filter((k) => !delNiche.has(String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase()));
    }
  }
  if (delComp.size > 0) {
    rc.competitors = (rc.competitors || []).filter((c) => !delComp.has(String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase()));
  }

  selectedKeywordKeys.clear();
  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Deleted ${selected.length} keyword(s)/competitor(s).`);
}

function bulkConvertSelectedKeywords(targetKind) {
  const { rc, b, selected } = getSelectedKeywordItemsForAction();
  if (selected.length === 0) return;
  const nowIso = new Date().toISOString();
  const toConvert = selected.filter((it) => it.kind !== targetKind);
  if (toConvert.length === 0) return;

  if (!Array.isArray(rc.keywords)) rc.keywords = [];
  if (!Array.isArray(rc.competitors)) rc.competitors = [];
  if (b && !Array.isArray(b.keywords)) b.keywords = [];

  let convertedCount = 0;
  toConvert.forEach((it) => {
    const lower = it.text.toLowerCase();
    selectedKeywordKeys.delete(it.key);

    if (targetKind === 'competitor') {
      rc.keywords = rc.keywords.filter((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() !== lower);
      if (b) {
        b.keywords = b.keywords.filter((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() !== lower);
      }
      if (!rc.deletedKeywords || typeof rc.deletedKeywords !== 'object') rc.deletedKeywords = {};
      rc.deletedKeywords[lower] = nowIso;
      if (rc.deletedCompetitors && rc.deletedCompetitors[lower]) delete rc.deletedCompetitors[lower];

      const existsComp = rc.competitors.some((c) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === lower);
      if (!existsComp) {
        rc.competitors.unshift({
          id: 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          name: it.text,
          orQuery: formatCompetitorOrQuery(it.text),
          queries: buildCompetitorCombinations(it.text),
          ...(it.starred ? { starred: true } : {}),
        });
      }
      selectedKeywordKeys.add(getKeywordSelectionKey('competitor', it.text));
      convertedCount += 1;
    } else {
      rc.competitors = rc.competitors.filter((c) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() !== lower);
      if (!rc.deletedCompetitors || typeof rc.deletedCompetitors !== 'object') rc.deletedCompetitors = {};
      rc.deletedCompetitors[lower] = nowIso;
      if (rc.deletedKeywords && rc.deletedKeywords[lower]) delete rc.deletedKeywords[lower];

      if (!rc.keywords.some((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() === lower)) {
        rc.keywords.unshift(it.text);
      }
      if (b) {
        const existingBrandKw = b.keywords.find((k) => String(typeof k === 'string' ? k : k?.text || '').trim().toLowerCase() === lower);
        if (!existingBrandKw) {
          b.keywords.unshift({ id: 'kw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5), text: it.text, bookmarked: Boolean(it.starred) });
        } else if (typeof existingBrandKw === 'object' && it.starred) {
          existingBrandKw.bookmarked = true;
        }
      }
      selectedKeywordKeys.add(getKeywordSelectionKey('niche', it.text));
      convertedCount += 1;
    }
  });

  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Moved ${convertedCount} term(s) to ${targetKind === 'competitor' ? 'Competitors' : 'Niche Keywords'}.`);
}

function bulkLaunchKeywordsRocket() {
  const { selected } = getSelectedKeywordItemsForAction();
  if (selected.length === 0) return;
  const rocketPlatforms = ['google', 'youtube', 'twitter', 'instagram', 'tiktok', 'reddit'];
  const urlSet = new Set();
  selected.forEach((it) => {
    const isComp = it.kind === 'competitor';
    rocketPlatforms.forEach((plat) => urlSet.add(getDashSocialSearchUrl(plat, it.text, isComp)));
  });
  const urls = Array.from(urlSet);
  if (urls.length === 0) return;
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
  }
  showToast(`Opened ${urls.length} tab(s) for ${selected.length} selected term(s)!`);
}

function bulkLaunchKeywordsPlatform(platform) {
  const { selected } = getSelectedKeywordItemsForAction();
  if (selected.length === 0) return;
  const urlSet = new Set();
  selected.forEach((it) => {
    urlSet.add(getDashSocialSearchUrl(platform, it.text, it.kind === 'competitor'));
  });
  const urls = Array.from(urlSet);
  if (urls.length === 0) return;
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
  }
  showToast(`Opened ${urls.length} tab(s)!`);
}

function renderUnifiedKeywordsList(rc) {
  const b = getActiveBrand();
  const kwFilterAll = document.getElementById('res-kw-filter-all');
  const kwFilterFav = document.getElementById('res-kw-filter-favourites');
  const kwFilterNiche = document.getElementById('res-kw-filter-niche');
  const kwFilterComp = document.getElementById('res-kw-filter-competitor');

  const activeCls = 'px-3 py-1 rounded-md text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36]';
  const inactiveCls = 'px-3 py-1 rounded-md text-xs font-semibold text-[#57606f] hover:text-[#1e222a]';
  if (kwFilterAll) kwFilterAll.className = dashKwTypeFilter === 'all' ? activeCls : inactiveCls;
  if (kwFilterFav) kwFilterFav.className = dashKwTypeFilter === 'favourites' ? activeCls : inactiveCls;
  if (kwFilterNiche) kwFilterNiche.className = dashKwTypeFilter === 'niche' ? activeCls : inactiveCls;
  if (kwFilterComp) kwFilterComp.className = dashKwTypeFilter === 'competitor' ? activeCls : inactiveCls;

  // Keep brand.keywords & rc.keywords gently synced without overriding user deletes
  if (b && Array.isArray(b.keywords)) {
    const seen = new Set((rc.keywords || []).map((k) => String(k || '').trim().toLowerCase()));
    b.keywords.forEach((k) => {
      const text = String(typeof k === 'string' ? k : k?.text || '').trim();
      const lower = text.toLowerCase();
      if (!text || seen.has(lower)) return;
      if (rc.deletedKeywords && rc.deletedKeywords[lower]) return;
      seen.add(lower);
      rc.keywords.push(text);
    });
  }

  const { nicheItems, compItems, items } = getFilteredKeywordItems(rc, b);

  const countEl = document.getElementById('res-kw-count');
  const totalCount = nicheItems.length + compItems.length;
  if (countEl) countEl.textContent = `${totalCount} term${totalCount === 1 ? '' : 's'} (${nicheItems.length} niche · ${compItems.length} comp)`;

  const fetchBtnLabelEl = document.getElementById('btn-opp-fetch-keywords-label');
  if (fetchBtnLabelEl) {
    fetchBtnLabelEl.textContent = totalCount > 0 ? 'Fetch more Keywords & Competitors' : 'Fetch Keywords & Competitors';
  }

  updateKeywordBulkToolbar(items);

  const listEl = document.getElementById('res-keywords-list');
  if (!listEl) return;

  if (items.length === 0) {
    const searchQ = (document.getElementById('res-kw-search')?.value || '').trim();
    let emptyMsg = 'No terms tracked yet. Add niche keywords or competitors above, or click <strong>Fetch Keywords &amp; Competitors</strong>.';
    if (searchQ) emptyMsg = 'No matching keywords or competitors.';
    else if (dashKwTypeFilter === 'favourites') emptyMsg = 'No favourite keywords starred yet. Click the star icon on any keyword or competitor to add it here.';
    listEl.innerHTML = `<div class="text-xs text-[#747d8c] py-6 text-center bg-[#FAF4EB]/50 rounded-xl border border-dashed border-[#dfd8cc]">${emptyMsg}</div>`;
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const isComp = item.kind === 'competitor';
    const dataAttrs = `data-query="${escapeHtml(item.text)}" data-comp="${isComp ? '1' : '0'}"`;
    const removeFn = isComp ? `removeResearchCompetitor(${item.idx})` : `removeResearchKeyword(${item.idx})`;
    const isChecked = selectedKeywordKeys.has(item.key);
    const starIconCls = item.starred ? 'fas fa-star text-amber-500' : 'far fa-star text-[#b5ada0] hover:text-amber-400';
    return `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#FAF4EB] border border-[#dfd8cc] rounded-xl">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <input type="checkbox" data-kw-key="${escapeHtml(item.key)}" ${isChecked ? 'checked' : ''} onchange="toggleKeywordSelection(this)" class="accent-[#6c5ce7] cursor-pointer shrink-0">
          <button type="button" data-kind="${item.kind}" data-text="${escapeHtml(item.text)}" onclick="toggleKeywordStar(this)" class="p-1 text-xs leading-none shrink-0 transition" aria-label="Toggle favourite">
            <i class="${starIconCls}"></i>
          </button>
          <span class="text-xs font-bold text-[#1e222a] truncate">${escapeHtml(item.text)}</span>
          ${isComp ? `<span class="hidden sm:inline text-[10px] font-mono text-[#747d8c] truncate">(alt OR vs)</span>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-1 shrink-0">
          <button type="button" ${dataAttrs} onclick="handleKeywordRocketClick(this)" class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] hover:brightness-95 transition">
            <i class="fas fa-rocket text-[11px]"></i>
          </button>
          ${DASH_SOCIAL_PLATFORMS.map((plat) => `
            <button type="button" ${dataAttrs} onclick="handleKeywordPlatformClick(this, '${plat}')" class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white text-[#57606f] hover:text-[#6c5ce7] border border-[#dfd8cc] hover:border-[#6c5ce7] transition">
              ${getDashSocialIconSvg(plat)}
            </button>
          `).join('')}
          <button type="button" onclick="${removeFn}" class="text-[#747d8c] hover:text-red-600 p-1.5 text-xs"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

const selectedContactFormKeys = new Set();

function buildContactFormSearchQuery(keyword, location = '', mode = 'wide') {
  const cleanKw = String(keyword || '').replace(/"/g, '').trim();
  if (!cleanKw) return '';
  const cleanLoc = String(location || '').replace(/"/g, '').trim();
  const baseTerms = cleanLoc ? `"${cleanKw}" "${cleanLoc}"` : `"${cleanKw}"`;
  const normalizedMode = normalizeContactFormSearchMode(mode);

  if (normalizedMode === 'strict') {
    return `${baseTerms} intitle:contact "name" "email" "subject" "message"`;
  }
  if (normalizedMode === 'max') {
    return `${baseTerms} (intitle:contact OR intitle:support OR intitle:"get in touch" OR inurl:contact OR inurl:support) "email" "message"`;
  }
  // 'wide' (Recommended default): covers both Contact & Support titles without dropping forms missing "subject" or "name"
  return `${baseTerms} (intitle:contact OR intitle:support) ("name" OR "subject") "email" "message"`;
}

function getContactFormEntryKey(keyword, location = '') {
  const cleanKw = String(keyword || '').replace(/"/g, '').trim().toLowerCase();
  const cleanLoc = String(location || '').replace(/"/g, '').trim().toLowerCase();
  return `${cleanKw}||${cleanLoc}`;
}

function normalizeContactFormSearchEntry(raw, mode = 'wide') {
  if (!raw || typeof raw !== 'object') return null;
  const keyword = String(raw.keyword || '').replace(/"/g, '').trim();
  if (!keyword) return null;
  const location = String(raw.location || '').replace(/"/g, '').trim();
  return {
    id: String(raw.id || `cfk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    keyword,
    location,
    query: buildContactFormSearchQuery(keyword, location, mode),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function getFilteredContactFormEntries(rc) {
  const mode = normalizeContactFormSearchMode(rc?.contactFormSearchMode);
  const seen = new Set();
  const allEntries = [];
  (Array.isArray(rc?.contactFormSearches) ? rc.contactFormSearches : []).forEach((raw) => {
    const norm = normalizeContactFormSearchEntry(raw, mode);
    if (!norm) return;
    const key = getContactFormEntryKey(norm.keyword, norm.location);
    if (seen.has(key)) return;
    seen.add(key);
    allEntries.push({ ...norm, key });
  });

  const filterQ = (document.getElementById('opp-cf-search')?.value || '').trim().toLowerCase();
  const visibleEntries = filterQ
    ? allEntries.filter((it) =>
        it.keyword.toLowerCase().includes(filterQ) ||
        it.location.toLowerCase().includes(filterQ) ||
        it.query.toLowerCase().includes(filterQ)
      )
    : allEntries;

  return { allEntries, visibleEntries };
}

function setContactFormSearchMode(mode) {
  const nextMode = normalizeContactFormSearchMode(mode);
  const rc = getCampaignResearchConfig();
  rc.contactFormSearchMode = nextMode;
  if (Array.isArray(rc.contactFormSearches)) {
    rc.contactFormSearches = rc.contactFormSearches.map((it) => normalizeContactFormSearchEntry(it, nextMode)).filter(Boolean);
  }
  touchActiveResearchConfig(rc);
  renderContactFormOpportunities(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  const labels = {
    wide: 'Contact & Support (Wide)',
    max: 'Max Reach (+ In-URL & Get in Touch)',
    strict: 'Classic Strict',
  };
  showToast(`Contact form query updated: ${labels[nextMode] || nextMode}`);
}

function updateContactFormBulkToolbar(visibleEntries) {
  const visibleMap = new Map(visibleEntries.map((it) => [it.key, it]));
  Array.from(selectedContactFormKeys).forEach((k) => {
    if (!visibleMap.has(k)) selectedContactFormKeys.delete(k);
  });

  const selectedEntries = visibleEntries.filter((it) => selectedContactFormKeys.has(it.key));
  const count = selectedEntries.length;

  const countEl = document.getElementById('opp-cf-selected-count');
  if (countEl) countEl.textContent = `${count} selected`;

  const selectAllEl = document.getElementById('opp-cf-select-all');
  if (selectAllEl) {
    selectAllEl.checked = visibleEntries.length > 0 && visibleEntries.every((it) => selectedContactFormKeys.has(it.key));
  }

  const bulkOpenBtn = document.getElementById('btn-cf-bulk-open');
  const bulkDeleteBtn = document.getElementById('btn-cf-bulk-delete');
  if (bulkOpenBtn) bulkOpenBtn.disabled = count === 0;
  if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
}

function addContactFormSearchEntry() {
  const kwEl = document.getElementById('opp-cf-keyword-input');
  const locEl = document.getElementById('opp-cf-location-input');
  const keyword = String(kwEl?.value || '').replace(/"/g, '').trim();
  const location = String(locEl?.value || '').replace(/"/g, '').trim();

  if (!keyword) {
    kwEl?.focus();
    showToast('Please enter a Main keyword.', 'error');
    return;
  }

  const rc = getCampaignResearchConfig();
  if (!Array.isArray(rc.contactFormSearches)) rc.contactFormSearches = [];
  const key = getContactFormEntryKey(keyword, location);

  const duplicate = rc.contactFormSearches.some((it) => getContactFormEntryKey(it?.keyword, it?.location) === key);
  if (duplicate) {
    showToast('This Contact form keyword entry already exists.', 'error');
    return;
  }

  if (rc.deletedContactFormSearchKeys && rc.deletedContactFormSearchKeys[key]) {
    delete rc.deletedContactFormSearchKeys[key];
  }

  const mode = normalizeContactFormSearchMode(rc.contactFormSearchMode);
  const entry = {
    id: 'cfk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    keyword,
    location,
    query: buildContactFormSearchQuery(keyword, location, mode),
    createdAt: new Date().toISOString(),
  };
  rc.contactFormSearches.unshift(entry);

  if (kwEl) kwEl.value = '';
  if (locEl) locEl.value = '';
  kwEl?.focus();

  touchActiveResearchConfig(rc);
  renderContactFormOpportunities(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Saved "${keyword}"${location ? ` (${location})` : ''}!`);
}

function openContactFormGoogleUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
  }
}

function openContactFormSearchEntry(id) {
  const rc = getCampaignResearchConfig();
  const raw = (rc.contactFormSearches || []).find((it) => String(it?.id || '') === String(id || ''));
  const entry = normalizeContactFormSearchEntry(raw, normalizeContactFormSearchMode(rc.contactFormSearchMode));
  if (!entry) return;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(entry.query)}`;
  openContactFormGoogleUrls([googleUrl]);
}

function openSelectedContactFormSearches() {
  const rc = getCampaignResearchConfig();
  const { visibleEntries } = getFilteredContactFormEntries(rc);
  const selected = visibleEntries.filter((it) => selectedContactFormKeys.has(it.key));
  if (selected.length === 0) return;
  const urls = selected.map((it) => `https://www.google.com/search?q=${encodeURIComponent(it.query)}`);
  openContactFormGoogleUrls(urls);
  showToast(`Opened ${urls.length} Google search tab(s)!`);
}

function copyContactFormSearchQuery(id, btnEl) {
  const rc = getCampaignResearchConfig();
  const raw = (rc.contactFormSearches || []).find((it) => String(it?.id || '') === String(id || ''));
  const entry = normalizeContactFormSearchEntry(raw, normalizeContactFormSearchMode(rc.contactFormSearchMode));
  if (!entry) return;
  navigator.clipboard?.writeText(entry.query).catch(() => {});
  if (btnEl) {
    const iconEl = btnEl.querySelector('i');
    if (iconEl) {
      iconEl.className = 'fas fa-check text-[11px] text-emerald-600';
      setTimeout(() => { iconEl.className = 'fas fa-copy text-[11px]'; }, 1200);
    }
  }
  showToast('Google search query copied!');
}

function removeContactFormSearchEntry(id) {
  const rc = getCampaignResearchConfig();
  const list = Array.isArray(rc.contactFormSearches) ? rc.contactFormSearches : [];
  const target = list.find((it) => String(it?.id || '') === String(id || ''));
  if (!target) return;
  const key = getContactFormEntryKey(target.keyword, target.location);
  if (!rc.deletedContactFormSearchKeys || typeof rc.deletedContactFormSearchKeys !== 'object') {
    rc.deletedContactFormSearchKeys = {};
  }
  rc.deletedContactFormSearchKeys[key] = new Date().toISOString();
  rc.contactFormSearches = list.filter((it) => String(it?.id || '') !== String(id || ''));
  selectedContactFormKeys.delete(key);

  touchActiveResearchConfig(rc);
  renderContactFormOpportunities(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast('Contact form keyword removed.');
}

function toggleContactFormSearchSelection(el) {
  const key = el?.getAttribute('data-cf-key') || '';
  if (!key) return;
  if (el.checked) selectedContactFormKeys.add(key);
  else selectedContactFormKeys.delete(key);
  const rc = getCampaignResearchConfig();
  const { visibleEntries } = getFilteredContactFormEntries(rc);
  updateContactFormBulkToolbar(visibleEntries);
}

function toggleSelectAllContactFormSearches(checked) {
  const rc = getCampaignResearchConfig();
  const { visibleEntries } = getFilteredContactFormEntries(rc);
  if (checked) {
    visibleEntries.forEach((it) => selectedContactFormKeys.add(it.key));
  } else {
    selectedContactFormKeys.clear();
  }
  renderContactFormOpportunities(rc);
}

function deleteSelectedContactFormSearches() {
  const rc = getCampaignResearchConfig();
  const { visibleEntries } = getFilteredContactFormEntries(rc);
  const selected = visibleEntries.filter((it) => selectedContactFormKeys.has(it.key));
  if (selected.length === 0) return;

  const nowIso = new Date().toISOString();
  if (!rc.deletedContactFormSearchKeys || typeof rc.deletedContactFormSearchKeys !== 'object') {
    rc.deletedContactFormSearchKeys = {};
  }
  const delKeys = new Set();
  selected.forEach((it) => {
    delKeys.add(it.key);
    rc.deletedContactFormSearchKeys[it.key] = nowIso;
  });

  rc.contactFormSearches = (rc.contactFormSearches || []).filter((it) => {
    const key = getContactFormEntryKey(it?.keyword, it?.location);
    return !delKeys.has(key);
  });
  selectedContactFormKeys.clear();

  touchActiveResearchConfig(rc);
  renderContactFormOpportunities(rc);
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Deleted ${selected.length} Contact form entry(s).`);
}

function renderContactFormOpportunities(rcParam) {
  const rc = rcParam || getCampaignResearchConfig();
  const mode = normalizeContactFormSearchMode(rc?.contactFormSearchMode);
  const modeEl = document.getElementById('opp-cf-mode-select');
  if (modeEl && modeEl.value !== mode) modeEl.value = mode;

  const { allEntries, visibleEntries } = getFilteredContactFormEntries(rc);

  const countEl = document.getElementById('opp-cf-count');
  if (countEl) {
    countEl.textContent = `${allEntries.length} entr${allEntries.length === 1 ? 'y' : 'ies'}`;
  }

  updateContactFormBulkToolbar(visibleEntries);

  const listEl = document.getElementById('opp-cf-list');
  if (!listEl) return;

  if (visibleEntries.length === 0) {
    const searchQ = (document.getElementById('opp-cf-search')?.value || '').trim();
    const emptyMsg = searchQ
      ? 'No matching Contact form keyword entries.'
      : 'No Contact form keyword entries saved yet. Add a <strong>Main keyword</strong> and optional <strong>Location keyword</strong> above.';
    listEl.innerHTML = `<div class="text-xs text-[#747d8c] py-6 text-center bg-[#FAF4EB]/50 rounded-xl border border-dashed border-[#dfd8cc]">${emptyMsg}</div>`;
    return;
  }

  listEl.innerHTML = visibleEntries.map((item) => {
    const isChecked = selectedContactFormKeys.has(item.key);
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#FAF4EB] border border-[#dfd8cc] rounded-xl">
        <div class="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <input type="checkbox" data-cf-key="${escapeHtml(item.key)}" ${isChecked ? 'checked' : ''} onchange="toggleContactFormSearchSelection(this)" class="accent-[#6c5ce7] cursor-pointer shrink-0 mt-0.5 sm:mt-0">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-[#1e222a] truncate" title="${escapeHtml(item.query)}">${escapeHtml(item.keyword)}</span>
              ${item.location ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-[#57606f] border border-[#dfd8cc] shrink-0"><i class="fas fa-location-dot text-[9px] text-[#6c5ce7]"></i>${escapeHtml(item.location)}</span>` : ''}
            </div>
            <div class="text-[10px] font-mono text-[#747d8c] truncate mt-0.5" title="${escapeHtml(item.query)}">${escapeHtml(item.query)}</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="openContactFormSearchEntry('${escapeHtml(item.id)}')" title="${escapeHtml(item.query)}" class="sp-btn-amber inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap">
            <i class="fas fa-external-link-alt text-[10px]"></i>
            <span>Open</span>
          </button>
          <button type="button" onclick="copyContactFormSearchQuery('${escapeHtml(item.id)}', this)" title="Copy search query" class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white text-[#57606f] hover:text-[#6c5ce7] border border-[#dfd8cc] hover:border-[#6c5ce7] transition">
            <i class="fas fa-copy text-[11px]"></i>
          </button>
          <button type="button" onclick="removeContactFormSearchEntry('${escapeHtml(item.id)}')" title="Delete entry" class="text-[#747d8c] hover:text-red-600 p-1.5 text-xs"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function renderResearchSection() {
  document.getElementById('alerts-ext-recommended-banner')?.classList.toggle('hidden', Boolean(state.extInstalled));
  const rc = syncActiveResearchConfigMirror();
  renderGoogleAlertsSourcesBar(rc);
  renderFeedBuilderControls(rc);
  renderDiscoveredThreads();
  renderSavedFeedsPanel(rc);
  renderUnifiedKeywordsList(rc);
  renderContactFormOpportunities(rc);
}

function computeLocalThreadIntentScore(t) {
  if (typeof t?.intentScore === 'number' && Number.isFinite(t.intentScore)) return t.intentScore;
  let score = 25;
  const hay = `${t?.title || ''} ${t?.snippet || ''}`.toLowerCase();
  if (/\b(alternative|alternatives|alternate|competitor|vs\.?|versus|switch(?:ing)? from|replace)\b/.test(hay)) score += 28;
  if (/\b(recommend|recommendation|looking for|anyone know|anyone use|anyone tried|what(?:'s| is) the best|best tool|best app|best software|suggest)\b/.test(hay)) score += 25;
  if (hay.includes('?')) score += 8;
  if (t?.platform === 'reddit' || t?.platform === 'twitter' || t?.platform === 'quora') score += 15;
  else if (t?.platform === 'youtube' || t?.platform === 'linkedin') score += 8;
  if (String(t?.source || '').toLowerCase().includes('google alerts')) score += 10;
  return Math.max(0, Math.min(100, score));
}

let visibleThreadsLimit = 50;

function resetThreadsPaginationAndRender() {
  visibleThreadsLimit = 50;
  renderDiscoveredThreads();
}

function showMoreDiscoveredThreads() {
  visibleThreadsLimit += 50;
  renderDiscoveredThreads();
}

function normalizeTargetUrlForMatch(rawUrl) {
  return String(rawUrl || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

function extractDomainFromUrlSafe(rawUrl) {
  try {
    return new URL(String(rawUrl || '')).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function getActiveSuppressionAndCompletedSets() {
  const b = getActiveBrand();
  const suppressedUrls = new Set();
  const suppressedDomains = new Set();
  const addSupEntry = (entry) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const clean = entry.trim().toLowerCase();
      if (!clean) return;
      if (clean.startsWith('http')) suppressedUrls.add(normalizeTargetUrlForMatch(clean));
      else suppressedDomains.add(clean.replace(/^www\./i, ''));
      return;
    }
    if (entry.url) suppressedUrls.add(normalizeTargetUrlForMatch(entry.url));
    if (entry.domain && entry.type !== 'thread') {
      suppressedDomains.add(String(entry.domain).trim().toLowerCase().replace(/^www\./i, ''));
    }
  };
  (b?.suppressionList || []).forEach(addSupEntry);
  (state.suppressionList || []).forEach(addSupEntry);

  const completedUrlsSet = new Set();
  const completedMap = state.completedUrls && typeof state.completedUrls === 'object' ? state.completedUrls : {};
  Object.values(completedMap).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.url) completedUrlsSet.add(normalizeTargetUrlForMatch(item.url));
  });

  return { suppressedUrls, suppressedDomains, completedUrlsSet };
}

function getFilteredSortedThreads() {
  const rc = getCampaignResearchConfig();
  const { suppressedUrls, suppressedDomains } = getActiveSuppressionAndCompletedSets();
  const activeThreads = (rc.discoveredThreads || []).filter((t) => {
    if (!t || t.status === 'dismissed') return false;
    const norm = normalizeTargetUrlForMatch(t.url);
    const dom = extractDomainFromUrlSafe(t.url);
    if (norm && suppressedUrls.has(norm)) return false;
    if (dom && suppressedDomains.has(dom)) return false;
    return true;
  });

  const statusFilter = document.getElementById('res-thread-status-filter')?.value || 'all';
  const intentFilter = document.getElementById('res-thread-intent-filter')?.value || 'all';
  const sortMode = document.getElementById('res-thread-sort')?.value || 'newest';
  const q = (document.getElementById('res-thread-search')?.value || '').trim().toLowerCase();

  const filtered = activeThreads.filter((t) => {
    const plat = String(t.platform || 'web').toLowerCase();
    if (dashSelectedNetworkTabs.size > 0 && !dashSelectedNetworkTabs.has(plat)) return false;
    if (statusFilter === 'new' && t.status === 'queued') return false;
    if (statusFilter === 'queued' && t.status !== 'queued') return false;
    if (statusFilter === 'alerts' && !String(t.source || '').toLowerCase().includes('google alerts')) return false;
    if (intentFilter === 'high' && computeLocalThreadIntentScore(t) < 60) return false;
    if (q) {
      const hay = `${t.title || ''} ${t.matchedTerm || ''} ${t.url || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'intent') {
      const diff = computeLocalThreadIntentScore(b) - computeLocalThreadIntentScore(a);
      if (diff !== 0) return diff;
    }
    return (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0);
  });

  return { activeThreads, filtered: sorted };
}

function updateThreadSelectionToolbar(visibleSlice) {
  const visibleIds = new Set(visibleSlice.map((t) => t.id));
  Array.from(selectedThreadIds).forEach((id) => {
    if (!visibleIds.has(id)) selectedThreadIds.delete(id);
  });
  const count = selectedThreadIds.size;
  const countEl = document.getElementById('res-threads-selected-count');
  if (countEl) countEl.textContent = `${count} selected`;

  const selectAllEl = document.getElementById('res-threads-select-all');
  if (selectAllEl) {
    selectAllEl.checked = visibleSlice.length > 0 && visibleSlice.every((t) => selectedThreadIds.has(t.id));
  }
  const qBtn = document.getElementById('btn-threads-queue-selected');
  const dBtn = document.getElementById('btn-threads-dismiss-selected');
  if (qBtn) qBtn.disabled = count === 0;
  if (dBtn) dBtn.disabled = count === 0;
}

function toggleThreadSelection(threadId, checked) {
  if (checked) selectedThreadIds.add(threadId);
  else selectedThreadIds.delete(threadId);
  const { filtered } = getFilteredSortedThreads();
  updateThreadSelectionToolbar(filtered.slice(0, visibleThreadsLimit));
}

function toggleSelectAllVisibleThreads(checked) {
  const { filtered } = getFilteredSortedThreads();
  const visibleSlice = filtered.slice(0, visibleThreadsLimit);
  if (checked) visibleSlice.forEach((t) => selectedThreadIds.add(t.id));
  else selectedThreadIds.clear();
  renderDiscoveredThreads();
}

function queueSelectedThreads() {
  const rc = getCampaignResearchConfig();
  const b = getActiveBrand();
  if (!b || selectedThreadIds.size === 0) return;
  if (!Array.isArray(b.queue)) b.queue = [];
  const existingUrls = new Set(b.queue.map((i) => String(i?.url || '').trim().toLowerCase()));
  let queuedCount = 0;

  (rc.discoveredThreads || []).forEach((t) => {
    if (!selectedThreadIds.has(t.id)) return;
    const normUrl = String(t.url || '').trim().toLowerCase();
    if (normUrl && !existingUrls.has(normUrl)) {
      existingUrls.add(normUrl);
      b.queue.unshift({
        id: 'opp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        url: t.url,
        title: t.title || t.url,
        platform: t.platform || 'web',
        status: 'queued',
        savedAt: new Date().toISOString(),
      });
    }
    if (t.status !== 'queued') queuedCount++;
    t.status = 'queued';
  });

  selectedThreadIds.clear();
  touchActiveResearchConfig(rc, b);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  showToast(`Added ${queuedCount || 'selected'} thread(s) to Opportunity Queue!`);
}

function dismissSelectedThreads() {
  const rc = getCampaignResearchConfig();
  if (selectedThreadIds.size === 0) return;
  let dismissed = 0;
  (rc.discoveredThreads || []).forEach((t) => {
    if (selectedThreadIds.has(t.id)) {
      t.status = 'dismissed';
      dismissed++;
    }
  });
  selectedThreadIds.clear();
  touchActiveResearchConfig(rc);
  renderResearchSection();
  persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles, researchConfig: getMirroredResearchPayload() });
  if (dismissed > 0) showToast(`Dismissed ${dismissed} thread(s).`);
}

function openNextUnqueuedThreads(limit = 5) {
  const { filtered } = getFilteredSortedThreads();
  const selectedTargets = filtered.filter((t) => selectedThreadIds.has(t.id) && t.url);
  const targets = selectedTargets.length > 0
    ? selectedTargets.slice(0, 8)
    : filtered.filter((t) => t.status !== 'queued' && t.url).slice(0, limit);

  const urls = targets.map((t) => t.url).filter((u) => typeof u === 'string' && u.startsWith('http'));
  if (urls.length === 0) {
    showToast('No unqueued or selected thread URLs to open.', 'error');
    return;
  }
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
    showToast(`Opened ${urls.length} thread tab(s) for exploration!`);
  } else {
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
    showToast(`Opened ${urls.length} thread tab(s)!`);
  }
}

function renderDiscoveredThreads() {
  const inbox = document.getElementById('res-threads-inbox');
  const paginationEl = document.getElementById('res-threads-pagination');
  const showMoreBtn = document.getElementById('btn-threads-show-more');
  const badge = document.getElementById('nav-research-badge');
  const feedTabBadge = document.getElementById('opp-feed-tab-badge');
  const statsEl = document.getElementById('res-threads-stats');
  const lastPolledEl = document.getElementById('res-last-polled');
  const netTabsEl = document.getElementById('res-network-filter-tabs');
  const rc = getCampaignResearchConfig();
  const { activeThreads, filtered } = getFilteredSortedThreads();
  const { completedUrlsSet } = getActiveSuppressionAndCompletedSets();
  const visibleSlice = filtered.slice(0, visibleThreadsLimit);

  if (badge) {
    badge.textContent = activeThreads.length;
    badge.classList.toggle('hidden', activeThreads.length === 0);
  }
  if (feedTabBadge) {
    feedTabBadge.textContent = activeThreads.length;
    feedTabBadge.classList.toggle('hidden', activeThreads.length === 0);
  }
  if (statsEl) {
    const highIntent = activeThreads.filter((t) => computeLocalThreadIntentScore(t) >= 60).length;
    const queued = activeThreads.filter((t) => t.status === 'queued').length;
    statsEl.textContent = `${activeThreads.length} active · ${highIntent} high intent · ${queued} queued`;
  }
  if (lastPolledEl) {
    lastPolledEl.textContent = rc.lastPolledAt
      ? `Last fetched ${new Date(rc.lastPolledAt).toLocaleString()} • Showing ${visibleSlice.length} of ${filtered.length} matching (${activeThreads.length} total)`
      : 'Select platforms & timeframe above, then click Fetch Feed.';
  }

  if (netTabsEl) {
    if (activeThreads.length === 0) {
      netTabsEl.innerHTML = '';
    } else {
      const counts = {};
      activeThreads.forEach((t) => {
        const plat = String(t.platform || 'web').toLowerCase();
        counts[plat] = (counts[plat] || 0) + 1;
      });
      const labelMap = Object.fromEntries(RESEARCH_PLATFORMS_META.map((m) => [m.key, m.label]));
      const allActive = dashSelectedNetworkTabs.size === 0;
      netTabsEl.innerHTML = [
        `<button type="button" onclick="toggleNetworkFilterTab('all')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${allActive ? 'bg-[#fdcb6e] text-[#2a2d36] border-[#2a2d36]' : 'bg-white text-[#57606f] border-[#dfd8cc] hover:bg-[#FAF4EB]'}">All (${activeThreads.length})</button>`,
        ...Object.entries(counts).map(([plat, cnt]) => {
          const active = dashSelectedNetworkTabs.has(plat);
          return `<button type="button" data-net="${escapeHtml(plat)}" onclick="toggleNetworkFilterTab(this.getAttribute('data-net'))" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${active ? 'bg-[#6c5ce7] text-white border-[#6c5ce7]' : 'bg-white text-[#57606f] border-[#dfd8cc] hover:bg-[#FAF4EB]'}">${escapeHtml(labelMap[plat] || plat)} (${cnt})</button>`;
        }),
      ].join('');
    }
  }

  updateThreadSelectionToolbar(visibleSlice);
  if (!inbox) return;

  if (paginationEl) {
    const remaining = Math.max(0, filtered.length - visibleSlice.length);
    paginationEl.classList.toggle('hidden', remaining === 0);
    if (showMoreBtn && remaining > 0) {
      showMoreBtn.textContent = `Show More Results (+${Math.min(50, remaining)} of ${remaining} remaining)`;
    }
  }

  if (visibleSlice.length === 0) {
    inbox.innerHTML = `<div class="py-10 text-center text-xs text-[#747d8c]">No matching results. Adjust filters or click <strong>Fetch Feed</strong> above.</div>`;
    return;
  }

  // Compact result rows (no description snippet)
  inbox.innerHTML = visibleSlice.map((t) => {
    const score = computeLocalThreadIntentScore(t);
    const isGoogleAlert = String(t.source || '').toLowerCase().includes('google alerts');
    const isChecked = selectedThreadIds.has(t.id);
    const isCompleted = completedUrlsSet.has(normalizeTargetUrlForMatch(t.url));
    return `
    <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#FAF4EB]/80 bg-white">
      <div class="flex items-start gap-3 min-w-0 flex-1">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleThreadSelection('${escapeHtml(t.id)}', this.checked)" class="accent-[#6c5ce7] mt-1 shrink-0 cursor-pointer">
        <div class="min-w-0 space-y-1 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">${escapeHtml(t.platform || 'web')}</span>
            ${score >= 60 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">High Intent ${score}</span>` : ''}
            ${isGoogleAlert ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">Google Alert</span>` : ''}
            ${isCompleted ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Already Posted ✓</span>` : ''}
            <span class="text-[11px] font-medium text-[#57606f]">Matched: <strong class="text-[#1e222a]">${escapeHtml(t.matchedTerm || '')}</strong></span>
            <span class="text-[11px] text-[#747d8c]">${t.publishedAt ? new Date(t.publishedAt).toLocaleDateString() : ''}</span>
          </div>
          <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-[#1e222a] hover:text-[#6c5ce7] block truncate">${escapeHtml(t.title)}</a>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0 pl-6 sm:pl-0">
        <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px]">Open</a>
        <button type="button" onclick="openDashboardSaveFeedBar('${escapeHtml(t.id)}')" title="Save to Saved Feeds" class="sp-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px]"><i class="fas fa-bookmark text-[#6c5ce7]"></i></button>
        ${t.status === 'queued'
          ? `<span class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Queue ✓</span>`
          : `<button type="button" onclick="sendThreadToQueue('${escapeHtml(t.id)}')" class="sp-btn-primary px-3 py-1.5 rounded-lg text-[11px]">+ Opportunity Queue</button>`}
        <button type="button" onclick="dismissThread('${escapeHtml(t.id)}')" title="Dismiss" class="text-[#747d8c] hover:text-red-600 p-1.5 text-xs"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `;
  }).join('');
}

// ============================================================================
// 4. Directories Table (Admin Catalog + Bookmarks + Custom User Add)
// ============================================================================
async function loadDirectoriesCatalog() {
  try {
    const token = state.session?.accessToken || state.session?.token || '';
    const res = await fetch('/api/directories', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.directories)) {
      state.adminDirectories = data.directories;
      state.directoriesPreview = false;
      state.directoriesTotalCount = Number(data.totalCount || data.directories.length);
    }
  } catch (_) {}
}

function parseDirectoryTags(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;|]/);
  const seen = new Set();
  const tags = [];
  list.forEach((item) => {
    const t = String(item || '').trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(t);
  });
  return tags;
}

function getDirectoryTags(d) {
  if (!d) return [];
  const tags = parseDirectoryTags(d.tags);
  return tags;
}

function deriveDirNameFromUrl(rawUrl) {
  try {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const host = new URL(normalized).hostname.replace(/^www\./i, '');
    const label = host.split('.')[0] || host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch (_) {
    return rawUrl;
  }
}

function normalizeDirectoryUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname || !u.hostname.includes('.')) return '';
    return u.toString();
  } catch (_) {
    return '';
  }
}

function parseBulkDirectoryLines(rawText, sharedTagsRaw = '') {
  const sharedTags = parseDirectoryTags(sharedTagsRaw);
  const items = [];
  const seenUrls = new Set();

  String(rawText || '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line.includes('|')
      ? line.split('|').map((s) => s.trim())
      : (line.includes(',') ? line.split(',').map((s) => s.trim()) : [line]);

    let name = '';
    let urlRaw = '';
    let lineTags = [];

    if (parts.length === 1) {
      urlRaw = parts[0];
    } else {
      const urlIdx = parts.findIndex((p) => /^https?:\/\//i.test(p) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(p));
      if (urlIdx === 0) {
        urlRaw = parts[0];
        lineTags = parseDirectoryTags(parts.slice(1));
      } else if (urlIdx > 0) {
        name = parts[0];
        urlRaw = parts[urlIdx];
        lineTags = parseDirectoryTags(parts.slice(urlIdx + 1));
      } else {
        name = parts[0];
        urlRaw = parts[1] || '';
        lineTags = parseDirectoryTags(parts.slice(2));
      }
    }

    const url = normalizeDirectoryUrl(urlRaw);
    if (!url) return;
    const key = url.toLowerCase().replace(/\/+$/, '');
    if (seenUrls.has(key)) return;
    seenUrls.add(key);

    items.push({
      name: name || deriveDirNameFromUrl(url),
      url,
      tags: parseDirectoryTags([...lineTags, ...sharedTags]),
    });
  });

  return items;
}

function getDirectoryDr(d) {
  const n = Number(d?.domain_rating);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getDirectoryAddedTimestamp(d) {
  const candidates = [d?.created_at, d?.createdAt, d?.added_at, d?.addedAt];
  for (const raw of candidates) {
    if (raw) {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  const idMatch = String(d?.id || '').match(/^custom-dir-(\d{10,})/);
  if (idMatch) {
    const idTs = Number(idMatch[1]);
    if (Number.isFinite(idTs) && idTs > 0) return idTs;
  }
  const fallback = Date.parse(d?.updated_at || d?.updatedAt || '');
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

function formatDirectoryAddedDate(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  try {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return '—';
  }
}

function formatDirectoryAddedDateFull(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  try {
    return new Date(ms).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return '';
  }
}

function getDirectoryCategoryTags(d) {
  const dr = getDirectoryDr(d);
  const tags = [];
  if (dr > 50) tags.push('Legacy');
  else if (dr > 0) tags.push('Popular');
  else tags.push('New');
  if (d?.isCustom) tags.push('My custom');
  return tags;
}

function matchesDirectoryCategory(d, tagFilter) {
  const dr = getDirectoryDr(d);
  if (tagFilter === 'legacy') return dr > 50;
  if (tagFilter === 'popular') return dr > 0 && dr <= 50;
  if (tagFilter === 'new') return dr <= 0;
  if (tagFilter === 'custom') return Boolean(d?.isCustom);
  return true;
}

function setDirectoryTagFilter(tag) {
  const nextTag = String(tag || 'all').toLowerCase();
  const allowed = new Set(['all', 'legacy', 'popular', 'new', 'custom']);
  state.dirTagFilter = allowed.has(nextTag) ? nextTag : 'all';
  if (state.dirTagFilter === 'new') {
    if (state.dirSort !== 'date-desc' && state.dirSort !== 'date-asc') {
      state.dirSort = 'date-desc';
    }
  } else if (state.dirSort === 'date-desc' || state.dirSort === 'date-asc') {
    state.dirSort = 'dr-desc';
  }
  renderDirectoriesTable();
}

function setDirectorySort(sortVal) {
  const isNewFilter = (state.dirTagFilter || 'all').toLowerCase() === 'new';
  if (isNewFilter) {
    state.dirSort = sortVal === 'date-asc' ? 'date-asc' : 'date-desc';
  } else {
    state.dirSort = sortVal === 'dr-asc' ? 'dr-asc' : 'dr-desc';
  }
  renderDirectoriesTable();
}

function toggleDirectoryColumnSort() {
  const isNewFilter = (state.dirTagFilter || 'all').toLowerCase() === 'new';
  if (isNewFilter) {
    state.dirSort = state.dirSort === 'date-desc' ? 'date-asc' : 'date-desc';
  } else {
    state.dirSort = state.dirSort === 'dr-desc' ? 'dr-asc' : 'dr-desc';
  }
  renderDirectoriesTable();
}

function renderDirectorySortControls() {
  const isNewFilter = (state.dirTagFilter || 'all').toLowerCase() === 'new';
  const expectedMode = isNewFilter ? 'new' : 'dr';
  if (isNewFilter && state.dirSort !== 'date-desc' && state.dirSort !== 'date-asc') {
    state.dirSort = 'date-desc';
  } else if (!isNewFilter && state.dirSort !== 'dr-desc' && state.dirSort !== 'dr-asc') {
    state.dirSort = 'dr-desc';
  }

  const selectEl = document.getElementById('dir-sort-select');
  if (selectEl) {
    if (selectEl.dataset.sortMode !== expectedMode) {
      selectEl.dataset.sortMode = expectedMode;
      selectEl.innerHTML = isNewFilter
        ? '<option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option>'
        : '<option value="dr-desc">DR: High to Low</option><option value="dr-asc">DR: Low to High</option>';
    }
    if (selectEl.value !== state.dirSort) {
      selectEl.value = state.dirSort;
    }
    syncCustomSelect(selectEl);
  }

  const colLabel = document.getElementById('dir-sort-col-label');
  if (colLabel) colLabel.textContent = isNewFilter ? 'Added' : 'DR';
  const colIcon = document.getElementById('dir-sort-col-icon');
  if (colIcon) {
    const isAsc = state.dirSort === 'dr-asc' || state.dirSort === 'date-asc';
    colIcon.className = `fas ${isAsc ? 'fa-sort-up' : 'fa-sort-down'} text-[10px] text-[#6c5ce7]`;
  }
}

function renderDirectoryTagFilters() {
  const container = document.getElementById('dir-tag-filters');
  if (!container) return;

  const active = (state.dirTagFilter || 'all').toLowerCase();
  const activeCls = 'dir-tag-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] shadow-[1px_1px_0px_rgba(42,45,54,0.72)]';
  const idleCls = 'dir-tag-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#dfd8cc] text-[#57606f] hover:bg-[#FAF4EB]';

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'legacy', label: 'Legacy' },
    { key: 'popular', label: 'Popular' },
    { key: 'new', label: 'New' },
    { key: 'custom', label: 'My custom' },
  ];

  container.innerHTML = categories.map(({ key, label }) => {
    const isSelected = active === key;
    return `<button type="button" class="${isSelected ? activeCls : idleCls}" data-tag="${key}" onclick="setDirectoryTagFilter('${key}')">${label}</button>`;
  }).join('');
}

function toggleBookmarkedOnlyFilter() {
  state.dirBookmarkedOnly = !state.dirBookmarkedOnly;
  const btn = document.getElementById('btn-dir-bookmarked-only');
  if (btn) {
    btn.className = state.dirBookmarkedOnly
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold border border-[#e6b85c] bg-[#fef7e7] text-[#854d0e]'
      : 'sp-btn-secondary px-3 py-1.5 rounded-lg text-xs';
  }
  renderDirectoriesTable();
}

function toggleDirectoryBookmark(id) {
  const list = state.directoryPrefs.bookmarkedIds || (state.directoryPrefs.bookmarkedIds = []);
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  renderDirectoriesTable();
  persistStateToBridgeAndLocal({ directoryPrefs: state.directoryPrefs });
}

function updateCustomBulkCount() {
  const countEl = document.getElementById('custom-dir-bulk-count');
  if (!countEl) return;
  const parsed = parseBulkDirectoryLines(
    document.getElementById('custom-dir-bulk-urls')?.value || '',
    document.getElementById('custom-dir-bulk-tags')?.value || ''
  );
  countEl.textContent = `${parsed.length} link${parsed.length === 1 ? '' : 's'} detected`;
}

function switchCustomDirMode(mode) {
  const isBulk = mode === 'bulk';
  const modeEl = document.getElementById('custom-dir-mode');
  if (modeEl) modeEl.value = isBulk ? 'bulk' : 'single';
  document.getElementById('custom-dir-single-fields')?.classList.toggle('hidden', isBulk);
  document.getElementById('custom-dir-bulk-fields')?.classList.toggle('hidden', !isBulk);

  const nameEl = document.getElementById('custom-dir-name');
  const urlEl = document.getElementById('custom-dir-url');
  if (nameEl) nameEl.required = !isBulk;
  if (urlEl) urlEl.required = !isBulk;

  const singleTab = document.getElementById('custom-dir-tab-single');
  const bulkTab = document.getElementById('custom-dir-tab-bulk');
  const activeTabCls = 'px-3 py-1.5 rounded-md text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] shadow-[1px_1px_0px_rgba(42,45,54,0.72)] transition';
  const idleTabCls = 'px-3 py-1.5 rounded-md text-xs font-semibold text-[#57606f] hover:text-[#1e222a] transition';
  if (singleTab) singleTab.className = !isBulk ? activeTabCls : idleTabCls;
  if (bulkTab) bulkTab.className = isBulk ? activeTabCls : idleTabCls;

  const titleEl = document.getElementById('custom-dir-modal-title');
  if (titleEl) titleEl.textContent = isBulk ? 'Bulk Add Custom Directories' : 'Add Custom Directory';
  const submitBtn = document.getElementById('custom-dir-submit-btn');
  if (submitBtn) submitBtn.textContent = isBulk ? 'Add Directories' : 'Add Directory';
  if (isBulk) updateCustomBulkCount();
}

function openCustomDirectoryModal(mode = 'single') {
  document.getElementById('custom-dir-name').value = '';
  document.getElementById('custom-dir-url').value = '';
  const tagsEl = document.getElementById('custom-dir-tags');
  if (tagsEl) tagsEl.value = '';
  document.getElementById('custom-dir-desc').value = '';
  const bulkUrlsEl = document.getElementById('custom-dir-bulk-urls');
  if (bulkUrlsEl) bulkUrlsEl.value = '';
  const bulkTagsEl = document.getElementById('custom-dir-bulk-tags');
  if (bulkTagsEl) bulkTagsEl.value = '';
  switchCustomDirMode(mode === 'bulk' ? 'bulk' : 'single');
  document.getElementById('custom-dir-modal')?.classList.remove('hidden');
}

function saveCustomDirectory(e) {
  e.preventDefault();
  const mode = document.getElementById('custom-dir-mode')?.value || 'single';
  const existing = state.directoryPrefs.customDirectories || (state.directoryPrefs.customDirectories = []);
  const bookmarks = state.directoryPrefs.bookmarkedIds || (state.directoryPrefs.bookmarkedIds = []);

  if (mode === 'bulk') {
    const parsed = parseBulkDirectoryLines(
      document.getElementById('custom-dir-bulk-urls')?.value || '',
      document.getElementById('custom-dir-bulk-tags')?.value || ''
    );
    if (parsed.length === 0) {
      showToast('Please paste at least one valid directory URL.', 'error');
      return;
    }

    const existingUrlSet = new Set(
      existing.map((d) => String(d.url || '').trim().toLowerCase().replace(/\/+$/, ''))
    );
    const now = Date.now();
    let addedCount = 0;

    parsed.slice().reverse().forEach((entry, idx) => {
      const urlKey = entry.url.toLowerCase().replace(/\/+$/, '');
      if (existingUrlSet.has(urlKey)) return;
      existingUrlSet.add(urlKey);
      const item = {
        id: `custom-dir-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: entry.name,
        url: entry.url,
        tags: entry.tags,
        description: '',
        domain_rating: 0,
        isCustom: true,
        created_at: new Date(now).toISOString(),
      };
      existing.unshift(item);
      if (!bookmarks.includes(item.id)) bookmarks.push(item.id);
      addedCount++;
    });

    document.getElementById('custom-dir-modal')?.classList.add('hidden');
    renderDirectoriesTable();
    persistStateToBridgeAndLocal({ directoryPrefs: state.directoryPrefs });
    showToast(addedCount > 0 ? `Added ${addedCount} custom director${addedCount === 1 ? 'y' : 'ies'}!` : 'Those directory links are already in your list.');
    return;
  }

  const rawUrl = document.getElementById('custom-dir-url').value.trim();
  const normalizedUrl = normalizeDirectoryUrl(rawUrl) || rawUrl;
  const nowIso = new Date().toISOString();
  const item = {
    id: 'custom-dir-' + Date.now(),
    name: document.getElementById('custom-dir-name').value.trim() || deriveDirNameFromUrl(normalizedUrl),
    url: normalizedUrl,
    tags: parseDirectoryTags(document.getElementById('custom-dir-tags')?.value || ''),
    description: document.getElementById('custom-dir-desc').value.trim(),
    domain_rating: 0,
    isCustom: true,
    created_at: nowIso,
  };
  existing.unshift(item);
  if (!bookmarks.includes(item.id)) {
    bookmarks.push(item.id);
  }
  document.getElementById('custom-dir-modal')?.classList.add('hidden');
  renderDirectoriesTable();
  persistStateToBridgeAndLocal({ directoryPrefs: state.directoryPrefs });
  showToast(`Added "${item.name}" to your directories!`);
}

function deleteCustomDirectory(id) {
  state.directoryPrefs.customDirectories = state.directoryPrefs.customDirectories.filter((d) => d.id !== id);
  state.directoryPrefs.bookmarkedIds = state.directoryPrefs.bookmarkedIds.filter((b) => b !== id);
  renderDirectoriesTable();
  persistStateToBridgeAndLocal({ directoryPrefs: state.directoryPrefs });
}

const selectedDirectoryIds = new Set();

function updateDirectorySelectionToolbar() {
  const visibleDirs = Array.isArray(state.lastSortedDirectories) ? state.lastSortedDirectories : [];
  const visibleIds = new Set(visibleDirs.map((d) => d.id));
  Array.from(selectedDirectoryIds).forEach((id) => {
    if (!visibleIds.has(id)) selectedDirectoryIds.delete(id);
  });
  const count = selectedDirectoryIds.size;
  const qBtn = document.getElementById('btn-dir-queue-selected');
  if (qBtn) {
    qBtn.disabled = count === 0;
    qBtn.innerHTML = count > 0
      ? `<i class="fas fa-plus mr-1"></i> Queue Selected (${count})`
      : `<i class="fas fa-plus mr-1"></i> Queue Selected`;
  }
  const selectAllEl = document.getElementById('dir-select-all');
  if (selectAllEl) {
    selectAllEl.checked = visibleDirs.length > 0 && visibleDirs.every((d) => selectedDirectoryIds.has(d.id));
  }
}

function toggleDirectorySelection(dirId, checked) {
  if (checked) selectedDirectoryIds.add(dirId);
  else selectedDirectoryIds.delete(dirId);
  updateDirectorySelectionToolbar();
}

function toggleSelectAllDirectories(checked) {
  const visibleDirs = Array.isArray(state.lastSortedDirectories) ? state.lastSortedDirectories : [];
  if (checked) visibleDirs.forEach((d) => selectedDirectoryIds.add(d.id));
  else selectedDirectoryIds.clear();
  renderDirectoriesTable();
}

function queueSelectedDirectories() {
  const b = getActiveBrand();
  if (!b || selectedDirectoryIds.size === 0) return;
  const all = [
    ...(state.directoryPrefs.customDirectories || []),
    ...(state.adminDirectories || []),
  ];
  if (!Array.isArray(b.queue)) b.queue = [];
  const existing = new Set(
    b.queue.map((i) => String(i?.url || '').split('#')[0].replace(/\/+$/, '').toLowerCase()).filter(Boolean)
  );
  let addedCount = 0;
  all.forEach((d) => {
    if (!d || !selectedDirectoryIds.has(d.id) || !d.url) return;
    const norm = String(d.url).split('#')[0].replace(/\/+$/, '').toLowerCase();
    if (!existing.has(norm)) {
      existing.add(norm);
      b.queue.unshift({
        id: 'dir_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        url: d.url,
        title: d.name || d.url,
        platform: 'directory',
        status: 'queued',
        savedAt: new Date().toISOString(),
      });
      addedCount++;
    }
  });
  selectedDirectoryIds.clear();
  if (addedCount > 0) {
    b.updatedAt = new Date().toISOString();
    delete b.isUntouchedDefault;
    persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles });
  }
  renderDirectoriesTable();
  showToast(`Added ${addedCount || 'selected'} director${addedCount === 1 ? 'y' : 'ies'} to Opportunity Queue!`);
}

function renderDirectoriesTable() {
  const tbody = document.getElementById('directories-table-body');
  if (!tbody) return;
  const q = (document.getElementById('dir-table-search')?.value || '').trim().toLowerCase();
  const bookmarks = new Set(state.directoryPrefs.bookmarkedIds || []);
  const combined = [
    ...(state.directoryPrefs.customDirectories || []),
    ...(state.adminDirectories || []),
  ];

  renderDirectoryTagFilters();
  renderDirectorySortControls();
  const tagFilter = (state.dirTagFilter || 'all').toLowerCase();

  const filtered = combined.filter((d) => {
    if (!matchesDirectoryCategory(d, tagFilter)) return false;
    if (state.dirBookmarkedOnly && !bookmarks.has(d.id)) return false;
    const categoryTags = getDirectoryCategoryTags(d);
    if (q && !(d.name + ' ' + d.url + ' ' + (d.description || '') + ' ' + categoryTags.join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    state.lastSortedDirectories = [];
    updateDirectorySelectionToolbar();
    tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-[#747d8c]">No directories match the current filters.</td></tr>`;
    return;
  }

  const sortMode = state.dirSort || (tagFilter === 'new' ? 'date-desc' : 'dr-desc');
  const sorted = [...filtered].sort((a, b) => {
    const aDr = getDirectoryDr(a);
    const bDr = getDirectoryDr(b);
    const aTs = getDirectoryAddedTimestamp(a);
    const bTs = getDirectoryAddedTimestamp(b);

    if (sortMode === 'date-desc') {
      if (bTs !== aTs) return bTs - aTs;
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (sortMode === 'date-asc') {
      if (aTs !== bTs) return aTs - bTs;
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (sortMode === 'dr-asc') {
      if ((aDr > 0) !== (bDr > 0)) return aDr > 0 ? -1 : 1;
      if (aDr !== bDr) return aDr - bDr;
      if (bTs !== aTs) return bTs - aTs;
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    // default: dr-desc
    if ((aDr > 0) !== (bDr > 0)) return aDr > 0 ? -1 : 1;
    if (bDr !== aDr) return bDr - aDr;
    if (bTs !== aTs) return bTs - aTs;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  state.lastSortedDirectories = sorted;
  const b = getActiveBrand();
  const queuedDirUrls = new Set(
    (b?.queue || [])
      .filter((i) => i && i.url)
      .map((i) => String(i.url).split('#')[0].replace(/\/+$/, '').toLowerCase())
  );
  const { completedUrlsSet } = getActiveSuppressionAndCompletedSets();

  const rowsHtml = sorted.map((d) => {
    const isStarred = bookmarks.has(d.id);
    const isSelected = selectedDirectoryIds.has(d.id);
    const dr = getDirectoryDr(d);
    const addedMs = getDirectoryAddedTimestamp(d);
    const addedDate = formatDirectoryAddedDate(addedMs);
    const addedDateFull = formatDirectoryAddedDateFull(addedMs);
    const categoryTags = getDirectoryCategoryTags(d);
    const normUrl = String(d.url || '').split('#')[0].replace(/\/+$/, '').toLowerCase();
    const isQueued = normUrl && queuedDirUrls.has(normUrl);
    const isSubmitted = completedUrlsSet.has(normalizeTargetUrlForMatch(d.url));
    const tagsHtml = categoryTags.length
      ? `<div class="flex flex-wrap gap-1">${categoryTags.map((t) => `<span class="px-2 py-0.5 rounded-md bg-[#FAF4EB] border border-[#dfd8cc] text-[10px] font-semibold text-[#57606f]">${escapeHtml(t)}</span>`).join('')}</div>`
      : '<span class="text-[#747d8c]">—</span>';
    const drOrDateHtml = dr > 0
      ? `DR ${dr}`
      : `<span class="text-[11px] font-semibold text-[#57606f]"${addedDateFull ? ` title="Added ${escapeHtml(addedDateFull)}"` : ''}>${escapeHtml(addedDate)}</span>`;
    return `
      <tr class="hover:bg-[#FAF4EB]/80">
        <td class="py-3 px-3 text-center">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleDirectorySelection('${escapeHtml(d.id)}', this.checked)" class="accent-[#6c5ce7] cursor-pointer">
        </td>
        <td class="py-3 px-4 text-center">
          <button type="button" onclick="toggleDirectoryBookmark('${escapeHtml(d.id)}')" title="${isStarred ? 'Remove bookmark' : 'Bookmark directory'}" class="text-base ${isStarred ? 'text-amber-500' : 'text-[#d5cdc0] hover:text-amber-400'}">
            <i class="${isStarred ? 'fas' : 'far'} fa-star"></i>
          </button>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-[#1e222a]">${escapeHtml(d.name)}</span>
            ${d.isCustom ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">Custom</span>' : ''}
            ${isSubmitted ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Submitted ✓</span>' : ''}
          </div>
          <div class="text-[11px] text-[#57606f] mt-0.5">${escapeHtml(d.description || d.url)}</div>
        </td>
        <td class="py-3 px-4">${tagsHtml}</td>
        <td class="py-3 px-4 text-right font-mono-tabular font-bold text-[#1e222a]">${drOrDateHtml}</td>
        <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
          ${isQueued
            ? `<span class="inline-flex items-center px-2 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Queue ✓</span>`
            : `<button type="button" onclick="queueDirectoryToCampaign('${escapeHtml(d.id)}')" class="sp-btn-secondary inline-flex items-center px-2 py-1 rounded text-[11px]" title="Add to campaign Opportunity Queue">+ Queue</button>`}
          <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer" class="sp-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs">Open <i class="fas fa-arrow-up-right-from-square text-[10px]"></i></a>
          ${d.isCustom ? `<button type="button" onclick="deleteCustomDirectory('${escapeHtml(d.id)}')" class="text-red-600 hover:underline font-semibold">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
  updateDirectorySelectionToolbar();
}

function queueDirectoryToCampaign(dirId) {
  const b = getActiveBrand();
  if (!b) return;
  const all = [
    ...(state.directoryPrefs.customDirectories || []),
    ...(state.adminDirectories || []),
  ];
  const d = all.find((item) => item && item.id === dirId);
  if (!d || !d.url) return;
  if (!Array.isArray(b.queue)) b.queue = [];
  const normUrl = String(d.url).split('#')[0].replace(/\/+$/, '').toLowerCase();
  if (!b.queue.some((i) => String(i?.url || '').split('#')[0].replace(/\/+$/, '').toLowerCase() === normUrl)) {
    b.queue.unshift({
      id: 'dir_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: d.url,
      title: d.name || d.url,
      platform: 'directory',
      status: 'queued',
      savedAt: new Date().toISOString(),
    });
    b.updatedAt = new Date().toISOString();
    delete b.isUntouchedDefault;
    persistStateToBridgeAndLocal({ brandProfiles: state.brandProfiles });
  }
  renderDirectoriesTable();
  showToast(`Added "${d.name}" to product Opportunity Queue!`);
}

function openNextDirectoryTabs(limit = 5) {
  const b = getActiveBrand();
  const queuedUrls = new Set(
    (b?.queue || [])
      .filter((i) => i && i.url)
      .map((i) => String(i.url).split('#')[0].replace(/\/+$/, '').toLowerCase())
  );
  const candidates = (state.lastSortedDirectories || [])
    .filter((d) => {
      if (!d?.url || !d.url.startsWith('http')) return false;
      const norm = String(d.url).split('#')[0].replace(/\/+$/, '').toLowerCase();
      return !queuedUrls.has(norm);
    })
    .slice(0, limit);
  const urls = candidates.map((d) => d.url);
  if (urls.length === 0) {
    showToast('No unqueued directories match the current filters.', 'error');
    return;
  }
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls });
    showToast(`Opened ${urls.length} directory tab(s)!`);
  } else {
    urls.forEach((u) => window.open(u, '_blank'));
    showToast(`Opened ${urls.length} directory tab(s)!`);
  }
}

function discoverNewDirectoriesSearch() {
  const query = '("submit a tool" OR "submit your site" OR "submit website" OR "add your tool" OR "list your product") (directory OR "ai tools" OR launchpad) "free" -inurl:blog -inurl:news -site:reddit.com -site:medium.com -site:youtube.com -site:substack.com';
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:w`;
  if (state.extInstalled) {
    bridgeCall('LAUNCH_RADAR_URLS', { urls: [url] });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ============================================================================
// 5. Reports View (NO Insert Buttons)
// ============================================================================
function setReportsFilter(mod) {
  state.reportsFilter = mod;
  document.querySelectorAll('.rep-filter-btn').forEach((btn) => {
    const active = btn.dataset.mod === mod;
    btn.className = active
      ? 'rep-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] shadow-[1px_1px_0px_rgba(42,45,54,0.72)]'
      : 'rep-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#dfd8cc] text-[#57606f] hover:bg-[#FAF4EB]';
  });
  renderReportsView();
}

function renderReportsView() {
  const logs = state.masterLogs || [];
  document.getElementById('rep-stat-total').textContent = logs.length;
  document.getElementById('rep-stat-dir').textContent = logs.filter((l) => l.module === 'directory').length;
  document.getElementById('rep-stat-contact').textContent = logs.filter((l) => l.module === 'contact').length;
  document.getElementById('rep-stat-email').textContent = logs.filter((l) => l.module === 'email').length;
  document.getElementById('rep-stat-social').textContent = logs.filter((l) => ['social', 'commenter', 'twitter'].includes(l.module)).length;

  const tbody = document.getElementById('reports-ledger-tbody');
  const q = (document.getElementById('rep-search-input')?.value || '').trim().toLowerCase();
  const filtered = logs.filter((l) => {
    if (state.reportsFilter !== 'all') {
      if (state.reportsFilter === 'social') {
        if (!['social', 'commenter', 'twitter'].includes(l.module)) return false;
      } else if (l.module !== state.reportsFilter) {
        return false;
      }
    }
    if (q && !((l.targetUrl || '') + ' ' + (l.campaignName || '') + ' ' + (l.contentSnippet || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  if (tbody) {
    tbody.innerHTML = filtered.length === 0
      ? `<tr><td colspan="5" class="py-10 text-center text-[#747d8c]">No outreach logs recorded for this filter.</td></tr>`
      : filtered.slice(0, 150).map((l) => {
        const statusColor = l.status === 'failed' ? 'bg-red-50 text-red-700' : (l.status === 'suppressed' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700');
        return `
          <tr class="hover:bg-[#FAF4EB]/80">
            <td class="py-2.5 px-4 font-mono-tabular text-[11px] text-[#747d8c] whitespace-nowrap">${l.timestamp ? new Date(l.timestamp).toLocaleString() : ''}</td>
            <td class="py-2.5 px-4 uppercase font-bold text-[11px] text-[#1e222a]">${escapeHtml(l.module || 'general')}</td>
            <td class="py-2.5 px-4 font-mono text-[11px] text-[#6c5ce7] max-w-xs truncate"><a href="${escapeHtml(l.targetUrl || '#')}" target="_blank" class="hover:underline">${escapeHtml(l.targetUrl || '—')}</a></td>
            <td class="py-2.5 px-4 text-[#57606f] max-w-sm truncate">${escapeHtml(l.contentSnippet || l.campaignName || '')}</td>
            <td class="py-2.5 px-4 text-right"><span class="px-2 py-0.5 rounded font-bold text-[10px] uppercase ${statusColor}">${escapeHtml(l.status || 'success')}</span></td>
          </tr>
        `;
      }).join('');
  }

  // Global suppression list
  const supEl = document.getElementById('global-suppression-list');
  if (supEl) {
    supEl.innerHTML = state.suppressionList.length === 0
      ? `<div class="text-xs text-[#747d8c]">No globally suppressed domains.</div>`
      : state.suppressionList.map((d, idx) => {
        const label = typeof d === 'string' ? d : (d && typeof d === 'object' ? (d.type === 'thread' ? (d.url || d.domain) : (d.domain || d.url)) : '');
        return `
        <div class="flex items-center justify-between px-3 py-1.5 bg-[#FAF4EB] border border-[#dfd8cc] rounded text-xs font-mono text-[#1e222a]">
          <span class="truncate" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <button type="button" onclick="removeGlobalSuppression(${idx})" class="text-red-600 hover:underline ml-2 shrink-0">Remove</button>
        </div>
      `;
      }).join('');
  }

  // Error logs
  const errEl = document.getElementById('ext-error-logs-list');
  if (errEl) {
    errEl.innerHTML = state.errorLogs.length === 0
      ? `<div class="text-[#747d8c] py-4 text-center">No errors logged. All systems operational.</div>`
      : state.errorLogs.slice(0, 40).map((e) => `
        <div class="p-2 rounded bg-red-50/70 border border-red-200 text-red-900">
          <div class="font-bold">${escapeHtml(e.message || 'Error')}</div>
          <div class="text-[10px] text-red-700 truncate">${escapeHtml(e.domain || '')} • ${e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}</div>
        </div>
      `).join('');
  }
}

function exportReportsCsv() {
  const rows = [['Timestamp', 'Module', 'Target URL', 'Product', 'Snippet', 'Status']];
  (state.masterLogs || []).forEach((l) => {
    rows.push([
      l.timestamp || '',
      l.module || '',
      l.targetUrl || '',
      l.campaignName || '',
      (l.contentSnippet || '').replace(/[\r\n]+/g, ' '),
      l.status || '',
    ]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `smart-poster-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function clearReportsHistory() {
  if (!confirm('Clear outreach history logs?')) return;
  state.masterLogs = [];
  localStorage.removeItem('sp_master_logs');
  persistStateToBridgeAndLocal({ masterLogs: [], clearMasterLogs: true });
  renderReportsView();
}

function addGlobalSuppression() {
  const input = document.getElementById('global-suppress-input');
  const raw = (input?.value || '').trim();
  if (!raw) return;
  const entries = raw.split(/[\r\n,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return;

  const existing = new Set(
    (state.suppressionList || []).map((d) => String(typeof d === 'string' ? d : (d?.url || d?.domain || '')).trim().toLowerCase())
  );
  let added = 0;
  entries.forEach((entry) => {
    const key = entry.toLowerCase();
    if (!existing.has(key)) {
      existing.add(key);
      state.suppressionList.unshift(entry);
      added++;
    }
  });
  input.value = '';
  state.settings.updatedAt = new Date().toISOString();
  renderReportsView();
  renderSettingsSuppressionAndCompleted();
  persistStateToBridgeAndLocal({ suppressionList: state.suppressionList, settings: state.settings });
  if (typeof showToast === 'function') {
    showToast(added > 0 ? `Added ${added} rule${added > 1 ? 's' : ''} to Global Suppression` : 'Entries already suppressed');
  }
}

function removeGlobalSuppression(idx) {
  state.suppressionList.splice(idx, 1);
  state.settings.updatedAt = new Date().toISOString();
  renderReportsView();
  renderSettingsSuppressionAndCompleted();
  persistStateToBridgeAndLocal({ suppressionList: state.suppressionList, settings: state.settings });
}

function clearExtensionErrorLogs() {
  state.errorLogs = [];
  localStorage.removeItem('sp_error_logs');
  persistStateToBridgeAndLocal({ errorLogs: [], clearErrorLogs: true });
  renderReportsView();
}

// ============================================================================
// 6. Settings View (Full Two-Way Parity with Extension Settings)
// ============================================================================
const BASE_AI_MODELS = [
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku (Fast & Intelligent)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Balanced)' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ultra High Speed)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Open Source)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Budget Friendly)' },
  { id: 'mistralai/mistral-small', name: 'Mistral Small' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (High Quality)' },
];

const DEFAULT_RANDOMNESS_DICTS = `(app | tool | platform | software | utility)\n(founders | builders | creators | entrepreneurs | developers)\n(great | awesome | solid | fantastic | incredible)\n(quick | fast | rapid | instant)\n(laptop | mac | desktop | computer)`;

function toggleSettingsAccordion(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const body = card.querySelector('.settings-card-body');
  const chevron = card.querySelector('.settings-chevron');
  const btn = card.querySelector('button');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden', !isHidden);
  if (chevron) chevron.classList.toggle('rotate-180', isHidden);
  if (btn) btn.classList.toggle('rounded-xl', !isHidden);
  if (btn) btn.classList.toggle('rounded-t-xl', isHidden);
}

function togglePasswordVisibility(inputId, btnEl) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (btnEl) btnEl.textContent = show ? 'Hide' : 'Show';
}

function toggleApiKeyVisibility() {
  togglePasswordVisibility('ai-setting-apikey');
}

function populateDashboardAiModelSelect() {
  const modelEl = document.getElementById('ai-setting-model');
  if (!modelEl) return;
  const customModels = Array.isArray(state.settings?.customModels) ? state.settings.customModels : [];
  const activeVal = state.aiModel || 'anthropic/claude-3.5-haiku';

  modelEl.innerHTML = '';
  BASE_AI_MODELS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    modelEl.appendChild(opt);
  });

  if (customModels.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Custom Models';
    customModels.forEach((cm) => {
      const opt = document.createElement('option');
      opt.value = cm;
      opt.textContent = `Custom: ${cm}`;
      group.appendChild(opt);
    });
    modelEl.appendChild(group);
  }

  if (!Array.from(modelEl.options).some((o) => o.value === activeVal)) {
    const opt = document.createElement('option');
    opt.value = activeVal;
    opt.textContent = activeVal;
    modelEl.appendChild(opt);
  }
  modelEl.value = activeVal;
  syncCustomSelect(modelEl);
}

function renderDashboardCustomModelsChips() {
  const container = document.getElementById('setting-custom-models-chips');
  if (!container) return;
  const customModels = Array.isArray(state.settings?.customModels) ? state.settings.customModels : [];
  if (customModels.length === 0) {
    container.innerHTML = `<span class="text-[11px] text-[#747d8c]">No custom models added yet.</span>`;
    return;
  }
  container.innerHTML = customModels.map((model) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-[#FAF4EB] text-[#1e222a] border border-[#dfd8cc]">
      <span>${escapeHtml(model)}</span>
      <button type="button" onclick='removeDashboardCustomModel(${JSON.stringify(model)})' title="Remove custom model" class="text-[#747d8c] hover:text-red-600 font-bold leading-none">✕</button>
    </span>
  `).join('');
}

async function addDashboardCustomModel() {
  const input = document.getElementById('setting-custom-model-input');
  const val = (input?.value || '').trim();
  if (!val) {
    showToast('Enter a custom model ID (e.g. anthropic/claude-3-opus)', 'error');
    return;
  }
  const current = Array.isArray(state.settings?.customModels) ? [...state.settings.customModels] : [];
  if (!current.includes(val)) {
    current.push(val);
    state.settings.customModels = current;
    state.aiModel = val;
    if (input) input.value = '';
    populateDashboardAiModelSelect();
    renderDashboardCustomModelsChips();
    await saveAiSettingsFromDashboard(false);
    showToast(`Added custom model "${val}"`);
  } else if (input) {
    input.value = '';
  }
}

async function removeDashboardCustomModel(modelId) {
  const current = Array.isArray(state.settings?.customModels) ? state.settings.customModels : [];
  state.settings.customModels = current.filter((m) => m !== modelId);
  if (state.aiModel === modelId) {
    state.aiModel = 'anthropic/claude-3.5-haiku';
  }
  populateDashboardAiModelSelect();
  renderDashboardCustomModelsChips();
  await saveAiSettingsFromDashboard(false);
  showToast(`Removed model "${modelId}" from Dashboard & Extension`);
}

function handleDashboardAiModelChange(val) {
  state.aiModel = val || 'anthropic/claude-3.5-haiku';
  scheduleSettingsSync();
}

function toggleDashboardJevModelGroup() {
  const enabled = Boolean(document.getElementById('setting-jev-enabled')?.checked);
  const group = document.getElementById('setting-jev-model-group');
  if (group) group.classList.toggle('hidden', !enabled);
  syncCustomSelect('setting-jev-model');
}

const DASHBOARD_LEVEL_META = {
  1: {
    name: 'Strict',
    badge: '1 · Strict (Preset)',
    badgeClass: 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200',
    desc: 'Level 1 (Strict): 1–2 micro-tweaks (contractions & subtle swaps). Runs locally in 0ms.'
  },
  2: {
    name: 'Light',
    badge: '2 · Light (Preset)',
    badgeClass: 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200',
    desc: 'Level 2 (Light): 2–3 natural word & short phrase swaps. Runs locally in 0ms.'
  },
  3: {
    name: 'Neutral',
    badge: '3 · Neutral (Preset)',
    badgeClass: 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]',
    desc: 'Level 3 (Neutral · Default): 3–5 phrasing & paragraph rhythm shifts. Runs locally in 0ms.'
  },
  4: {
    name: 'Distinct',
    badge: '4 · Distinct (AI Pool ✦)',
    badgeClass: 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#fef7e7] text-[#92400e] border border-[#fcd34d]',
    desc: 'Level 4 (Distinct): AI structural rewrite with pre-warmed pool · exact pitch, voice & links locked.'
  },
  5: {
    name: 'Unique',
    badge: '5 · Unique (AI Pool ✦)',
    badgeClass: 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200',
    desc: 'Level 5 (Unique): AI bold hook re-angle & clause reordering · core pitch & links locked.'
  }
};

function migrateDashboardRandomnessLevel(rawLevel, alreadyMigrated = false) {
  const n = Number(rawLevel);
  if (!Number.isFinite(n)) return 3;
  const clamped = Math.max(1, Math.min(5, Math.round(n)));
  if (!alreadyMigrated && clamped === 2) return 3;
  return clamped;
}

function setDashboardRandomnessLevel(level, refreshSocialView = false) {
  const lvl = migrateDashboardRandomnessLevel(level, true);
  if (!state.settings) state.settings = {};
  state.settings.randomnessLevel = lvl;
  state.settings.sp_randomness_v2_migrated = true;
  const slider = document.getElementById('setting-randomness-level');
  if (slider && String(slider.value) !== String(lvl)) slider.value = String(lvl);
  updateDashboardRandomnessBadge(lvl);
  scheduleSettingsSync();
  if (refreshSocialView && typeof renderSocialWorkspace === 'function') {
    renderSocialWorkspace();
  }
}

function toggleDashboardAutoVariation(enabled) {
  if (!state.settings) state.settings = {};
  state.settings.autoVariation = Boolean(enabled);
  state.settings.sp_randomness_v2_migrated = true;
  scheduleSettingsSync();
  if (typeof renderSocialWorkspace === 'function') {
    renderSocialWorkspace();
  }
}

function updateDashboardRandomnessBadge(level) {
  const lvl = migrateDashboardRandomnessLevel(level, true);
  const meta = DASHBOARD_LEVEL_META[lvl] || DASHBOARD_LEVEL_META[3];
  const badge = document.getElementById('setting-randomness-badge');
  const desc = document.getElementById('setting-randomness-desc');
  if (badge) {
    badge.textContent = meta.badge;
    badge.className = meta.badgeClass;
  }
  if (desc) {
    desc.textContent = meta.desc;
  }
  const pillContainer = document.getElementById('setting-randomness-pills');
  if (pillContainer) {
    pillContainer.querySelectorAll('.dash-rand-pill').forEach((btn) => {
      const isActive = Number(btn.dataset.level) === lvl;
      btn.className = isActive
        ? 'dash-rand-pill px-2 py-1.5 rounded-lg text-[11px] font-bold bg-white text-[#5b4bc4] shadow-sm border border-[#d4cdfc] transition'
        : 'dash-rand-pill px-2 py-1.5 rounded-lg text-[11px] font-bold text-[#57606f] hover:text-[#1e222a] transition';
    });
  }
}

function resolveSpinTextForDashboard(rawText, overrideLevel = null) {
  const level = migrateDashboardRandomnessLevel(
    overrideLevel ?? document.getElementById('setting-randomness-level')?.value ?? state.settings?.randomnessLevel ?? 3,
    true
  );
  const synonymsOn = document.getElementById('setting-randomness-synonyms')
    ? document.getElementById('setting-randomness-synonyms').checked !== false
    : state.settings?.randomnessSynonyms !== false;
  const dictText = document.getElementById('setting-randomness-dict')?.value || state.settings?.randomnessDicts || '';

  let out = String(rawText || '');
  // 1. Spin-tax {a|b}
  let guard = 0;
  while (/\{([^{}]+)\}/.test(out) && guard < 30) {
    guard++;
    out = out.replace(/\{([^{}]+)\}/, (_, choices) => {
      const arr = choices.split('|');
      return (arr[Math.floor(Math.random() * arr.length)] || '').trim();
    });
  }
  // 2. Micro contractions / tweaks (Level 1+)
  const contractionSwaps = [
    [/\bit is\b/gi, "it's"],
    [/\bit's\b/gi, 'it is'],
    [/\byou will\b/gi, "you'll"],
    [/\bdo not\b/gi, "don't"],
    [/\bhelpful\b/gi, 'useful']
  ];
  if (level >= 1) {
    const [re, rep] = contractionSwaps[Math.floor(Math.random() * contractionSwaps.length)];
    out = out.replace(re, rep);
  }
  // 3. Inline groups (a|b) and custom dictionaries (Level 2+)
  if (level >= 2) {
    out = out.replace(/\(([^()|]+\|[^()]+)\)/g, (_, inner) => {
      const arr = inner.split('|').map((s) => s.trim()).filter(Boolean);
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : _;
    });
    const groups = dictText.split('\n').map((l) => l.trim().replace(/^[\(\{\[]|[\)\}\]]$/g, '').split('|').map((s) => s.trim()).filter(Boolean)).filter((g) => g.length > 1);
    groups.forEach((group) => {
      const regex = new RegExp(`\\b(${group.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
      out = out.replace(regex, (m) => {
        const pick = group[Math.floor(Math.random() * group.length)];
        return m[0] === m[0].toUpperCase() ? pick.charAt(0).toUpperCase() + pick.slice(1) : pick;
      });
    });
  }
  // 4. Synonym swapping & Level 3 phrase upgrades
  if (synonymsOn && level >= 2) {
    const swaps = {
      great: ['awesome', 'solid', 'fantastic'],
      tool: ['app', 'utility', 'platform'],
      fast: ['quick', 'rapid'],
      founders: ['builders', 'creators'],
      awesome: ['great', 'solid', 'super helpful']
    };
    out = out.replace(/\b(great|tool|fast|founders|awesome)\b/gi, (m) => {
      const list = swaps[m.toLowerCase()];
      if (!list) return m;
      const pick = list[Math.floor(Math.random() * list.length)];
      return m[0] === m[0].toUpperCase() ? pick.charAt(0).toUpperCase() + pick.slice(1) : pick;
    });
  }
  if (level >= 3) {
    out = out.replace(/\bcheck out\b/i, () => (Math.random() < 0.5 ? 'take a look at' : 'give a look at'));
  }
  return out;
}

async function runDashboardTestSpin() {
  const input = document.getElementById('setting-randomness-test-input')?.value || '';
  const preview = document.getElementById('setting-randomness-test-preview');
  const btn = document.getElementById('setting-randomness-test-btn');
  if (!preview || !input.trim()) return;

  const level = migrateDashboardRandomnessLevel(
    document.getElementById('setting-randomness-level')?.value ?? state.settings?.randomnessLevel ?? 3,
    true
  );

  if (level <= 3) {
    preview.textContent = resolveSpinTextForDashboard(input, level);
    return;
  }

  const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
  if (!openRouterKey && !geminiApiKey) {
    preview.textContent = resolveSpinTextForDashboard(input, 3);
    showToast('Add an OpenRouter or Gemini API Key in Settings to test AI Levels 4–5.', 'error');
    return;
  }

  if (btn) btn.disabled = true;
  preview.textContent = `Generating Level ${level} AI variation...`;
  try {
    const activeBrand = typeof getActiveBrand === 'function' ? getActiveBrand() : null;
    const token = state.session?.accessToken || state.session?.token || '';
    const res = await fetch('/api/ai/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'auto_vary_batch',
        text: resolveSpinTextForDashboard(input, 2),
        creativityLevel: level,
        variationCount: 1,
        brand: activeBrand || {},
        ...(openRouterKey ? { openRouterKey } : {}),
        ...(geminiApiKey ? { geminiApiKey } : {}),
        aiModel: state.aiModel
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.variations) && data.variations[0]) {
        preview.textContent = data.variations[0];
        return;
      }
    }
  } catch (_) {}
  finally {
    if (btn) btn.disabled = false;
  }
  preview.textContent = resolveSpinTextForDashboard(input, 3);
}

function renderSettingsSuppressionAndCompleted() {
  const badge = document.getElementById('setting-completed-badge');
  const listEl = document.getElementById('setting-completed-urls-list');
  const completedMap = state.completedUrls && typeof state.completedUrls === 'object' ? state.completedUrls : {};
  const completedItems = Object.entries(completedMap).map(([key, item]) => ({ ...(item || {}), _key: key }));
  const supItems = Array.isArray(state.suppressionList) ? state.suppressionList : [];
  const totalCount = completedItems.length;

  if (badge) {
    badge.textContent = `${totalCount} Completed`;
  }
  if (!listEl) return;

  const q = (document.getElementById('setting-completed-search')?.value || '').trim().toLowerCase();
  const filteredCompleted = completedItems
    .filter((item) => !q || `${item.url || ''} ${item.domain || ''} ${item.brandName || ''}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  const filteredSup = supItems
    .map((item, idx) => {
      const val = typeof item === 'string' ? item : (item && typeof item === 'object' ? (item.type === 'thread' ? (item.url || item.domain) : (item.domain || item.url)) : '');
      return { val, idx };
    })
    .filter((entry) => entry.val && (!q || String(entry.val).toLowerCase().includes(q)));

  if (filteredCompleted.length === 0 && filteredSup.length === 0) {
    listEl.innerHTML = `<div class="py-6 text-center text-xs text-[#747d8c]">${q ? 'No matching targets found.' : 'No completed or suppressed URLs logged yet.'}</div>`;
    return;
  }

  const completedHtml = filteredCompleted.map((item) => {
    const cleanUrl = item.url ? String(item.url).replace(/^https?:\/\//i, '').replace(/\/$/, '') : (item.domain || item._key);
    const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recently';
    return `
      <div class="flex items-center justify-between gap-2 bg-white border border-[#dfd8cc] rounded-lg px-3 py-2 text-xs">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] shrink-0">✓ Done</span>
            <span class="font-mono font-medium text-[#1e222a] truncate">${escapeHtml(cleanUrl)}</span>
          </div>
          <div class="text-[10px] text-[#747d8c] mt-0.5">${escapeHtml(item.brandName || 'Product')} • ${escapeHtml(dateStr)}</div>
        </div>
        <button type="button" onclick='removeCompletedTargetFromSettings(${JSON.stringify(item._key)})' class="text-xs font-semibold text-red-600 hover:underline shrink-0">Remove</button>
      </div>
    `;
  }).join('');

  const supHtml = filteredSup.map(({ val, idx }) => `
    <div class="flex items-center justify-between gap-2 bg-white border border-[#dfd8cc] rounded-lg px-3 py-2 text-xs">
      <div class="min-w-0 flex items-center gap-2 flex-1">
        <span class="px-1.5 py-0.5 rounded bg-[#FAF4EB] text-[#57606f] border border-[#dfd8cc] font-bold text-[10px] shrink-0">Suppressed</span>
        <span class="font-mono text-[#1e222a] truncate">${escapeHtml(val)}</span>
      </div>
      <button type="button" onclick="removeGlobalSuppression(${idx})" class="text-xs font-semibold text-red-600 hover:underline shrink-0">Remove</button>
    </div>
  `).join('');

  listEl.innerHTML = completedHtml + supHtml;
}

async function addSettingsGlobalSuppression() {
  const area = document.getElementById('setting-global-suppress-input');
  const raw = (area?.value || '').trim();
  if (!raw) return;
  const entries = raw.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
  let added = 0;
  entries.forEach((entry) => {
    if (!state.suppressionList.includes(entry)) {
      state.suppressionList.unshift(entry);
      added++;
    }
  });
  if (area) area.value = '';
  state.settings.updatedAt = new Date().toISOString();
  renderReportsView();
  renderSettingsSuppressionAndCompleted();
  await persistStateToBridgeAndLocal({ suppressionList: state.suppressionList, settings: state.settings });
  showToast(added > 0 ? `Added ${added} rule${added > 1 ? 's' : ''} to Global Suppression` : 'Entries already suppressed');
}

async function removeCompletedTargetFromSettings(key) {
  if (!state.completedUrls || typeof state.completedUrls !== 'object') return;
  const item = state.completedUrls[key];
  delete state.completedUrls[key];
  // Also strip matching domain if present so removing doesn't leave orphan domain block
  if (item?.domain) {
    state.suppressionList = (state.suppressionList || []).filter((d) => d !== item.domain && d !== item.url);
  }
  state.settings.updatedAt = new Date().toISOString();
  renderSettingsSuppressionAndCompleted();
  renderReportsView();
  await persistStateToBridgeAndLocal({
    completedUrls: state.completedUrls,
    deletedCompletedIds: [key],
    suppressionList: state.suppressionList,
    settings: state.settings,
  });
  showToast('Target removed from Dashboard & Extension');
}

async function clearAllCompletedTargetsFromSettings() {
  if (!confirm('Clear all completed URLs and reset suppression targets?')) return;
  state.completedUrls = {};
  state.suppressionList = [];
  state.settings.updatedAt = new Date().toISOString();
  renderSettingsSuppressionAndCompleted();
  renderReportsView();
  await persistStateToBridgeAndLocal({
    completedUrls: {},
    clearCompletedUrls: true,
    suppressionList: [],
    settings: state.settings,
  });
  showToast('All completed URLs & suppression targets cleared');
}

function renderAiSettingsView() {
  const s = state.settings || {};
  const keyEl = document.getElementById('ai-setting-apikey');
  const geminiKeyEl = document.getElementById('ai-setting-gemini-apikey');
  const modeEl = document.getElementById('ai-setting-form-mode');
  const slowEl = document.getElementById('ai-setting-slow-mode');
  const finEl = document.getElementById('ai-setting-financial');
  const jevToggle = document.getElementById('setting-jev-enabled');
  const jevModel = document.getElementById('setting-jev-model');
  const captchaEl = document.getElementById('setting-captcha-key');
  const delaySlider = document.getElementById('setting-safety-delay');
  const delayVal = document.getElementById('setting-safety-delay-val');
  const randSlider = document.getElementById('setting-randomness-level');
  const randSyn = document.getElementById('setting-randomness-synonyms');
  const randDict = document.getElementById('setting-randomness-dict');
  const compEnabled = document.getElementById('setting-companion-enabled');
  const compShortcuts = document.getElementById('setting-companion-shortcuts');
  const aiContext = document.getElementById('setting-ai-context-matching');
  const simKeys = document.getElementById('setting-simulate-keystrokes');
  const autoSup = document.getElementById('setting-auto-suppress');

  if (keyEl && document.activeElement !== keyEl) keyEl.value = state.apiKey || '';
  if (geminiKeyEl && document.activeElement !== geminiKeyEl) geminiKeyEl.value = state.geminiApiKey || '';
  populateDashboardAiModelSelect();
  renderDashboardCustomModelsChips();

  if (modeEl) {
    modeEl.value = s.formActionMode || 'fill-only';
    syncCustomSelect(modeEl);
  }
  if (slowEl) slowEl.checked = Boolean(s.slowMode);
  if (finEl) finEl.checked = s.financialDetection !== false;

  if (jevToggle) jevToggle.checked = Boolean(s.jevEnabled);
  if (jevModel) {
    jevModel.value = s.jevModel || 'typesafe/jev-1.14';
    syncCustomSelect(jevModel);
  }
  toggleDashboardJevModelGroup();

  if (captchaEl && document.activeElement !== captchaEl) captchaEl.value = s.captchaApiKey || '';
  const delayNum = Number(s.safetyDelay ?? 3) || 3;
  if (delaySlider) delaySlider.value = String(delayNum);
  if (delayVal) delayVal.textContent = `${delayNum}s delay`;

  const randNum = migrateDashboardRandomnessLevel(s.randomnessLevel ?? 3, Boolean(s.sp_randomness_v2_migrated));
  if (randSlider) randSlider.value = String(randNum);
  updateDashboardRandomnessBadge(randNum);
  if (randSyn) randSyn.checked = s.randomnessSynonyms !== false;
  if (randDict && document.activeElement !== randDict) {
    randDict.value = s.randomnessDicts || DEFAULT_RANDOMNESS_DICTS;
  }

  if (compEnabled) compEnabled.checked = s.companionWidgetEnabled !== false;
  if (compShortcuts) compShortcuts.checked = s.companionShortcutsEnabled !== false;
  if (aiContext) aiContext.checked = s.aiContextMatching !== false;
  if (simKeys) simKeys.checked = Boolean(s.simulateKeystrokes);
  if (autoSup) autoSup.checked = s.autoSuppress !== false;

  renderSettingsSuppressionAndCompleted();
}

let settingsSyncTimer = null;
function scheduleSettingsSync() {
  clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => {
    saveAiSettingsFromDashboard(false);
  }, 300);
}

async function saveAiSettingsFromDashboard(showNotification = true) {
  const nowIso = new Date().toISOString();
  state.apiKey = document.getElementById('ai-setting-apikey')?.value.trim() || '';
  state.geminiApiKey = document.getElementById('ai-setting-gemini-apikey')?.value.trim() || '';
  state.aiModel = document.getElementById('ai-setting-model')?.value || 'anthropic/claude-3.5-haiku';
  state.settings = {
    ...state.settings,
    aiModel: state.aiModel,
    customModels: Array.isArray(state.settings?.customModels) ? state.settings.customModels : [],
    formActionMode: document.getElementById('ai-setting-form-mode')?.value || 'fill-only',
    slowMode: Boolean(document.getElementById('ai-setting-slow-mode')?.checked),
    financialDetection: document.getElementById('ai-setting-financial')?.checked !== false,
    jevEnabled: Boolean(document.getElementById('setting-jev-enabled')?.checked),
    jevModel: document.getElementById('setting-jev-model')?.value || 'typesafe/jev-1.14',
    captchaApiKey: document.getElementById('setting-captcha-key')?.value.trim() || '',
    safetyDelay: Number(document.getElementById('setting-safety-delay')?.value || 3),
    randomnessLevel: migrateDashboardRandomnessLevel(document.getElementById('setting-randomness-level')?.value ?? state.settings?.randomnessLevel ?? 3, true),
    sp_randomness_v2_migrated: true,
    randomnessSynonyms: document.getElementById('setting-randomness-synonyms')?.checked !== false,
    randomnessDicts: document.getElementById('setting-randomness-dict')?.value || DEFAULT_RANDOMNESS_DICTS,
    companionWidgetEnabled: document.getElementById('setting-companion-enabled')?.checked !== false,
    companionShortcutsEnabled: document.getElementById('setting-companion-shortcuts')?.checked !== false,
    aiContextMatching: document.getElementById('setting-ai-context-matching')?.checked !== false,
    simulateKeystrokes: Boolean(document.getElementById('setting-simulate-keystrokes')?.checked),
    autoVariation: Boolean(state.settings?.autoVariation),
    autoSuppress: document.getElementById('setting-auto-suppress')?.checked !== false,
    updatedAt: nowIso,
  };
  await persistStateToBridgeAndLocal({
    apiKey: state.apiKey,
    geminiApiKey: state.geminiApiKey,
    aiModel: state.aiModel,
    settings: state.settings,
  });
  refreshDashboardAssistantGateState();
  if (showNotification) showToast('Settings saved & synced with extension!');
}

function exportAllWorkspaceBackup() {
  syncActiveResearchConfigMirror();
  const payload = {
    app: 'SmartPoster',
    exportedAt: new Date().toISOString(),
    brandProfiles: state.brandProfiles,
    activeBrandId: state.activeBrandId,
    researchConfig: getMirroredResearchPayload(),
    directoryPrefs: state.directoryPrefs,
    settings: state.settings,
    aiModel: state.aiModel,
    suppressionList: state.suppressionList,
    completedUrls: state.completedUrls,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `smart-poster-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast('Workspace backup downloaded');
}

function importWorkspaceBackupFile(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const nowIso = new Date().toISOString();
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.brandProfiles) && data.brandProfiles.length) {
        state.brandProfiles = data.brandProfiles.map((b) => ({ ...b, updatedAt: b?.updatedAt || nowIso }));
        state.activeBrandId = data.activeBrandId || data.brandProfiles[0].brandId;
      }
      if (data.researchConfig) migrateLegacyResearchConfigToCampaigns(data.researchConfig);
      syncActiveResearchConfigMirror();
      if (data.directoryPrefs) state.directoryPrefs = { ...state.directoryPrefs, ...data.directoryPrefs };
      if (data.settings) state.settings = { ...state.settings, ...data.settings, updatedAt: nowIso };
      if (data.aiModel) state.aiModel = data.aiModel;
      if (Array.isArray(data.suppressionList)) state.suppressionList = data.suppressionList;
      if (data.completedUrls && typeof data.completedUrls === 'object') state.completedUrls = data.completedUrls;

      await persistStateToBridgeAndLocal({
        brandProfiles: state.brandProfiles,
        activeBrandId: state.activeBrandId,
        researchConfig: getMirroredResearchPayload(),
        directoryPrefs: state.directoryPrefs,
        settings: state.settings,
        aiModel: state.aiModel,
        suppressionList: state.suppressionList,
        completedUrls: state.completedUrls,
      });
      renderAll();
      showToast('Backup imported & synced with extension!');
    } catch (err) {
      showToast('Invalid JSON backup file: ' + err.message, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function resetDashboardSettingsToDefaults() {
  if (!confirm('Reset all settings, custom models, and completed URLs to defaults?')) return;
  const nowIso = new Date().toISOString();
  state.apiKey = '';
  state.geminiApiKey = '';
  state.aiModel = 'anthropic/claude-3.5-haiku';
  state.suppressionList = [];
  state.completedUrls = {};
  state.settings = {
    formActionMode: 'fill-only',
    slowMode: false,
    financialDetection: true,
    customModels: [],
    jevEnabled: false,
    jevModel: 'typesafe/jev-1.14',
    captchaApiKey: '',
    safetyDelay: 3,
    randomnessLevel: 3,
    sp_randomness_v2_migrated: true,
    randomnessSynonyms: true,
    randomnessDicts: DEFAULT_RANDOMNESS_DICTS,
    companionWidgetEnabled: true,
    companionShortcutsEnabled: true,
    aiContextMatching: true,
    simulateKeystrokes: false,
    autoVariation: false,
    autoSuppress: true,
    updatedAt: nowIso,
  };
  await persistStateToBridgeAndLocal({
    apiKey: '',
    geminiApiKey: '',
    aiModel: state.aiModel,
    settings: state.settings,
    suppressionList: [],
    completedUrls: {},
    clearCompletedUrls: true,
  });
  renderAiSettingsView();
  renderReportsView();
  showToast('Settings reset to defaults & synced');
}

// ============================================================================
// 7. Download Releases View (Current Version + Last 3 Versions)
// ============================================================================
const DEFAULT_EXTENSION_RELEASES = [
  {
    id: 'rel-v1-3-0',
    version: 'v1.3.0',
    title: 'Smart Poster v1.3.0 (Latest)',
    summary: 'Smart Context Detection across social/DM/article/webmail/directory/contact pages, starred & draggable comment ordering, campaign-aware AI rewriting, and synced User Dashboard.',
    download_url: '/api/download/extension?version=v1.3.0',
    file_size: '~522 KB',
    is_latest: true,
    released_at: '2026-11-14T08:05:25.008Z',
  },
  {
    id: 'rel-v1-2-0',
    version: 'v1.2.0',
    title: 'Smart Poster v1.2.0',
    summary: 'Supabase Cloud Sync, Google OAuth login, 3+3 AI reply generation (Organic, Trojan Bridge, Direct Promo), and Anti-Ban preflight protection.',
    download_url: '/api/download/extension?version=v1.2.0',
    file_size: '~500 KB',
    is_latest: false,
    released_at: '2026-09-18T10:00:00.000Z',
  },
  {
    id: 'rel-v1-1-0',
    version: 'v1.1.0',
    title: 'Smart Poster v1.1.0',
    summary: 'Multi-Platform Keyword Radar, 1-click Opportunity Queue launcher, Twitter clean domain rule, and domain/thread suppression lists.',
    download_url: '/api/download/extension?version=v1.1.0',
    file_size: '~470 KB',
    is_latest: false,
    released_at: '2026-08-05T10:00:00.000Z',
  },
];

const DEFAULT_CHANGELOG_ENTRIES = [
  {
    id: 'chg-130-ai-assistant',
    version: 'v1.3.0',
    title: 'AI Assistant Upgrade: Full Marketing Content Creator',
    category: 'feature',
    description: 'Upgraded the AI Assistant into a versatile content creator and marketing copy generator. Beyond filling SmartPoster modules, use it to brainstorm campaigns, scan reference pages, and craft promotional copy, social threads, emails, and marketing assets for your entire business.',
    published_at: '2026-11-14T08:05:25.008Z',
  },
  {
    id: 'chg-130-images-gallery',
    version: 'v1.3.0',
    title: 'Dedicated Promotional Images Gallery',
    category: 'feature',
    description: 'Save, label, and organize promotional banners, product screenshots, and marketing creatives in a dedicated per-campaign Gallery—synced between the Dashboard and Chrome Extension for instant drag-and-drop onto any webpage.',
    published_at: '2026-11-13T15:30:00.000Z',
  },
  {
    id: 'chg-130-comment-priority',
    version: 'v1.3.0',
    title: 'Comment Favorites (Starring) & Drag-and-Drop Priority Reordering',
    category: 'feature',
    description: 'Star your top-converting comment variations to keep favorites pinned at the top, and drag-and-drop to reorder your comment list by priority with automatic sequential numbering.',
    published_at: '2026-11-11T16:45:00.000Z',
  },
  {
    id: 'chg-130-velocity-guard',
    version: 'v1.3.0',
    title: 'Anti-Ban Velocity Tracker & Rolling Hourly Guard',
    category: 'feature',
    description: 'Live per-platform daily counters and rolling 60-minute rate monitoring (SAFE, CAUTION, SLOW DOWN) built directly into the extension to help prevent shadowbans and spam flags during outreach sessions.',
    published_at: '2026-11-09T14:20:00.000Z',
  },
  {
    id: 'chg-130-single-pass-editors',
    version: 'v1.3.0',
    title: 'Reliable Single-Pass Insertion for X (Twitter) & Modern Rich-Text Editors',
    category: 'fix',
    description: 'Resolved duplicate/undeletable text issues in X/Twitter Draft.js and modern editors (Pinterest, YouTube, Reddit, LinkedIn), and added automatic scroll-and-highlight guidance straight to the native Reply/Post button.',
    published_at: '2026-11-07T11:10:00.000Z',
  },
  {
    id: 'chg-130-cloud-vault',
    version: 'v1.3.0',
    title: 'Cross-Device Cloud Sync & Media Asset Vault',
    category: 'feature',
    description: 'Sync your campaigns, uploaded logos/favicons/screenshots, comment images, suppression lists, and posting rules automatically across devices when signed in with Google.',
    published_at: '2026-11-05T17:00:00.000Z',
  },
  {
    id: 'chg-130-dashboard',
    version: 'v1.3.0',
    title: 'Full-Screen Left-Hand User Dashboard',
    category: 'feature',
    description: 'Manage campaigns, reports, AI settings, curated Directory Database, releases, and support in one workspace synced with your Chrome Side Panel.',
    published_at: '2026-11-03T13:15:00.000Z',
  },
  {
    id: 'chg-130-research',
    version: 'v1.3.0',
    title: 'Research & Automated Competitor Alerts (Zero API Keys)',
    category: 'feature',
    description: 'Track brand keywords and competitors with automatic high-intent queries and 1-click Google Alerts RSS capture.',
    published_at: '2026-11-02T10:30:00.000Z',
  },
  {
    id: 'chg-130-dir-bookmarks',
    version: 'v1.3.0',
    title: 'Directory Table Bookmarks & Custom User Directories',
    category: 'feature',
    description: 'Browse all Admin-managed directories in a sortable table, star favorites for quick access, and add your own custom directories.',
    published_at: '2026-11-01T09:45:00.000Z',
  },
  {
    id: 'chg-120-twitter-fix',
    version: 'v1.2.0',
    title: 'Twitter / X Clean Domain Formatting Fix',
    category: 'fix',
    description: 'Automatically formats links cleanly without protocol prefixes when enabled in Posting Rules.',
    published_at: '2026-09-18T10:00:00.000Z',
  },
];

function formatVersionTag(ver) {
  const clean = String(ver || '').trim().replace(/^v+/i, '');
  return clean ? `v${clean}` : 'v1.3.0';
}

function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function getSortedReleases() {
  const source = (Array.isArray(state.releases) && state.releases.length > 0)
    ? state.releases
    : DEFAULT_EXTENSION_RELEASES;
  return [...source]
    .map((r) => {
      const versionTag = formatVersionTag(r.version);
      return {
        ...r,
        version: versionTag,
        download_url: r.download_url || `/api/download/extension?version=${encodeURIComponent(versionTag)}`,
      };
    })
    .sort((a, b) => {
      const verCmp = compareSemver(b.version, a.version);
      if (verCmp !== 0) return verCmp;
      if (Boolean(b.is_latest) !== Boolean(a.is_latest)) return b.is_latest ? 1 : -1;
      return new Date(b.released_at || 0).getTime() - new Date(a.released_at || 0).getTime();
    });
}

function formatReleaseDisplayName(release, isLatest = false) {
  const vTag = formatVersionTag(release?.version);
  const rawTitle = String(release?.title || '').trim();
  const baseName = rawTitle && !/^smart poster\s+v?\d/i.test(rawTitle)
    ? `Smart Poster ${vTag} — ${rawTitle}`
    : (rawTitle || `Smart Poster ${vTag}`);
  if (isLatest && !/\blatest\b/i.test(baseName)) {
    return `${baseName} (Latest)`;
  }
  return baseName;
}

function updateVersionNotificationUI() {
  const releases = getSortedReleases();
  const latest = releases.find((r) => r.is_latest) || releases[0];
  const latestTag = latest ? formatVersionTag(latest.version) : 'v1.3.0';
  const installedTag = state.extInstalled && state.extVersion ? formatVersionTag(state.extVersion) : '';
  const hasUpdate = Boolean(installedTag && compareSemver(latestTag, installedTag) > 0);
  window._spUpdateAvailable = hasUpdate;

  const navBadge = document.getElementById('nav-download-update-badge');
  if (navBadge) {
    if (hasUpdate) {
      navBadge.textContent = latestTag;
      navBadge.classList.remove('hidden');
    } else {
      navBadge.classList.add('hidden');
    }
  }

  const card = document.getElementById('ext-bridge-status-card');
  const dot = document.getElementById('ext-bridge-dot');
  const label = document.getElementById('ext-bridge-label');
  const sub = document.getElementById('ext-bridge-sub');
  if (state.extInstalled && installedTag) {
    if (hasUpdate) {
      if (card) card.classList.add('cursor-pointer', 'border-amber-400', 'bg-[#fef7e7]');
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0';
      if (label) label.textContent = `Update: ${latestTag} Ready`;
      if (sub) sub.textContent = `Current ${installedTag} • Click to update`;
    } else {
      if (card) card.classList.remove('cursor-pointer', 'border-amber-400', 'bg-[#fef7e7]');
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0';
      if (label) label.textContent = `Extension ${installedTag}`;
      if (sub) sub.textContent = 'Up to date • Live Chrome sync';
    }
  } else if (card) {
    card.classList.remove('cursor-pointer', 'border-amber-400', 'bg-[#fef7e7]');
  }
}

async function loadReleasesCatalog() {
  try {
    const res = await fetch('/api/releases');
    const data = await res.json();
    if (data.success && Array.isArray(data.releases) && data.releases.length > 0) {
      state.releases = data.releases;
    } else if (!Array.isArray(state.releases) || state.releases.length === 0) {
      state.releases = [...DEFAULT_EXTENSION_RELEASES];
    }
  } catch (_) {
    if (!Array.isArray(state.releases) || state.releases.length === 0) {
      state.releases = [...DEFAULT_EXTENSION_RELEASES];
    }
  }
  updateVersionNotificationUI();
}

async function handleAuthenticatedExtensionDownload(downloadUrl, version = 'v1.3.0') {
  const versionTag = formatVersionTag(version);
  const token = state.session?.accessToken || state.session?.token || '';
  if (!token) {
    showToast('Please sign in first to download the Chrome Extension.', 'error');
    setTimeout(() => {
      window.location.href = `/login.html?next=${encodeURIComponent('/dashboard#download')}`;
    }, 500);
    return;
  }

  try {
    const res = await fetch('/api/auth/download-token', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      showToast('Session expired. Please sign in again to download.', 'error');
      setTimeout(() => {
        window.location.href = `/login.html?next=${encodeURIComponent('/dashboard#download')}`;
      }, 600);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.downloadToken) {
      showToast(data?.error || 'Could not authorize extension download.', 'error');
      return;
    }

    const baseUrl = downloadUrl || `/api/download/extension?version=${encodeURIComponent(versionTag)}`;
    const sep = baseUrl.includes('?') ? '&' : '?';
    const signedUrl = `${baseUrl}${sep}dt=${encodeURIComponent(data.downloadToken)}`;
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = `smart-poster-extension-${versionTag}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(`Downloading Smart Poster ${versionTag}...`);
  } catch (err) {
    showToast('Download failed: ' + (err.message || String(err)), 'error');
  }
}

function renderDownloadSection() {
  const currentCard = document.getElementById('download-current-version-card');
  const latestCard = document.getElementById('download-latest-card');
  const prevList = document.getElementById('download-previous-list');
  const latestPill = document.getElementById('download-latest-pill');
  if (!latestCard || !prevList) return;

  const lastThree = getSortedReleases().slice(0, 3);
  const latest = lastThree[0];
  const previous = lastThree.slice(1, 3);
  const latestTag = formatVersionTag(latest.version);
  const installedTag = state.extInstalled && state.extVersion ? formatVersionTag(state.extVersion) : '';
  const hasUpdate = Boolean(installedTag && compareSemver(latestTag, installedTag) > 0);

  if (latestPill) latestPill.textContent = `Latest: ${latestTag}`;

  if (currentCard) {
    if (installedTag && hasUpdate) {
      currentCard.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-[#fef7e7] border border-[#e6b85c] text-[#854d0e] flex items-center justify-center text-base flex-shrink-0">
              <i class="fas fa-arrow-up-right-dots"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Your Current Version:</span>
                <span class="font-mono-tabular text-xs font-extrabold px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#dfd8cc] text-[#1e222a]">${escapeHtml(installedTag)}</span>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36]">New Update Available (${escapeHtml(latestTag)})</span>
              </div>
              <p class="text-xs text-[#57606f] mt-1">A newer version (${escapeHtml(latestTag)}) is available. Download the latest archive below and reload the unpacked folder in Chrome.</p>
            </div>
          </div>
          <button type="button" onclick='handleAuthenticatedExtensionDownload(${JSON.stringify(latest.download_url || '')}, ${JSON.stringify(latestTag)})' class="sp-btn-amber px-4 py-2 rounded-lg text-xs whitespace-nowrap shrink-0 cursor-pointer">
            Update to ${escapeHtml(latestTag)}
          </button>
        </div>
      `;
    } else if (installedTag) {
      currentCard.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base flex-shrink-0">
              <i class="fas fa-check-circle"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Your Current Version:</span>
                <span class="font-mono-tabular text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">${escapeHtml(installedTag)}</span>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Up to Date</span>
              </div>
              <p class="text-xs text-[#57606f] mt-1">Your installed Smart Poster Chrome Extension matches the latest release (${escapeHtml(latestTag)}).</p>
            </div>
          </div>
        </div>
      `;
    } else {
      currentCard.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-[#FAF4EB] border border-[#dfd8cc] text-[#57606f] flex items-center justify-center text-base flex-shrink-0">
              <i class="fas fa-puzzle-piece"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold uppercase tracking-wider text-[#57606f]">Your Current Version:</span>
                <span class="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#dfd8cc] text-[#57606f]">Not Detected</span>
              </div>
              <p class="text-xs text-[#57606f] mt-1">Install the Chrome extension below (or open this dashboard in Chrome with Smart Poster enabled) to detect your installed version.</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  const latestDisplayName = formatReleaseDisplayName(latest, true);
  latestCard.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-[#f1effe] border-2 border-[#6c5ce7] text-[#6c5ce7] flex items-center justify-center text-xl flex-shrink-0 shadow-sm">📦</div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#6c5ce7] text-white">Recommended • Latest</span>
            <span class="font-mono-tabular text-xs font-extrabold px-2 py-0.5 rounded bg-[#f1effe] text-[#5b4bc4] border border-[#d4cdfc]">${escapeHtml(latestTag)}</span>
          </div>
          <h3 class="text-base font-extrabold text-[#1e222a] mt-1.5">${escapeHtml(latestDisplayName)}</h3>
          <p class="text-xs text-[#57606f] mt-1 max-w-xl leading-relaxed">${escapeHtml(latest.summary || '')}</p>
          <div class="flex items-center gap-4 mt-2.5 text-[11px] text-[#747d8c] font-mono-tabular">
            <span>${escapeHtml(latest.file_size || '~522 KB')}</span>
            <span>Chrome Manifest V3</span>
            <span>${latest.released_at ? new Date(latest.released_at).toLocaleDateString() : ''}</span>
          </div>
        </div>
      </div>
      <button type="button" onclick='handleAuthenticatedExtensionDownload(${JSON.stringify(latest.download_url || '')}, ${JSON.stringify(latestTag)})' class="sp-btn-primary inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-extrabold whitespace-nowrap shrink-0 cursor-pointer">
        <i class="fas fa-download"></i>
        <span>Download Latest ${escapeHtml(latestTag)} (.zip)</span>
      </button>
    </div>
  `;

  prevList.innerHTML = previous.length === 0
    ? `<div class="p-5 text-xs text-[#747d8c]">No archived previous versions yet.</div>`
    : previous.map((r) => {
      const vTag = formatVersionTag(r.version);
      const displayTitle = formatReleaseDisplayName(r, false);
      return `
      <div class="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF4EB]/80">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#dfd8cc] text-[#1e222a]">${escapeHtml(vTag)}</span>
            <span class="text-xs font-bold text-[#1e222a]">${escapeHtml(displayTitle)}</span>
          </div>
          <p class="text-[11px] text-[#57606f] mt-1">${escapeHtml(r.summary || '')}</p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span class="text-[11px] font-mono-tabular text-[#747d8c]">${r.released_at ? new Date(r.released_at).toLocaleDateString() : ''} • ${escapeHtml(r.file_size || '')}</span>
          <button type="button" onclick='handleAuthenticatedExtensionDownload(${JSON.stringify(r.download_url || '')}, ${JSON.stringify(vTag)})' class="sp-btn-secondary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer">Download ${escapeHtml(vTag)} (.zip)</button>
        </div>
      </div>
    `;
    }).join('');
}

// ============================================================================
// 8. New Features / Changelog View
// ============================================================================
async function loadChangelogCatalog() {
  try {
    const res = await fetch('/api/changelog');
    const data = await res.json();
    if (data.success && Array.isArray(data.entries) && data.entries.length > 0) {
      state.changelog = data.entries;
    } else if (!Array.isArray(state.changelog) || state.changelog.length === 0) {
      state.changelog = [...DEFAULT_CHANGELOG_ENTRIES];
    }
  } catch (_) {
    if (!Array.isArray(state.changelog) || state.changelog.length === 0) {
      state.changelog = [...DEFAULT_CHANGELOG_ENTRIES];
    }
  }
}

function setChangelogFilter(cat) {
  state.changelogFilter = cat;
  document.querySelectorAll('.chg-filter-btn').forEach((btn) => {
    const active = btn.dataset.cat === cat;
    btn.className = active
      ? 'chg-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#fdcb6e] text-[#2a2d36] border border-[#2a2d36] shadow-[1px_1px_0px_rgba(42,45,54,0.72)]'
      : 'chg-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#dfd8cc] text-[#57606f] hover:bg-[#FAF4EB]';
  });
  renderChangelogSection();
}

function renderChangelogSection() {
  const container = document.getElementById('new-features-timeline');
  if (!container) return;
  const list = state.changelog.filter((c) => state.changelogFilter === 'all' || c.category === state.changelogFilter);

  if (list.length === 0) {
    container.innerHTML = `<div class="sp-card p-8 text-center text-xs text-[#747d8c]">No updates published in this category yet.</div>`;
    return;
  }

  container.innerHTML = list.map((c) => {
    const pill = c.category === 'fix'
      ? 'bg-red-50 text-red-700 border-red-200'
      : (c.category === 'improvement' ? 'bg-[#fef7e7] text-[#854d0e] border-[#e6b85c]' : 'bg-[#f1effe] text-[#5b4bc4] border-[#d4cdfc]');
    const label = c.category === 'fix' ? 'Bug Fix' : (c.category === 'improvement' ? 'Improvement' : 'New Feature');
    return `
      <div class="sp-card p-5 space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-[#FAF4EB] border border-[#dfd8cc] text-[#1e222a]">${escapeHtml(c.version)}</span>
          <span class="text-[11px] font-bold px-2 py-0.5 rounded border ${pill}">${label}</span>
          <span class="text-[11px] text-[#747d8c] font-mono-tabular">${c.published_at ? new Date(c.published_at).toLocaleDateString() : ''}</span>
        </div>
        <h3 class="text-sm font-bold text-[#1e222a]">${escapeHtml(c.title)}</h3>
        <p class="text-xs text-[#57606f] leading-relaxed">${escapeHtml(c.description)}</p>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 9. Contact & Suggest a Feature Forms (Web3Forms with Account Holder Email)
// ============================================================================
const WEB3FORMS_ACCESS_KEY = '23981c93-4381-444d-a23f-0eb6ff159c38';

function renderContactAndFeatureForms() {
  const email = (state.user?.email || '').trim();
  const name = (state.user?.fullName || '').trim();

  const contactPill = document.getElementById('dash-contact-sender-pill');
  const featurePill = document.getElementById('dash-feature-sender-pill');
  const contactNote = document.getElementById('dash-contact-sender-note');
  const nameInput = document.getElementById('dash-contact-name');

  if (contactPill) {
    contactPill.textContent = email ? `Sender: ${email}` : 'Sign in required to send';
  }
  if (featurePill) {
    featurePill.textContent = email ? `Sender: ${email}` : 'Sign in required to send';
  }
  if (contactNote) {
    contactNote.textContent = email
      ? `Replies will be sent to ${email}.`
      : 'Please sign in with your account to send a message.';
  }
  if (nameInput && !nameInput.value && name) {
    nameInput.value = name;
  }
}

async function submitDashboardContactForm(event) {
  event.preventDefault();
  const statusEl = document.getElementById('dash-contact-status');
  const submitBtn = document.getElementById('dash-contact-submit-btn');
  const senderEmail = (state.user?.email || '').trim();

  if (!senderEmail) {
    if (statusEl) {
      statusEl.className = 'p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold';
      statusEl.textContent = 'Please sign in with your account first so we can send from your account email.';
      statusEl.classList.remove('hidden');
    }
    showToast('Please sign in first to send a contact message.', 'error');
    return;
  }

  const nameVal = (document.getElementById('dash-contact-name')?.value || state.user?.fullName || senderEmail).trim();
  const categoryVal = (document.getElementById('dash-contact-category')?.value || 'General').trim();
  const topicSubjectVal = (document.getElementById('dash-contact-subject')?.value || '').trim();
  const messageVal = (document.getElementById('dash-contact-message')?.value || '').trim();

  if (!messageVal) return;

  const origHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
  }
  if (statusEl) statusEl.classList.add('hidden');

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: topicSubjectVal ? `SmartPoster Support: ${topicSubjectVal}` : 'SmartPoster Support',
        from_name: nameVal,
        name: nameVal,
        email: senderEmail,
        replyto: senderEmail,
        category: categoryVal,
        topic_subject: topicSubjectVal,
        message: messageVal,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      document.getElementById('dash-contact-form')?.reset();
      const nameInput = document.getElementById('dash-contact-name');
      if (nameInput && state.user?.fullName) nameInput.value = state.user.fullName;
      if (statusEl) {
        statusEl.className = 'p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold';
        statusEl.textContent = 'Thank you! Your message has been sent. Our team will reply to your account email shortly.';
        statusEl.classList.remove('hidden');
      }
      showToast('Message sent successfully!');
    } else {
      if (statusEl) {
        statusEl.className = 'p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold';
        statusEl.textContent = data.message || 'Unable to send message right now. Please try again.';
        statusEl.classList.remove('hidden');
      }
      showToast(data.message || 'Failed to send message.', 'error');
    }
  } catch (_) {
    if (statusEl) {
      statusEl.className = 'p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold';
      statusEl.textContent = 'Network error while sending message. Please try again.';
      statusEl.classList.remove('hidden');
    }
    showToast('Network error while sending message.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHtml;
    }
  }
}

async function submitDashboardFeatureForm(event) {
  event.preventDefault();
  const statusEl = document.getElementById('dash-feature-status');
  const submitBtn = document.getElementById('dash-feature-submit-btn');
  const senderEmail = (state.user?.email || '').trim();

  if (!senderEmail) {
    if (statusEl) {
      statusEl.className = 'p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold';
      statusEl.textContent = 'Please sign in with your account first so we can send from your account email.';
      statusEl.classList.remove('hidden');
    }
    showToast('Please sign in first to suggest a feature.', 'error');
    return;
  }

  const senderName = (state.user?.fullName || senderEmail.split('@')[0] || 'Smart Poster User').trim();
  const featureTitleVal = (document.getElementById('dash-feature-title')?.value || '').trim();
  const messageVal = (document.getElementById('dash-feature-message')?.value || '').trim();
  if (!messageVal) return;

  const origHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }
  if (statusEl) statusEl.classList.add('hidden');

  try {
    const formattedMessage = featureTitleVal
      ? `Feature Idea: ${featureTitleVal}\n\n${messageVal}`
      : messageVal;
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Feature suggestion',
        from_name: senderName,
        name: senderName,
        email: senderEmail,
        replyto: senderEmail,
        feature_title: featureTitleVal,
        message: formattedMessage,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      document.getElementById('dash-feature-form')?.reset();
      if (statusEl) {
        statusEl.className = 'p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold';
        statusEl.textContent = 'Feature suggestion submitted! Thank you for helping shape Smart Poster.';
        statusEl.classList.remove('hidden');
      }
      showToast('Feature suggestion submitted!');
    } else {
      if (statusEl) {
        statusEl.className = 'p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold';
        statusEl.textContent = data.message || 'Unable to submit feature suggestion right now. Please try again.';
        statusEl.classList.remove('hidden');
      }
      showToast(data.message || 'Failed to submit feature suggestion.', 'error');
    }
  } catch (_) {
    if (statusEl) {
      statusEl.className = 'p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold';
      statusEl.textContent = 'Network error while submitting feature suggestion. Please try again.';
      statusEl.classList.remove('hidden');
    }
    showToast('Network error while submitting suggestion.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHtml;
    }
  }
}

// ============================================================================
// 11. AI Assistant Module (Direct Web Workspace)
// ============================================================================
let dashAssistantIsSending = false;
const dashAssistantUrlScanCache = new Map();
let dashAssistantEventsInitialized = false;

function getDashboardAssistantModelDisplayName(modelId) {
  const id = String(modelId || state.aiModel || 'anthropic/claude-3.5-haiku').trim();
  const baseMatch = BASE_AI_MODELS.find((m) => m.id === id);
  if (baseMatch) {
    return baseMatch.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }
  const labels = {
    'deepseek/deepseek-chat': 'DeepSeek V3',
    'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
    'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
    'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B',
    'mistralai/mistral-small': 'Mistral Small',
    'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  };
  if (labels[id]) return labels[id];
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

function getActiveBrandAssistantChat(brand = null) {
  const b = brand || getActiveBrand();
  if (!b) return { messages: [], scannedContexts: [] };
  if (!b.assistantChat || typeof b.assistantChat !== 'object') {
    b.assistantChat = { messages: [], scannedContexts: [] };
  }
  if (!Array.isArray(b.assistantChat.messages)) b.assistantChat.messages = [];
  if (!Array.isArray(b.assistantChat.scannedContexts)) b.assistantChat.scannedContexts = [];
  return b.assistantChat;
}

function persistDashboardAssistantChat(immediate = false) {
  const b = getActiveBrand();
  if (!b) return;
  const chat = getActiveBrandAssistantChat(b);
  chat.messages = chat.messages.slice(-40).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || ''),
    ...(m.isError ? { isError: true } : {}),
    ...(m.retryPrompt ? { retryPrompt: String(m.retryPrompt) } : {}),
    ...(m.model ? { model: String(m.model) } : {}),
    ...(Array.isArray(m.deliverables) && m.deliverables.length > 0 ? { deliverables: m.deliverables } : {}),
    timestamp: m.timestamp || Date.now(),
  }));
  chat.scannedContexts = chat.scannedContexts.slice(-8);
  b.updatedAt = new Date().toISOString();
  if (immediate) {
    saveCampaignChanges(false);
  } else {
    scheduleCampaignSave();
  }
}

function refreshDashboardAssistantGateState() {
  const gateEl = document.getElementById('dash-ai-assistant-key-gate');
  const workspaceEl = document.getElementById('dash-ai-assistant-workspace');
  const modelPill = document.getElementById('dash-ai-assistant-model-pill');
  const hasKey = hasDashboardAiKey();

  if (modelPill) {
    const modelId = state.aiModel || 'anthropic/claude-3.5-haiku';
    modelPill.textContent = getDashboardAssistantModelDisplayName(modelId);
    modelPill.title = `Active AI Model: ${modelId} (click to configure in Settings)`;
  }

  if (gateEl) {
    gateEl.classList.toggle('hidden', hasKey);
  }
  if (workspaceEl) {
    workspaceEl.classList.toggle('hidden', !hasKey);
  }
}

function normalizeDashboardAssistantUrlKey(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    return u.href.replace(/\/+$/, '').toLowerCase();
  } catch (_) {
    return trimmed.toLowerCase();
  }
}

function upsertDashboardAssistantContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  const urlStr = String(ctx.url || '').trim();
  let domainStr = String(ctx.domain || '').trim();
  if (!domainStr && urlStr) {
    try {
      domainStr = new URL(/^https?:\/\//i.test(urlStr) ? urlStr : `https://${urlStr}`).hostname.replace(/^www\./i, '');
    } catch (_) {}
  }
  if (!domainStr && !ctx.bodyCopy && !ctx.copy && !ctx.title) return;

  const descStr = String(ctx.metaDescription || ctx.description || '').trim();
  const bodyStr = String(ctx.bodyCopy || ctx.copy || '').trim();
  const normalized = {
    sourceType: ctx.sourceType === 'tab' ? 'tab' : 'url',
    url: urlStr,
    domain: domainStr,
    title: String(ctx.title || domainStr).trim(),
    metaDescription: descStr,
    description: descStr,
    headings: Array.isArray(ctx.headings) ? ctx.headings.slice(0, 12) : [],
    ctaTexts: Array.isArray(ctx.ctaTexts) ? ctx.ctaTexts.slice(0, 8) : [],
    bodyCopy: bodyStr,
    copy: bodyStr,
    platform: ctx.platform || 'web',
    scannedAt: ctx.scannedAt || new Date().toISOString(),
  };

  const chat = getActiveBrandAssistantChat();
  const existingIdx = chat.scannedContexts.findIndex((c) => {
    if (urlStr && c.url) return String(c.url).toLowerCase() === urlStr.toLowerCase();
    return String(c.domain || '').toLowerCase() === domainStr.toLowerCase() && c.sourceType === normalized.sourceType;
  });

  if (existingIdx >= 0) {
    chat.scannedContexts[existingIdx] = normalized;
  } else {
    chat.scannedContexts.push(normalized);
  }
  renderDashboardAssistantContextChips();
  persistDashboardAssistantChat(true);
}

function removeDashboardAssistantContext(idx) {
  const chat = getActiveBrandAssistantChat();
  if (idx < 0 || idx >= chat.scannedContexts.length) return;
  chat.scannedContexts.splice(idx, 1);
  renderDashboardAssistantContextChips();
  persistDashboardAssistantChat(true);
}

function renderDashboardAssistantContextChips() {
  const container = document.getElementById('dash-ai-assistant-context-chips');
  if (!container) return;
  const chat = getActiveBrandAssistantChat();
  const list = chat.scannedContexts || [];
  if (list.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = `
    <span class="text-[10px] font-bold uppercase tracking-wider text-[#747d8c] mr-1">Attached Context:</span>
    ${list.map((ctx, idx) => {
      const badgeLabel = ctx.sourceType === 'tab' ? 'Tab' : 'Site';
      const displayDomain = ctx.domain || ctx.title || ctx.url || 'Scanned Page';
      const tooltip = [ctx.title, ctx.url].filter(Boolean).join(' — ');
      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-[#dfd8cc] text-[#1e222a]" title="${escapeHtml(tooltip)}">
          <span class="text-[10px] font-bold uppercase text-[#5b4bc4]">${escapeHtml(badgeLabel)}</span>
          <span class="truncate max-w-[180px]">${escapeHtml(displayDomain)}</span>
          <button type="button" onclick="removeDashboardAssistantContext(${idx})" title="Remove scanned context" class="text-[#747d8c] hover:text-red-600 font-bold leading-none pl-0.5">&times;</button>
        </span>
      `;
    }).join('')}
  `;
}

function toggleDashboardAssistantScanBar(forceOpen = null) {
  const bar = document.getElementById('dash-ai-assistant-scan-bar');
  if (!bar) return;
  const shouldShow = forceOpen !== null ? Boolean(forceOpen) : bar.classList.contains('hidden');
  bar.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    const input = document.getElementById('dash-ai-assistant-scan-url-input');
    if (input) {
      input.focus();
      const b = getActiveBrand();
      if (!input.value.trim() && b?.brandInfo?.url) {
        input.placeholder = `https://competitor-or-site.com (Product site: ${b.brandInfo.url})`;
      }
    }
  }
}

async function scanDashboardAssistantUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  if (!hasDashboardAiKey()) {
    showDashboardApiKeyPrompt();
    return null;
  }

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const cacheKey = normalizeDashboardAssistantUrlKey(withProto);
  if (cacheKey && dashAssistantUrlScanCache.has(cacheKey)) {
    const cached = dashAssistantUrlScanCache.get(cacheKey);
    if (cached) {
      upsertDashboardAssistantContext(cached);
      return cached;
    }
  }

  const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
  const token = state.session?.accessToken || state.session?.token || '';
  const resp = await fetch('/api/ai/analyze-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      url: withProto,
      ...(openRouterKey ? { openRouterKey } : {}),
      ...(geminiApiKey ? { geminiApiKey } : {}),
    }),
  });
  const json = await resp.json().catch(() => null);
  const siteObj = json?.site || json?.context || null;
  if (!resp.ok || !json?.success || !siteObj) {
    throw new Error(json?.error || 'Could not extract copy from that URL.');
  }
  const normalized = { ...siteObj, sourceType: 'url' };
  if (cacheKey) dashAssistantUrlScanCache.set(cacheKey, normalized);
  upsertDashboardAssistantContext(normalized);
  return normalized;
}

async function submitDashboardAssistantScanUrl(event) {
  if (event) event.preventDefault();
  const inputEl = document.getElementById('dash-ai-assistant-scan-url-input');
  const submitBtn = document.getElementById('btn-dash-ai-assistant-scan-submit');
  const rawUrl = (inputEl?.value || '').trim();
  if (!rawUrl) {
    showToast('Enter a URL to scan', 'error');
    return;
  }

  const origHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scanning...';
  }
  try {
    const ctx = await scanDashboardAssistantUrl(rawUrl);
    if (ctx) {
      if (inputEl) inputEl.value = '';
      showToast(`Scanned copy from ${ctx.domain || rawUrl}`);
      document.getElementById('dash-ai-assistant-input')?.focus();
    }
  } catch (err) {
    showToast(err?.message || 'Failed to scan URL', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHtml;
    }
  }
}

async function scanActiveProductUrlForDashboardAssistant() {
  const b = getActiveBrand();
  const ctx = b ? buildDashboardFullBrandContext(b) : {};
  const productUrl = (ctx.website || ctx.url || '').trim();
  if (!productUrl) {
    showToast('Add a Website URL in Products -> Brand Assets first', 'error');
    return;
  }
  const btn = document.getElementById('btn-dash-ai-assistant-scan-product');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }
  try {
    const scanned = await scanDashboardAssistantUrl(productUrl);
    if (scanned) {
      showToast(`Attached live copy from ${scanned.domain || productUrl}`);
      document.getElementById('dash-ai-assistant-input')?.focus();
    }
  } catch (err) {
    showToast(err?.message || 'Could not scan product URL', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

function formatDashboardAssistantMarkdown(rawText) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let listItems = [];

  const formatInline = (text) => {
    return escapeHtml(text)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#5b4bc4] underline font-semibold">$1</a>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((li) => `<li>${formatInline(li)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const bulletMatch = trimmed.match(/^(?:[-*]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }
    flushList();
    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(`<p class="font-bold text-[#1e222a]">${formatInline(headingMatch[1])}</p>`);
      return;
    }
    blocks.push(`<p>${formatInline(trimmed)}</p>`);
  });
  flushList();

  return blocks.join('') || `<p>${formatInline(rawText || '')}</p>`;
}

function getDashboardAssistantModuleLabel(mod) {
  const key = String(mod || 'comment').toLowerCase().trim();
  const labels = {
    social_post: 'Social Post',
    email: 'Cold Email',
    emails: 'Cold Email',
    contact: 'Contact Form',
    dm: 'Social DM',
    dms: 'Social DM',
    comment: 'Comment',
    comments: 'Comment',
    article: 'Article',
    articles: 'Article',
    directory_tagline: 'Directory Tagline',
    directory_pitch: 'Directory Pitch',
    directory_summary: 'Directory Summary',
    directory_description: 'Directory Description',
    directory: 'Directory',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

function getDashboardDirectoryCharLimit(mod, targetField) {
  const m = String(mod || '').toLowerCase();
  const tf = String(targetField || '').toLowerCase();
  if (m === 'directory_tagline' || tf === 'tagline') return 60;
  if (m === 'directory_pitch' || tf === 'pitch') return 140;
  if (m === 'directory_summary' || tf === 'shortsummary' || tf === 'summary') return 250;
  return null;
}

function normalizeDashboardAssistantSuggestedModule(mod, targetField) {
  const m = String(mod || '').toLowerCase().trim();
  const tf = String(targetField || '').toLowerCase().trim();
  if (m === 'social_post' || m === 'social_posts' || m === 'social' || m === 'post') return 'social_post';
  if (m === 'comments' || m === 'comment') return 'comment';
  if (m === 'contact' || m === 'contact_form' || m === 'contact-form' || m === 'outreach') return 'contact';
  if (m === 'emails' || m === 'email') return 'email';
  if (m === 'dms' || m === 'dm') return 'dm';
  if (m === 'articles' || m === 'article') return 'article';
  if (m === 'directory_tagline' || (m.startsWith('directory') && tf === 'tagline')) return 'directory_tagline';
  if (m === 'directory_pitch' || (m.startsWith('directory') && (tf === 'pitch' || tf === 'elevatorpitch'))) return 'directory_pitch';
  if (m === 'directory_summary' || (m.startsWith('directory') && (tf === 'shortsummary' || tf === 'summary' || tf === 'mediumsummary'))) return 'directory_summary';
  if (m === 'directory_description' || m === 'directory' || m === 'directories') return 'directory_description';
  return 'comment';
}

function getDashboardAssistantDestinationOptions() {
  return [
    { key: 'social_post', label: 'Social Posts', group: 'outreach' },
    { key: 'comment', label: 'Comments', group: 'outreach' },
    { key: 'contact', label: 'Contact Form', group: 'outreach' },
    { key: 'email', label: 'Cold Email', group: 'outreach' },
    { key: 'dm', label: 'DM', group: 'outreach' },
    { key: 'article', label: 'Articles & Blogs', group: 'outreach' },
    { key: 'directory_tagline', label: 'Tagline (60 chars)', group: 'directory' },
    { key: 'directory_pitch', label: 'Pitch (140 chars)', group: 'directory' },
    { key: 'directory_summary', label: 'Summary (250 chars)', group: 'directory' },
    { key: 'directory_description', label: 'Description', group: 'directory' },
  ];
}

function getDashboardAssistantDestinationDisplayName(targetKey) {
  const names = {
    social_post: 'Social Posts',
    comment: 'Comments',
    contact: 'Contact Form',
    email: 'Cold Email',
    dm: 'DM',
    article: 'Articles & Blogs',
    directory_tagline: 'Directory Tagline',
    directory_pitch: 'Directory Pitch',
    directory_summary: 'Directory Summary',
    directory_description: 'Directory Description',
  };
  return names[targetKey] || targetKey;
}

function closeAllDashboardAssistantAddMenus() {
  document.querySelectorAll('.dash-assistant-add-menu').forEach((menu) => {
    menu.classList.add('hidden');
  });
  document.querySelectorAll('.dash-assistant-add-toggle[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function toggleDashboardAssistantAddMenu(event, menuId) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(menuId);
  const toggleBtn = event?.currentTarget;
  if (!menu) return;
  const wasOpen = !menu.classList.contains('hidden');
  closeAllDashboardAssistantAddMenus();
  if (!wasOpen) {
    const scrollBox = document.getElementById('dash-ai-assistant-messages');
    let openUp = true;
    if (toggleBtn && scrollBox) {
      const btnRect = toggleBtn.getBoundingClientRect();
      const boxRect = scrollBox.getBoundingClientRect();
      const spaceBelow = boxRect.bottom - btnRect.bottom;
      const spaceAbove = btnRect.top - boxRect.top;
      openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    }
    menu.classList.toggle('bottom-full', openUp);
    menu.classList.toggle('mb-1.5', openUp);
    menu.classList.toggle('top-full', !openUp);
    menu.classList.toggle('mt-1.5', !openUp);
    menu.classList.remove('hidden');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

function applyDashboardAssistantPostingRules(rawBody, targetModule, platformHint = '') {
  let text = String(rawBody || '').trim();
  const plat = String(platformHint || '').toLowerCase();
  const isTwitterTarget = plat === 'twitter' || plat === 'x' || plat.includes('twitter');
  if ((targetModule === 'dm' || targetModule === 'comment' || targetModule === 'social_post') && isTwitterTarget) {
    text = text.replace(/https?:\/\/(?:www\.)?/gi, '');
  }
  return text.trim();
}

async function addDashboardAssistantAsset(msgIdx, assetIdx, targetModule) {
  const chat = getActiveBrandAssistantChat();
  const asset = chat.messages?.[msgIdx]?.deliverables?.[assetIdx];
  const b = getActiveBrand();
  if (!asset || !b) return false;

  const rawBody = String(asset.body || asset.content || '').trim();
  if (!rawBody) {
    showToast('Draft body is empty', 'error');
    return false;
  }

  const cleanBody = applyDashboardAssistantPostingRules(rawBody, targetModule, asset.platform || '');
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let truncatedNotice = '';

  if (targetModule === 'social_post') {
    const posts = ensureDashboardSocialPosts(b);
    const rawPlat = String(asset.platform || '').trim();
    const mappedPlat = rawPlat && rawPlat.toLowerCase() !== 'web'
      ? (rawPlat.toLowerCase() === 'twitter' || rawPlat.toLowerCase() === 'x' ? 'X / Twitter' : rawPlat)
      : 'X / Twitter';
    posts.unshift({
      id: `sp-${uid()}`,
      platform: mappedPlat,
      format: 'single',
      hook: String(asset.title || asset.subject || '').trim(),
      body: cleanBody,
      ctaUrl: buildBrandUtmUrl(b) || b.brandInfo?.url || '',
      mediaGalleryIds: [],
      enabled: true,
      createdAt: new Date().toISOString(),
    });
  } else if (targetModule === 'comment') {
    const comments = ensureDashboardBrandCommentsNormalized(b);
    comments.unshift({
      id: `comm-${uid()}`,
      text: cleanBody,
      tags: [DEFAULT_COMMENT_TAG],
      images: [],
      enabled: true,
      starred: false,
      isExpanded: true,
    });
    b.comments = b.social.comments;
    b.commentTags = getCampaignAvailableTags(b);
  } else if (targetModule === 'contact') {
    const c = b.contact || (b.contact = {});
    const nextSubject = String(asset.subject || asset.title || c.subject || '').trim();
    if (nextSubject) c.subject = nextSubject;
    const msgs = ensureDashboardContactMessages(c);
    if (msgs.length === 1 && !(msgs[0].text || '').trim()) {
      msgs[0].text = cleanBody;
    } else {
      msgs.push({
        id: `cmsg-${uid()}`,
        text: cleanBody,
        enabled: true,
      });
    }
    syncPrimaryContactMessage(c);
  } else if (targetModule === 'email') {
    if (!Array.isArray(b.emails)) b.emails = [];
    if (b.emails.length >= 10) {
      showToast('Maximum 10 email variations reached. Delete one in Products -> Cold Email first.', 'error');
      return false;
    }
    const subject = String(asset.subject || asset.title || asset.label || '').trim();
    b.emails.push({
      id: `email-${uid()}`,
      subject,
      body: cleanBody,
      enabled: true,
    });
  } else if (targetModule === 'dm') {
    if (!Array.isArray(b.dms)) b.dms = [];
    const validPlatforms = ['Twitter', 'LinkedIn', 'Instagram', 'Reddit', 'Threads', 'BlueSky', 'Other'];
    const rawPlat = String(asset.platform || '').trim();
    let mappedPlatform = validPlatforms.find((p) => p.toLowerCase() === rawPlat.toLowerCase()) || '';
    if (!mappedPlatform) {
      mappedPlatform = rawPlat.toLowerCase() === 'x' ? 'Twitter' : (rawPlat ? 'Other' : 'Twitter');
    }
    b.dms.push({
      id: `dm-${uid()}`,
      platform: mappedPlatform,
      message: cleanBody,
      enabled: true,
    });
  } else if (targetModule === 'article') {
    if (!Array.isArray(b.articles)) b.articles = [];
    const artTitle = String(asset.title || asset.label || `Article ${b.articles.length + 1}`).trim();
    b.articles.unshift({
      id: `art-${uid()}`,
      title: artTitle,
      category: 'Blog',
      preset: state.articleAutoPreset || 'problem-solution',
      targetKeyword: state.articleAutoKeyword || '',
      slug: typeof slugifyDashboardSeo === 'function' ? slugifyDashboardSeo(artTitle) : '',
      metaDescription: '',
      body: cleanBody,
      enabled: true,
    });
  } else if (
    targetModule === 'directory_tagline' ||
    targetModule === 'directory_pitch' ||
    targetModule === 'directory_summary' ||
    targetModule === 'directory_description'
  ) {
    const dir = b.directory || (b.directory = {});
    const typeMap = {
      directory_tagline: { type: 'taglines', max: 60 },
      directory_pitch: { type: 'pitches', max: 140 },
      directory_summary: { type: 'summaries', max: 250 },
      directory_description: { type: 'descriptions', max: null },
    };
    const cfg = typeMap[targetModule];
    let finalText = cleanBody;
    if (cfg.max && finalText.length > cfg.max) {
      finalText = finalText.slice(0, cfg.max).trim();
      truncatedNotice = ` (trimmed to ${cfg.max} chars)`;
    }
    if (!Array.isArray(dir[cfg.type])) dir[cfg.type] = [];
    dir[cfg.type].push({
      id: `${cfg.type.slice(0, -1)}-${uid()}`,
      text: finalText,
      enabled: true,
    });
  } else {
    return false;
  }

  if (!Array.isArray(asset.addedModules)) asset.addedModules = [];
  if (!asset.addedModules.includes(targetModule)) {
    asset.addedModules.push(targetModule);
  }

  closeAllDashboardAssistantAddMenus();
  renderContentEditor();
  persistDashboardAssistantChat(true);

  const cardEl = document.getElementById(`dash-assistant-asset-${msgIdx}-${assetIdx}`);
  if (cardEl) {
    let badgesEl = cardEl.querySelector('.dash-assistant-added-badges');
    if (!badgesEl) {
      badgesEl = document.createElement('div');
      badgesEl.className = 'dash-assistant-added-badges flex flex-wrap gap-1.5 pt-1';
      const actionsEl = cardEl.querySelector('.dash-assistant-asset-actions');
      if (actionsEl) {
        cardEl.insertBefore(badgesEl, actionsEl);
      } else {
        cardEl.appendChild(badgesEl);
      }
    }
    badgesEl.innerHTML = asset.addedModules
      .map((m) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold">&#10003; Added to ${escapeHtml(getDashboardAssistantDestinationDisplayName(m))}</span>`)
      .join('');
  }

  const destName = getDashboardAssistantDestinationDisplayName(targetModule);
  showToast(`Added to ${destName}${truncatedNotice}`);
  return true;
}

async function copyDashboardAssistantAsset(msgIdx, assetIdx, btn) {
  const chat = getActiveBrandAssistantChat();
  const asset = chat.messages?.[msgIdx]?.deliverables?.[assetIdx];
  if (!asset) return;
  const rawText = String(asset.body || asset.content || '').trim();
  const copyText = asset.subject
    ? `Subject: ${asset.subject}\n\n${rawText}`
    : (asset.title ? `${asset.title}\n\n${rawText}` : rawText);
  try {
    await navigator.clipboard.writeText(copyText);
    if (btn) {
      const orig = btn.innerHTML;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 1400);
    }
  } catch (_) {
    showToast('Unable to copy to clipboard.', 'error');
  }
}

function toggleDashboardAssistantAssetExpand(bodyId, btn) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  const clamped = el.classList.toggle('is-clamped');
  if (btn) btn.textContent = clamped ? 'Show full' : 'Collapse';
}

function getDashboardAssistantEmptyStateHtml() {
  const starters = [
    {
      title: 'Brainstorm content ideas & hooks',
      prompt: 'Brainstorm 5 fresh content ideas, viral hooks, and soft-promo angles for my active product.',
    },
    {
      title: 'Write 3 soft-promo outreach emails',
      prompt: 'Create 3 short, soft-promotional outreach emails for my active product targeting startup founders.',
    },
    {
      title: 'Draft social posts & community comments',
      prompt: 'Write 3 natural, value-first social posts and community comments that subtly mention my active product.',
    },
    {
      title: 'Draft a contact form outreach message',
      prompt: 'Draft a concise, non-salesy contact form outreach message for B2B partners.',
    },
    {
      title: 'Write an informative long-form article',
      prompt: "Write an informative 700-word article on solving my audience's core pain point with a subtle product mention.",
    },
    {
      title: 'Generate directory taglines & pitches',
      prompt: 'Write 3 punchy directory taglines (under 60 chars) and 2 elevator pitches (under 140 chars) for my active product.',
    },
  ];
  return `
    <div class="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-6 space-y-5">
      <div class="space-y-1.5">
        <div class="w-10 h-10 rounded-xl bg-[#f1effe] border border-[#d4cdfc] text-[#5b4bc4] flex items-center justify-center mx-auto">
          <i class="fas fa-wand-magic-sparkles"></i>
        </div>
        <h3 class="text-sm font-extrabold text-[#1e222a]">Create, revise &amp; brainstorm copy for your product</h3>
        <p class="text-xs text-[#57606f] leading-relaxed">
          Describe an idea, ask to rewrite existing copy, or paste a website URL. Generated drafts can be added straight into your active Product modules.
        </p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
        ${starters.map((s) => `
          <button type="button" data-prompt="${escapeHtml(s.prompt)}" onclick="sendDashboardAssistantMessage(this.getAttribute('data-prompt'))" class="p-3 rounded-xl bg-white border border-[#dfd8cc] hover:border-[#6c5ce7] hover:bg-[#f8f7ff] text-left transition space-y-0.5 cursor-pointer">
            <div class="text-xs font-bold text-[#1e222a]">${escapeHtml(s.title)}</div>
            <div class="text-[11px] text-[#747d8c] line-clamp-2">${escapeHtml(s.prompt)}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDashboardAssistantMessages(isLoading = false) {
  const container = document.getElementById('dash-ai-assistant-messages');
  if (!container) return;

  const chat = getActiveBrandAssistantChat();
  const messages = chat.messages || [];

  if (messages.length === 0 && !isLoading) {
    container.innerHTML = getDashboardAssistantEmptyStateHtml();
    return;
  }

  const destOptions = getDashboardAssistantDestinationOptions();
  const outreachOpts = destOptions.filter((o) => o.group === 'outreach');
  const directoryOpts = destOptions.filter((o) => o.group === 'directory');

  const htmlParts = messages.map((msg, msgIdx) => {
    const isUser = msg.role === 'user';
    const isError = Boolean(msg.isError);
    const deliverables = Array.isArray(msg.deliverables) ? msg.deliverables : [];

    const deliverablesHtml = deliverables.length > 0
      ? `
        <div class="space-y-3 mt-2">
          ${deliverables.map((d, assetIdx) => {
            const bodyText = String(d.body || d.content || '');
            const normalizedSuggested = normalizeDashboardAssistantSuggestedModule(d.suggestedModule, d.targetField);
            const modLabel = getDashboardAssistantModuleLabel(normalizedSuggested);
            const dirLimit = getDashboardDirectoryCharLimit(normalizedSuggested, d.targetField);
            const charLen = bodyText.length;
            const isOverLimit = dirLimit !== null && charLen > dirLimit;
            const isLongBody = bodyText.length > 520;
            const wordCount = normalizedSuggested === 'article'
              ? bodyText.trim().split(/\s+/).filter(Boolean).length
              : 0;
            const addedModules = Array.isArray(d.addedModules) ? d.addedModules : [];
            const menuId = `dash-assistant-add-menu-${msgIdx}-${assetIdx}`;
            const bodyId = `dash-assistant-asset-body-${msgIdx}-${assetIdx}`;

            const renderMenuItem = (opt) => {
              const isRec = opt.key === normalizedSuggested;
              return `
                <button type="button" onclick="addDashboardAssistantAsset(${msgIdx}, ${assetIdx}, '${opt.key}')" class="w-full text-left px-3 py-1.5 text-xs text-[#1e222a] hover:bg-[#FAF4EB] flex items-center justify-between gap-2">
                  <span>${escapeHtml(opt.label)}</span>
                  ${isRec ? '<span class="text-[10px] font-bold text-[#5b4bc4]">Match</span>' : ''}
                </button>
              `;
            };

            return `
              <div id="dash-assistant-asset-${msgIdx}-${assetIdx}" class="bg-white border border-[#dfd8cc] rounded-xl p-3.5 space-y-2 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-extrabold text-[#1e222a]">${escapeHtml(d.label || `Draft #${assetIdx + 1}`)}</span>
                  <div class="flex items-center gap-1.5 text-[11px] text-[#57606f]">
                    ${d.platform ? `<span class="font-semibold">${escapeHtml(d.platform)}</span><span aria-hidden="true">&middot;</span>` : ''}
                    <span class="font-bold text-[#5b4bc4]">${escapeHtml(modLabel)}</span>
                    ${dirLimit !== null
                      ? `<span aria-hidden="true">&middot;</span><span class="font-mono ${isOverLimit ? 'text-red-600 font-bold' : ''}">${charLen}/${dirLimit} chars</span>`
                      : (wordCount > 0 ? `<span aria-hidden="true">&middot;</span><span class="font-mono">${wordCount} words</span>` : '')
                    }
                  </div>
                </div>
                ${d.subject ? `<div class="text-xs font-bold text-[#1e222a] bg-[#FAF4EB] px-2.5 py-1.5 rounded-md border border-[#dfd8cc]">Subject: ${escapeHtml(d.subject)}</div>` : ''}
                ${d.title ? `<div class="text-xs font-bold text-[#1e222a] bg-[#FAF4EB] px-2.5 py-1.5 rounded-md border border-[#dfd8cc]">Title: ${escapeHtml(d.title)}</div>` : ''}
                <div id="${bodyId}" class="dash-assistant-preview-body${isLongBody ? ' is-clamped' : ''} text-xs text-[#1e222a] leading-relaxed bg-[#FCF9F2] border border-[#F2EBE0] rounded-lg p-3">${escapeHtml(bodyText)}</div>
                ${addedModules.length > 0 ? `
                  <div class="dash-assistant-added-badges flex flex-wrap gap-1.5 pt-0.5">
                    ${addedModules.map((m) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold">&#10003; Added to ${escapeHtml(getDashboardAssistantDestinationDisplayName(m))}</span>`).join('')}
                  </div>
                ` : ''}
                <div class="dash-assistant-asset-actions flex items-center justify-between gap-2 pt-1">
                  <div>
                    ${isLongBody ? `<button type="button" onclick="toggleDashboardAssistantAssetExpand('${bodyId}', this)" class="sp-btn-secondary px-2.5 py-1 rounded-md text-[11px]">Show full</button>` : ''}
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="copyDashboardAssistantAsset(${msgIdx}, ${assetIdx}, this)" class="sp-btn-secondary px-3 py-1.5 rounded-lg text-xs">Copy</button>
                    <div class="relative inline-block">
                      <button type="button" onclick="toggleDashboardAssistantAddMenu(event, '${menuId}')" aria-haspopup="menu" aria-expanded="false" class="dash-assistant-add-toggle sp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                        <span>Add to Product</span>
                        <span aria-hidden="true">&#9662;</span>
                      </button>
                      <div id="${menuId}" class="dash-assistant-add-menu hidden absolute right-0 bottom-full mb-1.5 w-52 bg-white border border-[#dfd8cc] rounded-xl shadow-lg py-1.5 z-40" role="menu" onclick="event.stopPropagation()">
                        ${outreachOpts.map(renderMenuItem).join('')}
                        <div class="my-1 border-t border-[#F2EBE0]"></div>
                        <div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#747d8c]">Directory Submission</div>
                        ${directoryOpts.map(renderMenuItem).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `
      : '';

    const errorActionsHtml = isError
      ? `
        <div class="flex items-center gap-2 mt-2">
          ${msg.retryPrompt ? `<button type="button" data-retry="${escapeHtml(msg.retryPrompt)}" onclick="sendDashboardAssistantMessage(this.getAttribute('data-retry'))" class="sp-btn-secondary px-3 py-1 rounded-lg text-xs">Retry</button>` : ''}
          <button type="button" onclick="goToDashboardAiApiKeySetting()" class="sp-btn-secondary px-3 py-1 rounded-lg text-xs">AI Settings</button>
        </div>
      `
      : '';

    if (isUser) {
      return `
        <div class="flex justify-end">
          <div class="max-w-2xl bg-[#6c5ce7] text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-xs leading-relaxed shadow-sm">
            <div class="whitespace-pre-wrap break-word">${escapeHtml(msg.content || '')}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="flex justify-start">
        <div class="max-w-3xl w-full ${isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-[#dfd8cc] text-[#1e222a]'} border rounded-2xl rounded-bl-sm px-4 py-3 text-xs leading-relaxed shadow-sm space-y-2">
          <div class="dash-assistant-msg-content">${formatDashboardAssistantMarkdown(msg.content || '')}</div>
          ${errorActionsHtml}
          ${deliverablesHtml}
          ${!isError && msg.model ? `<div class="text-[10.5px] text-[#747d8c] pt-0.5">${escapeHtml(getDashboardAssistantModelDisplayName(msg.model))}</div>` : ''}
        </div>
      </div>
    `;
  });

  if (isLoading) {
    const modelName = getDashboardAssistantModelDisplayName(state.aiModel || 'anthropic/claude-3.5-haiku');
    htmlParts.push(`
      <div class="flex justify-start">
        <div class="bg-white border border-[#dfd8cc] rounded-2xl rounded-bl-sm px-4 py-3 text-xs text-[#57606f] inline-flex items-center gap-2 shadow-sm">
          <i class="fas fa-spinner fa-spin text-[#6c5ce7]"></i>
          <span>Thinking with ${escapeHtml(modelName)}...</span>
        </div>
      </div>
    `);
  }

  container.innerHTML = htmlParts.join('');
  container.scrollTop = container.scrollHeight;
}

function clearDashboardAssistantChat() {
  const b = getActiveBrand();
  if (!b) return;
  const chat = getActiveBrandAssistantChat(b);
  chat.messages = [];
  chat.scannedContexts = [];
  dashAssistantIsSending = false;
  renderDashboardAssistantContextChips();
  renderDashboardAssistantMessages(false);
  persistDashboardAssistantChat(true);
  const inputEl = document.getElementById('dash-ai-assistant-input');
  if (inputEl) {
    inputEl.value = '';
    inputEl.style.height = '';
    inputEl.focus();
  }
}

async function sendDashboardAssistantMessage(customPrompt = null) {
  if (!hasDashboardAiKey()) {
    showDashboardApiKeyPrompt();
    return;
  }
  if (dashAssistantIsSending) return;

  const inputEl = document.getElementById('dash-ai-assistant-input');
  const sendBtn = document.getElementById('btn-dash-ai-assistant-send');
  const promptText = String(customPrompt !== null ? customPrompt : (inputEl?.value || '')).trim();
  if (!promptText) return;

  dashAssistantIsSending = true;
  if (sendBtn) sendBtn.disabled = true;
  if (inputEl && customPrompt === null) {
    inputEl.value = '';
    inputEl.style.height = '';
  }

  const b = getActiveBrand();
  const chat = getActiveBrandAssistantChat(b);

  try {
    chat.messages.push({
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
    });
    renderDashboardAssistantMessages(true);
    persistDashboardAssistantChat(false);

    const brandCtx = b ? buildDashboardFullBrandContext(b) : {};
    const { openRouterKey, geminiApiKey } = getDashboardConfiguredKeys();
    const token = state.session?.accessToken || state.session?.token || '';
    const postingRulesSummary = [
      'Twitter / X: Never include https:// or http:// in links—use clean domain.com.',
      'Formatting: Preserve clean line breaks and avoid leading/trailing whitespace.',
      'Spintax: Only generate {option A|option B} spintax variations when requested by the user.',
    ].join('\n');

    const payload = {
      messages: chat.messages
        .filter((m) => !m.isError)
        .slice(-16)
        .map((m) => ({ role: m.role, content: m.content })),
      brandContext: brandCtx,
      brand: brandCtx,
      scannedSites: chat.scannedContexts,
      scannedContexts: chat.scannedContexts,
      autoScanUrls: true,
      openRouterKey,
      geminiApiKey,
      aiModel: state.aiModel || 'anthropic/claude-3.5-haiku',
      postingRulesSummary,
    };

    const resp = await fetch('/api/ai/marketer-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const result = await resp.json().catch(() => null);

    if (!resp.ok || !result || !result.success) {
      const errMsg = result?.error || 'Could not reach the AI assistant service.';
      if (result?.needsApiKey) {
        showDashboardApiKeyPrompt();
      }
      chat.messages.push({
        role: 'assistant',
        isError: true,
        retryPrompt: promptText,
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
      });
      renderDashboardAssistantMessages(false);
      persistDashboardAssistantChat(true);
      return;
    }

    if (Array.isArray(result.scannedSources) && result.scannedSources.length > 0) {
      result.scannedSources.forEach((src) => {
        upsertDashboardAssistantContext({ ...src, sourceType: 'url' });
        const cacheKey = normalizeDashboardAssistantUrlKey(src?.url || src?.domain || '');
        if (cacheKey) dashAssistantUrlScanCache.set(cacheKey, { ...src, sourceType: 'url' });
      });
    }

    const returnedAssets = Array.isArray(result.assets)
      ? result.assets
      : (Array.isArray(result.deliverables) ? result.deliverables : []);

    chat.messages.push({
      role: 'assistant',
      content: result.reply || 'Here is your generated copy:',
      deliverables: returnedAssets,
      model: result.model || state.aiModel || 'anthropic/claude-3.5-haiku',
      timestamp: Date.now(),
    });
    renderDashboardAssistantMessages(false);
    persistDashboardAssistantChat(true);
  } catch (err) {
    chat.messages.push({
      role: 'assistant',
      isError: true,
      retryPrompt: promptText,
      content: `Error: ${err?.message || 'Unexpected assistant failure.'}`,
      timestamp: Date.now(),
    });
    renderDashboardAssistantMessages(false);
    persistDashboardAssistantChat(true);
  } finally {
    dashAssistantIsSending = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function initDashboardAssistantEvents() {
  if (dashAssistantEventsInitialized) return;
  dashAssistantEventsInitialized = true;

  const inputEl = document.getElementById('dash-ai-assistant-input');
  if (inputEl) {
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = `${Math.min(Math.max(inputEl.scrollHeight, 56), 150)}px`;
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendDashboardAssistantMessage();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dash-assistant-add-menu') && !e.target.closest('.dash-assistant-add-toggle')) {
      closeAllDashboardAssistantAddMenus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDashboardAssistantAddMenus();
  });
}

function renderAiAssistantSection() {
  initDashboardAssistantEvents();
  refreshDashboardAssistantGateState();
  renderDashboardAssistantContextChips();
  renderDashboardAssistantMessages(dashAssistantIsSending);
}

window.addEventListener('DOMContentLoaded', initDashboard);
