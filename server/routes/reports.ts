import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { isGeminiConfigured } from '../services/geminiOrchestrator';
import { generateReportPdfBuffer } from '../services/pdfGenerator';
import { ensureReportCatalogSeeded } from '../services/reportDefaults';
import { enqueueReportOrder } from '../workers/reportWorker';

const router = Router();

// 1. Report Store Catalog + User's Profiles + User's Orders
router.get('/catalog', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  await ensureReportCatalogSeeded();

  const [{ data: catalogRows, error: catErr }, { data: profiles }, { data: orders }] =
    await Promise.all([
      supabaseAdmin
        .from('report_catalog')
        .select('id, slug, name, category, short_description, long_description, price_credits, prompt_chain_json, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('profiles')
        .select('id, name, birth_date, birth_city, birth_country, is_activated')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('report_orders')
        .select(
          'id, profile_id, report_catalog_id, user_questions, credits_charged, status, progress_step, pdf_url, audio_url, linked_conversation_id, error_message, created_at, completed_at'
        )
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

  if (catErr) {
    res.status(500).json({ error: 'Failed to load Deep Research report catalog' });
    return;
  }

  // Strip internal prompt instructions; expose only safe step titles/count to client
  const safeCatalog = (catalogRows || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    short_description: row.short_description,
    long_description: row.long_description,
    price_credits: row.price_credits,
    pass_count: Array.isArray(row.prompt_chain_json) ? row.prompt_chain_json.length : 4,
    pass_titles: Array.isArray(row.prompt_chain_json)
      ? row.prompt_chain_json.map((s: { title?: string }) => s.title || '').filter(Boolean)
      : [],
  }));

  res.json({
    catalog: safeCatalog,
    profiles: profiles || [],
    orders: orders || [],
    geminiConfigured: isGeminiConfigured(),
  });
});

// 2. Place a Deep Research Report Order
router.post('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!isGeminiConfigured()) {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const { reportCatalogId, profileId, userQuestions } = req.body || {};
  if (!reportCatalogId || !profileId) {
    res.status(400).json({ error: 'Please select both a report and an activated birth profile.' });
    return;
  }

  const [{ data: catalogItem }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('report_catalog')
      .select('id, name, price_credits, is_active')
      .eq('id', reportCatalogId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, name, is_activated')
      .eq('id', profileId)
      .eq('user_id', req.appUser.id)
      .maybeSingle(),
  ]);

  if (!catalogItem) {
    res.status(404).json({ error: 'Selected report was not found.' });
    return;
  }

  if (!profile) {
    res.status(404).json({ error: 'Selected profile was not found.' });
    return;
  }

  if (!profile.is_activated) {
    res.status(400).json({
      error: `Please activate ${profile.name}'s birth chart before ordering a Deep Research Report.`,
      code: 'PROFILE_NOT_ACTIVATED',
    });
    return;
  }

  // Atomically deduct credits first
  const priceCredits = Number(catalogItem.price_credits) || 0;
  if (priceCredits > 0) {
    const { error: deductErr } = await supabaseAdmin.rpc('deduct_user_credits', {
      p_user_id: req.appUser.id,
      p_amount: priceCredits,
      p_tx_type: 'report_order',
      p_reference_id: catalogItem.id,
      p_description: `${catalogItem.name} for ${profile.name}`,
    });

    if (deductErr) {
      res.status(402).json({
        error: deductErr.message || 'Insufficient credits to order this report.',
        requiredCredits: priceCredits,
        availableCredits: req.appUser.credits_balance,
      });
      return;
    }
  }

  const { data: order, error: insertErr } = await supabaseAdmin
    .from('report_orders')
    .insert({
      user_id: req.appUser.id,
      profile_id: profile.id,
      report_catalog_id: catalogItem.id,
      user_questions:
        typeof userQuestions === 'string' && userQuestions.trim()
          ? userQuestions.trim().slice(0, 3000)
          : null,
      credits_charged: priceCredits,
      status: 'queued',
      progress_step: 'Queued for Council sequential synthesis',
    })
    .select('*')
    .single();

  if (insertErr || !order) {
    if (priceCredits > 0) {
      await supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: req.appUser.id,
        p_amount: priceCredits,
        p_tx_type: 'refund',
        p_reference_id: catalogItem.id,
        p_description: `Refund: failed to create report order for ${profile.name}`,
      });
    }
    res.status(500).json({ error: 'Failed to create report order' });
    return;
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  enqueueReportOrder(order.id, origin);

  res.status(201).json({ order });
});

// 3. Poll Detailed Order Status + Live Step Outputs + Final Markdown
router.get('/orders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: order } = await supabaseAdmin
    .from('report_orders')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!order) {
    res.status(404).json({ error: 'Report order not found' });
    return;
  }

  const [{ data: catalogItem }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('report_catalog')
      .select('id, name, category, short_description, prompt_chain_json')
      .eq('id', order.report_catalog_id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, name, birth_date, birth_time, birth_city, birth_country')
      .eq('id', order.profile_id)
      .maybeSingle(),
  ]);

  res.json({
    order,
    reportMeta: catalogItem
      ? {
          id: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          short_description: catalogItem.short_description,
          pass_titles: Array.isArray(catalogItem.prompt_chain_json)
            ? catalogItem.prompt_chain_json.map((s: { title?: string }) => s.title || '')
            : [],
        }
      : null,
    profile: profile || null,
  });
});

// 4. Download Typeset PDF Dossier (from Supabase Storage or cleanly rendered on-demand)
router.get('/orders/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: order } = await supabaseAdmin
    .from('report_orders')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!order) {
    res.status(404).json({ error: 'Report order not found' });
    return;
  }

  if (order.status !== 'completed' || !order.final_markdown) {
    res.status(409).json({ error: 'Report synthesis is not complete yet.' });
    return;
  }

  const [{ data: catalogItem }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('report_catalog')
      .select('name, category')
      .eq('id', order.report_catalog_id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('name, birth_date, birth_time, birth_city, birth_country')
      .eq('id', order.profile_id)
      .maybeSingle(),
  ]);

  const safeFileSlug = (catalogItem?.name || 'cosmic-council-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Try Supabase Storage cached binary first
  const storagePath = `${req.appUser.id}/${order.id}.pdf`;
  const { data: fileBlob } = await supabaseAdmin.storage
    .from('reports')
    .download(storagePath);

  let pdfBuffer: Buffer;
  if (fileBlob) {
    const arr = await fileBlob.arrayBuffer();
    pdfBuffer = Buffer.from(arr);
  } else {
    pdfBuffer = await generateReportPdfBuffer({
      orderId: order.id,
      reportTitle: catalogItem?.name || 'Cosmic Council Deep Research Dossier',
      category: catalogItem?.category || 'Vedic Astrology',
      profileName: profile?.name || 'Seeker',
      birthSummary: profile
        ? `${profile.birth_date} ${profile.birth_time} · ${profile.birth_city}, ${profile.birth_country}`
        : '',
      generatedAt: order.completed_at || order.created_at,
      finalMarkdown: order.final_markdown,
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFileSlug}.pdf"`
  );
  res.send(pdfBuffer);
});

export default router;
