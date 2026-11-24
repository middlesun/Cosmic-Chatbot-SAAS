import {
  DEFAULT_COMPANION_PERSONALITY_V2,
  DEFAULT_COMPANION_SPECIALIZATIONS,
  detectCoreIdentityChanges,
  normalizePersonalityV2,
  sanitizeSpecializationSlugs,
  sanitizeSpecializationTags,
  type CompanionBulkExportBundle,
  type CompanionExportBundle,
  type CompanionSpecializationTag,
  type CompanionVersionRecord,
  type CoreIdentityProtectedDiff,
  type GlobalCompanionIntelligenceBundle,
} from '../../lib/companionV2Schema';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  getAllCompanionsServerCached,
  invalidateCompanionsCache,
  isCompanionsTableReady,
  isMissing022ColumnError,
  readCompanionV2Overlay,
  saveCompanionV2OverlayEntry,
  upsertAdminCompanion,
  type AdminCompanionMutationResult,
  type CompanionPresetRecord,
} from './companionPresets';
import {
  DEFAULT_COMPANION_ARCHETYPES,
  DEFAULT_COMPANION_BOND_EXTRACTOR_PROMPT,
  DEFAULT_COMPANION_CHART_PRESENCE_PROMPT,
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_EMPATHY_FIRST_GUARDRAIL,
  DEFAULT_COMPANION_GROUP_CONFIGS,
  DEFAULT_COMPANION_LISTEN_ONLY_GUARDRAIL,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
  DEFAULT_COMPANION_REALISM_BASELINE,
  DEFAULT_COMPANION_RETURN_GREETING_PROMPT,
  DEFAULT_COMPANION_SKILL_RULES,
} from './enginePromptDefaults';
import {
  getEnginePromptOverrides,
  invalidateAllPlatformCaches,
  savePlatformSetting,
  type EnginePromptOverrides,
} from './platformSettings';

export interface Migration022Status {
  columnsReady: boolean;
  versionsTableReady: boolean;
}

export async function getMigration022Status(): Promise<Migration022Status> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { columnsReady: false, versionsTableReady: false };

  const [colRes, verRes] = await Promise.all([
    supabaseAdmin.from('companions').select('id, personality_v2_json, draft_payload_json').limit(1),
    supabaseAdmin.from('companion_versions').select('id').limit(1),
  ]);

  return {
    columnsReady: !colRes.error,
    versionsTableReady: !verRes.error,
  };
}

export async function getCompanionSpecializations(): Promise<CompanionSpecializationTag[]> {
  const overrides = await getEnginePromptOverrides();
  if (Array.isArray(overrides.companion_specializations) && overrides.companion_specializations.length > 0) {
    return sanitizeSpecializationTags(overrides.companion_specializations);
  }
  return DEFAULT_COMPANION_SPECIALIZATIONS;
}

export async function saveCompanionSpecializations(
  rawTags: unknown,
  adminUserId?: string | null
): Promise<{ ok: boolean; specializations?: CompanionSpecializationTag[]; error?: string }> {
  const sanitized = sanitizeSpecializationTags(rawTags);
  if (sanitized.length === 0) {
    return { ok: false, error: 'Provide at least one valid specialization tag.' };
  }
  const current = await getEnginePromptOverrides();
  const next: EnginePromptOverrides = {
    ...current,
    companion_specializations: sanitized,
  };
  const saved = await savePlatformSetting('engine_prompt_overrides', next, adminUserId);
  if (!saved.ok) {
    return { ok: false, error: saved.error || 'Failed to save specialization taxonomy.' };
  }
  invalidateAllPlatformCaches();
  return { ok: true, specializations: sanitized };
}

export async function findAdminCompanionByIdOrSlug(
  idOrSlug: string
): Promise<CompanionPresetRecord | null> {
  const target = idOrSlug.trim().toLowerCase();
  if (!target) return null;
  const all = await getAllCompanionsServerCached();
  return (
    all.find(
      (c) =>
        c.id.toLowerCase() === target ||
        c.slug.toLowerCase() === target ||
        (target.startsWith('preset_') && c.slug.toLowerCase() === target.replace(/^preset_/, ''))
    ) || null
  );
}

export function buildCompanionSnapshot(record: CompanionPresetRecord): Record<string, unknown> {
  return {
    slug: record.slug,
    legacy_id: record.legacy_id ?? null,
    name: record.name,
    age: record.age,
    sex: record.sex,
    tagline: record.tagline,
    card_subtitle: record.card_subtitle || '',
    short_bio: record.short_bio,
    full_bio: record.full_bio,
    how_conversations_feel: record.how_conversations_feel || '',
    primary_expertise: record.primary_expertise,
    secondary_expertise: [...(record.secondary_expertise || [])],
    category_tag: record.category_tag,
    companion_group: record.companion_group || 'everyday_companions',
    advisory_mode: record.advisory_mode || 'friend',
    chart_access: record.chart_access || undefined,
    formula_cartridge_slugs: [...(record.formula_cartridge_slugs || [])],
    max_output_tokens: record.max_output_tokens ?? null,
    discoverable_tags: [...(record.discoverable_tags || record.situation_tags || [])],
    situation_tags: [...(record.situation_tags || record.discoverable_tags || [])],
    specialization_slugs: [...(record.specialization_slugs || [])],
    gender_variants: record.gender_variants || {},
    override_group_rules: Boolean(record.override_group_rules),
    cultural_fluency: record.cultural_fluency,
    avatar_url: record.avatar_url,
    monogram_palette: record.monogram_palette,
    welcome_messages: [...(record.welcome_messages || [])],
    system_prompt: record.system_prompt,
    backstory: record.backstory,
    soul_consciousness: record.soul_consciousness,
    hard_rules: record.hard_rules,
    soft_rules: record.soft_rules,
    autonomy_level: record.autonomy_level,
    override_global_rules: record.override_global_rules,
    skill_level: record.skill_level,
    chat_style: record.chat_style,
    model_id: record.model_id,
    tts_voice_profile: record.tts_voice_profile,
    supports_listening_cue: record.supports_listening_cue,
    suggestions_enabled: record.suggestions_enabled,
    is_active: record.is_active,
    sort_order: record.sort_order,
    personality_v2_json: normalizePersonalityV2(
      record.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
    ),
  };
}

function sanitizeDraftPayload(
  base: CompanionPresetRecord,
  input: Record<string, unknown>
): Record<string, unknown> {
  const baseSnapshot = buildCompanionSnapshot(base);
  const next: Record<string, unknown> = { ...baseSnapshot };

  const copyString = (key: string, maxLen: number) => {
    if (typeof input[key] === 'string') {
      next[key] = (input[key] as string).trim().slice(0, maxLen);
    }
  };

  copyString('name', 80);
  if (typeof input.slug === 'string' && input.slug.trim()) {
    next.slug = input.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
  }
  if (typeof input.age === 'number' && Number.isFinite(input.age)) {
    next.age = Math.max(18, Math.min(95, Math.round(input.age)));
  }
  if (input.sex === 'M' || input.sex === 'F' || input.sex === 'NB') {
    next.sex = input.sex;
  }
  copyString('tagline', 240);
  copyString('card_subtitle', 180);
  copyString('short_bio', 600);
  copyString('full_bio', 4000);
  copyString('how_conversations_feel', 2000);
  copyString('primary_expertise', 80);
  copyString('cultural_fluency', 160);
  copyString('system_prompt', 25000);
  copyString('backstory', 8000);
  copyString('soul_consciousness', 8000);
  copyString('hard_rules', 8000);
  copyString('soft_rules', 8000);

  if (Array.isArray(input.secondary_expertise)) {
    next.secondary_expertise = input.secondary_expertise
      .map((s) => String(s || '').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 8);
  }
  if (Array.isArray(input.welcome_messages)) {
    next.welcome_messages = input.welcome_messages
      .map((s) => String(s || '').trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Array.isArray(input.situation_tags) || Array.isArray(input.discoverable_tags)) {
    const rawTags = Array.isArray(input.discoverable_tags)
      ? input.discoverable_tags
      : (input.situation_tags as unknown[]);
    const cleaned = rawTags
      .map((t) => String(t || '').trim().toLowerCase().slice(0, 48))
      .filter(Boolean)
      .slice(0, 16);
    next.situation_tags = cleaned;
    next.discoverable_tags = cleaned;
  }
  if (Array.isArray(input.specialization_slugs)) {
    next.specialization_slugs = sanitizeSpecializationSlugs(input.specialization_slugs);
  }
  if (typeof input.category_tag === 'string') next.category_tag = input.category_tag;
  if (typeof input.companion_group === 'string') next.companion_group = input.companion_group;
  if (typeof input.advisory_mode === 'string') next.advisory_mode = input.advisory_mode;
  if (typeof input.autonomy_level === 'string') next.autonomy_level = input.autonomy_level;
  if (typeof input.skill_level === 'string') next.skill_level = input.skill_level;
  if (typeof input.chat_style === 'string') next.chat_style = input.chat_style;
  if (input.model_id === null || typeof input.model_id === 'string') {
    next.model_id = typeof input.model_id === 'string' && input.model_id.trim()
      ? input.model_id.trim().slice(0, 160)
      : null;
  }
  if (input.avatar_url === null || typeof input.avatar_url === 'string') {
    next.avatar_url = input.avatar_url;
  }
  if (input.monogram_palette && typeof input.monogram_palette === 'object') {
    next.monogram_palette = input.monogram_palette;
  }
  if (input.tts_voice_profile && typeof input.tts_voice_profile === 'object') {
    next.tts_voice_profile = input.tts_voice_profile;
  }
  if (input.chart_access && typeof input.chart_access === 'object') {
    next.chart_access = input.chart_access;
  }
  if (Array.isArray(input.formula_cartridge_slugs)) {
    next.formula_cartridge_slugs = input.formula_cartridge_slugs;
  }
  if (input.max_output_tokens === null || typeof input.max_output_tokens === 'number') {
    next.max_output_tokens = input.max_output_tokens;
  }
  if (typeof input.override_global_rules === 'boolean') {
    next.override_global_rules = input.override_global_rules;
  }
  if (typeof input.override_group_rules === 'boolean') {
    next.override_group_rules = input.override_group_rules;
  }
  if (typeof input.supports_listening_cue === 'boolean') {
    next.supports_listening_cue = input.supports_listening_cue;
  }
  if (typeof input.suggestions_enabled === 'boolean') {
    next.suggestions_enabled = input.suggestions_enabled;
  }
  if (typeof input.is_active === 'boolean') {
    next.is_active = input.is_active;
  }
  if (typeof input.sort_order === 'number' && Number.isFinite(input.sort_order)) {
    next.sort_order = Math.max(0, Math.min(99999, Math.round(input.sort_order)));
  }
  if (input.personality_v2_json !== undefined) {
    next.personality_v2_json = normalizePersonalityV2(input.personality_v2_json);
  }
  next.draft_saved_at = new Date().toISOString();
  return next;
}

// ---------------- Fallback Version Store (Pre-022 resilience) ----------------

type VersionOverlayMap = Record<string, CompanionVersionRecord[]>;

async function readVersionsOverlay(): Promise<VersionOverlayMap> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return {};
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', 'companion_versions_overlay')
      .maybeSingle();
    if (error || !data || typeof data.value_json !== 'object' || data.value_json === null) {
      return {};
    }
    return data.value_json as VersionOverlayMap;
  } catch {
    return {};
  }
}

async function appendVersionSnapshot(params: {
  companionId?: string | null;
  companionSlug: string;
  versionNumber: number;
  snapshotJson: Record<string, unknown>;
  changeNote?: string | null;
  createdBy?: string | null;
}): Promise<{ usedFallback: boolean }> {
  const supabaseAdmin = getSupabaseAdmin();
  const slugLower = params.companionSlug.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (supabaseAdmin) {
    // Archive prior published versions for this slug first
    const archiveRes = await supabaseAdmin
      .from('companion_versions')
      .update({ status: 'archived' })
      .eq('companion_slug', slugLower)
      .eq('status', 'published');

    if (!archiveRes.error) {
      const insertRes = await supabaseAdmin.from('companion_versions').upsert(
        {
          companion_id:
            params.companionId &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.companionId)
              ? params.companionId
              : null,
          companion_slug: slugLower,
          version_number: params.versionNumber,
          status: 'published',
          snapshot_json: params.snapshotJson,
          change_note: params.changeNote?.trim().slice(0, 300) || null,
          created_by: params.createdBy || null,
          created_at: nowIso,
        },
        { onConflict: 'companion_slug,version_number' }
      );
      if (!insertRes.error) {
        return { usedFallback: false };
      }
    }
  }

  // Fallback persistence in platform_settings (capped at 15 snapshots per companion)
  const overlay = await readVersionsOverlay();
  const existing = Array.isArray(overlay[slugLower]) ? overlay[slugLower] : [];
  const archived = existing
    .filter((v) => v.version_number !== params.versionNumber)
    .map((v) => ({ ...v, status: 'archived' as const }));
  const nextEntry: CompanionVersionRecord = {
    id: `ver_${slugLower}_v${params.versionNumber}`,
    companion_id: params.companionId || null,
    companion_slug: slugLower,
    version_number: params.versionNumber,
    status: 'published',
    snapshot_json: params.snapshotJson,
    change_note: params.changeNote?.trim().slice(0, 300) || null,
    created_by: params.createdBy || null,
    created_at: nowIso,
  };
  overlay[slugLower] = [nextEntry, ...archived].slice(0, 15);
  await savePlatformSetting('companion_versions_overlay', overlay, params.createdBy);
  return { usedFallback: true };
}

// ---------------- Draft / Publish / Discard / Versions / Rollback ----------------

export async function saveCompanionDraft(
  targetId: string,
  input: Record<string, unknown>,
  adminUserId?: string | null
): Promise<AdminCompanionMutationResult> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, status: 503, error: 'Backend unavailable.' };

  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const draftSnapshot = sanitizeDraftPayload(existing, input);
  const nowIso = new Date().toISOString();
  const slugLower = existing.slug.toLowerCase();

  const tableReady = await isCompanionsTableReady();
  if (tableReady) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id);
    const updateQuery = supabaseAdmin
      .from('companions')
      .update({
        draft_payload_json: draftSnapshot,
        has_unpublished_draft: true,
        updated_at: nowIso,
      });
    const res = isUuid
      ? await updateQuery.eq('id', existing.id).select('id').maybeSingle()
      : await updateQuery.eq('slug', slugLower).select('id').maybeSingle();

    if (res.error && !isMissing022ColumnError(res.error)) {
      return { ok: false, status: 500, error: res.error.message || 'Failed to save draft.' };
    }
  }

  await saveCompanionV2OverlayEntry(slugLower, {
    draft_payload_json: draftSnapshot,
    has_unpublished_draft: true,
  });

  if (adminUserId) {
    // Kept explicit for future audit metadata parity
  }

  invalidateCompanionsCache();
  const refreshed = (await findAdminCompanionByIdOrSlug(existing.slug)) || {
    ...existing,
    draft_payload_json: draftSnapshot,
    has_unpublished_draft: true,
  };
  return { ok: true, companion: refreshed };
}

export async function discardCompanionDraft(
  targetId: string
): Promise<AdminCompanionMutationResult> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, status: 503, error: 'Backend unavailable.' };

  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const slugLower = existing.slug.toLowerCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id);
  const updateQuery = supabaseAdmin
    .from('companions')
    .update({
      draft_payload_json: null,
      has_unpublished_draft: false,
      updated_at: new Date().toISOString(),
    });
  const res = isUuid
    ? await updateQuery.eq('id', existing.id).select('id').maybeSingle()
    : await updateQuery.eq('slug', slugLower).select('id').maybeSingle();

  if (res.error && !isMissing022ColumnError(res.error)) {
    return { ok: false, status: 500, error: res.error.message || 'Failed to discard draft.' };
  }

  await saveCompanionV2OverlayEntry(slugLower, {
    draft_payload_json: null,
    has_unpublished_draft: false,
  });

  invalidateCompanionsCache();
  const refreshed = (await findAdminCompanionByIdOrSlug(existing.slug)) || {
    ...existing,
    draft_payload_json: null,
    has_unpublished_draft: false,
  };
  return { ok: true, companion: refreshed };
}

export async function publishCompanionDraft(
  targetId: string,
  options?: {
    draftInput?: Record<string, unknown>;
    changeNote?: string;
    confirmCoreIdentityChange?: boolean;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const sourcePayload =
    options?.draftInput && typeof options.draftInput === 'object'
      ? sanitizeDraftPayload(existing, options.draftInput)
      : existing.draft_payload_json && typeof existing.draft_payload_json === 'object'
      ? sanitizeDraftPayload(existing, existing.draft_payload_json)
      : buildCompanionSnapshot(existing);

  const currentVersion = Math.max(1, Number(existing.published_version || 1));

  // Ensure initial baseline version v1 is archived in history if no history exists yet
  const existingHistory = await listCompanionVersions(existing.slug);
  if (existingHistory.versions.length === 0) {
    await appendVersionSnapshot({
      companionId: existing.id,
      companionSlug: existing.slug,
      versionNumber: currentVersion,
      snapshotJson: buildCompanionSnapshot(existing),
      changeNote: 'Initial published baseline snapshot',
      createdBy: options?.adminUserId || null,
    });
  }

  const nextVersion = currentVersion + 1;
  const nowIso = new Date().toISOString();

  const upsertRes = await upsertAdminCompanion(
    {
      ...sourcePayload,
      published_version: nextVersion,
      clear_draft: true,
      last_published_at: nowIso,
      confirm_core_identity_change: Boolean(options?.confirmCoreIdentityChange),
    },
    { isNew: false, targetId: existing.id }
  );

  if (!upsertRes.ok || !upsertRes.companion) {
    return upsertRes;
  }

  await appendVersionSnapshot({
    companionId: upsertRes.companion.id,
    companionSlug: upsertRes.companion.slug,
    versionNumber: nextVersion,
    snapshotJson: buildCompanionSnapshot(upsertRes.companion),
    changeNote: options?.changeNote || 'Published update',
    createdBy: options?.adminUserId || null,
  });

  invalidateCompanionsCache();
  return upsertRes;
}

export async function listCompanionVersions(targetId: string): Promise<{
  ok: boolean;
  versions: CompanionVersionRecord[];
  usingFallbackStorage?: boolean;
  error?: string;
}> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, versions: [], error: 'Companion not found.' };
  }
  const slugLower = existing.slug.toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();

  if (supabaseAdmin) {
    const res = await supabaseAdmin
      .from('companion_versions')
      .select('id, companion_id, companion_slug, version_number, status, snapshot_json, change_note, created_by, created_at')
      .eq('companion_slug', slugLower)
      .order('version_number', { ascending: false })
      .limit(30);

    if (!res.error && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        return {
          ok: true,
          versions: res.data as CompanionVersionRecord[],
          usingFallbackStorage: false,
        };
      }
    }
  }

  const overlay = await readVersionsOverlay();
  const overlayVersions = Array.isArray(overlay[slugLower]) ? overlay[slugLower] : [];
  if (overlayVersions.length > 0) {
    return { ok: true, versions: overlayVersions, usingFallbackStorage: true };
  }

  // Synthesize current v1 live snapshot so history drawer is never confusingly blank
  return {
    ok: true,
    usingFallbackStorage: true,
    versions: [
      {
        id: `current_${slugLower}_v${existing.published_version || 1}`,
        companion_id: existing.id,
        companion_slug: slugLower,
        version_number: existing.published_version || 1,
        status: 'published',
        snapshot_json: buildCompanionSnapshot(existing),
        change_note: 'Current live baseline',
        created_at: existing.last_published_at || existing.updated_at || new Date().toISOString(),
      },
    ],
  };
}

export async function rollbackCompanionToVersion(
  targetId: string,
  versionNumber: number,
  options?: {
    confirmCoreIdentityChange?: boolean;
    changeNote?: string;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const history = await listCompanionVersions(existing.slug);
  const targetVer = history.versions.find((v) => Number(v.version_number) === Number(versionNumber));
  if (!targetVer || !targetVer.snapshot_json || typeof targetVer.snapshot_json !== 'object') {
    return { ok: false, status: 404, error: `Version v${versionNumber} not found for ${existing.name}.` };
  }

  const currentVersion = Math.max(1, Number(existing.published_version || 1));
  const nextVersion = Math.max(currentVersion + 1, ...history.versions.map((v) => v.version_number + 1));
  const nowIso = new Date().toISOString();

  // Safety check before rollback if core identity is protected & fields differ
  const targetSnap = targetVer.snapshot_json;
  const protectedDiffs = detectCoreIdentityChanges(
    {
      name: existing.name,
      slug: existing.slug,
      sex: existing.sex,
      backstory: existing.backstory,
      personality_v2_json: existing.personality_v2_json,
    },
    {
      name: String(targetSnap.name || existing.name),
      slug: String(targetSnap.slug || existing.slug),
      sex: String(targetSnap.sex || existing.sex),
      backstory: String(targetSnap.backstory || ''),
      personality_v2_json: normalizePersonalityV2(targetSnap.personality_v2_json),
    }
  );
  if (protectedDiffs.length > 0 && !options?.confirmCoreIdentityChange) {
    return {
      ok: false,
      status: 409,
      code: 'CORE_IDENTITY_PROTECTED',
      protectedChanges: protectedDiffs,
      error: `Rolling back to v${versionNumber} alters protected core identity fields (${protectedDiffs
        .map((d) => d.label)
        .join(', ')}). Confirm rollback to proceed.`,
    };
  }

  const res = await upsertAdminCompanion(
    {
      ...targetSnap,
      published_version: nextVersion,
      clear_draft: true,
      last_published_at: nowIso,
      confirm_core_identity_change: true,
    },
    { isNew: false, targetId: existing.id, skipCoreIdentityCheck: true }
  );

  if (!res.ok || !res.companion) return res;

  await appendVersionSnapshot({
    companionId: res.companion.id,
    companionSlug: res.companion.slug,
    versionNumber: nextVersion,
    snapshotJson: buildCompanionSnapshot(res.companion),
    changeNote: options?.changeNote?.trim() || `Rolled back to v${versionNumber}`,
    createdBy: options?.adminUserId || null,
  });

  invalidateCompanionsCache();
  return res;
}

// ---------------- JSON Import / Export (Single, Bulk, Global) ----------------

export async function exportSingleCompanionBundle(targetId: string): Promise<{
  ok: boolean;
  bundle?: CompanionExportBundle;
  error?: string;
}> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) return { ok: false, error: 'Companion not found.' };

  return {
    ok: true,
    bundle: {
      bundle_type: 'cosmic_council_companion_v2',
      schema_version: 2,
      exported_at: new Date().toISOString(),
      companion: {
        ...buildCompanionSnapshot(existing),
        published_version: existing.published_version || 1,
        ...(existing.draft_payload_json ? { draft_payload_json: existing.draft_payload_json } : {}),
      },
    },
  };
}

export async function exportBulkCompanionsBundle(): Promise<CompanionBulkExportBundle> {
  const [companions, specializations] = await Promise.all([
    getAllCompanionsServerCached(),
    getCompanionSpecializations(),
  ]);
  return {
    bundle_type: 'cosmic_council_companions_roster_v2',
    schema_version: 2,
    exported_at: new Date().toISOString(),
    count: companions.length,
    specializations,
    companions: companions.map((c) => ({
      ...buildCompanionSnapshot(c),
      published_version: c.published_version || 1,
    })),
  };
}

function unwrapCompanionImportObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.companion && typeof obj.companion === 'object' && !Array.isArray(obj.companion)) {
    return obj.companion as Record<string, unknown>;
  }
  return obj;
}

export async function importSingleCompanionBundle(
  rawBundle: unknown,
  options: {
    mode: 'draft' | 'publish';
    targetId?: string;
    confirmCoreIdentityChange?: boolean;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult> {
  const candidate = unwrapCompanionImportObject(rawBundle);
  if (!candidate || typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid companion JSON: missing required "name" field.',
    };
  }

  const lookupKey =
    options.targetId?.trim() ||
    (typeof candidate.slug === 'string' && candidate.slug.trim()) ||
    '';
  const existing = lookupKey ? await findAdminCompanionByIdOrSlug(lookupKey) : null;

  if (!existing) {
    // Creating a brand-new companion via import
    const createRes = await upsertAdminCompanion(candidate, { isNew: true });
    if (createRes.ok && createRes.companion) {
      await appendVersionSnapshot({
        companionId: createRes.companion.id,
        companionSlug: createRes.companion.slug,
        versionNumber: 1,
        snapshotJson: buildCompanionSnapshot(createRes.companion),
        changeNote: 'Imported new companion',
        createdBy: options.adminUserId || null,
      });
    }
    return createRes;
  }

  if (options.mode === 'draft') {
    return saveCompanionDraft(existing.id, candidate, options.adminUserId);
  }

  return publishCompanionDraft(existing.id, {
    draftInput: candidate,
    changeNote: 'Imported JSON configuration',
    confirmCoreIdentityChange: Boolean(options.confirmCoreIdentityChange),
    adminUserId: options.adminUserId,
  });
}

export async function importBulkCompanionsBundle(
  rawBundle: unknown,
  options: {
    mode: 'draft' | 'publish';
    confirmCoreIdentityChange?: boolean;
    adminUserId?: string | null;
  }
): Promise<{
  ok: boolean;
  error?: string;
  updated: number;
  created: number;
  drafted: number;
  skippedProtected: Array<{ slug: string; name: string; protectedChanges: CoreIdentityProtectedDiff[] }>;
  errors: Array<{ slug: string; error: string }>;
  totalProcessed: number;
}> {
  const emptyResult = {
    ok: false,
    updated: 0,
    created: 0,
    drafted: 0,
    skippedProtected: [] as Array<{ slug: string; name: string; protectedChanges: CoreIdentityProtectedDiff[] }>,
    errors: [] as Array<{ slug: string; error: string }>,
    totalProcessed: 0,
  };

  if (!rawBundle || typeof rawBundle !== 'object') {
    return { ...emptyResult, error: 'Bulk JSON payload must be an object or array.' };
  }

  const obj = rawBundle as Record<string, unknown>;
  const list = Array.isArray(rawBundle)
    ? rawBundle
    : Array.isArray(obj.companions)
    ? obj.companions
    : null;

  if (!list || list.length === 0) {
    return { ...emptyResult, error: 'No companions array found in JSON bundle.' };
  }
  if (list.length > 200) {
    return { ...emptyResult, error: 'Bulk import is capped at 200 companions per batch.' };
  }

  // Optionally update specializations taxonomy if included in bundle
  if (Array.isArray(obj.specializations) && obj.specializations.length > 0) {
    await saveCompanionSpecializations(obj.specializations, options.adminUserId);
  }

  const existingAll = await getAllCompanionsServerCached();
  const bySlug = new Map(existingAll.map((c) => [c.slug.toLowerCase(), c]));

  let updated = 0;
  let created = 0;
  let drafted = 0;
  const skippedProtected: Array<{
    slug: string;
    name: string;
    protectedChanges: CoreIdentityProtectedDiff[];
  }> = [];
  const errors: Array<{ slug: string; error: string }> = [];

  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const slug = String(rec.slug || '').trim().toLowerCase();
    const name = String(rec.name || slug || 'Unknown').trim();
    const existing = slug ? bySlug.get(slug) : undefined;

    if (!existing) {
      const res = await upsertAdminCompanion(rec, { isNew: true });
      if (res.ok && res.companion) {
        created++;
        bySlug.set(res.companion.slug.toLowerCase(), res.companion);
      } else {
        errors.push({ slug: slug || name, error: res.error || 'Failed to create companion' });
      }
      continue;
    }

    if (options.mode === 'draft') {
      const res = await saveCompanionDraft(existing.id, rec, options.adminUserId);
      if (res.ok) drafted++;
      else errors.push({ slug: existing.slug, error: res.error || 'Failed to save draft' });
    } else {
      const res = await publishCompanionDraft(existing.id, {
        draftInput: rec,
        changeNote: 'Bulk JSON import',
        confirmCoreIdentityChange: Boolean(options.confirmCoreIdentityChange),
        adminUserId: options.adminUserId,
      });
      if (res.ok) {
        updated++;
      } else if (res.code === 'CORE_IDENTITY_PROTECTED') {
        skippedProtected.push({
          slug: existing.slug,
          name: existing.name,
          protectedChanges: res.protectedChanges || [],
        });
      } else {
        errors.push({ slug: existing.slug, error: res.error || 'Failed to publish companion' });
      }
    }
  }

  invalidateCompanionsCache();
  return {
    ok: true,
    updated,
    created,
    drafted,
    skippedProtected,
    errors,
    totalProcessed: list.length,
  };
}

export async function exportGlobalCompanionBundle(): Promise<GlobalCompanionIntelligenceBundle> {
  const overrides = await getEnginePromptOverrides();
  const specializations = await getCompanionSpecializations();

  return {
    bundle_type: 'cosmic_council_companion_global_v2',
    schema_version: 2,
    exported_at: new Date().toISOString(),
    companion_constitution:
      overrides.companion_constitution?.trim() || DEFAULT_COMPANION_CONSTITUTION,
    companion_realism_baseline:
      overrides.companion_realism_baseline?.trim() || DEFAULT_COMPANION_REALISM_BASELINE,
    companion_listen_only_guardrail:
      overrides.companion_listen_only_guardrail?.trim() || DEFAULT_COMPANION_LISTEN_ONLY_GUARDRAIL,
    companion_empathy_first_guardrail:
      overrides.companion_empathy_first_guardrail?.trim() || DEFAULT_COMPANION_EMPATHY_FIRST_GUARDRAIL,
    companion_chart_presence_prompt:
      overrides.companion_chart_presence_prompt?.trim() || DEFAULT_COMPANION_CHART_PRESENCE_PROMPT,
    companion_return_greeting_prompt:
      overrides.companion_return_greeting_prompt?.trim() || DEFAULT_COMPANION_RETURN_GREETING_PROMPT,
    companion_bond_extractor_prompt:
      overrides.companion_bond_extractor_prompt?.trim() || DEFAULT_COMPANION_BOND_EXTRACTOR_PROMPT,
    companion_matcher_instructions:
      overrides.companion_matcher_instructions?.trim() || DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
    companion_skill_rules: {
      ...DEFAULT_COMPANION_SKILL_RULES,
      ...(overrides.companion_skill_rules || {}),
    },
    companion_group_configs: {
      ...DEFAULT_COMPANION_GROUP_CONFIGS,
      ...(overrides.companion_group_configs || {}),
    },
    companion_archetypes:
      Array.isArray(overrides.companion_archetypes) && overrides.companion_archetypes.length > 0
        ? overrides.companion_archetypes
        : DEFAULT_COMPANION_ARCHETYPES,
    companion_specializations: specializations,
  };
}

export async function importGlobalCompanionBundle(
  rawBundle: unknown,
  adminUserId?: string | null
): Promise<{ ok: boolean; error?: string; bundle?: GlobalCompanionIntelligenceBundle }> {
  if (!rawBundle || typeof rawBundle !== 'object' || Array.isArray(rawBundle)) {
    return { ok: false, error: 'Global companion config JSON must be an object.' };
  }
  const obj = rawBundle as Record<string, unknown>;
  const current = await getEnginePromptOverrides();
  const next: EnginePromptOverrides = { ...current };

  const stringFields = [
    'companion_constitution',
    'companion_realism_baseline',
    'companion_listen_only_guardrail',
    'companion_empathy_first_guardrail',
    'companion_chart_presence_prompt',
    'companion_return_greeting_prompt',
    'companion_bond_extractor_prompt',
    'companion_matcher_instructions',
  ] as const;

  let touched = false;
  for (const key of stringFields) {
    if (typeof obj[key] === 'string') {
      const val = (obj[key] as string).trim();
      if (val) {
        next[key] = val.slice(0, 12000);
      } else {
        delete next[key];
      }
      touched = true;
    }
  }

  if (obj.companion_skill_rules && typeof obj.companion_skill_rules === 'object' && !Array.isArray(obj.companion_skill_rules)) {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.companion_skill_rules as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) merged[k] = v.trim().slice(0, 8000);
    }
    if (Object.keys(merged).length > 0) {
      next.companion_skill_rules = merged as EnginePromptOverrides['companion_skill_rules'];
      touched = true;
    }
  }

  if (obj.companion_group_configs && typeof obj.companion_group_configs === 'object' && !Array.isArray(obj.companion_group_configs)) {
    next.companion_group_configs = obj.companion_group_configs as EnginePromptOverrides['companion_group_configs'];
    touched = true;
  }

  if (Array.isArray(obj.companion_archetypes) && obj.companion_archetypes.length > 0) {
    next.companion_archetypes = obj.companion_archetypes as EnginePromptOverrides['companion_archetypes'];
    touched = true;
  }

  if (Array.isArray(obj.companion_specializations) && obj.companion_specializations.length > 0) {
    const cleanedSpecs = sanitizeSpecializationTags(obj.companion_specializations);
    if (cleanedSpecs.length > 0) {
      next.companion_specializations = cleanedSpecs;
      touched = true;
    }
  }

  if (!touched) {
    return {
      ok: false,
      error: 'No recognized global companion config keys were found in the uploaded JSON.',
    };
  }

  const saved = await savePlatformSetting('engine_prompt_overrides', next, adminUserId);
  if (!saved.ok) {
    return { ok: false, error: saved.error || 'Failed to save imported global config.' };
  }
  invalidateAllPlatformCaches();
  return { ok: true, bundle: await exportGlobalCompanionBundle() };
}
