import { corsHeaders, extractBearerToken, verifyBearerToken } from '../../lib/workspace-auth';
import { loadUserWorkspacePrefsCf, saveUserWorkspacePrefsCf } from '../../lib/cloud-state';

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

    const url = new URL(context.request.url);
    const requestedUserId = String(url.searchParams.get('userId') || auth.user.userId || '').trim();
    if (!requestedUserId) {
      return new Response(JSON.stringify({ success: false, error: 'userId is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (auth.user.role !== 'admin' && auth.user.userId !== requestedUserId) {
      return new Response(JSON.stringify({ success: false, error: 'Access denied for requested workspace' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const prefs = await loadUserWorkspacePrefsCf(context.env, requestedUserId, token);
    return new Response(JSON.stringify({ success: true, prefs }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Failed to load workspace prefs' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    const auth = await verifyBearerToken(context.env, token);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status,
        headers: corsHeaders,
      });
    }

    const body: any = await context.request.json().catch(() => ({}));
    const targetUserId = String(body?.userId || auth.user.userId || '').trim();
    if (!targetUserId) {
      return new Response(JSON.stringify({ success: false, error: 'userId is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (auth.user.role !== 'admin' && auth.user.userId !== targetUserId) {
      return new Response(JSON.stringify({ success: false, error: 'Access denied for target workspace' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const prefs = await saveUserWorkspacePrefsCf(
      context.env,
      targetUserId,
      {
        bookmarked_directory_ids: body?.bookmarked_directory_ids,
        custom_directories: body?.custom_directories,
        research_config: body?.research_config,
      },
      token
    );
    return new Response(JSON.stringify({ success: true, prefs }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Failed to save workspace prefs' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
