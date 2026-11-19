import { corsHeaders } from '../lib/workspace-auth';
import { loadChangelogFromEnv } from '../lib/catalog';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const result = await loadChangelogFromEnv(context.env);
    return new Response(
      JSON.stringify({ success: true, entries: result.items, source: result.source }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed loading changelog' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
