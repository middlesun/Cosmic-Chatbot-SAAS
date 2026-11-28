/**
 * K01 Initial Planetary State Population
 *
 * Maps ONLY directly observed facts and measurements from K01 `CanonicalEvidenceObject[]`
 * into the 10-dimension `PlanetaryStateRecord` per celestial body (`Sun`..`Ketu`, `Ascendant`).
 *
 * Strict Guardrails:
 *  - Zero fabricated scores, weights, or PHI heuristics.
 *  - Preserves exact `propagatedTrust` (`usable` vs `provisional` vs `blocked`) on every observation.
 *  - Synthesis-dependent dimensions (`authority`, `resilience`, `functionalOrientation`,
 *    `deliverability`, or any dimension lacking direct observed metrics) stay `status: 'unevaluated'`
 *    with an explicit `unevaluatedReason`.
 */

import {
  PLANETARY_STATE_DIMENSIONS,
  PLANETARY_STATE_SCHEMA_VERSION,
  PLANETARY_STATE_SUBJECTS,
  type CanonicalEvidenceObject,
  type PlanetaryStateDimension,
  type PlanetaryStateDimensionName,
  type PlanetaryStateObservation,
  type PlanetaryStateRecord,
  type PlanetaryStateSubjectName,
} from './types';

function createEmptyDimension(reason: string): PlanetaryStateDimension {
  return {
    status: 'unevaluated',
    supportedEvidenceIds: [],
    directObservations: [],
    unevaluatedReason: reason,
  };
}

const SYNTHESIS_UNAVAILABLE_REASONS: Record<PlanetaryStateDimensionName, string> = {
  capacity: 'No direct quantitative capacity observations extracted.',
  integrity: 'No direct dignity or integrity observations extracted.',
  stability: 'No direct stability or kinematics observations extracted.',
  autonomy: 'No direct dispositor autonomy observations extracted.',
  authority:
    'Awaiting K03 Contextual Evidence Authority Intelligence & Lagna-specific authority synthesis rules.',
  vulnerability: 'No direct combustion, boundary, war, or vulnerability observations extracted.',
  resilience:
    'Awaiting K02 State Intelligence & K05 Interaction recovery/cancellation rules.',
  influenceFootprint:
    'No direct house, cusp, or signification footprint observations extracted (full P08 enrichment deferred to K04 Relational Intelligence).',
  functionalOrientation:
    'Awaiting K03 Contextual Evidence Authority Intelligence (Lagna-specific functional benefic/malefic & yogakaraka orientation rules).',
  deliverability:
    'Awaiting K08 Deliverability Intelligence (KP sub-lord, Bhava Chalit, and strength gating) rules.',
};

function pushObs(
  record: PlanetaryStateRecord,
  dimName: PlanetaryStateDimensionName,
  item: CanonicalEvidenceObject,
  key: string,
  value: number | string | boolean | null,
  unit: string | null = null
): void {
  if (value === null || value === undefined || value === '') return;
  const dim = record.dimensions[dimName];
  dim.status = 'observed_direct_only';
  dim.unevaluatedReason = null;
  if (!dim.supportedEvidenceIds.includes(item.evidenceId)) {
    dim.supportedEvidenceIds.push(item.evidenceId);
  }
  const obs: PlanetaryStateObservation = {
    key,
    value,
    unit,
    sourceEvidenceId: item.evidenceId,
    trust: item.verification.propagatedTrust,
  };
  dim.directObservations.push(obs);
}

function getMetric(
  item: CanonicalEvidenceObject,
  metricName: string
): { value: number | string | boolean | null; unit: string | null } | null {
  const m = item.measurements.find((x) => x.metric === metricName);
  if (!m || m.value === null || m.value === undefined || m.value === '') return null;
  return { value: m.value, unit: m.unit };
}

function isSubjectName(raw: string): raw is PlanetaryStateSubjectName {
  return (PLANETARY_STATE_SUBJECTS as readonly string[]).includes(raw);
}

export function buildInitialPlanetaryStates(
  evidenceItems: CanonicalEvidenceObject[]
): Record<PlanetaryStateSubjectName, PlanetaryStateRecord> {
  const records = {} as Record<PlanetaryStateSubjectName, PlanetaryStateRecord>;

  for (const subject of PLANETARY_STATE_SUBJECTS) {
    const dimensions = {} as Record<PlanetaryStateDimensionName, PlanetaryStateDimension>;
    for (const dim of PLANETARY_STATE_DIMENSIONS) {
      dimensions[dim] = createEmptyDimension(SYNTHESIS_UNAVAILABLE_REASONS[dim]);
    }
    records[subject] = {
      schemaVersion: PLANETARY_STATE_SCHEMA_VERSION,
      planet: subject,
      dimensions,
    };
  }

  for (const item of evidenceItems) {
    // 1. Direct subject observations
    if (
      (item.subject.type === 'planet' || item.subject.type === 'ascendant') &&
      isSubjectName(item.subject.id)
    ) {
      const rec = records[item.subject.id];
      const code = item.observation.code;

      if (code === 'SHADBALA_MAJOR_SIX_BALA') {
        for (const metric of [
          'total_virupas',
          'total_rupas',
          'required_rupas',
          'strength_ratio',
          'rank',
        ]) {
          const m = getMetric(item, metric);
          if (m) pushObs(rec, 'capacity', item, `shadbala_${metric}`, m.value, m.unit);
        }
      } else if (code === 'ISHTA_KASHTA_PHALA') {
        const ishta = getMetric(item, 'ishta_phala');
        const kashta = getMetric(item, 'kashta_phala');
        if (ishta) pushObs(rec, 'capacity', item, 'ishta_phala', ishta.value, ishta.unit);
        if (kashta) pushObs(rec, 'vulnerability', item, 'kashta_phala', kashta.value, kashta.unit);
      } else if (code === 'ASHTAKAVARGA_BHINNA_BAV') {
        const total = getMetric(item, 'total_bindus');
        if (total) pushObs(rec, 'capacity', item, 'bav_total_bindus', total.value, total.unit);
      } else if (code === 'ASHTAKAVARGA_SHODHANA_PINDA') {
        const sp = getMetric(item, 'shodhya_pinda');
        if (sp) pushObs(rec, 'capacity', item, 'shodhya_pinda', sp.value, sp.unit);
      } else if (code === 'VIMSHOPAKA_BALA_SCHEME') {
        const scheme = getMetric(item, 'scheme')?.value;
        const score = getMetric(item, 'score_out_of_20');
        const tier = getMetric(item, 'strength_tier');
        if (score && scheme) {
          pushObs(rec, 'capacity', item, `vimshopaka_${String(scheme)}`, score.value, score.unit);
        }
        if (tier && scheme) {
          pushObs(
            rec,
            'capacity',
            item,
            `vimshopaka_${String(scheme)}_tier`,
            tier.value,
            tier.unit
          );
        }
      } else if (code === 'VEDIC_D1_DIGNITY') {
        const dig = getMetric(item, 'dignity');
        const rel = getMetric(item, 'compound_relation_to_sign_lord');
        if (dig) pushObs(rec, 'integrity', item, 'vedic_d1_dignity', dig.value, dig.unit);
        if (rel) {
          pushObs(
            rec,
            'integrity',
            item,
            'compound_relation_to_sign_lord',
            rel.value,
            rel.unit
          );
        }
      } else if (code === 'WESTERN_ESSENTIAL_DIGNITY') {
        const status = getMetric(item, 'dignity_status');
        const score = getMetric(item, 'essential_score');
        if (status) {
          pushObs(rec, 'integrity', item, 'western_essential_dignity', status.value, status.unit);
        }
        if (score) {
          pushObs(rec, 'integrity', item, 'western_essential_score', score.value, score.unit);
        }
      } else if (code === 'MODIFIER_VARGOTTAMA') {
        pushObs(rec, 'integrity', item, 'is_vargottama', true, null);
      } else if (code === 'VEDIC_VARGA_PLACEMENT') {
        const div = getMetric(item, 'division')?.value;
        const sign = getMetric(item, 'sign');
        const dig = getMetric(item, 'dignity');
        if (div === 'D9' && sign) {
          pushObs(rec, 'integrity', item, 'd9_navamsa_sign', sign.value, sign.unit);
        }
        if (div === 'D9' && dig) {
          pushObs(rec, 'integrity', item, 'd9_navamsa_dignity', dig.value, dig.unit);
        }
      } else if (code === 'VEDIC_ADVANCED_AVASTHAS') {
        for (const metric of ['baladi_avastha', 'jagradadi_avastha', 'deeptadi_avastha']) {
          const m = getMetric(item, metric);
          if (m) pushObs(rec, 'integrity', item, metric, m.value, m.unit);
        }
      } else if (code === 'ASTRONOMICAL_BODY_TELEMETRY') {
        const spd = getMetric(item, 'speed_deg_per_day');
        const motion = getMetric(item, 'motion_state');
        if (spd) pushObs(rec, 'stability', item, 'speed_deg_per_day', spd.value, spd.unit);
        if (motion) pushObs(rec, 'stability', item, 'motion_state', motion.value, motion.unit);
      } else if (code === 'VEDIC_PLANET_OPERATING_CONDITIONS') {
        const retro = getMetric(item, 'is_retrograde');
        const gandanta = getMetric(item, 'is_gandanta');
        const combust = getMetric(item, 'is_combust');
        const yuddha = getMetric(item, 'in_graha_yuddha');
        const yuddhaRole = getMetric(item, 'graha_yuddha_role');
        if (retro) pushObs(rec, 'stability', item, 'is_retrograde', retro.value, retro.unit);
        if (gandanta && gandanta.value === true) {
          pushObs(rec, 'stability', item, 'is_gandanta', true, null);
          pushObs(rec, 'vulnerability', item, 'is_gandanta', true, null);
        }
        if (combust && combust.value === true) {
          pushObs(rec, 'vulnerability', item, 'is_combust', true, null);
        }
        if (yuddha && yuddha.value === true) {
          pushObs(
            rec,
            'vulnerability',
            item,
            'graha_yuddha_role',
            yuddhaRole?.value ?? 'participant',
            null
          );
        }
      } else if (code === 'MODIFIER_COMBUSTION_ASTA') {
        const sep = getMetric(item, 'sun_separation_deg');
        pushObs(rec, 'vulnerability', item, 'is_combust', true, null);
        if (sep) {
          pushObs(rec, 'vulnerability', item, 'sun_separation_deg', sep.value, sep.unit);
        }
      } else if (code === 'MODIFIER_GANDANTA_JUNCTION') {
        pushObs(rec, 'vulnerability', item, 'is_gandanta', true, null);
        pushObs(rec, 'stability', item, 'gandanta_junction_risk', true, null);
      } else if (code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY') {
        const selfDisp = getMetric(item, 'is_self_disposited');
        const termType = getMetric(item, 'termination_type');
        const signLord = getMetric(item, 'sign_lord');
        const finalDisp = getMetric(item, 'final_dispositor');
        if (selfDisp) {
          pushObs(rec, 'autonomy', item, 'is_self_disposited', selfDisp.value, null);
          pushObs(rec, 'stability', item, 'is_self_disposited', selfDisp.value, null);
        }
        if (termType) pushObs(rec, 'autonomy', item, 'dispositor_termination', termType.value, null);
        if (signLord) pushObs(rec, 'autonomy', item, 'sign_dispositor', signLord.value, null);
        if (finalDisp) pushObs(rec, 'autonomy', item, 'final_dispositor', finalDisp.value, null);
      } else if (code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' || code === 'VEDIC_D1_ASCENDANT_SIGN') {
        const sign = getMetric(item, 'sign');
        const house = getMetric(item, 'house');
        if (sign) pushObs(rec, 'influenceFootprint', item, 'vedic_d1_sign', sign.value, null);
        if (house) {
          pushObs(
            rec,
            'influenceFootprint',
            item,
            'vedic_d1_whole_sign_house',
            house.value,
            house.unit
          );
        }
      } else if (code === 'BHAVA_CHALIT_HOUSE_PLACEMENT') {
        const cHouse = getMetric(item, 'chalit_house');
        const shifted = getMetric(item, 'shifted_from_rashi');
        if (cHouse) {
          pushObs(
            rec,
            'influenceFootprint',
            item,
            'sripati_chalit_house',
            cHouse.value,
            cHouse.unit
          );
        }
        if (shifted) {
          pushObs(rec, 'stability', item, 'chalit_shifted_from_rashi', shifted.value, null);
        }
      } else if (code === 'KP_PLACIDUS_HOUSE_PLACEMENT') {
        const kpHouse = getMetric(item, 'kp_house');
        if (kpHouse) {
          pushObs(
            rec,
            'influenceFootprint',
            item,
            'kp_placidus_house',
            kpHouse.value,
            kpHouse.unit
          );
        }
      } else if (code === 'KP_FOUR_LEVEL_SIGNIFICATORS') {
        for (const lvl of ['level_1_houses', 'level_2_houses', 'level_3_houses', 'level_4_houses']) {
          const m = getMetric(item, lvl);
          if (m) pushObs(rec, 'influenceFootprint', item, `kp_${lvl}`, m.value, m.unit);
        }
      } else if (code === 'JAIMINI_CHARA_KARAKA') {
        const role = getMetric(item, 'karaka_role');
        if (role) pushObs(rec, 'influenceFootprint', item, 'jaimini_chara_karaka', role.value, null);
      } else if (code === 'PARIVARTANA_MUTUAL_EXCHANGE') {
        const pType = getMetric(item, 'parivartana_type');
        const div = getMetric(item, 'division')?.value;
        pushObs(
          rec,
          'integrity',
          item,
          `parivartana_${String(div ?? 'D1')}`,
          pType?.value ?? 'exchange',
          null
        );
      }
    }

    // 2. Related-entity observations (house lordships, mutual exchange partners, active doshas, Graha Yuddha opponents)
    if (item.observation.code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT') {
      const hNum = getMetric(item, 'house')?.value;
      const lordRel = item.relatedEntities.find(
        (r) => r.role === 'house_lord' && isSubjectName(r.id)
      );
      if (lordRel && isSubjectName(lordRel.id) && hNum !== null && hNum !== undefined) {
        pushObs(
          records[lordRel.id],
          'influenceFootprint',
          item,
          `rules_vedic_house_${String(hNum)}`,
          Number(hNum),
          'house_number'
        );
      }
    } else if (item.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE') {
      const pType = getMetric(item, 'parivartana_type');
      const div = getMetric(item, 'division')?.value;
      for (const rel of item.relatedEntities) {
        if (rel.role === 'mutual_exchange_partner' && isSubjectName(rel.id)) {
          pushObs(
            records[rel.id],
            'integrity',
            item,
            `parivartana_${String(div ?? 'D1')}`,
            pType?.value ?? 'exchange',
            null
          );
        }
      }
    } else if (item.observation.code === 'DOSHA_EVALUATION') {
      const isPresent = getMetric(item, 'is_present')?.value;
      if (isPresent === true) {
        for (const rel of item.relatedEntities) {
          if (isSubjectName(rel.id)) {
            pushObs(
              records[rel.id],
              'vulnerability',
              item,
              `dosha_${item.subject.name.toLowerCase().replace(/\s+/g, '_')}`,
              true,
              null
            );
          }
        }
      }
    } else if (item.observation.code === 'MODIFIER_GRAHA_YUDDHA') {
      const winner = getMetric(item, 'winner')?.value;
      const loser = getMetric(item, 'loser')?.value;
      if (typeof loser === 'string' && isSubjectName(loser)) {
        pushObs(records[loser], 'vulnerability', item, 'graha_yuddha_loser', true, null);
      }
      if (typeof winner === 'string' && isSubjectName(winner)) {
        pushObs(records[winner], 'stability', item, 'graha_yuddha_winner', true, null);
      }
    }
  }

  return records;
}
