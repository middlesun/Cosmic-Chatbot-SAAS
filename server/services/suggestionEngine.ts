import type { MessageSuggestions, SuggestionItem } from '../../components/app/chatTypes';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  type Stage1RouterResult,
  type UserFluencyTier,
  type VedicSynthesisMeta,
} from '../../lib/vedicTypes';
import { getPlaybookById, localizePlaybookForWestern } from './canonicalPlaybooks';
import type { Stage2ContextPackage } from './contextSlicer';
import type { NatalTruthDossierV1 } from './natalDossier';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfigured,
  isOpenRouterConfiguredAsync,
} from './openrouter';
import {
  DEFAULT_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
  DEFAULT_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
  WESTERN_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
  WESTERN_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
} from './enginePromptDefaults';
import {
  getEnginePromptOverrides,
  getResolvedGuideConfig,
  getResolvedOpenRouterRuntime,
} from './platformSettings';

export interface Stage4ContradictionSeed {
  title: string;
  mechanism: string;
  kind:
    | 'contradiction'
    | 'cancellation'
    | 'chalit_shift'
    | 'yoga'
    | 'dosha'
    | 'configuration'
    | 'mutual_reception'
    | 'tight_aspect';
}

export interface Stage4NextHopSeed {
  playbookId: string;
  shortLabel: string;
  title: string;
  domain: string;
}

export interface Stage4StructuredSeeds {
  isWestern: boolean;
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
  vedicMeta: VedicSynthesisMeta;
  userQuestion: string;
  assistantAnswer: string;
  languageSlug: string;
  userFluency?: UserFluencyTier;
  expertSlug?: string;
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
  target: UserFluencyTier,
  isWestern = false
): string {
  if (isWestern) {
    if (current === 'beginner') {
      return `Current fluency is "beginner": write "followups" in warm, everyday life language (zero unexplained jargon). Write "deeper_analysis" one rung deeper ("${target}") by gently introducing 1 specific named Western check (e.g., Annual Profection focus, Solar Return, or a tight natal aspect) with its plain-English meaning first.`;
    }
    if (current === 'guided_bridge') {
      return `Current fluency is "guided_bridge": write "followups" as crisp life questions with light chart context. Write "deeper_analysis" one rung deeper ("${target}") by explicitly targeting Diurnal/Nocturnal Sect, Mutual Reception, Progressed Moon, or tight <2° natal aspects.`;
    }
    return `Current fluency is "practitioner": write "followups" cleanly at intermediate-to-peer clarity. Write "deeper_analysis" as rigorous Western falsification probes testing Contrary-to-Sect Malefic mitigation, Dispositor loops, Solar Return Midheaven, and tight outer transits.`;
  }

  if (current === 'beginner') {
    return `Current fluency is "beginner": write "followups" in warm, everyday life language (zero unexplained jargon). Write "deeper_analysis" one rung deeper ("${target}") by gently introducing 1 specific named check (e.g., Navamsa / D9 inner strength, KP Sub-Lord support, or house-lord timing) with its plain-English meaning first.`;
  }
  if (current === 'guided_bridge') {
    return `Current fluency is "guided_bridge": write "followups" as crisp life questions with light chart context. Write "deeper_analysis" one rung deeper ("${target}") by explicitly targeting named D9/D10 divisional checks, Bhava-Chalit shifts, SAV bindus, or KP Cuspal Sub-Lord verification.`;
  }
  return `Current fluency is "practitioner": write "followups" cleanly at intermediate-to-peer clarity. Write "deeper_analysis" as rigorous cross-divisional falsification probes testing KP Cuspal Sub-Lords, Shadbala/PHI, SAV bindu thresholds, and Nakshatra-lord overrides.`;
}

const TOPIC_STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'almost', 'alone', 'along', 'already',
  'also', 'although', 'always', 'among', 'another', 'answer', 'anything', 'around',
  'asked', 'astrology', 'because', 'become', 'before', 'being', 'below', 'between',
  'birth', 'chart', 'could', 'current', 'currently', 'doing', 'during', 'each',
  'either', 'enough', 'especially', 'every', 'everyone', 'everything', 'feel', 'feeling',
  'first', 'focus', 'from', 'further', 'general', 'getting', 'going', 'good', 'great',
  'having', 'here', 'hers', 'herself', 'himself', 'house', 'houses', 'however', 'into',
  'itself', 'just', 'keep', 'kind', 'know', 'last', 'later', 'least', 'less', 'life',
  'like', 'likely', 'little', 'look', 'looking', 'made', 'make', 'making', 'many',
  'mean', 'means', 'might', 'more', 'most', 'much', 'must', 'myself', 'native',
  'natural', 'need', 'needs', 'never', 'next', 'none', 'nothing', 'often', 'only',
  'other', 'others', 'over', 'part', 'period', 'person', 'phase', 'place', 'planet',
  'planets', 'please', 'point', 'possible', 'potential', 'present', 'really', 'recent',
  'right', 'said', 'same', 'season', 'seems', 'seen', 'several', 'should', 'shows',
  'since', 'some', 'someone', 'something', 'somewhat', 'still', 'strong', 'such',
  'sure', 'take', 'taking', 'tell', 'than', 'that', 'their', 'theirs', 'them', 'then',
  'there', 'these', 'they', 'thing', 'things', 'think', 'this', 'those', 'though',
  'through', 'time', 'timing', 'today', 'together', 'toward', 'towards', 'turn',
  'under', 'until', 'very', 'want', 'wants', 'well', 'were', 'what', 'when', 'where',
  'whether', 'which', 'while', 'will', 'with', 'within', 'without', 'would', 'year',
  'years', 'your', 'yours', 'yourself',
]);

function extractTopicAnchorTokens(text: string): Set<string> {
  const tokens = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !TOPIC_STOPWORDS.has(t));
  return new Set(tokens);
}

function scoreTopicOverlap(candidateText: string, anchorTokens: Set<string>): number {
  if (anchorTokens.size === 0) return 0;
  const words = String(candidateText || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !TOPIC_STOPWORDS.has(t));
  const matched = new Set<string>();
  for (const w of words) {
    if (anchorTokens.has(w)) {
      matched.add(w);
    }
  }
  return matched.size;
}

/**
 * Pure deterministic Stage 4 seed extractor (0ms, $0 LLM cost).
 * Filters Dossier contradictions, Bhava-Chalit shifts, Yogas/Doshas, and Next-Hops
 * strictly by relevance to the user's immediate question & just-delivered answer.
 */
export function buildStage4StructuredSeeds(params: {
  stage2Pkg: Stage2ContextPackage;
  dossier?: NatalTruthDossierV1 | null;
  routerResult?: Stage1RouterResult | null;
  vedicMeta: VedicSynthesisMeta;
  userQuestion?: string;
  assistantAnswer: string;
  userFluency?: UserFluencyTier;
}): Stage4StructuredSeeds {
  const isWestern = params.stage2Pkg.tradition === 'western';
  const questionLower = String(params.userQuestion || '').toLowerCase();
  const answerLower = String(params.assistantAnswer || '').toLowerCase();
  const turnAnchorTokens = extractTopicAnchorTokens(
    `${params.userQuestion || ''}\n${params.assistantAnswer || ''}`
  );
  const currentFluency =
    params.userFluency || params.vedicMeta.effectiveFluency || 'beginner';
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

  if (isWestern) {
    const westernDossier = params.dossier?.western_dossier;
    if (westernDossier) {
      for (const contradictionText of westernDossier.unresolved_contradictions || []) {
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

      for (const cfg of westernDossier.configurations || []) {
        const title = `${cfg.type} (${cfg.planets.slice(0, 3).join(' / ')})`;
        if (!answerLower.includes(cfg.type.toLowerCase())) {
          unusedContradictions.push({
            title,
            mechanism: cfg.summary,
            kind: 'configuration',
          });
        }
      }

      for (const mr of westernDossier.dignity_hierarchy?.mutual_receptions || []) {
        const title = `Mutual Reception (${mr.planetA} ↔ ${mr.planetB})`;
        if (!isAlreadyCovered([mr.planetA, mr.planetB, 'reception'])) {
          unusedContradictions.push({
            title,
            mechanism: mr.summary,
            kind: 'mutual_reception',
          });
        }
      }

      for (const asp of westernDossier.tight_structural_aspects || []) {
        if (asp.orb > 2.0) continue;
        const title = `${asp.bodyA} ${asp.aspect} ${asp.bodyB} (${asp.orb.toFixed(1)}°)`;
        if (!isAlreadyCovered([asp.bodyA, asp.bodyB, asp.aspect])) {
          unusedContradictions.push({
            title,
            mechanism: `Core structural <=2° aspect (weight ${asp.weightScore}) shaping baseline chart wiring`,
            kind: 'tight_aspect',
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
  } else {
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
  }

  // Deduplicate and strictly filter contradictions/features to those relevant to the current Q&A topic
  const seenTitles = new Set<string>();
  const scoredContradictions: Array<{ seed: Stage4ContradictionSeed; score: number }> = [];
  for (const seed of unusedContradictions) {
    const key = seed.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    const overlap = scoreTopicOverlap(`${seed.title} ${seed.mechanism}`, turnAnchorTokens);
    // Keep only features that share topic/planet/house overlap with the active exchange (or high-signal cancellations)
    if (overlap > 0 || (seed.kind === 'cancellation' && turnAnchorTokens.size === 0)) {
      scoredContradictions.push({
        seed,
        score: overlap + (seed.kind === 'cancellation' || seed.kind === 'contradiction' ? 1 : 0),
      });
    }
  }
  scoredContradictions.sort((a, b) => b.score - a.score);
  const dedupedContradictions = scoredContradictions
    .slice(0, 6)
    .map((entry) => entry.seed);

  // Input 2: Playbook Next-Hop Graph — filter strictly to hops matching the active question/domain (prevent domain drift like marriage/contracts when asking about income/Dasha)
  const nextHops: Stage4NextHopSeed[] = [];
  const activeDomainLower = String(params.stage2Pkg.domain || '').toLowerCase();
  const candidateHops: Array<{ hop: Stage4NextHopSeed; score: number }> = [];
  for (const hopId of playbook?.nextHops || []) {
    const hop = getPlaybookById(hopId);
    if (!hop || hop.id === params.stage2Pkg.playbookId) continue;
    const localized = isWestern
      ? localizePlaybookForWestern(hop)
      : { shortLabel: hop.shortLabel, title: hop.title };
    const hopSeed: Stage4NextHopSeed = {
      playbookId: hop.id,
      shortLabel: localized.shortLabel,
      title: localized.title,
      domain: hop.domain,
    };
    const textOverlap = scoreTopicOverlap(
      `${localized.shortLabel} ${localized.title}`,
      turnAnchorTokens
    );
    const sameDomain = hop.domain.toLowerCase() === activeDomainLower;
    const explicitDomainMention =
      questionLower.includes(hop.domain.toLowerCase()) ||
      answerLower.includes(hop.domain.toLowerCase());
    if (textOverlap > 0 || sameDomain || explicitDomainMention) {
      candidateHops.push({
        hop: hopSeed,
        score: textOverlap * 2 + (sameDomain ? 2 : 0) + (explicitDomainMention ? 1 : 0),
      });
    }
  }
  candidateHops.sort((a, b) => b.score - a.score);
  for (const item of candidateHops.slice(0, 4)) {
    nextHops.push(item.hop);
  }

  // Input 3: Cancellation & Low-Convergence Escalation
  const pivotalCodes = isWestern
    ? new Set([
        'CONTRARY_TO_SECT_MALEFIC',
        'ESSENTIAL_DIGNITY_CHECK',
        'T_SQUARE',
        'GRAND_CROSS',
        'YOD',
        'ANGLE_BOUNDARY_SENSITIVITY',
      ])
    : new Set([
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
  const splitConvergence = params.vedicMeta.convergencePillarsAligned <= 3;
  const highStakes = (params.routerResult?.complexity_intensity ?? 5) >= 8;

  const needsDeepAuditEscalation =
    !params.vedicMeta.isDeepAudit &&
    (splitConvergence || highStakes || Boolean(pivotalCancellation));

  let escalationReason: string | null = null;
  if (needsDeepAuditEscalation) {
    const reasons: string[] = [];
    if (splitConvergence) {
      reasons.push(
        `mixed pillar convergence (${params.vedicMeta.convergenceBandLabel})`
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
    isWestern,
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
      deeperTargetFluency,
      isWestern
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
      item.technical_directive = rec.technical_directive.trim().slice(0, 240);
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
  seenKeys: Set<string>,
  userQuestion = ''
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

  // Topic-locked fallback followups if Playbook had zero same-domain nextHops
  const domainLabel = seeds.domain.replace(/_/g, ' ').toLowerCase();
  const hasDashaContext = /\b(dasha|antardasha|mahadasha|period|phase)\b/i.test(userQuestion);
  const topicFallbacks = hasDashaContext
    ? [
        'Which upcoming sub-period brings the clearest turning point in this exact cycle?',
        'What practical steps make the most of this current phase without forcing outcomes?',
        'How will the next transit shift interact with this same planetary period?',
        'Where might subtle friction show up in this phase so I can plan around it?',
      ]
    : [
        `What upcoming timing shift directly changes this ${domainLabel} outlook next?`,
        `What practical approach supports the best outcome here right now?`,
        `What could slow down or delay this exact ${domainLabel} trajectory?`,
        `How does the next planetary transit interact with this specific area?`,
      ];
  for (let i = 0; i < topicFallbacks.length && followups.length < maxF; i++) {
    const text = topicFallbacks[i];
    const key = text.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    followups.push({
      id: `fu_s4_topic_${i + 1}`,
      text,
      playbook_id: seeds.playbookId,
    });
  }

  const deeper: SuggestionItem[] = [];

  for (let i = 0; i < seeds.unusedContradictions.length && deeper.length < maxD; i++) {
    const c = seeds.unusedContradictions[i];
    const text = seeds.isWestern
      ? c.kind === 'configuration'
        ? `Explore how ${c.title} directly shapes this exact topic`
        : c.kind === 'mutual_reception'
        ? `Check how ${c.title} turns friction on this issue into skill`
        : c.kind === 'tight_aspect'
        ? `Test how your tight ${c.title} reacts to current transits on this theme`
        : c.kind === 'cancellation'
        ? `Examine whether ${c.title} softens or redirects this exact timing`
        : `Resolve the chart tension around ${c.title} for this question`
      : c.kind === 'chalit_shift'
      ? `Check how ${c.title} modifies real-world results on this exact question`
      : c.kind === 'cancellation'
      ? `Test whether ${c.title} softens or reverses this exact timing`
      : c.kind === 'yoga'
      ? `Verify how ${c.title} activates in the current sub-period for this topic`
      : c.kind === 'dosha'
      ? `Check if ${c.title} affects this exact area or stays neutralized`
      : `Examine how ${c.title} influences this specific reading`;
    const key = text.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deeper.push({
      id: `da_s4_${i + 1}`,
      text,
      playbook_id: seeds.playbookId,
      technical_directive: seeds.isWestern
        ? `Audit ${c.title} (${seeds.deeperTargetFluency}) strictly for this turn's question: verify Sect polarity, Placidus cusp ruler, tight <=2° aspects, and Profection/Transit timing.`
        : `Audit ${c.title} (${seeds.deeperTargetFluency}) strictly for this turn's question: verify KP Cuspal Sub-Lord, D9 endurance, Bhava-Chalit placement, and active MD/AD timing.`,
    });
  }

  const deeperTopicFallbacks = seeds.isWestern
    ? [
        {
          text: 'Verify the exact Placidus house ruler and Sect condition behind this answer',
          directive: `Audit the primary Placidus cusp ruler, Diurnal/Nocturnal Sect role, and tight <=2° aspects directly governing the user's last question.`,
        },
        {
          text: 'Cross-check Annual Profection and Progressed Moon timing on this same topic',
          directive: `Test Annual Profection Lord of the Year and Secondary Progressed Moon timing strictly for the user's last question.`,
        },
      ]
    : [
        {
          text: 'Verify the KP Sub-Lord promise and Navamsa strength behind this exact reading',
          directive: `Check KP Cuspal Sub-Lord, D9 Navamsa dignity, and Ashtakavarga SAV bindus specifically for the house and planet in the user's last question.`,
        },
        {
          text: 'Cross-check Pratyantardasha and Saturn-Jupiter Double Transit for this exact window',
          directive: `Trace Vimshottari MD/AD/PD shifts and Saturn/Jupiter Gochar from Lagna & Moon strictly for the timing question just asked.`,
        },
      ];
  for (let i = 0; i < deeperTopicFallbacks.length && deeper.length < maxD; i++) {
    const fb = deeperTopicFallbacks[i];
    const key = fb.text.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deeper.push({
      id: `da_s4_topic_${i + 1}`,
      text: fb.text,
      playbook_id: seeds.playbookId,
      technical_directive: fb.directive,
    });
  }

  return {
    followups: followups.slice(0, maxF),
    deeper_analysis: deeper.slice(0, maxD),
  };
}

/**
 * Stage 4 Decoupled Chart-Aligned Suggestions Engine.
 * Strictly anchored to the user's last question & just-delivered answer,
 * filtered by topic relevance and +1 Fluency Ladder progression.
 */
export async function generateAlignedStage4Suggestions(
  params: GenerateAlignedStage4Params
): Promise<MessageSuggestions> {
  const seeds = buildStage4StructuredSeeds({
    stage2Pkg: params.stage2Pkg,
    dossier: params.dossier,
    routerResult: params.routerResult,
    vedicMeta: params.vedicMeta,
    userQuestion: params.userQuestion,
    assistantAnswer: params.assistantAnswer,
    userFluency: params.userFluency,
  });

  const existingSeen = new Set<string>(
    (params.existingTexts || [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );

  const isWestern = seeds.isWestern;
  let maxF = params.maxFollowupsOverride ?? 4;
  let maxD = params.maxDeeperOverride ?? 4;
  let followupsRules = '';
  let deeperRules = '';
  let utilityModel = getUtilityModel();
  let utilityMaxTokens = 750;
  let stage4Template = isWestern
    ? WESTERN_STAGE4_ALIGNED_SUGGESTIONS_PROMPT
    : DEFAULT_STAGE4_ALIGNED_SUGGESTIONS_PROMPT;

  try {
    const [guideCfg, engineOverrides, runtime] = await Promise.all([
      getResolvedGuideConfig(params.expertSlug || DEFAULT_COUNCIL_EXPERT_SLUG),
      getEnginePromptOverrides(),
      getResolvedOpenRouterRuntime(),
    ]);
    const sugCfg = guideCfg.suggestions;
    if (
      !sugCfg.enabled ||
      guideCfg.features.followups === false ||
      (!sugCfg.followups_enabled && !sugCfg.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }
    if (params.maxFollowupsOverride === undefined) {
      maxF = sugCfg.followups_enabled
        ? Math.max(1, Math.min(6, sugCfg.max_followups || 4))
        : 0;
    } else if (!sugCfg.followups_enabled) {
      maxF = 0;
    }
    if (params.maxDeeperOverride === undefined) {
      maxD = sugCfg.deeper_analysis_enabled
        ? Math.max(1, Math.min(6, sugCfg.max_deeper_analysis || 4))
        : 0;
    } else if (!sugCfg.deeper_analysis_enabled) {
      maxD = 0;
    }
    followupsRules = sugCfg.followups_rules || '';
    deeperRules = sugCfg.deeper_analysis_rules || '';
    utilityModel = runtime.utilityModel || utilityModel;
    utilityMaxTokens = Math.max(700, runtime.tokenLimits.utility || 750);
    if (isWestern && engineOverrides.western_stage4_aligned_suggestions_prompt?.trim()) {
      stage4Template = engineOverrides.western_stage4_aligned_suggestions_prompt.trim();
    } else if (!isWestern && engineOverrides.stage4_aligned_suggestions_prompt?.trim()) {
      stage4Template = engineOverrides.stage4_aligned_suggestions_prompt.trim();
    }
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
    return buildDeterministicFallbackSuggestions(
      seeds,
      maxF,
      maxD,
      existingSeen,
      params.userQuestion
    );
  }

  const nextHopsText =
    seeds.nextHops.length > 0
      ? seeds.nextHops
          .map((h) => `- [${h.playbookId}] ${h.shortLabel} — ${h.title}`)
          .join('\n')
      : `- [${seeds.playbookId}] Stay strictly on the exact Dasha, planetary period, or life topic from the user's last question.`;

  const contradictionsText =
    seeds.unusedContradictions.length > 0
      ? seeds.unusedContradictions
          .map((c) => `- (${c.kind}) ${c.title}: ${c.mechanism}`)
          .join('\n')
      : isWestern
      ? '- Focus strictly on stress-testing the exact house ruler, tight aspects, Sect polarity, or Profection/Transit cycle directly governing this question.'
      : '- Focus strictly on stress-testing the exact Dasha planet, relevant house KP Sub-Lord, D9 endurance, dispositor/cancellation, and SAV bindus governing this question.';

  const dedupBlock =
    existingSeen.size > 0
      ? `\nDEDUPLICATION (DO NOT repeat or paraphrase these already-shown questions):\n${Array.from(
          existingSeen
        )
          .slice(0, 24)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}\n`
      : '';

  const stage4Core = stage4Template
    .replace(/\{\{LANGUAGE\}\}/g, params.languageSlug)
    .replace(/\{\{NEXT_HOPS_TEXT\}\}/g, nextHopsText)
    .replace(/\{\{CONTRADICTIONS_TEXT\}\}/g, contradictionsText)
    .replace(/\{\{FLUENCY_BRIDGE_DIRECTIVE\}\}/g, seeds.fluencyBridgeDirective);

  const prompt = `IMMEDIATE CONVERSATION ANCHOR (PRIMARY — EVERY SUGGESTION MUST RELATE DIRECTLY TO THIS EXACT Q&A):
Playbook: ${seeds.playbookId} | Domain: ${seeds.domain} | Convergence: ${params.vedicMeta.convergenceBandLabel}
User's Last Question: ${params.userQuestion.slice(0, 600)}
Just-Delivered Answer Summary: ${params.assistantAnswer.slice(0, 1500)}

${stage4Core}
${followupsRules ? `\nADMIN FOLLOWUP STYLE:\n${followupsRules}` : ''}
${deeperRules ? `\nADMIN DEEPER ANALYSIS STYLE:\n${deeperRules}` : ''}
${dedupBlock}
Return STRICTLY JSON:
{
  "followups": ${maxF > 0 ? `[{ "text": "...", "playbook_id": "OPTIONAL_ID" }] (up to ${maxF} items)` : '[]'},
  "deeper_analysis": ${maxD > 0 ? `[{ "text": "...", "technical_directive": "..." }] (up to ${maxD} items)` : '[]'}
}`;

  try {
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      maxTokens: Math.min(utilityMaxTokens, 680),
      jsonMode: true,
      disableReasoning: true,
      temperature: params.existingTexts?.length ? 0.5 : 0.35,
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
    const deeper =
      maxD > 0 ? deduplicateList(parsedDa, existingSeen, maxD) : [];

    // Backfill cleanly from topic-locked deterministic seeds if LLM returned fewer items
    if (followups.length === 0 || deeper.length === 0) {
      const fallback = buildDeterministicFallbackSuggestions(
        seeds,
        Math.max(0, maxF - followups.length),
        Math.max(0, maxD - deeper.length),
        existingSeen,
        params.userQuestion
      );
      return {
        followups: followups.length > 0 ? followups : fallback.followups,
        deeper_analysis: deeper.length > 0 ? deeper : fallback.deeper_analysis,
      };
    }

    return { followups, deeper_analysis: deeper };
  } catch {
    return buildDeterministicFallbackSuggestions(
      seeds,
      maxF,
      maxD,
      existingSeen,
      params.userQuestion
    );
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

/**
 * Lightweight fast-path for "Load more" (POST /suggestions/more):
 * Avoids downloading heavy chart_json / natal_truth_dossier_json or recompiling Stage 2.
 * Uses saved Playbook next-hops + message context with reasoning disabled for rapid JSON output.
 */
export async function generateFastMoreStage4Suggestions(params: {
  playbookId: string;
  domain: string;
  convergenceBandLabel?: string;
  userFluency: UserFluencyTier;
  userQuestion: string;
  assistantAnswer: string;
  languageSlug: string;
  expertSlug?: string;
  existingTexts: string[];
  count?: number;
}): Promise<MessageSuggestions> {
  const isWestern =
    params.expertSlug === 'western_astrologer' ||
    params.expertSlug === 'modern_astrologer' ||
    params.expertSlug === 'hellenistic_astrologer';
  const rawPlaybook = getPlaybookById(params.playbookId);
  const playbook = isWestern
    ? { ...rawPlaybook, ...localizePlaybookForWestern(rawPlaybook) }
    : rawPlaybook;
  const fastAnchorTokens = extractTopicAnchorTokens(
    `${params.userQuestion || ''}\n${params.assistantAnswer || ''}`
  );
  const nextHops: Stage4NextHopSeed[] = [];
  for (const hopId of playbook?.nextHops || []) {
    const rawHop = getPlaybookById(hopId);
    if (!rawHop || rawHop.id === playbook.id) continue;
    const hop = isWestern
      ? { ...rawHop, ...localizePlaybookForWestern(rawHop) }
      : rawHop;
    const sameDomain = hop.domain.toLowerCase() === playbook.domain.toLowerCase();
    const overlap = scoreTopicOverlap(`${hop.shortLabel} ${hop.title}`, fastAnchorTokens);
    if (!sameDomain && overlap === 0) continue;
    nextHops.push({
      playbookId: hop.id,
      shortLabel: hop.shortLabel,
      title: hop.title,
      domain: hop.domain,
    });
  }

  const totalTarget = Math.max(2, Math.min(12, params.count || 8));
  let countF = Math.ceil(totalTarget / 2);
  let countD = Math.floor(totalTarget / 2);
  let followupsRules = '';
  let deeperRules = '';
  let utilityModel = getUtilityModel();
  let fastMoreTemplate = isWestern
    ? WESTERN_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT
    : DEFAULT_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT;

  try {
    const [guideCfg, engineOverrides, runtime] = await Promise.all([
      getResolvedGuideConfig(params.expertSlug || DEFAULT_COUNCIL_EXPERT_SLUG),
      getEnginePromptOverrides(),
      getResolvedOpenRouterRuntime(),
    ]);
    const sugCfg = guideCfg.suggestions;
    if (
      !sugCfg.enabled ||
      guideCfg.features.followups === false ||
      (!sugCfg.followups_enabled && !sugCfg.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }
    const bothEnabled =
      sugCfg.followups_enabled && sugCfg.deeper_analysis_enabled;
    countF = bothEnabled
      ? Math.ceil(totalTarget / 2)
      : sugCfg.followups_enabled
      ? totalTarget
      : 0;
    countD = bothEnabled
      ? Math.floor(totalTarget / 2)
      : sugCfg.deeper_analysis_enabled
      ? totalTarget
      : 0;
    followupsRules = sugCfg.followups_rules || '';
    deeperRules = sugCfg.deeper_analysis_rules || '';
    utilityModel = runtime.utilityModel || utilityModel;
    if (isWestern && engineOverrides.western_stage4_fast_more_suggestions_prompt?.trim()) {
      fastMoreTemplate = engineOverrides.western_stage4_fast_more_suggestions_prompt.trim();
    } else if (!isWestern && engineOverrides.stage4_fast_more_suggestions_prompt?.trim()) {
      fastMoreTemplate = engineOverrides.stage4_fast_more_suggestions_prompt.trim();
    }
  } catch {
    // Proceed with sensible defaults
  }

  const existingSeen = new Set<string>(
    params.existingTexts.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );

  const deeperTargetFluency = nextFluencyRung(params.userFluency);
  const fluencyDirective = buildFluencyBridgeDirective(
    params.userFluency,
    deeperTargetFluency,
    isWestern
  );

  const openRouterReady = await isOpenRouterConfiguredAsync().catch(() =>
    isOpenRouterConfigured()
  );
  if (!openRouterReady) {
    const fallbackFollowups: SuggestionItem[] = [];
    for (let i = 0; i < nextHops.length && fallbackFollowups.length < countF; i++) {
      const text = buildHumanQuestionForHop(nextHops[i]);
      const key = text.toLowerCase();
      if (existingSeen.has(key)) continue;
      existingSeen.add(key);
      fallbackFollowups.push({
        id: `fu_s4m_${i + 1}`,
        text,
        playbook_id: nextHops[i].playbookId,
      });
    }
    return { followups: fallbackFollowups, deeper_analysis: [] };
  }

  const nextHopsText =
    nextHops.length > 0
      ? nextHops
          .slice(0, 6)
          .map((h) => `- [${h.playbookId}] ${h.shortLabel}`)
          .join('\n')
      : `- [${playbook.id}] Explore ${playbook.domain} timing and practical next steps`;

  const dedupBlock =
    existingSeen.size > 0
      ? `\nDO NOT repeat or reword:\n${Array.from(existingSeen)
          .slice(0, 20)
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}\n`
      : '';

  const corePrompt = fastMoreTemplate
    .replace(/\{\{TOTAL_TARGET\}\}/g, String(totalTarget))
    .replace(/\{\{LANGUAGE\}\}/g, params.languageSlug)
    .replace(/\{\{NEXT_HOPS_TEXT\}\}/g, nextHopsText)
    .replace(/\{\{FLUENCY_DIRECTIVE\}\}/g, fluencyDirective);

  const prompt = `IMMEDIATE CONVERSATION ANCHOR (PRIMARY — STAY STRICTLY ON THIS EXACT QUESTION):
CONTEXT: ${playbook.id} (${playbook.domain})
Q: ${params.userQuestion.slice(0, 480)}
A EXCERPT: ${params.assistantAnswer.slice(0, 1200)}

${corePrompt}
${followupsRules ? `\nFOLLOWUP STYLE:\n${followupsRules.slice(0, 500)}` : ''}
${deeperRules ? `\nDEEPER STYLE:\n${deeperRules.slice(0, 500)}` : ''}
${dedupBlock}
Return STRICTLY JSON:
{
  "followups": ${countF > 0 ? `[{ "text": "...", "playbook_id": "OPTIONAL_ID" }] (up to ${countF})` : '[]'},
  "deeper_analysis": ${countD > 0 ? `[{ "text": "...", "technical_directive": "..." }] (up to ${countD})` : '[]'}
}`;

  try {
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      maxTokens: 560,
      jsonMode: true,
      disableReasoning: true,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = safeExtractJsonObject(completion.text);
    const rawFu = Array.isArray(parsed.followups) ? parsed.followups : [];
    const rawDa = Array.isArray(parsed.deeper_analysis) ? parsed.deeper_analysis : [];

    const parsedFu = rawFu
      .map((item, idx) => sanitizeSuggestionItem(item, 'fu', idx, false))
      .filter((x): x is SuggestionItem => Boolean(x));
    const parsedDa = rawDa
      .map((item, idx) => sanitizeSuggestionItem(item, 'da', idx, true))
      .filter((x): x is SuggestionItem => Boolean(x));

    const followups = countF > 0 ? deduplicateList(parsedFu, existingSeen, countF) : [];
    const deeper = countD > 0 ? deduplicateList(parsedDa, existingSeen, countD) : [];

    if (followups.length < countF && nextHops.length > 0) {
      for (let i = 0; i < nextHops.length && followups.length < countF; i++) {
        const text = buildHumanQuestionForHop(nextHops[i]);
        const key = text.toLowerCase();
        if (existingSeen.has(key)) continue;
        existingSeen.add(key);
        followups.push({
          id: `fu_s4m_fb_${i + 1}`,
          text,
          playbook_id: nextHops[i].playbookId,
        });
      }
    }

    return { followups, deeper_analysis: deeper };
  } catch {
    const fallbackFollowups: SuggestionItem[] = [];
    for (let i = 0; i < nextHops.length && fallbackFollowups.length < countF; i++) {
      const text = buildHumanQuestionForHop(nextHops[i]);
      const key = text.toLowerCase();
      if (existingSeen.has(key)) continue;
      existingSeen.add(key);
      fallbackFollowups.push({
        id: `fu_s4m_err_${i + 1}`,
        text,
        playbook_id: nextHops[i].playbookId,
      });
    }
    return { followups: fallbackFollowups, deeper_analysis: [] };
  }
}
