import type { MessageSuggestions, SuggestionItem } from '../../components/app/chatTypes';
import type {
  Stage1RouterResult,
  SutraSynthesisMeta,
  UserFluencyTier,
} from '../../lib/sutraTypes';
import { getPlaybookById } from './canonicalPlaybooks';
import type { Stage2ContextPackage } from './contextSlicer';
import type { NatalTruthDossierV1 } from './natalDossier';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfigured,
  isOpenRouterConfiguredAsync,
} from './openrouter';
import {
  getChatbotConfig,
  getResolvedOpenRouterRuntime,
  getSuggestionsConfig,
} from './platformSettings';

export interface Stage4ContradictionSeed {
  title: string;
  mechanism: string;
  kind: 'contradiction' | 'cancellation' | 'chalit_shift' | 'yoga' | 'dosha';
}

export interface Stage4NextHopSeed {
  playbookId: string;
  shortLabel: string;
  title: string;
  domain: string;
}

export interface Stage4StructuredSeeds {
  playbookId: string;
  domain: string;
  unusedContradictions: Stage4ContradictionSeed[];
  nextHops: Stage4NextHopSeed[];
  needsDeepAuditEscalation: boolean;
  escalationReason: string | null;
  currentFluency: UserFluencyTier;
  deeperTargetFluency: UserFluencyTier;
  fluencyBridgeDirective: string;
}

export interface GenerateAlignedStage4Params {
  stage2Pkg: Stage2ContextPackage;
  dossier?: NatalTruthDossierV1 | null;
  routerResult?: Stage1RouterResult | null;
  sutraMeta: SutraSynthesisMeta;
  userQuestion: string;
  assistantAnswer: string;
  languageSlug: string;
  userFluency?: UserFluencyTier;
  existingTexts?: string[];
  maxFollowupsOverride?: number;
  maxDeeperOverride?: number;
}

function nextFluencyRung(current: UserFluencyTier): UserFluencyTier {
  if (current === 'beginner') return 'guided_bridge';
  if (current === 'guided_bridge') return 'practitioner';
  return 'practitioner';
}

function buildFluencyBridgeDirective(
  current: UserFluencyTier,
  target: UserFluencyTier
): string {
  if (current === 'beginner') {
    return `Current fluency is "beginner": write "followups" in warm, everyday life language (zero unexplained jargon). Write "deeper_analysis" one rung deeper ("${target}") by gently introducing 1 specific named check (e.g., Navamsa / D9 inner strength, KP Sub-Lord support, or house-lord timing) with its plain-English meaning first.`;
  }
  if (current === 'guided_bridge') {
    return `Current fluency is "guided_bridge": write "followups" as crisp life questions with light chart context. Write "deeper_analysis" one rung deeper ("${target}") by explicitly targeting named D9/D10 divisional checks, Bhava-Chalit shifts, SAV bindus, or KP Cuspal Sub-Lord verification.`;
  }
  return `Current fluency is "practitioner": write "followups" cleanly at intermediate-to-peer clarity. Write "deeper_analysis" as rigorous cross-divisional falsification probes testing KP Cuspal Sub-Lords, Shadbala/PHI, SAV bindu thresholds, and Nakshatra-lord overrides.`;
}

/**
 * Pure deterministic Stage 4 seed extractor (0ms, $0 LLM cost).
 * Identifies unused dossier contradictions, Bhava-Chalit shifts, Playbook Next-Hops,
 * Cancellation/Low-Convergence Deep Audit escalation, and the +1 Fluency Ladder.
 */
export function buildStage4StructuredSeeds(params: {
  stage2Pkg: Stage2ContextPackage;
  dossier?: NatalTruthDossierV1 | null;
  routerResult?: Stage1RouterResult | null;
  sutraMeta: SutraSynthesisMeta;
  assistantAnswer: string;
  userFluency?: UserFluencyTier;
}): Stage4StructuredSeeds {
  const answerLower = String(params.assistantAnswer || '').toLowerCase();
  const currentFluency =
    params.userFluency || params.sutraMeta.effectiveFluency || 'beginner';
  const deeperTargetFluency = nextFluencyRung(currentFluency);
  const playbook = getPlaybookById(params.stage2Pkg.playbookId);

  const isAlreadyCovered = (tokens: Array<string | null | undefined>): boolean => {
    const significant = tokens
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 4);
    if (significant.length === 0) return false;
    let hits = 0;
    for (const t of significant) {
      if (answerLower.includes(t)) hits += 1;
    }
    return hits >= Math.min(2, significant.length);
  };

  const unusedContradictions: Stage4ContradictionSeed[] = [];
  const layerA = params.dossier?.layer_a;

  if (layerA) {
    for (const contradictionText of layerA.unresolved_contradictions || []) {
      const clean = String(contradictionText || '').trim();
      if (!clean) continue;
      const keyTokens = clean.split(/[\s:,;()]+/).filter((w) => w.length >= 5).slice(0, 3);
      if (!isAlreadyCovered(keyTokens)) {
        const shortTitle = clean.split(/[—:(]/)[0].trim().slice(0, 68) || clean.slice(0, 68);
        unusedContradictions.push({
          title: shortTitle,
          mechanism: clean,
          kind: 'contradiction',
        });
      }
    }

    for (const shift of layerA.command_hierarchy?.dispositor_backbone?.bhava_chalit_shifts || []) {
      const cleanShift = String(shift || '').trim();
      if (!cleanShift) continue;
      const planetWord = cleanShift.split(/\s+/)[0] || '';
      if (
        planetWord &&
        !answerLower.includes('chalit') &&
        !answerLower.includes(cleanShift.toLowerCase().slice(0, 18))
      ) {
        unusedContradictions.push({
          title: `Bhava-Chalit shift (${planetWord})`,
          mechanism: cleanShift,
          kind: 'chalit_shift',
        });
      }
    }
  }

  for (const canc of params.stage2Pkg.triggeredCancellations || []) {
    const titleWords = canc.title.split(/\s+/).slice(0, 3);
    if (!isAlreadyCovered(titleWords)) {
      unusedContradictions.push({
        title: canc.title,
        mechanism: canc.detail,
        kind: 'cancellation',
      });
    }
  }

  if (layerA) {
    for (const y of layerA.validated_yogas || []) {
      if (!answerLower.includes(y.name.toLowerCase())) {
        unusedContradictions.push({
          title: `${y.name} (${y.status})`,
          mechanism: `${y.formula_proof} — YSI ${y.ysi_score_0_110}/110`,
          kind: 'yoga',
        });
      }
    }
    for (const d of layerA.doshas_and_hidden_risks || []) {
      if (!answerLower.includes(d.name.toLowerCase())) {
        unusedContradictions.push({
          title: `${d.name} (Severity ${d.severity_0_10}/10)`,
          mechanism: `${d.d1_trigger} | D9: ${d.d9_status} | Offset: ${d.offset_present}`,
          kind: 'dosha',
        });
      }
    }
  }

  // Deduplicate by title and cap to 8 highest-signal seeds
  const seenTitles = new Set<string>();
  const dedupedContradictions: Stage4ContradictionSeed[] = [];
  for (const seed of unusedContradictions) {
    const key = seed.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    dedupedContradictions.push(seed);
    if (dedupedContradictions.length >= 8) break;
  }

  // Input 2: Playbook Next-Hop Graph
  const nextHops: Stage4NextHopSeed[] = [];
  for (const hopId of playbook?.nextHops || []) {
    const hop = getPlaybookById(hopId);
    if (!hop || hop.id === params.stage2Pkg.playbookId) continue;
    nextHops.push({
      playbookId: hop.id,
      shortLabel: hop.shortLabel,
      title: hop.title,
      domain: hop.domain,
    });
  }

  // Input 3: Cancellation & Low-Convergence Escalation
  const pivotalCodes = new Set([
    'NEECHA_BHANGA',
    'DASHA_SANDHI_WINDOW',
    'SAV_LOW_BINDUS',
    'D1_STRONG_D9_INVERSION',
    'MARAKA_ACTIVE_DASHAS',
    'KP_MINUTE_SENSITIVITY',
  ]);
  const pivotalCancellation = (params.stage2Pkg.triggeredCancellations || []).find(
    (c) => c.severity === 'high' || pivotalCodes.has(c.code)
  );
  const splitConvergence = params.sutraMeta.convergencePillarsAligned <= 3;
  const highStakes = (params.routerResult?.complexity_intensity ?? 5) >= 8;

  const needsDeepAuditEscalation =
    !params.sutraMeta.isDeepAudit &&
    (splitConvergence || highStakes || Boolean(pivotalCancellation));

  let escalationReason: string | null = null;
  if (needsDeepAuditEscalation) {
    const reasons: string[] = [];
    if (splitConvergence) {
      reasons.push(
        `mixed pillar convergence (${params.sutraMeta.convergenceBandLabel})`
      );
    }
    if (pivotalCancellation) {
      reasons.push(`active ${pivotalCancellation.title}`);
    }
    if (highStakes) {
      reasons.push('high-stakes decision complexity');
    }
    escalationReason = reasons.join(' + ');
  }

  return {
    playbookId: params.stage2Pkg.playbookId,
    domain: params.stage2Pkg.domain,
    unusedContradictions: dedupedContradictions,
    nextHops: nextHops.slice(0, 6),
    needsDeepAuditEscalation,
    escalationReason,
    currentFluency,
    deeperTargetFluency,
    fluencyBridgeDirective: buildFluencyBridgeDirective(
      currentFluency,
      deeperTargetFluency
    ),
  };
}

function safeExtractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = String(raw || '').trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function sanitizeSuggestionItem(
  raw: unknown,
  prefix: 'fu' | 'da',
  index: number,
  includeDirective: boolean
): SuggestionItem | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const clean = raw.trim();
    if (!clean) return null;
    return {
      id: `${prefix}_${index + 1}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
    };
  }
  if (typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const rawText = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (!rawText) return null;
    const item: SuggestionItem = {
      id: `${prefix}_${index + 1}_${Math.random().toString(36).slice(2, 6)}`,
      text: rawText,
    };
    if (includeDirective && typeof rec.technical_directive === 'string' && rec.technical_directive.trim()) {
      item.technical_directive = rec.technical_directive.trim().slice(0, 600);
    }
    if (rec.action === 'deep_audit') {
      item.action = 'deep_audit';
    }
    if (typeof rec.playbook_id === 'string' && rec.playbook_id.trim()) {
      item.playbook_id = rec.playbook_id.trim();
    }
    return item;
  }
  return null;
}

function deduplicateList(
  items: SuggestionItem[],
  seenKeys: Set<string>,
  limit: number
): SuggestionItem[] {
  const out: SuggestionItem[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function buildHumanQuestionForHop(hop: Stage4NextHopSeed): string {
  const cleanLabel = hop.shortLabel
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  const lower = cleanLabel.toLowerCase();
  if (/^(when|how|what|will|should|does|is|can|why)\b/.test(lower)) {
    return cleanLabel.endsWith('?') ? cleanLabel : `${cleanLabel}?`;
  }
  return `How does ${cleanLabel.charAt(0).toLowerCase() + cleanLabel.slice(1)} look in my chart?`;
}

/**
 * Deterministic zero-LLM fallback (also enriches sparse LLM outputs so every turn has
 * specific, non-generic chart-seeded followups & deeper probes even offline).
 */
export function buildDeterministicFallbackSuggestions(
  seeds: Stage4StructuredSeeds,
  maxF: number,
  maxD: number,
  seenKeys: Set<string>
): MessageSuggestions {
  const followups: SuggestionItem[] = [];
  for (let i = 0; i < seeds.nextHops.length && followups.length < maxF; i++) {
    const hop = seeds.nextHops[i];
    const text = buildHumanQuestionForHop(hop);
    const key = text.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    followups.push({
      id: `fu_s4_${i + 1}`,
      text,
      playbook_id: hop.playbookId,
    });
  }

  const deeper: SuggestionItem[] = [];

  // Escalation chip first when convergence is split or high-severity cancellation exists
  if (seeds.needsDeepAuditEscalation && maxD > 0) {
    const deepText = 'Run a 4-Lens Deep Council Audit on these conflicting factors';
    const key = deepText.toLowerCase();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deeper.push({
        id: 'da_deep_audit',
        text: deepText,
        action: 'deep_audit',
        playbook_id: seeds.playbookId,
        technical_directive: `Run full 4-lens cross-verification (${seeds.escalationReason || 'split convergence'}) applying the 5-Tier Truth Gate (KP CSL -> D9 -> PHI/Shadbala -> SAV -> D1) and weigh opposing outcomes transparently.`,
      });
    }
  }

  for (let i = 0; i < seeds.unusedContradictions.length && deeper.length < maxD; i++) {
    const c = seeds.unusedContradictions[i];
    const text =
      c.kind === 'chalit_shift'
        ? `Check how ${c.title} changes real-world results vs. my Rashi chart`
        : c.kind === 'cancellation'
        ? `Test whether ${c.title} softens or reverses the timing tension`
        : c.kind === 'yoga'
        ? `Check when ${c.title} actually activates in my upcoming Dasha`
        : c.kind === 'dosha'
        ? `Verify if ${c.title} affects this area or stays neutralized`
        : `Resolve the chart tension around ${c.title}`;
    const key = text.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deeper.push({
      id: `da_s4_${i + 1}`,
      text,
      playbook_id: seeds.playbookId,
      technical_directive: `Target fluency=${seeds.deeperTargetFluency}. Audit "${c.title}": ${c.mechanism}. Cross-verify with KP Cuspal Sub-Lord, D9 Navamsa endurance, Bhava-Chalit placement, and active Vimshottari MD/AD/PD timing.`,
    });
  }

  return {
    followups: followups.slice(0, maxF),
    deeper_analysis: deeper.slice(0, maxD),
  };
}

/**
 * Stage 4 Decoupled Chart-Aligned Suggestions Engine.
 * Strictly seeded by:
 * 1. Unused Dossier contradictions, Bhava-Chalit shifts, Yogas & Doshas
 * 2. Playbook Next-Hop Graph (`canonicalPlaybooks.ts`)
 * 3. Cancellation & Low-Convergence Escalation (`Deep Council Audit` trigger)
 * 4. `+1` Fluency Ladder progression with hidden `technical_directive`
 */
export async function generateAlignedStage4Suggestions(
  params: GenerateAlignedStage4Params
): Promise<MessageSuggestions> {
  const seeds = buildStage4StructuredSeeds({
    stage2Pkg: params.stage2Pkg,
    dossier: params.dossier,
    routerResult: params.routerResult,
    sutraMeta: params.sutraMeta,
    assistantAnswer: params.assistantAnswer,
    userFluency: params.userFluency,
  });

  const existingSeen = new Set<string>(
    (params.existingTexts || [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );

  let maxF = params.maxFollowupsOverride ?? 4;
  let maxD = params.maxDeeperOverride ?? 4;
  let followupsRules = '';
  let deeperRules = '';
  let utilityModel = getUtilityModel();
  let utilityMaxTokens = 750;

  try {
    const [chatbotConfig, suggestionsConfig, runtime] = await Promise.all([
      getChatbotConfig(),
      getSuggestionsConfig(),
      getResolvedOpenRouterRuntime(),
    ]);
    if (
      chatbotConfig.features.followups === false ||
      (!suggestionsConfig.followups_enabled && !suggestionsConfig.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }
    if (params.maxFollowupsOverride === undefined) {
      maxF = suggestionsConfig.followups_enabled
        ? Math.max(1, Math.min(6, suggestionsConfig.max_followups || 4))
        : 0;
    } else if (!suggestionsConfig.followups_enabled) {
      maxF = 0;
    }
    if (params.maxDeeperOverride === undefined) {
      maxD = suggestionsConfig.deeper_analysis_enabled
        ? Math.max(1, Math.min(6, suggestionsConfig.max_deeper_analysis || 4))
        : 0;
    } else if (!suggestionsConfig.deeper_analysis_enabled) {
      maxD = 0;
    }
    followupsRules = suggestionsConfig.followups_rules || '';
    deeperRules = suggestionsConfig.deeper_analysis_rules || '';
    utilityModel = runtime.utilityModel || utilityModel;
    utilityMaxTokens = Math.max(700, runtime.tokenLimits.utility || 750);
  } catch {
    // Allow clean offline execution in CLI QA harness without Supabase
  }

  if (maxF === 0 && maxD === 0) {
    return { followups: [], deeper_analysis: [] };
  }

  const openRouterReady = await isOpenRouterConfiguredAsync().catch(() =>
    isOpenRouterConfigured()
  );
  if (!openRouterReady) {
    return buildDeterministicFallbackSuggestions(seeds, maxF, maxD, existingSeen);
  }

  const nextHopsText =
    seeds.nextHops.length > 0
      ? seeds.nextHops
          .map((h) => `- [${h.playbookId}] ${h.shortLabel} — ${h.title}`)
          .join('\n')
      : `- [${seeds.playbookId}] Continue exploring ${seeds.domain} timing and practical next steps`;

  const contradictionsText =
    seeds.unusedContradictions.length > 0
      ? seeds.unusedContradictions
          .map((c) => `- (${c.kind}) ${c.title}: ${c.mechanism}`)
          .join('\n')
      : '- No unmentioned contradictions; check D9 endurance vs. current Vimshottari Antardasha & SAV volume.';

  const dedupBlock =
    existingSeen.size > 0
      ? `\nDEDUPLICATION (DO NOT repeat or paraphrase these already-shown questions):\n${Array.from(
          existingSeen
        )
          .slice(0, 24)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}\n`
      : '';

  const escalationInstruction = seeds.needsDeepAuditEscalation
    ? `\n3. CANCELLATION / LOW-CONVERGENCE ESCALATION TRIGGERED (${seeds.escalationReason}):
Include ONE "deeper_analysis" item with "action": "deep_audit" offering a thorough 4-Lens Deep Council Audit of the conflicting factors (written naturally in ${params.languageSlug}, e.g., "Run a 4-Lens Deep Council Audit on these conflicting signals").`
    : '';

  const prompt = `You are Stage 4 of the Sutradhara Vedic Consultation Engine generating Chart-Aligned Follow-Up & Deeper Analysis suggestions.

STRICT 4-SOURCE SEEDING CONTRACT (Eliminate generic filler like "Tell me more about my chart"):
1. PLAYBOOK NEXT-HOP GRAPH (Seed "followups" primarily from these natural next questions in ${params.languageSlug}):
${nextHopsText}

2. UNUSED CHART CONTRADICTIONS, CHALIT SHIFTS, YOGAS & DOSHAS NOT YET COVERED (Seed "deeper_analysis" directly from these real chart features):
${contradictionsText}
${escalationInstruction}

4. +1 FLUENCY LADDER RULE:
${seeds.fluencyBridgeDirective}
- Write all user-facing "text" strings in ${params.languageSlug}.
- Write every "technical_directive" in crisp English naming exact houses, Vargas (D9/D10/D7/D2/D4), KP CSL, SAV bindus, or cancellations to verify if clicked.
${followupsRules ? `\nADMIN FOLLOWUP STYLE:\n${followupsRules}` : ''}
${deeperRules ? `\nADMIN DEEPER ANALYSIS STYLE:\n${deeperRules}` : ''}
${dedupBlock}
CONVERSATION CONTEXT:
Playbook: ${seeds.playbookId} | Domain: ${seeds.domain} | Convergence: ${params.sutraMeta.convergenceBandLabel}
User Question: ${params.userQuestion.slice(0, 450)}
Answer Summary: ${params.assistantAnswer.slice(0, 1200)}

Return STRICTLY JSON:
{
  "followups": ${maxF > 0 ? `[{ "text": "...", "playbook_id": "OPTIONAL_ID" }] (up to ${maxF} items)` : '[]'},
  "deeper_analysis": ${maxD > 0 ? `[{ "text": "...", "technical_directive": "...", "action": "deep_audit (ONLY on the 1 escalation item if triggered)" }] (up to ${maxD} items)` : '[]'}
}`;

  try {
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      maxTokens: utilityMaxTokens,
      jsonMode: true,
      temperature: params.existingTexts?.length ? 0.6 : 0.4,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = safeExtractJsonObject(completion.text);
    const rawFu = Array.isArray(parsed.followups) ? parsed.followups : [];
    const rawDa = Array.isArray(parsed.deeper_analysis)
      ? parsed.deeper_analysis
      : [];

    const parsedFu = rawFu
      .map((item, idx) => sanitizeSuggestionItem(item, 'fu', idx, false))
      .filter((x): x is SuggestionItem => Boolean(x));
    const parsedDa = rawDa
      .map((item, idx) => sanitizeSuggestionItem(item, 'da', idx, true))
      .filter((x): x is SuggestionItem => Boolean(x));

    const followups =
      maxF > 0 ? deduplicateList(parsedFu, existingSeen, maxF) : [];
    let deeper =
      maxD > 0 ? deduplicateList(parsedDa, existingSeen, maxD) : [];

    // Guarantee Deep Audit escalation chip appears when triggered & room remains
    if (
      seeds.needsDeepAuditEscalation &&
      maxD > 0 &&
      !deeper.some((d) => d.action === 'deep_audit')
    ) {
      const escalationFallback = buildDeterministicFallbackSuggestions(
        seeds,
        0,
        1,
        existingSeen
      );
      if (escalationFallback.deeper_analysis.length > 0) {
        deeper = [
          escalationFallback.deeper_analysis[0],
          ...deeper.slice(0, Math.max(0, maxD - 1)),
        ];
      }
    }

    // Backfill cleanly from deterministic seeds if LLM returned fewer items
    if (followups.length === 0 || deeper.length === 0) {
      const fallback = buildDeterministicFallbackSuggestions(
        seeds,
        Math.max(0, maxF - followups.length),
        Math.max(0, maxD - deeper.length),
        existingSeen
      );
      return {
        followups: followups.length > 0 ? followups : fallback.followups,
        deeper_analysis: deeper.length > 0 ? deeper : fallback.deeper_analysis,
      };
    }

    return { followups, deeper_analysis: deeper };
  } catch {
    return buildDeterministicFallbackSuggestions(seeds, maxF, maxD, existingSeen);
  }
}

export async function generateMoreAlignedStage4Suggestions(
  params: Omit<
    GenerateAlignedStage4Params,
    'maxFollowupsOverride' | 'maxDeeperOverride'
  > & { count?: number }
): Promise<MessageSuggestions> {
  const totalTarget = Math.max(2, Math.min(12, params.count || 8));
  const countF = Math.ceil(totalTarget / 2);
  const countD = Math.floor(totalTarget / 2);
  return generateAlignedStage4Suggestions({
    ...params,
    maxFollowupsOverride: countF,
    maxDeeperOverride: countD,
  });
}
