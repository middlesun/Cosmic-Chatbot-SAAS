import { enrichCompiledChart, type CompiledChartData } from './chartCompiler';
import type {
  BadhakaReport,
  DoubleTransitHouseRow,
  KPCusp,
  KPSignificatorRow,
  PlanetaryHealthRow,
  PlanetPosition,
  ScoredYogaItem,
  StructuralDoshaItem,
} from './jyotishMath';
import type { LifeContextData } from './lifeContextGuard';
import {
  createOpenRouterCompletion,
  getUtilityModelAsync,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from './openrouter';

export const CURRENT_NATAL_DOSSIER_VERSION = 1;

export type KpHouseVerdict = 'supportive' | 'conditional' | 'delayed' | 'mixed' | 'obstructed';

export interface NatalTruthDossierLayerA {
  schema_version: 'natal_truth_v1';
  birth_time_sensitivity: {
    lagna_near_sandhi: boolean;
    d9_or_d10_boundary_risk: boolean;
    kp_sublord_minute_sensitive: boolean;
    caution_note: string | null;
  };
  snapshot_scores: {
    overall_natal_power_0_100: number;
    stability_index_0_10: number;
    career_potential_0_10: number;
    wealth_potential_0_10: number;
    marriage_support_0_10: number;
    health_resilience_0_10: number;
    d9_amplification_0_10: number;
    chart_archetype_label: string;
  };
  lagnesh_profile: {
    ascendant_sign: string;
    ascendant_degree_maturity: string;
    lagnesh: string;
    health_score_0_100: number;
    d1_state: string;
    d9_state: string;
    core_implication: string;
  };
  command_hierarchy: {
    top_powerhouse_planets: Array<{
      planet: string;
      composite_health_0_100: number;
      authority_index_0_10: number;
      why_dominant: string;
      primary_domains: string[];
    }>;
    vulnerable_or_afflicted_planets: Array<{
      planet: string;
      composite_health_0_100: number;
      primary_vulnerability: string;
      offset_or_protection: string;
    }>;
    dispositor_backbone: {
      final_dispositor_or_loop: string;
      bhava_chalit_shifts: string[];
      net_control_note: string;
    };
  };
  validated_yogas: Array<{
    name: string;
    classification: string;
    formula_proof: string;
    ysi_score_0_110: number;
    status: string;
    domains: string[];
    real_world_expression: string;
  }>;
  suppressed_or_cosmetic_yogas: Array<{
    name: string;
    reason_downgraded: string;
  }>;
  doshas_and_hidden_risks: Array<{
    name: string;
    severity_0_10: number;
    d1_trigger: string;
    d9_status: string;
    offset_present: string;
    domains: string[];
  }>;
  house_promises: Record<
    string,
    {
      score: number;
      sav: number;
      kp_verdict: KpHouseVerdict;
      note: string;
    }
  >;
  special_points_summary: {
    indu_lagna: string;
    shri_lagna: string;
    khara_64_moon: string;
    khara_64_lagna: string;
    khara_22_lagna: string;
    badhaka_note: string;
    kendradhipati_notes: string[];
  };
  domain_pre_audits: {
    marriage: {
      structural_verdict: string;
      positive_weights_0_100: number;
      friction_weights_0_100: number;
      d1_vs_d9_contrast: string;
      priority_rule_triggered: string;
      key_anchors: string[];
    };
    career: {
      structural_verdict: string;
      positive_weights_0_100: number;
      friction_weights_0_100: number;
      d1_vs_d10_contrast: string;
      best_mode: string;
      key_anchors: string[];
    };
    wealth: {
      structural_verdict: string;
      positive_weights_0_100: number;
      friction_weights_0_100: number;
      d2_hora_and_al_note: string;
      indu_shri_lagna_note: string;
      leakage_flags: string[];
    };
    health_and_mind: {
      physical_resilience: string;
      mental_pattern: string;
      key_anchors: string[];
    };
    foreign_and_relocation: {
      promise_level: string;
      key_anchors: string[];
    };
  };
  unresolved_contradictions: string[];
}

export interface NatalNarrativeKernel {
  core_identity_summary: string;
  top_3_structural_tensions: string[];
  active_life_arc: string;
  d1_d9_contrast: string;
  ascendant_degree_maturity: string;
  bhava_chalit_shifts: string;
  d2_hora_and_al_note: string;
  indu_shri_lagna_note: string;
  key_latent_yogas_if_triggered: string[];
  anti_hype_caveats: string[];
  narrative_kernel: string;
  model_used: string;
  generated_by: 'llm' | 'deterministic_fallback';
}

export interface NatalTruthDossierV1 {
  version: number;
  generated_at: string;
  layer_a: NatalTruthDossierLayerA;
  layer_b: NatalNarrativeKernel | null;
}

const PLANET_DOMAINS: Record<string, string[]> = {
  Sun: ['authority', 'vitality', 'leadership'],
  Moon: ['mind', 'emotional_security', 'home'],
  Mars: ['drive', 'property', 'courage'],
  Mercury: ['intellect', 'commerce', 'communication'],
  Jupiter: ['wisdom', 'wealth', 'dharma'],
  Venus: ['partnership', 'comforts', 'creativity'],
  Saturn: ['career', 'longevity', 'endurance'],
  Rahu: ['ambition', 'foreign', 'innovation'],
  Ketu: ['detachment', 'research', 'intuition'],
};

const HOUSE_NOTES: Record<number, string> = {
  1: 'Self-direction, vitality, and personal agency',
  2: 'Savings, speech, family roots, and resources',
  3: 'Initiative, skills, siblings, and self-effort',
  4: 'Emotional anchor, home, mother, and fixed assets',
  5: 'Creativity, discernment, romance, and children',
  6: 'Service, routines, competition, and health recovery',
  7: 'Committed partnership, contracts, and public interface',
  8: 'Deep transformation, shared assets, and resilience',
  9: 'Dharma, mentors, higher learning, and fortune',
  10: 'Career vocation, reputation, and public authority',
  11: 'Gains, alliances, income streams, and fulfillment',
  12: 'Foreign ties, retreat, expenditure, and inner release',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function getHouseLord(ascSignIdx: number, houseNum: number): string {
  const lords = [
    'Mars',
    'Venus',
    'Mercury',
    'Moon',
    'Sun',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Saturn',
    'Jupiter',
  ];
  return lords[(ascSignIdx + houseNum - 1) % 12];
}

function getVargaDignitySimple(planet: string, signIdx: number): string {
  const ownSigns: Record<string, number[]> = {
    Sun: [4],
    Moon: [3],
    Mars: [0, 7],
    Mercury: [2, 5],
    Jupiter: [8, 11],
    Venus: [1, 6],
    Saturn: [9, 10],
  };
  const exalt: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mars: 9,
    Mercury: 5,
    Jupiter: 3,
    Venus: 11,
    Saturn: 6,
  };
  const debil: Record<string, number> = {
    Sun: 6,
    Moon: 7,
    Mars: 3,
    Mercury: 11,
    Jupiter: 9,
    Venus: 5,
    Saturn: 0,
  };
  if (exalt[planet] === signIdx) return 'Exalted';
  if (ownSigns[planet]?.includes(signIdx)) return 'Own Sign';
  if (debil[planet] === signIdx) return 'Debilitated';
  return 'Neutral';
}

function evaluateKpHouseVerdict(
  houseNum: number,
  cusps: KPCusp[],
  significators: KPSignificatorRow[]
): KpHouseVerdict {
  const cusp = cusps.find((c) => c.house === houseNum);
  if (!cusp) return 'mixed';
  const cslSig = significators.find((s) => s.planet === cusp.subLord);
  const sigHouses = new Set(cslSig?.signifiesHouses || []);

  const favorableMap: Record<number, number[]> = {
    1: [1, 5, 9, 11],
    2: [2, 6, 11],
    3: [3, 9, 11],
    4: [4, 11, 2],
    5: [5, 2, 11, 9],
    6: [6, 10, 11],
    7: [7, 2, 11, 5],
    8: [8, 11, 9],
    9: [9, 5, 11, 1],
    10: [10, 6, 11, 2],
    11: [11, 2, 6, 10],
    12: [12, 9, 3, 11],
  };

  const obstructionMap: Record<number, number[]> = {
    1: [6, 8, 12],
    2: [5, 8, 12],
    4: [3, 8, 12],
    5: [4, 10, 12],
    7: [1, 6, 10],
    9: [8, 12],
    10: [5, 8, 12],
    11: [8, 12],
  };

  const favCount = (favorableMap[houseNum] || [houseNum, 11]).filter((h) => sigHouses.has(h)).length;
  const obsCount = (obstructionMap[houseNum] || [8, 12]).filter((h) => sigHouses.has(h)).length;

  if (favCount >= 2 && obsCount === 0) return 'supportive';
  if (favCount >= 1 && obsCount >= 1) return sigHouses.has(11) ? 'conditional' : 'mixed';
  if (favCount === 0 && obsCount >= 2) return 'obstructed';
  if (sigHouses.has(6) || sigHouses.has(12)) return 'delayed';
  return favCount >= 1 ? 'supportive' : 'conditional';
}

function classifyYogaDomains(y: ScoredYogaItem): string[] {
  const txt = `${y.name} ${y.category} ${y.summary}`.toLowerCase();
  const domains: string[] = [];
  if (/dhana|wealth|lakshmi|indu|shri/.test(txt)) domains.push('wealth');
  if (/raj|amatyakaraka|career|bhadr|sasa|ruchaka|hamsa/.test(txt)) domains.push('career');
  if (/gajakesari|budh|saraswati|mind/.test(txt)) domains.push('wisdom');
  if (/malavya|marriage|kalatra|venus/.test(txt)) domains.push('marriage');
  if (/vipareeta|neecha/.test(txt)) domains.push('resilience');
  if (domains.length === 0) domains.push('life_arc');
  return domains;
}

function classifyDoshaDomains(d: StructuralDoshaItem): string[] {
  const txt = `${d.slug} ${d.name}`.toLowerCase();
  if (/7l|punarphoo|marriage/.test(txt)) return ['marriage', 'mental_wellness'];
  if (/10l/.test(txt)) return ['career'];
  if (/2l|daridra/.test(txt)) return ['wealth'];
  if (/grahan|kemadruma/.test(txt)) return ['mental_wellness', 'clarity'];
  return ['general_caution'];
}

function deriveArchetypeLabel(params: {
  lagneshPhi: number;
  strongestPlanet: string;
  careerScore: number;
  marriageScore: number;
  wealthScore: number;
  hasDelayed7H: boolean;
  lagneshAligned: boolean;
}): string {
  const { strongestPlanet, careerScore, wealthScore, hasDelayed7H, lagneshAligned } = params;
  if (strongestPlanet === 'Saturn' && careerScore >= 7) {
    return 'Slow-Burn Institutional Builder';
  }
  if (strongestPlanet === 'Jupiter' && lagneshAligned) {
    return 'Steady Ethical Advisor & Mentor';
  }
  if ((strongestPlanet === 'Mercury' || strongestPlanet === 'Rahu') && careerScore >= 6.8) {
    return 'Adaptive Strategist & Problem-Solver';
  }
  if (strongestPlanet === 'Venus' && wealthScore >= 7) {
    return 'Refined Creator & Relationship Steward';
  }
  if (strongestPlanet === 'Mars') {
    return 'Decisive Pioneer & Field Builder';
  }
  if (hasDelayed7H) {
    return 'Self-Forged Path Toward Mature Partnership';
  }
  return 'Balanced Self-Directed Growth Arc';
}

/**
 * Pure deterministic Stage-0 / Activation compiler ($0, 0ms).
 * Consumes Phase 1 chart metrics and optionally Desh-Kaal-Patra life context.
 */
export function buildNatalTruthDossierLayerA(
  rawChart: CompiledChartData,
  lifeContext?: LifeContextData | null
): NatalTruthDossierLayerA {
  // Ensure Phase 1 precision fields exist even for legacy saved charts (zero API calls)
  const chart =
    rawChart.planetaryHealth &&
    rawChart.scoredYogas &&
    rawChart.structuralFlags &&
    rawChart.ascendantMaturity &&
    rawChart.specialPoints &&
    rawChart.bhavaChalit &&
    rawChart.dispositorChain
      ? rawChart
      : enrichCompiledChart(rawChart).chartJson;

  const planets = chart.planets || [];
  const asc = planets.find((p) => p.name === 'Ascendant');
  const ascSignIdx = asc?.signIndex ?? 0;
  const healthRows: PlanetaryHealthRow[] = chart.planetaryHealth || [];
  const scoredYogas: ScoredYogaItem[] = chart.scoredYogas || [];
  const flags = chart.structuralFlags;
  const maturity = chart.ascendantMaturity;
  const special = chart.specialPoints;
  const chalit = chart.bhavaChalit;
  const disp = chart.dispositorChain;
  const savArr = chart.ashtakavarga?.sarva || Array(12).fill(28);
  const d9 = chart.vargas?.D9;
  const d10 = chart.vargas?.D10;
  const d2 = chart.vargas?.D2;

  const findPhi = (name: string): PlanetaryHealthRow | undefined =>
    healthRows.find((r) => r.planet === name);
  const findPlanet = (name: string): PlanetPosition | undefined =>
    planets.find((p) => p.name === name);

  // 1. Birth-time sensitivity
  const ascDeg = maturity?.degreeInSign ?? asc?.degreeInSign ?? 15;
  const lagnaNearSandhi = Boolean(maturity?.isSandhi || maturity?.birthTimeSensitivityWarning);
  // 3°20' per Navamsa (D9 boundary sensitivity ~0.25°); 3° per D10 boundary
  const d9SlotDist = Math.min(ascDeg % (30 / 9), 30 / 9 - (ascDeg % (30 / 9)));
  const d10SlotDist = Math.min(ascDeg % 3, 3 - (ascDeg % 3));
  const d9OrD10BoundaryRisk = d9SlotDist < 0.4 || d10SlotDist < 0.35;
  const bta = lifeContext?.birth_time_accuracy;
  const kpMinuteSensitive =
    bta === 'approximate' || bta === 'sunrise_unknown' || d9OrD10BoundaryRisk || lagnaNearSandhi;

  let cautionNote: string | null = null;
  if (bta === 'approximate' || bta === 'sunrise_unknown') {
    cautionNote =
      'Birth time is approximate/unknown; prioritize Chandra Lagna (Moon), active Mahadasha/Antardasha, and broad house signifiers over minute-sensitive KP Sub-Lords or borderline D9/D10 cusps.';
  } else if (lagnaNearSandhi || d9OrD10BoundaryRisk) {
    cautionNote = `Ascendant sits near a ${lagnaNearSandhi ? 'sign/Gandanta' : 'D9/D10 Navamsa-Dasamsa'} boundary (${ascDeg.toFixed(2)}°); confirm past life anchors if timing precision matters.`;
  }

  // 2. Lagnesh Profile
  const lagnesh = maturity?.lagnesh || getHouseLord(ascSignIdx, 1);
  const lagneshPos = findPlanet(lagnesh);
  const lagneshPhi = findPhi(lagnesh)?.totalScore ?? 60;
  const lagneshNb = flags?.neechaBhanga.find((n) => n.planet === lagnesh && n.isCancelled);
  const d1StateStr = lagneshPos
    ? `${lagneshPos.dignity} in ${lagneshPos.sign} (H${lagneshPos.house})${
        lagneshPos.isRetrograde ? ' · Retrograde' : ''
      }${lagneshNb ? ' · Neecha Bhanga active' : ''}`
    : 'Placed normally';
  const d9StateStr = maturity
    ? `${maturity.lagneshD9Dignity} in ${maturity.lagneshD9Sign} (D9)`
    : 'Balanced in D9';

  const coreImplication =
    lagneshPhi >= 72
      ? `${lagnesh} as Lagnesh gives durable self-direction and steady recovery through challenges.`
      : lagneshNb
      ? `Initial self-questioning converts into earned resilience and specialized authority over time (${lagnesh} Neecha Bhanga).`
      : lagneshPhi < 50
      ? `${lagnesh} requires pacing, structured routines, and supportive allies so energy is not scattered.`
      : `${lagnesh} balances practical adaptability with steady growth across Dashas.`;

  const ascMaturityLabel = maturity
    ? `${
        maturity.maturityBand === 'early_immature'
          ? 'Early-degree (<5°)'
          : maturity.maturityBand === 'late_mature'
          ? 'Late-degree (>25°)'
          : 'Mid-degree (5°–25°)'
      } (${maturity.degreeInSign}°, ${maturity.nakshatra} P${maturity.pada})${
        maturity.isSandhi ? ' — Sandhi sensitivity' : ''
      }`
    : `${ascDeg.toFixed(1)}° in ${asc?.sign || 'Aries'}`;

  // 3. House Promises (1..12)
  const housePromises: NatalTruthDossierLayerA['house_promises'] = {};
  const houseScores: Record<number, number> = {};

  for (let h = 1; h <= 12; h++) {
    const signIdx = (ascSignIdx + h - 1) % 12;
    const sav = savArr[signIdx] ?? 26;
    const lord = getHouseLord(ascSignIdx, h);
    const lordPhi = findPhi(lord)?.totalScore ?? 58;
    const occupants = planets.filter((p) => p.name !== 'Ascendant' && p.house === h);
    const kpVerdict = evaluateKpHouseVerdict(h, chart.kp?.cusps || [], chart.kp?.significators || []);

    let occAdj = 0;
    for (const o of occupants) {
      const oPhi = findPhi(o.name)?.totalScore ?? 55;
      if (['Jupiter', 'Venus', 'Mercury', 'Moon'].includes(o.name)) {
        occAdj += oPhi >= 60 ? 5 : 2;
      } else {
        occAdj += oPhi >= 70 ? 2 : -4;
      }
    }

    const kpAdj =
      kpVerdict === 'supportive'
        ? 9
        : kpVerdict === 'conditional'
        ? 2
        : kpVerdict === 'mixed'
        ? -2
        : kpVerdict === 'delayed'
        ? -4
        : -10;
    const savAdj = sav >= 30 ? 8 : sav >= 26 ? 3 : sav < 22 ? -7 : 0;

    const score = clamp(Math.round(lordPhi * 0.65 + 22 + occAdj + kpAdj + savAdj), 28, 96);
    houseScores[h] = score;

    const baseNote = HOUSE_NOTES[h] || 'Domain structure';
    const noteSuffix =
      kpVerdict === 'supportive'
        ? 'well-backed by KP Sub-Lord and SAV'
        : kpVerdict === 'delayed'
        ? 'matures patiently after initial effort'
        : kpVerdict === 'obstructed'
        ? 'requires realistic expectations and careful timing'
        : 'responsive during supportive Dasha windows';

    housePromises[String(h)] = {
      score,
      sav,
      kp_verdict: kpVerdict,
      note: `${baseNote} — ${noteSuffix}`,
    };
  }

  // 4. Command Hierarchy (Top Powerhouse & Vulnerable Planets)
  const sortedByPhi = [...healthRows].sort((a, b) => b.totalScore - a.totalScore);
  const karakaMap = new Map((chart.jaimini?.karakas || []).map((k) => [k.planet, k.code]));

  const topPowerhouse = sortedByPhi
    .filter((r) => r.totalScore >= 64)
    .slice(0, 3)
    .map((r) => {
      const p = findPlanet(r.planet);
      const akCode = karakaMap.get(r.planet);
      const cond = chart.conditions?.find((c) => c.planet === r.planet);
      const reasons: string[] = [];
      if (p?.dignity === 'Exalted' || p?.dignity === 'Own Sign') reasons.push(p.dignity);
      if (cond?.isVargottama) reasons.push('Vargottama');
      if (r.isNeechaBhanga) reasons.push('Neecha Bhanga');
      if (akCode) reasons.push(`Jaimini ${akCode}`);
      if (p) reasons.push(`H${p.house}`);
      return {
        planet: r.planet,
        composite_health_0_100: r.totalScore,
        authority_index_0_10: round1(r.totalScore / 10),
        why_dominant: reasons.join(' + ') || r.factors.slice(0, 3).join(', ') || 'High multi-varga strength',
        primary_domains: PLANET_DOMAINS[r.planet] || ['general'],
      };
    });

  const vulnerable = [...healthRows]
    .sort((a, b) => a.totalScore - b.totalScore)
    .filter((r) => r.totalScore < 56)
    .slice(0, 3)
    .map((r) => {
      const p = findPlanet(r.planet);
      const d9Pl = d9?.placements.find((pl) => pl.name === r.planet);
      const d9Dig = d9Pl ? getVargaDignitySimple(r.planet, d9Pl.signIndex) : 'Neutral';
      const jup = findPlanet('Jupiter');
      const hasJupShield = Boolean(jup && p && [0, 4, 6, 8].includes((p.signIndex - jup.signIndex + 12) % 12));
      return {
        planet: r.planet,
        composite_health_0_100: r.totalScore,
        primary_vulnerability: r.factors.slice(0, 3).join(' · ') || `Dusthana/low Shadbala in H${p?.house ?? '?'}`,
        offset_or_protection: r.isNeechaBhanga
          ? 'Neecha Bhanga cancellation converts early strain into competence'
          : d9Dig === 'Exalted' || d9Dig === 'Own Sign'
          ? `Uplifted in D9 Navamsa (${d9Dig})`
          : hasJupShield
          ? 'Jupiter aspect moderates downside pressure'
          : 'Improves when paired with conscious pacing and Dasha awareness',
      };
    });

  const dispNote = disp?.finalDispositors.length
    ? `Final dispositor(s): ${disp.finalDispositors.join(', ')}`
    : disp?.mutualReceptions.length
    ? `Mutual reception anchor(s): ${disp.mutualReceptions.map(([a, b]) => `${a}-${b}`).join(', ')}`
    : 'Circular dispositor flow across houses';

  const chalitNotes = (chalit?.shifts || [])
    .filter((s) => s.shifted)
    .map((s) => `${s.planet} shifts from H${s.rashiHouse} (Rashi) to H${s.chalitHouse} (Bhava Chalit)`);

  // 5. Yogas Split (YSI >= 50 vs suppressed)
  const validatedYogas = scoredYogas
    .filter((y) => y.ysiTotal >= 50 && y.status !== 'Blocked')
    .slice(0, 8)
    .map((y) => ({
      name: y.name,
      classification: y.category || 'Classical',
      formula_proof: y.summary,
      ysi_score_0_110: y.ysiTotal,
      status: y.status,
      domains: classifyYogaDomains(y),
      real_world_expression: `${y.status} combination (${y.ysiTotal}/110 YSI) — expresses clearest during Dashas of ${y.planets.join('/')}.`,
    }));

  const suppressedYogas = scoredYogas
    .filter((y) => y.ysiTotal < 50 || y.status === 'Blocked')
    .slice(0, 6)
    .map((y) => ({
      name: y.name,
      reason_downgraded: `YSI ${y.ysiTotal}/110 (${y.status}) — secondary nuance rather than primary chart driver.`,
    }));

  // 6. Doshas & Hidden Risks with offsets
  const doshasList = (flags?.doshas || []).map((d) => {
    const jup = findPlanet('Jupiter');
    const offset = d.cancelledOrMitigated
      ? 'Structural mitigation present — moderates harsh extremes'
      : jup && (findPhi('Jupiter')?.totalScore ?? 0) >= 65
      ? 'Strong natal Jupiter supports steady correction'
      : 'Manageable through awareness and favorable Dasha timing';
    return {
      name: d.name,
      severity_0_10: d.severity,
      d1_trigger: d.notes,
      d9_status: d9 ? 'Cross-checked against D9 Navamsa placements' : 'D1 check',
      offset_present: offset,
      domains: classifyDoshaDomains(d),
    };
  });

  // 7. Snapshot Scores (0-100 & 0-10)
  const avgPhi = healthRows.length
    ? healthRows.reduce((s, r) => s + r.totalScore, 0) / healthRows.length
    : 60;
  const d9StrongCount = (d9?.placements || []).filter((pl) => {
    if (pl.name === 'Ascendant') return false;
    const dig = getVargaDignitySimple(pl.name, pl.signIndex);
    return dig === 'Exalted' || dig === 'Own Sign';
  }).length;
  const d9Amp = clamp(round1(4.8 + d9StrongCount * 0.9 + (maturity?.lagneshD1D9Aligned ? 1.2 : 0)), 3.0, 9.8);

  const careerPositive = clamp(
    Math.round((houseScores[10] * 0.45 + houseScores[6] * 0.25 + houseScores[11] * 0.3)),
    25,
    95
  );
  const wealthPositive = clamp(
    Math.round(houseScores[2] * 0.35 + houseScores[11] * 0.4 + houseScores[9] * 0.25),
    25,
    95
  );
  const marriagePositive = clamp(
    Math.round(houseScores[7] * 0.5 + houseScores[2] * 0.2 + (findPhi('Venus')?.totalScore ?? 60) * 0.3),
    25,
    95
  );
  const healthPositive = clamp(Math.round(houseScores[1] * 0.55 + lagneshPhi * 0.45), 25, 95);

  const topYogaBoost = validatedYogas.some((y) => y.status === 'Foundational') ? 6 : validatedYogas.length > 0 ? 3 : 0;
  const overallPower = clamp(Math.round(avgPhi * 0.72 + d9Amp * 2.2 + topYogaBoost), 35, 95);
  const stabilityIndex = clamp(
    round1((houseScores[1] + houseScores[4] + (findPhi('Moon')?.totalScore ?? 60)) / 30),
    3.0,
    9.6
  );

  // 8. Domain Pre-Audits
  const venD1 = findPlanet('Venus');
  const venD9Pl = d9?.placements.find((p) => p.name === 'Venus');
  const venD9Dig = venD9Pl ? getVargaDignitySimple('Venus', venD9Pl.signIndex) : 'Neutral';
  const satPhi = findPhi('Saturn')?.totalScore ?? 60;
  const has7lDusthana = Boolean(flags?.doshas.some((d) => d.slug === '7l_dusthana'));
  const hasPunarphoo = Boolean(flags?.doshas.some((d) => d.slug === 'punarphoo'));
  const marriageVerdict =
    housePromises['7'].kp_verdict === 'supportive' && !has7lDusthana && !hasPunarphoo
      ? 'Clear Relational Support'
      : marriagePositive >= 62
      ? 'Delayed or Deliberate but Supported'
      : 'Requires Conscious Selection & Patience';

  const marriageFriction = clamp(
    100 - marriagePositive + (hasPunarphoo ? 10 : 0) + (has7lDusthana ? 8 : 0),
    18,
    85
  );

  const l10Name = getHouseLord(ascSignIdx, 10);
  const l10D10 = d10?.placements.find((p) => p.name === l10Name);
  const l10D10Dig = l10D10 ? getVargaDignitySimple(l10Name, l10D10.signIndex) : 'Neutral';
  const careerFriction = clamp(100 - careerPositive + (flags?.doshas.some((d) => d.slug === '10l_combust') ? 8 : 0), 15, 82);
  const bestCareerMode =
    houseScores[7] > houseScores[6] + 6 || (findPhi('Mercury')?.totalScore ?? 0) >= 72
      ? 'Independent consulting, ownership, or strategic advisory blends well'
      : houseScores[6] >= houseScores[7]
      ? 'Structured mastery, specialization, or institutional leadership excels'
      : 'Hybrid expertise combining steady execution with autonomous scope';

  const d2Placements = d2?.placements || [];
  const sunHoraCount = d2Placements.filter((p) => p.name !== 'Ascendant' && p.signIndex === 4).length;
  const moonHoraCount = d2Placements.filter((p) => p.name !== 'Ascendant' && p.signIndex === 3).length;
  const al = chart.jaimini?.arudhaPadas?.find((a) => a.code === 'AL');
  const d2HoraNote = `${
    sunHoraCount > moonHoraCount
      ? 'Sun Hora (Leo) majority favors self-earned authority'
      : moonHoraCount > sunHoraCount
      ? 'Moon Hora (Cancer) majority favors steady liquid reserves & partnerships'
      : 'Balanced Sun/Moon Hora energy'
  }; Arudha Lagna (AL) in ${al?.padaSign || 'D1'} shapes public material standing.`;

  const induNote = special?.induLagna
    ? `Indu Lagna in ${special.induLagna.sign} (H${special.induLagna.houseFromLagna}, lord ${special.induLagna.lord})${
        special.induLagna.occupants.length > 0 ? ` occupied by ${special.induLagna.occupants.join(', ')}` : ''
      }; Shri Lagna in ${special.shriLagna.sign} (H${special.shriLagna.houseFromLagna}).`
    : 'Indu/Shri Lagna computed at baseline.';

  const leakageFlags = (flags?.doshas || [])
    .filter((d) => d.slug === '2l_in_12h' || d.slug === 'daridra_11l')
    .map((d) => d.notes);

  const foreignScore = Math.round((houseScores[9] + houseScores[12] + houseScores[3]) / 3);

  // 9. Unresolved Contradictions (Feeds Stage 4 Deeper Analysis suggestions)
  const contradictions: string[] = [];
  if ((houseScores[7] < 60 || has7lDusthana) && (venD9Dig === 'Exalted' || venD9Dig === 'Own Sign' || marriagePositive >= 62)) {
    contradictions.push(
      `D1 7th house/lord shows caution or delay, while D9 Venus (${venD9Dig}) and deeper weights support durable commitment.`
    );
  }
  if (lagneshPhi < 58 && careerPositive >= 70) {
    contradictions.push(
      `Strong 10th/11th career architecture (${careerPositive}/100) contrasts with lower Lagnesh confidence (${lagneshPhi}/100).`
    );
  }
  if (chalitNotes.length > 0) {
    contradictions.push(`Bhava-Chalit house shift active: ${chalitNotes[0]}.`);
  }
  if (suppressedYogas.length > 0 && validatedYogas.length > 0) {
    contradictions.push(
      `Operative ${validatedYogas[0].name} dominates over softer textbook combinations (${suppressedYogas[0].name}).`
    );
  }
  if (contradictions.length === 0) {
    contradictions.push(
      `${topPowerhouse[0]?.planet || 'Primary lord'} leadership balances ${
        vulnerable[0]?.planet ? `vulnerability in ${vulnerable[0].planet}` : 'multi-house pacing'
      } across Dashas.`
    );
  }

  const badhaka: BadhakaReport | undefined = flags?.badhaka;
  const kendraNotes = (flags?.kendradhipati || []).map((k) => k.notes);

  return {
    schema_version: 'natal_truth_v1',
    birth_time_sensitivity: {
      lagna_near_sandhi: lagnaNearSandhi,
      d9_or_d10_boundary_risk: d9OrD10BoundaryRisk,
      kp_sublord_minute_sensitive: kpMinuteSensitive,
      caution_note: cautionNote,
    },
    snapshot_scores: {
      overall_natal_power_0_100: overallPower,
      stability_index_0_10: stabilityIndex,
      career_potential_0_10: round1(careerPositive / 10),
      wealth_potential_0_10: round1(wealthPositive / 10),
      marriage_support_0_10: round1(marriagePositive / 10),
      health_resilience_0_10: round1(healthPositive / 10),
      d9_amplification_0_10: d9Amp,
      chart_archetype_label: deriveArchetypeLabel({
        lagneshPhi,
        strongestPlanet: topPowerhouse[0]?.planet || chart.shadbala?.strongestPlanet || lagnesh,
        careerScore: round1(careerPositive / 10),
        marriageScore: round1(marriagePositive / 10),
        wealthScore: round1(wealthPositive / 10),
        hasDelayed7H: has7lDusthana || hasPunarphoo,
        lagneshAligned: Boolean(maturity?.lagneshD1D9Aligned),
      }),
    },
    lagnesh_profile: {
      ascendant_sign: asc?.sign || 'Aries',
      ascendant_degree_maturity: ascMaturityLabel,
      lagnesh,
      health_score_0_100: lagneshPhi,
      d1_state: d1StateStr,
      d9_state: d9StateStr,
      core_implication: coreImplication,
    },
    command_hierarchy: {
      top_powerhouse_planets: topPowerhouse,
      vulnerable_or_afflicted_planets: vulnerable,
      dispositor_backbone: {
        final_dispositor_or_loop: dispNote,
        bhava_chalit_shifts: chalitNotes,
        net_control_note:
          disp?.finalDispositors.length
            ? `Chart energy concentrates cleanly through ${disp.finalDispositors.join(', ')}.`
            : 'Planetary lords circulate responsibility across mutual house links.',
      },
    },
    validated_yogas: validatedYogas,
    suppressed_or_cosmetic_yogas: suppressedYogas,
    doshas_and_hidden_risks: doshasList,
    house_promises: housePromises,
    special_points_summary: {
      indu_lagna: special
        ? `${special.induLagna.sign} (H${special.induLagna.houseFromLagna}, lord ${special.induLagna.lord})`
        : '—',
      shri_lagna: special
        ? `${special.shriLagna.sign} (H${special.shriLagna.houseFromLagna}, ${special.shriLagna.nakshatra})`
        : '—',
      khara_64_moon: special
        ? `${special.khara64NavamsaMoon.sign} (lord ${special.khara64NavamsaMoon.lord})`
        : '—',
      khara_64_lagna: special
        ? `${special.khara64NavamsaLagna.sign} (lord ${special.khara64NavamsaLagna.lord})`
        : '—',
      khara_22_lagna: special
        ? `${special.khara22DrekkanaLagna.sign} (lord ${special.khara22DrekkanaLagna.lord})`
        : '—',
      badhaka_note: badhaka
        ? `${badhaka.lagnaModality} Lagna -> ${badhaka.badhakaHouse}H Badhaka (${badhaka.badhakesh} in H${badhaka.badhakeshHouse})`
        : '—',
      kendradhipati_notes: kendraNotes,
    },
    domain_pre_audits: {
      marriage: {
        structural_verdict: marriageVerdict,
        positive_weights_0_100: marriagePositive,
        friction_weights_0_100: marriageFriction,
        d1_vs_d9_contrast: `D1 Venus sits in ${venD1?.sign || '—'} (H${venD1?.house || '?'}); D9 Venus holds ${venD9Dig} dignity.`,
        priority_rule_triggered:
          hasPunarphoo || has7lDusthana ? 'Signature_Delay_Validation' : 'Standard_7H_D9_Balance',
        key_anchors: [
          `7H KP verdict: ${housePromises['7'].kp_verdict}`,
          `D9 Venus: ${venD9Dig}`,
          `Saturn PHI: ${satPhi}/100`,
        ],
      },
      career: {
        structural_verdict:
          careerPositive >= 74
            ? 'Strong Institutional or Specialist Rise'
            : careerPositive >= 58
            ? 'Steady Earned Ascent'
            : 'Requires Niche Alignment & Consistency',
        positive_weights_0_100: careerPositive,
        friction_weights_0_100: careerFriction,
        d1_vs_d10_contrast: `10th lord ${l10Name} in D1 H${findPlanet(l10Name)?.house ?? '?'}; holds ${l10D10Dig} status in D10.`,
        best_mode: bestCareerMode,
        key_anchors: [
          `10H SAV: ${housePromises['10'].sav}`,
          `10H KP verdict: ${housePromises['10'].kp_verdict}`,
          `10L D10: ${l10D10Dig}`,
        ],
      },
      wealth: {
        structural_verdict:
          wealthPositive >= 72
            ? 'Compounding Resource Potential'
            : wealthPositive >= 56
            ? 'Steady Earned Accumulation'
            : 'Disciplined Cash-Flow Management Needed',
        positive_weights_0_100: wealthPositive,
        friction_weights_0_100: clamp(100 - wealthPositive + leakageFlags.length * 8, 15, 82),
        d2_hora_and_al_note: d2HoraNote,
        indu_shri_lagna_note: induNote,
        leakage_flags: leakageFlags,
      },
      health_and_mind: {
        physical_resilience:
          healthPositive >= 68
            ? 'Solid baseline vitality with steady stamina'
            : 'Sensitive constitution rewarding consistent sleep and pacing',
        mental_pattern:
          (findPhi('Moon')?.totalScore ?? 60) >= 65
            ? 'Composed emotional processing under pressure'
            : 'Reflective or sensitive nervous rhythm requiring grounding routines',
        key_anchors: [
          `Lagnesh ${lagnesh} PHI: ${lagneshPhi}/100`,
          `Moon PHI: ${findPhi('Moon')?.totalScore ?? 60}/100`,
          `6H SAV: ${housePromises['6'].sav}`,
        ],
      },
      foreign_and_relocation: {
        promise_level:
          foreignScore >= 72 ? 'High' : foreignScore >= 58 ? 'Moderate-High' : 'Selective / Dasha-Dependent',
        key_anchors: [
          `9H KP: ${housePromises['9'].kp_verdict}`,
          `12H KP: ${housePromises['12'].kp_verdict}`,
          `12H SAV: ${housePromises['12'].sav}`,
        ],
      },
    },
    unresolved_contradictions: contradictions,
  };
}

function buildDeterministicNarrativeKernel(layerA: NatalTruthDossierLayerA): NatalNarrativeKernel {
  const topPower = layerA.command_hierarchy.top_powerhouse_planets
    .map((p) => `${p.planet} (${p.composite_health_0_100}/100)`)
    .join(', ');
  const vuln = layerA.command_hierarchy.vulnerable_or_afflicted_planets
    .map((p) => `${p.planet} (${p.primary_vulnerability})`)
    .join('; ');
  const topYogas = layerA.validated_yogas.slice(0, 3).map((y) => `${y.name} (${y.ysi_score_0_110}/110)`);

  return {
    core_identity_summary: `${layerA.lagnesh_profile.ascendant_sign} Ascendant steered by ${layerA.lagnesh_profile.lagnesh} (${layerA.lagnesh_profile.d1_state}). Archetype: ${layerA.snapshot_scores.chart_archetype_label}.`,
    top_3_structural_tensions: layerA.unresolved_contradictions.slice(0, 3),
    active_life_arc: `${layerA.domain_pre_audits.career.structural_verdict}; ${layerA.domain_pre_audits.marriage.structural_verdict}.`,
    d1_d9_contrast: `${layerA.lagnesh_profile.lagnesh} moves from ${layerA.lagnesh_profile.d1_state} to ${layerA.lagnesh_profile.d9_state}. ${layerA.domain_pre_audits.marriage.d1_vs_d9_contrast}`,
    ascendant_degree_maturity: layerA.lagnesh_profile.ascendant_degree_maturity,
    bhava_chalit_shifts:
      layerA.command_hierarchy.dispositor_backbone.bhava_chalit_shifts.join('; ') ||
      'All planets hold identical Whole-Sign and Placidus Chalit houses.',
    d2_hora_and_al_note: layerA.domain_pre_audits.wealth.d2_hora_and_al_note,
    indu_shri_lagna_note: layerA.domain_pre_audits.wealth.indu_shri_lagna_note,
    key_latent_yogas_if_triggered: topYogas,
    anti_hype_caveats: [
      ...(layerA.birth_time_sensitivity.caution_note ? [layerA.birth_time_sensitivity.caution_note] : []),
      ...(layerA.suppressed_or_cosmetic_yogas.slice(0, 2).map((y) => `${y.name}: ${y.reason_downgraded}`)),
    ],
    narrative_kernel: `Core engine: ${layerA.lagnesh_profile.core_implication} Dominant supports: ${
      topPower || 'balanced distribution'
    }. Key areas needing deliberate pacing: ${
      vuln || 'no severe planetary impairment detected'
    }. Overall structural power sits at ${layerA.snapshot_scores.overall_natal_power_0_100}/100 with D9 amplification at ${layerA.snapshot_scores.d9_amplification_0_10}/10.`,
    model_used: 'deterministic',
    generated_by: 'deterministic_fallback',
  };
}

/**
 * Generates concise Layer B narrative kernel (~500-700 tokens) using a single utility model call
 * when OpenRouter is configured, falling back cleanly to deterministic synthesis if unavailable.
 */
export async function generateNatalNarrativeKernel(
  layerA: NatalTruthDossierLayerA
): Promise<NatalNarrativeKernel> {
  const fallback = buildDeterministicNarrativeKernel(layerA);

  try {
    const configured = await isOpenRouterConfiguredAsync();
    if (!configured) {
      return fallback;
    }

    const model = await getUtilityModelAsync();
    const compactInput = {
      birth_time_sensitivity: layerA.birth_time_sensitivity,
      snapshot_scores: layerA.snapshot_scores,
      lagnesh_profile: layerA.lagnesh_profile,
      command_hierarchy: layerA.command_hierarchy,
      validated_yogas: layerA.validated_yogas.slice(0, 5),
      suppressed_or_cosmetic_yogas: layerA.suppressed_or_cosmetic_yogas.slice(0, 4),
      doshas_and_hidden_risks: layerA.doshas_and_hidden_risks.slice(0, 4),
      special_points_summary: layerA.special_points_summary,
      domain_pre_audits: layerA.domain_pre_audits,
      unresolved_contradictions: layerA.unresolved_contradictions,
    };

    const completion = await createOpenRouterCompletion({
      model,
      temperature: 0.15,
      maxTokens: 900,
      jsonMode: true,
      system: `You are a Grandmaster Vedic Astrology Structural Compiler.
Transform the verified Layer A Natal Truth Dossier JSON into concise, grounded Observatory prose fields.
STRICT RULES:
1. ZERO FABRICATION: Cite ONLY signs, planets, scores, and flags present in the supplied JSON.
2. NEVER use the phrase "the native" — write plainly ("this chart" or "the individual").
3. NO fear-mongering, NO gemstone/ritual sales, NO em-dashes.
4. Return ONLY valid JSON matching the exact keys requested.`,
      messages: [
        {
          role: 'user',
          content: `Compile the narrative Layer B JSON from this verified Layer A structural dossier. Return JSON with keys:
{
  "core_identity_summary": string,
  "top_3_structural_tensions": string[],
  "active_life_arc": string,
  "d1_d9_contrast": string,
  "ascendant_degree_maturity": string,
  "bhava_chalit_shifts": string,
  "d2_hora_and_al_note": string,
  "indu_shri_lagna_note": string,
  "key_latent_yogas_if_triggered": string[],
  "anti_hype_caveats": string[],
  "narrative_kernel": "200-350 word clear synthesis of core powers, bottlenecks, D1-vs-D9 maturity, and life pacing"
}

VERIFIED LAYER A JSON:
${JSON.stringify(compactInput)}`,
        },
      ],
    });

    const parsed = safeExtractJson<Partial<NatalNarrativeKernel>>(completion.text, {});
    if (!parsed || typeof parsed.narrative_kernel !== 'string' || parsed.narrative_kernel.trim().length < 40) {
      return fallback;
    }

    return {
      core_identity_summary:
        typeof parsed.core_identity_summary === 'string' && parsed.core_identity_summary.trim()
          ? parsed.core_identity_summary.trim()
          : fallback.core_identity_summary,
      top_3_structural_tensions: Array.isArray(parsed.top_3_structural_tensions)
        ? parsed.top_3_structural_tensions.map(String).slice(0, 4)
        : fallback.top_3_structural_tensions,
      active_life_arc:
        typeof parsed.active_life_arc === 'string' && parsed.active_life_arc.trim()
          ? parsed.active_life_arc.trim()
          : fallback.active_life_arc,
      d1_d9_contrast:
        typeof parsed.d1_d9_contrast === 'string' && parsed.d1_d9_contrast.trim()
          ? parsed.d1_d9_contrast.trim()
          : fallback.d1_d9_contrast,
      ascendant_degree_maturity:
        typeof parsed.ascendant_degree_maturity === 'string' && parsed.ascendant_degree_maturity.trim()
          ? parsed.ascendant_degree_maturity.trim()
          : fallback.ascendant_degree_maturity,
      bhava_chalit_shifts:
        typeof parsed.bhava_chalit_shifts === 'string' && parsed.bhava_chalit_shifts.trim()
          ? parsed.bhava_chalit_shifts.trim()
          : fallback.bhava_chalit_shifts,
      d2_hora_and_al_note:
        typeof parsed.d2_hora_and_al_note === 'string' && parsed.d2_hora_and_al_note.trim()
          ? parsed.d2_hora_and_al_note.trim()
          : fallback.d2_hora_and_al_note,
      indu_shri_lagna_note:
        typeof parsed.indu_shri_lagna_note === 'string' && parsed.indu_shri_lagna_note.trim()
          ? parsed.indu_shri_lagna_note.trim()
          : fallback.indu_shri_lagna_note,
      key_latent_yogas_if_triggered: Array.isArray(parsed.key_latent_yogas_if_triggered)
        ? parsed.key_latent_yogas_if_triggered.map(String).slice(0, 6)
        : fallback.key_latent_yogas_if_triggered,
      anti_hype_caveats: Array.isArray(parsed.anti_hype_caveats)
        ? parsed.anti_hype_caveats.map(String).slice(0, 5)
        : fallback.anti_hype_caveats,
      narrative_kernel: parsed.narrative_kernel.trim(),
      model_used: model,
      generated_by: 'llm',
    };
  } catch {
    return fallback;
  }
}

export async function compileNatalTruthDossier(
  chart: CompiledChartData,
  options?: {
    lifeContext?: LifeContextData | null;
    includeNarrativeKernel?: boolean;
  }
): Promise<NatalTruthDossierV1> {
  const layerA = buildNatalTruthDossierLayerA(chart, options?.lifeContext);
  const layerB =
    options?.includeNarrativeKernel === false
      ? buildDeterministicNarrativeKernel(layerA)
      : await generateNatalNarrativeKernel(layerA);

  return {
    version: CURRENT_NATAL_DOSSIER_VERSION,
    generated_at: new Date().toISOString(),
    layer_a: layerA,
    layer_b: layerB,
  };
}

/**
 * Helper to format Double Transit + SAV context snippet cleanly for future Stage 2 slicing.
 */
export function summarizeDoubleTransitFocus(rows: DoubleTransitHouseRow[] | undefined): string[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r.doubleTransitActive)
    .map((r) => `H${r.house} (${r.sign}, SAV ${r.savBindus} - ${r.savVolumeBand})`);
}
