/**
 * K01 Positional, Degree-Level & Frame Coordinate Extractor
 *
 * Strictly isolates `canonical_instant`, `vedic_lahiri`, `kp_placidus`,
 * `bhava_chalit`, `western_tropical`, and `astronomical_telemetry` frames.
 * Establishes root degree-level evidence IDs so downstream divisional, stellar,
 * and Chalit evidence can link back cleanly without false duplication collapse.
 */

import { SIGNS } from '../../jyotishMath';
import { buildDeterministicEvidenceId } from '../lineage';
import type { CanonicalEvidenceDraft, EvidenceVerificationMetadata } from '../types';
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

export interface PositionalExtractionResult {
  drafts: CanonicalEvidenceDraft[];
  /** Keyed as `<frame>:<subjectId>` e.g. `vedic_lahiri:Jupiter` -> deterministic root degree evidenceId */
  degreeEvidenceIdByKey: Map<string, string>;
  /** Keyed as `vedic_lahiri_house:<subjectId>` -> D1 Whole-Sign placement evidenceId */
  vedicPlacementEvidenceIdByPlanet: Map<string, string>;
  /** Keyed as `kp_cusp:<house>` -> KP Placidus cusp evidenceId */
  kpCuspEvidenceIdByHouse: Map<number, string>;
}

function signFromDeg(deg: number | null): string | null {
  if (deg === null) return null;
  const norm = ((deg % 360) + 360) % 360;
  return SIGNS[Math.floor(norm / 30) % 12] ?? null;
}

function degInSignFromLon(deg: number | null): number | null {
  if (deg === null) return null;
  const norm = ((deg % 360) + 360) % 360;
  return Number((norm % 30).toFixed(4));
}

export function extractPositionalAndDegreeEvidence(
  ctx: ExtractionSharedContext
): PositionalExtractionResult {
  const drafts: CanonicalEvidenceDraft[] = [];
  const degreeEvidenceIdByKey = new Map<string, string>();
  const vedicPlacementEvidenceIdByPlanet = new Map<string, string>();
  const kpCuspEvidenceIdByHouse = new Map<number, string>();

  const instant = ctx.input.canonicalBirthInstant;
  const instantEntry = ctx.manifestByKey.get('canonical_birth_instant');
  const instantVerification: EvidenceVerificationMetadata = {
    computational: 'verified_internal',
    methodological: 'classical_standard',
    empirical: 'not_validated',
    propagatedTrust: 'usable',
    statusNotes: instant.timezone.dstTransitionNote
      ? [instant.timezone.dstTransitionNote]
      : [],
  };
  const instantSourceRef = {
    datasetKey: 'canonical_birth_instant',
    providerOrModule: 'v2Engine:birthInstant',
    canonicalStatus: instantEntry?.canonicalStatus ?? 'internally_verified',
    acquiredAtUtc: null,
  };

  // 1. Canonical Birth Instant (Root astronomical epoch)
  const instantDraft = makeDraft(ctx, {
    frame: 'canonical_instant',
    family: 'degree_level',
    observationCode: 'CANONICAL_BIRTH_INSTANT',
    ruleCode: 'MEEUS_UT_SIDEREAL_BASELINE',
    subject: {
      type: 'chart_instant',
      id: 'CanonicalBirthInstant',
      name: instant.input.name,
    },
    secondaryTags: ['astronomical_epoch', 'natal_baseline'],
    observation: {
      code: 'CANONICAL_BIRTH_INSTANT',
      label: 'Canonical Birth Instant & Sidereal Time',
      summary: `${instant.utc.iso} (JD ${instant.utc.julianDayUt.toFixed(6)}), LMST ${instant.astronomy.localMeanSiderealTimeDeg.toFixed(4)}°`,
      classification: 'canonical_astronomical_epoch',
    },
    measurements: [
      { metric: 'julian_day_ut', value: instant.utc.julianDayUt, unit: 'days' },
      { metric: 'latitude', value: instant.input.latitude, unit: 'degrees' },
      { metric: 'longitude', value: instant.input.longitude, unit: 'degrees' },
      { metric: 'historical_utc_offset_hours', value: instant.timezone.historicalUtcOffsetHours, unit: 'hours' },
      { metric: 'gmst_deg', value: instant.astronomy.greenwichMeanSiderealTimeDeg, unit: 'degrees' },
      { metric: 'lmst_ramc_deg', value: instant.astronomy.localMeanSiderealTimeDeg, unit: 'degrees' },
      { metric: 'mean_obliquity_deg', value: instant.astronomy.meanObliquityDeg, unit: 'degrees' },
      { metric: 'lahiri_ayanamsha_approx_deg', value: instant.astronomy.lahiriAyanamsaApproxDeg, unit: 'degrees' },
      { metric: 'kp_ayanamsha_approx_deg', value: instant.astronomy.kpAyanamsaApproxDeg, unit: 'degrees' },
    ],
    methodology: buildFrameMethodology(ctx, 'canonical_instant'),
    ruleReference: {
      sourceType: 'astronomical',
      referenceCode: 'MEEUS_UT_SIDEREAL_BASELINE',
      citation: 'Meeus Astronomical Algorithms (UT -> JD, GMST, LMST, Obliquity, Lahiri/KP Ayanamsha baseline)',
    },
    sourceDatasets: [instantSourceRef],
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    verification: instantVerification,
    sensitivity: ctx.baseSensitivity,
  });
  drafts.push(instantDraft);
  const canonicalInstantId = buildDeterministicEvidenceId(instantDraft.naturalKeyParts).evidenceId;
  degreeEvidenceIdByKey.set('canonical_instant:CanonicalBirthInstant', canonicalInstantId);

  // 2. Frame 1: Vedic Lahiri (Whole Sign)
  const vedicEnv = ctx.input.natalInvariant.frames.vedicLahiri;
  const vedicD1Manifest = ctx.manifestByKey.get('vedic_d1_positions');
  if (isEnvelopeExtractable(vedicEnv, ctx, 'vedic_lahiri', 'vedic_d1_positions', vedicD1Manifest)) {
    const vedic = vedicEnv.data;
    const vedicVerification = mapEnvelopeVerification(vedicEnv, vedicD1Manifest);
    const vedicSource = buildSourceDatasetRef('vedic_d1_positions', vedicEnv, vedicD1Manifest);
    const vedicMethodology = buildFrameMethodology(ctx, 'vedic_lahiri', {
      ayanamshaIdentifier: vedic.ayanamsha?.id ?? vedic.ayanamshaLabel ?? 'lahiri',
      ayanamshaDegrees: vedic.ayanamsha?.valueDegrees ?? vedic.ayanamshaValueDegrees ?? null,
    });

    // Lagna / Ascendant degree-level + sign placement
    const ascObj = asObj(vedic.ascendant);
    const ascLon = numOrNull(ascObj?.absolute_degree ?? ascObj?.longitude ?? ascObj?.degree);
    const ascSign = strOrNull(ascObj?.sign) ?? signFromDeg(ascLon);
    const ascDegInSign = numOrNull(ascObj?.degreeInSign) ?? degInSignFromLon(ascLon);

    let lagnaDegreeId: string | null = null;
    if (ascLon !== null || ascSign !== null) {
      const lagnaDegDraft = makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'degree_level',
        observationCode: 'VEDIC_D1_ASCENDANT_LONGITUDE',
        ruleCode: 'BPHS_RASHI_LAGNA',
        subject: { type: 'ascendant', id: 'Ascendant', name: 'Ascendant (Lagna)' },
        secondaryTags: ['lagna', 'd1_rashi'],
        observation: {
          code: 'VEDIC_D1_ASCENDANT_LONGITUDE',
          label: 'Vedic Lahiri Ascendant Longitude',
          summary: `Ascendant at ${ascSign ?? 'Unknown'} ${
            ascDegInSign !== null ? `${ascDegInSign.toFixed(4)}°` : 'N/A'
          } (abs ${ascLon !== null ? `${ascLon.toFixed(4)}°` : 'N/A'})`,
          classification: 'sidereal_lagna_longitude',
        },
        measurements: [
          { metric: 'longitude_deg', value: ascLon, unit: 'degrees' },
          { metric: 'degree_in_sign', value: ascDegInSign, unit: 'degrees' },
          { metric: 'sign', value: ascSign, unit: null },
        ],
        methodology: vedicMethodology,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'BPHS_RASHI_LAGNA',
          citation: 'Parashari Lahiri Sidereal Lagna (D1 Rashi)',
        },
        sourceDatasets: [vedicSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['julian_day_ut', 'lmst_ramc_deg', 'latitude', 'lahiri_ayanamsha_approx_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: vedicVerification,
        sensitivity: buildDegreeSensitivity(ctx, ascDegInSign, ['Ascendant moves ~1° every 4 minutes.']),
      });
      drafts.push(lagnaDegDraft);
      lagnaDegreeId = buildDeterministicEvidenceId(lagnaDegDraft.naturalKeyParts).evidenceId;
      degreeEvidenceIdByKey.set('vedic_lahiri:Ascendant', lagnaDegreeId);

      if (ascSign) {
        const lagnaPosDraft = makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'positional',
          observationCode: 'VEDIC_D1_ASCENDANT_SIGN',
          ruleCode: 'BPHS_WHOLE_SIGN_LAGNA',
          subject: { type: 'ascendant', id: 'Ascendant', name: 'Ascendant (Lagna)' },
          relatedEntities: [{ type: 'sign', id: ascSign, name: ascSign, role: 'occupied_sign' }],
          secondaryTags: ['lagna', 'whole_sign_house_1'],
          observation: {
            code: 'VEDIC_D1_ASCENDANT_SIGN',
            label: 'Vedic D1 Lagna Sign',
            summary: `Lagna rises in ${ascSign} (House 1 anchor)`,
            classification: 'whole_sign_lagna_anchor',
          },
          measurements: [
            { metric: 'sign', value: ascSign, unit: null },
            { metric: 'house', value: 1, unit: 'house_number' },
          ],
          methodology: vedicMethodology,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_WHOLE_SIGN_LAGNA',
            citation: 'BPHS Whole Sign Rashi Lagna Anchor',
          },
          sourceDatasets: [vedicSource],
          parentEvidenceIds: [lagnaDegreeId],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: vedicVerification,
          sensitivity: buildDegreeSensitivity(ctx, ascDegInSign),
        });
        drafts.push(lagnaPosDraft);
        vedicPlacementEvidenceIdByPlanet.set(
          'Ascendant',
          buildDeterministicEvidenceId(lagnaPosDraft.naturalKeyParts).evidenceId
        );
      }
    }

    // Vedic Planets (Degree-Level + Whole Sign House/Sign Positional)
    for (const p of vedic.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet ?? p.raw_name);
      if (!planet || planet === 'Ascendant') continue;
      const lon = numOrNull(p.absolute_degree ?? p.longitude ?? p.degree);
      const sign = strOrNull(p.sign) ?? signFromDeg(lon);
      const degInSign = numOrNull(p.degree_in_sign ?? p.degreeInSign) ?? degInSignFromLon(lon);
      const house = numOrNull(p.house);
      const isNode = planet === 'Rahu' || planet === 'Ketu';

      const sensitivity = buildDegreeSensitivity(
        ctx,
        degInSign,
        isNode
          ? [`Lunar Node convention check: ${vedic.nodeType}`]
          : []
      );

      const degDraft = makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'degree_level',
        observationCode: 'VEDIC_D1_PLANET_LONGITUDE',
        ruleCode: 'BPHS_SIDEREAL_LONGITUDE',
        subject: { type: 'planet', id: planet, name: planet },
        relatedEntities: sign
          ? [{ type: 'sign', id: sign, name: sign, role: 'occupied_sign' }]
          : [],
        secondaryTags: [
          'd1_rashi',
          ...(sensitivity.sandhiOrBoundaryRisk ? ['sandhi_sensitivity'] : []),
        ],
        observation: {
          code: 'VEDIC_D1_PLANET_LONGITUDE',
          label: `${planet} Sidereal Longitude (Lahiri)`,
          summary: `${planet} at ${sign ?? 'Unknown'} ${
            degInSign !== null ? `${degInSign.toFixed(4)}°` : 'N/A'
          } (abs ${lon !== null ? `${lon.toFixed(4)}°` : 'N/A'})`,
          classification: 'sidereal_planet_longitude',
        },
        measurements: [
          { metric: 'longitude_deg', value: lon, unit: 'degrees' },
          { metric: 'degree_in_sign', value: degInSign, unit: 'degrees' },
          { metric: 'sign', value: sign, unit: null },
        ],
        methodology: vedicMethodology,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'BPHS_SIDEREAL_LONGITUDE',
          citation: 'Lahiri Sidereal Geocentric Ecliptic Longitude',
        },
        sourceDatasets: [vedicSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['julian_day_ut', 'lahiri_ayanamsha_approx_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: vedicVerification,
        sensitivity,
      });
      drafts.push(degDraft);
      const degId = buildDeterministicEvidenceId(degDraft.naturalKeyParts).evidenceId;
      degreeEvidenceIdByKey.set(`vedic_lahiri:${planet}`, degId);

      const parentIds = [degId, ...(lagnaDegreeId ? [lagnaDegreeId] : [])];
      const posDraft = makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'positional',
        observationCode: 'VEDIC_D1_SIGN_HOUSE_PLACEMENT',
        ruleCode: 'BPHS_WHOLE_SIGN_PLACEMENT',
        subject: { type: 'planet', id: planet, name: planet },
        relatedEntities: [
          ...(sign ? [{ type: 'sign' as const, id: sign, name: sign, role: 'occupied_sign' }] : []),
          ...(house !== null
            ? [{ type: 'house' as const, id: `H${house}`, name: `House ${house}`, role: 'whole_sign_house' }]
            : []),
        ],
        secondaryTags: [
          'd1_rashi',
          'whole_sign_house',
          ...(house !== null && [1, 4, 7, 10].includes(house) ? ['angular_position'] : []),
          ...(house !== null && [1, 5, 9].includes(house) ? ['trinal_position'] : []),
          ...(house !== null && [6, 8, 12].includes(house) ? ['dusthana_position'] : []),
        ],
        observation: {
          code: 'VEDIC_D1_SIGN_HOUSE_PLACEMENT',
          label: `${planet} D1 Sign & Whole-Sign House Placement`,
          summary: `${planet} in ${sign ?? 'Unknown'} (Whole-Sign House ${house ?? 'N/A'})`,
          classification: 'rashi_whole_sign_placement',
        },
        measurements: [
          { metric: 'sign', value: sign, unit: null },
          { metric: 'house', value: house, unit: 'house_number' },
          { metric: 'sign_index', value: sign ? (SIGNS as readonly string[]).indexOf(sign) : null, unit: '0_to_11' },
        ],
        methodology: vedicMethodology,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'BPHS_WHOLE_SIGN_PLACEMENT',
          citation: 'BPHS Rashi Whole-Sign House & Sign Occupancy',
        },
        sourceDatasets: [vedicSource],
        parentEvidenceIds: parentIds,
        derivedFromMetrics: ['longitude_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: vedicVerification,
        sensitivity,
      });
      drafts.push(posDraft);
      vedicPlacementEvidenceIdByPlanet.set(
        planet,
        buildDeterministicEvidenceId(posDraft.naturalKeyParts).evidenceId
      );
    }
  }

  // 3. Frame 2: KP Placidus
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

    for (const c of kp.cusps ?? []) {
      const houseNum = numOrNull(c.house);
      const deg = numOrNull(c.cusp_degree ?? c.absolute_degree ?? c.longitude);
      const sign = strOrNull(c.sign) ?? signFromDeg(deg);
      if (houseNum === null) continue;
      const degInSign = degInSignFromLon(deg);
      const cuspDraft = makeDraft(ctx, {
        frame: 'kp_placidus',
        family: 'degree_level',
        observationCode: 'KP_PLACIDUS_CUSP_LONGITUDE',
        ruleCode: 'KP_PLACIDUS_CUSP',
        subject: { type: 'cusp', id: `KP_Cusp_${houseNum}`, name: `KP Cusp ${houseNum}` },
        relatedEntities: sign ? [{ type: 'sign', id: sign, name: sign, role: 'cusp_sign' }] : [],
        secondaryTags: ['kp_cusp', ...(houseNum === 1 || houseNum === 10 ? ['angular_position'] : [])],
        observation: {
          code: 'KP_PLACIDUS_CUSP_LONGITUDE',
          label: `KP Placidus Cusp ${houseNum}`,
          summary: `KP Cusp ${houseNum} at ${sign ?? 'Unknown'} ${
            degInSign !== null ? `${degInSign.toFixed(4)}°` : 'N/A'
          }`,
          classification: 'kp_placidus_cusp_longitude',
        },
        measurements: [
          { metric: 'house', value: houseNum, unit: 'house_number' },
          { metric: 'longitude_deg', value: deg, unit: 'degrees' },
          { metric: 'degree_in_sign', value: degInSign, unit: 'degrees' },
          { metric: 'sign', value: sign, unit: null },
        ],
        methodology: kpMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'KP_PLACIDUS_CUSP',
          citation: 'Krishnamurti Paddhati Placidus House Cusp (KP Ayanamsha)',
        },
        sourceDatasets: [kpSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['lmst_ramc_deg', 'latitude', 'kp_ayanamsha_approx_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: kpVer,
        sensitivity: buildDegreeSensitivity(ctx, degInSign, ['Placidus cusp degrees are birth-time sensitive.']),
      });
      drafts.push(cuspDraft);
      const cid = buildDeterministicEvidenceId(cuspDraft.naturalKeyParts).evidenceId;
      kpCuspEvidenceIdByHouse.set(houseNum, cid);
      degreeEvidenceIdByKey.set(`kp_placidus:KP_Cusp_${houseNum}`, cid);
    }

    for (const p of kp.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet ?? p.raw_name);
      if (!planet) continue;
      const deg = numOrNull(p.absolute_degree ?? p.degree ?? p.longitude);
      const sign = strOrNull(p.sign) ?? signFromDeg(deg);
      const degInSign = degInSignFromLon(deg);
      const kpHouse = numOrNull(p.kp_house ?? p.house);

      const kpDegDraft = makeDraft(ctx, {
        frame: 'kp_placidus',
        family: 'degree_level',
        observationCode: 'KP_PLANET_LONGITUDE',
        ruleCode: 'KP_AYANAMSHA_LONGITUDE',
        subject: { type: 'planet', id: planet, name: planet },
        relatedEntities: sign ? [{ type: 'sign', id: sign, name: sign, role: 'kp_sign' }] : [],
        secondaryTags: ['kp_frame'],
        observation: {
          code: 'KP_PLANET_LONGITUDE',
          label: `${planet} KP Sidereal Longitude`,
          summary: `${planet} (KP) at ${sign ?? 'Unknown'} ${
            degInSign !== null ? `${degInSign.toFixed(4)}°` : 'N/A'
          }`,
          classification: 'kp_planet_longitude',
        },
        measurements: [
          { metric: 'longitude_deg', value: deg, unit: 'degrees' },
          { metric: 'degree_in_sign', value: degInSign, unit: 'degrees' },
          { metric: 'sign', value: sign, unit: null },
        ],
        methodology: kpMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'KP_AYANAMSHA_LONGITUDE',
          citation: 'KP Ayanamsha Planetary Longitude',
        },
        sourceDatasets: [kpSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['julian_day_ut', 'kp_ayanamsha_approx_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: kpVer,
        sensitivity: buildDegreeSensitivity(ctx, degInSign),
      });
      drafts.push(kpDegDraft);
      const kpDegId = buildDeterministicEvidenceId(kpDegDraft.naturalKeyParts).evidenceId;
      degreeEvidenceIdByKey.set(`kp_placidus:${planet}`, kpDegId);

      if (kpHouse !== null) {
        const cuspParent = kpCuspEvidenceIdByHouse.get(kpHouse);
        const vedicRoot = degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
        const kpPosDraft = makeDraft(ctx, {
          frame: 'kp_placidus',
          family: 'positional',
          observationCode: 'KP_PLACIDUS_HOUSE_PLACEMENT',
          ruleCode: 'KP_PLACIDUS_BHAVA',
          subject: { type: 'planet', id: planet, name: planet },
          relatedEntities: [
            { type: 'house', id: `KP_H${kpHouse}`, name: `KP House ${kpHouse}`, role: 'kp_house' },
          ],
          secondaryTags: ['kp_placidus_house'],
          observation: {
            code: 'KP_PLACIDUS_HOUSE_PLACEMENT',
            label: `${planet} KP Placidus House Placement`,
            summary: `${planet} occupies KP Placidus House ${kpHouse} (${sign ?? 'Unknown'})`,
            classification: 'kp_placidus_placement',
          },
          measurements: [
            { metric: 'kp_house', value: kpHouse, unit: 'house_number' },
            { metric: 'sign', value: sign, unit: null },
          ],
          methodology: kpMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'KP_PLACIDUS_BHAVA',
            citation: 'KP Placidus Cusp-to-Cusp House Occupancy',
          },
          sourceDatasets: [kpSource],
          parentEvidenceIds: [
            kpDegId,
            ...(cuspParent ? [cuspParent] : []),
            ...(vedicRoot ? [vedicRoot] : []),
          ],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: kpVer,
          sensitivity: buildDegreeSensitivity(ctx, degInSign),
        });
        drafts.push(kpPosDraft);
      }
    }
  }

  // 4. Frame 3: Bhava Chalit (Sripati) — strictly gated if incompatible
  const chalitEnv = ctx.input.natalInvariant.frames.bhavaChalit;
  const chalitManifest = ctx.manifestByKey.get('bhava_chalit');
  if (isEnvelopeExtractable(chalitEnv, ctx, 'bhava_chalit', 'bhava_chalit', chalitManifest)) {
    const chalit = chalitEnv.data;
    const chalitVer = mapEnvelopeVerification(chalitEnv, chalitManifest);
    const chalitSource = buildSourceDatasetRef('bhava_chalit', chalitEnv, chalitManifest);
    const chalitMeth = buildFrameMethodology(ctx, 'bhava_chalit', {
      houseSystem: chalit.houseBasis ?? 'sripati_midpoint',
    });

    const houseIdByNum = new Map<number, string>();
    for (const h of chalit.houses ?? []) {
      const hNum = numOrNull(h.house ?? h.house_number);
      if (hNum === null) continue;
      const madhya = numOrNull(h.bhava_madhya ?? h.midpoint_degree ?? h.degree ?? h.cusp_degree);
      const startDeg = numOrNull(h.bhava_sandhi_start ?? h.start_degree);
      const endDeg = numOrNull(h.bhava_sandhi_end ?? h.end_degree);
      const madhyaSign = strOrNull(h.sign) ?? signFromDeg(madhya);

      const hDraft = makeDraft(ctx, {
        frame: 'bhava_chalit',
        family: 'degree_level',
        observationCode: 'SRIPATI_BHAVA_MADHYA_SANDHI',
        ruleCode: 'SRIPATI_QUADRANT_TRISECTION',
        subject: { type: 'house', id: `Chalit_H${hNum}`, name: `Sripati Bhava ${hNum}` },
        secondaryTags: ['bhava_chalit', 'sripati_midpoint'],
        observation: {
          code: 'SRIPATI_BHAVA_MADHYA_SANDHI',
          label: `Sripati Bhava ${hNum} Madhya & Sandhi`,
          summary: `Bhava ${hNum} Madhya=${madhya !== null ? `${madhya.toFixed(4)}°` : 'N/A'} (${madhyaSign ?? 'Unknown'})`,
          classification: 'sripati_bhava_cusp',
        },
        measurements: [
          { metric: 'house', value: hNum, unit: 'house_number' },
          { metric: 'bhava_madhya_deg', value: madhya, unit: 'degrees' },
          { metric: 'bhava_sandhi_start_deg', value: startDeg, unit: 'degrees' },
          { metric: 'bhava_sandhi_end_deg', value: endDeg, unit: 'degrees' },
          { metric: 'sign', value: madhyaSign, unit: null },
        ],
        methodology: chalitMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'SRIPATI_QUADRANT_TRISECTION',
          citation: 'Sripati Paddhati Bhava Madhya & Equal-Half Sandhi',
        },
        sourceDatasets: [chalitSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['lmst_ramc_deg', 'latitude', 'lahiri_ayanamsha_approx_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: chalitVer,
        sensitivity: buildDegreeSensitivity(ctx, degInSignFromLon(madhya)),
      });
      drafts.push(hDraft);
      houseIdByNum.set(hNum, buildDeterministicEvidenceId(hDraft.naturalKeyParts).evidenceId);
    }

    for (const p of chalit.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet);
      if (!planet || planet === 'Ascendant') continue;
      const chalitHouse = numOrNull(p.chalit_house ?? p.house);
      const rashiHouse = numOrNull(p.rashi_house);
      const shifted =
        typeof p.shifted === 'boolean'
          ? p.shifted
          : chalitHouse !== null && rashiHouse !== null
          ? chalitHouse !== rashiHouse
          : null;
      const vedicRoot = degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      const hParent = chalitHouse !== null ? houseIdByNum.get(chalitHouse) : undefined;

      const cPosDraft = makeDraft(ctx, {
        frame: 'bhava_chalit',
        family: 'positional',
        observationCode: 'BHAVA_CHALIT_HOUSE_PLACEMENT',
        ruleCode: 'SRIPATI_CHALIT_PLACEMENT',
        subject: { type: 'planet', id: planet, name: planet },
        relatedEntities:
          chalitHouse !== null
            ? [{ type: 'house', id: `Chalit_H${chalitHouse}`, name: `Chalit House ${chalitHouse}`, role: 'chalit_house' }]
            : [],
        secondaryTags: [
          'bhava_chalit',
          ...(shifted ? ['chalit_shifted_from_rashi'] : ['chalit_matches_rashi']),
        ],
        observation: {
          code: 'BHAVA_CHALIT_HOUSE_PLACEMENT',
          label: `${planet} Bhava Chalit Placement`,
          summary: `${planet} in Sripati Chalit House ${chalitHouse ?? 'N/A'}${
            shifted === true ? ` (shifted from Rashi H${rashiHouse ?? '?'})` : ''
          }`,
          classification: 'sripati_chalit_placement',
        },
        measurements: [
          { metric: 'chalit_house', value: chalitHouse, unit: 'house_number' },
          { metric: 'rashi_house', value: rashiHouse, unit: 'house_number' },
          { metric: 'shifted_from_rashi', value: shifted, unit: null },
        ],
        methodology: chalitMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'SRIPATI_CHALIT_PLACEMENT',
          citation: 'Sripati Bhava Sandhi House Placement',
        },
        sourceDatasets: [chalitSource],
        parentEvidenceIds: [
          ...(vedicRoot ? [vedicRoot] : []),
          ...(hParent ? [hParent] : []),
        ],
        derivedFromMetrics: ['longitude_deg', 'bhava_sandhi_start_deg', 'bhava_sandhi_end_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: chalitVer,
        sensitivity: ctx.baseSensitivity,
      });
      drafts.push(cPosDraft);
    }
  }

  // 5. Frame 4: Western Tropical (Placidus)
  const westEnv = ctx.input.natalInvariant.frames.westernTropical;
  const westManifest = ctx.manifestByKey.get('western_tropical_natal');
  if (isEnvelopeExtractable(westEnv, ctx, 'western_tropical', 'western_tropical_natal', westManifest)) {
    const west = westEnv.data;
    const westVer = mapEnvelopeVerification(westEnv, westManifest);
    const westSource = buildSourceDatasetRef('western_tropical_natal', westEnv, westManifest);
    const westMeth = buildFrameMethodology(ctx, 'western_tropical', {
      houseSystem: west.houseSystem || 'placidus',
    });

    const angleEntries = [
      ['Ascendant', asObj(west.angles)?.ascendant ?? asObj(west.anglesDetails)?.ascendant],
      ['Midheaven', asObj(west.angles)?.midheaven ?? asObj(west.angles)?.mc ?? asObj(west.anglesDetails)?.mc],
    ] as const;
    for (const [angleName, rawAngle] of angleEntries) {
      const aObj = asObj(rawAngle);
      const aLon = numOrNull(aObj?.abs_pos ?? aObj?.degree ?? aObj?.longitude ?? rawAngle);
      const aSign = strOrNull(aObj?.sign) ?? signFromDeg(aLon);
      if (aLon === null && aSign === null) continue;
      const aDraft = makeDraft(ctx, {
        frame: 'western_tropical',
        family: 'degree_level',
        observationCode: 'WESTERN_TROPICAL_ANGLE_LONGITUDE',
        ruleCode: 'WESTERN_TROPICAL_PLACIDUS_ANGLE',
        subject: { type: 'angle', id: `West_${angleName}`, name: `Tropical ${angleName}` },
        relatedEntities: aSign ? [{ type: 'sign', id: aSign, name: aSign, role: 'tropical_sign' }] : [],
        secondaryTags: ['western_tropical', 'angular_position'],
        observation: {
          code: 'WESTERN_TROPICAL_ANGLE_LONGITUDE',
          label: `Tropical ${angleName}`,
          summary: `Tropical ${angleName} at ${aSign ?? 'Unknown'} ${
            aLon !== null ? `${degInSignFromLon(aLon)?.toFixed(4)}°` : 'N/A'
          }`,
          classification: 'tropical_angle_longitude',
        },
        measurements: [
          { metric: 'longitude_deg', value: aLon, unit: 'degrees' },
          { metric: 'degree_in_sign', value: degInSignFromLon(aLon), unit: 'degrees' },
          { metric: 'sign', value: aSign, unit: null },
        ],
        methodology: westMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'WESTERN_TROPICAL_PLACIDUS_ANGLE',
          citation: 'Western Tropical Zodiac Placidus Angles',
        },
        sourceDatasets: [westSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['lmst_ramc_deg', 'latitude', 'mean_obliquity_deg'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: westVer,
        sensitivity: buildDegreeSensitivity(ctx, degInSignFromLon(aLon)),
      });
      drafts.push(aDraft);
      degreeEvidenceIdByKey.set(
        `western_tropical:${angleName}`,
        buildDeterministicEvidenceId(aDraft.naturalKeyParts).evidenceId
      );
    }

    for (const p of west.planets ?? []) {
      const rawName = strOrNull(p.name ?? p.planet);
      if (!rawName) continue;
      const subjectId = canonicalSubjectPlanet(rawName) ?? rawName;
      const lon = numOrNull(p.abs_pos ?? p.absolute_degree ?? p.longitude ?? p.degree);
      const sign = strOrNull(p.sign) ?? signFromDeg(lon);
      const degInSign = degInSignFromLon(lon);
      const house = numOrNull(p.house);
      const speed = numOrNull(p.speed);

      const wDegDraft = makeDraft(ctx, {
        frame: 'western_tropical',
        family: 'degree_level',
        observationCode: 'WESTERN_TROPICAL_PLANET_LONGITUDE',
        ruleCode: 'WESTERN_TROPICAL_EPHEMERIS',
        subject: { type: 'planet', id: subjectId, name: rawName },
        relatedEntities: sign ? [{ type: 'sign', id: sign, name: sign, role: 'tropical_sign' }] : [],
        secondaryTags: ['western_tropical'],
        observation: {
          code: 'WESTERN_TROPICAL_PLANET_LONGITUDE',
          label: `${rawName} Tropical Longitude`,
          summary: `${rawName} (Tropical) at ${sign ?? 'Unknown'} ${
            degInSign !== null ? `${degInSign.toFixed(4)}°` : 'N/A'
          }`,
          classification: 'tropical_planet_longitude',
        },
        measurements: [
          { metric: 'longitude_deg', value: lon, unit: 'degrees' },
          { metric: 'degree_in_sign', value: degInSign, unit: 'degrees' },
          { metric: 'sign', value: sign, unit: null },
          { metric: 'speed_deg_per_day', value: speed, unit: 'deg/day' },
        ],
        methodology: westMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'WESTERN_TROPICAL_EPHEMERIS',
          citation: 'Tropical Sayana Geocentric Position',
        },
        sourceDatasets: [westSource],
        parentEvidenceIds: [canonicalInstantId],
        derivedFromMetrics: ['julian_day_ut'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: westVer,
        sensitivity: buildDegreeSensitivity(
          ctx,
          degInSign,
          west.secondPrecisionDroppedByV1Endpoint
            ? ['Western V1 endpoint truncates input seconds.']
            : []
        ),
      });
      drafts.push(wDegDraft);
      const wDegId = buildDeterministicEvidenceId(wDegDraft.naturalKeyParts).evidenceId;
      degreeEvidenceIdByKey.set(`western_tropical:${subjectId}`, wDegId);

      if (house !== null || sign !== null) {
        drafts.push(
          makeDraft(ctx, {
            frame: 'western_tropical',
            family: 'positional',
            observationCode: 'WESTERN_TROPICAL_PLACEMENT',
            ruleCode: 'WESTERN_PLACIDUS_HOUSE_PLACEMENT',
            subject: { type: 'planet', id: subjectId, name: rawName },
            relatedEntities: [
              ...(sign ? [{ type: 'sign' as const, id: sign, name: sign, role: 'tropical_sign' }] : []),
              ...(house !== null
                ? [{ type: 'house' as const, id: `West_H${house}`, name: `Tropical House ${house}`, role: 'placidus_house' }]
                : []),
            ],
            secondaryTags: ['western_tropical'],
            observation: {
              code: 'WESTERN_TROPICAL_PLACEMENT',
              label: `${rawName} Tropical Sign & House`,
              summary: `${rawName} in Tropical ${sign ?? 'Unknown'}${
                house !== null ? `, Placidus House ${house}` : ''
              }`,
              classification: 'tropical_sign_house_placement',
            },
            measurements: [
              { metric: 'sign', value: sign, unit: null },
              { metric: 'house', value: house, unit: 'house_number' },
            ],
            methodology: westMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'WESTERN_PLACIDUS_HOUSE_PLACEMENT',
              citation: 'Western Tropical Sign & Placidus House Placement',
            },
            sourceDatasets: [westSource],
            parentEvidenceIds: [wDegId],
            derivedFromMetrics: ['longitude_deg'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: westVer,
            sensitivity: buildDegreeSensitivity(ctx, degInSign),
          })
        );
      }
    }
  }

  // 6. Frame 5: Astronomical Telemetry
  const teleEnv = ctx.input.natalInvariant.frames.astronomicalTelemetry;
  const teleManifest = ctx.manifestByKey.get('astronomical_telemetry');
  if (
    isEnvelopeExtractable(
      teleEnv,
      ctx,
      'astronomical_telemetry',
      'astronomical_telemetry',
      teleManifest
    )
  ) {
    const tele = teleEnv.data;
    const teleVer = mapEnvelopeVerification(teleEnv, teleManifest);
    const teleSource = buildSourceDatasetRef('astronomical_telemetry', teleEnv, teleManifest);
    const teleMeth = buildFrameMethodology(ctx, 'astronomical_telemetry');

    for (const [bodyKey, bodyData] of Object.entries(tele.bodies ?? {})) {
      const planet = canonicalSubjectPlanet(bodyKey) ?? bodyKey;
      const bObj = asObj(bodyData);
      if (!bObj) continue;
      const lon = numOrNull(bObj.longitude ?? bObj.degree ?? bObj.abs_pos);
      const latDeg = numOrNull(bObj.latitude_deg ?? bObj.latitude ?? bObj.ecliptic_latitude);
      const speed = numOrNull(bObj.speed ?? bObj.speed_deg_per_day);
      const distAu = numOrNull(bObj.distance_au ?? bObj.distance);
      const motionState = strOrNull(bObj.motion_state ?? bObj.station);

      drafts.push(
        makeDraft(ctx, {
          frame: 'astronomical_telemetry',
          family: 'degree_level',
          observationCode: 'ASTRONOMICAL_BODY_TELEMETRY',
          ruleCode: 'EPHEMERIS_KINEMATICS',
          subject: { type: 'planet', id: String(planet), name: String(planet) },
          secondaryTags: ['astronomical_telemetry', 'kinematics'],
          observation: {
            code: 'ASTRONOMICAL_BODY_TELEMETRY',
            label: `${planet} Ephemeris Kinematics`,
            summary: `Speed=${speed !== null ? `${speed.toFixed(4)}°/d` : 'N/A'}, Ecl.Lat=${
              latDeg !== null ? `${latDeg.toFixed(4)}°` : 'N/A'
            }`,
            classification: 'ephemeris_kinematics',
          },
          measurements: [
            { metric: 'longitude_deg', value: lon, unit: 'degrees' },
            { metric: 'ecliptic_latitude_deg', value: latDeg, unit: 'degrees' },
            { metric: 'speed_deg_per_day', value: speed, unit: 'deg/day' },
            { metric: 'distance_au', value: distAu, unit: 'AU' },
            { metric: 'motion_state', value: motionState, unit: null },
          ],
          methodology: teleMeth,
          ruleReference: {
            sourceType: 'astronomical',
            referenceCode: 'EPHEMERIS_KINEMATICS',
            citation: 'Geocentric Ephemeris Speed, Latitude & Distance',
          },
          sourceDatasets: [teleSource],
          parentEvidenceIds: [canonicalInstantId],
          derivedFromMetrics: ['julian_day_ut'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: teleVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  return {
    drafts,
    degreeEvidenceIdByKey,
    vedicPlacementEvidenceIdByPlanet,
    kpCuspEvidenceIdByHouse,
  };
}
