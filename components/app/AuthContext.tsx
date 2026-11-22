import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  isSupabaseClientConfigured,
  loadSupabasePublicConfig,
} from '../../lib/supabaseClient';
import { normalizeCouncilSlug } from '../../lib/vedicTypes';
import { PREVIEW_APP_USER } from './previewFixtures';

export type AstrologyMode = 'vedic' | 'western';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  tier: 'personal' | 'pro' | 'guru';
  credits_balance: number;
  currency_pref: 'INR' | 'USD' | 'AED' | 'EUR';
  default_expert: string;
  default_output: string;
  default_language: string;
  default_astrology_mode?: AstrologyMode | null;
  preferred_call_name?: string | null;
  chat_font_size?: 'sm' | 'base' | 'lg' | null;
  chat_numeric_font?: 'dm_sans' | 'inter' | 'plus_jakarta' | 'roboto' | 'cormorant' | 'jetbrains_mono' | null;
  suggestions_auto_expand?: boolean | null;
  referral_code: string;
  referred_by: string | null;
  must_change_password: boolean;
  is_admin: boolean;
  account_status: 'active' | 'suspended';
  created_at: string;
}

export interface UserStats {
  savedProfiles: number;
  successfulReferrals: number;
}

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  isPreviewMode: boolean;
  session: Session | null;
  authUser: SupabaseAuthUser | null;
  appUser: AppUser | null;
  stats: UserStats;
  astrologyMode: AstrologyMode;
  setAstrologyMode: (mode: AstrologyMode) => void;
  isPasswordRecovery: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  clearPasswordRecovery: () => void;
  enterPreviewMode: () => void;
  exitPreviewMode: () => void;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFERRAL_STORAGE_KEY = 'cc_pending_referral_code';
const PREVIEW_STORAGE_KEY = 'cc_ui_preview_mode';
const ASTROLOGY_MODE_STORAGE_KEY = 'cc_active_astrology_mode';

export const storePendingReferral = (code: string) => {
  if (code && code.trim()) {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code.trim().toUpperCase());
  }
};

export const getPendingReferral = (): string | null =>
  localStorage.getItem(REFERRAL_STORAGE_KEY);

export const clearPendingReferral = () => {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(() => isSupabaseClientConfigured());
  const [isLoading, setIsLoading] = useState(true);
  const [previewRequested, setPreviewRequested] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === '1') {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(PREVIEW_STORAGE_KEY) === '1';
  });
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [stats, setStats] = useState<UserStats>({ savedProfiles: 0, successfulReferrals: 0 });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [astrologyModeState, setAstrologyModeState] = useState<AstrologyMode>(() => {
    const saved = sessionStorage.getItem(ASTROLOGY_MODE_STORAGE_KEY);
    return saved === 'western' ? 'western' : 'vedic';
  });

  const inFlightFetchRef = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const isPreviewMode = previewRequested && !session;

  const setAstrologyMode = useCallback((mode: AstrologyMode) => {
    setAstrologyModeState(mode);
    sessionStorage.setItem(ASTROLOGY_MODE_STORAGE_KEY, mode);
  }, []);

  const enterPreviewMode = useCallback(() => {
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, '1');
    setPreviewRequested(true);
  }, []);

  const exitPreviewMode = useCallback(() => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    setPreviewRequested(false);
  }, []);

  const fetchAppUser = useCallback(async (activeSession: Session | null, force = false) => {
    const accessToken = activeSession?.access_token;
    if (!accessToken) {
      inFlightFetchRef.current = null;
      setAppUser(null);
      setStats({ savedProfiles: 0, successfulReferrals: 0 });
      setIsLoading(false);
      return;
    }

    if (!force && inFlightFetchRef.current?.token === accessToken) {
      return inFlightFetchRef.current.promise;
    }

    const promise = (async () => {
      try {
        const pendingRef = getPendingReferral();
        if (pendingRef) {
          await fetch('/api/app/referral/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ referralCode: pendingRef }),
          }).catch(() => null);
          clearPendingReferral();
        }

        const res = await fetch('/api/app/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || 'Unable to load account profile');
          setAppUser(null);
        } else {
          const data = await res.json();
          const hydratedUser = data.user
            ? {
                ...data.user,
                default_expert: normalizeCouncilSlug(data.user.default_expert),
              }
            : null;
          setAppUser(hydratedUser);
          setStats(data.stats || { savedProfiles: 0, successfulReferrals: 0 });
          setError(null);
          if (!sessionStorage.getItem(ASTROLOGY_MODE_STORAGE_KEY) && data.user?.default_astrology_mode) {
            setAstrologyModeState(data.user.default_astrology_mode === 'western' ? 'western' : 'vedic');
          }
        }
      } catch {
        setError('Network error while connecting to Cosmic Council backend.');
      } finally {
        if (inFlightFetchRef.current?.token === accessToken) {
          inFlightFetchRef.current = null;
        }
        setIsLoading(false);
      }
    })();

    inFlightFetchRef.current = { token: accessToken, promise };
    return promise;
  }, []);

  useEffect(() => {
    // Capture ?ref=CODE whenever user visits any /app/* route
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      storePendingReferral(refParam);
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      if (!isSupabaseClientConfigured()) {
        const loaded = await loadSupabasePublicConfig();
        if (!mounted) return;
        setIsConfigured(loaded);
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (mounted) setIsLoading(false);
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        if (nextSession && window.location.hash.includes('access_token=')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        setSession(nextSession);
        void fetchAppUser(nextSession);
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session && window.location.hash.includes('access_token=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setSession(data.session);
      await fetchAppUser(data.session);
    };

    void initAuth();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [fetchAppUser]);

  const refreshUser = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await fetchAppUser(data.session, true);
  }, [fetchAppUser]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    sessionStorage.removeItem(ASTROLOGY_MODE_STORAGE_KEY);
    setPreviewRequested(false);
    setSession(null);
    setAppUser(null);
    setIsPasswordRecovery(false);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const effectiveAppUser = isPreviewMode ? PREVIEW_APP_USER : appUser;
  const effectiveStats = isPreviewMode
    ? { savedProfiles: 1, successfulReferrals: 2 }
    : stats;

  return (
    <AuthContext.Provider
      value={{
        isConfigured,
        isLoading,
        isPreviewMode,
        session,
        authUser: session?.user ?? null,
        appUser: effectiveAppUser,
        stats: effectiveStats,
        astrologyMode: astrologyModeState,
        setAstrologyMode,
        isPasswordRecovery,
        error,
        refreshUser,
        clearPasswordRecovery: () => setIsPasswordRecovery(false),
        enterPreviewMode,
        exitPreviewMode,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
