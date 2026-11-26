import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Copy,
  FileText,
  HeartHandshake,
  LayoutGrid,
  Loader2,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import CustomSelect, { type CustomSelectOption } from './CustomSelect';
import CouncilToCompanionModal, {
  type CouncilHandoffConfirmPayload,
  type CouncilHandoffSource,
} from './CouncilToCompanionModal';
import {
  COMPANION_LABEL_SINGULAR,
  isConsultantCatalogEntryAllowed,
  type PublicCompanionCard,
} from './chatTypes';
import { PREVIEW_PUBLIC_COMPANIONS } from './previewFixtures';

export type NoteSourceType = 'personal' | 'council' | 'companion' | 'apps' | 'reports';

export interface NoteRecord {
  id: string;
  profile_id: string | null;
  profile_label?: string | null;
  source_type: NoteSourceType;
  source_ref_id: string | null;
  astrology_mode: 'vedic' | 'western' | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface LightweightProfile {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean | null;
}

const SOURCE_TABS: { id: 'all' | NoteSourceType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'council', label: 'Council' },
  { id: 'companion', label: COMPANION_LABEL_SINGULAR },
  { id: 'apps', label: 'Apps' },
  { id: 'reports', label: 'Reports' },
];

const SOURCE_LABELS: Record<NoteSourceType, string> = {
  personal: 'Personal Note',
  council: 'Council Chat',
  companion: COMPANION_LABEL_SINGULAR,
  apps: 'Mini-App',
  reports: 'My Reports',
};

const PREVIEW_NOTES: NoteRecord[] = [
  {
    id: 'preview-note-1',
    profile_id: 'preview-prof-1',
    profile_label: 'You (Aarav)',
    source_type: 'council',
    source_ref_id: 'preview-msg-2',
    astrology_mode: 'vedic',
    title: 'Career Pivot Timing & D10 Alignment',
    content: `### 1. Executive Synthesis
Your **10th House and D10 Dasamsa** strongly favor structured autonomy over rigid corporate hierarchy during the upcoming transition window. Across Parashari, KP, and Jaimini checks, entering an advisory mandate is structurally supported—provided contractual retainers are locked before Mercury enters brief combustion.

- **Primary Alignment Window:** Active **Jupiter Antardasha** coupled with Jupiter transiting your 10th house from Lagna brings elevated visibility and higher-trust mandates.
- **Practical Move:** Use the next 45 days to negotiate scope and milestone clarity while avoiding verbal-only commitments.`,
    created_at: '2026-11-17T18:25:00.000Z',
    updated_at: '2026-11-17T18:25:00.000Z',
  },
  {
    id: 'preview-note-2',
    profile_id: 'preview-prof-1',
    profile_label: 'You (Aarav)',
    source_type: 'apps',
    source_ref_id: 'preview-app-daily',
    astrology_mode: 'western',
    title: 'Daily Horoscope · Western Transit Note',
    content: `### Today's Western Sky Alignment
With transiting Jupiter forming a supportive aspect to your natal Midheaven ruler, strategic outreach and written proposals carry unusual clarity today.

- **Morning:** Focus on deep work and structuring deliverables.
- **Afternoon:** Schedule alignment calls with long-term collaborators.`,
    created_at: '2026-11-16T09:15:00.000Z',
    updated_at: '2026-11-16T09:15:00.000Z',
  },
  {
    id: 'preview-note-3',
    profile_id: 'preview-prof-1',
    profile_label: 'You (Aarav)',
    source_type: 'personal',
    source_ref_id: null,
    astrology_mode: null,
    title: 'Questions for Q1 Retainer Review',
    content: `1. Confirm quarterly deliverables before the Saturn-Jupiter sub-period check-in.
2. Revisit independent consulting pricing vs retainer structure.
3. Track energy levels during late-November travel days.`,
    created_at: '2026-11-15T14:40:00.000Z',
    updated_at: '2026-11-15T14:40:00.000Z',
  },
];

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-2xl font-medium text-[#3D3830] mt-4 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-serif text-xl font-medium text-[#3D3830] mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-serif text-lg font-semibold text-[#3D3830] mt-3.5 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-[14px] leading-relaxed text-[#5C5449] mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed text-[#5C5449] mb-3">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1.5 text-[14px] leading-relaxed text-[#5C5449] mb-3">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#3D3830]">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#B8965A]/60 pl-3.5 py-0.5 my-3 text-[#5C5449] italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[12px] bg-[#F1ECE3] text-[#3D3830] px-1.5 py-0.5 rounded">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[#3D3830]/12">
      <table className="w-full text-left border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#F1ECE3] text-[#3D3830]">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold border-b border-[#3D3830]/10">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[#5C5449] border-b border-[#3D3830]/10">{children}</td>
  ),
};

const formatNoteDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatProfileLabel = (p: LightweightProfile): string => {
  const short = typeof p.short_name === 'string' ? p.short_name.trim() : '';
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const SourceIcon: React.FC<{ source: NoteSourceType; className?: string }> = ({
  source,
  className = 'h-3.5 w-3.5',
}) => {
  switch (source) {
    case 'personal':
      return <NotebookPen className={className} />;
    case 'council':
      return <Sparkles className={className} />;
    case 'companion':
      return <HeartHandshake className={className} />;
    case 'apps':
      return <LayoutGrid className={className} />;
    case 'reports':
      return <FileText className={className} />;
  }
};

const NotesPage: React.FC = () => {
  const { getAccessToken, isPreviewMode } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [profiles, setProfiles] = useState<LightweightProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<'all' | NoteSourceType>('all');
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active selection / editor state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Personal note composer/editor state (strictly only for source_type === 'personal')
  const [isComposingNew, setIsComposingNew] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftProfileId, setDraftProfileId] = useState<string>('');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [saveSuccessTick, setSaveSuccessTick] = useState(false);

  // Copy & Delete states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Council note -> Companion handoff states
  const [companionCatalog, setCompanionCatalog] = useState<PublicCompanionCard[]>(
    isPreviewMode ? PREVIEW_PUBLIC_COMPANIONS : []
  );
  const [handoffSource, setHandoffSource] = useState<CouncilHandoffSource | null>(null);
  const [handoffSubmittingSlug, setHandoffSubmittingSlug] = useState<string | null>(null);

  const loadNotesAndProfiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    if (isPreviewMode) {
      setNotes(PREVIEW_NOTES);
      setProfiles([
        { id: 'preview-prof-1', name: 'Aarav Mehta (Sample)', short_name: 'Aarav', is_default: true },
      ]);
      setCompanionCatalog(PREVIEW_PUBLIC_COMPANIONS.filter(isConsultantCatalogEntryAllowed));
      setSelectedNoteId((prev) => prev || PREVIEW_NOTES[0]?.id || null);
      setIsLoading(false);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const [notesRes, profRes, compRes] = await Promise.all([
        fetch('/api/notes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/profiles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/chat/companions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (notesRes.ok) {
        const data = await notesRes.json();
        const loadedNotes = (data.notes || []) as NoteRecord[];
        setNotes(loadedNotes);
        setMigrationPending(Boolean(data.migrationPending));
        if (loadedNotes.length > 0) {
          setSelectedNoteId((prev) =>
            prev && loadedNotes.some((n) => n.id === prev) ? prev : loadedNotes[0].id
          );
        }
      } else {
        setErrorMsg('Could not load notes.');
      }

      if (profRes.ok) {
        const profData = await profRes.json();
        setProfiles((profData.profiles || []) as LightweightProfile[]);
      }

      if (compRes.ok) {
        const compData = await compRes.json().catch(() => ({}));
        if (Array.isArray(compData.companions)) {
          setCompanionCatalog(
            (compData.companions as PublicCompanionCard[]).filter(isConsultantCatalogEntryAllowed)
          );
        }
      }
    } catch {
      setErrorMsg('Network error loading notes.');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, isPreviewMode]);

  useEffect(() => {
    void loadNotesAndProfiles();
  }, [loadNotesAndProfiles]);

  const handleOpenHandoffFromNote = (note: NoteRecord) => {
    const expertLabel =
      note.astrology_mode === 'western'
        ? 'Western Astrologer'
        : note.astrology_mode === 'vedic'
        ? 'Vedic Astrologer'
        : 'Astrology Council';
    setHandoffSource({
      title: note.title,
      rawContent: note.content,
      expertSlug: note.astrology_mode === 'western' ? 'western_astrologer' : 'council_synthesis',
      expertLabel,
      astrologyMode: note.astrology_mode,
      profileId: note.profile_id,
      profileLabel: note.profile_label || null,
      conversationId: null,
      messageId: note.source_ref_id,
    });
  };

  const handleConfirmNoteHandoff = async (payload: CouncilHandoffConfirmPayload) => {
    if (isPreviewMode) {
      setHandoffSource(null);
      navigate(`/app/chat?pillar=companion&companion=${encodeURIComponent(payload.card.slug)}`, {
        state: { councilHandoff: payload },
      });
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setErrorMsg(`Please sign in to chat with a ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`);
      return;
    }

    setHandoffSubmittingSlug(payload.card.slug);
    try {
      const res = await fetch('/api/chat/companions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companionSlug: payload.card.slug,
          forceNew: false,
          profileId: payload.source.profileId ?? undefined,
          handoffNote: payload.handoffNote,
          handoffFromName: payload.source.expertLabel,
          handoffFullContext: payload.fullContext,
          handoffTitle: payload.title,
          handoffExpertLabel: payload.source.expertLabel,
          handoffExpertSlug: payload.source.expertSlug ?? null,
          handoffMessageId: payload.source.messageId ?? null,
          handoffConversationId: payload.source.conversationId ?? null,
          handoffAstrologyMode: payload.source.astrologyMode ?? null,
          rememberReadingNote: payload.rememberReadingNote,
          clientLocalHour: new Date().getHours(),
          pinAsTab: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.conversation?.id) {
        setErrorMsg(data.error || `Could not open ${payload.card.name} right now.`);
        return;
      }
      setHandoffSource(null);
      navigate(`/app/chat/${encodeURIComponent(data.conversation.id)}`);
    } catch {
      setErrorMsg(`Network error starting ${COMPANION_LABEL_SINGULAR} chat.`);
    } finally {
      setHandoffSubmittingSlug(null);
    }
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((note) => {
      if (sourceFilter !== 'all' && note.source_type !== sourceFilter) return false;
      if (profileFilter !== 'all' && note.profile_id !== profileFilter) return false;
      if (systemFilter !== 'all' && note.astrology_mode !== systemFilter) return false;
      if (q) {
        const hay = `${note.title} ${note.content} ${note.profile_label || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, sourceFilter, profileFilter, systemFilter, searchQuery]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  // Sync editor fields when selecting a personal note
  useEffect(() => {
    if (isComposingNew) return;
    if (selectedNote && selectedNote.source_type === 'personal') {
      setDraftTitle(selectedNote.title);
      setDraftContent(selectedNote.content);
      setDraftProfileId(selectedNote.profile_id || '');
    }
  }, [selectedNote, isComposingNew]);

  const profileFilterOptions = useMemo<CustomSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All Charts' },
      ...profiles.map((p) => ({
        value: p.id,
        label: formatProfileLabel(p),
      })),
    ];
  }, [profiles]);

  const systemFilterOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Systems' },
    { value: 'vedic', label: 'Vedic' },
    { value: 'western', label: 'Western' },
  ];

  const personalProfileOptions = useMemo<CustomSelectOption[]>(() => {
    return [
      { value: '', label: 'No linked chart' },
      ...profiles.map((p) => ({
        value: p.id,
        label: formatProfileLabel(p),
      })),
    ];
  }, [profiles]);

  const handleStartNewPersonalNote = () => {
    setIsComposingNew(true);
    setSelectedNoteId(null);
    setDraftTitle('');
    setDraftContent('');
    setDraftProfileId('');
    setConfirmDeleteId(null);
    setErrorMsg(null);
    setMobileShowDetail(true);
  };

  const handleSelectNote = (note: NoteRecord) => {
    setIsComposingNew(false);
    setSelectedNoteId(note.id);
    setConfirmDeleteId(null);
    setErrorMsg(null);
    setMobileShowDetail(true);
  };

  const handleSavePersonalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = draftContent.trim();
    if (!trimmedContent || isSavingPersonal) return;

    const trimmedTitle =
      draftTitle.trim() ||
      trimmedContent.split('\n').find((l) => l.trim())?.trim().slice(0, 90) ||
      'Personal Note';

    if (isPreviewMode) {
      if (isComposingNew) {
        const now = new Date().toISOString();
        const prof = profiles.find((p) => p.id === draftProfileId);
        const created: NoteRecord = {
          id: `preview-note-${Date.now()}`,
          profile_id: draftProfileId || null,
          profile_label: prof ? formatProfileLabel(prof) : null,
          source_type: 'personal',
          source_ref_id: null,
          astrology_mode: null,
          title: trimmedTitle,
          content: trimmedContent,
          created_at: now,
          updated_at: now,
        };
        setNotes((prev) => [created, ...prev]);
        setIsComposingNew(false);
        setSelectedNoteId(created.id);
      } else if (selectedNote && selectedNote.source_type === 'personal') {
        const now = new Date().toISOString();
        setNotes((prev) =>
          prev.map((n) =>
            n.id === selectedNote.id
              ? { ...n, title: trimmedTitle, content: trimmedContent, updated_at: now }
              : n
          )
        );
      }
      setSaveSuccessTick(true);
      window.setTimeout(() => setSaveSuccessTick(false), 1800);
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    setIsSavingPersonal(true);
    setErrorMsg(null);
    try {
      if (isComposingNew) {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
            source_type: 'personal',
            profile_id: draftProfileId || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.note) {
          setErrorMsg(data.error || 'Could not save note.');
          return;
        }
        const prof = profiles.find((p) => p.id === data.note.profile_id);
        const enriched: NoteRecord = {
          ...(data.note as NoteRecord),
          profile_label: prof ? formatProfileLabel(prof) : null,
        };
        setNotes((prev) => [enriched, ...prev]);
        setIsComposingNew(false);
        setSelectedNoteId(enriched.id);
      } else if (selectedNote && selectedNote.source_type === 'personal') {
        const res = await fetch(`/api/notes/${selectedNote.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.note) {
          setErrorMsg(data.error || 'Could not update note.');
          return;
        }
        setNotes((prev) =>
          prev.map((n) =>
            n.id === selectedNote.id ? { ...n, ...(data.note as NoteRecord) } : n
          )
        );
      }
      setSaveSuccessTick(true);
      window.setTimeout(() => setSaveSuccessTick(false), 1800);
    } catch {
      setErrorMsg('Network error saving note.');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (deletingId) return;

    if (isPreviewMode) {
      const remaining = notes.filter((n) => n.id !== noteId);
      setNotes(remaining);
      setConfirmDeleteId(null);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(remaining[0]?.id || null);
        setMobileShowDetail(false);
      }
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const remaining = notes.filter((n) => n.id !== noteId);
        setNotes(remaining);
        setConfirmDeleteId(null);
        if (selectedNoteId === noteId) {
          setSelectedNoteId(remaining[0]?.id || null);
          setMobileShowDetail(false);
        }
      } else {
        setErrorMsg('Could not delete note.');
      }
    } catch {
      setErrorMsg('Network error deleting note.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyContent = async (note: NoteRecord) => {
    try {
      await navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
      setCopiedId(note.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div className="min-h-full bg-[#FAF7F2] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight">
              Notes
            </h1>
            <p className="mt-1 text-sm text-[#5C5449]">
              Your saved insights from Chat, Mini-Apps, and Reports alongside personal reflections.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartNewPersonalNote}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A453D] hover:bg-[#38342E] text-[#FAF7F2] px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Personal Note</span>
          </button>
        </div>

        {migrationPending && (
          <div className="rounded-2xl border border-[#B8965A]/30 bg-[#F1ECE3] px-4 py-3 text-xs text-[#5C5449]">
            Notes storage requires migration <span className="font-mono">008_pro_charts_notes_favourites.sql</span> in Supabase SQL Editor.
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#7A3E36]/20 bg-[#7A3E36]/10 px-4 py-2.5 text-xs text-[#7A3E36]">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
              className="cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Filters Strip */}
        <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {SOURCE_TABS.map((tab) => {
              const active = sourceFilter === tab.id;
              const count =
                tab.id === 'all'
                  ? notes.length
                  : notes.filter((n) => n.source_type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'bg-[#F1ECE3]/80 text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-['DM_Sans',sans-serif] text-[11px] tabular-nums ${
                      active ? 'text-[#FAF7F2]/80' : 'text-[#8B8275]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8275]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, content, or chart..."
                className="w-full rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] pl-9 pr-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#8B7355]"
              />
            </div>
            <div className="sm:col-span-3">
              <CustomSelect
                size="sm"
                surface="canvas"
                ariaLabel="Filter by chart"
                value={profileFilter}
                onChange={setProfileFilter}
                options={profileFilterOptions}
              />
            </div>
            <div className="sm:col-span-3">
              <CustomSelect
                size="sm"
                surface="canvas"
                ariaLabel="Filter by astrology system"
                value={systemFilter}
                onChange={setSystemFilter}
                options={systemFilterOptions}
              />
            </div>
          </div>
        </div>

        {/* Master-Detail Content */}
        {isLoading ? (
          <div className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] py-20 flex flex-col items-center justify-center gap-2 text-[#8B8275]">
            <Loader2 className="h-5 w-5 animate-spin text-[#8B7355]" />
            <p className="text-xs">Loading your notes...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Note List */}
            <div
              className={`lg:col-span-5 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden ${
                mobileShowDetail ? 'hidden lg:block' : 'block'
              }`}
            >
              {filteredNotes.length === 0 ? (
                <div className="px-6 py-14 text-center space-y-3">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1ECE3] text-[#8B7355]">
                    <Bookmark className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-serif text-lg font-medium text-[#3D3830]">
                      {notes.length === 0 ? 'No saved notes yet' : 'No matching notes'}
                    </p>
                    <p className="text-xs text-[#8B8275] max-w-xs mx-auto">
                      {notes.length === 0
                        ? 'Save any insight from Chat, Mini-Apps, or Reports in one click, or jot down your own note.'
                        : 'Try clearing one of the filters or search keywords.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#3D3830]/10 max-h-[68vh] overflow-y-auto">
                  {filteredNotes.map((note) => {
                    const isActive = !isComposingNew && note.id === selectedNoteId;
                    const plainSnippet = note.content
                      .replace(/^#+\s*/gm, '')
                      .replace(/\*\*([^*]+)\*\*/g, '$1')
                      .trim()
                      .slice(0, 120);
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => handleSelectNote(note)}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#F1ECE3] border-l-2 border-l-[#4A453D]'
                            : 'hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#5C5449]">
                            <SourceIcon source={note.source_type} className="h-3.5 w-3.5 text-[#8B7355]" />
                            <span>{SOURCE_LABELS[note.source_type]}</span>
                            {note.astrology_mode && (
                              <span>
                                · {note.astrology_mode === 'western' ? 'Western' : 'Vedic'}
                              </span>
                            )}
                          </span>
                          <span className="font-['DM_Sans',sans-serif] text-[10px] tabular-nums shrink-0">
                            {formatNoteDate(note.created_at)}
                          </span>
                        </div>

                        <p className="mt-1.5 font-serif text-[17px] font-medium text-[#3D3830] leading-snug line-clamp-1">
                          {note.title}
                        </p>

                        <p className="mt-1 text-xs text-[#5C5449]/85 line-clamp-2 leading-relaxed">
                          {plainSnippet}
                        </p>

                        {note.profile_label && (
                          <p className="mt-1.5 text-[11px] text-[#8B8275] font-medium">
                            Chart: {note.profile_label}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Detail / Editor Pane */}
            <div
              className={`lg:col-span-7 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-7 min-h-[420px] ${
                mobileShowDetail ? 'block' : 'hidden lg:block'
              }`}
            >
              {mobileShowDetail && (
                <button
                  type="button"
                  onClick={() => setMobileShowDetail(false)}
                  className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to notes</span>
                </button>
              )}

              {isComposingNew || (selectedNote && selectedNote.source_type === 'personal') ? (
                <form onSubmit={(e) => void handleSavePersonalNote(e)} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#3D3830]/10">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B7355]">
                      <NotebookPen className="h-3.5 w-3.5" />
                      <span>{isComposingNew ? 'New Personal Note' : 'Personal Note'}</span>
                    </span>

                    {!isComposingNew && selectedNote && (
                      <div className="flex items-center gap-2">
                        {confirmDeleteId === selectedNote.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDeleteNote(selectedNote.id)}
                              disabled={deletingId === selectedNote.id}
                              className="rounded-lg bg-[#7A3E36] text-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium cursor-pointer disabled:opacity-60"
                            >
                              {deletingId === selectedNote.id ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-[#3D3830]/15 px-2.5 py-1 text-[11px] text-[#5C5449] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(selectedNote.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-[#3D3830]/12 px-2.5 py-1.5 text-xs text-[#7A3E36] hover:bg-[#7A3E36]/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#8B8275] mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Give this note a clear title..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-serif text-lg font-medium text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#8B7355]"
                    />
                  </div>

                  {isComposingNew && profiles.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#8B8275] mb-1">
                        Link to Chart (optional)
                      </label>
                      <CustomSelect
                        size="sm"
                        surface="canvas"
                        ariaLabel="Link to chart"
                        value={draftProfileId}
                        onChange={setDraftProfileId}
                        options={personalProfileOptions}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-[#8B8275] mb-1">
                      Reflection / Note
                    </label>
                    <textarea
                      rows={11}
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      placeholder="Write your reflections, chart observations, or reminders..."
                      className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-3 text-sm leading-relaxed text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#8B7355]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-[#2D6A4F] font-medium">
                      {saveSuccessTick ? 'Saved cleanly' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      {isComposingNew && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsComposingNew(false);
                            setSelectedNoteId(notes[0]?.id || null);
                            setMobileShowDetail(false);
                          }}
                          className="rounded-xl border border-[#3D3830]/15 px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={!draftContent.trim() || isSavingPersonal}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A453D] hover:bg-[#38342E] text-[#FAF7F2] px-4 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSavingPersonal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{isComposingNew ? 'Save Note' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : selectedNote ? (
                /* Saved Insight from Chat / Companion / Apps / Reports — strictly non-editable */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B8275]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#5C5449]">
                          <SourceIcon
                            source={selectedNote.source_type}
                            className="h-3.5 w-3.5 text-[#8B7355]"
                          />
                          <span>{SOURCE_LABELS[selectedNote.source_type]}</span>
                        </span>
                        {selectedNote.astrology_mode && (
                          <span>
                            ·{' '}
                            {selectedNote.astrology_mode === 'western'
                              ? 'Western'
                              : 'Vedic'}
                          </span>
                        )}
                        {selectedNote.profile_label && (
                          <span>· {selectedNote.profile_label}</span>
                        )}
                        <span className="font-['DM_Sans',sans-serif] text-[11px] tabular-nums">
                          · {formatNoteDate(selectedNote.created_at)}
                        </span>
                      </div>

                      <h2 className="font-serif text-2xl font-medium text-[#3D3830] leading-snug">
                        {selectedNote.title}
                      </h2>
                      <p className="text-[11px] text-[#8B8275]">
                        Saved insight (read-only)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {selectedNote.source_type === 'council' &&
                        companionCatalog.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenHandoffFromNote(selectedNote)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A453D] hover:bg-[#38342E] text-[#FAF7F2] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                          >
                            <HeartHandshake className="h-3.5 w-3.5" />
                            <span>Talk with {COMPANION_LABEL_SINGULAR}</span>
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => void handleCopyContent(selectedNote)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                      >
                        {copiedId === selectedNote.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {confirmDeleteId === selectedNote.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(selectedNote.id)}
                            disabled={deletingId === selectedNote.id}
                            className="rounded-lg bg-[#7A3E36] text-[#FAF7F2] px-2.5 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-60"
                          >
                            {deletingId === selectedNote.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-[#3D3830]/15 px-2.5 py-1.5 text-xs text-[#5C5449] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedNote.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#3D3830]/12 px-2.5 py-1.5 text-xs text-[#7A3E36] hover:bg-[#7A3E36]/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={MARKDOWN_COMPONENTS}
                    >
                      {selectedNote.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center px-6 space-y-2">
                  <Bookmark className="h-6 w-6 text-[#8B8275]" />
                  <p className="font-serif text-xl font-medium text-[#3D3830]">
                    Select a note to read
                  </p>
                  <p className="text-xs text-[#8B8275] max-w-xs">
                    Or create a new personal note to capture chart observations and questions.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CouncilToCompanionModal
        isOpen={Boolean(handoffSource)}
        source={handoffSource}
        companions={companionCatalog}
        submittingSlug={handoffSubmittingSlug}
        onClose={() => {
          if (!handoffSubmittingSlug) setHandoffSource(null);
        }}
        onConfirm={handleConfirmNoteHandoff}
      />
    </div>
  );
};

export default NotesPage;
