/**
 * Isolated V2 Engine Secret Environment Configuration
 *
 * - Reads FREE_ASTRO_API_KEY exclusively from server environment variables.
 * - Never falls back to FREE_ASTROLOGY_API_KEY (legacy production key).
 * - Never writes, echoes, logs, or serializes credentials into artifacts.
 * - Supports Node CLI (.env.local -> .env), AI Studio / Cloud Run env vars,
 *   and Cloudflare Worker secrets (bridged into process.env by worker.ts).
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const FREE_ASTRO_API_ENV_VAR = 'FREE_ASTRO_API_KEY';

const SECRET_HEADER_KEYS = new Set([
  'x-api-key',
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
]);

let cliEnvLoaded = false;

/**
 * Safe CLI-only loader for `.env.local` and `.env` (both gitignored).
 * Does not override already-injected runtime environment variables.
 */
export function loadLocalEnvFilesIfPresent(cwd: string = process.cwd()): {
  loadedFiles: string[];
} {
  if (cliEnvLoaded) return { loadedFiles: [] };
  cliEnvLoaded = true;
  const loadedFiles: string[] = [];

  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.resolve(cwd, filename);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false });
      loadedFiles.push(filename);
    }
  }
  return { loadedFiles };
}

export function getFreeAstroApiKey(): string | null {
  const raw = process.env[FREE_ASTRO_API_ENV_VAR];
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

export function redactSecretsInText(input: string): string {
  const key = getFreeAstroApiKey();
  if (!key) return input;
  return input.split(key).join('[REDACTED]');
}

export function redactSecretsDeep<T>(value: T): T {
  const key = getFreeAstroApiKey();
  if (!key) return value;

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return node.includes(key) ? node.split(key).join('[REDACTED]') : node;
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
