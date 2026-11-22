import type { LifeContextData } from '../../lib/lifeContextSchema';
import { localizePlaybookForWestern } from './canonicalPlaybooks';
import {
  enrichCompiledChart,
  formatChartForLLM,
  type CompiledChartData,
} from './chartCompiler';
import {
  hasTimingSignal,
  type ExtraProfileSliceInput,
  type SelectedCartridgeInfo,
  type Stage2CompileInput,
  type Stage2ContextPackage,
  type TriggeredCancellationItem,
  type TruthGateHouseResolution,
} from './contextSlicer';
import {
  buildWesternTimingWidgets,
  computeWesternTimingSnapshot,
  SIGNS,
  WESTERN_MODERN_RULERS,
  WESTERN_TRADITIONAL_RULERS,
  type WesternAspectItem,
  type WesternChartData,
  type WesternPlanetPosition,
} from './jyotishMath';
import { buildWesternTruthDossier, type WesternTruthDossierV1 } from './natalDossier';
import {
  getFormulaCartridgesCached,
  getPriorityRulesCached,
  type ResolvedInternalRuleRecord,
} from './promptDefaults';
import {
  resolveWesternPriorityRuleSlug,
  WESTERN_FORMULA_CARTRIDGE_META_BY_SLUG,
} from './westernFormulaSeed';

export const WESTERN_TRUTH_GATE_HIERARCHY = [
  '1. Tight Natal Aspects (<= 2.0°) & Aspect Configurations — Core structural wiring (T-Square, Grand Trine, Yod, Stellium)',
  '2. Essential/Accidental Dignity + Mutual Reception + Sect Polarity — Day/Night Benefic & Malefic calibration',
  '3. Placidus House Cusp Rulers, Chart Ruler & Angles (AC/MC/DC/IC) — Concrete life-house authority',
  '4. Multi-Clock Timing Gate — Annual Profection Lord, Progressed Moon/Sun, Solar Return & Outer Transits (<= 2.5°)',
  '5. Generic Sun-Sign Traits — Broad baseline only (lowest override authority)',
] as const;

function stripWesternCodePrefix(displayName: string): string {
  return displayName
    .replace(/^(?:W|W_PRIO|F|PRIO)_[A-Z0-9_]+\s*[—–-]\s*/i, '')
    .trim();
}

function circularDegDist(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function formatWesternLifeContextAnchor(
  lifeContext: LifeContextData | null | undefined,
  dossier: WesternTruthDossierV1,
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
  if (dossier.sect_and_ruler.angle_cusp_minute_sensitive) {
    lines.push(
      `Angle boundary note: Ascendant is at ${dossier.sect_and_ruler.ascendant_sign} ${dossier.sect_and_ruler.ascendant_dms} (near a sign cusp); minor birth-time differences can shift Ascendant, Midheaven, and Placidus house cusps.`
    );
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
  if (typeof ctx.has_children === 'boolean') {
    if (Array.isArray(ctx.children) && ctx.children.length > 0) {
      lines.push(
        `Children: ${ctx.children.length} (${ctx.children
          .map((c) => `${c.gender} b.${c.birth_year}`)
          .join(', ')})`
      );
    } else {
      lines.push(`Has children: ${ctx.has_children ? 'Yes' : 'No'}`);
    }
  }
  if (ctx.career_mode) {
    lines.push(
      `Career setup: ${ctx.career_mode.replace(/_/g, ' ')}${
        ctx.career_role ? ` (${ctx.career_role})` : ''
      }`
    );
  }
  if (ctx.location_status) {
    lines.push(`Location context: ${ctx.location_status.replace(/_/g, ' ')}`);
  }
  if (Array.isArray(ctx.past_anchors) && ctx.past_anchors.length > 0) {
    lines.push(
      `Verified past anchors: ${ctx.past_anchors
        .slice(0, 6)
        .map((a) => `${a.year} ${a.tag}${a.note ? ` (${a.note})` : ''}`)
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
  if (contextTrapPromptNote) {
    lines.push(`Context adaptation: ${contextTrapPromptNote}`);
  }

  return lines.length > 0
    ? lines.join('\n')
    : 'No additional personal life-context anchors recorded yet; stay grounded in neutral possibilities.';
}

function summarizeWesternSynastryPartner(
  primaryWestern: WesternChartData,
  item: ExtraProfileSliceInput,
  index: number
): Record<string, unknown> {
  const enriched =
    item.chart.western?.sect && item.chart.western?.configurations
      ? item.chart
      : enrichCompiledChart(item.chart).chartJson;
  const pw = enriched.western;
  if (!pw) {
    return {
      person: item.label || enriched.meta.name || `Partner ${index + 1}`,
      note: 'Tropical chart data unavailable.',
    };
  }

  const keyNames = new Set([
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Ascendant',
    'Midheaven',
    'North Node',
  ]);
  const aspSpecs = [
    { name: 'Conjunction', angle: 0 },
    { name: 'Sextile', angle: 60 },
    { name: 'Square', angle: 90 },
    { name: 'Trine', angle: 120 },
    { name: 'Opposition', angle: 180 },
  ];

  const crossAspects: Array<{ desc: string; orb: number }> = [];
  for (const a of primaryWestern.planets) {
    if (!keyNames.has(a.name)) continue;
    for (const b of pw.planets) {
      if (!keyNames.has(b.name)) continue;
      const dist = circularDegDist(a.longitude, b.longitude);
      for (const sp of aspSpecs) {
        const orb = Math.abs(dist - sp.angle);
        if (orb <= 3.5) {
          crossAspects.push({
            desc: `Primary ${a.name} ${sp.name} Partner ${b.name} (${orb.toFixed(1)}°)`,
            orb,
          });
          break;
        }
      }
    }
  }
  crossAspects.sort((x, y) => x.orb - y.orb);

  const sun = pw.planets.find((p) => p.name === 'Sun');
  const moon = pw.planets.find((p) => p.name === 'Moon');
  const venus = pw.planets.find((p) => p.name === 'Venus');
  const mars = pw.planets.find((p) => p.name === 'Mars');

  return {
    person: item.label || enriched.meta.name || `Partner ${index + 1}`,
    sect: pw.sect?.chartType || 'Diurnal',
    bigThree: {
      Asc: `${pw.angles.ascendant.sign} ${pw.angles.ascendant.dms}`,
      Sun: sun ? `${sun.sign.slice(0, 3)} ${sun.dms} (H${sun.house})` : '—',
      Moon: moon ? `${moon.sign.slice(0, 3)} ${moon.dms} (H${moon.house})` : '—',
    },
    venusMars: [
      ...(venus ? [`Venus:${venus.sign.slice(0, 3)}(H${venus.house},${venus.dignity})`] : []),
      ...(mars ? [`Mars:${mars.sign.slice(0, 3)}(H${mars.house},${mars.dignity})`] : []),
    ],
    tightCrossAspects: crossAspects.slice(0, 10).map((c) => c.desc),
  };
}

export async function compileWesternStage2ContextPackage(
  input: Stage2CompileInput
): Promise<Stage2ContextPackage> {
  const enriched: CompiledChartData =
    !input.chart.western ||
    !input.chart.western.sect ||
    !input.chart.western.configurations ||
    !input.chart.western.mutualReceptions ||
    !input.chart.western.dispositorTree
      ? enrichCompiledChart(input.chart).chartJson
      : input.chart;

  const w: WesternChartData = enriched.western!;
  const westernDossier: WesternTruthDossierV1 =
    input.dossier?.western_dossier || buildWesternTruthDossier(enriched, input.lifeContext);

  const effectiveRequiresTimingStack =
    Boolean(input.playbook.requiresTimingStack) ||
    hasTimingSignal(input.userPrompt, input.routerResult.intent);

  // 1. Focus Houses (1..12 Placidus)
  const focusHouseSet = new Set<number>(input.playbook.requiredHouses || [1, 7, 10]);
  focusHouseSet.add(1);
  if (input.playbook.domain === 'marriage' || input.playbook.domain === 'synastry') {
    focusHouseSet.add(7);
    focusHouseSet.add(5);
  } else if (input.playbook.domain === 'career') {
    focusHouseSet.add(10);
    focusHouseSet.add(6);
  } else if (input.playbook.domain === 'wealth') {
    focusHouseSet.add(2);
    focusHouseSet.add(8);
    focusHouseSet.add(11);
  } else if (input.playbook.domain === 'foreign') {
    focusHouseSet.add(9);
    focusHouseSet.add(12);
    focusHouseSet.add(4);
  } else if (input.playbook.domain === 'health' || input.playbook.domain === 'mental') {
    focusHouseSet.add(6);
    focusHouseSet.add(12);
  }
  const focusHouses = Array.from(focusHouseSet).sort((a, b) => a - b).slice(0, 7);

  // 2. Focus Planets & Angles
  const focusPlanetSet = new Set<string>([
    'Sun',
    'Moon',
    'Ascendant',
    'Midheaven',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
  ]);
  if (w.chartRuler?.traditional) focusPlanetSet.add(w.chartRuler.traditional);
  if (w.chartRuler?.modern) focusPlanetSet.add(w.chartRuler.modern);

  for (const h of focusHouses) {
    const cusp = w.cusps.find((c) => c.house === h);
    const sIdx = cusp?.signIndex ?? (Math.floor(w.angles.ascendant.longitude / 30) + h - 1) % 12;
    focusPlanetSet.add(WESTERN_TRADITIONAL_RULERS[sIdx]);
    focusPlanetSet.add(WESTERN_MODERN_RULERS[sIdx]);
    for (const pl of w.planets) {
      if (pl.house === h) focusPlanetSet.add(pl.name);
    }
  }
  for (const rk of input.playbook.requiredKarakas || []) {
    if (rk === 'AK') focusPlanetSet.add('Sun');
    else if (rk === 'AmK') {
      focusPlanetSet.add('Mercury');
      focusPlanetSet.add('Saturn');
    } else if (rk === 'DK') focusPlanetSet.add('Venus');
    else if (rk === 'PK') focusPlanetSet.add('Jupiter');
    else if (rk === 'GK') focusPlanetSet.add('Mars');
    else if (rk === 'MK') focusPlanetSet.add('Moon');
  }

  // 3. Multi-Clock Timing Snapshot (Profections, Secondary Progressions, Solar Return, Outer Transits)
  const timingSnapshot = effectiveRequiresTimingStack
    ? computeWesternTimingSnapshot({
        westernChart: w,
        birthDateISO: enriched.meta.birthDate,
        birthTimeStr: enriched.meta.birthTime,
        timezoneOffsetHours: enriched.meta.location.timezoneOffset,
        latitude: enriched.meta.location.latitude,
        longitude: enriched.meta.location.longitude,
        transitPlanets: input.dailyTransits?.westernPlanets || null,
      })
    : null;

  if (timingSnapshot) {
    focusPlanetSet.add(timingSnapshot.profection.lordOfYearTraditional);
    focusPlanetSet.add(timingSnapshot.profection.lordOfYearModern);
  }

  // 4. Scoped Tropical Cusps & Planets
  const cuspsSlice = focusHouses.map((h) => {
    const c = w.cusps.find((x) => x.house === h);
    const sIdx = c?.signIndex ?? 0;
    const tradRuler = WESTERN_TRADITIONAL_RULERS[sIdx];
    const modRuler = WESTERN_MODERN_RULERS[sIdx];
    const occ = w.planets
      .filter((p) => !['Ascendant', 'Midheaven'].includes(p.name) && p.house === h)
      .map((p) => p.name);
    return {
      h,
      sign: c ? `${c.sign} ${c.dms}` : SIGNS[sIdx],
      tradRuler,
      ...(modRuler !== tradRuler ? { modRuler } : {}),
      ...(occ.length > 0 ? { occupants: occ } : {}),
      verdict: westernDossier.house_promises[String(h)]?.verdict || 'mixed',
    };
  });

  const planetsSlice = w.planets
    .filter((p) => focusPlanetSet.has(p.name))
    .map((p: WesternPlanetPosition) => ({
      b: p.name,
      pos: `${p.sign} ${p.dms}`,
      h: p.house,
      wsH: p.wholeSignHouse,
      hc: p.houseClass,
      dig: p.dignity,
      ess: p.essentialScore ?? 0,
      ...(p.sectAlignment && p.sectAlignment !== 'Neutral' ? { sect: p.sectAlignment } : {}),
      ...(p.solarCondition && p.solarCondition !== 'Free' ? { solar: p.solarCondition } : {}),
      ...(p.isRetrograde ? { rx: true } : {}),
    }));

  // 5. Tight Core Aspects (<= 2.0°) + Active Aspects touching focus planets
  const coreAspects = w.aspects.filter((a) => a.orb <= 2.0);
  const focusActiveAspects = w.aspects.filter(
    (a) =>
      a.orb > 2.0 &&
      a.orb <= 5.0 &&
      (focusPlanetSet.has(a.bodyA) || focusPlanetSet.has(a.bodyB))
  );
  const combinedAspects: WesternAspectItem[] = [...coreAspects, ...focusActiveAspects].slice(0, 18);

  // 6. Cancellations, Sect & Calibration Checks
  const triggeredCancellations: TriggeredCancellationItem[] = [];
  const triggerSignals = new Set<string>();

  if (coreAspects.length > 0) {
    triggerSignals.add('tight_core_aspects');
  }

  if ((w.mutualReceptions || []).length > 0) {
    triggerSignals.add('mutual_reception');
    for (const mr of (w.mutualReceptions || []).slice(0, 2)) {
      triggeredCancellations.push({
        code: 'MUTUAL_RECEPTION_RESCUE',
        title: `Mutual Reception (${mr.planetA} ↔ ${mr.planetB}, ${mr.type})`,
        detail: mr.summary,
        severity: 'info',
      });
    }
  }

  for (const pl of w.planets) {
    if (!focusPlanetSet.has(pl.name)) continue;
    if (pl.dignity === 'Detriment' || pl.dignity === 'Fall') {
      triggerSignals.add('detriment_or_fall');
      const mrHit = (w.mutualReceptions || []).some(
        (mr) => mr.planetA === pl.name || mr.planetB === pl.name
      );
      triggeredCancellations.push({
        code: 'ESSENTIAL_DIGNITY_CHECK',
        title: `${pl.name} in ${pl.dignity} (${pl.sign} H${pl.house})${mrHit ? ' — Rescued' : ''}`,
        detail: mrHit
          ? `${pl.name} is in ${pl.dignity} but shares Mutual Reception — cooperative bridge turns unconventional wiring into skill.`
          : `${pl.name} operates outside its home sign (${pl.dignity}, score ${pl.essentialScore ?? -4}) — examine Sect (${pl.sectAlignment}) and Angularity (${pl.houseClass}).`,
        severity: mrHit ? 'info' : 'moderate',
      });
    }
    if (pl.solarCondition === 'Cazimi' || pl.solarCondition === 'Combust') {
      triggerSignals.add('cazimi_or_combust');
      triggeredCancellations.push({
        code: `SOLAR_${pl.solarCondition.toUpperCase()}`,
        title: `${pl.name} ${pl.solarCondition} in ${pl.sign}`,
        detail:
          pl.solarCondition === 'Cazimi'
            ? `${pl.name} sits within 0.28° of the Sun (Cazimi) — sharpened clarity and focused potency.`
            : `${pl.name} sits within 8.5° of the Sun (Combust) — internalized intensity that matures with self-awareness.`,
        severity: pl.solarCondition === 'Cazimi' ? 'info' : 'moderate',
      });
    }
  }

  const sect = w.sect;
  if (sect) {
    const contraryMal = w.planets.find((p) => p.name === sect.maleficContrary);
    if (contraryMal && (focusHouseSet.has(contraryMal.house) || contraryMal.houseClass === 'Angular')) {
      triggeredCancellations.push({
        code: 'CONTRARY_TO_SECT_MALEFIC',
        title: `${sect.maleficContrary} Contrary to Sect in H${contraryMal.house}`,
        detail: `In this ${sect.chartType} chart, ${sect.maleficContrary} operates contrary to sect in H${contraryMal.house} (${contraryMal.sign}), asking for deliberate patience and boundaries around ${contraryMal.house === 7 ? 'partnership' : contraryMal.house === 10 ? 'vocation' : `H${contraryMal.house}`}.`,
        severity: 'moderate',
      });
    }
  }

  for (const cfg of w.configurations || []) {
    if (cfg.type === 'T-Square') triggerSignals.add('t_square');
    else if (cfg.type === 'Grand Trine') triggerSignals.add('grand_trine');
    else if (cfg.type === 'Yod' || cfg.type === 'Grand Cross') triggerSignals.add('yod_or_grand_cross');
    else if (cfg.type === 'Stellium') triggerSignals.add('stellium');

    triggeredCancellations.push({
      code: cfg.type.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      title: `${cfg.type}: ${cfg.planets.join(' / ')}`,
      detail: cfg.summary,
      severity: cfg.type === 'Grand Trine' || cfg.type === 'Stellium' ? 'info' : 'moderate',
    });
  }

  if (westernDossier.sect_and_ruler.angle_cusp_minute_sensitive) {
    triggeredCancellations.push({
      code: 'ANGLE_BOUNDARY_SENSITIVITY',
      title: 'Minute-Sensitive Angle / House Cusp Guard',
      detail: `Ascendant sits at ${westernDossier.sect_and_ruler.ascendant_sign} ${westernDossier.sect_and_ruler.ascendant_dms}; verify exact birth time before resting big claims solely on late-degree house cusps.`,
      severity: 'moderate',
    });
  }

  if (timingSnapshot) {
    triggerSignals.add('profection_lord_focus');
    if (timingSnapshot.progressions.tightAspectsToNatal.length > 0) {
      triggerSignals.add('progressed_tight_hit');
    }
    if (timingSnapshot.transits.tightHitsToNatal.length > 0) {
      triggerSignals.add('outer_transit_hit');
    }
  }

  // 7. 5-Tier Truth Gate House Resolution (Western)
  const truthGateResolution: TruthGateHouseResolution[] = focusHouses.slice(0, 6).map((h) => {
    const hp = westernDossier.house_promises[String(h)];
    const cuspSign = hp?.cusp_sign || SIGNS[h - 1];
    const ruler = hp?.traditional_ruler || 'Sun';
    const rulerObj = w.planets.find((p) => p.name === ruler);
    const tightCount = combinedAspects.filter(
      (a) =>
        a.orb <= 2.0 &&
        (a.bodyA === ruler ||
          a.bodyB === ruler ||
          (hp?.occupants || []).includes(a.bodyA) ||
          (hp?.occupants || []).includes(a.bodyB))
    ).length;

    return {
      house: h,
      sign: cuspSign,
      kpVerdict: hp?.verdict || 'mixed',
      sav: tightCount,
      houseScore: hp?.score ?? 60,
      summary: `H${h} (${cuspSign}): Verdict=${hp?.verdict || 'mixed'} | Ruler ${ruler}${
        rulerObj ? ` in ${rulerObj.sign} H${rulerObj.house} (${rulerObj.dignity}, ${rulerObj.sectAlignment || 'Neutral'})` : ''
      } | Core <=2° Aspects=${tightCount}`,
    };
  });

  // 8. Admin-Editable Western Priority Rule + Cartridge Selection (4–8 Max)
  const [priorityRulesMap, cartridgesMap] = await Promise.all([
    getPriorityRulesCached(),
    getFormulaCartridgesCached(),
  ]);

  const prioSlug = resolveWesternPriorityRuleSlug(
    input.playbook.priorityDomain,
    input.playbook.id,
    input.playbook.requiresSynastry
  );
  const prioRecord: ResolvedInternalRuleRecord | undefined =
    priorityRulesMap[prioSlug] || priorityRulesMap.w_prio_overview;

  const isRelFrictionReordered =
    (input.playbook.domain === 'marriage' || input.playbook.domain === 'relationships') &&
    westernDossier.domain_pre_audits.love_and_partnership.friction_weights_0_100 >= 45;

  const priorityBody =
    prioRecord && prioRecord.is_active
      ? isRelFrictionReordered
        ? `CONDITIONAL PRIORITY REORDER TRIGGERED: Hard Saturn/Pluto/Chiron friction or Contrary-to-Sect tension hits relational markers — calibrate structural patterns and emotional boundaries #1 BEFORE giving timing windows.\n${prioRecord.prompt_body}`
        : prioRecord.prompt_body
      : 'Prioritize Tropical natal dignity, Sect polarity, tight <=2° aspects, Placidus cusp rulers, and Multi-Clock timing proportionally.';

  const candidateScores = new Map<string, { score: number; reason: string }>();
  candidateScores.set('w_sect_polarity', {
    score: 185,
    reason: 'Day/Night Sect baseline calibration',
  });

  const pbDomain = input.playbook.domain;
  const isDomainCompatible = (domains: string[]): boolean => {
    if (domains.includes('universal') || domains.includes(pbDomain)) return true;
    if (pbDomain === 'synastry' && (domains.includes('marriage') || domains.includes('relationships'))) {
      return true;
    }
    if (pbDomain === 'marriage' && domains.includes('relationships')) return true;
    if (pbDomain === 'open' && domains.includes('timing')) return true;
    return false;
  };

  // Domain primary cartridges
  const domainPrimaryMap: Record<string, string[]> = {
    marriage: ['w_love_venus_mars_7h'],
    relationships: ['w_love_venus_mars_7h'],
    synastry: ['w_synastry_aspects', 'w_love_venus_mars_7h'],
    career: ['w_career_mc_10h_saturn'],
    wealth: ['w_wealth_2h_8h_resources'],
    property: ['w_wealth_2h_8h_resources'],
    foreign: ['w_relocation_9h_12h_4h'],
    education: ['w_relocation_9h_12h_4h'],
    spirituality: ['w_relocation_9h_12h_4h'],
    health: ['w_mind_health_moon_1h'],
    mental: ['w_mind_health_moon_1h'],
    remedies: ['w_mind_health_moon_1h'],
  };
  for (const slug of domainPrimaryMap[pbDomain] || []) {
    candidateScores.set(slug, { score: 220, reason: `Primary Western domain lens (${pbDomain})` });
  }
  if (input.playbook.requiresSynastry) {
    candidateScores.set('w_synastry_aspects', {
      score: 230,
      reason: 'Two-chart Synastry comparison',
    });
  }

  for (const [slug, meta] of Object.entries(WESTERN_FORMULA_CARTRIDGE_META_BY_SLUG)) {
    if (!isDomainCompatible(meta.domains)) continue;
    const matched = (meta.triggerFlags || []).filter((f) => triggerSignals.has(f));
    if (matched.length > 0) {
      const existing = candidateScores.get(slug);
      const bonus = 155 + matched.length * 15 + meta.basePriority * 0.2;
      if (!existing || bonus > existing.score) {
        candidateScores.set(slug, {
          score: existing ? existing.score + 35 : bonus,
          reason: `Triggered by Tropical chart check (${matched.join(', ')})`,
        });
      }
    } else if (
      effectiveRequiresTimingStack &&
      ['w_annual_profections', 'w_secondary_progressions', 'w_solar_return_year', 'w_outer_planet_transits'].includes(slug)
    ) {
      if (!candidateScores.has(slug)) {
        candidateScores.set(slug, {
          score: slug === 'w_annual_profections' || slug === 'w_outer_planet_transits' ? 165 : 148,
          reason: 'Multi-clock Western timing consultation',
        });
      }
    }
  }

  const fallbackOrder = [
    'w_tight_orb_priority',
    'w_dignity_and_angles',
    'w_annual_profections',
    'w_outer_planet_transits',
  ];
  for (const slug of fallbackOrder) {
    if (candidateScores.size >= 4) break;
    if (!candidateScores.has(slug) && cartridgesMap[slug]?.is_active) {
      candidateScores.set(slug, { score: 85, reason: 'Core Western verification guardrail' });
    }
  }

  const selectedCartridges: SelectedCartridgeInfo[] = Array.from(candidateScores.entries())
    .map(([slug, info]) => ({ slug, info, record: cartridgesMap[slug] }))
    .filter(
      (e): e is { slug: string; info: { score: number; reason: string }; record: ResolvedInternalRuleRecord } =>
        Boolean(e.record && e.record.is_active)
    )
    .sort((a, b) => b.info.score - a.info.score)
    .slice(0, 8)
    .map(({ slug, info, record }) => ({
      slug,
      canonicalKey: WESTERN_FORMULA_CARTRIDGE_META_BY_SLUG[slug]?.canonicalKey || slug.toUpperCase(),
      title: stripWesternCodePrefix(record.display_name),
      body: record.prompt_body,
      triggerReason: info.reason,
    }));

  // 9. Synastry Partner Slices
  const synastrySlices =
    Array.isArray(input.extraProfiles) && input.extraProfiles.length > 0
      ? input.extraProfiles.slice(0, 3).map((ep, idx) => summarizeWesternSynastryPartner(w, ep, idx))
      : undefined;

  // 10. Domain Pre-Audit Slice
  const domainAudit =
    pbDomain === 'marriage' || pbDomain === 'synastry' || pbDomain === 'relationships'
      ? westernDossier.domain_pre_audits.love_and_partnership
      : pbDomain === 'career'
      ? westernDossier.domain_pre_audits.vocation_and_authority
      : pbDomain === 'wealth'
      ? westernDossier.domain_pre_audits.resources_and_worth
      : pbDomain === 'foreign'
      ? westernDossier.domain_pre_audits.growth_and_relocation
      : pbDomain === 'health' || pbDomain === 'mental'
      ? westernDossier.domain_pre_audits.mind_and_vitality
      : undefined;

  const chartSlice: Record<string, unknown> = {
    system: 'Western Tropical (Placidus)',
    profile: {
      name: enriched.meta.name,
      sect: w.sect?.chartType || 'Diurnal',
      beneficOfSect: w.sect?.beneficOfSect,
      maleficOfSect: w.sect?.maleficOfSect,
      angles: {
        Asc: `${w.angles.ascendant.sign} ${w.angles.ascendant.dms}`,
        MC: `${w.angles.midheaven.sign} ${w.angles.midheaven.dms}`,
        Desc: `${w.angles.descendant.sign} ${w.angles.descendant.dms}`,
        IC: `${w.angles.ic.sign} ${w.angles.ic.dms}`,
      },
      chartRuler: w.chartRuler
        ? `${w.chartRuler.traditional} (Trad, H${w.chartRuler.traditionalHouse}, ${w.chartRuler.traditionalDignity}) / ${w.chartRuler.modern} (Mod, H${w.chartRuler.modernHouse})`
        : undefined,
      dominant: `${w.dominantElement} / ${w.dominantModality}`,
    },
    kernel: westernDossier.narrative_kernel,
    ...(domainAudit ? { domainAudit } : {}),
    cuspsFocus: cuspsSlice,
    planetsFocus: planetsSlice,
    tightAspects: combinedAspects.map(
      (a) => `${a.bodyA} ${a.aspect} ${a.bodyB} (${a.orb.toFixed(1)}°${a.orb <= 2.0 ? ' CORE' : ''})`
    ),
    ...(w.configurations && w.configurations.length > 0
      ? { configurations: w.configurations.map((c) => c.summary) }
      : {}),
    ...(w.mutualReceptions && w.mutualReceptions.length > 0
      ? { mutualReceptions: w.mutualReceptions.map((m) => m.summary) }
      : {}),
    ...(westernDossier.dignity_hierarchy.dispositor_backbone.summary
      ? { dispositorTree: westernDossier.dignity_hierarchy.dispositor_backbone.summary }
      : {}),
    ...(timingSnapshot
      ? {
          timing: {
            asOfDate: timingSnapshot.asOfDate,
            profection: {
              age: timingSnapshot.profection.age,
              house: timingSnapshot.profection.profectedHouse,
              sign: timingSnapshot.profection.profectedSign,
              lord: timingSnapshot.profection.lordOfYearTraditional,
              modernLord: timingSnapshot.profection.lordOfYearModern,
              lordHouse: timingSnapshot.profection.lordNatalHouse,
              dignity: timingSnapshot.profection.lordDignity,
              startDate: timingSnapshot.profection.yearStartIso,
              endDate: timingSnapshot.profection.yearEndIso,
              daysLeft: timingSnapshot.profection.daysLeft,
            },
            progressedMoon: `${timingSnapshot.progressions.moon.sign} ${timingSnapshot.progressions.moon.dms} H${timingSnapshot.progressions.moon.house} (${timingSnapshot.progressions.moon.signStartIso}..${timingSnapshot.progressions.moon.signEndIso}, ${timingSnapshot.progressions.moon.percentElapsed}% elapsed, ${timingSnapshot.progressions.moon.daysLeft}d left)`,
            progressedSun: `${timingSnapshot.progressions.sun.sign} ${timingSnapshot.progressions.sun.dms} H${timingSnapshot.progressions.sun.house}`,
            ...(timingSnapshot.progressions.tightAspectsToNatal.length > 0
              ? {
                  progressedTightAspects: timingSnapshot.progressions.tightAspectsToNatal
                    .slice(0, 6)
                    .map((a) => `${a.progressedBody} ${a.aspect} ${a.natalBody} (${a.orb}°)`),
                }
              : {}),
            solarReturn: timingSnapshot.solarReturn.summary,
            outerTransits: timingSnapshot.transits.outerPlanets.map(
              (p) => `${p.planet} ${p.sign} ${p.dms} H${p.natalHouse}${p.isRetrograde ? ' Rx' : ''}`
            ),
            ...(timingSnapshot.transits.tightHitsToNatal.length > 0
              ? {
                  tightTransitHits: timingSnapshot.transits.tightHitsToNatal
                    .slice(0, 8)
                    .map((h) => `${h.transitPlanet} ${h.aspect} ${h.natalBody} (${h.orb}°)`),
                }
              : {}),
          },
        }
      : {}),
    ...(synastrySlices ? { partners: synastrySlices } : {}),
  };

  const chartSliceJsonStr = JSON.stringify(chartSlice);
  const v1FullWesternBaseline = JSON.stringify({
    western: enriched.western,
    westernDossier,
    ...(synastrySlices ? { partners: input.extraProfiles?.map((p) => p.chart.western) } : {}),
    ...(timingSnapshot
      ? { fullTiming: timingSnapshot, dailyTransits: input.dailyTransits?.westernPlanets || [] }
      : {}),
  }).length;
  const v1FullChartChars = Math.max(
    formatChartForLLM(enriched, 'western').length,
    v1FullWesternBaseline
  );
  const slicedChars = chartSliceJsonStr.length;
  const reductionPct =
    v1FullChartChars > 0
      ? Math.max(0, Math.round(((v1FullChartChars - slicedChars) / v1FullChartChars) * 100))
      : 0;

  const lifeContextAnchorText = formatWesternLifeContextAnchor(
    input.lifeContext,
    westernDossier,
    input.contextTrapPromptNote
  );

  const cancellationBlock =
    triggeredCancellations.length > 0
      ? triggeredCancellations
          .map((c, idx) => `${idx + 1}. [${c.severity.toUpperCase()}] ${c.title}: ${c.detail}`)
          .join('\n')
      : 'No unusual dignity detriments or configuration bottlenecks triggered on this slice.';

  const truthGateBlock = [
    'WESTERN TRUTH GATE RESOLUTION ORDER (Resolve conflicts strictly in this hierarchy):',
    ...WESTERN_TRUTH_GATE_HIERARCHY,
    '',
    'HOUSE-BY-HOUSE WESTERN GATE AUDIT:',
    ...truthGateResolution.map((r) => `- ${r.summary}`),
  ].join('\n');

  const cartridgesBlock = selectedCartridges
    .map((c, idx) => `### Interpretive Principle ${idx + 1}: ${c.title}\n${c.body}`)
    .join('\n\n');

  const localizedPb = localizePlaybookForWestern(input.playbook);
  const renderedPromptContext = [
    `CONSULTATION TOPIC FOCUS: ${localizedPb.title}`,
    `RESPONSE ARCHETYPE: ${input.routerResult.intent}`,
    ...(input.playbook.customInstructions?.trim()
      ? ['', `## PLAYBOOK SPECIFIC GUIDANCE\n${input.playbook.customInstructions.trim()}`]
      : []),
    '',
    `## REAL-WORLD LIFE CONTEXT ANCHORS (Current Reality)\n${lifeContextAnchorText}`,
    '',
    `## PRIORITY ORDERING\n${priorityBody}`,
    '',
    `## STRUCTURAL DIGNITY, SECT & CONFIGURATION AUDIT\n${cancellationBlock}`,
    '',
    `## ${truthGateBlock}`,
    '',
    `## ACTIVE WESTERN INTERPRETIVE PRINCIPLES\n${cartridgesBlock}`,
    '',
    `## SCOPED TROPICAL NATAL & MULTI-CLOCK TIMING DATA\n${chartSliceJsonStr}`,
  ].join('\n');

  const timingWidgets = timingSnapshot ? buildWesternTimingWidgets(timingSnapshot) : undefined;

  return {
    tradition: 'western',
    playbookId: input.playbook.id,
    domain: input.playbook.domain,
    intent: input.routerResult.intent,
    requiresTimingStack: effectiveRequiresTimingStack,
    ...(timingWidgets && timingWidgets.length > 0 ? { timingWidgets } : {}),
    priorityRule: {
      slug: prioRecord?.slug || prioSlug,
      title: prioRecord ? stripWesternCodePrefix(prioRecord.display_name) : 'Western Priority Matrix',
      body: priorityBody,
      conditionalReordered: isRelFrictionReordered,
    },
    selectedCartridges,
    triggeredCancellations,
    truthGateHierarchy: WESTERN_TRUTH_GATE_HIERARCHY,
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
      slicedVargasCount: 0,
    },
  };
}
