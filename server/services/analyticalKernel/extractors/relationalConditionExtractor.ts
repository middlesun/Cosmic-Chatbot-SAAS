/**
 * K01 Relational, Dependency, Operating Condition & Modification Extractor
 *
 * Extracts:
 *  - Panchadha Maitri (5-fold compound planetary friendship) -> `relational`
 *  - Western Tropical & Sidereal Aspects + Antiscia -> `relational`
 *  - Dispositor Chains, Final Dispositors, Cycles & Parivartana -> `dependency` / `relational`
 *  - Operating Conditions (Retrograde, Combustion, Vargottama, Gandanta, Graha Yuddha) ->
 *    `operating_condition` & `modification`
 *  - Advanced Avasthas (Baladi, Jagradadi, Deeptadi) -> `operating_condition` (strictly provisional)
 */

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

export function extractRelationalAndConditionEvidence(
  ctx: ExtractionSharedContext,
  pos: PositionalExtractionResult
): CanonicalEvidenceDraft[] {
  const drafts: CanonicalEvidenceDraft[] = [];
  const ext = asObj(ctx.input.natalInvariant.providerExtendedDatasets);
  const localModules = ctx.input.natalInvariant.localModules;
  const vedicMeth = buildFrameMethodology(ctx, 'vedic_lahiri');
  const westMeth = buildFrameMethodology(ctx, 'western_tropical');

  // 1. Panchadha Maitri (Five-Fold Compound Planetary Friendship)
  const pmEnv = localModules?.panchadhaMaitri;
  const pmManifest = ctx.manifestByKey.get('panchadha_maitri');
  const pmData = asObj(pmEnv?.data ?? ext?.panchadhaMaitri);
  const pmMatrix = asObj(pmData?.matrix);

  if (pmMatrix && pmData?.valid === true) {
    const pmVer = mapEnvelopeVerification(pmEnv, pmManifest);
    const pmSource = buildSourceDatasetRef('panchadha_maitri', pmEnv, pmManifest);

    for (const [rawSourcePlanet, rowObj] of Object.entries(pmMatrix)) {
      const sourcePlanet = canonicalSubjectPlanet(rawSourcePlanet);
      const targets = asObj(rowObj);
      if (!sourcePlanet || !targets) continue;
      const srcDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${sourcePlanet}`);

      for (const [rawTargetPlanet, rawEntry] of Object.entries(targets)) {
        const targetPlanet = canonicalSubjectPlanet(rawTargetPlanet);
        const entry = asObj(rawEntry);
        if (!targetPlanet || !entry || sourcePlanet === targetPlanet) continue;

        const naturalRel = strOrNull(entry.naturalRelation);
        const compoundRel = strOrNull(entry.compoundRelation);
        const compoundScore = numOrNull(entry.compoundScore);
        const tatkalikaHouse = numOrNull(entry.tatkalikaHouseFromSource);
        const tatkalikaFriend =
          typeof entry.tatkalikaIsFriend === 'boolean' ? entry.tatkalikaIsFriend : null;
        const tgtDegId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${targetPlanet}`);

        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'relational',
            observationCode: 'PANCHADHA_MAITRI_PAIR',
            ruleCode: 'BPHS_PANCHADHA_MAITRI',
            qualifier: `${sourcePlanet}_to_${targetPlanet}`,
            subject: { type: 'planet', id: sourcePlanet, name: sourcePlanet },
            relatedEntities: [
              { type: 'planet', id: targetPlanet, name: targetPlanet, role: 'evaluated_target_planet' },
            ],
            secondaryTags: ['panchadha_maitri', 'planetary_friendship'],
            observation: {
              code: 'PANCHADHA_MAITRI_PAIR',
              label: `${sourcePlanet} -> ${targetPlanet} Panchadha Maitri`,
              summary: `${sourcePlanet} views ${targetPlanet} as ${compoundRel ?? 'Unknown'} (Natural: ${
                naturalRel ?? '?'
              }, House Diff: ${tatkalikaHouse ?? '?'})`,
              classification: 'compound_planetary_friendship',
            },
            measurements: [
              { metric: 'compound_relation', value: compoundRel, unit: null },
              { metric: 'compound_score', value: compoundScore, unit: '-2_to_2' },
              { metric: 'natural_relation', value: naturalRel, unit: null },
              { metric: 'tatkalika_house_from_source', value: tatkalikaHouse, unit: 'house_count' },
              { metric: 'tatkalika_is_friend', value: tatkalikaFriend, unit: null },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_PANCHADHA_MAITRI',
              citation: 'BPHS Ch. 3 Naisargika + Tatkalika -> Panchadha Maitri',
            },
            sourceDatasets: [pmSource],
            parentEvidenceIds: [
              ...(srcDegId ? [srcDegId] : []),
              ...(tgtDegId ? [tgtDegId] : []),
            ],
            derivedFromMetrics: ['sign_index'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: pmVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }
    }
  } else {
    ctx.blockedNotices.push({
      frame: 'vedic_lahiri',
      datasetKey: 'panchadha_maitri',
      canonicalStatus: pmManifest?.canonicalStatus ?? 'unavailable',
      reason: 'Panchadha Maitri matrix unavailable.',
    });
  }

  // 2. Western Tropical Aspects & Declination Aspects
  const westEnv = ctx.input.natalInvariant.frames.westernTropical;
  const westManifest = ctx.manifestByKey.get('western_tropical_natal');
  if (isEnvelopeExtractable(westEnv, ctx, 'western_tropical', 'western_tropical_natal', westManifest)) {
    const west = westEnv.data;
    const westVer = mapEnvelopeVerification(westEnv, westManifest);
    const westSource = buildSourceDatasetRef('western_tropical_natal', westEnv, westManifest);

    for (let idx = 0; idx < (west.aspects ?? []).length; idx++) {
      const asp = asObj(west.aspects[idx]);
      if (!asp) continue;
      const p1Raw = strOrNull(asp.p1_name ?? asp.planet1 ?? asp.body1 ?? asp.first);
      const p2Raw = strOrNull(asp.p2_name ?? asp.planet2 ?? asp.body2 ?? asp.second);
      const aspName = strOrNull(asp.aspect ?? asp.name ?? asp.type);
      if (!p1Raw || !p2Raw || !aspName) continue;

      const s1 = canonicalSubjectPlanet(p1Raw) ?? p1Raw;
      const s2 = canonicalSubjectPlanet(p2Raw) ?? p2Raw;
      const orb = numOrNull(asp.orbit ?? asp.orb ?? asp.diff);
      const deg1 = pos.degreeEvidenceIdByKey.get(`western_tropical:${s1}`);
      const deg2 = pos.degreeEvidenceIdByKey.get(`western_tropical:${s2}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'relational',
          observationCode: 'WESTERN_GEOMETRIC_ASPECT',
          ruleCode: 'WESTERN_PTOLEMAIC_ASPECTS',
          qualifier: `${s1}_${aspName}_${s2}_${idx}`,
          subject: { type: 'planet', id: s1, name: p1Raw },
          relatedEntities: [{ type: 'planet', id: s2, name: p2Raw, role: 'aspected_body' }],
          secondaryTags: ['western_aspect', `aspect:${aspName.toLowerCase().replace(/\s+/g, '_')}`],
          observation: {
            code: 'WESTERN_GEOMETRIC_ASPECT',
            label: `${p1Raw} ${aspName} ${p2Raw}`,
            summary: `Tropical ${p1Raw} ${aspName} ${p2Raw}${orb !== null ? ` (orb ${orb.toFixed(2)}°)` : ''}`,
            classification: 'western_aspect',
          },
          measurements: [
            { metric: 'aspect_name', value: aspName, unit: null },
            { metric: 'orb_deg', value: orb, unit: 'degrees' },
            { metric: 'aspect_degrees', value: numOrNull(asp.aspect_degrees ?? asp.angle), unit: 'degrees' },
            { metric: 'applying_or_movement', value: strOrNull(asp.aid ?? asp.movement ?? asp.applying), unit: null },
          ],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'WESTERN_PTOLEMAIC_ASPECTS',
            citation: 'Western Tropical Ecliptic Aspect Geometry',
          },
          sourceDatasets: [westSource],
          parentEvidenceIds: [...(deg1 ? [deg1] : []), ...(deg2 ? [deg2] : [])],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: westVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    for (let idx = 0; idx < (west.declinationAspects ?? []).length; idx++) {
      const asp = asObj(west.declinationAspects[idx]);
      if (!asp) continue;
      const p1Raw = strOrNull(asp.p1_name ?? asp.planet1 ?? asp.body1);
      const p2Raw = strOrNull(asp.p2_name ?? asp.planet2 ?? asp.body2);
      const aspName = strOrNull(asp.aspect ?? asp.name ?? asp.type);
      if (!p1Raw || !p2Raw || !aspName) continue;
      const s1 = canonicalSubjectPlanet(p1Raw) ?? p1Raw;
      const s2 = canonicalSubjectPlanet(p2Raw) ?? p2Raw;
      const orb = numOrNull(asp.orbit ?? asp.orb ?? asp.diff);

      drafts.push(
        makeDraft(ctx, {
          frame: 'western_tropical',
          family: 'relational',
          observationCode: 'WESTERN_DECLINATION_ASPECT',
          ruleCode: 'WESTERN_PARALLEL_CONTRAPARALLEL',
          qualifier: `${s1}_${aspName}_${s2}_${idx}`,
          subject: { type: 'planet', id: s1, name: p1Raw },
          relatedEntities: [{ type: 'planet', id: s2, name: p2Raw, role: 'declination_partner' }],
          secondaryTags: ['declination_aspect'],
          observation: {
            code: 'WESTERN_DECLINATION_ASPECT',
            label: `${p1Raw} ${aspName} ${p2Raw} (Declination)`,
            summary: `${p1Raw} ${aspName} ${p2Raw}${orb !== null ? ` (orb ${orb.toFixed(2)}°)` : ''}`,
            classification: 'western_declination_aspect',
          },
          measurements: [
            { metric: 'aspect_name', value: aspName, unit: null },
            { metric: 'orb_deg', value: orb, unit: 'degrees' },
          ],
          methodology: westMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'WESTERN_PARALLEL_CONTRAPARALLEL',
            citation: 'Equatorial Declination Parallel / Contra-Parallel',
          },
          sourceDatasets: [westSource],
          derivedFromMetrics: ['declination'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: westVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 3. Sidereal Chart Aspects & Antiscia (from AstroWay /chart sidereal extras)
  const siderealExtras = asObj(ext?.siderealChartExtras);
  const vedicEnv = ctx.input.natalInvariant.frames.vedicLahiri;
  const vedicD1Manifest = ctx.manifestByKey.get('vedic_d1_positions');
  if (siderealExtras && vedicEnv?.data) {
    const sidVer = mapEnvelopeVerification(vedicEnv, vedicD1Manifest);
    const sidSource = buildSourceDatasetRef('vedic_d1_positions', vedicEnv, vedicD1Manifest);

    for (let idx = 0; idx < asObjArr(siderealExtras.aspects).length; idx++) {
      const asp = asObjArr(siderealExtras.aspects)[idx];
      const p1Raw = strOrNull(asp.planet1 ?? asp.p1 ?? asp.from ?? asp.body1 ?? asp.subject);
      const p2Raw = strOrNull(asp.planet2 ?? asp.p2 ?? asp.to ?? asp.body2 ?? asp.target);
      const aspType = strOrNull(asp.type ?? asp.aspect ?? asp.name);
      if (!p1Raw || !p2Raw || !aspType) continue;
      const s1 = canonicalSubjectPlanet(p1Raw) ?? p1Raw;
      const s2 = canonicalSubjectPlanet(p2Raw) ?? p2Raw;
      const deg1 = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${s1}`);
      const deg2 = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${s2}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'relational',
          observationCode: 'SIDEREAL_PLANETARY_ASPECT',
          ruleCode: 'SIDEREAL_CHART_ASPECT',
          qualifier: `${s1}_${aspType}_${s2}_${idx}`,
          subject: { type: 'planet', id: s1, name: p1Raw },
          relatedEntities: [{ type: 'planet', id: s2, name: p2Raw, role: 'aspected_body' }],
          secondaryTags: ['sidereal_aspect'],
          observation: {
            code: 'SIDEREAL_PLANETARY_ASPECT',
            label: `${p1Raw} ${aspType} ${p2Raw} (Sidereal)`,
            summary: `Sidereal ${p1Raw} -> ${p2Raw}: ${aspType}`,
            classification: 'sidereal_aspect',
          },
          measurements: [
            { metric: 'aspect_type', value: aspType, unit: null },
            { metric: 'orb_deg', value: numOrNull(asp.orb ?? asp.orbit), unit: 'degrees' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'provider',
            referenceCode: 'SIDEREAL_CHART_ASPECT',
            citation: 'Sidereal Planetary Aspect Telemetry',
          },
          sourceDatasets: [sidSource],
          parentEvidenceIds: [...(deg1 ? [deg1] : []), ...(deg2 ? [deg2] : [])],
          derivedFromMetrics: ['longitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: sidVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 4. Dispositor Chains, House Lords & Parivartana (Mutual Exchanges) -> `dependency` & `relational`
  const dispEnv = localModules?.dispositorRelationships;
  const dispManifest = ctx.manifestByKey.get('dispositor_relationships');
  const dispData = asObj(dispEnv?.data ?? ext?.dispositorRelationships);
  const d1Disp = asObj(dispData?.d1);
  const d1DispPlanets = asObj(d1Disp?.planets);

  if (d1DispPlanets && dispData?.valid === true) {
    const dispVer = mapEnvelopeVerification(dispEnv, dispManifest);
    const dispSource = buildSourceDatasetRef('dispositor_relationships', dispEnv, dispManifest);

    for (const [rawPlanet, rawNode] of Object.entries(d1DispPlanets)) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      const node = asObj(rawNode);
      if (!planet || !node) continue;

      const signLord = canonicalSubjectPlanet(node.signLord) ?? strOrNull(node.signLord);
      const finalDispositor =
        canonicalSubjectPlanet(node.finalDispositor) ?? strOrNull(node.finalDispositor);
      const termType = strOrNull(node.terminationType);
      const isSelf = typeof node.isSelfDisposited === 'boolean' ? node.isSelfDisposited : null;
      const chain = Array.isArray(node.chain) ? node.chain.map(String) : [];
      const pPosId = pos.vedicPlacementEvidenceIdByPlanet.get(planet);
      const lordDegId = signLord ? pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${signLord}`) : undefined;

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'dependency',
          observationCode: 'VEDIC_D1_DISPOSITOR_DEPENDENCY',
          ruleCode: 'PARASHARI_DISPOSITOR_CHAIN',
          subject: { type: 'planet', id: planet, name: planet },
          relatedEntities: [
            ...(signLord
              ? [{ type: 'planet' as const, id: signLord, name: signLord, role: 'sign_dispositor' }]
              : []),
            ...(finalDispositor && finalDispositor !== signLord
              ? [{ type: 'planet' as const, id: finalDispositor, name: finalDispositor, role: 'final_dispositor' }]
              : []),
          ],
          secondaryTags: [
            'dispositor_chain',
            ...(isSelf ? ['swakshetra_self_disposited'] : []),
            ...(termType ? [`termination:${termType}`] : []),
          ],
          observation: {
            code: 'VEDIC_D1_DISPOSITOR_DEPENDENCY',
            label: `${planet} D1 Dispositor Dependency`,
            summary: `${planet} -> Sign Lord ${signLord ?? '?'} (Chain: ${chain.join(' -> ') || 'N/A'}, Termination: ${
              termType ?? '?'
            })`,
            classification: 'dispositor_dependency',
          },
          measurements: [
            { metric: 'sign_lord', value: signLord, unit: null },
            { metric: 'dispositor_sign', value: strOrNull(node.dispositorSign), unit: null },
            { metric: 'dispositor_house', value: numOrNull(node.dispositorHouse), unit: 'house_number' },
            { metric: 'is_self_disposited', value: isSelf, unit: null },
            { metric: 'termination_type', value: termType, unit: null },
            { metric: 'final_dispositor', value: finalDispositor, unit: null },
            { metric: 'chain_path', value: chain.join('->') || null, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'PARASHARI_DISPOSITOR_CHAIN',
            citation: 'Parashari Sign-Lord Dispositor Authority & Chain Termination',
          },
          sourceDatasets: [dispSource],
          parentEvidenceIds: [
            ...(pPosId ? [pPosId] : []),
            ...(lordDegId && lordDegId !== pPosId ? [lordDegId] : []),
          ],
          derivedFromMetrics: ['sign', 'house'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: dispVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    // House Dispositors (Bhavesha placements for H1..H12)
    for (const hRow of asObjArr(d1Disp?.houseDispositors)) {
      const hNum = numOrNull(hRow.house);
      const lord = canonicalSubjectPlanet(hRow.lord);
      const sign = strOrNull(hRow.sign);
      if (hNum === null || !lord) continue;
      const lordPosId = pos.vedicPlacementEvidenceIdByPlanet.get(lord);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'dependency',
          observationCode: 'VEDIC_D1_HOUSE_LORD_PLACEMENT',
          ruleCode: 'PARASHARI_BHAVESHA_DEPENDENCY',
          subject: { type: 'house', id: `H${hNum}`, name: `House ${hNum}` },
          relatedEntities: [{ type: 'planet', id: lord, name: lord, role: 'house_lord' }],
          secondaryTags: ['bhavesha', 'house_dispositor'],
          observation: {
            code: 'VEDIC_D1_HOUSE_LORD_PLACEMENT',
            label: `House ${hNum} Lord (${lord}) Placement`,
            summary: `House ${hNum} (${sign ?? '?'}) ruled by ${lord}, placed in ${
              strOrNull(hRow.lordPlacedInSign) ?? '?'
            } (H${numOrNull(hRow.lordPlacedInHouse) ?? '?'})`,
            classification: 'house_lord_dependency',
          },
          measurements: [
            { metric: 'house', value: hNum, unit: 'house_number' },
            { metric: 'house_sign', value: sign, unit: null },
            { metric: 'house_lord', value: lord, unit: null },
            { metric: 'lord_placed_in_sign', value: strOrNull(hRow.lordPlacedInSign), unit: null },
            { metric: 'lord_placed_in_house', value: numOrNull(hRow.lordPlacedInHouse), unit: 'house_number' },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'PARASHARI_BHAVESHA_DEPENDENCY',
            citation: 'BPHS House Lord (Bhavesha) Dependency Placement',
          },
          sourceDatasets: [dispSource],
          parentEvidenceIds: lordPosId ? [lordPosId] : [],
          derivedFromMetrics: ['sign', 'house'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: dispVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }

    // Parivartana (Mutual Exchanges) in D1 & D9
    const exchangeBuckets = [
      { division: 'D1', list: asObjArr(d1Disp?.mutualExchanges) },
      { division: 'D9', list: asObjArr(asObj(dispData?.d9)?.mutualExchanges) },
    ];
    for (const bucket of exchangeBuckets) {
      for (const pair of bucket.list) {
        const pA = canonicalSubjectPlanet(pair.planetA);
        const pB = canonicalSubjectPlanet(pair.planetB);
        if (!pA || !pB) continue;
        const pType = strOrNull(pair.parivartanaType);
        const dA = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${pA}`);
        const dB = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${pB}`);

        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'relational',
            observationCode: 'PARIVARTANA_MUTUAL_EXCHANGE',
            ruleCode: 'BPHS_PARIVARTANA_YOGA',
            qualifier: `${bucket.division}_${pA}_${pB}`,
            subject: { type: 'planet', id: pA, name: pA },
            relatedEntities: [{ type: 'planet', id: pB, name: pB, role: 'mutual_exchange_partner' }],
            secondaryTags: ['parivartana', 'dependency', `division:${bucket.division}`],
            observation: {
              code: 'PARIVARTANA_MUTUAL_EXCHANGE',
              label: `${pA}-${pB} ${bucket.division} Parivartana (${pType ?? 'Exchange'})`,
              summary: `${bucket.division} ${pType ?? ''} Parivartana between ${pA} (H${
                numOrNull(pair.houseA) ?? '?'
              }) and ${pB} (H${numOrNull(pair.houseB) ?? '?'})`,
              classification: 'mutual_exchange',
            },
            measurements: [
              { metric: 'division', value: bucket.division, unit: null },
              { metric: 'parivartana_type', value: pType, unit: null },
              { metric: 'sign_a', value: strOrNull(pair.signA), unit: null },
              { metric: 'house_a', value: numOrNull(pair.houseA), unit: 'house_number' },
              { metric: 'sign_b', value: strOrNull(pair.signB), unit: null },
              { metric: 'house_b', value: numOrNull(pair.houseB), unit: 'house_number' },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_PARIVARTANA_YOGA',
              citation: 'Parashari Sign-Exchange Parivartana (Maha / Kahala / Dainya)',
            },
            sourceDatasets: [dispSource],
            parentEvidenceIds: [...(dA ? [dA] : []), ...(dB ? [dB] : [])],
            derivedFromMetrics: ['sign', 'house'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: dispVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }
    }
  }

  // 5. Operating Conditions & Modifications (Combustion, Retrograde, Vargottama, Gandanta, Graha Yuddha)
  const localCondEnv = localModules?.localVedicConditions;
  const condManifest = ctx.manifestByKey.get('planetary_dignity_conditions');
  const localCondData = asObj(localCondEnv?.data ?? ext?.localVedicConditions);
  const condByPlanet = asObj(localCondData?.byPlanet);

  if (condByPlanet && localCondData?.valid === true) {
    const condVer = mapEnvelopeVerification(localCondEnv, condManifest);
    const condSource = buildSourceDatasetRef('planetary_dignity_conditions', localCondEnv, condManifest);

    for (const [rawPlanet, rawCond] of Object.entries(condByPlanet)) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      const c = asObj(rawCond);
      if (!planet || !c) continue;
      const degId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);
      const isRetro = Boolean(c.isRetrograde);
      const isCombust = Boolean(c.isCombust);
      const isVargottama = typeof c.isVargottama === 'boolean' ? c.isVargottama : null;
      const isGandanta = Boolean(c.isGandanta);
      const inYuddha = Boolean(c.inGrahaYuddha);
      const yuddhaRole = strOrNull(c.grahaYuddhaRole);
      const sunSep = numOrNull(c.sunSeparationDeg);
      const combOrb = numOrNull(c.combustionOrbDeg);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'operating_condition',
          observationCode: 'VEDIC_PLANET_OPERATING_CONDITIONS',
          ruleCode: 'BPHS_CHESTA_ASTA_GANDANTA_YUDDHA',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: [
            ...(isRetro ? ['retrograde'] : ['direct_motion']),
            ...(isCombust ? ['combust'] : []),
            ...(isVargottama ? ['vargottama'] : []),
            ...(isGandanta ? ['gandanta'] : []),
            ...(inYuddha ? ['graha_yuddha'] : []),
          ],
          observation: {
            code: 'VEDIC_PLANET_OPERATING_CONDITIONS',
            label: `${planet} Operating Conditions`,
            summary: `${planet}: Retro=${isRetro}, Combust=${isCombust}, Vargottama=${
              isVargottama ?? 'N/A'
            }, Gandanta=${isGandanta}, Yuddha=${inYuddha}`,
            classification: 'planetary_operating_condition',
          },
          measurements: [
            { metric: 'is_retrograde', value: isRetro, unit: null },
            { metric: 'is_combust', value: isCombust, unit: null },
            { metric: 'sun_separation_deg', value: sunSep, unit: 'degrees' },
            { metric: 'combustion_orb_deg', value: combOrb, unit: 'degrees' },
            { metric: 'is_vargottama', value: isVargottama, unit: null },
            { metric: 'is_gandanta', value: isGandanta, unit: null },
            { metric: 'in_graha_yuddha', value: inYuddha, unit: null },
            { metric: 'graha_yuddha_role', value: yuddhaRole, unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_CHESTA_ASTA_GANDANTA_YUDDHA',
            citation: 'Surya Siddhanta Combustion Orbs, Retrograde, Vargottama, Gandanta & Graha Yuddha',
          },
          sourceDatasets: [condSource],
          parentEvidenceIds: degId ? [degId] : [],
          derivedFromMetrics: ['longitude_deg', 'ecliptic_latitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: condVer,
          sensitivity: ctx.baseSensitivity,
        })
      );

      // Emit explicit `modification` evidence items for active condition modifiers
      if (isCombust) {
        const sunDegId = pos.degreeEvidenceIdByKey.get('vedic_lahiri:Sun');
        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'modification',
            observationCode: 'MODIFIER_COMBUSTION_ASTA',
            ruleCode: 'SURYA_SIDDHANTA_COMBUSTION',
            subject: { type: 'planet', id: planet, name: planet },
            relatedEntities: [{ type: 'planet', id: 'Sun', name: 'Sun', role: 'combusting_luminary' }],
            secondaryTags: ['combustion', 'operating_modifier'],
            observation: {
              code: 'MODIFIER_COMBUSTION_ASTA',
              label: `${planet} Combustion (Asta)`,
              summary: `${planet} is combust (${sunSep !== null ? `${sunSep.toFixed(2)}°` : '?'} from Sun; orb ${
                combOrb ?? '?'
              }°)`,
              classification: 'combustion_modifier',
            },
            measurements: [
              { metric: 'sun_separation_deg', value: sunSep, unit: 'degrees' },
              { metric: 'combustion_orb_deg', value: combOrb, unit: 'degrees' },
              { metric: 'is_retrograde', value: isRetro, unit: null },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'SURYA_SIDDHANTA_COMBUSTION',
              citation: 'Surya Siddhanta Combustion Orbs',
            },
            sourceDatasets: [condSource],
            parentEvidenceIds: [...(degId ? [degId] : []), ...(sunDegId ? [sunDegId] : [])],
            derivedFromMetrics: ['longitude_deg'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: condVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }

      if (isVargottama === true) {
        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'modification',
            observationCode: 'MODIFIER_VARGOTTAMA',
            ruleCode: 'BPHS_VARGOTTAMA',
            subject: { type: 'planet', id: planet, name: planet },
            secondaryTags: ['vargottama', 'd1_d9_reinforcement'],
            observation: {
              code: 'MODIFIER_VARGOTTAMA',
              label: `${planet} Vargottama (D1 = D9 Sign)`,
              summary: `${planet} occupies the same sign in D1 Rashi and D9 Navamsa`,
              classification: 'vargottama_modifier',
            },
            measurements: [
              { metric: 'is_vargottama', value: true, unit: null },
              { metric: 'sign', value: strOrNull(c.sign), unit: null },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_VARGOTTAMA',
              citation: 'BPHS Vargottama (Identical D1 and D9 Sign)',
            },
            sourceDatasets: [condSource],
            parentEvidenceIds: degId ? [degId] : [],
            derivedFromMetrics: ['longitude_deg'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: condVer,
            sensitivity: ctx.baseSensitivity,
          })
        );
      }

      if (isGandanta) {
        drafts.push(
          makeDraft(ctx, {
            frame: 'vedic_lahiri',
            family: 'modification',
            observationCode: 'MODIFIER_GANDANTA_JUNCTION',
            ruleCode: 'BPHS_GANDANTA',
            subject: { type: 'planet', id: planet, name: planet },
            secondaryTags: ['gandanta', 'boundary_junction'],
            observation: {
              code: 'MODIFIER_GANDANTA_JUNCTION',
              label: `${planet} Gandanta Junction`,
              summary: `${planet} lies within a Water-Fire Rashi/Nakshatra Gandanta junction`,
              classification: 'gandanta_modifier',
            },
            measurements: [
              { metric: 'is_gandanta', value: true, unit: null },
              { metric: 'degree_in_sign', value: numOrNull(c.degreeInSign), unit: 'degrees' },
            ],
            methodology: vedicMeth,
            ruleReference: {
              sourceType: 'classical',
              referenceCode: 'BPHS_GANDANTA',
              citation: 'BPHS Rashi-Nakshatra Gandanta Junction',
            },
            sourceDatasets: [condSource],
            parentEvidenceIds: degId ? [degId] : [],
            derivedFromMetrics: ['longitude_deg'],
            temporalScope: 'natal_invariant',
            referenceDateIso: null,
            verification: condVer,
            sensitivity: { ...ctx.baseSensitivity, sandhiOrBoundaryRisk: true },
          })
        );
      }
    }

    // Graha Yuddha pairs
    for (const pair of asObjArr(localCondData.grahaYuddhaPairs)) {
      const pA = canonicalSubjectPlanet(pair.planetA);
      const pB = canonicalSubjectPlanet(pair.planetB);
      if (!pA || !pB) continue;
      const dA = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${pA}`);
      const dB = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${pB}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'modification',
          observationCode: 'MODIFIER_GRAHA_YUDDHA',
          ruleCode: 'SURYA_SIDDHANTA_GRAHA_YUDDHA',
          qualifier: `${pA}_vs_${pB}`,
          subject: { type: 'planet', id: pA, name: pA },
          relatedEntities: [{ type: 'planet', id: pB, name: pB, role: 'planetary_war_opponent' }],
          secondaryTags: ['graha_yuddha', 'planetary_war'],
          observation: {
            code: 'MODIFIER_GRAHA_YUDDHA',
            label: `Graha Yuddha: ${pA} vs ${pB}`,
            summary: `${pA} vs ${pB} (${numOrNull(pair.separationDeg)?.toFixed(3) ?? '?'}° apart); winner=${
              strOrNull(pair.winner) ?? 'undetermined'
            }`,
            classification: 'graha_yuddha_modifier',
          },
          measurements: [
            { metric: 'separation_deg', value: numOrNull(pair.separationDeg), unit: 'degrees' },
            { metric: 'winner', value: strOrNull(pair.winner), unit: null },
            { metric: 'loser', value: strOrNull(pair.loser), unit: null },
            { metric: 'determination_basis', value: strOrNull(pair.determinationBasis), unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'SURYA_SIDDHANTA_GRAHA_YUDDHA',
            citation: 'Surya Siddhanta Planetary War (< 1° longitude, northern ecliptic latitude wins)',
          },
          sourceDatasets: [condSource],
          parentEvidenceIds: [...(dA ? [dA] : []), ...(dB ? [dB] : [])],
          derivedFromMetrics: ['longitude_deg', 'ecliptic_latitude_deg'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: condVer,
          sensitivity: ctx.baseSensitivity,
        })
      );
    }
  }

  // 6. Advanced Avasthas (Baladi, Jagradadi, Deeptadi) — ALWAYS strictly provisional
  const advEnv = localModules?.advancedAvasthas;
  const advManifest = ctx.manifestByKey.get('advanced_avasthas');
  const advData = asObj(advEnv?.data ?? ext?.advancedAvasthas);
  const advByPlanet = asObj(advData?.byPlanet);

  if (advByPlanet && advData?.valid === true) {
    const advVer = mapEnvelopeVerification(advEnv, advManifest, {
      forceProvisional: true,
      methodologicalOverride: 'contested_or_uncalibrated',
      extraNotes: [
        'Advanced Avasthas (Baladi/Jagradadi/Deeptadi) preserved as provisional pending external reference reconciliation.',
      ],
    });
    const advSource = buildSourceDatasetRef('advanced_avasthas', advEnv, advManifest);

    for (const [rawPlanet, rawAv] of Object.entries(advByPlanet)) {
      const planet = canonicalSubjectPlanet(rawPlanet);
      const av = asObj(rawAv);
      if (!planet || !av) continue;
      const degId = pos.degreeEvidenceIdByKey.get(`vedic_lahiri:${planet}`);

      drafts.push(
        makeDraft(ctx, {
          frame: 'vedic_lahiri',
          family: 'operating_condition',
          observationCode: 'VEDIC_ADVANCED_AVASTHAS',
          ruleCode: 'BPHS_BALADI_JAGRADADI_DEEPTADI',
          subject: { type: 'planet', id: planet, name: planet },
          secondaryTags: ['avastha', 'provisional_avastha'],
          observation: {
            code: 'VEDIC_ADVANCED_AVASTHAS',
            label: `${planet} Baladi / Jagradadi / Deeptadi Avastha`,
            summary: `${planet}: Baladi=${strOrNull(av.baladiAvastha) ?? '?'} (${
              numOrNull(av.baladiStrengthPercent) ?? '?'
            }%), Jagradadi=${strOrNull(av.jagradadiAvastha) ?? '?'}, Deeptadi=${
              strOrNull(av.deeptadiAvastha) ?? '?'
            }`,
            classification: 'planetary_avastha',
          },
          measurements: [
            { metric: 'baladi_avastha', value: strOrNull(av.baladiAvastha), unit: null },
            { metric: 'baladi_strength_percent', value: numOrNull(av.baladiStrengthPercent), unit: 'percent' },
            { metric: 'jagradadi_avastha', value: strOrNull(av.jagradadiAvastha), unit: null },
            { metric: 'deeptadi_avastha', value: strOrNull(av.deeptadiAvastha), unit: null },
          ],
          methodology: vedicMeth,
          ruleReference: {
            sourceType: 'classical',
            referenceCode: 'BPHS_BALADI_JAGRADADI_DEEPTADI',
            citation: 'BPHS Ch. 45 Baladi, Jagradadi & Deeptadi Avasthas',
          },
          sourceDatasets: [advSource],
          parentEvidenceIds: degId ? [degId] : [],
          derivedFromMetrics: ['degree_in_sign', 'dignity'],
          temporalScope: 'natal_invariant',
          referenceDateIso: null,
          verification: advVer,
          sensitivity: {
            ...ctx.baseSensitivity,
            conventionSensitive: true,
            reasons: [...ctx.baseSensitivity.reasons, 'Commentary variance in Jagradadi/Deeptadi rules.'],
          },
        })
      );
    }
  } else {
    ctx.blockedNotices.push({
      frame: 'vedic_lahiri',
      datasetKey: 'advanced_avasthas',
      canonicalStatus: advManifest?.canonicalStatus ?? 'unavailable',
      reason: 'Advanced Avasthas dataset unavailable.',
    });
  }

  return drafts;
}
