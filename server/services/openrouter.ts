import { getResolvedOpenRouterRuntime } from './platformSettings';

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContentPart[];
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function isOpenRouterConfiguredAsync(): Promise<boolean> {
  const runtime = await getResolvedOpenRouterRuntime();
  return Boolean(runtime.apiKey);
}

export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }
  return key;
}

export function getConsultationModel(): string {
  return process.env.OPENROUTER_CONSULTATION_MODEL || 'google/gemini-2.5-flash';
}

export function getUtilityModel(): string {
  return process.env.OPENROUTER_UTILITY_MODEL || 'google/gemini-2.5-flash';
}

export async function getConsultationModelAsync(): Promise<string> {
  const runtime = await getResolvedOpenRouterRuntime();
  return runtime.consultationModel;
}

export async function getUtilityModelAsync(): Promise<string> {
  const runtime = await getResolvedOpenRouterRuntime();
  return runtime.utilityModel;
}

function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.APP_URL || 'https://cosmiccouncil.pro',
    'X-Title': 'Cosmic Council PRO',
  };
}

export async function testOpenRouterConnection(params?: {
  overrideApiKey?: string | null;
  model?: string | null;
}): Promise<{
  ok: boolean;
  modelUsed: string;
  keySource: 'override' | 'database' | 'env' | 'none';
  latencyMs: number;
  replyPreview?: string;
  error?: string;
}> {
  const runtime = await getResolvedOpenRouterRuntime();
  const key = (params?.overrideApiKey || '').trim() || runtime.apiKey;
  const keySource = (params?.overrideApiKey || '').trim() ? 'override' : runtime.keySource;
  const model = (params?.model || '').trim() || runtime.utilityModel || getUtilityModel();

  if (!key) {
    return {
      ok: false,
      modelUsed: model,
      keySource: 'none',
      latencyMs: 0,
      error: 'No OpenRouter API key configured (neither database override nor environment variable).',
    };
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: buildOpenRouterHeaders(key),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Respond with exactly one word: OK' }],
        max_tokens: 16,
        temperature: 0,
        stream: false,
      }),
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        ok: false,
        modelUsed: model,
        keySource,
        latencyMs,
        error: `OpenRouter returned HTTP ${response.status}: ${errText.slice(0, 220)}`,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return {
        ok: false,
        modelUsed: model,
        keySource,
        latencyMs,
        error: json.error.message,
      };
    }

    const replyPreview = extractMessageText(json.choices?.[0]?.message?.content).trim().slice(0, 80);
    return {
      ok: true,
      modelUsed: model,
      keySource,
      latencyMs,
      replyPreview: replyPreview || 'OK',
    };
  } catch (err) {
    return {
      ok: false,
      modelUsed: model,
      keySource,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'OpenRouter connectivity check failed',
    };
  }
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text || '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

export function safeExtractJson<T = unknown>(rawText: string, fallback: T): T {
  try {
    const trimmed = rawText.trim();
    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(unfenced) as T;
  } catch {
    return fallback;
  }
}

export async function createOpenRouterCompletion(params: {
  model?: string;
  system?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  abortSignal?: AbortSignal;
}): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const runtime = await getResolvedOpenRouterRuntime();
  if (!runtime.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const fullMessages: OpenRouterMessage[] = [];
  if (params.system?.trim()) {
    fullMessages.push({ role: 'system', content: params.system.trim() });
  }
  fullMessages.push(...params.messages);

  const bodyPayload: Record<string, unknown> = {
    model: params.model || runtime.utilityModel || getUtilityModel(),
    messages: fullMessages,
    temperature: params.temperature ?? 0.4,
    stream: false,
  };

  if (params.maxTokens) {
    bodyPayload.max_tokens = params.maxTokens;
  }
  if (params.jsonMode) {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: buildOpenRouterHeaders(runtime.apiKey),
    body: JSON.stringify(bodyPayload),
    signal: params.abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error (${response.status}): ${errText.slice(0, 260)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };

  if (json.error?.message) {
    throw new Error(`OpenRouter error: ${json.error.message}`);
  }

  const text = extractMessageText(json.choices?.[0]?.message?.content);
  return {
    text,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
}

export async function streamOpenRouterCompletion(params: {
  model?: string;
  system?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  onChunk: (chunkText: string) => void;
}): Promise<{
  fullText: string;
  tokensIn: number;
  tokensOut: number;
  aborted: boolean;
}> {
  const runtime = await getResolvedOpenRouterRuntime();
  if (!runtime.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const fullMessages: OpenRouterMessage[] = [];
  if (params.system?.trim()) {
    fullMessages.push({ role: 'system', content: params.system.trim() });
  }
  fullMessages.push(...params.messages);

  const bodyPayload: Record<string, unknown> = {
    model: params.model || runtime.consultationModel || getConsultationModel(),
    messages: fullMessages,
    temperature: params.temperature ?? 0.45,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (params.maxTokens) {
    bodyPayload.max_tokens = params.maxTokens;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: buildOpenRouterHeaders(runtime.apiKey),
    body: JSON.stringify(bodyPayload),
    signal: params.abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter stream error (${response.status}): ${errText.slice(0, 260)}`);
  }

  if (!response.body) {
    throw new Error('OpenRouter returned an empty stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let aborted = false;

  try {
    while (true) {
      if (params.abortSignal?.aborted) {
        aborted = true;
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            error?: { message?: string };
          };

          if (parsed.error?.message) {
            throw new Error(parsed.error.message);
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta;
            params.onChunk(delta);
          }

          if (parsed.usage) {
            tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
            tokensOut = parsed.usage.completion_tokens ?? tokensOut;
          }
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            continue;
          }
          throw parseErr;
        }
      }
    }
  } catch (err) {
    if (params.abortSignal?.aborted || (err as Error)?.name === 'AbortError') {
      aborted = true;
    } else {
      throw err;
    }
  }

  return {
    fullText,
    tokensIn,
    tokensOut,
    aborted,
  };
}
