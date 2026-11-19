import { corsHeaders, extractBearerToken, verifyBearerToken } from '../../lib/workspace-auth';
import { fetchWebsiteCopy } from '../../lib/url-analyzer';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const { url = '', openRouterKey = '', geminiApiKey = '' } = body || {};
    const userByokKey = String(openRouterKey || geminiApiKey || '').trim();

    if (!userByokKey) {
      const token = extractBearerToken(context.request);
      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            needsApiKey: true,
            error: 'Sign in or provide a BYOK AI key to analyze URLs.',
          }),
          { status: 401, headers: corsHeaders }
        );
      }

      const verified = await verifyBearerToken(context.env, token);
      if (!verified.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            needsApiKey: true,
            error: 'Sign in or provide a BYOK AI key to analyze URLs.',
          }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const result = await fetchWebsiteCopy(String(url || ''));
    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, url: result.url, error: result.error }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, site: result.context, context: result.context }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'URL scan failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
