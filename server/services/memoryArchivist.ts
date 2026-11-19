import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfigured,
} from './openrouter';

/**
 * Incrementally summarizes the latest consultation exchange into `profiles.profile_memory_summary`
 * while skipping any messages flagged `excluded_from_context`.
 */
export async function updateProfileMemoryAfterTurn(
  profileId: string,
  userId: string
): Promise<void> {
  return rebuildProfileMemory(profileId, userId);
}

/**
 * Rebuilds a profile's longitudinal memory strictly from non-deleted, non-excluded messages
 * across its conversations so excluded/deleted topics never linger in memory.
 */
export async function rebuildProfileMemory(
  profileId: string,
  userId: string
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !isOpenRouterConfigured()) return;

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, user_id')
      .eq('id', profileId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) return;

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id, title')
      .eq('profile_id', profileId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(12);

    if (!conversations || conversations.length === 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ profile_memory_summary: null })
        .eq('id', profileId);
      return;
    }

    const convoIds = conversations.map((c) => c.id);
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, role, content, created_at, excluded_from_context')
      .in('conversation_id', convoIds)
      .eq('excluded_from_context', false)
      .order('created_at', { ascending: false })
      .limit(36);

    if (!messages || messages.length === 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ profile_memory_summary: null })
        .eq('id', profileId);
      return;
    }

    const transcript = [...messages]
      .reverse()
      .map((m) => `${m.role === 'user' ? 'USER' : 'COUNCIL'}: ${String(m.content).slice(0, 600)}`)
      .join('\n\n');

    const completion = await createOpenRouterCompletion({
      model: getUtilityModel(),
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Summarize the longitudinal consultation memory for profile "${profile.name}" from these recent active consultation excerpts.
Focus strictly on:
- Key life events, goals, or decisions the user shared (e.g., marriage, career change, relocation, health focus).
- Major astrological themes and Dasha/transit periods already explored so future sessions remain coherent without repeating basics.
Keep the summary under 220 words in concise bullet points.

TRANSCRIPT EXCERPTS:
${transcript}`,
        },
      ],
    });

    const summary = completion.text.trim() || null;
    await supabaseAdmin
      .from('profiles')
      .update({
        profile_memory_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal memory rebuild error:', err);
  }
}
