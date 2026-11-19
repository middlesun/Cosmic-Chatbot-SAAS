import {
  corsHeaders,
  extractBearerToken,
  verifyBearerToken,
  verifyDownloadToken,
} from '../../lib/workspace-auth';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const url = new URL(context.request.url);
  const bearer = extractBearerToken(context.request);
  const dt = String(url.searchParams.get('dt') || '').trim();

  let authorized = false;
  if (bearer) {
    const auth = await verifyBearerToken(context.env, bearer);
    authorized = auth.ok;
  } else if (dt) {
    const tokenUser = await verifyDownloadToken(context.env, dt);
    authorized = Boolean(tokenUser);
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication required to download the extension' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const rawVersion = String(url.searchParams.get('version') || 'v1.3.0').replace(/[^a-zA-Z0-9._-]/g, '');
  const reqVersion = rawVersion ? (/^\d/.test(rawVersion) ? `v${rawVersion}` : rawVersion) : 'v1.3.0';

  if (context.env?.ASSETS && typeof context.env.ASSETS.fetch === 'function') {
    const candidates = [
      `/downloads/smart-poster-extension-${reqVersion}.zip`,
      '/downloads/smart-poster-extension-v1.3.0.zip',
    ];
    for (const candidatePath of candidates) {
      const assetUrl = new URL(context.request.url);
      assetUrl.pathname = candidatePath;
      assetUrl.search = '';
      const assetRes = await context.env.ASSETS.fetch(new Request(assetUrl.toString()));
      if (assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set('Content-Type', 'application/zip');
        headers.set('Content-Disposition', `attachment; filename="smart-poster-extension-${reqVersion}.zip"`);
        return new Response(assetRes.body, { status: 200, headers });
      }
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Extension archive not found' }),
    { status: 404, headers: corsHeaders }
  );
}
