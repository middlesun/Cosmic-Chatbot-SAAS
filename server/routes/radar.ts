import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { buildTimingRadarForProfile } from '../services/timingRadar';
import type { CompiledChartData } from '../services/chartCompiler';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const requestedProfileId = typeof req.query.profileId === 'string' ? req.query.profileId : '';
  const rawMode = typeof req.query.mode === 'string' ? req.query.mode.trim().toLowerCase() : '';
  const mode: 'vedic' | 'western' =
    rawMode === 'western'
      ? 'western'
      : rawMode === 'vedic'
      ? 'vedic'
      : req.appUser.default_astrology_mode === 'western'
      ? 'western'
      : 'vedic';

  interface RadarProfileRow {
    id: string;
    name: string;
    short_name?: string | null;
    is_default?: boolean | null;
    birth_date: string;
    birth_city: string;
    is_activated: boolean;
  }

  let activatedProfiles: RadarProfileRow[] | null = null;

  const primaryRes = await supabaseAdmin
    .from('profiles')
    .select('id, name, short_name, is_default, birth_date, birth_city, is_activated')
    .eq('user_id', req.appUser.id)
    .eq('is_activated', true)
    .order('activated_at', { ascending: false });

  if (primaryRes.error) {
    // Fallback if 002_v2_foundations.sql columns are not yet applied in Postgres
    const fallbackRes = await supabaseAdmin
      .from('profiles')
      .select('id, name, birth_date, birth_city, is_activated')
      .eq('user_id', req.appUser.id)
      .eq('is_activated', true)
      .order('activated_at', { ascending: false });

    if (fallbackRes.error) {
      res.status(500).json({ error: 'Failed to load profiles for Timing Radar' });
      return;
    }

    activatedProfiles = (fallbackRes.data || []).map((row) => ({
      ...row,
      short_name: null,
      is_default: false,
    }));
  } else {
    activatedProfiles = (primaryRes.data || []) as RadarProfileRow[];
  }

  const list = [...(activatedProfiles || [])].sort((a, b) => {
    const aDef = a.is_default ? 1 : 0;
    const bDef = b.is_default ? 1 : 0;
    return bDef - aDef;
  });

  if (list.length === 0) {
    res.json({
      hasActivatedProfile: false,
      profiles: [],
      radar: null,
    });
    return;
  }

  const targetMeta =
    (requestedProfileId ? list.find((p) => p.id === requestedProfileId) : null) || list[0];

  const { data: targetChartRow } = await supabaseAdmin
    .from('profiles')
    .select('chart_json')
    .eq('id', targetMeta.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  const serializedProfiles = list.map((p) => ({
    id: p.id,
    name: p.name,
    short_name: p.short_name ?? null,
    is_default: Boolean(p.is_default),
    birth_date: p.birth_date,
    birth_city: p.birth_city,
  }));

  if (!targetChartRow?.chart_json) {
    res.json({
      hasActivatedProfile: false,
      profiles: serializedProfiles,
      radar: null,
    });
    return;
  }

  try {
    const radar = await buildTimingRadarForProfile({
      profileId: targetMeta.id,
      profileName: targetMeta.name,
      chartJson: targetChartRow.chart_json as CompiledChartData,
      mode,
    });

    res.json({
      hasActivatedProfile: true,
      mode,
      profiles: serializedProfiles,
      radar,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to compile Timing Radar',
    });
  }
});

export default router;
