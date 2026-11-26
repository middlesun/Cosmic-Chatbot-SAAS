import {
  buildCoreIdentityCapsuleDraft,
  computeCompanionFieldDiffs,
  createBlankCompanionV2Template,
  createBlankGlobalConfigV2Template,
  DEFAULT_COMPANION_PERSONALITY_V2,
  DEFAULT_COMPANION_SPECIALIZATIONS,
  detectCoreIdentityChanges,
  estimateTokensRough,
  hasAuthoredV2Depth,
  isLegacySeedSpecializationTaxonomy,
  normalizePersonalityV2,
  sanitizeSpecializationSlugs,
  sanitizeSpecializationTags,
  stripUnsafeJsonKeys,
  type CompanionBulkExportBundle,
  type CompanionExportBundle,
  type CompanionFieldDiff,
  type CompanionSpecializationTag,
  type CompanionVersionRecord,
  type CoreIdentityProtectedDiff,
  type GlobalCompanionIntelligenceBundle,
} from '../../lib/companionV2Schema';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { ensureCompanionV2Initialized, validateCoreIdentityLock } from './companionV2Mapper';
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
import { FORMULA_CARTRIDGES_SEED } from './formulaCartridgesSeed';
import { WESTERN_FORMULA_CARTRIDGES_SEED } from './westernFormulaSeed';
import {
  ASTRA_MOON_BENCHMARK_SLUG,
  getAstraMoonBenchmarkPreset,
} from './astraMoonBenchmark';
import {
  runCompanionStudioTestTurn,
  type CompanionSandboxResult,
  type CompanionStudioSimulationConfig,
  type ReferrableCompanionSummary,
} from './companionEngine';
import {
  createOpenRouterCompletion,
  getUtilityModelAsync,
  isOpenRouterConfiguredAsync,
} from './openrouter';
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
    const sanitized = sanitizeSpecializationTags(overrides.companion_specializations);
    if (sanitized.length > 0 && !isLegacySeedSpecializationTaxonomy(sanitized)) {
      return sanitized;
    }
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
  invalidateCompanionsCache();
  return { ok: true, specializations: sanitized };
}

export interface AdminCompanionRosterSummary {
  id: string;
  slug: string;
  legacy_id: string | null;
  name: string;
  age: number;
  sex: CompanionPresetRecord['sex'];
  tagline: string;
  card_subtitle: string;
  primary_expertise: string;
  secondary_expertise: string[];
  category_tag: CompanionPresetRecord['category_tag'];
  companion_group: NonNullable<CompanionPresetRecord['companion_group']>;
  advisory_mode: NonNullable<CompanionPresetRecord['advisory_mode']>;
  skill_level: CompanionPresetRecord['skill_level'];
  chat_style: CompanionPresetRecord['chat_style'];
  model_id: string | null;
  avatar_url: string | null;
  monogram_palette: CompanionPresetRecord['monogram_palette'];
  override_global_rules: boolean;
  is_active: boolean;
  sort_order: number;
  specializations: string[];
  specialization_slugs: string[];
  core_identity_locked: boolean;
  v2_status: 'draft_pending' | 'published';
  v2_version: number;
  published_version: number;
  has_unpublished_draft: boolean;
  last_published_at: string | null;
  capsule_token_estimate: number;
  has_authored_v2: boolean;
  updated_at?: string;
}

export function toAdminCompanionRosterSummary(
  c: CompanionPresetRecord
): AdminCompanionRosterSummary {
  const v2 = c.personality_v2_json || ensureCompanionV2Initialized(c);
  const specializations = Array.isArray(c.specialization_slugs) ? c.specialization_slugs : [];
  const publishedVersion = Math.max(1, Number(c.published_version || 1));
  const hasDraft = Boolean(c.has_unpublished_draft || c.draft_payload_json);
  return {
    id: c.id,
    slug: c.slug,
    legacy_id: c.legacy_id ?? null,
    name: c.name,
    age: c.age,
    sex: c.sex,
    tagline: c.tagline,
    card_subtitle: c.card_subtitle || '',
    primary_expertise: c.primary_expertise,
    secondary_expertise: [...(c.secondary_expertise || [])],
    category_tag: c.category_tag,
    companion_group: c.companion_group || 'everyday_companions',
    advisory_mode: c.advisory_mode || 'friend',
    skill_level: c.skill_level,
    chat_style: c.chat_style,
    model_id: c.model_id,
    avatar_url: c.avatar_url,
    monogram_palette: c.monogram_palette,
    override_global_rules: c.override_global_rules,
    is_active: c.is_active,
    sort_order: c.sort_order,
    specializations,
    specialization_slugs: specializations,
    core_identity_locked: c.core_identity_locked !== false,
    v2_status: hasDraft ? 'draft_pending' : 'published',
    v2_version: publishedVersion,
    published_version: publishedVersion,
    has_unpublished_draft: hasDraft,
    last_published_at: c.last_published_at || null,
    capsule_token_estimate:
      v2.capsule_token_estimate ?? estimateTokensRough(v2.core_identity_capsule),
    has_authored_v2: hasAuthoredV2Depth(v2),
    updated_at: c.updated_at,
  };
}

export function getFormulaCartridgesCatalogSummary(): Array<{
  slug: string;
  display_name: string;
  subtitle: string;
  system: 'vedic' | 'western';
}> {
  const vedic = FORMULA_CARTRIDGES_SEED.map((f) => ({
    slug: f.slug,
    display_name: f.display_name,
    subtitle: f.subtitle,
    system: 'vedic' as const,
  }));
  const western = WESTERN_FORMULA_CARTRIDGES_SEED.map((f) => ({
    slug: f.slug,
    display_name: f.display_name,
    subtitle: f.subtitle,
    system: 'western' as const,
  }));
  return [...vedic, ...western];
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

export interface CompanionV2EditorState {
  companion: CompanionPresetRecord;
  v2_draft_json: Record<string, unknown>;
  v2_published_json: Record<string, unknown>;
  v2_status: 'draft_pending' | 'published';
  v2_version: number;
  core_identity_locked: boolean;
  has_unpublished_draft: boolean;
  last_published_at: string | null;
  draft_diffs: CompanionFieldDiff[];
  versions: CompanionVersionRecord[];
  usingFallbackStorage: boolean;
}

export async function getCompanionV2EditorState(
  targetId: string
): Promise<{ ok: true; state: CompanionV2EditorState } | { ok: false; status: number; error: string }> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const publishedSnap = buildCompanionSnapshot(existing);
  const draftMerged =
    existing.draft_payload_json && typeof existing.draft_payload_json === 'object'
      ? sanitizeDraftPayload(existing, existing.draft_payload_json)
      : { ...publishedSnap };

  const history = await listCompanionVersions(existing.slug);
  const hasDraft = Boolean(existing.has_unpublished_draft || existing.draft_payload_json);
  const publishedVersion = Math.max(1, Number(existing.published_version || 1));

  return {
    ok: true,
    state: {
      companion: existing,
      v2_draft_json: draftMerged,
      v2_published_json: publishedSnap,
      v2_status: hasDraft ? 'draft_pending' : 'published',
      v2_version: publishedVersion,
      core_identity_locked: existing.core_identity_locked !== false,
      has_unpublished_draft: hasDraft,
      last_published_at: existing.last_published_at || null,
      draft_diffs: hasDraft ? computeCompanionFieldDiffs(publishedSnap, draftMerged) : [],
      versions: history.versions,
      usingFallbackStorage: Boolean(history.usingFallbackStorage),
    },
  };
}

export function buildCompanionSnapshot(record: CompanionPresetRecord): Record<string, unknown> {
  const coreLocked = record.core_identity_locked !== false;
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
    core_identity_locked: coreLocked,
    personality_v2_json: normalizePersonalityV2({
      ...(record.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2),
      core_identity_locked: coreLocked,
    }),
  };
}

function sanitizeDraftPayload(
  base: CompanionPresetRecord,
  rawInput: Record<string, unknown>
): Record<string, unknown> {
  const input = stripUnsafeJsonKeys(rawInput);
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
    next.model_id =
      typeof input.model_id === 'string' && input.model_id.trim()
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
    next.formula_cartridge_slugs = input.formula_cartridge_slugs
      .map((s) => String(s || '').trim().toLowerCase().slice(0, 80))
      .filter(Boolean)
      .slice(0, 32);
  }
  if (input.max_output_tokens === null || typeof input.max_output_tokens === 'number') {
    next.max_output_tokens =
      typeof input.max_output_tokens === 'number' && Number.isFinite(input.max_output_tokens)
        ? Math.max(300, Math.min(16000, Math.round(input.max_output_tokens)))
        : null;
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
  if (typeof input.core_identity_locked === 'boolean') {
    next.core_identity_locked = input.core_identity_locked;
  }
  if (input.personality_v2_json !== undefined) {
    const normalizedV2 = normalizePersonalityV2(input.personality_v2_json);
    if (typeof input.core_identity_locked === 'boolean') {
      normalizedV2.core_identity_locked = input.core_identity_locked;
    }
    next.personality_v2_json = normalizedV2;
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
        // Lean history cap: prune snapshots older than the latest 25 per companion
        const { data: staleRows } = await supabaseAdmin
          .from('companion_versions')
          .select('id')
          .eq('companion_slug', slugLower)
          .order('version_number', { ascending: false })
          .range(25, 200);
        if (Array.isArray(staleRows) && staleRows.length > 0) {
          await supabaseAdmin
            .from('companion_versions')
            .delete()
            .in(
              'id',
              staleRows.map((r: { id: string }) => r.id)
            );
        }
        return { usedFallback: false };
      }
    }
  }

  // Fallback persistence in platform_settings (capped at 25 snapshots per companion)
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
  overlay[slugLower] = [nextEntry, ...archived].slice(0, 25);
  await savePlatformSetting('companion_versions_overlay', overlay, params.createdBy);
  return { usedFallback: true };
}

// ---------------- Draft / Publish / Discard / Versions / Rollback ----------------

export async function saveCompanionDraft(
  targetId: string,
  input: Record<string, unknown>,
  adminUserId?: string | null,
  options?: {
    enforceCoreLock?: boolean;
    confirmCoreIdentityChange?: boolean;
    unlockCoreIdentity?: boolean;
  }
): Promise<AdminCompanionMutationResult & { state?: CompanionV2EditorState }> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, status: 503, error: 'Backend unavailable.' };

  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const draftSnapshot = sanitizeDraftPayload(existing, input);
  const v2InDraft = normalizePersonalityV2(draftSnapshot.personality_v2_json);
  v2InDraft.capsule_token_estimate = estimateTokensRough(v2InDraft.core_identity_capsule);
  draftSnapshot.personality_v2_json = v2InDraft;

  const enforceLock = options?.enforceCoreLock !== false;
  const confirmedUnlock = Boolean(
    options?.confirmCoreIdentityChange || options?.unlockCoreIdentity
  );

  if (enforceLock) {
    const lockCheck = validateCoreIdentityLock(
      {
        name: existing.name,
        slug: existing.slug,
        sex: existing.sex,
        backstory: existing.backstory,
        core_identity_locked: existing.core_identity_locked,
        personality_v2_json: existing.personality_v2_json,
      },
      {
        name: String(draftSnapshot.name || existing.name),
        slug: String(draftSnapshot.slug || existing.slug),
        sex: String(draftSnapshot.sex || existing.sex),
        backstory: String(draftSnapshot.backstory || ''),
        personality_v2_json: v2InDraft,
      },
      confirmedUnlock
    );
    if (!lockCheck.ok) {
      return {
        ok: false,
        status: 409,
        code: 'CORE_IDENTITY_PROTECTED',
        protectedChanges: lockCheck.protectedChanges,
        error: `Core Identity Protection is enabled for ${existing.name}. Unlock core identity or confirm protected changes (${lockCheck.protectedChanges
          .map((d) => d.label)
          .join(', ')}) before saving.`,
      };
    }
  }

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
    // Reserved for explicit audit log hook
  }

  invalidateCompanionsCache();
  const refreshed = (await findAdminCompanionByIdOrSlug(existing.slug)) || {
    ...existing,
    draft_payload_json: draftSnapshot,
    has_unpublished_draft: true,
  };
  const editorStateRes = await getCompanionV2EditorState(refreshed.slug);
  return {
    ok: true,
    companion: refreshed,
    ...(editorStateRes.ok ? { state: editorStateRes.state } : {}),
  };
}

export async function discardCompanionDraft(
  targetId: string
): Promise<AdminCompanionMutationResult & { state?: CompanionV2EditorState }> {
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
  const editorStateRes = await getCompanionV2EditorState(refreshed.slug);
  return {
    ok: true,
    companion: refreshed,
    ...(editorStateRes.ok ? { state: editorStateRes.state } : {}),
  };
}

export async function publishCompanionDraft(
  targetId: string,
  options?: {
    draftInput?: Record<string, unknown>;
    changeNote?: string;
    confirmCoreIdentityChange?: boolean;
    unlockCoreIdentity?: boolean;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult & { state?: CompanionV2EditorState }> {
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

  // Ensure initial baseline version is archived in history if no history exists yet
  const existingHistory = await listCompanionVersions(existing.slug);
  if (
    existingHistory.versions.length === 0 ||
    !existingHistory.versions.some((v) => v.version_number === currentVersion)
  ) {
    await appendVersionSnapshot({
      companionId: existing.id,
      companionSlug: existing.slug,
      versionNumber: currentVersion,
      snapshotJson: buildCompanionSnapshot(existing),
      changeNote: 'Initial published baseline snapshot',
      createdBy: options?.adminUserId || null,
    });
  }

  const nextVersion = Math.max(
    currentVersion + 1,
    ...existingHistory.versions.map((v) => Number(v.version_number || 0) + 1)
  );
  const nowIso = new Date().toISOString();
  const confirmedUnlock = Boolean(
    options?.confirmCoreIdentityChange || options?.unlockCoreIdentity
  );

  const upsertRes = await upsertAdminCompanion(
    {
      ...sourcePayload,
      published_version: nextVersion,
      clear_draft: true,
      last_published_at: nowIso,
      confirm_core_identity_change: confirmedUnlock,
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
    changeNote: options?.changeNote?.trim() || 'Published update',
    createdBy: options?.adminUserId || null,
  });

  invalidateAllPlatformCaches();
  invalidateCompanionsCache();
  const editorStateRes = await getCompanionV2EditorState(upsertRes.companion.slug);
  return {
    ...upsertRes,
    ...(editorStateRes.ok ? { state: editorStateRes.state } : {}),
  };
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
      .select(
        'id, companion_id, companion_slug, version_number, status, snapshot_json, change_note, created_by, created_at'
      )
      .eq('companion_slug', slugLower)
      .order('version_number', { ascending: false })
      .limit(30);

    if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
      return {
        ok: true,
        versions: res.data as CompanionVersionRecord[],
        usingFallbackStorage: false,
      };
    }
  }

  const overlay = await readVersionsOverlay();
  const overlayVersions = Array.isArray(overlay[slugLower]) ? overlay[slugLower] : [];
  if (overlayVersions.length > 0) {
    return { ok: true, versions: overlayVersions, usingFallbackStorage: true };
  }

  // Synthesize current live snapshot so history drawer always has an accurate baseline
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
  versionIdentifier: number | string | { versionId?: string; versionNumber?: number },
  options?: {
    targetStage?: 'draft' | 'publish';
    confirmCoreIdentityChange?: boolean;
    unlockCoreIdentity?: boolean;
    changeNote?: string;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult & { state?: CompanionV2EditorState; restoredVersion?: number }> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const history = await listCompanionVersions(existing.slug);

  let targetVer: CompanionVersionRecord | undefined;
  if (typeof versionIdentifier === 'number' && Number.isFinite(versionIdentifier)) {
    targetVer = history.versions.find(
      (v) => Number(v.version_number) === Number(versionIdentifier)
    );
  } else if (typeof versionIdentifier === 'string') {
    const trimmed = versionIdentifier.trim();
    const num = Number(trimmed);
    targetVer =
      history.versions.find((v) => v.id === trimmed) ||
      (Number.isFinite(num)
        ? history.versions.find((v) => Number(v.version_number) === num)
        : undefined);
  } else if (versionIdentifier && typeof versionIdentifier === 'object') {
    if (versionIdentifier.versionId) {
      targetVer = history.versions.find((v) => v.id === versionIdentifier.versionId);
    }
    if (!targetVer && typeof versionIdentifier.versionNumber === 'number') {
      targetVer = history.versions.find(
        (v) => Number(v.version_number) === Number(versionIdentifier.versionNumber)
      );
    }
  }

  if (!targetVer || !targetVer.snapshot_json || typeof targetVer.snapshot_json !== 'object') {
    return { ok: false, status: 404, error: `Requested version snapshot was not found for ${existing.name}.` };
  }

  const targetSnap = targetVer.snapshot_json;
  const restoredVersionNum = Number(targetVer.version_number);
  const stage = options?.targetStage || 'draft';

  // Stage rollback into Draft (default non-destructive 1-click flow)
  if (stage === 'draft') {
    const draftRes = await saveCompanionDraft(
      existing.id,
      {
        ...targetSnap,
        restored_from_version: restoredVersionNum,
      },
      options?.adminUserId,
      { enforceCoreLock: false }
    );
    return {
      ...draftRes,
      restoredVersion: restoredVersionNum,
    };
  }

  const currentVersion = Math.max(1, Number(existing.published_version || 1));
  const nextVersion = Math.max(
    currentVersion + 1,
    ...history.versions.map((v) => Number(v.version_number || 0) + 1)
  );
  const nowIso = new Date().toISOString();
  const confirmedUnlock = Boolean(
    options?.confirmCoreIdentityChange || options?.unlockCoreIdentity
  );

  // Safety check before publishing rollback if core identity is locked & fields differ
  const protectedDiffs =
    existing.core_identity_locked === false
      ? []
      : detectCoreIdentityChanges(
          {
            name: existing.name,
            slug: existing.slug,
            sex: existing.sex,
            backstory: existing.backstory,
            core_identity_locked: existing.core_identity_locked,
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
  if (protectedDiffs.length > 0 && !confirmedUnlock) {
    return {
      ok: false,
      status: 409,
      code: 'CORE_IDENTITY_PROTECTED',
      protectedChanges: protectedDiffs,
      error: `Rolling back to v${restoredVersionNum} alters protected core identity fields (${protectedDiffs
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
    changeNote: options?.changeNote?.trim() || `Rolled back to v${restoredVersionNum}`,
    createdBy: options?.adminUserId || null,
  });

  invalidateAllPlatformCaches();
  invalidateCompanionsCache();
  const editorStateRes = await getCompanionV2EditorState(res.companion.slug);
  return {
    ...res,
    restoredVersion: restoredVersionNum,
    ...(editorStateRes.ok ? { state: editorStateRes.state } : {}),
  };
}

// ---------------- Core Identity Capsule Compiler ----------------

export async function compileCompanionCapsule(
  targetId: string,
  overridesInput?: Record<string, unknown>,
  options?: { useAi?: boolean }
): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  capsule?: string;
  tokenEstimate?: number;
  charCount?: number;
  source?: 'deterministic' | 'ai_synthesized';
  modelUsed?: string;
}> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing && targetId !== '__new__') {
    return { ok: false, status: 404, error: 'Companion not found.' };
  }

  const cleanedOverrides =
    overridesInput && typeof overridesInput === 'object' ? stripUnsafeJsonKeys(overridesInput) : {};

  const merged = existing
    ? sanitizeDraftPayload(existing, cleanedOverrides)
    : cleanedOverrides;

  const v2 = normalizePersonalityV2(merged.personality_v2_json);
  const deterministicCapsule = buildCoreIdentityCapsuleDraft({
    name: String(merged.name || existing?.name || 'Companion'),
    age: typeof merged.age === 'number' ? merged.age : existing?.age,
    sex: String(merged.sex || existing?.sex || 'F'),
    primary_expertise: String(merged.primary_expertise || existing?.primary_expertise || ''),
    cultural_fluency: String(merged.cultural_fluency || existing?.cultural_fluency || ''),
    tagline: String(merged.tagline || existing?.tagline || ''),
    backstory: String(merged.backstory || existing?.backstory || ''),
    personality_v2_json: v2,
  });

  if (options?.useAi && (await isOpenRouterConfiguredAsync())) {
    try {
      const utilityModel = await getUtilityModelAsync();
      const sourceContext = {
        name: merged.name,
        age: merged.age,
        sex: merged.sex,
        primary_expertise: merged.primary_expertise,
        cultural_fluency: merged.cultural_fluency,
        tagline: merged.tagline,
        backstory: merged.backstory,
        soul_consciousness: merged.soul_consciousness,
        character_essence: v2.character_essence,
        fictional_lore: v2.fictional_lore,
        inner_compass: v2.inner_compass,
        expression_spectrum: v2.expression_spectrum,
        subtle_contradictions: v2.subtle_contradictions,
        humour_and_interests: v2.humour_and_interests,
        quirks_and_habits: v2.quirks_and_habits,
        linguistic_fingerprint: v2.linguistic_fingerprint,
        interpersonal_dynamics: v2.interpersonal_dynamics,
        soft_instincts: v2.soft_instincts,
        signature_methodology: v2.signature_methodology,
      };
      const completion = await createOpenRouterCompletion({
        model: utilityModel,
        temperature: 0.3,
        maxTokens: 1100,
        disableReasoning: true,
        system: [
          'You are a character voice architect compressing a rich companion profile into an always-injected Core Identity Capsule.',
          'Target length: ~500 to 700 tokens (roughly 2000 to 2800 characters). Be vivid, psychologically real, and zero-fluff.',
          'Preserve exact voice cadence, lived roots/lore, inner compass anchors, contradictions, humor, quirks, linguistic habits, and emotional boundaries.',
          'Write as a cohesive behavioral identity briefing in crisp prose/tight blocks (never generic therapy clichés, never markdown bloat).',
          'Return ONLY the compiled capsule text with no preamble or commentary.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `Compile the Core Identity Capsule from this structured character data:\n\n${JSON.stringify(
              sourceContext,
              null,
              2
            )}\n\nDeterministic baseline for completeness:\n${deterministicCapsule}`,
          },
        ],
      });
      const aiText = completion.text.trim();
      if (aiText.length >= 250) {
        const sliced = aiText.slice(0, 6000);
        return {
          ok: true,
          capsule: sliced,
          tokenEstimate: estimateTokensRough(sliced),
          charCount: sliced.length,
          source: 'ai_synthesized',
          modelUsed: utilityModel,
        };
      }
    } catch {
      // Fall back safely to deterministic synthesis
    }
  }

  return {
    ok: true,
    capsule: deterministicCapsule,
    tokenEstimate: estimateTokensRough(deterministicCapsule),
    charCount: deterministicCapsule.length,
    source: 'deterministic',
  };
}

// ---------------- JSON Import / Export (Single, Bulk, Global) ----------------

export async function exportSingleCompanionBundle(
  targetId: string,
  stage: 'draft' | 'published' = 'published'
): Promise<{
  ok: boolean;
  bundle?: CompanionExportBundle;
  error?: string;
}> {
  const existing = await findAdminCompanionByIdOrSlug(targetId);
  if (!existing) return { ok: false, error: 'Companion not found.' };

  const baseSnapshot = buildCompanionSnapshot(existing);
  let companionPayload: Record<string, unknown>;

  if (stage === 'draft' && existing.draft_payload_json) {
    const mergedDraft = sanitizeDraftPayload(existing, existing.draft_payload_json);
    companionPayload = {
      ...mergedDraft,
      published_version: existing.published_version || 1,
      export_stage: 'draft',
    };
  } else {
    companionPayload = {
      ...baseSnapshot,
      published_version: existing.published_version || 1,
      export_stage: 'published',
    };
  }

  return {
    ok: true,
    bundle: {
      bundle_type: 'cosmic_council_companion_v2',
      schema_version: 2,
      exported_at: new Date().toISOString(),
      companion: companionPayload,
    },
  };
}

export function getBlankV2Templates(): {
  companionTemplate: CompanionExportBundle;
  globalConfigTemplate: GlobalCompanionIntelligenceBundle;
} {
  return {
    companionTemplate: createBlankCompanionV2Template(),
    globalConfigTemplate: createBlankGlobalConfigV2Template(),
  };
}

export async function exportBulkCompanionsBundle(
  stage: 'draft' | 'published' = 'published'
): Promise<CompanionBulkExportBundle> {
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
    companions: companions.map((c) => {
      if (stage === 'draft' && c.draft_payload_json) {
        return {
          ...sanitizeDraftPayload(c, c.draft_payload_json),
          published_version: c.published_version || 1,
          export_stage: 'draft',
        };
      }
      return {
        ...buildCompanionSnapshot(c),
        published_version: c.published_version || 1,
        export_stage: 'published',
      };
    }),
  };
}

function unwrapCompanionImportObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cleaned = stripUnsafeJsonKeys(raw as Record<string, unknown>);
  if (cleaned.companion && typeof cleaned.companion === 'object' && !Array.isArray(cleaned.companion)) {
    return stripUnsafeJsonKeys(cleaned.companion as Record<string, unknown>);
  }
  return cleaned;
}

export interface CompanionImportDryRunPreview {
  ok: true;
  dryRun: true;
  action: 'create' | 'update' | 'unchanged';
  slug: string;
  name: string;
  diffCount: number;
  diffs: CompanionFieldDiff[];
  coreIdentityLocked: boolean;
  protectedChanges: CoreIdentityProtectedDiff[];
}

export async function importSingleCompanionBundle(
  rawBundle: unknown,
  options: {
    mode: 'draft' | 'publish';
    targetId?: string;
    dryRun?: boolean;
    confirmCoreIdentityChange?: boolean;
    unlockCoreIdentity?: boolean;
    adminUserId?: string | null;
  }
): Promise<AdminCompanionMutationResult & { dryRun?: boolean; preview?: CompanionImportDryRunPreview }> {
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
  const confirmedUnlock = Boolean(
    options.confirmCoreIdentityChange || options.unlockCoreIdentity
  );

  if (options.dryRun) {
    if (!existing) {
      const slug =
        (typeof candidate.slug === 'string' && candidate.slug.trim().toLowerCase()) ||
        candidate.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .slice(0, 64);
      return {
        ok: true,
        dryRun: true,
        preview: {
          ok: true,
          dryRun: true,
          action: 'create',
          slug,
          name: candidate.name.trim(),
          diffCount: Object.keys(candidate).length,
          diffs: [
            {
              field: 'slug',
              label: 'New Companion',
              category: 'profile',
              before: '(does not exist)',
              after: `${candidate.name.trim()} (${slug})`,
            },
          ],
          coreIdentityLocked: candidate.core_identity_locked !== false,
          protectedChanges: [],
        },
      };
    }

    const baseSnap = buildCompanionSnapshot(existing);
    const mergedSnap = sanitizeDraftPayload(existing, candidate);
    const diffs = computeCompanionFieldDiffs(baseSnap, mergedSnap);
    const protectedChanges = detectCoreIdentityChanges(
      {
        name: existing.name,
        slug: existing.slug,
        sex: existing.sex,
        backstory: existing.backstory,
        core_identity_locked: existing.core_identity_locked,
        personality_v2_json: existing.personality_v2_json,
      },
      {
        name: String(mergedSnap.name || existing.name),
        slug: String(mergedSnap.slug || existing.slug),
        sex: String(mergedSnap.sex || existing.sex),
        backstory: String(mergedSnap.backstory || ''),
        personality_v2_json: normalizePersonalityV2(mergedSnap.personality_v2_json),
      }
    );

    return {
      ok: true,
      dryRun: true,
      preview: {
        ok: true,
        dryRun: true,
        action: diffs.length > 0 ? 'update' : 'unchanged',
        slug: existing.slug,
        name: existing.name,
        diffCount: diffs.length,
        diffs,
        coreIdentityLocked: existing.core_identity_locked !== false,
        protectedChanges,
      },
    };
  }

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
      invalidateAllPlatformCaches();
      invalidateCompanionsCache();
    }
    return createRes;
  }

  if (options.mode === 'draft') {
    return saveCompanionDraft(existing.id, candidate, options.adminUserId, {
      enforceCoreLock: true,
      confirmCoreIdentityChange: confirmedUnlock,
      unlockCoreIdentity: confirmedUnlock,
    });
  }

  return publishCompanionDraft(existing.id, {
    draftInput: candidate,
    changeNote: 'Imported JSON configuration',
    confirmCoreIdentityChange: confirmedUnlock,
    unlockCoreIdentity: confirmedUnlock,
    adminUserId: options.adminUserId,
  });
}

export interface BulkImportPreviewItem {
  slug: string;
  name: string;
  action: 'create' | 'update' | 'unchanged' | 'error';
  diffCount: number;
  diffs: CompanionFieldDiff[];
  coreIdentityLocked: boolean;
  protectedChanges: CoreIdentityProtectedDiff[];
  error?: string;
}

export async function importBulkCompanionsBundle(
  rawBundle: unknown,
  options: {
    mode: 'draft' | 'publish';
    dryRun?: boolean;
    confirmCoreIdentityChange?: boolean;
    unlockCoreIdentity?: boolean;
    adminUserId?: string | null;
  }
): Promise<{
  ok: boolean;
  dryRun?: boolean;
  error?: string;
  updated: number;
  created: number;
  drafted: number;
  skippedProtected: Array<{ slug: string; name: string; protectedChanges: CoreIdentityProtectedDiff[] }>;
  errors: Array<{ slug: string; error: string }>;
  totalProcessed: number;
  preview?: {
    wouldCreate: number;
    wouldUpdate: number;
    unchanged: number;
    protectedCount: number;
    errorCount: number;
    specializationsIncluded: number;
    items: BulkImportPreviewItem[];
  };
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

  const obj = Array.isArray(rawBundle)
    ? { companions: rawBundle }
    : stripUnsafeJsonKeys(rawBundle as Record<string, unknown>);
  const list = Array.isArray(obj.companions) ? obj.companions : null;

  if (!list || list.length === 0) {
    return { ...emptyResult, error: 'No companions array found in JSON bundle.' };
  }
  if (list.length > 200) {
    return { ...emptyResult, error: 'Bulk import is capped at 200 companions per batch.' };
  }

  const existingAll = await getAllCompanionsServerCached();
  const bySlug = new Map(existingAll.map((c) => [c.slug.toLowerCase(), c]));
  const confirmedUnlock = Boolean(
    options.confirmCoreIdentityChange || options.unlockCoreIdentity
  );

  if (options.dryRun) {
    const items: BulkImportPreviewItem[] = [];
    let wouldCreate = 0;
    let wouldUpdate = 0;
    let unchanged = 0;
    let protectedCount = 0;
    let errorCount = 0;

    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errorCount++;
        items.push({
          slug: 'invalid',
          name: 'Invalid entry',
          action: 'error',
          diffCount: 0,
          diffs: [],
          coreIdentityLocked: false,
          protectedChanges: [],
          error: 'Item is not a valid object.',
        });
        continue;
      }
      const rec = stripUnsafeJsonKeys(item as Record<string, unknown>);
      const name = String(rec.name || '').trim();
      const slug = String(rec.slug || '').trim().toLowerCase();
      if (!name) {
        errorCount++;
        items.push({
          slug: slug || 'missing_slug',
          name: '(missing name)',
          action: 'error',
          diffCount: 0,
          diffs: [],
          coreIdentityLocked: false,
          protectedChanges: [],
          error: 'Missing required "name" field.',
        });
        continue;
      }

      const existing = slug ? bySlug.get(slug) : undefined;
      if (!existing) {
        wouldCreate++;
        items.push({
          slug:
            slug ||
            name
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, '_')
              .slice(0, 64),
          name,
          action: 'create',
          diffCount: Object.keys(rec).length,
          diffs: [
            {
              field: 'slug',
              label: 'New Companion',
              category: 'profile',
              before: '(new)',
              after: name,
            },
          ],
          coreIdentityLocked: rec.core_identity_locked !== false,
          protectedChanges: [],
        });
        continue;
      }

      const baseSnap = buildCompanionSnapshot(existing);
      const mergedSnap = sanitizeDraftPayload(existing, rec);
      const diffs = computeCompanionFieldDiffs(baseSnap, mergedSnap);
      const protectedChanges = detectCoreIdentityChanges(
        {
          name: existing.name,
          slug: existing.slug,
          sex: existing.sex,
          backstory: existing.backstory,
          core_identity_locked: existing.core_identity_locked,
          personality_v2_json: existing.personality_v2_json,
        },
        {
          name: String(mergedSnap.name || existing.name),
          slug: String(mergedSnap.slug || existing.slug),
          sex: String(mergedSnap.sex || existing.sex),
          backstory: String(mergedSnap.backstory || ''),
          personality_v2_json: normalizePersonalityV2(mergedSnap.personality_v2_json),
        }
      );

      if (protectedChanges.length > 0) protectedCount++;
      if (diffs.length > 0) wouldUpdate++;
      else unchanged++;

      items.push({
        slug: existing.slug,
        name: existing.name,
        action: diffs.length > 0 ? 'update' : 'unchanged',
        diffCount: diffs.length,
        diffs,
        coreIdentityLocked: existing.core_identity_locked !== false,
        protectedChanges,
      });
    }

    return {
      ok: true,
      dryRun: true,
      updated: 0,
      created: 0,
      drafted: 0,
      skippedProtected: [],
      errors: [],
      totalProcessed: list.length,
      preview: {
        wouldCreate,
        wouldUpdate,
        unchanged,
        protectedCount,
        errorCount,
        specializationsIncluded: Array.isArray(obj.specializations) ? obj.specializations.length : 0,
        items,
      },
    };
  }

  // Optionally update specializations taxonomy if included in bundle
  if (Array.isArray(obj.specializations) && obj.specializations.length > 0) {
    await saveCompanionSpecializations(obj.specializations, options.adminUserId);
  }

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
    const rec = stripUnsafeJsonKeys(item as Record<string, unknown>);
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
      const res = await saveCompanionDraft(existing.id, rec, options.adminUserId, {
        enforceCoreLock: true,
        confirmCoreIdentityChange: confirmedUnlock,
        unlockCoreIdentity: confirmedUnlock,
      });
      if (res.ok) {
        drafted++;
      } else if (res.code === 'CORE_IDENTITY_PROTECTED') {
        skippedProtected.push({
          slug: existing.slug,
          name: existing.name,
          protectedChanges: res.protectedChanges || [],
        });
      } else {
        errors.push({ slug: existing.slug, error: res.error || 'Failed to save draft' });
      }
    } else {
      const res = await publishCompanionDraft(existing.id, {
        draftInput: rec,
        changeNote: 'Bulk JSON import',
        confirmCoreIdentityChange: confirmedUnlock,
        unlockCoreIdentity: confirmedUnlock,
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

  invalidateAllPlatformCaches();
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
  adminUserId?: string | null,
  options?: { dryRun?: boolean }
): Promise<{
  ok: boolean;
  dryRun?: boolean;
  error?: string;
  changedKeys?: string[];
  diffs?: CompanionFieldDiff[];
  bundle?: GlobalCompanionIntelligenceBundle;
}> {
  if (!rawBundle || typeof rawBundle !== 'object' || Array.isArray(rawBundle)) {
    return { ok: false, error: 'Global companion config JSON must be an object.' };
  }
  const obj = stripUnsafeJsonKeys(rawBundle as Record<string, unknown>);
  const current = await getEnginePromptOverrides();
  const baselineBundle = await exportGlobalCompanionBundle();
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
  const changedKeys: string[] = [];
  const diffs: CompanionFieldDiff[] = [];

  for (const key of stringFields) {
    if (typeof obj[key] === 'string') {
      const val = (obj[key] as string).trim();
      const prevVal = String(baselineBundle[key] || '');
      if (val) {
        next[key] = val.slice(0, 12000);
      } else {
        delete next[key];
      }
      if (val !== prevVal) {
        changedKeys.push(key);
        diffs.push({
          field: key,
          label: key,
          category: 'core_identity',
          before: prevVal.slice(0, 120) || '(empty)',
          after: val.slice(0, 120) || '(cleared -> default)',
        });
      }
      touched = true;
    }
  }

  if (
    obj.companion_skill_rules &&
    typeof obj.companion_skill_rules === 'object' &&
    !Array.isArray(obj.companion_skill_rules)
  ) {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.companion_skill_rules as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) merged[k] = v.trim().slice(0, 8000);
    }
    if (Object.keys(merged).length > 0) {
      if (JSON.stringify(merged) !== JSON.stringify(baselineBundle.companion_skill_rules)) {
        changedKeys.push('companion_skill_rules');
        diffs.push({
          field: 'companion_skill_rules',
          label: 'Skill Rules Map',
          category: 'specialist',
          before: `${Object.keys(baselineBundle.companion_skill_rules).length} skill rules`,
          after: `${Object.keys(merged).length} skill rules`,
        });
      }
      next.companion_skill_rules = merged as EnginePromptOverrides['companion_skill_rules'];
      touched = true;
    }
  }

  if (
    obj.companion_group_configs &&
    typeof obj.companion_group_configs === 'object' &&
    !Array.isArray(obj.companion_group_configs)
  ) {
    if (
      JSON.stringify(obj.companion_group_configs) !==
      JSON.stringify(baselineBundle.companion_group_configs)
    ) {
      changedKeys.push('companion_group_configs');
      diffs.push({
        field: 'companion_group_configs',
        label: 'Pillar Group Configs',
        category: 'specialist',
        before: `${Object.keys(baselineBundle.companion_group_configs).length} groups`,
        after: `${Object.keys(obj.companion_group_configs as object).length} groups`,
      });
    }
    next.companion_group_configs =
      obj.companion_group_configs as EnginePromptOverrides['companion_group_configs'];
    touched = true;
  }

  if (Array.isArray(obj.companion_archetypes) && obj.companion_archetypes.length > 0) {
    if (
      JSON.stringify(obj.companion_archetypes) !==
      JSON.stringify(baselineBundle.companion_archetypes)
    ) {
      changedKeys.push('companion_archetypes');
      diffs.push({
        field: 'companion_archetypes',
        label: 'Companion Archetypes',
        category: 'core_identity',
        before: `${baselineBundle.companion_archetypes.length} archetypes`,
        after: `${obj.companion_archetypes.length} archetypes`,
      });
    }
    next.companion_archetypes =
      obj.companion_archetypes as EnginePromptOverrides['companion_archetypes'];
    touched = true;
  }

  if (Array.isArray(obj.companion_specializations) && obj.companion_specializations.length > 0) {
    const cleanedSpecs = sanitizeSpecializationTags(obj.companion_specializations);
    if (cleanedSpecs.length > 0) {
      if (
        JSON.stringify(cleanedSpecs) !== JSON.stringify(baselineBundle.companion_specializations)
      ) {
        changedKeys.push('companion_specializations');
        diffs.push({
          field: 'companion_specializations',
          label: 'Specialization Taxonomy',
          category: 'specialist',
          before: `${baselineBundle.companion_specializations.length} specializations`,
          after: `${cleanedSpecs.length} specializations`,
        });
      }
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

  if (options?.dryRun) {
    return {
      ok: true,
      dryRun: true,
      changedKeys,
      diffs,
    };
  }

  const saved = await savePlatformSetting('engine_prompt_overrides', next, adminUserId);
  if (!saved.ok) {
    return { ok: false, error: saved.error || 'Failed to save imported global config.' };
  }
  invalidateAllPlatformCaches();
  invalidateCompanionsCache();
  return {
    ok: true,
    changedKeys,
    diffs,
    bundle: await exportGlobalCompanionBundle(),
  };
}

// ---------------- Admin Companion Testing Studio (Zero DB Side-Effects) ----------------

function snapshotToPresetRecord(
  base: CompanionPresetRecord,
  snapshot: Record<string, unknown>
): CompanionPresetRecord {
  const merged: CompanionPresetRecord = {
    ...base,
    name: typeof snapshot.name === 'string' && snapshot.name ? snapshot.name : base.name,
    slug: typeof snapshot.slug === 'string' && snapshot.slug ? snapshot.slug : base.slug,
    age: typeof snapshot.age === 'number' ? snapshot.age : base.age,
    sex: (snapshot.sex as CompanionPresetRecord['sex']) || base.sex,
    tagline: typeof snapshot.tagline === 'string' ? snapshot.tagline : base.tagline,
    card_subtitle:
      typeof snapshot.card_subtitle === 'string' ? snapshot.card_subtitle : base.card_subtitle,
    short_bio: typeof snapshot.short_bio === 'string' ? snapshot.short_bio : base.short_bio,
    full_bio: typeof snapshot.full_bio === 'string' ? snapshot.full_bio : base.full_bio,
    how_conversations_feel:
      typeof snapshot.how_conversations_feel === 'string'
        ? snapshot.how_conversations_feel
        : base.how_conversations_feel,
    primary_expertise:
      typeof snapshot.primary_expertise === 'string'
        ? snapshot.primary_expertise
        : base.primary_expertise,
    secondary_expertise: Array.isArray(snapshot.secondary_expertise)
      ? (snapshot.secondary_expertise as string[])
      : base.secondary_expertise,
    category_tag:
      (snapshot.category_tag as CompanionPresetRecord['category_tag']) || base.category_tag,
    companion_group:
      (snapshot.companion_group as CompanionPresetRecord['companion_group']) ||
      base.companion_group,
    advisory_mode:
      (snapshot.advisory_mode as CompanionPresetRecord['advisory_mode']) || base.advisory_mode,
    chart_access:
      snapshot.chart_access && typeof snapshot.chart_access === 'object'
        ? (snapshot.chart_access as CompanionPresetRecord['chart_access'])
        : base.chart_access,
    formula_cartridge_slugs: Array.isArray(snapshot.formula_cartridge_slugs)
      ? (snapshot.formula_cartridge_slugs as string[])
      : base.formula_cartridge_slugs,
    max_output_tokens:
      snapshot.max_output_tokens === null
        ? null
        : typeof snapshot.max_output_tokens === 'number'
        ? snapshot.max_output_tokens
        : base.max_output_tokens,
    discoverable_tags: Array.isArray(snapshot.discoverable_tags)
      ? (snapshot.discoverable_tags as string[])
      : base.discoverable_tags,
    situation_tags: Array.isArray(snapshot.situation_tags)
      ? (snapshot.situation_tags as string[])
      : base.situation_tags,
    specialization_slugs: Array.isArray(snapshot.specialization_slugs)
      ? (snapshot.specialization_slugs as string[])
      : base.specialization_slugs,
    override_group_rules:
      typeof snapshot.override_group_rules === 'boolean'
        ? snapshot.override_group_rules
        : base.override_group_rules,
    cultural_fluency:
      typeof snapshot.cultural_fluency === 'string'
        ? snapshot.cultural_fluency
        : base.cultural_fluency,
    avatar_url:
      snapshot.avatar_url === null
        ? null
        : typeof snapshot.avatar_url === 'string'
        ? snapshot.avatar_url
        : base.avatar_url,
    monogram_palette:
      snapshot.monogram_palette && typeof snapshot.monogram_palette === 'object'
        ? (snapshot.monogram_palette as CompanionPresetRecord['monogram_palette'])
        : base.monogram_palette,
    welcome_messages: Array.isArray(snapshot.welcome_messages)
      ? (snapshot.welcome_messages as string[])
      : base.welcome_messages,
    system_prompt:
      typeof snapshot.system_prompt === 'string' ? snapshot.system_prompt : base.system_prompt,
    backstory: typeof snapshot.backstory === 'string' ? snapshot.backstory : base.backstory,
    soul_consciousness:
      typeof snapshot.soul_consciousness === 'string'
        ? snapshot.soul_consciousness
        : base.soul_consciousness,
    hard_rules: typeof snapshot.hard_rules === 'string' ? snapshot.hard_rules : base.hard_rules,
    soft_rules: typeof snapshot.soft_rules === 'string' ? snapshot.soft_rules : base.soft_rules,
    autonomy_level:
      (snapshot.autonomy_level as CompanionPresetRecord['autonomy_level']) ||
      base.autonomy_level,
    override_global_rules:
      typeof snapshot.override_global_rules === 'boolean'
        ? snapshot.override_global_rules
        : base.override_global_rules,
    skill_level:
      (snapshot.skill_level as CompanionPresetRecord['skill_level']) || base.skill_level,
    chat_style: (snapshot.chat_style as CompanionPresetRecord['chat_style']) || base.chat_style,
    model_id:
      snapshot.model_id === null
        ? null
        : typeof snapshot.model_id === 'string'
        ? snapshot.model_id
        : base.model_id,
    tts_voice_profile:
      snapshot.tts_voice_profile && typeof snapshot.tts_voice_profile === 'object'
        ? (snapshot.tts_voice_profile as CompanionPresetRecord['tts_voice_profile'])
        : base.tts_voice_profile,
    supports_listening_cue:
      typeof snapshot.supports_listening_cue === 'boolean'
        ? snapshot.supports_listening_cue
        : base.supports_listening_cue,
    suggestions_enabled:
      typeof snapshot.suggestions_enabled === 'boolean'
        ? snapshot.suggestions_enabled
        : base.suggestions_enabled,
    is_active: typeof snapshot.is_active === 'boolean' ? snapshot.is_active : base.is_active,
    sort_order: typeof snapshot.sort_order === 'number' ? snapshot.sort_order : base.sort_order,
    core_identity_locked:
      typeof snapshot.core_identity_locked === 'boolean'
        ? snapshot.core_identity_locked
        : base.core_identity_locked,
    personality_v2_json:
      snapshot.personality_v2_json !== undefined
        ? normalizePersonalityV2(snapshot.personality_v2_json)
        : base.personality_v2_json,
  };
  merged.personality_v2_json = ensureCompanionV2Initialized(merged);
  return merged;
}

export async function resolveCompanionPresetForTesting(params: {
  slug: string;
  targetStage?: 'draft' | 'published';
  draftOverride?: Record<string, unknown> | null;
}): Promise<{
  preset: CompanionPresetRecord;
  resolvedStage: 'draft' | 'published' | 'benchmark';
  hasStagedDraft: boolean;
} | null> {
  const cleanSlug = String(params.slug || '').trim();
  if (!cleanSlug) return null;

  if (cleanSlug === ASTRA_MOON_BENCHMARK_SLUG || cleanSlug.toLowerCase() === 'astra_moon_benchmark') {
    return {
      preset: getAstraMoonBenchmarkPreset(),
      resolvedStage: 'benchmark',
      hasStagedDraft: false,
    };
  }

  const existing = await findAdminCompanionByIdOrSlug(cleanSlug);
  if (!existing) return null;

  const hasStagedDraft = Boolean(existing.has_unpublished_draft || existing.draft_payload_json);
  const wantDraft = params.targetStage !== 'published';

  if (!wantDraft) {
    return {
      preset: {
        ...existing,
        personality_v2_json: ensureCompanionV2Initialized(existing),
      },
      resolvedStage: 'published',
      hasStagedDraft,
    };
  }

  let working = { ...existing };
  if (existing.draft_payload_json && typeof existing.draft_payload_json === 'object') {
    const draftSnap = sanitizeDraftPayload(working, existing.draft_payload_json);
    working = snapshotToPresetRecord(working, draftSnap);
  }
  if (params.draftOverride && typeof params.draftOverride === 'object' && !Array.isArray(params.draftOverride)) {
    const overrideSnap = sanitizeDraftPayload(working, params.draftOverride);
    working = snapshotToPresetRecord(working, overrideSnap);
  }

  return {
    preset: working,
    resolvedStage: 'draft',
    hasStagedDraft,
  };
}

export interface AdminTestTurnInput {
  slug: string;
  targetStage?: 'draft' | 'published';
  draftOverride?: Record<string, unknown> | null;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  simulation?: CompanionStudioSimulationConfig;
  compareWithStageOrSlug?:
    | string
    | {
        slug?: string;
        targetStage?: 'draft' | 'published';
      }
    | null;
  runLiveModel?: boolean;
}

export interface AdminTestTurnResponse {
  ok: true;
  zeroDbSideEffects: true;
  primaryStage: 'draft' | 'published' | 'benchmark';
  primaryHasStagedDraft: boolean;
  primary: CompanionSandboxResult;
  comparison?: {
    stage: 'draft' | 'published' | 'benchmark';
    result: CompanionSandboxResult;
  } | null;
}

export async function executeAdminCompanionTestTurn(
  input: AdminTestTurnInput
): Promise<
  | AdminTestTurnResponse
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const cleanedMessages = Array.isArray(input.messages)
    ? input.messages
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim().length > 0
        )
        .slice(-24)
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 6000) }))
    : [];

  if (cleanedMessages.length === 0) {
    return { ok: false, status: 400, error: 'Provide at least one user message to test.' };
  }

  const primaryResolved = await resolveCompanionPresetForTesting({
    slug: input.slug,
    targetStage: input.targetStage === 'published' ? 'published' : 'draft',
    draftOverride: input.draftOverride || null,
  });
  if (!primaryResolved) {
    return { ok: false, status: 404, error: `Companion "${input.slug}" not found.` };
  }

  let comparisonResolved: Awaited<ReturnType<typeof resolveCompanionPresetForTesting>> = null;
  if (input.compareWithStageOrSlug) {
    if (typeof input.compareWithStageOrSlug === 'string') {
      const targetStr = input.compareWithStageOrSlug.trim();
      if (targetStr === 'draft' || targetStr === 'published') {
        comparisonResolved = await resolveCompanionPresetForTesting({
          slug: input.slug,
          targetStage: targetStr,
          draftOverride: targetStr === 'draft' ? input.draftOverride || null : null,
        });
      } else if (targetStr) {
        comparisonResolved = await resolveCompanionPresetForTesting({
          slug: targetStr,
          targetStage: 'published',
        });
      }
    } else if (typeof input.compareWithStageOrSlug === 'object') {
      const cmpSlug = String(input.compareWithStageOrSlug.slug || input.slug).trim();
      const cmpStage =
        input.compareWithStageOrSlug.targetStage === 'draft' ? 'draft' : 'published';
      comparisonResolved = await resolveCompanionPresetForTesting({
        slug: cmpSlug,
        targetStage: cmpStage,
      });
    }
  }

  const allCompanions = await getAllCompanionsServerCached();
  const referrableCompanions: ReferrableCompanionSummary[] = allCompanions
    .filter((c) => c.is_active)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      primary_expertise: c.primary_expertise,
    }));

  const runLiveModel = input.runLiveModel !== false;

  const [primaryResult, comparisonResult] = await Promise.all([
    runCompanionStudioTestTurn({
      preset: primaryResolved.preset,
      messages: cleanedMessages,
      simulation: input.simulation,
      referrableCompanions,
      runLiveModel,
      gracefulMissingKey: true,
    }),
    comparisonResolved
      ? runCompanionStudioTestTurn({
          preset: comparisonResolved.preset,
          messages: cleanedMessages,
          simulation: input.simulation,
          referrableCompanions,
          runLiveModel,
          gracefulMissingKey: true,
        })
      : Promise.resolve(null),
  ]);

  return {
    ok: true,
    zeroDbSideEffects: true,
    primaryStage: primaryResolved.resolvedStage,
    primaryHasStagedDraft: primaryResolved.hasStagedDraft,
    primary: primaryResult,
    comparison:
      comparisonResolved && comparisonResult
        ? {
            stage: comparisonResolved.resolvedStage,
            result: comparisonResult,
          }
        : null,
  };
}

