import { callUserGeminiRestCf, corsHeaders } from '../../lib/workspace-auth';
import { loadPromptTemplates } from '../admin/prompts';
import { buildThreadSuggestionsPrompts, parseThreadSuggestionsResponse } from '../../lib/thread-suggestions';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const {
      threadTitle = '',
      threadBody = '',
      threadContext = null,
      platform = 'twitter',
      brand = {},
      campaign = {},
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      count = 6,
    } = body || {};

    const effectiveOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();

    if (!effectiveOrKey && !userGeminiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApiKey: true,
          error: 'Add your own OpenRouter or Google Gemini API key in Settings to generate AI Auto Comments.',
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const activeBrand = campaign && typeof campaign === 'object' && Object.keys(campaign).length > 0 ? campaign : brand;
    const targetCount = Math.max(3, Math.min(8, Number(count) || 6));

    const templates = await loadPromptTemplates(context.env).catch(() => []);
    const organicTpl = Array.isArray(templates) ? templates.find((t: any) => t.id === 'organic') : null;
    const trojanTpl = Array.isArray(templates) ? templates.find((t: any) => t.id === 'trojan') : null;

    const { systemPrompt, userPrompt } = buildThreadSuggestionsPrompts({
      platform,
      threadTitle,
      threadBody,
      threadContext,
      brand: activeBrand,
      organicGuidelines: organicTpl?.system_instruction || '',
      trojanGuidelines: trojanTpl?.system_instruction || '',
      count: targetCount,
    });

    const effectiveModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
    let rawContent = '';
    let responseSource = '';
    let responseModel = effectiveModel;
    let lastOpenRouterStatus = 0;
    let lastOpenRouterError = '';

    if (effectiveOrKey) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveOrKey}`,
            'HTTP-Referer': 'https://smartposter.pro',
            'X-Title': 'Smart Poster Auto Comments',
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.75,
            max_tokens: 1800,
          }),
        });

        if (orRes.ok) {
          const orData: any = await orRes.json();
          rawContent = String(orData?.choices?.[0]?.message?.content || '').trim();
          if (rawContent) {
            responseSource = 'openrouter';
          }
        } else {
          lastOpenRouterStatus = orRes.status;
          const errText = await orRes.text().catch(() => '');
          lastOpenRouterError = `OpenRouter returned HTTP ${orRes.status}`;
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr?.error?.message) lastOpenRouterError = parsedErr.error.message;
          } catch {
            if (errText) lastOpenRouterError = errText.slice(0, 220);
          }
        }
      } catch (orErr: any) {
        lastOpenRouterError = orErr?.message || 'OpenRouter request failed';
      }
    }

    let parsedSuggestions = rawContent ? parseThreadSuggestionsResponse(rawContent, targetCount) : null;

    if (!parsedSuggestions && userGeminiKey) {
      try {
        const gemResult = await callUserGeminiRestCf({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction: systemPrompt,
          prompt: userPrompt,
          temperature: 0.75,
          maxOutputTokens: 2048,
          jsonMode: true,
        });
        if (gemResult.ok && gemResult.text) {
          parsedSuggestions = parseThreadSuggestionsResponse(gemResult.text, targetCount);
          if (parsedSuggestions) {
            responseSource = 'gemini';
            responseModel = gemResult.model;
          }
        } else if (!lastOpenRouterStatus && gemResult.status) {
          lastOpenRouterStatus = gemResult.status;
          lastOpenRouterError = gemResult.error || 'Gemini request failed';
        }
      } catch (gemErr: any) {
        if (!lastOpenRouterError) lastOpenRouterError = gemErr?.message || 'Gemini request failed';
      }
    }

    if (!parsedSuggestions) {
      if (lastOpenRouterStatus) {
        return new Response(
          JSON.stringify({
            success: false,
            needsApiKey: lastOpenRouterStatus === 401 || lastOpenRouterStatus === 403,
            error: lastOpenRouterError || 'OpenRouter generation failed.',
          }),
          { status: lastOpenRouterStatus, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: lastOpenRouterError || 'AI could not generate valid replies for this thread. Please try again.',
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: parsedSuggestions,
        model: responseModel,
        source: responseSource,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Thread suggestions error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
