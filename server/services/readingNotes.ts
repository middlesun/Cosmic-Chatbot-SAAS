import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CouncilReadingNoteEntry {
  id: string;
  profile_id: string | null;
  profile_label: string | null;
  expert_slug: string | null;
  expert_label: string;
  astrology_mode: 'vedic' | 'western' | null;
  conversation_id: string | null;
  message_id: string | null;
  title: string;
  summary: string;
  created_at: string;
  origin?: 'shared_handoff' | 'saved_note';
}

const CACHE_TTL_MS = 60_000;
const MAX_SHARED_NOTES_PER_USER = 15;
const readingNotesCache = new Map<
  string,
  { expiresAt: number; items: CouncilReadingNoteEntry[] }
>();

function sanitizeCleanText(raw: unknown, maxLen: number): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

export function invalidateReadingNotesCache(userId: string): void {
  readingNotesCache.delete(userId);
}

async function readExplicitSharedNotes(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<CouncilReadingNoteEntry[]> {
  const cached = readingNotesCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.items;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', `council_reading_notes:${userId}`)
      .maybeSingle();

    if (!error && data?.value_json && typeof data.value_json === 'object') {
      const rawItems = (data.value_json as { items?: unknown }).items;
      if (Array.isArray(rawItems)) {
        const parsed = rawItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            id: String(item.id || crypto.randomUUID()),
            profile_id: typeof item.profile_id === 'string' ? item.profile_id : null,
            profile_label: typeof item.profile_label === 'string' ? item.profile_label : null,
            expert_slug: typeof item.expert_slug === 'string' ? item.expert_slug : null,
            expert_label: String(item.expert_label || 'Council Reading'),
            astrology_mode:
              item.astrology_mode === 'vedic' || item.astrology_mode === 'western'
                ? (item.astrology_mode as 'vedic' | 'western')
                : null,
            conversation_id: typeof item.conversation_id === 'string' ? item.conversation_id : null,
            message_id: typeof item.message_id === 'string' ? item.message_id : null,
            title: sanitizeCleanText(item.title || 'Council Reading Note', 140),
            summary: sanitizeCleanText(item.summary || '', 1400),
            created_at: String(item.created_at || new Date().toISOString()),
            origin: 'shared_handoff' as const,
          }))
          .filter((item) => Boolean(item.summary));

        readingNotesCache.set(userId, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          items: parsed,
        });
        return parsed;
      }
    }
  } catch {
    // Non-fatal fallback
  }

  const fallback = cached?.items || [];
  readingNotesCache.set(userId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    items: fallback,
  });
  return fallback;
}

async function writeExplicitSharedNotes(
  supabaseAdmin: SupabaseClient,
  userId: string,
  items: CouncilReadingNoteEntry[]
): Promise<void> {
  const capped = items.slice(0, MAX_SHARED_NOTES_PER_USER);
  readingNotesCache.set(userId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    items: capped,
  });

  try {
    await supabaseAdmin.from('platform_settings').upsert(
      {
        key: `council_reading_notes:${userId}`,
        value_json: { items: capped },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {
    // Cache stays warm for active process
  }
}

export async function saveSharedReadingNote(
  supabaseAdmin: SupabaseClient,
  userId: string,
  input: {
    profile_id?: string | null;
    profile_label?: string | null;
    expert_slug?: string | null;
    expert_label?: string | null;
    astrology_mode?: 'vedic' | 'western' | null;
    conversation_id?: string | null;
    message_id?: string | null;
    title?: string | null;
    summary: string;
  }
): Promise<CouncilReadingNoteEntry | null> {
  const cleanSummary = sanitizeCleanText(input.summary, 1400);
  if (!cleanSummary) return null;

  let verifiedProfileId: string | null =
    typeof input.profile_id === 'string' && input.profile_id.trim()
      ? input.profile_id.trim()
      : null;
  let resolvedProfileLabel: string | null =
    typeof input.profile_label === 'string' && input.profile_label.trim()
      ? input.profile_label.trim().slice(0, 80)
      : null;

  if (verifiedProfileId) {
    const { data: ownedProf } = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default')
      .eq('id', verifiedProfileId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!ownedProf) {
      verifiedProfileId = null;
      resolvedProfileLabel = null;
    } else if (!resolvedProfileLabel) {
      const short = typeof ownedProf.short_name === 'string' ? ownedProf.short_name.trim() : '';
      resolvedProfileLabel = ownedProf.is_default
        ? short
          ? `You (${short})`
          : 'You'
        : short || String(ownedProf.name || '');
    }
  }

  const existing = await readExplicitSharedNotes(supabaseAdmin, userId);
  const messageIdClean =
    typeof input.message_id === 'string' && input.message_id.trim()
      ? input.message_id.trim().slice(0, 120)
      : null;

  const cleanTitle =
    sanitizeCleanText(input.title, 140) ||
    cleanSummary.split('\n').find((l) => l.trim().length > 0)?.slice(0, 100) ||
    'Council Reading Note';

  const nowIso = new Date().toISOString();
  const entry: CouncilReadingNoteEntry = {
    id: crypto.randomUUID(),
    profile_id: verifiedProfileId,
    profile_label: resolvedProfileLabel,
    expert_slug:
      typeof input.expert_slug === 'string' && input.expert_slug.trim()
        ? input.expert_slug.trim().slice(0, 80)
        : null,
    expert_label: sanitizeCleanText(input.expert_label || 'Council Reading', 80) || 'Council Reading',
    astrology_mode:
      input.astrology_mode === 'vedic' || input.astrology_mode === 'western'
        ? input.astrology_mode
        : null,
    conversation_id:
      typeof input.conversation_id === 'string' && input.conversation_id.trim()
        ? input.conversation_id.trim().slice(0, 120)
        : null,
    message_id: messageIdClean,
    title: cleanTitle,
    summary: cleanSummary,
    created_at: nowIso,
    origin: 'shared_handoff',
  };

  const deduped = existing.filter((item) => {
    if (messageIdClean && item.message_id === messageIdClean) return false;
    if (
      item.title.toLowerCase() === entry.title.toLowerCase() &&
      item.summary.slice(0, 120).toLowerCase() === entry.summary.slice(0, 120).toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  await writeExplicitSharedNotes(supabaseAdmin, userId, [entry, ...deduped]);
  return entry;
}

export async function deleteSharedReadingNote(
  supabaseAdmin: SupabaseClient,
  userId: string,
  noteId: string
): Promise<boolean> {
  const existing = await readExplicitSharedNotes(supabaseAdmin, userId);
  const next = existing.filter((item) => item.id !== noteId);
  if (next.length === existing.length) return false;
  await writeExplicitSharedNotes(supabaseAdmin, userId, next);
  return true;
}

export async function listSharedReadingNotes(
  supabaseAdmin: SupabaseClient,
  userId: string,
  profileId?: string | null,
  options?: { includeSavedCouncilNotes?: boolean }
): Promise<CouncilReadingNoteEntry[]> {
  const explicitNotes = await readExplicitSharedNotes(supabaseAdmin, userId);
  let savedCouncilNotes: CouncilReadingNoteEntry[] = [];

  if (options?.includeSavedCouncilNotes !== false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notes')
        .select('id, profile_id, source_ref_id, astrology_mode, title, content, created_at')
        .eq('user_id', userId)
        .eq('source_type', 'council')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!error && Array.isArray(data) && data.length > 0) {
        const seenMsgIds = new Set(
          explicitNotes.map((n) => n.message_id).filter((id): id is string => Boolean(id))
        );
        savedCouncilNotes = data
          .filter((row) => !row.source_ref_id || !seenMsgIds.has(String(row.source_ref_id)))
          .map((row) => ({
            id: `saved_note:${row.id}`,
            profile_id: row.profile_id ? String(row.profile_id) : null,
            profile_label: null,
            expert_slug: null,
            expert_label:
              row.astrology_mode === 'western'
                ? 'Saved Western Council Note'
                : 'Saved Vedic Council Note',
            astrology_mode:
              row.astrology_mode === 'vedic' || row.astrology_mode === 'western'
                ? (row.astrology_mode as 'vedic' | 'western')
                : null,
            conversation_id: null,
            message_id: row.source_ref_id ? String(row.source_ref_id) : null,
            title: sanitizeCleanText(row.title || 'Saved Council Insight', 140),
            summary: sanitizeCleanText(
              String(row.content || '')
                .replace(/^#+\s*/gm, '')
                .replace(/\*\*([^*]+)\*\*/g, '$1'),
              900
            ),
            created_at: String(row.created_at || new Date().toISOString()),
            origin: 'saved_note' as const,
          }))
          .filter((n) => Boolean(n.summary));
      }
    } catch {
      // Non-fatal if notes table isn't migrated yet
    }
  }

  const combined = [...explicitNotes, ...savedCouncilNotes];
  if (profileId) {
    combined.sort((a, b) => {
      const aMatch = a.profile_id === profileId ? 2 : a.profile_id === null ? 1 : 0;
      const bMatch = b.profile_id === profileId ? 2 : b.profile_id === null ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else {
    combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return combined;
}

export function formatCouncilReadingNotesForCompanion(
  notes: CouncilReadingNoteEntry[],
  maxNotes = 4
): string {
  if (!notes || notes.length === 0) return '';
  const selected = notes.slice(0, maxNotes);
  const blocks = selected.map((note, idx) => {
    const datePart = note.created_at ? note.created_at.slice(0, 10) : '';
    const meta = [
      note.expert_label,
      note.profile_label ? `Chart: ${note.profile_label}` : null,
      datePart || null,
    ]
      .filter(Boolean)
      .join(' · ');
    return `[Note ${idx + 1} · ${meta}]\nTitle: ${note.title}\nTakeaway: ${note.summary.slice(0, 520)}`;
  });

  return blocks.join('\n\n').slice(0, 2200);
}
