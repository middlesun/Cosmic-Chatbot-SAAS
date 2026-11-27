/**
 * Isolated V2 Engine Secret Environment Configuration (Cloudflare Workers Safe)
 *
 * - Pure Web / TypeScript (zero Node fs/path/dotenv dependencies).
 * - Reads FREE_ASTRO_API_KEY exclusively from server environment variables.
 * - Never falls back to FREE_ASTROLOGY_API_KEY (legacy production key).
 * - Never writes, echoes, logs, or serializes credentials into artifacts.
 * - Works identically in Node CLI, AI Studio / Cloud Run, and Cloudflare Workers
 *   (where worker.ts bridges Worker Secrets into process.env).
 */

export const FREE_ASTRO_API_ENV_VAR = 'FREE_ASTRO_API_KEY';

const SECRET_HEADER_KEYS = new Set([
  'x-api-key',
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
]);

export function getFreeAstroApiKey(): string | null {
  const raw =
    typeof process !== 'undefined' && process.env
      ? process.env[FREE_ASTRO_API_ENV_VAR]
      : undefined;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getFreeAstroApiSecretStatus(): {
  envVarName: typeof FREE_ASTRO_API_ENV_VAR;
  configured: boolean;
  legacyKeyAffected: false;
  configuredViaMechanismHint: string;
} {
  const key = getFreeAstroApiKey();
  return {
    envVarName: FREE_ASTRO_API_ENV_VAR,
    configured: Boolean(key),
    legacyKeyAffected: false,
    configuredViaMechanismHint: key
      ? 'Detected in runtime process.env.FREE_ASTRO_API_KEY (value redacted).'
      : 'Unset. Set via runtime Secrets / .env.local (local CLI) / `npx wrangler secret put FREE_ASTRO_API_KEY` (Cloudflare).',
  };
}

export function redactHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      out[lk] = SECRET_HEADER_KEYS.has(lk) ? '[REDACTED]' : value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    const lk = key.toLowerCase();
    out[lk] = SECRET_HEADER_KEYS.has(lk) ? '[REDACTED]' : value;
  }
  return out;
}

function collectSecrets(extraSecrets?: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const envKey = getFreeAstroApiKey();
  if (envKey) out.push(envKey);
  if (Array.isArray(extraSecrets)) {
    for (const s of extraSecrets) {
      if (typeof s === 'string') {
        const trimmed = s.trim();
        if (trimmed.length > 0 && !out.includes(trimmed)) {
          out.push(trimmed);
        }
      }
    }
  }
  return out;
}

export function redactSecretsInText(
  input: string,
  extraSecrets?: Array<string | null | undefined>
): string {
  const secrets = collectSecrets(extraSecrets);
  if (secrets.length === 0) return input;
  let result = input;
  for (const s of secrets) {
    result = result.split(s).join('[REDACTED]');
  }
  return result;
}

export function redactSecretsDeep<T>(
  value: T,
  extraSecrets?: Array<string | null | undefined>
): T {
  const secrets = collectSecrets(extraSecrets);

  const scrubStr = (str: string): string => {
    if (secrets.length === 0) return str;
    let out = str;
    for (const s of secrets) {
      if (out.includes(s)) out = out.split(s).join('[REDACTED]');
    }
    return out;
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return scrubStr(node);
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        result[k] = SECRET_HEADER_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : walk(v);
      }
      return result;
    }
    return node;
  };

  return walk(value) as T;
}
