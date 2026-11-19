import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let runtimeSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
let runtimeSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let cachedClient: SupabaseClient | null = null;
let publicConfigPromise: Promise<boolean> | null = null;

export const isSupabaseClientConfigured = (): boolean =>
  Boolean(runtimeSupabaseUrl && runtimeSupabaseAnonKey);

export const initSupabasePublicConfig = (url: string, anonKey: string): boolean => {
  const nextUrl = (url || '').trim();
  const nextAnon = (anonKey || '').trim();
  if (!nextUrl || !nextAnon) return isSupabaseClientConfigured();

  if (nextUrl !== runtimeSupabaseUrl || nextAnon !== runtimeSupabaseAnonKey) {
    runtimeSupabaseUrl = nextUrl;
    runtimeSupabaseAnonKey = nextAnon;
    cachedClient = null;
  }
  return isSupabaseClientConfigured();
};

export const loadSupabasePublicConfig = async (): Promise<boolean> => {
  if (isSupabaseClientConfigured()) {
    return true;
  }
  if (publicConfigPromise) {
    return publicConfigPromise;
  }

  publicConfigPromise = (async () => {
    try {
      const res = await fetch('/api/config/public');
      if (!res.ok) return false;
      const data = (await res.json()) as {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
      };
      return initSupabasePublicConfig(data.supabaseUrl || '', data.supabaseAnonKey || '');
    } catch {
      return false;
    } finally {
      if (!isSupabaseClientConfigured()) {
        publicConfigPromise = null;
      }
    }
  })();

  return publicConfigPromise;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseClientConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(runtimeSupabaseUrl, runtimeSupabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
};
