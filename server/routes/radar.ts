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

  const { data: activatedProfiles, error: listErr } = await supabaseAdmin
    .from('profiles')
    .select('id, name, birth_date, birth_city, is_activated, chart_json')
    .eq('user_id', req.appUser.id)
    .eq('is_activated', true)
    .order('activated_at', { ascending: false });

  if (listErr) {
    res.status(500).json({ error: 'Failed to load profiles for Timing Radar' });
    return;
  }

  const list = activatedProfiles || [];
  if (list.length === 0) {
    res.json({
      hasActivatedProfile: false,
      profiles: [],
      radar: null,
    });
    return;
  }

  const target =
    (requestedProfileId ? list.find((p) => p.id === requestedProfileId) : null) || list[0];

  if (!target.chart_json) {
    res.json({
      hasActivatedProfile: false,
      profiles: list.map((p) => ({ id: p.id, name: p.name })),
      radar: null,
    });
    return;
  }

  try {
    const radar = await buildTimingRadarForProfile({
      profileId: target.id,
      profileName: target.name,
      chartJson: target.chart_json as CompiledChartData,
    });

    res.json({
      hasActivatedProfile: true,
      profiles: list.map((p) => ({
        id: p.id,
        name: p.name,
        birth_date: p.birth_date,
        birth_city: p.birth_city,
      })),
      radar,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to compile Timing Radar',
    });
  }
});

export default router;
