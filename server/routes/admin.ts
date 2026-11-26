import {
  createOpenRouterCompletion,
  getConsultationModelAsync,
  isOpenRouterConfiguredAsync,
  testOpenRouterConnection,
} from '../services/openrouter';
import crypto from 'crypto';
import { Router } from 'express';
import { getSupabaseAdmin, isSupabaseServerConfigured } from '../lib/supabaseAdmin';
import {
  isPrimaryAdminEmail,
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth';
import { isAstrologyApiConfigured } from '../services/astrologyApi';
import { sendClientInviteEmail, sendSupportReplyEmail } from '../services/email';
import {
  ALL_DEFAULT_PROMPTS,
  CORE_COUNCIL_CONSTITUTION,
  LEGACY_VEDIC_SUBSYSTEM_SLUGS,
  getFormulaCartridgesCached,
  getPriorityRulesCached,
  invalidatePromptCache,
} from '../services/promptDefaults';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
} from '../../lib/vedicTypes';
import {
  ALL_GUIDE_CATALOG_META,
  DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT,
  DEFAULT_COMPANION_ARCHETYPES,
  DEFAULT_COMPANION_CHART_PRESENCE_PROMPT,
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
  DEFAULT_COMPANION_REALISM_BASELINE,
  DEFAULT_CORE_COUNCIL_CONSTITUTION,
  DEFAULT_FORMAT_CONTRACTS,
  DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
  DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
  DEFAULT_VEDIC_ANTI_CLICHE_RULES,
  DEFAULT_VEDIC_TIER1_REASONING_LAWS,
  WESTERN_ANTI_CLICHE_RULES,
  WESTERN_CORE_COUNCIL_CONSTITUTION,
  WESTERN_FORMAT_CONTRACTS,
  WESTERN_TIER1_REASONING_LAWS,
  GUIDE_SLUGS,
  getGuideCatalogMeta,
  isValidGuideSlug,
  normalizeChatStyle,
  type GuideSlug,
} from '../services/enginePromptDefaults';
import {
  COMPANION_MONOGRAM_PALETTES,
  COMPANION_PORTRAIT_GALLERY,
  DEFAULT_COMPANION_PRESETS,
  deleteAdminCompanion,
  getAdminCompanionsList,
  invalidateCompanionsCache,
  isCompanionsTableReady,
  reorderAdminCompanions,
  resetAdminCompanionToDefault,
  upsertAdminCompanion,
} from '../services/companionPresets';
import { ASTRA_MOON_BENCHMARK_SLUG } from '../services/astraMoonBenchmark';
import {
  compileCompanionCapsule,
  discardCompanionDraft,
  executeAdminCompanionTestTurn,
  exportBulkCompanionsBundle,
  exportGlobalCompanionBundle,
  exportSingleCompanionBundle,
  getBlankV2Templates,
  getCompanionSpecializations,
  getCompanionV2EditorState,
  getFormulaCartridgesCatalogSummary,
  getMigration022Status,
  importBulkCompanionsBundle,
  importGlobalCompanionBundle,
  importSingleCompanionBundle,
  listCompanionVersions,
  publishCompanionDraft,
  rollbackCompanionToVersion,
  saveCompanionDraft,
  saveCompanionSpecializations,
  toAdminCompanionRosterSummary,
} from '../services/companionV2Service';
import { stripUnsafeJsonKeys } from '../../lib/companionV2Schema';
import {
  BUILTIN_MODEL_SUGGESTIONS,
  DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
  DEFAULT_CONVERSATIONAL_RULES,
  DEFAULT_DEEPER_ANALYSIS_RULES,
  DEFAULT_FOLLOWUPS_RULES,
  DEFAULT_MINI_APPS_CONFIG,
  DEFAULT_SUGGESTIONS_CONFIG,
  encryptSecret,
  getAiSettings,
  getBirthChartConversionConfig,
  getChatbotConfig,
  getEnginePromptDefaultsBundle,
  getEnginePromptOverrides,
  getMiniAppsConfig,
  getPerGuideChatbotConfig,
  getPlaybookOverrides,
  getPricingConfig,
  getPromptRecipes,
  getResolvedGuideConfig,
  getResolvedOpenRouterRuntime,
  getSuggestionsConfig,
  invalidateAllPlatformCaches,
  invalidateRecipesCache,
  sanitizeBirthChartConversionConfig,
  savePlatformSetting,
  type BirthChartConversionConfig,
  type EnginePromptOverrides,
  type GuideChatbotOverride,
  type MiniAppOverrideConfig,
  type MiniAppsGovernanceConfig,
  type ModularRuleBlock,
  type PerGuideChatbotConfigMap,
  type PlaybookOverrideEntry,
  type PlaybookOverridesMap,
  type PromptRecipeStep,
} from '../services/platformSettings';
import {
  CANONICAL_PLAYBOOKS,
  getPlaybooksCatalogSummary,
} from '../services/canonicalPlaybooks';
import {
  createDynamicCategory,
  createDynamicMiniApp,
  deleteDynamicCategory,
  deleteDynamicMiniApp,
  getDynamicMiniAppsAdminCatalog,
  invalidateMiniAppsRegistryCache,
  reorderDynamicCategories,
  reorderDynamicMiniApps,
  syncMiniAppsConfigOverridesToRegistry,
  updateDynamicCategory,
  updateDynamicMiniApp,
  type MiniAppMutationPayload,
} from '../services/miniAppsRegistry';
import { clearMiniAppsMemoryCache } from './apps';
import { ensureReportCatalogSeeded } from '../services/reportDefaults';
import { isSanityConfigured } from '../../lib/sanity';
import {
  clearChatbotPipelineLogs,
  getChatbotPipelineLogs,
  isPipelineLogsTableReady,
} from '../services/pipelineLogger';

const router = Router();

// All routes in /api/admin require authenticated admin privileges
router.use(requireAuth, requireAdmin);

let defaultPromptsSeeded = false;

function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    msg.includes('column') ||
    msg.includes('schema cache')
  );
}

async function ensureDefaultPromptsSeeded(): Promise<void> {
  if (defaultPromptsSeeded) return;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    const { data: existing } = await supabaseAdmin
      .from('system_prompts')
      .select('slug');

    const existingSlugs = new Set(
      (existing || []).map((r) => String(r.slug || '').trim().toLowerCase())
    );
    const missing = ALL_DEFAULT_PROMPTS.filter(
      (p) => !existingSlugs.has(p.slug.trim().toLowerCase())
    );

    if (missing.length > 0) {
      const insertBatch = async (
        items: typeof missing,
        overrideCategory?: string
      ) => {
        const extRes = await supabaseAdmin
          .from('system_prompts')
          .insert(
            items.map((p) => ({
              slug: p.slug,
              category: overrideCategory || p.category,
              display_name: p.display_name,
              subtitle: p.subtitle,
              description: p.description ?? null,
              tags: Array.isArray(p.tags) ? p.tags : [],
              sort_order: typeof p.sort_order === 'number' ? p.sort_order : 100,
              prompt_body: p.prompt_body,
              version: 1,
              previous_versions: [],
              is_active: true,
            }))
          )
          .select('id, slug');

        if (!extRes.error) return extRes;

        if (isMissingColumnError(extRes.error)) {
          const withSubRes = await supabaseAdmin
            .from('system_prompts')
            .insert(
              items.map((p) => ({
                slug: p.slug,
                category: overrideCategory || p.category,
                display_name: p.display_name,
                subtitle: p.subtitle,
                prompt_body: p.prompt_body,
                version: 1,
                previous_versions: [],
                is_active: true,
              }))
            )
            .select('id, slug');

          if (!withSubRes.error) return withSubRes;

          if (isMissingColumnError(withSubRes.error)) {
            return supabaseAdmin
              .from('system_prompts')
              .insert(
                items.map((p) => ({
                  slug: p.slug,
                  category: overrideCategory || p.category,
                  display_name: p.display_name,
                  prompt_body: p.prompt_body,
                  version: 1,
                  previous_versions: [],
                  is_active: true,
                }))
              )
              .select('id, slug');
          }
          return withSubRes;
        }

        return extRes;
      };

      const fullAttempt = await insertBatch(missing);
      if (fullAttempt.error && isCategoryCheckConstraintError(fullAttempt.error)) {
        const standardMissing = missing.filter(
          (p) => !FALLBACK_OVERRIDE_CATEGORIES.has(p.category)
        );
        const overrideMissing = missing.filter((p) =>
          FALLBACK_OVERRIDE_CATEGORIES.has(p.category)
        );

        if (standardMissing.length > 0) {
          await insertBatch(standardMissing);
        }

        if (overrideMissing.length > 0) {
          const fallbackInsert = await insertBatch(overrideMissing, 'system');
          if (!fallbackInsert.error && Array.isArray(fallbackInsert.data)) {
            const catBySlug = new Map(
              overrideMissing.map((p) => [p.slug.toLowerCase(), p.category])
            );
            const currentOverrides = await readPromptCategoryOverrides(supabaseAdmin);
            let changed = false;
            for (const row of fallbackInsert.data as Array<{ id: string; slug: string }>) {
              const targetCat = catBySlug.get(String(row.slug || '').toLowerCase());
              if (targetCat) {
                currentOverrides[row.id] = targetCat;
                promptCategoryOverridesMemory.set(row.id, targetCat);
                changed = true;
              }
            }
            if (changed) {
              try {
                await supabaseAdmin.from('platform_settings').upsert(
                  {
                    key: PROMPT_CATEGORY_OVERRIDES_KEY,
                    value_json: currentOverrides,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'key' }
                );
              } catch {
                // In-memory map preserves state
              }
            }
          }
        }
      }
      invalidatePromptCache();
    }
    defaultPromptsSeeded = true;
  } catch (err) {
    console.warn('[admin] Prompt seed warning:', err);
  }
}

// 1. Platform Overview Analytics
router.get('/overview', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const [
    { count: totalUsers },
    { count: totalProfiles },
    { count: activatedProfiles },
    { count: totalConversations },
    { count: totalMessages },
    { count: totalOrders },
    { data: creditSums },
    { data: succeededPayments },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_activated', true),
    supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user'),
    supabaseAdmin.from('report_orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('credits_balance, tier'),
    supabaseAdmin
      .from('payment_orders')
      .select('amount_paid, currency')
      .eq('status', 'succeeded'),
  ]);

  const totalCreditsCirculating = (creditSums || []).reduce(
    (sum, u) => sum + (Number(u.credits_balance) || 0),
    0
  );

  const tierBreakdown = (creditSums || []).reduce(
    (acc, u) => {
      const t = u.tier || 'personal';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const revenueByCurrency = (succeededPayments || []).reduce(
    (acc, p) => {
      const curr = p.currency || 'INR';
      acc[curr] = (acc[curr] || 0) + Number(p.amount_paid || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const hasPublicUrl = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasPublicAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

  const [runtime, openTicketsRes, appRunsTotalRes, appRunsCachedRes] = await Promise.all([
    getResolvedOpenRouterRuntime(),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved')
      .then((r) => (r.error ? { count: 0 } : r)),
    supabaseAdmin
      .from('app_usage_logs')
      .select('id', { count: 'exact', head: true })
      .then((r) => (r.error ? { count: 0 } : r)),
    supabaseAdmin
      .from('app_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('cache_hit', true)
      .then((r) => (r.error ? { count: 0 } : r)),
  ]);

  const totalAppRuns = appRunsTotalRes.count || 0;
  const appCacheHits = appRunsCachedRes.count || 0;
  const appCacheHitRate =
    totalAppRuns > 0 ? Math.round((appCacheHits / totalAppRuns) * 100) : 0;

  res.json({
    metrics: {
      totalUsers: totalUsers || 0,
      totalProfiles: totalProfiles || 0,
      activatedProfiles: activatedProfiles || 0,
      totalConversations: totalConversations || 0,
      totalQuestionsAsked: totalMessages || 0,
      totalReportOrders: totalOrders || 0,
      totalCreditsCirculating,
      openSupportTickets: openTicketsRes.count || 0,
      totalAppRuns,
      appCacheHits,
      appCacheHitRate,
      tierBreakdown,
      revenueByCurrency,
    },
    aiRuntime: {
      consultationModel: runtime.consultationModel,
      utilityModel: runtime.utilityModel,
      jevClassifierEnabled: runtime.jevClassifierEnabled,
      jevModel: runtime.jevModel,
      pipelineLoggingEnabled: runtime.pipelineLoggingEnabled,
      keySource: runtime.keySource,
      maskedKey: runtime.maskedKey,
    },
    integrations: {
      supabaseServer: isSupabaseServerConfigured(),
      supabaseClient: hasPublicUrl && hasPublicAnon,
      openrouter: Boolean(runtime.apiKey),
      freeAstrologyApi: isAstrologyApiConfigured(),
      dodoPayments: Boolean(process.env.DODO_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      sanityBlog: isSanityConfigured(),
    },
  });
});

// 2. Users Directory with Profile, Question & Anti-Abuse Cluster Counts
router.get('/users', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  let query = supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data: users, error } = await query;
  if (error) {
    res.status(500).json({ error: 'Failed to fetch user directory' });
    return;
  }

  const userIds = (users || []).map((u) => u.id);
  const [profileRes, convoRes, ipUsersRes, fpRes] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin
          .from('profiles')
          .select('user_id, is_activated, chart_fingerprint')
          .in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabaseAdmin.from('conversations').select('user_id, total_word_count').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('users').select('id, signup_ip_hash, last_ip_hash').limit(1000),
    supabaseAdmin
      .from('profiles')
      .select('user_id, chart_fingerprint')
      .not('chart_fingerprint', 'is', null)
      .limit(2000),
  ]);

  let profileRows = profileRes.data as Array<{
    user_id: string;
    is_activated: boolean;
    chart_fingerprint?: string | null;
  }> | null;
  if (profileRes.error && userIds.length > 0) {
    const fallbackProf = await supabaseAdmin
      .from('profiles')
      .select('user_id, is_activated')
      .in('user_id', userIds);
    profileRows = fallbackProf.data || [];
  }

  const convoRows = convoRes.data || [];

  const profileCounts = new Map<string, { total: number; activated: number }>();
  for (const p of profileRows || []) {
    const curr = profileCounts.get(p.user_id) || { total: 0, activated: 0 };
    curr.total += 1;
    if (p.is_activated) curr.activated += 1;
    profileCounts.set(p.user_id, curr);
  }

  const convoCounts = new Map<string, number>();
  for (const c of convoRows) {
    convoCounts.set(c.user_id, (convoCounts.get(c.user_id) || 0) + 1);
  }

  // Compute IP-cluster sizes across accounts without exposing raw hashes/IPs
  const ipHashUsers = new Map<string, Set<string>>();
  if (!ipUsersRes.error && Array.isArray(ipUsersRes.data)) {
    for (const row of ipUsersRes.data as Array<{
      id: string;
      signup_ip_hash?: string | null;
      last_ip_hash?: string | null;
    }>) {
      if (row.signup_ip_hash) {
        const set = ipHashUsers.get(row.signup_ip_hash) || new Set<string>();
        set.add(row.id);
        ipHashUsers.set(row.signup_ip_hash, set);
      }
      if (row.last_ip_hash) {
        const set = ipHashUsers.get(row.last_ip_hash) || new Set<string>();
        set.add(row.id);
        ipHashUsers.set(row.last_ip_hash, set);
      }
    }
  }

  // Compute cross-account fuzzy chart fingerprint collisions
  const fpUsers = new Map<string, Set<string>>();
  if (!fpRes.error && Array.isArray(fpRes.data)) {
    for (const row of fpRes.data as Array<{
      user_id: string;
      chart_fingerprint?: string | null;
    }>) {
      if (row.chart_fingerprint) {
        const set = fpUsers.get(row.chart_fingerprint) || new Set<string>();
        set.add(row.user_id);
        fpUsers.set(row.chart_fingerprint, set);
      }
    }
  }

  const duplicateChartCounts = new Map<string, number>();
  for (const p of profileRows || []) {
    if (p.chart_fingerprint) {
      const owners = fpUsers.get(p.chart_fingerprint);
      if (owners && owners.size > 1) {
        duplicateChartCounts.set(p.user_id, (duplicateChartCounts.get(p.user_id) || 0) + 1);
      }
    }
  }

  const enriched = (users || []).map((u) => {
    const signupHash = (u as { signup_ip_hash?: string | null }).signup_ip_hash || null;
    const lastHash = (u as { last_ip_hash?: string | null }).last_ip_hash || null;
    const signupCluster = signupHash ? ipHashUsers.get(signupHash)?.size || 1 : 0;
    const lastCluster = lastHash ? ipHashUsers.get(lastHash)?.size || 1 : 0;

    let ipClusterSize = Math.max(signupCluster, lastCluster);
    let ipClusterId: string | null = null;
    if (signupCluster >= lastCluster && signupHash) {
      ipClusterId = signupHash.slice(0, 6);
    } else if (lastHash) {
      ipClusterId = lastHash.slice(0, 6);
    }
    if (ipClusterSize < 2) {
      ipClusterSize = signupHash || lastHash ? 1 : 0;
    }

    const safeUser = { ...u } as Record<string, unknown>;
    delete safeUser.signup_ip_hash;
    delete safeUser.last_ip_hash;

    return {
      ...safeUser,
      profile_count: profileCounts.get(u.id)?.total || 0,
      activated_profile_count: profileCounts.get(u.id)?.activated || 0,
      conversation_count: convoCounts.get(u.id) || 0,
      ip_cluster_size: ipClusterSize,
      ip_cluster_id: ipClusterId,
      duplicate_chart_count: duplicateChartCounts.get(u.id) || 0,
    };
  });

  res.json({ users: enriched });
});

// 3. Update User Tier / Status / Admin Flag / Atomic Credit Adjustment
router.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const targetUserId = req.params.id;
  const { tier, account_status, is_admin, creditAdjustment, adjustmentNote } =
    req.body || {};

  if (is_admin === false || account_status === 'suspended') {
    const { data: targetRow } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .maybeSingle();
    if (isPrimaryAdminEmail(targetRow?.email)) {
      res.status(400).json({ error: 'Primary admin account cannot be demoted or suspended.' });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (tier === 'personal' || tier === 'pro' || tier === 'guru') {
    updates.tier = tier;
  }
  if (account_status === 'active' || account_status === 'suspended') {
    updates.account_status = account_status;
  }
  if (typeof is_admin === 'boolean') {
    updates.is_admin = is_admin;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabaseAdmin
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);
    if (updErr) {
      res.status(500).json({ error: 'Failed to update user record' });
      return;
    }
  }

  const delta = Number(creditAdjustment) || 0;
  if (delta !== 0) {
    const note =
      typeof adjustmentNote === 'string' && adjustmentNote.trim()
        ? adjustmentNote.trim()
        : `Admin credit adjustment by ${req.appUser.email}`;

    if (delta > 0) {
      const { error: rpcErr } = await supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: targetUserId,
        p_amount: Math.round(delta),
        p_tx_type: 'admin_adjustment',
        p_reference_id: req.appUser.id,
        p_description: note,
      });
      if (rpcErr) {
        res.status(400).json({ error: rpcErr.message });
        return;
      }
    } else {
      const { error: rpcErr } = await supabaseAdmin.rpc('deduct_user_credits', {
        p_user_id: targetUserId,
        p_amount: Math.abs(Math.round(delta)),
        p_tx_type: 'admin_adjustment',
        p_reference_id: req.appUser.id,
        p_description: note,
      });
      if (rpcErr) {
        res.status(400).json({ error: rpcErr.message });
        return;
      }
    }
  }

  const { data: refreshed } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', targetUserId)
    .maybeSingle();

  res.json({ user: refreshed });
});

// 4. Modular System Prompts Management (with Version History + Rollback + Sandbox)
const VALID_PROMPT_CATEGORIES = [
  'system',
  'master_prompts',
  'expert',
  'analysis',
  'modifier',
  'tone',
  'mode',
  'output',
  'language',
  'tool',
  'report_step',
  'learn',
  'formula_cartridge',
  'priority_rule',
];

const FALLBACK_OVERRIDE_CATEGORIES = new Set([
  'master_prompts',
  'tone',
  'formula_cartridge',
  'priority_rule',
]);

const PROMPT_CATEGORY_OVERRIDES_KEY = 'prompt_category_overrides';
const promptCategoryOverridesMemory = new Map<string, string>();

function isCategoryCheckConstraintError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.code === '23514' ||
    msg.includes('system_prompts_category_check') ||
    msg.includes('check constraint')
  );
}

async function readPromptCategoryOverrides(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};
  for (const [k, v] of promptCategoryOverridesMemory.entries()) {
    merged[k] = v;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', PROMPT_CATEGORY_OVERRIDES_KEY)
      .maybeSingle();

    if (!error && data?.value_json && typeof data.value_json === 'object' && !Array.isArray(data.value_json)) {
      for (const [id, cat] of Object.entries(data.value_json as Record<string, unknown>)) {
        if (typeof cat === 'string' && VALID_PROMPT_CATEGORIES.includes(cat)) {
          merged[id] = cat;
          promptCategoryOverridesMemory.set(id, cat);
        }
      }
    }
  } catch {
    // Non-fatal: in-memory fallback remains active
  }
  return merged;
}

async function writePromptCategoryOverride(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  promptId: string,
  categoryOrNull: string | null
): Promise<void> {
  if (categoryOrNull) {
    promptCategoryOverridesMemory.set(promptId, categoryOrNull);
  } else {
    promptCategoryOverridesMemory.delete(promptId);
  }

  try {
    const current = await readPromptCategoryOverrides(supabaseAdmin);
    if (categoryOrNull) {
      current[promptId] = categoryOrNull;
    } else {
      delete current[promptId];
    }
    await supabaseAdmin.from('platform_settings').upsert(
      {
        key: PROMPT_CATEGORY_OVERRIDES_KEY,
        value_json: current,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {
    // Non-fatal: in-memory map preserves state for current server lifecycle
  }
}

router.get('/prompts', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  await ensureDefaultPromptsSeeded();

  const [{ data, error }, categoryOverrides] = await Promise.all([
    supabaseAdmin
      .from('system_prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('display_name', { ascending: true }),
    readPromptCategoryOverrides(supabaseAdmin),
  ]);

  if (error) {
    res.status(500).json({ error: 'Failed to load system prompts' });
    return;
  }

  const enriched = (data || []).map((row) =>
    categoryOverrides[row.id] ? { ...row, category: categoryOverrides[row.id] } : row
  );

  res.json({ prompts: enriched });
});

router.post('/prompts', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { slug, category, display_name, subtitle, description, prompt_body, model_id, tags, sort_order } =
    req.body || {};

  if (
    !slug?.trim() ||
    !VALID_PROMPT_CATEGORIES.includes(category) ||
    !display_name?.trim() ||
    !prompt_body?.trim()
  ) {
    res.status(400).json({ error: 'Valid slug, category, display_name, and prompt_body are required.' });
    return;
  }

  const normalizedSlug = String(slug)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');

  const normalizedSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : null;
  const normalizedDescription =
    typeof description === 'string' && description.trim() ? description.trim() : null;
  const normalizedModelId =
    typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null;
  const normalizedTags = Array.isArray(tags)
    ? Array.from(
        new Set(
          tags
            .map((t) => String(t).trim().replace(/^#+/, '').toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 25)
    : [];
  const normalizedSortOrder =
    typeof sort_order === 'number' && Number.isFinite(sort_order) ? Math.round(sort_order) : 100;

  const insertAttempt = async (dbCategory: string) => {
    let attempt = await supabaseAdmin
      .from('system_prompts')
      .insert({
        slug: normalizedSlug,
        category: dbCategory,
        display_name: display_name.trim(),
        subtitle: normalizedSubtitle,
        description: normalizedDescription,
        prompt_body: prompt_body.trim(),
        model_id: normalizedModelId,
        tags: normalizedTags,
        sort_order: normalizedSortOrder,
        version: 1,
        previous_versions: [],
        is_active: true,
      })
      .select('*')
      .single();

    if (attempt.error && isMissingColumnError(attempt.error)) {
      attempt = await supabaseAdmin
        .from('system_prompts')
        .insert({
          slug: normalizedSlug,
          category: dbCategory,
          display_name: display_name.trim(),
          subtitle: normalizedSubtitle,
          prompt_body: prompt_body.trim(),
          model_id: normalizedModelId,
          version: 1,
          previous_versions: [],
          is_active: true,
        })
        .select('*')
        .single();
    }

    if (attempt.error && isMissingColumnError(attempt.error)) {
      attempt = await supabaseAdmin
        .from('system_prompts')
        .insert({
          slug: normalizedSlug,
          category: dbCategory,
          display_name: display_name.trim(),
          prompt_body: prompt_body.trim(),
          version: 1,
          previous_versions: [],
          is_active: true,
        })
        .select('*')
        .single();
    }

    return attempt;
  };

  let usedFallbackOverride = false;
  let insertRes = await insertAttempt(category);

  if (
    insertRes.error &&
    isCategoryCheckConstraintError(insertRes.error) &&
    FALLBACK_OVERRIDE_CATEGORIES.has(category)
  ) {
    usedFallbackOverride = true;
    insertRes = await insertAttempt('system');
  }

  if (insertRes.error || !insertRes.data) {
    const errMsg = insertRes.error?.message || 'Could not create prompt';
    if (isCategoryCheckConstraintError(insertRes.error)) {
      res.status(400).json({
        error:
          'New prompt categories require running supabase/migrations/010_tone_prompt_category.sql in Supabase SQL Editor first.',
      });
      return;
    }
    res.status(400).json({ error: errMsg });
    return;
  }

  if (usedFallbackOverride) {
    await writePromptCategoryOverride(supabaseAdmin, insertRes.data.id, category);
  }

  invalidatePromptCache();
  res.status(201).json({
    prompt: usedFallbackOverride
      ? { ...insertRes.data, category }
      : insertRes.data,
  });
});

router.patch('/prompts/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: 'System prompt not found' });
    return;
  }

  const { display_name, subtitle, description, prompt_body, model_id, is_active, tags, sort_order, category } =
    req.body || {};

  const prevHistory = Array.isArray(existing.previous_versions)
    ? existing.previous_versions
    : [];

  const bodyChanged =
    typeof prompt_body === 'string' && prompt_body.trim() !== existing.prompt_body;

  const nextHistory = bodyChanged
    ? [
        {
          version: existing.version,
          prompt_body: existing.prompt_body,
          archived_at: new Date().toISOString(),
        },
        ...prevHistory,
      ].slice(0, 20)
    : prevHistory;

  const hasValidCategoryUpdate =
    typeof category === 'string' && VALID_PROMPT_CATEGORIES.includes(category);

  const buildPayloads = (includeCategory: boolean) => {
    const basePayload: Record<string, unknown> = {
      ...(typeof display_name === 'string' && display_name.trim()
        ? { display_name: display_name.trim() }
        : {}),
      ...(includeCategory && hasValidCategoryUpdate ? { category } : {}),
      ...(typeof prompt_body === 'string' ? { prompt_body: prompt_body.trim() } : {}),
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
      version: bodyChanged ? existing.version + 1 : existing.version,
      previous_versions: nextHistory,
      updated_at: new Date().toISOString(),
    };

    const midPayload: Record<string, unknown> = {
      ...basePayload,
      ...(subtitle !== undefined
        ? { subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : null }
        : {}),
      ...(model_id !== undefined
        ? { model_id: typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null }
        : {}),
    };

    const extendedPayload: Record<string, unknown> = {
      ...midPayload,
      ...(description !== undefined
        ? { description: typeof description === 'string' && description.trim() ? description.trim() : null }
        : {}),
      ...(Array.isArray(tags)
        ? {
            tags: Array.from(
              new Set(
                tags
                  .map((t) => String(t).trim().replace(/^#+/, '').toLowerCase())
                  .filter(Boolean)
              )
            ).slice(0, 25),
          }
        : {}),
      ...(typeof sort_order === 'number' && Number.isFinite(sort_order)
        ? { sort_order: Math.round(sort_order) }
        : {}),
    };

    return { basePayload, midPayload, extendedPayload };
  };

  const runUpdate = async (includeCategory: boolean) => {
    const { basePayload, midPayload, extendedPayload } = buildPayloads(includeCategory);
    let attempt = await supabaseAdmin
      .from('system_prompts')
      .update(extendedPayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (attempt.error && isMissingColumnError(attempt.error)) {
      attempt = await supabaseAdmin
        .from('system_prompts')
        .update(midPayload)
        .eq('id', existing.id)
        .select('*')
        .single();
    }

    if (attempt.error && isMissingColumnError(attempt.error)) {
      attempt = await supabaseAdmin
        .from('system_prompts')
        .update(basePayload)
        .eq('id', existing.id)
        .select('*')
        .single();
    }

    return attempt;
  };

  let usedFallbackOverride = false;
  let updateRes = await runUpdate(true);

  if (
    updateRes.error &&
    isCategoryCheckConstraintError(updateRes.error) &&
    typeof category === 'string' &&
    FALLBACK_OVERRIDE_CATEGORIES.has(category)
  ) {
    usedFallbackOverride = true;
    updateRes = await runUpdate(false);
  }

  if (updateRes.error || !updateRes.data) {
    res.status(500).json({ error: updateRes.error?.message || 'Failed to update system prompt' });
    return;
  }

  if (usedFallbackOverride && typeof category === 'string') {
    await writePromptCategoryOverride(supabaseAdmin, existing.id, category);
  } else if (hasValidCategoryUpdate) {
    // Clear any stale override once DB accepted the native category directly
    await writePromptCategoryOverride(supabaseAdmin, existing.id, null);
  }

  const overrides = await readPromptCategoryOverrides(supabaseAdmin);
  const resolvedPrompt = overrides[updateRes.data.id]
    ? { ...updateRes.data, category: overrides[updateRes.data.id] }
    : updateRes.data;

  invalidatePromptCache();
  res.json({ prompt: resolvedPrompt });
});

router.delete('/prompts/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('system_prompts')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    res.status(500).json({ error: error.message || 'Failed to delete prompt' });
    return;
  }

  await writePromptCategoryOverride(supabaseAdmin, String(req.params.id), null);
  invalidatePromptCache();
  res.json({ deleted: true });
});

router.post('/prompts/:id/rollback', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const targetVersion = Number(req.body?.version);
  const { data: existing } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: 'Prompt not found' });
    return;
  }

  const history = Array.isArray(existing.previous_versions)
    ? (existing.previous_versions as Array<{
        version: number;
        prompt_body: string;
        archived_at: string;
      }>)
    : [];

  const match = history.find((v) => v.version === targetVersion);
  if (!match) {
    res.status(404).json({ error: `Archived version ${targetVersion} not found` });
    return;
  }

  const nextHistory = [
    {
      version: existing.version,
      prompt_body: existing.prompt_body,
      archived_at: new Date().toISOString(),
    },
    ...history,
  ].slice(0, 20);

  const { data: updated, error } = await supabaseAdmin
    .from('system_prompts')
    .update({
      prompt_body: match.prompt_body,
      version: existing.version + 1,
      previous_versions: nextHistory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: 'Rollback failed' });
    return;
  }

  invalidatePromptCache();
  res.json({ prompt: updated });
});

router.post('/prompts/import', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawList = Array.isArray(req.body?.prompts)
    ? req.body.prompts
    : Array.isArray(req.body)
    ? req.body
    : null;

  if (!rawList || rawList.length === 0) {
    res.status(400).json({ error: 'Provide a non-empty "prompts" array to import.' });
    return;
  }

  if (rawList.length > 500) {
    res.status(400).json({ error: 'Import is limited to 500 prompts per batch.' });
    return;
  }

  const conflictMode: 'skip' | 'upsert' =
    req.body?.conflictMode === 'upsert' ? 'upsert' : 'skip';

  const normalizeIncomingCategory = (rawCat: unknown): string | null => {
    if (typeof rawCat !== 'string') return null;
    const cleaned = rawCat
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return VALID_PROMPT_CATEGORIES.includes(cleaned) ? cleaned : null;
  };

  const normalizeIncomingTags = (rawTags: unknown): string[] => {
    const list = Array.isArray(rawTags)
      ? rawTags
      : typeof rawTags === 'string'
      ? rawTags.split(',')
      : [];
    return Array.from(
      new Set(
        list
          .map((t) => String(t).trim().replace(/^#+/, '').toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 25);
  };

  const { data: existingRows, error: fetchErr } = await supabaseAdmin
    .from('system_prompts')
    .select('*');

  if (fetchErr) {
    res.status(500).json({ error: 'Failed to inspect existing prompt library.' });
    return;
  }

  const existingBySlug = new Map<string, any>();
  for (const row of existingRows || []) {
    if (row?.slug) {
      existingBySlug.set(String(row.slug).toLowerCase(), row);
    }
  }

  const created: any[] = [];
  const updated: any[] = [];
  const skipped: Array<{ slug: string; display_name: string; reason: string }> = [];
  const errors: Array<{ slug: string; error: string }> = [];

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      errors.push({ slug: `item_${i + 1}`, error: 'Invalid prompt entry object' });
      continue;
    }

    const displayName =
      typeof raw.display_name === 'string' ? raw.display_name.trim() : '';
    const rawSlugInput =
      typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug : displayName;
    const normalizedSlug = String(rawSlugInput || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const category = normalizeIncomingCategory(raw.category);
    const promptBody =
      typeof raw.prompt_body === 'string' ? raw.prompt_body.trim() : '';

    if (!normalizedSlug || !displayName || !promptBody || !category) {
      errors.push({
        slug: normalizedSlug || displayName || `item_${i + 1}`,
        error: !category
          ? `Invalid or missing category "${String(raw.category || '')}"`
          : 'Missing required display_name, slug, or prompt_body',
      });
      continue;
    }

    const normalizedSubtitle =
      typeof raw.subtitle === 'string' && raw.subtitle.trim() ? raw.subtitle.trim() : null;
    const normalizedDescription =
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : null;
    const normalizedModelId =
      typeof raw.model_id === 'string' && raw.model_id.trim() ? raw.model_id.trim() : null;
    const normalizedTags = normalizeIncomingTags(raw.tags);
    const normalizedSortOrder =
      typeof raw.sort_order === 'number' && Number.isFinite(raw.sort_order)
        ? Math.round(raw.sort_order)
        : 100;
    const normalizedActive =
      typeof raw.is_active === 'boolean' ? raw.is_active : true;

    const existing = existingBySlug.get(normalizedSlug);

    if (existing) {
      if (conflictMode === 'skip') {
        skipped.push({
          slug: normalizedSlug,
          display_name: displayName,
          reason: 'Slug already exists',
        });
        continue;
      }

      const prevHistory = Array.isArray(existing.previous_versions)
        ? existing.previous_versions
        : [];
      const bodyChanged = promptBody !== String(existing.prompt_body || '');
      const nextHistory = bodyChanged
        ? [
            {
              version: existing.version || 1,
              prompt_body: existing.prompt_body,
              archived_at: new Date().toISOString(),
            },
            ...prevHistory,
          ].slice(0, 20)
        : prevHistory;

      const buildUpdatePayloads = (includeCategory: boolean) => {
        const basePayload: Record<string, unknown> = {
          display_name: displayName,
          ...(includeCategory ? { category } : {}),
          prompt_body: promptBody,
          is_active: normalizedActive,
          version: bodyChanged ? (existing.version || 1) + 1 : existing.version || 1,
          previous_versions: nextHistory,
          updated_at: new Date().toISOString(),
        };
        const midPayload: Record<string, unknown> = {
          ...basePayload,
          subtitle: normalizedSubtitle,
          model_id: normalizedModelId,
        };
        const extendedPayload: Record<string, unknown> = {
          ...midPayload,
          description: normalizedDescription,
          tags: normalizedTags,
          sort_order: normalizedSortOrder,
        };
        return { basePayload, midPayload, extendedPayload };
      };

      const runUpdate = async (includeCategory: boolean) => {
        const { basePayload, midPayload, extendedPayload } = buildUpdatePayloads(includeCategory);
        let attempt = await supabaseAdmin
          .from('system_prompts')
          .update(extendedPayload)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (attempt.error && isMissingColumnError(attempt.error)) {
          attempt = await supabaseAdmin
            .from('system_prompts')
            .update(midPayload)
            .eq('id', existing.id)
            .select('*')
            .single();
        }
        if (attempt.error && isMissingColumnError(attempt.error)) {
          attempt = await supabaseAdmin
            .from('system_prompts')
            .update(basePayload)
            .eq('id', existing.id)
            .select('*')
            .single();
        }
        return attempt;
      };

      let usedFallbackOverride = false;
      let updateRes = await runUpdate(true);
      if (
        updateRes.error &&
        isCategoryCheckConstraintError(updateRes.error) &&
        FALLBACK_OVERRIDE_CATEGORIES.has(category)
      ) {
        usedFallbackOverride = true;
        updateRes = await runUpdate(false);
      }

      if (updateRes.error || !updateRes.data) {
        errors.push({
          slug: normalizedSlug,
          error: updateRes.error?.message || 'Failed to update existing prompt',
        });
        continue;
      }

      if (usedFallbackOverride) {
        await writePromptCategoryOverride(supabaseAdmin, existing.id, category);
      } else {
        await writePromptCategoryOverride(supabaseAdmin, existing.id, null);
      }

      const resolved = usedFallbackOverride
        ? { ...updateRes.data, category }
        : updateRes.data;
      existingBySlug.set(normalizedSlug, resolved);
      updated.push(resolved);
    } else {
      const insertAttempt = async (dbCategory: string) => {
        let attempt = await supabaseAdmin
          .from('system_prompts')
          .insert({
            slug: normalizedSlug,
            category: dbCategory,
            display_name: displayName,
            subtitle: normalizedSubtitle,
            description: normalizedDescription,
            prompt_body: promptBody,
            model_id: normalizedModelId,
            tags: normalizedTags,
            sort_order: normalizedSortOrder,
            version: 1,
            previous_versions: [],
            is_active: normalizedActive,
          })
          .select('*')
          .single();

        if (attempt.error && isMissingColumnError(attempt.error)) {
          attempt = await supabaseAdmin
            .from('system_prompts')
            .insert({
              slug: normalizedSlug,
              category: dbCategory,
              display_name: displayName,
              subtitle: normalizedSubtitle,
              prompt_body: promptBody,
              model_id: normalizedModelId,
              version: 1,
              previous_versions: [],
              is_active: normalizedActive,
            })
            .select('*')
            .single();
        }

        if (attempt.error && isMissingColumnError(attempt.error)) {
          attempt = await supabaseAdmin
            .from('system_prompts')
            .insert({
              slug: normalizedSlug,
              category: dbCategory,
              display_name: displayName,
              prompt_body: promptBody,
              version: 1,
              previous_versions: [],
              is_active: normalizedActive,
            })
            .select('*')
            .single();
        }

        return attempt;
      };

      let usedFallbackOverride = false;
      let insertRes = await insertAttempt(category);
      if (
        insertRes.error &&
        isCategoryCheckConstraintError(insertRes.error) &&
        FALLBACK_OVERRIDE_CATEGORIES.has(category)
      ) {
        usedFallbackOverride = true;
        insertRes = await insertAttempt('system');
      }

      if (insertRes.error || !insertRes.data) {
        errors.push({
          slug: normalizedSlug,
          error: insertRes.error?.message || 'Failed to insert prompt',
        });
        continue;
      }

      if (usedFallbackOverride) {
        await writePromptCategoryOverride(supabaseAdmin, insertRes.data.id, category);
      }

      const resolved = usedFallbackOverride
        ? { ...insertRes.data, category }
        : insertRes.data;
      existingBySlug.set(normalizedSlug, resolved);
      created.push(resolved);
    }
  }

  if (created.length > 0 || updated.length > 0) {
    invalidatePromptCache();
  }

  res.json({ created, updated, skipped, errors });
});

// Live Prompt Test Sandbox (Server-side OpenRouter evaluation)
router.post('/prompts/test', async (req: AuthenticatedRequest, res) => {
  if (!(await isOpenRouterConfiguredAsync())) {
    res.status(503).json({ error: 'OPENROUTER_API_KEY not configured on server' });
    return;
  }

  const { promptBody, testQuestion, chartContext, modelId } = req.body || {};
  if (!String(promptBody || '').trim() || !String(testQuestion || '').trim()) {
    res.status(400).json({ error: 'Draft prompt body and test question are required.' });
    return;
  }

  const targetModel =
    typeof modelId === 'string' && modelId.trim()
      ? modelId.trim()
      : await getConsultationModelAsync();

  try {
    const completion = await createOpenRouterCompletion({
      model: targetModel,
      system: `${CORE_COUNCIL_CONSTITUTION}\n\n${String(promptBody).trim()}${
        chartContext ? `\n\nTEST CHART CONTEXT:\n${String(chartContext).trim()}` : ''
      }`,
      messages: [{ role: 'user', content: String(testQuestion).trim() }],
      temperature: 0.4,
    });

    res.json({
      output: completion.text.trim(),
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      modelUsed: targetModel,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sandbox failed' });
  }
});

// 5. Report Catalog & Sequential Prompt Chain Editor
router.get('/reports', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  await ensureReportCatalogSeeded();

  const { data, error } = await supabaseAdmin
    .from('report_catalog')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Failed to load report catalog' });
    return;
  }

  res.json({ reports: data || [] });
});

router.post('/reports', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const {
    slug,
    name,
    category,
    short_description,
    long_description,
    price_credits,
    sort_order,
    is_active,
    prompt_chain_json,
    model_id,
  } = req.body || {};

  if (!String(name || '').trim() || !String(category || '').trim() || !String(short_description || '').trim()) {
    res.status(400).json({ error: 'Report name, category, and short description are required.' });
    return;
  }

  const normalizedSlug = String(slug || name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalizedSlug) {
    res.status(400).json({ error: 'Valid URL slug is required.' });
    return;
  }

  const chain =
    Array.isArray(prompt_chain_json) && prompt_chain_json.length > 0
      ? prompt_chain_json.map(
          (
            step: {
              title?: string;
              instruction?: string;
              promptSlugs?: string[];
              recipeSlug?: string | null;
              modelId?: string | null;
            },
            idx: number
          ) => ({
            stepNumber: idx + 1,
            title: String(step?.title || `Pass ${idx + 1}`).trim(),
            instruction: String(step?.instruction || '').trim(),
            ...(Array.isArray(step?.promptSlugs) && step.promptSlugs.length > 0
              ? { promptSlugs: step.promptSlugs.map(String).filter(Boolean) }
              : {}),
            ...(typeof step?.recipeSlug === 'string' && step.recipeSlug.trim()
              ? { recipeSlug: step.recipeSlug.trim() }
              : {}),
            ...(typeof step?.modelId === 'string' && step.modelId.trim()
              ? { modelId: step.modelId.trim() }
              : {}),
          })
        )
      : [
          {
            stepNumber: 1,
            title: 'Pass 1 · Chart Foundation & Planetary Evidence',
            instruction: 'Audit the natal chart placements, divisional Vargas, and active Dashas.',
          },
          {
            stepNumber: 2,
            title: 'Pass 2 · Strategic Synthesis & Dossier Compilation',
            instruction: 'Compile a clear, editorial-grade Vedic report answering every user question.',
          },
        ];

  const baseInsert = {
    slug: normalizedSlug,
    name: String(name).trim(),
    category: String(category).trim(),
    short_description: String(short_description).trim(),
    long_description:
      typeof long_description === 'string' && long_description.trim()
        ? long_description.trim()
        : null,
    price_credits:
      typeof price_credits === 'number' && Number.isFinite(price_credits) && price_credits >= 0
        ? Math.round(price_credits)
        : 2500,
    sort_order:
      typeof sort_order === 'number' && Number.isFinite(sort_order)
        ? Math.round(sort_order)
        : 99,
    is_active: typeof is_active === 'boolean' ? is_active : true,
    prompt_chain_json: chain,
  };

  let insertRes = await supabaseAdmin
    .from('report_catalog')
    .insert({
      ...baseInsert,
      model_id: typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null,
    })
    .select('*')
    .single();

  if (insertRes.error && isMissingColumnError(insertRes.error)) {
    insertRes = await supabaseAdmin
      .from('report_catalog')
      .insert(baseInsert)
      .select('*')
      .single();
  }

  if (insertRes.error || !insertRes.data) {
    res.status(400).json({ error: insertRes.error?.message || 'Failed to create report catalog entry' });
    return;
  }

  res.status(201).json({ report: insertRes.data });
});

router.patch('/reports/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const {
    name,
    category,
    short_description,
    long_description,
    price_credits,
    sort_order,
    prompt_chain_json,
    is_active,
    model_id,
  } = req.body || {};

  const baseUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === 'string' && name.trim()) baseUpdates.name = name.trim();
  if (typeof category === 'string' && category.trim()) baseUpdates.category = category.trim();
  if (typeof short_description === 'string') baseUpdates.short_description = short_description.trim();
  if (long_description !== undefined) {
    baseUpdates.long_description =
      typeof long_description === 'string' && long_description.trim()
        ? long_description.trim()
        : null;
  }
  if (typeof price_credits === 'number' && Number.isFinite(price_credits) && price_credits >= 0) {
    baseUpdates.price_credits = Math.round(price_credits);
  }
  if (typeof sort_order === 'number' && Number.isFinite(sort_order)) {
    baseUpdates.sort_order = Math.round(sort_order);
  }
  if (Array.isArray(prompt_chain_json)) {
    baseUpdates.prompt_chain_json = prompt_chain_json.map(
      (
        step: {
          title?: string;
          instruction?: string;
          promptSlugs?: string[];
          recipeSlug?: string | null;
          modelId?: string | null;
        },
        idx: number
      ) => ({
        stepNumber: idx + 1,
        title: String(step?.title || `Pass ${idx + 1}`).trim(),
        instruction: String(step?.instruction || '').trim(),
        ...(Array.isArray(step?.promptSlugs) && step.promptSlugs.length > 0
          ? { promptSlugs: step.promptSlugs.map(String).filter(Boolean) }
          : {}),
        ...(typeof step?.recipeSlug === 'string' && step.recipeSlug.trim()
          ? { recipeSlug: step.recipeSlug.trim() }
          : {}),
        ...(typeof step?.modelId === 'string' && step.modelId.trim()
          ? { modelId: step.modelId.trim() }
          : {}),
      })
    );
  }
  if (typeof is_active === 'boolean') baseUpdates.is_active = is_active;

  const extendedUpdates: Record<string, unknown> = {
    ...baseUpdates,
    ...(model_id !== undefined
      ? { model_id: typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null }
      : {}),
  };

  let updateRes = await supabaseAdmin
    .from('report_catalog')
    .update(extendedUpdates)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (updateRes.error && isMissingColumnError(updateRes.error)) {
    updateRes = await supabaseAdmin
      .from('report_catalog')
      .update(baseUpdates)
      .eq('id', req.params.id)
      .select('*')
      .single();
  }

  if (updateRes.error || !updateRes.data) {
    res.status(500).json({ error: 'Failed to update report catalog entry' });
    return;
  }

  res.json({ report: updateRes.data });
});

router.delete('/reports/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin.from('report_catalog').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: error.message || 'Failed to delete report' });
    return;
  }
  res.json({ deleted: true });
});

// 6. Bulk Old-Client CSV Onboarding (forces must_change_password = true + optional credits + profile + Resend invite)
interface BulkClientRowInput {
  email: string;
  full_name?: string;
  credits_grant?: number;
  birth_name?: string;
  birth_date?: string;
  birth_time?: string;
  birth_city?: string;
  birth_country?: string;
  gender?: string;
}

router.post('/import-clients', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rows = Array.isArray(req.body?.clients) ? (req.body.clients as BulkClientRowInput[]) : [];
  const sendInviteEmails = Boolean(req.body?.sendInviteEmails);
  const origin = `${req.protocol}://${req.get('host')}`;
  const loginUrl = `${origin}/app/login`;

  if (rows.length === 0 || rows.length > 200) {
    res.status(400).json({ error: 'Provide between 1 and 200 client records.' });
    return;
  }

  const results: Array<{
    email: string;
    status: 'created' | 'updated' | 'error';
    message: string;
    inviteSent?: boolean;
  }> = [];

  for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      results.push({ email: row.email || '—', status: 'error', message: 'Invalid email' });
      continue;
    }

    const fullName = String(row.full_name || '').trim() || email.split('@')[0];
    const tempPassword = `CC-${crypto.randomBytes(6).toString('base64url')}!9`;

    try {
      let userId: string | null = null;
      let statusLabel: 'created' | 'updated' = 'created';

      // Check if user already exists in public.users
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
        statusLabel = 'updated';
        await supabaseAdmin
          .from('users')
          .update({
            full_name: fullName,
            must_change_password: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      } else {
        const { data: authCreated, error: authErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              must_change_password: true,
            },
          });

        if (authErr || !authCreated.user) {
          throw new Error(authErr?.message || 'Auth user creation failed');
        }
        userId = authCreated.user.id;
      }

      // Grant starting credits if requested
      const grantAmt = Number(row.credits_grant) || 0;
      if (grantAmt > 0 && userId) {
        await supabaseAdmin.rpc('grant_user_credits', {
          p_user_id: userId,
          p_amount: Math.round(grantAmt),
          p_tx_type: 'welcome_bonus',
          p_reference_id: req.appUser.id,
          p_description: 'Client migration welcome credits',
        });
      }

      // Pre-create birth profile if birth fields provided
      if (
        userId &&
        row.birth_date &&
        row.birth_time &&
        row.birth_city &&
        row.birth_country
      ) {
        await supabaseAdmin.from('profiles').insert({
          user_id: userId,
          name: (row.birth_name || fullName).trim(),
          birth_date: row.birth_date.trim(),
          birth_time:
            row.birth_time.trim().length === 5
              ? `${row.birth_time.trim()}:00`
              : row.birth_time.trim(),
          birth_city: row.birth_city.trim(),
          birth_country: row.birth_country.trim(),
          gender: ['male', 'female', 'non-binary'].includes(String(row.gender))
            ? row.gender
            : null,
        });
      }

      let inviteSent = false;
      if (sendInviteEmails && statusLabel === 'created') {
        const emailRes = await sendClientInviteEmail({
          to: email,
          name: fullName,
          loginUrl,
          tempPassword,
        });
        inviteSent = emailRes.sent;
      }

      results.push({
        email,
        status: statusLabel,
        message:
          statusLabel === 'created'
            ? 'Created account with forced password setup'
            : 'Updated existing account & flagged password setup',
        inviteSent,
      });
    } catch (err) {
      results.push({
        email,
        status: 'error',
        message: err instanceof Error ? err.message : 'Import error',
      });
    }
  }

  res.json({ results });
});

// 7. AI Settings (OpenRouter API Key Override, Models Registry, Token Limits, Jev & Pipeline Logs)
router.get('/settings/ai', async (_req: AuthenticatedRequest, res) => {
  const runtime = await getResolvedOpenRouterRuntime();
  res.json({
    keySource: runtime.keySource,
    maskedKey: runtime.maskedKey,
    hasDatabaseOverride: runtime.hasDatabaseOverride,
    hasEnvKey: runtime.hasEnvKey,
    consultation_model: runtime.consultationModel,
    utility_model: runtime.utilityModel,
    jev_classifier_enabled: runtime.jevClassifierEnabled,
    jev_model: runtime.jevModel,
    chatbot_pipeline_logging_enabled: runtime.pipelineLoggingEnabled,
    custom_models: runtime.customModels,
    builtin_models: BUILTIN_MODEL_SUGGESTIONS,
    token_limits: runtime.tokenLimits,
  });
});

router.put('/settings/ai', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const current = await getAiSettings();
  const {
    openrouter_api_key,
    consultation_model,
    utility_model,
    jev_classifier_enabled,
    jev_model,
    chatbot_pipeline_logging_enabled,
    custom_models,
    token_limits,
  } = req.body || {};

  let nextEncrypted = current.openrouter_api_key_encrypted ?? null;
  let nextLast4 = current.openrouter_api_key_last4 ?? null;

  if (typeof openrouter_api_key === 'string' && openrouter_api_key.trim()) {
    const cleanKey = openrouter_api_key.trim();
    if (cleanKey.length < 12) {
      res.status(400).json({ error: 'OpenRouter API key looks too short.' });
      return;
    }
    nextEncrypted = encryptSecret(cleanKey);
    nextLast4 = cleanKey.slice(-4);
  }

  const sanitizedCustomModels = Array.isArray(custom_models)
    ? custom_models
        .filter((m) => m && typeof m.id === 'string' && m.id.trim())
        .map((m) => ({
          id: String(m.id).trim().slice(0, 120),
          label: String(m.label || m.id).trim().slice(0, 80),
          provider: typeof m.provider === 'string' ? m.provider.trim().slice(0, 50) : undefined,
          notes: typeof m.notes === 'string' ? m.notes.trim().slice(0, 160) : undefined,
        }))
        .slice(0, 50)
    : current.custom_models;

  const nextLimits = {
    chat_short:
      typeof token_limits?.chat_short === 'number' && token_limits.chat_short >= 100
        ? Math.min(8000, Math.round(token_limits.chat_short))
        : current.token_limits.chat_short,
    chat_detailed:
      typeof token_limits?.chat_detailed === 'number' && token_limits.chat_detailed >= 200
        ? Math.min(16000, Math.round(token_limits.chat_detailed))
        : current.token_limits.chat_detailed,
    report_pass:
      typeof token_limits?.report_pass === 'number' && token_limits.report_pass >= 400
        ? Math.min(24000, Math.round(token_limits.report_pass))
        : current.token_limits.report_pass,
    utility:
      typeof token_limits?.utility === 'number' && token_limits.utility >= 100
        ? Math.min(4000, Math.round(token_limits.utility))
        : current.token_limits.utility,
    max_history_turns:
      typeof token_limits?.max_history_turns === 'number' && token_limits.max_history_turns >= 2
        ? Math.min(60, Math.round(token_limits.max_history_turns))
        : current.token_limits.max_history_turns,
  };

  const nextConfig = {
    openrouter_api_key_encrypted: nextEncrypted,
    openrouter_api_key_last4: nextLast4,
    consultation_model:
      typeof consultation_model === 'string' && consultation_model.trim()
        ? consultation_model.trim()
        : current.consultation_model,
    utility_model:
      typeof utility_model === 'string' && utility_model.trim()
        ? utility_model.trim()
        : current.utility_model,
    jev_classifier_enabled:
      typeof jev_classifier_enabled === 'boolean'
        ? jev_classifier_enabled
        : current.jev_classifier_enabled,
    jev_model:
      typeof jev_model === 'string' && jev_model.trim()
        ? jev_model.trim().slice(0, 120)
        : current.jev_model,
    chatbot_pipeline_logging_enabled:
      typeof chatbot_pipeline_logging_enabled === 'boolean'
        ? chatbot_pipeline_logging_enabled
        : current.chatbot_pipeline_logging_enabled,
    custom_models: sanitizedCustomModels,
    token_limits: nextLimits,
  };

  const saved = await savePlatformSetting('ai_config', nextConfig, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save AI settings.' });
    return;
  }

  const runtime = await getResolvedOpenRouterRuntime();
  res.json({
    saved: true,
    keySource: runtime.keySource,
    maskedKey: runtime.maskedKey,
    hasDatabaseOverride: runtime.hasDatabaseOverride,
    hasEnvKey: runtime.hasEnvKey,
    consultation_model: runtime.consultationModel,
    utility_model: runtime.utilityModel,
    jev_classifier_enabled: runtime.jevClassifierEnabled,
    jev_model: runtime.jevModel,
    chatbot_pipeline_logging_enabled: runtime.pipelineLoggingEnabled,
    custom_models: runtime.customModels,
    builtin_models: BUILTIN_MODEL_SUGGESTIONS,
    token_limits: runtime.tokenLimits,
  });
});

router.delete('/settings/ai/key', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  const current = await getAiSettings();
  const saved = await savePlatformSetting(
    'ai_config',
    {
      ...current,
      openrouter_api_key_encrypted: null,
      openrouter_api_key_last4: null,
    },
    req.appUser.id
  );
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to clear API key override.' });
    return;
  }
  const runtime = await getResolvedOpenRouterRuntime();
  res.json({
    cleared: true,
    keySource: runtime.keySource,
    maskedKey: runtime.maskedKey,
    hasDatabaseOverride: runtime.hasDatabaseOverride,
    hasEnvKey: runtime.hasEnvKey,
  });
});

router.post('/settings/ai/test', async (req: AuthenticatedRequest, res) => {
  const { openrouter_api_key, model } = req.body || {};
  const result = await testOpenRouterConnection({
    overrideApiKey: typeof openrouter_api_key === 'string' ? openrouter_api_key : null,
    model: typeof model === 'string' ? model : null,
  });
  res.json(result);
});

// 8. Chatbot Control Deck Settings
router.get('/settings/chatbot', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  await ensureDefaultPromptsSeeded();

  const [
    config,
    suggestionsConfig,
    recipes,
    aiSettings,
    perGuideResolvedList,
    engineOverrides,
    playbookOverrides,
    birthChartConversion,
    promptsRes,
  ] = await Promise.all([
    getChatbotConfig(),
    getSuggestionsConfig(),
    getPromptRecipes(),
    getAiSettings(),
    Promise.all(GUIDE_SLUGS.map((slug) => getResolvedGuideConfig(slug))),
    getEnginePromptOverrides(),
    getPlaybookOverrides(),
    getBirthChartConversionConfig(),
    supabaseAdmin
      .from('system_prompts')
      .select('id, slug, category, display_name, subtitle, prompt_body, is_active, model_id, sort_order, version, updated_at')
      .order('display_name', { ascending: true }),
  ]);

  let promptRows: Array<{
    id: string;
    slug: string;
    category: string;
    display_name: string;
    subtitle: string | null;
    prompt_body?: string | null;
    is_active: boolean;
    model_id: string | null;
    sort_order: number | null;
    version?: number;
    updated_at?: string | null;
  }> = (promptsRes.data as any[]) || [];

  if (promptsRes.error) {
    const fallback = await supabaseAdmin
      .from('system_prompts')
      .select('id, slug, category, display_name, prompt_body, is_active');
    promptRows = ((fallback.data as any[]) || []).map((r) => ({
      ...r,
      subtitle: null,
      model_id: null,
      sort_order: 100,
    }));
  }

  const uiCategories = new Set(['expert', 'mode', 'learn', 'language', 'output']);
  const cleanedPrompts = promptRows
    .filter(
      (row) =>
        uiCategories.has(row.category) &&
        !(row.category === 'expert' && LEGACY_VEDIC_SUBSYSTEM_SLUGS.has(row.slug))
    )
    .map(({ prompt_body: _body, ...rest }) => rest);

  const guideSystemPrompts: Record<
    string,
    {
      id: string | null;
      slug: string;
      display_name: string;
      subtitle: string | null;
      prompt_body: string;
      default_prompt_body: string;
      model_id: string | null;
      is_active: boolean;
      version: number;
      updated_at: string | null;
    }
  > = {};

  for (const meta of ALL_GUIDE_CATALOG_META) {
    if (!meta.hasSystemPromptRow) continue;
    const dbRow = promptRows.find((r) => r.slug === meta.slug);
    const seed = ALL_DEFAULT_PROMPTS.find((p) => p.slug === meta.slug);
    guideSystemPrompts[meta.slug] = {
      id: dbRow?.id || null,
      slug: meta.slug,
      display_name: dbRow?.display_name || meta.displayName,
      subtitle: dbRow?.subtitle ?? meta.subtitle ?? null,
      prompt_body: dbRow?.prompt_body || seed?.prompt_body || '',
      default_prompt_body: seed?.prompt_body || '',
      model_id: dbRow?.model_id || null,
      is_active: dbRow ? dbRow.is_active !== false : true,
      version: dbRow?.version || 1,
      updated_at: dbRow?.updated_at || null,
    };
  }

  const libraryPrompts = promptRows
    .filter(
      (row) =>
        row.is_active !== false &&
        !LEGACY_VEDIC_SUBSYSTEM_SLUGS.has(row.slug) &&
        Boolean(row.prompt_body && row.prompt_body.trim())
    )
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      category: row.category,
      display_name: row.display_name,
      subtitle: row.subtitle,
      prompt_body: row.prompt_body || '',
    }));

  const perGuideConfigs: Record<string, Awaited<ReturnType<typeof getResolvedGuideConfig>>> = {};
  for (const resolved of perGuideResolvedList) {
    perGuideConfigs[resolved.slug] = resolved;
  }

  res.json({
    config,
    suggestionsConfig,
    pipelineLoggingEnabled: Boolean(aiSettings.chatbot_pipeline_logging_enabled),
    defaultConversationalRules: DEFAULT_CONVERSATIONAL_RULES,
    defaultSuggestionsConfig: DEFAULT_SUGGESTIONS_CONFIG,
    prompts: cleanedPrompts,
    recipes,
    guidesMeta: ALL_GUIDE_CATALOG_META,
    perGuideConfigs,
    guideSystemPrompts,
    libraryPrompts,
    enginePrompts: {
      overrides: engineOverrides,
      defaults: getEnginePromptDefaultsBundle(),
    },
    playbookOverrides,
    canonicalPlaybooks: getPlaybooksCatalogSummary(),
    birthChartConversion,
    birthChartDefaults: DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
  });
});

router.put('/settings/chatbot', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const current = await getChatbotConfig();
  const body = req.body || {};

  const nextConfig = {
    welcome_title:
      typeof body.welcome_title === 'string' && body.welcome_title.trim()
        ? body.welcome_title.trim().slice(0, 120)
        : current.welcome_title,
    welcome_subtitle:
      typeof body.welcome_subtitle === 'string'
        ? body.welcome_subtitle.trim().slice(0, 280)
        : current.welcome_subtitle,
    general_ready_message:
      typeof body.general_ready_message === 'string' && body.general_ready_message.trim()
        ? body.general_ready_message.trim().slice(0, 400)
        : current.general_ready_message,
    composer_placeholder:
      typeof body.composer_placeholder === 'string' && body.composer_placeholder.trim()
        ? body.composer_placeholder.trim().slice(0, 180)
        : current.composer_placeholder,
    default_expert:
      typeof body.default_expert === 'string' && body.default_expert.trim()
        ? normalizeCouncilSlug(body.default_expert)
        : current.default_expert,
    default_mode:
      typeof body.default_mode === 'string' && body.default_mode.trim()
        ? body.default_mode.trim()
        : current.default_mode,
    default_output:
      typeof body.default_output === 'string' && body.default_output.trim()
        ? body.default_output.trim()
        : current.default_output,
    default_language:
      typeof body.default_language === 'string' && body.default_language.trim()
        ? body.default_language.trim()
        : current.default_language,
    default_tone:
      body.default_tone === 'friendly' || body.default_tone === 'technical'
        ? body.default_tone
        : current.default_tone,
    default_response_length:
      body.default_response_length === 'short' || body.default_response_length === 'detailed'
        ? body.default_response_length
        : current.default_response_length,
    chat_numeric_font:
      typeof body.chat_numeric_font === 'string' &&
      ['dm_sans', 'inter', 'plus_jakarta', 'roboto', 'cormorant', 'jetbrains_mono'].includes(
        body.chat_numeric_font
      )
        ? body.chat_numeric_font
        : current.chat_numeric_font,
    expert_order: Array.isArray(body.expert_order)
      ? Array.from(new Set(body.expert_order.map((s) => normalizeCouncilSlug(String(s))).filter(Boolean)))
      : current.expert_order,
    mode_order: Array.isArray(body.mode_order)
      ? body.mode_order.map(String).filter(Boolean)
      : current.mode_order,
    language_order: Array.isArray(body.language_order)
      ? body.language_order.map(String).filter(Boolean)
      : current.language_order,
    features: {
      ...current.features,
      ...(body.features && typeof body.features === 'object' ? body.features : {}),
    },
    conversational_rules:
      typeof body.conversational_rules === 'string' && body.conversational_rules.trim()
        ? body.conversational_rules.trim().slice(0, 4000)
        : current.conversational_rules,
  };

  const saved = await savePlatformSetting('chatbot_config', nextConfig, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save chatbot settings.' });
    return;
  }

  invalidatePromptCache();
  res.json({ saved: true, config: nextConfig });
});

router.put('/settings/chatbot/guide/:guideSlug', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!req.appUser || !supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlug = normalizeCouncilSlug(String(req.params.guideSlug || '').trim());
  if (!isValidGuideSlug(rawSlug)) {
    res.status(400).json({ error: 'Unknown guide slug.' });
    return;
  }
  const guideSlug: GuideSlug = rawSlug;
  const meta = getGuideCatalogMeta(guideSlug);
  const body = req.body || {};

  const currentMap = await getPerGuideChatbotConfig();
  const prevEntry: GuideChatbotOverride = currentMap[guideSlug] || {};
  const nextEntry: GuideChatbotOverride = { ...prevEntry };

  if (typeof body.welcome_title === 'string') {
    nextEntry.welcome_title = body.welcome_title.trim().slice(0, 120);
  }
  if (typeof body.welcome_subtitle === 'string') {
    nextEntry.welcome_subtitle = body.welcome_subtitle.trim().slice(0, 400);
  }
  if (typeof body.general_ready_message === 'string') {
    nextEntry.general_ready_message = body.general_ready_message.trim().slice(0, 400);
  }
  if (typeof body.composer_placeholder === 'string') {
    nextEntry.composer_placeholder = body.composer_placeholder.trim().slice(0, 200);
  }
  if (typeof body.chat_style === 'string') {
    nextEntry.chat_style = normalizeChatStyle(body.chat_style, meta.defaultChatStyle);
  }
  if (body.features && typeof body.features === 'object') {
    const f = body.features as Record<string, unknown>;
    nextEntry.features = {
      ...(prevEntry.features || {}),
      ...(typeof f.voice_input === 'boolean' ? { voice_input: f.voice_input } : {}),
      ...(typeof f.listen_tts === 'boolean' ? { listen_tts: f.listen_tts } : {}),
      ...(typeof f.whatsapp_share === 'boolean' ? { whatsapp_share: f.whatsapp_share } : {}),
      ...(typeof f.attachments === 'boolean' ? { attachments: f.attachments } : {}),
      ...(typeof f.quick_tools === 'boolean' ? { quick_tools: f.quick_tools } : {}),
      ...(typeof f.followups === 'boolean' ? { followups: f.followups } : {}),
      ...(typeof f.auto_intake === 'boolean' ? { auto_intake: f.auto_intake } : {}),
      ...(typeof f.memory_summary === 'boolean' ? { memory_summary: f.memory_summary } : {}),
    };
  }
  if (Array.isArray(body.modular_rules)) {
    const cleanedRules: ModularRuleBlock[] = [];
    for (let i = 0; i < Math.min(30, body.modular_rules.length); i++) {
      const item = body.modular_rules[i] as Record<string, unknown> | null;
      if (!item || typeof item !== 'object') continue;
      const title =
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim().slice(0, 140)
          : `Rule ${i + 1}`;
      const ruleBody = typeof item.body === 'string' ? item.body.trim().slice(0, 8000) : '';
      const id =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim().slice(0, 80)
          : `rule_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
      cleanedRules.push({
        id,
        title,
        body: ruleBody,
        enabled: item.enabled !== false,
        source_slug:
          typeof item.source_slug === 'string' && item.source_slug.trim()
            ? item.source_slug.trim()
            : null,
        updated_at: new Date().toISOString(),
      });
    }
    nextEntry.modular_rules = cleanedRules;
  }
  if (body.suggestions && typeof body.suggestions === 'object') {
    const s = body.suggestions as Record<string, unknown>;
    nextEntry.suggestions = {
      ...(prevEntry.suggestions || {}),
      ...(typeof s.enabled === 'boolean' ? { enabled: s.enabled } : {}),
      ...(typeof s.followups_enabled === 'boolean'
        ? { followups_enabled: s.followups_enabled }
        : {}),
      ...(typeof s.deeper_analysis_enabled === 'boolean'
        ? { deeper_analysis_enabled: s.deeper_analysis_enabled }
        : {}),
      ...(typeof s.default_expanded === 'boolean'
        ? { default_expanded: s.default_expanded }
        : {}),
      ...(typeof s.max_followups === 'number' && s.max_followups >= 1
        ? { max_followups: Math.min(6, Math.round(s.max_followups)) }
        : {}),
      ...(typeof s.max_deeper_analysis === 'number' && s.max_deeper_analysis >= 1
        ? { max_deeper_analysis: Math.min(6, Math.round(s.max_deeper_analysis)) }
        : {}),
      ...(typeof s.followups_rules === 'string'
        ? { followups_rules: s.followups_rules.trim().slice(0, 4000) }
        : {}),
      ...(typeof s.deeper_analysis_rules === 'string'
        ? { deeper_analysis_rules: s.deeper_analysis_rules.trim().slice(0, 5000) }
        : {}),
    };
  }
  if (body.model_id !== undefined) {
    nextEntry.model_id =
      typeof body.model_id === 'string' && body.model_id.trim()
        ? body.model_id.trim()
        : null;
  }

  const nextMap = { ...currentMap, [guideSlug]: nextEntry };
  const savedSetting = await savePlatformSetting(
    'per_guide_chatbot_config',
    nextMap,
    req.appUser.id
  );
  if (!savedSetting.ok) {
    res.status(400).json({ error: savedSetting.error || 'Failed to save guide settings.' });
    return;
  }

  let updatedSystemPrompt: Record<string, unknown> | null = null;
  if (meta.hasSystemPromptRow) {
    const hasRowUpdates =
      body.prompt_body !== undefined ||
      body.display_name !== undefined ||
      body.subtitle !== undefined ||
      body.model_id !== undefined ||
      body.is_active !== undefined;

    if (hasRowUpdates) {
      const { data: existingRow } = await supabaseAdmin
        .from('system_prompts')
        .select('*')
        .eq('slug', guideSlug)
        .maybeSingle();

      if (existingRow) {
        const prevHistory = Array.isArray(existingRow.previous_versions)
          ? existingRow.previous_versions
          : [];
        const nextBody =
          typeof body.prompt_body === 'string' ? body.prompt_body.trim() : existingRow.prompt_body;
        const bodyChanged =
          typeof body.prompt_body === 'string' && nextBody !== existingRow.prompt_body;

        const nextHistory = bodyChanged
          ? [
              {
                version: existingRow.version || 1,
                prompt_body: existingRow.prompt_body,
                archived_at: new Date().toISOString(),
              },
              ...prevHistory,
            ].slice(0, 20)
          : prevHistory;

        const updatePayload: Record<string, unknown> = {
          ...(typeof body.display_name === 'string' && body.display_name.trim()
            ? { display_name: body.display_name.trim() }
            : {}),
          ...(body.subtitle !== undefined
            ? {
                subtitle:
                  typeof body.subtitle === 'string' && body.subtitle.trim()
                    ? body.subtitle.trim()
                    : null,
              }
            : {}),
          ...(typeof body.prompt_body === 'string' ? { prompt_body: nextBody } : {}),
          ...(body.model_id !== undefined
            ? {
                model_id:
                  typeof body.model_id === 'string' && body.model_id.trim()
                    ? body.model_id.trim()
                    : null,
              }
            : {}),
          ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
          version: bodyChanged ? (existingRow.version || 1) + 1 : existingRow.version || 1,
          previous_versions: nextHistory,
          updated_at: new Date().toISOString(),
        };

        const upRes = await supabaseAdmin
          .from('system_prompts')
          .update(updatePayload)
          .eq('id', existingRow.id)
          .select('id, slug, display_name, subtitle, prompt_body, model_id, is_active, version, updated_at')
          .single();

        if (!upRes.error && upRes.data) {
          updatedSystemPrompt = upRes.data as Record<string, unknown>;
        }
      }
    }
  } else if (
    body.clarity_helper_system_prompt !== undefined ||
    body.companion_constitution !== undefined ||
    body.companion_realism_baseline !== undefined ||
    body.companion_chart_presence_prompt !== undefined ||
    body.companion_return_greeting_prompt !== undefined ||
    body.companion_bond_extractor_prompt !== undefined ||
    body.profile_memory_extractor_prompt !== undefined ||
    body.companion_matcher_instructions !== undefined ||
    body.companion_archetypes !== undefined
  ) {
    const engineOverrides = await getEnginePromptOverrides();
    const nextEngine: EnginePromptOverrides = { ...engineOverrides };
    const companionScalarKeys = [
      'clarity_helper_system_prompt',
      'companion_constitution',
      'companion_realism_baseline',
      'companion_chart_presence_prompt',
      'companion_return_greeting_prompt',
      'companion_bond_extractor_prompt',
      'profile_memory_extractor_prompt',
      'companion_matcher_instructions',
    ] as const;
    for (const cKey of companionScalarKeys) {
      if (typeof body[cKey] === 'string') {
        const trimmed = (body[cKey] as string).trim();
        if (trimmed) {
          nextEngine[cKey] = trimmed.slice(0, 12000);
        } else {
          delete nextEngine[cKey];
        }
      }
    }
    if (Array.isArray(body.companion_archetypes)) {
      nextEngine.companion_archetypes = body.companion_archetypes;
    }
    await savePlatformSetting('engine_prompt_overrides', nextEngine, req.appUser.id);
  }

  invalidateAllPlatformCaches();
  invalidatePromptCache();
  const resolvedGuide = await getResolvedGuideConfig(guideSlug);

  res.json({
    saved: true,
    guideSlug,
    resolvedGuide,
    systemPrompt: updatedSystemPrompt,
  });
});

router.post('/settings/chatbot/guide/:guideSlug/reset', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!req.appUser || !supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlug = normalizeCouncilSlug(String(req.params.guideSlug || '').trim());
  if (!isValidGuideSlug(rawSlug)) {
    res.status(400).json({ error: 'Unknown guide slug.' });
    return;
  }
  const guideSlug: GuideSlug = rawSlug;
  const meta = getGuideCatalogMeta(guideSlug);
  const scope = typeof req.body?.scope === 'string' ? req.body.scope : 'all';

  const currentMap = await getPerGuideChatbotConfig();
  const nextMap = { ...currentMap };
  const entry: GuideChatbotOverride = { ...(nextMap[guideSlug] || {}) };

  if (scope === 'all') {
    delete nextMap[guideSlug];
  } else {
    if (scope === 'welcome') {
      delete entry.welcome_title;
      delete entry.welcome_subtitle;
      delete entry.general_ready_message;
      delete entry.composer_placeholder;
      delete entry.chat_style;
    } else if (scope === 'features') {
      delete entry.features;
    } else if (scope === 'rules') {
      delete entry.modular_rules;
    } else if (scope === 'suggestions') {
      delete entry.suggestions;
    } else if (scope === 'system_prompt') {
      delete entry.model_id;
    }
    if (Object.keys(entry).length === 0) {
      delete nextMap[guideSlug];
    } else {
      nextMap[guideSlug] = entry;
    }
  }

  const saved = await savePlatformSetting('per_guide_chatbot_config', nextMap, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to reset guide settings.' });
    return;
  }

  let resetSystemPrompt: Record<string, unknown> | null = null;
  if (scope === 'system_prompt' || scope === 'all') {
    if (meta.hasSystemPromptRow) {
      const seed = ALL_DEFAULT_PROMPTS.find((p) => p.slug === guideSlug);
      const { data: existingRow } = await supabaseAdmin
        .from('system_prompts')
        .select('*')
        .eq('slug', guideSlug)
        .maybeSingle();

      if (existingRow && seed) {
        const prevHistory = Array.isArray(existingRow.previous_versions)
          ? existingRow.previous_versions
          : [];
        const nextHistory =
          existingRow.prompt_body !== seed.prompt_body
            ? [
                {
                  version: existingRow.version || 1,
                  prompt_body: existingRow.prompt_body,
                  archived_at: new Date().toISOString(),
                },
                ...prevHistory,
              ].slice(0, 20)
            : prevHistory;

        const upRes = await supabaseAdmin
          .from('system_prompts')
          .update({
            display_name: seed.display_name,
            subtitle: seed.subtitle,
            prompt_body: seed.prompt_body,
            model_id: null,
            is_active: true,
            version: (existingRow.version || 1) + 1,
            previous_versions: nextHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRow.id)
          .select('id, slug, display_name, subtitle, prompt_body, model_id, is_active, version, updated_at')
          .single();

        if (!upRes.error && upRes.data) {
          resetSystemPrompt = upRes.data as Record<string, unknown>;
        }
      }
    } else {
      const engineOverrides = await getEnginePromptOverrides();
      const nextEngine: EnginePromptOverrides = { ...engineOverrides };
      if (guideSlug === 'clarity') {
        delete nextEngine.clarity_helper_system_prompt;
      } else if (guideSlug === 'companion') {
        delete nextEngine.companion_constitution;
        delete nextEngine.companion_realism_baseline;
        delete nextEngine.companion_chart_presence_prompt;
        delete nextEngine.companion_return_greeting_prompt;
        delete nextEngine.companion_bond_extractor_prompt;
        delete nextEngine.profile_memory_extractor_prompt;
        delete nextEngine.companion_matcher_instructions;
        delete nextEngine.companion_archetypes;
      }
      await savePlatformSetting('engine_prompt_overrides', nextEngine, req.appUser.id);
    }
  }

  invalidateAllPlatformCaches();
  invalidatePromptCache();

  res.json({
    reset: true,
    scope,
    guideSlug,
    resolvedGuide: await getResolvedGuideConfig(guideSlug),
    systemPrompt: resetSystemPrompt,
    engineOverrides: await getEnginePromptOverrides(),
  });
});

router.put('/settings/chatbot/engine-prompts', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const current = await getEnginePromptOverrides();
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const next: EnginePromptOverrides = { ...current };

  const scalarKeys: Array<
    | 'core_council_constitution'
    | 'companion_constitution'
    | 'companion_realism_baseline'
    | 'companion_listen_only_guardrail'
    | 'companion_empathy_first_guardrail'
    | 'companion_chart_presence_prompt'
    | 'companion_return_greeting_prompt'
    | 'companion_bond_extractor_prompt'
    | 'memory_companion_bond_prompt'
    | 'profile_memory_extractor_prompt'
    | 'memory_deep_profile_extractor_prompt'
    | 'memory_rolling_thread_compactor_prompt'
    | 'memory_profile_synthesizer_prompt'
    | 'companion_matcher_instructions'
    | 'companion_neutral_verification_prompt'
    | 'companion_analysis_task_frame_prompt'
    | 'companion_analysis_investigation_prompt'
    | 'companion_analysis_refine_prompt'
    | 'companion_analysis_response_strategy_prompt'
    | 'companion_analysis_memory_extraction_prompt'
    | 'clarity_helper_system_prompt'
    | 'vedic_tier1_reasoning_laws'
    | 'vedic_anti_cliche_rules'
    | 'vedic_turn_modifier_prompt'
    | 'short_reply_breakdown_wrapper'
    | 'timing_widget_placement_wrapper'
    | 'stage1_router_prompt'
    | 'deep_audit_adjudicator_mandate'
    | 'stage4_aligned_suggestions_prompt'
    | 'stage4_fast_more_suggestions_prompt'
    | 'western_core_council_constitution'
    | 'western_tier1_reasoning_laws'
    | 'western_anti_cliche_rules'
    | 'western_turn_modifier_prompt'
    | 'western_deep_audit_adjudicator_mandate'
    | 'western_stage4_aligned_suggestions_prompt'
    | 'western_stage4_fast_more_suggestions_prompt'
    | 'natal_narrative_kernel_system_prompt'
    | 'natal_narrative_kernel_user_prompt'
  > = [
    'core_council_constitution',
    'companion_constitution',
    'companion_realism_baseline',
    'companion_listen_only_guardrail',
    'companion_empathy_first_guardrail',
    'companion_chart_presence_prompt',
    'companion_return_greeting_prompt',
    'companion_bond_extractor_prompt',
    'memory_companion_bond_prompt',
    'profile_memory_extractor_prompt',
    'memory_deep_profile_extractor_prompt',
    'memory_rolling_thread_compactor_prompt',
    'memory_profile_synthesizer_prompt',
    'companion_matcher_instructions',
    'companion_neutral_verification_prompt',
    'companion_analysis_task_frame_prompt',
    'companion_analysis_investigation_prompt',
    'companion_analysis_refine_prompt',
    'companion_analysis_response_strategy_prompt',
    'companion_analysis_memory_extraction_prompt',
    'clarity_helper_system_prompt',
    'vedic_tier1_reasoning_laws',
    'vedic_anti_cliche_rules',
    'vedic_turn_modifier_prompt',
    'short_reply_breakdown_wrapper',
    'timing_widget_placement_wrapper',
    'stage1_router_prompt',
    'deep_audit_adjudicator_mandate',
    'stage4_aligned_suggestions_prompt',
    'stage4_fast_more_suggestions_prompt',
    'western_core_council_constitution',
    'western_tier1_reasoning_laws',
    'western_anti_cliche_rules',
    'western_turn_modifier_prompt',
    'western_deep_audit_adjudicator_mandate',
    'western_stage4_aligned_suggestions_prompt',
    'western_stage4_fast_more_suggestions_prompt',
    'natal_narrative_kernel_system_prompt',
    'natal_narrative_kernel_user_prompt',
  ];

  for (const key of scalarKeys) {
    if (body[key] !== undefined) {
      const val = typeof body[key] === 'string' ? body[key].trim() : '';
      if (val) {
        next[key] = val.slice(0, 12000);
      } else {
        delete next[key];
      }
    }
  }

  // Keep canonical memory prompt aliases synchronized on save/clear so cleared keys don't resurrect
  if (body.memory_deep_profile_extractor_prompt !== undefined && body.profile_memory_extractor_prompt === undefined) {
    if (next.memory_deep_profile_extractor_prompt) {
      next.profile_memory_extractor_prompt = next.memory_deep_profile_extractor_prompt;
    } else {
      delete next.profile_memory_extractor_prompt;
    }
  } else if (body.profile_memory_extractor_prompt !== undefined && body.memory_deep_profile_extractor_prompt === undefined) {
    if (next.profile_memory_extractor_prompt) {
      next.memory_deep_profile_extractor_prompt = next.profile_memory_extractor_prompt;
    } else {
      delete next.memory_deep_profile_extractor_prompt;
    }
  }

  if (body.memory_companion_bond_prompt !== undefined && body.companion_bond_extractor_prompt === undefined) {
    if (next.memory_companion_bond_prompt) {
      next.companion_bond_extractor_prompt = next.memory_companion_bond_prompt;
    } else {
      delete next.companion_bond_extractor_prompt;
    }
  } else if (body.companion_bond_extractor_prompt !== undefined && body.memory_companion_bond_prompt === undefined) {
    if (next.companion_bond_extractor_prompt) {
      next.memory_companion_bond_prompt = next.companion_bond_extractor_prompt;
    } else {
      delete next.memory_companion_bond_prompt;
    }
  }

  const recordKeys: Array<
    | 'companion_skill_rules'
    | 'intent_output_contracts'
    | 'fluency_instructions'
    | 'format_contracts'
    | 'deep_audit_lenses'
    | 'western_intent_output_contracts'
    | 'western_fluency_instructions'
    | 'western_format_contracts'
    | 'western_deep_audit_lenses'
  > = [
    'companion_skill_rules',
    'intent_output_contracts',
    'fluency_instructions',
    'format_contracts',
    'deep_audit_lenses',
    'western_intent_output_contracts',
    'western_fluency_instructions',
    'western_format_contracts',
    'western_deep_audit_lenses',
  ];

  for (const rKey of recordKeys) {
    const incoming = body[rKey];
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      const merged: Record<string, string> = { ...((current[rKey] as Record<string, string>) || {}) };
      for (const [subKey, rawVal] of Object.entries(incoming as Record<string, unknown>)) {
        const cleaned = typeof rawVal === 'string' ? rawVal.trim() : '';
        if (cleaned) {
          merged[subKey] = cleaned.slice(0, 8000);
        } else {
          delete merged[subKey];
        }
      }
      if (Object.keys(merged).length > 0) {
        (next as Record<string, unknown>)[rKey] = merged;
      } else {
        delete next[rKey];
      }
    }
  }

  if (body.companion_group_configs && typeof body.companion_group_configs === 'object' && !Array.isArray(body.companion_group_configs)) {
    const allowedGroups = ['spiritual_guides', 'everyday_companions', 'life_companions'] as const;
    const allowedAdvisory = ['listen_only', 'friend', 'balanced_support', 'esoteric_guide'] as const;
    const allowedStyles = ['editorial', 'structured', 'chat_bubbles', 'dialogue', 'concise_brief'] as const;
    const mergedGroups: Record<string, unknown> = {
      ...(current.companion_group_configs || {}),
    };
    for (const grp of allowedGroups) {
      const incomingGrp = (body.companion_group_configs as Record<string, unknown>)[grp];
      if (!incomingGrp || typeof incomingGrp !== 'object' || Array.isArray(incomingGrp)) continue;
      const gObj = incomingGrp as Record<string, unknown>;
      const existingGrp = (mergedGroups[grp] && typeof mergedGroups[grp] === 'object'
        ? { ...(mergedGroups[grp] as Record<string, unknown>) }
        : {}) as Record<string, unknown>;

      if (typeof gObj.group_system_prompt === 'string') {
        const trimmed = gObj.group_system_prompt.trim();
        if (trimmed) existingGrp.group_system_prompt = trimmed.slice(0, 8000);
        else delete existingGrp.group_system_prompt;
      }
      if (typeof gObj.default_advisory_mode === 'string' && (allowedAdvisory as readonly string[]).includes(gObj.default_advisory_mode)) {
        existingGrp.default_advisory_mode = gObj.default_advisory_mode;
      }
      if (typeof gObj.default_chat_style === 'string' && (allowedStyles as readonly string[]).includes(gObj.default_chat_style)) {
        existingGrp.default_chat_style = gObj.default_chat_style;
      }
      if (typeof gObj.default_max_output_tokens === 'number' && Number.isFinite(gObj.default_max_output_tokens)) {
        existingGrp.default_max_output_tokens = Math.max(300, Math.min(8000, Math.round(gObj.default_max_output_tokens)));
      }
      if (gObj.default_chart_access && typeof gObj.default_chart_access === 'object' && !Array.isArray(gObj.default_chart_access)) {
        const ca = gObj.default_chart_access as Record<string, unknown>;
        existingGrp.default_chart_access = {
          vedic: Boolean(ca.vedic),
          western: Boolean(ca.western),
          tarot: Boolean(ca.tarot),
          numerology: Boolean(ca.numerology),
          past_life: Boolean(ca.past_life),
          council_notes: Boolean(ca.council_notes),
        };
      }
      if (Object.keys(existingGrp).length > 0) {
        mergedGroups[grp] = existingGrp;
      } else {
        delete mergedGroups[grp];
      }
    }
    if (Object.keys(mergedGroups).length > 0) {
      next.companion_group_configs = mergedGroups as EnginePromptOverrides['companion_group_configs'];
    } else {
      delete next.companion_group_configs;
    }
  }

  if (Array.isArray(body.companion_archetypes)) {
    const cleanedArchetypes = body.companion_archetypes
      .filter((a) => a && typeof a === 'object')
      .map((a) => {
        const obj = a as Record<string, unknown>;
        return {
          slug: String(obj.slug || 'friend').trim() as typeof DEFAULT_COMPANION_ARCHETYPES[number]['slug'],
          label: String(obj.label || '').trim().slice(0, 60),
          shortDesc: String(obj.shortDesc || '').trim().slice(0, 260),
          questionOne: String(obj.questionOne || '').trim().slice(0, 180),
          questionTwo: String(obj.questionTwo || '').trim().slice(0, 180),
          ...(obj.isSpiritual ? { isSpiritual: true } : {}),
        };
      })
      .filter((a) => a.label);
    if (cleanedArchetypes.length > 0) {
      next.companion_archetypes = cleanedArchetypes;
    } else {
      delete next.companion_archetypes;
    }
  }

  const saved = await savePlatformSetting('engine_prompt_overrides', next, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save engine prompts.' });
    return;
  }

  invalidateAllPlatformCaches();
  invalidatePromptCache();
  invalidateCompanionsCache();
  res.json({ saved: true, overrides: await getEnginePromptOverrides() });
});

router.post('/settings/chatbot/engine-prompts/reset', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : 'all';
  const subKey = typeof req.body?.subKey === 'string' ? req.body.subKey.trim() : '';

  const current = await getEnginePromptOverrides();
  let next: EnginePromptOverrides = { ...current };

  if (!key || key === 'all') {
    next = {};
  } else if (subKey && next[key as keyof EnginePromptOverrides] && typeof next[key as keyof EnginePromptOverrides] === 'object') {
    const parentCopy = { ...(next[key as keyof EnginePromptOverrides] as Record<string, unknown>) };
    delete parentCopy[subKey];
    if (Object.keys(parentCopy).length === 0) {
      delete next[key as keyof EnginePromptOverrides];
    } else {
      (next as Record<string, unknown>)[key] = parentCopy;
    }
  } else {
    delete next[key as keyof EnginePromptOverrides];
    if (key === 'memory_deep_profile_extractor_prompt' || key === 'profile_memory_extractor_prompt') {
      delete next.memory_deep_profile_extractor_prompt;
      delete next.profile_memory_extractor_prompt;
    }
    if (key === 'memory_companion_bond_prompt' || key === 'companion_bond_extractor_prompt') {
      delete next.memory_companion_bond_prompt;
      delete next.companion_bond_extractor_prompt;
    }
  }

  const saved = await savePlatformSetting('engine_prompt_overrides', next, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to reset engine prompt.' });
    return;
  }

  invalidateAllPlatformCaches();
  invalidatePromptCache();
  res.json({ reset: true, key, subKey: subKey || null, overrides: await getEnginePromptOverrides() });
});

router.put('/settings/chatbot/playbooks/:playbookId', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const playbookId = String(req.params.playbookId || '').trim().toUpperCase();
  const basePb = CANONICAL_PLAYBOOKS.find((p) => p.id === playbookId);
  if (!basePb) {
    res.status(404).json({ error: 'Canonical playbook not found.' });
    return;
  }

  const body = req.body || {};
  const current = await getPlaybookOverrides();
  const nextEntry: PlaybookOverrideEntry = {
    ...(typeof body.requiresTimingStack === 'boolean'
      ? { requiresTimingStack: body.requiresTimingStack }
      : {}),
    ...(Array.isArray(body.formulaSlugs)
      ? {
          formulaSlugs: body.formulaSlugs
            .map((s: unknown) => String(s || '').trim())
            .filter(Boolean),
        }
      : {}),
    ...(typeof body.customInstructions === 'string' && body.customInstructions.trim()
      ? { customInstructions: body.customInstructions.trim().slice(0, 3000) }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const nextMap = { ...current, [playbookId]: nextEntry };
  const saved = await savePlatformSetting('playbook_overrides', nextMap, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save playbook override.' });
    return;
  }

  invalidateAllPlatformCaches();
  res.json({ saved: true, playbookId, overrides: await getPlaybookOverrides() });
});

router.delete('/settings/chatbot/playbooks/:playbookId', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const playbookId = String(req.params.playbookId || '').trim().toUpperCase();
  const current = await getPlaybookOverrides();
  const nextMap = { ...current };
  delete nextMap[playbookId];

  const saved = await savePlatformSetting('playbook_overrides', nextMap, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to reset playbook override.' });
    return;
  }

  invalidateAllPlatformCaches();
  res.json({ deleted: true, playbookId, overrides: await getPlaybookOverrides() });
});

// 8B. Birth Chart Conversion & Natal Truth Dossier Settings
router.get('/settings/birth-chart', async (_req: AuthenticatedRequest, res) => {
  if (!getSupabaseAdmin()) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const [config, engineOverrides, runtime] = await Promise.all([
    getBirthChartConversionConfig(),
    getEnginePromptOverrides(),
    getResolvedOpenRouterRuntime(),
  ]);

  res.json({
    config,
    defaults: DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
    prompts: {
      natal_narrative_kernel_system_prompt:
        engineOverrides.natal_narrative_kernel_system_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt:
        engineOverrides.natal_narrative_kernel_user_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
      hasCustomSystemPrompt: Boolean(
        engineOverrides.natal_narrative_kernel_system_prompt &&
          engineOverrides.natal_narrative_kernel_system_prompt.trim() !==
            DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT.trim()
      ),
      hasCustomUserPrompt: Boolean(
        engineOverrides.natal_narrative_kernel_user_prompt &&
          engineOverrides.natal_narrative_kernel_user_prompt.trim() !==
            DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT.trim()
      ),
    },
    promptDefaults: {
      natal_narrative_kernel_system_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
    },
    utilityModel: runtime.utilityModel,
  });
});

router.put('/settings/birth-chart', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const currentConfig = await getBirthChartConversionConfig();
  const nextConfig = sanitizeBirthChartConversionConfig(
    body.config && typeof body.config === 'object' ? body.config : body,
    currentConfig
  );

  const savedCfg = await savePlatformSetting(
    'birth_chart_conversion_config',
    nextConfig,
    req.appUser.id
  );
  if (!savedCfg.ok) {
    res.status(400).json({ error: savedCfg.error || 'Failed to save birth chart conversion settings.' });
    return;
  }

  const hasSysPrompt = typeof body.natal_narrative_kernel_system_prompt === 'string';
  const hasUserPrompt = typeof body.natal_narrative_kernel_user_prompt === 'string';
  if (hasSysPrompt || hasUserPrompt) {
    const engineOverrides = await getEnginePromptOverrides();
    const nextEngine: EnginePromptOverrides = { ...engineOverrides };
    if (hasSysPrompt) {
      const cleaned = (body.natal_narrative_kernel_system_prompt as string).trim();
      if (cleaned && cleaned !== DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT.trim()) {
        nextEngine.natal_narrative_kernel_system_prompt = cleaned.slice(0, 12000);
      } else {
        delete nextEngine.natal_narrative_kernel_system_prompt;
      }
    }
    if (hasUserPrompt) {
      const cleaned = (body.natal_narrative_kernel_user_prompt as string).trim();
      if (cleaned && cleaned !== DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT.trim()) {
        nextEngine.natal_narrative_kernel_user_prompt = cleaned.slice(0, 12000);
      } else {
        delete nextEngine.natal_narrative_kernel_user_prompt;
      }
    }
    const savedEngine = await savePlatformSetting(
      'engine_prompt_overrides',
      nextEngine,
      req.appUser.id
    );
    if (!savedEngine.ok) {
      res.status(400).json({ error: savedEngine.error || 'Failed to save extraction prompts.' });
      return;
    }
  }

  invalidateAllPlatformCaches();
  const [freshCfg, freshEngine, runtime] = await Promise.all([
    getBirthChartConversionConfig(),
    getEnginePromptOverrides(),
    getResolvedOpenRouterRuntime(),
  ]);

  res.json({
    saved: true,
    config: freshCfg,
    defaults: DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
    prompts: {
      natal_narrative_kernel_system_prompt:
        freshEngine.natal_narrative_kernel_system_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt:
        freshEngine.natal_narrative_kernel_user_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
      hasCustomSystemPrompt: Boolean(
        freshEngine.natal_narrative_kernel_system_prompt &&
          freshEngine.natal_narrative_kernel_system_prompt.trim() !==
            DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT.trim()
      ),
      hasCustomUserPrompt: Boolean(
        freshEngine.natal_narrative_kernel_user_prompt &&
          freshEngine.natal_narrative_kernel_user_prompt.trim() !==
            DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT.trim()
      ),
    },
    promptDefaults: {
      natal_narrative_kernel_system_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
    },
    utilityModel: runtime.utilityModel,
  });
});

router.post('/settings/birth-chart/reset', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const scope = typeof req.body?.scope === 'string' ? req.body.scope : 'all';
  if (scope === 'all' || scope === 'config') {
    await savePlatformSetting(
      'birth_chart_conversion_config',
      DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
      req.appUser.id
    );
  }
  if (scope === 'all' || scope === 'prompts' || scope === 'system_prompt' || scope === 'user_prompt') {
    const engineOverrides = await getEnginePromptOverrides();
    const nextEngine: EnginePromptOverrides = { ...engineOverrides };
    if (scope !== 'user_prompt') delete nextEngine.natal_narrative_kernel_system_prompt;
    if (scope !== 'system_prompt') delete nextEngine.natal_narrative_kernel_user_prompt;
    await savePlatformSetting('engine_prompt_overrides', nextEngine, req.appUser.id);
  }

  invalidateAllPlatformCaches();
  const [freshCfg, freshEngine, runtime] = await Promise.all([
    getBirthChartConversionConfig(),
    getEnginePromptOverrides(),
    getResolvedOpenRouterRuntime(),
  ]);

  res.json({
    reset: true,
    scope,
    config: freshCfg,
    defaults: DEFAULT_BIRTH_CHART_CONVERSION_CONFIG,
    prompts: {
      natal_narrative_kernel_system_prompt:
        freshEngine.natal_narrative_kernel_system_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt:
        freshEngine.natal_narrative_kernel_user_prompt ||
        DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
      hasCustomSystemPrompt: Boolean(freshEngine.natal_narrative_kernel_system_prompt),
      hasCustomUserPrompt: Boolean(freshEngine.natal_narrative_kernel_user_prompt),
    },
    promptDefaults: {
      natal_narrative_kernel_system_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_SYSTEM_PROMPT,
      natal_narrative_kernel_user_prompt: DEFAULT_NATAL_NARRATIVE_KERNEL_USER_PROMPT,
    },
    utilityModel: runtime.utilityModel,
  });
});

// 8C. Export & Import Chatbot Engine Prompts, Playbooks, Modular Rules & Birth Chart Config
const ENGINE_BUNDLE_SCALAR_KEYS = [
  'core_council_constitution',
  'companion_constitution',
  'companion_realism_baseline',
  'companion_listen_only_guardrail',
  'companion_empathy_first_guardrail',
  'companion_chart_presence_prompt',
  'companion_return_greeting_prompt',
  'companion_bond_extractor_prompt',
  'memory_companion_bond_prompt',
  'profile_memory_extractor_prompt',
  'memory_deep_profile_extractor_prompt',
  'memory_rolling_thread_compactor_prompt',
  'memory_profile_synthesizer_prompt',
  'companion_matcher_instructions',
  'clarity_helper_system_prompt',
  'vedic_tier1_reasoning_laws',
  'vedic_anti_cliche_rules',
  'vedic_turn_modifier_prompt',
  'short_reply_breakdown_wrapper',
  'timing_widget_placement_wrapper',
  'stage1_router_prompt',
  'deep_audit_adjudicator_mandate',
  'stage4_aligned_suggestions_prompt',
  'stage4_fast_more_suggestions_prompt',
  'western_core_council_constitution',
  'western_tier1_reasoning_laws',
  'western_anti_cliche_rules',
  'western_turn_modifier_prompt',
  'western_deep_audit_adjudicator_mandate',
  'western_stage4_aligned_suggestions_prompt',
  'western_stage4_fast_more_suggestions_prompt',
  'natal_narrative_kernel_system_prompt',
  'natal_narrative_kernel_user_prompt',
] as const;

const ENGINE_BUNDLE_RECORD_KEYS = [
  'companion_skill_rules',
  'intent_output_contracts',
  'fluency_instructions',
  'format_contracts',
  'deep_audit_lenses',
  'western_intent_output_contracts',
  'western_fluency_instructions',
  'western_format_contracts',
  'western_deep_audit_lenses',
] as const;

router.get('/settings/chatbot/export', async (req: AuthenticatedRequest, res) => {
  if (!getSupabaseAdmin()) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawScope = String(req.query.scope || 'all').trim().toLowerCase();
  const scope = (['all', 'engine', 'playbooks', 'rules', 'birth_chart'] as const).includes(
    rawScope as 'all' | 'engine' | 'playbooks' | 'rules' | 'birth_chart'
  )
    ? (rawScope as 'all' | 'engine' | 'playbooks' | 'rules' | 'birth_chart')
    : 'all';
  const includeDefaults =
    req.query.includeDefaults === '1' || req.query.includeDefaults === 'true';
  const rawGuide = typeof req.query.guide === 'string' ? normalizeCouncilSlug(req.query.guide.trim()) : '';
  const targetGuide = rawGuide && isValidGuideSlug(rawGuide) ? rawGuide : null;

  const [engineOverrides, playbookOverrides, perGuideResolvedList, chatbotCfg, birthChartCfg] =
    await Promise.all([
      getEnginePromptOverrides(),
      getPlaybookOverrides(),
      Promise.all(GUIDE_SLUGS.map((slug) => getResolvedGuideConfig(slug))),
      getChatbotConfig(),
      getBirthChartConversionConfig(),
    ]);

  const bundle: Record<string, unknown> = {
    schema: 'cosmic_council.chatbot_engine_bundle.v1',
    exportedAt: new Date().toISOString(),
    scope,
  };

  if (scope === 'all' || scope === 'engine') {
    bundle.enginePrompts = {
      overrides: engineOverrides,
      ...(includeDefaults ? { defaults: getEnginePromptDefaultsBundle() } : {}),
    };
  }

  if (scope === 'all' || scope === 'playbooks') {
    bundle.playbookOverrides = playbookOverrides;
    if (includeDefaults) {
      bundle.canonicalPlaybooksReference = getPlaybooksCatalogSummary();
    }
  }

  if (scope === 'all' || scope === 'rules') {
    const perGuideRules: Record<string, { displayName: string; modular_rules: ModularRuleBlock[] }> = {};
    for (const resolved of perGuideResolvedList) {
      if (targetGuide && resolved.slug !== targetGuide) continue;
      perGuideRules[resolved.slug] = {
        displayName: resolved.meta.displayName,
        modular_rules: resolved.modular_rules,
      };
    }
    bundle.rules = {
      ...(targetGuide ? { guideSlug: targetGuide } : { global_conversational_rules: chatbotCfg.conversational_rules }),
      per_guide: perGuideRules,
    };
  }

  if (scope === 'all' || scope === 'birth_chart') {
    bundle.birthChartConversion = birthChartCfg;
  }

  res.json(bundle);
});

router.post('/settings/chatbot/import', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser || !getSupabaseAdmin()) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const reqBody = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const rawBundle = stripUnsafeJsonKeys(reqBody.bundle);
  if (!rawBundle || typeof rawBundle !== 'object') {
    res.status(400).json({ error: 'Invalid JSON bundle: expected a JSON object or array.' });
    return;
  }

  const rawScope = String(reqBody.scope || 'auto').trim().toLowerCase();
  const requestedScope = (['auto', 'all', 'engine', 'playbooks', 'rules', 'birth_chart'] as const).includes(
    rawScope as 'auto' | 'all' | 'engine' | 'playbooks' | 'rules' | 'birth_chart'
  )
    ? (rawScope as 'auto' | 'all' | 'engine' | 'playbooks' | 'rules' | 'birth_chart')
    : 'auto';
  const replaceMode = reqBody.replaceMode === 'replace' ? 'replace' : 'merge';
  const dryRun = reqBody.dryRun !== false;
  const rawGuideParam =
    typeof reqBody.guideSlug === 'string' && reqBody.guideSlug.trim()
      ? normalizeCouncilSlug(reqBody.guideSlug.trim())
      : '';
  const fallbackGuideSlug: GuideSlug | null =
    rawGuideParam && isValidGuideSlug(rawGuideParam) ? rawGuideParam : null;

  const bundleObj = Array.isArray(rawBundle) ? null : (rawBundle as Record<string, unknown>);

  const [
    currentEngine,
    currentPlaybooks,
    currentPerGuideMap,
    currentChatbotCfg,
    currentBirthChart,
  ] = await Promise.all([
    getEnginePromptOverrides(),
    getPlaybookOverrides(),
    getPerGuideChatbotConfig(),
    getChatbotConfig(),
    getBirthChartConversionConfig(),
  ]);

  const warnings: string[] = [];
  const engineChanges: Array<{ key: string; subKey?: string; action: 'add' | 'update' | 'remove' }> = [];
  const playbookChanges: Array<{ playbookId: string; action: 'add' | 'update' | 'remove' }> = [];
  const ruleChanges: Array<{ target: string; action: 'update' | 'clear'; ruleCount: number }> = [];
  const birthChartChanges: Array<{ field: string; action: 'update' }> = [];

  // 1. Engine prompts
  let engineTouched = false;
  const nextEngine: EnginePromptOverrides =
    replaceMode === 'replace'
      ? {
          ...(currentEngine.companion_group_configs
            ? { companion_group_configs: currentEngine.companion_group_configs }
            : {}),
          ...(currentEngine.companion_archetypes
            ? { companion_archetypes: currentEngine.companion_archetypes }
            : {}),
          ...(currentEngine.companion_specializations
            ? { companion_specializations: currentEngine.companion_specializations }
            : {}),
        }
      : { ...currentEngine };
  const defaultsBundle = getEnginePromptDefaultsBundle();

  const wantsEngine =
    requestedScope === 'engine' ||
    requestedScope === 'all' ||
    (requestedScope === 'auto' &&
      Boolean(
        bundleObj &&
          (bundleObj.enginePrompts ||
            ENGINE_BUNDLE_SCALAR_KEYS.some((k) => bundleObj[k] !== undefined) ||
            ENGINE_BUNDLE_RECORD_KEYS.some((k) => bundleObj[k] !== undefined))
      ));

  if (wantsEngine && bundleObj) {
    const engineContainer =
      bundleObj.enginePrompts && typeof bundleObj.enginePrompts === 'object' && !Array.isArray(bundleObj.enginePrompts)
        ? (bundleObj.enginePrompts as Record<string, unknown>)
        : bundleObj;
    const incomingOverrides =
      engineContainer.overrides && typeof engineContainer.overrides === 'object' && !Array.isArray(engineContainer.overrides)
        ? (engineContainer.overrides as Record<string, unknown>)
        : engineContainer;

    engineTouched = true;
    for (const sKey of ENGINE_BUNDLE_SCALAR_KEYS) {
      if (incomingOverrides[sKey] === undefined) continue;
      const val = typeof incomingOverrides[sKey] === 'string' ? (incomingOverrides[sKey] as string).trim() : '';
      const defVal = typeof defaultsBundle[sKey] === 'string' ? (defaultsBundle[sKey] as string).trim() : '';
      if (val && val !== defVal) {
        const prevVal = currentEngine[sKey];
        if (!prevVal) {
          engineChanges.push({ key: sKey, action: 'add' });
        } else if (prevVal.trim() !== val) {
          engineChanges.push({ key: sKey, action: 'update' });
        }
        nextEngine[sKey] = val.slice(0, 12000);
      } else {
        if (currentEngine[sKey]) {
          engineChanges.push({ key: sKey, action: 'remove' });
        }
        delete nextEngine[sKey];
      }
    }

    for (const rKey of ENGINE_BUNDLE_RECORD_KEYS) {
      const incomingRec = incomingOverrides[rKey];
      if (!incomingRec || typeof incomingRec !== 'object' || Array.isArray(incomingRec)) continue;
      const baseRec =
        replaceMode === 'replace'
          ? {}
          : { ...((currentEngine[rKey] as Record<string, string>) || {}) };
      const defaultRec = (defaultsBundle[rKey] as Record<string, string>) || {};
      const prevRec = (currentEngine[rKey] as Record<string, string>) || {};

      for (const [subKey, rawSubVal] of Object.entries(incomingRec as Record<string, unknown>)) {
        if (typeof defaultRec[subKey] !== 'string' && !prevRec[subKey]) {
          warnings.push(`Ignored unknown sub-key "${rKey}.${subKey}".`);
          continue;
        }
        const cleaned = typeof rawSubVal === 'string' ? rawSubVal.trim() : '';
        const defSub = (defaultRec[subKey] || '').trim();
        if (cleaned && cleaned !== defSub) {
          if (!prevRec[subKey]) engineChanges.push({ key: rKey, subKey, action: 'add' });
          else if (prevRec[subKey].trim() !== cleaned) engineChanges.push({ key: rKey, subKey, action: 'update' });
          baseRec[subKey] = cleaned.slice(0, 8000);
        } else {
          if (prevRec[subKey]) engineChanges.push({ key: rKey, subKey, action: 'remove' });
          delete baseRec[subKey];
        }
      }

      if (Object.keys(baseRec).length > 0) {
        (nextEngine as Record<string, unknown>)[rKey] = baseRec;
      } else {
        delete nextEngine[rKey];
      }
    }

    if (replaceMode === 'replace') {
      for (const sKey of ENGINE_BUNDLE_SCALAR_KEYS) {
        if (currentEngine[sKey] && !nextEngine[sKey]) {
          engineChanges.push({ key: sKey, action: 'remove' });
        }
      }
    }
  }

  // 2. Canonical Playbook Overrides
  let playbooksTouched = false;
  const nextPlaybooks: PlaybookOverridesMap =
    replaceMode === 'replace' ? {} : { ...currentPlaybooks };
  const validPlaybookIds = new Set(CANONICAL_PLAYBOOKS.map((p) => p.id));

  const wantsPlaybooks =
    requestedScope === 'playbooks' ||
    requestedScope === 'all' ||
    (requestedScope === 'auto' && Boolean(bundleObj && bundleObj.playbookOverrides));

  if (wantsPlaybooks && bundleObj) {
    const incomingPb =
      bundleObj.playbookOverrides && typeof bundleObj.playbookOverrides === 'object' && !Array.isArray(bundleObj.playbookOverrides)
        ? (bundleObj.playbookOverrides as Record<string, unknown>)
        : requestedScope === 'playbooks'
        ? bundleObj
        : null;

    if (incomingPb) {
      playbooksTouched = true;
      for (const [rawPbId, rawEntry] of Object.entries(incomingPb)) {
        const pbId = rawPbId.trim().toUpperCase();
        if (!validPlaybookIds.has(pbId)) {
          if (!['schema', 'exportedAt', 'scope', 'canonicalPlaybooksReference'].includes(rawPbId)) {
            warnings.push(`Skipped unknown playbook ID "${pbId}".`);
          }
          continue;
        }
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
        const eObj = rawEntry as Record<string, unknown>;
        const entry: PlaybookOverrideEntry = {
          ...(typeof eObj.requiresTimingStack === 'boolean'
            ? { requiresTimingStack: eObj.requiresTimingStack }
            : {}),
          ...(Array.isArray(eObj.formulaSlugs)
            ? { formulaSlugs: eObj.formulaSlugs.map((s) => String(s || '').trim()).filter(Boolean) }
            : {}),
          ...(typeof eObj.customInstructions === 'string' && eObj.customInstructions.trim()
            ? { customInstructions: eObj.customInstructions.trim().slice(0, 3000) }
            : {}),
          updated_at: new Date().toISOString(),
        };
        const hasMeaningfulField =
          entry.requiresTimingStack !== undefined ||
          entry.formulaSlugs !== undefined ||
          Boolean(entry.customInstructions);
        if (!hasMeaningfulField) {
          if (currentPlaybooks[pbId]) playbookChanges.push({ playbookId: pbId, action: 'remove' });
          delete nextPlaybooks[pbId];
          continue;
        }
        const prevPb = currentPlaybooks[pbId];
        if (!prevPb) {
          playbookChanges.push({ playbookId: pbId, action: 'add' });
        } else if (
          prevPb.requiresTimingStack !== entry.requiresTimingStack ||
          JSON.stringify(prevPb.formulaSlugs || []) !== JSON.stringify(entry.formulaSlugs || []) ||
          (prevPb.customInstructions || '') !== (entry.customInstructions || '')
        ) {
          playbookChanges.push({ playbookId: pbId, action: 'update' });
        }
        nextPlaybooks[pbId] = entry;
      }

      if (replaceMode === 'replace') {
        for (const existingId of Object.keys(currentPlaybooks)) {
          if (!nextPlaybooks[existingId]) {
            playbookChanges.push({ playbookId: existingId, action: 'remove' });
          }
        }
      }
    }
  }

  // 3. Modular Rules & Global Conversational Rules
  let rulesTouched = false;
  let globalRulesTouched = false;
  let nextGlobalConvRules = currentChatbotCfg.conversational_rules;
  const nextPerGuideMap: PerGuideChatbotConfigMap = { ...currentPerGuideMap };

  const cleanModularRulesList = (arr: unknown[]): ModularRuleBlock[] => {
    const cleaned: ModularRuleBlock[] = [];
    for (let i = 0; i < Math.min(30, arr.length); i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const obj = item as Record<string, unknown>;
      const title =
        typeof obj.title === 'string' && obj.title.trim()
          ? obj.title.trim().slice(0, 140)
          : `Rule ${i + 1}`;
      const bodyStr = typeof obj.body === 'string' ? obj.body.trim().slice(0, 8000) : '';
      const id =
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim().slice(0, 80)
          : `rule_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
      cleaned.push({
        id,
        title,
        body: bodyStr,
        enabled: obj.enabled !== false,
        source_slug:
          typeof obj.source_slug === 'string' && obj.source_slug.trim()
            ? obj.source_slug.trim()
            : null,
        updated_at: new Date().toISOString(),
      });
    }
    return cleaned;
  };

  const wantsRules =
    requestedScope === 'rules' ||
    requestedScope === 'all' ||
    (requestedScope === 'auto' &&
      (Array.isArray(rawBundle) ||
        Boolean(bundleObj && (bundleObj.rules || bundleObj.modular_rules || bundleObj.per_guide))));

  if (wantsRules) {
    if (Array.isArray(rawBundle)) {
      if (!fallbackGuideSlug) {
        res.status(400).json({ error: 'Select a target guide when importing a raw modular_rules array.' });
        return;
      }
      const cleaned = cleanModularRulesList(rawBundle);
      nextPerGuideMap[fallbackGuideSlug] = {
        ...(nextPerGuideMap[fallbackGuideSlug] || {}),
        modular_rules: cleaned,
      };
      rulesTouched = true;
      ruleChanges.push({ target: `guide:${fallbackGuideSlug}`, action: 'update', ruleCount: cleaned.length });
    } else if (bundleObj) {
      const rulesContainer =
        bundleObj.rules && typeof bundleObj.rules === 'object' && !Array.isArray(bundleObj.rules)
          ? (bundleObj.rules as Record<string, unknown>)
          : bundleObj;

      if (typeof rulesContainer.global_conversational_rules === 'string' && rulesContainer.global_conversational_rules.trim()) {
        const cleanedGlobal = rulesContainer.global_conversational_rules.trim().slice(0, 4000);
        if (cleanedGlobal !== currentChatbotCfg.conversational_rules.trim()) {
          globalRulesTouched = true;
          nextGlobalConvRules = cleanedGlobal;
          ruleChanges.push({ target: 'global_conversational_rules', action: 'update', ruleCount: 1 });
        }
      }

      if (Array.isArray(rulesContainer.modular_rules) && fallbackGuideSlug) {
        const cleaned = cleanModularRulesList(rulesContainer.modular_rules);
        nextPerGuideMap[fallbackGuideSlug] = {
          ...(nextPerGuideMap[fallbackGuideSlug] || {}),
          modular_rules: cleaned,
        };
        rulesTouched = true;
        ruleChanges.push({ target: `guide:${fallbackGuideSlug}`, action: 'update', ruleCount: cleaned.length });
      }

      const perGuideObj =
        rulesContainer.per_guide && typeof rulesContainer.per_guide === 'object' && !Array.isArray(rulesContainer.per_guide)
          ? (rulesContainer.per_guide as Record<string, unknown>)
          : null;
      if (perGuideObj) {
        for (const [rawSlug, entryVal] of Object.entries(perGuideObj)) {
          const slug = normalizeCouncilSlug(rawSlug.trim());
          if (!isValidGuideSlug(slug)) {
            warnings.push(`Skipped unknown guide slug "${rawSlug}" in rules bundle.`);
            continue;
          }
          const rulesArr = Array.isArray(entryVal)
            ? entryVal
            : entryVal && typeof entryVal === 'object' && Array.isArray((entryVal as Record<string, unknown>).modular_rules)
            ? ((entryVal as Record<string, unknown>).modular_rules as unknown[])
            : null;
          if (!rulesArr) continue;
          const cleaned = cleanModularRulesList(rulesArr);
          nextPerGuideMap[slug] = {
            ...(nextPerGuideMap[slug] || {}),
            modular_rules: cleaned,
          };
          rulesTouched = true;
          ruleChanges.push({ target: `guide:${slug}`, action: 'update', ruleCount: cleaned.length });
        }
      }
    }
  }

  // 4. Birth Chart Conversion Settings
  let birthChartTouched = false;
  let nextBirthChart: BirthChartConversionConfig = currentBirthChart;

  const wantsBirthChart =
    requestedScope === 'birth_chart' ||
    requestedScope === 'all' ||
    (requestedScope === 'auto' && Boolean(bundleObj && bundleObj.birthChartConversion));

  if (wantsBirthChart && bundleObj) {
    const incomingBc =
      bundleObj.birthChartConversion && typeof bundleObj.birthChartConversion === 'object' && !Array.isArray(bundleObj.birthChartConversion)
        ? bundleObj.birthChartConversion
        : requestedScope === 'birth_chart'
        ? bundleObj
        : null;
    if (incomingBc) {
      birthChartTouched = true;
      nextBirthChart = sanitizeBirthChartConversionConfig(
        incomingBc,
        replaceMode === 'replace' ? DEFAULT_BIRTH_CHART_CONVERSION_CONFIG : currentBirthChart
      );
      for (const field of Object.keys(DEFAULT_BIRTH_CHART_CONVERSION_CONFIG) as Array<keyof BirthChartConversionConfig>) {
        if (nextBirthChart[field] !== currentBirthChart[field]) {
          birthChartChanges.push({ field, action: 'update' });
        }
      }
    }
  }

  if (!engineTouched && !playbooksTouched && !rulesTouched && !globalRulesTouched && !birthChartTouched) {
    res.status(400).json({
      error: 'No recognizable enginePrompts, playbookOverrides, rules, or birthChartConversion sections were found in this JSON.',
    });
    return;
  }

  const preview = {
    engineChanges,
    playbookChanges,
    ruleChanges,
    birthChartChanges,
    warnings,
    totalChanges:
      engineChanges.length +
      playbookChanges.length +
      ruleChanges.length +
      birthChartChanges.length,
  };

  if (dryRun) {
    res.json({ ok: true, dryRun: true, preview });
    return;
  }

  if (engineTouched) {
    const r = await savePlatformSetting('engine_prompt_overrides', nextEngine, req.appUser.id);
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Failed to save imported engine prompts.' });
      return;
    }
  }
  if (playbooksTouched) {
    const r = await savePlatformSetting('playbook_overrides', nextPlaybooks, req.appUser.id);
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Failed to save imported playbook overrides.' });
      return;
    }
  }
  if (rulesTouched) {
    const r = await savePlatformSetting('per_guide_chatbot_config', nextPerGuideMap, req.appUser.id);
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Failed to save imported guide rules.' });
      return;
    }
  }
  if (globalRulesTouched) {
    const r = await savePlatformSetting(
      'chatbot_config',
      { ...currentChatbotCfg, conversational_rules: nextGlobalConvRules },
      req.appUser.id
    );
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Failed to save imported global conversational rules.' });
      return;
    }
  }
  if (birthChartTouched) {
    const r = await savePlatformSetting(
      'birth_chart_conversion_config',
      nextBirthChart,
      req.appUser.id
    );
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Failed to save imported birth chart conversion settings.' });
      return;
    }
  }

  invalidateAllPlatformCaches();
  invalidatePromptCache();
  invalidateCompanionsCache();

  res.json({ ok: true, dryRun: false, preview });
});

router.get('/chatbot-settings/runtime-manifest', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawGuide = normalizeCouncilSlug(
    typeof req.query.guide === 'string' ? req.query.guide.trim() : DEFAULT_COUNCIL_EXPERT_SLUG
  );
  const guideSlug: GuideSlug = isValidGuideSlug(rawGuide)
    ? rawGuide
    : DEFAULT_COUNCIL_EXPERT_SLUG;
  const guideMeta = getGuideCatalogMeta(guideSlug);

  const [
    guideCfg,
    runtime,
    engineOverrides,
    pbOverrides,
    recipes,
    chatbotCfg,
    cartridgesMap,
    priorityRulesMap,
    promptsRes,
    dailyTransitsCountRes,
    profilesCountRes,
    conversationsCountRes,
    messagesCountRes,
    pipelineLogsCountRes,
  ] = await Promise.all([
    getResolvedGuideConfig(guideSlug),
    getResolvedOpenRouterRuntime(),
    getEnginePromptOverrides(),
    getPlaybookOverrides(),
    getPromptRecipes(),
    getChatbotConfig(),
    getFormulaCartridgesCached(),
    getPriorityRulesCached(),
    supabaseAdmin
      .from('system_prompts')
      .select('id, slug, category, display_name, prompt_body, model_id, is_active'),
    supabaseAdmin.from('daily_transits').select('date', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('chatbot_pipeline_logs').select('id', { count: 'exact', head: true }),
  ]);

  const promptRows = (promptsRes.data || []) as Array<{
    id: string;
    slug: string;
    category: string;
    display_name: string;
    prompt_body: string;
    model_id: string | null;
    is_active: boolean;
  }>;

  const systemPromptRow = promptRows.find((r) => r.slug === guideSlug) || null;
  const seedPrompt = ALL_DEFAULT_PROMPTS.find((p) => p.slug === guideSlug) || null;
  const defaultLanguageRow = promptRows.find(
    (r) => r.category === 'language' && r.slug === chatbotCfg.default_language
  );
  const defaultOutputRow = promptRows.find(
    (r) => r.category === 'output' && r.slug === chatbotCfg.default_output
  );
  const activeModeRecipes = recipes.filter(
    (r) => r.is_active && r.target_type === 'mode'
  );

  const guideModelOverride = guideCfg.model_id || systemPromptRow?.model_id || null;
  const effectiveConsultationModel = guideModelOverride || runtime.consultationModel;
  const effectiveUtilityModel = runtime.utilityModel;
  const jevModel = runtime.jevClassifierEnabled ? runtime.jevModel : runtime.utilityModel;

  const isWesternManifestGuide =
    guideSlug === 'western_astrologer' ||
    guideSlug === 'hellenistic_astrologer';
  const isVedicManifestGuide =
    guideSlug === DEFAULT_COUNCIL_EXPERT_SLUG ||
    guideSlug === 'kp_precision' ||
    guideSlug === 'jaimini';
  const isAstroPipelineManifestGuide = isVedicManifestGuide || isWesternManifestGuide;

  const runtimeFiles =
    guideMeta.pillar === 'council'
      ? [
          ...(isAstroPipelineManifestGuide
            ? [
                {
                  step: 'Stage 1 — Intent & Playbook Router',
                  filePath: 'server/services/intentRouter.ts',
                  modelResolved: `${jevModel} -> ${effectiveUtilityModel}`,
                  notes: 'Classifies question into Canonical Playbook, 5-Tier Intent archetype, and user fluency.',
                },
                {
                  step: isWesternManifestGuide
                    ? 'Stage 2 — Western Context & Playbook Slicer'
                    : 'Stage 2 — Vedic Context & Playbook Slicer',
                  filePath: isWesternManifestGuide
                    ? 'server/services/westernContextSlicer.ts'
                    : 'server/services/contextSlicer.ts',
                  modelResolved: 'Deterministic Node/TS + Database',
                  notes: isWesternManifestGuide
                    ? 'Selects Placidus cusps, Sect, Dignity, Mutual Receptions, Tight <=2° Aspects, Profections, Progressions, Outer Transits & w_* Cartridges.'
                    : 'Selects relevant houses, Vargas, KP Sub-Lords, Formula Cartridges, Priority Rules, and Playbook overrides.',
                },
              ]
            : []),
          {
            step: 'Consultation Orchestrator',
            filePath: 'server/services/geminiOrchestrator.ts',
            modelResolved: effectiveConsultationModel,
            notes: 'Builds static + volatile system instructions, resolves guide rules, and streams SSE output.',
          },
          ...(isAstroPipelineManifestGuide
            ? [
                {
                  step: isWesternManifestGuide
                    ? 'Stage 3 — Western Astrologer Reasoner & Voice Synthesizer'
                    : 'Stage 3 — Vedic Astrologer Reasoner & Voice Synthesizer',
                  filePath: 'server/services/vedicAstrologerEngine.ts',
                  modelResolved: effectiveConsultationModel,
                  notes: 'Enforces Tier-1 Adjudication Laws, Anti-Cliché Guardrails, Intent Contract, Fluency, and Format Contract.',
                },
                {
                  step: isWesternManifestGuide
                    ? 'Optional — Deep Multi-System Western Audit'
                    : 'Optional — Deep Multi-System Council Audit',
                  filePath: 'server/services/deepCouncilAudit.ts',
                  modelResolved: effectiveConsultationModel,
                  notes: isWesternManifestGuide
                    ? 'Runs 4 parallel Western lenses (Sect & Dignity, Tight Aspects, Multi-Clock Timing, Contrarian) + Adjudicator Mandate when toggled.'
                    : 'Runs 4 parallel analytical lenses (Parashari, KP/Nadi, Multi-Clock Timing, Contrarian) + Adjudicator Mandate when toggled.',
                },
              ]
            : []),
          {
            step: guideCfg.suggestions.enabled
              ? 'Stage 4 — Aligned Suggestions Engine (Active)'
              : 'Stage 4 — Aligned Suggestions Engine (Disabled for Guide)',
            filePath: 'server/services/suggestionEngine.ts',
            modelResolved: guideCfg.suggestions.enabled ? effectiveUtilityModel : 'Skipped (Master Disabled)',
            notes: guideCfg.suggestions.enabled
              ? 'Generates Followup & Deeper Analysis chips using guide suggestion limits and rules.'
              : 'Bypassed completely for this guide — zero Stage 4 OpenRouter calls.',
          },
          {
            step: 'Chat HTTP & Streaming Controller',
            filePath: 'server/routes/chat.ts',
            modelResolved: effectiveConsultationModel,
            notes: 'Handles auth, credit deduction, message persistence, SSE streaming, and gated Stage 4 dispatch.',
          },
        ]
      : [
          {
            step: guideMeta.pillar === 'companion' ? 'Companion Persona & Matching Engine' : 'Clarity Sidekick Engine',
            filePath: 'server/services/companionEngine.ts',
            modelResolved: effectiveConsultationModel,
            notes:
              guideMeta.pillar === 'companion'
                ? 'Compiles Companion Constitution, Archetype Matcher Rules, and per-guide modular rules.'
                : 'Compiles Clarity Helper System Prompt and per-guide modular rules off-record.',
          },
          {
            step: 'Consultation Orchestrator & Stream',
            filePath: 'server/services/geminiOrchestrator.ts',
            modelResolved: effectiveConsultationModel,
            notes: 'Streams response over OpenRouter using guide model override if configured.',
          },
          {
            step: guideCfg.suggestions.enabled
              ? 'Stage 4 — Suggestions Engine (Active)'
              : 'Stage 4 — Suggestions Engine (Disabled for Guide)',
            filePath: 'server/services/suggestionEngine.ts',
            modelResolved: guideCfg.suggestions.enabled ? effectiveUtilityModel : 'Skipped (Master Disabled)',
            notes: guideCfg.suggestions.enabled
              ? 'Active per Admin override.'
              : 'Skipped completely — zero suggestion token cost for this pillar.',
          },
          {
            step: 'Chat HTTP & Streaming Controller',
            filePath: 'server/routes/chat.ts',
            modelResolved: effectiveConsultationModel,
            notes: 'Handles conversation persistence, metering, and SSE streaming.',
          },
        ];

  const makeStackItem = (
    order: number,
    layer: string,
    source: 'Database' | 'Code Default',
    dbLocation: string,
    status: 'Active' | 'Disabled',
    text: string
  ) => {
    const clean = text.trim();
    return {
      order,
      layer,
      source,
      dbLocation,
      status,
      chars: clean.length,
      approxTokens: Math.ceil(clean.length / 4),
      preview: clean.length > 280 ? `${clean.slice(0, 280)}…` : clean,
      fullText: clean,
    };
  };

  const promptStack: Array<ReturnType<typeof makeStackItem>> = [];
  if (guideMeta.pillar === 'council') {
    if (isWesternManifestGuide) {
      const hasCustomWesternConst = Boolean(
        engineOverrides.western_core_council_constitution?.trim()
      );
      const westernConstText =
        engineOverrides.western_core_council_constitution?.trim() ||
        WESTERN_CORE_COUNCIL_CONSTITUTION;
      promptStack.push(
        makeStackItem(
          1,
          'Western Council Constitution (Anti-Extraction & Tropical Grounding)',
          hasCustomWesternConst ? 'Database' : 'Code Default',
          hasCustomWesternConst
            ? 'platform_settings.engine_prompt_overrides.western_core_council_constitution'
            : 'enginePromptDefaults.ts',
          'Active',
          westernConstText
        )
      );
    } else {
      const hasCustomConst = Boolean(engineOverrides.core_council_constitution?.trim());
      const constText =
        engineOverrides.core_council_constitution?.trim() || DEFAULT_CORE_COUNCIL_CONSTITUTION;
      promptStack.push(
        makeStackItem(
          1,
          'Core Council Constitution (Anti-Extraction & Grounding)',
          hasCustomConst ? 'Database' : 'Code Default',
          hasCustomConst
            ? 'platform_settings.engine_prompt_overrides.core_council_constitution'
            : 'enginePromptDefaults.ts',
          'Active',
          constText
        )
      );
    }

    const expertBody = systemPromptRow?.prompt_body || seedPrompt?.prompt_body || '';
    const isExpertModifiedFromSeed =
      Boolean(systemPromptRow && seedPrompt && systemPromptRow.prompt_body.trim() !== seedPrompt.prompt_body.trim());
    promptStack.push(
      makeStackItem(
        2,
        `Guide Expert Prompt (${guideMeta.displayName})`,
        systemPromptRow ? 'Database' : 'Code Default',
        systemPromptRow ? `system_prompts[slug="${guideSlug}"]` : 'promptDefaults.ts',
        systemPromptRow?.is_active === false ? 'Disabled' : 'Active',
        expertBody + (isExpertModifiedFromSeed ? '' : '')
      )
    );

    if (isWesternManifestGuide) {
      const hasWesternLaws = Boolean(engineOverrides.western_tier1_reasoning_laws?.trim());
      promptStack.push(
        makeStackItem(
          3,
          'Western Tier-1 Adjudication Laws & Truth Gate',
          hasWesternLaws ? 'Database' : 'Code Default',
          hasWesternLaws
            ? 'platform_settings.engine_prompt_overrides.western_tier1_reasoning_laws'
            : 'enginePromptDefaults.ts',
          'Active',
          engineOverrides.western_tier1_reasoning_laws?.trim() || WESTERN_TIER1_REASONING_LAWS
        )
      );

      const hasWesternAntiCliche = Boolean(engineOverrides.western_anti_cliche_rules?.trim());
      promptStack.push(
        makeStackItem(
          4,
          'Western Voice & Anti-Cliché Guardrails',
          hasWesternAntiCliche ? 'Database' : 'Code Default',
          hasWesternAntiCliche
            ? 'platform_settings.engine_prompt_overrides.western_anti_cliche_rules'
            : 'enginePromptDefaults.ts',
          'Active',
          engineOverrides.western_anti_cliche_rules?.trim() || WESTERN_ANTI_CLICHE_RULES
        )
      );

      const formatKey = (chatbotCfg.default_output === 'short' ? 'short' : 'detailed') as keyof typeof WESTERN_FORMAT_CONTRACTS;
      const hasWesternFormat = Boolean(engineOverrides.western_format_contracts?.[formatKey]?.trim());
      promptStack.push(
        makeStackItem(
          5,
          `Western Format Contract (${chatbotCfg.default_output})`,
          hasWesternFormat ? 'Database' : 'Code Default',
          hasWesternFormat
            ? 'platform_settings.engine_prompt_overrides.western_format_contracts'
            : 'enginePromptDefaults.ts',
          'Active',
          engineOverrides.western_format_contracts?.[formatKey]?.trim() ||
            WESTERN_FORMAT_CONTRACTS[formatKey] ||
            WESTERN_FORMAT_CONTRACTS.detailed
        )
      );
    } else if (isVedicManifestGuide) {
      const hasLawsOverride = Boolean(engineOverrides.vedic_tier1_reasoning_laws?.trim());
      promptStack.push(
        makeStackItem(
          3,
          'Tier-1 Adjudication Laws & Truth Gate',
          hasLawsOverride ? 'Database' : 'Code Default',
          hasLawsOverride ? 'platform_settings.engine_prompt_overrides.vedic_tier1_reasoning_laws' : 'enginePromptDefaults.ts',
          'Active',
          engineOverrides.vedic_tier1_reasoning_laws?.trim() || DEFAULT_VEDIC_TIER1_REASONING_LAWS
        )
      );

      const hasAntiCliche = Boolean(engineOverrides.vedic_anti_cliche_rules?.trim());
      promptStack.push(
        makeStackItem(
          4,
          'Voice & Anti-Cliché Guardrails',
          hasAntiCliche ? 'Database' : 'Code Default',
          hasAntiCliche ? 'platform_settings.engine_prompt_overrides.vedic_anti_cliche_rules' : 'enginePromptDefaults.ts',
          'Active',
          engineOverrides.vedic_anti_cliche_rules?.trim() || DEFAULT_VEDIC_ANTI_CLICHE_RULES
        )
      );

      const hasFormatCustom = Boolean(engineOverrides.format_contracts?.detailed?.trim());
      promptStack.push(
        makeStackItem(
          5,
          `Format Contract (${chatbotCfg.default_output})`,
          hasFormatCustom ? 'Database' : defaultOutputRow ? 'Database' : 'Code Default',
          hasFormatCustom
            ? 'platform_settings.engine_prompt_overrides.format_contracts'
            : `system_prompts[slug="${chatbotCfg.default_output}"]`,
          'Active',
          engineOverrides.format_contracts?.detailed?.trim() ||
            defaultOutputRow?.prompt_body ||
            DEFAULT_FORMAT_CONTRACTS.detailed
        )
      );
    } else {
      promptStack.push(
        makeStackItem(
          3,
          `Default Output Style (${chatbotCfg.default_output})`,
          defaultOutputRow ? 'Database' : 'Code Default',
          defaultOutputRow ? `system_prompts[slug="${chatbotCfg.default_output}"]` : 'promptDefaults.ts',
          defaultOutputRow?.is_active === false ? 'Disabled' : 'Active',
          defaultOutputRow?.prompt_body || DEFAULT_FORMAT_CONTRACTS.detailed
        )
      );
    }

    promptStack.push(
      makeStackItem(
        promptStack.length + 1,
        `Default Language Directive (${chatbotCfg.default_language})`,
        defaultLanguageRow ? 'Database' : 'Code Default',
        defaultLanguageRow ? `system_prompts[slug="${chatbotCfg.default_language}"]` : 'promptDefaults.ts',
        defaultLanguageRow?.is_active === false ? 'Disabled' : 'Active',
        defaultLanguageRow?.prompt_body || `LANGUAGE: ${chatbotCfg.default_language}`
      )
    );
  } else if (guideMeta.pillar === 'companion') {
    const hasConst = Boolean(engineOverrides.companion_constitution?.trim());
    promptStack.push(
      makeStackItem(
        1,
        'Companion Safety & Tone Constitution',
        hasConst ? 'Database' : 'Code Default',
        hasConst ? 'platform_settings.engine_prompt_overrides.companion_constitution' : 'enginePromptDefaults.ts',
        'Active',
        engineOverrides.companion_constitution?.trim() || DEFAULT_COMPANION_CONSTITUTION
      )
    );
    const hasRealism = Boolean(engineOverrides.companion_realism_baseline?.trim());
    promptStack.push(
      makeStackItem(
        2,
        'Companion Anti-AI Realism Baseline',
        hasRealism ? 'Database' : 'Code Default',
        hasRealism ? 'platform_settings.engine_prompt_overrides.companion_realism_baseline' : 'enginePromptDefaults.ts',
        'Active',
        engineOverrides.companion_realism_baseline?.trim() || DEFAULT_COMPANION_REALISM_BASELINE
      )
    );
    const hasChartPresence = Boolean(engineOverrides.companion_chart_presence_prompt?.trim());
    promptStack.push(
      makeStackItem(
        3,
        'Companion Chart Adaptability & Full Context Directive',
        hasChartPresence ? 'Database' : 'Code Default',
        hasChartPresence
          ? 'platform_settings.engine_prompt_overrides.companion_chart_presence_prompt'
          : 'enginePromptDefaults.ts',
        'Active',
        engineOverrides.companion_chart_presence_prompt?.trim() || DEFAULT_COMPANION_CHART_PRESENCE_PROMPT
      )
    );
    const hasMatcher = Boolean(engineOverrides.companion_matcher_instructions?.trim());
    promptStack.push(
      makeStackItem(
        4,
        'Companion 4-Persona Matcher Rules',
        hasMatcher ? 'Database' : 'Code Default',
        hasMatcher ? 'platform_settings.engine_prompt_overrides.companion_matcher_instructions' : 'enginePromptDefaults.ts',
        'Active',
        engineOverrides.companion_matcher_instructions?.trim() || DEFAULT_COMPANION_MATCHER_INSTRUCTIONS
      )
    );
  } else {
    const hasClarity = Boolean(engineOverrides.clarity_helper_system_prompt?.trim());
    promptStack.push(
      makeStackItem(
        1,
        'Clarity Sidekick Core Prompt',
        hasClarity ? 'Database' : 'Code Default',
        hasClarity ? 'platform_settings.engine_prompt_overrides.clarity_helper_system_prompt' : 'enginePromptDefaults.ts',
        'Active',
        engineOverrides.clarity_helper_system_prompt?.trim() || DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT
      )
    );
  }

  // Per-guide Modular Conversational Rules Stack (always highest behavioral precedence)
  promptStack.push(
    makeStackItem(
      promptStack.length + 1,
      `Per-Guide Modular Rules Stack (${guideCfg.modular_rules.filter((r) => r.enabled).length}/${guideCfg.modular_rules.length} active)`,
      guideCfg.has_custom_modular_rules ? 'Database' : 'Code Default',
      guideCfg.has_custom_modular_rules
        ? `platform_settings.per_guide_chatbot_config.${guideSlug}.modular_rules`
        : 'platform_settings.chatbot_config.conversational_rules / Code Default',
      guideCfg.combined_rules_text ? 'Active' : 'Disabled',
      guideCfg.combined_rules_text || '(No active rules enabled for this guide)'
    )
  );

  // Override Warnings
  const overrideWarnings: Array<{ severity: 'warn' | 'info'; message: string }> = [];
  if (!runtime.apiKey) {
    overrideWarnings.push({
      severity: 'warn',
      message: 'No OpenRouter API key is configured in AI Settings or environment variables. Live chat requests will fail until set.',
    });
  }
  if (systemPromptRow && systemPromptRow.is_active === false) {
    overrideWarnings.push({
      severity: 'warn',
      message: `${guideMeta.displayName} is currently marked Hidden/Inactive in system_prompts and may not appear in public dropdowns.`,
    });
  }
  const rulesLower = guideCfg.combined_rules_text.toLowerCase();
  if (
    isAstroPipelineManifestGuide &&
    (rulesLower.includes('no table') ||
      rulesLower.includes('never use table') ||
      rulesLower.includes('no heading') ||
      rulesLower.includes('never use markdown heading'))
  ) {
    overrideWarnings.push({
      severity: 'warn',
      message:
        'Modular rule conflict detected: active modular rules instruct against headings or tables while Detailed Observatory Format instructs ## cards & evidence tables.',
    });
  }
  if (!guideCfg.suggestions.enabled) {
    overrideWarnings.push({
      severity: 'info',
      message: `Suggestions are disabled for ${guideMeta.displayName} (Stage 4 LLM suggestion calls and UI suggestion cards are skipped).`,
    });
  }
  if (guideModelOverride && guideModelOverride !== runtime.consultationModel) {
    overrideWarnings.push({
      severity: 'info',
      message: `Guide uses custom model override "${guideModelOverride}" instead of global consultation model "${runtime.consultationModel}".`,
    });
  }

  const recipeSlugsSet = new Set<string>();
  for (const r of activeModeRecipes) {
    for (const st of r.steps_json || []) {
      if (st.enabled && st.prompt_slug) recipeSlugsSet.add(st.prompt_slug);
    }
  }
  const unboundModifiers = promptRows.filter(
    (r) => r.is_active && (r.category === 'modifier' || r.category === 'tone') && !recipeSlugsSet.has(r.slug)
  );
  if (unboundModifiers.length > 0 && guideMeta.pillar === 'council') {
    overrideWarnings.push({
      severity: 'info',
      message: `${unboundModifiers.length} active modifier/tone prompt(s) in Prompt Library (${unboundModifiers
        .slice(0, 3)
        .map((m) => m.slug)
        .join(', ')}${unboundModifiers.length > 3 ? '…' : ''}) are not bound to any active mode recipe.`,
    });
  }

  const cartridgesList = Object.values(cartridgesMap);
  const priorityRulesList = Object.values(priorityRulesMap);

  const databaseTables = [
    {
      table: 'system_prompts',
      purpose: 'Guides, modes, outputs, languages, formula cartridges, priority rules & library blocks',
      count: promptRows.length,
      details: `${cartridgesList.filter((c) => c.is_active).length}/${cartridgesList.length} active cartridges · ${
        priorityRulesList.filter((p) => p.is_active).length
      }/${priorityRulesList.length} active priority rules`,
    },
    {
      table: 'prompt_recipes',
      purpose: 'Composable prompt pipelines bound to focus modes & reports',
      count: activeModeRecipes.length,
      details: `${recipes.length} total recipes configured`,
    },
    {
      table: 'platform_settings',
      purpose: 'Global defaults, per_guide_chatbot_config, engine_prompt_overrides & playbook_overrides',
      count: Object.keys(pbOverrides).length,
      details: `${guideCfg.modular_rules.filter((r) => r.enabled).length} enabled modular rules for ${guideSlug} · ${
        Object.keys(pbOverrides).length
      } customized canonical playbooks`,
    },
    {
      table: 'daily_transits',
      purpose: 'Shared platform Gochar planetary ephemeris feed (1 fetch/day)',
      count: dailyTransitsCountRes.count ?? 0,
      details: 'Cached transit rows available for live readings',
    },
    {
      table: 'profiles',
      purpose: 'Activated member birth charts, life context & memory summaries',
      count: profilesCountRes.count ?? 0,
      details: 'Chart context sliced dynamically by Stage 2 Slicer',
    },
    {
      table: 'conversations & messages',
      purpose: 'Encrypted conversation threads, turns & cached Stage 4 suggestion JSON',
      count: conversationsCountRes.count ?? 0,
      details: `${messagesCountRes.count ?? 0} total messages stored`,
    },
    {
      table: 'chatbot_pipeline_logs',
      purpose: 'Opt-in Stage 1–4 diagnostics and latency telemetry',
      count: pipelineLogsCountRes.count ?? 0,
      details: runtime.pipelineLoggingEnabled ? 'Diagnostics logging ON' : 'Diagnostics logging OFF',
    },
  ];

  res.json({
    guide: guideSlug,
    guideMeta,
    resolvedModels: {
      consultationModel: runtime.consultationModel,
      utilityModel: effectiveUtilityModel,
      jevModel,
      guideModelOverride,
      effectiveModel: effectiveConsultationModel,
    },
    runtimeFiles,
    promptStack,
    overrideWarnings,
    databaseTables,
  });
});

// 8b. Suggestions (Followup & Deeper analysis) Dynamic Rules Control
router.get('/settings/suggestions', async (_req: AuthenticatedRequest, res) => {
  const config = await getSuggestionsConfig();
  res.json({
    config,
    defaults: {
      ...DEFAULT_SUGGESTIONS_CONFIG,
      followups_rules: DEFAULT_FOLLOWUPS_RULES,
      deeper_analysis_rules: DEFAULT_DEEPER_ANALYSIS_RULES,
    },
  });
});

router.put('/settings/suggestions', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const current = await getSuggestionsConfig();
  const body = req.body || {};

  const nextConfig = {
    followups_enabled:
      typeof body.followups_enabled === 'boolean'
        ? body.followups_enabled
        : current.followups_enabled,
    deeper_analysis_enabled:
      typeof body.deeper_analysis_enabled === 'boolean'
        ? body.deeper_analysis_enabled
        : current.deeper_analysis_enabled,
    default_expanded:
      typeof body.default_expanded === 'boolean'
        ? body.default_expanded
        : current.default_expanded,
    max_followups:
      typeof body.max_followups === 'number' && body.max_followups >= 1
        ? Math.min(6, Math.round(body.max_followups))
        : current.max_followups,
    max_deeper_analysis:
      typeof body.max_deeper_analysis === 'number' && body.max_deeper_analysis >= 1
        ? Math.min(6, Math.round(body.max_deeper_analysis))
        : current.max_deeper_analysis,
    followups_rules:
      typeof body.followups_rules === 'string' && body.followups_rules.trim()
        ? body.followups_rules.trim().slice(0, 4000)
        : current.followups_rules,
    deeper_analysis_rules:
      typeof body.deeper_analysis_rules === 'string' && body.deeper_analysis_rules.trim()
        ? body.deeper_analysis_rules.trim().slice(0, 5000)
        : current.deeper_analysis_rules,
  };

  const saved = await savePlatformSetting('suggestions_config', nextConfig, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save suggestions settings.' });
    return;
  }

  res.json({ saved: true, config: nextConfig });
});

// 9. Pricing & Plans Management
router.get('/settings/pricing', async (_req: AuthenticatedRequest, res) => {
  const pricing = await getPricingConfig();
  res.json({ pricing });
});

router.put('/settings/pricing', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const current = await getPricingConfig();
  const body = req.body || {};

  const nextPricing = {
    signup_welcome_credits:
      typeof body.signup_welcome_credits === 'number' && body.signup_welcome_credits >= 0
        ? Math.round(body.signup_welcome_credits)
        : current.signup_welcome_credits,
    referral_reward_credits:
      typeof body.referral_reward_credits === 'number' && body.referral_reward_credits >= 0
        ? Math.round(body.referral_reward_credits)
        : current.referral_reward_credits,
    min_credits_to_chat:
      typeof body.min_credits_to_chat === 'number' && body.min_credits_to_chat >= 0
        ? Math.round(body.min_credits_to_chat)
        : current.min_credits_to_chat,
    chat_billing: {
      output_token_weight:
        typeof body.chat_billing?.output_token_weight === 'number' &&
        body.chat_billing.output_token_weight >= 0
          ? Number(body.chat_billing.output_token_weight)
          : current.chat_billing.output_token_weight,
      input_token_weight:
        typeof body.chat_billing?.input_token_weight === 'number' &&
        body.chat_billing.input_token_weight >= 0
          ? Number(body.chat_billing.input_token_weight)
          : current.chat_billing.input_token_weight,
      min_credits_per_reply:
        typeof body.chat_billing?.min_credits_per_reply === 'number' &&
        body.chat_billing.min_credits_per_reply >= 0
          ? Math.round(body.chat_billing.min_credits_per_reply)
          : current.chat_billing.min_credits_per_reply,
      max_credits_per_reply:
        typeof body.chat_billing?.max_credits_per_reply === 'number' &&
        body.chat_billing.max_credits_per_reply >= 10
          ? Math.round(body.chat_billing.max_credits_per_reply)
          : current.chat_billing.max_credits_per_reply,
    },
    credit_packs: Array.isArray(body.credit_packs) && body.credit_packs.length > 0
      ? body.credit_packs.map((p: Record<string, unknown>, idx: number) => {
          const prices = (p.prices || {}) as Record<string, unknown>;
          return {
            slug: String(p.slug || `pack_${idx + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
            name: String(p.name || 'Credit Pack').trim(),
            subtitle: String(p.subtitle || '').trim(),
            credits: Math.max(0, Math.round(Number(p.credits) || 0)),
            highlight: typeof p.highlight === 'string' && p.highlight.trim() ? p.highlight.trim() : undefined,
            dodo_product_id:
              typeof p.dodo_product_id === 'string' && p.dodo_product_id.trim()
                ? p.dodo_product_id.trim()
                : undefined,
            is_active: p.is_active !== false,
            prices: {
              INR: Math.max(0, Number(prices.INR) || 0),
              USD: Math.max(0, Number(prices.USD) || 0),
              AED: Math.max(0, Number(prices.AED) || 0),
              EUR: Math.max(0, Number(prices.EUR) || 0),
            },
          };
        })
      : current.credit_packs,
    membership_tiers: Array.isArray(body.membership_tiers) && body.membership_tiers.length > 0
      ? body.membership_tiers.map((t: Record<string, unknown>) => {
          const prices = (t.prices || {}) as Record<string, unknown>;
          const slug =
            t.slug === 'pro' || t.slug === 'guru' ? t.slug : ('personal' as const);
          return {
            slug,
            name: String(t.name || slug).trim(),
            profileLimit: Math.max(1, Math.round(Number(t.profileLimit) || 10)),
            activationCostCredits: Math.max(0, Math.round(Number(t.activationCostCredits) || 0)),
            includedMonthlyCredits: Math.max(0, Math.round(Number(t.includedMonthlyCredits) || 0)),
            dodo_product_id:
              typeof t.dodo_product_id === 'string' && t.dodo_product_id.trim()
                ? t.dodo_product_id.trim()
                : undefined,
            prices: {
              INR: Math.max(0, Number(prices.INR) || 0),
              USD: Math.max(0, Number(prices.USD) || 0),
              AED: Math.max(0, Number(prices.AED) || 0),
              EUR: Math.max(0, Number(prices.EUR) || 0),
            },
            features: Array.isArray(t.features)
              ? t.features.map((f) => String(f).trim()).filter(Boolean)
              : [],
          };
        })
      : current.membership_tiers,
  };

  const saved = await savePlatformSetting('pricing_config', nextPricing, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save pricing configuration.' });
    return;
  }

  res.json({ saved: true, pricing: nextPricing });
});

// 10. Composable Prompt Recipes CRUD
router.get('/recipes', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('prompt_recipes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    if (error.code === '42P01' || String(error.message || '').toLowerCase().includes('prompt_recipes')) {
      res.json({ recipes: [], tableMissing: true });
      return;
    }
    res.status(500).json({ error: 'Failed to load prompt recipes' });
    return;
  }

  res.json({ recipes: data || [], tableMissing: false });
});

router.post('/recipes', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { slug, name, description, target_type, target_slug, steps_json, model_id, is_active } =
    req.body || {};

  if (!String(name || '').trim()) {
    res.status(400).json({ error: 'Recipe name is required.' });
    return;
  }

  const normalizedSlug = String(slug || name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const normalizedTargetType =
    target_type === 'report_pass' || target_type === 'custom' ? target_type : 'mode';

  const normalizedSteps: PromptRecipeStep[] = Array.isArray(steps_json)
    ? steps_json
        .filter((s) => s && typeof s.prompt_slug === 'string' && s.prompt_slug.trim())
        .map((s) => ({
          prompt_slug: String(s.prompt_slug).trim(),
          label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : undefined,
          inline_override:
            typeof s.inline_override === 'string' && s.inline_override.trim()
              ? s.inline_override.trim()
              : undefined,
          enabled: s.enabled !== false,
        }))
    : [];

  const { data, error } = await supabaseAdmin
    .from('prompt_recipes')
    .insert({
      slug: normalizedSlug,
      name: String(name).trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      target_type: normalizedTargetType,
      target_slug: typeof target_slug === 'string' && target_slug.trim() ? target_slug.trim() : null,
      steps_json: normalizedSteps,
      model_id: typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null,
      is_active: is_active !== false,
    })
    .select('*')
    .single();

  if (error || !data) {
    const msg = error?.message || 'Could not create recipe';
    if (error?.code === '42P01' || msg.toLowerCase().includes('prompt_recipes')) {
      res.status(400).json({
        error:
          'Table public.prompt_recipes does not exist yet. Run supabase/migrations/004_admin_console_and_recipes.sql in Supabase SQL Editor first.',
      });
      return;
    }
    res.status(400).json({ error: msg });
    return;
  }

  invalidateRecipesCache();
  res.status(201).json({ recipe: data });
});

router.patch('/recipes/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { name, description, target_type, target_slug, steps_json, model_id, is_active } =
    req.body || {};

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (description !== undefined) {
    updates.description =
      typeof description === 'string' && description.trim() ? description.trim() : null;
  }
  if (target_type === 'mode' || target_type === 'report_pass' || target_type === 'custom') {
    updates.target_type = target_type;
  }
  if (target_slug !== undefined) {
    updates.target_slug =
      typeof target_slug === 'string' && target_slug.trim() ? target_slug.trim() : null;
  }
  if (model_id !== undefined) {
    updates.model_id = typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null;
  }
  if (typeof is_active === 'boolean') updates.is_active = is_active;
  if (Array.isArray(steps_json)) {
    updates.steps_json = steps_json
      .filter((s) => s && typeof s.prompt_slug === 'string' && s.prompt_slug.trim())
      .map((s) => ({
        prompt_slug: String(s.prompt_slug).trim(),
        label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : undefined,
        inline_override:
          typeof s.inline_override === 'string' && s.inline_override.trim()
            ? s.inline_override.trim()
            : undefined,
        enabled: s.enabled !== false,
      }));
  }

  const { data, error } = await supabaseAdmin
    .from('prompt_recipes')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error || !data) {
    res.status(400).json({ error: error?.message || 'Failed to update prompt recipe' });
    return;
  }

  invalidateRecipesCache();
  res.json({ recipe: data });
});

router.delete('/recipes/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin.from('prompt_recipes').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: error.message || 'Failed to delete recipe' });
    return;
  }

  invalidateRecipesCache();
  res.json({ deleted: true });
});

// 11. Support Tickets Desk
router.get('/support', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  let query = supabaseAdmin
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (['open', 'in_progress', 'resolved'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }
  if (search) {
    query = query.or(
      `subject.ilike.%${search}%,from_email.ilike.%${search}%,from_name.ilike.%${search}%,message.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01' || String(error.message || '').toLowerCase().includes('support_tickets')) {
      res.json({ tickets: [], tableMissing: true });
      return;
    }
    res.status(500).json({ error: 'Failed to load support tickets' });
    return;
  }

  const tickets = data || [];
  const userIds = Array.from(new Set(tickets.map((t) => t.user_id).filter(Boolean)));
  const userMetaMap = new Map<string, { tier: string; credits_balance: number }>();

  if (userIds.length > 0) {
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('id, tier, credits_balance')
      .in('id', userIds);
    for (const u of userRows || []) {
      userMetaMap.set(u.id, { tier: u.tier, credits_balance: u.credits_balance });
    }
  }

  const enriched = tickets.map((t) => ({
    ...t,
    user_tier: t.user_id ? userMetaMap.get(t.user_id)?.tier || null : null,
    user_credits_balance: t.user_id ? userMetaMap.get(t.user_id)?.credits_balance ?? null : null,
  }));

  res.json({ tickets: enriched, tableMissing: false });
});

router.patch('/support/:id', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { status, priority, admin_notes } = req.body || {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status === 'open' || status === 'in_progress' || status === 'resolved') {
    updates.status = status;
  }
  if (priority === 'low' || priority === 'normal' || priority === 'high') {
    updates.priority = priority;
  }
  if (admin_notes !== undefined) {
    updates.admin_notes =
      typeof admin_notes === 'string' && admin_notes.trim() ? admin_notes.trim() : null;
  }

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error || !data) {
    res.status(400).json({ error: error?.message || 'Failed to update support ticket' });
    return;
  }

  res.json({ ticket: data });
});

router.post('/support/:id/reply', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { replyText, markResolved } = req.body || {};
  const cleanReply = typeof replyText === 'string' ? replyText.trim() : '';
  if (!cleanReply) {
    res.status(400).json({ error: 'Reply message is required.' });
    return;
  }

  const { data: ticket } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!ticket) {
    res.status(404).json({ error: 'Support ticket not found' });
    return;
  }

  const emailRes = await sendSupportReplyEmail({
    to: ticket.from_email,
    name: ticket.from_name,
    subject: ticket.subject,
    originalMessage: ticket.message,
    replyText: cleanReply,
  });

  const { data: updated, error } = await supabaseAdmin
    .from('support_tickets')
    .update({
      admin_reply_text: cleanReply,
      replied_at: new Date().toISOString(),
      replied_by: req.appUser.id,
      status: markResolved ? 'resolved' : 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: 'Reply sent, but failed to update ticket status.' });
    return;
  }

  res.json({
    ticket: updated,
    emailSent: emailRes.sent,
    emailReason: emailRes.reason,
  });
});

// 12. Mini-Apps Usage, Token Economics & Governance Controls
router.get('/apps/analytics', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawDays = String(req.query.days || '30').trim();
  const periodDays = rawDays === '7' ? 7 : rawDays === 'all' ? 0 : 30;
  const sinceIso =
    periodDays > 0
      ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const [miniAppsCfg, runtime, adminCatalog] = await Promise.all([
    getMiniAppsConfig(),
    getResolvedOpenRouterRuntime(),
    getDynamicMiniAppsAdminCatalog(),
  ]);

  let usageTableMissing = false;
  let usageRows: Array<{
    user_id: string;
    app_slug: string;
    cache_hit: boolean;
    tokens_in: number;
    tokens_out: number;
    model_used: string | null;
    created_at: string;
  }> = [];

  try {
    let query = supabaseAdmin
      .from('app_usage_logs')
      .select('user_id, app_slug, cache_hit, tokens_in, tokens_out, model_used, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (sinceIso) {
      query = query.gte('created_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01' || String(error.message || '').toLowerCase().includes('app_usage_logs')) {
        usageTableMissing = true;
      }
    } else if (Array.isArray(data)) {
      usageRows = data.map((r) => ({
        user_id: String(r.user_id || ''),
        app_slug: String(r.app_slug || ''),
        cache_hit: Boolean(r.cache_hit),
        tokens_in: Number(r.tokens_in || 0),
        tokens_out: Number(r.tokens_out || 0),
        model_used: r.model_used ? String(r.model_used) : null,
        created_at: String(r.created_at || ''),
      }));
    }
  } catch {
    usageTableMissing = true;
  }

  // Favorites counts & total cached rows
  const favoritesBySlug = new Map<string, number>();
  let totalCachedEntries = 0;

  try {
    const [favRes, cacheCountRes] = await Promise.all([
      supabaseAdmin.from('user_favorite_apps').select('app_slug').limit(5000),
      supabaseAdmin.from('app_cache').select('id', { count: 'exact', head: true }),
    ]);
    if (!favRes.error && Array.isArray(favRes.data)) {
      for (const row of favRes.data) {
        const s = String(row.app_slug || '');
        if (!s) continue;
        favoritesBySlug.set(s, (favoritesBySlug.get(s) || 0) + 1);
      }
    }
    if (!cacheCountRes.error && typeof cacheCountRes.count === 'number') {
      totalCachedEntries = cacheCountRes.count;
    }
  } catch {
    // Graceful pre-migration fallback
  }

  const inRate = miniAppsCfg.estimated_input_cost_per_million_usd;
  const outRate = miniAppsCfg.estimated_output_cost_per_million_usd;
  const calcCostUsd = (tIn: number, tOut: number) =>
    (tIn / 1_000_000) * inRate + (tOut / 1_000_000) * outRate;

  let totalRuns = 0;
  let liveRuns = 0;
  let cacheHits = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const uniqueUsersSet = new Set<string>();

  const perAppAcc = new Map<
    string,
    {
      runs: number;
      liveRuns: number;
      cacheHits: number;
      tokensIn: number;
      tokensOut: number;
      users: Set<string>;
      lastUsedAt: string | null;
    }
  >();

  const dailyAcc = new Map<
    string,
    {
      date: string;
      totalRuns: number;
      liveRuns: number;
      cacheHits: number;
      tokensIn: number;
      tokensOut: number;
    }
  >();

  const userAcc = new Map<
    string,
    {
      totalRuns: number;
      liveRuns: number;
      cacheHits: number;
      tokensIn: number;
      tokensOut: number;
      lastUsedAt: string;
    }
  >();

  for (const row of usageRows) {
    totalRuns += 1;
    if (row.cache_hit) {
      cacheHits += 1;
    } else {
      liveRuns += 1;
    }
    totalTokensIn += row.tokens_in;
    totalTokensOut += row.tokens_out;
    if (row.user_id) uniqueUsersSet.add(row.user_id);

    // Per-app accumulation
    const appEntry = perAppAcc.get(row.app_slug) || {
      runs: 0,
      liveRuns: 0,
      cacheHits: 0,
      tokensIn: 0,
      tokensOut: 0,
      users: new Set<string>(),
      lastUsedAt: null,
    };
    appEntry.runs += 1;
    if (row.cache_hit) appEntry.cacheHits += 1;
    else appEntry.liveRuns += 1;
    appEntry.tokensIn += row.tokens_in;
    appEntry.tokensOut += row.tokens_out;
    if (row.user_id) appEntry.users.add(row.user_id);
    if (!appEntry.lastUsedAt || row.created_at > appEntry.lastUsedAt) {
      appEntry.lastUsedAt = row.created_at;
    }
    perAppAcc.set(row.app_slug, appEntry);

    // Daily timeline accumulation
    const dateKey = row.created_at.slice(0, 10);
    if (dateKey) {
      const day = dailyAcc.get(dateKey) || {
        date: dateKey,
        totalRuns: 0,
        liveRuns: 0,
        cacheHits: 0,
        tokensIn: 0,
        tokensOut: 0,
      };
      day.totalRuns += 1;
      if (row.cache_hit) day.cacheHits += 1;
      else day.liveRuns += 1;
      day.tokensIn += row.tokens_in;
      day.tokensOut += row.tokens_out;
      dailyAcc.set(dateKey, day);
    }

    // Per-user accumulation
    if (row.user_id) {
      const u = userAcc.get(row.user_id) || {
        totalRuns: 0,
        liveRuns: 0,
        cacheHits: 0,
        tokensIn: 0,
        tokensOut: 0,
        lastUsedAt: row.created_at,
      };
      u.totalRuns += 1;
      if (row.cache_hit) u.cacheHits += 1;
      else u.liveRuns += 1;
      u.tokensIn += row.tokens_in;
      u.tokensOut += row.tokens_out;
      if (row.created_at > u.lastUsedAt) u.lastUsedAt = row.created_at;
      userAcc.set(row.user_id, u);
    }
  }

  // Enrich top active users with email/name/tier
  const sortedTopUserIds = Array.from(userAcc.entries())
    .sort((a, b) => b[1].totalRuns - a[1].totalRuns)
    .slice(0, 15)
    .map(([uid]) => uid);

  const userInfoMap = new Map<string, { email: string; full_name: string | null; tier: string }>();
  if (sortedTopUserIds.length > 0) {
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, tier')
      .in('id', sortedTopUserIds);
    for (const u of userRows || []) {
      userInfoMap.set(String(u.id), {
        email: String(u.email || ''),
        full_name: u.full_name ? String(u.full_name) : null,
        tier: String(u.tier || 'personal'),
      });
    }
  }

  const topUsers = sortedTopUserIds.map((uid) => {
    const agg = userAcc.get(uid)!;
    const info = userInfoMap.get(uid);
    return {
      userId: uid,
      email: info?.email || 'Unknown user',
      fullName: info?.full_name || null,
      tier: info?.tier || 'personal',
      totalRuns: agg.totalRuns,
      liveRuns: agg.liveRuns,
      cacheHits: agg.cacheHits,
      totalTokens: agg.tokensIn + agg.tokensOut,
      estimatedCostUsd: Number(calcCostUsd(agg.tokensIn, agg.tokensOut).toFixed(4)),
      lastUsedAt: agg.lastUsedAt,
    };
  });

  const perAppRows = adminCatalog.apps.map((app) => {
    const agg = perAppAcc.get(app.slug);
    const ov = miniAppsCfg.overrides[app.slug] || {};
    const runs = agg?.runs || 0;
    const appLiveRuns = agg?.liveRuns || 0;
    const appCacheHits = agg?.cacheHits || 0;
    const tIn = agg?.tokensIn || 0;
    const tOut = agg?.tokensOut || 0;
    const costUsd = calcCostUsd(tIn, tOut);
    return {
      slug: app.slug,
      title: app.title,
      shortTitle: app.shortTitle,
      category: app.category,
      categoryLabel: app.categoryLabel,
      template: app.template,
      cacheScope: app.cacheScope,
      enabled: ov.enabled !== undefined ? ov.enabled !== false : app.isActive,
      featuredOnHome:
        typeof ov.featured_on_home === 'boolean' ? ov.featured_on_home : app.featuredOnHome,
      modelOverride: ov.model_id !== undefined ? ov.model_id : app.modelId,
      runs,
      liveRuns: appLiveRuns,
      cacheHits: appCacheHits,
      cacheHitRate: runs > 0 ? Math.round((appCacheHits / runs) * 100) : 0,
      uniqueUsers: agg ? agg.users.size : 0,
      avgTokensPerLiveRun:
        appLiveRuns > 0 ? Math.round((tIn + tOut) / appLiveRuns) : 0,
      tokensIn: tIn,
      tokensOut: tOut,
      totalTokens: tIn + tOut,
      estimatedCostUsd: Number(costUsd.toFixed(4)),
      favoritesCount: favoritesBySlug.get(app.slug) || 0,
      lastUsedAt: agg?.lastUsedAt || null,
    };
  });

  const dailySeries = Array.from(dailyAcc.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const estimatedTotalCostUsd = calcCostUsd(totalTokensIn, totalTokensOut);
  const uniqueUsersCount = uniqueUsersSet.size;
  const avgCostPerActiveUserUsd =
    uniqueUsersCount > 0 ? estimatedTotalCostUsd / uniqueUsersCount : 0;
  // 95% gross margin target => Price = Cost / (1 - 0.95) = Cost * 20
  const ninetyFiveMarginTargetPerUserUsd = avgCostPerActiveUserUsd * 20;

  res.json({
    periodDays,
    usageTableMissing,
    summary: {
      totalAppsCount: adminCatalog.apps.length,
      activeAppsCount: perAppRows.filter((r) => r.enabled).length,
      totalRuns,
      liveRuns,
      cacheHits,
      cacheHitRate: totalRuns > 0 ? Math.round((cacheHits / totalRuns) * 100) : 0,
      uniqueUsers: uniqueUsersCount,
      totalCachedEntries,
      totalTokensIn,
      totalTokensOut,
      totalTokens: totalTokensIn + totalTokensOut,
      estimatedCostUsd: Number(estimatedTotalCostUsd.toFixed(4)),
      avgCostPerActiveUserUsd: Number(avgCostPerActiveUserUsd.toFixed(4)),
      ninetyFiveMarginTargetPerUserUsd: Number(ninetyFiveMarginTargetPerUserUsd.toFixed(2)),
    },
    perApp: perAppRows,
    dailySeries,
    topUsers,
    config: miniAppsCfg,
    defaultConfig: DEFAULT_MINI_APPS_CONFIG,
    effectiveDefaultModel: miniAppsCfg.default_model_id || runtime.utilityModel,
  });
});

router.put('/apps/config', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = (req.body || {}) as Partial<MiniAppsGovernanceConfig>;
  const current = await getMiniAppsConfig();

  const nextOverrides: Record<string, MiniAppOverrideConfig> = {};
  if (body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides)) {
    for (const [slug, ov] of Object.entries(body.overrides)) {
      if (!ov || typeof ov !== 'object') continue;
      nextOverrides[slug] = {
        enabled: typeof ov.enabled === 'boolean' ? ov.enabled : undefined,
        featured_on_home:
          typeof ov.featured_on_home === 'boolean' ? ov.featured_on_home : undefined,
        model_id:
          typeof ov.model_id === 'string' && ov.model_id.trim()
            ? ov.model_id.trim()
            : null,
      };
    }
  } else {
    Object.assign(nextOverrides, current.overrides);
  }

  const nextConfig: MiniAppsGovernanceConfig = {
    default_model_id:
      typeof body.default_model_id === 'string' && body.default_model_id.trim()
        ? body.default_model_id.trim()
        : null,
    daily_live_runs_soft_cap:
      typeof body.daily_live_runs_soft_cap === 'number' && body.daily_live_runs_soft_cap >= 1
        ? Math.min(500, Math.round(body.daily_live_runs_soft_cap))
        : current.daily_live_runs_soft_cap,
    estimated_input_cost_per_million_usd:
      typeof body.estimated_input_cost_per_million_usd === 'number' &&
      body.estimated_input_cost_per_million_usd >= 0
        ? Number(body.estimated_input_cost_per_million_usd)
        : current.estimated_input_cost_per_million_usd,
    estimated_output_cost_per_million_usd:
      typeof body.estimated_output_cost_per_million_usd === 'number' &&
      body.estimated_output_cost_per_million_usd >= 0
        ? Number(body.estimated_output_cost_per_million_usd)
        : current.estimated_output_cost_per_million_usd,
    overrides: nextOverrides,
  };

  const saved = await savePlatformSetting('mini_apps_config', nextConfig, req.appUser.id);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to save Mini-Apps configuration.' });
    return;
  }

  await syncMiniAppsConfigOverridesToRegistry(nextOverrides, req.appUser.id);
  invalidateMiniAppsRegistryCache();
  res.json({ saved: true, config: nextConfig });
});

// Complete Mini-Apps & Categories CRUD + Reorder Endpoints
router.get('/apps/manager', async (_req: AuthenticatedRequest, res) => {
  const [catalog, runtime, cfg] = await Promise.all([
    getDynamicMiniAppsAdminCatalog(),
    getResolvedOpenRouterRuntime(),
    getMiniAppsConfig(),
  ]);
  res.json({
    apps: catalog.apps,
    categories: catalog.categories,
    storageSource: catalog.storageSource,
    effectiveDefaultModel: cfg.default_model_id || runtime.utilityModel,
  });
});

router.post('/apps/items', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const body = (req.body || {}) as MiniAppMutationPayload;
  const result = await createDynamicMiniApp(body, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ saved: true, app: result.app });
});

router.put('/apps/items/reorder', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const orderedSlugs = Array.isArray(req.body?.orderedSlugs)
    ? req.body.orderedSlugs.map((s: unknown) => String(s || '').trim()).filter(Boolean)
    : [];
  if (orderedSlugs.length === 0) {
    res.status(400).json({ error: 'orderedSlugs array is required.' });
    return;
  }
  const result = await reorderDynamicMiniApps(orderedSlugs, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ saved: true });
});

router.put('/apps/items/:slug', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const slug = String(req.params.slug || '').trim();
  const body = (req.body || {}) as Partial<MiniAppMutationPayload> & { flushCache?: boolean };
  const result = await updateDynamicMiniApp(slug, body, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  let cacheFlushed = false;
  if (body.flushCache) {
    clearMiniAppsMemoryCache(slug);
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('app_cache').delete().eq('app_slug', slug);
        cacheFlushed = true;
      } catch {
        // Non-fatal
      }
    }
  }

  res.json({ saved: true, app: result.app, cacheFlushed });
});

router.delete('/apps/items/:slug', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const slug = String(req.params.slug || '').trim();
  const result = await deleteDynamicMiniApp(slug, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  clearMiniAppsMemoryCache(slug);
  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('app_cache').delete().eq('app_slug', slug);
    } catch {
      // Non-fatal
    }
  }
  res.json({ deleted: true });
});

router.post('/apps/categories', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const body = (req.body || {}) as { slug?: string; label?: string; isActive?: boolean };
  const result = await createDynamicCategory(
    { slug: body.slug, label: String(body.label || ''), isActive: body.isActive },
    req.appUser.id
  );
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ saved: true, category: result.category });
});

router.put('/apps/categories/reorder', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const orderedSlugs = Array.isArray(req.body?.orderedSlugs)
    ? req.body.orderedSlugs.map((s: unknown) => String(s || '').trim()).filter(Boolean)
    : [];
  if (orderedSlugs.length === 0) {
    res.status(400).json({ error: 'orderedSlugs array is required.' });
    return;
  }
  const result = await reorderDynamicCategories(orderedSlugs, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ saved: true });
});

router.put('/apps/categories/:slug', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const slug = String(req.params.slug || '').trim();
  const body = (req.body || {}) as { label?: string; isActive?: boolean; sortOrder?: number };
  const result = await updateDynamicCategory(slug, body, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ saved: true, category: result.category });
});

router.delete('/apps/categories/:slug', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const slug = String(req.params.slug || '').trim();
  const result = await deleteDynamicCategory(slug, req.appUser.id);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ deleted: true });
});

router.post('/apps/cache-clear', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  const appSlug =
    typeof req.body?.appSlug === 'string' && req.body.appSlug.trim()
      ? req.body.appSlug.trim()
      : undefined;

  const memoryCleared = clearMiniAppsMemoryCache(appSlug);
  let dbCleared = false;

  if (supabaseAdmin) {
    try {
      const query = appSlug
        ? supabaseAdmin.from('app_cache').delete().eq('app_slug', appSlug)
        : supabaseAdmin.from('app_cache').delete().neq('app_slug', '__never__');
      const { error } = await query;
      if (!error) dbCleared = true;
    } catch {
      // Non-fatal if migration 007 hasn't run yet
    }
  }

  res.json({
    cleared: true,
    appSlug: appSlug || 'all',
    memoryCleared,
    dbCleared,
  });
});

// 13. Platform Health & Cache Controls (Verifies Migrations 004, 005, 006, 007)
router.get('/platform/health', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  const runtime = await getResolvedOpenRouterRuntime();

  const hasPublicUrl = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasPublicAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

  const checkTable = async (tableName: string, columns = 'id'): Promise<boolean> => {
    if (!supabaseAdmin) return false;
    const { error } = await supabaseAdmin.from(tableName).select(columns).limit(1);
    return !error;
  };

  const [
    hasUsers,
    hasProfiles,
    hasPrompts,
    hasPlatformSettings,
    hasPromptRecipes,
    hasSupportTickets,
    hasMigration005Profiles,
    hasMigration005Messages,
    hasMigration006Conversations,
    hasAppCache,
    hasAppUsageLogs,
    hasUserFavoriteApps,
    hasPipelineLogs,
    hasCompanionsTable,
    hasCompanionBondsTable,
    hasCustomCompanionsTable,
    hasMiniAppCategoriesTable,
    hasMiniAppsTable,
    hasMigration017Companions,
    hasMigration017MiniApps,
  ] = await Promise.all([
    checkTable('users'),
    checkTable('profiles'),
    checkTable('system_prompts'),
    checkTable('platform_settings', 'key'),
    checkTable('prompt_recipes'),
    checkTable('support_tickets'),
    checkTable('profiles', 'id, current_city'),
    checkTable('messages', 'id, suggestions_json'),
    checkTable('conversations', 'id, pillar, is_active_tab, companion_persona_json'),
    checkTable('app_cache'),
    checkTable('app_usage_logs'),
    checkTable('user_favorite_apps', 'user_id, app_slug'),
    isPipelineLogsTableReady(),
    checkTable('companions'),
    checkTable('companion_bonds'),
    checkTable('user_custom_companions'),
    checkTable('mini_app_categories', 'slug'),
    checkTable('mini_apps', 'slug'),
    checkTable('companions', 'id, backstory, soul_consciousness'),
    checkTable('mini_apps', 'slug, rules_json'),
  ]);

  const migration004Ready = hasPlatformSettings && hasPromptRecipes && hasSupportTickets;
  const migration005Ready = hasMigration005Profiles && hasMigration005Messages;
  const migration006Ready = hasMigration006Conversations;
  const migration007Ready = hasAppCache && hasAppUsageLogs && hasUserFavoriteApps;
  const migration012Ready = hasPipelineLogs;
  const migration015Ready = hasCompanionsTable && hasCompanionBondsTable && hasCustomCompanionsTable;
  const migration016Ready = hasMiniAppCategoriesTable && hasMiniAppsTable;
  const migration017Ready = hasMigration017Companions && hasMigration017MiniApps;

  res.json({
    integrations: {
      supabaseServer: isSupabaseServerConfigured(),
      supabaseClient: hasPublicUrl && hasPublicAnon,
      openrouter: Boolean(runtime.apiKey),
      openrouterSource: runtime.keySource,
      openrouterMaskedKey: runtime.maskedKey,
      consultationModel: runtime.consultationModel,
      utilityModel: runtime.utilityModel,
      freeAstrologyApi: isAstrologyApiConfigured(),
      dodoPayments: Boolean(process.env.DODO_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      sanityBlog: isSanityConfigured(),
    },
    tables: {
      users: hasUsers,
      profiles: hasProfiles,
      system_prompts: hasPrompts,
      platform_settings: hasPlatformSettings,
      prompt_recipes: hasPromptRecipes,
      support_tickets: hasSupportTickets,
      migration_005_columns: migration005Ready,
      migration_006_columns: migration006Ready,
      app_cache: hasAppCache,
      app_usage_logs: hasAppUsageLogs,
      user_favorite_apps: hasUserFavoriteApps,
      chatbot_pipeline_logs: hasPipelineLogs,
      companions: hasCompanionsTable,
      companion_bonds: hasCompanionBondsTable,
      user_custom_companions: hasCustomCompanionsTable,
      mini_app_categories: hasMiniAppCategoriesTable,
      mini_apps: hasMiniAppsTable,
      migration_017_columns: migration017Ready,
    },
    migration004Ready,
    migration005Ready,
    migration006Ready,
    migration007Ready,
    migration012Ready,
    migration015Ready,
    migration016Ready,
    migration017Ready,
    timestamp: new Date().toISOString(),
  });
});

// 14. Chatbot Pipeline Diagnostics & Execution Logs
router.get('/chatbot-logs', async (req: AuthenticatedRequest, res) => {
  const limitRaw = Number(req.query.limit || 60);
  const actionFilter = typeof req.query.action === 'string' ? req.query.action : 'all';
  const [ai, result] = await Promise.all([
    getAiSettings(),
    getChatbotPipelineLogs({
      limit: Number.isFinite(limitRaw) ? limitRaw : 60,
      actionFilter,
    }),
  ]);
  res.json({
    enabled: Boolean(ai.chatbot_pipeline_logging_enabled),
    jevClassifierEnabled: Boolean(ai.jev_classifier_enabled),
    jevModel: ai.jev_model,
    logs: result.logs,
    storage: result.storage,
    tableMissing: result.tableMissing,
    schemaCacheStale: result.schemaCacheStale,
    schemaErrorDetail: result.schemaErrorDetail,
  });
});

router.post('/chatbot-logs/toggle', async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled (boolean) is required.' });
    return;
  }
  const current = await getAiSettings();
  const saved = await savePlatformSetting(
    'ai_config',
    {
      ...current,
      chatbot_pipeline_logging_enabled: enabled,
    },
    req.appUser.id
  );
  if (!saved.ok) {
    res.status(400).json({ error: saved.error || 'Failed to update pipeline logging toggle.' });
    return;
  }
  res.json({ enabled });
});

router.delete('/chatbot-logs', async (_req: AuthenticatedRequest, res) => {
  const result = await clearChatbotPipelineLogs();
  res.json({ cleared: true, ...result });
});

router.post('/platform/cache-flush', async (_req: AuthenticatedRequest, res) => {
  invalidatePromptCache();
  invalidateAllPlatformCaches();
  invalidateCompanionsCache();
  const miniAppsMemoryCleared = clearMiniAppsMemoryCache();
  res.json({ flushed: true, miniAppsMemoryCleared, timestamp: new Date().toISOString() });
});

// 15. Companions Manager (Full CRUD, DP Upload, Ordering, Portrait Library & Defaults Reset)
router.post('/companions/upload-dp', async (req: AuthenticatedRequest, res) => {
  const rawDataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : '';
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(rawDataUrl);
  if (!match) {
    res.status(400).json({ error: 'Portrait must be a PNG, JPEG, or WebP image.' });
    return;
  }

  const mimeSubtype = match[1].toLowerCase();
  const base64Body = match[2];
  let buf: Buffer;
  try {
    buf = Buffer.from(base64Body, 'base64');
  } catch {
    res.status(400).json({ error: 'Invalid image encoding.' });
    return;
  }

  if (buf.length === 0 || buf.length > 250 * 1024) {
    res.status(400).json({ error: 'Portrait image must be under 250KB.' });
    return;
  }

  const isPng =
    mimeSubtype === 'png' &&
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  const isJpeg =
    mimeSubtype === 'jpeg' &&
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff;
  const isWebp =
    mimeSubtype === 'webp' &&
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    res.status(400).json({ error: 'Uploaded file signature does not match PNG, JPEG, or WebP.' });
    return;
  }

  const normalizedUrl = `data:image/${mimeSubtype};base64,${buf.toString('base64')}`;
  res.status(201).json({ avatar_url: normalizedUrl });
});

router.get('/companions', async (_req: AuthenticatedRequest, res) => {
  try {
    const [companions, tableReady, specializations, migration022Status] = await Promise.all([
      getAdminCompanionsList(),
      isCompanionsTableReady(),
      getCompanionSpecializations(),
      getMigration022Status(),
    ]);
    res.json({
      companions: companions.map(toAdminCompanionRosterSummary),
      specializations,
      formulaCartridges: getFormulaCartridgesCatalogSummary(),
      migration022Status,
      tableReady,
      defaultSlugs: DEFAULT_COMPANION_PRESETS.map((p) => p.slug),
      availablePortraits: COMPANION_PORTRAIT_GALLERY,
      monogramPalettes: COMPANION_MONOGRAM_PALETTES,
      benchmarkCompanion: {
        slug: ASTRA_MOON_BENCHMARK_SLUG,
        name: 'Astra Moon (Benchmark)',
        primary_expertise: 'Modern Astrologer',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load companions' });
  }
});

// Static V2 governance, specialization taxonomy & bulk/global JSON endpoints
// IMPORTANT: Must remain registered BEFORE parameterized /companions/:id or /companions/:slug routes.

router.get('/companions/specializations', async (_req: AuthenticatedRequest, res) => {
  try {
    const specializations = await getCompanionSpecializations();
    res.json({ specializations });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Failed to load specializations' });
  }
});

router.put('/companions/specializations', async (req: AuthenticatedRequest, res) => {
  const rawList = Array.isArray(req.body?.specializations) ? req.body.specializations : req.body;
  const result = await saveCompanionSpecializations(rawList, req.appUser?.id || null);
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Failed to save specializations' });
    return;
  }
  res.json({ ok: true, specializations: result.specializations });
});

router.get('/companions/templates', (_req: AuthenticatedRequest, res) => {
  res.json(getBlankV2Templates());
});

router.get('/companions/export/bulk', async (req: AuthenticatedRequest, res) => {
  try {
    const stage = req.query.stage === 'draft' ? 'draft' : 'published';
    const bundle = await exportBulkCompanionsBundle(stage);
    res.json(bundle);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Failed to export bulk companions' });
  }
});

router.post('/companions/import/bulk', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const rawBundle = body.bundle !== undefined ? body.bundle : req.body;
  const mode = body.mode === 'publish' ? 'publish' : 'draft';
  const dryRun = Boolean(body.dryRun);
  const confirmCoreIdentityChange = Boolean(
    body.confirmCoreIdentityChange || body.unlockCoreIdentity
  );
  const result = await importBulkCompanionsBundle(rawBundle, {
    mode,
    dryRun,
    confirmCoreIdentityChange,
    unlockCoreIdentity: confirmCoreIdentityChange,
    adminUserId: req.appUser?.id || null,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Bulk companion import failed' });
    return;
  }
  res.json(result);
});

router.get('/companions/export/global', async (_req: AuthenticatedRequest, res) => {
  try {
    const bundle = await exportGlobalCompanionBundle();
    res.json(bundle);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Failed to export global config' });
  }
});

router.post('/companions/import/global', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const rawBundle = body.bundle !== undefined ? body.bundle : req.body;
  const dryRun = Boolean(body.dryRun);
  const result = await importGlobalCompanionBundle(rawBundle, req.appUser?.id || null, { dryRun });
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Global companion config import failed' });
    return;
  }
  res.json(result);
});

router.post('/companions/test-turn', async (req: AuthenticatedRequest, res) => {
  try {
    const rawBody =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? stripUnsafeJsonKeys(req.body as Record<string, unknown>)
        : {};

    const slug = typeof rawBody.slug === 'string' ? rawBody.slug.trim() : '';
    if (!slug) {
      res.status(400).json({ error: 'Select a companion slug to test.' });
      return;
    }

    const targetStage = rawBody.targetStage === 'published' ? 'published' : 'draft';
    const messages = Array.isArray(rawBody.messages)
      ? (rawBody.messages as Array<{ role: 'user' | 'assistant'; content: string }>)
      : [];

    const draftOverride =
      rawBody.draftOverride &&
      typeof rawBody.draftOverride === 'object' &&
      !Array.isArray(rawBody.draftOverride)
        ? stripUnsafeJsonKeys(rawBody.draftOverride as Record<string, unknown>)
        : null;

    const simulation =
      rawBody.simulation &&
      typeof rawBody.simulation === 'object' &&
      !Array.isArray(rawBody.simulation)
        ? stripUnsafeJsonKeys(rawBody.simulation as Record<string, unknown>)
        : undefined;

    const compareWithStageOrSlug =
      typeof rawBody.compareWithStageOrSlug === 'string'
        ? rawBody.compareWithStageOrSlug.trim()
        : rawBody.compareWithStageOrSlug &&
          typeof rawBody.compareWithStageOrSlug === 'object' &&
          !Array.isArray(rawBody.compareWithStageOrSlug)
        ? stripUnsafeJsonKeys(rawBody.compareWithStageOrSlug as Record<string, unknown>)
        : null;

    const runLiveModel = rawBody.runLiveModel !== false;

    const result = await executeAdminCompanionTestTurn({
      slug,
      targetStage,
      draftOverride,
      messages,
      simulation: simulation as Parameters<typeof executeAdminCompanionTestTurn>[0]['simulation'],
      compareWithStageOrSlug: compareWithStageOrSlug as Parameters<
        typeof executeAdminCompanionTestTurn
      >[0]['compareWithStageOrSlug'],
      runLiveModel,
    });

    if (!result.ok) {
      res.status('status' in result ? result.status : 400).json({
        error: 'error' in result ? result.error : 'Test turn failed',
      });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Companion test turn failed',
    });
  }
});

router.post('/companions', async (req: AuthenticatedRequest, res) => {
  const result = await upsertAdminCompanion((req.body || {}) as Record<string, unknown>, {
    isNew: true,
  });
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error || 'Failed to create companion' });
    return;
  }
  res.status(201).json({ companion: result.companion });
});

router.patch('/companions/reorder', async (req: AuthenticatedRequest, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.map(String)
    : [];
  const result = await reorderAdminCompanions(orderedIds);
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Failed to reorder companions' });
    return;
  }
  res.json({ reordered: true });
});

router.get('/companions/:slug/v2', async (req: AuthenticatedRequest, res) => {
  const result = await getCompanionV2EditorState(String(req.params.slug || ''));
  if (!result.ok) {
    res.status('status' in result ? result.status : 404).json({
      error: 'error' in result ? result.error : 'Companion not found',
    });
    return;
  }
  res.json(result.state);
});

router.put('/companions/:slug/draft', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const payload =
    body.draft && typeof body.draft === 'object' && !Array.isArray(body.draft)
      ? (body.draft as Record<string, unknown>)
      : body;
  const unlockCoreIdentity = Boolean(
    body.unlockCoreIdentity || body.confirmCoreIdentityChange
  );
  const enforceCoreLock = body.enforceCoreLock === false ? false : true;

  const result = await saveCompanionDraft(
    String(req.params.slug || ''),
    payload,
    req.appUser?.id || null,
    {
      enforceCoreLock,
      confirmCoreIdentityChange: unlockCoreIdentity,
      unlockCoreIdentity,
    }
  );
  if (!result.ok) {
    res.status(result.status || 400).json({
      error: result.error || 'Failed to save draft',
      ...(result.code ? { code: result.code } : {}),
      ...(result.protectedChanges ? { protectedChanges: result.protectedChanges } : {}),
    });
    return;
  }
  res.json({ ok: true, companion: result.companion, state: result.state });
});

router.post('/companions/:slug/publish', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const draftInput =
    body.draft && typeof body.draft === 'object' && !Array.isArray(body.draft)
      ? (body.draft as Record<string, unknown>)
      : undefined;
  const changeNote = typeof body.changeNote === 'string' ? body.changeNote : undefined;
  const unlockCoreIdentity = Boolean(
    body.unlockCoreIdentity || body.confirmCoreIdentityChange
  );

  const result = await publishCompanionDraft(String(req.params.slug || ''), {
    draftInput,
    changeNote,
    confirmCoreIdentityChange: unlockCoreIdentity,
    unlockCoreIdentity,
    adminUserId: req.appUser?.id || null,
  });
  if (!result.ok) {
    res.status(result.status || 400).json({
      error: result.error || 'Failed to publish companion',
      ...(result.code ? { code: result.code } : {}),
      ...(result.protectedChanges ? { protectedChanges: result.protectedChanges } : {}),
    });
    return;
  }
  res.json({ ok: true, companion: result.companion, state: result.state });
});

router.post('/companions/:slug/discard-draft', async (req: AuthenticatedRequest, res) => {
  const result = await discardCompanionDraft(String(req.params.slug || ''));
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error || 'Failed to discard draft' });
    return;
  }
  res.json({ ok: true, companion: result.companion, state: result.state });
});

router.get('/companions/:slug/versions', async (req: AuthenticatedRequest, res) => {
  const result = await listCompanionVersions(String(req.params.slug || ''));
  if (!result.ok) {
    res.status(404).json({ error: result.error || 'Companion not found' });
    return;
  }
  res.json(result);
});

router.post('/companions/:slug/rollback', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const versionId = typeof body.versionId === 'string' ? body.versionId : undefined;
  const versionNumber =
    typeof body.versionNumber === 'number' && Number.isFinite(body.versionNumber)
      ? body.versionNumber
      : undefined;
  if (!versionId && versionNumber === undefined) {
    res.status(400).json({ error: 'Provide versionId or versionNumber to roll back.' });
    return;
  }
  const targetStage = body.targetStage === 'publish' ? 'publish' : 'draft';
  const unlockCoreIdentity = Boolean(
    body.unlockCoreIdentity || body.confirmCoreIdentityChange
  );
  const changeNote = typeof body.changeNote === 'string' ? body.changeNote : undefined;

  const result = await rollbackCompanionToVersion(
    String(req.params.slug || ''),
    { versionId, versionNumber },
    {
      targetStage,
      confirmCoreIdentityChange: unlockCoreIdentity,
      unlockCoreIdentity,
      changeNote,
      adminUserId: req.appUser?.id || null,
    }
  );
  if (!result.ok) {
    res.status(result.status || 400).json({
      error: result.error || 'Failed to rollback companion',
      ...(result.code ? { code: result.code } : {}),
      ...(result.protectedChanges ? { protectedChanges: result.protectedChanges } : {}),
    });
    return;
  }
  res.json({
    ok: true,
    companion: result.companion,
    state: result.state,
    restoredVersion: result.restoredVersion,
  });
});

router.post('/companions/:slug/capsule/compile', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const overrides =
    body.draft && typeof body.draft === 'object' && !Array.isArray(body.draft)
      ? (body.draft as Record<string, unknown>)
      : body;
  const useAi = Boolean(body.useAi);
  const result = await compileCompanionCapsule(String(req.params.slug || ''), overrides, {
    useAi,
  });
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error || 'Failed to compile capsule' });
    return;
  }
  res.json(result);
});

router.get('/companions/:slug/export', async (req: AuthenticatedRequest, res) => {
  const stage = req.query.stage === 'draft' ? 'draft' : 'published';
  const result = await exportSingleCompanionBundle(String(req.params.slug || ''), stage);
  if (!result.ok || !result.bundle) {
    res.status(404).json({ error: result.error || 'Companion not found' });
    return;
  }
  res.json(result.bundle);
});

router.post('/companions/:slug/import', async (req: AuthenticatedRequest, res) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const rawBundle = body.bundle !== undefined ? body.bundle : req.body;
  const mode = body.mode === 'publish' ? 'publish' : 'draft';
  const dryRun = Boolean(body.dryRun);
  const unlockCoreIdentity = Boolean(
    body.unlockCoreIdentity || body.confirmCoreIdentityChange
  );
  const targetSlug = String(req.params.slug || '').trim();
  const result = await importSingleCompanionBundle(rawBundle, {
    mode,
    targetId: targetSlug === '__new__' ? undefined : targetSlug,
    dryRun,
    confirmCoreIdentityChange: unlockCoreIdentity,
    unlockCoreIdentity,
    adminUserId: req.appUser?.id || null,
  });
  if (!result.ok) {
    res.status(result.status || 400).json({
      error: result.error || 'Failed to import companion JSON',
      ...(result.code ? { code: result.code } : {}),
      ...(result.protectedChanges ? { protectedChanges: result.protectedChanges } : {}),
    });
    return;
  }
  res.json(result);
});

router.put('/companions/:id', async (req: AuthenticatedRequest, res) => {
  const result = await upsertAdminCompanion((req.body || {}) as Record<string, unknown>, {
    isNew: false,
    targetId: String(req.params.id || ''),
  });
  if (!result.ok) {
    res.status(result.status || 400).json({
      error: result.error || 'Failed to update companion',
      ...(result.code ? { code: result.code } : {}),
      ...(result.protectedChanges ? { protectedChanges: result.protectedChanges } : {}),
    });
    return;
  }
  res.json({ companion: result.companion });
});

router.post('/companions/:slug/reset', async (req: AuthenticatedRequest, res) => {
  const result = await resetAdminCompanionToDefault(String(req.params.slug || ''));
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error || 'Failed to reset companion' });
    return;
  }
  res.json({ companion: result.companion });
});

router.delete('/companions/:id', async (req: AuthenticatedRequest, res) => {
  const result = await deleteAdminCompanion(String(req.params.id || ''));
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error || 'Failed to delete companion' });
    return;
  }
  res.json({ deleted: true });
});

export default router;
