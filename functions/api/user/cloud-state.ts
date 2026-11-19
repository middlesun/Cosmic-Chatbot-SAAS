import {
  calculateBrandsAssistantStorageBytesCf,
  corsHeaders,
  extractBearerToken,
  getStorageQuotaBytesForTier,
  getUserStorageUsageBytes,
  verifyBearerToken,
} from '../../lib/workspace-auth';
import { loadUserCloudStateCf, saveUserCloudStateCf } from '../../lib/cloud-state';

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
      return new Response(JSON.stringify({ success: false, error: 'Access denied for requested cloud state' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const cloudState = await loadUserCloudStateCf(context.env, requestedUserId, token);
    return new Response(JSON.stringify({ success: true, ...cloudState }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Failed to load cloud state' }), {
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
      return new Response(JSON.stringify({ success: false, error: 'Access denied for target cloud state' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const storageLimitBytes = getStorageQuotaBytesForTier(auth.user.tier);
    if (Array.isArray(body?.brands) && body.brands.length > 0) {
      const incomingTextBytes = calculateBrandsAssistantStorageBytesCf(body.brands);
      if (incomingTextBytes > 0) {
        const currentTotalBytes = await getUserStorageUsageBytes(context.env, targetUserId, token);
        const existingState = await loadUserCloudStateCf(context.env, targetUserId, token);
        const prevTextBytes = calculateBrandsAssistantStorageBytesCf(existingState?.brands || []);
        const estimatedMediaBytes = Math.max(0, currentTotalBytes - prevTextBytes);
        const projectedTotalBytes = estimatedMediaBytes + incomingTextBytes;

        if (projectedTotalBytes > storageLimitBytes && incomingTextBytes > prevTextBytes) {
          const usedMb = (projectedTotalBytes / (1024 * 1024)).toFixed(1);
          const limitMb = Math.round(storageLimitBytes / (1024 * 1024));
          return new Response(
            JSON.stringify({
              success: false,
              quotaExceeded: true,
              storageUsedBytes: currentTotalBytes,
              storageLimitBytes,
              error: `Workspace storage quota exceeded (${usedMb} MB / ${limitMb} MB including AI chats & Vault). Delete old chats, Vault drafts, or images—or upgrade your plan.`,
            }),
            { status: 413, headers: corsHeaders }
          );
        }
      }
    }

    const result = await saveUserCloudStateCf(context.env, targetUserId, body, token);
    const storageUsedBytes = await getUserStorageUsageBytes(
      context.env,
      targetUserId,
      token,
      Array.isArray(body?.brands) && body.brands.length > 0 ? body.brands : undefined
    );
    return new Response(JSON.stringify({ ...result, storageUsedBytes, storageLimitBytes }), {
      status: result.success ? 200 : 500,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Failed to save cloud state' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
