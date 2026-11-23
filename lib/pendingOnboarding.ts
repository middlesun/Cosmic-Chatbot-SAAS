import { getSupabaseClient, loadSupabasePublicConfig } from './supabaseClient';

export interface PendingBirthChartDraft {
  name: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM (24h)
  unknown_time?: boolean;
  place_query: string;
  birth_city?: string;
  birth_state?: string | null;
  birth_country?: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone_offset?: number | null;
  companion_slug?: string | null;
  companion_name?: string | null;
  created_at: number;
}

const PENDING_ONBOARDING_KEY = 'cc_pending_onboarding_chart_v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function savePendingOnboardingDraft(
  draft: Omit<PendingBirthChartDraft, 'created_at'> & { created_at?: number }
): PendingBirthChartDraft {
  const normalized: PendingBirthChartDraft = {
    ...draft,
    name: draft.name.trim(),
    birth_date: draft.birth_date.trim(),
    birth_time: draft.birth_time.trim(),
    place_query: draft.place_query.trim(),
    created_at: draft.created_at ?? Date.now(),
  };

  try {
    localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors
  }

  return normalized;
}

export function getPendingOnboardingDraft(): PendingBirthChartDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBirthChartDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      typeof parsed.created_at === 'number' &&
      Date.now() - parsed.created_at > DRAFT_TTL_MS
    ) {
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
      return null;
    }

    if (!parsed.name || !parsed.birth_date || !parsed.birth_time || !parsed.place_query) {
      return null;
    }

    return parsed as PendingBirthChartDraft;
  } catch {
    return null;
  }
}

export function updatePendingOnboardingCompanion(
  companionSlug: string | null,
  companionName?: string | null
): void {
  const existing = getPendingOnboardingDraft();
  if (!existing) return;
  savePendingOnboardingDraft({
    ...existing,
    companion_slug: companionSlug,
    companion_name: companionName || null,
  });
}

export function clearPendingOnboardingDraft(): void {
  try {
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  } catch {
    // Ignore storage errors
  }
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatPendingBirthSummary(draft: PendingBirthChartDraft): string {
  let formattedDate = draft.birth_date;
  const dateMatch = draft.birth_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const monthName = MONTHS_SHORT[Number(dateMatch[2]) - 1] || dateMatch[2];
    formattedDate = `${Number(dateMatch[3])} ${monthName} ${dateMatch[1]}`;
  }

  let formattedTime = draft.birth_time;
  if (draft.unknown_time) {
    formattedTime = 'Approx. noon';
  } else {
    const timeMatch = draft.birth_time.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h24 = Number(timeMatch[1]);
      const mm = timeMatch[2];
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      formattedTime = `${h12}:${mm} ${period}`;
    }
  }

  return `${draft.name} · ${formattedDate} · ${formattedTime} · ${draft.place_query}`;
}

export async function signInWithGooglePreservingDraft(
  draft?: PendingBirthChartDraft
): Promise<{ error?: string }> {
  if (draft) {
    savePendingOnboardingDraft(draft);
  }

  let supabase = getSupabaseClient();
  if (!supabase) {
    await loadSupabasePublicConfig();
    supabase = getSupabaseClient();
  }

  if (!supabase) {
    return {
      error: 'Authentication is temporarily unavailable. Please verify Supabase public environment variables.',
    };
  }

  // If the visitor already has an active Supabase session, skip OAuth and enter directly
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    window.location.assign('/app/home');
    return {};
  }

  const redirectTo = `${window.location.origin}/app/home`;
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (isInIframe) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      return { error: error?.message || 'Unable to start Google sign-in.' };
    }
    try {
      window.top?.location.assign(data.url);
    } catch {
      window.location.assign(data.url);
    }
    return {};
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
