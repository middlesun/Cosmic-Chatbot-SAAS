import {
  corsHeaders,
  extractBearerToken,
  verifyBearerToken,
} from '../../lib/workspace-auth';
import {
  deleteDirectoryFromEnv,
  loadDirectoriesFromEnv,
  upsertDirectoriesBulkFromEnv,
  upsertDirectoryFromEnv,
} from '../../lib/catalog';

async function requireAdmin(request: Request, env: any) {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false as const, status: 401, error: 'Authentication required' };
  }
  const verified = await verifyBearerToken(env, token);
  if (!verified.ok) {
    return { ok: false as const, status: verified.status, error: verified.error };
  }
  if (verified.user.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Administrator privileges required' };
  }
  return { ok: true as const, user: verified.user };
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const auth = await requireAdmin(context.request, context.env);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: corsHeaders,
      });
    }
    const result = await loadDirectoriesFromEnv(context.env, true);
    return new Response(
      JSON.stringify({ success: true, directories: result.items, source: result.source }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed loading directories' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const auth = await requireAdmin(context.request, context.env);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: corsHeaders,
      });
    }
    const body = (await context.request.json().catch(() => ({}))) as any;
    if (Array.isArray(body) || Array.isArray(body?.directories)) {
      const list = Array.isArray(body) ? body : body.directories;
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
    }
    const result = await upsertDirectoryFromEnv(context.env, body || {});
    return new Response(
      JSON.stringify({ success: true, directory: result.item, source: result.source }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed saving directory' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestDelete(context: { request: Request; env: any; params?: { id?: string } }) {
  try {
    const auth = await requireAdmin(context.request, context.env);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: corsHeaders,
      });
    }
    const url = new URL(context.request.url);
    const id = decodeURIComponent(
      String(context.params?.id || url.searchParams.get('id') || url.pathname.split('/').pop() || '').trim()
    );
    if (!id || id === 'directories') {
      return new Response(JSON.stringify({ success: false, error: 'Directory id is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await deleteDirectoryFromEnv(context.env, id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed deleting directory' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
