import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedAdmin: SupabaseClient | null = null;

export const isSupabaseServerConfigured = (): boolean =>
  Boolean(supabaseUrl && serviceRoleKey);

export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (!isSupabaseServerConfigured()) {
    return null;
  }
  if (!cachedAdmin) {
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedAdmin;
};
