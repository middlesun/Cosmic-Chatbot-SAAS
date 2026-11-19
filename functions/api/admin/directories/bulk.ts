import {
  corsHeaders,
  extractBearerToken,
  verifyBearerToken,
} from '../../../lib/workspace-auth';
import { upsertDirectoriesBulkFromEnv } from '../../../lib/catalog';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const verified = await verifyBearerToken(context.env, token);
    if (!verified.ok) {
      return new Response(JSON.stringify({ success: false, error: verified.error }), {
        status: verified.status,
        headers: corsHeaders,
      });
    }
    if (verified.user.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Administrator privileges required' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = (await context.request.json().catch(() => ({}))) as any;
    const list = Array.isArray(body) ? body : (Array.isArray(body?.directories) ? body.directories : []);
    if (list.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'At least one directory link is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const result = await upsertDirectoriesBulkFromEnv(context.env, list);
    return new Response(
      JSON.stringify({
        success: true,
        directories: result.items,
        count: result.items.length,
        source: result.source,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed bulk saving directories' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
