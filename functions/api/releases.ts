import { corsHeaders } from '../lib/workspace-auth';
import { loadReleasesFromEnv } from '../lib/catalog';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const result = await loadReleasesFromEnv(context.env);
    return new Response(
      JSON.stringify({ success: true, releases: result.items, source: result.source }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed loading releases' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
