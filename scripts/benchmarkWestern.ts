/**
 * Cosmic Council Western Astrology Engine — Phase 7 Western Parity Benchmark QA Harness
 *
 * Run offline (zero DB mutations, zero API keys required):
 *   npx tsx scripts/benchmarkWestern.ts
 */

import assert from 'node:assert/strict';
import type { LifeContextData } from '../lib/lifeContextSchema';
import type { Stage1RouterResult } from '../lib/vedicTypes';
import { sanitizeVedicProse } from '../server/services/abuseGuard';
import { getPlaybookById } from '../server/services/canonicalPlaybooks';
import { enrichCompiledChart, formatChartForLLM, type CompiledChartData } from '../server/services/chartCompiler';
import { compileStage2ContextPackage } from '../server/services/contextSlicer';
import { buildDeepAuditLensPrompts } from '../server/services/deepCouncilAudit';
import { WESTERN_CORE_COUNCIL_CONSTITUTION } from '../server/services/enginePromptDefaults';
import { evaluateStage1Routing } from '../server/services/intentRouter';
import {
  buildWesternTimingWidgets,
  computeAshtakavarga,
  computeDivisionalCharts,
  computeJaiminiKarakas,
  computeKPSignificators,
  computeVimshottariTimeline,
  computeWesternChart,
  computeWesternDailyTransits,
  computeWesternTimingSnapshot,
  computeDeterministicSiderealPlanets,
  formatDMS,
  getDignity,
  getKPAyanamsaApprox,
  getLahiriAyanamsaApprox,
  getNakshatraAndSubs,
  SIGN_LORDS,
  SIGNS,
  toJulianDay,
  type KPCusp,
  type PlanetPosition,
} from '../server/services/jyotishMath';
import { compileNatalTruthDossier, type NatalTruthDossierV1 } from '../server/services/natalDossier';
import {
  buildStage4StructuredSeeds,
  generateAlignedStage4Suggestions,
} from '../server/services/suggestionEngine';
import {
  buildShortReplyBreakdownInstruction,
  buildVedicPathAPrompt,
  computeDeterministicPillarConvergence,
} from '../server/services/vedicAstrologerEngine';

interface BenchmarkCaseResult {
  id: string;
  label: string;
  passed: boolean;
  latencyMs: number;
  summary: string;
}

const FORBIDDEN_VEDIC_TERMS_RE =
  /\b(?:navamsa|vargottama|shadbala|kp\s+sub-lord|kp\s+csl|mahadasha|antardasha|pratyantardasha|vimshottari|chara\s+dasha|gochar|nakshatra|lagnesh|rashi|ashtakavarga|bhava[- ]chalit|neecha\s+bhanga|kendradhipati|badhaka|khara\s+d[39]|indu\s+lagna|shri\s+lagna|sav\s+bindu|bav\s+bindu)\b/i;

function assertZeroVedicLeakage(text: string, contextLabel: string): void {
  const match = FORBIDDEN_VEDIC_TERMS_RE.exec(text);
  assert.equal(
    match,
    null,
    `Vedic term "${match?.[0]}" leaked into Western ${contextLabel}!`
  );
}

function buildWesternTestChart(name = 'Western QA Chart'): CompiledChartData {
  // Tropical longitudes engineered to include:
  // - Diurnal chart (Sun in H10)
  // - Cazimi Mercury (within 0.2° of Sun)
  // - Mutual Reception (Venus in Aries <-> Mars in Taurus)
  // - T-Square (Sun 105.2° Cancer opp Saturn 285.5° Capricorn, apex Uranus 15.4° Aries)
  // - Grand Trine Air (Moon 75.3° Gemini, Jupiter 315.4° Aquarius, Pluto 195.2° Libra)
  const birthDateISO = '1992-07-07';
  const birthTimeStr = '12:45:00';
  const timezoneOffsetHours = -4;
  const jd = toJulianDay(1992, 7, 7, 12 + 45 / 60 - timezoneOffsetHours);
  const lahiri = getLahiriAyanamsaApprox(jd);
  const kpAyanamsa = getKPAyanamsaApprox(jd);

  const ascLong = 195.0; // 15° Libra -> House 10 MC = 105° Cancer

  const westernApiPlanets = [
    { name: 'Sun', longitude: 105.2, isRetrograde: false },
    { name: 'Moon', longitude: 75.3, isRetrograde: false },
    { name: 'Mercury', longitude: 105.4, isRetrograde: false },
    { name: 'Venus', longitude: 18.0, isRetrograde: false },
    { name: 'Mars', longitude: 48.0, isRetrograde: false },
    { name: 'Jupiter', longitude: 315.4, isRetrograde: false },
    { name: 'Saturn', longitude: 285.5, isRetrograde: false },
    { name: 'Uranus', longitude: 15.4, isRetrograde: false },
    { name: 'Neptune', longitude: 292.1, isRetrograde: true },
    { name: 'Pluto', longitude: 195.2, isRetrograde: false },
    { name: 'North Node', longitude: 118.0, isRetrograde: true },
    { name: 'Chiron', longitude: 21.6, isRetrograde: false },
  ];

  // Convert desired Tropical longitudes into Sidereal so computeWesternChart(+lahiri) recovers exact targets
  const siderealPlanets: PlanetPosition[] = [
    ['Ascendant', ascLong - lahiri, false],
    ['Sun', 105.2 - lahiri, false],
    ['Moon', 75.3 - lahiri, false],
    ['Mars', 48.0 - lahiri, false],
    ['Mercury', 105.4 - lahiri, false],
    ['Jupiter', 315.4 - lahiri, false],
    ['Venus', 18.0 - lahiri, false],
    ['Saturn', 285.5 - lahiri, false],
    ['Rahu', 118.0 - lahiri, true],
    ['Ketu', 298.0 - lahiri, true],
  ].map(([pName, lon, retro]) => {
    const nLon = (((lon as number) % 360) + 360) % 360;
    const signIndex = Math.floor(nLon / 30) % 12;
    const ascSign = Math.floor((((ascLong - lahiri) % 360) + 360) % 360 / 30);
    const nak = getNakshatraAndSubs(nLon);
    return {
      name: pName as string,
      longitude: nLon,
      degreeInSign: nLon % 30,
      dms: formatDMS(nLon % 30),
      signIndex,
      sign: SIGNS[signIndex],
      signLord: SIGN_LORDS[signIndex],
      house: ((signIndex - ascSign + 12) % 12) + 1,
      isRetrograde: Boolean(retro),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      dignity: getDignity(pName as string, signIndex),
    };
  });

  const kpCusps: KPCusp[] = Array.from({ length: 12 }, (_, i) => {
    const tropLon = (ascLong + i * 30) % 360;
    const sidLon = (((tropLon - kpAyanamsa) % 360) + 360) % 360;
    const signIndex = Math.floor(sidLon / 30) % 12;
    const nak = getNakshatraAndSubs(sidLon);
    return {
      house: i + 1,
      longitude: sidLon,
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: sidLon % 30,
      dms: formatDMS(sidLon % 30),
      signLord: SIGN_LORDS[signIndex],
      nakshatra: nak.nakshatra,
      starLord: nak.nakshatraLord,
      subLord: nak.subLord,
    };
  });

  const kpSigs = computeKPSignificators(siderealPlanets, kpCusps);
  const vargas = computeDivisionalCharts(siderealPlanets);
  const jaiminiBase = computeJaiminiKarakas(siderealPlanets);
  const ashtakavarga = computeAshtakavarga(siderealPlanets);
  const moon = siderealPlanets.find((p) => p.name === 'Moon')!;
  const vimshottari = computeVimshottariTimeline(
    moon.longitude,
    birthDateISO,
    birthTimeStr,
    timezoneOffsetHours
  );

  const western = computeWesternChart({
    siderealPlanets,
    kpCusps,
    birthDateISO,
    birthTimeStr,
    timezoneOffsetHours,
    apiWesternPlanets: westernApiPlanets,
  });

  const raw: CompiledChartData = {
    meta: {
      name,
      birthDate: birthDateISO,
      birthTime: birthTimeStr,
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        timezoneOffset: timezoneOffsetHours,
        locationLabel: 'New York, USA',
      },
      ayanamsha: 'Lahiri',
      generatedAt: new Date().toISOString(),
    },
    planets: siderealPlanets,
    vargas,
    kp: { cusps: kpCusps, significators: kpSigs },
    jaimini: jaiminiBase,
    ashtakavarga,
    vimshottari,
    western,
  };

  return enrichCompiledChart(raw).chartJson;
}

async function runWesternBenchmark() {
  console.log('========================================================================');
  console.log(' COSMIC COUNCIL — PHASE 7 WESTERN ASTROLOGY PARITY QA HARNESS (8 Cases)');
  console.log('========================================================================\n');

  const chart = buildWesternTestChart('Elena QA');
  const partnerChart = buildWesternTestChart('Partner QA');

  const singleContext: LifeContextData = {
    birth_time_accuracy: 'hospital_exact',
    relationship_status: 'single',
    career_mode: 'job_salaried',
    location_status: 'hometown',
  };
  const marriedContext: LifeContextData = {
    birth_time_accuracy: 'hospital_exact',
    relationship_status: 'married_with_children',
    marriage_year: 2020,
    has_children: true,
    children: [{ gender: 'male', birth_year: 2023 }],
    career_mode: 'job_salaried',
    location_status: 'hometown',
  };

  const dossier: NatalTruthDossierV1 = await compileNatalTruthDossier(chart, {
    lifeContext: singleContext,
    includeNarrativeKernel: false,
  });

  const results: BenchmarkCaseResult[] = [];

  // ── Case 1: Sect, Cazimi, Mutual Reception, Tight <2° Orbs & Configurations ──
  {
    const t0 = Date.now();
    const w = chart.western!;
    assert.equal(w.sect?.chartType, 'Diurnal', 'Sun in H10 must be Diurnal sect');
    assert.equal(w.sect?.beneficOfSect, 'Jupiter');
    assert.equal(w.sect?.maleficContrary, 'Mars');

    const mercury = w.planets.find((p) => p.name === 'Mercury');
    assert.equal(mercury?.solarCondition, 'Cazimi', 'Mercury 0.2° from Sun must be Cazimi');

    assert.ok(
      (w.mutualReceptions || []).some(
        (m) =>
          (m.planetA === 'Venus' && m.planetB === 'Mars') ||
          (m.planetA === 'Mars' && m.planetB === 'Venus')
      ),
      'Venus in Aries <-> Mars in Taurus must detect Mutual Reception'
    );

    const coreAspects = w.aspects.filter((a) => a.orbTier === 'core_structural');
    assert.ok(coreAspects.length >= 2, 'Expected tight <=2.0° core_structural aspects');
    assert.ok(
      (w.configurations || []).some((c) => c.type === 'T-Square'),
      'Expected T-Square configuration (Sun-Saturn-Uranus)'
    );
    assert.ok(
      (w.configurations || []).some((c) => c.type === 'Grand Trine'),
      'Expected Grand Trine configuration (Moon-Jupiter-Pluto)'
    );

    const formatted = formatChartForLLM(chart, 'western');
    assert.ok(formatted.includes('"type":"Diurnal"'));
    assert.ok(formatted.includes('"mutualReceptions":'));
    assert.ok(formatted.includes('CORE'));

    results.push({
      id: 'W-CASE-01',
      label: 'Tropical Math: Sect, Cazimi, Mutual Reception, <2° Orbs, Configurations',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `${w.sect?.chartType} | MR=${w.mutualReceptions?.length} | Cfgs=${w.configurations?.map((c) => c.type).join(', ')}`,
    });
  }

  // ── Case 2: Multi-Clock Timing & 4 Western TimingProgressWidgets ──────────
  {
    const t0 = Date.now();
    const todayISO = new Date().toISOString().slice(0, 10);
    const siderealDaily = computeDeterministicSiderealPlanets(todayISO);
    const westernDaily = computeWesternDailyTransits(siderealDaily, todayISO);
    const snapshot = computeWesternTimingSnapshot({
      westernChart: chart.western!,
      birthDateISO: chart.meta.birthDate,
      birthTimeStr: chart.meta.birthTime,
      timezoneOffsetHours: -4,
      latitude: 40.7128,
      longitude: -74.006,
      transitPlanets: westernDaily,
    });
    assert.ok(snapshot.profection.profectedHouse >= 1 && snapshot.profection.profectedHouse <= 12);
    assert.ok(snapshot.progressions.moon.sign);
    assert.ok(snapshot.solarReturn.srAscendantSign);
    const satTransit = snapshot.transits.outerPlanets.find((p) => p.planet === 'Saturn');
    const jupTransit = snapshot.transits.outerPlanets.find((p) => p.planet === 'Jupiter');
    assert.ok(satTransit && satTransit.natalHouse >= 1 && satTransit.natalHouse <= 12);
    assert.ok(jupTransit && jupTransit.natalHouse >= 1 && jupTransit.natalHouse <= 12);

    const widgets = buildWesternTimingWidgets(snapshot);
    assert.equal(widgets.length, 4, 'Expected 4 Western timing widgets');
    assert.deepEqual(
      widgets.map((w) => w.id),
      ['profection', 'progressed_moon', 'w_saturn', 'w_jupiter']
    );
    for (const wd of widgets) {
      assert.ok(wd.previous.label && wd.current.label && wd.next.label);
      assert.ok(wd.current.percentElapsed >= 0 && wd.current.percentElapsed <= 100);
      assertZeroVedicLeakage(
        `${wd.title} ${wd.previous.label} ${wd.current.label} ${wd.next.label}`,
        `timing widget ${wd.id}`
      );
    }

    results.push({
      id: 'W-CASE-02',
      label: 'Multi-Clock Western Timing + 4 Progress Widgets',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `H${snapshot.profection.profectedHouse} Profection (${snapshot.profection.lordOfYearTraditional}) | ProgMoon=${snapshot.progressions.moon.sign} | 4 widgets`,
    });
  }

  // ── Case 3: WesternTruthDossierV1 Compilation ─────────────────────────────
  {
    const t0 = Date.now();
    const wd = dossier.western_dossier;
    assert.ok(wd, 'WesternTruthDossierV1 must be populated inside NatalTruthDossierV1');
    assert.equal(wd.schema_version, 'western_truth_v1');
    assert.equal(wd.sect_and_ruler.chart_type, 'Diurnal');
    assert.ok(wd.dignity_hierarchy.mutual_receptions.length >= 1);
    assert.ok(wd.tight_structural_aspects.length >= 2);
    assert.ok(wd.configurations.length >= 2);
    assert.ok(wd.domain_pre_audits.love_and_partnership.key_anchors.length >= 1);
    assertZeroVedicLeakage(JSON.stringify(wd), 'WesternTruthDossierV1');

    results.push({
      id: 'W-CASE-03',
      label: 'WesternTruthDossierV1 Compilation & Zero Vedic Leakage',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `Powerhouse=${wd.dignity_hierarchy.powerhouse_planets.length}, Strained=${wd.dignity_hierarchy.strained_planets.length}, Contradictions=${wd.unresolved_contradictions.length}`,
    });
  }

  // ── Case 4: Stage 1 Western Trap & Clarification Localization ─────────────
  {
    const t0 = Date.now();
    const dMarried = await evaluateStage1Routing({
      userPrompt: 'When will I get married?',
      hasPrimaryProfile: true,
      extraProfilesCount: 0,
      lifeContext: marriedContext,
      explicitPlaybookId: 'MAR_02',
      tradition: 'western',
    });
    assert.equal(dMarried.action, 'clarify');
    assert.ok(dMarried.clarification);
    assertZeroVedicLeakage(
      JSON.stringify(dMarried.clarification),
      'Stage 1 married trap clarification'
    );

    const dSynastry = await evaluateStage1Routing({
      userPrompt: 'Are we compatible for marriage?',
      hasPrimaryProfile: true,
      extraProfilesCount: 0,
      lifeContext: singleContext,
      explicitPlaybookId: 'MAR_21',
      tradition: 'western',
    });
    assert.equal(dSynastry.action, 'prompt_partner_chart');
    assert.ok(dSynastry.clarification?.message.includes('Western Synastry'));
    assertZeroVedicLeakage(
      JSON.stringify(dSynastry.clarification),
      'Stage 1 synastry prompt'
    );

    results.push({
      id: 'W-CASE-04',
      label: 'Stage 1 Western Trap & Synastry Localization',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `MAR_02=${dMarried.action}, MAR_21=${dSynastry.action} (0 Vedic terms)`,
    });
  }

  // ── Case 5: Stage 2 Western Context Slicer (Synastry + Timing + w_*) ──────
  {
    const t0 = Date.now();
    const todayISO = new Date().toISOString().slice(0, 10);
    const siderealDaily = computeDeterministicSiderealPlanets(todayISO);
    const westernDaily = computeWesternDailyTransits(siderealDaily, todayISO);
    const pb = getPlaybookById('MAR_21');
    const routerResult: Stage1RouterResult = {
      playbook_id: 'MAR_21',
      playbook_confidence: 0.93,
      intent: 'HARD_DECISION',
      intent_confidence: 0.92,
      detected_user_fluency: 'guided_bridge',
      is_prompt_extraction: false,
      needs_clarification: false,
      requires_synastry_partner: true,
      requests_remedy_or_guidance: false,
      complexity_intensity: 8,
      provider_used: 'rule_guard',
      latency_ms: 1,
    };
    const pkg = await compileStage2ContextPackage({
      tradition: 'western',
      routerResult,
      playbook: pb,
      chart,
      dossier,
      lifeContext: singleContext,
      dailyTransits: {
        transitDate: todayISO,
        planets: siderealDaily,
        westernPlanets: westernDaily,
      },
      extraProfiles: [{ label: 'Partner QA', chart: partnerChart }],
      userPrompt: 'How compatible are our charts and when does partnership timing peak?',
    });
    assert.equal(pkg.tradition, 'western');
    assert.ok(pkg.selectedCartridges.some((c) => c.slug.startsWith('w_')));
    assert.ok(pkg.priorityRule.slug.startsWith('w_prio_'));
    assert.ok(Array.isArray(pkg.chartSlice.partners));
    assert.ok(pkg.timingWidgets && pkg.timingWidgets.length === 4);
    assertZeroVedicLeakage(pkg.renderedPromptContext, 'Stage 2 renderedPromptContext');
    assertZeroVedicLeakage(JSON.stringify(pkg.chartSlice), 'Stage 2 chartSlice');

    results.push({
      id: 'W-CASE-05',
      label: 'Stage 2 Western Slicer (Synastry + Timing + w_* Cartridges)',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `Cartridges=${pkg.selectedCartridges.length}, Cancels=${pkg.triggeredCancellations.length}, Reduction=${pkg.metrics.reductionPct}%`,
    });
  }

  // ── Case 6: Stage 3 Path A (western_astrologer & modern_astrologer) ───────
  {
    const t0 = Date.now();
    const todayISO = new Date().toISOString().slice(0, 10);
    const siderealDaily = computeDeterministicSiderealPlanets(todayISO);
    const westernDaily = computeWesternDailyTransits(siderealDaily, todayISO);
    const pb = getPlaybookById('TIM_01');
    const routerResult: Stage1RouterResult = {
      playbook_id: 'TIM_01',
      playbook_confidence: 0.91,
      intent: 'TIMING',
      intent_confidence: 0.91,
      detected_user_fluency: 'beginner',
      is_prompt_extraction: false,
      needs_clarification: false,
      requires_synastry_partner: false,
      requests_remedy_or_guidance: false,
      complexity_intensity: 6,
      provider_used: 'rule_guard',
      latency_ms: 1,
    };
    const pkg = await compileStage2ContextPackage({
      tradition: 'western',
      routerResult,
      playbook: pb,
      chart,
      dossier,
      lifeContext: singleContext,
      dailyTransits: {
        transitDate: todayISO,
        planets: siderealDaily,
        westernPlanets: westernDaily,
      },
      userPrompt: 'What is happening in my Annual Profection and Saturn transit over the next year?',
    });

    const conv = computeDeterministicPillarConvergence(pkg, chart);
    assert.deepEqual(
      conv.pillars.map((p) => p.name),
      [
        'House & Cusp Promise',
        'Sect & Dignity',
        'Tight Aspects (<2°)',
        'Dispositor & Angles',
        'Profections & Transits',
      ]
    );

    const pathADetailed = buildVedicPathAPrompt({
      constitutionPrompt: WESTERN_CORE_COUNCIL_CONSTITUTION,
      expertDirective: 'SIGNATURE THREE-LAYER INTERPRETIVE FUNNEL: Personal / Social / Evolutionary.',
      pkg,
      chart,
      routerFluency: 'beginner',
      toneMode: 'friendly',
      responseLength: 'detailed',
      outputSlug: 'detailed',
      languageSlug: 'English',
      turnCount: 0,
    });
    assert.equal(pathADetailed.meta.tradition, 'western');
    assert.ok(pathADetailed.systemInstruction.includes('Annual Profection'));
    assert.ok(pathADetailed.systemInstruction.includes('[[TIMING_BAR:profection]]'));
    assert.ok(pathADetailed.systemInstruction.includes('SIGNATURE THREE-LAYER INTERPRETIVE FUNNEL'));
    assert.ok(pathADetailed.systemInstruction.includes('Natal Placements & Aspects'));
    assertZeroVedicLeakage(pathADetailed.systemInstruction, 'Stage 3 Path A Detailed');

    const pathAShort = buildVedicPathAPrompt({
      constitutionPrompt: WESTERN_CORE_COUNCIL_CONSTITUTION,
      pkg,
      chart,
      routerFluency: 'beginner',
      toneMode: 'friendly',
      responseLength: 'short',
      outputSlug: 'short',
      languageSlug: 'English',
      turnCount: 1,
    });
    assertZeroVedicLeakage(pathAShort.systemInstruction, 'Stage 3 Path A Short');
    assertZeroVedicLeakage(
      buildShortReplyBreakdownInstruction('practitioner', 'English', 'western'),
      'Short Reply Breakdown'
    );

    const sanitizedCheck = sanitizeVedicProse(
      "The native's T-Square shows [W_TIGHT_ORB] intensity.",
      new Set(['profection'])
    );
    assert.equal(sanitizedCheck, 'Your T-Square shows intensity.');

    results.push({
      id: 'W-CASE-06',
      label: 'Stage 3 Path A Western & Modern (Detailed + Short + Widgets)',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `Convergence=${conv.bandLabel} | Modern Funnel Preserved | 0 Vedic terms`,
    });
  }

  // ── Case 7: Stage 3 Path B Deep Audit (4 Western Isolated Lenses) ─────────
  {
    const t0 = Date.now();
    const pb = getPlaybookById('CAR_02');
    const routerResult: Stage1RouterResult = {
      playbook_id: 'CAR_02',
      playbook_confidence: 0.92,
      intent: 'HARD_DECISION',
      intent_confidence: 0.9,
      detected_user_fluency: 'practitioner',
      is_prompt_extraction: false,
      needs_clarification: false,
      requires_synastry_partner: false,
      requests_remedy_or_guidance: false,
      complexity_intensity: 8,
      provider_used: 'rule_guard',
      latency_ms: 1,
    };
    const pkg = await compileStage2ContextPackage({
      tradition: 'western',
      routerResult,
      playbook: pb,
      chart,
      dossier,
      lifeContext: singleContext,
      userPrompt: 'Should I leave my corporate job to launch an independent venture?',
    });
    const lenses = buildDeepAuditLensPrompts({
      pkg,
      userPrompt: 'Should I leave my corporate job to launch an independent venture?',
    });
    assert.equal(lenses.length, 4);
    assert.deepEqual(
      lenses.map((l) => l.id),
      [
        'sect_dignity_rulers',
        'tight_aspects_patterns',
        'western_multi_clock_timing',
        'western_contrarian_auditor',
      ]
    );
    assert.ok(lenses[0].userPrompt.includes('mutualReceptions') && !lenses[0].userPrompt.includes('tightAspects'));
    assert.ok(lenses[1].userPrompt.includes('tightAspects') && !lenses[1].userPrompt.includes('mutualReceptions'));
    assert.ok(lenses[2].userPrompt.includes('WESTERN TIMING SLICE'));
    assert.ok(lenses[3].userPrompt.includes('triggeredCancellations'));

    for (const lens of lenses) {
      assertZeroVedicLeakage(lens.systemPrompt, `Deep Audit lens ${lens.id} systemPrompt`);
      assertZeroVedicLeakage(lens.userPrompt, `Deep Audit lens ${lens.id} userPrompt`);
    }

    results.push({
      id: 'W-CASE-07',
      label: 'Stage 3 Path B Western 4-Lens Deep Audit Isolation',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: '4 Western Lenses Isolated & Zero Vedic Leakage',
    });
  }

  // ── Case 8: Stage 4 Western Seeds & Deterministic Suggestions ─────────────
  {
    const t0 = Date.now();
    const pb = getPlaybookById('CAR_01');
    const routerResult: Stage1RouterResult = {
      playbook_id: 'CAR_01',
      playbook_confidence: 0.9,
      intent: 'SOFT_HORIZON',
      intent_confidence: 0.9,
      detected_user_fluency: 'beginner',
      is_prompt_extraction: false,
      needs_clarification: false,
      requires_synastry_partner: false,
      requests_remedy_or_guidance: false,
      complexity_intensity: 8,
      provider_used: 'rule_guard',
      latency_ms: 1,
    };
    const pkg = await compileStage2ContextPackage({
      tradition: 'western',
      routerResult,
      playbook: pb,
      chart,
      dossier,
      lifeContext: singleContext,
      userPrompt: 'What is my overall career direction?',
    });
    const conv = computeDeterministicPillarConvergence(pkg, chart);
    const meta = {
      tradition: 'western' as const,
      intent: 'SOFT_HORIZON' as const,
      playbookId: pb.id,
      domain: pb.domain,
      convergencePillarsAligned: conv.alignedCount,
      convergenceBandLabel: conv.bandLabel,
      effectiveFluency: 'beginner' as const,
      isDeepAudit: false,
      cancellationsCount: pkg.triggeredCancellations.length,
    };
    const seeds = buildStage4StructuredSeeds({
      stage2Pkg: pkg,
      dossier,
      routerResult,
      vedicMeta: meta,
      assistantAnswer: 'Your 10th house Cancer Sun and Cazimi Mercury point toward thoughtful leadership.',
      userFluency: 'beginner',
    });
    assert.equal(seeds.isWestern, true);
    assert.ok(seeds.unusedContradictions.length > 0, 'Expected Western dossier seeds');
    assert.equal(seeds.needsDeepAuditEscalation, true);
    assertZeroVedicLeakage(seeds.fluencyBridgeDirective, 'Stage 4 fluencyBridgeDirective');

    // Run offline fallback check by temporarily forcing buildDeterministicFallbackSuggestions path
    const sug = await generateAlignedStage4Suggestions({
      stage2Pkg: pkg,
      dossier,
      routerResult,
      vedicMeta: meta,
      userQuestion: 'What is my overall career direction?',
      assistantAnswer: 'Your 10th house Cancer Sun and Cazimi Mercury point toward thoughtful leadership.',
      languageSlug: 'English',
      userFluency: 'beginner',
      expertSlug: 'western_astrologer',
    });
    assert.ok(sug.followups.length > 0 && sug.deeper_analysis.length > 0);
    for (const item of [...sug.followups, ...sug.deeper_analysis]) {
      assertZeroVedicLeakage(
        `${item.text} ${item.technical_directive || ''}`,
        'Stage 4 Western suggestion'
      );
    }

    results.push({
      id: 'W-CASE-08',
      label: 'Stage 4 Western Seeds, Fluency Bridge & Zero Vedic Leakage',
      passed: true,
      latencyMs: Date.now() - t0,
      summary: `Followups=${sug.followups.length}, Deeper=${sug.deeper_analysis.length}, Escalation=${seeds.needsDeepAuditEscalation}`,
    });
  }

  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.id} (${r.latencyMs}ms) | ${r.label} | ${r.summary}`);
  }
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\nSUMMARY: ${passedCount}/${results.length} Western Parity Benchmark checks passed.`);
  if (passedCount !== results.length) {
    process.exitCode = 1;
  }
}

void runWesternBenchmark();
