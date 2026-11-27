/**
 * Isolated V2 Engine — Read-Only Existing Profile & Downstream Impact Assessment
 *
 * Strictly READ-ONLY: inspects local chart JSON fixtures or Supabase rows via
 * SELECT only (when explicitly requested) without writing, regenerating, or
 * overwriting any existing database record or file.
 */

import { resolveCanonicalBirthInstant } from './birthInstant';
import { computeIndependentAstronomicalReference, verify12CuspSequence } from './verifier';
import type { ProfileDefectAssessment } from './types';

function circularDiffDeg(a: number, b: number): number {
  let d = ((a % 360) + 360) % 360 - (((b % 360) + 360) % 360);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function assessChartJsonDefects(
  identifier: string,
  name: string,
  rawChart: unknown
): ProfileDefectAssessment {
  const chart =
    rawChart && typeof rawChart === 'object'
      ? (rawChart as Record<string, unknown>)
      : {};
  const meta =
    chart.meta && typeof chart.meta === 'object'
      ? (chart.meta as Record<string, unknown>)
      : {};
  const loc =
    meta.location && typeof meta.location === 'object'
      ? (meta.location as Record<string, unknown>)
      : {};
  const providerRecorded =
    typeof meta.astrologyProvider === 'string' ? meta.astrologyProvider : null;

  const defects: string[] = [];

  // 1. Check Ascendant vs independent reference on recorded birthDate / birthTime / tzOffset
  const birthDate = typeof meta.birthDate === 'string' ? meta.birthDate : null;
  const birthTime = typeof meta.birthTime === 'string' ? meta.birthTime : null;
  const lat = typeof loc.latitude === 'number' ? loc.latitude : null;
  const lng = typeof loc.longitude === 'number' ? loc.longitude : null;
  const tzOffset = typeof loc.timezoneOffset === 'number' ? loc.timezoneOffset : null;

  const planets = Array.isArray(chart.planets)
    ? (chart.planets as Array<Record<string, unknown>>)
    : [];
  const ascObj = planets.find((p) => String(p.name) === 'Ascendant');
  const moonObj = planets.find((p) => String(p.name) === 'Moon');

  if (birthDate && birthTime && lat !== null && lng !== null && tzOffset !== null) {
    try {
      const instant = resolveCanonicalBirthInstant({
        name,
        birthDate,
        birthTime,
        latitude: lat,
        longitude: lng,
        explicitHistoricalUtcOffsetHours: tzOffset,
      });
      const ref = computeIndependentAstronomicalReference(instant);
      if (ascObj && typeof ascObj.longitude === 'number') {
        const ascErr = Math.abs(circularDiffDeg(ascObj.longitude, ref.lahiriAscendantDeg));
        if (ascErr > 1.0) {
          defects.push(
            `Ascendant discrepancy: stored=${ascObj.longitude.toFixed(4)}° vs reference=${ref.lahiriAscendantDeg.toFixed(4)}° (Δ=${ascErr.toFixed(2)}°, likely UTC/offset epoch mismatch).`
          );
        }
      }
      if (moonObj && typeof moonObj.longitude === 'number') {
        const moonErr = Math.abs(circularDiffDeg(moonObj.longitude, ref.lahiriMoonLonDeg));
        if (moonErr > 0.5) {
          defects.push(
            `Moon longitude discrepancy: stored=${moonObj.longitude.toFixed(4)}° vs reference=${ref.lahiriMoonLonDeg.toFixed(4)}° (Δ=${moonErr.toFixed(2)}°).`
          );
        }
      }
    } catch (err) {
      defects.push(
        `Unable to verify canonical birth instant: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 2. Check KP cusp sequence monotonicity
  const kp =
    chart.kp && typeof chart.kp === 'object'
      ? (chart.kp as Record<string, unknown>)
      : null;
  const kpCusps = Array.isArray(kp?.cusps)
    ? (kp!.cusps as Array<Record<string, unknown>>)
    : [];
  if (kpCusps.length === 12) {
    const seq = verify12CuspSequence(kpCusps.map((c) => Number(c.longitude)));
    if (!seq.monotonicSequential) {
      defects.push(
        `Invalid non-sequential KP house cusps (H1=${kpCusps[0]?.longitude}°, H2=${kpCusps[1]?.longitude}°, totalSpan=${seq.totalSpanDeg}°).`
      );
    }
  }

  // 3. Check Western Placidus cusp sequence & Asc-MC consistency
  const western =
    chart.western && typeof chart.western === 'object'
      ? (chart.western as Record<string, unknown>)
      : null;
  const westCusps = Array.isArray(western?.cusps)
    ? (western!.cusps as Array<Record<string, unknown>>)
    : [];
  if (westCusps.length === 12) {
    const seq = verify12CuspSequence(westCusps.map((c) => Number(c.longitude)));
    if (!seq.monotonicSequential) {
      defects.push(
        `Invalid non-sequential Western Placidus cusps (H1=${westCusps[0]?.longitude}°, H2=${westCusps[1]?.longitude}°).`
      );
    }
  }

  // 4. Check Bhava Chalit over-shift symptom (wraparound vs KP-Placidus-as-Chalit conflation)
  const bhavaChalit =
    chart.bhavaChalit && typeof chart.bhavaChalit === 'object'
      ? (chart.bhavaChalit as Record<string, unknown>)
      : null;
  const shiftedPlanets = Array.isArray(bhavaChalit?.shiftedPlanets)
    ? bhavaChalit!.shiftedPlanets
    : [];
  const kpNonMonotonic = defects.some((d) => d.includes('non-sequential KP house cusps'));
  if (shiftedPlanets.length >= 8) {
    defects.push(
      kpNonMonotonic
        ? `Bhava Chalit saturation (${shiftedPlanets.length}/9 planets shifted due to non-sequential KP H1 wraparound).`
        : `Bhava Chalit conflation (${shiftedPlanets.length}/9 planets shifted because KP Placidus cusp starts were treated as Bhava Chalit midpoints).`
    );
  }

  // 5. Check Shadbala vs shadBalaSummary conflict
  const localSb =
    chart.shadbala && typeof chart.shadbala === 'object'
      ? (chart.shadbala as Record<string, unknown>)
      : null;
  const apiSb =
    chart.shadBalaSummary && typeof chart.shadBalaSummary === 'object'
      ? (chart.shadBalaSummary as Record<string, unknown>)
      : null;
  if (localSb && apiSb && Array.isArray(localSb.planets)) {
    const localMoon = (localSb.planets as Array<Record<string, unknown>>).find(
      (r) => String(r.planet) === 'Moon'
    );
    const apiMoon = apiSb.Moon as Record<string, unknown> | undefined;
    if (localMoon && apiMoon && typeof localMoon.totalVirupas === 'number' && typeof apiMoon.total === 'number') {
      const diff = Math.abs(localMoon.totalVirupas - apiMoon.total);
      if (diff > 20) {
        defects.push(
          `Conflicting Shadbala datasets: local shadbala Moon=${localMoon.totalVirupas}V vs shadBalaSummary Moon=${apiMoon.total}V (Δ=${diff.toFixed(1)}V).`
        );
      }
    }
  }

  const affected = defects.length > 0;
  const severity: ProfileDefectAssessment['severity'] =
    defects.some(
      (d) =>
        d.includes('Ascendant discrepancy') ||
        d.includes('non-sequential') ||
        d.includes('Bhava Chalit')
    )
      ? 'critical'
      : affected
      ? 'moderate'
      : 'clean';

  return {
    identifier,
    name,
    providerRecorded,
    affected,
    severity,
    defects,
    downstreamArtifactsToRegenerate: affected
      ? [
          'profiles.chart_json (preserve backup before v2 upgrade)',
          'profiles.chart_text_context',
          'profiles.natal_truth_dossier_json (natal_dossier_version bump)',
          'profiles.analyst_notes_json (re-verify Council technical notes)',
          'profiles.deep_profile_json (audit chart-derived astrological claims)',
          'report_orders (regenerate or flag past PDF/markdown reports built on affected chart_json)',
          'mini_app_readings / user_favorite_reports (flag cached readings tied to corrupted profile snapshot)',
        ]
      : [],
  };
}

export const READ_ONLY_SUPABASE_DIAGNOSTIC_SQL = `
-- READ-ONLY IMPACT DISCOVERY QUERY (Never modifies rows)
SELECT
  p.id AS profile_id,
  p.user_id,
  p.name,
  p.birth_date,
  p.birth_time,
  p.birth_city,
  p.chart_json->'meta'->>'astrologyProvider' AS astrology_provider,
  p.chart_json->'meta'->>'generatedAt' AS chart_generated_at,
  p.natal_dossier_version,
  jsonb_array_length(COALESCE(p.chart_json->'bhavaChalit'->'shiftedPlanets', '[]'::jsonb)) AS chalit_shifted_count,
  (SELECT count(*) FROM public.report_orders ro WHERE ro.profile_id = p.id) AS linked_reports_count,
  (SELECT count(*) FROM public.mini_app_readings mar WHERE mar.profile_id = p.id) AS linked_miniapp_readings_count
FROM public.profiles p
WHERE p.chart_json IS NOT NULL
  AND (
    p.chart_json->'meta'->>'astrologyProvider' = 'freeastroapi'
    OR jsonb_array_length(COALESCE(p.chart_json->'bhavaChalit'->'shiftedPlanets', '[]'::jsonb)) >= 8
    OR p.chart_json->'shadBalaSummary' IS NOT NULL
  )
ORDER BY p.updated_at DESC;
`.trim();
