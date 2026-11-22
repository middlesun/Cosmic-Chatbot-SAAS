import type { LifeContextData } from './lifeContextSchema';

export const DEFAULT_COUNCIL_EXPERT_SLUG = 'vedic_astrologer';

/**
 * Normalizes legacy and current Vedic Astrologer expert slugs to the canonical
 * `'vedic_astrologer'` identifier while preserving any other valid expert slug.
 */
export function normalizeCouncilSlug(slug?: string | null): string {
  const cleaned = typeof slug === 'string' ? slug.trim() : '';
  if (!cleaned) return DEFAULT_COUNCIL_EXPERT_SLUG;
  if (cleaned.toLowerCase() === 'council_synthesis') {
    return DEFAULT_COUNCIL_EXPERT_SLUG;
  }
  return cleaned;
}

export function isVedicAstrologerSlug(slug?: string | null): boolean {
  return normalizeCouncilSlug(slug) === DEFAULT_COUNCIL_EXPERT_SLUG;
}

export type VedicIntentArchetype =
  | 'CONVERSATIONAL'
  | 'SOFT_HORIZON'
  | 'HARD_DECISION'
  | 'TIMING'
  | 'PEER_AUDIT';

export type UserFluencyTier = 'beginner' | 'guided_bridge' | 'practitioner';

export type Stage1ProviderUsed = 'jev' | 'openrouter_fallback' | 'rule_guard';

export interface Stage1RouterResult {
  playbook_id: string;
  playbook_confidence: number;
  intent: VedicIntentArchetype;
  intent_confidence: number;
  detected_user_fluency: UserFluencyTier;
  is_prompt_extraction: boolean;
  prompt_extraction_prob?: number;
  needs_clarification: boolean;
  needs_clarification_prob?: number;
  requires_synastry_partner: boolean;
  synastry_prob?: number;
  requests_remedy_or_guidance: boolean;
  complexity_intensity: number; // 2..10
  provider_used: Stage1ProviderUsed;
  model_used?: string;
  latency_ms: number;
}

export interface ClarificationChip {
  id: string;
  label: string;
  clarifiedQuestion: string;
  contextPatch?: Partial<LifeContextData>;
  playbookId?: string;
  action?: 'send' | 'open_partner_picker';
}

export interface ClarificationPayload {
  kind: 'trap_mismatch' | 'missing_context' | 'ambiguous_intent' | 'partner_required';
  trapId?: string | null;
  message: string;
  originalQuestion?: string;
  chips: ClarificationChip[];
}

export interface VedicSynthesisMeta {
  tradition?: 'vedic' | 'western';
  intent: VedicIntentArchetype;
  playbookId: string;
  domain: string;
  convergencePillarsAligned: number;
  convergenceBandLabel: string;
  effectiveFluency: UserFluencyTier;
  isDeepAudit: boolean;
  lensesSucceeded?: number;
  cancellationsCount: number;
  reductionPct?: number;
}

export interface VedicUserProfile {
  inferred_fluency: UserFluencyTier;
  recurring_domains: string[];
  domain_weights?: Record<string, number>;
  core_stress_areas?: string[];
  preferred_tradition?: 'vedic' | 'western' | 'dual';
  last_updated_at: string;
}

export type TimingWidgetId =
  | 'md'
  | 'ad'
  | 'pd'
  | 'saturn'
  | 'jupiter'
  | 'rahu_ketu'
  | 'profection'
  | 'progressed_moon'
  | 'w_saturn'
  | 'w_jupiter';

export interface TimingProgressWidget {
  id: TimingWidgetId;
  kind: 'dasha' | 'transit';
  title: string;
  previous: { label: string };
  current: {
    label: string;
    startDateIso: string;
    endDateIso: string;
    startDisplay: string;
    endDisplay: string;
    percentElapsed: number;
    daysLeft: number;
  };
  next: { label: string };
}
