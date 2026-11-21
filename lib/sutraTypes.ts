import type { LifeContextData } from './lifeContextSchema';

export type SutraIntentArchetype =
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
  intent: SutraIntentArchetype;
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

export interface SutraSynthesisMeta {
  intent: SutraIntentArchetype;
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

export interface SutraUserProfile {
  inferred_fluency: UserFluencyTier;
  recurring_domains: string[];
  domain_weights?: Record<string, number>;
  core_stress_areas?: string[];
  preferred_tradition?: 'vedic' | 'western' | 'dual';
  last_updated_at: string;
}

