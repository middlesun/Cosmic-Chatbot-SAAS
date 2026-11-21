import type {
  SutraIntentArchetype,
  SutraSynthesisMeta,
  TimingProgressWidget,
  UserFluencyTier,
} from '../../lib/sutraTypes';
import type { CompiledChartData } from './chartCompiler';
import type { Stage2ContextPackage } from './contextSlicer';
import {
  DEFAULT_FLUENCY_INSTRUCTIONS,
  DEFAULT_FORMAT_CONTRACTS,
  DEFAULT_INTENT_OUTPUT_CONTRACTS,
  DEFAULT_SUTRA_ANTI_CLICHE_RULES,
  DEFAULT_SUTRA_TIER1_REASONING_LAWS,
} from './enginePromptDefaults';
import type { EnginePromptOverrides } from './platformSettings';

/**
 * Feature flag controlling decoupled Stage 4 Chart-Aligned Suggestions.
 * Flipped to `true` in Phase 6 so `chat.ts` invokes `suggestionEngine.ts`
 * cleanly without embedding `<<<SUGGESTIONS_JSON>>>` inside Stage 3 prose.
 */
export const USE_DECOUPLED_STAGE4_SUGGESTIONS = true;

export const TECH_BREAKDOWN_START = '<<<TECH_BREAKDOWN>>>';
export const TECH_BREAKDOWN_END = '<<<END_TECH_BREAKDOWN>>>';

const TECH_BREAKDOWN_FULL_RE = /<<<TECH_BREAKDOWN>>>([\s\S]*?)<<<END_TECH_BREAKDOWN>>>/i;
const TECH_BREAKDOWN_OPEN_RE = /<<<TECH_BREAKDOWN>>>([\s\S]*)$/i;
const TECH_BREAKDOWN_PARTIAL_RE = /<<<TECH_BREAKDOWN[\s\S]*$/i;

export function extractTechBreakdown(rawText: string): {
  mainText: string;
  techBreakdown: string | null;
} {
  if (!rawText) return { mainText: '', techBreakdown: null };

  let techBreakdown: string | null = null;
  const fullMatch = TECH_BREAKDOWN_FULL_RE.exec(rawText);
  if (fullMatch && typeof fullMatch[1] === 'string') {
    const cleaned = fullMatch[1].trim();
    if (cleaned.length >= 12) {
      techBreakdown = cleaned;
    }
  } else {
    const openMatch = TECH_BREAKDOWN_OPEN_RE.exec(rawText);
    if (openMatch && typeof openMatch[1] === 'string') {
      const cleaned = openMatch[1].replace(/<<<END_TECH_BREAKDOWN[\s\S]*$/i, '').trim();
      if (cleaned.length >= 24) {
        techBreakdown = cleaned;
      }
    }
  }

  const mainText = rawText
    .replace(TECH_BREAKDOWN_FULL_RE, '')
    .replace(TECH_BREAKDOWN_PARTIAL_RE, '')
    .replace(/\n{3,}$/g, '\n\n')
    .trim();

  return { mainText, techBreakdown };
}

export function buildShortReplyBreakdownInstruction(
  effectiveFluency: UserFluencyTier,
  languageSlug: string
): string {
  const depthHint =
    effectiveFluency === 'practitioner'
      ? 'Full concise Jyotish trace: exact D1 degrees/Nakshatra/Pada, D9/Varga sign/house/dignity, KP Sub-Lord, Shadbala/SAV bindus, and active MD/AD/PD + Gochar triggers.'
      : 'Clean, structured technical verification: key houses & house lords, Nakshatra/KP Sub-Lord confirmation, D9/D10 endurance check, Ashtakavarga bindus, and active Dasha/transit window dates.';

  return `SHORT-REPLY + COLLAPSIBLE TECHNICAL BREAKDOWN CONTRACT (ACTIVE BECAUSE SHORT REPLY IS ON):
1. First, deliver ONLY the concise, calm plain-English answer (120–210 words max). Keep the main answer completely readable for an everyday user without dumping raw degrees or long technical lists inside it.
2. Immediately AFTER finishing the main answer, emit ONE optional hidden technical breakdown block using these exact delimiters (never inside markdown code fences, and NEVER mention the delimiter tags in your prose):
${TECH_BREAKDOWN_START}
...compact bulleted technical verification (${depthHint}) in ${languageSlug || 'English'}...
${TECH_BREAKDOWN_END}
3. Enforce D1-only degrees: never invent or quote degrees inside D9 or other Vargas inside the breakdown.`;
}

export type SutraVoicePreset =
  | 'observatory_calm'
  | 'editor_reflective'
  | 'casual_confidant'
  | 'reluctant_genius';

export interface DeterministicConvergenceResult {
  alignedCount: number; // 0..5
  bandLabel: string;
  tierLabel: 'High Convergence' | 'Moderate-High Convergence' | 'Mixed / Conditional' | 'Low / Restrained';
  pillars: Array<{
    name: string;
    aligned: boolean;
    note: string;
  }>;
}

/**
 * Shared non-negotiable Tier 1 adjudicative laws from VEDIC_FORMULA_AND_PRIORITY_LIBRARY.md.
 */
export const SUTRA_TIER1_REASONING_LAWS = DEFAULT_SUTRA_TIER1_REASONING_LAWS;

export const SUTRA_ANTI_CLICHE_RULES = DEFAULT_SUTRA_ANTI_CLICHE_RULES;

/**
 * Deterministically checks 5 independent Jyotish pillars from Stage 2 + Chart Telemetry
 * so `X / 5 Pillars` convergence badges remain grounded in real data rather than hallucinated numbers.
 */
export function computeDeterministicPillarConvergence(
  pkg: Stage2ContextPackage,
  chart: CompiledChartData
): DeterministicConvergenceResult {
  const pillars: Array<{ name: string; aligned: boolean; note: string }> = [];

  // Pillar 1: D1 Structural Promise & Domain Audit
  const domainAudit = pkg.chartSlice.domainAudit as
    | { verdict?: string; pos?: number; fric?: number; promiseLevel?: string; physicalResilience?: number }
    | undefined;
  let p1Aligned = true;
  let p1Note = 'Baseline house structure available';
  if (domainAudit) {
    if (typeof domainAudit.pos === 'number' && typeof domainAudit.fric === 'number') {
      p1Aligned = domainAudit.pos >= domainAudit.fric - 8;
      p1Note = `${domainAudit.verdict || 'assessed'} (+${domainAudit.pos}/-${domainAudit.fric})`;
    } else if (typeof domainAudit.physicalResilience === 'number') {
      p1Aligned = domainAudit.physicalResilience >= 55;
      p1Note = `Resilience ${domainAudit.physicalResilience}/100`;
    } else if (domainAudit.promiseLevel) {
      p1Aligned = domainAudit.promiseLevel !== 'weak';
      p1Note = `Promise ${domainAudit.promiseLevel}`;
    }
  } else {
    const avgHouseScore =
      pkg.truthGateResolution.length > 0
        ? pkg.truthGateResolution.reduce((s, r) => s + r.houseScore, 0) /
          pkg.truthGateResolution.length
        : 60;
    p1Aligned = avgHouseScore >= 55;
    p1Note = `Avg house score ${Math.round(avgHouseScore)}/100`;
  }
  pillars.push({ name: 'D1 Promise', aligned: p1Aligned, note: p1Note });

  // Pillar 2: D9 Navamsa & Divisional Confirmation
  const hasD9Collapse = pkg.triggeredCancellations.some(
    (c) => c.code === 'D1_STRONG_D9_INVERSION'
  );
  const hasD9Uplift = pkg.triggeredCancellations.some(
    (c) => c.code === 'D1_WEAK_D9_UPLIFT' || c.code === 'VARGOTTAMA_LOCK'
  );
  const d9Amp = chart.planetaryHealth?.length
    ? chart.planetaryHealth.reduce((s, p) => s + (p.d9Modifier || 0), 0) /
      chart.planetaryHealth.length
    : 0;
  const p2Aligned = !hasD9Collapse && (hasD9Uplift || d9Amp >= -1);
  pillars.push({
    name: 'D9 / Vargas',
    aligned: p2Aligned,
    note: hasD9Collapse
      ? 'D1-D9 inversion noted'
      : hasD9Uplift
      ? 'D9 uplift/Vargottama reinforcement'
      : 'Inner endurance supportive',
  });

  // Pillar 3: Shadbala / PHI / Ashtakavarga Delivery Stamina
  const avgSav =
    pkg.truthGateResolution.length > 0
      ? pkg.truthGateResolution.reduce((s, r) => s + r.sav, 0) /
        pkg.truthGateResolution.length
      : 25;
  const hasLowSavOnly = pkg.triggeredCancellations.some((c) => c.code === 'SAV_LOW_BINDUS');
  const p3Aligned = avgSav >= 22 && !hasLowSavOnly;
  pillars.push({
    name: 'Delivery (PHI/SAV)',
    aligned: p3Aligned,
    note: `Avg SAV ${Math.round(avgSav)} bindus`,
  });

  // Pillar 4: KP Cuspal Sub-Lord Binary Gate
  const obstructedCount = pkg.truthGateResolution.filter((r) => r.kpVerdict === 'obstructed').length;
  const supportiveCount = pkg.truthGateResolution.filter(
    (r) => r.kpVerdict === 'supportive' || r.kpVerdict === 'conditional'
  ).length;
  const p4Aligned =
    pkg.truthGateResolution.length === 0
      ? true
      : supportiveCount >= Math.max(1, obstructedCount);
  pillars.push({
    name: 'KP Sub-Lord',
    aligned: p4Aligned,
    note: `${supportiveCount}/${Math.max(1, pkg.truthGateResolution.length)} focus cusps clear`,
  });

  // Pillar 5: Timing / Activation Window (Dasha & Double Transit)
  const timingObj = pkg.chartSlice.timing as { dt?: string[]; dasha?: string } | undefined;
  const hasDoubleTransit = Array.isArray(timingObj?.dt)
    ? timingObj.dt.some((row) => row.includes('DT_YES'))
    : false;
  const isSandhi = pkg.triggeredCancellations.some((c) => c.code === 'DASHA_SANDHI_WINDOW');
  const p5Aligned = timingObj
    ? hasDoubleTransit || (!isSandhi && Boolean(timingObj.dasha))
    : Boolean(chart.vimshottari?.currentStack);
  pillars.push({
    name: 'Dasha & Gochar',
    aligned: p5Aligned,
    note: hasDoubleTransit
      ? 'Double Transit active'
      : isSandhi
      ? 'Dasha Sandhi transition'
      : 'Dasha sequence aligned',
  });

  const alignedCount = pillars.filter((p) => p.aligned).length;
  const tierLabel =
    alignedCount >= 4
      ? 'High Convergence'
      : alignedCount === 3
      ? 'Moderate-High Convergence'
      : alignedCount === 2
      ? 'Mixed / Conditional'
      : 'Low / Restrained';

  return {
    alignedCount,
    bandLabel: `${alignedCount}/5 Pillars Aligned`,
    tierLabel,
    pillars,
  };
}

export function resolveEffectiveFluency(
  routerFluency: UserFluencyTier,
  toneMode: 'friendly' | 'technical',
  priorInferredFluency?: UserFluencyTier | null,
  hasTechnicalDirective?: boolean
): UserFluencyTier {
  // Explicit per-turn peer language or technical override leads cleanly,
  // while deeper_analysis directive clicks step +1 rung over baseline beginner.
  let baseline = routerFluency;
  if (
    priorInferredFluency &&
    routerFluency === 'beginner' &&
    priorInferredFluency !== 'beginner'
  ) {
    baseline = priorInferredFluency;
  }
  if (hasTechnicalDirective && baseline === 'beginner') {
    baseline = 'guided_bridge';
  }

  if (toneMode === 'friendly') {
    return baseline === 'practitioner' ? 'guided_bridge' : baseline === 'guided_bridge' && hasTechnicalDirective ? 'guided_bridge' : 'beginner';
  }
  return baseline === 'beginner' ? 'guided_bridge' : baseline;
}

export function buildFluencyInstruction(
  effectiveFluency: UserFluencyTier,
  responseLength: 'short' | 'detailed' = 'detailed',
  engineOverrides?: EnginePromptOverrides | null
): string {
  const custom = engineOverrides?.fluency_instructions;
  if (responseLength === 'short') {
    if (effectiveFluency === 'beginner') {
      return custom?.short_beginner?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.short_beginner;
    }
    if (effectiveFluency === 'guided_bridge') {
      return custom?.short_guided_bridge?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.short_guided_bridge;
    }
    return custom?.short_practitioner?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.short_practitioner;
  }

  if (effectiveFluency === 'beginner') {
    return custom?.detailed_beginner?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.detailed_beginner;
  }
  if (effectiveFluency === 'guided_bridge') {
    return custom?.detailed_guided_bridge?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.detailed_guided_bridge;
  }
  return custom?.detailed_practitioner?.trim() || DEFAULT_FLUENCY_INSTRUCTIONS.detailed_practitioner;
}

export function buildIntentOutputContract(
  intent: SutraIntentArchetype,
  convergence: DeterministicConvergenceResult,
  responseLength: 'short' | 'detailed',
  requiresTimingStack = false,
  engineOverrides?: EnginePromptOverrides | null
): string {
  const lengthHint =
    responseLength === 'short'
      ? 'Keep total length crisp (around 150–250 words) without losing the required contract structure.'
      : 'Keep depth well-paced, substantive, and easy to scan.';

  const mandatoryGocharClause =
    intent === 'TIMING' || requiresTimingStack
      ? `\n- MANDATORY GOCHAR & DOUBLE TRANSIT RULE: Explicitly reference current **Saturn** and **Jupiter** Gochar (transit) signs and house positions **counted from BOTH your Lagna (Ascendant) AND Natal Moon**, plus **Double Transit** activation on the relevant focus houses and SAV/BAV bindus from the timing slice.`
      : '';

  const convergenceLine = `**${convergence.bandLabel}** (${convergence.tierLabel}: ${convergence.pillars
    .map((p) => `${p.name}=${p.aligned ? 'Yes' : 'Caution'}`)
    .join(', ')})`;

  const customContracts = engineOverrides?.intent_output_contracts;
  const rawTemplate =
    (intent === 'SOFT_HORIZON' && (customContracts?.SOFT_HORIZON?.trim() || DEFAULT_INTENT_OUTPUT_CONTRACTS.SOFT_HORIZON)) ||
    (intent === 'HARD_DECISION' && (customContracts?.HARD_DECISION?.trim() || DEFAULT_INTENT_OUTPUT_CONTRACTS.HARD_DECISION)) ||
    (intent === 'TIMING' && (customContracts?.TIMING?.trim() || DEFAULT_INTENT_OUTPUT_CONTRACTS.TIMING)) ||
    (intent === 'PEER_AUDIT' && (customContracts?.PEER_AUDIT?.trim() || DEFAULT_INTENT_OUTPUT_CONTRACTS.PEER_AUDIT)) ||
    (customContracts?.CONVERSATIONAL?.trim() || DEFAULT_INTENT_OUTPUT_CONTRACTS.CONVERSATIONAL);

  return rawTemplate
    .replace(/\{\{LENGTH_HINT\}\}/g, lengthHint)
    .replace(/\{\{MANDATORY_GOCHAR_CLAUSE\}\}/g, mandatoryGocharClause)
    .replace(/\{\{CONVERGENCE_LINE\}\}/g, convergenceLine);
}

export function buildVoiceAndFormatInstructions(params: {
  voicePreset?: SutraVoicePreset;
  outputSlug: string;
  languageSlug: string;
  responseLength: 'short' | 'detailed';
  effectiveFluency: UserFluencyTier;
  engineOverrides?: EnginePromptOverrides | null;
}): string {
  const voiceMap: Record<SutraVoicePreset, string> = {
    observatory_calm:
      'TONE REGISTER — OBSERVATORY CALM: Warm, measured, empathetic strategic counsel. Grounded clarity over hype.',
    editor_reflective:
      'TONE REGISTER — EDITOR REFLECTIVE: Thoughtful, story-driven contrast between common astrology myths and what the chart actually shows.',
    casual_confidant:
      'TONE REGISTER — CASUAL CONFIDANT: Candid, relatable everyday voice with crisp parenthetical chart proof where helpful.',
    reluctant_genius:
      'TONE REGISTER — ULTRA-DIRECT: Zero filler or preamble; surgical insight and exact mechanism in minimal words.',
  };

  const formatOverrides = params.engineOverrides?.format_contracts;
  let outputShape = '';
  if (params.outputSlug === 'marriage_master' || params.outputSlug === 'dual_view') {
    outputShape = formatOverrides?.dual_view?.trim() || DEFAULT_FORMAT_CONTRACTS.dual_view;
  } else if (params.responseLength === 'short') {
    outputShape = formatOverrides?.short?.trim() || DEFAULT_FORMAT_CONTRACTS.short;
  } else {
    outputShape = formatOverrides?.detailed?.trim() || DEFAULT_FORMAT_CONTRACTS.detailed;
  }

  let langRule = 'LANGUAGE: Natural, clear modern English.';
  if (params.languageSlug === 'Hindi') {
    langRule =
      'LANGUAGE: Pure, natural Hindi in Devanagari script (हिंदी). Use accurate Jyotish terms gracefully.';
  } else if (params.languageSlug === 'Hinglish') {
    langRule =
      'LANGUAGE: Natural, warm conversational Hinglish (Roman script mixing Hindi & English smoothly).';
  }

  return [
    voiceMap[params.voicePreset || 'observatory_calm'],
    outputShape,
    langRule,
    buildFluencyInstruction(params.effectiveFluency, params.responseLength, params.engineOverrides),
  ].join('\n\n');
}

export function buildTimingWidgetPlacementInstruction(
  timingWidgets?: TimingProgressWidget[] | null
): string {
  if (!timingWidgets || timingWidgets.length === 0) return '';
  const tokenList = timingWidgets
    .map((w) => `- \`[[TIMING_BAR:${w.id}]]\` — ${w.title} (${w.current.label})`)
    .join('\n');

  return `TIMING PROGRESS WIDGET PLACEMENT TOKENS (PLACEMENT ONLY — ZERO SELF-CALCULATED PROGRESS BARS):
The server will render verified, deterministic 3-step visual progress bars inline wherever you place these exact tokens on their own standalone line immediately AFTER the paragraph discussing that specific period:
${tokenList}
Rules:
1. Place ONLY tokens for periods you actually discuss in your answer (typically 1–3 relevant widgets; never dump all tokens together at the bottom).
2. Put each token on its own line right below its matching paragraph (never inside a Markdown table cell or code fence).
3. NEVER invent new token IDs, NEVER modify the \`[[TIMING_BAR:...]]\` syntax, and NEVER mention these tokens in your prose.`;
}

export interface BuildSutraPathAParams {
  constitutionPrompt: string;
  conversationalRules?: string;
  expertDirective?: string;
  modeRecipeBlocks?: string[];
  pkg: Stage2ContextPackage;
  chart: CompiledChartData;
  routerFluency: UserFluencyTier;
  toneMode: 'friendly' | 'technical';
  responseLength: 'short' | 'detailed';
  outputSlug: string;
  languageSlug: string;
  voicePreset?: SutraVoicePreset;
  gocharFeedText?: string | null;
  profileMemorySummary?: string | null;
  preferredCallName?: string | null;
  turnCount: number;
  technicalDirective?: string | null;
  priorInferredFluency?: UserFluencyTier | null;
  engineOverrides?: EnginePromptOverrides | null;
}

export interface BuiltSutraPathAPrompt {
  systemInstruction: string;
  wantsSuggestions: boolean;
  effectiveFluency: UserFluencyTier;
  convergence: DeterministicConvergenceResult;
  meta: SutraSynthesisMeta;
}

export function buildSutraPathAPrompt(params: BuildSutraPathAParams): BuiltSutraPathAPrompt {
  const convergence = computeDeterministicPillarConvergence(params.pkg, params.chart);
  const effectiveFluency = resolveEffectiveFluency(
    params.routerFluency,
    params.toneMode,
    params.priorInferredFluency,
    Boolean(params.technicalDirective?.trim())
  );

  const tier1Laws =
    params.engineOverrides?.sutra_tier1_reasoning_laws?.trim() ||
    SUTRA_TIER1_REASONING_LAWS;
  const antiCliche =
    params.engineOverrides?.sutra_anti_cliche_rules?.trim() ||
    SUTRA_ANTI_CLICHE_RULES;

  const sections: string[] = [
    params.constitutionPrompt,
    params.conversationalRules || '',
    params.expertDirective || '',
    ...(params.modeRecipeBlocks || []),
    tier1Laws,
    antiCliche,
    buildIntentOutputContract(
      params.pkg.intent,
      convergence,
      params.responseLength,
      Boolean(params.pkg.requiresTimingStack),
      params.engineOverrides
    ),
    buildVoiceAndFormatInstructions({
      voicePreset: params.voicePreset,
      outputSlug: params.outputSlug,
      languageSlug: params.languageSlug,
      responseLength: params.responseLength,
      effectiveFluency,
      engineOverrides: params.engineOverrides,
    }),
  ];

  if (params.preferredCallName?.trim()) {
    const safeName = params.preferredCallName.trim();
    sections.push(
      `USER ADDRESS CONTEXT: The person consulting with you goes by "${safeName}". Address them directly as "you". Never open with a letter salutation ("Hello ${safeName},"); at most weave their name organically once mid-sentence if natural.`
    );
  }

  if (params.turnCount > 0) {
    sections.push(
      `THREAD CONTINUITY (Message #${params.turnCount + 1}): Continue the live dialogue naturally from earlier turns without re-introducing yourself or saying hello.`
    );
  }

  // Lean Stage 2 context package (76-82% smaller than monolithic V1 chart dump!)
  sections.push(params.pkg.renderedPromptContext);

  if (params.gocharFeedText?.trim()) {
    sections.push(params.gocharFeedText.trim());
  }

  if (params.profileMemorySummary?.trim()) {
    sections.push(
      `PRIOR THREAD THEMES (Continuity Background — use quietly without quoting literally):\n${params.profileMemorySummary.trim()}`
    );
  }

  if (params.technicalDirective?.trim()) {
    sections.push(
      `SPECIFIC ANALYTICAL FOCUS FOR THIS TURN (Apply thoroughly without quoting internal instructions):\n${params.technicalDirective.trim()}`
    );
  }

  if (params.pkg.requiresTimingStack && params.pkg.timingWidgets?.length) {
    const widgetBlock = buildTimingWidgetPlacementInstruction(params.pkg.timingWidgets);
    if (widgetBlock) sections.push(widgetBlock);
  }

  if (params.responseLength === 'short') {
    sections.push(buildShortReplyBreakdownInstruction(effectiveFluency, params.languageSlug));
  }

  // Explicit suggestions separation contract for Phase 5 -> Phase 6
  const wantsSuggestions = USE_DECOUPLED_STAGE4_SUGGESTIONS ? false : false;

  const meta: SutraSynthesisMeta = {
    intent: params.pkg.intent,
    playbookId: params.pkg.playbookId,
    domain: params.pkg.domain,
    convergencePillarsAligned: convergence.alignedCount,
    convergenceBandLabel: convergence.bandLabel,
    effectiveFluency,
    isDeepAudit: false,
    cancellationsCount: pkgCancellationsCount(params.pkg),
    reductionPct: params.pkg.metrics.reductionPct,
  };

  return {
    systemInstruction: sections.filter(Boolean).join('\n\n---\n\n'),
    wantsSuggestions,
    effectiveFluency,
    convergence,
    meta,
  };
}

function pkgCancellationsCount(pkg: Stage2ContextPackage): number {
  return pkg.triggeredCancellations.length;
}
