import {
  createOpenRouterCompletion,
  getConsultationModel,
  isOpenRouterConfigured,
} from '../services/openrouter';
import crypto from 'crypto';
import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { sendClientInviteEmail } from '../services/email';
import {
  ALL_DEFAULT_PROMPTS,
  CORE_COUNCIL_CONSTITUTION,
  invalidatePromptCache,
} from '../services/promptDefaults';
import { ensureReportCatalogSeeded } from '../services/reportDefaults';

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

  res.json({
    metrics: {
      totalUsers: totalUsers || 0,
      totalProfiles: totalProfiles || 0,
      activatedProfiles: activatedProfiles || 0,
      totalConversations: totalConversations || 0,
      totalQuestionsAsked: totalMessages || 0,
      totalReportOrders: totalOrders || 0,
      totalCreditsCirculating,
      tierBreakdown,
      revenueByCurrency,
    },
  });
});

// 2. Users Directory with Profile & Question Counts
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
  const [{ data: profileRows }, { data: convoRows }] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from('profiles').select('user_id, is_activated').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabaseAdmin.from('conversations').select('user_id, total_word_count').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileCounts = new Map<string, { total: number; activated: number }>();
  for (const p of profileRows || []) {
    const curr = profileCounts.get(p.user_id) || { total: 0, activated: 0 };
    curr.total += 1;
    if (p.is_activated) curr.activated += 1;
    profileCounts.set(p.user_id, curr);
  }

  const convoCounts = new Map<string, number>();
  for (const c of convoRows || []) {
    convoCounts.set(c.user_id, (convoCounts.get(c.user_id) || 0) + 1);
  }

  const enriched = (users || []).map((u) => ({
    ...u,
    profile_count: profileCounts.get(u.id)?.total || 0,
    activated_profile_count: profileCounts.get(u.id)?.activated || 0,
    conversation_count: convoCounts.get(u.id) || 0,
  }));

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

  const { slug, category, display_name, subtitle, prompt_body, model_id } = req.body || {};
  const validCategories = ['expert', 'mode', 'output', 'language', 'tool', 'report_step', 'learn'];

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
  const normalizedModelId =
    typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null;

  let insertRes = await supabaseAdmin
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
    res.status(400).json({ error: insertRes.error?.message || 'Could not create prompt' });
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

  const { display_name, subtitle, prompt_body, model_id, is_active } = req.body || {};
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
    ...(typeof prompt_body === 'string' ? { prompt_body: prompt_body.trim() } : {}),
    ...(typeof is_active === 'boolean' ? { is_active } : {}),
    version: bodyChanged ? existing.version + 1 : existing.version,
    previous_versions: nextHistory,
    updated_at: new Date().toISOString(),
  };

  const extendedPayload: Record<string, unknown> = {
    ...basePayload,
    ...(subtitle !== undefined
      ? { subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : null }
      : {}),
    ...(model_id !== undefined
      ? { model_id: typeof model_id === 'string' && model_id.trim() ? model_id.trim() : null }
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
      .update(basePayload)
      .eq('id', existing.id)
      .select('*')
      .single();
  }

  if (updateRes.error || !updateRes.data) {
    res.status(500).json({ error: 'Failed to update system prompt' });
    return;
  }

  invalidatePromptCache();
  res.json({ prompt: updateRes.data });
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
  if (!isOpenRouterConfigured()) {
    res.status(503).json({ error: 'OPENROUTER_API_KEY not configured on server' });
    return;
  }

  const { promptBody, testQuestion, chartContext, modelId } = req.body || {};
  if (!String(promptBody || '').trim() || !String(testQuestion || '').trim()) {
    res.status(400).json({ error: 'Draft prompt body and test question are required.' });
    return;
  }

  const targetModel =
    typeof modelId === 'string' && modelId.trim() ? modelId.trim() : getConsultationModel();

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
      ? prompt_chain_json.map((step: { title?: string; instruction?: string }, idx: number) => ({
          stepNumber: idx + 1,
          title: String(step?.title || `Pass ${idx + 1}`).trim(),
          instruction: String(step?.instruction || '').trim(),
        }))
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
      (step: { title?: string; instruction?: string }, idx: number) => ({
        stepNumber: idx + 1,
        title: String(step?.title || `Pass ${idx + 1}`).trim(),
        instruction: String(step?.instruction || '').trim(),
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

export default router;
