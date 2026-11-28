/**
 * K01 Dignity, Quantitative Strength, Ashtakavarga & House Strength Extractor
 *
 * Extracts:
 *  - Shadbala major 6 + subcomponents + Ishta/Kashta (strictly preserving provisional caveats)
 *  - Bhavabala (House 1..12 strength)
 *  - Ashtakavarga BAV, SAV, Prastara & Shodhana/Reductions (with explicit SAV->BAV->Prastara lineage)
 *  - Vimshopaka Bala (Shadvarga, Saptavarga, Dashavarga, Shodashavarga out of 20.0)
 */

import { SIGNS } from '../../jyotishMath';
import { buildDeterministicEvidenceId } from '../lineage';
import type { CanonicalEvidenceDraft } from '../types';
import {
  asObj,
  asObjArr,
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

export function extractDignityAndStrengthEvidence(
  ctx: ExtractionSharedContext,
  pos: PositionalExtractionResult
): CanonicalEvidenceDraft[] {
  const drafts: CanonicalEvidenceDraft[] = [];
  const vedicEnv = ctx.input.natalInvariant.frames.vedicLahiri;
  const vedicD1Manifest = ctx.manifestByKey.get('vedic_d1_positions');
  const vedicMeth = buildFrameMethodology(ctx, 'vedic_lahiri');
  const ext = asObj(ctx.input.natalInvariant.providerExtendedDatasets);
  const localModules = ctx.input.natalInvariant.localModules;

  // 1. Shadbala Major 6 (from shadbalaReconciliation / providerExtendedDatasets.shadbalaFull)
  const shadbalaReconEnv = ctx.input.natalInvariant.shadbalaReconciliation;
  const shadbalaManifest = ctx.manifestByKey.get('shadbala_major_6');
  const shadbalaRecon = shadbalaReconEnv?.data ?? null;
  const shadbalaUnassigned =
    shadbalaRecon?.authoritativeDesignation === 'unassigned_pending_reconciliation';

  const shadbalaEvidenceIdByPlanet = new Map<string, string>();
  if (
    shadbalaRecon &&
    Array.isArray(shadbalaRecon.perPlanet) &&
    shadbalaReconEnv?.canonicalStatus !== 'unavailable' &&
    shadbalaReconEnv?.canonicalStatus !== 'incompatible'
  ) {
    const shadbalaVer = mapEnvelopeVerification(shadbalaReconEnv, shadbalaManifest, {
      forceProvisional: shadbalaUnassigned,
      extraNotes: shadbalaUnassigned
        ? [
            'Shadbala reconciliation authoritativeDesignation is unassigned_pending_reconciliation; preserved as provisional without averaging.',
          ]
        : [],
    });
    const shadbalaSource = buildSourceDatasetRef(
      'shadbala_major_6',
      shadbalaReconEnv,
      shadbalaManifest
    );

    for (const row of shadbalaRecon.perPlanet) {
      const planet = canonicalSubjectPlanet(row.planet);
      if (!planet || !row.provider) continue;
      const pDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      const prov = row.provider;
      const totalVStr = typeof prov.totalVirupas === 'number' ? prov.totalVirupas.toFixed(2) : 'N/A';
      const rupasStr = typeof prov.rupas === 'number' ? prov.rupas.toFixed(2) : 'N/A';
      const ratioStr = typeof prov.ratio === 'number' ? prov.ratio.toFixed(2) : 'N/A';

      const sbDraft = makeDraft(ctx, {
        frame: 'vedic_lahiri',
        family: 'quantitative',
        observationCode: 'SHADBALA_MAJOR_SIX_BALA',
        ruleCode: 'BPHS_SHADBALA_SIX_FOLD',
        subject: { type: 'planet', id: planet, name: planet },
        secondaryTags: ['shadbala', 'planetary_strength'],
        observation: {
          code: 'SHADBALA_MAJOR_SIX_BALA',
          label: `${planet} Shadbala Six-Fold Strength`,
          summary: `${planet} Total=${totalVStr} Virupas (${rupasStr} Rupas, Ratio=${ratioStr}, Rank=#${prov.rank ?? 'N/A'})`,
          classification: 'shadbala_major_6',
        },
        measurements: [
          { metric: 'total_virupas', value: prov.totalVirupas, unit: 'virupas' },
          { metric: 'total_rupas', value: prov.rupas, unit: 'rupas' },
          { metric: 'required_rupas', value: prov.requiredRupas, unit: 'rupas' },
          { metric: 'strength_ratio', value: prov.ratio, unit: 'ratio' },
          { metric: 'rank', value: prov.rank, unit: 'rank_1_to_7' },
          { metric: 'sthana_bala', value: prov.sthanaBala, unit: 'virupas' },
          { metric: 'dig_bala', value: prov.digBala, unit: 'virupas' },
          { metric: 'kala_bala', value: prov.kalaBala, unit: 'virupas' },
          { metric: 'cheshta_bala', value: prov.cheshtaBala, unit: 'virupas' },
          { metric: 'naisargika_bala', value: prov.naisargikaBala, unit: 'virupas' },
          { metric: 'drik_bala', value: prov.drikBala, unit: 'virupas' },
        ],
        methodology: vedicMeth,
        ruleReference: {
          sourceType: 'classical',
          referenceCode: 'BPHS_SHADBALA_SIX_FOLD',
          citation: 'BPHS Shadbala (Sthana, Dig, Kala, Cheshta, Naisargika, Drik)',
        },
        sourceDatasets: [shadbalaSource],
        parentEvidenceIds: pDegId ? [pDegId] : [],
        derivedFromMetrics: ['longitude_deg', 'house'],
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: shadbalaVer,
        sensitivity: {
          ...ctx.baseSensitivity,
          conventionSensitive: true,
          reasons: Array.from(
            new Set([
              ...ctx.baseSensitivity.reasons,
              'Sun BPHS minimum threshold (6.5 vs 5.0 Rupas) & Kala/Cheshta conventions affect ratio.',
            ])
          ),
        },
      });
      drafts.push(sbDraft);
      shadbalaEvidenceIdByPlanet.set(
        planet,
        buildDeterministicEvidenceId(sbDraft.naturalKeyParts).evidenceId
      );
    }
  }
  if (shadbalaEvidenceIdByPlanet.size === 0) {
    ctx.blockedNotices.push({
      frame: 'vedic_lahiri',
      datasetKey: 'shadbala_major_6',
      canonicalStatus:
        shadbalaManifest?.canonicalStatus ?? shadbalaReconEnv?.canonicalStatus ?? 'unavailable',
      reason: 'Shadbala reconciliation / provider data unavailable.',
    });
  }

  // 2. Shadbala Subcomponents
  const subNorm = asObj(ext?.shadbalaSubcomponentsNormalized);
  const subManifest = ctx.manifestByKey.get('shadbala_subcomponents');
  const subByPlanet = asObj(subNorm?.byPlanet);
  if (subByPlanet && Object.keys(subByPlanet).length > 0 && subManifest?.canonicalStatus !== 'unavailable') {
    const subVer = mapEnvelopeVerification(null, subManifest, {
      forceProvisional: shadbalaUnassigned,
    });
    const subSource = buildSourceDatasetRef('shadbala_subcomponents', null, subManifest);

    for (const [rawPlanet, bucketsObj] of Object.entries(subByPlanet)) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      const bMap = asObj(bucketsObj);
      if (!planet || !bMap) continue;
      const parentSbId = shadbalaEvidenceIdByPlanet.get(planet);

      for (const [bucketName, rawRow] of Object.entries(bMap)) {
        const row = asObj(rawRow);
        if (!row) continue;
        const measurements: CanonicalEvidenceDraft['measurements'] = [];
        for (const [k, v] of Object.entries(row)) {
          if (k === 'planet' || k === 'planetName' || k === 'grahaName' || k === 'name') continue;
          if (typeof v === 'number' && Number.isFinite(v)) {
            measurements.push({ metric: k, value: v, unit: 'virupas' });
          } else if (typeof v === 'boolean' || typeof v === 'string') {
            measurements.push({ metric: k, value: v, unit: null });
          }
        }
        if (measurements.length === 0) continue;

        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'quantitative',
            observationCode: 'SHADBALA_SUBCOMPONENT_BUCKET',
            ruleCode: `BPHS_SHADBALA_${bucketName.toUpperCase()}`,
            qualifier: bucketName,
            subject: { type: 'planet', id: planet, name: planet },
            secondaryTags: ['shadbala_subcomponent', `shadbala:${bucketName}`],
            observation: {
              code: 'SHADBALA_SUBCOMPONENT_BUCKET',
              label: `${planet} Shadbala ${bucketName} Subcomponents`,
              summary: `Detailed ${bucketName} Bala breakdown for ${planet} (${measurements.length} metrics)`,
              classification: 'shadbala_subcomponent',
            },
            measurements,
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: `BPHS_SHADBALA_${bucketName.toUpperCase()}`,
              citation: `BPHS Shadbala ${bucketName} component breakdown`,
            },
            sourceDatasets: [subSource],
            parentEvidenceIds: parentSbId ? [parentSbId] : [],
            derivedFromMetrics: [`${bucketName}_bala`],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: subVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }
    }
  } else {
    ctx.blockedNotices.push({
      frame: 'vedic_lahiri',
      datasetKey: 'shadbala_subcomponents',
      canonicalStatus: subManifest?.canonicalStatus ?? 'unavailable',
      reason: 'Detailed Shadbala subcomponents unavailable.',
    });
  }

  // 3. Ishta & Kashta Phala
  const ishtaObj = asObj(ext?.ishtaKashtaPhala);
  const ishtaManifest = ctx.manifestByKey.get('ishta_kashta_phala');
  const ishtaByPlanet = asObj(ishtaObj?.byPlanet);
  if (ishtaByPlanet && ishtaManifest?.canonicalStatus !== 'unavailable') {
    const ikVer = mapEnvelopeVerification(null, ishtaManifest);
    const ikSource = buildSourceDatasetRef('ishta_kashta_phala', null, ishtaManifest);

    for (const [rawPlanet, rawEntry] of Object.entries(ishtaByPlanet)) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      const entry = asObj(rawEntry);
      if (!planet || !entry) continue;
      const ishtaVal = numOrNull(entry.ishta);
      const kashtaVal = numOrNull(entry.kashta);
      const netVal = numOrNull(entry.netIshtaMinusKashta);
      const parentSbId = shadbalaEvidenceIdByPlanet.get(planet);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'quantitative',
          observationCode: 'ISHTA_KASHTA_PHALA',
          ruleCode: 'BPHS_ISHTA_KASHTA',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['ishta_kashta', 'planetary_strength'],
          observation: {
            code: 'ISHTA_KASHTA_PHALA',
            label: `${planet} Ishta & Kashta Phala`,
            summary: `${planet} Ishta=${ishtaVal ?? 'N/A'}, Kashta=${kashtaVal ?? 'N/A'}`,
            classification: 'ishta_kashta_balance',
          },
          measurements: [
            { metric: 'ishta_phala', value: ishtaVal, unit: 'virupas' },
            { metric: 'kashta_phala', value: kashtaVal, unit: 'virupas' },
            { metric: 'net_ishta_minus_kashta', value: netVal, unit: 'virupas' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_ISHTA_KASHTA',
            citation: 'BPHS Ishta Phala & Kashta Phala (from Uchcha & Cheshta Bala)',
          },
          sourceDatasets: [ikSource],
          parentEvidenceIds: parentSbId ? [parentSbId] : [],
          derivedFromMetrics: ['sthana_bala', 'cheshta_bala'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: ikVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 4. Bhavabala (House 1..12 Strength)
  const bhavaObj = asObj(ext?.bhavabala);
  const bhavaManifest = ctx.manifestByKey.get('bhavabala');
  const bhavaHouses = asObjArr(bhavaObj?.houses);
  if (bhavaHouses.length > 0 && bhavaManifest?.canonicalStatus !== 'unavailable') {
    const bbVer = mapEnvelopeVerification(null, bhavaManifest);
    const bbSource = buildSourceDatasetRef('bhavabala', null, bhavaManifest);

    for (const h of bhavaHouses) {
      const hNum = numOrNull(h.house);
      if (hNum === null) continue;
      const totalVirupa = numOrNull(h.totalVirupa);
      const totalRupa = numOrNull(h.totalRupa);
      const adhipati = numOrNull(h.bhavadhipatiBala ?? h.adhipatiBala);
      const dig = numOrNull(h.bhavaDigbala ?? h.digBala);
      const drishti = numOrNull(h.bhavaDrishtiBala ?? h.drishtiBala);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'quantitative',
          observationCode: 'BHAVABALA_HOUSE_STRENGTH',
          ruleCode: 'BPHS_BHAVABALA',
          subject: { type: 'house', id: `H${hNum}`, name: `House ${hNum}` },
          secondaryTags: ['bhavabala', 'house_strength'],
          observation: {
            code: 'BHAVABALA_HOUSE_STRENGTH',
            label: `House ${hNum} Bhavabala`,
            summary: `House ${hNum} Bhavabala=${totalRupa ?? 'N/A'} Rupas (${totalVirupa ?? 'N/A'} Virupas)`,
            classification: 'bhavabala_strength',
          },
          measurements: [
            { metric: 'house', value: hNum, unit: 'house_number' },
            { metric: 'total_virupas', value: totalVirupa, unit: 'virupas' },
            { metric: 'total_rupas', value: totalRupa, unit: 'rupas' },
            { metric: 'bhavadhipati_bala', value: adhipati, unit: 'virupas' },
            { metric: 'bhava_dig_bala', value: dig, unit: 'virupas' },
            { metric: 'bhava_drishti_bala', value: drishti, unit: 'virupas' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_BHAVABALA',
            citation: 'BPHS Bhavabala (Bhavadhipati, Bhava Digbala, Bhava Drishti)',
          },
          sourceDatasets: [bbSource],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: bbVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  } else {
    ctx.blockedNotices.push({
      frame: 'vedic_lahiri',
      datasetKey: 'bhavabala',
      canonicalStatus: bhavaManifest?.canonicalStatus ?? 'unavailable',
      reason: 'Bhavabala house strength dataset unavailable.',
    });
  }

  // 5. Planetary Dignities (Vedic + Western Essential Dignities)
  if (vedicEnv?.data && isEnvelopeExtractable(vedicEnv, ctx, 'vedic_lahiri', 'vedic_d1_positions', vedicD1Manifest)) {
    const condMap = asObj(asObj(ext?.planetaryConditions)?.byPlanet);
    const localCondEnv = localModules?.localVedicConditions;
    const localCondByPlanet = asObj(asObj(localCondEnv?.data)?.byPlanet);
    const condManifest = ctx.manifestByKey.get('planetary_dignity_conditions');

    const condVer = localCondEnv?.data
      ? mapEnvelopeVerification(localCondEnv, condManifest)
      : mapEnvelopeVerification(vedicEnv, vedicD1Manifest);
    const condSource = localCondEnv?.data
      ? buildSourceDatasetRef('planetary_dignity_conditions', localCondEnv, condManifest)
      : buildSourceDatasetRef('vedic_d1_positions', vedicEnv, vedicD1Manifest);

    for (const p of vedicEnv.data.planets ?? []) {
      const planet = canonicalSubjectPlanet(p.name ?? p.planet);
      if (!planet || planet === 'Ascendant') continue;
      const localC = asObj(localCondByPlanet?.[planet]);
      const provC = asObj(condMap?.[planet]);
      const dignity = strOrNull(localC?.dignity ?? provC?.dignity ?? p.dignity);
      const relToLord = strOrNull(localC?.compoundRelationToSignLord);
      if (!dignity && !relToLord) continue;

      const pDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      const pPosId = pos.vedicPlacementEvidenceIdByPlanet.get(planet);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'operating_condition',
          observationCode: 'VEDIC_D1_DIGNITY',
          ruleCode: 'BPHS_RASHI_DIGNITY',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['dignity', 'd1_rashi'],
          observation: {
            code: 'VEDIC_D1_DIGNITY',
            label: `${planet} D1 Dignity`,
            summary: `${planet} dignity: ${dignity ?? 'Unknown'}${
              relToLord ? ` (Compound relation to sign lord: ${relToLord})` : ''
            }`,
            classification: 'rashi_dignity',
          },
          measurements: [
            { metric: 'dignity', value: dignity, unit: null },
            { metric: 'compound_relation_to_sign_lord', value: relToLord, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_RASHI_DIGNITY',
            citation: 'BPHS Exaltation / Moolatrikona / Own Sign / Friendship Dignity',
          },
          sourceDatasets: [condSource],
          parentEvidenceIds: [...(pDegId ? [pDegId] : []), ...(pPosId ? [pPosId] : [])],
          derivedFromMetrics: ['longitude_deg', 'sign'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: condVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // Western Essential Dignities (if present in westernAndHellenistic.essentialDignities)
  const westEssDig = asObj(asObj(ext?.westernAndHellenistic)?.essentialDignities);
  const westEnv = ctx.input.natalInvariant.frames.westernTropical;
  const westEssManifest = ctx.manifestByKey.get('western_essential_dignities');
  if (westEssDig && westEnv?.data) {
    const essVer = mapEnvelopeVerification(westEnv, westEssManifest);
    const essSource = buildSourceDatasetRef('western_essential_dignities', westEnv, westEssManifest);
    const westMeth = buildFrameMethodology(ctx, 'western_tropical');
    const items = asObjArr(westEssDig.items ?? westEssDig.planets ?? westEssDig.dignities);
    for (const row of items) {
      const rawName = strOrNull(row.planet ?? row.name ?? row.body);
      if (!rawName) continue;
      const subjectId = canonicalSubjectPlanet(rawName) ?? rawName;
      const score = numOrNull(row.score ?? row.totalScore ?? row.essentialScore);
      const label = strOrNull(row.dignity ?? row.status ?? row.primaryDignity) ?? 'Observed';
      const parentDeg = pos.degreeEvidenceIdByKey.get(`western_tropical:${subjectId}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'operating_condition',
          observationCode: 'WESTERN_ESSENTIAL_DIGNITY',
          ruleCode: 'TRADITIONAL_ESSENTIAL_DIGNITY',
          subject: { type: 'planet', id: subjectId, name: rawName },
          secondaryTags: ['dignity', 'western_tropical'],
          observation: {
            code: 'WESTERN_ESSENTIAL_DIGNITY',
            label: `${rawName} Traditional Essential Dignity`,
            summary: `${rawName}: ${label}${score !== null ? ` (Score ${score})` : ''}`,
            classification: 'western_essential_dignity',
          },
          measurements: [
            { metric: 'dignity_status', value: label, unit: null },
            { metric: 'essential_score', value: score, unit: 'points' },
          ],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'TRADITIONAL_ESSENTIAL_DIGNITY',
            citation: 'Hellenistic/Traditional Domicile, Exaltation, Triplicity, Bound, Face',
          },
          sourceDatasets: [essSource],
          parentEvidenceIds: parentDeg ? [parentDeg] : [],
          derivedFromMetrics: ['longitude_deg', 'sign'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: essVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 6. Ashtakavarga (BAV, SAV, Prastara & Reductions) with strict SAV -> BAV -> Prastara lineage
  const localAvEnv = localModules?.localAshtakavarga;
  const avManifest = ctx.manifestByKey.get('ashtakavarga_bav_sav_prastara');
  const localAvData = asObj(localAvEnv?.data);
  const frameAv = vedicEnv?.data?.ashtakavarga ?? null;
  const avUsable =
    (localAvData && localAvEnv && isEnvelopeExtractable(localAvEnv, ctx, 'vedic_lahiri', 'local_ashtakavarga', avManifest)) ||
    Boolean(frameAv && Array.isArray(frameAv.sarvashtakavarga) && frameAv.sarvashtakavarga.length === 12);

  const bavEvidenceIdByPlanet = new Map<string, string>();
  const prastaraIdByPlanet = new Map<string, string>();

  if (avUsable) {
    const avVer = localAvData
      ? mapEnvelopeVerification(localAvEnv, avManifest)
      : mapEnvelopeVerification(vedicEnv, avManifest);
    const avSource = localAvData
      ? buildSourceDatasetRef('ashtakavarga_bav_sav_prastara', localAvEnv, avManifest)
      : buildSourceDatasetRef('ashtakavarga_bav_sav_prastara', vedicEnv, avManifest);

    const bavRecord =
      asObj(localAvData?.bhinna) ?? (frameAv?.bhinnashtakavarga as Record<string, unknown> | undefined) ?? null;
    const prastaraRecord =
      asObj(localAvData?.prastara) ??
      (frameAv?.prastharashtakavarga as Record<string, unknown> | undefined) ??
      null;
    const savArr: number[] = Array.isArray(localAvData?.sarva)
      ? (localAvData!.sarva as number[])
      : Array.isArray(frameAv?.sarvashtakavarga)
      ? frameAv!.sarvashtakavarga
      : [];

    // 6a. Prastara (8 x 12 contributor matrices per planet)
    if (prastaraRecord) {
      for (const [rawPlanet, contributorsObj] of Object.entries(prastaraRecord)) {
        const planet = canonicalSubjectPlanet(rawPlanet);
        const cMap = asObj(contributorsObj);
        if (!planet || !cMap) continue;

        const contributorTotals: Record<string, number> = {};
        for (const [contrib, arr] of Object.entries(cMap)) {
          if (Array.isArray(arr)) {
            contributorTotals[contrib] = arr.reduce((sum, v) => sum + Number(v || 0), 0);
          }
        }
        const total = Object.values(contributorTotals).reduce((a, b) => a + b, 0);
        const degId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);

        const prDraft = makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'quantitative',
          observationCode: 'ASHTAKAVARGA_PRASTARA',
          ruleCode: 'BPHS_PRASTARA_8X12',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['ashtakavarga', 'prastara'],
          observation: {
            code: 'ASHTAKAVARGA_PRASTARA',
            label: `${planet} Prastara Ashtakavarga`,
            summary: `${planet} 8x12 Prastara contributor matrix (${total} total bindus across 12 signs)`,
            classification: 'ashtakavarga_prastara',
          },
          measurements: [
            { metric: 'total_bindus', value: total, unit: 'bindus' },
            ...Object.entries(contributorTotals).map(([contrib, sum]) => ({
              metric: `contributor_${contrib.toLowerCase()}`,
              value: sum,
              unit: 'bindus',
            })),
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_PRASTARA_8X12',
            citation: 'BPHS Ch. 66–72 Prastara Ashtakavarga (7 classical planets + Ascendant)',
          },
          sourceDatasets: [avSource],
          parentEvidenceIds: degId ? [degId] : [],
          derivedFromMetrics: ['sign_index'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: avVer,
          sensitivity: ctx.baseSensitivity,
        });
        drafts.push(prDraft);
        prastaraIdByPlanet.set(
          planet,
          buildDeterministicEvidenceId(prDraft.naturalKeyParts).evidenceId
        );
      }
    }

    // 6b. Bhinnashtakavarga (BAV) per planet -> derives from Prastara
    if (bavRecord) {
      for (const [rawPlanet, bindusRaw] of Object.entries(bavRecord)) {
        const planet = canonicalSubjectPlanet(rawPlanet);
        if (!planet || !Array.isArray(bindusRaw) || bindusRaw.length !== 12) continue;
        const bindus = bindusRaw.map((n) => Number(n));
        const total = bindus.reduce((a, b) => a + b, 0);
        const prId = prastaraIdByPlanet.get(planet);

        const bavDraft = makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'quantitative',
          observationCode: 'ASHTAKAVARGA_BHINNA_BAV',
          ruleCode: 'BPHS_BHINNASHTAKAVARGA',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['ashtakavarga', 'bav'],
          observation: {
            code: 'ASHTAKAVARGA_BHINNA_BAV',
            label: `${planet} Bhinnashtakavarga (BAV)`,
            summary: `${planet} BAV total = ${total} bindus across 12 rashis`,
            classification: 'ashtakavarga_bav',
          },
          measurements: [
            { metric: 'total_bindus', value: total, unit: 'bindus' },
            ...bindus.map((val, idx) => ({
              metric: `bav_${SIGNS[idx].toLowerCase()}`,
              value: val,
              unit: 'bindus',
            })),
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_BHINNASHTAKAVARGA',
            citation: 'BPHS Bhinnashtakavarga Sign Bindus',
          },
          sourceDatasets: [avSource],
          parentEvidenceIds: prId ? [prId] : [],
          derivedFromMetrics: ['total_bindus'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: avVer,
          sensitivity: ctx.baseSensitivity,
        });
        drafts.push(bavDraft);
        bavEvidenceIdByPlanet.set(
          planet,
          buildDeterministicEvidenceId(bavDraft.naturalKeyParts).evidenceId
        );
      }
    }

    // 6c. Sarvashtakavarga (SAV) per Rashi Sign -> derives from all 7 BAVs
    if (savArr.length === 12) {
      const savTotal = savArr.reduce((a, b) => a + Number(b || 0), 0);
      const ascSign = strOrNull(vedicEnv?.data?.ascendant?.sign);
      const ascSignIdx = ascSign ? (SIGNS as readonly string[]).indexOf(ascSign) : 0;
      const bavParents = Array.from(bavEvidenceIdByPlanet.values());

      for (let signIdx = 0; signIdx < 12; signIdx++) {
        const signName = SIGNS[signIdx];
        const wholeSignHouse = ((signIdx - (ascSignIdx >= 0 ? ascSignIdx : 0) + 12) % 12) + 1;
        const bindus = numOrNull(savArr[signIdx]);
        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'quantitative',
            observationCode: 'ASHTAKAVARGA_SARVA_SAV_SIGN',
            ruleCode: 'BPHS_SARVASHTAKAVARGA',
            subject: { type: 'house', id: `H${wholeSignHouse}`, name: `House ${wholeSignHouse} (${signName})` },
            relatedEntities: [{ type: 'sign', id: signName, name: signName, role: 'rashi' }],
            secondaryTags: ['ashtakavarga', 'sav', 'house_strength'],
            observation: {
              code: 'ASHTAKAVARGA_SARVA_SAV_SIGN',
              label: `House ${wholeSignHouse} (${signName}) SAV Bindus`,
              summary: `${signName} (House ${wholeSignHouse}) SAV = ${bindus ?? 'N/A'} bindus (Chart SAV total=${savTotal})`,
              classification: 'ashtakavarga_sav',
            },
            measurements: [
              { metric: 'sav_bindus', value: bindus, unit: 'bindus' },
              { metric: 'chart_sav_total', value: savTotal, unit: 'bindus' },
              { metric: 'house', value: wholeSignHouse, unit: 'house_number' },
              { metric: 'sign', value: signName, unit: null },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_SARVASHTAKAVARGA',
              citation: 'BPHS Sarvashtakavarga (7-Planet Sum per Sign)',
            },
            sourceDatasets: [avSource],
            parentEvidenceIds: bavParents,
            derivedFromMetrics: [`bav_${signName.toLowerCase()}`],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: avVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }
    }
  }

  // 7. Ashtakavarga Shodhana & Reductions (Trikona, Ekadhipatya, Shodhya Pinda)
  const redEnv = localModules?.ashtakavargaReductions;
  const redManifest = ctx.manifestByKey.get('ashtakavarga_shodhana_pinda');
  if (redEnv && isEnvelopeExtractable(redEnv, ctx, 'vedic_lahiri', 'ashtakavarga_shodhana_pinda', redManifest)) {
    const red = redEnv.data;
    const redVer = mapEnvelopeVerification(redEnv, redManifest);
    const redSource = buildSourceDatasetRef('ashtakavarga_shodhana_pinda', redEnv, redManifest);

    for (const [rawPlanet, entry] of Object.entries(red.perPlanet ?? {})) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      if (!planet) continue;
      const parentBav = bavEvidenceIdByPlanet.get(planet);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'modification',
          observationCode: 'ASHTAKAVARGA_SHODHANA_PINDA',
          ruleCode: 'BPHS_ASHTAKAVARGA_REDUCTIONS',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['ashtakavarga_shodhana', 'quantitative'],
          observation: {
            code: 'ASHTAKAVARGA_SHODHANA_PINDA',
            label: `${planet} Trikona/Ekadhipatya & Shodhya Pinda`,
            summary: `${planet} Rasi Pinda=${entry.rasiPinda}, Graha Pinda=${entry.grahaPinda}, Shodhya Pinda=${entry.shodhyaPinda}`,
            classification: 'ashtakavarga_reduction',
          },
          measurements: [
            { metric: 'rasi_pinda', value: entry.rasiPinda, unit: 'pinda' },
            { metric: 'graha_pinda', value: entry.grahaPinda, unit: 'pinda' },
            { metric: 'shodhya_pinda', value: entry.shodhyaPinda, unit: 'pinda' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_ASHTAKAVARGA_REDUCTIONS',
            citation: 'BPHS Trikona Shodhana, Ekadhipatya Shodhana & Shodhya Pinda',
          },
          sourceDatasets: [redSource],
          parentEvidenceIds: parentBav ? [parentBav] : [],
          derivedFromMetrics: ['total_bindus'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: redVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 8. Vimshopaka Bala (Shadvarga, Saptavarga, Dashavarga, Shodashavarga)
  const vimEnv = localModules?.vimshopakaBala;
  const vimManifest = ctx.manifestByKey.get('vimshopaka_bala');
  if (vimEnv && isEnvelopeExtractable(vimEnv, ctx, 'vedic_lahiri', 'vimshopaka_bala', vimManifest)) {
    const vimData = asObj(vimEnv.data);
    const schemes = asObj(vimData?.schemes);
    const vimVer = mapEnvelopeVerification(vimEnv, vimManifest);
    const vimSource = buildSourceDatasetRef('vimshopaka_bala', vimEnv, vimManifest);

    if (schemes) {
      for (const [schemeName, rawScheme] of Object.entries(schemes)) {
        const scheme = asObj(rawScheme);
        const scoresByPlanet = asObj(scheme?.scoresByPlanet);
        if (!scheme || !scoresByPlanet || scheme.complete !== true) continue;

        for (const [rawPlanet, rawScoreObj] of Object.entries(scoresByPlanet)) {
          const planet = canonicalSubjectPlanet(rawPlanet);
          const sObj = asObj(rawScoreObj);
          if (!planet || !sObj) continue;
          const scoreOutOf20 = numOrNull(sObj.scoreOutOf20);
          const pct = numOrNull(sObj.percentage);
          const tier = strOrNull(sObj.strengthTier);
          const pDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);

          drafts.push(
            makeDraft(ctx, {
              frame: 'vedic_lahiri',
              family: 'quantitative',
              observationCode: 'VIMSHOPAKA_BALA_SCHEME',
              ruleCode: `BPHS_VIMSHOPAKA_${schemeName.toUpperCase()}`,
              qualifier: schemeName,
              subject: { type: 'planet', id: planet, name: planet },
              secondaryTags: ['vimshopaka_bala', 'divisional_strength', `scheme:${schemeName}`],
              observation: {
                code: 'VIMSHOPAKA_BALA_SCHEME',
                label: `${planet} Vimshopaka Bala (${schemeName})`,
                summary: `${planet} ${schemeName} Vimshopaka = ${scoreOutOf20 ?? 'N/A'}/20 (${pct ?? 'N/A'}%, ${
                  tier ?? 'N/A'
                })`,
                classification: 'vimshopaka_bala',
              },
              measurements: [
                { metric: 'scheme', value: schemeName, unit: null },
                { metric: 'score_out_of_20', value: scoreOutOf20, unit: 'virupas_20_scale' },
                { metric: 'percentage', value: pct, unit: 'percent' },
                { metric: 'strength_tier', value: tier, unit: null },
              ],
              methodology: vedicMeth,
              ruleReference: {
                sourceType: 'classical',
                referenceCode: `BPHS_VIMSHOPAKA_${schemeName.toUpperCase()}`,
                citation: `BPHS Ch. 6 Vimshopaka Bala (${schemeName})`,
              },
              sourceDatasets: [vimSource],
              parentEvidenceIds: pDegId ? [pDegId] : [],
              derivedFromMetrics: ['longitude_deg'],
              temporalScope: 'natal_invariant',
              referenceDateIso: null,
              verification: vimVer,
              sensitivity: ctx.baseSensitivity,
            })
          );
        }
      }
    }
  }

  return drafts;
}
