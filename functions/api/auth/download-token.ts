import {
  corsHeaders,
  createDownloadToken,
  DOWNLOAD_TOKEN_TTL_MS,
  extractBearerToken,
  verifyBearerToken,
} from '../../lib/workspace-auth';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const token = extractBearerToken(context.request);
  const auth = await verifyBearerToken(context.env, token);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: auth.status, headers: corsHeaders }
    );
  }

  const downloadToken = await createDownloadToken(context.env, auth.user);
  return new Response(
    JSON.stringify({
      success: true,
      token: downloadToken,
      downloadToken,
      expiresInSeconds: Math.floor(DOWNLOAD_TOKEN_TTL_MS / 1000),
    }),
    { status: 200, headers: corsHeaders }
  );
}
