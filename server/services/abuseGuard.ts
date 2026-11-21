import crypto from 'node:crypto';
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PROMPT_EXTRACTION_REFUSAL =
  'I keep my internal consultation framework private so we can focus fully on your birth chart and life questions. What area of your chart would you like to explore today?';

export const DUPLICATE_CHART_NETWORK_ERROR =
  'This birth chart appears already registered from your network. Please sign in to your original account or upgrade your plan to manage additional client charts.';

// ─── 1. Client IP Extraction & Salted Hashing ────────────────────────────────

export function extractClientIp(req: Request): string | null {
  const cfHeader = req.headers['cf-connecting-ip'];
  const cfIp = Array.isArray(cfHeader) ? cfHeader[0] : cfHeader;
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  const xffHeader = req.headers['x-forwarded-for'];
  const xffRaw = Array.isArray(xffHeader) ? xffHeader[0] : xffHeader;
  if (typeof xffRaw === 'string' && xffRaw.trim()) {
    const firstHop = xffRaw.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  }

  const remote = req.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.trim()) {
    return remote.replace(/^::ffff:/, '').trim();
  }

  return null;
}

function getIpHashSalt(): string {
  return (
    process.env.IP_HASH_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) ||
    'cosmic-council-ip-salt-v2'
  );
}

export function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const normalized = ip.trim().toLowerCase();
  if (!normalized) return null;
  return crypto
    .createHash('sha256')
    .update(`${getIpHashSalt()}:${normalized}`)
    .digest('hex')
    .slice(0, 32);
}

export function getClientIpHash(req: Request): string | null {
  return hashClientIp(extractClientIp(req));
}

// ─── 2. Lightweight In-Memory Rate Limiter ───────────────────────────────────

interface RateWindowEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateWindowEntry>();
const RATE_STORE_MAX_KEYS = 5000;

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();

  if (rateLimitStore.size > RATE_STORE_MAX_KEYS) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt <= now) rateLimitStore.delete(k);
    }
  }

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

// ─── 3. Deterministic Fuzzy Birth-Chart Fingerprint ──────────────────────────

export interface ChartFingerprintInput {
  birthDate: string;
  birthTime: string;
  birthCity?: string | null;
  birthCountry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function normalizeGeoText(val: string | null | undefined): string {
  return String(val || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function get45MinEpochBucket(birthDate: string, birthTime: string): number | null {
  const dateMatch = String(birthDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const timeParts = String(birthTime || '12:00').trim().split(':');
  const hh = Math.min(23, Math.max(0, Number(timeParts[0]) || 0));
  const mm = Math.min(59, Math.max(0, Number(timeParts[1]) || 0));

  const epochMs = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hh,
    mm,
    0
  );
  if (!Number.isFinite(epochMs)) return null;
  return Math.floor(epochMs / (45 * 60 * 1000));
}

function hashFingerprintRaw(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 28);
}

function roundCoord025(val: number): string {
  return (Math.round(val * 4) / 4).toFixed(2);
}

export function computeChartFingerprint(input: ChartFingerprintInput): string | null {
  const bucket = get45MinEpochBucket(input.birthDate, input.birthTime);
  if (bucket === null) return null;

  if (
    typeof input.latitude === 'number' &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.longitude)
  ) {
    return hashFingerprintRaw(
      `geo:${bucket}:${roundCoord025(input.latitude)},${roundCoord025(input.longitude)}`
    );
  }

  const cityKey = `${normalizeGeoText(input.birthCity)}|${normalizeGeoText(input.birthCountry)}`;
  if (!cityKey || cityKey === '|') return null;
  return hashFingerprintRaw(`city:${bucket}:${cityKey}`);
}

function computeCandidateFingerprints(
  input: ChartFingerprintInput,
  includeAdjacentBuckets: boolean
): Set<string> {
  const hashes = new Set<string>();
  const bucket = get45MinEpochBucket(input.birthDate, input.birthTime);
  if (bucket === null) return hashes;

  const buckets = includeAdjacentBuckets ? [bucket - 1, bucket, bucket + 1] : [bucket];
  const hasGeo =
    typeof input.latitude === 'number' &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.longitude);
  const cityKey = `${normalizeGeoText(input.birthCity)}|${normalizeGeoText(input.birthCountry)}`;

  for (const b of buckets) {
    if (hasGeo) {
      hashes.add(
        hashFingerprintRaw(
          `geo:${b}:${roundCoord025(input.latitude as number)},${roundCoord025(input.longitude as number)}`
        )
      );
    }
    if (cityKey && cityKey !== '|') {
      hashes.add(hashFingerprintRaw(`city:${b}:${cityKey}`));
    }
  }

  return hashes;
}

export async function isPaidOrPrivilegedUser(
  supabaseAdmin: SupabaseClient,
  user: { id: string; tier: string; is_admin?: boolean }
): Promise<boolean> {
  if (user.is_admin) return true;
  if (user.tier === 'pro' || user.tier === 'guru') return true;

  const { count } = await supabaseAdmin
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'succeeded');

  return (count || 0) > 0;
}

export async function checkDuplicateChartAbuse(params: {
  supabaseAdmin: SupabaseClient;
  user: { id: string; tier: string; is_admin?: boolean };
  ipHash: string | null;
  birthDate: string;
  birthTime: string;
  birthCity?: string | null;
  birthCountry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  excludeProfileId?: string | null;
}): Promise<{ blocked: boolean; reason?: string }> {
  const { supabaseAdmin, user, ipHash } = params;

  if (!ipHash) {
    return { blocked: false };
  }

  const privileged = await isPaidOrPrivilegedUser(supabaseAdmin, user);
  if (privileged) {
    return { blocked: false };
  }

  const candidateHashes = computeCandidateFingerprints(
    {
      birthDate: params.birthDate,
      birthTime: params.birthTime,
      birthCity: params.birthCity,
      birthCountry: params.birthCountry,
      latitude: params.latitude,
      longitude: params.longitude,
    },
    true
  );

  if (candidateHashes.size === 0) {
    return { blocked: false };
  }

  // Find any distinct accounts sharing signup_ip_hash or last_ip_hash
  const { data: sameIpUsers, error: ipQueryErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .neq('id', user.id)
    .or(`signup_ip_hash.eq.${ipHash},last_ip_hash.eq.${ipHash}`)
    .limit(50);

  if (ipQueryErr || !sameIpUsers || sameIpUsers.length === 0) {
    return { blocked: false };
  }

  const otherUserIds = sameIpUsers.map((u) => u.id);

  let otherProfiles: Array<{
    id: string;
    user_id: string;
    birth_date: string;
    birth_time: string;
    birth_city: string;
    birth_country: string;
    latitude: number | null;
    longitude: number | null;
    chart_fingerprint?: string | null;
  }> | null = null;

  const primaryRes = await supabaseAdmin
    .from('profiles')
    .select(
      'id, user_id, birth_date, birth_time, birth_city, birth_country, latitude, longitude, chart_fingerprint'
    )
    .in('user_id', otherUserIds);

  if (!primaryRes.error && primaryRes.data) {
    otherProfiles = primaryRes.data;
  } else {
    const fallbackRes = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, birth_date, birth_time, birth_city, birth_country, latitude, longitude')
      .in('user_id', otherUserIds);
    otherProfiles = fallbackRes.data || [];
  }

  for (const existing of otherProfiles || []) {
    if (params.excludeProfileId && existing.id === params.excludeProfileId) continue;

    if (existing.chart_fingerprint && candidateHashes.has(existing.chart_fingerprint)) {
      return { blocked: true, reason: DUPLICATE_CHART_NETWORK_ERROR };
    }

    const existingHashes = computeCandidateFingerprints(
      {
        birthDate: existing.birth_date,
        birthTime: existing.birth_time,
        birthCity: existing.birth_city,
        birthCountry: existing.birth_country,
        latitude: existing.latitude,
        longitude: existing.longitude,
      },
      false
    );

    for (const h of existingHashes) {
      if (candidateHashes.has(h)) {
        return { blocked: true, reason: DUPLICATE_CHART_NETWORK_ERROR };
      }
    }
  }

  return { blocked: false };
}

// ─── 4. Multi-Layer Prompt-Extraction Defense ────────────────────────────────

const EXTRACTION_PATTERNS: RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b.{0,35}\b(?:all\s+)?(?:previous|prior|above|system|initial|earlier)\b.{0,25}\b(?:instructions|directives|prompts?|rules|guidelines)\b/i,
  /\b(?:show|reveal|print|display|output|repeat|dump|share|tell\s+me|give\s+me|what\s+(?:is|are))\b.{0,35}\b(?:your|the|exact|full|entire|hidden|internal)\b.{0,25}\b(?:system\s*prompt|system\s*instructions?|developer\s*(?:prompt|instructions?|message)|core\s*directives?|constitution|prompt\s*template|internal\s*rules?|scoring\s*rules?)\b/i,
  /\bwhat\s+prompt\s+are\s+you\s+using\b/i,
  /\b(?:print|output|repeat|quote|copy|show)\s+(?:everything|all\s+text|verbatim|the\s+text)\s+(?:above|before\s+this)\b/i,
  /\b(?:translate|encode|convert|summarize|paraphrase)\b.{0,30}\b(?:your|the)\s+(?:system\s*prompt|instructions?|directives?|prompt)\b.{0,30}\b(?:base64|rot13|hex|json|yaml|markdown|hindi|spanish|french)?\b/i,
  /\b(?:core\s+cosmic\s+council\s+directives|act\s+as\s+the\s+cosmic\s+council\s+synthesis\s+lead)\b/i,
];

function normalizeForPromptScan(input: string): string {
  return String(input || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectPromptExtractionAttempt(userText: string): boolean {
  const normalized = normalizeForPromptScan(userText);
  if (!normalized || normalized.length < 10) return false;
  return EXTRACTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

const INTERNAL_LEAK_SIGNATURES: RegExp[] = [
  /CORE\s+COSMIC\s+COUNCIL\s+DIRECTIVES/i,
  /CONSULTATION\s+MODE:/,
  /OUTPUT\s+FORMAT:/,
  /ACT\s+AS\s+(?:A|THE)\b/,
  /ACTIVE\s+NATAL\s+CHART\s+CONTEXT/i,
  /LONGITUDINAL\s+PROFILE\s+MEMORY\s*\(Themes/i,
];

export function containsInternalPromptLeak(text: string): boolean {
  if (!text) return false;
  return INTERNAL_LEAK_SIGNATURES.some((sig) => sig.test(text));
}

/**
 * Light, non-destructive Sutradhara prose sanitizer:
 * - Replaces archaic third-person chart tells ("the native", "the native's") with second-person ("you", "your")
 * - Strips accidental internal cartridge/priority debug tags ([F_...], [PRIO_...])
 * - Preserves markdown structure, tables, code fences, and inline Sanskrit/Jyotish terms
 */
export function sanitizeSutraProse(text: string): string {
  if (!text) return text;

  // Preserve fenced code blocks untouched
  const codeBlocks: string[] = [];
  let working = text.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CC_CODE_BLOCK_${idx}__`;
  });

  working = working
    // Possessive forms first: "The native's" / "the native's" / "a native's"
    .replace(/\b(?:The|A)\s+native['’]s\b/g, (match, offset, fullStr) => {
      const before = fullStr.slice(Math.max(0, offset - 3), offset);
      return offset === 0 || /(?:^|[.!?]\s+|\n|:\s+)$/.test(before) ? 'Your' : 'your';
    })
    .replace(/\b(?:the|a)\s+native['’]s\b/g, 'your')
    .replace(/\bnative['’]s\b(?=\s+(?:chart|birth|life|career|marriage|partner|spouse|mind|health|wealth|dasha|house|lagna|moon|horoscope|family|income))/gi, (m) =>
      m[0] === 'N' ? 'Your' : 'your'
    )
    // Subject/object forms with immediate 3rd-person verb agreement: "The native has/is/was/does" -> "You have/are/were/do"
    .replace(
      /\b(?:The|the|A|a)\s+native\s+(is|was|has|does|faces|carries|holds|shows|experiences|tends|needs|gains|receives|enters|benefits)\b/g,
      (match, verb: string, offset: number, fullStr: string) => {
        const before = fullStr.slice(Math.max(0, offset - 3), offset);
        const cap =
          (match[0] === 'T' || match[0] === 'A') &&
          (offset === 0 || /(?:^|[.!?]\s+|\n|:\s+)$/.test(before));
        const subj = cap ? 'You' : 'you';
        const vLower = verb.toLowerCase();
        const verbMap: Record<string, string> = {
          is: 'are',
          was: 'were',
          has: 'have',
          does: 'do',
          faces: 'face',
          carries: 'carry',
          holds: 'hold',
          shows: 'show',
          experiences: 'experience',
          tends: 'tend',
          needs: 'need',
          gains: 'gain',
          receives: 'receive',
          enters: 'enter',
          benefits: 'benefit',
        };
        return `${subj} ${verbMap[vLower] || vLower}`;
      }
    )
    // General subject/object forms: "The native" / "the native"
    .replace(/\b(?:The|A)\s+native\b/g, (match, offset, fullStr) => {
      const before = fullStr.slice(Math.max(0, offset - 3), offset);
      return offset === 0 || /(?:^|[.!?]\s+|\n|:\s+)$/.test(before) ? 'You' : 'you';
    })
    .replace(/\b(?:the|a)\s+native\b/g, 'you')
    // Strip any accidental internal rule token leakage like [F_DASHA_LADDER] or (PRIO_CAREER)
    .replace(/\[(?:F|PRIO)_[A-Z0-9_]+\]\s*/g, '')
    .replace(/\((?:F|PRIO)_[A-Z0-9_]+\)\s*/g, '')
    // Strip legacy prompt-structure markers (:::prediction, :::analysis, :::, [CONFIDENCE: ...], [FOLLOWUP])
    .replace(/^[ \t]*:::[a-zA-Z0-9_-]*[ \t]*(?:\r?\n|$)/gm, '')
    .replace(/:::(?:prediction|analysis)\b[ \t]*/gi, '')
    .replace(/[ \t]*:::[ \t]*$/gm, '')
    .replace(/\[CONFIDENCE\s*:[^\]]*\][ \t]*/gi, '')
    .replace(/^[ \t]*\[FOLLOWUP\][^\n]*(?:\r?\n|$)/gim, '')
    .replace(/\[FOLLOWUP\][ \t]*/gi, '')
    .replace(/\n{3,}/g, '\n\n');

  if (codeBlocks.length > 0) {
    working = working.replace(/__CC_CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)] || '');
  }

  return working.trimEnd();
}

export function sanitizeAssistantOutput(text: string): {
  text: string;
  leaked: boolean;
} {
  if (containsInternalPromptLeak(text)) {
    return { text: PROMPT_EXTRACTION_REFUSAL, leaked: true };
  }
  return { text: sanitizeSutraProse(text), leaked: false };
}
