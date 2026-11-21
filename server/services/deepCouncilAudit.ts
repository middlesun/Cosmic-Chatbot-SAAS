import {
  containsInternalPromptLeak,
  PROMPT_EXTRACTION_REFUSAL,
  sanitizeAssistantOutput,
  sanitizeSutraProse,
} from './abuseGuard';
import type { CompiledChartData } from './chartCompiler';
import type { Stage2ContextPackage } from './contextSlicer';
import {
  DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE,
  DEFAULT_DEEP_AUDIT_LENSES,
} from './enginePromptDefaults';
import type { EnginePromptOverrides } from './platformSettings';
import {
  createOpenRouterCompletion,
  streamOpenRouterCompletion,
  type OpenRouterMessage,
} from './openrouter';
import {
  buildIntentOutputContract,
  buildShortReplyBreakdownInstruction,
  buildTimingWidgetPlacementInstruction,
  buildVoiceAndFormatInstructions,
  computeDeterministicPillarConvergence,
  extractTechBreakdown,
  resolveEffectiveFluency,
  SUTRA_ANTI_CLICHE_RULES,
  SUTRA_TIER1_REASONING_LAWS,
  type DeterministicConvergenceResult,
  type SutraVoicePreset,
} from './sutraSynthesizer';
import type {
  SutraSynthesisMeta,
  TimingProgressWidget,
  UserFluencyTier,
} from '../../lib/sutraTypes';

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
  engineOverrides?: EnginePromptOverrides | null;
}): DeepAuditLensSpec[] {
  const { pkg, userPrompt, gocharFeedText, technicalDirective, engineOverrides } = params;
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

  const lensOverrides = engineOverrides?.deep_audit_lenses;

  return [
    {
      id: 'parashari_divisional',
      name: 'Parashari & Divisional Architect',
      systemPrompt: `${lensOverrides?.parashari_divisional?.trim() || DEFAULT_DEEP_AUDIT_LENSES.parashari_divisional}\n${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nPARASHARI SLICE:\n${JSON.stringify(parashariSlice)}`,
    },
    {
      id: 'kp_nadi',
      name: 'KP & Nadi Verifier',
      systemPrompt: `${lensOverrides?.kp_nadi?.trim() || DEFAULT_DEEP_AUDIT_LENSES.kp_nadi}\n${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nKP & NADI SLICE:\n${JSON.stringify(kpNadiSlice)}`,
    },
    {
      id: 'multi_clock_timing',
      name: 'Multi-Clock Timing Engine',
      systemPrompt: `${lensOverrides?.multi_clock_timing?.trim() || DEFAULT_DEEP_AUDIT_LENSES.multi_clock_timing}\n${sharedRules}`,
      userPrompt: `Question: ${userPrompt}${directiveNote}\n\nTIMING SLICE:\n${JSON.stringify(timingSlicePayload)}`,
    },
    {
      id: 'contrarian_auditor',
      name: 'Contrarian / Falsification Auditor',
      systemPrompt: `${lensOverrides?.contrarian_auditor?.trim() || DEFAULT_DEEP_AUDIT_LENSES.contrarian_auditor}\n${sharedRules}`,
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
  engineOverrides?: EnginePromptOverrides | null;
  abortSignal: AbortSignal;
  onStatus?: (statusText: string) => void;
  onChunk: (chunkText: string) => void;
}

export interface RunDeepCouncilAuditResult {
  fullText: string;
  techBreakdown?: string | null;
  timingWidgets?: TimingProgressWidget[];
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
    base.responseLength === 'short'
      ? buildShortReplyBreakdownInstruction(effectiveFluency, base.languageSlug)
      : effectiveFluency !== 'beginner' || base.outputSlug === 'marriage_master'
      ? `TECHNICAL TRACE REQUIREMENT:
End cleanly with a concise, clearly labeled **System Convergence & Technical Trace** section showing how KP promise, D9 Navamsa endurance, Shadbala/SAV stamina, and active Dasha timing resolve any friction (keep bullet points crisp and mobile-readable).`
      : '';

  const adjudicatorTemplate =
    base.engineOverrides?.deep_audit_adjudicator_mandate?.trim() ||
    DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE;
  const adjudicatorBlock = adjudicatorTemplate
    .replace(/\{\{TRUTH_GATE_HIERARCHY\}\}/g, base.pkg.truthGateHierarchy.join(' | '))
    .replace(/\{\{CONVERGENCE_BADGE\}\}/g, `**${convergence.bandLabel}** — ${convergence.tierLabel}`);

  const tier1Laws =
    base.engineOverrides?.sutra_tier1_reasoning_laws?.trim() ||
    SUTRA_TIER1_REASONING_LAWS;
  const antiCliche =
    base.engineOverrides?.sutra_anti_cliche_rules?.trim() ||
    SUTRA_ANTI_CLICHE_RULES;

  const sections = [
    base.constitutionPrompt,
    base.conversationalRules || '',
    base.expertDirective || '',
    ...(base.modeRecipeBlocks || []),
    adjudicatorBlock,
    tier1Laws,
    antiCliche,
    buildIntentOutputContract(
      base.pkg.intent,
      convergence,
      base.responseLength,
      Boolean(base.pkg.requiresTimingStack),
      base.engineOverrides
    ),
    buildVoiceAndFormatInstructions({
      voicePreset: base.voicePreset,
      outputSlug: base.outputSlug,
      languageSlug: base.languageSlug,
      responseLength: base.responseLength,
      effectiveFluency,
      engineOverrides: base.engineOverrides,
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
    base.pkg.requiresTimingStack && base.pkg.timingWidgets?.length
      ? buildTimingWidgetPlacementInstruction(base.pkg.timingWidgets)
      : '',
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
    engineOverrides: params.engineOverrides,
  });

  const lensShortLabels: Record<DeepAuditLensSpec['id'], string> = {
    parashari_divisional: 'Parashari & Vargas',
    kp_nadi: 'KP & Nadi',
    multi_clock_timing: 'Timing',
    contrarian_auditor: 'Contrarian Audit',
  };
  const completedLabels: string[] = [];
  params.onStatus?.('Running 4-system council audit (Parashari, KP, Timing, Contrarian)…');

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
      completedLabels.push(lensShortLabels[spec.id]);
      if (completedLabels.length < lensSpecs.length) {
        params.onStatus?.(
          `Audited ${completedLabels.join(', ')} (${completedLabels.length}/${lensSpecs.length} checks)…`
        );
      }
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
  params.onStatus?.('Adjudicating Truth Gates & synthesizing reading…');
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
  let hiddenBreakdownHoldStarted = false;
  const HOLD_BACK_CHARS = 72;

  const allowedTimingWidgetIds = new Set(
    (params.pkg.timingWidgets || []).map((w) => w.id)
  );

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
        if (hiddenBreakdownHoldStarted) return;

        const breakdownIdx = rawAccumulated.search(/<<<TECH_BREAKDOWN/i);
        if (breakdownIdx !== -1) {
          if (breakdownIdx > flushedLength) {
            const beforeTag = sanitizeSutraProse(
              rawAccumulated.slice(flushedLength, breakdownIdx).replace(/\s+$/, ''),
              allowedTimingWidgetIds
            );
            if (beforeTag) params.onChunk(beforeTag);
            flushedLength = breakdownIdx;
          }
          hiddenBreakdownHoldStarted = true;
          return;
        }

        let safeEnd = rawAccumulated.length - HOLD_BACK_CHARS;
        if (safeEnd > flushedLength) {
          const tentative = rawAccumulated.slice(flushedLength, safeEnd);
          // Avoid splitting trailing "the native" or partial TIMING_BAR token mid-phrase across stream chunks
          const trailingMatch =
            /(?:\b(?:the|a)(?:\s+native['’]?s?)?|\[\[?TIMING_BAR[^\]]*)$/i.exec(tentative);
          if (trailingMatch) {
            safeEnd -= trailingMatch[0].length;
          }
          if (safeEnd > flushedLength) {
            const toEmit = sanitizeSutraProse(
              rawAccumulated.slice(flushedLength, safeEnd),
              allowedTimingWidgetIds
            );
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
        techBreakdown: null,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        aborted: false,
        leakIntercepted: true,
        lenses: lensResults,
        convergence,
        meta,
      };
    }

    const extractedAccumulated = extractTechBreakdown(rawAccumulated);
    if (!hiddenBreakdownHoldStarted && extractedAccumulated.mainText.length > flushedLength) {
      const remaining = sanitizeSutraProse(
        extractedAccumulated.mainText.slice(flushedLength),
        allowedTimingWidgetIds
      );
      flushedLength = extractedAccumulated.mainText.length;
      if (remaining) params.onChunk(remaining);
    }

    const extractedFinal = extractTechBreakdown(streamResult.fullText.trim());
    const sanitized = sanitizeAssistantOutput(
      extractedFinal.mainText,
      allowedTimingWidgetIds
    );
    if (sanitized.leaked) {
      return {
        fullText: sanitized.text,
        techBreakdown: null,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        aborted: false,
        leakIntercepted: true,
        lenses: lensResults,
        convergence,
        meta,
      };
    }

    let safeBreakdown: string | null = null;
    if (extractedFinal.techBreakdown) {
      const bdSanitized = sanitizeAssistantOutput(extractedFinal.techBreakdown);
      if (!bdSanitized.leaked && bdSanitized.text.trim()) {
        safeBreakdown = bdSanitized.text.trim();
      }
    }

    return {
      fullText: sanitized.text,
      techBreakdown: safeBreakdown,
      timingWidgets: params.pkg.timingWidgets,
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
