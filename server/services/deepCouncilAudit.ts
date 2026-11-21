import {
  containsInternalPromptLeak,
  PROMPT_EXTRACTION_REFUSAL,
  sanitizeAssistantOutput,
  sanitizeSutraProse,
} from './abuseGuard';
import type { CompiledChartData } from './chartCompiler';
import type { Stage2ContextPackage } from './contextSlicer';
import {
  createOpenRouterCompletion,
  streamOpenRouterCompletion,
  type OpenRouterMessage,
} from './openrouter';
import {
  buildIntentOutputContract,
  buildVoiceAndFormatInstructions,
  computeDeterministicPillarConvergence,
  resolveEffectiveFluency,
  SUTRA_ANTI_CLICHE_RULES,
  SUTRA_TIER1_REASONING_LAWS,
  type DeterministicConvergenceResult,
  type SutraVoicePreset,
} from './sutraSynthesizer';
import type { SutraSynthesisMeta, UserFluencyTier } from '../../lib/sutraTypes';

export interface DeepAuditLensSpec {
  id: 'parashari_divisional' | 'kp_nadi' | 'multi_clock_timing' | 'contrarian_auditor';
  name: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface DeepAuditLensResult {
  id: DeepAuditLensSpec['id'];
  name: string;
  ok: boolean;
  output: string;
  tokensIn: number;
  tokensOut: number;
  error?: string;
}

/**
 * Constructs 4 strictly isolated specialist lens inputs from the Stage 2 Context Package
 * so each parallel lens sees ONLY its own non-overlapping chart domain slice.
 */
export function buildDeepAuditLensPrompts(params: {
  pkg: Stage2ContextPackage;
  userPrompt: string;
  gocharFeedText?: string | null;
  technicalDirective?: string | null;
}): DeepAuditLensSpec[] {
  const { pkg, userPrompt, gocharFeedText, technicalDirective } = params;
  const slice = pkg.chartSlice as Record<string, unknown>;
  const directiveNote = technicalDirective?.trim()
    ? `\nSpecific Audit Angle: ${technicalDirective.trim()}`
    : '';

  // Lens 1: Parashari & Divisional Architect (ONLY D1, Vargas, Shadbala, SAV, Yogas, Special Points)
  const parashariSlice = {
    profile: slice.profile,
    domainAudit: slice.domainAudit,
    d1Planets: slice.d1Planets,
    vargasNoDegrees: slice.vargasNoDegrees,
    shadbala: slice.shadbala,
    savFocus: slice.savFocus,
    specialPts: slice.specialPts,
    yogas: slice.yogas,
    ...(slice.partners ? { partners: slice.partners } : {}),
  };

  // Lens 2: KP & Nadi Precision Verifier (ONLY KP Cusps, ABCD significators, D1 degrees/Nakshatras, Jaimini Karakas/Arudhas)
  const kpNadiSlice = {
    profile: slice.profile,
    d1DegreesAndNakshatras: slice.d1Planets,
    kpCusps: slice.kpCusps,
    jaimini: slice.jaimini,
    truthGateKpSummary: pkg.truthGateResolution.map((r) => `H${r.house}(${r.sign}):KP=${r.kpVerdict}`),
  };

  // Lens 3: Multi-Clock Timing Engine (ONLY Vimshottari MD/AD/PD + Sandhi, Chara Dasha, Double Transit, Slow Ingresses, Gochar)
  const timingSlicePayload = {
    profile: slice.profile,
    timing: slice.timing || 'Timing stack not required for this query; summarize current Dasha background only.',
    savFocus: slice.savFocus,
    gocharFeed: gocharFeedText ? gocharFeedText.slice(0, 1200) : undefined,
  };

  // Lens 4: Contrarian / Falsification Auditor (ONLY Cancellations, Bhava-Chalit shifts, Downgraded Yogas, Truth Gate conflicts, DKP Reality)
  const contrarianSlice = {
    profile: slice.profile,
    priorityRule: pkg.priorityRule.title,
    conditionalReordered: pkg.priorityRule.conditionalReordered,
    chalitShifts: slice.chalitShifts,
    downgradedYogas: slice.downgradedYogas,
    triggeredCancellations: pkg.triggeredCancellations,
    truthGateResolution: pkg.truthGateResolution.map((r) => r.summary),
    lifeContextReality: pkg.lifeContextAnchorText,
  };

  const sharedRules = `STRICT ANALYTICAL RULES:
- Cite ONLY facts present in your JSON slice. Never invent degrees or Vargas placements.
- Never invent divisional degrees for D9/D10/etc.; cite sign/house/dignity only.
- Return crisp, structured technical bullet notes (max ~320 words). Do not write conversational fluff.`;

  return [
    {
      id: 'parashari_divisional',
      name: 'Parashari & Divisional Architect',
      systemPrompt: `You are Lens 1: Parashari & Divisional Architect.
Assess structural promise, planetary dignity, Shadbala stamina, Ashtakavarga SAV volume, and D1-to-Varga (D9/D10/D7/D2/D4) confirmation strictly from your Parashari slice.
${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nPARASHARI SLICE:\n${JSON.stringify(parashariSlice)}`,
    },
    {
      id: 'kp_nadi',
      name: 'KP & Nadi Verifier',
      systemPrompt: `You are Lens 2: Krishnamurti Paddhati (KP) & Nadi Precision Verifier.
Evaluate KP Cusp Sub-Lord (CSL) binary promise, supporting vs obstructing house significations (e.g. 2/7/11 vs 1/6/10 or 2/6/10/11 vs 5/8/12), Nakshatra-lord overrides, and Jaimini Karaka/Arudha links strictly from your KP/Nadi slice.
${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nKP & NADI SLICE:\n${JSON.stringify(kpNadiSlice)}`,
    },
    {
      id: 'multi_clock_timing',
      name: 'Multi-Clock Timing Engine',
      systemPrompt: `You are Lens 3: Multi-Clock Timing Engine.
Evaluate timing activation strictly across Vimshottari MD/AD/PD, Dasha Sandhi transitions, Jaimini Chara Dasha, Saturn/Jupiter Double Transit + SAV bindu readiness, and upcoming slow-planet ingresses.
${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nTIMING SLICE:\n${JSON.stringify(timingSlicePayload)}`,
    },
    {
      id: 'contrarian_auditor',
      name: 'Contrarian / Falsification Auditor',
      systemPrompt: `You are Lens 4: Contrarian & Falsification Auditor.
Your ONLY job is to stress-test and break any naive optimistic OR overly pessimistic reading. Hunt for Neecha Bhanga, D1-vs-D9 inversions, Bhava-Chalit house shifts, Kendradhipati/Badhaka friction, birth-time Sandhi instability, and Desh-Kaal-Patra real-world mismatches. State what could falsify an easy answer.
${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nCONTRARIAN & REALITY SLICE:\n${JSON.stringify(contrarianSlice)}`,
    },
  ];
}

export interface RunDeepCouncilAuditParams {
  model: string;
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
  historyMessages: OpenRouterMessage[];
  finalUserText: string;
  technicalDirective?: string | null;
  priorInferredFluency?: UserFluencyTier | null;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  onChunk: (chunkText: string) => void;
}

export interface RunDeepCouncilAuditResult {
  fullText: string;
  tokensIn: number;
  tokensOut: number;
  aborted: boolean;
  leakIntercepted: boolean;
  lenses: DeepAuditLensResult[];
  convergence: DeterministicConvergenceResult;
  meta: SutraSynthesisMeta;
}

function buildAdjudicatorSystemPrompt(params: {
  base: RunDeepCouncilAuditParams;
  convergence: DeterministicConvergenceResult;
  effectiveFluency: UserFluencyTier;
  lensResults: DeepAuditLensResult[];
}): string {
  const { base, convergence, effectiveFluency, lensResults } = params;
  const successfulLenses = lensResults.filter((l) => l.ok && l.output.trim().length > 0);

  const lensNotesBlock = successfulLenses
    .map((l) => `### Independent Analytical Thread (${l.name})\n${l.output.trim()}`)
    .join('\n\n');

  const dualViewRule =
    effectiveFluency !== 'beginner' || base.outputSlug === 'marriage_master'
      ? `TECHNICAL TRACE REQUIREMENT:
End cleanly with a concise, clearly labeled **System Convergence & Technical Trace** section showing how KP promise, D9 Navamsa endurance, Shadbala/SAV stamina, and active Dasha timing resolve any friction (keep bullet points crisp and mobile-readable).`
      : '';

  const sections = [
    base.constitutionPrompt,
    base.conversationalRules || '',
    base.expertDirective || '',
    ...(base.modeRecipeBlocks || []),
    `ADJUDICATOR MANDATE — DEEP MULTI-SYSTEM SYNTHESIS (TIER 1 RULE 10):
You are delivering the unified Master Synthesis after weighing independent Parashari, KP/Nadi, Multi-Clock Timing, and Contrarian Falsification checks.
- CONSENSUS IS NOT VALIDATION: If any check overclaims something contradicted by KP Sub-Lord, D9 Navamsa, Shadbala/PHI, SAV bindus, or Desh-Kaal-Patra reality, OVERRIDE IT strictly using the 5-Tier Truth Gate Conflict Hierarchy:
  ${base.pkg.truthGateHierarchy.join(' | ')}
- SEAMLESS VOICE RULE (CRITICAL): NEVER mention "4 lenses", "4 AI reports", "supplied analyses", "Lens 1/2/3/4", or "contrarian auditor". Speak with one calm, authoritative, deeply integrated human voice sitting across the table from the user.
- Highlight clearly where the independent systems **agree** vs. where **internal friction or conditions** modify how the result unfolds.
- Include the grounded Convergence Rating (**${convergence.bandLabel}** — ${convergence.tierLabel}) naturally and honestly.`,
    SUTRA_TIER1_REASONING_LAWS,
    SUTRA_ANTI_CLICHE_RULES,
    buildIntentOutputContract(base.pkg.intent, convergence, base.responseLength),
    buildVoiceAndFormatInstructions({
      voicePreset: base.voicePreset,
      outputSlug: base.outputSlug,
      languageSlug: base.languageSlug,
      responseLength: base.responseLength,
      effectiveFluency,
    }),
    dualViewRule,
    base.preferredCallName?.trim()
      ? `USER ADDRESS CONTEXT: Address "${base.preferredCallName.trim()}" as "you/your" directly in conversation — never start with a letter salutation.`
      : '',
    base.turnCount > 0
      ? `THREAD CONTINUITY (Message #${base.turnCount + 1}): Continue seamlessly from earlier turns without re-introducing yourself.`
      : '',
    `REAL-WORLD LIFE CONTEXT ANCHORS (Desh-Kaal-Patra):\n${base.pkg.lifeContextAnchorText}`,
    `PRIORITY ORDERING:\n${base.pkg.priorityRule.body}`,
    `SCOPED CHART & TIMING DATA:\n${JSON.stringify(base.pkg.chartSlice)}`,
    `SYNTHESIS INPUTS TO ADJUDICATE:\n${lensNotesBlock}`,
    base.profileMemorySummary?.trim()
      ? `PRIOR THREAD THEMES (Continuity Background):\n${base.profileMemorySummary.trim()}`
      : '',
  ];

  return sections.filter(Boolean).join('\n\n---\n\n');
}

export async function runDeepCouncilAudit(
  params: RunDeepCouncilAuditParams
): Promise<RunDeepCouncilAuditResult> {
  const convergence = computeDeterministicPillarConvergence(params.pkg, params.chart);
  const effectiveFluency = resolveEffectiveFluency(
    params.routerFluency,
    params.toneMode,
    params.priorInferredFluency,
    Boolean(params.technicalDirective?.trim())
  );

  const lensSpecs = buildDeepAuditLensPrompts({
    pkg: params.pkg,
    userPrompt: params.finalUserText,
    gocharFeedText: params.gocharFeedText,
    technicalDirective: params.technicalDirective,
  });

  // Step 1: 4 Parallel Isolated Lens Calls via Promise.allSettled
  const settled = await Promise.allSettled(
    lensSpecs.map(async (spec): Promise<DeepAuditLensResult> => {
      const completion = await createOpenRouterCompletion({
        model: params.model,
        system: spec.systemPrompt,
        messages: [{ role: 'user', content: spec.userPrompt }],
        temperature: 0.25,
        maxTokens: 700,
        abortSignal: params.abortSignal,
      });
      return {
        id: spec.id,
        name: spec.name,
        ok: true,
        output: completion.text,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
      };
    })
  );

  const lensResults: DeepAuditLensResult[] = settled.map((res, idx) => {
    const spec = lensSpecs[idx];
    if (res.status === 'fulfilled') {
      return res.value;
    }
    return {
      id: spec.id,
      name: spec.name,
      ok: false,
      output: '',
      tokensIn: 0,
      tokensOut: 0,
      error: res.reason instanceof Error ? res.reason.message : 'Lens call failed',
    };
  });

  if (params.abortSignal.aborted) {
    return {
      fullText: '',
      tokensIn: lensResults.reduce((s, r) => s + r.tokensIn, 0),
      tokensOut: lensResults.reduce((s, r) => s + r.tokensOut, 0),
      aborted: true,
      leakIntercepted: false,
      lenses: lensResults,
      convergence,
      meta: {
        intent: params.pkg.intent,
        playbookId: params.pkg.playbookId,
        domain: params.pkg.domain,
        convergencePillarsAligned: convergence.alignedCount,
        convergenceBandLabel: convergence.bandLabel,
        effectiveFluency,
        isDeepAudit: true,
        lensesSucceeded: lensResults.filter((l) => l.ok).length,
        cancellationsCount: params.pkg.triggeredCancellations.length,
        reductionPct: params.pkg.metrics.reductionPct,
      },
    };
  }

  const succeededCount = lensResults.filter((l) => l.ok && l.output.trim().length > 0).length;
  if (succeededCount === 0) {
    const firstErr = lensResults.find((l) => l.error)?.error || 'Deep Council Audit failed to run.';
    throw new Error(firstErr);
  }

  // Step 2: Streaming Master Convergence Adjudicator
  const adjudicatorSystem = buildAdjudicatorSystemPrompt({
    base: params,
    convergence,
    effectiveFluency,
    lensResults,
  });

  const internalAbortController = new AbortController();
  const forwardAbort = () => internalAbortController.abort();
  params.abortSignal.addEventListener('abort', forwardAbort, { once: true });

  let rawAccumulated = '';
  let flushedLength = 0;
  let leakIntercepted = false;
  const HOLD_BACK_CHARS = 72;

  try {
    const streamResult = await streamOpenRouterCompletion({
      model: params.model,
      system: adjudicatorSystem,
      messages: [
        ...params.historyMessages,
        { role: 'user', content: params.finalUserText },
      ],
      temperature: 0.35,
      maxTokens: Math.max(params.maxOutputTokens, 2400),
      abortSignal: internalAbortController.signal,
      onChunk: (chunkText) => {
        if (leakIntercepted) return;
        rawAccumulated += chunkText;
        if (containsInternalPromptLeak(rawAccumulated)) {
          leakIntercepted = true;
          internalAbortController.abort();
          return;
        }
        let safeEnd = rawAccumulated.length - HOLD_BACK_CHARS;
        if (safeEnd > flushedLength) {
          const tentative = rawAccumulated.slice(flushedLength, safeEnd);
          // Avoid splitting trailing "the native" mid-phrase across stream chunks
          const trailingMatch = /\b(?:the|a)(?:\s+native['’]?s?)?$/i.exec(tentative);
          if (trailingMatch) {
            safeEnd -= trailingMatch[0].length;
          }
          if (safeEnd > flushedLength) {
            const toEmit = sanitizeSutraProse(rawAccumulated.slice(flushedLength, safeEnd));
            flushedLength = safeEnd;
            if (toEmit) params.onChunk(toEmit);
          }
        }
      },
    });

    const lensTokensIn = lensResults.reduce((s, r) => s + r.tokensIn, 0);
    const lensTokensOut = lensResults.reduce((s, r) => s + r.tokensOut, 0);
    const totalTokensIn = lensTokensIn + streamResult.tokensIn;
    const totalTokensOut = lensTokensOut + streamResult.tokensOut;

    const meta: SutraSynthesisMeta = {
      intent: params.pkg.intent,
      playbookId: params.pkg.playbookId,
      domain: params.pkg.domain,
      convergencePillarsAligned: convergence.alignedCount,
      convergenceBandLabel: convergence.bandLabel,
      effectiveFluency,
      isDeepAudit: true,
      lensesSucceeded: succeededCount,
      cancellationsCount: params.pkg.triggeredCancellations.length,
      reductionPct: params.pkg.metrics.reductionPct,
    };

    if (leakIntercepted || containsInternalPromptLeak(streamResult.fullText)) {
      return {
        fullText: PROMPT_EXTRACTION_REFUSAL,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        aborted: false,
        leakIntercepted: true,
        lenses: lensResults,
        convergence,
        meta,
      };
    }

    if (rawAccumulated.length > flushedLength) {
      const remaining = sanitizeSutraProse(rawAccumulated.slice(flushedLength));
      flushedLength = rawAccumulated.length;
      if (remaining) params.onChunk(remaining);
    }

    const sanitized = sanitizeAssistantOutput(streamResult.fullText.trim());
    if (sanitized.leaked) {
      return {
        fullText: sanitized.text,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        aborted: false,
        leakIntercepted: true,
        lenses: lensResults,
        convergence,
        meta,
      };
    }

    return {
      fullText: sanitized.text,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      aborted: streamResult.aborted && !leakIntercepted,
      leakIntercepted: false,
      lenses: lensResults,
      convergence,
      meta,
    };
  } finally {
    params.abortSignal.removeEventListener('abort', forwardAbort);
  }
}
