import crypto from 'crypto';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const VALID_SOURCES = new Set(['personal', 'council', 'companion', 'apps', 'reports']);

interface FallbackNoteRow {
  id: string;
  profile_id: string | null;
  source_type: string;
  source_ref_id: string | null;
  astrology_mode: 'vedic' | 'western' | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const memoryUserNotes = new Map<string, FallbackNoteRow[]>();

function isMissingNotesTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

async function readFallbackNotes(supabaseAdmin: SupabaseClient, userId: string): Promise<FallbackNoteRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', `user_notes:${userId}`)
      .maybeSingle();

    if (!error && data?.value_json && typeof data.value_json === 'object') {
      const rawItems = (data.value_json as { items?: unknown }).items;
      if (Array.isArray(rawItems)) {
        const items = rawItems as FallbackNoteRow[];
        memoryUserNotes.set(userId, items);
        return items;
      }
    }
  } catch {
    // Fall through to in-memory fallback
  }
  return memoryUserNotes.get(userId) || [];
}

async function writeFallbackNotes(
  supabaseAdmin: SupabaseClient,
  userId: string,
  items: FallbackNoteRow[]
): Promise<void> {
  memoryUserNotes.set(userId, items);
  try {
    await supabaseAdmin.from('platform_settings').upsert(
      {
        key: `user_notes:${userId}`,
        value_json: { items },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {
    // In-memory store remains updated for current server lifecycle
  }
}

async function resolveProfileLabels(
  supabaseAdmin: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, string>> {
  const profileMap = new Map<string, string>();
  if (profileIds.length === 0) return profileMap;

  const { data: profs } = await supabaseAdmin
    .from('profiles')
    .select('id, name, short_name, is_default')
    .in('id', profileIds);

  for (const p of profs || []) {
    const label = p.is_default
      ? p.short_name
        ? `You (${p.short_name})`
        : 'You'
      : String(p.short_name || p.name);
    profileMap.set(String(p.id), label);
  }
  return profileMap;
}

// GET /api/notes — List notes for current user with optional filters
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const source = typeof req.query.source === 'string' ? req.query.source.trim() : '';
  const profileId = typeof req.query.profileId === 'string' ? req.query.profileId.trim() : '';
  const astrologyMode = typeof req.query.astrologyMode === 'string' ? req.query.astrologyMode.trim() : '';

  try {
    let query = supabaseAdmin
      .from('notes')
      .select('id, profile_id, source_type, source_ref_id, astrology_mode, title, content, created_at, updated_at')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (source && VALID_SOURCES.has(source)) {
      query = query.eq('source_type', source);
    }
    if (profileId) {
      query = query.eq('profile_id', profileId);
    }
    if (astrologyMode === 'vedic' || astrologyMode === 'western') {
      query = query.eq('astrology_mode', astrologyMode);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingNotesTableError(error)) {
        const fallbackAll = await readFallbackNotes(supabaseAdmin, req.appUser.id);
        const filtered = fallbackAll.filter((n) => {
          if (source && VALID_SOURCES.has(source) && n.source_type !== source) return false;
          if (profileId && n.profile_id !== profileId) return false;
          if ((astrologyMode === 'vedic' || astrologyMode === 'western') && n.astrology_mode !== astrologyMode) {
            return false;
          }
          return true;
        });
        const profileIds = Array.from(
          new Set(filtered.map((n) => n.profile_id).filter((id): id is string => Boolean(id)))
        );
        const profileMap = await resolveProfileLabels(supabaseAdmin, profileIds);
        res.json({
          notes: filtered.map((n) => ({
            ...n,
            profile_label: n.profile_id ? profileMap.get(String(n.profile_id)) || null : null,
          })),
          migrationPending: false,
        });
        return;
      }
      res.status(500).json({ error: error.message || 'Could not load notes.' });
      return;
    }

    const profileIds = Array.from(
      new Set((data || []).map((n) => n.profile_id).filter((id): id is string => Boolean(id)))
    );
    const profileMap = await resolveProfileLabels(supabaseAdmin, profileIds);

    const notes = (data || []).map((n) => ({
      ...n,
      profile_label: n.profile_id ? profileMap.get(String(n.profile_id)) || null : null,
    }));

    res.json({ notes, migrationPending: false });
  } catch {
    const fallbackAll = await readFallbackNotes(supabaseAdmin, req.appUser.id);
    res.json({ notes: fallbackAll, migrationPending: false });
  }
});

// POST /api/notes — Create / 1-click save a note
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const body = (req.body || {}) as {
    title?: unknown;
    content?: unknown;
    source_type?: unknown;
    source_ref_id?: unknown;
    profile_id?: unknown;
    astrology_mode?: unknown;
  };

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 40000) : '';
  const sourceType =
    typeof body.source_type === 'string' && VALID_SOURCES.has(body.source_type.trim())
      ? body.source_type.trim()
      : 'personal';
  const sourceRefId =
    typeof body.source_ref_id === 'string' && body.source_ref_id.trim()
      ? body.source_ref_id.trim().slice(0, 120)
      : null;
  const astrologyMode =
    body.astrology_mode === 'vedic' || body.astrology_mode === 'western'
      ? body.astrology_mode
      : null;

  let profileId: string | null =
    typeof body.profile_id === 'string' && body.profile_id.trim() ? body.profile_id.trim() : null;

  if (!content) {
    res.status(400).json({ error: 'Note content is required.' });
    return;
  }

  if (profileId) {
    const { data: ownedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    if (!ownedProfile) {
      profileId = null;
    }
  }

  const resolvedTitle =
    title ||
    content
      .replace(/^#+\s*/gm, '')
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim()
      .slice(0, 100) ||
    'Saved Note';

  try {
    // Prevent accidental duplicate saves of the exact same source_ref_id + source_type
    if (sourceRefId && sourceType !== 'personal') {
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from('notes')
        .select('id, profile_id, source_type, source_ref_id, astrology_mode, title, content, created_at, updated_at')
        .eq('user_id', req.appUser.id)
        .eq('source_type', sourceType)
        .eq('source_ref_id', sourceRefId)
        .maybeSingle();
      if (!existingErr && existing) {
        res.json({ note: existing, alreadySaved: true });
        return;
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('notes')
      .insert({
        user_id: req.appUser.id,
        profile_id: profileId,
        source_type: sourceType,
        source_ref_id: sourceRefId,
        astrology_mode: astrologyMode,
        title: resolvedTitle,
        content,
      })
      .select('id, profile_id, source_type, source_ref_id, astrology_mode, title, content, created_at, updated_at')
      .single();

    if (error || !inserted) {
      if (isMissingNotesTableError(error)) {
        const existingList = await readFallbackNotes(supabaseAdmin, req.appUser.id);
        if (sourceRefId && sourceType !== 'personal') {
          const dup = existingList.find(
            (n) => n.source_type === sourceType && n.source_ref_id === sourceRefId
          );
          if (dup) {
            res.json({ note: dup, alreadySaved: true });
            return;
          }
        }
        const now = new Date().toISOString();
        const created: FallbackNoteRow = {
          id: crypto.randomUUID(),
          profile_id: profileId,
          source_type: sourceType,
          source_ref_id: sourceRefId,
          astrology_mode: astrologyMode,
          title: resolvedTitle,
          content,
          created_at: now,
          updated_at: now,
        };
        await writeFallbackNotes(supabaseAdmin, req.appUser.id, [created, ...existingList].slice(0, 200));
        res.status(201).json({ note: created, alreadySaved: false });
        return;
      }

      console.error('[notes] Failed to insert note:', error);
      res.status(500).json({
        error: error?.message || 'Unable to save note right now.',
      });
      return;
    }

    res.status(201).json({ note: inserted, alreadySaved: false });
  } catch (err) {
    console.error('[notes] Unexpected error saving note:', err);
    res.status(500).json({
      error: 'Unable to save note right now.',
    });
  }
});

// PATCH /api/notes/:id — Update a personal note or title/content
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const noteId = String(req.params.id || '').trim();
  const body = (req.body || {}) as { title?: unknown; content?: unknown };
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };

  if (typeof body.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim().slice(0, 180);
  }
  if (typeof body.content === 'string' && body.content.trim()) {
    updates.content = body.content.trim().slice(0, 40000);
  }

  if (Object.keys(updates).length <= 1) {
    res.status(400).json({ error: 'No valid update fields supplied.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .update(updates)
    .eq('id', noteId)
    .eq('user_id', req.appUser.id)
    .select('id, profile_id, source_type, source_ref_id, astrology_mode, title, content, created_at, updated_at')
    .maybeSingle();

  if (error && isMissingNotesTableError(error)) {
    const existingList = await readFallbackNotes(supabaseAdmin, req.appUser.id);
    const idx = existingList.findIndex((n) => n.id === noteId);
    if (idx === -1) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const updated: FallbackNoteRow = {
      ...existingList[idx],
      ...(updates.title ? { title: updates.title } : {}),
      ...(updates.content ? { content: updates.content } : {}),
      updated_at: updates.updated_at,
    };
    const nextList = [...existingList];
    nextList[idx] = updated;
    await writeFallbackNotes(supabaseAdmin, req.appUser.id, nextList);
    res.json({ note: updated });
    return;
  }

  if (error || !data) {
    res.status(404).json({ error: 'Note not found.' });
    return;
  }

  res.json({ note: data });
});

// DELETE /api/notes/:id — Delete a note
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const noteId = String(req.params.id || '').trim();
  const { error } = await supabaseAdmin
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', req.appUser.id);

  if (error) {
    if (isMissingNotesTableError(error)) {
      const existingList = await readFallbackNotes(supabaseAdmin, req.appUser.id);
      const nextList = existingList.filter((n) => n.id !== noteId);
      await writeFallbackNotes(supabaseAdmin, req.appUser.id, nextList);
      res.json({ deleted: true, id: noteId });
      return;
    }
    res.status(500).json({ error: 'Could not delete note.' });
    return;
  }

  res.json({ deleted: true, id: noteId });
});

export default router;
