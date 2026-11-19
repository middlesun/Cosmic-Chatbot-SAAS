import { callUserGeminiRestCf, corsHeaders } from '../../lib/workspace-auth';

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body = (await context.request.json()) as any;
    const {
      threadTitle = '',
      threadBody = '',
      variations = [],
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
    } = body;

    if (!Array.isArray(variations) || variations.length === 0) {
      return new Response(JSON.stringify({ success: true, bestIndex: 0 }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (variations.length === 1) {
      return new Response(JSON.stringify({ success: true, bestIndex: 0 }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const combinedThread = `${threadTitle} ${threadBody}`.toLowerCase();
    let bestScore = -1;
    let bestIdx = 0;
    variations.forEach((v: string, idx: number) => {
      const words = (v || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      let score = 0;
      words.forEach((w) => {
        if (combinedThread.includes(w)) score += 2;
      });
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    const userOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    if (!userOrKey && !userGeminiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          bestIndex: bestIdx,
          reason: 'Keyword overlap alignment',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const variationsList = variations
      .map((v: string, i: number) => `[Index ${i}]: "${String(v).replace(/"/g, '\\"')}"`)
      .join('\n\n');

    const prompt = `Analyze this thread:\nTitle: ${threadTitle}\nPost: ${String(threadBody || '').slice(0, 1500)}\n\nVariations:\n${variationsList}\n\nChoose the single best variation index (0 to ${variations.length - 1}). Respond ONLY with JSON: {"bestIndex": <number>, "reason": "<brief explanation>"}`;

    if (userOrKey) {
      try {
        const orModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userOrKey}`,
          },
          body: JSON.stringify({
            model: orModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 200,
          }),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const raw = String(orData?.choices?.[0]?.message?.content || '').trim();
          const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(clean);
          if (typeof parsed.bestIndex === 'number' && parsed.bestIndex >= 0 && parsed.bestIndex < variations.length) {
            return new Response(
              JSON.stringify({ success: true, bestIndex: parsed.bestIndex, reason: parsed.reason || '' }),
              { status: 200, headers: corsHeaders }
            );
          }
        }
      } catch {}
    }

    if (userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRestCf({
          apiKey: userGeminiKey,
          model: aiModel,
          prompt,
          temperature: 0.2,
          maxOutputTokens: 200,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          const parsed = JSON.parse(gemRes.text);
          if (typeof parsed.bestIndex === 'number' && parsed.bestIndex >= 0 && parsed.bestIndex < variations.length) {
            return new Response(
              JSON.stringify({ success: true, bestIndex: parsed.bestIndex, reason: parsed.reason || '' }),
              { status: 200, headers: corsHeaders }
            );
          }
        }
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        bestIndex: bestIdx,
        reason: 'Topical keyword alignment',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error processing context matching',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
