import {
  computeLifeContextCompleteness,
  VALID_ANCHOR_TAGS,
  VALID_BIRTH_TIME_ACCURACIES,
  VALID_CAREER_MODES,
  VALID_LOCATION_STATUSES,
  VALID_RELATIONSHIP_STATUSES,
  type BirthTimeAccuracy,
  type CareerContextMode,
  type LifeContextAnchor,
  type LifeContextChild,
  type LifeContextData,
  type LocationContextStatus,
  type RelationshipContextStatus,
} from '../../lib/lifeContextSchema';
import type { ClarificationPayload } from '../../lib/sutraTypes';

export type {
  BirthTimeAccuracy,
  CareerContextMode,
  LifeContextAnchor,
  LifeContextChild,
  LifeContextData,
  LocationContextStatus,
  RelationshipContextStatus,
};
export { computeLifeContextCompleteness };

const MAX_CHILDREN = 10;
const MAX_ANCHORS = 10;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function clampYear(val: unknown, min = 1920, max = new Date().getFullYear() + 1): number | undefined {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isInteger(num) || num < min || num > max) return undefined;
  return num;
}

function cleanShortText(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const cleaned = val
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned || undefined;
}

/**
 * Validates and sanitizes an incoming Desh-Kaal-Patra life_context_json payload.
 * Drops unknown keys or invalid enums safely while preserving intentional clears.
 */
export function sanitizeLifeContext(rawInput: unknown): {
  sanitized: LifeContextData;
  completeness: number;
} {
  const src =
    rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};

  const sanitized: LifeContextData = {};

  if (
    typeof src.birth_time_accuracy === 'string' &&
    VALID_BIRTH_TIME_ACCURACIES.has(src.birth_time_accuracy)
  ) {
    sanitized.birth_time_accuracy = src.birth_time_accuracy as BirthTimeAccuracy;
  }

  if (
    typeof src.relationship_status === 'string' &&
    VALID_RELATIONSHIP_STATUSES.has(src.relationship_status)
  ) {
    sanitized.relationship_status = src.relationship_status as RelationshipContextStatus;
  }

  const marriageYear = clampYear(src.marriage_year, 1940);
  if (marriageYear !== undefined) {
    sanitized.marriage_year = marriageYear;
  }

  if (typeof src.has_children === 'boolean') {
    sanitized.has_children = src.has_children;
  }

  if (Array.isArray(src.children)) {
    const cleanedChildren: LifeContextChild[] = [];
    for (const item of src.children) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const gender = row.gender === 'male' || row.gender === 'female' ? row.gender : null;
      const birthYear = clampYear(row.birth_year, 1940);
      if (!gender || birthYear === undefined) continue;

      const entry: LifeContextChild = {
        gender,
        birth_year: birthYear,
      };
      if (typeof row.optional_birth_date === 'string' && ISO_DATE_RE.test(row.optional_birth_date.trim())) {
        entry.optional_birth_date = row.optional_birth_date.trim();
      }
      if (typeof row.optional_birth_time === 'string' && TIME_24H_RE.test(row.optional_birth_time.trim())) {
        entry.optional_birth_time = row.optional_birth_time.trim().slice(0, 5);
      }
      const birthPlace = cleanShortText(row.optional_birth_place, 80);
      if (birthPlace) {
        entry.optional_birth_place = birthPlace;
      }

      cleanedChildren.push(entry);
      if (cleanedChildren.length >= MAX_CHILDREN) break;
    }
    if (cleanedChildren.length > 0) {
      sanitized.children = cleanedChildren;
      if (sanitized.has_children === undefined) {
        sanitized.has_children = true;
      }
    }
  }

  if (sanitized.relationship_status === 'married_with_children') {
    sanitized.has_children = true;
  }

  if (typeof src.career_mode === 'string' && VALID_CAREER_MODES.has(src.career_mode)) {
    sanitized.career_mode = src.career_mode as CareerContextMode;
  }

  const careerRole = cleanShortText(src.career_role, 100);
  if (careerRole) {
    sanitized.career_role = careerRole;
  }

  if (typeof src.location_status === 'string' && VALID_LOCATION_STATUSES.has(src.location_status)) {
    sanitized.location_status = src.location_status as LocationContextStatus;
  }

  if (Array.isArray(src.past_anchors)) {
    const cleanedAnchors: LifeContextAnchor[] = [];
    for (const item of src.past_anchors) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const year = clampYear(row.year, 1930);
      const rawTag = typeof row.tag === 'string' ? row.tag.trim() : '';
      const safeTag = VALID_ANCHOR_TAGS.has(rawTag)
        ? rawTag
        : cleanShortText(rawTag, 32)?.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      if (year === undefined || !safeTag) continue;

      const anchor: LifeContextAnchor = { year, tag: safeTag };
      const note = cleanShortText(row.note, 80);
      if (note) anchor.note = note;
      cleanedAnchors.push(anchor);
      if (cleanedAnchors.length >= MAX_ANCHORS) break;
    }
    if (cleanedAnchors.length > 0) {
      cleanedAnchors.sort((a, b) => a.year - b.year);
      sanitized.past_anchors = cleanedAnchors;
    }
  }

  sanitized.updated_at = new Date().toISOString();

  const completeness = computeLifeContextCompleteness(sanitized);
  return { sanitized, completeness };
}

/**
 * Merges a partial patch (such as from an in-chat clarification chip in Phase 3)
 * onto existing life_context_json and recalculates completeness safely.
 */
export function mergeLifeContextPatch(
  existingRaw: unknown,
  patchRaw: Partial<LifeContextData>
): { sanitized: LifeContextData; completeness: number } {
  const existing =
    existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
      ? (existingRaw as Record<string, unknown>)
      : {};
  return sanitizeLifeContext({
    ...existing,
    ...patchRaw,
  });
}

export interface ContextTrapCheckResult {
  triggered: boolean;
  trapId:
    | 'MARRIED_ASKING_FIRST_MARRIAGE'
    | 'HAS_CHILDREN_ASKING_IF_CHILDREN'
    | 'MISSING_MARRIAGE_STATUS'
    | 'MISSING_CAREER_MODE'
    | 'BUSINESS_OR_RETIRED_JOB_QUESTION'
    | 'ALREADY_ABROAD_ASKING_IF_MOVING'
    | 'BIRTH_TIME_PRECISION_CAUTION'
    | null;
  requiresClarificationPause: boolean;
  promptNote?: string;
  clarification?: ClarificationPayload;
}

const FIRST_MARRIAGE_PHRASE_RE =
  /\bwhen will i get married\b|\bwill i (?:ever )?get married\b|\bwhen is my marriage\b|\bmarriage timing\b|\blove or arranged\b|\barranged or love\b|\bwhy is my marriage delayed\b/i;
const EXPLICIT_PAST_OR_SECOND_MARRIAGE_RE =
  /\b(?:past|first|current|existing|second)\s+marriage\b|\bmarriage evolution\b|\bverify\b|\bremarriage\b|\bdivorce\b/i;
const EXPLICIT_STATUS_IN_PROMPT_RE =
  /\b(?:i am |i'm )?(?:single|unmarried|married|divorced|separated|engaged|widowed|dating)\b/i;
const EXPLICIT_CAREER_MODE_IN_PROMPT_RE =
  /\b(?:salaried|my own business|startup|freelanc|self[- ]employed|student|retired|homemaker|unemployed|laid off)\b/i;

/**
 * Deterministic 0ms Desh-Kaal-Patra reality check & trap guard.
 * Catches contradictions (e.g. married user asking "When will I get married?")
 * and missing anchor context without interrogating the user.
 */
export function detectContextTrapMismatch(
  playbookId: string,
  lifeContext: LifeContextData | null | undefined,
  userPrompt: string,
  options?: { isFollowUpTurn?: boolean }
): ContextTrapCheckResult {
  const ctx = lifeContext || {};
  const prompt = (userPrompt || '').trim();
  const playbook = (playbookId || '').trim().toUpperCase();
  const isFollowUp = Boolean(options?.isFollowUpTurn);

  const isMarried =
    ctx.relationship_status === 'married_no_children' ||
    ctx.relationship_status === 'married_with_children';

  // 1. Married user asking first-marriage timing/likelihood
  if (
    isMarried &&
    !EXPLICIT_PAST_OR_SECOND_MARRIAGE_RE.test(prompt) &&
    (['MAR_01', 'MAR_02', 'MAR_04', 'MAR_09'].includes(playbook) ||
      FIRST_MARRIAGE_PHRASE_RE.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'MARRIED_ASKING_FIRST_MARRIAGE',
      requiresClarificationPause: true,
      clarification: {
        kind: 'trap_mismatch',
        trapId: 'MARRIED_ASKING_FIRST_MARRIAGE',
        message:
          "I see your profile notes you're already married. Would you like to verify your past marriage window against the chart, explore how your current partnership evolves next, or ask about a second chapter?",
        chips: [
          {
            id: 'verify_past_marriage',
            label: 'Verify my past marriage window',
            playbookId: 'TIM_11',
            clarifiedQuestion:
              'Please verify my past marriage window against my Vimshottari Dasha and transits to check chart timing accuracy.',
          },
          {
            id: 'current_marriage_evolution',
            label: 'Ask about current marriage evolution',
            playbookId: 'MAR_03',
            clarifiedQuestion:
              'How does my current married life and partnership harmony evolve over the coming Dasha and transit periods?',
          },
          {
            id: 'second_marriage_chapter',
            label: 'Second marriage / new chapter',
            playbookId: 'MAR_29',
            clarifiedQuestion:
              'Looking candidly at my chart, what do my Dashas and Navamsa indicate about separation or a second marriage / new chapter ahead?',
          },
        ],
      },
    };
  }

  // 2. Parent asking "Will I have children?"
  const hasExistingChildren =
    ctx.has_children === true ||
    ctx.relationship_status === 'married_with_children' ||
    (Array.isArray(ctx.children) && ctx.children.length > 0);

  if (
    hasExistingChildren &&
    (playbook === 'PRO_01' ||
      playbook === 'MAR_18' ||
      /\bwill i have (?:a )?(?:child|children|kids|baby)\b|\bwhen will i have children\b/i.test(prompt))
  ) {
    const childNote =
      Array.isArray(ctx.children) && ctx.children.length > 0
        ? `User already has ${ctx.children.length} child(ren) (${ctx.children
            .map((c) => `${c.gender} born ${c.birth_year}`)
            .join(', ')}).`
        : 'User profile notes existing child(ren).';

    if (/\b(?:second|another|more|bond|relationship with|existing)\b/i.test(prompt)) {
      return {
        triggered: true,
        trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
        requiresClarificationPause: false,
        promptNote: `${childNote} Anchor guidance directly in the requested bond or planning for an additional child.`,
      };
    }

    return {
      triggered: true,
      trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
      requiresClarificationPause: true,
      promptNote: childNote,
      clarification: {
        kind: 'trap_mismatch',
        trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
        message:
          'Your profile notes you already have children. Would you like to focus on your bond and milestones with them, or are you asking about planning another child?',
        chips: [
          {
            id: 'progeny_existing_bond',
            label: 'Bond & milestones with child(ren)',
            playbookId: 'PRO_05',
            clarifiedQuestion:
              'How does my chart describe my bond with my child(ren) and their upcoming supportive milestones?',
          },
          {
            id: 'progeny_second_child',
            label: 'Planning another child',
            playbookId: 'PRO_06',
            clarifiedQuestion:
              'What does my D1 and D7 Saptamsha suggest about planning another child and timing windows?',
          },
          {
            id: 'progeny_verify_past',
            label: 'Verify past child timing',
            playbookId: 'TIM_11',
            clarifiedQuestion:
              'Can you cross-check the birth year(s) of my child(ren) against my 5th house, D7, and Dasha periods?',
          },
        ],
      },
    };
  }

  // 3. Missing Marital Status on marriage-timing / love vs arranged / delay questions
  if (
    !ctx.relationship_status &&
    !isFollowUp &&
    !EXPLICIT_STATUS_IN_PROMPT_RE.test(prompt) &&
    ['MAR_01', 'MAR_02', 'MAR_04', 'MAR_08', 'MAR_09', 'MAR_12'].includes(playbook)
  ) {
    const cleanQ = prompt || 'What does my chart show about marriage?';
    return {
      triggered: true,
      trapId: 'MISSING_MARRIAGE_STATUS',
      requiresClarificationPause: true,
      clarification: {
        kind: 'missing_context',
        trapId: 'MISSING_MARRIAGE_STATUS',
        message:
          'To anchor this reading in your real-life situation, what is your relationship status right now?',
        chips: [
          {
            id: 'status_single',
            label: 'Single',
            contextPatch: { relationship_status: 'single' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'status_dating',
            label: 'In a relationship',
            contextPatch: { relationship_status: 'dating_committed' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'status_married',
            label: 'Married',
            contextPatch: { relationship_status: 'married_no_children' },
            playbookId: playbook === 'MAR_02' ? 'MAR_03' : playbook,
            clarifiedQuestion:
              playbook === 'MAR_02'
                ? 'I am already married — please verify my marriage timing on the chart and share how my current marriage evolves next.'
                : cleanQ,
          },
          {
            id: 'status_divorced',
            label: 'Divorced / Separated',
            contextPatch: { relationship_status: 'divorced_separated' },
            playbookId: playbook === 'MAR_02' ? 'MAR_29' : playbook,
            clarifiedQuestion: cleanQ,
          },
        ],
      },
    };
  }

  // 4. Missing Career Mode on career trajectory / switch / promotion questions
  if (
    !ctx.career_mode &&
    !EXPLICIT_CAREER_MODE_IN_PROMPT_RE.test(prompt) &&
    ['CAR_01', 'CAR_02', 'CAR_03', 'CAR_04', 'CAR_05', 'CAR_09', 'WLT_06'].includes(playbook) &&
    (!isFollowUp || playbook === 'CAR_01' || playbook === 'CAR_04')
  ) {
    const cleanQ = prompt || 'How will my career unfold?';
    return {
      triggered: true,
      trapId: 'MISSING_CAREER_MODE',
      requiresClarificationPause: true,
      clarification: {
        kind: 'missing_context',
        trapId: 'MISSING_CAREER_MODE',
        message:
          'To give you an honest read on your career direction and timing, which best describes your current work setup?',
        chips: [
          {
            id: 'career_salaried',
            label: 'Salaried Job',
            contextPatch: { career_mode: 'job_salaried' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'career_business',
            label: 'Own Business / Freelance',
            contextPatch: { career_mode: 'business_owner' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'career_switching_student',
            label: 'Switching / Student',
            contextPatch: { career_mode: 'career_break_pivot' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
        ],
      },
    };
  }

  // 5. Business owner / retired person asking corporate job/promotion question -> auto-adapt prompt note
  if (
    (ctx.career_mode === 'business_owner' || ctx.career_mode === 'retired') &&
    (['CAR_02', 'CAR_03', 'CAR_04', 'CAR_09'].includes(playbook) ||
      /\bquit my job\b|\bpromotion at work\b|\bjob switch\b/i.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'BUSINESS_OR_RETIRED_JOB_QUESTION',
      requiresClarificationPause: false,
      promptNote:
        ctx.career_mode === 'business_owner'
          ? 'User is a business owner — frame vocation via 7H/3H/11H enterprise leadership rather than salaried corporate employment.'
          : 'User is retired — frame career/purpose via advisory legacy, capital stewardship, and active peaceful routine rather than corporate job moves.',
    };
  }

  // 6. User already settled abroad asking about moving abroad -> auto-adapt to permanence vs homeland
  if (
    ctx.location_status === 'living_abroad' &&
    (playbook === 'FOR_01' || /\bmove abroad\b|\bgo abroad\b|\bsettle abroad\b/i.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'ALREADY_ABROAD_ASKING_IF_MOVING',
      requiresClarificationPause: false,
      promptNote:
        'User is already settled abroad — address residency stability, civic permanence, career roots abroad, or homeland visits rather than predicting an initial move.',
    };
  }

  // 7. Approximate / unknown birth time caution
  if (ctx.birth_time_accuracy === 'approximate' || ctx.birth_time_accuracy === 'sunrise_unknown') {
    return {
      triggered: true,
      trapId: 'BIRTH_TIME_PRECISION_CAUTION',
      requiresClarificationPause: false,
      promptNote:
        'Birth time accuracy is approximate/unknown — anchor insights in Moon sign (Chandra Lagna), planetary strengths, and broader Vimshottari Mahadasha/Antardasha without over-claiming minute-sensitive KP Sub-Lords or borderline Varga Lagna shifts.',
    };
  }

  return { triggered: false, trapId: null, requiresClarificationPause: false };
}

/**
 * Backward-compatible Phase 2 alias consumed by callers that only pass partial options.
 */
export function evaluateLifeContextGuardHints(
  lifeContext: LifeContextData | null | undefined,
  opts?: { userPrompt?: string; playbookId?: string; isFollowUpTurn?: boolean }
): ContextTrapCheckResult {
  return detectContextTrapMismatch(
    opts?.playbookId || '',
    lifeContext,
    opts?.userPrompt || '',
    { isFollowUpTurn: opts?.isFollowUpTurn }
  );
}
