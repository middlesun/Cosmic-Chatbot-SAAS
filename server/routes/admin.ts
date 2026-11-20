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
  invalidatePromptCache,
} from '../services/promptDefaults';
import {
  BUILTIN_MODEL_SUGGESTIONS,
  DEFAULT_CONVERSATIONAL_RULES,
  encryptSecret,
  getAiSettings,
  getChatbotConfig,
  getPricingConfig,
  getPromptRecipes,
  getResolvedOpenRouterRuntime,
  invalidateAllPlatformCaches,
  invalidateRecipesCache,
  savePlatformSetting,
  type PromptRecipeStep,
} from '../services/platformSettings';
import { ensureReportCatalogSeeded } from '../services/reportDefaults';
import { isSanityConfigured } from '../../lib/sanity';

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

    const existingSlugs = new Set((existing || []).map((r) => r.slug));
    const missing = ALL_DEFAULT_PROMPTS.filter((p) => !existingSlugs.has(p.slug));

    if (missing.length > 0) {
      const withSubRes = await supabaseAdmin.from('system_prompts').insert(
        missing.map((p) => ({
          slug: p.slug,
          category: p.category,
          display_name: p.display_name,
          subtitle: p.subtitle,
          prompt_body: p.prompt_body,
          version: 1,
          previous_versions: [],
          is_active: true,
        }))
      );

      if (withSubRes.error && isMissingColumnError(withSubRes.error)) {
        await supabaseAdmin.from('system_prompts').insert(
          missing.map((p) => ({
            slug: p.slug,
            category: p.category,
            display_name: p.display_name,
            prompt_body: p.prompt_body,
            version: 1,
            previous_versions: [],
            is_active: true,
          }))
        );
      }
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

  const [runtime, openTicketsRes] = await Promise.all([
    getResolvedOpenRouterRuntime(),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved')
      .then((r) => (r.error ? { count: 0 } : r)),
  ]);

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
      tierBreakdown,
      revenueByCurrency,
    },
    aiRuntime: {
      consultationModel: runtime.consultationModel,
      utilityModel: runtime.utilityModel,
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
router.get('/prompts', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  await ensureDefaultPromptsSeeded();

  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .order('category', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Failed to load system prompts' });
    return;
  }

  res.json({ prompts: data || [] });
});

router.post('/prompts', async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { slug, category, display_name, subtitle, description, prompt_body, model_id, tags, sort_order } =
    req.body || {};
  const validCategories = [
    'system',
    'expert',
    'analysis',
    'modifier',
    'mode',
    'output',
    'language',
    'tool',
    'report_step',
    'learn',
  ];

  if (!slug?.trim() || !validCategories.includes(category) || !display_name?.trim() || !prompt_body?.trim()) {
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
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 15)
    : [];
  const normalizedSortOrder =
    typeof sort_order === 'number' && Number.isFinite(sort_order) ? Math.round(sort_order) : 100;

  let insertRes = await supabaseAdmin
    .from('system_prompts')
    .insert({
      slug: normalizedSlug,
      category,
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

  if (insertRes.error && isMissingColumnError(insertRes.error)) {
    insertRes = await supabaseAdmin
      .from('system_prompts')
      .insert({
        slug: normalizedSlug,
        category,
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

  if (insertRes.error && isMissingColumnError(insertRes.error)) {
    insertRes = await supabaseAdmin
      .from('system_prompts')
      .insert({
        slug: normalizedSlug,
        category,
        display_name: display_name.trim(),
        prompt_body: prompt_body.trim(),
        version: 1,
        previous_versions: [],
        is_active: true,
      })
      .select('*')
      .single();
  }

  if (insertRes.error || !insertRes.data) {
    const errMsg = insertRes.error?.message || 'Could not create prompt';
    if (errMsg.includes('system_prompts_category_check') || errMsg.includes('check constraint')) {
      res.status(400).json({
        error:
          'New prompt categories require running supabase/migrations/004_admin_console_and_recipes.sql in Supabase SQL Editor first.',
      });
      return;
    }
    res.status(400).json({ error: errMsg });
    return;
  }

  invalidatePromptCache();
  res.status(201).json({ prompt: insertRes.data });
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
  const validCategories = [
    'system',
    'expert',
    'analysis',
    'modifier',
    'mode',
    'output',
    'language',
    'tool',
    'report_step',
    'learn',
  ];
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

  const basePayload: Record<string, unknown> = {
    ...(typeof display_name === 'string' && display_name.trim()
      ? { display_name: display_name.trim() }
      : {}),
    ...(typeof category === 'string' && validCategories.includes(category) ? { category } : {}),
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
      ? { tags: tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 15) }
      : {}),
    ...(typeof sort_order === 'number' && Number.isFinite(sort_order)
      ? { sort_order: Math.round(sort_order) }
      : {}),
  };

  let updateRes = await supabaseAdmin
    .from('system_prompts')
    .update(extendedPayload)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (updateRes.error && isMissingColumnError(updateRes.error)) {
    updateRes = await supabaseAdmin
      .from('system_prompts')
      .update(midPayload)
      .eq('id', existing.id)
      .select('*')
      .single();
  }

  if (updateRes.error && isMissingColumnError(updateRes.error)) {
    updateRes = await supabaseAdmin
      .from('system_prompts')
      .update(basePayload)
      .eq('id', existing.id)
      .select('*')
      .single();
  }

  if (updateRes.error || !updateRes.data) {
    res.status(500).json({ error: updateRes.error?.message || 'Failed to update system prompt' });
    return;
  }

  invalidatePromptCache();
  res.json({ prompt: updateRes.data });
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

// 7. AI Settings (OpenRouter API Key Override, Models Registry, Token Limits)
router.get('/settings/ai', async (_req: AuthenticatedRequest, res) => {
  const runtime = await getResolvedOpenRouterRuntime();
  res.json({
    keySource: runtime.keySource,
    maskedKey: runtime.maskedKey,
    hasDatabaseOverride: runtime.hasDatabaseOverride,
    hasEnvKey: runtime.hasEnvKey,
    consultation_model: runtime.consultationModel,
    utility_model: runtime.utilityModel,
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

  const [config, recipes, promptsRes] = await Promise.all([
    getChatbotConfig(),
    getPromptRecipes(),
    supabaseAdmin
      .from('system_prompts')
      .select('id, slug, category, display_name, subtitle, is_active, model_id, sort_order')
      .in('category', ['expert', 'mode', 'learn', 'language', 'output'])
      .order('display_name', { ascending: true }),
  ]);

  let promptRows = promptsRes.data;
  if (promptsRes.error) {
    const fallback = await supabaseAdmin
      .from('system_prompts')
      .select('id, slug, category, display_name, is_active')
      .in('category', ['expert', 'mode', 'learn', 'language', 'output']);
    promptRows = (fallback.data || []).map((r) => ({
      ...r,
      subtitle: null,
      model_id: null,
      sort_order: 100,
    }));
  }

  res.json({
    config,
    defaultConversationalRules: DEFAULT_CONVERSATIONAL_RULES,
    prompts: promptRows || [],
    recipes,
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
        ? body.default_expert.trim()
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
    expert_order: Array.isArray(body.expert_order)
      ? body.expert_order.map(String).filter(Boolean)
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

// 12. Platform Health & Cache Controls
router.get('/platform/health', async (_req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  const runtime = await getResolvedOpenRouterRuntime();

  const hasPublicUrl = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasPublicAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

  const checkTable = async (tableName: string): Promise<boolean> => {
    if (!supabaseAdmin) return false;
    const { error } = await supabaseAdmin.from(tableName).select('*').limit(1);
    return !error;
  };

  const [
    hasUsers,
    hasProfiles,
    hasPrompts,
    hasPlatformSettings,
    hasPromptRecipes,
    hasSupportTickets,
  ] = await Promise.all([
    checkTable('users'),
    checkTable('profiles'),
    checkTable('system_prompts'),
    checkTable('platform_settings'),
    checkTable('prompt_recipes'),
    checkTable('support_tickets'),
  ]);

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
    },
    migration004Ready: hasPlatformSettings && hasPromptRecipes && hasSupportTickets,
    timestamp: new Date().toISOString(),
  });
});

router.post('/platform/cache-flush', async (_req: AuthenticatedRequest, res) => {
  invalidatePromptCache();
  invalidateAllPlatformCaches();
  res.json({ flushed: true, timestamp: new Date().toISOString() });
});

export default router;
