import {
  corsHeaders,
  extractBearerToken,
  VerifiedAuthUser,
  verifyBearerToken,
} from '../lib/workspace-auth';
import { loadDirectoriesFromEnv } from '../lib/catalog';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    let authUser: VerifiedAuthUser | null = null;
    if (token) {
      const auth = await verifyBearerToken(context.env, token);
      if (auth.ok) {
        authUser = auth.user;
      }
    }

    const result = await loadDirectoriesFromEnv(context.env, false);
    const allItems = result.items || [];

    return new Response(
      JSON.stringify({
        success: true,
        directories: allItems,
        totalCount: allItems.length,
        isPreview: false,
        tier: authUser ? authUser.tier : 'guest',
        source: result.source,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed loading directories' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
