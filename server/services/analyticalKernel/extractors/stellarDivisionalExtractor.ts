/**
 * K01 Stellar (Nakshatra / KP Star-Sub-Sub / KP Significators) & Divisional (D1-D60) Extractor
 *
 * Strictly preserves:
 *  - Shared upstream degree-level parent links with `distinct_analytical_significance`
 *    (D1, Nakshatra, D9..D60, and KP sub-lords are distinct analytical lenses)
 *  - Provisional non-promotion for `calibrated: false` supplementary D5 Panchamsha
 */

import { getNakshatraAndSubs, SIGNS } from '../../jyotishMath';
import { buildDeterministicEvidenceId } from '../lineage';
import type { CanonicalEvidenceDraft } from '../types';
import {
  asObj,
  asObjArr,
  buildDegreeSensitivity,
  buildFrameMethodology,
  buildSourceDatasetRef,
  canonicalSubjectPlanet,
  isEnvelopeExtractable,
  makeDraft,
  mapEnvelopeVerification,
  numOrNull,
  strOrNull,
  type ExtractionSharedContext,
} from './helpers';
import type { PositionalExtractionResult } from './positionalExtractor';

export function extractStellarAndDivisionalEvidence(
  ctx: ExtractionSharedContext,
  pos: PositionalExtractionResult
): CanonicalEvidenceDraft[] {
  const drafts: CanonicalEvidenceDraft[] = [];

  const vedicEnv = ctx.input.natalInvariant.frames.vedicLahiri;
  const vedicD1Manifest = ctx.manifestByKey.get('vedic_d1_positions');
  const vedicMeth = buildFrameMethodology(ctx, 'vedic_lahiri');

  // 1. Stellar Nakshatra / Pada / Nakshatra Lord (Vedic Lahiri)
  if (isEnvelopeExtractable(vedicEnv, ctx, 'vedic_lahiri', 'vedic_d1_positions', vedicD1Manifest)) {
    const vedic = vedicEnv.data;
    const vedicVer = mapEnvelopeVerification(vedicEnv, vedicD1Manifest);
    const vedicSource = buildSourceDatasetRef('vedic_d1_positions', vedicEnv, vedicD1Manifest);

    // Lagna Nakshatra
    const ascLon = numOrNull(vedic.ascendant?.absolute_degree ?? vedic.ascendant?.longitude ?? vedic.ascendant?.degree);
    if (ascLon !== null) {
      const ascNak = getNakshatraAndSubs(ascLon);
      const ascDegId = pos.degreeEvidenceIdByKey.get('vedic_lahiri:Ascendant');
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'stellar',
          observationCode: 'VEDIC_NAKSHATRA_PADA',
          ruleCode: 'BPHS_NAKSHATRA_VIMSHOTTARI_LORDSHIP',
          subject: { type: 'ascendant', id: 'Ascendant', name: 'Ascendant (Lagna)' },
          relatedEntities: [
            { type: 'nakshatra', id: ascNak.nakshatra, name: ascNak.nakshatra, role: 'occupied_nakshatra' },
            { type: 'planet', id: ascNak.nakshatraLord, name: ascNak.nakshatraLord, role: 'nakshatra_lord' },
          ],
          secondaryTags: ['nakshatra', 'lagna'],
          observation: {
            code: 'VEDIC_NAKSHATRA_PADA',
            label: 'Ascendant Nakshatra & Pada',
            summary: `Ascendant in ${ascNak.nakshatra} Pada ${ascNak.pada} (Lord: ${ascNak.nakshatraLord})`,
            classification: 'sidereal_nakshatra',
          },
          measurements: [
            { metric: 'nakshatra', value: ascNak.nakshatra, unit: null },
            { metric: 'nakshatra_index', value: ascNak.nakshatraIndex, unit: '0_to_26' },
            { metric: 'pada', value: ascNak.pada, unit: '1_to_4' },
            { metric: 'nakshatra_lord', value: ascNak.nakshatraLord, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_NAKSHATRA_VIMSHOTTARI_LORDSHIP',
            citation: '27-Nakshatra 13°20′ Zodiac & Pada Subdivision',
          },
          sourceDatasets: [vedicSource],
          parentEvidenceIds: ascDegId ? [ascDegId] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: vedicVer,
          sensitivity: buildDegreeSensitivity(ctx, ascLon % 30),
        })
      );
    }

    // Planetary Nakshatras
    for (const p of vedic.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet ?? p.raw_name);
      if (!planet || planet === 'Ascendant') continue;
      const lon = numOrNull(p.absolute_degree ?? p.longitude ?? p.degree);
      const nakFromLon = lon !== null ? getNakshatraAndSubs(lon) : null;
      const nakName = strOrNull(p.nakshatra) ?? nakFromLon?.nakshatra ?? null;
      const pada = numOrNull(p.pada) ?? nakFromLon?.pada ?? null;
      const nakLord =
        canonicalSubjectPlanet(p.nakshatra_lord ?? p.nakshatraLord) ??
        nakFromLon?.nakshatraLord ??
        null;
      if (!nakName) continue;

      const degId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'stellar',
          observationCode: 'VEDIC_NAKSHATRA_PADA',
          ruleCode: 'BPHS_NAKSHATRA_VIMSHOTTARI_LORDSHIP',
          subject: { type: 'planet', id: planet, name: planet },
          relatedEntities: [
            { type: 'nakshatra', id: nakName, name: nakName, role: 'occupied_nakshatra' },
            ...(nakLord ? [{ type: 'planet' as const, id: nakLord, name: nakLord, role: 'nakshatra_lord' }] : []),
          ],
          secondaryTags: ['nakshatra'],
          observation: {
            code: 'VEDIC_NAKSHATRA_PADA',
            label: `${planet} Nakshatra & Pada`,
            summary: `${planet} in ${nakName}${pada ? ` Pada ${pada}` : ''} (Lord: ${nakLord ?? 'N/A'})`,
            classification: 'sidereal_nakshatra',
          },
          measurements: [
            { metric: 'nakshatra', value: nakName, unit: null },
            { metric: 'pada', value: pada, unit: '1_to_4' },
            { metric: 'nakshatra_lord', value: nakLord, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_NAKSHATRA_VIMSHOTTARI_LORDSHIP',
            citation: '27-Nakshatra 13°20′ Zodiac & Pada Subdivision',
          },
          sourceDatasets: [vedicSource],
          parentEvidenceIds: degId ? [degId] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: vedicVer,
          sensitivity: buildDegreeSensitivity(ctx, lon !== null ? lon % 30 : null),
        })
      );
    }

    // 2. Divisional Charts (D1..D60 in vedicLahiri.vargas)
    const vargas = vedic.vargas?.chartsByDivision;
    const d9Manifest = ctx.manifestByKey.get('vedic_d9_navamsa');
    const shodaManifest = ctx.manifestByKey.get('vedic_shodashavarga_16');
    const conv = ctx.input.calculationConventions;

    if (vargas) {
      for (const [divisionKey, rawChart] of Object.entries(vargas)) {
        const div = divisionKey.toUpperCase();
        const chartObj = asObj(rawChart);
        if (!chartObj) continue;

        const manifestRef = div === 'D9' ? d9Manifest : shodaManifest;
        const divVer = mapEnvelopeVerification(vedicEnv, manifestRef, {
          extraNotes:
            div === 'D4' && conv?.divisionalChartMethods.d4Method
              ? [`D4 calculation method: ${conv.divisionalChartMethods.d4Method}`]
              : [],
        });
        const divSource = buildSourceDatasetRef(
          div === 'D9' ? 'vedic_d9_navamsa' : 'vedic_shodashavarga_16',
          vedicEnv,
          manifestRef
        );

        const ascDivSign =
          strOrNull(chartObj.ascendantSign ?? asObj(chartObj.ascendant)?.sign ?? asObj(chartObj.lagna)?.sign) ??
          (() => {
            const ascIdx = numOrNull(chartObj.ascendantSignIndex);
            return ascIdx !== null && ascIdx >= 0 && ascIdx < 12 ? SIGNS[ascIdx] : null;
          })();
        const ascDivSignIdx = ascDivSign ? (SIGNS as readonly string[]).indexOf(ascDivSign) : -1;

        if (ascDivSign) {
          const ascDegId = pos.degreeEvidenceIdByKey.get('vedic_lahiri:Ascendant');
          drafts.push(
            makeDraft(ctx, {
              frame: 'vedic_lahiri',
              family: 'divisional',
              observationCode: 'VEDIC_VARGA_PLACEMENT',
              ruleCode: `BPHS_VARGA_${div}`,
              qualifier: div,
              subject: { type: 'ascendant', id: 'Ascendant', name: 'Ascendant (Lagna)' },
              relatedEntities: [
                { type: 'varga', id: div, name: div, role: 'divisional_chart' },
                { type: 'sign', id: ascDivSign, name: ascDivSign, role: 'varga_lagna_sign' },
              ],
              secondaryTags: ['divisional_lagna', `division:${div}`],
              observation: {
                code: 'VEDIC_VARGA_PLACEMENT',
                label: `${div} Lagna Sign`,
                summary: `${div} Ascendant in ${ascDivSign}`,
                classification: 'varga_lagna',
              },
              measurements: [
                { metric: 'division', value: div, unit: null },
                { metric: 'sign', value: ascDivSign, unit: null },
                { metric: 'house', value: 1, unit: 'house_number' },
              ],
              methodology: vedicMeth,
              ruleReference: {
                sourceType: 'classical',
                referenceCode: `BPHS_VARGA_${div}`,
                citation: `BPHS Shodashavarga ${div} Divisional Chart`,
              },
              sourceDatasets: [divSource],
              parentEvidenceIds: ascDegId ? [ascDegId] : [],
              derivedFromMetrics: ['longitude_deg'],
              temporalScope: 'natal_invariant',
              referenceDateIso: null,
              verification: divVer,
              sensitivity: {
                ...ctx.baseSensitivity,
                sandhiOrBoundaryRisk: ['D9', 'D10', 'D12', 'D30', 'D60'].includes(div),
              },
            })
          );
        }

        const pRows: Array<Record<string, unknown>> = Array.isArray(chartObj.planets)
          ? asObjArr(chartObj.planets)
          : Array.isArray(chartObj.placements)
          ? asObjArr(chartObj.placements)
          : Object.entries(asObj(chartObj.planetsByName) ?? asObj(chartObj.planets) ?? {}).map(
              ([k, v]): Record<string, unknown> => ({ name: k, ...(asObj(v) ?? { sign: v }) })
            );

        for (const row of pRows) {
          const planet = canonicalSubjectPlanet(row.name ?? row.planet ?? row.grahaName);
          if (!planet || planet === 'Ascendant') continue;
          const sign =
            strOrNull(row.sign ?? row.signName ?? row.rashiName) ??
            (() => {
              const sIdx = numOrNull(row.signIndex ?? row.rasiIndex);
              return sIdx !== null && sIdx >= 0 && sIdx < 12 ? SIGNS[sIdx] : null;
            })();
          if (!sign) continue;
          const sIdx = (SIGNS as readonly string[]).indexOf(sign);
          const vargaHouse =
            numOrNull(row.house) ??
            (ascDivSignIdx >= 0 && sIdx >= 0 ? ((sIdx - ascDivSignIdx + 12) % 12) + 1 : null);
          const dignity = strOrNull(row.dignity);
          const parentDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);

          drafts.push(
            makeDraft(ctx, {
              frame: 'vedic_lahiri',
              family: 'divisional',
              observationCode: 'VEDIC_VARGA_PLACEMENT',
              ruleCode: `BPHS_VARGA_${div}`,
              qualifier: div,
              subject: { type: 'planet', id: planet, name: planet },
              relatedEntities: [
                { type: 'varga', id: div, name: div, role: 'divisional_chart' },
                { type: 'sign', id: sign, name: sign, role: 'varga_sign' },
              ],
              secondaryTags: [
                `division:${div}`,
                ...(dignity ? [`dignity:${dignity.toLowerCase().replace(/\s+/g, '_')}`] : []),
              ],
              observation: {
                code: 'VEDIC_VARGA_PLACEMENT',
                label: `${planet} in ${div}`,
                summary: `${planet} in ${div} ${sign}${vargaHouse !== null ? ` (H${vargaHouse})` : ''}${
                  dignity ? ` [${dignity}]` : ''
                }`,
                classification: 'varga_placement',
              },
              measurements: [
                { metric: 'division', value: div, unit: null },
                { metric: 'sign', value: sign, unit: null },
                { metric: 'house', value: vargaHouse, unit: 'house_number' },
                ...(dignity ? [{ metric: 'dignity', value: dignity, unit: null }] : []),
              ],
              methodology: vedicMeth,
              ruleReference: {
                sourceType: 'classical',
                referenceCode: `BPHS_VARGA_${div}`,
                citation: `BPHS Shodashavarga ${div} Divisional Chart`,
              },
              sourceDatasets: [divSource],
              parentEvidenceIds: parentDegId ? [parentDegId] : [],
              derivedFromMetrics: ['longitude_deg'],
              temporalScope: 'natal_invariant',
              referenceDateIso: null,
              verification: divVer,
              sensitivity: {
                ...ctx.baseSensitivity,
                sandhiOrBoundaryRisk: ['D9', 'D10', 'D12', 'D30', 'D60'].includes(div),
              },
            })
          );
        }
      }
    }
  }

  // 2b. Supplementary Provisional D5 Panchamsha (when present & never silently promoted)
  const suppD5Candidate = asObj(
    asObj(ctx.input.natalInvariant.providerExtendedDatasets?.supplementaryIntegration)
      ?.provisionalCandidates
  )?.d5;
  const d5Manifest = ctx.manifestByKey.get('vedic_d5_panchamsha');
  if (suppD5Candidate && asObj(suppD5Candidate)) {
    const d5Obj = asObj(suppD5Candidate)!;
    const d5SyntheticEnv = {
      source: d5Manifest?.source ?? 'freeastroapi_supplementary',
      calculationMethod: 'supplementary_d5_panchamsha',
      version: ctx.versions.sourceSchemaVersion,
      conventions: { calibrated: false },
      acquiredAtUtc: d5Manifest?.acquiredAtUtc ?? null,
      inputFingerprint: ctx.chartFingerprint,
      completeness: 'partial' as const,
      verificationStatus: 'provisional' as const,
      canonicalStatus: 'provisional' as const,
      limitations: d5Manifest?.limitations ?? [],
      data: d5Obj,
    };
    const d5Ver = mapEnvelopeVerification(d5SyntheticEnv, d5Manifest, {
      forceProvisional: true,
      methodologicalOverride: 'contested_or_uncalibrated',
      extraNotes: [
        'FreeAstroAPI D5 Panchamsha flagged calibrated: false and/or differs in node/ayanamsha convention; kept provisional and never merged into primary AstroWay Vargas.',
      ],
    });
    const d5Source = buildSourceDatasetRef('vedic_d5_panchamsha', d5SyntheticEnv, d5Manifest);
    const d5Placements = asObjArr(d5Obj.placements ?? d5Obj.planets);
    for (const row of d5Placements) {
      const planet = canonicalSubjectPlanet(row.name ?? row.planet);
      const sign = strOrNull(row.sign ?? row.signName);
      if (!planet || !sign) continue;
      const parentDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'divisional',
          observationCode: 'VEDIC_VARGA_D5_PROVISIONAL',
          ruleCode: 'SUPPLEMENTARY_D5_PANCHAMSHA',
          qualifier: 'D5_PROVISIONAL',
          subject: { type: 'planet', id: planet, name: planet },
          relatedEntities: [
            { type: 'varga', id: 'D5', name: 'D5', role: 'divisional_chart' },
            { type: 'sign', id: sign, name: sign, role: 'varga_sign' },
          ],
          secondaryTags: ['division:D5', 'provisional_supplementary'],
          observation: {
            code: 'VEDIC_VARGA_D5_PROVISIONAL',
            label: `${planet} in D5 Panchamsha (Provisional)`,
            summary: `${planet} in supplementary D5 ${sign} (calibrated=false / provisional)`,
            classification: 'provisional_varga_placement',
          },
          measurements: [
            { metric: 'division', value: 'D5', unit: null },
            { metric: 'sign', value: sign, unit: null },
            { metric: 'calibrated', value: false, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'provider',
            referenceCode: 'SUPPLEMENTARY_D5_PANCHAMSHA',
            citation: 'FreeAstroAPI Supplementary D5 Panchamsha (Un-calibrated)',
          },
          sourceDatasets: [d5Source],
          parentEvidenceIds: parentDegId ? [parentDegId] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: d5Ver,
          sensitivity: {
            ...ctx.baseSensitivity,
            conventionSensitive: true,
            sandhiOrBoundaryRisk: true,
            reasons: [...ctx.baseSensitivity.reasons, 'D5 6° boundary & calibrated:false sensitivity.'],
          },
        })
      );
    }
  }

  // 3. KP Stellar Hierarchy (Cuspal Star/Sub/Sub-Sub Lords, Planet Star/Sub/Sub-Sub, KP Significators)
  const kpEnv = ctx.input.natalInvariant.frames.kpPlacidus;
  const kpManifest = ctx.manifestByKey.get('kp_placidus_cusps_sublords');
  if (isEnvelopeExtractable(kpEnv, ctx, 'kp_placidus', 'kp_placidus_cusps_sublords', kpManifest)) {
    const kp = kpEnv.data;
    const kpVer = mapEnvelopeVerification(kpEnv, kpManifest);
    const kpSource = buildSourceDatasetRef('kp_placidus_cusps_sublords', kpEnv, kpManifest);
    const kpMeth = buildFrameMethodology(ctx, 'kp_placidus', {
      ayanamshaIdentifier: kp.ayanamsha?.id ?? 'kp',
      ayanamshaDegrees: kp.ayanamsha?.valueDegrees ?? null,
    });

    // KP Cuspal Sub-Lords
    for (const c of kp.cusps ?? []) {
      const hNum = numOrNull(c.house);
      if (hNum === null) continue;
      const signLord = canonicalSubjectPlanet(c.sign_lord ?? c.signLord) ?? strOrNull(c.sign_lord);
      const starLord = canonicalSubjectPlanet(c.star_lord ?? c.starLord) ?? strOrNull(c.star_lord);
      const subLord = canonicalSubjectPlanet(c.sub_lord ?? c.subLord) ?? strOrNull(c.sub_lord);
      const subSubLord = canonicalSubjectPlanet(c.sub_sub_lord ?? c.subSubLord) ?? strOrNull(c.sub_sub_lord);
      const cuspParent = pos.kpCuspEvidenceIdByHouse.get(hNum);

      drafts.push(
        makeDraft(ctx, {
          frame: 'kp_placidus',
          family: 'stellar',
          observationCode: 'KP_CUSPAL_SUB_LORDS',
          ruleCode: 'KP_CUSPAL_FOUR_STEP_LORDSHIP',
          subject: { type: 'cusp', id: `KP_Cusp_${hNum}`, name: `KP Cusp ${hNum}` },
          relatedEntities: [
            ...(starLord ? [{ type: 'planet' as const, id: starLord, name: starLord, role: 'kp_star_lord' }] : []),
            ...(subLord ? [{ type: 'planet' as const, id: subLord, name: subLord, role: 'kp_sub_lord' }] : []),
          ],
          secondaryTags: ['kp_cuspal_sublord'],
          observation: {
            code: 'KP_CUSPAL_SUB_LORDS',
            label: `KP Cusp ${hNum} Star/Sub/Sub-Sub Lords`,
            summary: `KP Cusp ${hNum}: Sign=${signLord ?? '?'}, Star=${starLord ?? '?'}, Sub=${
              subLord ?? '?'
            }, SubSub=${subSubLord ?? '?'}`,
            classification: 'kp_cuspal_sublords',
          },
          measurements: [
            { metric: 'house', value: hNum, unit: 'house_number' },
            { metric: 'sign_lord', value: signLord, unit: null },
            { metric: 'star_lord', value: starLord, unit: null },
            { metric: 'sub_lord', value: subLord, unit: null },
            { metric: 'sub_sub_lord', value: subSubLord, unit: null },
          ],
          methodology: kpMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'KP_CUSPAL_FOUR_STEP_LORDSHIP',
            citation: 'Krishnamurti Paddhati Cuspal Sign/Star/Sub/Sub-Sub Lord',
          },
          sourceDatasets: [kpSource],
          parentEvidenceIds: cuspParent ? [cuspParent] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: kpVer,
          sensitivity: buildDegreeSensitivity(ctx, null, ['KP Sub-Lords shift rapidly with birth time.']),
        })
      );
    }

    // KP Planet Star/Sub/Sub-Sub
    for (const p of kp.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet);
      if (!planet) continue;
      const signLord = canonicalSubjectPlanet(p.sign_lord ?? p.signLord) ?? strOrNull(p.sign_lord);
      const starLord = canonicalSubjectPlanet(p.star_lord ?? p.starLord) ?? strOrNull(p.star_lord);
      const subLord = canonicalSubjectPlanet(p.sub_lord ?? p.subLord) ?? strOrNull(p.sub_lord);
      const subSubLord = canonicalSubjectPlanet(p.sub_sub_lord ?? p.subSubLord) ?? strOrNull(p.sub_sub_lord);
      const pDegParent = pos.degreeEvidenceIdByKey.get(`kp_placidus:${planet}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'kp_placidus',
          family: 'stellar',
          observationCode: 'KP_PLANET_SUB_LORDS',
          ruleCode: 'KP_PLANET_FOUR_STEP_LORDSHIP',
          subject: { type: 'planet', id: planet, name: planet },
          relatedEntities: [
            ...(starLord ? [{ type: 'planet' as const, id: starLord, name: starLord, role: 'kp_star_lord' }] : []),
            ...(subLord ? [{ type: 'planet' as const, id: subLord, name: subLord, role: 'kp_sub_lord' }] : []),
          ],
          secondaryTags: ['kp_planet_sublord'],
          observation: {
            code: 'KP_PLANET_SUB_LORDS',
            label: `${planet} KP Star/Sub/Sub-Sub Lords`,
            summary: `${planet}: Sign=${signLord ?? '?'}, Star=${starLord ?? '?'}, Sub=${
              subLord ?? '?'
            }, SubSub=${subSubLord ?? '?'}`,
            classification: 'kp_planet_sublords',
          },
          measurements: [
            { metric: 'sign_lord', value: signLord, unit: null },
            { metric: 'star_lord', value: starLord, unit: null },
            { metric: 'sub_lord', value: subLord, unit: null },
            { metric: 'sub_sub_lord', value: subSubLord, unit: null },
          ],
          methodology: kpMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'KP_PLANET_FOUR_STEP_LORDSHIP',
            citation: 'Krishnamurti Paddhati Planetary Sign/Star/Sub/Sub-Sub Lord',
          },
          sourceDatasets: [kpSource],
          parentEvidenceIds: pDegParent ? [pDegParent] : [],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: kpVer,
          sensitivity: buildDegreeSensitivity(ctx, null),
        })
      );
    }

    // KP Significators (4-level ABCD)
    const kpSigManifest = ctx.manifestByKey.get('kp_significators');
    const kpSigVer = mapEnvelopeVerification(kpEnv, kpSigManifest);
    const kpSigSource = buildSourceDatasetRef('kp_significators', kpEnv, kpSigManifest);

    for (const sig of kp.planetSignificators ?? []) {
      const planet = canonicalSubjectPlanet(sig.planet ?? sig.grahaName ?? sig.name);
      if (!planet) continue;
      const toList = (val: unknown) =>
        Array.isArray(val) ? val.map((x) => Number(x)).filter(Number.isFinite).join(',') : '';
      const l1 = toList(sig.level_1);
      const l2 = toList(sig.level_2);
      const l3 = toList(sig.level_3);
      const l4 = toList(sig.level_4);
      const pDegParent = pos.degreeEvidenceIdByKey.get(`kp_placidus:${planet}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'kp_placidus',
          family: 'stellar',
          observationCode: 'KP_FOUR_LEVEL_SIGNIFICATORS',
          ruleCode: 'KP_ABCD_SIGNIFICATORS',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['kp_signification', 'dependency'],
          observation: {
            code: 'KP_FOUR_LEVEL_SIGNIFICATORS',
            label: `${planet} KP 4-Level Significations`,
            summary: `${planet} KP Significators L1:[${l1}] L2:[${l2}] L3:[${l3}] L4:[${l4}]`,
            classification: 'kp_4_level_significators',
          },
          measurements: [
            { metric: 'level_1_houses', value: l1 || null, unit: 'house_list' },
            { metric: 'level_2_houses', value: l2 || null, unit: 'house_list' },
            { metric: 'level_3_houses', value: l3 || null, unit: 'house_list' },
            { metric: 'level_4_houses', value: l4 || null, unit: 'house_list' },
          ],
          methodology: kpMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'KP_ABCD_SIGNIFICATORS',
            citation: 'KP 4-Grade Significators (Occupant of Star / Star Occupant / Owner of Star / Owner)',
          },
          sourceDatasets: [kpSigSource],
          parentEvidenceIds: pDegParent ? [pDegParent] : [],
          derivedFromMetrics: ['kp_house', 'star_lord', 'sign_lord'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: kpSigVer,
          sensitivity: buildDegreeSensitivity(ctx, null),
        })
      );
    }
  }

  return drafts;
}
