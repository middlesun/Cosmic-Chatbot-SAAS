/**
 * Isolated V2 Engine — Phase 3: FreeAstroAPI Supplementary Compatibility Gates
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 * Enforces mandatory dataset compatibility verification before accepting any
 * supplementary intelligence from FreeAstroAPI (/api/v2/vedic/calculate):
 *  - Ashtakavarga (BAV / SAV = 337 / Prastara contributor reconciliation;
 *    Mean vs True Node explicitly non-invalidating for 7 classical planets;
 *    matching 337 totals alone never treated as proof)
 *  - Bhava Chalit (canonical instant, coords, ayanamsa, longitudes, Asc & MC,
 *    Sripati Bhava Madhya & Sandhi containment; rejects KP Placidus cusp starts)
 *  - D5 Panchamsha & other divisional data (longitudes, Asc, ayanamsa, node
 *    convention, formula establishment, calibrated flag, 6° boundary sensitivity;
 *    preserves distinction rather than silently merging)
 *  - Optional genuinely missing fields (e.g. avasthas) only when compatible
 *
 * Never overwrites AstroWay's primary planetary positions, Shadbala, existing
 * divisional charts, Dasha calculations, KP, or Western datasets.
 */

import { normalizeDeg, SIGNS } from '../jyotishMath';
import { enrichMasterWithPhase4LocalCalculations } from './localVedicMath';
import type {
  AshtakavargaCompatibilityAudit,
  BhavaChalitCompatibilityAudit,
  BhavaChalitFrame,
  CanonicalBirthInstant,
  D5CompatibilityAudit,
  DatasetEnvelope,
  LayerBMasterChartRecord,
  OptionalFieldCompatibilityAudit,
  SanitizedProviderCallRecord,
  SupplementaryIntegrationReport,
  VedicLahiriFrame,
} from './types';
import {
  computeIndependentAstronomicalReference,
  type IndependentAstroReference,
  verifyBhavaChalitMethodology,
} from './verifier';

const CLASSICAL_7_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

const ALL_9_VEDIC_BODIES = [...CLASSICAL_7_PLANETS, 'Rahu', 'Ketu'] as const;

const CLASSICAL_BAV_TOTALS: Record<(typeof CLASSICAL_7_PLANETS)[number], number> = {
  Sun: 48,
  Moon: 49,
  Mars: 39,
  Mercury: 54,
  Jupiter: 56,
  Venus: 52,
  Saturn: 39,
};

const PARASHARI_D5_ODD_OFFSETS = [0, 10, 8, 2, 6] as const; // Aries, Aquarius, Sagittarius, Gemini, Libra
const PARASHARI_D5_EVEN_OFFSETS = [1, 5, 11, 9, 7] as const; // Taurus, Virgo, Pisces, Capricorn, Scorpio

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Array<Record<string, unknown>>)
    : [];
}

function circularDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function normalizeSupplementaryBodyName(raw: unknown): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'sun' || s === 'surya') return 'Sun';
  if (s === 'moon' || s === 'chandra') return 'Moon';
  if (s === 'mars' || s === 'mangal' || s === 'kuja') return 'Mars';
  if (s === 'mercury' || s === 'budha' || s === 'budh') return 'Mercury';
  if (s === 'jupiter' || s === 'guru' || s === 'brihaspati') return 'Jupiter';
  if (s === 'venus' || s === 'shukra') return 'Venus';
  if (s === 'saturn' || s === 'shani') return 'Saturn';
  if (
    s === 'rahu' ||
    s === 'mean node' ||
    s === 'true node' ||
    s === 'north node' ||
    s === 'mean_node' ||
    s === 'true_node' ||
    s === 'north_node'
  ) {
    return 'Rahu';
  }
  if (
    s === 'ketu' ||
    s === 'south node' ||
    s === 'south_node' ||
    s === 'mean south node' ||
    s === 'true south node'
  ) {
    return 'Ketu';
  }
  if (s === 'ascendant' || s === 'asc' || s === 'lagna') return 'Ascendant';
  return String(raw || '').trim();
}

function resolveSignNameFromBody(body: Record<string, unknown> | null | undefined): string | null {
  if (!body) return null;
  const rawSign = typeof body.sign === 'string' ? body.sign.trim() : typeof body.signName === 'string' ? body.signName.trim() : '';
  if (rawSign) {
    const idx = SIGNS.findIndex((s) => s.toLowerCase() === rawSign.toLowerCase());
    if (idx >= 0) return SIGNS[idx];
    return rawSign;
  }
  const lon = Number(body.absolute_degree ?? body.longitude ?? body.degree);
  if (Number.isFinite(lon)) {
    const idx = Math.floor(normalizeDeg(lon) / 30) % 12;
    return SIGNS[idx];
  }
  return null;
}

function resolveSignIndexFromName(signName: string | null | undefined): number | null {
  if (!signName) return null;
  const idx = SIGNS.findIndex((s) => s.toLowerCase() === signName.trim().toLowerCase());
  return idx >= 0 ? idx : null;
}

function resolveLongitudeFromBody(body: Record<string, unknown> | null | undefined): number | null {
  if (!body) return null;
  const candidate = body.absolute_degree ?? body.longitude ?? body.degree;
  if (candidate === null || candidate === undefined || candidate === '') return null;
  const n = Number(candidate);
  return Number.isFinite(n) ? normalizeDeg(n) : null;
}

function extractBodyMap(
  planets: Array<Record<string, unknown>>
): Map<string, { sign: string | null; lon: number | null; raw: Record<string, unknown> }> {
  const out = new Map<string, { sign: string | null; lon: number | null; raw: Record<string, unknown> }>();
  for (const p of planets) {
    const canon = normalizeSupplementaryBodyName(p.name ?? p.planet ?? p.planetName ?? p.id);
    if (!canon) continue;
    if (!out.has(canon)) {
      out.set(canon, {
        sign: resolveSignNameFromBody(p),
        lon: resolveLongitudeFromBody(p),
        raw: p,
      });
    }
  }
  return out;
}

function verifyInstantCoordsAndAyanamsa(
  instant: CanonicalBirthInstant,
  master: LayerBMasterChartRecord,
  suppCall: SanitizedProviderCallRecord | null | undefined,
  suppRaw: Record<string, unknown>
): {
  canonicalBirthInstantCompatible: boolean;
  coordinatesCompatible: boolean;
  ayanamsaCompatible: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const req = asObj(suppCall?.sanitizedRequest) ?? {};

  // 1. Coordinates check
  let coordinatesCompatible = true;
  const reqLat = req.lat !== undefined ? Number(req.lat) : null;
  const reqLng = req.lng !== undefined ? Number(req.lng) : null;
  if (reqLat !== null && Number.isFinite(reqLat)) {
    if (Math.abs(reqLat - instant.input.latitude) > 0.01) {
      coordinatesCompatible = false;
      notes.push(
        `Supplementary request latitude (${reqLat}) diverges from canonical latitude (${instant.input.latitude}).`
      );
    }
  }
  if (reqLng !== null && Number.isFinite(reqLng)) {
    if (Math.abs(reqLng - instant.input.longitude) > 0.01) {
      coordinatesCompatible = false;
      notes.push(
        `Supplementary request longitude (${reqLng}) diverges from canonical longitude (${instant.input.longitude}).`
      );
    }
  }

  // 2. Canonical birth instant check (local IANA or UTC fields on sanitizedRequest)
  let canonicalBirthInstantCompatible = true;
  const hasReqYmd =
    req.year !== undefined &&
    req.month !== undefined &&
    req.day !== undefined &&
    req.hour !== undefined &&
    req.minute !== undefined;
  if (hasReqYmd) {
    const tzStr = typeof req.tz_str === 'string' ? req.tz_str.trim() : '';
    const isUtcReq = tzStr.toUpperCase() === 'UTC';
    const expected = isUtcReq
      ? {
          year: instant.utc.components.year,
          month: instant.utc.components.month,
          day: instant.utc.components.day,
          hour: instant.utc.components.hour,
          minute: instant.utc.components.minute,
          second: instant.utc.components.second,
        }
      : {
          year: instant.input.year,
          month: instant.input.month,
          day: instant.input.day,
          hour: instant.input.hour,
          minute: instant.input.minute,
          second: instant.input.second,
        };
    const reqSec = req.second !== undefined ? Number(req.second) : expected.second;
    const instantMatches =
      Number(req.year) === expected.year &&
      Number(req.month) === expected.month &&
      Number(req.day) === expected.day &&
      Number(req.hour) === expected.hour &&
      Number(req.minute) === expected.minute &&
      Math.abs(reqSec - expected.second) <= 1;
    if (!instantMatches) {
      canonicalBirthInstantCompatible = false;
      notes.push(
        `Supplementary birth timestamp (${req.year}-${req.month}-${req.day} ${req.hour}:${req.minute}:${reqSec} ${tzStr || 'local'}) does not match canonical instant.`
      );
    }
    if (!isUtcReq && instant.timezone.ianaTimezone && tzStr && tzStr !== instant.timezone.ianaTimezone) {
      canonicalBirthInstantCompatible = false;
      notes.push(
        `Supplementary timezone (${tzStr}) does not match canonical IANA timezone (${instant.timezone.ianaTimezone}).`
      );
    }
  }

  // 3. Ayanamsa check
  const primaryAy = String(
    master.frames.vedicLahiri.data?.ayanamshaLabel ||
      master.calculationConventions?.ayanamsa?.vedic ||
      'lahiri'
  )
    .trim()
    .toLowerCase();
  const suppAy = String(suppRaw.ayanamsha ?? req.ayanamsha ?? 'lahiri')
    .trim()
    .toLowerCase();
  const ayanamsaCompatible =
    suppAy.includes('lahiri') && (primaryAy.includes('lahiri') || primaryAy === '1');
  if (!ayanamsaCompatible) {
    notes.push(
      `Supplementary ayanamsha ("${suppAy || 'unspecified'}") is incompatible with primary "${primaryAy}".`
    );
  }

  return {
    canonicalBirthInstantCompatible,
    coordinatesCompatible,
    ayanamsaCompatible,
    notes,
  };
}

function normalize12SignArray(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    if (raw.length !== 12) return null;
    const nums = raw.map((x) => Number(x));
    return nums.every((n) => Number.isFinite(n) && Number.isInteger(n)) ? nums : null;
  }
  const obj = asObj(raw);
  if (obj) {
    const out: number[] = [];
    for (const sign of SIGNS) {
      const val =
        obj[sign] ?? obj[sign.toLowerCase()] ?? obj[sign.slice(0, 3)] ?? obj[sign.slice(0, 3).toLowerCase()];
      const num = Number(val);
      if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
      out.push(num);
    }
    return out;
  }
  return null;
}

function normalizeSupplementaryAshtakavarga(suppRaw: Record<string, unknown>): {
  sarvashtakavarga: number[];
  bhinnashtakavarga: Record<string, number[]>;
  prastharashtakavarga: Record<string, Record<string, number[]>>;
  totalPoints: number | null;
} | null {
  const avRaw = asObj(suppRaw.ashtakavarga);
  if (!avRaw) return null;

  const sav = normalize12SignArray(avRaw.sarvashtakavarga) ?? [];
  const bavRaw = asObj(avRaw.bhinnashtakavarga) ?? {};
  const bhinnashtakavarga: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(bavRaw)) {
    const canon = normalizeSupplementaryBodyName(k);
    const arr = normalize12SignArray(v);
    if (canon && arr) {
      bhinnashtakavarga[canon] = arr;
    }
  }

  const prRaw = asObj(avRaw.prastharashtakavarga) ?? {};
  const prastharashtakavarga: Record<string, Record<string, number[]>> = {};
  for (const [planetKey, matrixVal] of Object.entries(prRaw)) {
    const canonPlanet = normalizeSupplementaryBodyName(planetKey);
    const matrixObj = asObj(matrixVal);
    if (!canonPlanet || !matrixObj) continue;
    const contributors: Record<string, number[]> = {};
    for (const [contribKey, rowVal] of Object.entries(matrixObj)) {
      const canonContrib = normalizeSupplementaryBodyName(contribKey);
      const arr = normalize12SignArray(rowVal);
      if (canonContrib && arr) {
        contributors[canonContrib] = arr;
      }
    }
    if (Object.keys(contributors).length > 0) {
      prastharashtakavarga[canonPlanet] = contributors;
    }
  }

  const tpRaw = avRaw.total_points;
  const totalPoints =
    tpRaw !== null && tpRaw !== undefined && tpRaw !== '' && Number.isFinite(Number(tpRaw))
      ? Number(tpRaw)
      : null;

  return {
    sarvashtakavarga: sav,
    bhinnashtakavarga,
    prastharashtakavarga,
    totalPoints,
  };
}

/**
 * Evaluates whether primary master record already holds a valid 7-planet + 337 SAV Ashtakavarga.
 */
function hasValidPrimaryAshtakavarga(master: LayerBMasterChartRecord): boolean {
  const av = master.frames.vedicLahiri.data?.ashtakavarga;
  if (!av) return false;
  if (!Array.isArray(av.sarvashtakavarga) || av.sarvashtakavarga.length !== 12) return false;
  const savSum = av.sarvashtakavarga.reduce((a, b) => a + Number(b || 0), 0);
  if (savSum !== 337 || av.totalPoints !== 337) return false;
  for (const pl of CLASSICAL_7_PLANETS) {
    const row = av.bhinnashtakavarga?.[pl];
    if (!Array.isArray(row) || row.length !== 12) return false;
    const rowSum = row.reduce((a, b) => a + Number(b || 0), 0);
    if (rowSum !== CLASSICAL_BAV_TOTALS[pl]) return false;
  }
  return true;
}

/**
 * Mandatory Compatibility Gate 1 — Ashtakavarga (BAV / SAV / Prastara)
 */
export function evaluateAshtakavargaCompatibility(
  master: LayerBMasterChartRecord,
  suppRaw: Record<string, unknown> | null,
  suppCall?: SanitizedProviderCallRecord | null
): {
  audit: AshtakavargaCompatibilityAudit;
  normalizedSupplementaryAv: VedicLahiriFrame['ashtakavarga'] | null;
} {
  const primaryAlreadyValid = hasValidPrimaryAshtakavarga(master);
  const primaryVedic = master.frames.vedicLahiri.data;

  if (!suppRaw || !asObj(suppRaw.ashtakavarga)) {
    return {
      audit: {
        outcome: primaryAlreadyValid ? 'preserved_primary_cross_verified' : 'unavailable',
        recommendedState: primaryAlreadyValid ? 'available' : 'unavailable',
        primaryAlreadyHadValidAshtakavarga: primaryAlreadyValid,
        sevenClassicalPlanetSignsMatch: false,
        ascendantSignMatches: false,
        planetSignMismatches: [],
        ascendantSignComparison: {
          primarySign: resolveSignNameFromBody(primaryVedic?.ascendant),
          supplementarySign: null,
        },
        nodeConventionNote:
          'Supplementary Ashtakavarga absent; Rahu/Ketu are not Ashtakavarga contributors.',
        nodeSignOrLongitudeDiffs: [],
        conventionsCompatible: false,
        classicalPlanetTotalsMatch: false,
        perPlanetTotalChecks: [],
        savTotalEquals337: false,
        observedSavSum: null,
        observedTotalPointsField: null,
        bavToSavReconciliationPassed: false,
        bavToSavMismatches: [],
        prastaraAvailable: false,
        prastaraReconciliationPassed: null,
        prastaraMismatches: [],
        totalsAloneRejectedNotice: false,
        reasons: ['FreeAstroAPI supplementary response has no Ashtakavarga payload.'],
      },
      normalizedSupplementaryAv: null,
    };
  }

  const suppChart = asObj(suppRaw.chart) ?? {};
  const suppBodyMap = extractBodyMap(asObjArr(suppChart.planets));
  const primaryBodyMap = extractBodyMap(primaryVedic?.planets ?? []);

  // 1. Check 7 classical planet signs & separately track Mean vs True Node differences
  const planetSignMismatches: AshtakavargaCompatibilityAudit['planetSignMismatches'] = [];
  for (const pl of CLASSICAL_7_PLANETS) {
    const pSign = primaryBodyMap.get(pl)?.sign ?? null;
    const sSign = suppBodyMap.get(pl)?.sign ?? null;
    if (!pSign || !sSign || pSign.toLowerCase() !== sSign.toLowerCase()) {
      planetSignMismatches.push({ planet: pl, primarySign: pSign, supplementarySign: sSign });
    }
  }
  const sevenClassicalPlanetSignsMatch = planetSignMismatches.length === 0;

  const nodeSignOrLongitudeDiffs: AshtakavargaCompatibilityAudit['nodeSignOrLongitudeDiffs'] = [];
  for (const nodeName of ['Rahu', 'Ketu'] as const) {
    const pNode = primaryBodyMap.get(nodeName);
    const sNode = suppBodyMap.get(nodeName);
    const deltaDeg =
      pNode?.lon !== null && pNode?.lon !== undefined && sNode?.lon !== null && sNode?.lon !== undefined
        ? Number(Math.abs(circularDiffDeg(pNode.lon, sNode.lon)).toFixed(4))
        : null;
    nodeSignOrLongitudeDiffs.push({
      planet: nodeName,
      primarySign: pNode?.sign ?? null,
      supplementarySign: sNode?.sign ?? null,
      deltaDeg,
    });
  }
  const hasNodeSignDiff = nodeSignOrLongitudeDiffs.some(
    (d) =>
      (d.primarySign && d.supplementarySign && d.primarySign !== d.supplementarySign) ||
      (d.deltaDeg !== null && d.deltaDeg > 0.2)
  );
  const nodeConventionNote = hasNodeSignDiff
    ? 'Mean vs True Node difference observed between primary and supplementary nodes; explicitly ignored for 7-planet Ashtakavarga because Rahu and Ketu are not contributors.'
    : 'Nodes consistent (note: Mean vs True Node differences do not invalidate standard 7-planet Ashtakavarga).';

  // 2. Check Ascendant sign match
  const primaryAscSign = resolveSignNameFromBody(primaryVedic?.ascendant);
  const suppAscSign = resolveSignNameFromBody(asObj(suppChart.ascendant));
  const ascendantSignMatches =
    Boolean(primaryAscSign && suppAscSign) &&
    primaryAscSign!.toLowerCase() === suppAscSign!.toLowerCase();

  // 3. Check conventions & normalize BAV/SAV/Prastara
  const reqMeta = verifyInstantCoordsAndAyanamsa(
    master.canonicalBirthInstant,
    master,
    suppCall,
    suppRaw
  );
  const normAv = normalizeSupplementaryAshtakavarga(suppRaw);
  const savOkLen = Boolean(normAv && normAv.sarvashtakavarga.length === 12);
  const all7BavPresent = Boolean(
    normAv &&
      CLASSICAL_7_PLANETS.every(
        (pl) =>
          Array.isArray(normAv.bhinnashtakavarga[pl]) &&
          normAv.bhinnashtakavarga[pl].length === 12 &&
          normAv.bhinnashtakavarga[pl].every((v) => v >= 0 && v <= 8)
      )
  );
  const conventionsCompatible =
    reqMeta.ayanamsaCompatible &&
    reqMeta.coordinatesCompatible &&
    reqMeta.canonicalBirthInstantCompatible &&
    savOkLen &&
    all7BavPresent;

  // 4. Individual planetary bindu totals
  const perPlanetTotalChecks: AshtakavargaCompatibilityAudit['perPlanetTotalChecks'] = [];
  for (const pl of CLASSICAL_7_PLANETS) {
    const row = normAv?.bhinnashtakavarga[pl];
    const obsTotal = row ? row.reduce((a, b) => a + b, 0) : null;
    const expected = CLASSICAL_BAV_TOTALS[pl];
    perPlanetTotalChecks.push({
      planet: pl,
      observedTotal: obsTotal,
      expectedClassicalTotal: expected,
      matched: obsTotal === expected,
    });
  }
  const classicalPlanetTotalsMatch = perPlanetTotalChecks.every((c) => c.matched);

  // 5. Standard unreduced SAV total === 337
  const observedSavSum =
    normAv && normAv.sarvashtakavarga.length === 12
      ? normAv.sarvashtakavarga.reduce((a, b) => a + b, 0)
      : null;
  const observedTotalPointsField = normAv?.totalPoints ?? null;
  const savTotalEquals337 =
    observedSavSum === 337 &&
    (observedTotalPointsField === null || observedTotalPointsField === 337);

  // 6. Sign-by-sign BAV -> SAV reconciliation
  const bavToSavMismatches: AshtakavargaCompatibilityAudit['bavToSavMismatches'] = [];
  if (normAv && savOkLen && all7BavPresent) {
    for (let i = 0; i < 12; i++) {
      const colSum = CLASSICAL_7_PLANETS.reduce(
        (s, pl) => s + Number(normAv.bhinnashtakavarga[pl][i] ?? 0),
        0
      );
      const savVal = Number(normAv.sarvashtakavarga[i] ?? -1);
      if (colSum !== savVal) {
        bavToSavMismatches.push({
          signIndex: i,
          sign: SIGNS[i],
          bavColumnSum: colSum,
          savValue: savVal,
        });
      }
    }
  }
  const bavToSavReconciliationPassed = savOkLen && all7BavPresent && bavToSavMismatches.length === 0;

  // 7. Prastara contributor-level reconciliation (when available)
  const prastaraKeys = normAv ? Object.keys(normAv.prastharashtakavarga) : [];
  const prastaraAvailable = prastaraKeys.length > 0;
  const prastaraMismatches: string[] = [];
  let prastaraReconciliationPassed: boolean | null = null;
  if (prastaraAvailable && normAv) {
    const expectedContributors = [...CLASSICAL_7_PLANETS, 'Ascendant'];
    for (const pl of CLASSICAL_7_PLANETS) {
      const mat = normAv.prastharashtakavarga[pl];
      const bavRow = normAv.bhinnashtakavarga[pl];
      if (!mat) {
        prastaraMismatches.push(`Missing Prastara matrix for ${pl}.`);
        continue;
      }
      if (!bavRow) continue;
      for (const contrib of expectedContributors) {
        const cRow = mat[contrib];
        if (!cRow || cRow.length !== 12) {
          prastaraMismatches.push(`Prastara ${pl} missing 12-sign row for contributor ${contrib}.`);
        } else if (cRow.some((v) => v !== 0 && v !== 1)) {
          prastaraMismatches.push(`Prastara ${pl}/${contrib} contains non-binary contributor bindu values.`);
        }
      }
      for (let i = 0; i < 12; i++) {
        const contribSum = Object.values(mat).reduce((s, row) => s + Number(row[i] ?? 0), 0);
        if (contribSum !== bavRow[i]) {
          prastaraMismatches.push(
            `Prastara ${pl} sign ${SIGNS[i]} contributor sum (${contribSum}) != BAV (${bavRow[i]}).`
          );
        }
      }
    }
    prastaraReconciliationPassed = prastaraMismatches.length === 0;
  }

  const allChecksPassed =
    sevenClassicalPlanetSignsMatch &&
    ascendantSignMatches &&
    conventionsCompatible &&
    classicalPlanetTotalsMatch &&
    savTotalEquals337 &&
    bavToSavReconciliationPassed &&
    (prastaraReconciliationPassed === null || prastaraReconciliationPassed === true);

  // Explicit guard: matching 337 total alone NEVER suffices when sign/BAV/Prastara gates fail
  const totalsAloneRejectedNotice = savTotalEquals337 && !allChecksPassed;

  const reasons: string[] = [...reqMeta.notes];
  if (!sevenClassicalPlanetSignsMatch) {
    reasons.push(
      `7 classical planet sign mismatch: ${planetSignMismatches
        .map((m) => `${m.planet}(${m.primarySign} vs ${m.supplementarySign})`)
        .join(', ')}.`
    );
  }
  if (!ascendantSignMatches) {
    reasons.push(
      `Ascendant sign mismatch: primary=${primaryAscSign || 'missing'} vs supplementary=${suppAscSign || 'missing'}.`
    );
  }
  if (!classicalPlanetTotalsMatch) {
    const failedTotals = perPlanetTotalChecks
      .filter((c) => !c.matched)
      .map((c) => `${c.planet}:${c.observedTotal}!=expected(${c.expectedClassicalTotal})`);
    reasons.push(`Classical planetary BAV bindu total failure: ${failedTotals.join(', ')}.`);
  }
  if (!savTotalEquals337) {
    reasons.push(
      `SAV failed standard 337 total (sum=${observedSavSum}, total_points=${observedTotalPointsField}).`
    );
  }
  if (!bavToSavReconciliationPassed && bavToSavMismatches.length > 0) {
    reasons.push(
      `BAV-to-SAV sign sum mismatches (${bavToSavMismatches.length} signs, e.g. ${bavToSavMismatches[0].sign}: sum=${bavToSavMismatches[0].bavColumnSum} vs SAV=${bavToSavMismatches[0].savValue}).`
    );
  }
  if (prastaraReconciliationPassed === false) {
    reasons.push(`Prastara contributor reconciliation failed: ${prastaraMismatches.slice(0, 3).join(' ')}`);
  }
  if (totalsAloneRejectedNotice) {
    reasons.push(
      'Rejected despite matching 337 SAV total because matching totals alone are insufficient without sign identity, BAV-to-SAV, and Prastara reconciliation.'
    );
  }

  let outcome: AshtakavargaCompatibilityAudit['outcome'];
  let recommendedState: AshtakavargaCompatibilityAudit['recommendedState'];

  if (!allChecksPassed) {
    outcome = primaryAlreadyValid ? 'preserved_primary_cross_verified' : 'rejected_incompatible';
    recommendedState = primaryAlreadyValid ? 'available' : 'incompatible';
  } else if (primaryAlreadyValid) {
    outcome = 'preserved_primary_cross_verified';
    recommendedState = 'available';
    reasons.push('Primary AstroWay Ashtakavarga preserved without overwrite; supplementary FreeAstroAPI Ashtakavarga cross-verified cleanly.');
  } else {
    outcome = 'accepted';
    recommendedState = prastaraAvailable ? 'internally_verified' : 'provisional';
    reasons.push(
      prastaraAvailable
        ? 'Supplementary FreeAstroAPI BAV/SAV/Prastara passed all compatibility & reconciliation gates and was adopted cleanly.'
        : 'Supplementary FreeAstroAPI BAV/SAV passed all compatibility gates (adopted as provisional without Prastara matrix).'
    );
  }

  return {
    audit: {
      outcome,
      recommendedState,
      primaryAlreadyHadValidAshtakavarga: primaryAlreadyValid,
      sevenClassicalPlanetSignsMatch,
      ascendantSignMatches,
      planetSignMismatches,
      ascendantSignComparison: {
        primarySign: primaryAscSign,
        supplementarySign: suppAscSign,
      },
      nodeConventionNote,
      nodeSignOrLongitudeDiffs,
      conventionsCompatible,
      classicalPlanetTotalsMatch,
      perPlanetTotalChecks,
      savTotalEquals337,
      observedSavSum,
      observedTotalPointsField,
      bavToSavReconciliationPassed,
      bavToSavMismatches,
      prastaraAvailable,
      prastaraReconciliationPassed,
      prastaraMismatches,
      totalsAloneRejectedNotice,
      reasons,
    },
    normalizedSupplementaryAv:
      allChecksPassed && normAv
        ? {
            sarvashtakavarga: normAv.sarvashtakavarga,
            bhinnashtakavarga: normAv.bhinnashtakavarga,
            prastharashtakavarga: normAv.prastharashtakavarga,
            totalPoints: observedSavSum ?? 337,
          }
        : null,
  };
}

/**
 * Mandatory Compatibility Gate 2 — Bhava Chalit (Sripati Bhava Madhya & Sandhi Boundaries)
 */
export function evaluateBhavaChalitCompatibility(
  master: LayerBMasterChartRecord,
  suppRaw: Record<string, unknown> | null,
  suppCall: SanitizedProviderCallRecord | null | undefined,
  indepRef: IndependentAstroReference
): {
  audit: BhavaChalitCompatibilityAudit;
  frameData: BhavaChalitFrame | null;
} {
  const suppBcRaw = suppRaw
    ? asObj(suppRaw.bhava_chalit) ?? asObj(asObj(suppRaw.chart)?.bhava_chalit)
    : null;

  if (!suppRaw || !suppBcRaw) {
    return {
      audit: {
        outcome: 'unavailable',
        recommendedState: 'unavailable',
        canonicalBirthInstantCompatible: false,
        coordinatesCompatible: false,
        ayanamsaCompatible: false,
        classicalPlanetLongitudesCompatible: false,
        maxClassicalPlanetDeltaDeg: null,
        nodeLongitudesDeltaDeg: { rahu: null, ketu: null },
        ascendantCompatible: false,
        ascendantDeltaDeg: null,
        mcCompatible: false,
        h10MidpointVsRefMcDeltaDeg: null,
        sripatiConventionCompatible: false,
        kpPlacidusConfusionDetected: false,
        methodologyAudit: null,
        reasons: ['FreeAstroAPI supplementary response has no Bhava Chalit dataset.'],
      },
      frameData: null,
    };
  }

  const reqMeta = verifyInstantCoordsAndAyanamsa(
    master.canonicalBirthInstant,
    master,
    suppCall,
    suppRaw
  );
  const reasons: string[] = [...reqMeta.notes];

  const primaryVedic = master.frames.vedicLahiri.data;
  const primaryBodyMap = extractBodyMap(primaryVedic?.planets ?? []);
  const suppChart = asObj(suppRaw.chart) ?? {};
  const suppD1BodyMap = extractBodyMap(asObjArr(suppChart.planets));
  const bcBodyMap = extractBodyMap(asObjArr(suppBcRaw.planets));

  // Compare planetary longitudes against Primary D1 (using supplementary D1 and Bhava Chalit planets)
  let maxClassicalDelta: number | null = null;
  let classicalPlanetLongitudesCompatible = true;
  for (const pl of CLASSICAL_7_PLANETS) {
    const pLon = primaryBodyMap.get(pl)?.lon ?? null;
    const sLon = suppD1BodyMap.get(pl)?.lon ?? bcBodyMap.get(pl)?.lon ?? null;
    const bcLon = bcBodyMap.get(pl)?.lon ?? null;
    if (pLon === null || sLon === null) {
      classicalPlanetLongitudesCompatible = false;
      reasons.push(`Missing longitude comparison for classical planet ${pl}.`);
      continue;
    }
    const delta = Math.abs(circularDiffDeg(pLon, sLon));
    if (maxClassicalDelta === null || delta > maxClassicalDelta) {
      maxClassicalDelta = Number(delta.toFixed(4));
    }
    if (delta > 0.2) {
      classicalPlanetLongitudesCompatible = false;
      reasons.push(`Classical planet ${pl} longitude delta (${delta.toFixed(4)}°) exceeds 0.20° tolerance.`);
    }
    if (bcLon !== null && Math.abs(circularDiffDeg(pLon, bcLon)) > 0.2) {
      classicalPlanetLongitudesCompatible = false;
      reasons.push(
        `Bhava Chalit ${pl} longitude (${bcLon.toFixed(4)}°) diverges from primary (${pLon.toFixed(4)}°).`
      );
    }
  }

  const calcNodeDelta = (name: 'Rahu' | 'Ketu'): number | null => {
    const p = primaryBodyMap.get(name)?.lon;
    const s = suppD1BodyMap.get(name)?.lon ?? bcBodyMap.get(name)?.lon;
    return p !== null && p !== undefined && s !== null && s !== undefined
      ? Number(Math.abs(circularDiffDeg(p, s)).toFixed(4))
      : null;
  };
  const nodeLongitudesDeltaDeg = {
    rahu: calcNodeDelta('Rahu'),
    ketu: calcNodeDelta('Ketu'),
  };

  // Ascendant check (primary D1 ascendant vs supplementary D1 ascendant & Bhava Chalit ascendant / H1 cusp)
  const primaryAscLon = resolveLongitudeFromBody(primaryVedic?.ascendant);
  const suppD1AscLon = resolveLongitudeFromBody(asObj(suppChart.ascendant));
  const suppBcHouses = asObjArr(suppBcRaw.houses);
  const bcH1Cusp = Number(suppBcHouses.find((h) => Number(h.house) === 1)?.degree_cusp);
  const bcAscLon =
    resolveLongitudeFromBody(asObj(suppBcRaw.ascendant)) ??
    (Number.isFinite(bcH1Cusp) ? normalizeDeg(bcH1Cusp) : null) ??
    suppD1AscLon;

  let ascendantDeltaDeg: number | null = null;
  let ascendantCompatible = false;
  if (primaryAscLon !== null && suppD1AscLon !== null) {
    ascendantDeltaDeg = Number(Math.abs(circularDiffDeg(primaryAscLon, suppD1AscLon)).toFixed(4));
    const bcVsPrimaryDelta =
      bcAscLon !== null ? Math.abs(circularDiffDeg(primaryAscLon, bcAscLon)) : 0;
    ascendantCompatible = ascendantDeltaDeg <= 0.25 && bcVsPrimaryDelta <= 0.25;
    if (!ascendantCompatible) {
      reasons.push(
        `Ascendant longitude delta exceeds tolerance (primary=${primaryAscLon.toFixed(4)}°, suppD1=${suppD1AscLon.toFixed(4)}°, bcAsc=${bcAscLon?.toFixed(4) ?? 'N/A'}°).`
      );
    }
  } else {
    reasons.push('Ascendant longitude missing on primary or supplementary chart.');
  }

  // MC / H10 Bhava Madhya check against independent Sripati reference & primary sidereal MC (if available)
  const bcH10Raw = Number(suppBcHouses.find((h) => Number(h.house) === 10)?.degree_cusp);
  const primarySiderealAngles = asObj(master.frames.astronomicalTelemetry.data?.angles);
  const primarySiderealMc = Number(primarySiderealAngles?.mc ?? primarySiderealAngles?.midheaven);
  let h10MidpointVsRefMcDeltaDeg: number | null = null;
  let mcCompatible = false;
  if (Number.isFinite(bcH10Raw)) {
    const h10Norm = normalizeDeg(bcH10Raw);
    h10MidpointVsRefMcDeltaDeg = Number(
      Math.abs(circularDiffDeg(h10Norm, indepRef.lahiriMcDeg)).toFixed(4)
    );
    const primaryMcOk =
      !Number.isFinite(primarySiderealMc) ||
      Math.abs(circularDiffDeg(h10Norm, normalizeDeg(primarySiderealMc))) <= 0.3;
    mcCompatible = h10MidpointVsRefMcDeltaDeg <= 1.0 && primaryMcOk;
    if (!mcCompatible) {
      reasons.push(
        `Bhava Chalit H10 Bhava Madhya (${h10Norm.toFixed(4)}°) diverges from reference Lahiri MC (${indepRef.lahiriMcDeg.toFixed(4)}°, delta=${h10MidpointVsRefMcDeltaDeg}°).`
      );
    }
  } else {
    reasons.push('Bhava Chalit House 10 degree_cusp (MC Bhava Madhya) missing.');
  }

  // Sripati convention & KP Placidus cusp-start confusion check
  const houseBasis = typeof suppBcRaw.house_basis === 'string' ? suppBcRaw.house_basis.trim() : '';
  const lowerBasis = houseBasis.toLowerCase();
  const explicitNonSripatiBasis =
    lowerBasis.includes('placidus') ||
    lowerBasis.includes('kp') ||
    lowerBasis.includes('cusp_start') ||
    lowerBasis.includes('whole_sign') ||
    lowerBasis.includes('equal');

  let cuspEqualsBoundaryStartCount = 0;
  for (const h of suppBcHouses) {
    const cusp = Number(h.degree_cusp);
    const bStart = Number(h.boundary_start);
    if (Number.isFinite(cusp) && Number.isFinite(bStart)) {
      if (Math.abs(circularDiffDeg(cusp, bStart)) < 1.0) {
        cuspEqualsBoundaryStartCount++;
      }
    }
  }
  const methodologyAudit = verifyBhavaChalitMethodology(suppBcRaw, indepRef);
  const kpPlacidusConfusionDetected =
    explicitNonSripatiBasis || cuspEqualsBoundaryStartCount >= 6;
  const sripatiConventionCompatible =
    !kpPlacidusConfusionDetected &&
    methodologyAudit.compatibleWithIntendedClassicalMethodology;

  if (kpPlacidusConfusionDetected) {
    reasons.push(
      `KP Placidus / cusp-start confusion detected (house_basis="${houseBasis || 'unspecified'}", cusp==boundaryStart in ${cuspEqualsBoundaryStartCount}/12 houses). Rejected as classical Sripati Bhava Chalit.`
    );
  }
  if (!methodologyAudit.compatibleWithIntendedClassicalMethodology) {
    reasons.push(...methodologyAudit.notes);
  }

  const compatible =
    reqMeta.canonicalBirthInstantCompatible &&
    reqMeta.coordinatesCompatible &&
    reqMeta.ayanamsaCompatible &&
    classicalPlanetLongitudesCompatible &&
    ascendantCompatible &&
    mcCompatible &&
    sripatiConventionCompatible;

  const frameData: BhavaChalitFrame = {
    chartType: typeof suppBcRaw.chart_type === 'string' ? suppBcRaw.chart_type : null,
    name: typeof suppBcRaw.name === 'string' ? suppBcRaw.name : null,
    calibrated: typeof suppBcRaw.calibrated === 'boolean' ? suppBcRaw.calibrated : null,
    houseBasis: houseBasis || null,
    ascendant: asObj(suppBcRaw.ascendant),
    houses: suppBcHouses,
    planets: asObjArr(suppBcRaw.planets),
    methodologyAudit: {
      ...methodologyAudit,
      compatibleWithIntendedClassicalMethodology: compatible,
      notes: compatible
        ? methodologyAudit.notes
        : Array.from(new Set([...methodologyAudit.notes, ...reasons])),
    },
  };

  return {
    audit: {
      outcome: compatible ? 'accepted' : 'rejected_incompatible',
      recommendedState: compatible ? 'internally_verified' : 'incompatible',
      canonicalBirthInstantCompatible: reqMeta.canonicalBirthInstantCompatible,
      coordinatesCompatible: reqMeta.coordinatesCompatible,
      ayanamsaCompatible: reqMeta.ayanamsaCompatible,
      classicalPlanetLongitudesCompatible,
      maxClassicalPlanetDeltaDeg: maxClassicalDelta,
      nodeLongitudesDeltaDeg,
      ascendantCompatible,
      ascendantDeltaDeg,
      mcCompatible,
      h10MidpointVsRefMcDeltaDeg,
      sripatiConventionCompatible,
      kpPlacidusConfusionDetected,
      methodologyAudit: frameData.methodologyAudit,
      reasons: compatible
        ? ['Supplementary FreeAstroAPI Bhava Chalit passed all instant, coordinate, longitude, MC/Asc, and Sripati midpoint checks.']
        : reasons,
    },
    frameData,
  };
}

function computeParashariD5SignIdx(lon: number): number {
  const nLon = normalizeDeg(lon);
  const signIdx = Math.floor(nLon / 30) % 12;
  const part = Math.min(4, Math.floor((nLon % 30) / 6));
  return signIdx % 2 === 0
    ? PARASHARI_D5_ODD_OFFSETS[part]
    : PARASHARI_D5_EVEN_OFFSETS[part];
}

function computeCyclicalD5SignIdx(lon: number): number {
  const nLon = normalizeDeg(lon);
  const signIdx = Math.floor(nLon / 30) % 12;
  const part = Math.min(4, Math.floor((nLon % 30) / 6));
  return (signIdx * 5 + part) % 12;
}

/**
 * Mandatory Compatibility Gate 3 — D5 Panchamsha (and divisional method verification)
 */
export function evaluateD5DivisionalCompatibility(
  master: LayerBMasterChartRecord,
  suppRaw: Record<string, unknown> | null,
  suppCall?: SanitizedProviderCallRecord | null
): {
  audit: D5CompatibilityAudit;
  d5Chart: Record<string, unknown> | null;
} {
  const vargasNode = asObj(suppRaw?.vargas);
  const vargasDict = asObj(vargasNode?.vargas) ?? {};
  const d5Raw = asObj(vargasDict.D5 ?? vargasDict['5'] ?? vargasDict.d5);

  if (!suppRaw || !d5Raw) {
    return {
      audit: {
        outcome: 'unavailable',
        recommendedState: 'unavailable',
        longitudesCompatible: false,
        maxClassicalPlanetDeltaDeg: null,
        ascendantCompatible: false,
        ascendantDeltaDeg: null,
        ayanamsaCompatible: false,
        nodeConventionCompatible: false,
        nodeDeltaDeg: { rahu: null, ketu: null },
        providerCalibratedFlag: null,
        detectedFormula: 'unavailable',
        formulaMatchCount: 0,
        formulaCheckedCount: 0,
        boundarySensitiveBodies: [],
        preservesMethodDistinction: true,
        reasons: ['FreeAstroAPI supplementary response has no D5 Panchamsha chart.'],
      },
      d5Chart: null,
    };
  }

  const reqMeta = verifyInstantCoordsAndAyanamsa(
    master.canonicalBirthInstant,
    master,
    suppCall,
    suppRaw
  );
  const reasons: string[] = [...reqMeta.notes];

  const primaryVedic = master.frames.vedicLahiri.data;
  const primaryBodyMap = extractBodyMap(primaryVedic?.planets ?? []);
  const suppChart = asObj(suppRaw.chart) ?? {};
  const suppBodyMap = extractBodyMap(asObjArr(suppChart.planets));

  // 1. Classical planetary longitudes compatibility
  let maxClassicalDelta: number | null = null;
  let longitudesCompatible = true;
  for (const pl of CLASSICAL_7_PLANETS) {
    const pLon = primaryBodyMap.get(pl)?.lon ?? null;
    const sLon = suppBodyMap.get(pl)?.lon ?? null;
    if (pLon === null || sLon === null) {
      longitudesCompatible = false;
      reasons.push(`D5 longitude check missing ${pl} on primary or supplementary D1.`);
      continue;
    }
    const delta = Math.abs(circularDiffDeg(pLon, sLon));
    if (maxClassicalDelta === null || delta > maxClassicalDelta) {
      maxClassicalDelta = Number(delta.toFixed(4));
    }
    if (delta > 0.2) {
      longitudesCompatible = false;
      reasons.push(`D5 classical planet ${pl} longitude delta (${delta.toFixed(4)}°) exceeds 0.20°.`);
    }
  }

  // 2. Ascendant longitude compatibility
  const primaryAscLon = resolveLongitudeFromBody(primaryVedic?.ascendant);
  const suppAscLon = resolveLongitudeFromBody(asObj(suppChart.ascendant));
  let ascendantDeltaDeg: number | null = null;
  let ascendantCompatible = false;
  if (primaryAscLon !== null && suppAscLon !== null) {
    ascendantDeltaDeg = Number(Math.abs(circularDiffDeg(primaryAscLon, suppAscLon)).toFixed(4));
    ascendantCompatible = ascendantDeltaDeg <= 0.25;
    if (!ascendantCompatible) {
      reasons.push(`D5 Ascendant longitude delta (${ascendantDeltaDeg}°) exceeds 0.25°.`);
    }
  } else {
    reasons.push('D5 Ascendant longitude missing on primary or supplementary chart.');
  }

  // 3. Node convention compatibility (Mean vs True node DOES affect D5 if Rahu/Ketu differ)
  const suppNodeType = String(
    asObj(suppChart.metadata)?.node_type ??
      asObj(suppCall?.sanitizedRequest)?.node_type ??
      master.canonicalBirthInstant.input.nodeConvention
  )
    .trim()
    .toLowerCase();
  const rahuDelta =
    primaryBodyMap.get('Rahu')?.lon !== null &&
    primaryBodyMap.get('Rahu')?.lon !== undefined &&
    suppBodyMap.get('Rahu')?.lon !== null &&
    suppBodyMap.get('Rahu')?.lon !== undefined
      ? Number(
          Math.abs(circularDiffDeg(primaryBodyMap.get('Rahu')!.lon!, suppBodyMap.get('Rahu')!.lon!)).toFixed(4)
        )
      : null;
  const ketuDelta =
    primaryBodyMap.get('Ketu')?.lon !== null &&
    primaryBodyMap.get('Ketu')?.lon !== undefined &&
    suppBodyMap.get('Ketu')?.lon !== null &&
    suppBodyMap.get('Ketu')?.lon !== undefined
      ? Number(
          Math.abs(circularDiffDeg(primaryBodyMap.get('Ketu')!.lon!, suppBodyMap.get('Ketu')!.lon!)).toFixed(4)
        )
      : null;
  const primaryNodeRequested = master.canonicalBirthInstant.input.nodeConvention;
  const nodeConventionCompatible =
    (rahuDelta === null || rahuDelta <= 0.2) &&
    (ketuDelta === null || ketuDelta <= 0.2) &&
    (suppNodeType === primaryNodeRequested || suppNodeType === '');
  if (!nodeConventionCompatible) {
    reasons.push(
      `D5 Node convention sensitivity: Rahu delta=${rahuDelta ?? 'N/A'}°, Ketu delta=${ketuDelta ?? 'N/A'}°, suppNodeType="${suppNodeType}".`
    );
  }

  // 4. Calibrated flag & formula establishment
  const d5Meta = asObj(d5Raw.metadata) ?? {};
  const providerCalibratedFlag =
    typeof d5Raw.calibrated === 'boolean'
      ? d5Raw.calibrated
      : typeof d5Meta.calibrated === 'boolean'
      ? d5Meta.calibrated
      : null;

  const d5BodySigns = new Map<string, number>();
  const d5AscSign = resolveSignIndexFromName(resolveSignNameFromBody(asObj(d5Raw.ascendant)));
  if (d5AscSign !== null) d5BodySigns.set('Ascendant', d5AscSign);
  for (const dp of asObjArr(d5Raw.planets)) {
    const canon = normalizeSupplementaryBodyName(dp.name ?? dp.planet);
    const sIdx = resolveSignIndexFromName(resolveSignNameFromBody(dp));
    if (canon && sIdx !== null) {
      d5BodySigns.set(canon, sIdx);
    }
  }

  let parashariMatches = 0;
  let cyclicalMatches = 0;
  let formulaCheckedCount = 0;

  const evalFormulaEntry = (body: string, suppLon: number | null) => {
    const obsSign = d5BodySigns.get(body);
    if (obsSign === undefined || suppLon === null) return;
    formulaCheckedCount++;
    if (computeParashariD5SignIdx(suppLon) === obsSign) parashariMatches++;
    if (computeCyclicalD5SignIdx(suppLon) === obsSign) cyclicalMatches++;
  };

  evalFormulaEntry('Ascendant', suppAscLon);
  for (const body of ALL_9_VEDIC_BODIES) {
    evalFormulaEntry(body, suppBodyMap.get(body)?.lon ?? null);
  }

  let detectedFormula: D5CompatibilityAudit['detectedFormula'] = 'unestablished_unknown';
  let formulaMatchCount = 0;
  if (formulaCheckedCount >= 7) {
    if (parashariMatches === formulaCheckedCount && parashariMatches >= cyclicalMatches) {
      detectedFormula = 'parashari_odd_even';
      formulaMatchCount = parashariMatches;
    } else if (cyclicalMatches === formulaCheckedCount && cyclicalMatches > parashariMatches) {
      detectedFormula = 'cyclical_continuous';
      formulaMatchCount = cyclicalMatches;
    } else if (
      parashariMatches >= formulaCheckedCount - 1 &&
      parashariMatches > cyclicalMatches
    ) {
      detectedFormula = 'parashari_odd_even';
      formulaMatchCount = parashariMatches;
    } else if (
      cyclicalMatches >= formulaCheckedCount - 1 &&
      cyclicalMatches > parashariMatches
    ) {
      detectedFormula = 'cyclical_continuous';
      formulaMatchCount = cyclicalMatches;
    } else {
      formulaMatchCount = Math.max(parashariMatches, cyclicalMatches);
    }
  }

  if (providerCalibratedFlag === false) {
    reasons.push(
      `Provider explicitly flags D5 calibrated:false (detectedFormula=${detectedFormula}); kept separate from authoritative BPHS Shodashavarga.`
    );
  }
  if (detectedFormula === 'unestablished_unknown') {
    reasons.push(
      `D5 divisional formula unestablished against Parashari Odd/Even (${parashariMatches}/${formulaCheckedCount}) and Cyclical (${cyclicalMatches}/${formulaCheckedCount}).`
    );
  }

  // 5. 6° Boundary Sensitivity check
  const boundarySensitiveBodies: D5CompatibilityAudit['boundarySensitiveBodies'] = [];
  const evalBoundary = (body: string, pLon: number | null, sLon: number | null) => {
    const refLon = sLon ?? pLon;
    if (refLon === null) return;
    const calcDist = (lon: number) => {
      const dInSign = normalizeDeg(lon) % 30;
      const r = dInSign % 6;
      return { degInSign: Number(dInSign.toFixed(4)), dist: Number(Math.min(r, 6 - r).toFixed(4)), nearest: Math.round(dInSign / 6) * 6 };
    };
    const pInfo = pLon !== null ? calcDist(pLon) : null;
    const sInfo = sLon !== null ? calcDist(sLon) : null;
    const chosen =
      pInfo && sInfo
        ? sInfo.dist <= pInfo.dist
          ? sInfo
          : pInfo
        : sInfo ?? pInfo!;
    const calcSign =
      detectedFormula === 'cyclical_continuous'
        ? computeCyclicalD5SignIdx
        : computeParashariD5SignIdx;
    const pD5 = pLon !== null ? SIGNS[calcSign(pLon)] : null;
    const sD5 = sLon !== null ? SIGNS[calcSign(sLon)] : null;
    const flipped = Boolean(pD5 && sD5 && pD5 !== sD5);
    if (chosen.dist <= 0.25 || flipped) {
      boundarySensitiveBodies.push({
        body,
        degreeInSign: chosen.degInSign,
        nearest6DegBoundary: chosen.nearest,
        distanceDeg: chosen.dist,
        primarySignD5: pD5,
        supplementarySignD5: sD5,
      });
    }
  };
  evalBoundary('Ascendant', primaryAscLon, suppAscLon);
  for (const body of ALL_9_VEDIC_BODIES) {
    evalBoundary(
      body,
      primaryBodyMap.get(body)?.lon ?? null,
      suppBodyMap.get(body)?.lon ?? null
    );
  }
  const hasBoundaryFlip = boundarySensitiveBodies.some(
    (b) => b.primarySignD5 && b.supplementarySignD5 && b.primarySignD5 !== b.supplementarySignD5
  );
  if (boundarySensitiveBodies.length > 0) {
    reasons.push(
      `6° D5 boundary sensitivity on ${boundarySensitiveBodies
        .map((b) => `${b.body}@${b.degreeInSign}°(Δ=${b.distanceDeg}°)`)
        .join(', ')}.`
    );
  }

  const baseGeomCompatible =
    reqMeta.ayanamsaCompatible &&
    reqMeta.coordinatesCompatible &&
    reqMeta.canonicalBirthInstantCompatible &&
    longitudesCompatible &&
    ascendantCompatible;

  let outcome: D5CompatibilityAudit['outcome'];
  let recommendedState: D5CompatibilityAudit['recommendedState'];

  if (!baseGeomCompatible) {
    outcome = 'rejected_incompatible';
    recommendedState = 'incompatible';
  } else if (
    providerCalibratedFlag === false ||
    detectedFormula === 'unestablished_unknown' ||
    !nodeConventionCompatible ||
    hasBoundaryFlip
  ) {
    outcome = 'provisional';
    recommendedState = 'provisional';
  } else {
    outcome = 'accepted';
    recommendedState = 'available';
    reasons.push(
      `Supplementary FreeAstroAPI D5 established via ${detectedFormula} (${formulaMatchCount}/${formulaCheckedCount}) with calibrated=${String(providerCalibratedFlag)}.`
    );
  }

  const annotatedD5: Record<string, unknown> = {
    ...d5Raw,
    _source: 'freeastroapi:/api/v2/vedic/calculate#D5',
    _detectedFormula: detectedFormula,
    _calibrated: providerCalibratedFlag,
    _compatibilityState: recommendedState,
  };

  return {
    audit: {
      outcome,
      recommendedState,
      longitudesCompatible,
      maxClassicalPlanetDeltaDeg: maxClassicalDelta,
      ascendantCompatible,
      ascendantDeltaDeg,
      ayanamsaCompatible: reqMeta.ayanamsaCompatible,
      nodeConventionCompatible,
      nodeDeltaDeg: { rahu: rahuDelta, ketu: ketuDelta },
      providerCalibratedFlag,
      detectedFormula,
      formulaMatchCount,
      formulaCheckedCount,
      boundarySensitiveBodies,
      preservesMethodDistinction: true,
      reasons,
    },
    d5Chart: annotatedD5,
  };
}

/**
 * Integrates targeted supplementary datasets from a single FreeAstroAPI /api/v2/vedic/calculate
 * call into an existing LayerBMasterChartRecord (typically AstroWay primary), enforcing all
 * compatibility gates and guaranteeing zero overwrites of primary AstroWay calculations.
 */
export function integrateFreeAstroApiSupplementaryIntoMaster(
  primaryMaster: LayerBMasterChartRecord,
  supplementaryCall: SanitizedProviderCallRecord | null | undefined,
  options?: {
    independentRef?: IndependentAstroReference;
  }
): LayerBMasterChartRecord {
  const indepRef =
    options?.independentRef ??
    computeIndependentAstronomicalReference(primaryMaster.canonicalBirthInstant);

  const suppRaw =
    supplementaryCall?.ok && asObj(supplementaryCall.rawResponse)
      ? (supplementaryCall.rawResponse as Record<string, unknown>)
      : null;

  const avEval = evaluateAshtakavargaCompatibility(primaryMaster, suppRaw, supplementaryCall);
  const bcEval = evaluateBhavaChalitCompatibility(
    primaryMaster,
    suppRaw,
    supplementaryCall,
    indepRef
  );
  const d5Eval = evaluateD5DivisionalCompatibility(primaryMaster, suppRaw, supplementaryCall);

  // Clone primary master shallowly along mutated branches (preserving original AstroWay references)
  const primaryVedicEnv = primaryMaster.frames.vedicLahiri;
  const primaryVedicData = primaryVedicEnv.data
    ? {
        ...primaryVedicEnv.data,
        planets: primaryVedicEnv.data.planets.map((p) => ({ ...p })),
        vargas: primaryVedicEnv.data.vargas
          ? {
              ...primaryVedicEnv.data.vargas,
              divisionsReturned: [...primaryVedicEnv.data.vargas.divisionsReturned],
              chartsByDivision: { ...primaryVedicEnv.data.vargas.chartsByDivision },
            }
          : null,
      }
    : null;

  // 1. Ashtakavarga: adopt ONLY if primary lacked valid Ashtakavarga AND supplementary passed all checks
  if (
    primaryVedicData &&
    avEval.audit.outcome === 'accepted' &&
    avEval.normalizedSupplementaryAv
  ) {
    primaryVedicData.ashtakavarga = avEval.normalizedSupplementaryAv;
  }

  // 2. D5 Panchamsha: attach ONLY if method is established & compatible (outcome === 'accepted')
  // Otherwise preserve distinction in provisionalCandidates without silently merging into primary Vargas!
  let provisionalD5Candidate: Record<string, unknown> | null = null;
  if (d5Eval.audit.outcome === 'accepted' && d5Eval.d5Chart && primaryVedicData) {
    const existingVargas = primaryVedicData.vargas ?? {
      supportedCount: 0,
      divisionsReturned: [],
      chartsByDivision: {},
    };
    existingVargas.chartsByDivision.D5 = d5Eval.d5Chart;
    if (!existingVargas.divisionsReturned.some((d) => d.toUpperCase() === 'D5')) {
      existingVargas.divisionsReturned.push('D5');
    }
    existingVargas.supportedCount = Object.keys(existingVargas.chartsByDivision).length;
    primaryVedicData.vargas = existingVargas;
  } else if (d5Eval.audit.outcome === 'provisional' && d5Eval.d5Chart) {
    provisionalD5Candidate = d5Eval.d5Chart;
  }

  // 3. Optional missing field (avasthas on classical planets if missing on primary & coords compatible)
  const optionalFields: OptionalFieldCompatibilityAudit[] = [];
  if (suppRaw && primaryVedicData) {
    const suppChart = asObj(suppRaw.chart) ?? {};
    const suppBodyMap = extractBodyMap(asObjArr(suppChart.planets));
    const suppAvasthasObj = asObj(suppRaw.avasthas);
    let presentCount = 0;
    let primaryPopulatedCount = 0;
    let adoptedCount = 0;

    const geomCompatible =
      bcEval.audit.canonicalBirthInstantCompatible &&
      bcEval.audit.coordinatesCompatible &&
      bcEval.audit.ayanamsaCompatible &&
      bcEval.audit.classicalPlanetLongitudesCompatible;

    for (const planet of primaryVedicData.planets) {
      const canon = normalizeSupplementaryBodyName(planet.name ?? planet.planet);
      if (!canon || !CLASSICAL_7_PLANETS.includes(canon as (typeof CLASSICAL_7_PLANETS)[number])) {
        continue;
      }
      const hasPrimaryAvastha =
        typeof planet.avastha === 'string' && planet.avastha.trim().length > 0;
      if (hasPrimaryAvastha) primaryPopulatedCount++;

      const suppPlanetAvastha =
        suppBodyMap.get(canon)?.raw.avastha ??
        suppBodyMap.get(canon)?.raw.avasthas ??
        suppAvasthasObj?.[canon] ??
        suppAvasthasObj?.[canon.toLowerCase()];
      if (suppPlanetAvastha !== undefined && suppPlanetAvastha !== null && suppPlanetAvastha !== '') {
        presentCount++;
        if (geomCompatible && !hasPrimaryAvastha) {
          planet.supplementary_avastha = suppPlanetAvastha;
          planet.avastha = suppPlanetAvastha;
          planet.avastha_source = 'freeastroapi:/api/v2/vedic/calculate';
          adoptedCount++;
        }
      }
    }

    optionalFields.push({
      field: 'avasthas',
      presentOnSupplementary: presentCount > 0,
      primaryAlreadyPopulated: primaryPopulatedCount >= 7,
      compatible: geomCompatible,
      adoptedCount,
      notes:
        presentCount === 0
          ? ['No supplementary avastha fields returned.']
          : geomCompatible
          ? [
              `Adopted supplementary avastha on ${adoptedCount} classical planet(s) lacking primary avastha (primary already had ${primaryPopulatedCount}).`,
            ]
          : ['Supplementary avasthas rejected because geometric compatibility failed.'],
    });
  }

  // 4. Bhava Chalit Frame update (strictly never fall back to KP Placidus)
  let nextBhavaChalitEnv: DatasetEnvelope<BhavaChalitFrame> = primaryMaster.frames.bhavaChalit;
  const primaryBcHasValidSripati =
    Boolean(primaryMaster.frames.bhavaChalit.data) &&
    primaryMaster.frames.bhavaChalit.data?.methodologyAudit.compatibleWithIntendedClassicalMethodology === true &&
    primaryMaster.frames.bhavaChalit.canonicalStatus !== 'incompatible';

  if (!primaryBcHasValidSripati && bcEval.audit.outcome !== 'unavailable') {
    if (bcEval.audit.outcome === 'accepted' && bcEval.frameData) {
      nextBhavaChalitEnv = {
        source: 'freeastroapi:/api/v2/vedic/calculate#bhava_chalit (supplementary)',
        calculationMethod: `FreeAstroAPI V2 Sripati Bhava Chalit (${bcEval.frameData.houseBasis || 'midpoint'})`,
        version: primaryMaster.recalculationVersion ?? primaryMaster.schemaVersion,
        conventions: {
          ayanamsha: 'lahiri',
          houseBasis: bcEval.frameData.houseBasis,
          methodology: 'sripati_midpoint_chalit',
          supplementaryFrom: 'freeastroapi',
        },
        dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
        acquiredAtUtc: supplementaryCall?.timestampUtc ?? null,
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        inputFingerprint: primaryMaster.canonicalBirthInstant.inputFingerprint,
        completeness: bcEval.frameData.houses.length === 12 ? 'complete' : 'partial',
        verificationStatus: 'internally_verified',
        canonicalStatus: 'internally_verified',
        limitations: [],
        data: bcEval.frameData,
      };
    } else if (bcEval.audit.outcome === 'rejected_incompatible') {
      nextBhavaChalitEnv = {
        source: 'freeastroapi:/api/v2/vedic/calculate#bhava_chalit (rejected)',
        calculationMethod: 'Rejected incompatible supplementary Bhava Chalit',
        version: primaryMaster.recalculationVersion ?? primaryMaster.schemaVersion,
        conventions: {
          ayanamsha: 'lahiri',
          methodology: 'rejected_incompatible',
        },
        dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
        acquiredAtUtc: supplementaryCall?.timestampUtc ?? null,
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        inputFingerprint: primaryMaster.canonicalBirthInstant.inputFingerprint,
        completeness: 'unavailable',
        verificationStatus: 'incompatible',
        canonicalStatus: 'incompatible',
        limitations: bcEval.audit.reasons,
        data: bcEval.frameData,
      };
    }
  }

  const nextVedicEnv: DatasetEnvelope<VedicLahiriFrame> = primaryVedicData
    ? {
        ...primaryVedicEnv,
        data: primaryVedicData,
      }
    : primaryVedicEnv;

  const summaryNotes: string[] = [
    `Ashtakavarga gate: ${avEval.audit.outcome} (state=${avEval.audit.recommendedState})`,
    `Bhava Chalit gate: ${bcEval.audit.outcome} (state=${bcEval.audit.recommendedState})`,
    `D5 Panchamsha gate: ${d5Eval.audit.outcome} (state=${d5Eval.audit.recommendedState}, formula=${d5Eval.audit.detectedFormula})`,
  ];

  const report: SupplementaryIntegrationReport = {
    schemaVersion: 'v2.supplementary.1.0',
    supplementaryProvider: 'freeastroapi',
    supplementaryEndpoint: '/api/v2/vedic/calculate',
    acquiredAtUtc: supplementaryCall?.timestampUtc ?? null,
    singleCallOnly: true,
    primaryPreservationGuarantee: {
      primaryPlanetsOverwritten: false,
      primaryShadbalaOverwritten: false,
      primaryOtherVargasOverwritten: false,
      primaryDashasOverwritten: false,
    },
    ashtakavarga: avEval.audit,
    bhavaChalit: bcEval.audit,
    d5: d5Eval.audit,
    optionalFields,
    ...(provisionalD5Candidate ? { provisionalCandidates: { d5: provisionalD5Candidate } } : {}),
    summaryNotes,
  };

  const nextConventions = primaryMaster.calculationConventions
    ? {
        ...primaryMaster.calculationConventions,
        houseSystems: {
          ...primaryMaster.calculationConventions.houseSystems,
          bhavaChalit:
            bcEval.audit.outcome === 'accepted'
              ? bcEval.frameData?.houseBasis || 'sripati_midpoint_chalit (freeastroapi_supplementary)'
              : bcEval.audit.outcome === 'rejected_incompatible'
              ? 'rejected_incompatible_supplementary'
              : primaryMaster.calculationConventions.houseSystems.bhavaChalit,
        },
        divisionalChartMethods: {
          ...primaryMaster.calculationConventions.divisionalChartMethods,
          d5Method:
            d5Eval.audit.outcome === 'accepted'
              ? `freeastroapi_v2_${d5Eval.audit.detectedFormula}`
              : d5Eval.audit.outcome === 'provisional'
              ? `provisional_${d5Eval.audit.detectedFormula}_calibrated_${String(d5Eval.audit.providerCalibratedFlag)}`
              : primaryMaster.calculationConventions.divisionalChartMethods.d5Method,
        },
      }
    : undefined;

  const updatedMaster: LayerBMasterChartRecord = {
    ...primaryMaster,
    ...(nextConventions ? { calculationConventions: nextConventions } : {}),
    frames: {
      ...primaryMaster.frames,
      vedicLahiri: nextVedicEnv,
      bhavaChalit: nextBhavaChalitEnv,
    },
    providerExtendedDatasets: {
      ...(primaryMaster.providerExtendedDatasets ?? {}),
      supplementaryIntegration: report,
    },
    supplementaryIntegration: report,
  };

  return enrichMasterWithPhase4LocalCalculations(updatedMaster, {
    preferLocalAshtakavarga:
      primaryMaster.providerExtendedDatasets?.localAshtakavargaPreferred === true,
  });
}
