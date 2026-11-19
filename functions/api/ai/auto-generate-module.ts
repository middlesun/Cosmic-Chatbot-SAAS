import { corsHeaders } from '../../lib/workspace-auth';
import { runAutoGenerateModule } from '../../lib/auto-generate';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const result = await runAutoGenerateModule({
      module: body?.module || '',
      brand: body?.brand || {},
      landingContext: body?.landingContext || null,
      articlePreset: body?.articlePreset || '',
      targetKeyword: body?.targetKeyword || '',
      openRouterKey: body?.openRouterKey || '',
      geminiApiKey: body?.geminiApiKey || '',
      aiModel: body?.aiModel || '',
      env: context.env,
    });

    if (!result.ok) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: result.status, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        module: result.module,
        data: result.data,
        landingContext: result.landingContext,
        source: result.source,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Auto-generate failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
