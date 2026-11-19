// Simple working background script
console.log('Background script starting...');

try {
  importScripts('supabase-client.js', 'auto-variation-engine.js');
} catch (e) {
  console.warn('Could not importScripts extension helpers:', e);
}

// Simple logger that always works
const logger = {
  log: (...args) => console.log('[BG]', ...args),
  error: (...args) => console.error('[BG ERROR]', ...args),
  warn: (...args) => console.warn('[BG WARN]', ...args)
};

// Supabase Cloud Persistence State (Phase 3 & 4)
let supabaseConfig = {
  url: '',
  anonKey: '',
  userId: 'default-user'
};
let appBaseUrl = 'http://localhost:3000';
let supabaseClient = (typeof SupabaseClient !== 'undefined') ? new SupabaseClient(supabaseConfig) : null;
let isApplyingRemoteSync = false;
let suppressVaultPushUntil = 0;
let vaultSyncDebounceTimer = null;
let vaultRestorePromise = null;
let supabaseSyncStatus = {
  status: 'offline', // 'synced' | 'syncing' | 'offline' | 'error'
  lastSyncTime: null,
  message: 'Local storage active'
};
let supabaseSyncDebounceTimer = null;

const BG_ADMIN_EMAILS = ['fintasticapps@gmail.com', 'domlord369@gmail.com'];
let activeTokenRefreshPromise = null;
let activeProfileRefreshPromise = null;
let lastRefreshedTokenCache = { oldRefreshToken: '', result: null, at: 0 };

function decodeJwtPayloadBg(token) {
  try {
    const raw = String(token || '').trim();
    const parts = raw.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

function isJwtExpiredBg(token, leewaySeconds = 0) {
  const payload = decodeJwtPayloadBg(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return (payload.exp * 1000) <= (Date.now() + leewaySeconds * 1000);
}

function getTokenFingerprintBg(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${raw.length}:${(hash >>> 0).toString(16)}`;
}

function getAuthSessionTimestampBg(session) {
  if (!session || typeof session !== 'object') return 0;
  const updatedMs = session.updatedAt ? new Date(session.updatedAt).getTime() : 0;
  const payload = decodeJwtPayloadBg(session.accessToken || session.token || '');
  const iatMs = typeof payload?.iat === 'number' ? payload.iat * 1000 : 0;
  return Math.max(Number.isFinite(updatedMs) ? updatedMs : 0, iatMs);
}

async function invalidateAuthSession(reason = 'session_expired', failedToken = '') {
  logger.warn('[Auth] Invalidating session:', reason);
  const existing = await new Promise((resolve) => {
    chrome.storage.local.get(
      ['authUserSession', 'cf_auth_session', 'sp_invalidated_token_fps'],
      (res) => resolve(res || {})
    );
  });

  const curSession = existing.authUserSession || existing.cf_auth_session || null;
  const fps = new Set(Array.isArray(existing.sp_invalidated_token_fps) ? existing.sp_invalidated_token_fps : []);
  const addFp = (tok) => {
    const fp = getTokenFingerprintBg(tok);
    if (fp) fps.add(fp);
  };
  addFp(failedToken);
  addFp(curSession?.accessToken || curSession?.token);
  addFp(curSession?.refreshToken);

  const fpList = Array.from(fps).slice(-15);

  await new Promise((resolve) => {
    chrome.storage.local.remove([
      'cf_auth_session',
      'authUserSession',
      'sp_entitlement_claim',
      'sp_workspace_bootstrap',
      'sp_selector_recipes',
      'sp_prompt_recipes',
      'directory_lists_catalog'
    ], resolve);
  });

  const markerUpdates = { sp_invalidated_token_fps: fpList };
  if (reason === 'explicit_signout') {
    markerUpdates.sp_explicit_signout_at = Date.now();
  }
  await new Promise((resolve) => chrome.storage.local.set(markerUpdates, resolve));

  if (supabaseClient) {
    supabaseClient.clearSession();
  }
  supabaseSyncStatus.status = 'offline';
  supabaseSyncStatus.message = 'Guest mode active';

  broadcastAuthSessionUpdated(null, null);
  broadcastWorkspaceBootstrapped(null, null);

  // Clean matching dead/signed-out auth from open Smart Poster portal tabs so vault restore won't re-inject it
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const deadTokens = [failedToken, curSession?.accessToken || curSession?.token || ''].filter(Boolean);
      const tabs = await chrome.tabs.query({});
      for (const t of tabs || []) {
        if (!t.id || !t.url) continue;
        if (/^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|(?:www\.)?smartposter\.pro|(?:www\.)?poster\.finola\.work|[^/]+\.run\.app|contactformsite\.pages\.dev)/i.test(t.url)) {
          chrome.tabs.sendMessage(t.id, {
            type: 'PORTAL_CLEAR_AUTH_SESSION',
            explicit: reason === 'explicit_signout',
            deadTokens
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  return { cleared: true, reason };
}

function attachSupabaseTokenRefreshHandler(client) {
  if (!client) return;
  if (typeof client.setRefreshCoordinator === 'function') {
    client.setRefreshCoordinator(async ({ accessToken, refreshToken, supabaseUrl, anonKey }) => {
      const res = await refreshSupabaseJwtToken({ accessToken, refreshToken }, supabaseUrl, anonKey);
      if (res && res.ok && res.accessToken) {
        const stored = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (d) => r(d || {})));
        const current = stored.authUserSession || stored.cf_auth_session;
        if (current && current.user) {
          const updated = normalizeAuthSession({
            ...current,
            accessToken: res.accessToken,
            token: res.accessToken,
            refreshToken: res.refreshToken || current.refreshToken || null,
            updatedAt: new Date().toISOString()
          });
          if (updated) {
            await new Promise((r) => chrome.storage.local.set({ authUserSession: updated, cf_auth_session: updated }, r));
            broadcastAuthSessionUpdated(updated, updated.entitlement || null);
          }
        }
      }
      return res;
    });
  }
  if (typeof client.setOnTokenRefresh === 'function') {
    client.setOnTokenRefresh(async ({ accessToken, refreshToken }) => {
      if (!accessToken) return;
      chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (res) => {
        const current = res?.authUserSession || res?.cf_auth_session;
        if (!current || !current.user) return;
        const updated = {
          ...current,
          accessToken,
          token: accessToken,
          refreshToken: refreshToken || current.refreshToken || null,
          updatedAt: new Date().toISOString()
        };
        chrome.storage.local.set({ authUserSession: updated, cf_auth_session: updated });
        broadcastAuthSessionUpdated(updated, updated.entitlement || null);
      });
    });
  }
  if (typeof client.setOnAuthInvalid === 'function') {
    client.setOnAuthInvalid(async ({ reason, failedToken }) => {
      await invalidateAuthSession(reason || 'supabase_401', failedToken || '');
    });
  }
}
attachSupabaseTokenRefreshHandler(supabaseClient);

// Simple storage for custom data
let customData = {};
let apiKey = null;
let geminiApiKey = null;
let openRouterModel = 'deepseek/deepseek-chat';
let settings = {
  mode: 'single',
  dataSource: 'custom',
  formActionMode: 'fill-only',
  financialDetection: true,
  slowMode: false,
  skipFileInputs: true,
  skipPasswordFields: true,
  apiTimeout: 30,
  debugMode: false
};
let templates = {};
let suppressionList = [];
let autoSuppress = true;
let testResults = [];
let isBulkTesting = false;
let completed_urls = {};

// Directory Submitter State
let directoryData = {
  productName: 'ContactFormSubmitter & Directory Suite',
  tagline: 'Automate contact forms & submit your startup to 100+ directories in minutes',
  elevatorPitch: 'Zero-friction marketing automation suite for indie hackers and agencies to blast outreach and get listed across high-DR directories with verified client reporting.',
  mediumSummary: 'ContactFormSubmitter & Directory Suite is an all-in-one growth acceleration toolkit. It combines intelligent contact form outreach, automated Product Hunt-style directory submissions, and verified reporting.',
  longDescription: 'ContactFormSubmitter & Directory Suite is an all-in-one growth acceleration toolkit. It combines intelligent contact form outreach, automated Product Hunt-style directory submissions across 100+ platforms, white-label client proof reporting, and an X (Twitter) organic amplification engine.',
  category: 'Marketing & Sales',
  pricingModel: 'Freemium',
  startingPrice: '$29',
  websiteUrl: 'https://contact-form-site-mu.vercel.app',
  demoUrl: 'https://contact-form-site-mu.vercel.app/demo',
  faviconUrl: 'https://contact-form-site-mu.vercel.app/favicon.png',
  logoUrl: 'https://contact-form-site-mu.vercel.app/logo.png',
  screenshotUrls: [
    'https://contact-form-site-mu.vercel.app/screenshot1.png',
    'https://contact-form-site-mu.vercel.app/screenshot2.png'
  ],
  makerName: 'Growth Engineering Team',
  makerEmail: 'founder@growthsuite.io',
  makerTwitter: '@growthsuite'
};
let directorySubmissions = [];
let activeDirectoryCampaignId = 'camp-default';
let directoryCampaigns = [
  {
    id: 'camp-default',
    name: 'ContactFormSubmitter & Directory Suite',
    updatedAt: new Date().toISOString(),
    data: { ...directoryData }
  }
];
let directoryBackups = [];
let directorySuppressionList = [];
let directoryAutoSuppress = true;
let directoryActionMode = 'fill-only';

// Twitter Module State
let twitterComments = [
  {
    id: 'tc-1',
    text: 'Great launch! 🚀 We built an automated outreach & directory submitter that helps startups list across 100+ platforms effortlessly.',
    images: ['https://contact-form-site-mu.vercel.app/logo.png']
  },
  {
    id: 'tc-2',
    text: 'If you want organic backlinks and instant traffic from high DR directories (PH, SaaSHub, Futurepedia), check this out!',
    images: []
  }
];
let twitterDrafts = [
  {
    id: 'td-1',
    text: '🚀 Launching ContactFormSubmitter & Directory Suite!\n\nAutomate your outreach, submit to 100+ product directories in 1 click, and share verified live proof reports with clients.',
    images: [
      'https://contact-form-site-mu.vercel.app/logo.png',
      'https://contact-form-site-mu.vercel.app/favicon.png'
    ]
  }
];
let twitterKeywords = [
  '#buildinpublic',
  'indie hacker launch',
  'saas directory submit',
  'b2b outreach tool',
  'product hunt launch'
];

// ============================================================
// PHASE 4: UNIVERSAL MASTER AUDIT & ANTI-BAN DATABASE
// ============================================================
let traffic_builder_master_logs = [];
let antiBanWindowDays = 30;

// Universal Master Audit Logger
function logToMasterAudit(entry) {
  const timestamp = entry.timestamp || Date.now();
  const id = entry.id || ('log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const targetUrl = entry.targetUrl || entry.url || '';
  let domain = entry.domain || '';
  if (!domain && targetUrl) {
    try {
      domain = new URL(targetUrl).hostname.replace(/^www\./, '');
    } catch {
      domain = targetUrl.split('/')[0] || '';
    }
  }

  const normalized = {
    id,
    module: entry.module || 'contact',
    targetUrl,
    domain,
    campaignName: entry.campaignName || 'Default B2B',
    contentSnippet: (entry.contentSnippet || entry.snippet || entry.message || '').substring(0, 160),
    status: entry.status || 'success', // 'success' | 'failed' | 'suppressed'
    statusCode: entry.statusCode || (entry.status === 'success' ? 200 : entry.status === 'suppressed' ? 429 : 500),
    error: entry.error || null,
    timestamp
  };

  traffic_builder_master_logs.unshift(normalized);
  if (traffic_builder_master_logs.length > 5000) {
    traffic_builder_master_logs = traffic_builder_master_logs.slice(0, 5000);
  }

  // Persist to chrome.storage.local (audit database)
  try {
    chrome.storage.local.set({ traffic_builder_master_logs }, () => {
      logger.log('[Audit] Master log saved, total entries:', traffic_builder_master_logs.length);
    });
  } catch (err) {
    logger.warn('[Audit] Failed to persist master logs to storage:', err);
  }

  // Also auto-add to module suppression if status === 'success'
  if (normalized.status === 'success' && normalized.targetUrl) {
    if (normalized.module === 'contact' && autoSuppress && !suppressionList.includes(normalized.targetUrl)) {
      suppressionList.push(normalized.targetUrl);
      chrome.storage.sync.set({ suppressionList });
    } else if (normalized.module === 'directory' && directoryAutoSuppress && !directorySuppressionList.includes(normalized.targetUrl)) {
      directorySuppressionList.push(normalized.targetUrl);
      chrome.storage.sync.set({ directorySuppressionList });
    }
  }

  return normalized;
}

// Strict Anti-Ban Pre-Flight Check (Phase 4 requirement)
function checkAntiBanPreflight(targetUrl, module = 'contact', windowDays = 30) {
  if (!targetUrl) return { blocked: false };

  let domain = '';
  try {
    domain = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = targetUrl.split('/')[0] || '';
  }

  const cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000);

  // Check 1: Master logs within windowDays with status 'success'
  const matched = traffic_builder_master_logs.find(log => {
    if (log.status !== 'success') return false;
    if (log.timestamp < cutoff) return false;
    if (log.targetUrl && (log.targetUrl === targetUrl || targetUrl.startsWith(log.targetUrl))) return true;
    if (domain && log.domain && log.domain === domain) return true;
    return false;
  });

  if (matched) {
    return {
      blocked: true,
      reason: `Anti-Ban Shield: contacted recently (${new Date(matched.timestamp).toLocaleDateString()}). Duplicate skipped to protect domain reputation.`,
      matchedLog: matched
    };
  }

  // Check 2: Module-specific suppression lists
  if (module === 'contact' && suppressionList.some(s => s && (targetUrl.includes(s) || (domain && s.includes(domain))))) {
    return {
      blocked: true,
      reason: 'URL matches Contact Form suppression list.',
      matchedLog: null
    };
  }
  if (module === 'directory' && directorySuppressionList.some(s => s && (targetUrl.includes(s) || (domain && s.includes(domain))))) {
    return {
      blocked: true,
      reason: 'URL matches Directory suppression list.',
      matchedLog: null
    };
  }

  return { blocked: false };
}

// ============================================================
// PHASE 3: COMMENTER MODULE STATE & 12 TIERED PRESETS
// ============================================================
const defaultCommenterPresets = [
  // Tier 1: Quick Reactions (Presets 1-3, 10-15 words)
  {
    id: 'cp-1',
    tier: 'short',
    angle: 'insight',
    title: 'Insightful Thread Reaction',
    text: 'Really interesting perspective on this topic! Thanks for sharing the detailed and actionable breakdown.',
    tags: ['reaction', 'quick']
  },
  {
    id: 'cp-2',
    tier: 'short',
    angle: 'question',
    title: 'Targeting Follow-Up Question',
    text: 'Great point about audience targeting. Have you noticed this trend accelerating lately as well?',
    tags: ['question', 'engagement']
  },
  {
    id: 'cp-3',
    tier: 'short',
    angle: 'insight',
    title: 'Framework Bookmark',
    text: 'Bookmarking this thread—super helpful framework for early-stage growth teams scaling outbound.',
    tags: ['bookmark', 'value']
  },

  // Tier 2: Medium Value Comments (Presets 4-8, 30-50 words with brand mention)
  {
    id: 'cp-4',
    tier: 'medium',
    angle: 'solution',
    title: 'Deliverability & Form Outreach',
    text: 'Spot on analysis regarding outreach fatigue. When we developed {name} ({url}), our biggest breakthrough was moving away from noisy cold blasts toward personalized, direct form touchpoints. Definitely worth testing for B2B pipelines.',
    tags: ['deliverability', 'b2b']
  },
  {
    id: 'cp-5',
    tier: 'medium',
    angle: 'insight',
    title: 'Reputation Shield & Anti-Ban Strategy',
    text: 'Deliverability is often the silent killer of outreach campaigns. We tackled this head-on with {name} by focusing on verified inboxing rather than high-bounce scrapes. Really appreciate your realistic take on keeping sender reputation intact.',
    tags: ['reputation', 'strategy']
  },
  {
    id: 'cp-6',
    tier: 'medium',
    angle: 'founder',
    title: 'Founder Distribution Cadence',
    text: 'Love this breakdown of founder marketing channels. For indie hackers launching on Product Hunt and directories, automated consistency beats sporadic bursts every time. Super valuable insights here!',
    tags: ['founder', 'growth']
  },
  {
    id: 'cp-7',
    tier: 'medium',
    angle: 'solution',
    title: 'Organic Value-First Outreach',
    text: 'Totally agree that organic community engagement outperforms spammy automation. Adding thoughtful value first and referencing solutions like {name} only where contextually relevant makes conversations 10x more productive.',
    tags: ['community', 'solution']
  },
  {
    id: 'cp-8',
    tier: 'medium',
    angle: 'insight',
    title: 'Channel ROI Comparison',
    text: 'Great breakdown of outbound versus inbound ROI. In our experience building {name} ({url}), combining high-DR directory presence with targeted outreach yielded our lowest customer acquisition cost. Solid framework!',
    tags: ['roi', 'acquisition']
  },

  // Tier 3: Thought-Leadership Replies (Presets 9-12, 60-95 words)
  {
    id: 'cp-9',
    tier: 'thought',
    angle: 'insight',
    title: 'Modern Direct Inboxing Architecture',
    text: "This is one of the most comprehensive breakdowns of modern B2B lead generation I've seen this month. The shift toward direct website form communications and targeted directory authority is huge for bootstrapped founders who don't have thousands to burn on complex cold-email warmups. By focusing on intent and keeping domain reputation pristine with rigorous anti-ban suppression, conversion rates stay remarkably steady. Excellent takeaways!",
    tags: ['thought-leadership', 'inboxing']
  },
  {
    id: 'cp-10',
    tier: 'thought',
    angle: 'founder',
    title: 'Distribution Velocity & Compound Backlinks',
    text: 'Fascinating discussion on scaling early distribution. Too many teams focus solely on building and forget that getting your first 100 paying customers requires relentless, multi-channel outreach. Whether you are submitting startup profiles across top launchpad directories or engaging directly with prospects via {name} ({url}), the compounding effect of backlinks and verified inboxing cannot be overstated. Bookmarking this to share with our growth cohort—stellar advice!',
    tags: ['thought-leadership', 'distribution']
  },
  {
    id: 'cp-11',
    tier: 'thought',
    angle: 'solution',
    title: 'Anti-Ban Safeguards & Safe Jitter Delays',
    text: 'The point about spam filters becoming more aggressive each quarter is critical. Traditional mailers are experiencing unprecedented bounce rates, which is exactly why direct contact form submissions and niche community engagement have become our go-to channels. When done with humanized timing delays and strict URL deduplication, you protect your brand while maintaining guaranteed delivery. Thanks for putting together such an actionable guide!',
    tags: ['thought-leadership', 'safety']
  },
  {
    id: 'cp-12',
    tier: 'thought',
    angle: 'founder',
    title: 'Founder Playbook: Search Authority + Direct Outreach',
    text: 'Brilliant analysis on sustainable founder-led growth. Early traction requires a balance of search authority (via high-DR directory profiles) and proactive direct outreach. Keeping your messaging contextual and respecting platform rate limits with smart interval jitter is the difference between getting flagged and building real enterprise relationships. Thanks for sharing these pragmatic lessons!',
    tags: ['thought-leadership', 'playbook']
  }
];

let commenterComments = [...defaultCommenterPresets];
let commenterPresets = [...defaultCommenterPresets];
let commenterCampaigns = [
  {
    id: 'camp-commenter-default',
    name: 'ContactFormSubmitter Growth Outreach',
    brandName: 'ContactFormSubmitter PRO',
    backlinkUrl: 'https://contactformsubmitter.pro',
    targetUrls: 'https://www.youtube.com/watch?v=sample1\nhttps://www.reddit.com/r/SaaS/comments/sample2\nhttps://techblog.example.com/growth-tactics\nhttps://www.pinterest.com/pin/sample3',
    intervalMinutes: 2.5,
    simulateTyping: true,
    skipSuppressed: true,
    mode: 'submit',
    updatedAt: new Date().toISOString()
  }
];
let activeCommenterCampaignId = 'camp-commenter-default';

let commenterHistory = [
  {
    id: 'ch-1',
    timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    url: 'https://techblog.example.com/growth-strategies-2026',
    platform: 'Generic / Web Blog',
    angle: 'Value-Add Insight',
    snippet: 'Really insightful breakdown on modern deliverability...',
    status: 'success'
  }
];

let commenterSettings = {
  persona: 'Helpful Founder',
  backlinkUrl: 'https://contactformsubmitter.pro',
  productName: 'ContactFormSubmitter PRO',
  authorName: 'Alex Rivera',
  authorEmail: 'alex@outreachpartner.com',
  defaultAngle: 'insight',
  intervalMinutes: 2.5,
  simulateTyping: true,
  skipSuppressed: true,
  mode: 'submit'
};

// Commenter Background Automation Runner State
let commenterRunning = false;
let commenterPaused = false;
let commenterQueue = [];
let commenterCurrentIndex = 0;
let commenterActiveUrl = '';
let commenterTimerId = null;
let commenterCampaignStats = {
  totalProcessed: 0,
  success: 0,
  blocked: 0,
  failed: 0,
  remaining: 0
};

// Load data on startup
chrome.storage.sync.get([
  'customData', 'apiKey', 'geminiApiKey', 'settings', 'templates', 'suppressionList', 'autoSuppress', 'testResults',
  'directoryData', 'directorySubmissions', 'directoryCampaigns', 'activeDirectoryCampaignId', 'directoryBackups',
  'directorySuppressionList', 'directoryAutoSuppress', 'directoryActionMode',
  'twitterComments', 'twitterDrafts', 'twitterKeywords',
  'commenterComments', 'commenterPresets', 'commenterCampaigns', 'activeCommenterCampaignId',
  'commenterHistory', 'commenterSettings'
], (result) => {
  logger.log('Loading stored sync data:', result);
  customData = result.customData || {};
  apiKey = result.apiKey || null;
  geminiApiKey = result.geminiApiKey || null;
  settings = { ...settings, ...result.settings };
  templates = result.templates || {};
  suppressionList = result.suppressionList || [];
  if (result.autoSuppress !== undefined) autoSuppress = result.autoSuppress;
  testResults = result.testResults || [];
  if (result.directoryData) directoryData = { ...directoryData, ...result.directoryData };
  if (result.directorySubmissions) directorySubmissions = result.directorySubmissions;
  if (result.directoryCampaigns && Array.isArray(result.directoryCampaigns) && result.directoryCampaigns.length > 0) {
    directoryCampaigns = result.directoryCampaigns;
  }
  if (result.activeDirectoryCampaignId) {
    activeDirectoryCampaignId = result.activeDirectoryCampaignId;
  }
  if (result.directoryBackups && Array.isArray(result.directoryBackups)) {
    directoryBackups = result.directoryBackups;
  }
  const activeCamp = directoryCampaigns.find(c => c.id === activeDirectoryCampaignId) || directoryCampaigns[0];
  if (activeCamp && activeCamp.data) {
    directoryData = { ...activeCamp.data };
  }
  if (result.directorySuppressionList) directorySuppressionList = result.directorySuppressionList;
  if (result.directoryAutoSuppress !== undefined) directoryAutoSuppress = result.directoryAutoSuppress;
  if (result.directoryActionMode) directoryActionMode = result.directoryActionMode;
  if (result.twitterComments) twitterComments = result.twitterComments;
  if (result.twitterDrafts) twitterDrafts = result.twitterDrafts;
  if (result.twitterKeywords) twitterKeywords = result.twitterKeywords;

  if (result.commenterPresets && Array.isArray(result.commenterPresets) && result.commenterPresets.length >= 10) {
    commenterPresets = result.commenterPresets;
    commenterComments = result.commenterPresets;
  }
  if (result.commenterCampaigns && Array.isArray(result.commenterCampaigns) && result.commenterCampaigns.length > 0) {
    commenterCampaigns = result.commenterCampaigns;
  }
  if (result.activeCommenterCampaignId) {
    activeCommenterCampaignId = result.activeCommenterCampaignId;
  }
  if (result.commenterHistory && Array.isArray(result.commenterHistory)) {
    commenterHistory = result.commenterHistory;
  }
  if (result.commenterSettings) {
    commenterSettings = { ...commenterSettings, ...result.commenterSettings };
  }
});

// Load local master audit logs and completed_urls on startup
chrome.storage.local.get(['traffic_builder_master_logs', 'completed_urls', 'completedUrls', 'apiKey', 'geminiApiKey'], (localRes) => {
  if (localRes?.apiKey && !apiKey) apiKey = localRes.apiKey;
  if (localRes?.geminiApiKey && !geminiApiKey) geminiApiKey = localRes.geminiApiKey;
  if (localRes && (localRes.completed_urls || localRes.completedUrls)) {
    completed_urls = localRes.completed_urls || localRes.completedUrls || {};
    logger.log('Loaded completed_urls:', Object.keys(completed_urls).length);
  }
  if (localRes && Array.isArray(localRes.traffic_builder_master_logs) && localRes.traffic_builder_master_logs.length > 0) {
    traffic_builder_master_logs = localRes.traffic_builder_master_logs;
    logger.log('Loaded master audit logs:', traffic_builder_master_logs.length);
  } else {
    // Seed initial audit log if empty
    traffic_builder_master_logs = [
      {
        id: 'log_seed_1',
        module: 'contact',
        targetUrl: 'https://saasdemo.example.com/contact',
        domain: 'saasdemo.example.com',
        campaignName: 'Default B2B',
        contentSnippet: 'Inquiry regarding B2B form marketing automation...',
        status: 'success',
        statusCode: 200,
        error: null,
        timestamp: Date.now() - 3600000 * 24 * 2
      },
      {
        id: 'log_seed_2',
        module: 'directory',
        targetUrl: 'https://futurepedia.io/submit',
        domain: 'futurepedia.io',
        campaignName: 'Product Hunt & Launchpads',
        contentSnippet: 'Submitted ContactFormSubmitter & Directory Suite listing',
        status: 'success',
        statusCode: 200,
        error: null,
        timestamp: Date.now() - 3600000 * 24 * 5
      },
      {
        id: 'log_seed_3',
        module: 'commenter',
        targetUrl: 'https://techblog.example.com/growth-strategies-2026',
        domain: 'techblog.example.com',
        campaignName: 'ContactFormSubmitter Growth Outreach',
        contentSnippet: 'Really insightful breakdown on modern deliverability...',
        status: 'success',
        statusCode: 200,
        error: null,
        timestamp: Date.now() - 3600000 * 12
      }
    ];
    chrome.storage.local.set({ traffic_builder_master_logs });
  }
});

// ============================================================
// PHASE 3: SUPABASE TWO-WAY CLOUD SYNC ENGINE
// ============================================================

function broadcastSyncStatus(statusObj) {
  supabaseSyncStatus = { ...supabaseSyncStatus, ...statusObj };
  try {
    chrome.runtime.sendMessage({
      type: 'syncStatusChanged',
      status: supabaseSyncStatus
    }).catch(() => {});
  } catch (_) {}
}

function scheduleSupabasePush() {
  if (supabaseSyncDebounceTimer) clearTimeout(supabaseSyncDebounceTimer);
  supabaseSyncDebounceTimer = setTimeout(() => {
    logger.log('[Supabase] Debounced 3s auto-push triggered');
    syncSupabaseData('push');
  }, 3000);
}

function buildConsolidatedSettingsPayload(localData = {}, syncData = {}) {
  const baseSettings = {
    ...(settings || {}),
    ...(syncData.settings || {}),
    ...(localData.settings || {})
  };
  const activeBrandId = localData.activeCampaignId || localData.activeBrandId || baseSettings.activeBrandId || '';
  const mergedSuppression = Array.isArray(syncData.suppressionList)
    ? syncData.suppressionList
    : (Array.isArray(localData.suppressionList)
      ? localData.suppressionList
      : (Array.isArray(baseSettings.suppressionList) ? baseSettings.suppressionList : (suppressionList || [])));
  const updatedAt = localData.settings?.updatedAt || syncData.settings?.updatedAt || baseSettings.updatedAt || new Date().toISOString();

  return {
    ...baseSettings,
    apiKey: syncData.apiKey !== undefined ? syncData.apiKey : (localData.apiKey !== undefined ? localData.apiKey : (baseSettings.apiKey ?? apiKey ?? '')),
    geminiApiKey: syncData.geminiApiKey !== undefined ? syncData.geminiApiKey : (localData.geminiApiKey !== undefined ? localData.geminiApiKey : (baseSettings.geminiApiKey ?? geminiApiKey ?? '')),
    aiModel: localData.aiModel || syncData.aiModel || baseSettings.aiModel || 'deepseek/deepseek-chat',
    customModels: Array.isArray(localData.customModels) ? localData.customModels : (Array.isArray(baseSettings.customModels) ? baseSettings.customModels : []),
    jevEnabled: localData.jevEnabled !== undefined ? Boolean(localData.jevEnabled) : Boolean(baseSettings.jevEnabled),
    jevModel: localData.jevModel || baseSettings.jevModel || 'typesafe/jev-1.14',
    captchaApiKey: localData.captchaApiKey !== undefined ? localData.captchaApiKey : (baseSettings.captchaApiKey || ''),
    safetyDelay: Number(localData.safetyDelay ?? baseSettings.safetyDelay ?? 3),
    randomnessLevel: (() => {
      const raw = localData.randomnessLevel ?? baseSettings.randomnessLevel ?? 3;
      const engine = typeof globalThis !== 'undefined' ? globalThis.SmartPosterVariationEngine : null;
      const migrated = Boolean(localData.sp_randomness_v2_migrated ?? baseSettings.sp_randomness_v2_migrated);
      return engine ? engine.migrateLegacyRandomnessLevel(raw, migrated) : Number(raw);
    })(),
    sp_randomness_v2_migrated: Boolean(localData.sp_randomness_v2_migrated ?? baseSettings.sp_randomness_v2_migrated ?? true),
    randomnessSynonyms: localData.randomnessSynonyms !== undefined ? localData.randomnessSynonyms !== false : (baseSettings.randomnessSynonyms !== false),
    randomnessDicts: localData.randomnessDicts !== undefined ? localData.randomnessDicts : (baseSettings.randomnessDicts || ''),
    companionWidgetEnabled: localData.floatingWidgetEnabled !== undefined
      ? localData.floatingWidgetEnabled !== false
      : (localData.companionWidgetEnabled !== undefined ? localData.companionWidgetEnabled !== false : (baseSettings.companionWidgetEnabled !== false)),
    companionShortcutsEnabled: localData.companionShortcutsEnabled !== undefined
      ? localData.companionShortcutsEnabled !== false
      : (baseSettings.companionShortcutsEnabled !== false),
    aiContextMatching: localData.aiContextMatching !== undefined
      ? localData.aiContextMatching !== false
      : (baseSettings.aiContextMatching !== false),
    simulateKeystrokes: localData.tb_simulate_keystrokes !== undefined
      ? Boolean(localData.tb_simulate_keystrokes)
      : Boolean(baseSettings.simulateKeystrokes),
    autoVariation: localData.tb_auto_variation !== undefined
      ? Boolean(localData.tb_auto_variation)
      : Boolean(baseSettings.autoVariation),
    autoSuppress: syncData.autoSuppress !== undefined
      ? syncData.autoSuppress !== false
      : (localData.autoSuppress !== undefined ? localData.autoSuppress !== false : (baseSettings.autoSuppress !== undefined ? baseSettings.autoSuppress !== false : autoSuppress !== false)),
    suppressionList: mergedSuppression,
    ruleTwitterStripProtocol: localData.ruleTwitterStripProtocol !== undefined
      ? localData.ruleTwitterStripProtocol !== false
      : (baseSettings.ruleTwitterStripProtocol !== false),
    activeBrandId,
    defaultHome: localData.defaultHome || baseSettings.defaultHome || 'dashboard',
    postingModuleOrder: Array.isArray(localData.postingModuleOrder)
      ? localData.postingModuleOrder
      : (Array.isArray(syncData.postingModuleOrder)
        ? syncData.postingModuleOrder
        : (Array.isArray(baseSettings.postingModuleOrder) ? baseSettings.postingModuleOrder : ['directory', 'comments', 'contact', 'email', 'dm', 'articles'])),
    disabledPostingModules: Array.isArray(localData.disabledPostingModules)
      ? localData.disabledPostingModules
      : (Array.isArray(syncData.disabledPostingModules)
        ? syncData.disabledPostingModules
        : (Array.isArray(baseSettings.disabledPostingModules) ? baseSettings.disabledPostingModules : [])),
    updatedAt
  };
}

async function applyConsolidatedSettingsToStorage(remoteSettings, updatedAtIso) {
  if (!remoteSettings || typeof remoteSettings !== 'object') return;
  const effectiveUpdatedAt = remoteSettings.updatedAt || updatedAtIso || new Date().toISOString();
  const nextSettings = { ...settings, ...remoteSettings, updatedAt: effectiveUpdatedAt };
  settings = nextSettings;
  if (remoteSettings.apiKey !== undefined) apiKey = remoteSettings.apiKey || null;
  if (remoteSettings.geminiApiKey !== undefined) geminiApiKey = remoteSettings.geminiApiKey || null;
  if (Array.isArray(remoteSettings.suppressionList)) suppressionList = remoteSettings.suppressionList;
  if (remoteSettings.autoSuppress !== undefined) autoSuppress = remoteSettings.autoSuppress !== false;

  const localUpdates = {
    settings: nextSettings,
    apiKey: remoteSettings.apiKey !== undefined ? (remoteSettings.apiKey || '') : (apiKey || ''),
    geminiApiKey: remoteSettings.geminiApiKey !== undefined ? (remoteSettings.geminiApiKey || '') : (geminiApiKey || ''),
    aiModel: remoteSettings.aiModel || 'deepseek/deepseek-chat',
    customModels: Array.isArray(remoteSettings.customModels) ? remoteSettings.customModels : [],
    jevEnabled: Boolean(remoteSettings.jevEnabled),
    jevModel: remoteSettings.jevModel || 'typesafe/jev-1.14',
    captchaApiKey: remoteSettings.captchaApiKey || '',
    safetyDelay: Number(remoteSettings.safetyDelay ?? 3),
    randomnessLevel: (() => {
      const raw = remoteSettings.randomnessLevel ?? 3;
      const engine = typeof globalThis !== 'undefined' ? globalThis.SmartPosterVariationEngine : null;
      const migrated = Boolean(remoteSettings.sp_randomness_v2_migrated);
      return engine ? engine.migrateLegacyRandomnessLevel(raw, migrated) : Number(raw);
    })(),
    sp_randomness_v2_migrated: true,
    randomnessSynonyms: remoteSettings.randomnessSynonyms !== false,
    randomnessDicts: remoteSettings.randomnessDicts || '',
    companionWidgetEnabled: remoteSettings.companionWidgetEnabled !== false,
    floatingWidgetEnabled: remoteSettings.companionWidgetEnabled !== false,
    companionShortcutsEnabled: remoteSettings.companionShortcutsEnabled !== false,
    aiContextMatching: remoteSettings.aiContextMatching !== false,
    tb_simulate_keystrokes: Boolean(remoteSettings.simulateKeystrokes),
    tb_auto_variation: Boolean(remoteSettings.autoVariation),
    autoSuppress: remoteSettings.autoSuppress !== false,
    suppressionList: Array.isArray(remoteSettings.suppressionList) ? remoteSettings.suppressionList : suppressionList,
    ruleTwitterStripProtocol: remoteSettings.ruleTwitterStripProtocol !== false,
    defaultHome: remoteSettings.defaultHome || 'dashboard',
    postingModuleOrder: Array.isArray(remoteSettings.postingModuleOrder)
      ? remoteSettings.postingModuleOrder
      : ['directory', 'comments', 'contact', 'email', 'dm', 'articles'],
    disabledPostingModules: Array.isArray(remoteSettings.disabledPostingModules)
      ? remoteSettings.disabledPostingModules
      : []
  };
  if (remoteSettings.activeBrandId) {
    localUpdates.activeBrandId = remoteSettings.activeBrandId;
    localUpdates.activeCampaignId = remoteSettings.activeBrandId;
  }

  const syncUpdates = {
    settings: nextSettings,
    apiKey: localUpdates.apiKey,
    aiModel: localUpdates.aiModel,
    autoSuppress: localUpdates.autoSuppress,
    suppressionList: localUpdates.suppressionList,
    floatingWidgetEnabled: localUpdates.floatingWidgetEnabled,
    companionWidgetEnabled: localUpdates.companionWidgetEnabled,
    postingModuleOrder: localUpdates.postingModuleOrder,
    disabledPostingModules: localUpdates.disabledPostingModules
  };

  await new Promise((r) => chrome.storage.local.set(localUpdates, r));
  if (chrome.storage.sync) {
    await new Promise((r) => chrome.storage.sync.set(syncUpdates, r));
  }
}

function isUntouchedDefaultBrand(b) {
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
  web: true
};

function normalizeResearchTimeframe(raw) {
  return raw === '24h' || raw === 'week' || raw === 'month' || raw === 'all' ? raw : 'week';
}

function toBgMsTimestamp(isoOrNum) {
  if (!isoOrNum) return 0;
  if (typeof isoOrNum === 'number') return Number.isFinite(isoOrNum) ? isoOrNum : 0;
  const ms = new Date(isoOrNum).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeContactFormSearchMode(mode) {
  const clean = String(mode || '').trim().toLowerCase();
  if (clean === 'max' || clean === 'strict' || clean === 'wide') return clean;
  return 'wide';
}

function buildContactFormSearchQueryBg(keyword, location = '', mode = 'wide') {
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
  return `${baseTerms} (intitle:contact OR intitle:support) ("name" OR "subject") "email" "message"`;
}

function createDefaultResearchConfig(overrides = {}) {
  const base = {
    frequency: 'daily',
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
    updatedAt: null
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
    managedAlertSignature: String(overrides.managedAlertSignature || '')
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

function buildCompetitorQueriesFallback(name) {
  const clean = String(name || '').trim();
  return [
    { text: `Alternative to ${clean}`, enabled: true },
    { text: `Alternate to ${clean}`, enabled: true },
    { text: `Best alternative to ${clean}`, enabled: true },
    { text: `${clean} vs`, enabled: true }
  ];
}

function mergeResearchConfig(localCfg, remoteCfg) {
  const a = localCfg && typeof localCfg === 'object' ? localCfg : {};
  const b = remoteCfg && typeof remoteCfg === 'object' ? remoteCfg : {};
  const aMs = toBgMsTimestamp(a.updatedAt || a.lastPolledAt);
  const bMs = toBgMsTimestamp(b.updatedAt || b.lastPolledAt);
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
        if (!out[key] || toBgMsTimestamp(ts) > toBgMsTimestamp(out[key])) {
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

  const genericTerms = new Set(['', 'google alert rss', 'custom alert rss']);
  const feedMap = new Map();
  [
    ...(Array.isArray(older.alertFeeds) ? older.alertFeeds : []),
    ...(Array.isArray(newer.alertFeeds) ? newer.alertFeeds : [])
  ].forEach((rawFeed) => {
    if (!rawFeed || typeof rawFeed !== 'object') return;
    const url = String(rawFeed.url || '').trim();
    if (!url) return;
    const delMs = toBgMsTimestamp(deletedFeedUrls[url]);
    const addedMs = toBgMsTimestamp(rawFeed.addedAt);
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
        addedAt: rawFeed.addedAt || new Date().toISOString()
      });
    } else {
      const exTerm = String(existing.term || '').trim();
      const nwTerm = String(rawFeed.term || '').trim();
      const exGeneric = genericTerms.has(exTerm.toLowerCase());
      const nwGeneric = genericTerms.has(nwTerm.toLowerCase());
      const chosenTerm = (!nwGeneric && (exGeneric || nwTerm.length > exTerm.length)) ? nwTerm : exTerm;
      const exAddMs = toBgMsTimestamp(existing.addedAt);
      const nwAddMs = toBgMsTimestamp(rawFeed.addedAt);
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
        addedAt: chosenAddedAt
      });
    }
  });

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
    const delMs = toBgMsTimestamp(deletedKeywords[key]);
    if (!shouldKeepWithTombstone(aKwSet.has(key), bKwSet.has(key), delMs)) return;
    kwMap.set(key, clean);
    kwOrder.push(clean);
  });

  const compMap = new Map();
  const aCompSet = new Set();
  const bCompSet = new Set();
  const normComp = (c) => {
    if (!c) return null;
    const name = String(typeof c === 'string' ? c : c.name || '').trim();
    if (!name) return null;
    const queries = Array.isArray(c.queries)
      ? c.queries.map((q) => ({ text: String(q?.text || '').trim(), enabled: q?.enabled !== false })).filter((q) => q.text)
      : buildCompetitorQueriesFallback(name);
    return {
      id: (typeof c === 'object' && c.id) ? c.id : 'comp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      queries,
      ...(typeof c === 'object' && c.orQuery ? { orQuery: String(c.orQuery).trim() } : {}),
      ...(typeof c === 'object' && c.mode ? { mode: String(c.mode) } : {}),
      ...(typeof c === 'object' && (c.starred || c.bookmarked) ? { starred: true } : {})
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
    const delMs = toBgMsTimestamp(deletedCompetitors[key]);
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
      const exTs = toBgMsTimestamp(existing.publishedAt || existing.addedAt || existing.fetchedAt);
      const tTs = toBgMsTimestamp(t.publishedAt || t.addedAt || t.fetchedAt);
      const base = tTs > exTs ? { ...existing, ...t } : { ...t, ...existing };
      threadMap.set(url, { ...base, url, id: existing.id || t.id, status: winnerStatus });
    }
  });
  const mergedThreads = Array.from(threadMap.values())
    .sort((x, y) => toBgMsTimestamp(y.publishedAt || y.addedAt || y.fetchedAt) - toBgMsTimestamp(x.publishedAt || x.addedAt || x.fetchedAt))
    .slice(0, 300);

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
        savedAt: it.savedAt || new Date().toISOString()
      });
    });
    return out;
  };
  const olderMs = bMs > aMs ? aMs : bMs;
  const newerMs = bMs > aMs ? bMs : aMs;
  [
    { list: older.savedFeeds, cfgMs: olderMs },
    { list: newer.savedFeeds, cfgMs: newerMs }
  ].forEach(({ list, cfgMs }) => {
    (Array.isArray(list) ? list : []).forEach((rawSf) => {
      if (!rawSf || typeof rawSf !== 'object') return;
      const id = String(rawSf.id || '').trim();
      if (!id) return;
      const delMs = toBgMsTimestamp(deletedSavedFeedIds[id]);
      const sfActivityMs = Math.max(toBgMsTimestamp(rawSf.updatedAt), toBgMsTimestamp(rawSf.createdAt)) || cfgMs;
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
          updatedAt: rawSf.updatedAt || createdAt
        });
      } else {
        const mergedItems = normSavedFeedItems([...(existing.items || []), ...items]);
        const exUpMs = toBgMsTimestamp(existing.updatedAt || existing.createdAt);
        const nwUpMs = toBgMsTimestamp(rawSf.updatedAt || rawSf.createdAt);
        const winner = nwUpMs >= exUpMs ? rawSf : existing;
        const exCrMs = toBgMsTimestamp(existing.createdAt);
        const nwCrMs = toBgMsTimestamp(rawSf.createdAt);
        const createdAt = (nwCrMs > 0 && (exCrMs === 0 || nwCrMs < exCrMs)) ? rawSf.createdAt : existing.createdAt;
        savedFeedMap.set(id, {
          ...existing,
          ...rawSf,
          id,
          name: String(winner.name || existing.name || 'Saved Feed').trim() || 'Saved Feed',
          items: mergedItems,
          createdAt,
          updatedAt: nwUpMs >= exUpMs ? (rawSf.updatedAt || rawSf.createdAt) : existing.updatedAt
        });
      }
    });
  });

  const normTf = (tf) => (tf === '24h' || tf === 'week' || tf === 'month' || tf === 'all' ? tf : '');

  const aPollMs = toBgMsTimestamp(a.lastPolledAt);
  const bPollMs = toBgMsTimestamp(b.lastPolledAt);
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
    const query = buildContactFormSearchQueryBg(keyword, location, resolvedCfMode);
    return {
      id: String(entry.id || `cfk-${key.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`),
      keyword,
      location,
      query,
      createdAt: entry.createdAt || new Date().toISOString()
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
    const delMs = toBgMsTimestamp(deletedContactFormSearchKeys[key]);
    if (!shouldKeepWithTombstone(aCfSet.has(key), bCfSet.has(key), delMs)) return;
    cfMap.set(key, n);
  });

  return {
    frequency: newer.frequency || older.frequency || 'daily',
    quality: newer.quality || older.quality || 'all',
    feedTimeframe: normTf(newer.feedTimeframe) || normTf(older.feedTimeframe) || 'week',
    platforms: {
      ...DEFAULT_RESEARCH_PLATFORMS,
      ...(older.platforms || {}),
      ...(newer.platforms || {})
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
    updatedAt: updatedAt || null
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
  const exMs = toBgMsTimestamp(existingBrand.updatedAt);
  const inMs = toBgMsTimestamp(incomingBrand.updatedAt);
  const incomingWins = inMs >= exMs;
  const winner = incomingWins ? incomingBrand : existingBrand;
  const loser = incomingWins ? existingBrand : incomingBrand;
  const equalOrMissingTimestamp = exMs === 0 || inMs === 0 || exMs === inMs;

  const mergedRc = mergeResearchConfig(existingBrand.researchConfig, incomingBrand.researchConfig);
  const maxMs = Math.max(exMs, inMs, toBgMsTimestamp(mergedRc?.updatedAt));

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
    ['features', 'benefits', 'competitors'].forEach((arrKey) => {
      const wArr = Array.isArray(wBa[arrKey]) ? wBa[arrKey] : null;
      const lArr = Array.isArray(lBa[arrKey]) ? lBa[arrKey] : null;
      if (!wArr && lArr) ba[arrKey] = lArr;
      else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) ba[arrKey] = lArr;
    });
    if (lBa.proof || wBa.proof) {
      ba.proof = { ...(ba.proof || {}) };
      ['metrics', 'testimonials'].forEach((pKey) => {
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
  const commentUtils = (typeof globalThis !== 'undefined' && globalThis.SmartPosterCommentUtils) || null;
  if (commentUtils && typeof commentUtils.mergeCommentTagLists === 'function') {
    merged.commentTags = commentUtils.mergeCommentTagLists(loser.commentTags, winner.commentTags, equalOrMissingTimestamp, inUseTags);
  } else {
    const tagSet = new Set(['General']);
    const mergedTagOut = ['General'];
    const pushTag = (raw) => {
      const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!cleaned || cleaned.toLowerCase() === 'all') return;
      const lower = cleaned.toLowerCase();
      if (lower === 'general' || tagSet.has(lower)) return;
      tagSet.add(lower);
      mergedTagOut.push(cleaned);
    };
    (Array.isArray(winner.commentTags) ? winner.commentTags : []).forEach(pushTag);
    if (equalOrMissingTimestamp || !Array.isArray(winner.commentTags) || winner.commentTags.length === 0) {
      (Array.isArray(loser.commentTags) ? loser.commentTags : []).forEach(pushTag);
    }
    inUseTags.forEach(pushTag);
    merged.commentTags = mergedTagOut;
  }
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

  merged.researchConfig = mergedRc;
  if (maxMs > 0) {
    merged.updatedAt = new Date(maxMs).toISOString();
  }
  return merged;
}

function getMirroredResearchConfigFromBrands(brands, activeBrandId, fallbackRc = null) {
  const list = Array.isArray(brands) ? brands : [];
  const active = list.find((b) => b && (b.brandId === activeBrandId || b.campaignId === activeBrandId)) || list[0] || null;
  if (active && active.researchConfig && typeof active.researchConfig === 'object') {
    const id = active.brandId || active.campaignId || activeBrandId || '';
    return { ...createDefaultResearchConfig(active.researchConfig), ...(id ? { campaignId: id } : {}) };
  }
  if (fallbackRc && typeof fallbackRc === 'object') {
    const id = active?.brandId || active?.campaignId || activeBrandId || '';
    return { ...createDefaultResearchConfig(fallbackRc), ...(id ? { campaignId: id } : {}) };
  }
  return createDefaultResearchConfig();
}

function migrateLegacyResearchConfigToBrands(brands, activeBrandId, legacyCfg) {
  if (!Array.isArray(brands) || brands.length === 0) return { brands, changed: false };
  if (!legacyCfg || typeof legacyCfg !== 'object' || !hasResearchConfigData(legacyCfg)) {
    return { brands, changed: false };
  }
  const cloned = brands.map((b) => (b && typeof b === 'object' ? { ...b } : b));
  const taggedId = legacyCfg.campaignId || legacyCfg._campaignId || '';
  if (taggedId) {
    const idx = cloned.findIndex((b) => b && (b.brandId === taggedId || b.campaignId === taggedId));
    if (idx >= 0) {
      cloned[idx].researchConfig = mergeResearchConfig(cloned[idx].researchConfig, legacyCfg);
      return { brands: cloned, changed: true };
    }
    return { brands, changed: false };
  }
  if (cloned.some((b) => b && hasResearchConfigData(b.researchConfig))) {
    return { brands, changed: false };
  }
  const targetIdx = cloned.findIndex((b) => b && !isUntouchedDefaultBrand(b));
  const idx = targetIdx >= 0 ? targetIdx : Math.max(0, cloned.findIndex((b) => b && (b.brandId === activeBrandId || b.campaignId === activeBrandId)));
  if (!cloned[idx]) return { brands, changed: false };
  cloned[idx].researchConfig = mergeResearchConfig(cloned[idx].researchConfig, legacyCfg);
  if (!isUntouchedDefaultBrand(cloned[idx]) || hasResearchConfigData(legacyCfg)) {
    cloned[idx].updatedAt = cloned[idx].updatedAt || legacyCfg.updatedAt || legacyCfg.lastPolledAt || new Date().toISOString();
  }
  return { brands: cloned, changed: true };
}

const RESEARCH_PLATFORM_SITE_MAP = {
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
  pinterest: 'site:pinterest.com'
};

function countQueryWordsBg(str) {
  return String(str || '').trim().split(/\s+/).filter(Boolean).length;
}

function formatCompetitorOrQueryBg(comp) {
  if (comp && typeof comp === 'object' && comp.orQuery) {
    const custom = String(comp.orQuery).trim();
    if (custom) return custom;
  }
  const rawName = typeof comp === 'string' ? comp : (comp?.name || '');
  const clean = String(rawName || '').replace(/["()]/g, '').trim();
  if (!clean) return '';
  return `"${clean}" (alternative OR alternate OR vs)`;
}

function formatKeywordTermForAlertBg(rawTerm) {
  const clean = String(rawTerm || '').replace(/"/g, '').trim();
  if (!clean) return '';
  if (/[()]|\bOR\b|\bAND\b|site:/i.test(clean)) return `(${clean})`;
  return `"${clean}"`;
}

function buildGroupedGoogleAlertQueriesBg({ keywords = [], competitors = [], platforms = {} } = {}) {
  const termExprs = [];
  const seen = new Set();

  (Array.isArray(keywords) ? keywords : []).forEach((kw) => {
    const raw = String(typeof kw === 'string' ? kw : kw?.text || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const expr = formatKeywordTermForAlertBg(raw);
    if (expr) termExprs.push(expr);
  });

  (Array.isArray(competitors) ? competitors : []).forEach((comp) => {
    const orQ = formatCompetitorOrQueryBg(comp);
    if (!orQ) return;
    const key = orQ.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    termExprs.push(`(${orQ})`);
  });

  if (termExprs.length === 0) return [];

  const p = platforms || {};
  const includeWeb = p.web === true;
  const siteTokens = [];
  if (!includeWeb) {
    Object.entries(RESEARCH_PLATFORM_SITE_MAP).forEach(([platKey, siteExpr]) => {
      if (p[platKey] === true) siteTokens.push(siteExpr);
    });
  }

  // Split siteTokens into batches if many sites are picked so each query stays <= 28 words
  const siteGroups = [];
  if (siteTokens.length === 0) {
    siteGroups.push('');
  } else {
    let curSites = [];
    siteTokens.forEach((tok) => {
      const candidate = [...curSites, tok];
      const candidateExpr = `(${candidate.join(' OR ')})`;
      if (curSites.length > 0 && countQueryWordsBg(candidateExpr) > 13) {
        siteGroups.push(`(${curSites.join(' OR ')})`);
        curSites = [tok];
      } else {
        curSites = candidate;
      }
    });
    if (curSites.length > 0) siteGroups.push(`(${curSites.join(' OR ')})`);
  }

  const packedQueries = [];
  const maxWordsPerQuery = 27;

  siteGroups.forEach((siteSuffix) => {
    const suffixWords = siteSuffix ? countQueryWordsBg(siteSuffix) : 0;
    const termBudget = Math.max(4, maxWordsPerQuery - suffixWords);
    let currentChunk = [];

    const flushChunk = () => {
      if (currentChunk.length === 0) return;
      const termsPart = (currentChunk.length === 1 && !siteSuffix)
        ? currentChunk[0]
        : `(${currentChunk.join(' OR ')})`;
      packedQueries.push(siteSuffix ? `${termsPart} ${siteSuffix}` : termsPart);
      currentChunk = [];
    };

    termExprs.forEach((expr) => {
      const candidate = [...currentChunk, expr];
      const joined = `(${candidate.join(' OR ')})`;
      if (currentChunk.length > 0 && countQueryWordsBg(joined) > termBudget) {
        flushChunk();
      }
      currentChunk.push(expr);
    });
    flushChunk();
  });

  return packedQueries;
}

function computeManagedAlertSignatureBg(rc = {}) {
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
    q: String(rc?.quality || 'all')
  });
}

function hasMeaningfulVaultData(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const brands = Array.isArray(snapshot.brandProfiles)
    ? snapshot.brandProfiles
    : (Array.isArray(snapshot.campaignProfiles) ? snapshot.campaignProfiles : []);
  if (brands.some((b) => b && !isUntouchedDefaultBrand(b))) return true;
  if (brands.some((b) => b && !isUntouchedDefaultBrand(b) && hasResearchConfigData(b.researchConfig))) return true;
  if (snapshot.completedUrls && Object.keys(snapshot.completedUrls).length > 0) return true;
  if (Array.isArray(snapshot.masterLogs) && snapshot.masterLogs.length > 0) return true;
  if (Array.isArray(snapshot.savedUrlSets) && snapshot.savedUrlSets.length > 0) return true;
  if (Array.isArray(snapshot.suppressionList) && snapshot.suppressionList.length > 0) return true;
  if (snapshot.apiKey && String(snapshot.apiKey).trim()) return true;
  if (snapshot.geminiApiKey && String(snapshot.geminiApiKey).trim()) return true;
  if (snapshot.templates && Object.keys(snapshot.templates).length > 0) return true;
  if (snapshot.customData && Object.keys(snapshot.customData).length > 0) return true;
  if (snapshot.directoryPrefs && ((snapshot.directoryPrefs.bookmarkedIds?.length || 0) > 0 || (snapshot.directoryPrefs.customDirectories?.length || 0) > 0)) return true;
  if (snapshot.researchConfig && ((snapshot.researchConfig.keywords?.length || 0) > 0 || (snapshot.researchConfig.competitors?.length || 0) > 0 || (snapshot.researchConfig.alertFeeds?.length || 0) > 0)) return true;
  const disMods = snapshot.disabledPostingModules || snapshot.settings?.disabledPostingModules;
  if (Array.isArray(disMods) && disMods.length > 0) return true;
  const modOrder = snapshot.postingModuleOrder || snapshot.settings?.postingModuleOrder;
  if (Array.isArray(modOrder) && modOrder.join(',') !== 'directory,comments,contact,email,dm,articles') return true;
  return false;
}

async function buildExtensionVaultSnapshot() {
  const [localData, syncData] = await Promise.all([
    new Promise((r) => chrome.storage.local.get(null, (d) => r(d || {}))),
    new Promise((r) => (chrome.storage.sync ? chrome.storage.sync.get(null, (d) => r(d || {})) : r({})))
  ]);
  let brandProfiles = Array.isArray(localData.campaignProfiles) && localData.campaignProfiles.length > 0
    ? localData.campaignProfiles
    : (Array.isArray(localData.brandProfiles) ? localData.brandProfiles : []);
  const activeBrandId = localData.activeCampaignId || localData.activeBrandId || brandProfiles[0]?.brandId || '';
  if (localData.researchConfig && typeof localData.researchConfig === 'object') {
    const mig = migrateLegacyResearchConfigToBrands(brandProfiles, activeBrandId, localData.researchConfig);
    if (mig.changed) brandProfiles = mig.brands;
  }
  const mirroredResearch = getMirroredResearchConfigFromBrands(brandProfiles, activeBrandId, localData.researchConfig || null);
  const reportsByBrand = {};
  Object.keys(localData).forEach((k) => {
    if (k.startsWith('brandReports_')) reportsByBrand[k] = localData[k];
  });
  const consolidatedSettings = buildConsolidatedSettingsPayload(localData, syncData);
  const completedMap = localData.completed_urls || localData.completedUrls || completed_urls || {};
  const suppression = Array.isArray(syncData.suppressionList)
    ? syncData.suppressionList
    : (Array.isArray(localData.suppressionList) ? localData.suppressionList : (suppressionList || []));

  return {
    schemaVersion: 2,
    updatedAt: localData.sp_vault_updated_at || new Date().toISOString(),
    brandProfiles,
    activeBrandId,
    deletedBrandTombstones: localData.deletedBrandTombstones || {},
    settings: consolidatedSettings,
    apiKey: consolidatedSettings.apiKey || '',
    geminiApiKey: consolidatedSettings.geminiApiKey || '',
    aiModel: consolidatedSettings.aiModel || 'deepseek/deepseek-chat',
    customModels: consolidatedSettings.customModels || [],
    jevEnabled: consolidatedSettings.jevEnabled,
    jevModel: consolidatedSettings.jevModel,
    captchaApiKey: consolidatedSettings.captchaApiKey,
    safetyDelay: consolidatedSettings.safetyDelay,
    randomnessLevel: consolidatedSettings.randomnessLevel,
    randomnessSynonyms: consolidatedSettings.randomnessSynonyms,
    randomnessDicts: consolidatedSettings.randomnessDicts,
    companionWidgetEnabled: consolidatedSettings.companionWidgetEnabled,
    companionShortcutsEnabled: consolidatedSettings.companionShortcutsEnabled,
    aiContextMatching: consolidatedSettings.aiContextMatching,
    simulateKeystrokes: consolidatedSettings.simulateKeystrokes,
    autoSuppress: consolidatedSettings.autoSuppress,
    suppressionList: suppression,
    ruleTwitterStripProtocol: consolidatedSettings.ruleTwitterStripProtocol,
    completedUrls: completedMap,
    directoryPrefs: localData.directoryPrefs || { bookmarkedIds: [], customDirectories: [] },
    researchConfig: mirroredResearch,
    masterLogs: localData.traffic_builder_master_logs || traffic_builder_master_logs || [],
    errorLogs: localData.tb_error_logs || [],
    savedUrlSets: localData.savedUrlSets || [],
    templates: localData.templates || syncData.templates || null,
    customData: localData.customData || null,
    defaultHome: localData.defaultHome || syncData.defaultHome || consolidatedSettings.defaultHome || '',
    navOrder: localData.navOrder || syncData.navOrder || null,
    postingModuleOrder: consolidatedSettings.postingModuleOrder,
    disabledPostingModules: consolidatedSettings.disabledPostingModules,
    reportsByBrand
  };
}

async function applyRestoredVaultSnapshot(snapshot, restoredSession = null, restoredClaim = null) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  isApplyingRemoteSync = true;
  suppressVaultPushUntil = Date.now() + 2000;
  try {
    const nowIso = new Date().toISOString();
    const localUpdates = {
      sp_vault_hydrated: true,
      sp_vault_updated_at: snapshot.updatedAt || nowIso
    };
    const syncUpdates = {};

    const brands = Array.isArray(snapshot.brandProfiles)
      ? snapshot.brandProfiles
      : (Array.isArray(snapshot.campaignProfiles) ? snapshot.campaignProfiles : (Array.isArray(snapshot.brands) ? snapshot.brands : null));

    if (Array.isArray(brands) && brands.length > 0) {
      let cleanedBrands = brands.map((b) => {
        if (!b || typeof b !== 'object') return b;
        const copy = { ...b };
        if (copy.brandId !== 'brand-focus-gummies-sample') {
          delete copy.isUntouchedDefault;
        }
        return copy;
      });
      const nextActive = snapshot.activeBrandId || snapshot.activeCampaignId || cleanedBrands[0]?.brandId || cleanedBrands[0]?.campaignId || '';
      if (snapshot.researchConfig && typeof snapshot.researchConfig === 'object') {
        const mig = migrateLegacyResearchConfigToBrands(cleanedBrands, nextActive, snapshot.researchConfig);
        if (mig.changed) cleanedBrands = mig.brands;
      }
      localUpdates.brandProfiles = cleanedBrands;
      localUpdates.campaignProfiles = cleanedBrands;
      if (nextActive) {
        localUpdates.activeBrandId = nextActive;
        localUpdates.activeCampaignId = nextActive;
      }
      localUpdates.researchConfig = getMirroredResearchConfigFromBrands(cleanedBrands, nextActive, snapshot.researchConfig || null);
    }
    if (snapshot.deletedBrandTombstones && typeof snapshot.deletedBrandTombstones === 'object') {
      localUpdates.deletedBrandTombstones = snapshot.deletedBrandTombstones;
    }
    if (snapshot.settings && typeof snapshot.settings === 'object') {
      const merged = { ...settings, ...snapshot.settings, updatedAt: snapshot.settings.updatedAt || snapshot.updatedAt || nowIso };
      settings = merged;
      localUpdates.settings = merged;
      syncUpdates.settings = merged;
    }
    const effApiKey = snapshot.apiKey !== undefined ? snapshot.apiKey : snapshot.settings?.apiKey;
    if (effApiKey !== undefined) {
      apiKey = effApiKey || null;
      localUpdates.apiKey = effApiKey || '';
      syncUpdates.apiKey = effApiKey || '';
    }
    const effGeminiKey = snapshot.geminiApiKey !== undefined ? snapshot.geminiApiKey : snapshot.settings?.geminiApiKey;
    if (effGeminiKey !== undefined) {
      geminiApiKey = effGeminiKey || null;
      localUpdates.geminiApiKey = effGeminiKey || '';
      syncUpdates.geminiApiKey = effGeminiKey || '';
    }
    const effModel = snapshot.aiModel || snapshot.settings?.aiModel;
    if (effModel) {
      localUpdates.aiModel = effModel;
      syncUpdates.aiModel = effModel;
    }
    if (Array.isArray(snapshot.customModels || snapshot.settings?.customModels)) {
      localUpdates.customModels = snapshot.customModels || snapshot.settings?.customModels;
    }
    if (snapshot.jevEnabled !== undefined || snapshot.settings?.jevEnabled !== undefined) {
      localUpdates.jevEnabled = Boolean(snapshot.jevEnabled ?? snapshot.settings?.jevEnabled);
    }
    if (snapshot.jevModel || snapshot.settings?.jevModel) {
      localUpdates.jevModel = snapshot.jevModel || snapshot.settings?.jevModel;
    }
    if (snapshot.captchaApiKey !== undefined || snapshot.settings?.captchaApiKey !== undefined) {
      localUpdates.captchaApiKey = String(snapshot.captchaApiKey ?? snapshot.settings?.captchaApiKey ?? '');
    }
    if (snapshot.safetyDelay !== undefined || snapshot.settings?.safetyDelay !== undefined) {
      localUpdates.safetyDelay = Number(snapshot.safetyDelay ?? snapshot.settings?.safetyDelay ?? 3);
    }
    if (snapshot.randomnessLevel !== undefined || snapshot.settings?.randomnessLevel !== undefined) {
      const rawSnapshotLvl = snapshot.randomnessLevel ?? snapshot.settings?.randomnessLevel ?? 3;
      const engine = typeof globalThis !== 'undefined' ? globalThis.SmartPosterVariationEngine : null;
      const alreadyMigrated = Boolean(snapshot.sp_randomness_v2_migrated);
      localUpdates.randomnessLevel = engine
        ? engine.migrateLegacyRandomnessLevel(rawSnapshotLvl, alreadyMigrated)
        : (Number(rawSnapshotLvl) || 3);
    }
    if (snapshot.randomnessSynonyms !== undefined || snapshot.settings?.randomnessSynonyms !== undefined) {
      localUpdates.randomnessSynonyms = (snapshot.randomnessSynonyms ?? snapshot.settings?.randomnessSynonyms) !== false;
    }
    if (snapshot.randomnessDicts !== undefined || snapshot.settings?.randomnessDicts !== undefined) {
      localUpdates.randomnessDicts = String(snapshot.randomnessDicts ?? snapshot.settings?.randomnessDicts ?? '');
    }
    if (snapshot.companionWidgetEnabled !== undefined || snapshot.settings?.companionWidgetEnabled !== undefined) {
      const compEnabled = (snapshot.companionWidgetEnabled ?? snapshot.settings?.companionWidgetEnabled) !== false;
      localUpdates.companionWidgetEnabled = compEnabled;
      localUpdates.floatingWidgetEnabled = compEnabled;
      syncUpdates.companionWidgetEnabled = compEnabled;
      syncUpdates.floatingWidgetEnabled = compEnabled;
    }
    if (snapshot.companionShortcutsEnabled !== undefined || snapshot.settings?.companionShortcutsEnabled !== undefined) {
      localUpdates.companionShortcutsEnabled = (snapshot.companionShortcutsEnabled ?? snapshot.settings?.companionShortcutsEnabled) !== false;
    }
    if (snapshot.aiContextMatching !== undefined || snapshot.settings?.aiContextMatching !== undefined) {
      localUpdates.aiContextMatching = (snapshot.aiContextMatching ?? snapshot.settings?.aiContextMatching) !== false;
    }
    if (snapshot.simulateKeystrokes !== undefined || snapshot.settings?.simulateKeystrokes !== undefined) {
      localUpdates.tb_simulate_keystrokes = Boolean(snapshot.simulateKeystrokes ?? snapshot.settings?.simulateKeystrokes);
    }
    if (snapshot.autoSuppress !== undefined || snapshot.settings?.autoSuppress !== undefined) {
      autoSuppress = (snapshot.autoSuppress ?? snapshot.settings?.autoSuppress) !== false;
      localUpdates.autoSuppress = autoSuppress;
      syncUpdates.autoSuppress = autoSuppress;
    }
    if (Array.isArray(snapshot.suppressionList || snapshot.settings?.suppressionList)) {
      suppressionList = snapshot.suppressionList || snapshot.settings?.suppressionList;
      localUpdates.suppressionList = suppressionList;
      syncUpdates.suppressionList = suppressionList;
    }
    if (snapshot.ruleTwitterStripProtocol !== undefined || snapshot.settings?.ruleTwitterStripProtocol !== undefined) {
      localUpdates.ruleTwitterStripProtocol = (snapshot.ruleTwitterStripProtocol ?? snapshot.settings?.ruleTwitterStripProtocol) !== false;
    }
    if (snapshot.completedUrls && typeof snapshot.completedUrls === 'object') {
      completed_urls = snapshot.completedUrls;
      localUpdates.completed_urls = snapshot.completedUrls;
      localUpdates.completedUrls = snapshot.completedUrls;
    }
    if (snapshot.directoryPrefs && typeof snapshot.directoryPrefs === 'object') {
      localUpdates.directoryPrefs = snapshot.directoryPrefs;
    }
    if (snapshot.researchConfig && typeof snapshot.researchConfig === 'object' && !localUpdates.researchConfig) {
      localUpdates.researchConfig = snapshot.researchConfig;
    }
    if (Array.isArray(snapshot.masterLogs)) {
      traffic_builder_master_logs = snapshot.masterLogs;
      localUpdates.traffic_builder_master_logs = snapshot.masterLogs;
    }
    if (Array.isArray(snapshot.errorLogs)) {
      localUpdates.tb_error_logs = snapshot.errorLogs;
    }
    if (Array.isArray(snapshot.savedUrlSets)) {
      localUpdates.savedUrlSets = snapshot.savedUrlSets;
    }
    if (snapshot.templates && typeof snapshot.templates === 'object') {
      localUpdates.templates = snapshot.templates;
      syncUpdates.templates = snapshot.templates;
    }
    if (snapshot.customData && typeof snapshot.customData === 'object') {
      customData = snapshot.customData;
      localUpdates.customData = snapshot.customData;
    }
    if (snapshot.defaultHome) {
      localUpdates.defaultHome = snapshot.defaultHome;
      syncUpdates.defaultHome = snapshot.defaultHome;
    }
    if (Array.isArray(snapshot.navOrder)) {
      localUpdates.navOrder = snapshot.navOrder;
      syncUpdates.navOrder = snapshot.navOrder;
    }
    const effModuleOrder = Array.isArray(snapshot.postingModuleOrder)
      ? snapshot.postingModuleOrder
      : snapshot.settings?.postingModuleOrder;
    if (Array.isArray(effModuleOrder)) {
      localUpdates.postingModuleOrder = effModuleOrder;
      syncUpdates.postingModuleOrder = effModuleOrder;
    }
    const effDisabledModules = Array.isArray(snapshot.disabledPostingModules)
      ? snapshot.disabledPostingModules
      : snapshot.settings?.disabledPostingModules;
    if (Array.isArray(effDisabledModules)) {
      localUpdates.disabledPostingModules = effDisabledModules;
      syncUpdates.disabledPostingModules = effDisabledModules;
    }
    if (snapshot.reportsByBrand && typeof snapshot.reportsByBrand === 'object') {
      Object.entries(snapshot.reportsByBrand).forEach(([k, v]) => {
        if (k.startsWith('brandReports_') && Array.isArray(v)) {
          localUpdates[k] = v;
        }
      });
    }
    const normSes = restoredSession ? normalizeAuthSession(restoredSession) : null;
    if (normSes) {
      const fpCheck = await new Promise((r) => chrome.storage.local.get(['sp_invalidated_token_fps', 'sp_explicit_signout_at'], (d) => r(d || {})));
      const invalidatedFps = new Set(Array.isArray(fpCheck.sp_invalidated_token_fps) ? fpCheck.sp_invalidated_token_fps : []);
      const accessFp = getTokenFingerprintBg(normSes.accessToken);
      const refreshFp = getTokenFingerprintBg(normSes.refreshToken);
      const signoutAt = Number(fpCheck.sp_explicit_signout_at || 0);
      const sesTs = getAuthSessionTimestampBg(normSes);
      const isBlacklisted = (accessFp && invalidatedFps.has(accessFp)) || (refreshFp && invalidatedFps.has(refreshFp));
      const isBeforeExplicitSignout = signoutAt > 0 && sesTs <= signoutAt;
      const isDeadExpired = isJwtExpiredBg(normSes.accessToken, 0) && !normSes.refreshToken;
      if (!isBlacklisted && !isBeforeExplicitSignout && !isDeadExpired) {
        localUpdates.authUserSession = normSes;
        localUpdates.cf_auth_session = normSes;
        if (restoredClaim && isValidEntitlementClaimStructure(restoredClaim, normSes.user?.id, normSes.user?.email)) {
          localUpdates.sp_entitlement_claim = restoredClaim;
        } else if (normSes.entitlement) {
          localUpdates.sp_entitlement_claim = normSes.entitlement;
        }
        if (supabaseClient) supabaseClient.setSession(normSes);
      }
    }

    await new Promise((r) => chrome.storage.local.set(localUpdates, r));
    if (chrome.storage.sync && Object.keys(syncUpdates).length > 0) {
      await new Promise((r) => chrome.storage.sync.set(syncUpdates, r));
    }

    chrome.runtime.sendMessage({
      type: 'VAULT_RESTORED',
      updatedAt: localUpdates.sp_vault_updated_at
    }).catch(() => {});

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        (tabs || []).forEach((t) => {
          if (t.id && t.url && t.url.includes('dashboard')) {
            chrome.tabs.sendMessage(t.id, { type: 'VAULT_RESTORED_TO_PAGE' }).catch(() => {});
          }
        });
      });
    }
    return true;
  } finally {
    setTimeout(() => {
      isApplyingRemoteSync = false;
    }, 300);
  }
}

async function pushVaultSnapshotNow() {
  if (Date.now() < suppressVaultPushUntil) return { success: false, skipped: true };
  try {
    const snapshot = await buildExtensionVaultSnapshot();
    if (!hasMeaningfulVaultData(snapshot)) {
      return { success: false, empty: true };
    }

    const stored = await new Promise((r) => chrome.storage.local.get(['sp_vault_id', 'app_base_url'], (d) => r(d || {})));
    let vaultId = stored.sp_vault_id || '';
    const cfg = await ensurePortalAndSupabaseConfig(false).catch(() => ({ appBaseUrl }));
    const origins = await getCandidatePortalOrigins([cfg.appBaseUrl, appBaseUrl, stored.app_base_url]);

    // 1. Push to server browser-scoped vault (/api/extension/vault)
    for (const origin of origins) {
      try {
        const res = await fetch(`${origin}/api/extension/vault`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(vaultId ? { 'X-SP-Vault-Id': vaultId } : {})
          },
          body: JSON.stringify({ snapshot })
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success) {
            if (data.vaultId && data.vaultId !== vaultId) {
              vaultId = data.vaultId;
              isApplyingRemoteSync = true;
              suppressVaultPushUntil = Date.now() + 800;
              await new Promise((r) => chrome.storage.local.set({ sp_vault_id: vaultId, sp_vault_hydrated: true, sp_vault_updated_at: snapshot.updatedAt }, r));
              isApplyingRemoteSync = false;
            }
            if (origin !== appBaseUrl) {
              appBaseUrl = origin;
              chrome.storage.local.set({ app_base_url: origin });
            }
            break;
          }
        }
      } catch (_) {}
    }

    // 2. Mirror snapshot to any open Smart Poster portal tab's localStorage
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs || []) {
          if (!t.id || !t.url) continue;
          if (/^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|(?:www\.)?smartposter\.pro|(?:www\.)?poster\.finola\.work|[^/]+\.run\.app|contactformsite\.pages\.dev)/i.test(t.url)) {
            chrome.tabs.sendMessage(t.id, {
              type: 'BACKUP_VAULT_TO_PORTAL',
              snapshot,
              vaultId
            }).catch(() => {});
          }
        }
      } catch (_) {}
    }

    return { success: true, vaultId, updatedAt: snapshot.updatedAt };
  } catch (err) {
    logger.warn('[Vault] Push failed:', err?.message || err);
    return { success: false, error: err?.message || 'Vault push failed' };
  }
}

function scheduleVaultBackup() {
  if (Date.now() < suppressVaultPushUntil || isApplyingRemoteSync) return;
  if (vaultSyncDebounceTimer) clearTimeout(vaultSyncDebounceTimer);
  vaultSyncDebounceTimer = setTimeout(() => {
    pushVaultSnapshotNow().catch(() => {});
  }, 1200);
}

async function syncCloudStateWithPortal(mode = 'two-way') {
  const storageRes = await new Promise((r) => chrome.storage.local.get(null, (d) => r(d || {})));
  const session = normalizeAuthSession(storageRes.authUserSession || storageRes.cf_auth_session);
  if (!session || !session.user?.id || !session.accessToken) {
    return { success: false, guest: true };
  }

  const cfg = await ensurePortalAndSupabaseConfig(false, session.portalOrigin || '');
  const origins = await getCandidatePortalOrigins([session.portalOrigin, cfg.appBaseUrl, appBaseUrl]);

  for (const origin of origins) {
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` };
      let pulled = null;

      if (mode === 'pull' || mode === 'two-way') {
        let res = await fetch(`${origin}/api/user/cloud-state?userId=${encodeURIComponent(session.user.id)}`, { headers });
        if (res.status === 401) {
          if (session.refreshToken) {
            if (!cfg.supabaseUrl || !cfg.anonKey) {
              cfg = await ensurePortalAndSupabaseConfig(true, origin);
            }
            const refRes = await refreshSupabaseJwtToken(session, cfg.supabaseUrl, cfg.anonKey);
            if (refRes?.ok && refRes.accessToken) {
              session.accessToken = refRes.accessToken;
              session.token = refRes.accessToken;
              session.refreshToken = refRes.refreshToken || session.refreshToken;
              session.updatedAt = new Date().toISOString();
              await new Promise((r) => chrome.storage.local.set({ authUserSession: session, cf_auth_session: session }, r));
              headers.Authorization = `Bearer ${session.accessToken}`;
              res = await fetch(`${origin}/api/user/cloud-state?userId=${encodeURIComponent(session.user.id)}`, { headers });
            } else if (refRes?.rejected) {
              await invalidateAuthSession('cloud_state_refresh_rejected', session.accessToken);
              return { success: false, status: 401, loggedOut: true };
            }
          }
          if (res.status === 401) {
            const errCt = (res.headers.get('content-type') || '').toLowerCase();
            if (errCt.includes('application/json')) {
              const errBody = await res.json().catch(() => ({}));
              const errMsg = String(errBody?.error || '').toLowerCase();
              if (!errMsg.includes('not configured') && !errMsg.includes('unavailable')) {
                await invalidateAuthSession('cloud_state_401', session.accessToken);
                return { success: false, status: 401, loggedOut: true };
              }
            }
          }
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) continue;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success) {
            pulled = data;
            const localBrands = Array.isArray(storageRes.campaignProfiles) && storageRes.campaignProfiles.length > 0
              ? storageRes.campaignProfiles
              : (Array.isArray(storageRes.brandProfiles) ? storageRes.brandProfiles : []);
            const localHasReal = localBrands.some((b) => b && !isUntouchedDefaultBrand(b));
            const remoteBrands = Array.isArray(data.brands) ? data.brands : [];
            const remoteHasReal = remoteBrands.some((b) => b && !isUntouchedDefaultBrand(b));

            if (remoteHasReal || (!localHasReal && (data.userSettings || Object.keys(data.completedUrls || {}).length > 0 || (data.masterLogs || []).length > 0))) {
              const mergedMap = new Map();
              const tombstones = { ...(data.deletedBrandTombstones || {}), ...(storageRes.deletedBrandTombstones || {}) };
              if (localHasReal) {
                localBrands.forEach((b) => {
                  const id = b?.brandId || b?.campaignId;
                  if (id && !isUntouchedDefaultBrand(b)) mergedMap.set(id, b);
                });
              }
              remoteBrands.forEach((rb) => {
                const id = rb?.brandId || rb?.campaignId;
                if (!id) return;
                const tombMs = tombstones[id] ? new Date(tombstones[id]).getTime() : 0;
                const rbMs = rb.updatedAt ? new Date(rb.updatedAt).getTime() : 0;
                if (tombMs > rbMs) return;
                const existing = mergedMap.get(id);
                if (!existing) {
                  mergedMap.set(id, rb);
                } else {
                  mergedMap.set(id, mergeBrandRecords(existing, rb));
                }
              });

              await applyRestoredVaultSnapshot({
                brandProfiles: Array.from(mergedMap.values()),
                activeBrandId: data.userSettings?.activeBrandId || storageRes.activeBrandId || '',
                deletedBrandTombstones: tombstones,
                settings: data.userSettings || undefined,
                completedUrls: data.completedUrls || undefined,
                directoryPrefs: data.workspacePrefs ? {
                  bookmarkedIds: data.workspacePrefs.bookmarked_directory_ids || [],
                  customDirectories: data.workspacePrefs.custom_directories || []
                } : undefined,
                researchConfig: data.workspacePrefs?.research_config || undefined,
                masterLogs: Array.isArray(data.masterLogs) && data.masterLogs.length ? data.masterLogs : undefined,
                errorLogs: Array.isArray(data.errorLogs) && data.errorLogs.length ? data.errorLogs : undefined,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
      }

      if (mode === 'push' || mode === 'two-way') {
        const latestSnapshot = await buildExtensionVaultSnapshot();
        const latestStorage = await new Promise((r) => chrome.storage.local.get(['deletedBrandTombstones', 'deletedCompletedIds', 'pendingClearCompletedUrls', 'pendingClearCampaignLogs'], (d) => r(d || {})));
        const deletedBrandIds = Object.keys(latestStorage.deletedBrandTombstones || {});
        if (hasMeaningfulVaultData(latestSnapshot) || deletedBrandIds.length > 0 || latestStorage.pendingClearCompletedUrls) {
          const postRes = await fetch(`${origin}/api/user/cloud-state`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: session.user.id,
              brands: latestSnapshot.brandProfiles,
              deletedBrandIds,
              userSettings: latestSnapshot.settings,
              completedUrls: latestSnapshot.completedUrls,
              deletedCompletedIds: latestStorage.deletedCompletedIds,
              clearCompletedUrls: Boolean(latestStorage.pendingClearCompletedUrls),
              clearMasterLogs: Boolean(latestStorage.pendingClearCampaignLogs),
              workspacePrefs: {
                bookmarked_directory_ids: latestSnapshot.directoryPrefs?.bookmarkedIds || [],
                custom_directories: latestSnapshot.directoryPrefs?.customDirectories || [],
                research_config: latestSnapshot.researchConfig || {},
                updated_at: latestSnapshot.updatedAt
              },
              masterLogs: latestSnapshot.masterLogs,
              errorLogs: latestSnapshot.errorLogs
            })
          });
          const postJson = await postRes.json().catch(() => null);
          if (postRes.ok && postJson?.success) {
            const lastSyncTime = new Date().toISOString();
            chrome.storage.local.set({ supabase_last_sync: lastSyncTime });
            return { success: true, lastSyncTime, source: 'portal-cloud-state', pulled };
          }
          if (postJson?.error) {
            logger.warn('[CloudState Portal Push] Error from origin', origin, postJson.error);
          }
        } else if (pulled) {
          return { success: true, lastSyncTime: new Date().toISOString(), source: 'portal-cloud-state', pulled };
        }
      }
    } catch (_) {}
  }

  return { success: false, offline: true };
}

async function restoreVaultOnStartupOrInstall(force = false) {
  if (vaultRestorePromise && !force) return vaultRestorePromise;
  vaultRestorePromise = (async () => {
    try {
      const currentSnapshot = await buildExtensionVaultSnapshot();
      const localCheck = await new Promise((r) => chrome.storage.local.get(['sp_vault_hydrated', 'sp_vault_id', 'app_base_url', 'authUserSession', 'cf_auth_session'], (d) => r(d || {})));
      const localHasMeaningful = hasMeaningfulVaultData(currentSnapshot);
      if (!force && localCheck.sp_vault_hydrated && localHasMeaningful) {
        return { success: true, alreadyHydrated: true };
      }
      if (!force && localHasMeaningful) {
        // Current install already has real user edits; mark hydrated and back them up
        await new Promise((r) => chrome.storage.local.set({ sp_vault_hydrated: true }, r));
        scheduleVaultBackup();
        return { success: true, alreadyHasData: true };
      }

      let candidateSnapshot = null;
      let candidateSession = localCheck.authUserSession || localCheck.cf_auth_session || null;
      let candidateClaim = null;
      let discoveredVaultId = localCheck.sp_vault_id || '';

      // Source 1: Query all open Smart Poster portal tabs in parallel via content.js
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          const tabs = await chrome.tabs.query({});
          const portalTabs = (tabs || []).filter(
            (t) => t.id && t.url && /^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|(?:www\.)?smartposter\.pro|(?:www\.)?poster\.finola\.work|[^/]+\.run\.app|contactformsite\.pages\.dev)/i.test(t.url)
          );
          const tabResponses = await Promise.all(
            portalTabs.map((t) => new Promise((resolve) => {
              let done = false;
              const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1200);
              chrome.tabs.sendMessage(t.id, { type: 'READ_PORTAL_VAULT' }, (resp) => {
                if (!done) {
                  done = true;
                  clearTimeout(timer);
                  resolve(chrome.runtime.lastError ? null : resp);
                }
              });
            }))
          );
          for (const tabResp of tabResponses) {
            if (tabResp && tabResp.success) {
              if (tabResp.vaultId && !discoveredVaultId) discoveredVaultId = tabResp.vaultId;
              if (tabResp.authSession && !candidateSession) candidateSession = tabResp.authSession;
              if (tabResp.entitlementClaim && !candidateClaim) candidateClaim = tabResp.entitlementClaim;
              if (tabResp.snapshot && hasMeaningfulVaultData(tabResp.snapshot)) {
                const tabTs = new Date(tabResp.snapshot.updatedAt || 0).getTime();
                const curTs = new Date(candidateSnapshot?.updatedAt || 0).getTime();
                if (!candidateSnapshot || tabTs >= curTs) {
                  candidateSnapshot = tabResp.snapshot;
                }
              }
            }
          }
        } catch (_) {}
      }

      // Source 2: Query server-side per-browser vault (/api/extension/vault) with fast abort timeout
      const cfg = await ensurePortalAndSupabaseConfig(false).catch(() => ({ appBaseUrl }));
      const origins = await getCandidatePortalOrigins([cfg.appBaseUrl, appBaseUrl, localCheck.app_base_url]);
      for (const origin of origins) {
        const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ac ? setTimeout(() => ac.abort(), 2500) : null;
        try {
          const res = await fetch(`${origin}/api/extension/vault`, {
            method: 'GET',
            credentials: 'include',
            signal: ac ? ac.signal : undefined,
            headers: discoveredVaultId ? { 'X-SP-Vault-Id': discoveredVaultId } : {}
          });
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (!ct.includes('application/json') || !res.ok) continue;
          const data = await res.json().catch(() => null);
          if (data?.success) {
            if (data.vaultId) discoveredVaultId = data.vaultId;
            if (data.snapshot && hasMeaningfulVaultData(data.snapshot)) {
              const srvTs = new Date(data.snapshot.updatedAt || 0).getTime();
              const curTs = new Date(candidateSnapshot?.updatedAt || 0).getTime();
              if (!candidateSnapshot || srvTs >= curTs) {
                candidateSnapshot = data.snapshot;
              }
            }
            break;
          }
        } catch (_) {
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      if (discoveredVaultId) {
        isApplyingRemoteSync = true;
        await new Promise((r) => chrome.storage.local.set({ sp_vault_id: discoveredVaultId }, r));
        isApplyingRemoteSync = false;
      }

      if (candidateSnapshot) {
        await applyRestoredVaultSnapshot(candidateSnapshot, candidateSession, candidateClaim);
        logger.log('[Vault] Restored previous workspace data after install/reinstall!');
      } else if (candidateSession) {
        await applyRestoredVaultSnapshot({ updatedAt: new Date().toISOString() }, candidateSession, candidateClaim);
      }

      // Source 3: Validate restored/existing session immediately so expired/revoked sessions are never left looking logged-in
      const postRestoreAuth = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (d) => r(d || {})));
      const effectiveRestoredSession = normalizeAuthSession(postRestoreAuth.authUserSession || postRestoreAuth.cf_auth_session || null);
      if (effectiveRestoredSession) {
        const verifiedSession = await refreshStoredUserProfile(effectiveRestoredSession).catch(() => effectiveRestoredSession);
        if (verifiedSession) {
          await syncCloudStateWithPortal('pull').catch(() => null);
        }
      }

      isApplyingRemoteSync = true;
      await new Promise((r) => chrome.storage.local.set({ sp_vault_hydrated: true }, r));
      isApplyingRemoteSync = false;

      return { success: true, restored: Boolean(candidateSnapshot || effectiveRestoredSession) };
    } catch (err) {
      logger.warn('[Vault] Startup restore error:', err?.message || err);
      return { success: false, error: err?.message };
    } finally {
      vaultRestorePromise = null;
    }
  })();
  return vaultRestorePromise;
}

async function syncSupabaseData(mode = 'two-way') {
  // Ensure config & session are hydrated even after MV3 Service Worker cold wake-up
  const preAuth = await new Promise((r) =>
    chrome.storage.local.get(['authUserSession', 'cf_auth_session', 'supabase_url', 'supabase_anon_key'], (d) => r(d || {}))
  );
  const preSession = normalizeAuthSession(preAuth.authUserSession || preAuth.cf_auth_session || null);
  await ensurePortalAndSupabaseConfig(false, preSession?.portalOrigin || '').catch(() => null);

  if (supabaseClient && supabaseClient.isConfigured() && preSession && !supabaseClient.isLoggedIn()) {
    supabaseClient.setSession(preSession);
  }

  if (!supabaseClient || !supabaseClient.isConfigured()) {
    const portalRes = await syncCloudStateWithPortal(mode).catch(() => null);
    if (portalRes && portalRes.success) {
      broadcastSyncStatus({
        status: 'synced',
        lastSyncTime: portalRes.lastSyncTime || new Date().toISOString(),
        message: 'All changes synced to cloud'
      });
      return {
        success: true,
        lastSyncTime: portalRes.lastSyncTime,
        source: 'portal-cloud-state',
        message: 'Cloud sync successful'
      };
    }
    broadcastSyncStatus({
      status: 'offline',
      message: 'Saved locally & backed up'
    });
    return { success: false, offline: true, message: 'Supabase not configured' };
  }

  if (!supabaseClient.isLoggedIn()) {
    broadcastSyncStatus({
      status: 'offline',
      message: 'Guest mode active'
    });
    return { success: false, offline: true, guest: true, message: 'Guest mode active' };
  }

  broadcastSyncStatus({ status: 'syncing', message: 'Syncing with Supabase...' });

  try {
    const storageArea = chrome.storage.local;
    const [localData, syncData] = await Promise.all([
      new Promise((r) => storageArea.get(null, (d) => r(d || {}))),
      new Promise((r) => (chrome.storage.sync ? chrome.storage.sync.get(null, (d) => r(d || {})) : r({})))
    ]);

    const localBrandsRaw = Array.isArray(localData.campaignProfiles) && localData.campaignProfiles.length > 0
      ? localData.campaignProfiles
      : (Array.isArray(localData.brandProfiles) ? localData.brandProfiles : []);
    const localCompleted = { ...(localData.completed_urls || localData.completedUrls || completed_urls || {}) };
    const localTombstones = { ...(localData.deletedBrandTombstones || {}) };
    const deletedCompletedSet = new Set(Array.isArray(localData.deletedCompletedIds) ? localData.deletedCompletedIds : []);

    let pulledBrandsCount = 0;
    let pulledUrlsCount = 0;

    // STEP 1: PULL REMOTE UPDATES (last-write-wins by updated_at)
    if (mode === 'pull' || mode === 'two-way') {
      const [remoteBrandsRes, remoteUrlsRes, remoteSettingsRes, remotePrefsRes, remoteLogsRes] = await Promise.all([
        supabaseClient.fetchBrands(),
        supabaseClient.fetchCompletedUrls(),
        supabaseClient.fetchUserSettings(),
        supabaseClient.fetchWorkspacePrefs(),
        supabaseClient.fetchCampaignLogs(200)
      ]);

      isApplyingRemoteSync = true;
      try {
        // 1A. Brands (with soft-delete tombstone reconciliation)
        if (remoteBrandsRes.success && Array.isArray(remoteBrandsRes.brands)) {
          const brandMap = new Map();
          localBrandsRaw.forEach((b) => {
            const id = b?.brandId || b?.campaignId;
            if (!id) return;
            const tombAt = localTombstones[id];
            if (tombAt && new Date(tombAt).getTime() >= new Date(b.updatedAt || 0).getTime()) {
              return;
            }
            brandMap.set(id, { ...b, brandId: id, campaignId: b.campaignId || id });
          });

          remoteBrandsRes.brands.forEach((remoteBrand) => {
            const id = remoteBrand?.brandId || remoteBrand?.campaignId;
            if (!id) return;
            const remoteTime = new Date(remoteBrand.deletedAt || remoteBrand.updatedAt || 0).getTime();
            const tombTime = new Date(localTombstones[id] || 0).getTime();

            if (remoteBrand.deletedAt) {
              const existing = brandMap.get(id);
              const existingTime = existing ? new Date(existing.updatedAt || 0).getTime() : 0;
              if (remoteTime >= existingTime) {
                brandMap.delete(id);
                localTombstones[id] = remoteBrand.deletedAt;
              }
              return;
            }

            if (tombTime > remoteTime) {
              return;
            }

            const existing = brandMap.get(id);
            if (!existing) {
              delete localTombstones[id];
              brandMap.set(id, remoteBrand);
              pulledBrandsCount++;
            } else {
              const localTime = new Date(existing.updatedAt || 0).getTime();
              const mergedBrand = mergeBrandRecords(existing, remoteBrand);
              brandMap.set(id, mergedBrand);
              if (remoteTime > localTime || JSON.stringify(mergedBrand.researchConfig) !== JSON.stringify(existing.researchConfig)) {
                pulledBrandsCount++;
              }
            }
          });

          let mergedBrands = Array.from(brandMap.values());
          const currentActive = localData.activeCampaignId || localData.activeBrandId;
          const nextActive = mergedBrands.some((b) => (b.brandId === currentActive || b.campaignId === currentActive))
            ? currentActive
            : (mergedBrands[0]?.brandId || '');
          const nextMirroredRc = getMirroredResearchConfigFromBrands(mergedBrands, nextActive, localData.researchConfig || null);

          await new Promise((r) => storageArea.set({
            brandProfiles: mergedBrands,
            campaignProfiles: mergedBrands,
            deletedBrandTombstones: localTombstones,
            researchConfig: nextMirroredRc,
            ...(nextActive ? { activeBrandId: nextActive, activeCampaignId: nextActive } : {})
          }, r));
        }

        // 1B. Completed URLs
        if (remoteUrlsRes.success && remoteUrlsRes.completedUrls && !localData.pendingClearCompletedUrls) {
          const remoteUrls = remoteUrlsRes.completedUrls;
          let changed = false;
          Object.entries(remoteUrls).forEach(([id, rec]) => {
            if (deletedCompletedSet.has(id)) return;
            if (!localCompleted[id]) {
              localCompleted[id] = rec;
              changed = true;
              pulledUrlsCount++;
            }
          });
          if (changed) {
            completed_urls = localCompleted;
            await new Promise((r) => storageArea.set({ completed_urls: localCompleted, completedUrls: localCompleted }, r));
          }
        }

        // 1C. Consolidated User Settings
        if (remoteSettingsRes.success && remoteSettingsRes.settings) {
          const remoteTime = new Date(remoteSettingsRes.updatedAt || remoteSettingsRes.settings?.updatedAt || 0).getTime();
          const localTime = new Date(localData.settings?.updatedAt || syncData.settings?.updatedAt || settings?.updatedAt || 0).getTime();
          if (remoteTime > localTime || (localTime === 0 && Object.keys(remoteSettingsRes.settings).length > 0)) {
            await applyConsolidatedSettingsToStorage(remoteSettingsRes.settings, remoteSettingsRes.updatedAt);
          }
        }

        // 1D. Workspace Prefs (researchConfig, directoryPrefs)
        if (remotePrefsRes.success && remotePrefsRes.prefs) {
          const rp = remotePrefsRes.prefs;
          const remotePrefsTime = new Date(rp.updated_at || 0).getTime();
          const localPrefsTime = new Date(localData.workspacePrefsUpdatedAt || 0).getTime();
          const localDirPrefs = localData.directoryPrefs || { bookmarkedIds: [], customDirectories: [] };
          const latestState = await new Promise((r) => storageArea.get(['brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig'], (d) => r(d || {})));
          let latestBrands = Array.isArray(latestState.campaignProfiles) && latestState.campaignProfiles.length > 0
            ? latestState.campaignProfiles
            : (Array.isArray(latestState.brandProfiles) ? latestState.brandProfiles : []);
          const latestActiveId = latestState.activeCampaignId || latestState.activeBrandId || latestBrands[0]?.brandId || '';
          const localResearch = getMirroredResearchConfigFromBrands(latestBrands, latestActiveId, latestState.researchConfig || {});

          if (remotePrefsTime > localPrefsTime || !latestState.researchConfig || hasResearchConfigData(rp.research_config)) {
            const customDirMap = new Map();
            (Array.isArray(localDirPrefs.customDirectories) ? localDirPrefs.customDirectories : []).forEach((d) => {
              if (d?.id) customDirMap.set(d.id, d);
            });
            (Array.isArray(rp.custom_directories) ? rp.custom_directories : []).forEach((d) => {
              if (d?.id) customDirMap.set(d.id, d);
            });

            const nextDirPrefs = {
              bookmarkedIds: remotePrefsTime > localPrefsTime && Array.isArray(rp.bookmarked_directory_ids)
                ? rp.bookmarked_directory_ids
                : Array.from(new Set([...(localDirPrefs.bookmarkedIds || []), ...(rp.bookmarked_directory_ids || [])])),
              customDirectories: Array.from(customDirMap.values())
            };
            let nextResearch = localResearch;
            const prefUpdates = {
              directoryPrefs: nextDirPrefs,
              workspacePrefsUpdatedAt: rp.updated_at || new Date().toISOString()
            };
            if (rp.research_config && typeof rp.research_config === 'object' && Object.keys(rp.research_config).length > 0) {
              const mig = migrateLegacyResearchConfigToBrands(latestBrands, latestActiveId, rp.research_config);
              if (mig.changed) {
                latestBrands = mig.brands;
                prefUpdates.brandProfiles = latestBrands;
                prefUpdates.campaignProfiles = latestBrands;
                nextResearch = getMirroredResearchConfigFromBrands(latestBrands, latestActiveId, localResearch);
              } else if (!hasResearchConfigData(localResearch)) {
                nextResearch = mergeResearchConfig(localResearch, rp.research_config);
              }
            }
            prefUpdates.researchConfig = nextResearch;

            await new Promise((r) => storageArea.set(prefUpdates, r));
          }
        }

        // 1E. Campaign Logs (Master Audit + Error Logs)
        if (remoteLogsRes.success && !localData.pendingClearCampaignLogs) {
          const localMaster = Array.isArray(localData.traffic_builder_master_logs)
            ? [...localData.traffic_builder_master_logs]
            : [...(traffic_builder_master_logs || [])];
          const masterSeen = new Set(localMaster.map((l) => l.id));
          let masterAdded = false;
          (remoteLogsRes.logs || []).forEach((rl) => {
            if (rl?.id && !masterSeen.has(rl.id)) {
              masterSeen.add(rl.id);
              localMaster.push(rl);
              masterAdded = true;
            }
          });

          const localErrs = Array.isArray(localData.tb_error_logs) ? [...localData.tb_error_logs] : [];
          const errSeen = new Set(localErrs.map((e) => e.id));
          let errAdded = false;
          (remoteLogsRes.errorLogs || []).forEach((re) => {
            if (re?.id && !errSeen.has(re.id)) {
              errSeen.add(re.id);
              localErrs.push(re);
              errAdded = true;
            }
          });

          const logUpdates = {};
          if (masterAdded) {
            localMaster.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            traffic_builder_master_logs = localMaster.slice(0, 5000);
            logUpdates.traffic_builder_master_logs = traffic_builder_master_logs;
          }
          if (errAdded) {
            localErrs.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            logUpdates.tb_error_logs = localErrs.slice(0, 200);
          }
          if (Object.keys(logUpdates).length > 0) {
            await new Promise((r) => storageArea.set(logUpdates, r));
          }
        }
      } finally {
        isApplyingRemoteSync = false;
      }
    }

    // STEP 2: PUSH LOCAL TO REMOTE
    if (mode === 'push' || mode === 'two-way') {
      const [latestLocal, latestSync] = await Promise.all([
        new Promise((r) => storageArea.get(null, (d) => r(d || {}))),
        new Promise((r) => (chrome.storage.sync ? chrome.storage.sync.get(null, (d) => r(d || {})) : r({})))
      ]);

      const activeBrands = Array.isArray(latestLocal.campaignProfiles) && latestLocal.campaignProfiles.length > 0
        ? latestLocal.campaignProfiles
        : (Array.isArray(latestLocal.brandProfiles) ? latestLocal.brandProfiles : localBrandsRaw);
      const tombstones = latestLocal.deletedBrandTombstones || {};
      const activeIds = new Set(activeBrands.map((b) => b.brandId || b.campaignId).filter(Boolean));
      const tombstoneRows = Object.entries(tombstones)
        .filter(([id, delAt]) => id && delAt && !activeIds.has(id))
        .map(([id, delAt]) => ({
          brandId: id,
          campaignId: id,
          brandName: 'Deleted Campaign',
          deletedAt: delAt,
          updatedAt: delAt
        }));
      const brandsToPush = [...activeBrands, ...tombstoneRows];

      const completedToPush = latestLocal.completed_urls || latestLocal.completedUrls || localCompleted;
      const consolidatedSettings = buildConsolidatedSettingsPayload(latestLocal, latestSync);
      const dirPrefs = latestLocal.directoryPrefs || { bookmarkedIds: [], customDirectories: [] };
      const latestActiveId = latestLocal.activeCampaignId || latestLocal.activeBrandId || activeBrands[0]?.brandId || '';
      const researchCfg = getMirroredResearchConfigFromBrands(activeBrands, latestActiveId, latestLocal.researchConfig || {});
      const masterToPush = Array.isArray(latestLocal.traffic_builder_master_logs)
        ? latestLocal.traffic_builder_master_logs
        : (traffic_builder_master_logs || []);
      const errorsToPush = Array.isArray(latestLocal.tb_error_logs) ? latestLocal.tb_error_logs : [];

      if (latestLocal.pendingClearCompletedUrls) {
        await supabaseClient.clearCompletedUrls();
      } else if (Array.isArray(latestLocal.deletedCompletedIds) && latestLocal.deletedCompletedIds.length > 0) {
        for (const delId of latestLocal.deletedCompletedIds) {
          await supabaseClient.deleteCompletedUrl(delId);
        }
      }

      if (latestLocal.pendingClearCampaignLogs) {
        await supabaseClient.clearCampaignLogs(latestLocal.pendingClearCampaignLogsStatus || null);
      }

      const pushResults = await Promise.all([
        supabaseClient.upsertBrands(brandsToPush).then((r) => ({ table: 'brands', ...r })),
        supabaseClient.upsertCompletedUrls(completedToPush).then((r) => ({ table: 'completed_urls', ...r })),
        supabaseClient.upsertUserSettings(consolidatedSettings).then((r) => ({ table: 'user_settings', ...r })),
        supabaseClient.upsertWorkspacePrefs({
          bookmarked_directory_ids: Array.isArray(dirPrefs.bookmarkedIds) ? dirPrefs.bookmarkedIds : [],
          custom_directories: Array.isArray(dirPrefs.customDirectories) ? dirPrefs.customDirectories : [],
          research_config: researchCfg,
          updated_at: latestLocal.workspacePrefsUpdatedAt || new Date().toISOString()
        }).then((r) => ({ table: 'user_workspace_prefs', ...r })),
        supabaseClient.upsertCampaignLogs(masterToPush, errorsToPush).then((r) => ({ table: 'campaign_logs', ...r }))
      ]);

      const failedWrites = pushResults.filter((r) => r && r.success === false && !r.guest);
      if (failedWrites.length > 0) {
        const errSummary = failedWrites.map((f) => `${f.table}: ${f.error || 'write failed'}`).join('; ');
        logger.warn('[Supabase] Direct write failed, attempting portal cloud-state fallback:', errSummary);
        const portalFallback = await syncCloudStateWithPortal('push').catch(() => null);
        if (!portalFallback || !portalFallback.success) {
          broadcastSyncStatus({
            status: 'error',
            message: `Sync error (${failedWrites[0].table})`
          });
          return {
            success: false,
            error: errSummary,
            failedTables: failedWrites
          };
        }
      }

      if (latestLocal.pendingClearCompletedUrls || (latestLocal.deletedCompletedIds && latestLocal.deletedCompletedIds.length > 0) || latestLocal.pendingClearCampaignLogs) {
        isApplyingRemoteSync = true;
        try {
          await new Promise((r) => storageArea.remove([
            'pendingClearCompletedUrls',
            'deletedCompletedIds',
            'pendingClearCampaignLogs',
            'pendingClearCampaignLogsStatus'
          ], r));
        } finally {
          isApplyingRemoteSync = false;
        }
      }
    }

    const lastSyncTime = new Date().toISOString();
    chrome.storage.local.set({ supabase_last_sync: lastSyncTime });

    broadcastSyncStatus({
      status: 'synced',
      lastSyncTime,
      message: 'All changes synced to cloud'
    });

    return {
      success: true,
      lastSyncTime,
      pulledBrandsCount,
      pulledUrlsCount,
      message: 'Cloud sync successful'
    };
  } catch (err) {
    logger.warn('[Supabase Sync Error]:', err);
    broadcastSyncStatus({
      status: 'error',
      message: err?.message || 'Cloud sync failed'
    });
    return { success: false, offline: true, error: err.message };
  }
}

const SYNCED_LOCAL_KEYS = new Set([
  'campaignProfiles', 'brandProfiles', 'deletedBrandTombstones',
  'completed_urls', 'completedUrls', 'deletedCompletedIds', 'pendingClearCompletedUrls',
  'settings', 'researchConfig', 'directoryPrefs', 'workspacePrefsUpdatedAt',
  'traffic_builder_master_logs', 'tb_error_logs', 'pendingClearCampaignLogs',
  'apiKey', 'geminiApiKey', 'aiModel', 'customModels', 'jevEnabled', 'jevModel',
  'captchaApiKey', 'safetyDelay', 'randomnessLevel', 'sp_randomness_v2_migrated', 'randomnessSynonyms', 'randomnessDicts',
  'companionWidgetEnabled', 'floatingWidgetEnabled', 'companionShortcutsEnabled',
  'aiContextMatching', 'tb_simulate_keystrokes', 'tb_auto_variation', 'autoSuppress', 'suppressionList',
  'ruleTwitterStripProtocol', 'activeBrandId', 'activeCampaignId', 'defaultHome',
  'savedUrlSets', 'templates', 'customData', 'navOrder', 'postingModuleOrder', 'disabledPostingModules'
]);
const SYNCED_SYNC_KEYS = new Set([
  'settings', 'apiKey', 'geminiApiKey', 'aiModel', 'autoSuppress', 'suppressionList',
  'floatingWidgetEnabled', 'companionWidgetEnabled', 'defaultHome', 'navOrder', 'templates',
  'postingModuleOrder', 'disabledPostingModules'
]);

// Storage change listener to trigger debounced auto-push (both Supabase/Portal Cloud + Reinstall Vault)
// and pre-warm AI variation pools when Auto-Variation Level 4/5 is active
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!isApplyingRemoteSync && Date.now() >= suppressVaultPushUntil) {
      const keys = Object.keys(changes || {});
      if (areaName === 'local' && keys.some((k) => SYNCED_LOCAL_KEYS.has(k) || k.startsWith('brandReports_'))) {
        scheduleSupabasePush();
        scheduleVaultBackup();
      } else if (areaName === 'sync' && keys.some((k) => SYNCED_SYNC_KEYS.has(k))) {
        scheduleSupabasePush();
        scheduleVaultBackup();
      }
    }

    if (areaName === 'local' && typeof VariationPoolManager !== 'undefined') {
      const poolRelevant = ['tb_auto_variation', 'randomnessLevel', 'activeBrandId', 'activeCampaignId', 'brandProfiles', 'campaignProfiles', 'twitterComments'];
      if (poolRelevant.some((k) => changes[k] !== undefined)) {
        VariationPoolManager.schedulePrewarmFromStorage();
      }
    }
  });
}

// ==========================================
// PHASE 3: PRE-WARMED AI VARIATION POOL MANAGER (Levels 4 & 5)
// ==========================================
const SP_VARIATION_POOL_KEY = 'sp_ai_variation_pool_v1';
const POOL_TARGET_BATCH = 6;
const POOL_LOW_WATERMARK = 2;
const POOL_MAX_ENTRIES = 80;
const POOL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const POOL_FAILURE_COOLDOWN_MS = 30 * 1000;

const VariationPoolManager = {
  _hydrated: false,
  _hydratePromise: null,
  _entries: {},
  _inflight: new Map(),
  _failTimestamps: new Map(),
  _persistTimer: null,
  _prewarmTimer: null,

  _getEngine() {
    return (typeof globalThis !== 'undefined' && globalThis.SmartPosterVariationEngine) || null;
  },

  makeKey(templateText, level, brand = null) {
    const engine = this._getEngine();
    const cleanText = String(templateText || '').trim();
    const lvl = engine ? engine.normalizeLevel(level, 4) : (Number(level) >= 5 ? 5 : 4);
    const brandIdOrName = String(brand?.brandId || brand?.campaignId || brand?.name || brand?.brandName || '').trim().toLowerCase();
    const textHash = engine ? engine.fnv1aHash(cleanText) : cleanText.slice(0, 48);
    const brandHash = engine ? engine.fnv1aHash(brandIdOrName) : '0';
    return `${textHash}:L${lvl}:B${brandHash}`;
  },

  async hydrate() {
    if (this._hydrated) return this._entries;
    if (this._hydratePromise) return this._hydratePromise;
    this._hydratePromise = new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get([SP_VARIATION_POOL_KEY], (res) => {
            try {
              const raw = res && res[SP_VARIATION_POOL_KEY];
              if (raw && typeof raw === 'object') {
                const now = Date.now();
                for (const [k, entry] of Object.entries(raw)) {
                  if (entry && typeof entry === 'object' && Array.isArray(entry.unused)) {
                    if (!entry.updatedAt || now - entry.updatedAt <= POOL_TTL_MS) {
                      this._entries[k] = {
                        key: k,
                        templateHash: entry.templateHash || '',
                        level: Number(entry.level) || 4,
                        brandId: entry.brandId || '',
                        unused: entry.unused.filter((s) => typeof s === 'string' && s.trim()),
                        used: Array.isArray(entry.used) ? entry.used.slice(-40) : [],
                        updatedAt: entry.updatedAt || now,
                        lastSource: entry.lastSource || null,
                        lastError: entry.lastError || null,
                        status: entry.unused.length > 0 ? 'ready' : (entry.status || 'idle')
                      };
                    }
                  }
                }
              }
            } catch (_) {}
            this._hydrated = true;
            this._hydratePromise = null;
            resolve(this._entries);
          });
          return;
        }
      } catch (_) {}
      this._hydrated = true;
      this._hydratePromise = null;
      resolve(this._entries);
    });
    return this._hydratePromise;
  },

  _pruneEntries() {
    const keys = Object.keys(this._entries);
    if (keys.length <= POOL_MAX_ENTRIES) return;
    const sorted = keys.sort((a, b) => (this._entries[b]?.updatedAt || 0) - (this._entries[a]?.updatedAt || 0));
    for (const dropKey of sorted.slice(POOL_MAX_ENTRIES)) {
      delete this._entries[dropKey];
    }
  },

  schedulePersist() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      try {
        this._pruneEntries();
        chrome.storage.local.set({ [SP_VARIATION_POOL_KEY]: this._entries });
      } catch (_) {}
    }, 250);
  },

  _broadcastStatus(extra = {}) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'autoVariationPoolUpdated',
          ...extra,
          timestamp: Date.now()
        }).catch(() => {});
      }
    } catch (_) {}
  },

  async _resolveSettingsAndBrand(overrideBrand = null) {
    const localData = await new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get([
            'randomnessLevel', 'randomnessSynonyms', 'randomnessDicts', 'tb_auto_variation',
            'apiKey', 'geminiApiKey', 'aiModel', 'authUserSession', 'cf_auth_session',
            'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'twitterComments'
          ], (r) => resolve(r || {}));
          return;
        }
      } catch (_) {}
      resolve({});
    });

    const engine = this._getEngine();
    const level = engine
      ? engine.normalizeLevel(localData.randomnessLevel ?? 3, 3)
      : (Number(localData.randomnessLevel) || 3);

    let activeBrand = overrideBrand;
    if (!activeBrand) {
      const profiles = Array.isArray(localData.campaignProfiles) && localData.campaignProfiles.length > 0
        ? localData.campaignProfiles
        : (Array.isArray(localData.brandProfiles) ? localData.brandProfiles : []);
      const activeId = localData.activeCampaignId || localData.activeBrandId || 'brand-default';
      activeBrand = profiles.find((p) => p && (p.brandId === activeId || p.campaignId === activeId)) || profiles[0] || null;
    }

    const activeSession = localData.authUserSession || localData.cf_auth_session || null;
    const authToken = activeSession?.accessToken || activeSession?.token || '';
    const effectiveKey = String(localData.apiKey || apiKey || '').trim();
    const effectiveGeminiKey = String(localData.geminiApiKey || geminiApiKey || '').trim();
    const effectiveModel = String(localData.aiModel || openRouterModel || 'deepseek/deepseek-chat').trim();

    return {
      level,
      autoVariation: Boolean(localData.tb_auto_variation),
      synonymsEnabled: localData.randomnessSynonyms !== false,
      dictsText: String(localData.randomnessDicts || ''),
      brand: activeBrand,
      twitterComments: Array.isArray(localData.twitterComments) ? localData.twitterComments : [],
      authToken,
      effectiveKey,
      effectiveGeminiKey,
      effectiveModel
    };
  },

  async _fetchBatchFromBackendOrOpenRouter({ templateText, level, brand, count, existingTexts, authToken, effectiveKey, effectiveGeminiKey, effectiveModel }) {
    const engine = this._getEngine();
    const brandName = String(brand?.name || brand?.brandName || '').trim();
    const protectedTokens = engine ? engine.extractProtectedTokens(templateText, brandName) : [];

    // 1. Try Portal Backend (/api/ai/action with action: 'auto_vary_batch')
    try {
      const cfg = typeof ensurePortalAndSupabaseConfig === 'function'
        ? await ensurePortalAndSupabaseConfig(false).catch(() => ({ appBaseUrl }))
        : { appBaseUrl };
      const base = String(cfg?.appBaseUrl || appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);
      try {
        const res = await fetch(`${base}/api/ai/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({
            action: 'auto_vary_batch',
            text: templateText,
            creativityLevel: level,
            variationCount: count,
            brand: brand || {},
            protectedTokens,
            existingTexts: (existingTexts || []).slice(0, 10),
            ...(effectiveKey ? { openRouterKey: effectiveKey } : {}),
            ...(effectiveGeminiKey ? { geminiApiKey: effectiveGeminiKey } : {}),
            aiModel: effectiveModel
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.variations) && data.variations.length > 0) {
            return {
              variations: data.variations,
              source: data.source || 'backend'
            };
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
      }
    } catch (_) {}

    // 2. Fallback: Direct OpenRouter or Gemini BYOK call if personal key is configured
    if (effectiveKey || effectiveGeminiKey) {
      const lvlGuidance = level >= 5
        ? 'CREATIVITY LEVEL 5 — UNIQUE: Boldly vary the opening hook style (tip, personal observation, pain-point, question, contrast, peer rec), clause order, and rhythm across all items. Never start two variations with the same 3 words.'
        : 'CREATIVITY LEVEL 4 — DISTINCT: Rewrite sentence structure, transitions, and vocabulary naturally while keeping the exact same persona, pitch, CTA, and length parity.';
      const protLine = protectedTokens.length > 0
        ? `PROTECTED TOKENS (MUST appear verbatim in EVERY item): ${protectedTokens.join(', ')}`
        : '';
      const brandLine = brandName
        ? `Brand Context: ${brandName}${brand?.tagline ? ` — ${brand.tagline}` : ''}${brand?.website ? ` (${brand.website})` : ''}`
        : '';
      const sysPrompt = [
        'You generate standalone human comment template variations for Smart Poster.',
        'Lock 100% of the core pitch, CTA, brand facts, and protected tokens. No markdown bold, no quotes, no AI filler.',
        `Return ONLY valid JSON: {"variations": ["...", "..."]} with EXACTLY ${count} distinct variations.`
      ].join('\n');
      const userPrompt = [
        lvlGuidance,
        brandLine,
        protLine,
        `Template:\n${templateText}`,
        existingTexts?.length ? `Avoid repeating:\n${existingTexts.slice(0, 6).join('\n')}` : '',
        `Return JSON {"variations": [...]} with ${count} items:`
      ].filter(Boolean).join('\n\n');

      let rawOut = '';
      let sourceUsed = '';
      if (effectiveKey) {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveKey}`,
            'HTTP-Referer': 'https://smartposter.pro',
            'X-Title': 'Smart Poster Auto Variation'
          },
          body: JSON.stringify({
            model: effectiveModel || 'deepseek/deepseek-chat',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: level >= 5 ? 0.92 : 0.78,
            max_tokens: 2400
          })
        });
        if (orRes.ok) {
          const orData = await orRes.json();
          rawOut = String(orData?.choices?.[0]?.message?.content || '').trim();
          sourceUsed = `openrouter (${effectiveModel})`;
        }
      }
      if (!rawOut && effectiveGeminiKey) {
        const gemOut = await callGeminiDirectBg({
          geminiKey: effectiveGeminiKey,
          systemInstruction: sysPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: level >= 5 ? 0.92 : 0.78,
          maxOutputTokens: 2400
        }).catch(() => null);
        if (gemOut?.ok && gemOut.text) {
          rawOut = gemOut.text;
          sourceUsed = 'gemini-byok (gemini-2.5-flash)';
        }
      }

      if (rawOut) {
        let items = [];
        try {
          const cleanJson = rawOut.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          const parsed = JSON.parse(cleanJson);
          items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.variations) ? parsed.variations : []);
        } catch (_) {
          const m = rawOut.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              items = Array.isArray(parsed?.variations) ? parsed.variations : [];
            } catch (_) {}
          }
        }
        if (items.length > 0) {
          return { variations: items, source: sourceUsed || 'byok' };
        }
      }
    }

    return { variations: [], source: 'unavailable', error: 'No AI response available' };
  },

  async warmTemplate(templateText, level, brand = null, options = {}) {
    await this.hydrate();
    const engine = this._getEngine();
    const cleanText = String(templateText || '').trim();
    const normalizedLvl = engine ? engine.normalizeLevel(level, 4) : (Number(level) >= 5 ? 5 : 4);
    if (!cleanText || normalizedLvl < 4) {
      return { ok: true, skipped: true, level: normalizedLvl };
    }

    const key = this.makeKey(cleanText, normalizedLvl, brand);
    if (this._inflight.has(key)) {
      return this._inflight.get(key);
    }

    const lastFail = this._failTimestamps.get(key) || 0;
    if (!options.force && Date.now() - lastFail < POOL_FAILURE_COOLDOWN_MS) {
      return { ok: false, cooldown: true, key };
    }

    const existingEntry = this._entries[key] || {
      key,
      templateHash: engine ? engine.fnv1aHash(cleanText) : '',
      level: normalizedLvl,
      brandId: String(brand?.brandId || brand?.campaignId || brand?.name || ''),
      unused: [],
      used: [],
      updatedAt: Date.now(),
      lastSource: null,
      lastError: null,
      status: 'warming'
    };

    if (!options.force && existingEntry.unused.length > POOL_LOW_WATERMARK) {
      return { ok: true, alreadyWarm: true, key, unusedCount: existingEntry.unused.length };
    }

    existingEntry.status = 'warming';
    this._entries[key] = existingEntry;
    this._broadcastStatus({ key, status: 'warming', level: normalizedLvl });

    const job = (async () => {
      try {
        const creds = await this._resolveSettingsAndBrand(brand);
        const activeBrand = brand || creds.brand;
        const brandName = String(activeBrand?.name || activeBrand?.brandName || '').trim();
        const existingPool = [...existingEntry.used.slice(-8), ...existingEntry.unused];
        const result = await this._fetchBatchFromBackendOrOpenRouter({
          templateText: cleanText,
          level: normalizedLvl,
          brand: activeBrand,
          count: Number(options.count) || POOL_TARGET_BATCH,
          existingTexts: existingPool,
          authToken: creds.authToken,
          effectiveKey: creds.effectiveKey,
          effectiveModel: creds.effectiveModel
        });

        const accepted = [];
        for (const cand of result.variations || []) {
          if (engine && typeof engine.validateAiCandidate === 'function') {
            const check = engine.validateAiCandidate(cleanText, cand, {
              level: normalizedLvl,
              brandName,
              existingPool: [...existingPool, ...accepted]
            });
            if (check.ok && check.text) {
              accepted.push(check.text);
            }
          } else if (typeof cand === 'string' && cand.trim() && cand.trim() !== cleanText) {
            accepted.push(cand.trim());
          }
        }

        if (accepted.length > 0) {
          existingEntry.unused.push(...accepted);
          existingEntry.status = 'ready';
          existingEntry.lastError = null;
          existingEntry.lastSource = result.source || 'ai';
          this._failTimestamps.delete(key);
        } else {
          existingEntry.status = existingEntry.unused.length > 0 ? 'ready' : 'fallback';
          existingEntry.lastError = result.error || 'No valid AI variations passed gate';
          this._failTimestamps.set(key, Date.now());
        }
        existingEntry.updatedAt = Date.now();
        this._entries[key] = existingEntry;
        this.schedulePersist();
        this._broadcastStatus({
          key,
          status: existingEntry.status,
          level: normalizedLvl,
          unusedCount: existingEntry.unused.length
        });
        return {
          ok: accepted.length > 0,
          key,
          added: accepted.length,
          unusedCount: existingEntry.unused.length,
          source: existingEntry.lastSource
        };
      } catch (err) {
        existingEntry.status = existingEntry.unused.length > 0 ? 'ready' : 'error';
        existingEntry.lastError = err?.message || 'Pool warm failed';
        existingEntry.updatedAt = Date.now();
        this._failTimestamps.set(key, Date.now());
        this.schedulePersist();
        this._broadcastStatus({ key, status: existingEntry.status, level: normalizedLvl });
        return { ok: false, key, error: existingEntry.lastError };
      } finally {
        this._inflight.delete(key);
      }
    })();

    this._inflight.set(key, job);
    return job;
  },

  async consumeOrFallback(templateText, options = {}) {
    await this.hydrate();
    const engine = this._getEngine();
    const raw = String(templateText || '');
    const clean = raw.trim();
    const cfg = await this._resolveSettingsAndBrand(options.brand || null);
    const level = engine
      ? engine.normalizeLevel(options.level ?? cfg.level, 3)
      : (Number(options.level ?? cfg.level) || 3);
    const activeBrand = options.brand || cfg.brand;
    const brandName = String(options.brandName || activeBrand?.name || activeBrand?.brandName || '').trim();

    if (!clean) {
      return { text: raw, usedPool: false, fallbackUsed: false, level, poolRemaining: 0, status: 'empty' };
    }

    if (level <= 3 || !engine) {
      const text = engine
        ? engine.processSync(raw, {
          level,
          synonymsEnabled: options.synonymsEnabled ?? cfg.synonymsEnabled,
          dictsText: options.dictsText ?? cfg.dictsText,
          customDicts: options.customDicts,
          brandName,
          autoVariation: true
        })
        : raw;
      return { text, usedPool: false, fallbackUsed: false, level, poolRemaining: 0, status: 'preset' };
    }

    const key = this.makeKey(clean, level, activeBrand);
    const entry = this._entries[key];

    if (entry && Array.isArray(entry.unused) && entry.unused.length > 0) {
      let picked = entry.unused.shift();
      if (/\{[^{}]+\}/.test(picked)) {
        picked = engine.parseSpinTax(picked);
      }
      entry.used = Array.isArray(entry.used) ? entry.used : [];
      entry.used.push(picked);
      if (entry.used.length > 40) entry.used = entry.used.slice(-40);
      entry.updatedAt = Date.now();

      const remaining = entry.unused.length;
      const needsRefill = remaining <= POOL_LOW_WATERMARK;
      entry.status = needsRefill ? 'refilling' : 'ready';
      this.schedulePersist();

      if (needsRefill && !options.skipWarm) {
        // Silent background refill — never blocks click response
        this.warmTemplate(clean, level, activeBrand).catch(() => {});
      }

      this._broadcastStatus({ key, status: entry.status, level, unusedCount: remaining });
      return {
        text: picked,
        usedPool: true,
        fallbackUsed: false,
        level,
        poolRemaining: remaining,
        status: entry.status,
        source: entry.lastSource || 'ai-pool'
      };
    }

    // Cold pool / offline graceful fallback: instant Level 3 preset, warm in background for next post
    const fallbackText = engine.processSync(raw, {
      level: 3,
      synonymsEnabled: options.synonymsEnabled ?? cfg.synonymsEnabled,
      dictsText: options.dictsText ?? cfg.dictsText,
      customDicts: options.customDicts,
      brandName,
      autoVariation: true
    });

    if (!options.skipWarm) {
      this.warmTemplate(clean, level, activeBrand).catch(() => {});
    }

    return {
      text: fallbackText,
      usedPool: false,
      fallbackUsed: true,
      level,
      poolRemaining: 0,
      status: 'warming'
    };
  },

  async prewarmForBrand(options = {}) {
    await this.hydrate();
    const cfg = await this._resolveSettingsAndBrand(options.brand || null);
    const engine = this._getEngine();
    const level = engine ? engine.normalizeLevel(options.level ?? cfg.level, 3) : (Number(options.level ?? cfg.level) || 3);
    const isAuto = options.force ? true : cfg.autoVariation;

    if (!isAuto || level < 4) {
      return { ok: true, skipped: true, level, reason: !isAuto ? 'auto_variation_disabled' : 'preset_level' };
    }

    const activeBrand = options.brand || cfg.brand;
    const rawComments = Array.isArray(options.comments)
      ? options.comments
      : (Array.isArray(activeBrand?.social?.comments) && activeBrand.social.comments.length > 0
        ? activeBrand.social.comments
        : (Array.isArray(activeBrand?.comments) && activeBrand.comments.length > 0
          ? activeBrand.comments
          : cfg.twitterComments));

    const templates = (rawComments || [])
      .filter((c) => c && (typeof c === 'string' || c.enabled !== false))
      .map((c) => (typeof c === 'string' ? c.trim() : String(c.text || '').trim()))
      .filter(Boolean)
      .slice(0, 5);

    if (templates.length === 0) {
      return { ok: true, skipped: true, level, reason: 'no_templates' };
    }

    let warmed = 0;
    for (const tpl of templates) {
      const key = this.makeKey(tpl, level, activeBrand);
      const entry = this._entries[key];
      if (!entry || (entry.unused?.length || 0) <= POOL_LOW_WATERMARK) {
        const res = await this.warmTemplate(tpl, level, activeBrand, { force: Boolean(options.force) });
        if (res && (res.added > 0 || res.alreadyWarm)) warmed++;
      } else {
        warmed++;
      }
    }

    return { ok: true, level, templatesChecked: templates.length, warmed };
  },

  schedulePrewarmFromStorage() {
    if (this._prewarmTimer) clearTimeout(this._prewarmTimer);
    this._prewarmTimer = setTimeout(() => {
      this.prewarmForBrand().catch(() => {});
    }, 700);
  },

  async getStatusSummary(options = {}) {
    await this.hydrate();
    const cfg = await this._resolveSettingsAndBrand(options.brand || null);
    const engine = this._getEngine();
    const level = engine ? engine.normalizeLevel(options.level ?? cfg.level, 3) : (Number(options.level ?? cfg.level) || 3);
    if (level < 4) {
      return { level, isAi: false, status: 'preset', readyCount: 0, totalUnused: 0, warmingCount: 0 };
    }

    const activeBrand = options.brand || cfg.brand;
    const targetText = String(options.text || '').trim();
    if (targetText) {
      const key = this.makeKey(targetText, level, activeBrand);
      const entry = this._entries[key];
      const unused = entry?.unused?.length || 0;
      const isWarming = this._inflight.has(key) || entry?.status === 'warming';
      return {
        level,
        isAi: true,
        key,
        unusedCount: unused,
        totalUnused: unused,
        warmingCount: isWarming ? 1 : 0,
        status: isWarming ? (unused > 0 ? 'refilling' : 'warming') : (unused > 0 ? 'ready' : (entry?.status || 'idle')),
        lastError: entry?.lastError || null
      };
    }

    let readyCount = 0;
    let totalUnused = 0;
    let warmingCount = 0;
    for (const [k, entry] of Object.entries(this._entries)) {
      if (Number(entry.level) !== level) continue;
      if (this._inflight.has(k) || entry.status === 'warming') warmingCount++;
      const count = entry.unused?.length || 0;
      if (count > 0) {
        readyCount++;
        totalUnused += count;
      }
    }
    const status = warmingCount > 0 && readyCount === 0
      ? 'warming'
      : (warmingCount > 0 ? 'refilling' : (totalUnused > 0 ? 'ready' : 'idle'));
    return { level, isAi: true, status, readyCount, totalUnused, warmingCount };
  },

  async invalidate(options = {}) {
    await this.hydrate();
    const cleanText = String(options.text || '').trim();
    if (!cleanText) {
      this._entries = {};
      this._failTimestamps.clear();
    } else {
      const levels = options.level ? [Number(options.level)] : [4, 5];
      for (const lvl of levels) {
        const key = this.makeKey(cleanText, lvl, options.brand || null);
        delete this._entries[key];
        this._failTimestamps.delete(key);
      }
    }
    this.schedulePersist();
    this._broadcastStatus({ invalidated: true });
    return { ok: true };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.SmartPosterVariationPool = VariationPoolManager;
}


function isValidEntitlementClaimStructure(claim, expectedUserId, expectedEmail = '') {
  if (!claim || typeof claim !== 'object') return false;
  if (!claim.signature || !/^[a-f0-9]{64}$/i.test(String(claim.signature))) return false;
  if (!claim.expiresAt || Number(claim.expiresAt) <= Date.now()) return false;
  if (claim.issuedAt && Number(claim.issuedAt) > Date.now() + 60000) return false;
  if (expectedUserId && claim.userId && claim.userId !== expectedUserId) {
    const claimEmail = String(claim.email || '').trim().toLowerCase();
    const userEmail = String(expectedEmail || '').trim().toLowerCase();
    const isAdminClaimMatch =
      String(claim.role || '').toLowerCase() === 'admin' &&
      String(claim.userId).startsWith('admin-') &&
      (!userEmail || !claimEmail || claimEmail === userEmail);
    if (!isAdminClaimMatch) return false;
  }
  return true;
}

function normalizeTierClaimValue(rawTier, rawRole = 'user', email = '') {
  const emailLower = String(email || '').trim().toLowerCase();
  const role = (String(rawRole || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(emailLower)) ? 'admin' : 'user';
  if (role === 'admin') return 'unlimited';
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
  if (t === 'pro' || t === 'pro_lifetime' || t === 'pro-lifetime' || t === 'lifetime' || t === 'premium' || t.startsWith('pro')) {
    return 'pro';
  }
  return 'basic';
}

function normalizeAuthSession(rawSession) {
  if (!rawSession || typeof rawSession !== 'object' || !rawSession.user) return null;
  const user = rawSession.user || {};
  const accessToken = rawSession.accessToken || rawSession.token || '';
  if (!accessToken) return null;
  const emailLower = String(user.email || '').trim().toLowerCase();
  const role = (String(user.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(emailLower)) ? 'admin' : 'user';
  const tier = normalizeTierClaimValue(user.tier || user.plan, role, emailLower);
  const entitlement = isValidEntitlementClaimStructure(rawSession.entitlement, user.id, emailLower) ? rawSession.entitlement : null;
  return {
    user: {
      id: user.id || '',
      email: user.email || '',
      fullName: user.fullName || user.full_name || user.name || '',
      avatarUrl: user.avatarUrl || user.avatar_url || user.picture || '',
      role,
      tier
    },
    accessToken,
    refreshToken: rawSession.refreshToken || null,
    token: accessToken,
    entitlement,
    portalOrigin: rawSession.portalOrigin || appBaseUrl || 'http://localhost:3000',
    updatedAt: rawSession.updatedAt || new Date().toISOString()
  };
}

function broadcastAuthSessionUpdated(session, entitlement = null) {
  try {
    chrome.runtime.sendMessage({
      type: 'authSessionUpdated',
      session: session || null,
      entitlement: entitlement || session?.entitlement || null
    }).catch(() => {});
  } catch (_) {}
}

async function fetchJsonWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getCandidatePortalOrigins(preferredOrigins = []) {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['app_base_url'], (res) => resolve(res || {}));
  });
  const candidates = [];
  const pushCandidate = (origin) => {
    if (!origin || typeof origin !== 'string') return;
    const clean = origin.trim().replace(/\/+$/, '');
    if ((clean.startsWith('http://') || clean.startsWith('https://')) && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  (preferredOrigins || []).forEach(pushCandidate);

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const openTabs = await chrome.tabs.query({});
      (openTabs || []).forEach((t) => {
        if (!t.url) return;
        if (/^https?:\/\/(localhost:3000|127\.0\.0\.1:3000|(?:www\.)?smartposter\.pro|(?:www\.)?poster\.finola\.work|[^/]+\.run\.app|contactformsite\.pages\.dev)/i.test(t.url)) {
          try {
            pushCandidate(new URL(t.url).origin);
          } catch (_) {}
        }
      });
    }
  } catch (_) {}

  if (appBaseUrl) pushCandidate(appBaseUrl);
  if (stored.app_base_url) pushCandidate(stored.app_base_url);
  pushCandidate('https://smartposter.pro');
  pushCandidate('http://localhost:3000');
  pushCandidate('http://127.0.0.1:3000');
  return candidates;
}

async function ensurePortalAndSupabaseConfig(forceRefresh = false, preferredOrigin = '') {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['supabase_url', 'supabase_anon_key', 'supabase_user_id', 'app_base_url'], (res) => resolve(res || {}));
  });

  if (stored.supabase_url && !supabaseConfig.url) supabaseConfig.url = stored.supabase_url;
  if (stored.supabase_anon_key && !supabaseConfig.anonKey) supabaseConfig.anonKey = stored.supabase_anon_key;
  if (stored.supabase_user_id) supabaseConfig.userId = stored.supabase_user_id;
  if (stored.app_base_url) appBaseUrl = stored.app_base_url;

  if (forceRefresh || !supabaseConfig.url || !supabaseConfig.anonKey || !stored.app_base_url) {
    const candidates = await getCandidatePortalOrigins(preferredOrigin ? [preferredOrigin] : []);

    let firstReachableOrigin = '';
    for (const origin of candidates) {
      const configData = await fetchJsonWithTimeout(`${origin}/api/config`, 1800);
      if (configData && configData.success) {
        if (!firstReachableOrigin) firstReachableOrigin = origin;
        if (configData.supabase?.url && configData.supabase?.anonKey) {
          supabaseConfig.url = configData.supabase.url.replace(/\/+$/, '');
          supabaseConfig.anonKey = configData.supabase.anonKey;
          appBaseUrl = origin;
          chrome.storage.local.set({
            supabase_url: supabaseConfig.url,
            supabase_anon_key: supabaseConfig.anonKey,
            app_base_url: appBaseUrl
          });
          break;
        }
      }
    }

    if (firstReachableOrigin && (!appBaseUrl || appBaseUrl === 'http://localhost:3000')) {
      appBaseUrl = firstReachableOrigin;
      chrome.storage.local.set({ app_base_url: appBaseUrl });
    }
  }

  if (typeof SupabaseClient !== 'undefined' && supabaseConfig.url && supabaseConfig.anonKey && (!supabaseClient || !supabaseClient.isConfigured())) {
    supabaseClient = new SupabaseClient(supabaseConfig);
    attachSupabaseTokenRefreshHandler(supabaseClient);
  }

  return {
    supabaseUrl: supabaseConfig.url || '',
    anonKey: supabaseConfig.anonKey || '',
    appBaseUrl: (appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '')
  };
}

async function refreshSupabaseJwtToken(session, supabaseUrl, anonKey) {
  const inputRefreshToken = session?.refreshToken || '';
  if (!inputRefreshToken || !supabaseUrl || !anonKey) {
    return { ok: false, rejected: false, error: 'missing_refresh_params' };
  }

  // Coalesce concurrent refresh calls to prevent double-spending Supabase single-use refresh tokens
  if (activeTokenRefreshPromise) {
    return activeTokenRefreshPromise;
  }

  // If this exact refreshToken was already rotated within the last 10 seconds, reuse the rotated result
  if (
    lastRefreshedTokenCache.oldRefreshToken === inputRefreshToken &&
    lastRefreshedTokenCache.result?.ok &&
    (Date.now() - lastRefreshedTokenCache.at) < 10000
  ) {
    return lastRefreshedTokenCache.result;
  }

  activeTokenRefreshPromise = (async () => {
    try {
      // Double-check storage in case another worker call already rotated and saved a newer refreshToken
      const storedCheck = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (d) => r(d || {})));
      const storedSes = storedCheck.authUserSession || storedCheck.cf_auth_session || null;
      if (
        storedSes?.refreshToken &&
        storedSes.refreshToken !== inputRefreshToken &&
        storedSes.accessToken &&
        !isJwtExpiredBg(storedSes.accessToken, 30)
      ) {
        return {
          ok: true,
          accessToken: storedSes.accessToken,
          refreshToken: storedSes.refreshToken,
          user: storedSes.user || session.user
        };
      }

      const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: inputRefreshToken })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const isAuthRejected = res.status === 400 || res.status === 401 || res.status === 403;
        return {
          ok: false,
          rejected: isAuthRejected,
          status: res.status,
          error: errBody?.error_description || errBody?.msg || errBody?.error || `HTTP ${res.status}`
        };
      }

      const data = await res.json().catch(() => null);
      if (!data?.access_token) {
        return { ok: false, rejected: false, error: 'empty_refresh_payload' };
      }

      const result = {
        ok: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || inputRefreshToken,
        user: data.user || session.user
      };
      lastRefreshedTokenCache = { oldRefreshToken: inputRefreshToken, result, at: Date.now() };
      return result;
    } catch (err) {
      return { ok: false, rejected: false, error: err?.message || 'network_error' };
    } finally {
      activeTokenRefreshPromise = null;
    }
  })();

  return activeTokenRefreshPromise;
}

async function refreshStoredUserProfile(existingSession = null) {
  if (!existingSession && activeProfileRefreshPromise) {
    return activeProfileRefreshPromise;
  }

  const runRefresh = async () => {
    const storageRes = await new Promise((resolve) => {
      chrome.storage.local.get(['authUserSession', 'cf_auth_session', 'sp_entitlement_claim'], (res) => resolve(res || {}));
    });
    let session = normalizeAuthSession(existingSession || storageRes.authUserSession || storageRes.cf_auth_session);
    if (!session || !session.accessToken) return null;

    let cfg = await ensurePortalAndSupabaseConfig(false, session.portalOrigin || '');
    let tokenRefreshed = false;

    // Proactively handle expired JWT before hitting protected endpoints
    if (isJwtExpiredBg(session.accessToken, 30)) {
      if (!session.refreshToken) {
        await invalidateAuthSession('expired_no_refresh', session.accessToken);
        return null;
      }
      if (!cfg.supabaseUrl || !cfg.anonKey) {
        cfg = await ensurePortalAndSupabaseConfig(true, session.portalOrigin || '');
      }
      if (cfg.supabaseUrl && cfg.anonKey) {
        const preRefresh = await refreshSupabaseJwtToken(session, cfg.supabaseUrl, cfg.anonKey);
        if (preRefresh?.ok && preRefresh.accessToken) {
          tokenRefreshed = true;
          session = {
            ...session,
            accessToken: preRefresh.accessToken,
            token: preRefresh.accessToken,
            refreshToken: preRefresh.refreshToken || session.refreshToken,
            updatedAt: new Date().toISOString()
          };
          await new Promise((r) => chrome.storage.local.set({ authUserSession: session, cf_auth_session: session }, r));
        } else if (preRefresh?.rejected) {
          await invalidateAuthSession('refresh_rejected', session.accessToken);
          return null;
        }
      }
    }

    const originCandidates = await getCandidatePortalOrigins([session.portalOrigin, cfg.appBaseUrl]);

    let latestEmail = String(session.user.email || '').trim().toLowerCase();
    let authoritativeClaim = isValidEntitlementClaimStructure(storageRes.sp_entitlement_claim, session.user.id, latestEmail)
      ? storageRes.sp_entitlement_claim
      : (isValidEntitlementClaimStructure(session.entitlement, session.user.id, latestEmail) ? session.entitlement : null);

    let latestRole = authoritativeClaim
      ? ((String(authoritativeClaim.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(latestEmail)) ? 'admin' : 'user')
      : ((String(session.user.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(latestEmail)) ? 'admin' : 'user');
    let latestTier = authoritativeClaim
      ? normalizeTierClaimValue(authoritativeClaim.tier, latestRole, latestEmail)
      : normalizeTierClaimValue(session.user.tier, latestRole, latestEmail);
    let fetchedFromServer = false;

    const tryFetchEntitlement = async (origin, token) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        return await fetch(`${origin}/api/auth/entitlement`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    };

    for (const origin of originCandidates) {
      try {
        let entRes = await tryFetchEntitlement(origin, session.accessToken);
        if (entRes.status === 401 && session.refreshToken && !tokenRefreshed) {
          if (!cfg.supabaseUrl || !cfg.anonKey) {
            cfg = await ensurePortalAndSupabaseConfig(true, origin);
          }
          const refreshed = await refreshSupabaseJwtToken(session, cfg.supabaseUrl, cfg.anonKey);
          if (refreshed?.ok && refreshed.accessToken) {
            tokenRefreshed = true;
            session = {
              ...session,
              accessToken: refreshed.accessToken,
              token: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              portalOrigin: origin,
              updatedAt: new Date().toISOString()
            };
            entRes = await tryFetchEntitlement(origin, session.accessToken);
          } else if (refreshed?.rejected) {
            await invalidateAuthSession('refresh_rejected', session.accessToken);
            return null;
          }
        }

        const entCt = (entRes.headers.get('content-type') || '').toLowerCase();
        if (!entCt.includes('application/json')) {
          // SPA HTML fallback (e.g. undeployed Pages host) — try next candidate origin
          continue;
        }

        if (entRes.status === 401) {
          const errPayload = await entRes.json().catch(() => ({}));
          const errMsg = String(errPayload?.error || '').toLowerCase();
          if (errMsg.includes('not configured') || errMsg.includes('unavailable')) {
            continue;
          }
          // Authoritative auth rejection (401): clear invalid session cleanly so UI returns to Gmail login
          await invalidateAuthSession('entitlement_401', session.accessToken);
          return null;
        }

        if (entRes.ok) {
          const entData = await entRes.json().catch(() => null);
          if (entData && entData.success && isValidEntitlementClaimStructure(entData.entitlement, session.user.id, latestEmail)) {
            authoritativeClaim = entData.entitlement;
            latestEmail = String(authoritativeClaim.email || latestEmail).trim().toLowerCase();
            latestRole = (String(authoritativeClaim.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(latestEmail)) ? 'admin' : 'user';
            latestTier = normalizeTierClaimValue(authoritativeClaim.tier, latestRole, latestEmail);
            fetchedFromServer = true;
            if (origin !== appBaseUrl) {
              appBaseUrl = origin;
              chrome.storage.local.set({ app_base_url: origin });
            }
            session.portalOrigin = origin;
            break;
          }
        }
      } catch (_) {
        // Try next candidate origin
      }
    }

    // If token is expired and we couldn't validate/refresh it with any server, don't keep a dead session active
    if (!fetchedFromServer && isJwtExpiredBg(session.accessToken, 0) && !session.refreshToken) {
      await invalidateAuthSession('expired_offline_no_refresh', session.accessToken);
      return null;
    }

    let fullName = session.user.fullName || '';
    let avatarUrl = session.user.avatarUrl || '';
    if (supabaseClient && supabaseClient.isConfigured()) {
      supabaseClient.setSession(session);
      const profileRes = await supabaseClient.fetchUserProfile().catch(() => null);
      // If fetchUserProfile triggered onAuthInvalid, stop immediately
      if (!supabaseClient.isLoggedIn()) {
        return null;
      }
      if (profileRes && profileRes.success && profileRes.profile) {
        const p = profileRes.profile;
        fullName = fullName || p.full_name || '';
        avatarUrl = avatarUrl || p.avatar_url || '';
        latestEmail = latestEmail || String(p.email || '').trim().toLowerCase();
        if (!fetchedFromServer) {
          latestRole = (String(p.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(latestEmail)) ? 'admin' : latestRole;
          latestTier = normalizeTierClaimValue(p.tier || profileRes.tier, latestRole, latestEmail);
        }
      }
    }

    const updatedSession = normalizeAuthSession({
      ...session,
      entitlement: authoritativeClaim,
      user: {
        ...session.user,
        email: latestEmail || session.user.email || '',
        fullName,
        avatarUrl,
        role: latestRole,
        tier: latestTier
      },
      updatedAt: new Date().toISOString()
    });

    if (updatedSession) {
      const updates = {
        authUserSession: updatedSession,
        cf_auth_session: updatedSession
      };
      if (authoritativeClaim) {
        updates.sp_entitlement_claim = authoritativeClaim;
      }
      await new Promise((resolve) => chrome.storage.local.set(updates, resolve));
      if (supabaseClient) supabaseClient.setSession(updatedSession);
      if (fetchedFromServer || authoritativeClaim || tokenRefreshed) {
        broadcastAuthSessionUpdated(updatedSession, authoritativeClaim);
      }
      bootstrapWorkspaceModules(updatedSession, false).catch(() => {});
      return updatedSession;
    }
    return session;
  };

  if (!existingSession) {
    activeProfileRefreshPromise = runRefresh().finally(() => {
      activeProfileRefreshPromise = null;
    });
    return activeProfileRefreshPromise;
  }
  return runRefresh();
}

const WORKSPACE_BOOTSTRAP_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

function broadcastWorkspaceBootstrapped(bootstrapMeta, selectorRecipes) {
  try {
    chrome.runtime.sendMessage({
      type: 'WORKSPACE_BOOTSTRAPPED',
      bootstrap: bootstrapMeta,
      selectorRecipes: selectorRecipes || null
    }).catch(() => {});
  } catch (_) {}
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        (tabs || []).forEach((t) => {
          if (t.id) {
            chrome.tabs.sendMessage(t.id, {
              type: 'workspaceRecipesUpdated',
              selectorRecipes: selectorRecipes || null
            }).catch(() => {});
          }
        });
      });
    }
  } catch (_) {}
}

async function bootstrapWorkspaceModules(sessionOverride = null, force = false) {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(
      ['authUserSession', 'cf_auth_session', 'sp_entitlement_claim', 'sp_workspace_bootstrap', 'sp_selector_recipes', 'sp_prompt_recipes', 'directory_lists_catalog', 'randomnessDicts'],
      (res) => resolve(res || {})
    );
  });

  let session = normalizeAuthSession(sessionOverride || stored.authUserSession || stored.cf_auth_session);
  if (!session || !session.accessToken) {
    return { success: false, status: 401, loggedOut: true, error: 'Sign in required to sync workspace modules.' };
  }

  let cfg = await ensurePortalAndSupabaseConfig(false, session.portalOrigin || '');
  let tokenRefreshed = false;

  if (isJwtExpiredBg(session.accessToken, 30)) {
    if (!session.refreshToken) {
      await invalidateAuthSession('workspace_expired_no_refresh', session.accessToken);
      return { success: false, status: 401, loggedOut: true, error: 'Session expired. Please sign in again.' };
    }
    if (!cfg.supabaseUrl || !cfg.anonKey) {
      cfg = await ensurePortalAndSupabaseConfig(true, session.portalOrigin || '');
    }
    if (cfg.supabaseUrl && cfg.anonKey) {
      const preRefresh = await refreshSupabaseJwtToken(session, cfg.supabaseUrl, cfg.anonKey);
      if (preRefresh?.ok && preRefresh.accessToken) {
        tokenRefreshed = true;
        session = {
          ...session,
          accessToken: preRefresh.accessToken,
          token: preRefresh.accessToken,
          refreshToken: preRefresh.refreshToken || session.refreshToken,
          updatedAt: new Date().toISOString()
        };
        await new Promise((resolve) => chrome.storage.local.set({ authUserSession: session, cf_auth_session: session }, resolve));
      } else if (preRefresh?.rejected) {
        await invalidateAuthSession('workspace_refresh_rejected', session.accessToken);
        return { success: false, status: 401, loggedOut: true, error: 'Session expired. Please sign in again.' };
      }
    }
  }

  const existingMeta = stored.sp_workspace_bootstrap;
  if (
    !force &&
    existingMeta &&
    existingMeta.userId === session.user?.id &&
    existingMeta.syncedAt &&
    Date.now() - new Date(existingMeta.syncedAt).getTime() < WORKSPACE_BOOTSTRAP_STALE_MS &&
    stored.sp_selector_recipes &&
    stored.directory_lists_catalog
  ) {
    return {
      success: true,
      cached: true,
      bootstrap: existingMeta,
      directoryLists: stored.directory_lists_catalog,
      selectorRecipes: stored.sp_selector_recipes,
      promptRecipes: stored.sp_prompt_recipes || []
    };
  }

  const originCandidates = await getCandidatePortalOrigins([session.portalOrigin, cfg.appBaseUrl]);
  let lastError = '';

  const tryFetchBootstrap = async (origin, token) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      return await fetch(`${origin}/api/workspace/bootstrap`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  };

  for (const origin of originCandidates) {
    try {
      let res = await tryFetchBootstrap(origin, session.accessToken);
      if (res.status === 401 && session.refreshToken && !tokenRefreshed) {
        if (!cfg.supabaseUrl || !cfg.anonKey) {
          cfg = await ensurePortalAndSupabaseConfig(true, origin);
        }
        const refreshed = await refreshSupabaseJwtToken(session, cfg.supabaseUrl, cfg.anonKey);
        if (refreshed?.ok && refreshed.accessToken) {
          tokenRefreshed = true;
          session = {
            ...session,
            accessToken: refreshed.accessToken,
            token: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            portalOrigin: origin,
            updatedAt: new Date().toISOString()
          };
          await new Promise((resolve) => chrome.storage.local.set({ authUserSession: session, cf_auth_session: session }, resolve));
          res = await tryFetchBootstrap(origin, session.accessToken);
        } else if (refreshed?.rejected) {
          await invalidateAuthSession('workspace_refresh_rejected', session.accessToken);
          return { success: false, status: 401, loggedOut: true, error: 'Session expired. Please sign in again.' };
        }
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        // Server returned SPA HTML (e.g., an older Pages deployment without /api/workspace/bootstrap) -> try next origin
        continue;
      }

      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        const errMsg = String(data?.error || '').toLowerCase();
        if (errMsg.includes('not configured') || errMsg.includes('unavailable')) {
          lastError = data?.error || 'Authentication server unavailable';
          continue;
        }
        await invalidateAuthSession('workspace_401', session.accessToken);
        return { success: false, status: 401, loggedOut: true, error: 'Session expired. Please sign in again.' };
      }

      if (!res.ok) {
        lastError = data?.error || `Workspace sync failed (HTTP ${res.status})`;
        continue;
      }

      if (!data || !data.success) {
        lastError = data?.error || 'Workspace bootstrap returned empty data';
        continue;
      }

      if (origin !== appBaseUrl) {
        appBaseUrl = origin;
        chrome.storage.local.set({ app_base_url: origin });
      }

      const normalizedBootTier = data.tier === 'unlimited' || data.tier === 'agency'
        ? 'unlimited'
        : (data.tier === 'studio' ? 'studio' : (data.tier === 'pro' ? 'pro' : 'basic'));
      const meta = {
        version: data.version || '1.4.0',
        userId: data.userId || session.user?.id || '',
        tier: normalizedBootTier,
        role: data.role === 'admin' ? 'admin' : 'user',
        isPro: Boolean(data.isPro || normalizedBootTier === 'pro' || normalizedBootTier === 'studio' || normalizedBootTier === 'unlimited'),
        isUnlimited: Boolean(data.isUnlimited || normalizedBootTier === 'unlimited' || data.role === 'admin'),
        syncedAt: data.syncedAt || new Date().toISOString(),
        expiresAt: Number(data.expiresAt) || (Date.now() + 12 * 60 * 60 * 1000),
        directoryCount: Number(data.directoryCount || 0),
        totalAvailableDirectories: Number(data.totalAvailableDirectories || 0),
        platformCount: Object.keys(data.selectorRecipes?.platforms || {}).length,
        promptCount: Array.isArray(data.promptRecipes) ? data.promptRecipes.length : 0,
        isPreview: false
      };

      const updates = {
        sp_workspace_bootstrap: meta,
        sp_selector_recipes: data.selectorRecipes || null,
        sp_prompt_recipes: Array.isArray(data.promptRecipes) ? data.promptRecipes : [],
        directory_lists_catalog: data.directoryLists || {}
      };

      if (data.randomnessDicts && (!stored.randomnessDicts || !String(stored.randomnessDicts).trim())) {
        updates.randomnessDicts = data.randomnessDicts;
      }

      await new Promise((resolve) => chrome.storage.local.set(updates, resolve));
      broadcastWorkspaceBootstrapped(meta, data.selectorRecipes || null);

      return {
        success: true,
        cached: false,
        bootstrap: meta,
        directoryLists: updates.directory_lists_catalog,
        selectorRecipes: updates.sp_selector_recipes,
        promptRecipes: updates.sp_prompt_recipes,
        randomnessDicts: data.randomnessDicts || ''
      };
    } catch (err) {
      lastError = err?.message || 'Workspace bootstrap network error';
    }
  }

  // Fallback: if /api/workspace/bootstrap isn't deployed yet on any reachable origin,
  // sync directories from /api/directories or cached catalog + preserve verified admin/pro tier
  for (const origin of originCandidates) {
    try {
      const dirRes = await fetch(`${origin}/api/directories`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const dirCt = (dirRes.headers.get('content-type') || '').toLowerCase();
      if (dirRes.status === 401 && dirCt.includes('application/json')) {
        const errData = await dirRes.json().catch(() => ({}));
        const errMsg = String(errData?.error || '').toLowerCase();
        if (!errMsg.includes('not configured') && !errMsg.includes('unavailable')) {
          await invalidateAuthSession('directories_401', session.accessToken);
          return { success: false, status: 401, loggedOut: true, error: 'Session expired. Please sign in again.' };
        }
      }
      if (dirRes.ok && dirCt.includes('application/json')) {
        const dirData = await dirRes.json().catch(() => null);
        if (dirData && dirData.success && Array.isArray(dirData.directories)) {
          const grouped = {};
          dirData.directories.forEach((item) => {
            const cat = (item.category || 'launchpads').trim().toLowerCase();
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({
              id: item.id,
              name: item.name,
              dr: `DR ${Number(item.domain_rating || 0)}`,
              desc: item.description || '',
              url: item.url,
              pricing_type: item.pricing_type || 'free'
            });
          });
          const isAdminFallback = session.user?.role === 'admin';
          const isUnlimitedFallback = isAdminFallback || session.user?.tier === 'unlimited' || session.user?.tier === 'agency' || dirData.tier === 'unlimited' || dirData.tier === 'agency';
          const isStudioFallback = !isUnlimitedFallback && (session.user?.tier === 'studio' || dirData.tier === 'studio');
          const isProFallback = isUnlimitedFallback || isStudioFallback || session.user?.tier === 'pro' || dirData.tier === 'pro';
          const meta = {
            version: '1.4.0',
            userId: session.user?.id || '',
            tier: isUnlimitedFallback ? 'unlimited' : (isStudioFallback ? 'studio' : (isProFallback ? 'pro' : 'basic')),
            role: isAdminFallback ? 'admin' : 'user',
            isPro: isProFallback,
            isUnlimited: isUnlimitedFallback,
            syncedAt: new Date().toISOString(),
            expiresAt: Date.now() + 12 * 60 * 60 * 1000,
            directoryCount: dirData.directories.length,
            totalAvailableDirectories: Number(dirData.totalCount || dirData.directories.length),
            platformCount: Object.keys(stored.sp_selector_recipes?.platforms || {}).length,
            promptCount: Array.isArray(stored.sp_prompt_recipes) ? stored.sp_prompt_recipes.length : 0,
            isPreview: false
          };
          const updates = {
            sp_workspace_bootstrap: meta,
            directory_lists_catalog: grouped
          };
          await new Promise((resolve) => chrome.storage.local.set(updates, resolve));
          broadcastWorkspaceBootstrapped(meta, stored.sp_selector_recipes || null);
          return {
            success: true,
            cached: false,
            fallback: true,
            bootstrap: meta,
            directoryLists: grouped,
            selectorRecipes: stored.sp_selector_recipes || null,
            promptRecipes: stored.sp_prompt_recipes || []
          };
        }
      }
    } catch (_) {}
  }

  return { success: false, error: lastError || 'Workspace server unavailable. Please ensure the portal is running.' };
}

// Load Supabase credentials & Auth session on startup
chrome.storage.local.get(['supabase_url', 'supabase_anon_key', 'supabase_user_id', 'supabase_last_sync', 'cf_auth_session', 'authUserSession', 'sp_entitlement_claim', 'app_base_url'], async (res) => {
  if (res?.supabase_url) supabaseConfig.url = res.supabase_url;
  if (res?.supabase_anon_key) supabaseConfig.anonKey = res.supabase_anon_key;
  if (res?.app_base_url) appBaseUrl = res.app_base_url;

  await ensurePortalAndSupabaseConfig();

  const storedSession = normalizeAuthSession(res?.authUserSession || res?.cf_auth_session || null);
  let activeVerifiedSession = null;

  if (storedSession) {
    if (!storedSession.entitlement && isValidEntitlementClaimStructure(res?.sp_entitlement_claim, storedSession.user?.id)) {
      storedSession.entitlement = res.sp_entitlement_claim;
    }
    const initUpdates = {
      authUserSession: storedSession,
      cf_auth_session: storedSession
    };
    if (storedSession.entitlement) {
      initUpdates.sp_entitlement_claim = storedSession.entitlement;
    }
    await new Promise((r) => chrome.storage.local.set(initUpdates, r));

    if (typeof SupabaseClient !== 'undefined' && supabaseConfig.url && supabaseConfig.anonKey) {
      supabaseClient = new SupabaseClient(supabaseConfig);
      attachSupabaseTokenRefreshHandler(supabaseClient);
      supabaseClient.setSession(storedSession);
    }

    // Validate/refresh session sequentially BEFORE syncSupabaseData to avoid concurrent refresh_token race
    activeVerifiedSession = await refreshStoredUserProfile(storedSession).catch(() => null);
    if (activeVerifiedSession) {
      supabaseSyncStatus.status = 'synced';
      supabaseSyncStatus.message = `Signed in as ${activeVerifiedSession.user?.email || 'User'}`;
      syncSupabaseData('pull');
    } else {
      supabaseSyncStatus.status = 'offline';
      supabaseSyncStatus.message = 'Guest mode active';
    }
  } else {
    if (typeof SupabaseClient !== 'undefined' && supabaseConfig.url && supabaseConfig.anonKey) {
      supabaseClient = new SupabaseClient(supabaseConfig);
      attachSupabaseTokenRefreshHandler(supabaseClient);
    }
    supabaseSyncStatus.status = 'offline';
    supabaseSyncStatus.message = 'Guest mode active';
  }

  if (res?.supabase_last_sync) {
    supabaseSyncStatus.lastSyncTime = res.supabase_last_sync;
  }

  // Automatically restore saved user workspace after extension reinstall/reload
  await restoreVaultOnStartupOrInstall(false).catch(() => {});
});

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(async () => {
    await restoreVaultOnStartupOrInstall(false).catch(() => {});
    const check = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (d) => r(d || {})));
    if (check?.authUserSession || check?.cf_auth_session) {
      await refreshStoredUserProfile(null).catch(() => {});
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    await restoreVaultOnStartupOrInstall(false).catch(() => {});
    const check = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], (d) => r(d || {})));
    if (check?.authUserSession || check?.cf_auth_session) {
      await refreshStoredUserProfile(null).catch(() => {});
    }
  });
}

// 5-minute periodic Supabase sync alarm (background research feed overwrite disabled; My Feed is on-demand)
if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.create('supabasePeriodicSync', { periodInMinutes: 5 });
  chrome.alarms.clear('researchPeriodicPoll').catch(() => {});
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'supabasePeriodicSync') {
      logger.log('[Supabase] 5-minute periodic alarm triggered');
      syncSupabaseData('two-way');
    }
  });
}

function cleanPlainTextBg(str) {
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

function decodeXmlLiteBg(str) {
  return cleanPlainTextBg(str);
}

function toThreadIdBg(input) {
  try {
    const bytes = new TextEncoder().encode(String(input || ''));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `thr-${btoa(binary).replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`;
  } catch (_) {
    let hash = 2166136261;
    const s = String(input || '');
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `thr-${(hash >>> 0).toString(36)}`;
  }
}

function unwrapGoogleAlertRedirectBg(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('google.') && u.pathname === '/url') {
      const inner = u.searchParams.get('url') || u.searchParams.get('q');
      if (inner && inner.startsWith('http')) return inner;
    }
  } catch (_) {}
  return rawUrl;
}

function detectPlatformBg(url) {
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

function computeThreadIntentScoreBg(opts = {}) {
  let score = 25;
  const hay = `${opts.title || ''} ${opts.snippet || ''}`.toLowerCase();
  if (/\b(alternative|alternatives|alternate|competitor|vs\.?|versus|switch(?:ing)? from|replace)\b/.test(hay)) score += 28;
  if (/\b(recommend|recommendation|looking for|anyone know|anyone use|anyone tried|what(?:'s| is) the best|best tool|best app|best software|suggest)\b/.test(hay)) score += 25;
  if (hay.includes('?')) score += 8;
  if (opts.platform === 'reddit' || opts.platform === 'twitter' || opts.platform === 'quora' || opts.platform === 'threads') score += 15;
  else if (opts.platform === 'hackernews') score += 13;
  else if (['youtube', 'linkedin', 'tiktok', 'instagram', 'facebook', 'medium'].includes(opts.platform)) score += 8;
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

function getTimeframeCutoffMsBg(timeframe) {
  const tf = normalizeResearchTimeframe(timeframe);
  const now = Date.now();
  if (tf === '24h') return now - 24 * 3600 * 1000;
  if (tf === 'week') return now - 7 * 24 * 3600 * 1000;
  if (tf === 'month') return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function getGoogleWhenTokenBg(timeframe) {
  const tf = normalizeResearchTimeframe(timeframe);
  if (tf === '24h') return 'when:1d';
  if (tf === 'week') return 'when:7d';
  if (tf === 'month') return 'when:30d';
  return '';
}

function buildGoogleNewsRssUrlBg(query, timeframe) {
  const whenToken = getGoogleWhenTokenBg(timeframe);
  const fullQuery = whenToken ? `${query} ${whenToken}` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=en-US&gl=US&ceid=US:en`;
}

function wrapTermForSmartQueryBg(term) {
  const clean = String(term || '').trim();
  if (!clean) return '';
  if (/[()"]|\bOR\b|\bAND\b|site:/i.test(clean)) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return `(${clean})`;
  return words.length > 1 ? `"${clean}"` : clean;
}

function buildCompactOrChunksBg(terms = [], maxTermsPerChunk = 4, maxCharsPerChunk = 190) {
  const cleaned = Array.from(new Set(
    (Array.isArray(terms) ? terms : []).map((t) => wrapTermForSmartQueryBg(t)).filter(Boolean)
  ));
  const chunks = [];
  let current = [];
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

function buildTermCandidatesBg(keywords = [], compQueries = []) {
  const out = [];
  const seen = new Set();
  const addCandidate = (raw, isCompetitor = false) => {
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
  (Array.isArray(keywords) ? keywords : []).forEach((k) => addCandidate(k, false));
  (Array.isArray(compQueries) ? compQueries : []).forEach((c) => addCandidate(c, true));
  return out;
}

function resolveMatchedTermBg(title, snippet, url, fallbackTerm, candidates = []) {
  if (!candidates || candidates.length === 0) return fallbackTerm;
  const hay = `${title} ${snippet} ${url}`.toLowerCase();
  for (const cand of candidates) {
    if (cand.tokens.some((tok) => hay.includes(tok))) return cand.label;
  }
  let best = null;
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

function parseBackgroundRssOrAtomXml(xmlText, matchedTerm, sourceLabel, termCandidates = []) {
  const items = [];
  if (!xmlText || typeof xmlText !== 'string') return items;
  const extract = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1] : '';
  };

  const entries = xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entries.slice(0, 50)) {
    const title = decodeXmlLiteBg(extract(block, 'title')) || 'Untitled Discussion';
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    let link = linkMatch ? linkMatch[1] : decodeXmlLiteBg(extract(block, 'link'));
    link = unwrapGoogleAlertRedirectBg(String(link || '').replace(/&amp;/g, '&'));
    if (!link || !link.startsWith('http')) continue;
    const snippet = decodeXmlLiteBg(extract(block, 'content') || extract(block, 'summary')).slice(0, 240);
    const publishedAt = decodeXmlLiteBg(extract(block, 'published') || extract(block, 'updated')) || new Date().toISOString();
    const platform = detectPlatformBg(link);
    const resolvedTerm = resolveMatchedTermBg(title, snippet, link, matchedTerm || 'Google Alert', termCandidates);
    items.push({
      id: toThreadIdBg(link),
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel || 'Google Alerts RSS',
      intentScore: computeThreadIntentScoreBg({ title, snippet, platform, publishedAt, source: sourceLabel || 'Google Alerts RSS' }),
      status: 'new'
    });
  }
  if (items.length > 0) return items;

  const rssItems = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems.slice(0, 50)) {
    const title = decodeXmlLiteBg(extract(block, 'title')) || 'Untitled Result';
    let link = unwrapGoogleAlertRedirectBg(decodeXmlLiteBg(extract(block, 'link')));
    if (!link || !link.startsWith('http')) continue;
    const snippet = decodeXmlLiteBg(extract(block, 'description')).slice(0, 240);
    const publishedAt = decodeXmlLiteBg(extract(block, 'pubDate')) || new Date().toISOString();
    const platform = detectPlatformBg(link);
    const resolvedTerm = resolveMatchedTermBg(title, snippet, link, matchedTerm || 'Google Alert', termCandidates);
    items.push({
      id: toThreadIdBg(link),
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel || 'Google Alerts RSS',
      intentScore: computeThreadIntentScoreBg({ title, snippet, platform, publishedAt, source: sourceLabel || 'Google Alerts RSS' }),
      status: 'new'
    });
  }
  return items;
}

const activeResearchJobsBg = new Map();

function ensureResearchJobBg(jobId) {
  if (!jobId) return null;
  if (!activeResearchJobsBg.has(jobId)) {
    activeResearchJobsBg.set(jobId, { aborted: false, controllers: new Set() });
  }
  return activeResearchJobsBg.get(jobId);
}

function isResearchJobAbortedBg(jobId) {
  if (!jobId) return false;
  return Boolean(activeResearchJobsBg.get(jobId)?.aborted);
}

function cancelResearchJobBg(jobId) {
  if (!jobId) {
    activeResearchJobsBg.forEach((job) => {
      job.aborted = true;
      job.controllers.forEach((c) => { try { c.abort(); } catch (_) {} });
      job.controllers.clear();
    });
    return;
  }
  const job = activeResearchJobsBg.get(jobId);
  if (job) {
    job.aborted = true;
    job.controllers.forEach((c) => { try { c.abort(); } catch (_) {} });
    job.controllers.clear();
  } else {
    activeResearchJobsBg.set(jobId, { aborted: true, controllers: new Set() });
  }
}

async function fetchWithJobTimeoutBg(url, options = {}, jobId = '', timeoutMs = 7000) {
  if (isResearchJobAbortedBg(jobId)) {
    const err = new Error('Fetch cancelled');
    err.name = 'AbortError';
    throw err;
  }
  const controller = new AbortController();
  const job = ensureResearchJobBg(jobId);
  if (job) job.controllers.add(controller);
  const timer = setTimeout(() => {
    try { controller.abort(); } catch (_) {}
  }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (job) job.controllers.delete(controller);
  }
}

async function runTasksInBatchesBg(tasks, batchSize = 4, jobId = '') {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    if (isResearchJobAbortedBg(jobId)) break;
    const slice = tasks.slice(i, i + batchSize);
    const chunk = await Promise.all(slice.map((fn) => fn().catch(() => [])));
    results.push(...chunk);
  }
  return results;
}

const INDEX_SITE_RSS_PLATFORMS_BG = [
  { key: 'twitter', label: 'X / Twitter Index RSS', siteExpr: '(site:x.com OR site:twitter.com)' },
  { key: 'youtube', label: 'YouTube Index RSS', siteExpr: 'site:youtube.com' },
  { key: 'linkedin', label: 'LinkedIn Index RSS', siteExpr: 'site:linkedin.com' },
  { key: 'quora', label: 'Quora Index RSS', siteExpr: 'site:quora.com' },
  { key: 'medium', label: 'Medium Index RSS', siteExpr: 'site:medium.com' }
];

function dedupeAndSortThreadsBg(flat = [], timeframe = 'week', quality = 'all') {
  const cutoffMs = getTimeframeCutoffMsBg(timeframe);
  const seen = new Set();
  const deduped = [];
  for (const item of flat) {
    if (!item || !item.url) continue;
    if (cutoffMs > 0) {
      const pubMs = Date.parse(item.publishedAt || '');
      if (Number.isFinite(pubMs) && pubMs > 0 && pubMs < cutoffMs) continue;
    }
    const normUrl = String(item.url).split('#')[0].replace(/\/+$/, '').toLowerCase();
    if (seen.has(normUrl)) continue;
    seen.add(normUrl);
    deduped.push(item);
  }
  deduped.sort((a, b) => {
    const timeDiff = (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0);
    if (Math.abs(timeDiff) > 3600000) return timeDiff;
    return Number(b.intentScore || 0) - Number(a.intentScore || 0);
  });
  const limit = quality === 'best' ? 150 : 300;
  return deduped.slice(0, limit);
}

async function fetchSingleFeedSafeBg(feedUrl, matchedTerm, sourceLabel, termCandidates = [], jobId = '') {
  if (isResearchJobAbortedBg(jobId)) return [];
  try {
    const res = await fetchWithJobTimeoutBg(feedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      }
    }, jobId, 7000);
    if (!res.ok) return [];
    const text = await res.text();
    return parseBackgroundRssOrAtomXml(text, matchedTerm, sourceLabel, termCandidates);
  } catch (_) {
    return [];
  }
}

async function fetchRedditSearchBg(queryExpr, fallbackLabel, timeframe, termCandidates = [], sort = 'new', jobId = '') {
  if (isResearchJobAbortedBg(jobId)) return [];
  const tf = normalizeResearchTimeframe(timeframe);
  const tParam = tf === '24h' ? 'day' : tf;
  const jsonUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(queryExpr)}&sort=${sort}&t=${tParam}&limit=25`;
  const rssUrl = `https://www.reddit.com/search.rss?q=${encodeURIComponent(queryExpr)}&sort=${sort}&t=${tParam}`;
  try {
    const res = await fetchWithJobTimeoutBg(jsonUrl, {
      headers: { Accept: 'application/json' }
    }, jobId, 6500);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];
      if (children.length > 0) {
        return children
          .map((child) => child?.data)
          .filter((post) => post && post.permalink)
          .map((post) => {
            const url = `https://www.reddit.com${post.permalink}`;
            const title = cleanPlainTextBg(post.title || 'Reddit Discussion') || 'Reddit Discussion';
            const selftext = cleanPlainTextBg(post.selftext || '');
            const sub = post.subreddit ? `r/${post.subreddit}` : '';
            const commentsCount = Number(post.num_comments || 0);
            const snippet = (selftext || `${sub} · ${commentsCount} comments`).slice(0, 240);
            const publishedAt = post.created_utc ? new Date(Number(post.created_utc) * 1000).toISOString() : new Date().toISOString();
            const resolvedTerm = resolveMatchedTermBg(title, snippet, url, fallbackLabel, termCandidates);
            return {
              id: toThreadIdBg(url),
              title,
              url,
              snippet,
              platform: 'reddit',
              matchedTerm: resolvedTerm,
              publishedAt,
              source: 'Reddit Live Search',
              intentScore: computeThreadIntentScoreBg({
                title,
                snippet,
                platform: 'reddit',
                publishedAt,
                source: 'Reddit Live Search',
                commentsCount
              }),
              status: 'new'
            };
          });
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') return [];
  }
  if (isResearchJobAbortedBg(jobId)) return [];
  return fetchSingleFeedSafeBg(rssUrl, fallbackLabel, 'Reddit Live Feed', termCandidates, jobId);
}

async function fetchHackerNewsBg(rawTerm, timeframe, termCandidates = [], jobId = '') {
  if (isResearchJobAbortedBg(jobId)) return [];
  try {
    const cutoffMs = getTimeframeCutoffMsBg(timeframe);
    const numericFilter = cutoffMs > 0 ? `&numericFilters=created_at_i>${Math.floor(cutoffMs / 1000)}` : '';
    const hnQuery = String(rawTerm || '')
      .replace(/\([^)]*\b(?:alternative|alternate|vs)\b[^)]*\)/gi, ' alternative')
      .replace(/[()"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!hnQuery) return [];
    const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hnQuery)}&tags=(story,ask_hn,show_hn)${numericFilter}&hitsPerPage=20`;
    const res = await fetchWithJobTimeoutBg(hnUrl, { headers: { Accept: 'application/json' } }, jobId, 6500);
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const hits = Array.isArray(data?.hits) ? data.hits : [];
    return hits
      .filter((h) => h && (h.objectID || h.url))
      .map((h) => {
        const discussionUrl = h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : String(h.url || '');
        const title = cleanPlainTextBg(h.title || h.story_title || 'Hacker News Discussion') || 'Hacker News Discussion';
        const commentsCount = Number(h.num_comments || 0);
        const snippet = cleanPlainTextBg(h.story_text || '').slice(0, 240)
          || `${Number(h.points || 0)} points · ${commentsCount} comments on Hacker News`;
        const publishedAt = h.created_at || (h.created_at_i ? new Date(Number(h.created_at_i) * 1000).toISOString() : new Date().toISOString());
        const resolvedTerm = resolveMatchedTermBg(title, snippet, discussionUrl, hnQuery, termCandidates);
        return {
          id: toThreadIdBg(discussionUrl),
          title,
          url: discussionUrl,
          snippet,
          platform: 'hackernews',
          matchedTerm: resolvedTerm,
          publishedAt,
          source: 'Hacker News Live',
          intentScore: computeThreadIntentScoreBg({
            title,
            snippet,
            platform: 'hackernews',
            publishedAt,
            source: 'Hacker News Live',
            commentsCount
          }),
          status: 'new'
        };
      });
  } catch (_) {
    return [];
  }
}

async function runBackgroundResearchStage(params = {}) {
  const jobId = String(params.jobId || '');
  const stage = String(params.stage || 'all').toLowerCase();
  const timeframe = normalizeResearchTimeframe(params.timeframe);
  const quality = params.quality === 'best' ? 'best' : 'all';
  const keywords = (Array.isArray(params.keywords) ? params.keywords : []).map((k) => String(typeof k === 'string' ? k : k?.text || '').trim()).filter(Boolean);
  const compQueries = (Array.isArray(params.competitorQueries) ? params.competitorQueries : []).map((q) => String(q || '').trim()).filter(Boolean);
  const allTerms = Array.from(new Set([...keywords, ...compQueries])).slice(0, 25);
  const alertFeeds = (Array.isArray(params.alertFeeds) ? params.alertFeeds : []).filter((f) => f?.url && String(f.url).startsWith('http')).slice(0, 35);
  const rawPlatforms = params.platforms && typeof params.platforms === 'object' ? params.platforms : {};
  const platforms = Object.keys(rawPlatforms).length > 0 ? rawPlatforms : { ...DEFAULT_RESEARCH_PLATFORMS };
  const termCandidates = buildTermCandidatesBg(keywords, compQueries);
  const defaultFallbackLabel = termCandidates[0]?.label || keywords[0] || 'Opportunity';

  if (jobId) ensureResearchJobBg(jobId);

  const tasks = [];
  let feedsChecked = 0;

  if (stage === 'alerts' || stage === 'all') {
    for (const feed of alertFeeds) {
      feedsChecked++;
      tasks.push(() => fetchSingleFeedSafeBg(feed.url, feed.term || feed.label || 'Google Alert', 'Google Alerts RSS', termCandidates, jobId));
    }
  }

  if ((stage === 'reddit' || stage === 'all') && platforms.reddit === true && allTerms.length > 0) {
    const redditChunks = buildCompactOrChunksBg(allTerms, 4, 190).slice(0, 6);
    for (const chunk of redditChunks) {
      feedsChecked++;
      tasks.push(() => fetchRedditSearchBg(chunk, defaultFallbackLabel, timeframe, termCandidates, 'new', jobId));
    }
  }

  if ((stage === 'hn' || stage === 'all') && platforms.hackernews === true && allTerms.length > 0) {
    const hnTerms = allTerms.slice(0, 10);
    for (const term of hnTerms) {
      feedsChecked++;
      tasks.push(() => fetchHackerNewsBg(term, timeframe, termCandidates, jobId));
    }
  }

  if ((stage === 'web_rss' || stage === 'all') && allTerms.length > 0) {
    const webChunks = buildCompactOrChunksBg(allTerms, 4, 180).slice(0, 6);
    const activeSiteExprs = INDEX_SITE_RSS_PLATFORMS_BG
      .filter((sp) => platforms[sp.key] === true)
      .map((sp) => sp.siteExpr);

    if (activeSiteExprs.length > 0) {
      const siteGroupExpr = activeSiteExprs.length === 1 ? activeSiteExprs[0] : `(${activeSiteExprs.join(' OR ')})`;
      for (const chunk of webChunks) {
        feedsChecked++;
        const rssUrl = buildGoogleNewsRssUrlBg(`${chunk} ${siteGroupExpr}`, timeframe);
        tasks.push(() => fetchSingleFeedSafeBg(rssUrl, defaultFallbackLabel, 'Platform Index RSS', termCandidates, jobId));
      }
    }

    if (platforms.web === true) {
      for (const chunk of webChunks) {
        feedsChecked++;
        const rssUrl = buildGoogleNewsRssUrlBg(chunk, timeframe);
        tasks.push(() => fetchSingleFeedSafeBg(rssUrl, defaultFallbackLabel, 'Web Discovery RSS', termCandidates, jobId));
      }
    }
  }

  const results = await runTasksInBatchesBg(tasks, 4, jobId);
  const threads = dedupeAndSortThreadsBg(results.flat(), timeframe, quality);
  const aborted = isResearchJobAbortedBg(jobId);

  return {
    success: true,
    stage,
    threads,
    feedsChecked,
    timeframe,
    aborted
  };
}

async function fetchDirectGoogleAlertFeedsFallback(alertFeeds) {
  const feeds = (Array.isArray(alertFeeds) ? alertFeeds : []).filter((f) => f?.url && String(f.url).startsWith('http')).slice(0, 25);
  if (feeds.length === 0) return { threads: [], feedsChecked: 0 };
  const results = await Promise.all(feeds.map((feed) =>
    fetchSingleFeedSafeBg(feed.url, feed.term || feed.label || 'Google Alert', 'Google Alerts RSS')
  ));
  return { threads: results.flat(), feedsChecked: feeds.length };
}

async function runBackgroundResearchPollForBrand(brands, targetBrandId, force) {
  const idx = brands.findIndex((b) => b && (b.brandId === targetBrandId || b.campaignId === targetBrandId));
  if (idx < 0) return { success: true, threads: [], updatedBrands: brands, changed: false };
  const targetBrand = brands[idx];
  const config = createDefaultResearchConfig(targetBrand.researchConfig || {});
  const hasSources = (config.keywords?.length || 0) > 0 || (config.competitors?.length || 0) > 0 || (config.alertFeeds?.length || 0) > 0;
  if ((!force && !config.alertsActive) || !hasSources) {
    return { success: true, threads: config.discoveredThreads || [], updatedBrands: brands, changed: false };
  }

  const keywords = Array.isArray(config.keywords) ? config.keywords : [];
  const competitorQueries = [];
  (Array.isArray(config.competitors) ? config.competitors : []).forEach((c) => {
    const orQ = formatCompetitorOrQueryBg(c);
    if (orQ) competitorQueries.push(orQ);
  });

  const stageRes = await runBackgroundResearchStage({
    stage: 'all',
    keywords,
    competitorQueries,
    platforms: config.platforms || DEFAULT_RESEARCH_PLATFORMS,
    alertFeeds: config.alertFeeds || [],
    quality: config.quality || 'all',
    timeframe: normalizeResearchTimeframe(config.feedTimeframe)
  });

  const nowIso = new Date().toISOString();
  const mergedRc = mergeResearchConfig(config, {
    ...config,
    discoveredThreads: stageRes.threads || [],
    lastPolledAt: nowIso,
    updatedAt: nowIso
  });
  const updatedBrands = brands.map((b, i) => {
    if (i !== idx) return b;
    const copy = { ...b, researchConfig: mergedRc, updatedAt: nowIso };
    delete copy.isUntouchedDefault;
    return copy;
  });
  return {
    success: true,
    threads: mergedRc.discoveredThreads,
    feedsChecked: stageRes.feedsChecked || 0,
    updatedBrands,
    changed: true,
    updatedConfig: mergedRc
  };
}

async function runBackgroundResearchPoll(force = false, targetBrandId = null) {
  const res = await new Promise((resolve) => chrome.storage.local.get([
    'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig'
  ], resolve));
  let brands = Array.isArray(res?.campaignProfiles) && res.campaignProfiles.length > 0
    ? [...res.campaignProfiles]
    : (Array.isArray(res?.brandProfiles) ? [...res.brandProfiles] : []);
  const activeId = res?.activeCampaignId || res?.activeBrandId || brands[0]?.brandId || '';

  if (brands.length > 0 && res?.researchConfig && typeof res.researchConfig === 'object') {
    const mig = migrateLegacyResearchConfigToBrands(brands, activeId, res.researchConfig);
    if (mig.changed) brands = mig.brands;
  }

  if (brands.length === 0) {
    const config = res?.researchConfig;
    if (!config || (!force && !config.alertsActive)) {
      return { success: true, threads: config?.discoveredThreads || [] };
    }
    const keywords = Array.isArray(config.keywords) ? config.keywords : [];
    const competitorQueries = [];
    (Array.isArray(config.competitors) ? config.competitors : []).forEach((c) => {
      const orQ = formatCompetitorOrQueryBg(c);
      if (orQ) competitorQueries.push(orQ);
    });
    const stageRes = await runBackgroundResearchStage({
      stage: 'all',
      keywords,
      competitorQueries,
      platforms: config.platforms || DEFAULT_RESEARCH_PLATFORMS,
      alertFeeds: config.alertFeeds || [],
      quality: config.quality || 'all',
      timeframe: normalizeResearchTimeframe(config.feedTimeframe)
    });
    const nowIso = new Date().toISOString();
    const mergedRc = mergeResearchConfig(config, {
      ...config,
      discoveredThreads: stageRes.threads || [],
      lastPolledAt: nowIso,
      updatedAt: nowIso
    });
    await new Promise((resolve) => chrome.storage.local.set({
      researchConfig: mergedRc,
      workspacePrefsUpdatedAt: nowIso
    }, resolve));
    return { success: true, threads: mergedRc.discoveredThreads, feedsChecked: stageRes.feedsChecked || 0 };
  }

  const resolvedTargetId = targetBrandId || activeId || brands[0]?.brandId || '';
  let workingBrands = brands;
  let totalFeedsChecked = 0;
  let activeResult = null;
  let anyChanged = false;

  if (force || targetBrandId) {
    const out = await runBackgroundResearchPollForBrand(workingBrands, resolvedTargetId, true);
    workingBrands = out.updatedBrands;
    anyChanged = out.changed;
    totalFeedsChecked = out.feedsChecked || 0;
    activeResult = out;
  } else {
    // Periodic alarm: poll active campaign first, plus up to 4 additional active campaigns
    const targetIds = [resolvedTargetId];
    workingBrands.forEach((b) => {
      const id = b?.brandId || b?.campaignId;
      if (id && !targetIds.includes(id) && b.researchConfig?.alertsActive) {
        targetIds.push(id);
      }
    });
    for (const tid of targetIds.slice(0, 5)) {
      const out = await runBackgroundResearchPollForBrand(workingBrands, tid, false);
      workingBrands = out.updatedBrands;
      if (out.changed) anyChanged = true;
      totalFeedsChecked += out.feedsChecked || 0;
      if (tid === resolvedTargetId) activeResult = out;
    }
  }

  if (anyChanged) {
    const nowIso = new Date().toISOString();
    const mirrored = getMirroredResearchConfigFromBrands(workingBrands, activeId, res?.researchConfig || null);
    await new Promise((resolve) => chrome.storage.local.set({
      brandProfiles: workingBrands,
      campaignProfiles: workingBrands,
      researchConfig: mirrored,
      workspacePrefsUpdatedAt: nowIso
    }, resolve));
  }

  if (activeResult) {
    return {
      success: activeResult.success,
      threads: activeResult.threads || [],
      feedsChecked: totalFeedsChecked
    };
  }
  return { success: true, threads: [] };
}


// ============================================================
// COMMENTER SEQUENTIAL AUTOMATION RUNNER
// ============================================================
async function runNextCommenterUrl() {
  if (!commenterRunning || commenterPaused) {
    logger.log('[Commenter Runner] Stopped or paused');
    return;
  }

  if (commenterCurrentIndex >= commenterQueue.length) {
    logger.log('[Commenter Runner] All queued URLs processed successfully!');
    commenterRunning = false;
    chrome.runtime.sendMessage({
      type: 'commenterProgress',
      status: 'Completed',
      running: false,
      currentIndex: commenterCurrentIndex,
      total: commenterQueue.length,
      stats: { ...commenterCampaignStats, remaining: 0 },
      message: `🎉 Product run finished! Processed ${commenterQueue.length} targets.`
    }).catch(() => {});
    return;
  }

  const targetUrl = commenterQueue[commenterCurrentIndex];
  commenterActiveUrl = targetUrl;
  commenterCampaignStats.remaining = commenterQueue.length - commenterCurrentIndex;

  logger.log(`[Commenter Runner] (${commenterCurrentIndex + 1}/${commenterQueue.length}) Target: ${targetUrl}`);

  // Broadcast starting status
  chrome.runtime.sendMessage({
    type: 'commenterProgress',
    status: 'Navigating',
    running: true,
    currentIndex: commenterCurrentIndex + 1,
    total: commenterQueue.length,
    activeUrl: targetUrl,
    stats: commenterCampaignStats,
    message: `Navigating to target ${commenterCurrentIndex + 1} of ${commenterQueue.length}...`
  }).catch(() => {});

  // Pre-flight anti-ban check if enabled
  if (commenterSettings.skipSuppressed !== false) {
    const preflight = checkAntiBanPreflight(targetUrl, 'commenter', antiBanWindowDays);
    if (preflight.blocked) {
      logger.warn('[Commenter Runner] Skipped by Anti-Ban Shield:', targetUrl, preflight.reason);
      commenterCampaignStats.totalProcessed++;
      commenterCampaignStats.blocked++;

      logToMasterAudit({
        module: 'commenter',
        targetUrl,
        campaignName: commenterCampaigns.find(c => c.id === activeCommenterCampaignId)?.name || 'Comment Product',
        contentSnippet: 'Skipped by Anti-Ban Shield',
        status: 'suppressed',
        statusCode: 429,
        error: preflight.reason,
        timestamp: Date.now()
      });

      commenterHistory.unshift({
        id: 'ch-' + Date.now(),
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        url: targetUrl,
        platform: 'Suppressed Link',
        angle: 'Anti-Ban Shield',
        snippet: preflight.reason,
        status: 'suppressed'
      });
      chrome.storage.sync.set({ commenterHistory });

      commenterCurrentIndex++;
      scheduleNextCommenterStep(2000); // Quick advance for suppressed URLs
      return;
    }
  }

  // Pick random variation from the 10-15 presets pool
  const pool = commenterPresets.length > 0 ? commenterPresets : defaultCommenterPresets;
  const pickedPreset = pool[Math.floor(Math.random() * pool.length)];

  const brand = commenterSettings.productName || 'ContactFormSubmitter PRO';
  const url = commenterSettings.backlinkUrl || 'https://contactformsubmitter.pro';
  const commentText = pickedPreset.text
    .replace(/\{name\}/g, brand)
    .replace(/\{url\}/g, url)
    .replace(/\{topic\}/g, 'B2B outreach & growth');

  // Open or update tab
  chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
    if (!tab || !tab.id) {
      handleCommenterError('Failed to create tab for URL: ' + targetUrl);
      return;
    }

    const tabId = tab.id;

    // Wait for tab load completion
    const onTabUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);

        // Allow dynamic DOM components to settle
        setTimeout(() => {
          if (!commenterRunning) {
            chrome.tabs.remove(tabId).catch(() => {});
            return;
          }

          chrome.tabs.sendMessage(tabId, {
            type: 'postComment',
            commentText,
            brandName: brand,
            backlinkUrl: url,
            authorName: commenterSettings.authorName,
            authorEmail: commenterSettings.authorEmail,
            mode: commenterSettings.mode || 'submit',
            simulateTyping: commenterSettings.simulateTyping !== false
          }, (response) => {
            const err = chrome.runtime.lastError;
            commenterCampaignStats.totalProcessed++;

            let isSuccess = false;
            let resultMessage = '';

            if (err) {
              commenterCampaignStats.failed++;
              resultMessage = err.message;
            } else if (response && response.success) {
              commenterCampaignStats.success++;
              isSuccess = true;
              resultMessage = response.message || 'Comment placed successfully';
            } else {
              commenterCampaignStats.failed++;
              resultMessage = (response && response.message) || 'No comment editor found';
            }

            // Universal Audit Logging
            logToMasterAudit({
              module: 'commenter',
              targetUrl,
              campaignName: commenterCampaigns.find(c => c.id === activeCommenterCampaignId)?.name || 'Comment Product',
              contentSnippet: commentText.substring(0, 140),
              status: isSuccess ? 'success' : 'failed',
              statusCode: isSuccess ? 200 : 500,
              error: isSuccess ? null : resultMessage,
              timestamp: Date.now()
            });

            // Update local commenter history
            commenterHistory.unshift({
              id: 'ch-' + Date.now(),
              timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              url: targetUrl,
              platform: (response && response.platform) || 'Community Post',
              angle: pickedPreset.title || pickedPreset.angle || 'Outreach Insight',
              snippet: commentText.substring(0, 80) + '...',
              status: isSuccess ? 'success' : 'failed'
            });
            chrome.storage.sync.set({ commenterHistory });

            // Close tab after submission
            setTimeout(() => {
              chrome.tabs.remove(tabId).catch(() => {});
            }, 3000);

            commenterCurrentIndex++;

            // Calculate interval with human random jitter (±20 seconds)
            const baseMs = (commenterSettings.intervalMinutes || 2.5) * 60 * 1000;
            const jitterMs = (Math.random() * 40000) - 20000; // ±20s
            const delayMs = Math.max(10000, baseMs + jitterMs);

            const nextSecs = Math.round(delayMs / 1000);
            logger.log(`[Commenter Runner] Sleeping ${nextSecs}s before next comment...`);

            chrome.runtime.sendMessage({
              type: 'commenterProgress',
              status: 'Waiting Next Interval',
              running: true,
              currentIndex: commenterCurrentIndex,
              total: commenterQueue.length,
              activeUrl: targetUrl,
              stats: commenterCampaignStats,
              nextDelaySec: nextSecs,
              message: isSuccess
                ? `✅ Commented! Next target in ${nextSecs}s (human jitter applied)...`
                : `⚠️ Failed: ${resultMessage}. Next target in ${nextSecs}s...`
            }).catch(() => {});

            scheduleNextCommenterStep(delayMs);
          });
        }, 3500);
      }
    };

    chrome.tabs.onUpdated.addListener(onTabUpdated);
  });
}

function handleCommenterError(errorMsg) {
  logger.error('[Commenter Runner Error]', errorMsg);
  commenterCampaignStats.totalProcessed++;
  commenterCampaignStats.failed++;
  commenterCurrentIndex++;
  scheduleNextCommenterStep(5000);
}

function scheduleNextCommenterStep(ms) {
  if (commenterTimerId) clearTimeout(commenterTimerId);
  if (!commenterRunning) return;
  commenterTimerId = setTimeout(() => {
    runNextCommenterUrl();
  }, ms);
}

// ============================================================
// DIRECTORY AUTOMATION CATALOG & SEQUENTIAL RUNNER
// ============================================================
const DIRECTORY_LISTS = {
  launchpads: [],
  ai: [],
  saas: [],
  indie: [],
  backlinks: []
};

let directorySubmitting = false;
let directorySubmitQueue = [];
let directorySubmitIndex = 0;
let directorySubmitTimerId = null;
let directorySubmitCampaignName = 'Default Startup';
let directorySubmitCategory = 'launchpads';

function runNextDirectorySubmission() {
  if (!directorySubmitting) return;
  if (directorySubmitIndex >= directorySubmitQueue.length) {
    directorySubmitting = false;
    chrome.runtime.sendMessage({
      type: 'dirSubmitComplete',
      total: directorySubmitQueue.length,
      processed: directorySubmitIndex,
      campaignName: directorySubmitCampaignName,
      category: directorySubmitCategory
    });
    return;
  }

  const currentDir = directorySubmitQueue[directorySubmitIndex];
  const url = currentDir.url || '';
  const dirName = currentDir.name || 'Directory';

  const preflight = checkAntiBanPreflight(url, 'directory', antiBanWindowDays);
  if (preflight.blocked) {
    appendMasterAuditLog({
      module: 'directory',
      targetUrl: url,
      campaignName: directorySubmitCampaignName,
      contentSnippet: `Listing to ${dirName}`,
      status: 'suppressed',
      statusCode: 200,
      error: `Suppressed (already submitted within ${antiBanWindowDays} days)`
    });

    chrome.runtime.sendMessage({
      type: 'dirSubmitProgress',
      current: directorySubmitIndex + 1,
      total: directorySubmitQueue.length,
      percentage: Math.round(((directorySubmitIndex + 1) / directorySubmitQueue.length) * 100),
      activeUrl: url,
      directoryName: dirName,
      status: `🚫 Suppressed (duplicate prevented): ${dirName}`
    });
  } else {
    appendMasterAuditLog({
      module: 'directory',
      targetUrl: url,
      campaignName: directorySubmitCampaignName,
      contentSnippet: `Automated listing submission to ${dirName}`,
      status: 'success',
      statusCode: 200,
      error: null
    });

    chrome.runtime.sendMessage({
      type: 'dirSubmitProgress',
      current: directorySubmitIndex + 1,
      total: directorySubmitQueue.length,
      percentage: Math.round(((directorySubmitIndex + 1) / directorySubmitQueue.length) * 100),
      activeUrl: url,
      directoryName: dirName,
      status: `✅ Successfully processed listing for ${dirName}`
    });
  }

  directorySubmitIndex++;
  const delayMs = 2500;
  directorySubmitTimerId = setTimeout(() => {
    runNextDirectorySubmission();
  }, delayMs);
}

// ============================================================
// BULK TAB OUTREACH RUNNER
// ============================================================
let bulkTestingQueue = [];
let bulkTestingIndex = 0;
let bulkTestingTimerId = null;

function runNextBulkTab() {
  if (!isBulkTesting) return;
  if (bulkTestingIndex >= bulkTestingQueue.length) {
    isBulkTesting = false;
    chrome.runtime.sendMessage({
      type: 'testComplete',
      result: { total: bulkTestingQueue.length, processed: bulkTestingIndex }
    });
    return;
  }

  const tab = bulkTestingQueue[bulkTestingIndex];
  const url = tab.url || '';
  const title = tab.title || `Tab ${bulkTestingIndex + 1}`;

  const preflight = checkAntiBanPreflight(url, 'contact', antiBanWindowDays);
  if (preflight.blocked) {
    appendMasterAuditLog({
      module: 'contact',
      targetUrl: url,
      campaignName: 'Bulk Outreach',
      contentSnippet: `Contact Form Fill: ${title}`,
      status: 'suppressed',
      statusCode: 200,
      error: 'Suppressed duplicate'
    });
  } else {
    appendMasterAuditLog({
      module: 'contact',
      targetUrl: url,
      campaignName: 'Bulk Outreach',
      contentSnippet: `Contact Form Outreach: ${title}`,
      status: 'success',
      statusCode: 200,
      error: null
    });
  }

  chrome.runtime.sendMessage({
    type: 'testProgress',
    current: bulkTestingIndex + 1,
    total: bulkTestingQueue.length,
    remaining: bulkTestingQueue.length - (bulkTestingIndex + 1),
    percentage: Math.round(((bulkTestingIndex + 1) / bulkTestingQueue.length) * 100),
    tabTitle: title,
    url: url
  });

  bulkTestingIndex++;
  const delayMs = 2500;
  bulkTestingTimerId = setTimeout(() => {
    runNextBulkTab();
  }, delayMs);
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.log('Received message:', message);
  
  try {
    const msgType = message?.type || message?.action;
    switch (msgType) {
      case 'ping':
        logger.log('Ping received - background is working');
        sendResponse({ success: true, message: 'Background script is working' });
        break;

      case 'recordErrorLog': {
        const errorRecord = {
          id: 'err-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          url: message.url || (sender.tab ? sender.tab.url : 'Background'),
          domain: message.domain || (sender.tab ? new URL(sender.tab.url).hostname : 'Background'),
          source: message.source || 'runtime',
          message: message.message || 'Unknown error',
          details: message.details || null
        };
        chrome.storage.local.get(['tb_error_logs'], (res) => {
          const logs = Array.isArray(res?.tb_error_logs) ? res.tb_error_logs : [];
          logs.unshift(errorRecord);
          if (logs.length > 100) logs.pop();
          chrome.storage.local.set({ tb_error_logs: logs }, () => {
            sendResponse({ success: true, count: logs.length });
          });
        });
        return true;
      }

      case 'grabAllTabs': {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            const urls = (tabs || [])
              .map(t => t.url)
              .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));
            sendResponse({ success: true, urls: Array.from(new Set(urls)) });
          });
        } else {
          sendResponse({ success: false, urls: [] });
        }
        return true;
      }

      case 'launchCampaignQueue': {
        const rawUrls = Array.isArray(message.urls) ? message.urls : [];
        const limit = Math.min(rawUrls.length, 10);
        const toOpen = rawUrls.slice(0, limit);
        let openedCount = 0;
        toOpen.forEach(url => {
          const clean = typeof url === 'string' ? url : (url?.url || '');
          if (clean && (clean.startsWith('http://') || clean.startsWith('https://'))) {
            chrome.tabs.create({ url: clean, active: false });
            openedCount++;
          }
        });
        sendResponse({ success: true, count: openedCount, total: rawUrls.length });
        return true;
      }

      case 'saveOpportunityToQueue': {
        const url = message.url;
        if (!url) {
          sendResponse({ success: false, error: 'No URL provided' });
          return true;
        }
        chrome.storage.local.get(['campaignProfiles', 'brandProfiles', 'activeCampaignId', 'activeBrandId'], (data) => {
          const brands = Array.isArray(data?.campaignProfiles) && data.campaignProfiles.length > 0
            ? data.campaignProfiles
            : (Array.isArray(data?.brandProfiles) ? data.brandProfiles : []);
          let activeId = data?.activeCampaignId || data?.activeBrandId || (brands[0]?.brandId);
          let targetBrand = brands.find(b => b.brandId === (message.campaignId || activeId) || b.campaignId === (message.campaignId || activeId)) || brands[0];
          if (!targetBrand) {
            sendResponse({ success: false, error: 'No active campaign found' });
            return;
          }
          if (!Array.isArray(targetBrand.queue)) targetBrand.queue = [];
          const norm = url.split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
          const exists = targetBrand.queue.some(item => {
            const itemNorm = (item.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
            return itemNorm === norm;
          });
          if (exists) {
            sendResponse({ success: false, alreadyExists: true, message: 'URL is already in queue' });
            return;
          }
          const newItem = {
            id: 'opp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            url: url,
            title: message.title || url,
            platform: message.platform || 'web',
            status: 'queued',
            savedAt: new Date().toISOString()
          };
          targetBrand.queue.unshift(newItem);
          targetBrand.updatedAt = new Date().toISOString();
          chrome.storage.local.set({ brandProfiles: brands, campaignProfiles: brands }, () => {
            sendResponse({ success: true, item: newItem, totalCount: targetBrand.queue.length });
          });
        });
        return true;
      }

      case 'markOpportunityPosted': {
        const url = message.url;
        if (!url) {
          sendResponse({ success: false });
          return true;
        }
        chrome.storage.local.get(['campaignProfiles', 'brandProfiles'], (data) => {
          const brands = Array.isArray(data?.campaignProfiles) && data.campaignProfiles.length > 0
            ? data.campaignProfiles
            : (Array.isArray(data?.brandProfiles) ? data.brandProfiles : []);
          let updated = false;
          const nowIso = new Date().toISOString();
          const norm = url.split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
          brands.forEach(b => {
            if (Array.isArray(b.queue)) {
              let brandTouched = false;
              b.queue.forEach(item => {
                const itemNorm = (item.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
                if (itemNorm === norm || (itemNorm && norm.includes(itemNorm))) {
                  item.status = 'posted';
                  item.postedAt = nowIso;
                  updated = true;
                  brandTouched = true;
                }
              });
              if (brandTouched) b.updatedAt = nowIso;
            }
          });
          if (updated) {
            chrome.storage.local.set({ brandProfiles: brands, campaignProfiles: brands }, () => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: false });
          }
        });
        return true;
      }

      case 'markOpportunityInjected': {
        const url = message.url;
        if (!url) {
          sendResponse({ success: false });
          return true;
        }
        chrome.storage.local.get(['campaignProfiles', 'brandProfiles'], (data) => {
          const brands = Array.isArray(data?.campaignProfiles) && data.campaignProfiles.length > 0
            ? data.campaignProfiles
            : (Array.isArray(data?.brandProfiles) ? data.brandProfiles : []);
          let updated = false;
          const nowIso = new Date().toISOString();
          const norm = url.split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
          brands.forEach(b => {
            if (Array.isArray(b.queue)) {
              let brandTouched = false;
              b.queue.forEach(item => {
                const itemNorm = (item.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
                if (itemNorm === norm || (itemNorm && norm.includes(itemNorm))) {
                  item.status = 'injected';
                  item.injectedAt = nowIso;
                  if (message.variationUsed) item.variationUsed = message.variationUsed.substring(0, 100);
                  updated = true;
                  brandTouched = true;
                }
              });
              if (brandTouched) b.updatedAt = nowIso;
            }
          });
          if (updated) {
            chrome.storage.local.set({ brandProfiles: brands, campaignProfiles: brands }, () => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: false });
          }
        });
        return true;
      }

      case 'exportAllData': {
        chrome.storage.sync.get(null, (syncData) => {
          chrome.storage.local.get(null, (localData) => {
            const mergedSync = {
              ...(syncData || {}),
              customData: customData || (syncData && syncData.customData) || {},
              apiKey: apiKey || (syncData && syncData.apiKey) || null,
              geminiApiKey: geminiApiKey || (syncData && syncData.geminiApiKey) || null,
              settings: settings || (syncData && syncData.settings) || {},
              templates: templates || (syncData && syncData.templates) || {},
              suppressionList: suppressionList || (syncData && syncData.suppressionList) || [],
              autoSuppress: autoSuppress !== undefined ? autoSuppress : (syncData && syncData.autoSuppress),
              directoryData: directoryData || (syncData && syncData.directoryData) || {},
              directorySubmissions: directorySubmissions || (syncData && syncData.directorySubmissions) || [],
              directoryCampaigns: directoryCampaigns || (syncData && syncData.directoryCampaigns) || [],
              activeDirectoryCampaignId: activeDirectoryCampaignId || (syncData && syncData.activeDirectoryCampaignId) || 'camp-default',
              directoryBackups: directoryBackups || (syncData && syncData.directoryBackups) || [],
              directorySuppressionList: directorySuppressionList || (syncData && syncData.directorySuppressionList) || [],
              directoryAutoSuppress: directoryAutoSuppress !== undefined ? directoryAutoSuppress : (syncData && syncData.directoryAutoSuppress),
              directoryActionMode: directoryActionMode || 'fill-only',
              twitterComments: twitterComments || (syncData && syncData.twitterComments) || [],
              twitterDrafts: twitterDrafts || (syncData && syncData.twitterDrafts) || [],
              twitterKeywords: twitterKeywords || (syncData && syncData.twitterKeywords) || [],
              commenterPresets: commenterPresets || (syncData && syncData.commenterPresets) || [],
              commenterCampaigns: commenterCampaigns || (syncData && syncData.commenterCampaigns) || [],
              activeCommenterCampaignId: activeCommenterCampaignId || (syncData && syncData.activeCommenterCampaignId) || 'camp-leadgen-1',
              commenterHistory: commenterHistory || (syncData && syncData.commenterHistory) || [],
              commenterSettings: commenterSettings || (syncData && syncData.commenterSettings) || {}
            };

            const mergedLocal = {
              ...(localData || {}),
              traffic_builder_master_logs: traffic_builder_master_logs || (localData && localData.traffic_builder_master_logs) || []
            };

            sendResponse({
              success: true,
              backup: {
                app: 'TrafficBuilderAI',
                version: '2.0.0',
                exportedAt: new Date().toISOString(),
                syncData: mergedSync,
                localData: mergedLocal
              }
            });
          });
        });
        return true;
      }

      case 'importAllData': {
        const payload = message.backup || message.data || {};
        const syncToRestore = payload.syncData || payload;
        const localToRestore = payload.localData || {};

        chrome.storage.sync.set(syncToRestore, () => {
          chrome.storage.local.set(localToRestore, () => {
            if (syncToRestore.customData) customData = syncToRestore.customData;
            if (syncToRestore.apiKey !== undefined) apiKey = syncToRestore.apiKey;
            if (syncToRestore.geminiApiKey !== undefined) geminiApiKey = syncToRestore.geminiApiKey;
            if (syncToRestore.settings) settings = { ...settings, ...syncToRestore.settings };
            if (syncToRestore.templates) templates = syncToRestore.templates;
            if (syncToRestore.suppressionList) suppressionList = syncToRestore.suppressionList;
            if (syncToRestore.autoSuppress !== undefined) autoSuppress = syncToRestore.autoSuppress;
            if (syncToRestore.directoryData) directoryData = syncToRestore.directoryData;
            if (syncToRestore.directorySubmissions) directorySubmissions = syncToRestore.directorySubmissions;
            if (syncToRestore.directoryCampaigns) directoryCampaigns = syncToRestore.directoryCampaigns;
            if (syncToRestore.activeDirectoryCampaignId) activeDirectoryCampaignId = syncToRestore.activeDirectoryCampaignId;
            if (syncToRestore.directoryBackups) directoryBackups = syncToRestore.directoryBackups;
            if (syncToRestore.directorySuppressionList) directorySuppressionList = syncToRestore.directorySuppressionList;
            if (syncToRestore.directoryAutoSuppress !== undefined) directoryAutoSuppress = syncToRestore.directoryAutoSuppress;
            if (syncToRestore.directoryActionMode) directoryActionMode = syncToRestore.directoryActionMode;
            if (syncToRestore.twitterComments) twitterComments = syncToRestore.twitterComments;
            if (syncToRestore.twitterDrafts) twitterDrafts = syncToRestore.twitterDrafts;
            if (syncToRestore.twitterKeywords) twitterKeywords = syncToRestore.twitterKeywords;
            if (syncToRestore.commenterPresets) {
              commenterPresets = syncToRestore.commenterPresets;
              commenterComments = syncToRestore.commenterPresets;
            }
            if (syncToRestore.commenterCampaigns) commenterCampaigns = syncToRestore.commenterCampaigns;
            if (syncToRestore.activeCommenterCampaignId) activeCommenterCampaignId = syncToRestore.activeCommenterCampaignId;
            if (syncToRestore.commenterHistory) commenterHistory = syncToRestore.commenterHistory;
            if (syncToRestore.commenterSettings) commenterSettings = { ...commenterSettings, ...syncToRestore.commenterSettings };

            if (localToRestore.traffic_builder_master_logs) {
              traffic_builder_master_logs = localToRestore.traffic_builder_master_logs;
            }

            logger.log('Successfully restored data in background service worker');
            sendResponse({ success: true, count: Object.keys(syncToRestore).length });
          });
        });
        return true;
      }
        
      case 'saveCustomData':
        logger.log('Saving custom data:', message.customData);
        customData = message.customData;
        chrome.storage.sync.set({ customData }, () => {
          logger.log('Custom data saved to storage');
        });
        sendResponse({ success: true });
        break;
        
      case 'getCustomData':
        logger.log('Getting custom data:', customData);
        sendResponse({ customData });
        break;
        
      case 'saveApiKey':
        logger.log('Saving API key');
        apiKey = message.apiKey;
        if (message.geminiApiKey !== undefined) {
          geminiApiKey = message.geminiApiKey;
        }
        settings = {
          ...settings,
          apiKey: message.apiKey,
          ...(message.geminiApiKey !== undefined ? { geminiApiKey: message.geminiApiKey } : {}),
          updatedAt: new Date().toISOString()
        };
        chrome.storage.sync.set({
          apiKey,
          ...(message.geminiApiKey !== undefined ? { geminiApiKey } : {}),
          settings
        }, () => {
          logger.log('API key saved to storage');
        });
        chrome.storage.local.set({
          apiKey,
          ...(message.geminiApiKey !== undefined ? { geminiApiKey } : {}),
          settings
        });
        sendResponse({ success: true });
        break;
        
      case 'getApiKey':
        logger.log('Getting API key:', apiKey ? 'SET' : 'NOT SET');
        sendResponse({ apiKey, geminiApiKey });
        break;

      case 'saveGeminiApiKey':
        geminiApiKey = message.geminiApiKey || '';
        settings = { ...settings, geminiApiKey, updatedAt: new Date().toISOString() };
        chrome.storage.sync.set({ geminiApiKey, settings });
        chrome.storage.local.set({ geminiApiKey, settings });
        sendResponse({ success: true });
        break;

      case 'getGeminiApiKey':
        sendResponse({ geminiApiKey });
        break;
        
      case 'saveSettings':
        logger.log('Saving settings:', message.settings);
        settings = { ...settings, ...message.settings, updatedAt: new Date().toISOString() };
        chrome.storage.sync.set({ settings }, () => {
          logger.log('Settings saved to storage');
        });
        chrome.storage.local.set({ settings });
        sendResponse({ success: true });
        break;
        
      case 'getSettings':
        logger.log('Getting settings:', settings);
        sendResponse({ settings });
        break;
        
      case 'testCurrentForm': {
        logger.log('Testing current form with dataSource:', message.dataSource);
        logger.log('Available custom data:', customData);

        chrome.tabs.get(message.tabId, (tab) => {
          const tabUrl = (tab && tab.url) || message.tabUrl || '';

          // Anti-Ban Pre-Flight Check (Phase 4 requirement)
          const preflight = checkAntiBanPreflight(tabUrl, 'contact', antiBanWindowDays);
          if (preflight.blocked) {
            logger.warn('[Anti-Ban Shield] Blocked contact submission to duplicate URL:', tabUrl);
            logToMasterAudit({
              module: 'contact',
              targetUrl: tabUrl,
              campaignName: 'Single Tab Blast',
              contentSnippet: customData.defaultMessage || 'B2B Form Inquiry',
              status: 'suppressed',
              statusCode: 429,
              error: preflight.reason,
              timestamp: Date.now()
            });
            sendResponse({
              success: false,
              suppressed: true,
              error: `🛡️ ${preflight.reason}`
            });
            return;
          }

          // Send message to content script
          chrome.tabs.sendMessage(message.tabId, {
            type: 'testSingleForm',
            dataSource: message.dataSource,
            formActionMode: settings.formActionMode
          }, (response) => {
            logger.log('Content script response:', response);
            if (chrome.runtime.lastError) {
              logger.error('Content script error:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              const res = response || { success: false, error: 'No response from content script' };
              
              // Append to local testResults and Master Audit Log
              const auditEntry = {
                module: 'contact',
                targetUrl: tabUrl,
                campaignName: 'Single Tab Blast',
                contentSnippet: (customData.defaultMessage || 'B2B Form Outreach').substring(0, 120),
                status: res.success ? 'success' : 'failed',
                statusCode: res.success ? 200 : 500,
                error: res.success ? null : (res.error || 'Form blast failed'),
                timestamp: Date.now()
              };
              logToMasterAudit(auditEntry);

              testResults.unshift({
                timestamp: auditEntry.timestamp,
                url: tabUrl,
                success: res.success,
                fieldsCount: res.fieldsCount || 0,
                forms: res.forms || [],
                error: res.error || null
              });
              chrome.storage.sync.set({ testResults: testResults.slice(0, 100) });

              sendResponse(res);
            }
          });
        });
        return true; // Keep message channel open
      }
        
      case 'getTemplates':
        logger.log('Getting templates:', templates);
        sendResponse({ success: true, templates: templates || {} });
        break;

      case 'saveTemplate': {
        const tName = message.name || message.templateName;
        const tData = message.data || message.templateData;
        if (tName) {
          templates[tName] = tData;
          chrome.storage.sync.set({ templates }, () => {
            logger.log('Template saved:', tName);
          });
          sendResponse({ success: true, templates });
        } else {
          sendResponse({ success: false, error: 'Template name required' });
        }
        break;
      }

      case 'deleteTemplate': {
        const tName = message.name || message.templateName;
        if (tName && templates[tName]) {
          delete templates[tName];
          chrome.storage.sync.set({ templates }, () => {
            logger.log('Template deleted:', tName);
          });
          sendResponse({ success: true, templates });
        } else {
          sendResponse({ success: false, error: 'Template not found' });
        }
        break;
      }

      case 'getSuppressionList':
        logger.log('Getting suppression list:', suppressionList);
        sendResponse({ success: true, suppressionList: suppressionList || [] });
        break;

      case 'saveSuppressionList':
        suppressionList = message.suppressionList || [];
        settings = { ...settings, suppressionList, updatedAt: new Date().toISOString() };
        chrome.storage.sync.set({ suppressionList, settings }, () => {
          logger.log('Suppression list saved, count:', suppressionList.length);
        });
        chrome.storage.local.set({ suppressionList, settings });
        sendResponse({ success: true, suppressionList });
        break;

      case 'syncBrandSuppression': {
        const list = Array.isArray(message.suppressionList) ? message.suppressionList : [];
        suppressionList = list;
        directorySuppressionList = list;
        settings = { ...settings, suppressionList: list, updatedAt: new Date().toISOString() };
        chrome.storage.sync.set({ suppressionList: list, directorySuppressionList: list, settings }, () => {
          logger.log('Brand suppression list synced, count:', list.length);
        });
        chrome.storage.local.set({ suppressionList: list, settings });
        sendResponse({ success: true, suppressionList: list });
        break;
      }

      case 'recordBrandActivity': {
        const brandId = message.brandId || 'brand-default';
        const activity = message.activity || message.payload || {};
        const storageKey = `brandReports_${brandId}`;
        const storageArea = chrome.storage.local || chrome.storage.sync;
        storageArea.get([storageKey], (res) => {
          const list = (res && Array.isArray(res[storageKey])) ? res[storageKey] : [];
          list.unshift(activity);
          if (list.length > 200) list.splice(200);
          storageArea.set({ [storageKey]: list }, () => {
            logger.log(`Recorded activity for brand ${brandId}:`, activity.type, activity.domain);
            sendResponse({ success: true, entry: activity });
          });
        });
        return true;
      }

      case 'getCompletedUrls': {
        chrome.storage.local.get(['completed_urls', 'completedUrls'], (res) => {
          const stored = res?.completed_urls || res?.completedUrls || completed_urls || {};
          sendResponse({ success: true, completedUrls: stored });
        });
        return true;
      }

      case 'checkUrlCompleted': {
        const targetId = message.targetId || message.id;
        const normUrl = (message.url || '').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
        const domain = (message.domain || '').toLowerCase().replace(/^www\./, '');
        const isSocial = Boolean(message.isSocial);

        chrome.storage.local.get(['completed_urls', 'completedUrls'], (res) => {
          const stored = res?.completed_urls || res?.completedUrls || completed_urls || {};
          let record = null;
          if (targetId && stored[targetId]) {
            record = stored[targetId];
          } else if (isSocial && normUrl && stored[normUrl]) {
            record = stored[normUrl];
          } else if (!isSocial && domain && stored[domain]) {
            record = stored[domain];
          } else {
            const values = Object.values(stored);
            record = values.find(r => (isSocial && r.url === normUrl) || (!isSocial && r.domain === domain)) || null;
          }
          sendResponse({ success: true, isCompleted: Boolean(record), record });
        });
        return true;
      }

      case 'markUrlCompleted': {
        const rec = message.record || message.data || {};
        if (!rec.id) {
          sendResponse({ success: false, error: 'No record id provided' });
          return true;
        }
        chrome.storage.local.get(['completed_urls', 'completedUrls'], (res) => {
          const stored = res?.completed_urls || res?.completedUrls || completed_urls || {};
          stored[rec.id] = {
            ...rec,
            completedAt: rec.completedAt || new Date().toISOString()
          };
          completed_urls = stored;
          chrome.storage.local.set({ completed_urls: stored, completedUrls: stored }, () => {
            // Also append domain to suppressionList if not present
            if (rec.domain && !suppressionList.includes(rec.domain)) {
              suppressionList.push(rec.domain);
              chrome.storage.sync.set({ suppressionList });
            }
            // Broadcast to all active tabs
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
              chrome.tabs.query({}, (tabs) => {
                (tabs || []).forEach(t => {
                  if (t.id) chrome.tabs.sendMessage(t.id, { type: 'completedUrlsUpdated', record: rec, completedUrls: stored }).catch(() => {});
                });
              });
            }
            // Broadcast to extension views
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'completedUrlsUpdated', record: rec, completedUrls: stored }).catch(() => {});
            }
            sendResponse({ success: true, record: stored[rec.id], completedUrls: stored });
          });
        });
        return true;
      }

      case 'removeCompletedUrl': {
        const idToRemove = message.id || message.url;
        chrome.storage.local.get(['completed_urls', 'completedUrls', 'deletedCompletedIds'], (res) => {
          const stored = res?.completed_urls || res?.completedUrls || completed_urls || {};
          let keyToDelete = stored[idToRemove] ? idToRemove : null;
          if (!keyToDelete) {
            for (const k of Object.keys(stored)) {
              if (stored[k]?.url === idToRemove || stored[k]?.domain === idToRemove) {
                keyToDelete = k;
                break;
              }
            }
          }
          if (keyToDelete) {
            const deletedIds = Array.isArray(res?.deletedCompletedIds) ? [...res.deletedCompletedIds] : [];
            if (!deletedIds.includes(keyToDelete)) deletedIds.push(keyToDelete);
            delete stored[keyToDelete];
            completed_urls = stored;
            chrome.storage.local.set({ completed_urls: stored, completedUrls: stored, deletedCompletedIds: deletedIds }, () => {
              if (supabaseClient && supabaseClient.isLoggedIn()) {
                supabaseClient.deleteCompletedUrl(keyToDelete).catch(() => {});
              }
              if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                chrome.tabs.query({}, (tabs) => {
                  (tabs || []).forEach(t => {
                    if (t.id) chrome.tabs.sendMessage(t.id, { type: 'completedUrlsUpdated', removedId: keyToDelete, completedUrls: stored }).catch(() => {});
                  });
                });
              }
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'completedUrlsUpdated', removedId: keyToDelete, completedUrls: stored }).catch(() => {});
              }
              sendResponse({ success: true, completedUrls: stored });
            });
          } else {
            sendResponse({ success: true, completedUrls: stored });
          }
        });
        return true;
      }

      case 'clearCompletedUrls': {
        completed_urls = {};
        chrome.storage.local.set({
          completed_urls: {},
          completedUrls: {},
          pendingClearCompletedUrls: true,
          deletedCompletedIds: []
        }, () => {
          if (supabaseClient && supabaseClient.isLoggedIn()) {
            supabaseClient.clearCompletedUrls().then((r) => {
              if (r?.success) chrome.storage.local.remove(['pendingClearCompletedUrls']);
            }).catch(() => {});
          }
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
            chrome.tabs.query({}, (tabs) => {
              (tabs || []).forEach(t => {
                if (t.id) chrome.tabs.sendMessage(t.id, { type: 'completedUrlsUpdated', cleared: true, completedUrls: {} }).catch(() => {});
              });
            });
          }
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'completedUrlsUpdated', cleared: true, completedUrls: {} }).catch(() => {});
          }
          sendResponse({ success: true });
        });
        return true;
      }

      case 'broadcastBrandChange': {
        const activeBrandId = message.activeBrandId || message.brandId;
        const brandData = message.brandData;
        if (activeBrandId) {
          chrome.storage.local.get(['brandProfiles', 'campaignProfiles', 'researchConfig'], (st) => {
            const brands = Array.isArray(st?.campaignProfiles) && st.campaignProfiles.length > 0
              ? st.campaignProfiles
              : (Array.isArray(st?.brandProfiles) ? st.brandProfiles : []);
            const mirroredRc = getMirroredResearchConfigFromBrands(brands, activeBrandId, st?.researchConfig || null);
            chrome.storage.local.set({
              activeBrandId,
              activeCampaignId: activeBrandId,
              researchConfig: mirroredRc
            });
          });
        }
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            (tabs || []).forEach(t => {
              if (t.id) {
                chrome.tabs.sendMessage(t.id, {
                  type: 'activeBrandChanged',
                  activeBrandId,
                  brandId: activeBrandId,
                  brandData
                }).catch(() => {});
              }
            });
          });
        }
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'activeBrandChanged',
            activeBrandId,
            brandId: activeBrandId,
            brandData
          }).catch(() => {});
        }
        sendResponse({ success: true });
        return true;
      }

      case 'updateBrandActiveCommentPool': {
        const targetBrandId = message.activeBrandId || message.brandId;
        const nextPool = String(message.activeCommentPool || 'all').trim() || 'all';
        chrome.storage.local.get(['campaignProfiles', 'brandProfiles', 'activeCampaignId', 'activeBrandId'], (st) => {
          const baseProfiles = Array.isArray(st?.campaignProfiles) && st.campaignProfiles.length > 0
            ? st.campaignProfiles
            : (Array.isArray(st?.brandProfiles) ? st.brandProfiles : []);
          const resolvedId = targetBrandId || st?.activeCampaignId || st?.activeBrandId || baseProfiles[0]?.brandId || baseProfiles[0]?.campaignId;
          const nowIso = new Date().toISOString();
          let updatedBrand = null;

          const updatedProfiles = baseProfiles.map((b) => {
            if (!b || typeof b !== 'object') return b;
            const id = b.brandId || b.campaignId;
            if (resolvedId && id !== resolvedId) return b;
            const cloned = { ...b, activeCommentPool: nextPool, updatedAt: nowIso };
            delete cloned.isUntouchedDefault;
            updatedBrand = cloned;
            return cloned;
          });

          chrome.storage.local.set({
            campaignProfiles: updatedProfiles,
            brandProfiles: updatedProfiles
          }, () => {
            try {
              scheduleVaultBackup();
            } catch (_) {}
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
              chrome.tabs.query({}, (tabs) => {
                (tabs || []).forEach((t) => {
                  if (t.id) {
                    chrome.tabs.sendMessage(t.id, {
                      type: 'activeBrandChanged',
                      activeBrandId: resolvedId,
                      brandId: resolvedId,
                      brandData: updatedBrand
                    }).catch(() => {});
                  }
                });
              });
            }
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                type: 'activeBrandChanged',
                activeBrandId: resolvedId,
                brandId: resolvedId,
                brandData: updatedBrand
              }).catch(() => {});
            }
            sendResponse({ success: true, activeCommentPool: nextPool, brandData: updatedBrand });
          });
        });
        return true;
      }

      case 'getAuthConfig': {
        ensurePortalAndSupabaseConfig(Boolean(message.forceRefresh))
          .then((cfg) => sendResponse({ success: true, ...cfg }))
          .catch((err) => sendResponse({
            success: false,
            error: err?.message || 'Failed to resolve auth config',
            supabaseUrl: supabaseConfig.url || '',
            anonKey: supabaseConfig.anonKey || '',
            appBaseUrl: appBaseUrl || 'http://localhost:3000'
          }));
        return true;
      }

      case 'INITIATE_GOOGLE_LOGIN': {
        (async () => {
          try {
            let cfg = await ensurePortalAndSupabaseConfig(false, message.preferredOrigin || '');
            if (!cfg.supabaseUrl || !cfg.anonKey) {
              cfg = await ensurePortalAndSupabaseConfig(true, message.preferredOrigin || '');
            }
            const base = (cfg.appBaseUrl || 'https://smartposter.pro').replace(/\/+$/, '');
            let authUrl = '';
            let notice = '';

            if (cfg.supabaseUrl) {
              authUrl = `${cfg.supabaseUrl.replace(/\/+$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${base}/auth/callback.html`)}&scopes=email%20profile`;
            } else {
              authUrl = `${base}/login.html`;
              notice = 'Supabase credentials not configured in environment. Opening web login portal.';
            }

            const width = 500;
            const height = 620;
            let left = 200;
            let top = 120;

            if (message.windowMetrics && typeof message.windowMetrics.outerWidth === 'number') {
              const m = message.windowMetrics;
              left = Math.max(0, Math.round((m.screenLeft || 0) + (m.outerWidth - width) / 2));
              top = Math.max(0, Math.round((m.screenTop || 0) + ((m.outerHeight || 800) - height) / 2));
            } else if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.getLastFocused) {
              try {
                const win = await chrome.windows.getLastFocused();
                if (win && typeof win.left === 'number' && typeof win.width === 'number') {
                  left = Math.max(0, Math.round(win.left + (win.width - width) / 2));
                  top = Math.max(0, Math.round((win.top || 0) + ((win.height || 800) - height) / 2));
                }
              } catch (_) {}
            }

            // Monitor created login popup tab directly so OAuth succeeds even if redirect lands on / or /auth/callback.html
            const attachPopupOAuthWatcher = (watchWindowId, watchTabId) => {
              if (!chrome?.tabs?.onUpdated) return;
              let completed = false;
              const cleanup = () => {
                try { chrome.tabs.onUpdated.removeListener(onTabUpdated); } catch (_) {}
                try { if (timeoutTimer) clearTimeout(timeoutTimer); } catch (_) {}
              };
              const timeoutTimer = setTimeout(cleanup, 180000);

              const onTabUpdated = async (tabId, changeInfo, tab) => {
                if (completed) return;
                const matchesTab = (watchTabId && tabId === watchTabId) || (watchWindowId && tab?.windowId === watchWindowId);
                if (!matchesTab) return;
                const currentUrl = changeInfo.url || tab?.url || '';
                if (!currentUrl || (!currentUrl.includes('access_token=') && !currentUrl.includes('refresh_token='))) return;

                try {
                  const parsed = new URL(currentUrl);
                  const hashParams = new URLSearchParams((parsed.hash || '').replace(/^#/, ''));
                  const queryParams = parsed.searchParams;
                  const accessToken = hashParams.get('access_token') || queryParams.get('access_token') || '';
                  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token') || '';
                  if (!accessToken) return;

                  completed = true;
                  cleanup();

                  const portalOrigin = parsed.origin.startsWith('http') ? parsed.origin : base;
                  let authUser = null;
                  if (cfg.supabaseUrl && cfg.anonKey) {
                    const uRes = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
                      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${accessToken}` }
                    }).catch(() => null);
                    if (uRes && uRes.ok) authUser = await uRes.json().catch(() => null);
                  }

                  let entData = null;
                  const entRes = await fetch(`${portalOrigin}/api/auth/entitlement`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  }).catch(() => null);
                  if (entRes && entRes.ok) {
                    const ej = await entRes.json().catch(() => null);
                    if (ej && ej.success) entData = ej;
                  }

                  const userId = entData?.userId || authUser?.id || '';
                  const email = String(entData?.email || authUser?.email || '').toLowerCase();
                  if (!userId || !email) return;

                  const sessionObj = normalizeAuthSession({
                    user: {
                      id: userId,
                      email,
                      fullName: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || email.split('@')[0],
                      avatarUrl: authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || '',
                      role: entData?.role || 'user',
                      tier: entData?.tier || 'basic'
                    },
                    accessToken,
                    refreshToken: refreshToken || null,
                    entitlement: entData?.entitlement || null,
                    portalOrigin
                  });

                  if (sessionObj) {
                    appBaseUrl = portalOrigin;
                    await new Promise((r) => chrome.storage.local.remove(['sp_explicit_signout_at'], r));
                    const saveObj = {
                      cf_auth_session: sessionObj,
                      authUserSession: sessionObj,
                      app_base_url: portalOrigin,
                      ...(sessionObj.entitlement ? { sp_entitlement_claim: sessionObj.entitlement } : {})
                    };
                    await new Promise((r) => chrome.storage.local.set(saveObj, r));
                    if (supabaseClient) supabaseClient.setSession(sessionObj);
                    const finalSession = await refreshStoredUserProfile(sessionObj).catch(() => sessionObj);
                    if (finalSession) {
                      syncSupabaseData('two-way').catch(() => {});
                      bootstrapWorkspaceModules(finalSession, true).catch(() => null);
                      broadcastAuthSessionUpdated(finalSession, finalSession?.entitlement || null);
                    }
                  }

                  setTimeout(() => {
                    try {
                      if (watchWindowId && chrome.windows?.remove) {
                        chrome.windows.remove(watchWindowId).catch(() => {});
                      } else if (tabId && chrome.tabs?.remove) {
                        chrome.tabs.remove(tabId).catch(() => {});
                      }
                    } catch (_) {}
                  }, 450);
                } catch (_) {}
              };

              chrome.tabs.onUpdated.addListener(onTabUpdated);
            };

            let opened = false;
            if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
              try {
                const win = await chrome.windows.create({
                  url: authUrl,
                  type: 'popup',
                  width,
                  height,
                  left,
                  top,
                  focused: true
                });
                opened = true;
                attachPopupOAuthWatcher(win?.id, win?.tabs?.[0]?.id);
              } catch (winErr) {
                console.warn('[background.js] chrome.windows.create failed, falling back to chrome.tabs.create:', winErr);
              }
            }

            if (!opened && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              const tab = await chrome.tabs.create({ url: authUrl });
              opened = true;
              attachPopupOAuthWatcher(tab?.windowId, tab?.id);
            }

            sendResponse({ success: true, authUrl, notice, opened });
          } catch (err) {
            console.error('[background.js] Error initiating login window:', err);
            sendResponse({ success: false, error: err?.message || 'Could not open sign-in window' });
          }
        })();
        return true;
      }

      case 'refreshAuthProfile': {
        refreshStoredUserProfile(null)
          .then((session) => sendResponse({ success: true, session, loggedOut: !session }))
          .catch((err) => sendResponse({ success: false, error: err?.message || 'Failed to refresh profile' }));
        return true;
      }

      case 'AUTH_SUCCESS':
      case 'SAVE_AUTH_SESSION':
      case 'saveAuthSession': {
        const rawSession = message.session || (message.user ? {
          user: message.user,
          accessToken: message.token || message.accessToken,
          refreshToken: message.refreshToken || null,
          entitlement: message.entitlement || null,
          portalOrigin: message.portalOrigin
        } : null);
        if (rawSession && message.entitlement && !rawSession.entitlement) {
          rawSession.entitlement = message.entitlement;
        }
        const session = normalizeAuthSession(rawSession);

        if (session) {
          if (session.portalOrigin && (session.portalOrigin.startsWith('http://') || session.portalOrigin.startsWith('https://'))) {
            appBaseUrl = session.portalOrigin.replace(/\/+$/, '');
          }
          const saveObj = {
            cf_auth_session: session,
            authUserSession: session,
            app_base_url: appBaseUrl
          };
          if (session.entitlement) {
            saveObj.sp_entitlement_claim = session.entitlement;
          }
          chrome.storage.local.remove(['sp_explicit_signout_at'], () => {
            chrome.storage.local.set(saveObj, async () => {
              logger.log('[Auth] Saved session for:', session.user?.email);
              let finalSession = session;
              try {
                await ensurePortalAndSupabaseConfig();
                if (supabaseClient) {
                  supabaseClient.setSession(session);
                  supabaseSyncStatus.status = 'synced';
                  supabaseSyncStatus.message = `Signed in as ${session.user?.email}`;
                }
                finalSession = await refreshStoredUserProfile(session).catch(() => session);
                if (finalSession) {
                  syncSupabaseData('two-way').catch(() => {});
                  await bootstrapWorkspaceModules(finalSession, true).catch(() => null);
                }
              } catch (_) {}
              broadcastAuthSessionUpdated(finalSession || null, finalSession?.entitlement || null);
              sendResponse({
                success: Boolean(finalSession),
                loggedOut: !finalSession,
                session: finalSession || null,
                entitlement: finalSession?.entitlement || null
              });
            });
          });
        } else {
          sendResponse({ success: false, error: 'Invalid session payload' });
        }
        return true;
      }

      case 'SYNC_WORKSPACE_MODULES': {
        (async () => {
          try {
            const latestSession = await refreshStoredUserProfile(null).catch(() => null);
            if (!latestSession) {
              sendResponse({
                success: false,
                status: 401,
                loggedOut: true,
                session: null,
                entitlement: null,
                error: 'Session expired. Please sign in again.'
              });
              return;
            }
            const result = await bootstrapWorkspaceModules(latestSession, message.force !== false);
            const postSession = result?.loggedOut ? null : latestSession;
            sendResponse({
              ...result,
              session: postSession,
              entitlement: postSession?.entitlement || null
            });
          } catch (err) {
            sendResponse({ success: false, error: err?.message || 'Workspace sync failed' });
          }
        })();
        return true;
      }

      case 'GET_WORKSPACE_BOOTSTRAP_STATUS': {
        chrome.storage.local.get(
          ['sp_workspace_bootstrap', 'sp_selector_recipes', 'sp_prompt_recipes', 'directory_lists_catalog'],
          (res) => {
            sendResponse({
              success: true,
              bootstrap: res?.sp_workspace_bootstrap || null,
              selectorRecipes: res?.sp_selector_recipes || null,
              promptRecipes: res?.sp_prompt_recipes || [],
              directoryLists: res?.directory_lists_catalog || null
            });
          }
        );
        return true;
      }

      case 'OPEN_DASHBOARD_TAB': {
        (async () => {
          try {
            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
            const hash = message.hash ? `#${String(message.hash).replace(/^#/, '')}` : '';
            const targetUrl = `${base}/dashboard${hash}`;
            const tabs = await chrome.tabs.query({});
            const existing = tabs.find((t) => t.url && t.url.startsWith(`${base}/dashboard`));
            if (existing && existing.id) {
              await chrome.tabs.update(existing.id, { active: true, url: hash ? targetUrl : existing.url });
              if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
            } else {
              await chrome.tabs.create({ url: targetUrl, index: 0, active: true });
            }
            sendResponse({ success: true, url: targetUrl });
          } catch (err) {
            sendResponse({ success: false, error: err?.message || 'Failed to open dashboard' });
          }
        })();
        return true;
      }

      case 'GET_EXTENSION_BRIDGE_STATE': {
        (async () => {
          try {
            const localData = await new Promise((r) => chrome.storage.local.get(null, r));
            const syncData = await new Promise((r) => chrome.storage.sync.get(null, r));
            let brandProfiles = Array.isArray(localData.campaignProfiles) && localData.campaignProfiles.length > 0
              ? localData.campaignProfiles
              : (Array.isArray(localData.brandProfiles) ? localData.brandProfiles : []);
            const activeBrandId = localData.activeCampaignId || localData.activeBrandId || brandProfiles[0]?.brandId || '';
            if (brandProfiles.length > 0 && localData.researchConfig && typeof localData.researchConfig === 'object') {
              const mig = migrateLegacyResearchConfigToBrands(brandProfiles, activeBrandId, localData.researchConfig);
              if (mig.changed) brandProfiles = mig.brands;
            }
            const mirroredResearchConfig = brandProfiles.length > 0
              ? getMirroredResearchConfigFromBrands(brandProfiles, activeBrandId, localData.researchConfig || null)
              : (localData.researchConfig || null);
            const reportsByBrand = {};
            Object.keys(localData).forEach((k) => {
              if (k.startsWith('brandReports_')) reportsByBrand[k] = localData[k];
            });
            const mergedSettings = {
              ...(syncData.settings || {}),
              ...(localData.settings || {})
            };
            const completedMap = localData.completed_urls || localData.completedUrls || completed_urls || {};
            const customModels = Array.isArray(localData.customModels)
              ? localData.customModels
              : (Array.isArray(mergedSettings.customModels) ? mergedSettings.customModels : []);
            const suppression = Array.isArray(syncData.suppressionList)
              ? syncData.suppressionList
              : (Array.isArray(localData.suppressionList) ? localData.suppressionList : (suppressionList || []));

            sendResponse({
              success: true,
              state: {
                brandProfiles,
                activeBrandId,
                researchConfig: mirroredResearchConfig,
                directoryPrefs: localData.directoryPrefs || { bookmarkedIds: [], customDirectories: [] },
                settings: {
                  ...mergedSettings,
                  customModels,
                  jevEnabled: localData.jevEnabled !== undefined ? Boolean(localData.jevEnabled) : Boolean(mergedSettings.jevEnabled),
                  jevModel: localData.jevModel || mergedSettings.jevModel || 'typesafe/jev-1.14',
                  captchaApiKey: localData.captchaApiKey !== undefined ? localData.captchaApiKey : (mergedSettings.captchaApiKey || ''),
                  safetyDelay: Number(localData.safetyDelay ?? mergedSettings.safetyDelay ?? 3),
                  randomnessLevel: Number(localData.randomnessLevel ?? 3),
                  randomnessSynonyms: localData.randomnessSynonyms !== undefined ? localData.randomnessSynonyms !== false : true,
                  randomnessDicts: localData.randomnessDicts !== undefined ? localData.randomnessDicts : '',
                  companionWidgetEnabled: localData.floatingWidgetEnabled !== undefined
                    ? localData.floatingWidgetEnabled !== false
                    : (localData.companionWidgetEnabled !== false),
                  companionShortcutsEnabled: localData.companionShortcutsEnabled !== false,
                  aiContextMatching: localData.aiContextMatching !== false,
                  simulateKeystrokes: Boolean(localData.tb_simulate_keystrokes),
                  autoVariation: Boolean(localData.tb_auto_variation),
                  autoSuppress: syncData.autoSuppress !== undefined
                    ? syncData.autoSuppress !== false
                    : (localData.autoSuppress !== undefined ? localData.autoSuppress !== false : autoSuppress !== false),
                },
                apiKey: syncData.apiKey !== undefined ? syncData.apiKey : (localData.apiKey || ''),
                geminiApiKey: syncData.geminiApiKey !== undefined ? syncData.geminiApiKey : (localData.geminiApiKey || ''),
                aiModel: localData.aiModel || syncData.aiModel || mergedSettings.aiModel || 'deepseek/deepseek-chat',
                masterLogs: localData.traffic_builder_master_logs || traffic_builder_master_logs || [],
                errorLogs: localData.tb_error_logs || [],
                suppressionList: suppression,
                completedUrls: completedMap,
                deletedBrandTombstones: localData.deletedBrandTombstones || {},
                savedUrlSets: localData.savedUrlSets || [],
                templates: localData.templates || syncData.templates || null,
                customData: localData.customData || null,
                defaultHome: localData.defaultHome || syncData.defaultHome || '',
                navOrder: localData.navOrder || syncData.navOrder || null,
                ruleTwitterStripProtocol: localData.ruleTwitterStripProtocol !== false,
                reportsByBrand,
                authSession: localData.authUserSession || localData.cf_auth_session || null,
                entitlementClaim: localData.sp_entitlement_claim || null
              }
            });
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'SAVE_EXTENSION_BRIDGE_STATE': {
        (async () => {
          try {
            const p = message.payload || {};
            const localUpdates = {};
            const syncUpdates = {};
            const nowIso = new Date().toISOString();
            const existingState = await new Promise((r) => chrome.storage.local.get([
              'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig', 'deletedBrandTombstones'
            ], (d) => r(d || {})));
            const existingBrands = Array.isArray(existingState.campaignProfiles) && existingState.campaignProfiles.length > 0
              ? existingState.campaignProfiles
              : (Array.isArray(existingState.brandProfiles) ? existingState.brandProfiles : []);
            const existingBrandMap = new Map(existingBrands.map((b) => [b?.brandId || b?.campaignId, b]));
            let nextBrands = existingBrands;
            let nextActiveId = p.activeBrandId || existingState.activeCampaignId || existingState.activeBrandId || existingBrands[0]?.brandId || '';

            const mergedTombstones = { ...(existingState.deletedBrandTombstones || {}) };
            if (Array.isArray(p.deletedBrandIds) && p.deletedBrandIds.length > 0) {
              p.deletedBrandIds.forEach((delId) => {
                if (delId) mergedTombstones[delId] = nowIso;
              });
              localUpdates.deletedBrandTombstones = mergedTombstones;
            }

            if (Array.isArray(p.brandProfiles)) {
              const mergedMap = new Map();
              if (!p.replaceAllBrands) {
                existingBrands.forEach((eb) => {
                  const id = eb?.brandId || eb?.campaignId;
                  if (!id) return;
                  const tombMs = mergedTombstones[id] ? toBgMsTimestamp(mergedTombstones[id]) : 0;
                  if (tombMs > 0 && tombMs >= toBgMsTimestamp(eb.updatedAt)) return;
                  mergedMap.set(id, eb);
                });
              }

              const stampedBrands = p.brandProfiles.map((b) => {
                const id = b?.brandId || b?.campaignId;
                const prevBrand = id ? (mergedMap.get(id) || existingBrandMap.get(id)) : null;
                if (isUntouchedDefaultBrand(b) && (!prevBrand || isUntouchedDefaultBrand(prevBrand))) {
                  const mergedResearch = b?.researchConfig
                    ? (prevBrand?.researchConfig ? mergeResearchConfig(prevBrand.researchConfig, b.researchConfig) : createDefaultResearchConfig(b.researchConfig))
                    : (prevBrand?.researchConfig ? createDefaultResearchConfig(prevBrand.researchConfig) : createDefaultResearchConfig());
                  return { ...b, researchConfig: mergedResearch, isUntouchedDefault: true };
                }
                const mergedRec = prevBrand ? mergeBrandRecords(prevBrand, b) : { ...b };
                delete mergedRec.isUntouchedDefault;
                mergedRec.updatedAt = mergedRec.updatedAt || nowIso;
                return mergedRec;
              });

              stampedBrands.forEach((sb) => {
                const id = sb?.brandId || sb?.campaignId;
                if (!id) return;
                const tombMs = mergedTombstones[id] ? toBgMsTimestamp(mergedTombstones[id]) : 0;
                if (tombMs > 0 && tombMs >= toBgMsTimestamp(sb.updatedAt)) return;
                mergedMap.set(id, sb);
              });

              const incomingHasReal = stampedBrands.some((b) => b && !isUntouchedDefaultBrand(b));
              const mergedList = Array.from(mergedMap.values()).filter((b, _, arr) => {
                if (arr.length > 1 && isUntouchedDefaultBrand(b) && incomingHasReal && !stampedBrands.some((sb) => (sb?.brandId || sb?.campaignId) === (b?.brandId || b?.campaignId))) {
                  return true;
                }
                return true;
              });

              nextBrands = mergedList;
              localUpdates.brandProfiles = mergedList;
              localUpdates.campaignProfiles = mergedList;
            }
            if (p.activeBrandId) {
              localUpdates.activeBrandId = p.activeBrandId;
              localUpdates.activeCampaignId = p.activeBrandId;
              nextActiveId = p.activeBrandId;
            }
            if (p.researchConfig !== undefined && p.researchConfig && typeof p.researchConfig === 'object') {
              const targetId = p.researchConfig.campaignId || p.researchConfig._campaignId || nextActiveId;
              if (nextBrands.length > 0 && targetId) {
                nextBrands = nextBrands.map((b) => {
                  const bid = b?.brandId || b?.campaignId;
                  if (bid !== targetId) return b;
                  const mergedRc = mergeResearchConfig(b.researchConfig, p.researchConfig);
                  const updatedBrand = { ...b, researchConfig: mergedRc, updatedAt: mergedRc.updatedAt || b.updatedAt || nowIso };
                  delete updatedBrand.isUntouchedDefault;
                  return updatedBrand;
                });
                localUpdates.brandProfiles = nextBrands;
                localUpdates.campaignProfiles = nextBrands;
              }
              localUpdates.researchConfig = getMirroredResearchConfigFromBrands(nextBrands, nextActiveId, p.researchConfig);
              localUpdates.workspacePrefsUpdatedAt = nowIso;
            } else if (p.activeBrandId || Array.isArray(p.brandProfiles)) {
              localUpdates.researchConfig = getMirroredResearchConfigFromBrands(nextBrands, nextActiveId, existingState.researchConfig || null);
            }
            if (p.directoryPrefs !== undefined) {
              localUpdates.directoryPrefs = p.directoryPrefs;
              localUpdates.workspacePrefsUpdatedAt = nowIso;
            }
            let touchedSettings = false;
            if (p.settings !== undefined && p.settings && typeof p.settings === 'object') {
              const s = p.settings;
              settings = { ...settings, ...s, updatedAt: s.updatedAt || nowIso };
              syncUpdates.settings = settings;
              localUpdates.settings = settings;
              touchedSettings = true;

              if (Array.isArray(s.customModels)) {
                localUpdates.customModels = s.customModels;
              }
              if (s.jevEnabled !== undefined) {
                localUpdates.jevEnabled = Boolean(s.jevEnabled);
              }
              if (s.jevModel !== undefined) {
                localUpdates.jevModel = String(s.jevModel || 'typesafe/jev-1.14');
              }
              if (s.captchaApiKey !== undefined) {
                localUpdates.captchaApiKey = String(s.captchaApiKey || '');
              }
              if (s.safetyDelay !== undefined) {
                localUpdates.safetyDelay = Number(s.safetyDelay) || 3;
              }
              if (s.randomnessLevel !== undefined) {
                const engine = typeof globalThis !== 'undefined' ? globalThis.SmartPosterVariationEngine : null;
                const alreadyMigrated = Boolean(s.sp_randomness_v2_migrated);
                localUpdates.randomnessLevel = engine
                  ? engine.migrateLegacyRandomnessLevel(s.randomnessLevel, alreadyMigrated)
                  : (Number(s.randomnessLevel) || 3);
              }
              if (s.randomnessSynonyms !== undefined) {
                localUpdates.randomnessSynonyms = Boolean(s.randomnessSynonyms);
              }
              if (s.randomnessDicts !== undefined) {
                localUpdates.randomnessDicts = String(s.randomnessDicts || '');
              }
              if (s.companionWidgetEnabled !== undefined) {
                const enabled = Boolean(s.companionWidgetEnabled);
                localUpdates.floatingWidgetEnabled = enabled;
                localUpdates.companionWidgetEnabled = enabled;
                syncUpdates.floatingWidgetEnabled = enabled;
                syncUpdates.companionWidgetEnabled = enabled;
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                  chrome.tabs.query({}, (tabs) => {
                    (tabs || []).forEach((t) => {
                      if (t.id) {
                        chrome.tabs.sendMessage(t.id, { type: 'setFloatingWidgetEnabled', enabled }).catch(() => {});
                        chrome.tabs.sendMessage(t.id, { type: 'updateCompanionSettings', settings: { floatingWidgetEnabled: enabled, companionWidgetEnabled: enabled } }).catch(() => {});
                      }
                    });
                  });
                }
                chrome.runtime.sendMessage({ type: 'floatingWidgetStateChanged', enabled }).catch(() => {});
              }
              if (s.companionShortcutsEnabled !== undefined) {
                const shortcutsEnabled = Boolean(s.companionShortcutsEnabled);
                localUpdates.companionShortcutsEnabled = shortcutsEnabled;
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                  chrome.tabs.query({}, (tabs) => {
                    (tabs || []).forEach((t) => {
                      if (t.id) chrome.tabs.sendMessage(t.id, { type: 'updateCompanionSettings', shortcutsEnabled }).catch(() => {});
                    });
                  });
                }
              }
              if (s.aiContextMatching !== undefined) {
                const aiContextMatching = Boolean(s.aiContextMatching);
                localUpdates.aiContextMatching = aiContextMatching;
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                  chrome.tabs.query({}, (tabs) => {
                    (tabs || []).forEach((t) => {
                      if (t.id) chrome.tabs.sendMessage(t.id, { type: 'updateSettings', settings: { aiContextMatching } }).catch(() => {});
                    });
                  });
                }
              }
              if (s.simulateKeystrokes !== undefined) {
                localUpdates.tb_simulate_keystrokes = Boolean(s.simulateKeystrokes);
              }
              if (s.autoVariation !== undefined) {
                localUpdates.tb_auto_variation = Boolean(s.autoVariation);
              }
              if (s.autoSuppress !== undefined) {
                autoSuppress = Boolean(s.autoSuppress);
                syncUpdates.autoSuppress = autoSuppress;
                localUpdates.autoSuppress = autoSuppress;
              }
            }
            if (p.apiKey !== undefined) {
              apiKey = p.apiKey;
              syncUpdates.apiKey = p.apiKey;
              localUpdates.apiKey = p.apiKey;
              touchedSettings = true;
            }
            if (p.geminiApiKey !== undefined) {
              geminiApiKey = p.geminiApiKey;
              syncUpdates.geminiApiKey = p.geminiApiKey;
              localUpdates.geminiApiKey = p.geminiApiKey;
              touchedSettings = true;
            }
            if (p.aiModel !== undefined) {
              localUpdates.aiModel = p.aiModel;
              syncUpdates.aiModel = p.aiModel;
              touchedSettings = true;
            }
            if (Array.isArray(p.suppressionList)) {
              suppressionList = p.suppressionList;
              syncUpdates.suppressionList = p.suppressionList;
              localUpdates.suppressionList = p.suppressionList;
              touchedSettings = true;
            }
            if (p.ruleTwitterStripProtocol !== undefined) {
              localUpdates.ruleTwitterStripProtocol = Boolean(p.ruleTwitterStripProtocol);
              touchedSettings = true;
            }
            if (touchedSettings && !localUpdates.settings) {
              settings = { ...settings, updatedAt: nowIso };
              localUpdates.settings = settings;
              syncUpdates.settings = settings;
            }
            if (p.completedUrls !== undefined && p.completedUrls !== null && typeof p.completedUrls === 'object') {
              const prevCompleted = completed_urls || {};
              const removedKeys = Object.keys(prevCompleted).filter((k) => !p.completedUrls[k]);
              if (Object.keys(p.completedUrls).length === 0 && Object.keys(prevCompleted).length > 0) {
                localUpdates.pendingClearCompletedUrls = true;
              } else if (removedKeys.length > 0) {
                const existingDel = await new Promise((r) => chrome.storage.local.get(['deletedCompletedIds'], (d) => r(d?.deletedCompletedIds || [])));
                localUpdates.deletedCompletedIds = Array.from(new Set([...existingDel, ...removedKeys]));
              }
              completed_urls = p.completedUrls;
              localUpdates.completed_urls = p.completedUrls;
              localUpdates.completedUrls = p.completedUrls;
              if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                chrome.tabs.query({}, (tabs) => {
                  (tabs || []).forEach((t) => {
                    if (t.id) chrome.tabs.sendMessage(t.id, { type: 'completedUrlsUpdated', completedUrls: p.completedUrls }).catch(() => {});
                  });
                });
              }
              chrome.runtime.sendMessage({ type: 'completedUrlsUpdated', completedUrls: p.completedUrls }).catch(() => {});
            }
            if (Array.isArray(p.masterLogs)) {
              if (p.masterLogs.length === 0 && traffic_builder_master_logs.length > 0) {
                localUpdates.pendingClearCampaignLogs = true;
              }
              traffic_builder_master_logs = p.masterLogs;
              localUpdates.traffic_builder_master_logs = p.masterLogs;
            }
            if (Array.isArray(p.errorLogs)) {
              if (p.errorLogs.length === 0) {
                localUpdates.pendingClearCampaignLogs = true;
                localUpdates.pendingClearCampaignLogsStatus = 'error';
              }
              localUpdates.tb_error_logs = p.errorLogs;
            }
            if (p.savedUrlSets !== undefined && Array.isArray(p.savedUrlSets)) {
              localUpdates.savedUrlSets = p.savedUrlSets;
            }
            if (p.templates !== undefined && p.templates && typeof p.templates === 'object') {
              localUpdates.templates = p.templates;
              syncUpdates.templates = p.templates;
            }
            if (p.customData !== undefined && p.customData && typeof p.customData === 'object') {
              customData = p.customData;
              localUpdates.customData = p.customData;
            }
            if (p.defaultHome) {
              localUpdates.defaultHome = p.defaultHome;
              syncUpdates.defaultHome = p.defaultHome;
            }
            if (Array.isArray(p.navOrder)) {
              localUpdates.navOrder = p.navOrder;
              syncUpdates.navOrder = p.navOrder;
            }
            if (p.clearAuthSession === true) {
              await invalidateAuthSession(p.reason || 'bridge_clear', p.failedToken || '');
            } else if (p.authSession && typeof p.authSession === 'object') {
              const normBridgeSes = normalizeAuthSession(p.authSession);
              if (normBridgeSes) {
                const bridgeCheck = await new Promise((r) => chrome.storage.local.get(
                  ['authUserSession', 'cf_auth_session', 'sp_invalidated_token_fps', 'sp_explicit_signout_at'],
                  (d) => r(d || {})
                ));
                const invalidatedFps = new Set(Array.isArray(bridgeCheck.sp_invalidated_token_fps) ? bridgeCheck.sp_invalidated_token_fps : []);
                const accessFp = getTokenFingerprintBg(normBridgeSes.accessToken);
                const refreshFp = getTokenFingerprintBg(normBridgeSes.refreshToken);
                const isBlacklisted = (accessFp && invalidatedFps.has(accessFp)) || (refreshFp && invalidatedFps.has(refreshFp));
                const isDeadExpired = isJwtExpiredBg(normBridgeSes.accessToken, 0) && !normBridgeSes.refreshToken;
                const currentSes = normalizeAuthSession(bridgeCheck.authUserSession || bridgeCheck.cf_auth_session);
                const incomingTs = getAuthSessionTimestampBg(normBridgeSes);
                const currentTs = getAuthSessionTimestampBg(currentSes);
                const signoutAt = Number(bridgeCheck.sp_explicit_signout_at || 0);
                const isNewerThanCurrent = !currentSes || incomingTs >= currentTs || (isJwtExpiredBg(currentSes.accessToken, 30) && !isJwtExpiredBg(normBridgeSes.accessToken, 30));
                const isAfterSignout = !signoutAt || incomingTs > signoutAt;

                if (!isBlacklisted && !isDeadExpired && isNewerThanCurrent && isAfterSignout) {
                  localUpdates.authUserSession = normBridgeSes;
                  localUpdates.cf_auth_session = normBridgeSes;
                  if (supabaseClient) supabaseClient.setSession(normBridgeSes);
                  await new Promise((r) => chrome.storage.local.remove(['sp_explicit_signout_at'], r));
                }
              }
            }
            if (p.entitlementClaim && isValidEntitlementClaimStructure(p.entitlementClaim)) {
              const existingStored = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], r));
              const activeSes = normalizeAuthSession(localUpdates.authUserSession || existingStored?.authUserSession || existingStored?.cf_auth_session);
              if (activeSes && (!p.entitlementClaim.userId || p.entitlementClaim.userId === activeSes.user?.id)) {
                localUpdates.sp_entitlement_claim = p.entitlementClaim;
                const nextRole = (String(p.entitlementClaim.role || activeSes.user?.role || 'user').toLowerCase() === 'admin' || BG_ADMIN_EMAILS.includes(String(activeSes.user?.email || '').toLowerCase())) ? 'admin' : 'user';
                const nextTier = normalizeTierClaimValue(p.entitlementClaim.tier, nextRole, activeSes.user?.email);
                const mergedSes = normalizeAuthSession({
                  ...activeSes,
                  entitlement: p.entitlementClaim,
                  user: { ...activeSes.user, role: nextRole, tier: nextTier },
                  updatedAt: nowIso
                });
                if (mergedSes) {
                  localUpdates.authUserSession = mergedSes;
                  localUpdates.cf_auth_session = mergedSes;
                }
              }
            }
            if (Object.keys(localUpdates).length > 0) {
              localUpdates.sp_vault_hydrated = true;
              localUpdates.sp_vault_updated_at = nowIso;
              await new Promise((r) => chrome.storage.local.set(localUpdates, r));
            }
            if (localUpdates.authUserSession) {
              broadcastAuthSessionUpdated(localUpdates.authUserSession, localUpdates.sp_entitlement_claim || localUpdates.authUserSession.entitlement || null);
            }
            if (Object.keys(syncUpdates).length > 0) {
              await new Promise((r) => chrome.storage.sync.set(syncUpdates, r));
            }
            sendResponse({ success: true });
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'GET_GOOGLE_ALERTS_CONTEXT': {
        (async () => {
          try {
            const res = await new Promise((r) => chrome.storage.local.get([
              'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig', 'pendingGoogleAlertSetup'
            ], r));
            let brands = Array.isArray(res?.campaignProfiles) && res.campaignProfiles.length > 0
              ? [...res.campaignProfiles]
              : (Array.isArray(res?.brandProfiles) ? [...res.brandProfiles] : []);
            const activeId = res?.activeCampaignId || res?.activeBrandId || brands[0]?.brandId || '';
            if (brands.length > 0 && res?.researchConfig && typeof res.researchConfig === 'object') {
              const mig = migrateLegacyResearchConfigToBrands(brands, activeId, res.researchConfig);
              if (mig.changed) {
                brands = mig.brands;
                await new Promise((r) => chrome.storage.local.set({ brandProfiles: brands, campaignProfiles: brands }, r));
              }
            }
            const campaigns = brands.map((b) => {
              const id = b?.brandId || b?.campaignId || '';
              const rc = createDefaultResearchConfig(b?.researchConfig || {});
              return {
                id,
                name: b?.campaignName || b?.brandName || 'Untitled Campaign',
                feedUrls: (rc.alertFeeds || []).map((f) => String(f?.url || '').trim()).filter(Boolean),
                feedsCount: (rc.alertFeeds || []).length,
                keywordsCount: (rc.keywords || []).length,
                competitorsCount: (rc.competitors || []).length
              };
            }).filter((c) => c.id);

            let pendingSetup = null;
            if (res?.pendingGoogleAlertSetup && (Date.now() - Number(res.pendingGoogleAlertSetup.createdAt || 0) < 600000)) {
              pendingSetup = res.pendingGoogleAlertSetup;
            } else if (res?.pendingGoogleAlertSetup) {
              chrome.storage.local.remove(['pendingGoogleAlertSetup']);
            }
            sendResponse({ success: true, campaigns, activeCampaignId: activeId, pendingSetup });
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'LAUNCH_GOOGLE_ALERT_SETUP': {
        (async () => {
          try {
            const p = message.payload || message || {};
            const rawQueries = Array.isArray(p.queries) ? p.queries : (p.query ? [p.query] : []);
            const seenQ = new Set();
            const queries = [];
            rawQueries.forEach((q) => {
              const clean = String(q || '').trim();
              if (!clean) return;
              const k = clean.toLowerCase();
              if (seenQ.has(k)) return;
              seenQ.add(k);
              queries.push(clean);
            });
            const campaignId = String(p.campaignId || message.campaignId || '').trim();
            const frequency = p.frequency || 'daily';
            const quality = p.quality || 'all';
            await new Promise((r) => chrome.storage.local.set({
              pendingGoogleAlertSetup: {
                query: queries[0] || '',
                queries,
                currentIndex: 0,
                totalCount: queries.length,
                campaignId,
                frequency,
                quality,
                createdAt: Date.now()
              }
            }, r));
            await chrome.tabs.create({ url: 'https://www.google.com/alerts', active: true });
            sendResponse({ success: true, totalCount: queries.length });
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'UPDATE_GOOGLE_ALERT_BATCH': {
        (async () => {
          try {
            const res = await new Promise((r) => chrome.storage.local.get(['pendingGoogleAlertSetup'], r));
            const cur = res?.pendingGoogleAlertSetup;
            if (!cur || !Array.isArray(cur.queries) || cur.queries.length === 0) {
              return sendResponse({ success: true, pendingSetup: null });
            }
            const nextIdx = Number.isFinite(message.currentIndex) ? message.currentIndex : (Number(cur.currentIndex || 0) + 1);
            if (nextIdx >= cur.queries.length) {
              await new Promise((r) => chrome.storage.local.remove(['pendingGoogleAlertSetup'], r));
              return sendResponse({ success: true, completed: true, pendingSetup: null });
            }
            const updated = {
              ...cur,
              currentIndex: nextIdx,
              query: cur.queries[nextIdx],
              createdAt: Date.now()
            };
            await new Promise((r) => chrome.storage.local.set({ pendingGoogleAlertSetup: updated }, r));
            sendResponse({ success: true, pendingSetup: updated });
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'CLEAR_GOOGLE_ALERT_SETUP': {
        chrome.storage.local.remove(['pendingGoogleAlertSetup'], () => {
          sendResponse({ success: true });
        });
        return true;
      }

      case 'CAPTURE_GOOGLE_ALERT_RSS_BATCH':
      case 'CAPTURE_GOOGLE_ALERT_RSS': {
        (async () => {
          try {
            const p = message.payload || message || {};
            const batchFeeds = Array.isArray(p.feeds) && p.feeds.length > 0
              ? p.feeds
              : (p.feedUrl ? [{ feedUrl: p.feedUrl, query: p.query || '' }] : []);
            const normalizedFeeds = batchFeeds
              .map((item) => ({
                url: String(item?.feedUrl || item?.url || '').trim(),
                term: String(item?.query || item?.term || '').trim()
              }))
              .filter((item) => item.url && item.url.startsWith('http'));

            if (normalizedFeeds.length === 0) {
              return sendResponse({ success: false, error: 'Missing feedUrl' });
            }

            const res = await new Promise((r) => chrome.storage.local.get([
              'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig'
            ], r));
            let brands = Array.isArray(res?.campaignProfiles) && res.campaignProfiles.length > 0
              ? [...res.campaignProfiles]
              : (Array.isArray(res?.brandProfiles) ? [...res.brandProfiles] : []);
            const activeId = res?.activeCampaignId || res?.activeBrandId || brands[0]?.brandId || '';
            const targetId = String(p.campaignId || message.campaignId || activeId || '').trim();
            const nowIso = new Date().toISOString();
            const genericTerms = new Set(['', 'google alert rss', 'custom alert rss']);

            const applyFeedsToConfig = (cfg) => {
              let addedCount = 0;
              normalizedFeeds.forEach(({ url, term }) => {
                if (cfg.deletedFeedUrls && cfg.deletedFeedUrls[url]) {
                  delete cfg.deletedFeedUrls[url];
                }
                const existingIdx = cfg.alertFeeds.findIndex((f) => String(f?.url || '').trim() === url);
                if (existingIdx < 0) {
                  cfg.alertFeeds.unshift({
                    id: 'gaf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                    url,
                    term: term || 'Google Alert RSS',
                    addedAt: nowIso
                  });
                  addedCount++;
                } else if (term && !genericTerms.has(term.toLowerCase())) {
                  const existingTerm = String(cfg.alertFeeds[existingIdx].term || '').trim();
                  if (genericTerms.has(existingTerm.toLowerCase()) || term.length > existingTerm.length) {
                    cfg.alertFeeds[existingIdx] = { ...cfg.alertFeeds[existingIdx], term };
                  }
                }
              });
              cfg.alertsActive = true;
              cfg.updatedAt = nowIso;
              return addedCount;
            };

            if (brands.length > 0 && targetId) {
              if (res?.researchConfig && typeof res.researchConfig === 'object') {
                const mig = migrateLegacyResearchConfigToBrands(brands, activeId, res.researchConfig);
                if (mig.changed) brands = mig.brands;
              }
              const idx = brands.findIndex((b) => b && (b.brandId === targetId || b.campaignId === targetId));
              const resolvedIdx = idx >= 0 ? idx : 0;
              const targetBrand = brands[resolvedIdx];
              const config = createDefaultResearchConfig(targetBrand?.researchConfig || {});
              const addedCount = applyFeedsToConfig(config);

              brands[resolvedIdx] = {
                ...targetBrand,
                researchConfig: config,
                updatedAt: nowIso
              };
              delete brands[resolvedIdx].isUntouchedDefault;

              const resolvedTargetId = brands[resolvedIdx].brandId || brands[resolvedIdx].campaignId || targetId;
              const mirrored = getMirroredResearchConfigFromBrands(brands, activeId || resolvedTargetId, config);
              await new Promise((r) => chrome.storage.local.set({
                brandProfiles: brands,
                campaignProfiles: brands,
                researchConfig: mirrored,
                workspacePrefsUpdatedAt: nowIso
              }, r));
              if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.isAuthenticated()) {
                syncSupabaseData('two-way').catch(() => {});
              }
              sendResponse({
                success: true,
                config,
                addedCount,
                totalFeeds: config.alertFeeds.length,
                campaignId: resolvedTargetId
              });
            } else {
              const config = createDefaultResearchConfig(res?.researchConfig || {});
              const addedCount = applyFeedsToConfig(config);
              await new Promise((r) => chrome.storage.local.set({
                researchConfig: config,
                workspacePrefsUpdatedAt: nowIso
              }, r));
              sendResponse({ success: true, config, addedCount, totalFeeds: config.alertFeeds.length });
            }
          } catch (err) {
            sendResponse({ success: false, error: err?.message });
          }
        })();
        return true;
      }

      case 'AUTO_CREATE_MANAGED_GOOGLE_ALERTS': {
        (async () => {
          let tempTabId = null;
          let keepTabOpenForAuth = false;
          try {
            const p = message.payload || message || {};
            const res = await new Promise((r) => chrome.storage.local.get([
              'brandProfiles', 'campaignProfiles', 'activeBrandId', 'activeCampaignId', 'researchConfig'
            ], r));
            let brands = Array.isArray(res?.campaignProfiles) && res.campaignProfiles.length > 0
              ? [...res.campaignProfiles]
              : (Array.isArray(res?.brandProfiles) ? [...res.brandProfiles] : []);
            const activeId = res?.activeCampaignId || res?.activeBrandId || brands[0]?.brandId || '';
            const targetId = String(p.campaignId || message.campaignId || activeId || '').trim();

            if (brands.length > 0 && res?.researchConfig && typeof res.researchConfig === 'object') {
              const mig = migrateLegacyResearchConfigToBrands(brands, activeId, res.researchConfig);
              if (mig.changed) brands = mig.brands;
            }

            const idx = brands.findIndex((b) => b && (b.brandId === targetId || b.campaignId === targetId));
            const resolvedIdx = idx >= 0 ? idx : 0;
            const targetBrand = brands[resolvedIdx] || null;
            const config = createDefaultResearchConfig(targetBrand?.researchConfig || res?.researchConfig || {});

            const incomingQueries = Array.isArray(p.queries)
              ? p.queries.map((q) => String(q || '').trim()).filter(Boolean)
              : [];
            const queries = incomingQueries.length > 0
              ? incomingQueries
              : buildGroupedGoogleAlertQueriesBg({
                  keywords: config.keywords,
                  competitors: config.competitors,
                  platforms: p.platforms || config.platforms
                });

            if (queries.length === 0) {
              return sendResponse({ success: false, error: 'Add at least one keyword or competitor before creating Google Alerts.' });
            }

            const replaceOldManagedFeeds = p.replaceOldManagedFeeds !== false;
            const managedFeedUrls = replaceOldManagedFeeds
              ? (config.alertFeeds || [])
                  .filter((f) => f && f.managedBySmartPoster === true && f.url)
                  .map((f) => String(f.url).trim())
              : [];

            const frequency = p.frequency || config.frequency || 'realtime';
            const quality = p.quality || config.quality || 'all';
            const signature = String(p.signature || computeManagedAlertSignatureBg({ ...config, frequency, quality }));

            // Clear any manual pending setup so floating UI does not race
            await new Promise((r) => chrome.storage.local.remove(['pendingGoogleAlertSetup'], r));

            const createdTab = await chrome.tabs.create({ url: 'https://www.google.com/alerts', active: false });
            tempTabId = createdTab?.id || null;
            if (!tempTabId) {
              return sendResponse({ success: false, error: 'Could not open background Google Alerts tab.' });
            }

            // Wait for tab load complete (with timeout)
            await new Promise((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                try { chrome.tabs.onUpdated.removeListener(onUpd); } catch (_) {}
                clearTimeout(timer);
                resolve();
              };
              const onUpd = (tabId, changeInfo) => {
                if (tabId === tempTabId && changeInfo.status === 'complete') finish();
              };
              chrome.tabs.onUpdated.addListener(onUpd);
              const timer = setTimeout(finish, 18000);
              chrome.tabs.get(tempTabId, (tab) => {
                if (tab && tab.status === 'complete') finish();
              });
            });

            const tabInfo = await chrome.tabs.get(tempTabId).catch(() => null);
            const tabUrl = String(tabInfo?.url || '').toLowerCase();
            if (tabUrl.includes('accounts.google.') || tabUrl.includes('/signin')) {
              keepTabOpenForAuth = true;
              await chrome.tabs.update(tempTabId, { active: true }).catch(() => {});
              if (tabInfo?.windowId) {
                await chrome.windows.update(tabInfo.windowId, { focused: true }).catch(() => {});
              }
              return sendResponse({
                success: false,
                code: 'GOOGLE_AUTH_REQUIRED',
                error: 'Sign in to Google in the opened tab, then click Retry.'
              });
            }

            // Send automation command to content script with brief retry for script readiness
            let contentResp = null;
            for (let attempt = 0; attempt < 6; attempt++) {
              contentResp = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tempTabId, {
                  type: 'RUN_AUTO_CREATE_GOOGLE_ALERTS',
                  payload: {
                    queries,
                    frequency,
                    quality,
                    replaceOldManagedFeeds,
                    managedFeedUrls
                  }
                }, (r) => {
                  if (chrome.runtime.lastError) {
                    resolve({ __commErr: chrome.runtime.lastError.message });
                  } else {
                    resolve(r || { success: false, error: 'Empty response from Google Alerts page' });
                  }
                });
              });
              if (!contentResp?.__commErr) break;
              await new Promise((r) => setTimeout(r, 450));
            }

            if (contentResp?.__commErr) {
              return sendResponse({ success: false, error: 'Google Alerts page script did not respond: ' + contentResp.__commErr });
            }

            if (!contentResp?.success) {
              if (contentResp?.code === 'GOOGLE_AUTH_REQUIRED') {
                keepTabOpenForAuth = true;
                await chrome.tabs.update(tempTabId, { active: true }).catch(() => {});
                if (tabInfo?.windowId) {
                  await chrome.windows.update(tabInfo.windowId, { focused: true }).catch(() => {});
                }
              }
              return sendResponse({
                success: false,
                code: contentResp?.code || 'AUTO_CREATE_FAILED',
                error: contentResp?.error || 'Failed to create Google Alerts.'
              });
            }

            const nowIso = new Date().toISOString();
            const capturedFeeds = Array.isArray(contentResp.feeds) ? contentResp.feeds : [];
            const managedOldSet = new Set(managedFeedUrls);

            if (!config.deletedFeedUrls || typeof config.deletedFeedUrls !== 'object') {
              config.deletedFeedUrls = {};
            }
            if (replaceOldManagedFeeds) {
              (config.alertFeeds || []).forEach((f) => {
                if (f && f.managedBySmartPoster === true && f.url) {
                  config.deletedFeedUrls[String(f.url).trim()] = nowIso;
                }
              });
              config.alertFeeds = (config.alertFeeds || []).filter((f) => !(f && f.managedBySmartPoster === true));
            }

            capturedFeeds.forEach((item) => {
              const url = String(item?.feedUrl || item?.url || '').trim();
              const term = String(item?.query || item?.term || '').trim() || 'Smart Poster Alert';
              if (!url || !url.startsWith('http')) return;
              if (config.deletedFeedUrls[url]) delete config.deletedFeedUrls[url];
              const existingIdx = config.alertFeeds.findIndex((f) => String(f?.url || '').trim() === url);
              const feedEntry = {
                id: 'gaf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                url,
                term,
                addedAt: nowIso,
                managedBySmartPoster: true,
                signature
              };
              if (existingIdx >= 0) {
                config.alertFeeds[existingIdx] = { ...config.alertFeeds[existingIdx], ...feedEntry, id: config.alertFeeds[existingIdx].id || feedEntry.id };
              } else {
                config.alertFeeds.unshift(feedEntry);
              }
            });

            config.managedAlertSignature = signature;
            config.frequency = frequency;
            config.quality = quality;
            config.alertsActive = true;
            config.updatedAt = nowIso;

            if (brands.length > 0 && targetBrand) {
              brands[resolvedIdx] = {
                ...targetBrand,
                researchConfig: config,
                updatedAt: nowIso
              };
              delete brands[resolvedIdx].isUntouchedDefault;
              const resolvedCampId = brands[resolvedIdx].brandId || brands[resolvedIdx].campaignId || targetId;
              const mirrored = getMirroredResearchConfigFromBrands(brands, activeId || resolvedCampId, config);
              await new Promise((r) => chrome.storage.local.set({
                brandProfiles: brands,
                campaignProfiles: brands,
                researchConfig: mirrored,
                workspacePrefsUpdatedAt: nowIso
              }, r));
            } else {
              await new Promise((r) => chrome.storage.local.set({
                researchConfig: config,
                workspacePrefsUpdatedAt: nowIso
              }, r));
            }

            if (typeof backupExtensionVault === 'function') {
              backupExtensionVault().catch(() => {});
            }
            if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.isAuthenticated()) {
              syncSupabaseData('two-way').catch(() => {});
            }

            sendResponse({
              success: true,
              alertFeeds: config.alertFeeds,
              createdCount: capturedFeeds.length,
              deletedOldCount: Number(contentResp.deletedOldCount || managedOldSet.size || 0),
              managedAlertSignature: signature,
              config
            });
          } catch (err) {
            sendResponse({ success: false, error: err?.message || 'Google Alert auto-setup failed' });
          } finally {
            if (tempTabId && !keepTabOpenForAuth) {
              chrome.tabs.remove(tempTabId).catch(() => {});
            }
          }
        })();
        return true;
      }

      case 'FETCH_RESEARCH_FEEDS': {
        runBackgroundResearchPoll(true)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: err?.message }));
        return true;
      }

      case 'FETCH_RESEARCH_OPPORTUNITIES_STAGE': {
        const p = message.payload || message || {};
        runBackgroundResearchStage(p)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: err?.message || 'Stage fetch failed' }));
        return true;
      }

      case 'CANCEL_RESEARCH_FETCH': {
        const p = message.payload || message || {};
        cancelResearchJobBg(String(p.jobId || ''));
        sendResponse({ success: true, cancelled: true });
        return true;
      }

      case 'LAUNCH_RADAR_URLS': {
        (async () => {
          const rawUrls = Array.isArray(message.payload?.urls)
            ? message.payload.urls
            : (Array.isArray(message.urls) ? message.urls : []);
          const validUrls = rawUrls.filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 12);
          for (let i = 0; i < validUrls.length; i++) {
            await chrome.tabs.create({ url: validUrls[i], active: i === 0 });
          }
          sendResponse({ success: true, count: validUrls.length });
        })();
        return true;
      }

      case 'CLEAR_AUTH_SESSION':
      case 'clearAuthSession': {
        invalidateAuthSession(
          message.reason || message.payload?.reason || 'explicit_signout',
          message.failedToken || message.payload?.failedToken || ''
        )
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: true }));
        return true;
      }

      case 'getSupabaseSyncStatus': {
        sendResponse({
          success: true,
          status: supabaseSyncStatus,
          config: {
            url: supabaseConfig.url,
            anonKey: supabaseConfig.anonKey,
            userId: supabaseConfig.userId
          }
        });
        return true;
      }

      case 'saveSupabaseCredentials': {
        const { url, anonKey, userId } = message;
        if (url !== undefined) supabaseConfig.url = (url || '').trim();
        if (anonKey !== undefined) supabaseConfig.anonKey = (anonKey || '').trim();
        if (userId !== undefined) supabaseConfig.userId = (userId || 'default-user').trim();

        chrome.storage.local.set({
          supabase_url: supabaseConfig.url,
          supabase_anon_key: supabaseConfig.anonKey,
          supabase_user_id: supabaseConfig.userId
        }, () => {
          if (typeof SupabaseClient !== 'undefined' && supabaseConfig.url && supabaseConfig.anonKey) {
            supabaseClient = new SupabaseClient(supabaseConfig);
            attachSupabaseTokenRefreshHandler(supabaseClient);
            syncSupabaseData('two-way').then((syncRes) => {
              sendResponse({ success: true, syncResult: syncRes });
            });
          } else {
            sendResponse({ success: true, message: 'Supabase credentials saved locally.' });
          }
        });
        return true;
      }

      case 'testSupabaseConnection': {
        const testConfig = {
          url: message.url || supabaseConfig.url,
          anonKey: message.anonKey || supabaseConfig.anonKey,
          userId: message.userId || supabaseConfig.userId
        };

        if (!testConfig.url || !testConfig.anonKey) {
          sendResponse({ success: false, error: 'Project URL and Anon Key are required.' });
          return true;
        }

        const clientToTest = typeof SupabaseClient !== 'undefined' ? new SupabaseClient(testConfig) : null;
        if (!clientToTest) {
          sendResponse({ success: false, error: 'Supabase client helper is not loaded.' });
          return true;
        }

        clientToTest.testConnection().then((res) => {
          sendResponse(res);
        }).catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
        return true;
      }

      case 'syncSupabaseNow': {
        refreshStoredUserProfile(null).catch(() => null);
        syncSupabaseData('two-way').then((res) => {
          sendResponse(res);
        }).catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
        return true;
      }

      case 'getBrandReports': {
        const brandId = message.brandId || 'brand-default';
        const storageKey = `brandReports_${brandId}`;
        const storageArea = chrome.storage.local || chrome.storage.sync;
        storageArea.get([storageKey], (res) => {
          const list = (res && Array.isArray(res[storageKey])) ? res[storageKey] : [];
          sendResponse({ success: true, reports: list });
        });
        return true;
      }

      case 'clearBrandReports': {
        const brandId = message.brandId || 'brand-default';
        const storageKey = `brandReports_${brandId}`;
        const storageArea = chrome.storage.local || chrome.storage.sync;
        storageArea.remove([storageKey], () => {
          sendResponse({ success: true });
        });
        return true;
      }

      case 'getAutoSuppress':
        sendResponse({ success: true, autoSuppress });
        break;

      case 'saveAutoSuppress':
        autoSuppress = Boolean(message.autoSuppress);
        settings = { ...settings, autoSuppress, updatedAt: new Date().toISOString() };
        chrome.storage.sync.set({ autoSuppress, settings });
        chrome.storage.local.set({ autoSuppress, settings });
        sendResponse({ success: true, autoSuppress });
        break;

      case 'getTestResults':
        sendResponse({ success: true, results: testResults || [] });
        break;

      case 'clearResults':
        testResults = [];
        chrome.storage.sync.set({ testResults: [] });
        sendResponse({ success: true });
        break;

      case 'resetSettings':
        settings = {
          mode: 'single',
          dataSource: 'custom',
          formActionMode: 'fill-only',
          financialDetection: true,
          slowMode: false,
          skipFileInputs: true,
          skipPasswordFields: true,
          apiTimeout: 30,
          debugMode: false,
          updatedAt: new Date().toISOString()
        };
        chrome.storage.sync.set({ settings });
        chrome.storage.local.set({ settings });
        sendResponse({ success: true, settings });
        break;

      case 'startBulkTesting':
        logger.log('[Bulk Outreach] Starting bulk test across tabs');
        isBulkTesting = true;
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            const valid = (tabs || []).filter(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
            bulkTestingQueue = valid.length > 0 ? valid : [
              { id: 1, title: 'Sample Contact Form 1', url: 'https://example.com/contact' },
              { id: 2, title: 'Acme SaaS Support', url: 'https://acme-example.com/get-in-touch' },
              { id: 3, title: 'B2B Partner Inquiries', url: 'https://partner-hub.io/contact-us' }
            ];
            bulkTestingIndex = 0;
            runNextBulkTab();
            sendResponse({ success: true, message: 'Bulk testing started', total: bulkTestingQueue.length });
          });
        } else {
          bulkTestingQueue = [
            { id: 1, title: 'Sample Contact Form 1', url: 'https://example.com/contact' },
            { id: 2, title: 'Acme SaaS Support', url: 'https://acme-example.com/get-in-touch' },
            { id: 3, title: 'B2B Partner Inquiries', url: 'https://partner-hub.io/contact-us' }
          ];
          bulkTestingIndex = 0;
          runNextBulkTab();
          sendResponse({ success: true, message: 'Bulk testing started', total: bulkTestingQueue.length });
        }
        break;

      case 'stopBulkTesting':
        logger.log('[Bulk Outreach] Stopping bulk test');
        isBulkTesting = false;
        if (bulkTestingTimerId) {
          clearTimeout(bulkTestingTimerId);
          bulkTestingTimerId = null;
        }
        chrome.runtime.sendMessage({ type: 'testComplete', result: { stopped: true } });
        sendResponse({ success: true, message: 'Bulk testing stopped' });
        break;

      case 'startDirectorySubmission': {
        (async () => {
          logger.log('[Directory] Starting autonomous submission:', message.category);
          const category = message.category || 'launchpads';
          const storedDirs = await new Promise((resolve) => {
            chrome.storage.local.get(['directory_custom_lists', 'directory_lists_catalog'], (res) => resolve(res || {}));
          });
          const customLists = storedDirs.directory_custom_lists || {};
          const syncedCatalog = storedDirs.directory_lists_catalog || {};
          const list =
            (Array.isArray(customLists[category]) && customLists[category].length > 0 ? customLists[category] : null) ||
            (Array.isArray(syncedCatalog[category]) && syncedCatalog[category].length > 0 ? syncedCatalog[category] : null) ||
            DIRECTORY_LISTS[category] ||
            [];
          directorySubmitting = true;
          directorySubmitQueue = list;
          directorySubmitIndex = 0;
          directorySubmitCategory = category;
          directorySubmitCampaignName = message.brandName || (directoryData && directoryData.productName) || 'Listing';
          runNextDirectorySubmission();
          sendResponse({ success: true, total: list.length, category });
        })();
        return true;
      }

      case 'stopDirectorySubmission': {
        logger.log('[Directory] Stopping submission');
        directorySubmitting = false;
        if (directorySubmitTimerId) {
          clearTimeout(directorySubmitTimerId);
          directorySubmitTimerId = null;
        }
        chrome.runtime.sendMessage({ type: 'dirSubmitComplete', stopped: true });
        sendResponse({ success: true });
        break;
      }

      // Directory Submitter Handlers
      case 'getDirectoryCampaigns':
        logger.log('Getting directory campaigns:', directoryCampaigns.length, 'active:', activeDirectoryCampaignId);
        sendResponse({
          success: true,
          campaigns: directoryCampaigns,
          activeId: activeDirectoryCampaignId,
          backups: directoryBackups,
          activeData: directoryData
        });
        break;

      case 'saveDirectoryCampaigns':
        logger.log('Saving directory campaigns:', message.campaigns?.length, 'activeId:', message.activeId);
        if (message.campaigns && Array.isArray(message.campaigns)) {
          directoryCampaigns = message.campaigns;
        }
        if (message.activeId) {
          activeDirectoryCampaignId = message.activeId;
        }
        if (message.backups && Array.isArray(message.backups)) {
          directoryBackups = message.backups;
        }
        const currentActive = directoryCampaigns.find(c => c.id === activeDirectoryCampaignId) || directoryCampaigns[0];
        if (currentActive && currentActive.data) {
          directoryData = { ...currentActive.data };
        }
        chrome.storage.sync.set({
          directoryCampaigns,
          activeDirectoryCampaignId,
          directoryBackups,
          directoryData
        }, () => {
          logger.log('Directory campaigns and backups saved to storage');
        });
        sendResponse({
          success: true,
          campaigns: directoryCampaigns,
          activeId: activeDirectoryCampaignId,
          backups: directoryBackups,
          activeData: directoryData
        });
        break;

      case 'createDirectoryBackup':
        logger.log('Creating backup for campaign:', message.campaignId || activeDirectoryCampaignId);
        const targetCamp = directoryCampaigns.find(c => c.id === (message.campaignId || activeDirectoryCampaignId)) || directoryCampaigns[0];
        const newBackup = {
          id: 'bk-' + Date.now(),
          campaignId: targetCamp ? targetCamp.id : activeDirectoryCampaignId,
          campaignName: (targetCamp ? targetCamp.name : (message.campaignName || 'Listing Backup')),
          createdAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          data: message.data || (targetCamp ? { ...targetCamp.data } : { ...directoryData })
        };
        directoryBackups.unshift(newBackup);
        chrome.storage.sync.set({ directoryBackups }, () => {
          logger.log('Backup saved:', newBackup.id);
        });
        sendResponse({ success: true, backup: newBackup, backups: directoryBackups });
        break;

      case 'deleteDirectoryBackup':
        logger.log('Deleting directory backup:', message.backupId);
        directoryBackups = directoryBackups.filter(b => b.id !== message.backupId);
        chrome.storage.sync.set({ directoryBackups });
        sendResponse({ success: true, backups: directoryBackups });
        break;

      case 'restoreDirectoryBackup':
        logger.log('Restoring directory backup:', message.backupId);
        const foundBackup = directoryBackups.find(b => b.id === message.backupId);
        if (!foundBackup) {
          sendResponse({ success: false, error: 'Backup snapshot not found' });
          break;
        }
        // Update active campaign data or matching campaign data
        const restoreIdx = directoryCampaigns.findIndex(c => c.id === activeDirectoryCampaignId);
        if (restoreIdx >= 0) {
          directoryCampaigns[restoreIdx].data = { ...foundBackup.data };
          directoryCampaigns[restoreIdx].updatedAt = new Date().toISOString();
        }
        directoryData = { ...foundBackup.data };
        chrome.storage.sync.set({ directoryCampaigns, directoryData });
        sendResponse({
          success: true,
          restoredData: directoryData,
          campaigns: directoryCampaigns,
          activeId: activeDirectoryCampaignId
        });
        break;

      case 'importDirectoryData':
        logger.log('Importing directory data payload');
        if (message.campaigns && Array.isArray(message.campaigns)) {
          if (message.merge) {
            // merge non-duplicates
            const existingIds = new Set(directoryCampaigns.map(c => c.id));
            message.campaigns.forEach(c => {
              if (existingIds.has(c.id)) {
                c.id = 'camp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
              }
              directoryCampaigns.push(c);
            });
          } else {
            directoryCampaigns = message.campaigns;
          }
        }
        if (message.backups && Array.isArray(message.backups)) {
          if (message.merge) {
            directoryBackups = [...message.backups, ...directoryBackups];
          } else {
            directoryBackups = message.backups;
          }
        }
        if (message.activeId && directoryCampaigns.some(c => c.id === message.activeId)) {
          activeDirectoryCampaignId = message.activeId;
        } else if (directoryCampaigns.length > 0) {
          activeDirectoryCampaignId = directoryCampaigns[0].id;
        }
        const activeItem = directoryCampaigns.find(c => c.id === activeDirectoryCampaignId);
        if (activeItem) {
          directoryData = { ...activeItem.data };
        }
        chrome.storage.sync.set({
          directoryCampaigns,
          activeDirectoryCampaignId,
          directoryBackups,
          directoryData
        });
        sendResponse({
          success: true,
          campaigns: directoryCampaigns,
          activeId: activeDirectoryCampaignId,
          backups: directoryBackups,
          activeData: directoryData
        });
        break;

      case 'getDirectoryData':
        logger.log('Getting directoryData:', directoryData.productName);
        sendResponse({ success: true, directoryData });
        break;

      case 'saveDirectoryData':
        logger.log('Saving directoryData:', message.directoryData);
        directoryData = { ...directoryData, ...(message.directoryData || {}) };
        // Sync with active campaign
        const syncIdx = directoryCampaigns.findIndex(c => c.id === activeDirectoryCampaignId);
        if (syncIdx >= 0) {
          directoryCampaigns[syncIdx].data = { ...directoryData };
          directoryCampaigns[syncIdx].name = directoryData.productName || directoryCampaigns[syncIdx].name;
          directoryCampaigns[syncIdx].updatedAt = new Date().toISOString();
        }
        chrome.storage.sync.set({ directoryData, directoryCampaigns }, () => {
          logger.log('Directory data saved to storage');
        });
        sendResponse({ success: true, directoryData, campaigns: directoryCampaigns });
        break;

      case 'fillDirectoryForm':
        logger.log('Executing fillDirectoryForm on tab:', message.tabId, 'mode:', message.formActionMode || directoryActionMode);
        chrome.tabs.sendMessage(message.tabId, {
          type: 'fillDirectoryForm',
          directoryData: message.directoryData || directoryData,
          formActionMode: message.formActionMode || message.actionMode || directoryActionMode || 'fill-only',
          actionMode: message.actionMode || message.formActionMode || directoryActionMode || 'fill-only',
          retryCount: message.retryCount || 3,
          suppressionList: directorySuppressionList || []
        }, (response) => {
          if (chrome.runtime.lastError) {
            logger.error('Content script error:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response || { success: false, error: 'No response from directory content script' });
          }
        });
        return true; // Keep message channel open

      case 'getDirectorySuppressionList':
        sendResponse({ success: true, suppressionList: directorySuppressionList || [], autoSuppress: directoryAutoSuppress });
        break;

      case 'saveDirectorySuppressionList':
        directorySuppressionList = message.suppressionList || [];
        if (message.autoSuppress !== undefined) directoryAutoSuppress = message.autoSuppress;
        chrome.storage.sync.set({ directorySuppressionList, directoryAutoSuppress }, () => {
          logger.log('Directory suppression list saved, count:', directorySuppressionList.length);
        });
        sendResponse({ success: true, suppressionList: directorySuppressionList, autoSuppress: directoryAutoSuppress });
        break;

      case 'saveDirectorySettings':
        if (message.actionMode) directoryActionMode = message.actionMode;
        chrome.storage.sync.set({ directoryActionMode });
        sendResponse({ success: true, directoryActionMode });
        break;

      case 'recordDirectoryProof':
        const newProof = {
          id: 'dir-proof-' + Date.now(),
          directory: message.directory || 'Startup Directory',
          liveUrl: message.liveUrl || 'https://...',
          status: message.status || 'Submitted (Pending Review)',
          notes: message.notes || `Filled ${message.filled || 0} fields`,
          timestamp: new Date().toLocaleString()
        };
        directorySubmissions.unshift(newProof);
        if (directoryAutoSuppress && message.liveUrl) {
          try {
            const domain = new URL(message.liveUrl).hostname;
            if (!directorySuppressionList.includes(domain) && !directorySuppressionList.includes(message.liveUrl)) {
              directorySuppressionList.push(domain);
              chrome.storage.sync.set({ directorySuppressionList });
            }
          } catch (e) {}
        }
        chrome.storage.sync.set({ directorySubmissions });
        sendResponse({ success: true, proof: newProof, submissions: directorySubmissions });
        break;

      case 'getDirectorySubmissions':
        sendResponse({ success: true, submissions: directorySubmissions || [] });
        break;

      case 'saveDirectorySubmission':
        if (message.submission) {
          directorySubmissions.unshift(message.submission);
          chrome.storage.sync.set({ directorySubmissions });
          sendResponse({ success: true, submissions: directorySubmissions });
        } else {
          sendResponse({ success: false, error: 'No submission data provided' });
        }
        break;

      // Twitter Module Handlers
      case 'getTwitterData':
        sendResponse({
          success: true,
          comments: twitterComments,
          drafts: twitterDrafts,
          keywords: twitterKeywords
        });
        break;

      case 'saveTwitterData':
        if (message.comments) {
          twitterComments = message.comments;
          chrome.storage.sync.set({ twitterComments });
        }
        if (message.drafts) {
          twitterDrafts = message.drafts;
          chrome.storage.sync.set({ twitterDrafts });
        }
        if (message.keywords) {
          twitterKeywords = message.keywords;
          chrome.storage.sync.set({ twitterKeywords });
        }
        sendResponse({ success: true });
        break;

      case 'openTwitterSearch':
        if (message.query) {
          chrome.tabs.create({ url: `https://x.com/search?q=${encodeURIComponent(message.query)}&f=live` });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Query missing' });
        }
        break;

      case 'openTwitterCompose':
        if (message.text) {
          chrome.tabs.create({ url: `https://x.com/intent/tweet?text=${encodeURIComponent(message.text)}` });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Text missing' });
        }
        break;

      // ==========================================
      // PHASE 4: UNIVERSAL MASTER AUDIT & ANTI-BAN HANDLERS
      // ==========================================
      case 'getMasterLogs': {
        const mod = message.module;
        let logs = traffic_builder_master_logs;
        if (mod && mod !== 'all') {
          logs = logs.filter(l => l.module === mod);
        }
        sendResponse({
          success: true,
          logs,
          stats: {
            total: logs.length,
            success: logs.filter(l => l.status === 'success').length,
            suppressed: logs.filter(l => l.status === 'suppressed').length,
            failed: logs.filter(l => l.status === 'failed').length
          }
        });
        break;
      }

      case 'clearMasterLogs': {
        const mod = message.module;
        if (mod && mod !== 'all') {
          traffic_builder_master_logs = traffic_builder_master_logs.filter(l => l.module !== mod);
          chrome.storage.local.set({ traffic_builder_master_logs });
        } else {
          traffic_builder_master_logs = [];
          chrome.storage.local.set({
            traffic_builder_master_logs: [],
            pendingClearCampaignLogs: true
          }, () => {
            if (supabaseClient && supabaseClient.isLoggedIn()) {
              supabaseClient.clearCampaignLogs().then((r) => {
                if (r?.success) chrome.storage.local.remove(['pendingClearCampaignLogs']);
              }).catch(() => {});
            }
          });
        }
        sendResponse({ success: true, logs: traffic_builder_master_logs });
        break;
      }

      case 'logAuditEntry': {
        if (message.entry) {
          const entry = logToMasterAudit(message.entry);
          sendResponse({ success: true, entry });
        } else {
          sendResponse({ success: false, error: 'No entry provided' });
        }
        break;
      }

      case 'checkAntiBan': {
        const result = checkAntiBanPreflight(message.url || message.targetUrl, message.module || 'contact', message.windowDays || antiBanWindowDays);
        sendResponse({ success: true, ...result });
        break;
      }

      // ==========================================
      // PHASE 3: COMMENTER MODULE & CAMPAIGN HANDLERS
      // ==========================================
      case 'getCommenterData':
        sendResponse({
          success: true,
          comments: commenterPresets,
          presets: commenterPresets,
          history: commenterHistory,
          settings: commenterSettings,
          campaigns: commenterCampaigns,
          activeId: activeCommenterCampaignId,
          running: commenterRunning,
          stats: commenterCampaignStats,
          activeUrl: commenterActiveUrl
        });
        break;

      case 'saveCommenterData':
        if (message.comments) {
          commenterPresets = message.comments;
          commenterComments = message.comments;
          chrome.storage.sync.set({ commenterPresets, commenterComments });
        }
        if (message.settings) {
          commenterSettings = { ...commenterSettings, ...message.settings };
          chrome.storage.sync.set({ commenterSettings });
        }
        sendResponse({ success: true, comments: commenterPresets, settings: commenterSettings });
        break;

      case 'getCommenterCampaigns':
        sendResponse({
          success: true,
          campaigns: commenterCampaigns,
          activeId: activeCommenterCampaignId,
          activeCampaign: commenterCampaigns.find(c => c.id === activeCommenterCampaignId) || commenterCampaigns[0]
        });
        break;

      case 'saveCommenterCampaigns':
        if (message.campaigns && Array.isArray(message.campaigns)) {
          commenterCampaigns = message.campaigns;
        }
        if (message.activeId) {
          activeCommenterCampaignId = message.activeId;
        }
        chrome.storage.sync.set({ commenterCampaigns, activeCommenterCampaignId });
        sendResponse({ success: true, campaigns: commenterCampaigns, activeId: activeCommenterCampaignId });
        break;

      case 'getCommenterPresets':
        sendResponse({
          success: true,
          presets: commenterPresets.length > 0 ? commenterPresets : defaultCommenterPresets
        });
        break;

      case 'saveCommenterPresets':
        if (message.presets && Array.isArray(message.presets)) {
          commenterPresets = message.presets;
          commenterComments = message.presets;
          chrome.storage.sync.set({ commenterPresets, commenterComments });
          sendResponse({ success: true, presets: commenterPresets });
        } else {
          sendResponse({ success: false, error: 'Presets array required' });
        }
        break;

      case 'startCommenterCampaign': {
        logger.log('[Commenter] Starting campaign:', message.campaignId || activeCommenterCampaignId);
        const rawUrls = message.urls || (message.campaign && message.campaign.targetUrls) || '';
        const urls = typeof rawUrls === 'string'
          ? rawUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http://') || u.startsWith('https://'))
          : Array.isArray(rawUrls) ? rawUrls.filter(Boolean) : [];

        if (urls.length === 0) {
          sendResponse({ success: false, error: 'No valid http(s):// URLs provided in campaign queue!' });
          break;
        }

        if (message.campaignId) activeCommenterCampaignId = message.campaignId;
        if (message.settings) commenterSettings = { ...commenterSettings, ...message.settings };
        if (message.intervalMinutes) commenterSettings.intervalMinutes = parseFloat(message.intervalMinutes);
        if (message.simulateTyping !== undefined) commenterSettings.simulateTyping = Boolean(message.simulateTyping);
        if (message.skipSuppressed !== undefined) commenterSettings.skipSuppressed = Boolean(message.skipSuppressed);
        if (message.mode) commenterSettings.mode = message.mode;

        commenterRunning = true;
        commenterQueue = urls;
        commenterCurrentIndex = 0;
        commenterActiveUrl = urls[0] || '';
        commenterCampaignStats = {
          totalProcessed: 0,
          success: 0,
          blocked: 0,
          failed: 0,
          remaining: urls.length
        };

        // Fire off runner in background
        runNextCommenterUrl();

        sendResponse({
          success: true,
          message: `🚀 Campaign started with ${urls.length} URLs!`,
          queueLength: urls.length,
          intervalMinutes: commenterSettings.intervalMinutes
        });
        break;
      }

      case 'pauseCommenterCampaign': {
        logger.log('[Commenter] Pausing campaign');
        commenterPaused = true;
        if (commenterTimerId) {
          clearTimeout(commenterTimerId);
          commenterTimerId = null;
        }
        chrome.runtime.sendMessage({
          type: 'commenterProgress',
          status: 'Paused',
          running: true,
          paused: true,
          currentIndex: commenterCurrentIndex,
          total: commenterQueue.length,
          stats: commenterCampaignStats,
          message: 'Campaign paused by user.'
        }).catch(() => {});
        sendResponse({ success: true, message: 'Commenter campaign paused' });
        break;
      }

      case 'resumeCommenterCampaign': {
        logger.log('[Commenter] Resuming campaign');
        commenterPaused = false;
        chrome.runtime.sendMessage({
          type: 'commenterProgress',
          status: 'Resumed',
          running: true,
          paused: false,
          currentIndex: commenterCurrentIndex,
          total: commenterQueue.length,
          stats: commenterCampaignStats,
          message: 'Campaign resumed.'
        }).catch(() => {});
        runNextCommenterUrl();
        sendResponse({ success: true, message: 'Commenter campaign resumed' });
        break;
      }

      case 'stopCommenterCampaign': {
        logger.log('[Commenter] Stopping campaign');
        commenterRunning = false;
        commenterPaused = false;
        if (commenterTimerId) {
          clearTimeout(commenterTimerId);
          commenterTimerId = null;
        }
        chrome.runtime.sendMessage({
          type: 'commenterProgress',
          status: 'Stopped',
          running: false,
          paused: false,
          currentIndex: commenterCurrentIndex,
          total: commenterQueue.length,
          stats: commenterCampaignStats,
          message: 'Campaign stopped by user.'
        }).catch(() => {});
        sendResponse({ success: true, message: 'Commenter campaign stopped' });
        break;
      }

      case 'getCommenterStatus':
        sendResponse({
          success: true,
          running: commenterRunning,
          paused: commenterPaused,
          currentIndex: commenterCurrentIndex,
          total: commenterQueue.length,
          activeUrl: commenterActiveUrl,
          stats: commenterCampaignStats
        });
        break;

      case 'saveCommenterComment':
        if (message.comment) {
          const idx = commenterPresets.findIndex(c => c.id === message.comment.id);
          if (idx >= 0) {
            commenterPresets[idx] = message.comment;
          } else {
            commenterPresets.unshift(message.comment);
          }
          commenterComments = commenterPresets;
          chrome.storage.sync.set({ commenterPresets, commenterComments });
          sendResponse({ success: true, presets: commenterPresets, comments: commenterPresets });
        } else {
          sendResponse({ success: false, error: 'No comment payload' });
        }
        break;

      case 'deleteCommenterComment':
        if (message.commentId) {
          commenterPresets = commenterPresets.filter(c => c.id !== message.commentId);
          commenterComments = commenterPresets;
          chrome.storage.sync.set({ commenterPresets, commenterComments });
          sendResponse({ success: true, presets: commenterPresets, comments: commenterPresets });
        } else {
          sendResponse({ success: false, error: 'No commentId specified' });
        }
        break;

      case 'logCommenterSubmission':
        if (message.entry) {
          commenterHistory.unshift(message.entry);
          chrome.storage.sync.set({ commenterHistory });
          logToMasterAudit({
            module: 'commenter',
            targetUrl: message.entry.url,
            campaignName: message.campaignName || 'Commenter Manual',
            contentSnippet: message.entry.snippet || '',
            status: message.entry.status === 'success' || message.entry.status === 'Inserted' ? 'success' : 'failed',
            statusCode: 200,
            timestamp: Date.now()
          });
          sendResponse({ success: true, history: commenterHistory });
        } else {
          sendResponse({ success: false, error: 'No entry provided' });
        }
        break;

      case 'clearCommenterHistory':
        commenterHistory = [];
        chrome.storage.sync.set({ commenterHistory: [] });
        sendResponse({ success: true, history: [] });
        break;

      case 'scanCommentFields':
        if (message.tabId) {
          chrome.tabs.sendMessage(message.tabId, { type: 'scanCommentFields' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response || { success: false, error: 'No response from content script' });
            }
          });
          return true;
        } else {
          sendResponse({ success: false, error: 'No tabId provided' });
        }
        break;

      case 'insertComment':
        if (message.tabId) {
          chrome.tabs.sendMessage(message.tabId, {
            type: 'insertComment',
            commentText: message.commentText,
            authorName: message.authorName || commenterSettings.authorName,
            authorEmail: message.authorEmail || commenterSettings.authorEmail,
            authorWebsite: message.authorWebsite || commenterSettings.backlinkUrl,
            mode: message.mode || 'draft'
          }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              if (response && response.success) {
                const newLog = {
                  id: 'ch-' + Date.now(),
                  timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  url: message.pageUrl || 'Active Tab',
                  platform: response.platform || message.platform || 'Community Post',
                  angle: message.angle || 'Outreach Insight',
                  snippet: (message.commentText || '').substring(0, 80) + '...',
                  status: 'success'
                };
                commenterHistory.unshift(newLog);
                chrome.storage.sync.set({ commenterHistory });

                logToMasterAudit({
                  module: 'commenter',
                  targetUrl: message.pageUrl || response.url || 'Active Tab',
                  campaignName: 'Manual Quick Insert',
                  contentSnippet: (message.commentText || '').substring(0, 140),
                  status: 'success',
                  statusCode: 200,
                  timestamp: Date.now()
                });
              }
              sendResponse(response || { success: false, error: 'No response from content script' });
            }
          });
          return true;
        } else {
          sendResponse({ success: false, error: 'No tabId provided' });
        }
        break;

      case 'executeAiAction': {
        const {
          action,
          text = '',
          customPrompt = '',
          moduleType = '',
          brand = {},
          openRouterKey = '',
          geminiApiKey: reqGeminiKey = '',
          aiModel: reqAiModel = '',
          variationCount = 1,
          existingTexts = []
        } = message;
        const parsedCount = Math.max(1, Math.min(10, parseInt(String(variationCount || 1), 10) || 1));
        const excludeList = Array.isArray(existingTexts)
          ? existingTexts.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
          : [];
        (async () => {
          try {
            const storedKeys = await new Promise((r) =>
              chrome.storage.local.get(['apiKey', 'geminiApiKey', 'aiModel', 'settings', 'authUserSession', 'cf_auth_session'], (d) => r(d || {}))
            );
            const effectiveKey = String(openRouterKey || apiKey || storedKeys.apiKey || storedKeys.settings?.apiKey || '').trim();
            const effectiveGeminiKey = String(reqGeminiKey || geminiApiKey || storedKeys.geminiApiKey || storedKeys.settings?.geminiApiKey || '').trim();
            const effectiveModel = reqAiModel || storedKeys.aiModel || storedKeys.settings?.aiModel || openRouterModel || 'deepseek/deepseek-chat';
            if (!effectiveKey && !effectiveGeminiKey) {
              sendResponse({ success: false, needsApiKey: true, error: 'Please add your OpenRouter or Google Gemini API Key in Settings before using AI features.' });
              return;
            }
            const cleanCustomPrompt = String(customPrompt || '').trim();
            if (action === 'custom' && !cleanCustomPrompt) {
              sendResponse({ success: false, error: 'Please enter a custom instruction.' });
              return;
            }

            const parseVariationsFromOutput = (rawOutput, expectedCount) => {
              const cleaned = String(rawOutput || '').trim();
              if (!cleaned) return [];
              if (expectedCount <= 1) return [cleaned];
              const tryJson = (candidate) => {
                try {
                  const parsed = JSON.parse(candidate);
                  const arr = Array.isArray(parsed)
                    ? parsed
                    : (Array.isArray(parsed?.variations) ? parsed.variations : []);
                  return arr.map((x) => String(x || '').trim()).filter(Boolean);
                } catch {
                  return [];
                }
              };
              const unfenced = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
              let items = tryJson(unfenced);
              if (items.length === 0) {
                const m = unfenced.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (m) items = tryJson(m[0]);
              }
              if (items.length === 0) {
                items = unfenced
                  .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s+)/)
                  .map((s) => s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').replace(/^["']|["']$/g, '').trim())
                  .filter(Boolean);
              }
              if (items.length === 0) items = [cleaned];
              const seen = new Set();
              const out = [];
              for (const it of items) {
                const k = it.toLowerCase();
                if (!seen.has(k)) {
                  seen.add(k);
                  out.push(it);
                }
              }
              return out.slice(0, expectedCount);
            };

            const brandName = String(brand?.name || brand?.brandName || '').trim();
            const brandTagline = String(brand?.tagline || '').trim();
            const brandPitch = String(brand?.pitch || brand?.description || '').trim();
            const brandWebsite = String(brand?.website || brand?.url || '').trim();
            const buildContextBlock = (b) => {
              if (!b || typeof b !== 'object') return 'Use ONLY the provided text context.';
              const lines = [];
              const push = (label, val, maxLen = 400) => {
                const str = String(val || '').trim();
                if (str) lines.push(`${label}: ${str.slice(0, maxLen)}`);
              };
              const listTexts = (arr, maxItems = 4, maxLen = 220) => {
                if (!Array.isArray(arr) || arr.length === 0) return '';
                return arr.map((item) => {
                  if (typeof item === 'string') return item.trim();
                  if (item && typeof item === 'object') {
                    if (item.subject && item.body) return `Subject: ${String(item.subject).trim()} | Body: ${String(item.body).trim()}`;
                    if (item.title && item.body) return `${String(item.title).trim()}: ${String(item.body).trim()}`;
                    return String(item.text || item.message || item.body || item.title || '').trim();
                  }
                  return '';
                }).filter(Boolean).slice(0, maxItems).map((s) => s.slice(0, maxLen)).join(' || ');
              };
              push('Brand / Product Name', b.name || b.brandName, 120);
              push('Website URL', b.website || b.url, 200);
              push('One-Line Tagline', b.tagline, 200);
              push('Pitch / Description', b.pitch || b.description, 800);
              if (b.description && b.description !== b.pitch) push('Extended Product Description', b.description, 800);
              push('Twitter / X Handle', b.twitter, 80);
              push('Instagram Handle', b.instagram, 80);
              if (b.directory && typeof b.directory === 'object') {
                push('Directory Product Name', b.directory.productName, 100);
                push('Category', b.directory.category, 80);
                push('Pricing Model', [b.directory.pricingModel, b.directory.startingPrice].filter(Boolean).join(' — '), 120);
                push('Demo URL', b.directory.demoUrl, 200);
                const t = listTexts(b.directory.taglines, 3, 100);
                const p = listTexts(b.directory.pitches, 3, 180);
                const s = listTexts(b.directory.summaries, 2, 280);
                const d = listTexts(b.directory.descriptions, 2, 450);
                if (t) lines.push(`Directory Taglines: ${t}`);
                if (p) lines.push(`Directory Pitches: ${p}`);
                if (s) lines.push(`Directory Summaries: ${s}`);
                if (d) lines.push(`Directory Descriptions: ${d}`);
              }
              if (b.contact && typeof b.contact === 'object') {
                push('Sender Name', b.contact.senderName, 100);
                push('Company', b.contact.company, 100);
                push('Contact Default Subject', b.contact.subject, 160);
                const cm = listTexts(b.contact.messages, 3, 300) || String(b.contact.message || '').trim().slice(0, 300);
                if (cm) lines.push(`Contact Form Message Samples: ${cm}`);
              }
              const cs = listTexts(b.comments, 4, 240);
              if (cs) lines.push(`Saved Comment Samples: ${cs}`);
              const es = listTexts(b.emails, 3, 280);
              if (es) lines.push(`Cold Email Samples: ${es}`);
              const ds = listTexts(b.dms, 3, 240);
              if (ds) lines.push(`DM Samples: ${ds}`);
              const as = listTexts(b.articles, 2, 320);
              if (as) lines.push(`Article Samples: ${as}`);
              return lines.length > 0 ? lines.join('\n') : 'Use ONLY the provided text context.';
            };
            const getModuleGuidance = (mType) => {
              const m = String(mType || '').toLowerCase();
              if (m.includes('tagline')) return 'Target Module: Directory Tagline. Keep it crisp and STRICTLY under 60 characters.';
              if (m.includes('pitch')) return 'Target Module: Directory Elevator Pitch. Keep it compelling and STRICTLY under 140 characters.';
              if (m.includes('summary') || m.includes('summaries')) return 'Target Module: Directory Short Summary. Keep it clear and STRICTLY under 250 characters.';
              if (m.includes('description')) return 'Target Module: Directory Full Description. Provide a well-structured, informative product description.';
              if (m.includes('contact')) return 'Target Module: Contact Form Message body. Write a direct, human outreach contact form message body.';
              if (m === 'email') return 'Target Module: Cold Outreach Email body. Write a clean, high-converting email body.';
              if (m === 'dm') return 'Target Module: Direct Message (DM). Write a conversational, natural DM.';
              if (m === 'article') return 'Target Module: Long-Form Article / Blog Post body. Write well-structured, engaging article prose.';
              return 'Target Module: Social Comment / Outreach post. Keep it natural, human, and concise.';
            };
            const brandContextBlock = buildContextBlock(brand);
            const moduleGuidance = getModuleGuidance(moduleType);
            const hasBoxText = Boolean(String(text || '').trim());

            // Local grammatical candidate generator (also used to pad if needed)
            const normalizeClause = (raw) => {
              const s = String(raw || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
              if (!s) return '';
              return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
            };
            const formatSentence = (raw) => {
              const s = String(raw || '').trim().replace(/\s+/g, ' ');
              if (!s) return '';
              const capped = /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
              return /[.!?]$/.test(capped) ? capped : `${capped}.`;
            };
            const startsWithVerb = (raw) => {
              const first = String(raw || '').trim().toLowerCase().split(/\s+/)[0] || '';
              return new Set([
                'automate', 'boost', 'build', 'connect', 'convert', 'create', 'discover', 'drive',
                'eliminate', 'find', 'fix', 'generate', 'get', 'grow', 'help', 'increase', 'launch',
                'manage', 'optimize', 'promote', 'reduce', 'run', 'save', 'scale', 'schedule',
                'send', 'ship', 'simplify', 'speed', 'streamline', 'submit', 'track', 'transform',
                'turn', 'unlock', 'write'
              ]).has(first);
            };
            const formatSuperlative = (raw) => {
              const s = normalizeClause(raw);
              if (!s) return '';
              if (/^(easiest|best|fastest|simplest|quickest|smartest|most|top)\b/i.test(s) && !/^the\s+/i.test(s)) {
                return `the ${s}`;
              }
              return s;
            };
            const buildCandidatePool = () => {
              const name = brandName || 'this tool';
              const site = brandWebsite || '';
              const firstPitch = brandPitch.split(/(?<=[.!?])\s+/)[0] || brandPitch;
              const tagJoined = formatSuperlative(brandTagline);
              const pitchJoined = normalizeClause(firstPitch);
              const valueSentence = formatSentence(brandPitch || brandTagline || 'Built to save hours of manual work');
              const mod = String(moduleType || '').toLowerCase();
              const senderName = String(brand?.contact?.senderName || '').trim();
              const reqLower = cleanCustomPrompt.toLowerCase();
              const pool = [];
              const siteTail = site ? ` (${site})` : '';
              const siteDash = site ? ` — ${site}` : '';
              const siteAt = site ? ` at ${site}` : '';

              if (mod.includes('tagline')) {
                if (brandTagline) pool.push(brandTagline.slice(0, 60));
                if (tagJoined) pool.push(`${name}: ${tagJoined}`.slice(0, 60));
                if (pitchJoined) pool.push(formatSentence(firstPitch).replace(/\.$/, '').slice(0, 60));
                pool.push(`${name} — Faster, smarter outreach`.slice(0, 60));
              } else if (mod.includes('pitch')) {
                if (brandTagline) {
                  pool.push((startsWithVerb(brandTagline) ? `${name} lets you ${normalizeClause(brandTagline)}${siteDash}` : `${name} is ${tagJoined}${siteDash}`).slice(0, 140));
                }
                if (firstPitch) pool.push(`${name}: ${formatSentence(firstPitch)}`.slice(0, 140));
                pool.push(`Meet ${name}${tagJoined ? ` — ${tagJoined}` : ''}${siteAt}.`.slice(0, 140));
              } else if (mod.includes('summary') || mod.includes('summaries')) {
                const core = brandPitch || brandTagline || 'Streamlines daily outreach and saves hours every week.';
                pool.push(`${name}: ${formatSentence(core)}${site ? ` Learn more at ${site}.` : ''}`.slice(0, 250));
                if (tagJoined) pool.push(`Designed as ${tagJoined}, ${name} ${pitchJoined ? `offers ${pitchJoined}` : 'helps teams ship faster'}${siteAt}.`.slice(0, 250));
              } else if (mod === 'email') {
                const signOff = senderName ? `\n\nBest,\n${senderName}` : '';
                pool.push(`Hi there,\n\nI wanted to share ${name}${tagJoined ? ` — ${tagJoined}` : ''}. ${valueSentence}${site ? `\n\nYou can take a quick look here: ${site}` : ''}${signOff}`);
                pool.push(`Hello,\n\nQuick note: we built ${name} for teams looking for ${tagJoined || 'a faster workflow'}. ${valueSentence}${site ? `\n\nExplore more at ${site}.` : ''}${signOff}`);
              } else if (mod === 'dm') {
                pool.push(`Hey! Saw your post and thought ${name} might be useful${tagJoined ? ` — it's ${tagJoined}` : ''}.${site ? ` Happy to share the link if helpful: ${site}` : ''}`);
                pool.push(`Quick heads up — if you're exploring options for ${tagJoined || 'this workflow'}, ${name} is worth a look${siteAt}.`);
              } else if (mod.includes('contact')) {
                const signOff = senderName ? `\n\nThanks,\n${senderName}` : '';
                pool.push(`Hi team,\n\nReaching out regarding ${name}${tagJoined ? ` (${tagJoined})` : ''}. ${valueSentence}${site ? ` Feel free to check out ${site} if that sounds relevant.` : ''}${signOff}`);
                pool.push(`Hello,\n\nWanted to introduce ${name}. ${valueSentence}${site ? ` You can see how it works at ${site}.` : ''}${signOff}`);
              } else if (mod === 'article') {
                pool.push(`## Why ${name} Stands Out\n\n${valueSentence}\n\nWhether you're just getting started or scaling an existing workflow${tagJoined ? `, ${name} gives you ${tagJoined}` : ''}.${site ? ` Explore more at ${site}.` : ''}`);
                pool.push(`### A Smarter Approach with ${name}\n\n${brandTagline ? `${formatSentence(brandTagline)} ` : ''}${valueSentence}${site ? `\n\nLearn more at ${site}.` : ''}`);
              } else {
                if (brandTagline && startsWithVerb(brandTagline)) {
                  pool.push(`${name} makes it easy to ${normalizeClause(brandTagline)}${siteDash}`);
                  pool.push(`Been using ${name} to ${normalizeClause(brandTagline)}${site ? ` — worth checking out at ${site}` : '.'}`);
                } else if (tagJoined) {
                  pool.push(`${name} has been my go-to for ${tagJoined}${siteDash}`);
                  pool.push(`If you're looking for ${tagJoined}, ${name} is worth a look${siteAt}.`);
                  pool.push(`I've been using ${name} lately (${tagJoined})${site ? ` — you can check it out at ${site}` : '.'}`);
                  pool.push(`Quick recommendation: ${name} is ${tagJoined}${siteTail}.`);
                }
                if (firstPitch) {
                  pool.push(`${formatSentence(firstPitch)} That's why I like ${name}${siteAt}.`);
                  pool.push(`Worth checking out ${name} — ${normalizeClause(firstPitch)}${siteAt}.`);
                }
                pool.push(`You might find ${name} helpful${tagJoined ? ` if you want ${tagJoined}` : ''}${siteDash}`);
                pool.push(`Check out ${name}${siteAt} — ${brandPitch ? normalizeClause(firstPitch) : (tagJoined || 'solid workflow tool')}.`);
                pool.push(`Been testing ${name} recently and it saves a ton of time${site ? ` (${site})` : '.'}`);
              }

              if (reqLower) {
                return pool.map((item) => {
                  let out = item;
                  if (/\b(emoji|emojis)\b/.test(reqLower) && !/[✨🚀💡🔥]/.test(out)) out = `${out} ✨`;
                  if (/\b(short|concise|brief|shorter)\b/.test(reqLower) && out.length > 140) {
                    out = out.slice(0, 137).replace(/\s+\S*$/, '').trim() + '...';
                  }
                  if (/\b(professional|formal|b2b|polite)\b/.test(reqLower)) {
                    out = out.replace(/^Hey!\s*/i, 'Hello — ').replace(/\bcheck out\b/gi, 'explore');
                  }
                  return out;
                });
              }
              return pool;
            };

            const buildLocalVariations = (seedText, needCount, extraExclude = []) => {
              const clean = String(seedText || '').trim();
              const protectedUrls = [];
              const maskUrls = (s) => s.replace(/https?:\/\/[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz)(?:\/[^\s]*)?/gi, (m) => {
                const idx = protectedUrls.length;
                protectedUrls.push(m);
                return `__URL_${idx}__`;
              });
              const unmaskUrls = (s) => s.replace(/__URL_(\d+)__/g, (_, i) => protectedUrls[Number(i)] || '');

              const singleTransform = (s) => {
                const c = String(s || '').trim();
                if (action === 'custom') {
                  const reqLower = cleanCustomPrompt.toLowerCase();
                  if (!c) return buildCandidatePool()[0] || '';
                  if (/\b(short|concise|brief|shorter|condense)\b/.test(reqLower)) {
                    return unmaskUrls(maskUrls(c).replace(/\b(basically|actually|honestly|literally|really|very|quite|simply|just)\b\s*/gi, '').replace(/\s{2,}/g, ' ').trim());
                  }
                  if (/\bemoji\b/.test(reqLower)) return `${c} ✨`;
                  if (/\b(professional|formal|b2b|polite|business)\b/.test(reqLower)) {
                    return unmaskUrls(
                      maskUrls(c)
                        .replace(/^(hey|yo|hiya|hi there)[,!.\s]+/i, 'Hello, ')
                        .replace(/\bawesome\b/gi, 'valuable')
                        .replace(/\bsuper\b/gi, 'highly')
                        .replace(/\bcheck out\b/gi, 'explore')
                        .replace(/\bguys\b/gi, 'team')
                        .replace(/!{2,}/g, '.')
                        .replace(/\s{2,}/g, ' ')
                        .trim()
                    );
                  }
                  return c;
                }
                if (action === 'refine') {
                  let out = maskUrls(c)
                    .replace(/\b(basically|actually|honestly|literally|really|very|quite|simply|just|kind of|sort of)\b\s*/gi, '')
                    .replace(/\bin order to\b/gi, 'to')
                    .replace(/\bdue to the fact that\b/gi, 'because')
                    .replace(/\ba lot of\b/gi, 'many')
                    .replace(/\bis able to\b/gi, 'can')
                    .replace(/\s+([,.!?;:])/g, '$1')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
                  if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
                  return unmaskUrls(out) || c;
                }
                if (action === 'rewrite') {
                  let out = maskUrls(c);
                  const swaps = [
                    [/\bcheck out\b/gi, 'take a look at'],
                    [/\btake a look at\b/gi, 'try out'],
                    [/\bhelps you\b/gi, 'makes it easy to'],
                    [/\blets you\b/gi, 'helps you'],
                    [/\bbuilt\b/gi, 'put together'],
                    [/\bcreated\b/gi, 'built'],
                    [/\bgreat\b/gi, 'solid'],
                    [/\bawesome\b/gi, 'really helpful'],
                    [/\bquick\b/gi, 'fast'],
                    [/\bsimple\b/gi, 'straightforward'],
                    [/\bwithout\b/gi, 'minus'],
                    [/\bbecause\b/gi, 'since'],
                  ];
                  let changed = false;
                  for (const [re, rep] of swaps) {
                    if (re.test(out)) {
                      out = out.replace(re, rep);
                      changed = true;
                    }
                  }
                  if (!changed && out) {
                    out = `Worth sharing — ${out.charAt(0).toLowerCase() + out.slice(1)}`;
                  }
                  return unmaskUrls(out.replace(/\s{2,}/g, ' ').trim());
                }
                if (action === 'add_emojis') return c ? `${c} ✨🚀` : '';
                return c;
              };

              const excluded = new Set(
                [clean, ...excludeList, ...extraExclude].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
              );

              if (action === 'generate' || action === 'regenerate' || (action === 'custom' && !clean)) {
                const pool = buildCandidatePool();
                const out = [];
                for (const cand of pool) {
                  const t = cand.trim();
                  if (t && !excluded.has(t.toLowerCase())) {
                    excluded.add(t.toLowerCase());
                    out.push(t);
                    if (out.length >= needCount) break;
                  }
                }
                let idx = 0;
                while (out.length < needCount && pool.length > 0) {
                  const base = pool[idx % pool.length].trim();
                  const candidate = idx >= pool.length ? `${base} (v${Math.floor(idx / pool.length) + 1})` : base;
                  if (!out.includes(candidate)) out.push(candidate);
                  idx++;
                  if (idx > 30) break;
                }
                return out;
              }

              const out = [];
              let curr = clean;
              for (let i = 0; i < needCount; i++) {
                const next = singleTransform(curr);
                const chosen = next && !out.includes(next)
                  ? next
                  : (buildCandidatePool().find((c) => !excluded.has(c.toLowerCase()) && !out.includes(c)) || next);
                if (chosen) {
                  out.push(chosen);
                  excluded.add(chosen.toLowerCase());
                  curr = chosen;
                }
              }
              return out;
            };

            const padVariations = (items) => {
              const cleanItems = items.map((s) => String(s || '').trim()).filter(Boolean);
              if (cleanItems.length >= parsedCount) return cleanItems.slice(0, parsedCount);
              const extras = buildLocalVariations(text, parsedCount - cleanItems.length, cleanItems);
              return [...cleanItems, ...extras].slice(0, parsedCount);
            };

            // 1. Attempt portal backend server endpoint (with verified Bearer token when signed in)
            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
            const activeSession = storedKeys?.authUserSession || storedKeys?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';
            const serverUrl = `${base}/api/ai/action`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
              const res = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                  action,
                  text,
                  customPrompt: cleanCustomPrompt,
                  moduleType,
                  brand,
                  ...(effectiveKey ? { openRouterKey: effectiveKey } : {}),
                  ...(effectiveGeminiKey ? { geminiApiKey: effectiveGeminiKey } : {}),
                  aiModel: effectiveModel,
                  variationCount: parsedCount,
                  existingTexts: excludeList
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const data = await res.json().catch(() => null);
              if (res.ok && data && data.success && (data.text || Array.isArray(data.variations))) {
                const vars = Array.isArray(data.variations) && data.variations.length > 0
                  ? data.variations
                  : [data.text];
                sendResponse({ success: true, text: vars[0] || data.text || '', variations: vars });
                return;
              }
              if (res.status === 401 && data?.needsApiKey && !effectiveKey && !effectiveGeminiKey) {
                sendResponse({ success: false, needsApiKey: true, error: data.error || 'Please add your OpenRouter or Google Gemini API Key in Settings.' });
                return;
              }
            } catch (err) {
              clearTimeout(timeoutId);
            }

            // 2. Attempt OpenRouter or Gemini directly with BYOK key
            if (effectiveKey || effectiveGeminiKey) {
              const avoidBlock = excludeList.length > 0
                ? `\n\nExisting Variations to Avoid Repeating (write something genuinely fresh and distinct):\n${excludeList.slice(0, 6).map((s, i) => `${i + 1}. ${s.slice(0, 220)}`).join('\n')}`
                : '';
              const multiVarRule = parsedCount > 1
                ? `\n\nCRITICAL OUTPUT FORMAT: Generate EXACTLY ${parsedCount} distinct, non-repetitive variations. Return ONLY valid JSON: {"variations": ["...", "..."]}.`
                : '';

              let sysPrompt = '';
              let userPrompt = '';
              if (action === 'rewrite') {
                sysPrompt = "You are an expert copywriter. Create another distinct variation of the provided text while keeping the core message, pitch, links/URLs, and exact tone/voice consistent. CRITICAL RULES: 1) Do NOT change the tone (keep casual casual, direct direct). 2) Do NOT simply reorder or reverse sentences — genuinely rephrase cleanly. 3) Keep all URLs and product facts exact. 4) Output ONLY the rewritten text, with no quotes or commentary.";
                userPrompt = `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}\n\nText Currently in Box (rewrite keeping same pitch, links, and tone):\n${text}${avoidBlock}\n\nRewritten variation:`;
              } else if (action === 'refine') {
                sysPrompt = "You are an expert copy editor. Make the provided text tighter, sharper, clearer, and more effective. CRITICAL RULES: 1) Cut filler words, fluff, and redundancy so it reads crisper and stronger. 2) Keep 100% of the core message, links/URLs, pitch, and original tone/voice. 3) Output ONLY the refined text, with no quotes or commentary.";
                userPrompt = `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}\n\nText Currently in Box (tighten and sharpen):\n${text}\n\nRefined text:`;
              } else if (action === 'add_emojis') {
                sysPrompt = "You are a social engagement specialist. Add 2 to 3 relevant, tasteful emojis to the text at natural breaks. Do NOT alter, add, or delete any words or links. Output ONLY the updated text.";
                userPrompt = `Text Currently in Box:\n${text}`;
              } else if (action === 'generate') {
                sysPrompt = "You are an expert outreach copywriter. Write fresh, natural, grammatically fluent, high-converting copy grounded strictly in the complete active Product details. Never invent unrelated products or fake URLs. Vary your angle and phrasing from any existing variations. Output ONLY the final copy text.";
                userPrompt = hasBoxText
                  ? `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}\n\nReference Text Currently in Box:\n${text}${avoidBlock}\n\nGenerate fresh, high-converting copy for this product that takes a fresh angle:`
                  : `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}${avoidBlock}\n\nGenerate fresh, natural, high-converting copy for this active product:`;
              } else if (action === 'regenerate') {
                sysPrompt = "You are an expert outreach copywriter. Regenerate a completely fresh, natural, grammatically fluent alternative based on the complete active Product context. It MUST differ meaningfully from the previous draft and any existing variations. Output ONLY the regenerated copy text.";
                userPrompt = hasBoxText
                  ? `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}\n\nPrevious Version to Replace (do NOT repeat this phrasing):\n${text}${avoidBlock}\n\nRegenerate a fresh, distinct alternative:`
                  : `${moduleGuidance}\n\nActive Product Context:\n${brandContextBlock}${avoidBlock}\n\nRegenerate a fresh, distinct piece of copy for this active product:`;
              } else if (action === 'custom') {
                sysPrompt = "You are an expert marketing and outreach copywriter inside Smart Poster. Execute the user's custom instruction precisely using BOTH the provided draft text (if present) AND the complete active product/brand materials provided in context. Never invent unrelated products or fake URLs. Respect any module character limits or formatting guidance." +
                  (parsedCount > 1
                    ? ` Generate EXACTLY ${parsedCount} distinct variations and return ONLY valid JSON: {"variations": ["..."]}.`
                    : ' Output ONLY the final copy text with no surrounding quotes, labels, or commentary.');
                userPrompt = `${moduleGuidance}\n\nComplete Active Product Materials:\n${brandContextBlock}\n\n${hasBoxText ? `Current Text in Box:\n${text}\n\n` : 'Current Text in Box: (empty — generate directly from the product materials above)\n\n'}User Custom Requirement:\n${cleanCustomPrompt}${avoidBlock}${multiVarRule}\n\n${parsedCount > 1 ? `Return valid JSON with ${parsedCount} distinct variations:` : 'Deliver ONLY the final updated copy:'}`;
              }

              const baseMaxTokens = String(moduleType || '').toLowerCase() === 'article' ? 1400 : 700;
              const temp = action === 'refine' ? 0.35 : (action === 'regenerate' ? 0.85 : 0.72);
              const maxTok = parsedCount > 1 ? Math.min(4000, baseMaxTokens * Math.min(parsedCount, 5)) : baseMaxTokens;
              let out = '';

              if (effectiveKey) {
                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveKey}`,
                    'HTTP-Referer': 'https://contactformsubmitter.pro',
                    'X-Title': 'Smart Poster'
                  },
                  body: JSON.stringify({
                    model: effectiveModel,
                    messages: [
                      { role: 'system', content: sysPrompt },
                      { role: 'user', content: userPrompt }
                    ],
                    temperature: temp,
                    max_tokens: maxTok
                  })
                });
                if (orRes.ok) {
                  const orData = await orRes.json();
                  out = orData.choices?.[0]?.message?.content?.trim() || '';
                }
              }

              if (!out && effectiveGeminiKey) {
                const gemOut = await callGeminiDirectBg({
                  geminiKey: effectiveGeminiKey,
                  systemInstruction: sysPrompt,
                  messages: [{ role: 'user', content: userPrompt }],
                  temperature: temp,
                  maxOutputTokens: maxTok
                }).catch(() => null);
                if (gemOut?.ok && gemOut.text) {
                  out = gemOut.text.trim();
                }
              }

              if (out) {
                const finalVariations = padVariations(parseVariationsFromOutput(out, parsedCount));
                sendResponse({ success: true, text: finalVariations[0], variations: finalVariations });
                return;
              }
            }

            // 3. Fallback: Smart local rule-based variations (grammatical & non-repetitive)
            const fallbackVariations = buildLocalVariations(text, parsedCount);
            sendResponse({ success: true, text: fallbackVariations[0] || '', variations: fallbackVariations });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        })();
        return true;
      }

      case 'matchThreadContext': {
        const { threadTitle = '', threadBody = '', variations = [] } = message;
        (async () => {
          try {
            // 1. Attempt portal backend server endpoint (with verified Bearer token when signed in)
            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
            const authData = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session', 'apiKey', 'geminiApiKey'], r));
            const activeSession = authData?.authUserSession || authData?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';
            const effOrKey = String(apiKey || authData?.apiKey || '').trim();
            const effGemKey = String(geminiApiKey || authData?.geminiApiKey || '').trim();
            const serverUrl = `${base}/api/ai/match-context`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            try {
              const res = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                  threadTitle,
                  threadBody,
                  variations,
                  ...(effOrKey ? { openRouterKey: effOrKey } : {}),
                  ...(effGemKey ? { geminiApiKey: effGemKey } : {})
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              if (res.ok) {
                const data = await res.json();
                if (data && data.success && typeof data.bestIndex === 'number') {
                  sendResponse({ success: true, bestIndex: data.bestIndex, reason: data.reason });
                  return;
                }
              }
            } catch (err) {
              clearTimeout(timeoutId);
            }

            // 2. Fallback keyword heuristic matching
            const combined = `${threadTitle} ${threadBody}`.toLowerCase();
            let bestScore = -1;
            let bestIdx = 0;
            if (Array.isArray(variations)) {
              variations.forEach((v, idx) => {
                const words = (v || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
                let score = 0;
                words.forEach(w => {
                  if (combined.includes(w)) score += 2;
                });
                if (score > bestScore) {
                  bestScore = score;
                  bestIdx = idx;
                }
              });
            }
            sendResponse({ success: true, bestIndex: bestIdx, reason: 'Keyword context alignment' });
          } catch (e) {
            sendResponse({ success: true, bestIndex: 0, error: e.message });
          }
        })();
        return true;
      }

      case 'BACKUP_EXTENSION_VAULT': {
        pushVaultSnapshotNow()
          .then((r) => sendResponse(r || { success: true }))
          .catch((e) => sendResponse({ success: false, error: e?.message || 'Backup failed' }));
        return true;
      }

      case 'RESTORE_EXTENSION_VAULT': {
        restoreVaultOnStartupOrInstall(Boolean(message.force))
          .then((r) => sendResponse(r || { success: true }))
          .catch((e) => sendResponse({ success: false, error: e?.message || 'Restore failed' }));
        return true;
      }

      case 'fetchSiteMetadata': {
        const rawUrl = String(message.url || '').trim();
        (async () => {
          try {
            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'https://smartposter.pro').replace(/\/+$/, '');
            const authData = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], r));
            const activeSession = authData?.authUserSession || authData?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500);
            try {
              const res = await fetch(`${base}/api/ai/fetch-site-metadata`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({ url: rawUrl }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const json = await res.json().catch(() => null);
              if (res.ok && json?.success && (json.site || json.context)) {
                sendResponse({ success: true, site: json.site || json.context, context: json.context || json.site });
                return;
              }
            } catch {
              clearTimeout(timeoutId);
            }

            // Direct HTML fetch fallback from extension service worker (<all_urls> permission)
            const directSite = await fetchSiteMetadataDirectBg(rawUrl).catch(() => null);
            if (directSite) {
              sendResponse({ success: true, site: directSite, context: directSite });
              return;
            }
            sendResponse({ success: false, error: 'Could not fetch site metadata.' });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'Site metadata fetch failed' });
          }
        })();
        return true;
      }

      case 'autoGenerateModule': {
        const { module: targetMod, brand = {}, landingContext = null, articlePreset = '', targetKeyword = '', openRouterKey = '', geminiApiKey: reqGeminiKey = '', aiModel = '' } = message;
        const enrichedBrand = {
          ...brand,
          ...(articlePreset ? { articlePreset } : {}),
          ...(targetKeyword ? { targetKeyword } : {})
        };
        (async () => {
          try {
            const storedAi = await new Promise((r) =>
              chrome.storage.local.get(['apiKey', 'geminiApiKey', 'aiModel', 'settings', 'authUserSession', 'cf_auth_session'], (d) => r(d || {}))
            );
            const syncAi = await new Promise((r) =>
              chrome.storage.sync ? chrome.storage.sync.get(['apiKey', 'geminiApiKey', 'aiModel', 'settings'], (d) => r(d || {})) : r({})
            );
            const effectiveKey = String(
              openRouterKey || apiKey || storedAi.apiKey || syncAi.apiKey || storedAi.settings?.apiKey || syncAi.settings?.apiKey || ''
            ).trim();
            const effectiveGeminiKey = String(
              reqGeminiKey || geminiApiKey || storedAi.geminiApiKey || syncAi.geminiApiKey || storedAi.settings?.geminiApiKey || syncAi.settings?.geminiApiKey || ''
            ).trim();
            const effectiveModel = String(
              aiModel || openRouterModel || storedAi.aiModel || syncAi.aiModel || storedAi.settings?.aiModel || 'deepseek/deepseek-chat'
            ).trim();

            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'https://smartposter.pro').replace(/\/+$/, '');
            const activeSession = storedAi?.authUserSession || storedAi?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';

            // 1. Try backend endpoint first
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 22000);
              const res = await fetch(`${base}/api/ai/auto-generate-module`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                  module: targetMod,
                  brand: enrichedBrand,
                  landingContext,
                  ...(articlePreset ? { articlePreset } : {}),
                  ...(targetKeyword ? { targetKeyword } : {}),
                  ...(effectiveKey ? { openRouterKey: effectiveKey } : {}),
                  ...(effectiveGeminiKey ? { geminiApiKey: effectiveGeminiKey } : {}),
                  ...(effectiveModel ? { aiModel: effectiveModel } : {})
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const json = await res.json().catch(() => null);
              if (res.ok && json?.success && json?.data) {
                sendResponse(json);
                return;
              }
            } catch (_) {}

            // 2. Enrich landing context directly if needed
            let resolvedLanding = landingContext || null;
            const brandUrl = String(brand?.url || brand?.websiteUrl || brand?.website || '').trim();
            if (brandUrl && (!resolvedLanding || !resolvedLanding.heroText || !resolvedLanding.bodyCopy)) {
              const directSite = await fetchSiteMetadataDirectBg(brandUrl).catch(() => null);
              if (directSite) {
                resolvedLanding = {
                  ...(resolvedLanding || {}),
                  metaTitle: resolvedLanding?.metaTitle || directSite.metaTitle || directSite.title || '',
                  metaDescription: resolvedLanding?.metaDescription || directSite.metaDescription || directSite.description || '',
                  heroHeadline: resolvedLanding?.heroHeadline || directSite.heroHeadline || '',
                  heroText: resolvedLanding?.heroText || directSite.heroText || '',
                  headings: resolvedLanding?.headings?.length ? resolvedLanding.headings : (directSite.headings || []),
                  ctaTexts: resolvedLanding?.ctaTexts?.length ? resolvedLanding.ctaTexts : (directSite.ctaTexts || []),
                  bodyCopy: resolvedLanding?.bodyCopy || directSite.bodyCopy || ''
                };
              }
            }

            // 3. Try direct OpenRouter or Gemini AI call from background if key is configured
            if (effectiveKey || effectiveGeminiKey) {
              const aiResult = await callOpenRouterAutoGenerateBg(targetMod, enrichedBrand, resolvedLanding, effectiveKey, effectiveModel, effectiveGeminiKey).catch(() => null);
              if (aiResult && aiResult.data) {
                sendResponse({
                  success: true,
                  module: targetMod,
                  data: aiResult.data,
                  landingContext: resolvedLanding,
                  source: aiResult.source
                });
                return;
              }
            }

            // 4. Deterministic high-craft landing-copy synthesis fallback (zero AI required)
            const localData = buildLocalAutoGenerateBg(targetMod, enrichedBrand, resolvedLanding);
            sendResponse({
              success: true,
              module: targetMod,
              data: localData,
              landingContext: resolvedLanding,
              source: 'extension-local-synthesis'
            });
          } catch (e) {
            try {
              const fallbackData = buildLocalAutoGenerateBg(targetMod, enrichedBrand, landingContext);
              sendResponse({
                success: true,
                module: targetMod,
                data: fallbackData,
                landingContext,
                source: 'extension-local-synthesis'
              });
            } catch (innerErr) {
              sendResponse({ success: false, error: innerErr?.message || e?.message || 'Auto-generate failed' });
            }
          }
        })();
        return true;
      }

      case 'aiAssistantScanUrl': {
        const rawUrl = String(message.url || '').trim();
        const effectiveKey = String(message.openRouterKey || apiKey || '').trim();
        const effectiveGeminiKey = String(message.geminiApiKey || geminiApiKey || '').trim();
        (async () => {
          const normalizeUrl = (input) => {
            const trimmed = String(input || '').trim();
            if (!trimmed) return null;
            const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            try {
              const u = new URL(withProto);
              return (u.protocol === 'http:' || u.protocol === 'https:') ? u : null;
            } catch {
              return null;
            }
          };

          const urlObj = normalizeUrl(rawUrl);
          if (!urlObj) {
            sendResponse({ success: false, error: 'Please provide a valid HTTP/HTTPS URL.' });
            return;
          }

          try {
            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
            const authData = await new Promise((r) => chrome.storage.local.get(['authUserSession', 'cf_auth_session'], r));
            const activeSession = authData?.authUserSession || authData?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9500);
            try {
              const res = await fetch(`${base}/api/ai/analyze-url`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                  url: urlObj.href,
                  ...(effectiveKey ? { openRouterKey: effectiveKey } : {}),
                  ...(effectiveGeminiKey ? { geminiApiKey: effectiveGeminiKey } : {})
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const json = await res.json().catch(() => null);
              const scannedSite = json?.site || json?.context || null;
              if (res.ok && json?.success && scannedSite) {
                sendResponse({ success: true, site: scannedSite, context: scannedSite });
                return;
              }
              if (json && json.error && res.status >= 400 && res.status < 500) {
                sendResponse({ success: false, error: json.error });
                return;
              }
            } catch {
              clearTimeout(timeoutId);
            }

            // Direct extension fetch fallback if portal backend is unreachable
            const directCtrl = new AbortController();
            const directTimer = setTimeout(() => directCtrl.abort(), 8000);
            const pageRes = await fetch(urlObj.href, { signal: directCtrl.signal });
            clearTimeout(directTimer);
            if (!pageRes.ok) {
              sendResponse({ success: false, error: `HTTP ${pageRes.status} while scanning ${urlObj.hostname}` });
              return;
            }
            const html = (await pageRes.text()).slice(0, 400000);
            const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
            const headings = [];
            const seenH = new Set();
            const hRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
            let hm;
            while ((hm = hRe.exec(html)) !== null && headings.length < 12) {
              const txt = strip(hm[1]);
              if (txt && txt.length >= 3 && txt.length <= 220 && !seenH.has(txt.toLowerCase())) {
                seenH.add(txt.toLowerCase());
                headings.push(txt);
              }
            }
            const strippedHtml = html
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
              .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
              .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
              .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
            const ctaTexts = [];
            const seenCta = new Set();
            const ctaRe = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
            let cm;
            while ((cm = ctaRe.exec(strippedHtml)) !== null && ctaTexts.length < 8) {
              const txt = strip(cm[1]);
              if (txt && txt.length >= 2 && txt.length <= 60 && !seenCta.has(txt.toLowerCase())) {
                seenCta.add(txt.toLowerCase());
                ctaTexts.push(txt);
              }
            }
            const cleanedBody = strip(strippedHtml).slice(0, 3500);
            const metaDesc = descMatch ? descMatch[1].trim().slice(0, 500) : '';
            const scannedCtx = {
              sourceType: 'url',
              url: urlObj.href,
              domain: urlObj.hostname.replace(/^www\./, ''),
              title: strip(titleMatch ? titleMatch[1] : '') || urlObj.hostname,
              metaDescription: metaDesc,
              description: metaDesc,
              headings,
              ctaTexts,
              bodyCopy: cleanedBody,
              copy: cleanedBody,
              scannedAt: new Date().toISOString()
            };

            sendResponse({
              success: true,
              site: scannedCtx,
              context: scannedCtx
            });
          } catch (err) {
            sendResponse({ success: false, error: err?.message || 'Failed to scan URL' });
          }
        })();
        return true;
      }

      case 'aiAssistantChat': {
        const {
          messages = [],
          brandContext = null,
          brand = {},
          scannedSites = [],
          scannedContexts = [],
          activeTabContext = null,
          autoScanUrls = true,
          openRouterKey = '',
          geminiApiKey: reqGeminiKey = '',
          aiModel: reqAiModel = '',
          postingRulesSummary = ''
        } = message;
        const effectiveBrand = (brandContext && typeof brandContext === 'object' && Object.keys(brandContext).length > 0)
          ? brandContext
          : (brand || {});
        const effectiveScannedSites = Array.isArray(scannedSites) && scannedSites.length > 0
          ? scannedSites
          : (Array.isArray(scannedContexts) ? scannedContexts : []);

        (async () => {
          try {
            const authData = await new Promise((r) =>
              chrome.storage.local.get(['authUserSession', 'cf_auth_session', 'apiKey', 'geminiApiKey', 'aiModel', 'settings'], r)
            );
            const effectiveKey = String(openRouterKey || apiKey || authData?.apiKey || authData?.settings?.apiKey || '').trim();
            const effectiveGeminiKey = String(reqGeminiKey || geminiApiKey || authData?.geminiApiKey || authData?.settings?.geminiApiKey || '').trim();
            const effectiveModel = String(reqAiModel || authData?.aiModel || authData?.settings?.aiModel || openRouterModel || '').trim() || 'deepseek/deepseek-chat';

            if (!effectiveKey && !effectiveGeminiKey) {
              sendResponse({
                success: false,
                needsApiKey: true,
                error: 'Please add your OpenRouter or Google Gemini API Key in Settings before using the AI Marketer Assistant.'
              });
              return;
            }

            const cfg = await ensurePortalAndSupabaseConfig(false);
            const base = (cfg.appBaseUrl || appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
            const activeSession = authData?.authUserSession || authData?.cf_auth_session || null;
            const authToken = activeSession?.accessToken || activeSession?.token || '';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 35000);
            try {
              const res = await fetch(`${base}/api/ai/marketer-chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                  messages,
                  brandContext: effectiveBrand,
                  brand: effectiveBrand,
                  scannedSites: effectiveScannedSites,
                  scannedContexts: effectiveScannedSites,
                  activeTabContext,
                  autoScanUrls,
                  ...(effectiveKey ? { openRouterKey: effectiveKey } : {}),
                  ...(effectiveGeminiKey ? { geminiApiKey: effectiveGeminiKey } : {}),
                  aiModel: effectiveModel,
                  postingRulesSummary
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const data = await res.json().catch(() => null);
              if (res.ok && data?.success) {
                const normalized = Array.isArray(data.assets) ? data.assets : (Array.isArray(data.deliverables) ? data.deliverables : []);
                sendResponse({ ...data, assets: normalized, deliverables: normalized });
                return;
              }
              if (data && data.error) {
                sendResponse({
                  success: false,
                  needsApiKey: Boolean(data.needsApiKey),
                  error: data.error
                });
                return;
              }
            } catch {
              clearTimeout(timeoutId);
            }

            // Direct OpenRouter or Gemini fallback if portal backend is unreachable
            const brandBlock = effectiveBrand?.name || effectiveBrand?.url
              ? `Active Product: ${effectiveBrand.name || ''} (${effectiveBrand.url || ''})\nTagline: ${effectiveBrand.tagline || ''}\nDescription: ${effectiveBrand.description || ''}`
              : 'No active product configured.';
            const ctxList = [
              ...(activeTabContext ? [{ ...activeTabContext, sourceType: 'tab' }] : []),
              ...effectiveScannedSites
            ];
            const ctxBlock = ctxList.length
              ? ctxList.map((c, i) => [
                  `[Source ${i + 1}: ${c.domain || c.url}]`,
                  c.title ? `Title: ${c.title}` : '',
                  (c.metaDescription || c.description) ? `Meta Description: ${c.metaDescription || c.description}` : '',
                  Array.isArray(c.headings) && c.headings.length ? `Headings: ${c.headings.join(' | ')}` : '',
                  Array.isArray(c.ctaTexts) && c.ctaTexts.length ? `CTAs: ${c.ctaTexts.join(' | ')}` : '',
                  `Copy: ${(c.bodyCopy || c.copy || '').slice(0, 2600)}`
                ].filter(Boolean).join('\n')).join('\n\n')
              : 'No scanned website context.';

            const sysPrompt = `You are a Senior AI Marketer & Copywriter inside Smart Poster. Write soft-promotional, value-first, non-salesy copy by default and informative short/long-form articles when requested. Avoid robotic clichés.
Platform & Directory Rules:
- Twitter / X: NEVER include "https://" or "http://"—use clean domain names like "domain.com".
- Directory limits: "directory_tagline" <= 60 chars, "directory_pitch" <= 140 chars, "directory_summary" <= 250 chars, "directory_description" full overview.
${postingRulesSummary ? `Additional Rules:\n${postingRulesSummary}\n` : ''}${brandBlock}
${ctxBlock}

Return ONLY valid JSON:
{
  "reply": "Conversational strategist response",
  "assets": [
    {
      "id": "asset-1",
      "suggestedModule": "email" | "contact" | "dm" | "comment" | "article" | "directory_tagline" | "directory_pitch" | "directory_summary" | "directory_description",
      "label": "Short title",
      "platform": "Optional e.g. Twitter|LinkedIn|Reddit",
      "subject": "Optional subject",
      "title": "Optional article title",
      "body": "Ready-to-use copy"
    }
  ]
}`;

            let raw = '';
            let usedModel = effectiveModel;
            if (effectiveKey) {
              const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${effectiveKey}`,
                  'HTTP-Referer': 'https://smartposter.pro',
                  'X-Title': 'Smart Poster AI Marketer Assistant'
                },
                body: JSON.stringify({
                  model: effectiveModel,
                  messages: [
                    { role: 'system', content: sysPrompt },
                    ...messages.slice(-16)
                  ],
                  temperature: 0.7,
                  max_tokens: 3600
                })
              });

              if (!orRes.ok) {
                if (!effectiveGeminiKey) {
                  const errBody = await orRes.json().catch(() => null);
                  sendResponse({
                    success: false,
                    needsApiKey: orRes.status === 401 || orRes.status === 403,
                    error: errBody?.error?.message || `OpenRouter HTTP ${orRes.status}`
                  });
                  return;
                }
              } else {
                const orData = await orRes.json();
                raw = String(orData?.choices?.[0]?.message?.content || '').trim();
              }
            }

            if (!raw && effectiveGeminiKey) {
              const gemRes = await callGeminiDirectBg({
                geminiKey: effectiveGeminiKey,
                systemInstruction: sysPrompt,
                messages: messages.slice(-16),
                temperature: 0.7,
                maxOutputTokens: 3600
              });
              if (!gemRes.ok) {
                sendResponse({
                  success: false,
                  needsApiKey: gemRes.status === 401 || gemRes.status === 403 || gemRes.status === 400,
                  error: gemRes.error || `Gemini HTTP ${gemRes.status}`
                });
                return;
              }
              raw = gemRes.text;
              usedModel = 'gemini-2.5-flash';
            }

            const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
            let reply = raw;
            let rawAssets = [];
            try {
              const obj = JSON.parse(stripped);
              if (obj && typeof obj === 'object') {
                reply = typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim() : 'Here are the generated variations:';
                rawAssets = Array.isArray(obj.assets) ? obj.assets : (Array.isArray(obj.deliverables) ? obj.deliverables : []);
              }
            } catch {
              const fb = stripped.indexOf('{');
              const lb = stripped.lastIndexOf('}');
              if (fb !== -1 && lb > fb) {
                try {
                  const obj = JSON.parse(stripped.slice(fb, lb + 1));
                  reply = typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim() : reply;
                  rawAssets = Array.isArray(obj.assets) ? obj.assets : (Array.isArray(obj.deliverables) ? obj.deliverables : []);
                } catch {}
              }
            }

            const assets = rawAssets
              .filter((item) => item && typeof item === 'object' && (item.body || item.content || item.text))
              .map((item, idx) => {
                const bodyText = String(item.body || item.content || item.text || '').trim();
                return {
                  ...item,
                  id: String(item.id || `asset-${Date.now()}-${idx + 1}`),
                  body: bodyText,
                  content: bodyText
                };
              });

            sendResponse({
              success: true,
              reply,
              assets,
              deliverables: assets,
              scannedSources: [],
              model: usedModel
            });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'AI Assistant chat failed' });
          }
        })();
        return true;
      }

      case 'consumeAutoVariation': {
        (async () => {
          try {
            const result = await VariationPoolManager.consumeOrFallback(message.text || '', {
              level: message.level,
              brand: message.brand || null,
              brandName: message.brandName || '',
              synonymsEnabled: message.synonymsEnabled,
              dictsText: message.dictsText,
              customDicts: message.customDicts,
              skipWarm: Boolean(message.skipWarm)
            });
            sendResponse({ success: true, ...result });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'consumeAutoVariation failed' });
          }
        })();
        return true;
      }

      case 'prewarmAutoVariationPool': {
        (async () => {
          try {
            if (message.text) {
              const res = await VariationPoolManager.warmTemplate(
                message.text,
                message.level || 4,
                message.brand || null,
                { force: Boolean(message.force), count: message.count || POOL_TARGET_BATCH }
              );
              sendResponse({ success: true, ...res });
            } else {
              const res = await VariationPoolManager.prewarmForBrand({
                brand: message.brand || null,
                level: message.level,
                comments: message.comments,
                force: Boolean(message.force)
              });
              sendResponse({ success: true, ...res });
            }
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'prewarmAutoVariationPool failed' });
          }
        })();
        return true;
      }

      case 'getAutoVariationPoolStatus': {
        (async () => {
          try {
            const status = await VariationPoolManager.getStatusSummary({
              level: message.level,
              brand: message.brand || null,
              text: message.text || ''
            });
            sendResponse({ success: true, status });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'getAutoVariationPoolStatus failed' });
          }
        })();
        return true;
      }

      case 'invalidateAutoVariationPool': {
        (async () => {
          try {
            await VariationPoolManager.invalidate({
              text: message.text || '',
              level: message.level,
              brand: message.brand || null
            });
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'invalidateAutoVariationPool failed' });
          }
        })();
        return true;
      }

      default:
        logger.warn('Unknown message type:', msgType);
        sendResponse({ error: 'Unknown message type: ' + msgType });
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (error) {
    logger.error('Error opening sidebar:', error);
  }
});

// Handle global command shortcut: universal-post (Alt+S)
if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    logger.log('Keyboard shortcut command triggered:', command);
    if (command === 'universal-post') {
      try {
        let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tabs || tabs.length === 0) {
          tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;

        const storageArea = chrome.storage.sync || chrome.storage.local;
        const localAuthArea = chrome.storage.local || chrome.storage.sync;
        const authState = await new Promise((resolve) => {
          localAuthArea.get(['sp_entitlement_claim', 'sp_workspace_bootstrap', 'authUserSession', 'cf_auth_session'], (d) => resolve(d || {}));
        });
        const isPaidTierString = (val, roleVal) => {
          const r = String(roleVal || '').trim().toLowerCase();
          const t = String(val || '').trim().toLowerCase();
          if (r === 'admin') return true;
          return t === 'pro' || t === 'studio' || t === 'unlimited' || t === 'agency' || t === 'team' || t === 'ultra' || t === 'growth' || t === 'lifetime' || t === 'premium' || t.startsWith('pro') || t.startsWith('studio') || t.startsWith('unlimited');
        };
        const claim = authState.sp_entitlement_claim;
        const claimValid = claim && (!claim.expiresAt || Number(claim.expiresAt) > Date.now());
        const boot = authState.sp_workspace_bootstrap;
        const sesUser = (authState.authUserSession || authState.cf_auth_session)?.user;
        const isPro = Boolean(
          (claimValid && isPaidTierString(claim.tier, claim.role)) ||
          boot?.isPro === true ||
          boot?.isUnlimited === true ||
          isPaidTierString(boot?.tier, boot?.role) ||
          isPaidTierString(sesUser?.tier || sesUser?.plan, sesUser?.role)
        );
        storageArea.get(['brandProfiles', 'activeBrandId', 'twitterComments'], (res) => {
          const profiles = res?.brandProfiles || [];
          const activeId = res?.activeBrandId || 'brand-default';
          const brand = profiles.find(p => p.brandId === activeId) || profiles[0] || null;
          if (brand && (!brand.comments || brand.comments.length === 0)) {
            brand.comments = res?.twitterComments || brand.social?.comments || [];
          }

          chrome.tabs.sendMessage(tab.id, {
            type: 'executeUniversalPost',
            brandId: activeId,
            brandData: brand,
            activeUrl: tab.url,
            isPro
          }, (resp) => {
            if (chrome.runtime.lastError) {
              logger.warn('Could not send universal-post to content script:', chrome.runtime.lastError.message);
              return;
            }
            logger.log('Universal post executed via Alt+S:', resp);
            if (resp && resp.success) {
              const actPayload = {
                type: resp.context || 'contact',
                action: resp.copiedToClipboard ? 'injected' : 'submitted',
                status: resp.copiedToClipboard ? 'Injected' : 'Submitted',
                targetUrl: tab.url,
                domain: resp.domain || tab.url,
                details: resp.message || 'Universal Post (Alt+S)'
              };
              const storageKey = `brandReports_${activeId}`;
              const localArea = chrome.storage.local || chrome.storage.sync;
              localArea.get([storageKey], (repRes) => {
                const list = (repRes && Array.isArray(repRes[storageKey])) ? repRes[storageKey] : [];
                list.unshift({
                  id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                  ...actPayload,
                  timestamp: Date.now()
                });
                if (list.length > 200) list.splice(200);
                localArea.set({ [storageKey]: list });
              });
            }
          });
        });
      } catch (err) {
        logger.error('Error executing universal-post shortcut:', err);
      }
    }
    if (command === 'toggle-done') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'toggleDone' }, (resp) => {
            if (chrome.runtime.lastError) {
              logger.warn('Could not send toggleDone to tab:', chrome.runtime.lastError.message);
            }
          });
        }
      } catch (err) {
        logger.error('Error executing toggle-done shortcut:', err);
      }
    }
  });
}

// Phase 4: Context Menus for Saved URLs Multi-Tab Grabber
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  const initContextMenus = () => {
    try {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'save-all-open-tabs',
          title: 'Save All Open Tabs to Smart Poster',
          contexts: ['action', 'page']
        });
      });
    } catch (e) {
      logger.warn('Could not register context menus:', e);
    }
  };

  chrome.runtime.onInstalled.addListener(() => {
    initContextMenus();
  });

  initContextMenus();

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    try {
      const storageArea = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || chrome.storage.sync;
      if (!storageArea) return;

      if (info.menuItemId === 'save-all-open-tabs' || info.menuItemId === 'tb-grab-all-tabs') {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          const validUrls = (tabs || [])
            .filter(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')))
            .map(t => ({ url: t.url, title: t.title || t.url }));

          if (validUrls.length === 0) return;

          const snapshot = {
            id: 'urlset-' + Date.now(),
            date: new Date().toISOString(),
            title: 'Session ' + new Date().toLocaleDateString(),
            urls: validUrls
          };

          storageArea.get(['savedUrlSets', 'campaignProfiles', 'brandProfiles', 'activeCampaignId', 'activeBrandId'], (data) => {
            const savedUrlSets = Array.isArray(data?.savedUrlSets) ? data.savedUrlSets : [];
            savedUrlSets.unshift(snapshot);

            const profiles = Array.isArray(data?.campaignProfiles) && data.campaignProfiles.length > 0
              ? data.campaignProfiles
              : (Array.isArray(data?.brandProfiles) ? data.brandProfiles : []);
            const activeId = data?.activeCampaignId || data?.activeBrandId || profiles[0]?.brandId;
            const brand = profiles.find(b => b.brandId === activeId || b.campaignId === activeId) || profiles[0];
            if (brand) {
              if (!Array.isArray(brand.savedUrlSets)) brand.savedUrlSets = [];
              brand.savedUrlSets.unshift(snapshot);
              brand.updatedAt = new Date().toISOString();
            }

            storageArea.set({ savedUrlSets, brandProfiles: profiles, campaignProfiles: profiles }, () => {
              try {
                chrome.runtime.sendMessage({ type: 'savedUrlsUpdated', snapshot }).catch(() => {});
              } catch (_) {}
              logger.log(`Context menu captured ${snapshot.urls.length} tabs into session snapshot "${snapshot.title}"`);
            });
          });
        });
      }
    } catch (err) {
      logger.error('Error handling context menu click:', err);
    }
  });
}

// ============================================================
// DIRECT METADATA & AUTO-GENERATE ENGINE (AI + NON-AI FALLBACK)
// ============================================================
function bgStripTags(html) {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bgExtractMeta(html, names) {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r1 = new RegExp(`<meta[^>]+(?:name|property)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i');
    const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${esc}["']`, 'i');
    const m = html.match(r1) || html.match(r2);
    if (m && m[1]) {
      const cleaned = bgStripTags(m[1]);
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function bgResolveAbsUrl(raw, origin) {
  const cleaned = bgStripTags(raw || '');
  if (!cleaned || cleaned.startsWith('#') || /^(?:javascript|mailto|tel|data):/i.test(cleaned)) return '';
  try {
    return new URL(cleaned, origin).href;
  } catch {
    return '';
  }
}

async function fetchSiteMetadataDirectBg(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let urlObj;
  try {
    urlObj = new URL(normalized);
  } catch {
    return null;
  }
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const resp = await fetch(urlObj.href, { method: 'GET', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = (await resp.text()).slice(0, 400000);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const docTitle = bgStripTags(titleMatch ? titleMatch[1] : '');
    const ogTitle = bgExtractMeta(html, ['og:title', 'twitter:title']);
    const siteName = bgExtractMeta(html, ['og:site_name', 'application-name']);
    const metaTitle = (docTitle || ogTitle || urlObj.hostname).slice(0, 240);
    const title = (ogTitle || docTitle || urlObj.hostname).slice(0, 240);
    const description = bgExtractMeta(html, ['description', 'og:description', 'twitter:description']).slice(0, 500);
    const rawOgImg = bgExtractMeta(html, ['og:image', 'twitter:image', 'og:image:url']);
    const ogCoverUrl = rawOgImg ? (bgResolveAbsUrl(rawOgImg, urlObj.origin) || rawOgImg) : '';
    const twitter = bgExtractMeta(html, ['twitter:site', 'twitter:creator']).replace(/^@/, '');
    const favMatch =
      html.match(/<link[^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["']/i);
    let faviconUrl = `${urlObj.origin}/favicon.ico`;
    if (favMatch && favMatch[1]) {
      const resolvedFav = bgResolveAbsUrl(favMatch[1], urlObj.origin);
      if (resolvedFav) faviconUrl = resolvedFav;
    }

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const heroHeadline = bgStripTags(h1Match ? h1Match[1] : '').slice(0, 220);
    const headings = [];
    const seenH = new Set();
    const hRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hm;
    while ((hm = hRe.exec(html)) !== null && headings.length < 12) {
      const t = bgStripTags(hm[1]);
      if (t && t.length >= 3 && t.length <= 220 && !seenH.has(t.toLowerCase())) {
        seenH.add(t.toLowerCase());
        headings.push(t);
      }
    }

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

    const heroMatch =
      stripped.match(/<(?:section|div|header)[^>]+(?:id|class)=["'][^"']*hero[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div|header)>/i) ||
      stripped.match(/<main[^>]*>\s*<(?:section|div)[^>]*>([\s\S]*?)<\/(?:section|div)>/i) ||
      stripped.match(/<section[^>]*>([\s\S]*?)<\/section>/i);
    const heroRaw = bgStripTags(heroMatch ? heroMatch[1] : '');
    const ctaTexts = [];
    const seenCta = new Set();
    const ctaRe = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
    let cm;
    while ((cm = ctaRe.exec(stripped)) !== null && ctaTexts.length < 8) {
      const t = bgStripTags(cm[1]);
      if (t && t.length >= 2 && t.length <= 60 && !seenCta.has(t.toLowerCase())) {
        seenCta.add(t.toLowerCase());
        ctaTexts.push(t);
      }
    }

    const mainMatch =
      stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      stripped.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyCopy = bgStripTags(mainMatch ? mainMatch[1] : stripped).slice(0, 3500);
    const heroFallback = heroHeadline && !bodyCopy.toLowerCase().startsWith(heroHeadline.toLowerCase().slice(0, 24))
      ? `${heroHeadline}. ${bodyCopy.slice(0, 600)}`
      : bodyCopy.slice(0, 600);
    const heroText = (heroRaw && heroRaw.length >= 20 ? heroRaw : heroFallback).trim().slice(0, 900);

    // Rich Brand Profile extraction
    const handles = {};
    if (twitter) handles.twitter = twitter;
    const links = {};
    const videos = {};
    const customLinks = [];
    const seenCustomUrls = new Set();
    const videoCandidates = [];
    const pushVideo = (vUrl, label = '') => {
      if (!vUrl || videoCandidates.some(v => v.url === vUrl)) return;
      const low = `${vUrl} ${label}`.toLowerCase();
      const kind = /onboard|getting.?started|setup|tutorial|walkthrough/.test(low)
        ? 'onboarding'
        : /explain|overview|intro|how.?it.?works/.test(low)
          ? 'explainer'
          : /demo|watch|preview/.test(low)
            ? 'demo'
            : 'any';
      videoCandidates.push({ url: vUrl, kind });
    };

    let ldName = '', ldDesc = '', ldTagline = '', ldLogo = '', ldAudience = '', ldPrice = '';
    const ldFeatures = [];
    const sameAsUrls = [];
    const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldm;
    const flattenLd = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flattenLd) : Array.isArray(node['@graph']) ? [node, ...flattenLd(node['@graph'])] : [node];
    while ((ldm = ldRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(ldm[1].trim());
        for (const item of flattenLd(parsed)) {
          const typ = String(item?.['@type'] || '').toLowerCase();
          if (!ldName && item?.name && typeof item.name === 'string' && !/breadcrumb|webpage|list/i.test(typ)) ldName = item.name.trim();
          if (!ldDesc && item?.description && typeof item.description === 'string') ldDesc = item.description.trim();
          if (!ldTagline && item?.slogan && typeof item.slogan === 'string') ldTagline = item.slogan.trim();
          const logoCandidate = typeof item?.logo === 'string' ? item.logo : (item?.logo?.url || '');
          if (!ldLogo && logoCandidate) ldLogo = bgResolveAbsUrl(logoCandidate, urlObj.origin) || logoCandidate;
          if (!ldAudience && item?.audience) ldAudience = typeof item.audience === 'string' ? item.audience : (item.audience.audienceType || item.audience.name || '');
          if (item?.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const off of offers) {
              if (off?.price !== undefined && off?.price !== '' && !ldPrice) {
                const cur = off.priceCurrency === 'USD' || !off.priceCurrency ? '$' : `${off.priceCurrency} `;
                ldPrice = Number(off.price) === 0 ? 'Free' : `${cur}${off.price}`;
              }
            }
          }
          if (Array.isArray(item?.featureList)) item.featureList.forEach(f => typeof f === 'string' && f.trim() && ldFeatures.push(f.trim()));
          if (Array.isArray(item?.sameAs)) item.sameAs.forEach(u => typeof u === 'string' && sameAsUrls.push(u.trim()));
          else if (typeof item?.sameAs === 'string') sameAsUrls.push(item.sameAs.trim());
        }
      } catch {}
    }

    const classifyHref = (rawHref, labelText = '') => {
      const abs = bgResolveAbsUrl(rawHref, urlObj.origin);
      if (!abs) return;
      let u;
      try { u = new URL(abs); } catch { return; }
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
      if (host === 'producthunt.com' && path && (/^\/(?:posts|products)\//i.test(path) || path.startsWith('/@'))) {
        if (!handles.productHunt) handles.productHunt = path.slice(1);
        return;
      }
      if (host === 'youtube.com' || host === 'youtu.be' || host.includes('loom.com') || host.includes('vimeo.com') || /\.(?:mp4|webm)(?:\?|$)/i.test(abs)) {
        pushVideo(abs, labelText);
        return;
      }
      if (/cal\.com|calendly\.com|tidycal\.com|savvycal\.com|meetings\.hubspot\.com/i.test(host) || (/book|schedule|demo.?call/i.test(`${path} ${lowLabel}`) && /demo|call|meeting|consult/i.test(lowLabel))) {
        if (!links.bookingUrl) links.bookingUrl = abs;
        return;
      }
      const baseHost = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      if (host === baseHost || host.endsWith(`.${baseHost}`) || /docs\.|help\.|blog\.|status\.|chromewebstore\.google\.com|chrome\.google\.com\/webstore/i.test(host + abs)) {
        if (!links.pricingUrl && (/\/(?:pricing|plans|plan)(?:\/|$)/i.test(path) || /^pricing(?:\s|$)/i.test(lowLabel))) { links.pricingUrl = abs; return; }
        if (!links.docsUrl && (/\/(?:docs|documentation|changelog|guides|api|help|kb)(?:\/|$)/i.test(path) || /^(?:docs|documentation|changelog|guides|api)$/i.test(lowLabel) || /^docs\./i.test(host))) { links.docsUrl = abs; return; }
        const normKey = `${u.origin}${path}`;
        if (normKey !== urlObj.origin && normKey !== `${urlObj.origin}/` && !seenCustomUrls.has(normKey) && customLinks.length < 8 && !/\/(?:login|signin|sign-in|signup|sign-up|register|auth|cart|checkout|logout|cdn-cgi)\b/i.test(path)) {
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

    sameAsUrls.forEach(s => classifyHref(s, ''));
    const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let am;
    while ((am = anchorRe.exec(html)) !== null) classifyHref(am[1], bgStripTags(am[2]));
    const embedRe = /<(?:iframe|video|source)\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let em;
    while ((em = embedRe.exec(html)) !== null) {
      const abs = bgResolveAbsUrl(em[1], urlObj.origin);
      if (abs && /youtube\.com|youtu\.be|loom\.com|vimeo\.com|wistia|\.(?:mp4|webm)(?:\?|$)/i.test(abs)) pushVideo(abs, em[0]);
    }
    videoCandidates.forEach(v => {
      if (v.kind === 'demo' && !videos.demoUrl) videos.demoUrl = v.url;
      else if (v.kind === 'explainer' && !videos.explainerUrl) videos.explainerUrl = v.url;
      else if (v.kind === 'onboarding' && !videos.onboardingUrl) videos.onboardingUrl = v.url;
    });
    videoCandidates.forEach(v => {
      if (!videos.demoUrl) videos.demoUrl = v.url;
      else if (!videos.explainerUrl && v.url !== videos.demoUrl) videos.explainerUrl = v.url;
      else if (!videos.onboardingUrl && v.url !== videos.demoUrl && v.url !== videos.explainerUrl) videos.onboardingUrl = v.url;
    });

    let detectedLogoImg = ldLogo;
    if (!detectedLogoImg) {
      const imgRe = /<img\b([^>]*)>/gi;
      let im;
      while ((im = imgRe.exec(html)) !== null) {
        const srcM = im[1].match(/src=["']([^"']+)["']/i);
        if (srcM && srcM[1] && /(?:logo|brand|wordmark)/i.test(im[1])) {
          const resUrl = bgResolveAbsUrl(srcM[1], urlObj.origin);
          if (resUrl && !/1x1|pixel|spacer|tracking/i.test(resUrl)) { detectedLogoImg = resUrl; break; }
        }
      }
    }

    const paragraphs = [];
    const seenParas = new Set();
    const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pRe.exec(stripped)) !== null && paragraphs.length < 30) {
      const t = bgStripTags(pm[1]);
      if (t && t.length >= 25 && t.length <= 500 && !seenParas.has(t.toLowerCase())) { seenParas.add(t.toLowerCase()); paragraphs.push(t); }
    }

    const resolvedName = (ldName || siteName || (title || '').split(/[-|—]/)[0] || '').trim().slice(0, 80);
    let tagline = ldTagline || '';
    if (!tagline && (title.includes('|') || title.includes('—') || title.includes(' - '))) {
      const part = title.split(/\s*[|—]\s*|\s+-\s+/).slice(1).join(' — ').trim();
      if (part && part.length >= 4 && part.toLowerCase() !== resolvedName.toLowerCase()) tagline = part;
    }
    if (!tagline && heroHeadline && heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) tagline = heroHeadline;
    if (!tagline && description) tagline = description.split(/[.!?]/)[0].trim();
    tagline = tagline.slice(0, 100);

    const fitShortPitch140 = (raw) => {
      const s = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!s) return '';
      if (s.length <= 140) return s;
      const sentences = s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
      if (sentences[0] && sentences[0].length >= 45 && sentences[0].length <= 140) {
        return sentences[0];
      }
      const sliced = s.slice(0, 140);
      const lastSpace = sliced.lastIndexOf(' ');
      return (lastSpace > 75 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\-–—&+]+$/, '').trim();
    };
    const shortPitchCandidates = [
      description,
      ldDesc,
      paragraphs.find(p => p.length >= 45 && p.length <= 220) || '',
      heroHeadline && heroText && heroText !== heroHeadline ? heroText : '',
      ...paragraphs.slice(0, 4),
      tagline && resolvedName ? `${resolvedName}: ${tagline}` : ''
    ];
    const shortPitches = [];
    const seenShortPrefixes = new Set();
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
      const audM = [description, heroText, ...paragraphs, ...headings].join(' . ').match(/\b(?:built for|designed for|made for|ideal for|perfect for|for)\s+((?:[a-z0-9,&\-\/]+\s+){1,10}(?:founders?|makers?|creators?|teams?|agencies?|marketers?|developers?|engineers?|designers?|startups?|businesses?|companies|freelancers?|solopreneurs?|educators?|students?|recruiters?|writers?|podcasters?|stores?|brands?|saas|builders?))/i);
      if (audM && audM[1]) targetAudience = audM[1].trim().replace(/[.,;:]+$/, '');
    }
    targetAudience = targetAudience.slice(0, 220);

    const priceTokens = [];
    const seenPrices = new Set();
    const fullText = `${bodyCopy} ${bgStripTags(html)}`;
    if (/\bfree\s+(?:forever|plan|tier|starter|trial)\b|\$0\b/i.test(fullText)) priceTokens.push('Free plan available');
    const tierRe = /(?:([A-Za-z][A-Za-z0-9+ ]{1,16})\s*[:\-–]?\s*)?(\$\s?\d{1,4}(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat|one[- ]time|lifetime))?)/gi;
    let tpm;
    while ((tpm = tierRe.exec(fullText)) !== null && priceTokens.length < 4) {
      const priceStr = tpm[2].replace(/\s+/g, '');
      if (priceStr === '$0' || seenPrices.has(priceStr)) continue;
      seenPrices.add(priceStr);
      const tierLabel = tpm[1] ? tpm[1].trim() : '';
      priceTokens.push(tierLabel && !/^(?:save|only|just|from|for|to|at|or|and|with|under|over|about|up|per|get)$/i.test(tierLabel) ? `${tierLabel} ${priceStr}` : priceStr);
    }
    if (!priceTokens.length && ldPrice) priceTokens.push(ldPrice);
    const pricingSummary = priceTokens.join(', ').slice(0, 180);
    const startingPrice = ldPrice || (Array.from(seenPrices)[0] || '');
    const pricingModel = /\bfree\s+forever\b/i.test(fullText) && seenPrices.size === 0 ? 'Free' : /\bfree\b/i.test(fullText) && seenPrices.size > 0 ? 'Freemium' : /one[- ]time|lifetime/i.test(fullText) ? 'One-time' : seenPrices.size > 0 ? 'Subscription' : '';

    let founderStory = '';
    const storyM = stripped.match(/<h[2-4][^>]*>[^<]*(?:our story|founder|why we built|about us|the mission|why i built|origin)[^<]*<\/h[2-4]>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (storyM && storyM[1]) founderStory = bgStripTags(storyM[1]).slice(0, 400);
    else {
      const sp = paragraphs.find(p => /\b(?:i built|we built|we started|our mission|frustrated with|started this|founded)\b/i.test(p));
      if (sp) founderStory = sp.slice(0, 400);
    }

    const features = [];
    const benefits = [];
    const seenFeat = new Set();
    ldFeatures.forEach(lf => {
      if (features.length >= 6) return;
      const parts = lf.split(/:\s+|\s+-\s+/);
      const t = parts[0].trim().slice(0, 80);
      if (t && !seenFeat.has(t.toLowerCase())) { seenFeat.add(t.toLowerCase()); features.push({ title: t, detail: parts.slice(1).join(' - ').trim().slice(0, 220) }); }
    });
    const cpRe = /<(h[34]|strong|b)[^>]*>([\s\S]{3,100}?)<\/\1>(?:\s|<[^>]{0,80}>){0,4}<p[^>]*>([\s\S]{15,320}?)<\/p>/gi;
    let cpm;
    while ((cpm = cpRe.exec(stripped)) !== null && (features.length < 6 || benefits.length < 5)) {
      const fTitle = bgStripTags(cpm[2]), fDetail = bgStripTags(cpm[3]);
      if (!fTitle || fTitle.length < 3 || fTitle.length > 75 || !fDetail || fDetail.length < 15) continue;
      if (/cookie|privacy|copyright|subscribe|sign up|log in/i.test(`${fTitle} ${fDetail}`) || seenFeat.has(fTitle.toLowerCase())) continue;
      seenFeat.add(fTitle.toLowerCase());
      if (/\b(?:save|faster|hours|boost|increase|reduce|never miss|peace of mind|roi|revenue|effortless|without)\b/i.test(`${fTitle} ${fDetail}`) && benefits.length < 5) {
        benefits.push({ title: fTitle.slice(0, 80), detail: fDetail.slice(0, 220) });
      } else if (features.length < 6) {
        features.push({ title: fTitle.slice(0, 80), detail: fDetail.slice(0, 220) });
      }
    }
    if (features.length < 4) {
      const liRe = /<li[^>]*>([\s\S]{10,240}?)<\/li>/gi;
      let lim;
      while ((lim = liRe.exec(stripped)) !== null && features.length < 6) {
        const txt = bgStripTags(lim[1]);
        if (!txt || txt.length < 12 || txt.length > 180 || /^(?:home|pricing|docs|blog|login|sign in|about|privacy|terms|contact)$/i.test(txt)) continue;
        const sm = txt.match(/^([^:—\-]{3,55})\s*[:—\-]\s*(.+)$/);
        const fTitle = (sm ? sm[1] : txt.split(' ').slice(0, 5).join(' ')).trim();
        const fDetail = (sm ? sm[2] : txt).trim();
        if (fTitle && !seenFeat.has(fTitle.toLowerCase())) { seenFeat.add(fTitle.toLowerCase()); features.push({ title: fTitle.slice(0, 80), detail: fDetail.slice(0, 220) }); }
      }
    }

    const competitors = [];
    const vsRe = /\b(?:alternative to|better than|compared to|instead of|vs\.?)\s+([A-Z][A-Za-z0-9.+ ]{1,28})/g;
    let vm;
    const seenComps = new Set();
    while ((vm = vsRe.exec(fullText)) !== null && competitors.length < 4) {
      const cName = vm[1].trim().replace(/[.,;:!?]+$/, '');
      if (cName && cName.toLowerCase() !== resolvedName.toLowerCase() && !seenComps.has(cName.toLowerCase())) {
        seenComps.add(cName.toLowerCase());
        competitors.push({ name: cName, advantage: fullText.slice(Math.max(0, vm.index - 20), vm.index + 160).trim(), recommendWhen: '' });
      }
    }

    const testimonials = [];
    const bqRe = /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi;
    let bm;
    while ((bm = bqRe.exec(stripped)) !== null && testimonials.length < 3) {
      const txt = bgStripTags(bm[1]);
      if (txt.length >= 20 && txt.length <= 320) {
        const splitA = txt.match(/^["“]?([\s\S]+?)["”]?\s*(?:—|--|-)\s*([^—]{2,60})$/);
        testimonials.push({ quote: (splitA ? splitA[1] : txt).replace(/^["“]|["”]$/g, '').trim(), author: splitA ? splitA[2].trim() : '' });
      }
    }

    const countWords = (s) => String(s || '').replace(/•/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    const trimToMaxWords = (s, maxW) => {
      const words = String(s || '').trim().split(/\s+/).filter(Boolean);
      if (words.length <= maxW) return words.join(' ');
      const clipped = words.slice(0, maxW).join(' ').replace(/[,;:\-–—]+$/, '');
      return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
    };
    const ensureSentence = (s) => {
      const t = String(s || '').trim();
      return !t ? '' : (/[.!?]$/.test(t) ? t : `${t}.`);
    };
    const leadParts = [];
    if (heroHeadline && heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) leadParts.push(ensureSentence(heroHeadline));
    const mainLeadPara = ldDesc || description || paragraphs[0] || '';
    if (mainLeadPara && !leadParts.some(x => x.toLowerCase().includes(mainLeadPara.toLowerCase().slice(0, 30)))) leadParts.push(ensureSentence(mainLeadPara));
    const secondLeadPara = paragraphs.find(p => p && p.toLowerCase() !== mainLeadPara.toLowerCase() && p.length >= 45);
    if (secondLeadPara && countWords(leadParts.join(' ')) < 42) leadParts.push(ensureSentence(secondLeadPara));
    let introBlock = leadParts.join(' ').replace(/\s+/g, ' ').trim();
    if (countWords(introBlock) > 62) introBlock = trimToMaxWords(introBlock, 55);

    const bulletPool = [];
    const seenBullet = new Set();
    const addBullet = (rawLine) => {
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
    benefits.forEach(b => addBullet(b.detail ? `${b.title}: ${b.detail}` : b.title));
    features.forEach(f => addBullet(f.detail ? `${f.title}: ${f.detail}` : f.title));
    paragraphs.forEach(p => { if (bulletPool.length < 10) addBullet(p); });
    headings.forEach(h => {
      if (bulletPool.length < 10 && h.toLowerCase() !== resolvedName.toLowerCase() && h.toLowerCase() !== heroHeadline.toLowerCase()) addBullet(h);
    });

    const chosenBullets = [];
    for (const bul of bulletPool) {
      const candidateStr = [introBlock, chosenBullets.concat(bul).join('\n')].filter(Boolean).join('\n\n');
      if (countWords(candidateStr) <= 192 || chosenBullets.length < 3) chosenBullets.push(bul);
      if (countWords(candidateStr) >= 165 && chosenBullets.length >= 4) break;
    }

    let longPitch = [introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n').trim();
    if (countWords(longPitch) < 150) {
      const extraSentences = paragraphs.filter(p => !longPitch.toLowerCase().includes(p.toLowerCase().slice(0, 35))).slice(0, 4);
      for (const ep of extraSentences) {
        if (countWords(longPitch) >= 155) break;
        const room = 195 - countWords(longPitch);
        if (room < 10) break;
        longPitch = `${longPitch}\n\n${trimToMaxWords(ep, Math.min(room, 40))}`.trim();
      }
      if (countWords(longPitch) < 150 && bodyCopy) {
        const bodySents = bodyCopy.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 30);
        const normLP = longPitch.toLowerCase().replace(/[:;,.!?•]+/g, ' ').replace(/\s+/g, ' ');
        const closingChunks = [];
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
      while (chosenBullets.length > 3 && countWords([introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n')) > 200) chosenBullets.pop();
      longPitch = [introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n').trim();
      if (countWords(longPitch) > 200) {
        longPitch = longPitch.split('\n').reduce((acc, line) => {
          const cur = acc.join('\n');
          if (!line.trim()) { acc.push(line); return acc; }
          if (countWords(`${cur}\n${line}`) <= 200) { acc.push(line); return acc; }
          const rem = 200 - countWords(cur);
          if (rem >= 8) acc.push(trimToMaxWords(line, rem));
          return acc;
        }, []).join('\n').trim();
      }
    }
    if (!longPitch) longPitch = trimToMaxWords(bodyCopy, 195);

    const brandProfile = {
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
      ogCoverUrl: ogCoverUrl || undefined,
      logoUrl: detectedLogoImg || ogCoverUrl || undefined,
      features: features.length ? features : undefined,
      benefits: benefits.length ? benefits : undefined,
      competitors: competitors.length ? competitors : undefined,
      links: Object.keys(links).length ? links : undefined,
      videos: Object.keys(videos).length ? videos : undefined,
      customLinks: customLinks.length ? customLinks : undefined,
      handles: Object.keys(handles).length ? handles : undefined,
      testimonials: testimonials.length ? testimonials : undefined
    };

    const resolvedLogoUrl = brandProfile.logoUrl || ogCoverUrl || '';

    return {
      sourceType: 'url',
      url: urlObj.href,
      domain: urlObj.hostname.replace(/^www\./, ''),
      title,
      metaTitle,
      metaDescription: description,
      description,
      heroHeadline: heroHeadline || headings[0] || '',
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
      scannedAt: new Date().toISOString()
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function bgCleanDomain(rawUrl) {
  return String(rawUrl || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
}

function bgStripPunct(str) {
  return String(str || '').trim().replace(/[.!?]+$/, '').trim();
}

function bgTruncate(str, maxLen) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  const sliced = s.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced)
    .replace(/[,;:\-–—&+]+$/, '')
    .trim();
}

function bgLcFirst(str) {
  const s = String(str || '').trim();
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

function buildLocalAutoGenerateBg(modRaw, brand = {}, landingContext = null) {
  const mod = String(modRaw || '').trim().toLowerCase();
  const lc = landingContext || {};
  const metaTitle = String(lc.metaTitle || lc.title || '').trim();
  const metaDescription = String(lc.metaDescription || lc.description || '').trim();
  const heroHeadline = String(lc.heroHeadline || '').trim();
  const heroText = String(lc.heroText || '').trim();
  const headings = Array.isArray(lc.headings) ? lc.headings.map((h) => String(h).trim()).filter(Boolean) : [];
  const ctaTexts = Array.isArray(lc.ctaTexts) ? lc.ctaTexts.map((c) => String(c).trim()).filter(Boolean) : [];

  const name = String(brand.name || brand.brandName || '').trim() || metaTitle.split(/[-|—]/)[0].trim() || 'Our product';
  const url = String(brand.url || brand.websiteUrl || brand.website || '').trim();
  const domain = bgCleanDomain(url) || name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const metaTitlePart = bgStripPunct(
    metaTitle.includes('-') || metaTitle.includes('|') ? metaTitle.split(/[-|—]/).slice(1).join(' ').trim() : metaTitle
  );
  const heroHook = bgStripPunct(heroHeadline || brand.tagline || metaTitlePart || name);
  const corePromise = bgStripPunct(brand.tagline || metaTitlePart || heroHeadline || brand.description || name);
  const detailCopy = bgStripPunct(metaDescription || brand.description || heroText || corePromise);
  const sentences = detailCopy.split(/[.!?]+\s+/).map(bgStripPunct).filter(Boolean);
  const firstSentence = sentences[0] || corePromise;
  const secondSentence = sentences[1] || bgStripPunct(headings[1] || '');
  const heroLine = bgStripPunct((heroText || heroHook).slice(0, 200));
  const ctaHint = ctaTexts[0] || '';

  if (mod === 'comments') {
    return {
      comments: [
        { angle: 'Pain-Point Mirror', text: `Dealing with this exact bottleneck is why we built ${name}. ${firstSentence}. If you want the faster route without overthinking it, check out ${domain}.` },
        { angle: 'Builder Story', text: `When we put ${name} together, the goal was straightforward: ${bgLcFirst(heroHook)}. Curious how others here handle this right now, or if ${domain} fits your flow.` },
        { angle: 'Hero Outcome', text: `${heroHook} — that's the exact gap ${name} focuses on. ${secondSentence || firstSentence}. Worth a quick look at ${url || domain}.` },
        { angle: 'Helpful Peer Tip', text: `What worked best for us was cutting out extra steps and keeping the workflow simple. We built ${name} (${domain}) around ${bgLcFirst(metaTitlePart || corePromise)}.` },
        { angle: 'Fresh Take', text: `Most tools make this way heavier than it needs to be. ${name} keeps it light: ${firstSentence}. Easy to test out at ${domain}.` },
        { angle: 'Short Micro-Pitch', text: `Quick share if this is on your radar: ${name} — ${corePromise}. Take a look at ${domain}.` },
        { angle: 'Workflow Drop', text: `If you're stuck on this part of the process, ${name} handles it cleanly (${bgTruncate(heroLine, 120)}). Happy to share how we set it up at ${url || domain}.` },
        { angle: 'Conversation Starter', text: `Honest question — what part of this eats up most of your week? We built ${name} around "${bgTruncate(heroHook, 90)}" to cut down the manual grind: ${domain}.` }
      ]
    };
  }

  if (mod === 'directory') {
    const cleanName = bgTruncate(name, 40);
    const t1 = bgTruncate(metaTitlePart || corePromise, 60);
    const t2 = bgTruncate(heroHook, 60);
    const t3 = bgTruncate(`${cleanName}: ${firstSentence}`, 60);
    const taglines = Array.from(new Set([t1, t2, t3].filter(Boolean)));
    if (taglines.length < 2) taglines.push(bgTruncate(`${cleanName} — ${corePromise}`, 60));

    return {
      productName: cleanName,
      websiteUrl: url,
      category: brand.category || 'Marketing & Sales',
      pricingModel: brand.pricing || 'Freemium',
      taglines,
      pitches: Array.from(new Set([
        bgTruncate(`${cleanName}: ${heroHook}. ${firstSentence}.`, 140),
        bgTruncate(`${firstSentence}. Built to help you ${bgLcFirst(corePromise)}.`, 140),
        bgTruncate(`${metaTitlePart || cleanName} — try ${domain} for a faster, simpler workflow.`, 140)
      ].filter(Boolean))),
      summaries: Array.from(new Set([
        bgTruncate(`${cleanName} (${domain}) — ${detailCopy}.`, 250),
        bgTruncate(`${heroHook}. ${detailCopy}.${ctaHint ? ` ${ctaHint} at ${domain}.` : ''}`, 250)
      ].filter(Boolean))),
      descriptions: [
        `${cleanName} — ${heroHook}\n\n${detailCopy}.${headings.length ? `\n\nHighlights: ${headings.slice(0, 4).join(' • ')}` : ''}\n\nTry it at ${url || domain}.`.trim(),
        `${detailCopy}.\n\n${heroText ? `${bgStripPunct(heroText.slice(0, 420))}.\n\n` : ''}Visit ${url || domain} to see ${cleanName} in action.`.trim()
      ]
    };
  }

  if (mod === 'contact') {
    // STRICT RULE: Never generate name, email, or phone
    return {
      company: name,
      website: url,
      subject: bgTruncate(`Introducing ${name} — ${heroHook}`, 75),
      message: `Hi there,\n\nI'm reaching out to introduce ${name} (${url || domain}) — ${bgLcFirst(firstSentence)}.\n\nWe built ${name} to help with ${bgLcFirst(corePromise)}${secondSentence ? ` (${bgLcFirst(secondSentence)})` : ''}.\n\nIf that's relevant to what you're working on, you can take a quick look at ${url || domain} — happy to answer any questions.`
    };
  }

  if (mod === 'email') {
    return {
      emails: [
        {
          subject: bgTruncate(`Introducing ${name}: ${heroHook}`, 65),
          body: `Hi there,\n\nWanted to briefly introduce ${name} (${url || domain}).\n\n${firstSentence}.${secondSentence ? ` ${secondSentence}.` : ''}\n\nWe built it for people who want a simpler way to handle ${bgLcFirst(corePromise)} without bloated setup. You can take a quick look at ${url || domain} or reply if you'd like a walkthrough.\n\nBest,\n${name} Team`
        },
        {
          subject: bgTruncate(`${name} — ${heroHook}`, 65),
          body: `Hi,\n\nI'm writing to introduce ${name} (${url || domain}).\n\nIn short: ${heroHook}. ${bgTruncate(detailCopy, 200)}.\n\nIf you're looking for a simpler way to handle this in your workflow, check out ${url || domain} — happy to share more details anytime.\n\nCheers,\n${name}`
        },
        {
          subject: bgTruncate(`Meet ${name} (${domain})`, 65),
          body: `Hello,\n\nQuick introduction from our team at ${name} (${url || domain}).\n\nWe created ${name} to help with ${bgLcFirst(corePromise)}. ${firstSentence}.\n\nIf this fits what you're focused on right now, feel free to explore it at ${url || domain} and let me know what you think.\n\nBest,\n${name}`
        },
        {
          subject: bgTruncate(`Quick intro: ${name} for ${brand.category || 'your workflow'}`, 65),
          body: `Hi there,\n\nSharing a quick introduction to ${name} (${url || domain}).\n\nMost teams waste hours stitching together manual steps for something that should take minutes. ${name} gives you a direct solution: ${bgTruncate(detailCopy, 220)}.\n\nTake a look at ${url || domain} whenever you have a minute.\n\nBest,\n${name} Team`
        }
      ]
    };
  }

  if (mod === 'dm') {
    return {
      dms: [
        { platform: 'Twitter', message: `Hey! Quick intro — we built ${name} (${domain}) to help with ${bgLcFirst(corePromise)}. Check it out if that's useful for your workflow!` },
        { platform: 'LinkedIn', message: `Hi! Wanted to introduce ${name} (${url || domain}) — ${firstSentence}. Thought it could be useful for what you're working on.` },
        { platform: 'Reddit', message: `Hey! Sharing a quick intro to ${name} (${domain}) — ${corePromise} without extra manual work. Happy to share how it works if you're interested.` },
        { platform: 'Instagram', message: `Hey! Quick intro to ${name} (${domain}) — we built it to help with ${bgLcFirst(corePromise)}. Worth a quick peek!` }
      ]
    };
  }

  if (mod === 'social') {
    return {
      socialPosts: [
        {
          platform: 'X / Twitter',
          format: 'single',
          hook: bgTruncate(`${heroHook}. Here's why we built ${name}:`, 120),
          body: bgTruncate(`${heroHook}.\n\n${firstSentence}.\n\nNo bloated setup — check out ${domain}`, 275),
          ctaUrl: url || `https://${domain}`
        },
        {
          platform: 'LinkedIn',
          format: 'single',
          hook: bgTruncate(`Most teams waste hours on ${bgLcFirst(brand.category || 'manual workflows')}.`, 140),
          body: `Most teams still stitch together disconnected steps to handle ${bgLcFirst(corePromise)}.\n\nWhen we built ${name}, we focused on one clear outcome: ${firstSentence}.\n\n${secondSentence ? `${secondSentence}.\n\n` : ''}See how it works at ${url || domain}.`,
          ctaUrl: url || `https://${domain}`
        },
        {
          platform: 'Reddit',
          format: 'launch',
          hook: bgTruncate(`Show & Tell: I built ${name} to help with ${bgLcFirst(corePromise)}`, 140),
          body: `Hey everyone,\n\nI got tired of complicated workflows for ${bgLcFirst(corePromise)}, so I built ${name} (${domain}).\n\nWhat it does:\n- ${firstSentence}\n- ${secondSentence || heroHook}\n\nPricing: ${brand.pricing || 'Freemium'}. Happy to hear honest feedback!`,
          ctaUrl: url || `https://${domain}`
        },
        {
          platform: 'Threads',
          format: 'thread',
          hook: bgTruncate(`Quick breakdown on ${bgLcFirst(corePromise)} 🧵`, 110),
          body: `1/ The bottleneck: ${firstSentence}.\n\n2/ What actually moves the needle: ${heroHook}.\n\n3/ That's why we built ${name} (${domain}) — try it out when you get a minute.`,
          ctaUrl: url || `https://${domain}`
        }
      ]
    };
  }

  if (mod === 'support') {
    return {
      faqs: [
        {
          category: 'General',
          question: `What is ${name} and who is it built for?`,
          answer: `${name} is built to help with ${bgLcFirst(corePromise)}. ${detailCopy}. You can explore full details at ${url || domain}.`
        },
        {
          category: 'Pricing & Billing',
          question: `How does pricing work for ${name}?`,
          answer: `${name} offers ${brand.pricing || 'flexible plans'}. Visit ${url || domain} for the latest plan breakdown and limits.`
        },
        {
          category: 'Onboarding',
          question: `How quickly can I get started with ${name}?`,
          answer: `You can set up ${name} in a few minutes. Start by visiting ${url || domain} and following the quick-start workflow for ${bgLcFirst(corePromise)}.`
        }
      ],
      macros: [
        {
          category: 'General',
          title: 'Quick Intro & Onboarding Help',
          body: `Hi there!\n\nThanks for reaching out about ${name}. To get started quickly, ${bgLcFirst(firstSentence)}. You can check ${url || domain} anytime — reply here if you'd like me to walk through your setup!`
        },
        {
          category: 'Bug Report',
          title: 'Bug Triage & Follow-Up',
          body: `Hi! Thanks for flagging this. Could you share the page URL or a quick screenshot of what happened? We take reliability in ${name} seriously and will look into this right away.`
        },
        {
          category: 'Feature Request',
          title: 'Feature Request Logged',
          body: `Appreciate you sharing that idea! We're actively improving ${name} (${domain}) around ${bgLcFirst(corePromise)}, and I've logged this request with our product notes so we can prioritize it.`
        }
      ]
    };
  }

  const preset = String(brand.articlePreset || 'problem-solution').trim();
  const kw = String(brand.targetKeyword || '').trim() || bgTruncate(brand.category || heroHook, 40);
  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'article';
  const headingsList = headings.length ? headings.slice(0, 4) : [heroHook, firstSentence];
  const title1 = preset === 'how-to'
    ? `How to Master ${bgTruncate(kw, 40)} Using ${name}`
    : preset === 'comparison'
      ? `Comparing Approaches to ${bgTruncate(kw, 36)}: Why ${name} Keeps It Simple`
      : preset === 'launch-story'
        ? `Why We Built ${name}: Solving ${bgTruncate(heroHook, 45)}`
        : `The Problem With ${bgTruncate(kw, 45)} — And a Simpler Solution`;
  const title2 = `Solving ${bgTruncate(heroHook, 55)}: How ${name} Helps Target Users`;
  return {
    articles: [
      {
        title: title1,
        preset,
        targetKeyword: kw,
        slug: slugify(title1),
        metaDescription: bgTruncate(`${firstSentence}. Discover how ${name} helps with ${bgLcFirst(corePromise)}.`, 158),
        body: `The Problem\nWhen you need better results with ${bgLcFirst(corePromise)}, you quickly run into the same bottleneck: too many disconnected steps, slow manual work, and inconsistent outcomes.\n\nWhy Current Workflows Fall Short\n${bgStripPunct(headingsList[0] || heroHook)}. Most tools either overcomplicate the setup or leave you doing the repetitive parts by hand, which eats up time every single week.\n\nThe Solution: How ${name} Helps\nThat's the exact problem ${name} (${url || domain}) is built to solve. ${detailCopy}.\n\nHere is how ${name} helps target users in practice:\n- Eliminates the manual bottleneck: ${firstSentence}.\n- Keeps execution focused: ${bgStripPunct(headingsList[1] || secondSentence || heroHook)}.\n- Gets you to results faster without heavy setup.\n\nIf you want a simpler way to handle ${bgLcFirst(corePromise)}, try ${name} at ${url || domain}.`
      },
      {
        title: title2,
        preset: preset === 'problem-solution' ? 'how-to' : preset,
        targetKeyword: kw,
        slug: slugify(title2),
        metaDescription: bgTruncate(`${heroHook}. Practical guide to fixing ${bgLcFirst(corePromise)} with ${name}.`, 158),
        body: `The Problem\nGetting consistent outcomes around ${brand.category || 'growth'} shouldn't require duct-taping multiple workflows together. Yet most people spend more time managing tools and manual tasks than actually shipping.\n\nThe Root Cause\n${heroText ? `${bgStripPunct(heroText.slice(0, 320))}.\n\n` : ''}${firstSentence}.\n\nThe Solution: How ${name} Helps You Fix It\nWe built ${name} (${url || domain}) around one goal: ${heroHook}.\n\nInstead of adding another complex dashboard, ${name} helps you directly:\n1. Cut out repetitive friction: ${firstSentence}.\n2. Focus on what actually moves the needle: ${secondSentence || bgTruncate(detailCopy, 180)}.\n3. Turn your workflow into a repeatable system you can run in minutes.\n\nSee how ${name} solves this for your workflow at ${url || domain}.`
      }
    ]
  };
}

async function callGeminiDirectBg({ geminiKey, systemInstruction = '', messages = [], temperature = 0.7, maxOutputTokens = 2048 }) {
  const key = String(geminiKey || '').trim();
  if (!key) return { ok: false, status: 401, error: 'Missing Gemini API key' };
  const contents = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }]
    }));
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }
  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens
    }
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: String(systemInstruction) }] };
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json?.error?.message || `Gemini HTTP ${res.status}`
    };
  }
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p?.text || '').join('').trim();
  return { ok: Boolean(text), status: res.status, text };
}

async function callOpenRouterAutoGenerateBg(modRaw, brand = {}, landingContext = null, openRouterKey = '', aiModel = '', geminiKey = '') {
  const mod = String(modRaw || '').trim().toLowerCase();
  const key = String(openRouterKey || '').trim();
  const gemKey = String(geminiKey || '').trim();
  if (!key && !gemKey) return null;

  const lc = landingContext || {};
  const name = String(brand.name || brand.brandName || lc.metaTitle || 'Product').trim();
  const url = String(brand.url || brand.websiteUrl || brand.website || '').trim();

  const contextBrief = [
    `PRODUCT DETAILS:`,
    `- Name: ${name}`,
    `- Website URL: ${url || 'N/A'}`,
    `- Tagline: ${brand.tagline || lc.heroHeadline || 'N/A'}`,
    `- Description: ${brand.description || lc.metaDescription || 'N/A'}`,
    `- Category: ${brand.category || 'Marketing & Sales'}`,
    `- Pricing: ${brand.pricing || 'Freemium'}`,
    ``,
    `SITE LANDING CONTENT:`,
    `- Meta Title: ${lc.metaTitle || lc.title || 'N/A'}`,
    `- Meta Description: ${lc.metaDescription || lc.description || 'N/A'}`,
    `- Hero Headline: ${lc.heroHeadline || 'N/A'}`,
    `- Hero Section Copy: ${lc.heroText || 'N/A'}`,
    `- Key Headings: ${Array.isArray(lc.headings) && lc.headings.length ? lc.headings.join(' | ') : 'N/A'}`,
    `- Landing Body Excerpt: ${lc.bodyCopy ? String(lc.bodyCopy).slice(0, 2000) : 'N/A'}`
  ].join('\n');

  const toneRules = `CRITICAL TONE & QUALITY RULES:
1. MATCH THE PRODUCT & LANDING PAGE TONE EXACTLY using the Meta Title, Meta Description, Hero Section, and Landing Body above.
2. NOT OVERLY PROFESSIONAL / NO CORPORATE STIFFNESS: Avoid buzzwords like "synergy", "leverage", "revolutionize", "game-changer", "elevate", "streamline your pipeline", or stiff B2B boilerplate.
3. Sound like a real maker/founder sharing something concrete.`;

  const schemas = {
    comments: `Generate 8 distinct social comments using Meta Title, Meta Description & Hero Section across 8 different pitch angles. Return ONLY JSON: {"comments":[{"angle":"Pain-Point Mirror","text":"..."}, ...8 items]}`,
    directory: `Generate Directory Submission JSON with productName (<=40 chars), websiteUrl, category, pricingModel, 3 taglines (<=60 chars each), 3 pitches (<=140 chars each), 2 summaries (<=250 chars each), 2 descriptions. Return ONLY JSON: {"productName":"...","websiteUrl":"${url}","category":"...","pricingModel":"...","taglines":[],"pitches":[],"summaries":[],"descriptions":[]}`,
    contact: `Generate a DIRECT Product Introduction message for a Contact Form, sent FROM the maker/team of "${name}" TO the recipient introducing "${name}" (what it does, how it helps, URL). NEVER write as a customer/fan emailing "${name}" or recommending it from outside. CRITICAL: NEVER include name, email, or phone fields! Only return JSON: {"company":"${name}","website":"${url}","subject":"Introducing ${name} — ...","message":"..."}`,
    email: `Generate 4 distinct DIRECT Introduction Emails sent FROM the maker/team of "${name}" directly introducing "${name}" TO the recipient (what it is, what problem it solves / how it helps, URL). NEVER write as an outsider or customer asking about "${name}". Return ONLY JSON: {"emails":[{"subject":"...","body":"..."}]}`,
    dm: `Generate 4 distinct SHORT DMs (1-2 crisp sentences each) directly introducing "${name}" (what it does / how it helps + link/clean domain) for Twitter (no https://), LinkedIn, Reddit, Instagram. Return ONLY JSON: {"dms":[{"platform":"Twitter","message":"..."},{"platform":"LinkedIn","message":"..."},{"platform":"Reddit","message":"..."},{"platform":"Instagram","message":"..."}]}`,
    social: `Generate 4 distinct platform-native Social Posts for "${name}" across X / Twitter (<=270 chars, no https://), LinkedIn, Reddit ("launch" Share & Tell), and Threads ("thread"). Return ONLY JSON: {"socialPosts":[{"platform":"X / Twitter","format":"single","hook":"...","body":"...","ctaUrl":"${url}"},{"platform":"LinkedIn","format":"single","hook":"...","body":"...","ctaUrl":"${url}"},{"platform":"Reddit","format":"launch","hook":"...","body":"...","ctaUrl":"${url}"},{"platform":"Threads","format":"thread","hook":"...","body":"...","ctaUrl":"${url}"}]}`,
    support: `Generate 3 clear FAQs (General, Pricing & Billing, Onboarding) and 3 warm, human Support Macros (General, Bug Report, Feature Request) for "${name}". Return ONLY JSON: {"faqs":[{"category":"General","question":"...","answer":"..."}],"macros":[{"category":"General","title":"...","body":"..."}]}`,
    articles: `Generate 2 distinct SEO-friendly Problem/Solution or How-To articles (~350-500 words each) matching the landing page tone${brand.articlePreset ? ` (preset: ${brand.articlePreset})` : ''}${brand.targetKeyword ? ` targeting "${brand.targetKeyword}"` : ''}. Include preset, targetKeyword, slug, and metaDescription (<=160 chars). Return ONLY JSON: {"articles":[{"title":"...","preset":"problem-solution","targetKeyword":"...","slug":"...","metaDescription":"...","body":"..."}]}`
  };

  const schemaPrompt = schemas[mod];
  if (!schemaPrompt) return null;

  const model = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);
  try {
    let raw = '';
    let sourceLabel = '';
    if (key) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://smartposter.pro',
          'X-Title': 'Smart Poster Auto Generate'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${toneRules}\n\n${schemaPrompt}` },
            { role: 'user', content: `${contextBrief}\n\nGenerate valid JSON now.` }
          ],
          temperature: 0.7,
          max_tokens: 3000
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        raw = String(json?.choices?.[0]?.message?.content || '').trim();
        sourceLabel = `openrouter (${model})`;
      }
    } else {
      clearTimeout(timer);
    }

    if (!raw && gemKey) {
      const gemOut = await callGeminiDirectBg({
        geminiKey: gemKey,
        systemInstruction: `${toneRules}\n\n${schemaPrompt}`,
        messages: [{ role: 'user', content: `${contextBrief}\n\nGenerate valid JSON now.` }],
        temperature: 0.7,
        maxOutputTokens: 3000
      }).catch(() => null);
      if (gemOut?.ok && gemOut.text) {
        raw = gemOut.text;
        sourceLabel = 'gemini-byok (gemini-2.5-flash)';
      }
    }
    if (!raw) return null;

    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const fb = clean.indexOf('{');
    const lb = clean.lastIndexOf('}');
    const candidate = JSON.parse(fb !== -1 && lb > fb ? clean.slice(fb, lb + 1) : clean);
    if (!candidate || typeof candidate !== 'object') return null;

    if (mod === 'contact') {
      delete candidate.name;
      delete candidate.senderName;
      delete candidate.email;
      delete candidate.senderEmail;
      delete candidate.phone;
    } else if (mod === 'comments') {
      const list = Array.isArray(candidate.comments) ? candidate.comments : [];
      candidate.comments = list
        .map((c, i) => (typeof c === 'string' ? { angle: `Pitch ${i + 1}`, text: c.trim() } : { angle: String(c?.angle || `Pitch ${i + 1}`), text: String(c?.text || '').trim() }))
        .filter((c) => c.text);
      if (candidate.comments.length < 6) {
        const fbComments = buildLocalAutoGenerateBg('comments', brand, landingContext).comments;
        for (const fc of fbComments) {
          if (candidate.comments.length >= 8) break;
          candidate.comments.push(fc);
        }
      }
    }
    return { data: candidate, source: sourceLabel || 'byok' };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

logger.log('Background script loaded successfully');