import { corsHeaders } from '../../lib/workspace-auth';
import { fetchWebsiteCopy } from '../../lib/url-analyzer';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const rawUrl = String(body?.url || '').trim();
    if (!rawUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Website URL is required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await fetchWebsiteCopy(rawUrl);
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
      JSON.stringify({ success: false, error: err?.message || 'Site metadata scan failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
