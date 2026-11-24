import {
  containsInternalPromptLeak,
  PROMPT_EXTRACTION_REFUSAL,
  sanitizeAssistantOutput,
  sanitizeVedicProse,
} from './abuseGuard';
import type { CompiledChartData } from './chartCompiler';
import type { Stage2ContextPackage } from './contextSlicer';
import {
  DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE,
  DEFAULT_DEEP_AUDIT_LENSES,
  WESTERN_ANTI_CLICHE_RULES,
  WESTERN_DEEP_AUDIT_ADJUDICATOR_MANDATE,
  WESTERN_DEEP_AUDIT_LENSES,
  WESTERN_TIER1_REASONING_LAWS,
} from './enginePromptDefaults';
import type { EnginePromptOverrides } from './platformSettings';
import {
  createOpenRouterCompletion,
  streamOpenRouterCompletion,
  type OpenRouterMessage,
} from './openrouter';
import {
  appendTurnVerificationModifier,
  buildIntentOutputContract,
  buildShortReplyBreakdownInstruction,
  buildTimingWidgetPlacementInstruction,
  buildVoiceAndFormatInstructions,
  computeDeterministicPillarConvergence,
  extractTechBreakdown,
  resolveEffectiveFluency,
  VEDIC_ANTI_CLICHE_RULES,
  VEDIC_TIER1_REASONING_LAWS,
  type DeterministicConvergenceResult,
  type VedicVoicePreset,
} from './vedicAstrologerEngine';
import type {
  TimingProgressWidget,
  UserFluencyTier,
  VedicSynthesisMeta,
} from '../../lib/vedicTypes';
import type { ChatStyle } from '../../components/app/chatTypes';
import { buildChatStyleInstruction } from './companionEngine';

export interface DeepAuditLensSpec {
  id:
    | 'parashari_divisional'
    | 'kp_nadi'
    | 'multi_clock_timing'
    | 'contrarian_auditor'
    | 'sect_dignity_rulers'
    | 'tight_aspects_patterns'
    | 'western_multi_clock_timing'
    | 'western_contrarian_auditor';
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

  if (pkg.tradition === 'western') {
    const sectDignitySlice = {
      profile: slice.profile,
      domainAudit: slice.domainAudit,
      cuspsFocus: slice.cuspsFocus,
      planetsFocus: slice.planetsFocus,
      dispositorTree: slice.dispositorTree,
      mutualReceptions: slice.mutualReceptions,
      ...(slice.partners ? { partners: slice.partners } : {}),
    };

    const tightAspectsSlice = {
      profile: slice.profile,
      tightAspects: slice.tightAspects,
      configurations: slice.configurations,
      truthGateSummary: pkg.truthGateResolution.map((r) => `H${r.house}(${r.sign}):${r.kpVerdict}`),
    };

    const westernTimingSlice = {
      profile: slice.profile,
      timing:
        slice.timing ||
        'Timing stack not required for this query; summarize current Profection and outer transit backdrop only.',
      transitFeed: gocharFeedText ? gocharFeedText.slice(0, 1200) : undefined,
    };

    const westernContrarianSlice = {
      profile: slice.profile,
      priorityRule: pkg.priorityRule.title,
      conditionalReordered: pkg.priorityRule.conditionalReordered,
      triggeredCancellations: pkg.triggeredCancellations,
      truthGateResolution: pkg.truthGateResolution.map((r) => r.summary),
      lifeContextReality: pkg.lifeContextAnchorText,
    };

    const westernSharedRules = `STRICT ANALYTICAL RULES:
- Cite ONLY Tropical facts present in your JSON slice. Never invent degrees, Placidus cusps, aspects, or timing dates.
- Use strictly Western Tropical terminology — NEVER inject Vedic or Sanskrit astrology terms.
- Return crisp, structured technical bullet notes (max ~320 words). Do not write conversational fluff.`;

    const wLensOv = engineOverrides?.western_deep_audit_lenses;

    return [
      {
        id: 'sect_dignity_rulers',
        name: 'Sect, Dignity & Rulers Architect',
        systemPrompt: `${wLensOv?.sect_dignity_rulers?.trim() || WESTERN_DEEP_AUDIT_LENSES.sect_dignity_rulers}\n${westernSharedRules}`,
        userPrompt: `Question: ${userPrompt}${directiveNote}\n\nSECT & DIGNITY SLICE:\n${JSON.stringify(sectDignitySlice)}`,
      },
      {
        id: 'tight_aspects_patterns',
        name: 'Tight Aspects & Configurations Verifier',
        systemPrompt: `${wLensOv?.tight_aspects_patterns?.trim() || WESTERN_DEEP_AUDIT_LENSES.tight_aspects_patterns}\n${westernSharedRules}`,
        userPrompt: `Question: ${userPrompt}${directiveNote}\n\nASPECTS & CONFIGURATIONS SLICE:\n${JSON.stringify(tightAspectsSlice)}`,
      },
      {
        id: 'western_multi_clock_timing',
        name: 'Multi-Clock Western Timing Engine',
        systemPrompt: `${wLensOv?.western_multi_clock_timing?.trim() || WESTERN_DEEP_AUDIT_LENSES.western_multi_clock_timing}\n${westernSharedRules}`,
        userPrompt: `Question: ${userPrompt}${directiveNote}\n\nWESTERN TIMING SLICE:\n${JSON.stringify(westernTimingSlice)}`,
      },
      {
        id: 'western_contrarian_auditor',
        name: 'Contrarian / Falsification Auditor',
        systemPrompt: `${wLensOv?.western_contrarian_auditor?.trim() || WESTERN_DEEP_AUDIT_LENSES.western_contrarian_auditor}\n${westernSharedRules}`,
        userPrompt: `Question: ${userPrompt}${directiveNote}\n\nCONTRARIAN & REALITY SLICE:\n${JSON.stringify(westernContrarianSlice)}`,
      },
    ];
  }

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
  voicePreset?: VedicVoicePreset;
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
  chatStyle?: ChatStyle;
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
  meta: VedicSynthesisMeta;
}

function buildAdjudicatorSystemPrompt(params: {
  base: RunDeepCouncilAuditParams;
  convergence: DeterministicConvergenceResult;
  effectiveFluency: UserFluencyTier;
  lensResults: DeepAuditLensResult[];
}): string {
  const { base, convergence, effectiveFluency, lensResults } = params;
  const tradition: 'vedic' | 'western' =
    base.pkg.tradition === 'western' ? 'western' : 'vedic';
  const successfulLenses = lensResults.filter((l) => l.ok && l.output.trim().length > 0);

  const lensNotesBlock = successfulLenses
    .map((l) => `### Independent Analytical Thread (${l.name})\n${l.output.trim()}`)
    .join('\n\n');

  const dualViewRule =
    base.responseLength === 'short'
      ? buildShortReplyBreakdownInstruction(
          effectiveFluency,
          base.languageSlug,
          tradition,
          base.engineOverrides
        )
      : effectiveFluency !== 'beginner' || base.outputSlug === 'marriage_master'
      ? tradition === 'western'
        ? `TECHNICAL TRACE REQUIREMENT:
End cleanly with a concise, clearly labeled **System Convergence & Technical Trace** section showing how Sect, Essential/Accidental Dignity, Tight <=2° Aspects & Configurations, Placidus cusp rulers, and Multi-Clock Profection/Transit timing resolve any friction (keep bullet points crisp and mobile-readable).`
        : `TECHNICAL TRACE REQUIREMENT:
End cleanly with a concise, clearly labeled **System Convergence & Technical Trace** section showing how KP promise, D9 Navamsa endurance, Shadbala/SAV stamina, and active Dasha timing resolve any friction (keep bullet points crisp and mobile-readable).`
      : '';

  const adjudicatorTemplate =
    tradition === 'western'
      ? base.engineOverrides?.western_deep_audit_adjudicator_mandate?.trim() ||
        WESTERN_DEEP_AUDIT_ADJUDICATOR_MANDATE
      : base.engineOverrides?.deep_audit_adjudicator_mandate?.trim() ||
        DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE;
  const adjudicatorBlock = adjudicatorTemplate
    .replace(/\{\{TRUTH_GATE_HIERARCHY\}\}/g, base.pkg.truthGateHierarchy.join(' | '))
    .replace(/\{\{CONVERGENCE_BADGE\}\}/g, `**${convergence.bandLabel}** — ${convergence.tierLabel}`);

  const tier1Laws =
    tradition === 'western'
      ? base.engineOverrides?.western_tier1_reasoning_laws?.trim() ||
        WESTERN_TIER1_REASONING_LAWS
      : base.engineOverrides?.vedic_tier1_reasoning_laws?.trim() ||
        VEDIC_TIER1_REASONING_LAWS;
  const antiCliche =
    tradition === 'western'
      ? base.engineOverrides?.western_anti_cliche_rules?.trim() ||
        WESTERN_ANTI_CLICHE_RULES
      : base.engineOverrides?.vedic_anti_cliche_rules?.trim() ||
        VEDIC_ANTI_CLICHE_RULES;

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
      base.engineOverrides,
      tradition
    ),
    buildVoiceAndFormatInstructions({
      voicePreset: base.voicePreset,
      outputSlug: base.outputSlug,
      languageSlug: base.languageSlug,
      responseLength: base.responseLength,
      effectiveFluency,
      engineOverrides: base.engineOverrides,
      tradition,
    }),
    base.chatStyle ? buildChatStyleInstruction(base.chatStyle, { isCouncil: true }) : '',
    dualViewRule,
    base.turnCount > 0
      ? `THREAD CONTINUITY (Message #${base.turnCount + 1}): Continue seamlessly from earlier turns without re-introducing yourself.`
      : '',
    tradition === 'western'
      ? `REAL-WORLD LIFE CONTEXT ANCHORS:\n${base.pkg.lifeContextAnchorText}`
      : `REAL-WORLD LIFE CONTEXT ANCHORS (Desh-Kaal-Patra):\n${base.pkg.lifeContextAnchorText}`,
    `PRIORITY ORDERING:\n${base.pkg.priorityRule.body}`,
    `SCOPED CHART & TIMING DATA:\n${JSON.stringify(base.pkg.chartSlice)}`,
    `SYNTHESIS INPUTS TO ADJUDICATE:\n${lensNotesBlock}`,
    base.pkg.requiresTimingStack && base.pkg.timingWidgets?.length
      ? buildTimingWidgetPlacementInstruction(base.pkg.timingWidgets, base.engineOverrides)
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

  const tradition: 'vedic' | 'western' =
    params.pkg.tradition === 'western' ? 'western' : 'vedic';

  const lensShortLabels: Record<DeepAuditLensSpec['id'], string> = {
    parashari_divisional: 'Parashari & Vargas',
    kp_nadi: 'KP & Nadi',
    multi_clock_timing: 'Timing',
    contrarian_auditor: 'Contrarian Audit',
    sect_dignity_rulers: 'Sect & Dignity',
    tight_aspects_patterns: 'Tight Aspects',
    western_multi_clock_timing: 'Timing',
    western_contrarian_auditor: 'Contrarian Audit',
  };
  const completedLabels: string[] = [];
  params.onStatus?.(
    tradition === 'western'
      ? 'Running 4-system Western audit (Sect & Dignity, Aspects, Timing, Contrarian)…'
      : 'Running 4-system council audit (Parashari, KP, Timing, Contrarian)…'
  );

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
        tradition,
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
    let finalFinishReason = 'stop';
    const handleStreamChunk = (chunkText: string) => {
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
          const beforeTag = sanitizeVedicProse(
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
        // Avoid splitting leading :::prediction markers, trailing "the native", or partial TIMING_BAR tokens
        const trailingMatch =
          /(?:^|\r?\n)[ \t]*(?::{1,3}[a-zA-Z0-9_-]*|(?:prediction|ediction|analysis)\b[ \t]*[:\-]?|\[(?:CONFIDENCE|FOLLOWUP)[^\]]*)|(?:\b(?:the|a)(?:\s+native['’]?s?)?|\[\[?TIMING_BAR[^\]]*)$/i.exec(
            tentative
          );
        if (trailingMatch) {
          safeEnd -= trailingMatch[0].length;
        }
        if (safeEnd > flushedLength) {
          const toEmit = sanitizeVedicProse(
            rawAccumulated.slice(flushedLength, safeEnd),
            allowedTimingWidgetIds
          );
          flushedLength = safeEnd;
          if (toEmit) params.onChunk(toEmit);
        }
      }
    };

    const adjudicatorUserText = appendTurnVerificationModifier(
      params.finalUserText,
      tradition,
      params.engineOverrides
    );

    const streamResult = await streamOpenRouterCompletion({
      model: params.model,
      system: adjudicatorSystem,
      messages: [
        ...params.historyMessages,
        { role: 'user', content: adjudicatorUserText },
      ],
      temperature: 0.35,
      maxTokens: Math.max(params.maxOutputTokens, 4800),
      abortSignal: internalAbortController.signal,
      onChunk: handleStreamChunk,
    });
    finalFinishReason = streamResult.finishReason || 'stop';

    let contTokensIn = 0;
    let contTokensOut = 0;
    let contAborted = false;
    if (
      finalFinishReason === 'length' &&
      !streamResult.aborted &&
      !leakIntercepted &&
      !hiddenBreakdownHoldStarted &&
      rawAccumulated.trim().length > 0 &&
      !/[.!?)"'\]\*\`]\s*$/.test(rawAccumulated)
    ) {
      const contResult = await streamOpenRouterCompletion({
        model: params.model,
        system: adjudicatorSystem,
        messages: [
          ...params.historyMessages,
          { role: 'user', content: adjudicatorUserText },
          { role: 'assistant', content: rawAccumulated },
          {
            role: 'user',
            content:
              'Continue seamlessly from your exact last word to finish this sentence and complete your reading cleanly without repeating anything already written.',
          },
        ],
        temperature: 0.35,
        maxTokens: 1800,
        abortSignal: internalAbortController.signal,
        onChunk: handleStreamChunk,
      });
      contTokensIn = contResult.tokensIn;
      contTokensOut = contResult.tokensOut;
      contAborted = contResult.aborted;
    }

    const lensTokensIn = lensResults.reduce((s, r) => s + r.tokensIn, 0);
    const lensTokensOut = lensResults.reduce((s, r) => s + r.tokensOut, 0);
    const totalTokensIn = lensTokensIn + streamResult.tokensIn + contTokensIn;
    const totalTokensOut = lensTokensOut + streamResult.tokensOut + contTokensOut;

    const meta: VedicSynthesisMeta = {
      tradition,
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

    if (leakIntercepted || containsInternalPromptLeak(rawAccumulated)) {
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
      const remaining = sanitizeVedicProse(
        extractedAccumulated.mainText.slice(flushedLength),
        allowedTimingWidgetIds
      );
      flushedLength = extractedAccumulated.mainText.length;
      if (remaining) params.onChunk(remaining);
    }

    const extractedFinal = extractTechBreakdown(rawAccumulated.trim());
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
      aborted: (streamResult.aborted || contAborted) && !leakIntercepted,
      leakIntercepted: false,
      lenses: lensResults,
      convergence,
      meta,
    };
  } finally {
    params.abortSignal.removeEventListener('abort', forwardAbort);
  }
}
