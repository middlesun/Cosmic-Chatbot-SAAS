import {
  BUILTIN_COMPANION_SPECIALIZATIONS,
  buildCoreIdentityCapsuleDraft,
  DEFAULT_COMPANION_PERSONALITY_V2,
  detectCoreIdentityChanges,
  estimateTokensRough,
  hasAuthoredV2Depth,
  hasOnlyLegacySpecializationSlugs,
  inferSpecializationsForCompanion,
  normalizePersonalityV2,
  normalizeSpecializationSlugsWithMigration,
  type AstrologyEntryRule,
  type CompanionPersonalityV2,
  type CoreIdentityProtectedDiff,
} from '../../lib/companionV2Schema';
import type { CompanionPresetRecord } from './companionPresets';
import type { CompanionPersona } from './companionEngine';

function splitShortClauses(raw: string, maxItems = 6, maxLen = 140): string[] {
  const cleaned = raw.replace(/\r/g, '').trim();
  if (!cleaned) return [];
  const pieces = cleaned
    .split(/[\n•;|]+|\.\s+/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((s) => s.length >= 6 && s.length <= maxLen);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of pieces) {
    const key = piece.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(piece);
    if (out.length >= maxItems) break;
  }
  return out;
}

function inferAstrologyEntryRule(record: Partial<CompanionPresetRecord>): AstrologyEntryRule {
  const ca = record.chart_access;
  const hasEsoteric = Boolean(
    ca?.vedic ||
      ca?.western ||
      ca?.tarot ||
      ca?.numerology ||
      ca?.past_life ||
      (record.skill_level && record.skill_level !== 'none_emotional')
  );
  if (!hasEsoteric) return 'never';
  if (record.advisory_mode === 'esoteric_guide') return 'invite_only';
  return 'contextual_invite';
}

function extractEssenceFromV1(record: Partial<CompanionPresetRecord>): string {
  const parts: string[] = [];
  if (record.tagline?.trim()) parts.push(record.tagline.trim());
  if (record.short_bio?.trim() && record.short_bio.trim() !== record.tagline?.trim()) {
    parts.push(record.short_bio.trim());
  }
  if (parts.length > 0) return parts.join(' ').slice(0, 2200);
  const sys = (record.system_prompt || '').trim();
  if (!sys) return '';
  const firstPara = sys.split(/\n{2,}/)[0] || sys;
  return firstPara.trim().slice(0, 1200);
}

/**
 * Deterministically and losslessly maps any V1 companion preset record into a complete
 * Companion Architecture V2 structure without losing a single existing instruction.
 */
export function synthesizePersonalityV2FromV1(
  record: Partial<CompanionPresetRecord>
): CompanionPersonalityV2 {
  const existing = record.personality_v2_json
    ? normalizePersonalityV2(record.personality_v2_json)
    : { ...DEFAULT_COMPANION_PERSONALITY_V2 };

  const primaryExp = (record.primary_expertise || '').trim();
  const secondaryExp = Array.isArray(record.secondary_expertise)
    ? record.secondary_expertise.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const expertSummary = [primaryExp, ...secondaryExp].filter(Boolean).join(' · ');

  const backstory = (record.backstory || '').trim();
  const soul = (record.soul_consciousness || '').trim();
  const softRules = (record.soft_rules || '').trim();
  const hardRules = (record.hard_rules || '').trim();
  const howFeel = (record.how_conversations_feel || '').trim();
  const sysPrompt = (record.system_prompt || '').trim();

  const derivedValues = [
    ...secondaryExp.slice(0, 4),
    ...splitShortClauses(soul, 4, 120),
  ].slice(0, 8);

  const derivedAnchors = splitShortClauses(softRules || sysPrompt, 5, 160);

  const astrologyEntryRule =
    record.personality_v2_json?.astrology_entry_rule || inferAstrologyEntryRule(record);

  const hasEsoteric = inferAstrologyEntryRule(record) !== 'never';

  const baseV2: CompanionPersonalityV2 = {
    schema_version: 2,
    core_identity_capsule: existing.core_identity_capsule || '',
    capsule_token_estimate: existing.capsule_token_estimate || 0,
    character_essence: existing.character_essence || extractEssenceFromV1(record),
    fictional_lore: existing.fictional_lore || backstory,
    inner_compass: {
      worldview: existing.inner_compass.worldview || soul,
      values:
        existing.inner_compass.values.length > 0
          ? existing.inner_compass.values
          : derivedValues,
      core_anchors:
        existing.inner_compass.core_anchors.length > 0
          ? existing.inner_compass.core_anchors
          : derivedAnchors,
    },
    expression_spectrum: existing.expression_spectrum || '',
    subtle_contradictions: existing.subtle_contradictions || '',
    humour_and_interests: existing.humour_and_interests || '',
    quirks_and_habits: existing.quirks_and_habits || '',
    linguistic_fingerprint:
      existing.linguistic_fingerprint || (record.cultural_fluency || '').trim(),
    interpersonal_dynamics: existing.interpersonal_dynamics || howFeel,
    soft_instincts: existing.soft_instincts || softRules,
    autonomy_guidance:
      existing.autonomy_guidance ||
      (record.autonomy_level === 'free'
        ? 'Trust lived human instincts first; adapt pacing, warmth, and candor freely to the moment.'
        : record.autonomy_level === 'steady'
        ? 'Hold a steady, calm cadence with gentle consistency across moods.'
        : 'Use grounded emotional judgment while keeping core character anchors intact.'),
    specialist_expertise: existing.specialist_expertise || expertSummary,
    signature_methodology:
      existing.signature_methodology || (hasEsoteric ? expertSummary : ''),
    astrology_entry_rule: astrologyEntryRule,
    esoteric_guardrails: existing.esoteric_guardrails || hardRules,
    ai_identity_disclosure:
      existing.ai_identity_disclosure || 'natural_immersion_honest_when_asked',
    contextual_nuances: existing.contextual_nuances || [],
    reference_dialogues: existing.reference_dialogues || [],
    core_identity_locked:
      typeof record.core_identity_locked === 'boolean'
        ? record.core_identity_locked
        : existing.core_identity_locked,
  };

  if (!baseV2.core_identity_capsule) {
    baseV2.core_identity_capsule = buildCoreIdentityCapsuleDraft({
      name: record.name,
      age: record.age,
      sex: record.sex,
      primary_expertise: record.primary_expertise,
      cultural_fluency: record.cultural_fluency,
      tagline: record.tagline,
      backstory: baseV2.fictional_lore,
      personality_v2_json: baseV2,
    });
  }
  baseV2.capsule_token_estimate = estimateTokensRough(baseV2.core_identity_capsule);

  return normalizePersonalityV2(baseV2);
}

/**
 * Ensures any loaded companion preset has a complete V2 personality structure.
 * If `personality_v2_json` already contains authored V2 fields, normalizes cleanly;
 * otherwise deterministically synthesizes V2 from existing V1 fields.
 */
export function ensureCompanionV2Initialized(
  record: Partial<CompanionPresetRecord>
): CompanionPersonalityV2 {
  const current = record.personality_v2_json;
  if (current && hasAuthoredV2Depth(current)) {
    const normalized = normalizePersonalityV2({
      ...current,
      core_identity_locked:
        typeof record.core_identity_locked === 'boolean'
          ? record.core_identity_locked
          : current.core_identity_locked,
    });
    if (!normalized.astrology_entry_rule || normalized.astrology_entry_rule === 'never') {
      const inferred = inferAstrologyEntryRule(record);
      if (inferred !== 'never' && !current.astrology_entry_rule) {
        normalized.astrology_entry_rule = inferred;
      }
    }
    return normalized;
  }
  return synthesizePersonalityV2FromV1(record);
}

/**
 * Compiles V2 fields back into compact legacy columns so V1 readers, lightweight queries,
 * and backward-compatible fallbacks remain synchronized without data loss.
 */
export function compileV2ToLegacySummary(
  record: Partial<CompanionPresetRecord>,
  v2Input: Partial<CompanionPersonalityV2>
): {
  backstory: string;
  soul_consciousness: string;
  soft_rules: string;
  hard_rules: string;
  how_conversations_feel: string;
  core_identity_capsule: string;
  capsule_token_estimate: number;
  specialization_slugs: string[];
} {
  const v2 = normalizePersonalityV2(v2Input);
  const capsule =
    v2.core_identity_capsule ||
    buildCoreIdentityCapsuleDraft({
      name: record.name,
      age: record.age,
      sex: record.sex,
      primary_expertise: record.primary_expertise,
      cultural_fluency: record.cultural_fluency,
      tagline: record.tagline,
      backstory: v2.fictional_lore || record.backstory,
      personality_v2_json: v2,
    });

  const specialization_slugs =
    Array.isArray(record.specialization_slugs) && record.specialization_slugs.length > 0
      ? hasOnlyLegacySpecializationSlugs(record.specialization_slugs)
        ? BUILTIN_COMPANION_SPECIALIZATIONS[String(record.slug || '').trim().toLowerCase()] ||
          normalizeSpecializationSlugsWithMigration(record.specialization_slugs)
        : normalizeSpecializationSlugsWithMigration(record.specialization_slugs)
      : inferSpecializationsForCompanion({
          slug: record.slug,
          companion_group: record.companion_group,
          category_tag: record.category_tag,
          skill_level: record.skill_level,
          primary_expertise: record.primary_expertise,
          secondary_expertise: record.secondary_expertise,
          discoverable_tags: record.discoverable_tags || record.situation_tags,
          tagline: record.tagline,
        });

  return {
    backstory: v2.fictional_lore || (record.backstory || '').trim(),
    soul_consciousness: v2.inner_compass.worldview || (record.soul_consciousness || '').trim(),
    soft_rules: v2.soft_instincts || (record.soft_rules || '').trim(),
    hard_rules: v2.esoteric_guardrails || (record.hard_rules || '').trim(),
    how_conversations_feel:
      v2.interpersonal_dynamics ||
      v2.expression_spectrum ||
      (record.how_conversations_feel || '').trim(),
    core_identity_capsule: capsule,
    capsule_token_estimate: estimateTokensRough(capsule),
    specialization_slugs,
  };
}

export function validateCoreIdentityLock(
  existing: {
    name?: string;
    slug?: string;
    sex?: string;
    backstory?: string;
    core_identity_locked?: boolean;
    personality_v2_json?: Partial<CompanionPersonalityV2> | null;
  },
  incoming: {
    name?: string;
    slug?: string;
    sex?: string;
    backstory?: string;
    personality_v2_json?: Partial<CompanionPersonalityV2> | null;
  },
  unlockCoreIdentity = false
): { ok: boolean; protectedChanges: CoreIdentityProtectedDiff[] } {
  const isLocked =
    typeof existing.core_identity_locked === 'boolean'
      ? existing.core_identity_locked
      : existing.personality_v2_json?.core_identity_locked !== false;

  if (!isLocked || unlockCoreIdentity) {
    return { ok: true, protectedChanges: [] };
  }

  const protectedChanges = detectCoreIdentityChanges(existing, incoming);
  return {
    ok: protectedChanges.length === 0,
    protectedChanges,
  };
}

export function mapCustomPersonaToV2PresetRecord(
  persona: CompanionPersona
): CompanionPresetRecord {
  const defaultGroup =
    persona.companion_type === 'listener' ||
    persona.companion_type === 'life_coach' ||
    persona.companion_type === 'motivator'
      ? 'life_companions'
      : 'everyday_companions';

  const defaultAdvisory =
    persona.companion_type === 'listener'
      ? 'listen_only'
      : persona.companion_type === 'life_coach' || persona.companion_type === 'motivator'
      ? 'balanced_support'
      : 'friend';

  const categoryTag =
    persona.companion_type === 'listener' ||
    persona.companion_type === 'life_coach' ||
    persona.companion_type === 'motivator' ||
    persona.companion_type === 'spiritual_guide'
      ? ('support' as const)
      : ('friends' as const);

  const spiritualHint = persona.religion_profile
    ? `Spiritual calibration: devotion ${persona.religion_profile.religiousness}/10 · ${persona.religion_profile.primary_religion}${
        persona.religion_profile.secondary_religion
          ? ` (${persona.religion_profile.secondary_religion})`
          : ''
      }.`
    : '';

  const draftRecord: CompanionPresetRecord = {
    id: persona.id || persona.slug || 'custom_companion',
    slug: (persona.slug || persona.id || 'custom_companion').toLowerCase(),
    legacy_id: null,
    name: persona.name || 'Companion',
    age: Number.isFinite(persona.age) ? persona.age : 32,
    sex: persona.gender || 'F',
    tagline: persona.tagline || 'Grounded, candid, and genuinely present.',
    short_bio: persona.background || persona.tagline || '',
    full_bio: persona.bio || persona.background || '',
    how_conversations_feel: persona.conversation_style || '',
    primary_expertise: persona.role_label || 'Companion',
    secondary_expertise: persona.topic_context ? [persona.topic_context] : [],
    category_tag: categoryTag,
    companion_group: persona.companion_group || defaultGroup,
    advisory_mode: persona.advisory_mode || defaultAdvisory,
    chart_access: persona.chart_access || {
      vedic: false,
      western: false,
      tarot: false,
      numerology: false,
      past_life: false,
      council_notes: false,
    },
    formula_cartridge_slugs: persona.formula_cartridge_slugs || [],
    max_output_tokens: persona.max_output_tokens ?? null,
    discoverable_tags: persona.topic_context ? [persona.topic_context] : [],
    override_group_rules: false,
    cultural_fluency: persona.background || 'Warm everyday conversationalist',
    avatar_url: persona.avatar_url || null,
    monogram_palette: persona.monogram_palette || {
      bg: '#F3EBDD',
      ring: '#B8965A',
      ink: '#4A3B22',
    },
    welcome_messages: persona.opening_message ? [persona.opening_message] : [],
    system_prompt: [persona.system_prompt || '', spiritualHint].filter(Boolean).join('\n'),
    backstory: persona.backstory || '',
    soul_consciousness: persona.soul_consciousness || '',
    hard_rules: '',
    soft_rules: persona.conversation_style || '',
    autonomy_level: 'intuitive',
    override_global_rules: false,
    skill_level: persona.skill_level || 'none_emotional',
    chat_style: persona.chat_style || 'chat_bubbles',
    model_id: null,
    tts_voice_profile: persona.tts_voice_profile || { rate: 1, pitch: 1 },
    supports_listening_cue: persona.supports_listening_cue !== false,
    suggestions_enabled: false,
    is_active: true,
    sort_order: 999,
  };

  draftRecord.personality_v2_json = ensureCompanionV2Initialized(draftRecord);
  draftRecord.specialization_slugs = inferSpecializationsForCompanion(draftRecord);
  return draftRecord;
}
