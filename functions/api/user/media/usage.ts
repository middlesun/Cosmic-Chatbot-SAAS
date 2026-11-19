import {
  corsHeaders,
  extractBearerToken,
  getStorageQuotaBytesForTier,
  getUserStorageUsageBytes,
  verifyBearerToken,
} from '../../../lib/workspace-auth';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    const auth = await verifyBearerToken(context.env, token);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: corsHeaders,
      });
    }

    const storageUsedBytes = await getUserStorageUsageBytes(context.env, auth.user.userId, token);
    const storageLimitBytes = getStorageQuotaBytesForTier(auth.user.tier);
    return new Response(
      JSON.stringify({
        success: true,
        tier: auth.user.tier,
        storageUsedBytes,
        storageLimitBytes,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Storage usage lookup failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
