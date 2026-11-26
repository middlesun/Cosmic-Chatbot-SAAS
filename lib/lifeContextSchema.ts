export type BirthTimeAccuracy =
  | 'hospital_exact'
  | 'family_memory'
  | 'approximate'
  | 'sunrise_unknown';

export type RelationshipContextStatus =
  | 'single'
  | 'dating_committed'
  | 'engaged'
  | 'married_no_children'
  | 'married_with_children'
  | 'divorced_separated'
  | 'widowed';

export type CareerContextMode =
  | 'job_salaried'
  | 'business_owner'
  | 'freelancer_consultant'
  | 'hybrid_job_and_business'
  | 'student'
  | 'homemaker'
  | 'career_break_pivot'
  | 'retired';

export type LocationContextStatus =
  | 'hometown'
  | 'relocated_same_country'
  | 'living_abroad'
  | 'living_abroad_temp'
  | 'planning_move';

export interface LifeContextChild {
  gender: 'male' | 'female';
  birth_year: number;
  optional_birth_date?: string; // YYYY-MM-DD
  optional_birth_time?: string; // HH:MM
  optional_birth_place?: string;
}

export interface LifeContextAnchor {
  year: number;
  tag: string;
  note?: string;
  cited_by?: string;
  cited_slug?: string;
}

export type CitedInsightCategory =
  | 'workplace'
  | 'family_children'
  | 'desire_dream'
  | 'worry_problem'
  | 'relationship'
  | 'emotional_pattern'
  | 'practical_life'
  | 'spiritual';

export interface CitedProfileInsight {
  id: string;
  category: CitedInsightCategory;
  summary: string;
  fact?: string;
  cited_by: string;
  cited_slug?: string;
  is_factual_life_fact?: boolean;
  conversation_id?: string | null;
  captured_at?: string;
  updated_at?: string;
}

export type DeepProfileBucketKey =
  | 'practical_reality'
  | 'emotional_triggers'
  | 'core_insecurities'
  | 'coping_patterns'
  | 'stress_areas'
  | 'desires_and_goals'
  | 'active_dilemmas'
  | 'relationship_dynamics'
  | 'communication_preferences'
  | 'habits_and_routines'
  | 'values_and_principles';

export interface DeepProfileEntry {
  id: string;
  category: CitedInsightCategory;
  bucket?: DeepProfileBucketKey;
  fact: string;
  source_label: string;
  source_slug: string;
  is_factual_life_fact?: boolean;
  conversation_id: string | null;
  captured_at: string;
  updated_at: string;
}

export interface DeepProfileData {
  practical_reality?: string[];
  emotional_triggers?: string[];
  core_insecurities?: string[];
  coping_patterns?: string[];
  stress_areas?: string[];
  desires_and_goals?: string[];
  active_dilemmas?: string[];
  relationship_dynamics?: string[];
  communication_preferences?: string[];
  habits_and_routines?: string[];
  values_and_principles?: string[];
  entries?: DeepProfileEntry[];
  updated_at?: string;
}

export interface UserContextPreferences {
  memory_paused: boolean;
  allow_cross_companion_memory: boolean;
}

export const DEFAULT_USER_CONTEXT_PREFERENCES: UserContextPreferences = {
  memory_paused: false,
  allow_cross_companion_memory: true,
};

export type ConversationThreadKind = 'chat' | 'journal' | 'checkin' | 'goal_review';

export interface CouncilAnalystNote {
  id: string;
  summary: string;
  system_label: string;
  system_slug: string;
  conversation_id: string | null;
  captured_at: string;
}

export interface LifeContextData {
  birth_time_accuracy?: BirthTimeAccuracy;
  relationship_status?: RelationshipContextStatus;
  marriage_year?: number;
  has_children?: boolean;
  children?: LifeContextChild[];
  children_summary?: string;
  career_mode?: CareerContextMode;
  career_role?: string;
  workplace_context?: string;
  location_status?: LocationContextStatus;
  past_anchors?: LifeContextAnchor[];
  core_stress_areas?: string[];
  cited_insights?: CitedProfileInsight[];
  updated_at?: string;
}

export const DEEP_PROFILE_BUCKET_LABELS: Record<DeepProfileBucketKey, string> = {
  practical_reality: 'Practical Reality',
  emotional_triggers: 'Emotional Triggers',
  core_insecurities: 'Core Sensitivities',
  coping_patterns: 'Coping Habits',
  stress_areas: 'Recurring Stressors',
  desires_and_goals: 'Desires & Dreams',
  active_dilemmas: 'Active Dilemmas',
  relationship_dynamics: 'Relationship Dynamics',
  communication_preferences: 'Conversation Style',
  habits_and_routines: 'Habits & Daily Rhythm',
  values_and_principles: 'Values & Inner Compass',
};

export const CITED_INSIGHT_CATEGORY_LABELS: Record<CitedInsightCategory, string> = {
  workplace: 'Work & Craft',
  family_children: 'Family & Children',
  desire_dream: 'Desires & Dreams',
  worry_problem: 'Concerns & Friction',
  relationship: 'Relationships',
  emotional_pattern: 'Inner Pattern',
  practical_life: 'Daily Life',
  spiritual: 'Values & Inner Path',
};

export const VALID_CITED_INSIGHT_CATEGORIES = new Set<string>(
  Object.keys(CITED_INSIGHT_CATEGORY_LABELS)
);

export const LIFE_CONTEXT_FRAMING_COPY =
  "For a genuinely accurate reading, your real-world context and major turning points matter as much as your birth time. Add what you're comfortable sharing.";

export const BIRTH_TIME_ACCURACY_OPTIONS: Array<{
  value: BirthTimeAccuracy;
  label: string;
  hint: string;
}> = [
  {
    value: 'hospital_exact',
    label: 'Hospital record / Exact (within 5 min)',
    hint: 'Supports minute-sensitive KP Sub-Lords & fine Divisional charts',
  },
  {
    value: 'family_memory',
    label: 'Family memory (±15 min)',
    hint: 'Reliable D1/D9; borderline cusps interpreted carefully',
  },
  {
    value: 'approximate',
    label: 'Approximate (±1 hour)',
    hint: 'Shifts focus toward Moon chart, Dashas & slower house rulers',
  },
  {
    value: 'sunrise_unknown',
    label: 'Sunrise / Unknown exact time',
    hint: 'Uses Chandra Lagna (Moon) & planetary periods honestly',
  },
];

export const RELATIONSHIP_STATUS_OPTIONS: Array<{
  value: RelationshipContextStatus;
  label: string;
  hint: string;
}> = [
  { value: 'single', label: 'Single', hint: 'Open / unattached' },
  { value: 'dating_committed', label: 'In a committed relationship', hint: 'Dating / long-term partner' },
  { value: 'engaged', label: 'Engaged', hint: 'Preparing for marriage' },
  { value: 'married_no_children', label: 'Married (no children)', hint: 'Partnered without children' },
  { value: 'married_with_children', label: 'Married with children', hint: 'Parent & spouse context' },
  { value: 'divorced_separated', label: 'Divorced or separated', hint: 'Navigating reset or second chapter' },
  { value: 'widowed', label: 'Widowed', hint: 'Past marriage chapter honored' },
];

export const CAREER_MODE_OPTIONS: Array<{
  value: CareerContextMode;
  label: string;
  hint: string;
}> = [
  { value: 'job_salaried', label: 'Salaried Job / Corporate / Public Service', hint: '6th & 10th house service dynamics' },
  { value: 'business_owner', label: 'Business Owner / Founder', hint: '7th, 3rd & 11th independent enterprise' },
  { value: 'freelancer_consultant', label: 'Freelancer / Independent Practice', hint: 'Self-driven advisory or creative income' },
  { value: 'hybrid_job_and_business', label: 'Job + Side Business / Transition', hint: 'Balancing employment and venture' },
  { value: 'student', label: 'Student / Preparing for Exams', hint: '4th, 5th, 9th & D24 study cycles' },
  { value: 'homemaker', label: 'Homemaker / Family Caregiver', hint: '4th & 2nd house household stewardship' },
  { value: 'career_break_pivot', label: 'Career Break / Active Pivot', hint: 'Reinvention or returning to work' },
  { value: 'retired', label: 'Retired / Senior Advisory', hint: 'Legacy, wealth preservation & wisdom' },
];

export const LOCATION_STATUS_OPTIONS: Array<{
  value: LocationContextStatus;
  label: string;
  hint: string;
}> = [
  { value: 'hometown', label: 'Living in birth city / home region', hint: '4th house roots intact' },
  { value: 'relocated_same_country', label: 'Relocated within home country', hint: 'Domestic 3rd/4th relocation shift' },
  { value: 'living_abroad', label: 'Settled abroad (long-term)', hint: '9th/12th foreign settlement active' },
  { value: 'living_abroad_temp', label: 'Living abroad temporarily (study / work visa)', hint: 'Visa & permanence windows active' },
  { value: 'planning_move', label: 'Exploring or planning relocation', hint: 'Evaluating 4th/9th/12th timing' },
];

export const PAST_ANCHOR_TAG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'married', label: 'Marriage' },
  { value: 'child_born', label: 'Child Born' },
  { value: 'career_shift', label: 'Major Career Shift' },
  { value: 'business_launch', label: 'Started Business' },
  { value: 'moved_abroad', label: 'Moved Abroad' },
  { value: 'property_purchase', label: 'Bought Home / Property' },
  { value: 'education_milestone', label: 'Degree / Exam Milestone' },
  { value: 'health_recovery', label: 'Health Turning Point' },
  { value: 'separation_reset', label: 'Separation / Major Reset' },
  { value: 'bereavement_loss', label: 'Family Loss / Bereavement' },
  { value: 'relationship_milestone', label: 'Major Relationship Milestone' },
  { value: 'windfall_breakthrough', label: 'Financial Breakthrough' },
];

export const VALID_BIRTH_TIME_ACCURACIES = new Set<string>(
  BIRTH_TIME_ACCURACY_OPTIONS.map((o) => o.value)
);
export const VALID_RELATIONSHIP_STATUSES = new Set<string>(
  RELATIONSHIP_STATUS_OPTIONS.map((o) => o.value)
);
export const VALID_CAREER_MODES = new Set<string>(
  CAREER_MODE_OPTIONS.map((o) => o.value)
);
export const VALID_LOCATION_STATUSES = new Set<string>(
  LOCATION_STATUS_OPTIONS.map((o) => o.value)
);
export const VALID_ANCHOR_TAGS = new Set<string>(
  PAST_ANCHOR_TAG_OPTIONS.map((o) => o.value)
);

const NO_CHILDREN_AUTO_STATUSES = new Set<RelationshipContextStatus>([
  'single',
  'dating_committed',
  'engaged',
  'married_no_children',
]);

/**
 * Exact weighted completeness score (0-100):
 * - birth_time_accuracy: 20%
 * - relationship_status: 25%
 * - children (conditional): 15%
 * - career_mode: 20%
 * - location_status: 10%
 * - past_anchors: 10%
 */
export function computeLifeContextCompleteness(raw?: LifeContextData | null): number {
  if (!raw || typeof raw !== 'object') return 0;

  let score = 0;

  if (raw.birth_time_accuracy && VALID_BIRTH_TIME_ACCURACIES.has(raw.birth_time_accuracy)) {
    score += 20;
  }

  const relValid = Boolean(
    raw.relationship_status && VALID_RELATIONSHIP_STATUSES.has(raw.relationship_status)
  );
  if (relValid) {
    score += 25;
  }

  const childrenList = Array.isArray(raw.children) ? raw.children : [];
  if (raw.relationship_status === 'married_with_children' || raw.has_children === true) {
    if (childrenList.length >= 1) {
      score += 15;
    }
  } else if (relValid && raw.relationship_status && NO_CHILDREN_AUTO_STATUSES.has(raw.relationship_status)) {
    // Auto-awarded cleanly for non-parent statuses
    score += 15;
  } else if (
    (raw.relationship_status === 'divorced_separated' || raw.relationship_status === 'widowed') &&
    (raw.has_children === false || childrenList.length >= 1)
  ) {
    score += 15;
  }

  if (raw.career_mode && VALID_CAREER_MODES.has(raw.career_mode)) {
    score += 20;
  }

  if (raw.location_status && VALID_LOCATION_STATUSES.has(raw.location_status)) {
    score += 10;
  }

  if (Array.isArray(raw.past_anchors) && raw.past_anchors.length >= 1) {
    score += 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isMarriedRelationshipStatus(status?: string | null): boolean {
  return status === 'married_no_children' || status === 'married_with_children';
}

export function formatLifeContextSummary(raw?: LifeContextData | null): string {
  if (!raw || typeof raw !== 'object') return '';
  const parts: string[] = [];

  const rel = RELATIONSHIP_STATUS_OPTIONS.find((o) => o.value === raw.relationship_status);
  if (rel) {
    parts.push(
      raw.marriage_year && isMarriedRelationshipStatus(raw.relationship_status)
        ? `${rel.label} (since ${raw.marriage_year})`
        : rel.label
    );
  }
  if (Array.isArray(raw.children) && raw.children.length > 0) {
    const kidsDesc = raw.children
      .map((c) => `${c.gender === 'male' ? 'Son' : 'Daughter'} (${c.birth_year})`)
      .join(', ');
    parts.push(`Children: ${kidsDesc}`);
  }
  const career = CAREER_MODE_OPTIONS.find((o) => o.value === raw.career_mode);
  if (career) {
    parts.push(raw.career_role ? `${career.label} — ${raw.career_role}` : career.label);
  }
  const loc = LOCATION_STATUS_OPTIONS.find((o) => o.value === raw.location_status);
  if (loc) parts.push(loc.label);

  const bta = BIRTH_TIME_ACCURACY_OPTIONS.find((o) => o.value === raw.birth_time_accuracy);
  if (bta) parts.push(`Birth time: ${bta.label}`);

  if (Array.isArray(raw.past_anchors) && raw.past_anchors.length > 0) {
    const anchors = raw.past_anchors
      .slice(0, 4)
      .map((a) => `${a.year}: ${a.tag.replace(/_/g, ' ')}`)
      .join('; ');
    parts.push(`Past milestones: ${anchors}`);
  }

  return parts.join(' | ');
}

export function countLivingContextSignals(
  lifeCtx?: LifeContextData | null,
  deepProfile?: DeepProfileData | null
): number {
  let count = 0;
  if (lifeCtx && typeof lifeCtx === 'object') {
    if (lifeCtx.relationship_status) count += 1;
    if (lifeCtx.career_mode || lifeCtx.career_role || lifeCtx.workplace_context) count += 1;
    if (lifeCtx.location_status) count += 1;
    if (Array.isArray(lifeCtx.children) && lifeCtx.children.length > 0) count += 1;
    if (Array.isArray(lifeCtx.past_anchors)) count += lifeCtx.past_anchors.length;
    if (Array.isArray(lifeCtx.core_stress_areas)) count += lifeCtx.core_stress_areas.length;
    if (Array.isArray(lifeCtx.cited_insights)) count += lifeCtx.cited_insights.length;
  }
  if (deepProfile && typeof deepProfile === 'object') {
    if (Array.isArray(deepProfile.entries) && deepProfile.entries.length > 0) {
      count += deepProfile.entries.length;
    } else {
      for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
        if (Array.isArray(deepProfile[key])) {
          count += deepProfile[key]!.length;
        }
      }
    }
  }
  return count;
}
