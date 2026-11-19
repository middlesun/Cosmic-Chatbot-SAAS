import {
  corsHeaders,
  deleteUserBrandMedia,
  extractBearerToken,
  getStorageQuotaBytesForTier,
  getUserStorageUsageBytes,
  uploadUserBrandMediaCf,
  verifyBearerToken,
} from '../../lib/workspace-auth';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
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
    const { userId, dataUrl, filename } = body || {};
    const targetUserId = String(userId || auth.user.userId || '').trim();
    if (!targetUserId) {
      return new Response(JSON.stringify({ success: false, error: 'userId is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (auth.user.role !== 'admin' && auth.user.userId !== targetUserId) {
      return new Response(JSON.stringify({ success: false, error: 'Access denied for target user media' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return new Response(JSON.stringify({ success: false, error: 'Valid image dataUrl is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const uploaded = await uploadUserBrandMediaCf(
      context.env,
      targetUserId,
      dataUrl,
      String(filename || 'asset.webp'),
      token,
      auth.user.tier || 'basic'
    );
    return new Response(JSON.stringify(uploaded), {
      status: uploaded.success ? 200 : (uploaded.status || 400),
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Media upload failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function onRequestDelete(context: { request: Request; env: any }) {
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
    const reqUrl = new URL(context.request.url);
    const targetUrl = String(body?.path || body?.url || reqUrl.searchParams.get('url') || reqUrl.searchParams.get('path') || '').trim();
    if (!targetUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Media url or path is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const deleted = await deleteUserBrandMedia(context.env, auth.user.userId, targetUrl, token);
    const storageUsedBytes = await getUserStorageUsageBytes(context.env, auth.user.userId, token);
    const storageLimitBytes = getStorageQuotaBytesForTier(auth.user.tier);
    return new Response(
      JSON.stringify({
        success: deleted.success,
        deletedPath: deleted.deletedPath || null,
        storageUsedBytes,
        storageLimitBytes,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Media delete failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
