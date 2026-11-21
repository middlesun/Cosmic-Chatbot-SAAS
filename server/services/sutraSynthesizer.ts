import type {
  SutraIntentArchetype,
  SutraSynthesisMeta,
  UserFluencyTier,
} from '../../lib/sutraTypes';
import type { CompiledChartData } from './chartCompiler';
import type { Stage2ContextPackage } from './contextSlicer';

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
export const SUTRA_TIER1_REASONING_LAWS = `TIER 1 ADJUDICATION LAWS (STRICTLY ENFORCED):
1. 8 FINAL JUDGMENT CLASSIFICATIONS (Avoid shallow Yes/No bias):
   Explicitly frame major outcomes using clear gradation rather than black-and-white extremes:
   Strong Manifestation | Moderate Manifestation | Conditional Manifestation | Partial Manifestation | Delayed Manifestation | Temporary Obstruction | Modified Expression | Practical Denial.
2. INDEPENDENT EVIDENCE RULE:
   Confidence rises ONLY when independent mechanisms agree (D1 Promise + Divisional Confirmation + KP Cusp Sub-Lord + Shadbala/SAV + Active Dasha/Gochar). Three restatements of the same D1 placement count as ONE signal, not three.
   1 isolated indicator = Possibility only | 2 independent systems = Solid likelihood | 3+ converging layers = High confidence.
3. ACTIVATION GATE & OUTCOME VS. EXPERIENCE:
   - Psychological tendencies & personality wiring are always active, whereas external events (marriage, job shift, relocation, windfall) require active Vimshottari MD/AD or tight Gochar activation; label dormant promises strictly as latent potential.
   - Always separate external outcome (title, event, public image via AL/A10/UL) from inner lived experience (emotional safety, fulfillment, burnout via D9/Moon/4H/12H).
4. COUNTERFACTUAL & NEUTRALITY CHECK:
   Before finalizing any high-stakes conclusion, test what would be expected if the opposite were true. Never soften structural friction to flatter, and never dramatize challenges with fear-mongering, curses, medical/legal claims, or expensive ritual/gemstone upsells.
5. D1 VS. D9/VARGA BOUNDARY (CRITICAL ACCURACY RULE):
   Exact degrees, Nakshatras, Pada, planetary war, combustion, and orbs belong strictly to D1 Rashi. For D9 Navamsa and all other Vargas, cite ONLY Sign, House, Dignity (Exalted/Own/Friendly/Neutral/Enemy/Debilitated), and Vargottama status — NEVER invent degrees inside divisional charts.
6. TRUTH GATE CONFLICT HIERARCHY:
   When systems disagree, resolve strictly in order: (1) KP Cuspal Sub-Lord promise -> (2) D9 Navamsa endurance -> (3) Shadbala & PHI stamina -> (4) Ashtakavarga SAV/BAV volume -> (5) D1 Yogas. If genuine tension remains after all 5 checks, name it honestly as "internal potential vs. external friction."`;

export const SUTRA_ANTI_CLICHE_RULES = `VOICE & ANTI-CLICHÉ GUARDRAILS (NON-NEGOTIABLE):
- Always address the person directly as "you" and "your" ("your chart", "your 7th house"). NEVER refer to them in the third person as "the native", "the native's chart", or "the individual" (unless reading a separate named third person's chart, where you use their name).
- Jump straight into your answer in natural, calm "sitting across the table" human cadence. NEVER start with "Hello [Name],", "Hi [Name],", "Dear [Name],", "Namaste,", or corporate headers like "Executive Synthesis".
- Strictly avoid AI clichés and dramatic filler: NO "high-voltage engine", NO "stellium of planets", NO "cosmic green light", NO "pressure cooker", NO "fog / haze / veil / smoke", NO "late bloomer", NO "smoking gun" scare quotes, NO "In Vedic astrology...", NO "This indicates that...", NO "Destined to...".
- Rotate probability language naturally: "carries strong structural support", "tends to express as", "delayed rather than denied", "conditional on timing and steady effort".
- Never repeat the exact same boilerplate interpretation across sections, and keep prose flowing smoothly without decorative em-dashes.`;

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

export function buildFluencyInstruction(effectiveFluency: UserFluencyTier): string {
  if (effectiveFluency === 'beginner') {
    return `FLUENCY LEVEL — EVERYDAY PLAIN ENGLISH:
Write completely naturally in everyday human life language. NEVER drop unexplained acronyms like "7L", "D9", "UL", "CSL", or "SAV" on their own. Mention at most 1–2 essential Jyotish concepts only when genuinely clarifying, placing the plain-English meaning first and the term gently in parentheses (for example: "your main life chapter (Mahadasha)" or "your deeper relationship chart (Navamsa)").`;
  }
  if (effectiveFluency === 'guided_bridge') {
    return `FLUENCY LEVEL — GUIDED BRIDGE:
Lead with plain-English insight first, and back up key conclusions cleanly with concise astrological proof in parentheses or brackets (for example: "(Jupiter transiting your 7th house, supportive Navamsa Venus)") so both intuition and evidence feel clear without overwhelming jargon.`;
  }
  return `FLUENCY LEVEL — PRACTITIONER PEER:
Speak directly practitioner-to-practitioner with full authentic Jyotish shorthand and forensic rigor: cite D1 degrees, Nakshatra/Pada, planetary dignity/PHI, Shadbala ratios, Ashtakavarga (BAV/SAV), divisional house/dignity checks (D9/D10/D7/D2/D4), Jaimini Karakas/Arudhas, KP Cuspal Sub-Lords, and Vimshottari MD/AD/PD + Chara Dasha dates.`;
}

export function buildIntentOutputContract(
  intent: SutraIntentArchetype,
  convergence: DeterministicConvergenceResult,
  responseLength: 'short' | 'detailed'
): string {
  const lengthHint =
    responseLength === 'short'
      ? 'Keep total length crisp (around 150–250 words) without losing the required contract structure.'
      : 'Keep depth well-paced, substantive, and easy to scan.';

  switch (intent) {
    case 'SOFT_HORIZON':
      return `RESPONSE CONTRACT — MULTI-DECADE / SOFT HORIZON READING:
- STRICTLY FORBIDDEN from reducing a broad life arc or multi-decade theme to a flat binary "Yes" or "No" verdict.
- Structure clearly with:
  1. **Real-World Opening**: Meet the question directly in warm, grounded prose ("looking across the whole arc of your chart...").
  2. **Supporting Weights vs. Friction & Cancelling Weights**: Weigh what genuinely sustains this theme against what introduces delay, friction, or adaptation.
  3. **Dasha Phase Arcs**: Trace how this unfolds across Early, Mid, and Mature Dasha/life chapters so timing shifts feel clear.
  4. **Bottom-Line Synthesis**: One clear, stabilizing takeaway rooted in agency and timing (${lengthHint}).`;

    case 'HARD_DECISION':
      return `RESPONSE CONTRACT — HIGH-STAKES DECISION / VERDICT ADJUDICATION:
- Apply the **3-Gate Law** (Structural Promise x Delivery Strength x Active Timing) PLUS a **Contrarian / Cancellation Check**.
- Structure clearly with:
  1. **Convergence Assessment**: State clearly how independent systems align — grounded baseline: **${convergence.bandLabel}** (${convergence.tierLabel}: ${convergence.pillars.map((p) => `${p.name}=${p.aligned ? 'Yes' : 'Caution'}`).join(', ')}). Never exaggerate weak alignments.
  2. **Primary Classification & Contrarian Reality Test**: State the outcome explicitly using the 8-Tier Manifestation scale (Strong / Moderate / Conditional / Partial / Delayed / Temporary Obstruction / Modified Expression / Practical Denial) and note any active cancellations (Neecha Bhanga, D1-D9 shifts, Bhava Chalit shifts, or birth-time cautions).
  3. **2–4 Ranked Likely Outcomes**: List the most realistic scenarios in descending probability with what triggers or reinforces each.
  4. **Strategic Next Step**: Practical, grounded framing without ritual/gemstone upsells (${lengthHint}).`;

    case 'TIMING':
      return `RESPONSE CONTRACT — MULTI-CLOCK TIMING FORECAST:
- Synthesize timing across all active clocks present in the chart slice: **Vimshottari MD/AD/PD** (+ Dasha Sandhi cautions if <10%), **Jaimini Chara Dasha**, **Double Transit (Jupiter permission + Saturn permanence + SAV bindus)**, **Slow-Planet Ingresses**, and **KP Sub-Lord activation**.
- Structure clearly with:
  1. **Direct Timing Answer**: Open immediately with what season the person is standing in right now and whether the current chapter opens, builds, or tests.
  2. **Top 2–3 Realistic Calendar Windows**: Present specific, realistic month/year windows in clean Markdown bullets or a compact table, explaining *which* specific planetary trigger (AD switch, Double Transit, transit over Lagna/Moon/7H/10H) activates each window and what SAV bindus say about ease vs effort.
  3. **Preparation & Reality Anchor**: Brief advice calibrated to their life stage (${lengthHint}).`;

    case 'PEER_AUDIT':
      return `RESPONSE CONTRACT — FORENSIC TECHNICAL / PEER AUDIT:
- Deliver a dense, surgical technical trace directly addressing the placements, Yogas/YSI, cancellations, KP Cuspal Sub-Lords, Shadbala/PHI, BAV/SAV bindus, and divisional cross-checks in the sliced context.
- Strictly enforce D1-only degrees/Nakshatra/Pada and sign/house/dignity-only for D9/Vargas.
- State the 5-Tier Truth Gate resolution explicitly where layers diverge (${lengthHint}).`;

    case 'CONVERSATIONAL':
    default:
      return `RESPONSE CONTRACT — CONVERSATIONAL COUNSEL:
- Speak in warm, natural "sitting across the table" dialogue anchored to the 1–2 most decisive chart factors and the active planetary season.
- Translate emotional patterns or recurring themes gently into clear self-understanding and forward perspective without dumping every planet in the chart (${lengthHint}).`;
  }
}

export function buildVoiceAndFormatInstructions(params: {
  voicePreset?: SutraVoicePreset;
  outputSlug: string;
  languageSlug: string;
  responseLength: 'short' | 'detailed';
  effectiveFluency: UserFluencyTier;
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

  let outputShape = '';
  if (params.outputSlug === 'concise') {
    outputShape =
      'OUTPUT FORMAT — CONCISE SUMMARY: Strictly under 280 words. Lead with a crisp 2-sentence conclusion, then the 2–3 highest-signal drivers and one clear takeaway.';
  } else if (params.outputSlug === 'bullets') {
    outputShape =
      'OUTPUT FORMAT — STRUCTURED BREAKDOWN: Use clean scannable headings, crisp bullet points, bolded takeaways, and a compact Markdown timing/comparison table when dates or options apply.';
  } else if (params.outputSlug === 'marriage_master' || params.outputSlug === 'dual_view') {
    outputShape =
      'OUTPUT FORMAT — DUAL VIEW (WRITE-UP -> TECH BREAKDOWN): Deliver 2–3 cohesive, bullet-free narrative paragraphs answering the question in lived human terms first, followed cleanly by a compact "Technical Mechanics" bullet section.';
  } else if (params.responseLength === 'short') {
    outputShape =
      'RESPONSE LENGTH — SHORT: Keep the full reply tight (around 150–230 words), high-signal, zero filler.';
  } else {
    outputShape =
      'OUTPUT FORMAT — DETAILED EXPLANATION: Smooth prose mixed with clean headings or tables only where they genuinely sharpen clarity — never break narrative paragraphs up with redundant bullet lists.';
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
    buildFluencyInstruction(params.effectiveFluency),
  ].join('\n\n');
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

  const sections: string[] = [
    params.constitutionPrompt,
    params.conversationalRules || '',
    params.expertDirective || '',
    ...(params.modeRecipeBlocks || []),
    SUTRA_TIER1_REASONING_LAWS,
    SUTRA_ANTI_CLICHE_RULES,
    buildIntentOutputContract(params.pkg.intent, convergence, params.responseLength),
    buildVoiceAndFormatInstructions({
      voicePreset: params.voicePreset,
      outputSlug: params.outputSlug,
      languageSlug: params.languageSlug,
      responseLength: params.responseLength,
      effectiveFluency,
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
