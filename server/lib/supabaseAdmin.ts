import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdmin: SupabaseClient | null = null;
let cachedSignature = '';

const readSupabaseServerConfig = () => {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { supabaseUrl, serviceRoleKey };
};

export const isSupabaseServerConfigured = (): boolean => {
  const { supabaseUrl, serviceRoleKey } = readSupabaseServerConfig();
  return Boolean(supabaseUrl && serviceRoleKey);
};

export const getSupabaseAdmin = (): SupabaseClient | null => {
  const { supabaseUrl, serviceRoleKey } = readSupabaseServerConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  const signature = `${supabaseUrl}::${serviceRoleKey}`;
  if (!cachedAdmin || cachedSignature !== signature) {
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedSignature = signature;
  }
  return cachedAdmin;
};
