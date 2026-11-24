import type { LifeContextData } from '../../lib/lifeContextSchema';
import type {
  Stage1RouterResult,
  TimingProgressWidget,
  VedicIntentArchetype,
} from '../../lib/vedicTypes';
import {
  applyPlaybookOverride,
  type CanonicalPlaybookDef,
} from './canonicalPlaybooks';
import { getPlaybookOverrides } from './platformSettings';
import {
  enrichCompiledChart,
  formatChartForLLM,
  type CompiledChartData,
} from './chartCompiler';
import {
  FORMULA_CARTRIDGE_META_BY_SLUG,
  resolvePriorityRuleSlug,
} from './formulaCartridgesSeed';
import {
  buildDeterministicTimingWidgets,
  computeDoubleTransitMatrix,
  SIGNS,
  SIGN_LORDS,
  type DoubleTransitHouseRow,
  type PlanetPosition,
  type SlowPlanetTransitPair,
  type WesternPlanetPosition,
} from './jyotishMath';
import {
  buildNatalTruthDossierLayerA,
  type NatalTruthDossierLayerA,
  type NatalTruthDossierV1,
} from './natalDossier';
import {
  getFormulaCartridgesCached,
  getPriorityRulesCached,
  type ResolvedInternalRuleRecord,
} from './promptDefaults';
import { compileWesternStage2ContextPackage } from './westernContextSlicer';

export const TRUTH_GATE_CONFLICT_HIERARCHY = [
  '1. KP Cuspal Sub-Lord (CSL) — Final promise & 1-6-8-10-12 negation gate',
  '2. D9 Navamsa Reality — Inner quality, outcome endurance & D1 uplift/inversion',
  '3. Shadbala / Bhavbala & Composite Planetary Health (PHI) — Delivery stamina',
  '4. Ashtakavarga (SAV / BAV) — Quantitative volume (<20 restrained, 20-27 standard, >=28 abundant)',
  '5. D1 Rashi Yogas — Baseline textbook combinations (lowest override authority)',
] as const;

export interface DailyTransitSliceInput {
  transitDate: string;
  planets: PlanetPosition[];
  slowTransitPairs?: SlowPlanetTransitPair[];
  westernPlanets?: WesternPlanetPosition[];
}

export interface ExtraProfileSliceInput {
  label?: string;
  chart: CompiledChartData;
  dossier?: NatalTruthDossierV1 | null;
}

export interface Stage2CompileInput {
  tradition?: 'vedic' | 'western';
  routerResult: Stage1RouterResult;
  playbook: CanonicalPlaybookDef;
  chart: CompiledChartData;
  dossier?: NatalTruthDossierV1 | null;
  lifeContext?: LifeContextData | null;
  dailyTransits?: DailyTransitSliceInput | null;
  extraProfiles?: ExtraProfileSliceInput[];
  contextTrapPromptNote?: string | null;
  userPrompt?: string;
  expertSlug?: string;
}

const TIMING_SIGNAL_RE =
  /\b(?:when|timing|year|years|month|months|202[4-9]|203\d|transit|transits|gochar|dasha|mahadasha|antardasha|pratyantardasha|profection|profections|solar return|progressed|progression|saturn return|windfall|window|windows|soon|next|future|period|periods|forecast|upcoming)\b/i;

export function hasTimingSignal(
  userPrompt?: string | null,
  intent?: VedicIntentArchetype | null
): boolean {
  if (intent === 'TIMING') return true;
  if (!userPrompt) return false;
  return TIMING_SIGNAL_RE.test(userPrompt);
}

export interface TriggeredCancellationItem {
  code: string;
  title: string;
  detail: string;
  severity: 'high' | 'moderate' | 'info';
}

export interface SelectedCartridgeInfo {
  slug: string;
  canonicalKey: string;
  title: string;
  body: string;
  triggerReason: string;
}

export interface TruthGateHouseResolution {
  house: number;
  sign: string;
  kpVerdict: string;
  sav: number;
  houseScore: number;
  summary: string;
}

export interface Stage2ContextPackage {
  tradition?: 'vedic' | 'western';
  playbookId: string;
  domain: string;
  intent: VedicIntentArchetype;
  requiresTimingStack?: boolean;
  timingWidgets?: TimingProgressWidget[];
  priorityRule: {
    slug: string;
    title: string;
    body: string;
    conditionalReordered: boolean;
  };
  selectedCartridges: SelectedCartridgeInfo[];
  triggeredCancellations: TriggeredCancellationItem[];
  truthGateHierarchy: readonly string[];
  truthGateResolution: TruthGateHouseResolution[];
  chartSlice: Record<string, unknown>;
  lifeContextAnchorText: string;
  renderedPromptContext: string;
  metrics: {
    slicedChars: number;
    v1FullChartChars: number;
    reductionPct: number;
    cartridgeCount: number;
    cancellationCount: number;
    slicedHousesCount: number;
    slicedVargasCount: number;
  };
}

const JAIMINI_CODE_SET = new Set(['AK', 'AMK', 'BK', 'MK', 'PK', 'GK', 'DK']);
const CLASSICAL_PLANET_NAMES = new Set([
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
]);

function stripInternalCodePrefix(displayName: string): string {
  return displayName
    .replace(/^(?:F|PRIO)_[A-Z0-9_]+\s*[—–-]\s*/i, '')
    .trim();
}

function getHouseLordName(ascSignIndex: number, houseNum: number): string {
  return SIGN_LORDS[(ascSignIndex + houseNum - 1) % 12];
}

function getSimpleVargaDignity(planet: string, signIndex: number): string {
  const exalt: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mars: 9,
    Mercury: 5,
    Jupiter: 3,
    Venus: 11,
    Saturn: 6,
    Rahu: 1,
    Ketu: 7,
  };
  const debil: Record<string, number> = {
    Sun: 6,
    Moon: 7,
    Mars: 3,
    Mercury: 11,
    Jupiter: 9,
    Venus: 5,
    Saturn: 0,
    Rahu: 7,
    Ketu: 1,
  };
  const own: Record<string, number[]> = {
    Sun: [4],
    Moon: [3],
    Mars: [0, 7],
    Mercury: [2, 5],
    Jupiter: [8, 11],
    Venus: [1, 6],
    Saturn: [9, 10],
    Rahu: [10],
    Ketu: [7],
  };
  if (exalt[planet] === signIndex) return 'Exalted';
  if (debil[planet] === signIndex) return 'Debilitated';
  if (own[planet]?.includes(signIndex)) return 'Own';
  return 'Neutral';
}

function formatLifeContextAnchor(
  lifeContext: LifeContextData | null | undefined,
  layerA: NatalTruthDossierLayerA,
  contextTrapPromptNote?: string | null
): string {
  const lines: string[] = [];
  const ctx = lifeContext || {};

  if (ctx.birth_time_accuracy) {
    const labelMap: Record<string, string> = {
      exact_hospital: 'Exact recorded birth time',
      approximate: 'Approximate birth time (+/- 15-60 min)',
      sunrise_unknown: 'Approximate/sunrise chart (time unverified)',
    };
    lines.push(`Birth time precision: ${labelMap[ctx.birth_time_accuracy] || ctx.birth_time_accuracy}`);
  }
  if (layerA.birth_time_sensitivity.caution_note) {
    lines.push(`Boundary note: ${layerA.birth_time_sensitivity.caution_note}`);
  }
  if (ctx.relationship_status) {
    const relMap: Record<string, string> = {
      single: 'Single',
      dating_committed: 'In a committed relationship',
      engaged: 'Engaged',
      married_no_children: 'Married (no children)',
      married_with_children: 'Married with children',
      divorced_separated: 'Divorced or separated',
      widowed: 'Widowed',
    };
    lines.push(
      `Relationship status: ${relMap[ctx.relationship_status] || ctx.relationship_status}${
        ctx.marriage_year ? ` (married ${ctx.marriage_year})` : ''
      }`
    );
  }
  if (Array.isArray(ctx.children) && ctx.children.length > 0) {
    lines.push(
      `Children: ${ctx.children.length} (${ctx.children
        .map((c) => `${c.gender} b.${c.birth_year}`)
        .join(', ')})`
    );
  } else if (ctx.children_summary) {
    lines.push(`Children context: ${ctx.children_summary}`);
  } else if (typeof ctx.has_children === 'boolean') {
    lines.push(`Has children: ${ctx.has_children ? 'Yes' : 'No'}`);
  }
  if (ctx.career_mode || ctx.career_role || ctx.workplace_context) {
    const modePart = ctx.career_mode ? ctx.career_mode.replace(/_/g, ' ') : 'Work';
    const rolePart = ctx.career_role ? ` (${ctx.career_role})` : '';
    const placePart = ctx.workplace_context ? ` — ${ctx.workplace_context}` : '';
    lines.push(`Career setup: ${modePart}${rolePart}${placePart}`);
  }
  if (ctx.location_status) {
    lines.push(`Location context: ${ctx.location_status.replace(/_/g, ' ')}`);
  }
  if (Array.isArray(ctx.past_anchors) && ctx.past_anchors.length > 0) {
    lines.push(
      `Verified past anchors: ${ctx.past_anchors
        .slice(0, 6)
        .map(
          (a) =>
            `${a.year} ${a.tag}${a.note ? ` (${a.note})` : ''}${a.cited_by ? ` [Noted by ${a.cited_by}]` : ''}`
        )
        .join('; ')}`
    );
  }
  if (Array.isArray(ctx.core_stress_areas) && ctx.core_stress_areas.length > 0) {
    lines.push(
      `Core recurring life concerns (stay empathetic and mindful without reciting mechanically): ${ctx.core_stress_areas
        .slice(0, 5)
        .join('; ')}`
    );
  }
  if (Array.isArray(ctx.cited_insights) && ctx.cited_insights.length > 0) {
    lines.push(
      `Depth psychological & practical notes (weave sensitively when helpful; never dump verbatim):\n${ctx.cited_insights
        .slice(0, 12)
        .map((n) => `- [${String(n.category || 'note').replace(/_/g, ' ')} · ${n.cited_by}] ${n.summary}`)
        .join('\n')}`
    );
  }
  if (contextTrapPromptNote) {
    lines.push(`Context adaptation: ${contextTrapPromptNote}`);
  }

  return lines.length > 0
    ? lines.join('\n')
    : 'No additional personal life-context anchors recorded yet; stay grounded in neutral possibilities.';
}

function getUpcomingAntardashasSnippet(chart: CompiledChartData): string[] {
  const stack = chart.vimshottari?.currentStack;
  if (!stack) return [];
  const today = new Date().toISOString().slice(0, 10);
  const md = chart.vimshottari.timeline.find(
    (m) => m.lord === stack.mahadasha && m.endDate >= today
  );
  if (!md?.children) return [];
  return md.children
    .filter((ad) => ad.endDate >= today)
    .slice(0, 3)
    .map((ad) => `${md.lord}-${ad.lord} (${ad.startDate}..${ad.endDate})`);
}

function summarizeExtraProfileForSynastry(
  item: ExtraProfileSliceInput,
  index: number
): Record<string, unknown> {
  const enriched =
    item.chart.planetaryHealth && item.chart.structuralFlags
      ? item.chart
      : enrichCompiledChart(item.chart).chartJson;
  const layerA =
    item.dossier?.layer_a || buildNatalTruthDossierLayerA(enriched, undefined);
  const asc = enriched.planets.find((p) => p.name === 'Ascendant');
  const ascIdx = asc?.signIndex ?? 0;
  const l7 = getHouseLordName(ascIdx, 7);
  const keyNames = new Set(['Ascendant', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn', l7]);
  const dk = enriched.jaimini?.karakas?.find((k) => k.code === 'DK');
  if (dk) keyNames.add(dk.planet);

  const d9 = enriched.vargas?.D9;
  return {
    person: item.label || enriched.meta.name || `Partner ${index + 1}`,
    lagna: asc ? `${asc.sign.slice(0, 3)} ${asc.dms}` : '—',
    activeDasha: enriched.vimshottari?.currentStack
      ? `${enriched.vimshottari.currentStack.mahadasha}/${enriched.vimshottari.currentStack.antardasha} (${
          enriched.vimshottari.currentStack.adStart
            ? `${enriched.vimshottari.currentStack.adStart}..`
            : 'to '
        }${enriched.vimshottari.currentStack.adEnd})`
      : '—',
    d1Core: enriched.planets
      .filter((p) => keyNames.has(p.name))
      .map((p) => `${p.name}:${p.sign.slice(0, 3)}(H${p.house},${p.dignity})`),
    d9Core: d9
      ? d9.placements
          .filter((pl) => pl.name === 'Ascendant' || pl.name === 'Venus' || pl.name === 'Moon' || pl.name === l7)
          .map((pl) => `${pl.name === 'Ascendant' ? 'D9Asc' : pl.name}:${pl.sign.slice(0, 3)}(H${pl.house})`)
      : [],
    dk: dk ? `${dk.planet} in ${dk.sign.slice(0, 3)}` : '—',
    marriageVerdict: layerA.domain_pre_audits.marriage.structural_verdict,
  };
}

/**
 * Pure 0ms Stage 2 Context Slicer, Cancellation Resolver, 5-Tier Truth Gate Ranker,
 * and Admin-governed Formula Cartridge & Priority Rule assembler.
 */
export async function compileStage2ContextPackage(
  rawInput: Stage2CompileInput
): Promise<Stage2ContextPackage> {
  const pbOverrides = await getPlaybookOverrides().catch(() => ({} as Record<string, never>));
  const effectivePlaybook = applyPlaybookOverride(
    rawInput.playbook,
    pbOverrides[rawInput.playbook.id] || null
  );
  const input: Stage2CompileInput = {
    ...rawInput,
    playbook: effectivePlaybook,
  };

  if (input.tradition === 'western') {
    return compileWesternStage2ContextPackage(input);
  }

  const enriched =
    input.chart.planetaryHealth &&
    input.chart.scoredYogas &&
    input.chart.structuralFlags &&
    input.chart.ascendantMaturity &&
    input.chart.specialPoints &&
    input.chart.bhavaChalit &&
    input.chart.dispositorChain
      ? input.chart
      : enrichCompiledChart(input.chart).chartJson;

  const layerA: NatalTruthDossierLayerA =
    input.dossier?.layer_a || buildNatalTruthDossierLayerA(enriched, input.lifeContext);

  const asc = enriched.planets.find((p) => p.name === 'Ascendant');
  const ascSignIdx = asc?.signIndex ?? 0;
  const moonNatal = enriched.planets.find((p) => p.name === 'Moon');
  const moonSignIdx = moonNatal?.signIndex ?? -1;
  const lagnesh = layerA.lagnesh_profile.lagnesh;
  const effectiveRequiresTimingStack = Boolean(
    input.playbook.requiresTimingStack ||
      hasTimingSignal(input.userPrompt, input.routerResult.intent)
  );

  // 1. Focus Houses (from Playbook only + Ascendant anchor when appropriate)
  const focusHouses = Array.from(
    new Set(
      (input.playbook.requiredHouses && input.playbook.requiredHouses.length > 0
        ? input.playbook.requiredHouses
        : [1, 7, 10]
      ).filter((h) => h >= 1 && h <= 12)
    )
  ).sort((a, b) => a - b);
  const focusHouseSet = new Set<number>(focusHouses);

  // 2. Focus Planets (house lords, house occupants, requested karakas, lagnesh, Moon, active Dasha lords)
  const focusPlanetSet = new Set<string>(['Ascendant', lagnesh, 'Moon']);
  for (const h of focusHouses) {
    focusPlanetSet.add(getHouseLordName(ascSignIdx, h));
    for (const p of enriched.planets) {
      if (p.house === h) focusPlanetSet.add(p.name);
    }
  }

  const chalitShiftsRelevant = (enriched.bhavaChalit?.shifts || []).filter(
    (s) =>
      s.shifted &&
      (focusHouseSet.has(s.rashiHouse) ||
        focusHouseSet.has(s.chalitHouse) ||
        focusPlanetSet.has(s.planet))
  );
  for (const sh of chalitShiftsRelevant) {
    focusPlanetSet.add(sh.planet);
  }

  const isKpExpert = input.expertSlug === 'kp_precision';
  const isJaiminiExpert = input.expertSlug === 'jaimini';

  const requestedPadaCodes = new Set<string>();
  const resolvedKarakaRows: Array<{ code: string; planet: string; sign: string; dms: string }> = [];
  for (const item of input.playbook.requiredKarakas || []) {
    const upper = item.trim().toUpperCase();
    if (JAIMINI_CODE_SET.has(upper)) {
      const kRow = enriched.jaimini?.karakas?.find((k) => k.code.toUpperCase() === upper);
      if (kRow) {
        focusPlanetSet.add(kRow.planet);
        resolvedKarakaRows.push({
          code: kRow.code,
          planet: kRow.planet,
          sign: kRow.sign.slice(0, 3),
          dms: kRow.dms,
        });
      }
    } else if (/^(?:UL|AL|A[2-9]|A10|A11|A12)$/.test(upper)) {
      requestedPadaCodes.add(upper);
    } else if (CLASSICAL_PLANET_NAMES.has(item)) {
      focusPlanetSet.add(item);
    }
  }

  if (isJaiminiExpert && Array.isArray(enriched.jaimini?.karakas)) {
    for (const kRow of enriched.jaimini.karakas) {
      focusPlanetSet.add(kRow.planet);
      if (!resolvedKarakaRows.some((r) => r.code === kRow.code)) {
        resolvedKarakaRows.push({
          code: kRow.code,
          planet: kRow.planet,
          sign: kRow.sign.slice(0, 3),
          dms: kRow.dms,
        });
      }
    }
    requestedPadaCodes.add('AL');
    requestedPadaCodes.add('UL');
    requestedPadaCodes.add('A7');
    requestedPadaCodes.add('A10');
  }

  if (input.playbook.domain === 'spirituality' || input.playbook.domain === 'open') {
    const ak = enriched.jaimini?.karakas?.find((k) => k.code === 'AK');
    if (ak && !resolvedKarakaRows.some((r) => r.code === 'AK')) {
      focusPlanetSet.add(ak.planet);
      resolvedKarakaRows.push({
        code: ak.code,
        planet: ak.planet,
        sign: ak.sign.slice(0, 3),
        dms: ak.dms,
      });
    }
  }

  const activeStack = enriched.vimshottari?.currentStack;
  if (effectiveRequiresTimingStack && activeStack) {
    focusPlanetSet.add(activeStack.mahadasha);
    focusPlanetSet.add(activeStack.antardasha);
    focusPlanetSet.add(activeStack.pratyantardasha);
  }

  // 3. Slice D1 Planets (full numerical precision in compact row format)
  const d1Slice = enriched.planets
    .filter((p) => focusPlanetSet.has(p.name))
    .map((p) => {
      const cond = enriched.conditions?.find((c) => c.planet === p.name);
      const phi = enriched.planetaryHealth?.find((h) => h.planet === p.name);
      const flags = [
        p.dignity !== 'Neutral' ? p.dignity : '',
        p.isRetrograde ? 'Rx' : '',
        cond?.isCombust ? 'Comb' : '',
        cond?.isVargottama ? 'Varg' : '',
        phi ? `PHI:${phi.totalScore}` : '',
        cond?.aspectsHouses?.length ? `Asp:${cond.aspectsHouses.join(',')}` : '',
      ].filter(Boolean);
      return `${p.name}:${p.sign.slice(0, 3)} ${p.dms}(H${p.house},${p.nakshatra} P${p.pada}/${p.nakshatraLord.slice(0, 2)},SL:${p.subLord.slice(0, 2)}${flags.length ? ',' + flags.join('|') : ''})`;
    });

  // 4. Slice Divisional Vargas (ONLY playbook.requiredVargas, NEVER degrees!)
  const requestedVargas = (input.playbook.requiredVargas || []).filter(
    (v) => v !== 'D1' && Boolean(enriched.vargas?.[v])
  );
  const vargasSlice: Record<string, string> = {};
  for (const vKey of requestedVargas) {
    const vData = enriched.vargas[vKey];
    if (!vData) continue;
    const relevantPlacements = vData.placements
      .filter((pl) => pl.name === 'Ascendant' || focusPlanetSet.has(pl.name))
      .map((pl) => {
        if (pl.name === 'Ascendant') {
          return `Lagna:${pl.sign.slice(0, 3)}`;
        }
        const cond = vKey === 'D9' ? enriched.conditions?.find((c) => c.planet === pl.name) : undefined;
        const dig = getSimpleVargaDignity(pl.name, pl.signIndex);
        const flags = [
          dig !== 'Neutral' ? dig.slice(0, 5) : '',
          cond?.isVargottama ? 'Varg' : '',
        ].filter(Boolean);
        return `${pl.name}:${pl.sign.slice(0, 3)}(H${pl.house}${flags.length ? ',' + flags.join('/') : ''})`;
      });
    vargasSlice[vKey] = relevantPlacements.join('|');
  }

  // 5. Slice KP Cusps & Significators (playbook.requiredKpCusps, expanded with focusHouses for kp_precision)
  const rawKpCusps = isKpExpert
    ? Array.from(new Set([...(input.playbook.requiredKpCusps || []), ...focusHouses])).sort(
        (a, b) => a - b
      )
    : input.playbook.requiredKpCusps || [];
  const requestedKp = rawKpCusps.filter((h) => h >= 1 && h <= 12);
  const kpSlice = requestedKp.map((h) => {
    const cusp = enriched.kp?.cusps?.find((c) => c.house === h);
    const cslSig = cusp
      ? enriched.kp?.significators?.find((s) => s.planet === cusp.subLord)
      : undefined;
    const verdict = layerA.house_promises[String(h)]?.kp_verdict || 'mixed';
    const sigs = (cslSig?.signifiesHouses || []).join(',');
    return `H${h}:${cusp ? `${cusp.sign.slice(0, 3)} ${cusp.dms}` : '—'}(StL:${cusp?.starLord?.slice(0, 2) || '—'},CSL:${cusp?.subLord || '—'}->[${sigs}],${verdict})`;
  });

  // 6. Ashtakavarga + Shadbala scoped strictly to focus houses & focus planets
  const savFocusRows = focusHouses.map((h) => {
    const signIdx = (ascSignIdx + h - 1) % 12;
    const savVal = enriched.ashtakavarga?.sarva?.[signIdx] ?? 25;
    const jupBav = enriched.ashtakavarga?.bhinna?.Jupiter?.[signIdx];
    const satBav = enriched.ashtakavarga?.bhinna?.Saturn?.[signIdx];
    const band = savVal >= 28 ? 'Hi' : savVal < 20 ? 'Lo' : 'Std';
    return {
      houseNum: h,
      label: `H${h}(${SIGNS[signIdx].slice(0, 3)})`,
      sav: savVal,
      compact: `H${h}(${SIGNS[signIdx].slice(0, 3)}):${savVal}[${band}${typeof jupBav === 'number' ? `,Ju:${jupBav}` : ''}${typeof satBav === 'number' ? `,Sa:${satBav}` : ''}]`,
    };
  });
  const savFocus = savFocusRows.map((r) => r.compact);

  const shadbalaFocus = enriched.shadbala
    ? enriched.shadbala.planets
        .filter((r) => focusPlanetSet.has(r.planet))
        .map((r) => `${r.planet}:${r.ratio}x(${r.totalRupas}/${r.requiredRupas}R)`)
    : [];

  // 7. Special Points & Arudhas (domain-filtered)
  const arudhaSlice = (enriched.jaimini?.arudhaPadas || [])
    .filter((a) => requestedPadaCodes.has(a.code.toUpperCase()) || (a.code === 'AL' && (input.playbook.domain === 'wealth' || input.playbook.domain === 'career')))
    .map((a) => `${a.code}:${a.padaSign.slice(0, 3)}(H${a.padaHouseFromLagna})`);

  const specialSlice: Record<string, unknown> = {};
  if (enriched.specialPoints) {
    if (['wealth', 'marriage', 'open'].includes(input.playbook.domain)) {
      specialSlice.induLagna = `${enriched.specialPoints.induLagna.sign}(H${enriched.specialPoints.induLagna.houseFromLagna},L:${enriched.specialPoints.induLagna.lord})`;
      specialSlice.shriLagna = `${enriched.specialPoints.shriLagna.sign}(H${enriched.specialPoints.shriLagna.houseFromLagna})`;
    }
    if (['health', 'litigation', 'timing', 'marriage', 'open'].includes(input.playbook.domain)) {
      specialSlice.khara64D9Moon = `${enriched.specialPoints.khara64NavamsaMoon.sign}(L:${enriched.specialPoints.khara64NavamsaMoon.lord})`;
      specialSlice.khara22D3Lagna = `${enriched.specialPoints.khara22DrekkanaLagna.sign}(L:${enriched.specialPoints.khara22DrekkanaLagna.lord})`;
    }
  }

  // 8. Scoped Timing Stack (playbook OR explicit timing/forecast signal)
  let doubleTransitFocus: DoubleTransitHouseRow[] = [];
  let slowTransitionsSummary: string[] = [];
  let gocharNowSummary: string[] = [];
  if (effectiveRequiresTimingStack && input.dailyTransits?.planets?.length) {
    const dtMatrix = computeDoubleTransitMatrix({
      natalPlanets: enriched.planets,
      ashtakavarga: enriched.ashtakavarga,
      transitPlanets: input.dailyTransits.planets,
      transitDateISO: input.dailyTransits.transitDate,
    });
    doubleTransitFocus = dtMatrix.houses.filter(
      (row) =>
        focusHouseSet.has(row.house) ||
        ((input.playbook.domain === 'timing' ||
          input.playbook.domain === 'open' ||
          input.routerResult.intent === 'TIMING') &&
          row.doubleTransitActive)
    );
    gocharNowSummary = input.dailyTransits.planets
      .filter((tp) => ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars', 'Sun'].includes(tp.name))
      .map((tp) => {
        const hLagna = ((tp.signIndex - ascSignIdx + 12) % 12) + 1;
        const hMoon =
          moonSignIdx >= 0 ? `,Moon H${((tp.signIndex - moonSignIdx + 12) % 12) + 1}` : '';
        return `${tp.name}:${tp.sign} ${tp.dms}(Lagna H${hLagna}${hMoon}${tp.isRetrograde ? ',Rx' : ''})`;
      });
    if (Array.isArray(input.dailyTransits.slowTransitPairs)) {
      slowTransitionsSummary = input.dailyTransits.slowTransitPairs.map((pair) => {
        const curH = ((pair.currentSignIndex - ascSignIdx + 12) % 12) + 1;
        const nextH = ((pair.nextSignIndex - ascSignIdx + 12) % 12) + 1;
        const curHMoon =
          moonSignIdx >= 0 ? `/M-H${((pair.currentSignIndex - moonSignIdx + 12) % 12) + 1}` : '';
        return `${pair.planet}:${pair.currentSign.slice(0, 3)} ${pair.currentDegreeInSign.toFixed(1)}°(L-H${curH}${curHMoon}${pair.isRetrograde ? ' Rx' : ''}${pair.currentSignEntryApproxDate ? `,from~${pair.currentSignEntryApproxDate}` : ''})->${pair.nextSign.slice(0, 3)}(L-H${nextH})~${pair.nextIngressApproxDate}(${pair.daysUntilIngress}d)`;
      });
    }
  }

  const timingSlice = effectiveRequiresTimingStack
    ? {
        transitDate: input.dailyTransits?.transitDate,
        dasha: activeStack
          ? `MD:${activeStack.mahadasha}(${activeStack.mdStart ? `${activeStack.mdStart}..` : 'to '}${activeStack.mdEnd},${activeStack.mdProgressPct ?? '?'}%${activeStack.mdSandhiWarning ? ',SANDHI' : ''}) | AD:${activeStack.antardasha}(${activeStack.adStart ? `${activeStack.adStart}..` : 'to '}${activeStack.adEnd},${activeStack.adProgressPct ?? '?'}%${activeStack.adSandhiWarning ? ',SANDHI' : ''}) | PD:${activeStack.pratyantardasha}(${activeStack.pdStart ? `${activeStack.pdStart}..` : 'to '}${activeStack.pdEnd})`
          : undefined,
        nextADs: getUpcomingAntardashasSnippet(enriched),
        chara: enriched.jaimini?.charaDasha?.currentPeriod
          ? `${enriched.jaimini.charaDasha.currentPeriod.sign.slice(0, 3)}(${enriched.jaimini.charaDasha.currentPeriod.startDate}..${enriched.jaimini.charaDasha.currentPeriod.endDate})`
          : undefined,
        gocharNow: gocharNowSummary.length ? gocharNowSummary : undefined,
        dt: doubleTransitFocus.map(
          (r) =>
            `H${r.house}:${r.doubleTransitActive ? 'DT_YES' : `Ju${r.jupiterActivated ? 'Y' : 'N'}/Sa${r.saturnActivated ? 'Y' : 'N'}`}(SAV:${r.savBindus})`
        ),
        slowIngress: slowTransitionsSummary.length ? slowTransitionsSummary : undefined,
      }
    : undefined;

  // 9. Scoped Yogas & Doshas (up to 10 relevant active Yogas/Cancellations)
  const KEY_YOGA_PRIORITY_RE =
    /neecha\s*bhanga|raja\s*yoga|dhana\s*yoga|vipareeta|mahapurusha|gajakesari|hamsa|malavya|ruchaka|bhadra|sasa|budhaditya/i;
  const scopedYogas = [...layerA.validated_yogas]
    .sort((a, b) => {
      const aScore =
        (a.domains.includes(input.playbook.domain) ? 4 : 0) +
        (a.domains.includes('resilience') ? 1 : 0) +
        (a.status === 'Foundational' ? 3 : 0) +
        (KEY_YOGA_PRIORITY_RE.test(a.name) ? 3 : 0);
      const bScore =
        (b.domains.includes(input.playbook.domain) ? 4 : 0) +
        (b.domains.includes('resilience') ? 1 : 0) +
        (b.status === 'Foundational' ? 3 : 0) +
        (KEY_YOGA_PRIORITY_RE.test(b.name) ? 3 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return (b.ysi_score_0_110 || 0) - (a.ysi_score_0_110 || 0);
    })
    .slice(0, 10)
    .map((y) => `${y.name}[${y.status},YSI:${y.ysi_score_0_110}]:${y.formula_proof}`);

  const scopedSuppressedYogas = layerA.suppressed_or_cosmetic_yogas
    .slice(0, 3)
    .map((y) => `${y.name}:${y.reason_downgraded}`);

  // =========================================================================
  // 10. CANCELLATION & CONFLICT RESOLVER (0ms Deterministic Scan)
  // =========================================================================
  const triggeredCancellations: TriggeredCancellationItem[] = [];
  const triggerSignals = new Set<string>();

  // A. Neecha Bhanga on focus planets
  for (const nb of enriched.structuralFlags?.neechaBhanga || []) {
    if (!focusPlanetSet.has(nb.planet)) continue;
    triggerSignals.add('neecha_bhanga');
    triggeredCancellations.push({
      code: nb.isCancelled ? 'NEECHA_BHANGA_ACTIVE' : 'UNCANCELLED_DEBILITATION',
      title: nb.isCancelled
        ? `${nb.planet} Debilitation Cancelled (Neecha Bhanga)`
        : `${nb.planet} Debilitation Without Direct Cancellation`,
      detail: nb.isCancelled
        ? `Debilitated in ${nb.sign} (H${nb.house}) but cancelled via: ${nb.conditionsMet.join('; ')}. Interpret as an earned, late-maturing strength arc rather than failure.`
        : `Debilitated in ${nb.sign} (H${nb.house}) with limited structural offset — requires realistic pacing and supportive scaffolding.`,
      severity: nb.isCancelled ? 'high' : 'moderate',
    });
  }

  // B. D1 vs D9 Inversion / Vargottama vs Combust
  const d9 = enriched.vargas?.D9;
  for (const p of enriched.planets) {
    if (p.name === 'Ascendant' || !focusPlanetSet.has(p.name)) continue;
    const cond = enriched.conditions?.find((c) => c.planet === p.name);
    const d9Pl = d9?.placements?.find((pl) => pl.name === p.name);
    const d9Dig = d9Pl ? getSimpleVargaDignity(p.name, d9Pl.signIndex) : 'Neutral';

    if ((p.dignity === 'Exalted' || p.dignity === 'Own Sign') && d9Dig === 'Debilitated') {
      triggerSignals.add('d1_d9_inversion');
      triggeredCancellations.push({
        code: 'D1_STRONG_D9_INVERSION',
        title: `${p.name} D1 Strong vs. D9 Weak Inversion`,
        detail: `${p.name} holds ${p.dignity} status in D1 (H${p.house}) but drops to Debilitated in D9 Navamsa (${d9Pl?.sign}). Distinguish outward/early promise from inner durability.`,
        severity: 'high',
      });
    } else if (p.dignity === 'Debilitated' && (d9Dig === 'Exalted' || d9Dig === 'Own')) {
      triggerSignals.add('d1_d9_inversion');
      triggeredCancellations.push({
        code: 'D1_WEAK_D9_UPLIFT',
        title: `${p.name} D9 Navamsa Uplift`,
        detail: `${p.name} rises from D1 ${p.dignity} to ${d9Dig} in D9 (${d9Pl?.sign}) — slow start maturing steadily after initial friction.`,
        severity: 'high',
      });
    }
    if (cond?.isVargottama || cond?.isCombust) {
      triggerSignals.add('d1_d9_inversion');
      triggeredCancellations.push({
        code: cond.isCombust ? 'COMBUSTION_CHECK' : 'VARGOTTAMA_LOCK',
        title: `${p.name} ${[cond.isVargottama ? 'Vargottama' : '', cond.isCombust ? 'Combust' : ''].filter(Boolean).join(' + ')}`,
        detail: `${p.name} in H${p.house}${cond.isVargottama ? ' holds identical D1/D9 sign (deeply consistent motivation)' : ''}${cond.isCombust ? ' sits close to Sun (internalized/overheated expression requiring conscious outlet)' : ''}.`,
        severity: cond.isCombust ? 'moderate' : 'info',
      });
    }

    // Nakshatra 6/8/12 lordship or Gandanta
    const nakOwnerHouses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(
      (h) => getHouseLordName(ascSignIdx, h) === p.nakshatraLord
    );
    if (nakOwnerHouses.some((h) => h === 6 || h === 8 || h === 12)) {
      triggerSignals.add('nakshatra_6_8_12');
    }
    if (p.name === 'Rahu' || p.name === 'Ketu') {
      if (focusHouseSet.has(p.house) || activeStack?.mahadasha === p.name || activeStack?.antardasha === p.name) {
        triggerSignals.add('nodal_focus');
      }
    }
  }

  // C. Bhava-Chalit Shift diff
  if (chalitShiftsRelevant.length > 0) {
    triggerSignals.add('chalit_shift');
    triggeredCancellations.push({
      code: 'BHAVA_CHALIT_SHIFT',
      title: `Bhava-Chalit House Shift (${chalitShiftsRelevant.map((s) => s.planet).join(', ')})`,
      detail: chalitShiftsRelevant
        .map((s) => `${s.planet} shifts from Whole-Sign H${s.rashiHouse} to Placidus Chalit H${s.chalitHouse} (${s.direction})`)
        .join('; '),
      severity: 'high',
    });
  }

  // D. Dasha Sandhi < 10%
  if (effectiveRequiresTimingStack && activeStack && (activeStack.mdSandhiWarning || activeStack.adSandhiWarning)) {
    triggerSignals.add('dasha_sandhi');
    triggeredCancellations.push({
      code: 'DASHA_SANDHI_WINDOW',
      title: 'Dasha Sandhi Transition Window (<10% remaining / <5% opening)',
      detail: `Active ${activeStack.mahadasha} MD (${activeStack.mdProgressPct ?? '?'}%) / ${activeStack.antardasha} AD (${activeStack.adProgressPct ?? '?'}%) is in a threshold transition zone — treat timelines as shifting gears rather than fixed momentum.`,
      severity: 'high',
    });
  }

  // E. SAV Extremes (<20 or >=28) — consolidated into single summary rows
  const lowSavRows = savFocusRows.filter((r) => r.sav < 20);
  const highSavRows = savFocusRows.filter((r) => r.sav >= 28);
  if (lowSavRows.length > 0) {
    triggeredCancellations.push({
      code: 'SAV_LOW_BINDUS',
      title: `Low SAV Restraint (${lowSavRows.map((r) => `${r.label}:${r.sav}`).join(', ')})`,
      detail: `${lowSavRows.map((r) => r.label).join(', ')} carry SAV <20 — results require concentrated effort and discipline rather than passive volume.`,
      severity: 'moderate',
    });
  }
  if (highSavRows.length > 0) {
    triggeredCancellations.push({
      code: 'SAV_HIGH_BINDUS',
      title: `High SAV Abundance (${highSavRows.map((r) => `${r.label}:${r.sav}`).join(', ')})`,
      detail: `${highSavRows.map((r) => r.label).join(', ')} carry SAV >=28 — strong quantitative resilience during favorable transits.`,
      severity: 'info',
    });
  }

  // F. Kendradhipati Dosha on focus planets
  for (const kd of enriched.structuralFlags?.kendradhipati || []) {
    if (!kd.isActive || !focusPlanetSet.has(kd.planet)) continue;
    triggerSignals.add('kendradhipati');
    triggeredCancellations.push({
      code: 'KENDRADHIPATI_DOSHA',
      title: `${kd.planet} Kendradhipati Check`,
      detail: kd.notes,
      severity: kd.mitigated ? 'info' : 'moderate',
    });
  }

  // G. Badhaka overlap
  const badhaka = enriched.structuralFlags?.badhaka;
  if (
    badhaka &&
    (focusHouseSet.has(badhaka.badhakaHouse) ||
      focusPlanetSet.has(badhaka.badhakesh) ||
      activeStack?.mahadasha === badhaka.badhakesh ||
      activeStack?.antardasha === badhaka.badhakesh)
  ) {
    triggerSignals.add('badhaka');
    triggeredCancellations.push({
      code: 'BADHAKA_GATE',
      title: `H${badhaka.badhakaHouse} Badhaka Factor (${badhaka.badhakesh})`,
      detail: `${badhaka.lagnaModality} Lagna activates H${badhaka.badhakaHouse} as Badhaka (${badhaka.badhakesh} in H${badhaka.badhakeshHouse}) — signal bottlenecks or unconventional timing delays before clearing.`,
      severity: 'moderate',
    });
  }

  // H. Maraka activation
  const marakas = enriched.structuralFlags?.marakaPlanets || [];
  if (
    ['health', 'timing', 'open'].includes(input.playbook.domain) &&
    activeStack &&
    marakas.some((m) => m.planet === activeStack.mahadasha || m.planet === activeStack.antardasha)
  ) {
    triggerSignals.add('maraka_active');
    triggeredCancellations.push({
      code: 'MARAKA_DASHA_CONTEXT',
      title: '2L/7L Maraka Lord Active in Dasha',
      detail: 'Evaluate active 2nd/7th lord strictly via preventive vitality pacing, speech/financial stakes, and stress-recovery hygiene without fatalistic framing.',
      severity: 'info',
    });
  }

  // I. Karako Bhava Nashaya
  const kbnPairs: Array<{ planet: string; house: number }> = [
    { planet: 'Jupiter', house: 5 },
    { planet: 'Venus', house: 7 },
    { planet: 'Sun', house: 9 },
    { planet: 'Saturn', house: 8 },
    { planet: 'Mars', house: 3 },
  ];
  for (const pair of kbnPairs) {
    if (!focusHouseSet.has(pair.house)) continue;
    const pos = enriched.planets.find((p) => p.name === pair.planet);
    if (pos && pos.house === pair.house) {
      triggerSignals.add('karako_bhava_nashaya');
      triggeredCancellations.push({
        code: 'KARAKO_BHAVA_NASHAYA',
        title: `${pair.planet} in H${pair.house} (Karaka in Own Bhava)`,
        detail: `${pair.planet} sits in its own signified H${pair.house} (${pos.dignity}) — test for own-sign/benefic rescue vs. high perfectionism or delayed ease.`,
        severity: 'moderate',
      });
    }
  }

  // J. Active Structural Doshas relevant to domain
  for (const dosha of enriched.structuralFlags?.doshas || []) {
    if (!dosha.active) continue;
    const relevant =
      dosha.planets.some((pl) => focusPlanetSet.has(pl)) ||
      (input.playbook.domain === 'marriage' && (dosha.slug === 'punarphoo' || dosha.slug === '7l_dusthana')) ||
      (input.playbook.domain === 'wealth' && (dosha.slug === '2l_in_12h' || dosha.slug === 'daridra_11l'));
    if (!relevant) continue;
    if (dosha.slug.includes('vipareeta')) triggerSignals.add('vipareeta');
    if (dosha.slug === 'punarphoo' || dosha.slug === '7l_dusthana') triggerSignals.add('7h_friction');
    triggeredCancellations.push({
      code: dosha.slug.toUpperCase(),
      title: `${dosha.name}${dosha.cancelledOrMitigated ? ' (Mitigated)' : ''}`,
      detail: dosha.notes,
      severity: dosha.cancelledOrMitigated ? 'info' : dosha.severity >= 7 ? 'high' : 'moderate',
    });
  }

  // K. Ascendant maturity / Sandhi & Birth Time Caution
  if (
    enriched.ascendantMaturity?.birthTimeSensitivityWarning ||
    enriched.ascendantMaturity?.maturityBand === 'early_immature' ||
    layerA.birth_time_sensitivity.kp_sublord_minute_sensitive
  ) {
    triggerSignals.add('asc_immature_or_sandhi');
    if (layerA.birth_time_sensitivity.kp_sublord_minute_sensitive) {
      triggeredCancellations.push({
        code: 'KP_MINUTE_SENSITIVITY_GUARD',
        title: 'Minute-Sensitive Cusp / Sandhi Guard',
        detail:
          layerA.birth_time_sensitivity.caution_note ||
          'Ascendant or D9/D10 boundary is minute-sensitive; weight Chandra Lagna, D1 planets, and Vimshottari Dasha higher than narrow KP Sub-Lord minute splits.',
        severity: 'moderate',
      });
    }
  }

  if (doubleTransitFocus.some((r) => r.doubleTransitActive && focusHouseSet.has(r.house))) {
    triggerSignals.add('double_transit');
  }
  if (
    ['marriage', 'synastry', 'relationships'].includes(input.playbook.domain) &&
    layerA.house_promises['7'] &&
    ['obstructed', 'delayed', 'mixed'].includes(layerA.house_promises['7'].kp_verdict)
  ) {
    triggerSignals.add('7h_friction');
  }

  // 11. 5-Tier Truth Gate Resolution per Focus House
  const truthGateResolution: TruthGateHouseResolution[] = focusHouses.slice(0, 6).map((h) => {
    const signIdx = (ascSignIdx + h - 1) % 12;
    const hp = layerA.house_promises[String(h)];
    const kpVerdict = hp?.kp_verdict || 'mixed';
    const sav = hp?.sav ?? 25;
    const houseScore = hp?.score ?? 60;
    const lord = getHouseLordName(ascSignIdx, h);
    const lordPhi = enriched.planetaryHealth?.find((r) => r.planet === lord)?.totalScore ?? 60;
    const d9Lord = d9?.placements?.find((pl) => pl.name === lord);
    const d9Dig = d9Lord ? getSimpleVargaDignity(lord, d9Lord.signIndex) : 'Neutral';

    return {
      house: h,
      sign: SIGNS[signIdx],
      kpVerdict,
      sav,
      houseScore,
      summary: `H${h} (${SIGNS[signIdx]}): 1.KP=${kpVerdict} -> 2.D9(${lord}:${d9Dig}) -> 3.PHI(${lord}:${lordPhi}/100) -> 4.SAV(${sav})`,
    };
  });

  // =========================================================================
  // 12. Admin-Editable Priority Rule + Formula Cartridge Selection (4–8 Max)
  // =========================================================================
  const [priorityRulesMap, cartridgesMap] = await Promise.all([
    getPriorityRulesCached(),
    getFormulaCartridgesCached(),
  ]);

  const prioSlug = resolvePriorityRuleSlug(
    input.playbook.priorityDomain,
    input.playbook.id,
    input.playbook.requiresSynastry
  );
  const prioRecord: ResolvedInternalRuleRecord | undefined =
    priorityRulesMap[prioSlug] || priorityRulesMap.prio_varshaphala;

  const isMarriageFrictionReordered =
    input.playbook.domain === 'marriage' &&
    (triggerSignals.has('7h_friction') || layerA.domain_pre_audits.marriage.friction_weights_0_100 >= 45);

  const priorityBody =
    prioRecord && prioRecord.is_active
      ? isMarriageFrictionReordered
        ? `CONDITIONAL PRIORITY REORDER TRIGGERED: 7th-house friction or delay factors are present — elevate Chart Support, Cancellations & Friction Calibration to #1 BEFORE discussing timeline dates.\n${prioRecord.prompt_body}`
        : prioRecord.prompt_body
      : 'Prioritize verified D1/Varga/KP/Dasha evidence proportional to the user question.';

  // Score candidate cartridges: playbook base cartridges first + triggered Group A/B cartridges + domain backfill
  const candidateScores = new Map<string, { score: number; reason: string }>();

  for (const rawKey of input.playbook.formulaSlugs || []) {
    const slug = rawKey.trim().toLowerCase();
    candidateScores.set(slug, { score: 220, reason: 'Primary question blueprint rule' });
  }

  const playbookDomain = input.playbook.domain;
  const isCartridgeDomainCompatible = (domains: string[]): boolean => {
    if (domains.includes('universal') || domains.includes(playbookDomain)) return true;
    if (playbookDomain === 'synastry' && (domains.includes('marriage') || domains.includes('relationships'))) {
      return true;
    }
    if (playbookDomain === 'marriage' && domains.includes('relationships')) return true;
    if (playbookDomain === 'open' && domains.includes('timing')) return true;
    return false;
  };

  for (const [slug, meta] of Object.entries(FORMULA_CARTRIDGE_META_BY_SLUG)) {
    if (!isCartridgeDomainCompatible(meta.domains)) {
      continue;
    }
    const matchedFlags = (meta.triggerFlags || []).filter((f) => triggerSignals.has(f));
    if (matchedFlags.length > 0) {
      const existing = candidateScores.get(slug);
      const triggerBonus = 150 + matchedFlags.length * 15 + meta.basePriority * 0.2;
      if (!existing || triggerBonus > existing.score) {
        candidateScores.set(slug, {
          score: existing ? existing.score + 40 : triggerBonus,
          reason: `Triggered by natal/transit check (${matchedFlags.join(', ')})`,
        });
      }
    } else if (
      effectiveRequiresTimingStack &&
      (slug === 'f_dasha_ladder' || slug === 'f_slow_planet_transit')
    ) {
      if (!candidateScores.has(slug)) {
        candidateScores.set(slug, {
          score: 145,
          reason: 'Timing-sensitive consultation window',
        });
      }
    }
  }

  // Ensure at least 4 active cartridges when available by checking universal fallbacks cleanly
  const fallbackUniversalOrder = [
    'f_d1_d9_inversion',
    'f_bhavat_bhavam',
    'f_planet_distance_lens',
    'f_obstruction_gate',
  ];
  for (const slug of fallbackUniversalOrder) {
    if (candidateScores.size >= 4) break;
    if (!candidateScores.has(slug) && cartridgesMap[slug]?.is_active) {
      candidateScores.set(slug, {
        score: 75,
        reason: 'Core cross-system verification guardrail',
      });
    }
  }

  const selectedCartridges: SelectedCartridgeInfo[] = Array.from(candidateScores.entries())
    .map(([slug, info]) => ({ slug, info, record: cartridgesMap[slug] }))
    .filter(
      (entry): entry is { slug: string; info: { score: number; reason: string }; record: ResolvedInternalRuleRecord } =>
        Boolean(entry.record && entry.record.is_active)
    )
    .sort((a, b) => b.info.score - a.info.score)
    .slice(0, 8)
    .map(({ slug, info, record }) => ({
      slug,
      canonicalKey: FORMULA_CARTRIDGE_META_BY_SLUG[slug]?.canonicalKey || slug.toUpperCase(),
      title: stripInternalCodePrefix(record.display_name),
      body: record.prompt_body,
      triggerReason: info.reason,
    }));

  // 13. Extra Synastry Profiles Slice
  const synastrySlices =
    Array.isArray(input.extraProfiles) && input.extraProfiles.length > 0
      ? input.extraProfiles.slice(0, 3).map((ep, idx) => summarizeExtraProfileForSynastry(ep, idx))
      : undefined;

  // 14. Build Lean Structured Chart Slice & Calculate Size Reduction vs V1
  const domainPreAudit =
    input.playbook.domain === 'marriage' || input.playbook.domain === 'synastry'
      ? layerA.domain_pre_audits.marriage
      : input.playbook.domain === 'career'
      ? layerA.domain_pre_audits.career
      : input.playbook.domain === 'wealth'
      ? layerA.domain_pre_audits.wealth
      : input.playbook.domain === 'foreign'
      ? layerA.domain_pre_audits.foreign_and_relocation
      : input.playbook.domain === 'health' || input.playbook.domain === 'mental'
      ? layerA.domain_pre_audits.health_and_mind
      : undefined;

  const rawNarrativeKernel =
    input.dossier?.layer_b?.narrative_kernel || layerA.lagnesh_profile.core_implication;
  const compactNarrativeKernel =
    rawNarrativeKernel.length > 260
      ? `${rawNarrativeKernel.slice(0, 257).trim()}...`
      : rawNarrativeKernel;

  const compactDomainAudit = domainPreAudit
    ? 'structural_verdict' in domainPreAudit
      ? {
          verdict: domainPreAudit.structural_verdict,
          pos: domainPreAudit.positive_weights_0_100,
          fric: domainPreAudit.friction_weights_0_100,
          ...('best_mode' in domainPreAudit ? { bestMode: domainPreAudit.best_mode } : {}),
          ...('wealth_leakage_risk' in domainPreAudit ? { leakage: domainPreAudit.wealth_leakage_risk } : {}),
          ...('abroad_type' in domainPreAudit ? { abroadType: domainPreAudit.abroad_type } : {}),
        }
      : 'physical_resilience' in domainPreAudit
      ? {
          physicalResilience: domainPreAudit.physical_resilience,
          mentalPattern: domainPreAudit.mental_pattern,
        }
      : {
          promiseLevel: domainPreAudit.promise_level,
        }
    : undefined;

  const chartSlice: Record<string, unknown> = {
    profile: {
      name: enriched.meta.name,
      asc: layerA.lagnesh_profile.ascendant_degree_maturity,
      lagnesh: `${lagnesh}(PHI:${layerA.lagnesh_profile.health_score_0_100},D1:${layerA.lagnesh_profile.d1_state},D9:${layerA.lagnesh_profile.d9_state})`,
      power: `${layerA.snapshot_scores.chart_archetype_label}|Pwr:${layerA.snapshot_scores.overall_natal_power_0_100}/100|D9Amp:${layerA.snapshot_scores.d9_amplification_0_10}/10`,
      ...(!timingSlice && activeStack
        ? {
            activeDasha: `MD:${activeStack.mahadasha}(${activeStack.mdStart ? `${activeStack.mdStart}..` : 'to '}${activeStack.mdEnd}) | AD:${activeStack.antardasha}(${activeStack.adStart ? `${activeStack.adStart}..` : 'to '}${activeStack.adEnd})`,
          }
        : {}),
    },
    kernel: compactNarrativeKernel,
    ...(compactDomainAudit ? { domainAudit: compactDomainAudit } : {}),
    d1Planets: d1Slice,
    ...(chalitShiftsRelevant.length > 0
      ? {
          chalitShifts: chalitShiftsRelevant.map(
            (s) => `${s.planet}:H${s.rashiHouse}->H${s.chalitHouse}`
          ),
        }
      : {}),
    ...(Object.keys(vargasSlice).length > 0 ? { vargasNoDegrees: vargasSlice } : {}),
    ...(kpSlice.length > 0 ? { kpCusps: kpSlice } : {}),
    ...(isKpExpert && enriched.kp?.rulingPlanets?.uniqueRulingPlanets?.length
      ? { kpRulingPlanets: enriched.kp.rulingPlanets.uniqueRulingPlanets }
      : {}),
    ...(resolvedKarakaRows.length > 0 || arudhaSlice.length > 0
      ? {
          jaimini: {
            km: enriched.jaimini.karakamshaSign.slice(0, 3),
            k: resolvedKarakaRows.map((k) => `${k.code}:${k.planet}(${k.sign} ${k.dms})`),
            ...(arudhaSlice.length > 0 ? { arudhas: arudhaSlice } : {}),
            ...(isJaiminiExpert && enriched.jaimini?.charaDasha?.currentPeriod
              ? {
                  charaDashaCurrent: `${enriched.jaimini.charaDasha.currentPeriod.sign} (${enriched.jaimini.charaDasha.currentPeriod.startDate}..${enriched.jaimini.charaDasha.currentPeriod.endDate})`,
                  ...(enriched.jaimini.charaDasha.periods?.length
                    ? {
                        charaDashaAll: enriched.jaimini.charaDasha.periods.map(
                          (c) => `${c.sign.slice(0, 3)}(${c.years}y:${c.startDate})`
                        ),
                      }
                    : {}),
                }
              : {}),
            ...(isJaiminiExpert && enriched.jaimini?.argala?.length
              ? {
                  argala: enriched.jaimini.argala.map(
                    (ag) => `H${ag.targetHouse}:${ag.netSupport}`
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(Object.keys(specialSlice).length > 0 ? { specialPts: specialSlice } : {}),
    savFocus,
    ...(shadbalaFocus.length > 0 ? { shadbala: shadbalaFocus } : {}),
    ...(scopedYogas.length > 0 ? { yogas: scopedYogas } : {}),
    ...(scopedSuppressedYogas.length > 0 ? { downgradedYogas: scopedSuppressedYogas } : {}),
    ...(timingSlice ? { timing: timingSlice } : {}),
    ...(synastrySlices ? { partners: synastrySlices } : {}),
  };

  const chartSliceJsonStr = JSON.stringify(chartSlice);
  const v1FullChartChars = formatChartForLLM(enriched, 'vedic').length;
  const slicedChars = chartSliceJsonStr.length;
  const reductionPct =
    v1FullChartChars > 0
      ? Math.max(0, Math.round(((v1FullChartChars - slicedChars) / v1FullChartChars) * 100))
      : 0;

  // 15. Render Clean Server-Only Prompt Context (ZERO internal slugs or debug codes)
  const lifeContextAnchorText = formatLifeContextAnchor(
    input.lifeContext,
    layerA,
    input.contextTrapPromptNote
  );

  const cancellationBlock =
    triggeredCancellations.length > 0
      ? triggeredCancellations
          .map((c, idx) => `${idx + 1}. [${c.severity.toUpperCase()}] ${c.title}: ${c.detail}`)
          .join('\n')
      : 'No unusual structural inversions or cancellations triggered on this slice.';

  const truthGateBlock = [
    'TRUTH GATE RESOLUTION ORDER (Strictly resolve cross-system conflicts in this exact order):',
    ...TRUTH_GATE_CONFLICT_HIERARCHY,
    '',
    'HOUSE-BY-HOUSE GATE AUDIT:',
    ...truthGateResolution.map((r) => `- ${r.summary}`),
  ].join('\n');

  const cartridgesBlock = selectedCartridges
    .map((c, idx) => `### Interpretive Principle ${idx + 1}: ${c.title}\n${c.body}`)
    .join('\n\n');

  const renderedPromptContext = [
    `CONSULTATION TOPIC FOCUS: ${input.playbook.title}`,
    `RESPONSE ARCHETYPE: ${input.routerResult.intent}`,
    ...(input.playbook.customInstructions?.trim()
      ? ['', `## PLAYBOOK SPECIFIC GUIDANCE\n${input.playbook.customInstructions.trim()}`]
      : []),
    '',
    `## REAL-WORLD LIFE CONTEXT ANCHORS (Desh-Kaal-Patra)\n${lifeContextAnchorText}`,
    '',
    `## PRIORITY ORDERING\n${priorityBody}`,
    '',
    `## STRUCTURAL CANCELLATIONS & CONFLICTS DETECTED\n${cancellationBlock}`,
    '',
    `## ${truthGateBlock}`,
    '',
    `## ACTIVE INTERPRETIVE GUIDELINES\n${cartridgesBlock}`,
    '',
    `## SCOPED NATAL & TIMING CHART DATA\n${chartSliceJsonStr}`,
  ].join('\n');

  const timingWidgets = effectiveRequiresTimingStack
    ? buildDeterministicTimingWidgets(enriched, input.dailyTransits || null)
    : undefined;

  return {
    tradition: 'vedic',
    playbookId: input.playbook.id,
    domain: input.playbook.domain,
    intent: input.routerResult.intent,
    requiresTimingStack: effectiveRequiresTimingStack,
    ...(timingWidgets && timingWidgets.length > 0 ? { timingWidgets } : {}),
    priorityRule: {
      slug: prioRecord?.slug || prioSlug,
      title: prioRecord ? stripInternalCodePrefix(prioRecord.display_name) : 'Priority Matrix',
      body: priorityBody,
      conditionalReordered: isMarriageFrictionReordered,
    },
    selectedCartridges,
    triggeredCancellations,
    truthGateHierarchy: TRUTH_GATE_CONFLICT_HIERARCHY,
    truthGateResolution,
    chartSlice,
    lifeContextAnchorText,
    renderedPromptContext,
    metrics: {
      slicedChars,
      v1FullChartChars,
      reductionPct,
      cartridgeCount: selectedCartridges.length,
      cancellationCount: triggeredCancellations.length,
      slicedHousesCount: focusHouses.length,
      slicedVargasCount: requestedVargas.length,
    },
  };
}
