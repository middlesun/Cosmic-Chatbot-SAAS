import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import CompanionAvatar from '../app/CompanionAvatar';
import CustomSelect from '../app/CustomSelect';
import { speakMessageText, stopSpeaking } from '../app/chatUtilities';
import {
  CHAT_STYLE_OPTIONS,
  COMPANION_GROUP_OPTIONS,
  type ChatStyle,
  type CompanionAutonomyLevel,
  type CompanionCategoryTag,
  type CompanionGroup,
  type CompanionMonogramPalette,
  type CompanionSex,
  type CompanionSkillLevel,
  type CompanionTtsVoiceProfile,
} from '../app/chatTypes';
import type { ModelChoiceOption } from './PromptLibraryManager';

export interface AdminCompanionRecord {
  id: string;
  slug: string;
  legacy_id: string | null;
  name: string;
  age: number;
  sex: CompanionSex;
  tagline: string;
  card_subtitle?: string;
  short_bio: string;
  full_bio: string;
  how_conversations_feel?: string;
  primary_expertise: string;
  secondary_expertise: string[];
  category_tag: CompanionCategoryTag;
  companion_group?: CompanionGroup;
  situation_tags?: string[];
  cultural_fluency: string;
  avatar_url: string | null;
  monogram_palette: CompanionMonogramPalette;
  welcome_messages: string[];
  system_prompt: string;
  backstory: string;
  soul_consciousness: string;
  hard_rules: string;
  soft_rules: string;
  autonomy_level: CompanionAutonomyLevel;
  override_global_rules: boolean;
  skill_level: CompanionSkillLevel;
  chat_style: ChatStyle;
  model_id: string | null;
  tts_voice_profile: CompanionTtsVoiceProfile;
  supports_listening_cue: boolean;
  suggestions_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface PortraitGalleryItem {
  slug: string;
  label: string;
  url: string;
}

interface AdminCompanionsManagerProps {
  getAccessToken: () => Promise<string | null>;
  modelOptions: ModelChoiceOption[];
}

type EditorTab = 'identity' | 'prompts' | 'behavior';

const CATEGORY_OPTIONS: Array<{ value: CompanionCategoryTag; label: string }> = [
  { value: 'friends', label: 'Everyday Friends & Banter' },
  { value: 'support', label: 'Emotional Support & Listeners' },
  { value: 'astrology', label: 'Astrology-Aware Companions' },
  { value: 'tarot_numerology', label: 'Tarot & Numerology Guides' },
  { value: 'past_life', label: 'Past-Life & Spiritual Guides' },
];

const SKILL_LEVEL_OPTIONS: Array<{
  value: CompanionSkillLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'none_emotional',
    label: 'Human Companion Only (No Esoteric Reading)',
    description: 'Uses chart/profile silently for life-stage awareness; refers readings to specialists.',
  },
  {
    value: 'astrology_soft',
    label: 'Astrology Soft (Conversational)',
    description: 'Discusses planets & cycles warmly only when relevant or invited.',
  },
  {
    value: 'vedic_soft',
    label: 'Vedic Jyotish Soft',
    description: 'Weaves Dashas, Nakshatras & houses gently in everyday language.',
  },
  {
    value: 'tarot',
    label: 'Tarot Archetypes',
    description: 'Reflective Rider-Waite card symbolism & grounded spreads.',
  },
  {
    value: 'numerology',
    label: 'Pythagorean Numerology',
    description: 'Life Path, Personal Year & number cycles.',
  },
  {
    value: 'past_life',
    label: 'Past-Life & Karmic Reflection',
    description: 'Deep karmic themes, South Node / Ketu archetypes & meaning.',
  },
];

const AUTONOMY_OPTIONS: Array<{
  value: CompanionAutonomyLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'steady',
    label: 'Steady (Anchored)',
    description: 'Holds default pacing closely; bends soft rules only on strong emotional shifts.',
  },
  {
    value: 'intuitive',
    label: 'Intuitive (Balanced Default)',
    description: 'Adapts naturally between short texting, gentle pushback, and deeper letters.',
  },
  {
    value: 'free',
    label: 'Free (Organic Judgment)',
    description: 'Prioritizes human instinct and authentic pacing over rigid formatting habits.',
  },
];

const SEX_OPTIONS = [
  { value: 'F', label: 'Female (F)' },
  { value: 'M', label: 'Male (M)' },
  { value: 'NB', label: 'Non-binary (NB)' },
];

const DEFAULT_NEW_PALETTE: CompanionMonogramPalette = {
  bg: '#EAE3D7',
  ring: '#B8965A',
  ink: '#3D3830',
};

const SKILL_BADGE_MAP: Record<CompanionSkillLevel, string> = {
  none_emotional: 'Human Only',
  astrology_soft: 'Astrology',
  vedic_soft: 'Vedic',
  tarot: 'Tarot',
  numerology: 'Numerology',
  past_life: 'Past Life',
};

const GLOBAL_COMPANION_PROMPT_META = [
  {
    key: 'companion_constitution',
    label: 'Global Companion Constitution (Fallback Layer 1)',
    description:
      'Active whenever a companion has "Override Global Rules" turned OFF (or lacks custom Hard Rules).',
  },
  {
    key: 'companion_realism_baseline',
    label: 'Universal Realism & Anti-AI Baseline (Always Active)',
    description:
      'Enforces natural human conversation across ALL 45 companions regardless of override toggles.',
  },
  {
    key: 'companion_chart_presence_prompt',
    label: 'Chart & Life-Awareness Guidance (Esoteric-Enabled Companions)',
    description:
      'Controls how companions with Astrology / Vedic / Tarot / Numerology / Past-Life skills blend chart knowledge warmly.',
  },
  {
    key: 'companion_return_greeting_prompt',
    label: 'Natural Return-Greeting Guidance',
    description:
      'Shapes how companions greet returning users across time gaps without sounding scripted.',
  },
  {
    key: 'companion_bond_extractor_prompt',
    label: 'Shared Bond & Relationship Memory Extractor',
    description:
      'Extracts slang cues, tone preferences, and inside references per (user x companion) bond.',
  },
] as const;

type GlobalCompanionPromptKey = (typeof GLOBAL_COMPANION_PROMPT_META)[number]['key'];

function createBlankCompanion(nextSortOrder: number): AdminCompanionRecord {
  return {
    id: '__new__',
    slug: '',
    legacy_id: null,
    name: '',
    age: 30,
    sex: 'F',
    tagline: '',
    card_subtitle: '',
    short_bio: '',
    full_bio: '',
    how_conversations_feel: '',
    primary_expertise: 'Friend',
    secondary_expertise: [],
    category_tag: 'friends',
    companion_group: 'everyday_companions',
    situation_tags: [],
    cultural_fluency: 'English · Warm Everyday',
    avatar_url: null,
    monogram_palette: { ...DEFAULT_NEW_PALETTE },
    welcome_messages: [
      "Hey—good to see you here. Take a breath, what's on your mind today?",
    ],
    system_prompt: '',
    backstory: '',
    soul_consciousness: '',
    hard_rules:
      'NON-NEGOTIABLE GUARDRAILS:\n- Stay inside your lived human persona; never refer to yourself as an AI or bot.\n- Never diagnose medical/psychiatric conditions or invent chart placements not provided.',
    soft_rules:
      'SOFT INSTINCTS (Override whenever real human judgment calls for it):\n- Keep replies natural and conversational like real texting unless a deeper moment calls for more.',
    autonomy_level: 'intuitive',
    override_global_rules: true,
    skill_level: 'none_emotional',
    chat_style: 'chat_bubbles',
    model_id: null,
    tts_voice_profile: { rate: 1.0, pitch: 1.0 },
    supports_listening_cue: true,
    suggestions_enabled: true,
    is_active: true,
    sort_order: nextSortOrder,
  };
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function approxTokens(text: string): number {
  const len = (text || '').trim().length;
  return len === 0 ? 0 : Math.ceil(len / 4);
}

const AdminCompanionsManager: React.FC<AdminCompanionsManagerProps> = ({
  getAccessToken,
  modelOptions,
}) => {
  const [companions, setCompanions] = useState<AdminCompanionRecord[]>([]);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [defaultSlugs, setDefaultSlugs] = useState<string[]>([]);
  const [availablePortraits, setAvailablePortraits] = useState<PortraitGalleryItem[]>([]);
  const [monogramPalettes, setMonogramPalettes] = useState<
    Record<string, CompanionMonogramPalette>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [managerView, setManagerView] = useState<'roster' | 'global'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [sexFilter, setSexFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminCompanionRecord | null>(null);
  const [secondaryText, setSecondaryText] = useState('');
  const [situationTagsText, setSituationTagsText] = useState('');
  const [editorTab, setEditorTab] = useState<EditorTab>('identity');

  const [globalPromptsLoaded, setGlobalPromptsLoaded] = useState(false);
  const [globalPromptsLoading, setGlobalPromptsLoading] = useState(false);
  const [globalPromptsSaving, setGlobalPromptsSaving] = useState(false);
  const [engineOverrides, setEngineOverrides] = useState<Record<string, string>>({});
  const [engineDefaults, setEngineDefaults] = useState<Record<string, string>>({});
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);

  const isCreating = draft?.id === '__new__';

  const loadCompanions = useCallback(
    async (preferSlugOrId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/admin/companions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load companions');

        const list: AdminCompanionRecord[] = Array.isArray(data.companions) ? data.companions : [];
        setCompanions(list);
        setTableReady(data.tableReady !== false);
        setDefaultSlugs(Array.isArray(data.defaultSlugs) ? data.defaultSlugs : []);
        setAvailablePortraits(
          Array.isArray(data.availablePortraits) ? data.availablePortraits : []
        );
        setMonogramPalettes(data.monogramPalettes || {});

        if (list.length > 0) {
          const target =
            (preferSlugOrId
              ? list.find((c) => c.id === preferSlugOrId || c.slug === preferSlugOrId)
              : null) ||
            (selectedId
              ? list.find((c) => c.id === selectedId || c.slug === selectedId)
              : null) ||
            list[0];
          setSelectedId(target.id);
          setDraft({ ...target });
          setSecondaryText((target.secondary_expertise || []).join(', '));
          setSituationTagsText((target.situation_tags || []).join(', '));
        } else {
          setSelectedId(null);
          setDraft(null);
          setSituationTagsText('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load companions');
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, selectedId]
  );

  const loadGlobalCompanionPrompts = useCallback(async () => {
    setGlobalPromptsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load global companion settings');
      setEngineOverrides(
        data.engineOverrides && typeof data.engineOverrides === 'object' ? data.engineOverrides : {}
      );
      setEngineDefaults(
        data.engineDefaults && typeof data.engineDefaults === 'object' ? data.engineDefaults : {}
      );
      setGlobalPromptsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load global companion controls');
    } finally {
      setGlobalPromptsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadCompanions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (managerView === 'global' && !globalPromptsLoaded && !globalPromptsLoading) {
      void loadGlobalCompanionPrompts();
    }
  }, [managerView, globalPromptsLoaded, globalPromptsLoading, loadGlobalCompanionPrompts]);

  const filteredCompanions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companions.filter((c) => {
      if (groupFilter !== 'all' && (c.companion_group || 'everyday') !== groupFilter) return false;
      if (categoryFilter !== 'all' && c.category_tag !== categoryFilter) return false;
      if (skillFilter === 'human_only' && c.skill_level !== 'none_emotional') return false;
      if (skillFilter === 'esoteric' && c.skill_level === 'none_emotional') return false;
      if (
        skillFilter !== 'all' &&
        skillFilter !== 'human_only' &&
        skillFilter !== 'esoteric' &&
        c.skill_level !== skillFilter
      ) {
        return false;
      }
      if (sexFilter !== 'all' && c.sex !== sexFilter) return false;
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'hidden' && c.is_active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.primary_expertise.toLowerCase().includes(q) ||
        c.cultural_fluency.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        (c.situation_tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [companions, searchQuery, groupFilter, categoryFilter, skillFilter, sexFilter, statusFilter]);

  const [uploadingDp, setUploadingDp] = useState(false);
  const [dpUploadError, setDpUploadError] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const dpFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadPortraitFile = async (file: File) => {
    setDpUploadError(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setDpUploadError('Please upload a PNG, JPEG, or WebP portrait image.');
      return;
    }

    setUploadingDp(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 320;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context unavailable'));
              return;
            }
            const minSide = Math.min(img.width, img.height);
            const sx = Math.max(0, (img.width - minSide) / 2);
            const sy = Math.max(0, (img.height - minSide) / 2);
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            let encoded = canvas.toDataURL('image/webp', 0.86);
            if (!encoded.startsWith('data:image/webp')) {
              encoded = canvas.toDataURL('image/jpeg', 0.88);
            }
            resolve(encoded);
          } catch (err) {
            reject(err);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not decode selected image.'));
        };
        img.src = objectUrl;
      });

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Admin session required.');
      }

      const res = await fetch('/api/admin/companions/upload-dp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatar_url) {
        throw new Error(data.error || 'Failed to upload portrait image.');
      }
      setDraft((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : prev));
      setFeedback('Portrait image cropped (320×320) and ready — save companion to publish.');
    } catch (err) {
      setDpUploadError(err instanceof Error ? err.message : 'Portrait upload failed.');
    } finally {
      setUploadingDp(false);
    }
  };

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const handleSelectCompanion = (item: AdminCompanionRecord) => {
    stopSpeaking();
    setTestingVoice(false);
    setDpUploadError(null);
    setSelectedId(item.id);
    setDraft({
      ...item,
      backstory: item.backstory || '',
      soul_consciousness: item.soul_consciousness || '',
      monogram_palette: { ...item.monogram_palette },
      tts_voice_profile: { ...item.tts_voice_profile },
      welcome_messages: [...(item.welcome_messages || [])],
      secondary_expertise: [...(item.secondary_expertise || [])],
      situation_tags: [...(item.situation_tags || [])],
    });
    setSecondaryText((item.secondary_expertise || []).join(', '));
    setSituationTagsText((item.situation_tags || []).join(', '));
    setConfirmDelete(false);
    setError(null);
    setFeedback(null);
  };

  const handleStartNewCompanion = () => {
    const maxOrder = companions.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
    const blank = createBlankCompanion(maxOrder + 10);
    setManagerView('roster');
    setSelectedId('__new__');
    setDraft(blank);
    setSecondaryText('');
    setSituationTagsText('');
    setEditorTab('identity');
    setConfirmDelete(false);
    setError(null);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError('Companion name is required.');
      return;
    }

    const parsedSecondary = secondaryText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedSituationTags = situationTagsText
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      ...draft,
      slug: (draft.slug || slugifyName(draft.name)).trim().toLowerCase(),
      backstory: (draft.backstory || '').trim(),
      soul_consciousness: (draft.soul_consciousness || '').trim(),
      secondary_expertise: parsedSecondary,
      situation_tags: parsedSituationTags,
      welcome_messages: (draft.welcome_messages || []).map((w) => w.trim()).filter(Boolean),
    };

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const url = isCreating
        ? '/api/admin/companions'
        : `/api/admin/companions/${encodeURIComponent(draft.id)}`;
      const res = await fetch(url, {
        method: isCreating ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save companion');

      const saved: AdminCompanionRecord = data.companion;
      setFeedback(
        isCreating
          ? `Created companion "${saved.name}" (${saved.slug}).`
          : `Saved changes to "${saved.name}". Live catalog updated.`
      );
      await loadCompanions(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save companion');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!draft || isCreating) return;
    setResetting(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/companions/${encodeURIComponent(draft.slug)}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset companion');

      const restored: AdminCompanionRecord = data.companion;
      setFeedback(`Restored "${restored.name}" back to canonical defaults.`);
      await loadCompanions(restored.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset companion');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!draft || isCreating) return;
    setDeleting(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/companions/${encodeURIComponent(draft.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete companion');

      const removedName = draft.name;
      setConfirmDelete(false);
      setSelectedId(null);
      setFeedback(`Deleted companion "${removedName}".`);
      await loadCompanions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete companion');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveCompanionToIndex = async (fromIdx: number, toIdx: number) => {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= companions.length ||
      toIdx >= companions.length ||
      fromIdx === toIdx
    ) {
      return;
    }
    const reordered = [...companions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updatedWithOrder = reordered.map((c, idx) => ({
      ...c,
      sort_order: (idx + 1) * 10,
    }));
    setCompanions(updatedWithOrder);
    if (draft && !isCreating) {
      const updatedSelected = updatedWithOrder.find((c) => c.id === draft.id);
      if (updatedSelected) {
        setDraft((prev) => (prev ? { ...prev, sort_order: updatedSelected.sort_order } : prev));
      }
    }

    setReordering(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/companions/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderedIds: updatedWithOrder.map((c) => c.id) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save new companion order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder companions');
      await loadCompanions();
    } finally {
      setReordering(false);
    }
  };

  const handleMoveCompanion = (indexInAll: number, delta: -1 | 1) =>
    handleMoveCompanionToIndex(indexInAll, indexInAll + delta);

  const handleQuickToggleActive = async (item: AdminCompanionRecord) => {
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/companions/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...item,
          is_active: !item.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle visibility');
      const updated: AdminCompanionRecord = data.companion;
      setCompanions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (draft?.id === updated.id) {
        setDraft(updated);
      }
      setFeedback(`${updated.name} is now ${updated.is_active ? 'active in Chat' : 'hidden'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update companion status');
    }
  };

  const isBuiltinDefault = Boolean(
    draft && !isCreating && defaultSlugs.includes(draft.slug.toLowerCase())
  );

  const selectedChatStyleMeta = useMemo(
    () =>
      CHAT_STYLE_OPTIONS.find((s) => s.value === (draft?.chat_style || 'chat_bubbles')) ||
      CHAT_STYLE_OPTIONS[2],
    [draft?.chat_style]
  );

  const selectedSkillMeta = useMemo(
    () =>
      SKILL_LEVEL_OPTIONS.find((s) => s.value === (draft?.skill_level || 'none_emotional')) ||
      SKILL_LEVEL_OPTIONS[0],
    [draft?.skill_level]
  );

  const selectedAutonomyMeta = useMemo(
    () =>
      AUTONOMY_OPTIONS.find((s) => s.value === (draft?.autonomy_level || 'intuitive')) ||
      AUTONOMY_OPTIONS[1],
    [draft?.autonomy_level]
  );

  const handleQuickPatchCompanion = async (
    item: AdminCompanionRecord,
    patch: Partial<
      Pick<
        AdminCompanionRecord,
        'is_active' | 'skill_level' | 'override_global_rules' | 'companion_group'
      >
    >,
    successLabel: string
  ) => {
    setQuickUpdatingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/companions/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...item,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update companion');
      const updated: AdminCompanionRecord = data.companion;
      setCompanions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (draft?.id === updated.id) {
        setDraft(updated);
      }
      setFeedback(successLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update companion');
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const handleSaveGlobalCompanionPrompts = async () => {
    setGlobalPromptsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const bodyPayload: Record<string, string> = {};
      for (const meta of GLOBAL_COMPANION_PROMPT_META) {
        const val = (engineOverrides[meta.key] || '').trim();
        bodyPayload[meta.key] = val;
      }
      const res = await fetch('/api/admin/settings/chatbot/engine-prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save global companion controls');
      setEngineOverrides(
        data.overrides && typeof data.overrides === 'object' ? data.overrides : {}
      );
      setFeedback('Saved global companion baselines and prompts across all companions.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save global companion prompts');
    } finally {
      setGlobalPromptsSaving(false);
    }
  };

  const handleResetGlobalPromptKey = async (key: GlobalCompanionPromptKey) => {
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot/engine-prompts/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset global prompt');
      setEngineOverrides(
        data.overrides && typeof data.overrides === 'object' ? data.overrides : {}
      );
      setFeedback(`Reset "${key}" back to canonical default.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset global prompt');
    }
  };

  const canReorder =
    searchQuery.trim() === '' &&
    groupFilter === 'all' &&
    categoryFilter === 'all' &&
    skillFilter === 'all' &&
    sexFilter === 'all' &&
    statusFilter === 'all';

  const esotericCount = useMemo(
    () => companions.filter((c) => c.skill_level !== 'none_emotional').length,
    [companions]
  );

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] px-5 py-4">
        <div className="space-y-2">
          <div>
            <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
              Companions Roster &amp; Governance
            </h2>
            <p className="text-xs text-[#5C5449] mt-0.5">
              Manage individual personas, birth-chart skill boundaries, chat style, and global companion baselines.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-2xl bg-[#F1ECE3] p-1">
            <button
              type="button"
              onClick={() => setManagerView('roster')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                managerView === 'roster'
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              Roster &amp; Editor ({companions.length})
            </button>
            <button
              type="button"
              onClick={() => setManagerView('global')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                managerView === 'global'
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              Global Controls &amp; Skill Matrix
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs tabular-nums text-[#8B8275]">
            {companions.filter((c) => c.is_active).length} active · {esotericCount} chart-skilled ·{' '}
            {companions.length} total
          </span>
          <button
            type="button"
            onClick={handleStartNewCompanion}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Companion</span>
          </button>
        </div>
      </div>

      {!tableReady && (
        <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/12 p-4 text-xs text-[#3D3830] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Migration 015 Pending in Supabase</p>
            <p className="text-[#5C5449]">
              Currently viewing in-memory defaults. Run{' '}
              <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                supabase/migrations/015_companions_v2_and_chat_styles.sql
              </code>{' '}
              in Supabase SQL Editor to enable saving, creating, and deleting companions.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F]">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {loading && companions.length === 0 ? (
        <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-10 text-center text-sm text-[#8B8275]">
          Loading companions roster...
        </div>
      ) : managerView === 'global' ? (
        <div className="space-y-5">
          {/* Global Companion Prompts */}
          <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
              <div>
                <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  Global Companion Rules &amp; Prompt Architecture
                </h3>
                <p className="text-xs text-[#5C5449] mt-0.5">
                  Configure platform-wide companion realism, chart-presence blending, return greetings, and bond extraction. Clear any field to revert to canonical defaults.
                </p>
              </div>
              <button
                type="button"
                disabled={globalPromptsSaving || globalPromptsLoading}
                onClick={() => void handleSaveGlobalCompanionPrompts()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{globalPromptsSaving ? 'Saving...' : 'Save Global Controls'}</span>
              </button>
            </div>

            {globalPromptsLoading ? (
              <p className="text-xs text-[#8B8275] py-4">Loading global companion baselines...</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {GLOBAL_COMPANION_PROMPT_META.map((meta) => {
                  const overrideVal = engineOverrides[meta.key] ?? '';
                  const defaultVal = engineDefaults[meta.key] ?? '';
                  const effectiveText = overrideVal || defaultVal;
                  const isOverridden = Boolean(overrideVal.trim());
                  return (
                    <div
                      key={meta.key}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#3D3830]">
                              {meta.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#8B8275]">
                              {isOverridden ? 'Custom Override' : 'Default'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">{meta.description}</p>
                        </div>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => void handleResetGlobalPromptKey(meta.key)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-2.5 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        value={effectiveText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEngineOverrides((prev) => ({ ...prev, [meta.key]: val }));
                        }}
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Governance & Chart-Skill Matrix */}
          <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  Quick Companion Skill &amp; Visibility Matrix
                </h3>
                <p className="text-xs text-[#5C5449] mt-0.5">
                  Flip any companion&apos;s Birth Chart / Esoteric skill boundary, pillar group, global rule inheritance, or active visibility in one click.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter companions..."
                    className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-8 pr-3 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
                  />
                </div>
                <CustomSelect
                  value={groupFilter}
                  onChange={setGroupFilter}
                  ariaLabel="Filter matrix by pillar group"
                  surface="canvas"
                  size="sm"
                  options={[
                    { value: 'all', label: 'All Pillars' },
                    ...COMPANION_GROUP_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
                  ]}
                />
                <CustomSelect
                  value={skillFilter}
                  onChange={setSkillFilter}
                  ariaLabel="Filter matrix by chart skill"
                  surface="canvas"
                  size="sm"
                  options={[
                    { value: 'all', label: 'All Skill Levels' },
                    { value: 'human_only', label: 'Human Only' },
                    { value: 'esoteric', label: 'Chart / Esoteric Active' },
                    ...SKILL_LEVEL_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
                  ]}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#3D3830]/12">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1ECE3]/70 text-[11px] uppercase tracking-wider text-[#8B8275] border-b border-[#3D3830]/10">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Companion</th>
                    <th className="py-2.5 px-3 font-medium">Pillar Group</th>
                    <th className="py-2.5 px-3 font-medium">Chart / Esoteric Skill</th>
                    <th className="py-2.5 px-3 font-medium text-center">Global Override</th>
                    <th className="py-2.5 px-3 font-medium text-center">Active</th>
                    <th className="py-2.5 px-3 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8">
                  {filteredCompanions.map((item) => {
                    const busy = quickUpdatingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-[#FAF7F2]/80">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <CompanionAvatar
                              name={item.name}
                              avatarUrl={item.avatar_url}
                              palette={item.monogram_palette}
                              size="xs"
                              shape="circle"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-[#3D3830] truncate">
                                {item.name}{' '}
                                <span className="font-mono text-[11px] text-[#8B8275]">
                                  {item.age}
                                  {item.sex}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#8B8275] truncate">
                                {item.primary_expertise}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 min-w-[165px]">
                          <CustomSelect
                            value={item.companion_group || 'everyday'}
                            disabled={busy}
                            onChange={(val) =>
                              void handleQuickPatchCompanion(
                                item,
                                { companion_group: val as CompanionGroup },
                                `Updated ${item.name} pillar group.`
                              )
                            }
                            ariaLabel={`Group for ${item.name}`}
                            surface="canvas"
                            size="sm"
                            options={COMPANION_GROUP_OPTIONS.map((g) => ({
                              value: g.value,
                              label: g.label,
                            }))}
                          />
                        </td>
                        <td className="py-2.5 px-3 min-w-[215px]">
                          <CustomSelect
                            value={item.skill_level}
                            disabled={busy}
                            onChange={(val) =>
                              void handleQuickPatchCompanion(
                                item,
                                { skill_level: val as CompanionSkillLevel },
                                `Updated ${item.name} skill level to ${SKILL_BADGE_MAP[val as CompanionSkillLevel]}.`
                              )
                            }
                            ariaLabel={`Skill level for ${item.name}`}
                            surface="canvas"
                            size="sm"
                            options={SKILL_LEVEL_OPTIONS.map((s) => ({
                              value: s.value,
                              label: s.label,
                            }))}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleQuickPatchCompanion(
                                item,
                                { override_global_rules: !item.override_global_rules },
                                `${item.name}: Override global rules ${
                                  !item.override_global_rules ? 'enabled' : 'disabled'
                                }.`
                              )
                            }
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                              item.override_global_rules
                                ? 'border-[#3D3830]/20 bg-[#EAE3D7] text-[#3D3830]'
                                : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#8B8275]'
                            }`}
                          >
                            {item.override_global_rules ? 'Custom' : 'Global'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleQuickToggleActive(item)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                              item.is_active
                                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/10 text-[#2D6A4F]'
                                : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Hidden'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectCompanion(item);
                              setManagerView('roster');
                            }}
                            className="text-xs font-medium text-[#4A453D] hover:underline cursor-pointer"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT DIRECTORY RAIL */}
          <aside className="lg:col-span-4 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-3.5 border-b border-[#3D3830]/10 space-y-2.5 bg-[#FAF7F2]/60">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, expertise, situation..."
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] pl-8 pr-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <CustomSelect
                  value={groupFilter}
                  onChange={setGroupFilter}
                  ariaLabel="Filter companions by pillar group"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Pillars' },
                    ...COMPANION_GROUP_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
                  ]}
                />
                <CustomSelect
                  value={skillFilter}
                  onChange={setSkillFilter}
                  ariaLabel="Filter companions by chart skill"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Skills' },
                    { value: 'human_only', label: 'Human Only' },
                    { value: 'esoteric', label: 'Chart / Esoteric' },
                    ...SKILL_LEVEL_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <CustomSelect
                  value={sexFilter}
                  onChange={setSexFilter}
                  ariaLabel="Filter companions by sex"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Genders' },
                    { value: 'F', label: 'Female (F)' },
                    { value: 'M', label: 'Male (M)' },
                    { value: 'NB', label: 'Non-binary (NB)' },
                  ]}
                />
                <CustomSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  ariaLabel="Filter companions by status"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'active', label: 'Active Only' },
                    { value: 'hidden', label: 'Hidden Only' },
                  ]}
                />
              </div>

              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel="Filter companions by category"
                surface="elevated"
                size="sm"
                className="w-full"
                options={[
                  { value: 'all', label: 'All Legacy Categories' },
                  ...CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
                ]}
              />

              <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                <span>
                  {canReorder
                    ? 'Drag handle or ↑ ↓ to reorder.'
                    : `Showing ${filteredCompanions.length} of ${companions.length}`}
                </span>
                {!canReorder && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setGroupFilter('all');
                      setCategoryFilter('all');
                      setSkillFilter('all');
                      setSexFilter('all');
                      setStatusFilter('all');
                    }}
                    className="text-[#4A453D] hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto divide-y divide-[#3D3830]/8">
              {filteredCompanions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8B8275]">
                  No companions match this filter.
                </div>
              ) : (
                filteredCompanions.map((item) => {
                  const isSelected = draft?.id === item.id;
                  const globalIdx = companions.findIndex((c) => c.id === item.id);
                  const isDragging = draggedIdx === globalIdx;
                  const isDragOver =
                    dragOverIdx === globalIdx && draggedIdx !== null && draggedIdx !== globalIdx;
                  return (
                    <div
                      key={item.id}
                      draggable={canReorder && !reordering}
                      onDragStart={(e) => {
                        if (!canReorder || reordering) return;
                        setDraggedIdx(globalIdx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(globalIdx));
                      }}
                      onDragOver={(e) => {
                        if (!canReorder || draggedIdx === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIdx !== globalIdx) setDragOverIdx(globalIdx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIdx === globalIdx) setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        if (!canReorder) return;
                        e.preventDefault();
                        const from = draggedIdx;
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                        if (from !== null && from !== globalIdx) {
                          void handleMoveCompanionToIndex(from, globalIdx);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 transition-colors border-l-2 ${
                        isDragging ? 'opacity-55' : ''
                      } ${
                        isDragOver
                          ? 'border-l-[#B8965A] bg-[#B8965A]/12'
                          : isSelected
                            ? 'border-l-[#3D3830] bg-[#EAE3D7]/70'
                            : 'border-l-transparent hover:bg-[#FAF7F2]'
                      }`}
                    >
                      {canReorder && (
                        <span
                          title="Drag to reorder"
                          className="text-[#8B8275] hover:text-[#3D3830] cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelectCompanion(item)}
                        className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                      >
                        <CompanionAvatar
                          name={item.name}
                          avatarUrl={item.avatar_url}
                          palette={item.monogram_palette}
                          size="sm"
                          shape="circle"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-medium truncate ${
                                item.is_active ? 'text-[#3D3830]' : 'text-[#8B8275] line-through'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                              {item.age}
                              {item.sex}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B8275] truncate">
                            {item.primary_expertise} · {SKILL_BADGE_MAP[item.skill_level] || 'Human Only'}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {canReorder && (
                          <>
                            <button
                              type="button"
                              disabled={reordering || globalIdx <= 0}
                              onClick={() => void handleMoveCompanion(globalIdx, -1)}
                              aria-label={`Move ${item.name} up`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FDFBF7] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={reordering || globalIdx >= companions.length - 1}
                              onClick={() => void handleMoveCompanion(globalIdx, 1)}
                              aria-label={`Move ${item.name} down`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FDFBF7] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleQuickToggleActive(item)}
                          title={item.is_active ? 'Active — click to hide' : 'Hidden — click to activate'}
                          aria-label={item.is_active ? `Hide ${item.name}` : `Activate ${item.name}`}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            item.is_active
                              ? 'border-[#2D6A4F]/25 text-[#2D6A4F] bg-[#2D6A4F]/8'
                              : 'border-[#3D3830]/15 text-[#8B8275] bg-[#F1ECE3]'
                          }`}
                        >
                          {item.is_active ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT EDITOR WORKBENCH */}
          <div className="lg:col-span-8 space-y-4">
            {!draft ? (
              <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-10 text-center space-y-3">
                <p className="font-['Cormorant_Garamond',serif] text-xl text-[#3D3830]">
                  Select a companion to inspect or edit
                </p>
                <p className="text-xs text-[#8B8275]">
                  Choose any personality from the roster or create a new companion persona.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
                {/* Editor Top Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#3D3830]/10">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CompanionAvatar
                      name={draft.name || 'New Companion'}
                      avatarUrl={draft.avatar_url}
                      palette={draft.monogram_palette}
                      size="lg"
                      shape="rounded"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] truncate">
                          {isCreating ? 'New Companion' : draft.name}
                        </h3>
                        {draft.slug && (
                          <span className="font-mono text-xs text-[#8B8275]">
                            {draft.slug}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5449] mt-0.5">
                        {isCreating
                          ? 'Custom preset · unsaved draft'
                          : isBuiltinDefault
                            ? 'Built-in Canonical Preset'
                            : 'Admin-Created Companion'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isBuiltinDefault && (
                      <button
                        type="button"
                        disabled={resetting || saving}
                        onClick={() => void handleResetToDefault()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{resetting ? 'Resetting...' : 'Reset Default'}</span>
                      </button>
                    )}

                    {!isCreating &&
                      (confirmDelete ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/30 bg-[#7A3E36]/8 px-2.5 py-1">
                          <span className="text-[11px] font-medium text-[#7A3E36] pl-1">
                            Delete?
                          </span>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => void handleDelete()}
                            className="rounded-full bg-[#7A3E36] px-2.5 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#612E27] cursor-pointer whitespace-nowrap"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-full px-2 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      ))}

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSave()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{saving ? 'Saving...' : isCreating ? 'Create Companion' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>

                {/* Split Editor + Live Preview Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-6 items-start">
                  <div className="min-w-0 space-y-5">
                    {/* Editor Section Sub-Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
                      {(
                        [
                          { key: 'identity', label: 'Identity & Portrait', icon: UserCheck },
                          { key: 'prompts', label: 'Prompts & Layered Rules', icon: Sparkles },
                          { key: 'behavior', label: 'Chat Style & AI Model', icon: Sliders },
                        ] as const
                      ).map((t) => {
                        const Icon = t.icon;
                        const active = editorTab === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setEditorTab(t.key)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              active
                                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                                : 'text-[#5C5449] hover:text-[#3D3830]'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>

                {/* TAB 1: IDENTITY & PORTRAIT */}
                {editorTab === 'identity' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <label className="block space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-medium text-[#5C5449]">Display Name</span>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    name: nextName,
                                    slug:
                                      isCreating && (!prev.slug || prev.slug === slugifyName(prev.name))
                                        ? slugifyName(nextName)
                                        : prev.slug,
                                  }
                                : prev
                            );
                          }}
                          placeholder="e.g. Soul Mira"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">Slug ID</span>
                        <input
                          type="text"
                          value={draft.slug}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                                  }
                                : prev
                            )
                          }
                          placeholder="mira"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-mono text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">Age</span>
                          <input
                            type="number"
                            min={18}
                            max={95}
                            value={draft.age}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev ? { ...prev, age: Number(e.target.value) || 30 } : prev
                              )
                            }
                            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                          />
                        </label>
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">Sex</span>
                          <CustomSelect
                            value={draft.sex}
                            onChange={(val) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      sex: val === 'M' ? 'M' : val === 'NB' ? 'NB' : 'F',
                                    }
                                  : prev
                              )
                            }
                            ariaLabel="Companion sex"
                            surface="canvas"
                            className="w-full"
                            options={SEX_OPTIONS}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">Companion Pillar Group</span>
                        <CustomSelect
                          value={draft.companion_group || 'everyday'}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, companion_group: val as CompanionGroup }
                                : prev
                            )
                          }
                          ariaLabel="Companion pillar group"
                          surface="canvas"
                          className="w-full"
                          options={COMPANION_GROUP_OPTIONS.map((g) => ({
                            value: g.value,
                            label: g.label,
                            description: g.description,
                          }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">Database Category</span>
                        <CustomSelect
                          value={draft.category_tag}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, category_tag: val as CompanionCategoryTag }
                                : prev
                            )
                          }
                          ariaLabel="Companion hub category"
                          surface="canvas"
                          className="w-full"
                          options={CATEGORY_OPTIONS}
                        />
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Primary Expertise / Role
                        </span>
                        <input
                          type="text"
                          value={draft.primary_expertise}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, primary_expertise: e.target.value } : prev
                            )
                          }
                          placeholder="e.g. Deep Listener"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Card Subtitle (Mini Card Role Line)
                        </span>
                        <input
                          type="text"
                          value={draft.card_subtitle || ''}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, card_subtitle: e.target.value } : prev
                            )
                          }
                          placeholder="e.g. Vedic Astrology · Life & Wisdom"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Secondary Strengths (comma-separated)
                        </span>
                        <input
                          type="text"
                          value={secondaryText}
                          onChange={(e) => setSecondaryText(e.target.value)}
                          placeholder="e.g. Grief Holding, Late-Night Company, Quiet Reflection"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Situation Tags (comma-separated)
                        </span>
                        <input
                          type="text"
                          value={situationTagsText}
                          onChange={(e) => setSituationTagsText(e.target.value)}
                          placeholder="e.g. heartbreak, breakup, moving-on"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Cultural &amp; Language Fluency
                        </span>
                        <input
                          type="text"
                          value={draft.cultural_fluency}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, cultural_fluency: e.target.value } : prev
                            )
                          }
                          placeholder="e.g. English & Hinglish · Warm Mumbai sensibility"
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">Tagline (Card Hook)</span>
                      <input
                        type="text"
                        value={draft.tagline}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, tagline: e.target.value } : prev))
                        }
                        placeholder="One warm line capturing their presence..."
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">Short Bio (Directory Card)</span>
                      <textarea
                        rows={2}
                        value={draft.short_bio}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, short_bio: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">
                        Full Bio (Profile Sheet &amp; Approach)
                      </span>
                      <textarea
                        rows={4}
                        value={draft.full_bio}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, full_bio: e.target.value } : prev))
                        }
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">
                        How Conversations Feel (Expanded Profile Sheet)
                      </span>
                      <textarea
                        rows={3}
                        value={draft.how_conversations_feel || ''}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, how_conversations_feel: e.target.value } : prev
                          )
                        }
                        placeholder="Warm narrative describing what chatting with this companion feels like..."
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </label>

                    {/* Portrait & Monogram Studio */}
                    <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-[#8B7355]" />
                          <span className="text-xs font-semibold text-[#3D3830]">
                            Editorial Portrait &amp; Monogram Palette
                          </span>
                        </div>
                        {draft.avatar_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => (prev ? { ...prev, avatar_url: null } : prev))
                            }
                            className="text-xs text-[#7A3E36] hover:underline cursor-pointer"
                          >
                            Use Monogram Only
                          </button>
                        )}
                      </div>

                      {availablePortraits.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-[#8B8275]">
                            Curated Watercolor Portraits (click to assign):
                          </p>
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                            {availablePortraits.map((p) => {
                              const selected = draft.avatar_url === p.url;
                              return (
                                <button
                                  key={p.url}
                                  type="button"
                                  onClick={() =>
                                    setDraft((prev) =>
                                      prev ? { ...prev, avatar_url: p.url } : prev
                                    )
                                  }
                                  title={p.label}
                                  className={`group flex flex-col items-center gap-1 rounded-xl p-1 border transition-colors cursor-pointer ${
                                    selected
                                      ? 'border-[#B8965A] bg-[#B8965A]/15'
                                      : 'border-transparent hover:border-[#3D3830]/20 hover:bg-[#F1ECE3]'
                                  }`}
                                >
                                  <img
                                    src={p.url}
                                    alt={p.label}
                                    className="h-10 w-10 rounded-full object-cover object-center"
                                  />
                                  <span className="text-[10px] text-[#5C5449] truncate w-full text-center">
                                    {p.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#3D3830]">
                            Upload Custom Display Picture (DP)
                          </p>
                          <p className="text-[11px] text-[#8B8275]">
                            PNG, JPEG, or WebP · Auto-cropped square 320×320
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            ref={dpFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              e.target.value = '';
                              if (picked) void handleUploadPortraitFile(picked);
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingDp}
                            onClick={() => dpFileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5 text-[#8B7355]" />
                            <span>{uploadingDp ? 'Processing…' : 'Upload Portrait Image'}</span>
                          </button>
                        </div>
                      </div>
                      {dpUploadError && (
                        <p className="text-xs text-[#7A3E36]">{dpUploadError}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Custom Avatar URL (https:// or /assets/...)
                          </span>
                          <input
                            type="text"
                            value={draft.avatar_url || ''}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev ? { ...prev, avatar_url: e.target.value || null } : prev
                              )
                            }
                            placeholder="/assets/companions/aira.jpg or https://..."
                            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                          />
                        </label>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Monogram Fallback Swatches
                          </span>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {Object.entries(monogramPalettes).map(([key, pal]) => {
                              const active =
                                draft.monogram_palette.bg.toLowerCase() === pal.bg.toLowerCase();
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setDraft((prev) =>
                                      prev ? { ...prev, monogram_palette: { ...pal } } : prev
                                    )
                                  }
                                  title={key}
                                  style={{
                                    backgroundColor: pal.bg,
                                    borderColor: pal.ring,
                                    color: pal.ink,
                                  }}
                                  className={`h-8 w-8 rounded-full border-2 font-serif text-xs font-semibold flex items-center justify-center cursor-pointer transition-transform ${
                                    active ? 'scale-110 ring-2 ring-[#3D3830]/40' : ''
                                  }`}
                                >
                                  {(draft.name || 'C').charAt(0).toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PROMPTS & LAYERED RULES */}
                {editorTab === 'prompts' && (
                  <div className="space-y-5">
                    {/* Multi-variant Welcome Messages */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-[#3D3830]">
                            Opening Welcome Lines ({draft.welcome_messages.length})
                          </span>
                          <p className="text-[11px] text-[#8B8275]">
                            Rotated naturally when a user starts a fresh conversation with {draft.name || 'this companion'}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    welcome_messages: [...prev.welcome_messages, ''],
                                  }
                                : prev
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Opener</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {draft.welcome_messages.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275] pt-2.5 w-6 shrink-0">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={msg}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        welcome_messages: prev.welcome_messages.map((m, i) =>
                                          i === idx ? val : m
                                        ),
                                      }
                                    : prev
                                );
                              }}
                              placeholder="Warm natural opener..."
                              className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                            />
                            {draft.welcome_messages.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          welcome_messages: prev.welcome_messages.filter(
                                            (_, i) => i !== idx
                                          ),
                                        }
                                      : prev
                                  )
                                }
                                aria-label={`Remove opener ${idx + 1}`}
                                className="p-2 rounded-lg border border-[#3D3830]/12 text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Core System Prompt (Persona Architecture)
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                          {draft.system_prompt.length} chars · ~{approxTokens(draft.system_prompt)} tokens
                        </span>
                      </div>
                      <textarea
                        rows={11}
                        value={draft.system_prompt}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, system_prompt: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>

                    {/* Back Story & Soul & Consciousness */}
                    <div className="grid grid-cols-1 gap-4 pt-2 border-t border-[#3D3830]/10">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-[#3D3830]">
                              Back Story (Private Lived History)
                            </span>
                            <p className="text-[11px] text-[#8B8275]">
                              Quiet lived background (roots, shaping season, small daily habits). Strictly server-side — never shown on public cards or dumped unprompted.
                            </p>
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                            {(draft.backstory || '').length} chars · ~{approxTokens(draft.backstory || '')} tokens
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={draft.backstory || ''}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, backstory: e.target.value } : prev
                            )
                          }
                          placeholder="Where they grew up, a turning point, and quiet everyday texture they carry without announcing..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-[#3D3830]">
                              Soul &amp; Consciousness (Inner Compass, Perceptual Focus &amp; Cadence)
                            </span>
                            <p className="text-[11px] text-[#8B8275]">
                              What they notice between the lines, how they hold silence or gentle pushback, and how they stay un-robotic.
                            </p>
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                            {(draft.soul_consciousness || '').length} chars · ~{approxTokens(draft.soul_consciousness || '')} tokens
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={draft.soul_consciousness || ''}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev ? { ...prev, soul_consciousness: e.target.value } : prev
                            )
                          }
                          placeholder="What subtle human truth this companion catches first, and how their inner stillness shapes their timing..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                        />
                      </div>
                    </div>

                    {/* Layered Rules & Autonomy */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#3D3830]/10">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Autonomy / Instinct Freedom
                        </span>
                        <CustomSelect
                          value={draft.autonomy_level}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, autonomy_level: val as CompanionAutonomyLevel }
                                : prev
                            )
                          }
                          ariaLabel="Autonomy level"
                          surface="canvas"
                          className="w-full"
                          options={AUTONOMY_OPTIONS.map((a) => ({
                            value: a.value,
                            label: a.label,
                            description: a.description,
                          }))}
                        />
                        <p className="text-[11px] text-[#8B8275]">
                          {selectedAutonomyMeta.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold text-[#3D3830]">
                            Override Global Companion Rules
                          </p>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">
                            When ON, this companion&apos;s own Hard &amp; Soft Rules take precedence over global defaults.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.override_global_rules}
                          aria-label="Override global companion rules"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    override_global_rules: !prev.override_global_rules,
                                  }
                                : prev
                            )
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            draft.override_global_rules ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                              draft.override_global_rules ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Layer 1: Hard Rules (Strict Guardrails)
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                          {draft.hard_rules.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={draft.hard_rules}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, hard_rules: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Layer 2: Soft Rules (Overrideable Default Instincts)
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                          {draft.soft_rules.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={draft.soft_rules}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, soft_rules: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: CHAT STYLE, SKILLS & AI MODEL */}
                {editorTab === 'behavior' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Chat Render Style
                        </span>
                        <CustomSelect
                          value={draft.chat_style}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev ? { ...prev, chat_style: val as ChatStyle } : prev
                            )
                          }
                          ariaLabel="Companion chat render style"
                          surface="canvas"
                          className="w-full"
                          options={CHAT_STYLE_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                            description: o.description,
                          }))}
                        />
                        <p className="text-[11px] text-[#8B8275]">
                          {selectedChatStyleMeta.description}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Birth Chart &amp; Esoteric Skill Access
                        </span>
                        <CustomSelect
                          value={draft.skill_level}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, skill_level: val as CompanionSkillLevel }
                                : prev
                            )
                          }
                          ariaLabel="Companion skill level"
                          surface="canvas"
                          className="w-full"
                          options={SKILL_LEVEL_OPTIONS.map((s) => ({
                            value: s.value,
                            label: s.label,
                            description: s.description,
                          }))}
                        />
                        <p className="text-[11px] text-[#8B8275]">
                          {selectedSkillMeta.description}{' '}
                          {draft.skill_level === 'none_emotional'
                            ? 'Chart JSON is NOT injected unless switched to an astrological/esoteric level.'
                            : 'User birth chart / ephemeris data is automatically unlocked for this companion.'}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          OpenRouter AI Model Override
                        </span>
                        <CustomSelect
                          value={draft.model_id || ''}
                          onChange={(val) =>
                            setDraft((prev) =>
                              prev ? { ...prev, model_id: val ? val : null } : prev
                            )
                          }
                          ariaLabel="Companion AI model override"
                          surface="canvas"
                          className="w-full"
                          options={modelOptions}
                        />
                        <p className="text-[11px] text-[#8B8275]">
                          Leave on Platform Default or pin a dedicated conversational model for {draft.name || 'this companion'}.
                        </p>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[#3D3830]">
                          Sort Order Priority
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={99999}
                          value={draft.sort_order}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev
                                ? { ...prev, sort_order: Number(e.target.value) || 0 }
                                : prev
                            )
                          }
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                        <p className="text-[11px] text-[#8B8275]">
                          Lower numbers appear first in the Companion Hub.
                        </p>
                      </label>
                    </div>

                    {/* TTS Voice Profile */}
                    <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
                      <span className="text-xs font-semibold text-[#3D3830]">
                        Read-Aloud TTS Voice Cadence
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-[#5C5449]">
                            <span>Speaking Rate</span>
                            <span className="font-mono tabular-nums text-[#3D3830]">
                              {draft.tts_voice_profile.rate.toFixed(2)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.75}
                            max={1.25}
                            step={0.02}
                            value={draft.tts_voice_profile.rate}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tts_voice_profile: {
                                        ...prev.tts_voice_profile,
                                        rate: Number(e.target.value),
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full accent-[#4A453D]"
                          />
                        </label>

                        <label className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-[#5C5449]">
                            <span>Voice Pitch</span>
                            <span className="font-mono tabular-nums text-[#3D3830]">
                              {draft.tts_voice_profile.pitch.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.75}
                            max={1.25}
                            step={0.02}
                            value={draft.tts_voice_profile.pitch}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tts_voice_profile: {
                                        ...prev.tts_voice_profile,
                                        pitch: Number(e.target.value),
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full accent-[#4A453D]"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Behavioral Toggles */}
                    <div className="divide-y divide-[#3D3830]/10 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4">
                      <div className="flex items-center justify-between gap-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-[#3D3830]">
                            Supports &ldquo;Just listen | Help me think&rdquo; Pace Cue
                          </p>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">
                            Shows the optional header toggle so members can signal they strictly want company with zero advice.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.supports_listening_cue}
                          aria-label="Supports listening cue"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    supports_listening_cue: !prev.supports_listening_cue,
                                  }
                                : prev
                            )
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            draft.supports_listening_cue ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                              draft.supports_listening_cue ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-[#3D3830]">
                            Follow-up Conversation Suggestions
                          </p>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">
                            When ON, generates light conversational prompts to keep quiet or hesitant chats flowing.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.suggestions_enabled}
                          aria-label="Enable follow-up suggestions"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    suggestions_enabled: !prev.suggestions_enabled,
                                  }
                                : prev
                            )
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            draft.suggestions_enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                              draft.suggestions_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-[#3D3830]">
                            Active in Companion Hub
                          </p>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">
                            Hidden companions remain saved for existing threads and admin tuning without appearing in public matching.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.is_active}
                          aria-label="Companion active in hub"
                          onClick={() =>
                            setDraft((prev) =>
                              prev ? { ...prev, is_active: !prev.is_active } : prev
                            )
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            draft.is_active ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                              draft.is_active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                  </div>

                  {/* Sticky Side-by-Side Live Companion Preview */}
                  <aside className="xl:sticky xl:top-4 space-y-4 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8275]">
                        Live Companion Preview
                      </span>
                      <span className="rounded-full bg-[#F1ECE3] px-2 py-0.5 text-[10px] font-medium text-[#5C5449]">
                        {CHAT_STYLE_OPTIONS.find((o) => o.value === draft.chat_style)?.label ||
                          draft.chat_style}
                      </span>
                    </div>

                    {/* 1. Hub Card Preview */}
                    <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <CompanionAvatar
                          name={draft.name || 'Companion'}
                          avatarUrl={draft.avatar_url}
                          palette={draft.monogram_palette}
                          size="lg"
                          shape="circle"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <h4 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830] truncate">
                              {draft.name || 'Unnamed'}
                            </h4>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                              {draft.age}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-[#8B7355] truncate">
                            {draft.primary_expertise || 'Role / Expertise'}
                          </p>
                          {secondaryText.trim() && (
                            <p className="text-[10px] text-[#8B8275] truncate mt-0.5">
                              {secondaryText
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .slice(0, 2)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[#5C5449] leading-relaxed line-clamp-2">
                        {draft.tagline ||
                          draft.short_bio ||
                          'Add a warm tagline or short bio to preview the directory card.'}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1 text-[11px] font-medium text-[#5C5449]">
                          About
                        </span>
                        <span className="flex-1 text-center rounded-full bg-[#4A453D] px-3 py-1 text-[11px] font-medium text-[#FAF7F2] truncate">
                          Talk with {draft.name || 'Companion'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Live Chat Style Sample */}
                    {(() => {
                      const sampleRaw =
                        draft.welcome_messages.find((m) => m.trim()) ||
                        `Hey — glad you stopped by. [[BUBBLE]] What's been sitting heaviest on your mind today?`;
                      const cleanedSingle = sampleRaw
                        .replace(/\s*\[\[BUBBLE\]\]\s*/gi, '\n\n')
                        .trim();
                      const sampleBubbles = sampleRaw.includes('[[BUBBLE]]')
                        ? sampleRaw
                            .split(/\s*\[\[BUBBLE\]\]\s*/gi)
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [cleanedSingle, 'No rush — pick up wherever it feels easiest.'];

                      return (
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8B8275]">
                            In-Thread Style Sample
                          </span>
                          {draft.chat_style === 'chat_bubbles' ? (
                            <div className="flex items-start gap-2">
                              <CompanionAvatar
                                name={draft.name || 'Companion'}
                                avatarUrl={draft.avatar_url}
                                palette={draft.monogram_palette}
                                size="xs"
                                shape="circle"
                                className="mt-1"
                              />
                              <div className="space-y-1.5 flex-1 min-w-0">
                                {sampleBubbles.slice(0, 3).map((b, i) => (
                                  <div
                                    key={i}
                                    className="w-fit max-w-full rounded-2xl rounded-tl-sm border border-[#3D3830]/12 bg-[#FDFBF7] px-3 py-2 text-xs leading-relaxed text-[#3D3830] shadow-2xs"
                                  >
                                    {b}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : draft.chat_style === 'dialogue' ? (
                            <div className="rounded-2xl border border-[#B8965A]/25 border-l-[3px] border-l-[#B8965A] bg-[#FDFBF7] px-3.5 py-3 text-xs leading-relaxed text-[#5C5449]">
                              {cleanedSingle}
                            </div>
                          ) : draft.chat_style === 'concise_brief' ? (
                            <div className="rounded-2xl border border-[#3D3830]/14 bg-[#FDFBF7] px-3.5 py-3 text-xs leading-relaxed text-[#5C5449]">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#8B8275] mb-1">
                                Quick Brief
                              </p>
                              <p>{cleanedSingle}</p>
                            </div>
                          ) : draft.chat_style === 'structured' ? (
                            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3.5 py-3 space-y-1.5 text-xs text-[#5C5449]">
                              <p className="font-['Cormorant_Garamond',serif] text-base font-medium text-[#3D3830] border-b border-[#3D3830]/10 pb-1">
                                Core Observation
                              </p>
                              <p className="leading-relaxed">{cleanedSingle}</p>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7]/70 px-3.5 py-3 text-xs leading-relaxed text-[#5C5449]">
                              {cleanedSingle}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. Voice Cadence Test Button */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#3D3830]/10">
                      <span className="text-[11px] font-mono tabular-nums text-[#8B8275]">
                        Rate {draft.tts_voice_profile.rate.toFixed(2)}x · Pitch{' '}
                        {draft.tts_voice_profile.pitch.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (testingVoice) {
                            stopSpeaking();
                            setTestingVoice(false);
                            return;
                          }
                          const sampleLine =
                            draft.welcome_messages.find((m) => m.trim()) ||
                            `Hey, I'm ${draft.name || 'your companion'}. Take a breath — I'm right here.`;
                          speakMessageText(sampleLine, 'English', {
                            rate: draft.tts_voice_profile.rate,
                            pitch: draft.tts_voice_profile.pitch,
                            gender: draft.sex,
                            onStart: () => setTestingVoice(true),
                            onEnd: () => setTestingVoice(false),
                            onError: () => setTestingVoice(false),
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        {testingVoice ? (
                          <>
                            <VolumeX className="h-3.5 w-3.5 text-[#7A3E36]" />
                            <span>Stop Voice</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5 text-[#8B7355]" />
                            <span>Test Voice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompanionsManager;
