/**
 * K01 Configurations, Yogas, Doshas, Jaimini, Upagrahas, Temporal & Historical Context Extractor
 *
 * Extracts:
 *  - Parashari & Jaimini Yogas -> `configuration`
 *  - Parashari & KP Doshas -> `modification`
 *  - Western Configurations, Stelliums & Hellenistic Lots -> `configuration` / `positional`
 *  - Jaimini Chara Karakas, Arudha Padas, Argala & Drishti -> `positional` / `dependency` / `relational`
 *  - Upagrahas & Aprakasha Grahas -> `positional`
 *  - Natal Dashas (`temporalScope: 'natal_invariant'`, `referenceDateIso: null`) -> `temporal`
 *  - Reference-Date Timing (`temporalScope: 'reference_date_dependent'`) -> `temporal`
 *  - Birth-time, DST/Timezone, Node convention & Natal Panchang -> `historical_contextual`
 *
 * K02 Phase 1 Completeness Audit Notes:
 *  - When run under `offline_compiled_hybrid_fallback` (when full cached AstroWay JSON is not on disk),
 *    mocked `prunedAwLayerA` contains only 4 yoga detectors and minimal stub dashas (`configuration=4`, `temporal=4`).
 *  - Fixed genuine field-mapping gaps: reads `normalizedYogas.summary.evaluatedItems` (preserving inactive/evaluated
 *    yogas cleanly without duplicate Jaimini/Parashari slug collisions), reads `contributingPlanets`/`planetName`/`graha`
 *    on Yogas & Doshas, and reads `start_date`/`end_date`/`duration_years` + `natalTimeline.mahadashas`/`dashaPeriods`
 *    plus `activeVimshottari` planet stack references.
 */

import type { CanonicalEvidenceDraft, EvidenceEntityRef } from '../types';
import {
  asObj,
  asObjArr,
  buildFrameMethodology,
  buildSourceDatasetRef,
  canonicalSubjectPlanet,
  makeDraft,
  mapEnvelopeVerification,
  numOrNull,
  strOrNull,
  type ExtractionSharedContext,
} from './helpers';
import type { PositionalExtractionResult } from './positionalExtractor';

function slugToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractPlanetRefs(rawList: unknown): EvidenceEntityRef[] {
  if (!Array.isArray(rawList)) return [];
  const refs: EvidenceEntityRef[] = [];
  const seen = new Set<string>();
  for (const item of rawList) {
    const candidate =
      typeof item === 'string'
        ? item
        : strOrNull(asObj(item)?.planet ?? asObj(item)?.planetName ?? asObj(item)?.name ?? asObj(item)?.graha);
    const p = canonicalSubjectPlanet(candidate);
    if (p && !seen.has(p)) {
      seen.add(p);
      refs.push({ type: 'planet', id: p, name: p, role: 'participating_planet' });
    }
  }
  return refs;
}

export function extractYogaHouseAndTimingEvidence(
  ctx: ExtractionSharedContext,
  pos: PositionalExtractionResult
): CanonicalEvidenceDraft[] {
  const drafts: CanonicalEvidenceDraft[] = [];
  const ext = asObj(ctx.input.natalInvariant.providerExtendedDatasets);
  const vedicEnv = ctx.input.natalInvariant.frames.vedicLahiri;
  const westEnv = ctx.input.natalInvariant.frames.westernTropical;
  const kpEnv = ctx.input.natalInvariant.frames.kpPlacidus;

  const vedicMeth = buildFrameMethodology(ctx, 'vedic_lahiri');
  const westMeth = buildFrameMethodology(ctx, 'western_tropical');
  const kpMeth = buildFrameMethodology(ctx, 'kp_placidus');
  const instantMeth = buildFrameMethodology(ctx, 'canonical_instant');

  const canonicalInstantId = pos.degreeEvidenceIdByKey.get('canonical_instant:CanonicalBirthInstant');

  // 1. Parashari & Jaimini Yogas -> `configuration`
  const ydExt = asObj(ext?.yogasAndDoshas);
  const ydManifest = ctx.manifestByKey.get('parashari_yogas_doshas');
  const ydVer = mapEnvelopeVerification(vedicEnv, ydManifest);
  const ydSource = buildSourceDatasetRef('parashari_yogas_doshas', vedicEnv, ydManifest);

  const normalizedYogasObj = asObj(ydExt?.normalizedYogas);
  const normalizedYogaEvalItems = asObjArr(asObj(normalizedYogasObj?.summary)?.evaluatedItems);
  const rawYogasParashara = asObj(ydExt?.yogasParashara);
  const synthesizedParasharaFallback: Array<Record<string, unknown>> = [];
  if (!normalizedYogasObj && rawYogasParashara) {
    for (const [k, label] of [
      ['raja', 'Raja Yoga'],
      ['dhana', 'Dhana Yoga'],
      ['dharmaKarmadhipati', 'Dharma-Karmadhipati Yoga'],
      ['gajakesari', 'Gajakesari Yoga'],
      ['adhi', 'Adhi Yoga'],
    ] as const) {
      const det = asObj(rawYogasParashara[k]);
      if (det) {
        synthesizedParasharaFallback.push({ ...det, name: label, category: k, school: 'parashara' });
      }
    }
    const panchaYogas = asObjArr(asObj(rawYogasParashara.panchaMahapurusha)?.yogas);
    for (const py of panchaYogas) {
      synthesizedParasharaFallback.push({ ...py, category: 'panchaMahapurusha', school: 'parashara' });
    }
  }

  // Prefer active items first, then full evaluatedItems (so absent yoga detectors are also preserved with is_present=false)
  const rawYogaItems = [
    ...asObjArr(vedicEnv?.data?.yogas?.items),
    ...asObjArr(normalizedYogasObj?.items),
    ...normalizedYogaEvalItems,
    ...asObjArr(rawYogasParashara?.items ?? rawYogasParashara?.yogas),
    ...synthesizedParasharaFallback,
  ];

  const seenYogaSlugs = new Set<string>();
  for (let i = 0; i < rawYogaItems.length; i++) {
    const y = rawYogaItems[i];
    const yName = strOrNull(y.name ?? y.yoga ?? y.title ?? y.yogaName);
    if (!yName) continue;
    const nameSlug = slugToken(yName);
    if (seenYogaSlugs.has(nameSlug)) continue;
    seenYogaSlugs.add(nameSlug);

    const isJaiminiSchool = strOrNull(y.school)?.toLowerCase() === 'jaimini';
    const yId = isJaiminiSchool ? `JaiminiYoga_${nameSlug}` : `Yoga_${nameSlug}`;
    const isPresent = typeof y.isPresent === 'boolean' ? y.isPresent : typeof y.present === 'boolean' ? y.present : true;
    const category = strOrNull(y.category ?? y.type) ?? (isJaiminiSchool ? 'jaimini_yoga' : 'parashari_yoga');
    const singlePlanet = strOrNull(y.planetName ?? y.graha ?? y.planet);
    const planets = extractPlanetRefs(
      y.planets ?? y.participatingPlanets ?? y.contributingPlanets ?? y.grahas ?? (singlePlanet ? [singlePlanet] : null)
    );
    const parentIds = planets
      .map((p) => pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${p.id}`))
      .filter((id): id is string => Boolean(id));

    drafts.push(
      makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'configuration',
        observationCode: isJaiminiSchool ? 'JAIMINI_YOGA_CONFIGURATION' : 'VEDIC_YOGA_CONFIGURATION',
        ruleCode: isJaiminiSchool ? 'JAIMINI_SUTRA_YOGA' : 'PARASHARI_YOGA_EVALUATION',
        qualifier: yId,
        subject: { type: 'yoga', id: yId, name: yName },
        relatedEntities: planets,
        secondaryTags: [
          ...(isJaiminiSchool ? ['jaimini'] : []),
          'yoga',
          slugToken(category),
          isPresent ? 'yoga_present' : 'yoga_absent',
        ],
        observation: {
          code: isJaiminiSchool ? 'JAIMINI_YOGA_CONFIGURATION' : 'VEDIC_YOGA_CONFIGURATION',
          label: isJaiminiSchool && !yName.toLowerCase().includes('jaimini') ? `${yName} (Jaimini)` : yName,
          summary: `${yName} (${category})${isPresent ? ' — Detected' : ' — Absent'}${
            planets.length ? ` [${planets.map((p) => p.name).join(', ')}]` : ''
          }`,
          classification: isJaiminiSchool ? 'jaimini_yoga' : 'parashari_yoga',
        },
        measurements: [
          { metric: 'is_present', value: isPresent, unit: null },
          { metric: 'category', value: category, unit: null },
          { metric: 'strength_or_grade', value: strOrNull(y.strength ?? y.grade) ?? numOrNull(y.strengthScore), unit: null },
        ],
        methodology: isJaiminiSchool
          ? buildFrameMethodology(ctx, 'vedic_lahiri', { tradition: 'jaimini' })
          : vedicMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: isJaiminiSchool ? 'JAIMINI_SUTRA_YOGA' : 'PARASHARI_YOGA_EVALUATION',
          citation:
            strOrNull(y.rule ?? y.description ?? y.reason) ??
            (isJaiminiSchool ? 'Jaimini Sutras Special Yoga Combinations' : 'Classical Parashari Yoga Formation'),
        },
        sourceDatasets: [ydSource],
        parentEvidenceIds: parentIds,
        derivedFromMetrics: isJaiminiSchool ? ['sign', 'chara_karaka'] : ['sign', 'house'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: ydVer,
        sensitivity: ctx.baseSensitivity,
      })
    );
  }

  // Jaimini Yogas fallback (when not already included in normalizedYogas)
  const jaiminiYogasObj = asObj(ydExt?.yogasJaimini) ?? asObj(asObj(ext?.jaimini)?.yogas);
  const jaiminiNamedFallback: Array<Record<string, unknown>> = [];
  if (jaiminiYogasObj && !Array.isArray(jaiminiYogasObj.items) && !Array.isArray(jaiminiYogasObj.yogas)) {
    for (const [k, label] of [
      ['raja', 'Jaimini Raja Yoga'],
      ['dhana', 'Jaimini Dhana Yoga'],
      ['daridra', 'Jaimini Daridra Yoga'],
      ['viparita', 'Jaimini Viparita Raja Yoga'],
    ] as const) {
      const det = asObj(jaiminiYogasObj[k]);
      if (det) jaiminiNamedFallback.push({ ...det, name: label, category: k });
    }
  }
  const jaiminiYogaList = [
    ...asObjArr(jaiminiYogasObj?.items ?? jaiminiYogasObj?.yogas),
    ...jaiminiNamedFallback,
  ];
  for (let i = 0; i < jaiminiYogaList.length; i++) {
    const y = jaiminiYogaList[i];
    const yName = strOrNull(y.name ?? y.yoga ?? y.title);
    if (!yName) continue;
    const nameSlug = slugToken(yName);
    if (seenYogaSlugs.has(nameSlug)) continue;
    seenYogaSlugs.add(nameSlug);
    const yId = `JaiminiYoga_${nameSlug}`;

    const isPresent = typeof y.isPresent === 'boolean' ? y.isPresent : typeof y.present === 'boolean' ? y.present : true;
    const planets = extractPlanetRefs(y.planets ?? y.contributingPlanets ?? y.grahas);
    const parentIds = planets
      .map((p) => pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${p.id}`))
      .filter((id): id is string => Boolean(id));

    drafts.push(
      makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'configuration',
        observationCode: 'JAIMINI_YOGA_CONFIGURATION',
        ruleCode: 'JAIMINI_SUTRA_YOGA',
        qualifier: yId,
        subject: { type: 'yoga', id: yId, name: yName },
        relatedEntities: planets,
        secondaryTags: ['jaimini', 'yoga', isPresent ? 'yoga_present' : 'yoga_absent'],
        observation: {
          code: 'JAIMINI_YOGA_CONFIGURATION',
          label: `${yName} (Jaimini)`,
          summary: `Jaimini Yoga: ${yName}${isPresent ? ' — Detected' : ' — Absent'}`,
          classification: 'jaimini_yoga',
        },
        measurements: [
          { metric: 'is_present', value: isPresent, unit: null },
        ],
        methodology: buildFrameMethodology(ctx, 'vedic_lahiri', { tradition: 'jaimini' }),
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'JAIMINI_SUTRA_YOGA',
          citation: strOrNull(y.description) ?? 'Jaimini Sutras Special Yoga Combinations',
        },
        sourceDatasets: [ydSource],
        parentEvidenceIds: parentIds,
        derivedFromMetrics: ['sign', 'chara_karaka'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: ydVer,
        sensitivity: ctx.baseSensitivity,
      })
    );
  }

  // 2. Parashari & KP Doshas -> `modification`
  const doshaSources: Array<{
    frame: 'vedic_lahiri' | 'kp_placidus';
    ruleCode: string;
    obj: Record<string, unknown> | null;
  }> = [
    { frame: 'vedic_lahiri', ruleCode: 'PARASHARI_DOSHA_EVALUATION', obj: asObj(ydExt?.doshasParashara) },
    { frame: 'kp_placidus', ruleCode: 'KP_DOSHA_EVALUATION', obj: asObj(ydExt?.doshasKp) },
  ];

  for (const ds of doshaSources) {
    if (!ds.obj) continue;
    const doshaItems = asObjArr(ds.obj.items ?? ds.obj.doshas);
    const entries: Array<{ name: string; raw: Record<string, unknown> }> =
      doshaItems.length > 0
        ? doshaItems
            .map((d) => ({
              name: strOrNull(d.name ?? d.dosha ?? d.title) ?? '',
              raw: d,
            }))
            .filter((x) => x.name.length > 0)
        : Object.entries(ds.obj)
            .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
            .map(([k, v]) => ({ name: k, raw: v as Record<string, unknown> }));

    for (const entry of entries) {
      const dId = `Dosha_${ds.frame}_${slugToken(entry.name)}`;
      const isPresent =
        typeof entry.raw.present === 'boolean'
          ? entry.raw.present
          : typeof entry.raw.isPresent === 'boolean'
          ? entry.raw.isPresent
          : typeof entry.raw.hasDosha === 'boolean'
          ? entry.raw.hasDosha
          : typeof entry.raw.active === 'boolean'
          ? entry.raw.active
          : null;
      const cancelled =
        typeof entry.raw.cancelled === 'boolean'
          ? entry.raw.cancelled
          : typeof entry.raw.isCancelled === 'boolean'
          ? entry.raw.isCancelled
          : null;
      const singleDoshaPlanet = strOrNull(entry.raw.planet ?? entry.raw.planetName);
      const planets = extractPlanetRefs(
        entry.raw.planets ?? entry.raw.factors ?? entry.raw.contributingPlanets ?? (singleDoshaPlanet ? [singleDoshaPlanet] : null)
      );

      drafts.push(
        makeDraft(ctx, {
          frame: ds.frame,
          family: 'modification',
          observationCode: 'DOSHA_EVALUATION',
          ruleCode: ds.ruleCode,
          qualifier: dId,
          subject: { type: 'dosha', id: dId, name: entry.name },
          relatedEntities: planets,
          secondaryTags: ['dosha', ds.frame],
          observation: {
            code: 'DOSHA_EVALUATION',
            label: `${entry.name} (${ds.frame === 'kp_placidus' ? 'KP' : 'Parashari'})`,
            summary: `${entry.name}: present=${isPresent ?? 'evaluated'}${
              cancelled !== null ? `, cancelled=${cancelled}` : ''
            }`,
            classification: 'dosha_evaluation',
          },
          measurements: [
            { metric: 'is_present', value: isPresent, unit: null },
            { metric: 'is_cancelled', value: cancelled, unit: null },
            { metric: 'severity', value: strOrNull(entry.raw.severity ?? entry.raw.intensity), unit: null },
          ],
          methodology: ds.frame === 'kp_placidus' ? kpMeth : vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: ds.ruleCode,
            citation: strOrNull(entry.raw.description ?? entry.raw.summary) ?? 'Classical Dosha Evaluation',
          },
          sourceDatasets: [ydSource],
          derivedFromMetrics: ['sign', 'house'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: ydVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 3. Western Configurations, Stelliums & Hellenistic Lots
  const westManifest = ctx.manifestByKey.get('western_tropical_natal');
  if (westEnv?.data) {
    const westVer = mapEnvelopeVerification(westEnv, westManifest);
    const westSource = buildSourceDatasetRef('western_tropical_natal', westEnv, westManifest);

    const configs = asObjArr(
      asObj(westEnv.data.configurations)?.items ?? asObj(westEnv.data.configurations)?.patterns
    );
    for (let idx = 0; idx < configs.length; idx++) {
      const cfg = configs[idx];
      const name = strOrNull(cfg.name ?? cfg.type ?? cfg.pattern) ?? `Configuration_${idx + 1}`;
      const planets = extractPlanetRefs(cfg.planets ?? cfg.bodies);
      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'configuration',
          observationCode: 'WESTERN_ASPECT_CONFIGURATION',
          ruleCode: 'WESTERN_GEOMETRIC_PATTERN',
          qualifier: `${slugToken(name)}_${idx}`,
          subject: { type: 'configuration', id: `WestCfg_${slugToken(name)}_${idx}`, name },
          relatedEntities: planets,
          secondaryTags: ['western_configuration'],
          observation: {
            code: 'WESTERN_ASPECT_CONFIGURATION',
            label: `Tropical ${name}`,
            summary: `${name}${planets.length ? ` (${planets.map((p) => p.name).join(', ')})` : ''}`,
            classification: 'western_aspect_configuration',
          },
          measurements: [{ metric: 'pattern_name', value: name, unit: null }],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'WESTERN_GEOMETRIC_PATTERN',
            citation: 'Western Tropical Aspect Configuration',
          },
          sourceDatasets: [westSource],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: westVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    const stelliums = asObjArr(
      asObj(westEnv.data.stelliums)?.items ?? asObj(westEnv.data.stelliums)?.stelliums
    );
    for (let idx = 0; idx < stelliums.length; idx++) {
      const st = stelliums[idx];
      const sign = strOrNull(st.sign);
      const house = numOrNull(st.house);
      const planets = extractPlanetRefs(st.planets ?? st.bodies);
      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'configuration',
          observationCode: 'WESTERN_STELLIUM',
          ruleCode: 'WESTERN_STELLIUM_CLUSTER',
          qualifier: `${sign ?? house ?? idx}`,
          subject: {
            type: 'configuration',
            id: `WestStellium_${sign ?? house ?? idx}`,
            name: `Stellium in ${sign ?? `H${house ?? '?'}`}`,
          },
          relatedEntities: planets,
          secondaryTags: ['stellium', 'western_tropical'],
          observation: {
            code: 'WESTERN_STELLIUM',
            label: `Tropical Stellium (${sign ?? `H${house ?? '?'}`})`,
            summary: `Stellium${sign ? ` in ${sign}` : ''}${house !== null ? ` H${house}` : ''}`,
            classification: 'western_stellium',
          },
          measurements: [
            { metric: 'sign', value: sign, unit: null },
            { metric: 'house', value: house, unit: 'house_number' },
            { metric: 'body_count', value: planets.length || numOrNull(st.count), unit: 'count' },
          ],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'WESTERN_STELLIUM_CLUSTER',
            citation: 'Western Tropical Planetary Stellium',
          },
          sourceDatasets: [westSource],
          derivedFromMetrics: ['sign', 'house'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: westVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    const hellenisticLots = asObjArr(
      asObj(asObj(ext?.westernAndHellenistic)?.brennanLots15)?.lots ??
        asObj(asObj(ext?.westernAndHellenistic)?.brennanLots15)?.items
    );
    for (let idx = 0; idx < hellenisticLots.length; idx++) {
      const lot = hellenisticLots[idx];
      const name = strOrNull(lot.name ?? lot.lot);
      if (!name) continue;
      const lotDegInSign =
        numOrNull(lot.degreeInSign ?? lot.degree) ??
        (() => {
          const absLon = numOrNull(lot.longitude ?? lot.absoluteDegree ?? lot.degree);
          return absLon !== null ? Number((absLon % 30).toFixed(4)) : null;
        })();
      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'positional',
          observationCode: 'HELLENISTIC_ARABIC_LOT',
          ruleCode: 'HELLENISTIC_BRENNAN_LOTS',
          qualifier: slugToken(name),
          subject: { type: 'special_point', id: `Lot_${slugToken(name)}`, name },
          secondaryTags: ['hellenistic', 'arabic_lot'],
          observation: {
            code: 'HELLENISTIC_ARABIC_LOT',
            label: `Hellenistic ${name}`,
            summary: `${name} at ${strOrNull(lot.sign) ?? '?'} ${
              lotDegInSign !== null ? lotDegInSign.toFixed(2) : '?'
            }°`,
            classification: 'hellenistic_lot',
          },
          measurements: [
            { metric: 'sign', value: strOrNull(lot.sign), unit: null },
            { metric: 'longitude_deg', value: numOrNull(lot.longitude ?? lot.absoluteDegree ?? lot.degree), unit: 'degrees' },
            { metric: 'house', value: numOrNull(lot.house), unit: 'house_number' },
          ],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'HELLENISTIC_BRENNAN_LOTS',
            citation: 'Hellenistic Lots (Sect-Sensitive Formula)',
          },
          sourceDatasets: [westSource],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: westVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 4. Jaimini Karakas, Arudha Padas & Argala
  const jaimini = asObj(ext?.jaimini);
  const jaiminiManifest = ctx.manifestByKey.get('jaimini_karakas_arudhas_argala');
  if (jaimini && jaiminiManifest && jaiminiManifest.canonicalStatus !== 'unavailable') {
    const jVer = mapEnvelopeVerification(null, jaiminiManifest);
    const jSource = buildSourceDatasetRef('jaimini_karakas_arudhas_argala', null, jaiminiManifest);
    const jMeth = buildFrameMethodology(ctx, 'vedic_lahiri', { tradition: 'jaimini' });

    const charaObj = asObj(jaimini.charaKarakas) ?? asObj(jaimini.karakas);
    const charaItems = Array.isArray(jaimini.charaKarakas)
      ? asObjArr(jaimini.charaKarakas)
      : Array.isArray(jaimini.karakas)
      ? asObjArr(jaimini.karakas)
      : asObjArr(charaObj?.ranking ?? charaObj?.chara ?? charaObj?.items ?? charaObj?.karakas);
    for (const row of charaItems) {
      const planet = canonicalSubjectPlanet(row.planet ?? row.grahaName ?? row.graha ?? row.name);
      const role = strOrNull(row.karaka ?? row.role ?? row.title ?? row.code);
      if (!planet || !role) continue;
      const degId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'positional',
          observationCode: 'JAIMINI_CHARA_KARAKA',
          ruleCode: 'JAIMINI_CHARA_KARAKA_RANKING',
          qualifier: slugToken(role),
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['jaimini', 'chara_karaka', slugToken(role)],
          observation: {
            code: 'JAIMINI_CHARA_KARAKA',
            label: `${planet} Jaimini ${role}`,
            summary: `${planet} holds Jaimini Chara Karaka role: ${role}`,
            classification: 'jaimini_chara_karaka',
          },
          measurements: [
            { metric: 'karaka_role', value: role, unit: null },
            { metric: 'degree_in_sign', value: numOrNull(row.degree ?? row.degreeInSign ?? row.longitudeInSign), unit: 'degrees' },
          ],
          methodology: jMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'JAIMINI_CHARA_KARAKA_RANKING',
            citation: 'Jaimini Sutras Chara Karaka (Highest Degree-in-Sign Hierarchy)',
          },
          sourceDatasets: [jSource],
          parentEvidenceIds: degId ? [degId] : [],
          derivedFromMetrics: ['degree_in_sign'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: jVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    const padasObj = asObj(jaimini.padas) ?? asObj(jaimini.arudhaPadas);
    const padasItems = Array.isArray(jaimini.padas)
      ? asObjArr(jaimini.padas)
      : Array.isArray(jaimini.arudhaPadas)
      ? asObjArr(jaimini.arudhaPadas)
      : asObjArr(padasObj?.bhavaArudhas ?? padasObj?.items ?? padasObj?.padas ?? padasObj?.arudhaPadas);
    for (const row of padasItems) {
      const padaName = strOrNull(row.name ?? row.pada ?? row.label ?? row.code);
      const sign = strOrNull(row.signName ?? row.padaSign ?? (typeof row.sign === 'string' ? row.sign : null));
      if (!padaName) continue;
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'positional',
          observationCode: 'JAIMINI_ARUDHA_PADA',
          ruleCode: 'JAIMINI_ARUDHA_PADA',
          qualifier: slugToken(padaName),
          subject: { type: 'special_point', id: `Pada_${slugToken(padaName)}`, name: padaName },
          relatedEntities: sign ? [{ type: 'sign', id: sign, name: sign, role: 'arudha_sign' }] : [],
          secondaryTags: ['jaimini', 'arudha_pada'],
          observation: {
            code: 'JAIMINI_ARUDHA_PADA',
            label: `Jaimini ${padaName}`,
            summary: `${padaName} falls in ${sign ?? 'Unknown'}`,
            classification: 'jaimini_arudha_pada',
          },
          measurements: [
            { metric: 'sign', value: sign, unit: null },
            { metric: 'house', value: numOrNull(row.house ?? row.padaHouseFromLagna), unit: 'house_number' },
          ],
          methodology: jMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'JAIMINI_ARUDHA_PADA',
            citation: 'Jaimini Arudha Lagna & House Padas',
          },
          sourceDatasets: [jSource],
          derivedFromMetrics: ['sign', 'house'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: jVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 5. Upagrahas & Aprakasha Grahas
  const upagrahas = asObj(ext?.upagrahas);
  const upaManifest = ctx.manifestByKey.get('upagrahas_aprakasha');
  if (upagrahas && upaManifest && upaManifest.canonicalStatus !== 'unavailable') {
    const uVer = mapEnvelopeVerification(null, upaManifest);
    const uSource = buildSourceDatasetRef('upagrahas_aprakasha', null, upaManifest);
    const directItems = asObjArr(upagrahas.items ?? upagrahas.upagrahas);
    const mandiObj = asObj(upagrahas.mandi);
    const items =
      directItems.length > 0
        ? directItems
        : [
            ...(mandiObj ? [{ ...mandiObj, name: strOrNull(mandiObj.name) ?? 'Mandi' }] : []),
            ...asObjArr(upagrahas.sunBased),
            ...asObjArr(upagrahas.timeBased),
          ];

    for (const u of items) {
      const name = strOrNull(u.name ?? u.upagraha);
      if (!name) continue;
      const sign = strOrNull(u.signName ?? (typeof u.sign === 'string' ? u.sign : null));
      const deg = numOrNull(u.longitude ?? u.degree ?? u.absoluteDegree);
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'positional',
          observationCode: 'VEDIC_UPAGRAHA_POSITION',
          ruleCode: 'BPHS_UPAGRAHA_APRAKASHA',
          qualifier: slugToken(name),
          subject: { type: 'special_point', id: `Upagraha_${slugToken(name)}`, name },
          relatedEntities: sign ? [{ type: 'sign', id: sign, name: sign, role: 'occupied_sign' }] : [],
          secondaryTags: ['upagraha'],
          observation: {
            code: 'VEDIC_UPAGRAHA_POSITION',
            label: `${name} (Upagraha)`,
            summary: `${name} in ${sign ?? 'Unknown'}${numOrNull(u.house) !== null ? ` (H${numOrNull(u.house)})` : ''}`,
            classification: 'upagraha_position',
          },
          measurements: [
            { metric: 'sign', value: sign, unit: null },
            { metric: 'longitude_deg', value: deg, unit: 'degrees' },
            { metric: 'house', value: numOrNull(u.house), unit: 'house_number' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_UPAGRAHA_APRAKASHA',
            citation: 'BPHS Upagraha & Aprakasha Sensitive Points',
          },
          sourceDatasets: [uSource],
          parentEvidenceIds: canonicalInstantId ? [canonicalInstantId] : [],
          derivedFromMetrics: ['sunrise', 'sunset', 'longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: uVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 6. Temporal — Natal Invariant Dashas (Vimshottari Birth Balance + Mahadashas + Alternative Dashas)
  const advDashas = asObj(ext?.advancedDashas);
  const vimObj = asObj(advDashas?.vimshottariPrana) ?? asObj(vedicEnv?.data?.vimshottariDasha);
  const vimManifest = ctx.manifestByKey.get('vimshottari_natal_timeline');
  const vimVer = mapEnvelopeVerification(vedicEnv, vimManifest);
  const vimSource = buildSourceDatasetRef('vimshottari_natal_timeline', vedicEnv, vimManifest);
  const moonDegId = pos.degreeEvidenceIdByKey.get('vedic_lahiri:Moon');

  if (vimObj) {
    const bb = asObj(vimObj.birth_balance ?? asObj(vimObj.natalTimeline)?.birth_balance ?? vimObj.initial);
    const bbLord = canonicalSubjectPlanet(bb?.lord ?? bb?.initialPlanetName ?? bb?.initialPlanet) ?? strOrNull(bb?.lord ?? bb?.initialPlanetName);
    const remYears = numOrNull(bb?.remaining_years ?? bb?.balanceYears ?? bb?.remainingYears);

    if (bbLord && remYears !== null) {
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'temporal',
          observationCode: 'VIMSHOTTARI_BIRTH_BALANCE',
          ruleCode: 'BPHS_VIMSHOTTARI_NAKSHATRA_BALANCE',
          subject: { type: 'dasha_period', id: 'Vimshottari_BirthBalance', name: 'Vimshottari Birth Balance' },
          relatedEntities: [{ type: 'planet', id: bbLord, name: bbLord, role: 'birth_mahadasha_lord' }],
          secondaryTags: ['vimshottari', 'birth_balance', 'natal_dasha_timeline'],
          observation: {
            code: 'VIMSHOTTARI_BIRTH_BALANCE',
            label: 'Vimshottari Dasha Balance at Birth',
            summary: `Birth balance: ${bbLord} Mahadasha — ${remYears.toFixed(4)} years remaining`,
            classification: 'natal_dasha_birth_balance',
          },
          measurements: [
            { metric: 'birth_lord', value: bbLord, unit: null },
            { metric: 'remaining_years', value: remYears, unit: 'years' },
            { metric: 'elapsed_years', value: numOrNull(bb?.elapsed_years ?? bb?.elapsedYears), unit: 'years' },
            { metric: 'full_duration_years', value: numOrNull(bb?.full_duration_years), unit: 'years' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_VIMSHOTTARI_NAKSHATRA_BALANCE',
            citation: 'BPHS 120-Year Vimshottari Dasha Balance from Moon Nakshatra Arc',
          },
          sourceDatasets: [vimSource],
          parentEvidenceIds: moonDegId ? [moonDegId] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: vimVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    const mahadashas = asObjArr(
      asObj(vimObj.natalTimeline)?.mahadashas ??
        vimObj.mahadashas ??
        vimObj.dashaPeriods ??
        vimObj.periods
    );
    for (let idx = 0; idx < mahadashas.length; idx++) {
      const md = mahadashas[idx];
      const lord =
        canonicalSubjectPlanet(md.lord ?? md.planet ?? md.planetName) ??
        strOrNull(md.lord ?? md.planet ?? md.planetName);
      if (!lord) continue;
      const start = strOrNull(md.start ?? md.startDate ?? md.start_date);
      const end = strOrNull(md.end ?? md.endDate ?? md.end_date);
      const durYears = numOrNull(md.duration_years ?? md.durationYears);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'temporal',
          observationCode: 'VIMSHOTTARI_NATAL_MAHADASHA',
          ruleCode: 'BPHS_VIMSHOTTARI_120YR',
          qualifier: `${idx}_${lord}`,
          subject: { type: 'dasha_period', id: `Vimshottari_MD_${idx}_${lord}`, name: `${lord} Mahadasha` },
          relatedEntities: [{ type: 'planet', id: lord, name: lord, role: 'mahadasha_lord' }],
          secondaryTags: ['vimshottari', 'mahadasha', 'natal_dasha_timeline'],
          observation: {
            code: 'VIMSHOTTARI_NATAL_MAHADASHA',
            label: `${lord} Natal Mahadasha (#${idx + 1})`,
            summary: `${lord} Mahadasha: ${start ?? '?'} to ${end ?? '?'}`,
            classification: 'natal_mahadasha_period',
          },
          measurements: [
            { metric: 'sequence_index', value: idx + 1, unit: 'index' },
            { metric: 'lord', value: lord, unit: null },
            { metric: 'start_date', value: start, unit: 'date' },
            { metric: 'end_date', value: end, unit: 'date' },
            ...(durYears !== null ? [{ metric: 'duration_years', value: durYears, unit: 'years' }] : []),
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_VIMSHOTTARI_120YR',
            citation: 'BPHS 120-Year Vimshottari Natal Mahadasha Sequence',
          },
          sourceDatasets: [vimSource],
          parentEvidenceIds: moonDegId ? [moonDegId] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: vimVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // Alternative Natal Dashas
  const altManifest = ctx.manifestByKey.get('alternative_dashas_natal');
  if (advDashas && altManifest && altManifest.canonicalStatus !== 'unavailable') {
    const altVer = mapEnvelopeVerification(null, altManifest);
    const altSource = buildSourceDatasetRef('alternative_dashas_natal', null, altManifest);

    for (const [sysKey, label] of [
      ['charaMaha', 'Chara Dasha'],
      ['yoginiMaha', 'Yogini Dasha'],
      ['ashtottariMaha', 'Ashtottari Dasha'],
      ['kalachakraMaha', 'Kalachakra Dasha'],
      ['tribhagiMaha', 'Tribhagi Dasha'],
    ] as const) {
      const sysObj = asObj(advDashas[sysKey]);
      const nt = asObj(sysObj?.natalTimeline);
      const periods = asObjArr(nt?.periods ?? sysObj?.periods ?? sysObj?.mahadashas);
      if (periods.length === 0) continue;

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'temporal',
          observationCode: 'ALTERNATIVE_DASHA_NATAL_TIMELINE',
          ruleCode: `DASHA_${sysKey.toUpperCase()}`,
          qualifier: sysKey,
          subject: { type: 'dasha_period', id: `AltDasha_${sysKey}`, name: label },
          secondaryTags: ['alternative_dasha', sysKey, 'natal_dasha_timeline'],
          observation: {
            code: 'ALTERNATIVE_DASHA_NATAL_TIMELINE',
            label: `${label} Natal Sequence`,
            summary: `${label} natal sequence (${periods.length} top-level periods)`,
            classification: 'alternative_natal_dasha',
          },
          measurements: [
            { metric: 'system', value: sysKey, unit: null },
            { metric: 'period_count', value: periods.length, unit: 'count' },
            { metric: 'max_depth', value: numOrNull(nt?.maxDepthObserved), unit: 'levels' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: `DASHA_${sysKey.toUpperCase()}`,
            citation: `${label} Natal Cycle Sequence`,
          },
          sourceDatasets: [altSource],
          parentEvidenceIds: canonicalInstantId ? [canonicalInstantId] : [],
          derivedFromMetrics: ['julian_day_ut'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: altVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 7. Temporal — Reference-Date-Dependent Timing (strictly gated on non-null referenceDateIso)
  const refTiming = ctx.input.referenceDateTiming;
  if (refTiming) {
    const refIso = strOrNull(refTiming.referenceDateIso);
    if (!refIso) {
      ctx.blockedNotices.push({
        frame: 'vedic_lahiri',
        datasetKey: 'reference_date_dasha_snapshot',
        canonicalStatus: 'unavailable',
        reason:
          'referenceDateTiming present without explicit referenceDateIso; strictly withheld from reference_date_dependent evidence to enforce temporal-scope integrity.',
      });
    } else {
      if (refTiming.activeVimshottari && Object.keys(refTiming.activeVimshottari).length > 0) {
        const refDashManifest = ctx.manifestByKey.get('reference_date_dasha_snapshot');
        const activeVim = asObj(refTiming.activeVimshottari) ?? {};
        const extractStackLord = (raw: unknown): string | null => {
          if (typeof raw === 'string') return canonicalSubjectPlanet(raw) ?? strOrNull(raw);
          const obj = asObj(raw);
          if (!obj) return null;
          const val = obj.lord ?? obj.planet ?? obj.planetName ?? obj.name;
          return canonicalSubjectPlanet(val) ?? strOrNull(val);
        };
        const mdLord = extractStackLord(activeVim.mahadasha ?? activeVim.major_dasha ?? activeVim.maha ?? activeVim.currentMaha);
        const adLord = extractStackLord(activeVim.antardasha ?? activeVim.minor_dasha ?? activeVim.antar ?? activeVim.currentAntar);
        const pdLord = extractStackLord(activeVim.pratyantardasha ?? activeVim.sub_minor_dasha ?? activeVim.pratyantar ?? activeVim.currentPratyantar);
        const sdLord = extractStackLord(activeVim.sookshma ?? activeVim.sookshmadasha ?? activeVim.currentSookshma);
        const prLord = extractStackLord(activeVim.prana ?? activeVim.pranadasha ?? activeVim.currentPrana);

        const activeEntities: EvidenceEntityRef[] = [];
        for (const [role, lord] of [
          ['active_mahadasha_lord', mdLord],
          ['active_antardasha_lord', adLord],
          ['active_pratyantardasha_lord', pdLord],
          ['active_sookshma_lord', sdLord],
          ['active_prana_lord', prLord],
        ] as const) {
          if (lord && canonicalSubjectPlanet(lord)) {
            activeEntities.push({ type: 'planet', id: lord, name: lord, role });
          }
        }
        const activeStr = JSON.stringify(refTiming.activeVimshottari).slice(0, 180);
        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'temporal',
            observationCode: 'REFERENCE_DATE_VIMSHOTTARI_ACTIVE',
            ruleCode: 'BPHS_VIMSHOTTARI_ACTIVE_STACK',
            subject: {
              type: 'dasha_period',
              id: 'ActiveVimshottari',
              name: `Active Vimshottari (${refIso})`,
            },
            relatedEntities: activeEntities,
            secondaryTags: ['vimshottari', 'reference_date_active'],
            observation: {
              code: 'REFERENCE_DATE_VIMSHOTTARI_ACTIVE',
              label: `Active Vimshottari Stack @ ${refIso}`,
              summary: [mdLord, adLord, pdLord, sdLord, prLord].filter(Boolean).join(' / ') || activeStr,
              classification: 'reference_date_active_dasha',
            },
            measurements: [
              { metric: 'reference_date_iso', value: refIso, unit: 'iso_date' },
              { metric: 'target_age_years', value: refTiming.targetAgeYears ?? null, unit: 'years' },
              ...(mdLord ? [{ metric: 'mahadasha_lord', value: mdLord, unit: null }] : []),
              ...(adLord ? [{ metric: 'antardasha_lord', value: adLord, unit: null }] : []),
              ...(pdLord ? [{ metric: 'pratyantardasha_lord', value: pdLord, unit: null }] : []),
              ...(sdLord ? [{ metric: 'sookshma_lord', value: sdLord, unit: null }] : []),
              ...(prLord ? [{ metric: 'prana_lord', value: prLord, unit: null }] : []),
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_VIMSHOTTARI_ACTIVE_STACK',
              citation: 'Active Vimshottari Dasha Hierarchy at Reference Date',
            },
            sourceDatasets: [buildSourceDatasetRef('reference_date_dasha_snapshot', null, refDashManifest)],
            temporalScope: 'reference_date_dependent',
            referenceDateIso: refIso,
            verification: mapEnvelopeVerification(null, refDashManifest),
            sensitivity: ctx.baseSensitivity,
          })
        );
      }

      if (refTiming.kpRulingPlanets && Object.keys(refTiming.kpRulingPlanets).length > 0) {
        const kpRpManifest = ctx.manifestByKey.get('kp_ruling_planets_snapshot');
        drafts.push(
          makeDraft(ctx, {
            frame: 'kp_placidus',
            family: 'temporal',
            observationCode: 'REFERENCE_DATE_KP_RULING_PLANETS',
            ruleCode: 'KP_RULING_PLANETS_MOMENT',
            subject: {
              type: 'dasha_period',
              id: 'KpRulingPlanets',
              name: `KP Ruling Planets (${refIso})`,
            },
            secondaryTags: ['kp_ruling_planets', 'reference_date_active'],
            observation: {
              code: 'REFERENCE_DATE_KP_RULING_PLANETS',
              label: `KP Ruling Planets @ ${refIso}`,
              summary: `KP Ruling Planets snapshot at ${refIso}`,
              classification: 'kp_ruling_planets_snapshot',
            },
            measurements: [{ metric: 'reference_date_iso', value: refIso, unit: 'iso_date' }],
            methodology: kpMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'KP_RULING_PLANETS_MOMENT',
              citation: 'KP Ruling Planets (Lagna/Moon Star & Sub Lords + Day Lord at Query Instant)',
            },
            sourceDatasets: [buildSourceDatasetRef('kp_ruling_planets_snapshot', kpEnv, kpRpManifest)],
            temporalScope: 'reference_date_dependent',
            referenceDateIso: refIso,
            verification: mapEnvelopeVerification(kpEnv, kpRpManifest),
            sensitivity: ctx.baseSensitivity,
          })
        );
      }

      if (refTiming.westernProfections && Object.keys(refTiming.westernProfections).length > 0) {
        const profManifest = ctx.manifestByKey.get('western_profections_snapshot');
        drafts.push(
          makeDraft(ctx, {
            frame: 'western_tropical',
            family: 'temporal',
            observationCode: 'REFERENCE_DATE_WESTERN_PROFECTION',
            ruleCode: 'HELLENISTIC_ANNUAL_PROFECTION',
            subject: {
              type: 'dasha_period',
              id: 'AnnualProfection',
              name: `Annual Profection (${refIso})`,
            },
            secondaryTags: ['annual_profection', 'reference_date_active'],
            observation: {
              code: 'REFERENCE_DATE_WESTERN_PROFECTION',
              label: `Annual Profection @ ${refIso}`,
              summary: `Annual profection for target age ${refTiming.targetAgeYears ?? '?'} at ${refIso}`,
              classification: 'annual_profection_snapshot',
            },
            measurements: [
              { metric: 'reference_date_iso', value: refIso, unit: 'iso_date' },
              { metric: 'target_age_years', value: refTiming.targetAgeYears ?? null, unit: 'years' },
            ],
            methodology: westMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'HELLENISTIC_ANNUAL_PROFECTION',
              citation: 'Hellenistic Annual Profection & Time Lord',
            },
            sourceDatasets: [buildSourceDatasetRef('western_profections_snapshot', westEnv, profManifest)],
            temporalScope: 'reference_date_dependent',
            referenceDateIso: refIso,
            verification: mapEnvelopeVerification(westEnv, profManifest),
            sensitivity: ctx.baseSensitivity,
          })
        );
      }
    }
  }

  // 8. Historical & Contextual Metadata (`historical_contextual`)
  const instant = ctx.input.canonicalBirthInstant;
  drafts.push(
    makeDraft(ctx, {
      frame: 'canonical_instant',
      family: 'historical_contextual',
      observationCode: 'BIRTH_CONTEXT_TIMEZONE_PRECISION',
      ruleCode: 'CANONICAL_TIMEZONE_PRECISION_AUDIT',
      subject: {
        type: 'chart_instant',
        id: 'BirthTimeAndTimezoneContext',
        name: 'Birth Time & Historical Timezone Context',
      },
      secondaryTags: ['birth_time_precision', 'timezone_audit'],
      observation: {
        code: 'BIRTH_CONTEXT_TIMEZONE_PRECISION',
        label: 'Birth-Time Precision & Historical Timezone Context',
        summary: `Precision=${instant.input.birthTimePrecision}, TZ=${
          instant.timezone.ianaTimezone ?? 'explicit_offset'
        } (UTC${instant.timezone.historicalUtcOffsetHours >= 0 ? '+' : ''}${
          instant.timezone.historicalUtcOffsetHours
        }, DST=${instant.timezone.isDst})`,
        classification: 'birth_context_metadata',
      },
      measurements: [
        { metric: 'birth_time_precision', value: instant.input.birthTimePrecision, unit: null },
        { metric: 'birth_time_uncertainty_minutes', value: instant.input.birthTimeUncertaintyMinutes, unit: 'minutes' },
        { metric: 'historical_utc_offset_hours', value: instant.timezone.historicalUtcOffsetHours, unit: 'hours' },
        { metric: 'is_dst', value: instant.timezone.isDst, unit: null },
        { metric: 'requested_node_convention', value: instant.input.nodeConvention, unit: null },
      ],
      methodology: instantMeth,
      ruleReference: {
        sourceType: 'astronomical',
        referenceCode: 'CANONICAL_TIMEZONE_PRECISION_AUDIT',
        citation: 'Historical IANA Timezone & Birth-Time Uncertainty Metadata',
      },
      sourceDatasets: [
        {
          datasetKey: 'canonical_birth_instant',
          providerOrModule: 'v2Engine:birthInstant',
          canonicalStatus: 'internally_verified',
          acquiredAtUtc: null,
        },
      ],
      parentEvidenceIds: canonicalInstantId ? [canonicalInstantId] : [],
      derivedFromMetrics: ['julian_day_ut', 'historical_utc_offset_hours'],
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      verification: {
        computational: 'verified_internal',
        methodological: 'classical_standard',
        empirical: 'not_validated',
        propagatedTrust: 'usable',
        statusNotes: instant.timezone.dstTransitionNote ? [instant.timezone.dstTransitionNote] : [],
      },
      sensitivity: ctx.baseSensitivity,
    })
  );

  // Natal Panchang (Vedic Lahiri)
  const panchang = asObj(vedicEnv?.data?.panchang);
  const panchangManifest = ctx.manifestByKey.get('natal_panchang');
  if (panchang && Object.keys(panchang).length > 0 && panchangManifest?.canonicalStatus !== 'unavailable') {
    const pVer = mapEnvelopeVerification(vedicEnv, panchangManifest);
    const pSource = buildSourceDatasetRef('natal_panchang', vedicEnv, panchangManifest);

    drafts.push(
      makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'historical_contextual',
        observationCode: 'NATAL_PANCHANG_CONTEXT',
        ruleCode: 'BPHS_PANCHANG_FIVE_LIMBS',
        subject: { type: 'chart_instant', id: 'NatalPanchang', name: 'Natal Panchang' },
        secondaryTags: ['panchang', 'natal_calendar'],
        observation: {
          code: 'NATAL_PANCHANG_CONTEXT',
          label: 'Natal Panchang (Vara, Tithi, Nakshatra, Yoga, Karana)',
          summary: `Vara=${strOrNull(asObj(panchang.vara)?.name ?? panchang.vara) ?? '?'}, Tithi=${
            strOrNull(asObj(panchang.tithi)?.name ?? panchang.tithi) ?? '?'
          }`,
          classification: 'natal_panchang',
        },
        measurements: [
          { metric: 'vara', value: strOrNull(asObj(panchang.vara)?.name ?? panchang.vara), unit: null },
          { metric: 'tithi', value: strOrNull(asObj(panchang.tithi)?.name ?? panchang.tithi), unit: null },
          { metric: 'nakshatra', value: strOrNull(asObj(panchang.nakshatra)?.name ?? panchang.nakshatra), unit: null },
          { metric: 'yoga', value: strOrNull(asObj(panchang.yoga)?.name ?? panchang.yoga), unit: null },
          { metric: 'karana', value: strOrNull(asObj(panchang.karana)?.name ?? panchang.karana), unit: null },
          { metric: 'sunrise', value: strOrNull(panchang.sunrise), unit: 'time' },
          { metric: 'sunset', value: strOrNull(panchang.sunset), unit: 'time' },
        ],
        methodology: vedicMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'BPHS_PANCHANG_FIVE_LIMBS',
          citation: 'Classical Panchanga (Vara, Tithi, Nakshatra, Yoga, Karana, Sunrise/Sunset)',
        },
        sourceDatasets: [pSource],
        parentEvidenceIds: canonicalInstantId ? [canonicalInstantId] : [],
        derivedFromMetrics: ['julian_day_ut'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: pVer,
        sensitivity: ctx.baseSensitivity,
      })
    );
  }

  return drafts;
}
