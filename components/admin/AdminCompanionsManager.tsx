import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  GitBranch,
  GripVertical,
  History,
  Lock,
  MessageSquare,
  MessageSquareQuote,
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
  type CompanionMonogramPalette,
} from '../app/chatTypes';
import {
  computeCompanionFieldDiffs,
  type CompanionSpecializationTag,
  type CompanionVersionRecord,
} from '../../lib/companionV2Schema';
import type { ModelChoiceOption } from './PromptLibraryManager';
import {
  CATEGORY_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  createBlankCompanion,
  hydrateAdminDraftFromState,
  slugifyName,
  type AdminCompanionRecord,
  type AdminCompanionRosterSummary,
  type CompanionV2EditorState,
  type EditorTab,
  type FormulaCartridgeOption,
  type GlobalCompanionAdminOverrides,
  type Migration022Status,
  type PortraitGalleryItem,
  type ProtectedLockAlert,
} from './companions/companionStudioTypes';
import CompanionPublicProfileTab from './companions/CompanionPublicProfileTab';
import CompanionCoreIdentityTab from './companions/CompanionCoreIdentityTab';
import CompanionNuancesDialoguesTab from './companions/CompanionNuancesDialoguesTab';
import CompanionSpecialistRulesTab from './companions/CompanionSpecialistRulesTab';
import CompanionChatAiSettingsTab from './companions/CompanionChatAiSettingsTab';
import CompanionVersionsTab from './companions/CompanionVersionsTab';
import GlobalIntelligencePanel from './companions/GlobalIntelligencePanel';
import CompanionImportExportModal from './companions/CompanionImportExportModal';
import CompanionTestingStudio from './companions/CompanionTestingStudio';

export type { AdminCompanionRecord };

interface AdminCompanionsManagerProps {
  getAccessToken: () => Promise<string | null>;
  modelOptions: ModelChoiceOption[];
}

const AdminCompanionsManager: React.FC<AdminCompanionsManagerProps> = ({
  getAccessToken,
  modelOptions,
}) => {
  const [companions, setCompanions] = useState<AdminCompanionRosterSummary[]>([]);
  const [specializations, setSpecializations] = useState<CompanionSpecializationTag[]>([]);
  const [formulaCartridges, setFormulaCartridges] = useState<FormulaCartridgeOption[]>([]);
  const [migration022Status, setMigration022Status] = useState<Migration022Status>({
    columnsReady: true,
    versionsTableReady: true,
  });
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [defaultSlugs, setDefaultSlugs] = useState<string[]>([]);
  const [availablePortraits, setAvailablePortraits] = useState<PortraitGalleryItem[]>([]);
  const [monogramPalettes, setMonogramPalettes] = useState<
    Record<string, CompanionMonogramPalette>
  >({});

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lockAlert, setLockAlert] = useState<ProtectedLockAlert | null>(null);

  const [managerView, setManagerView] = useState<'roster' | 'global' | 'testing'>('roster');
  const [testingTargetSlug, setTestingTargetSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [specializationFilter, setSpecializationFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [sexFilter, setSexFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<CompanionV2EditorState | null>(null);
  const [draft, setDraft] = useState<AdminCompanionRecord | null>(null);
  const [secondaryText, setSecondaryText] = useState('');
  const [situationTagsText, setSituationTagsText] = useState('');
  const [editorTab, setEditorTab] = useState<EditorTab>('profile');
  const [unlockOverride, setUnlockOverride] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [testingVoice, setTestingVoice] = useState(false);
  const [ioModalState, setIoModalState] = useState<{
    open: boolean;
    scope: 'single' | 'bulk' | 'global';
    focus: 'import' | 'export' | null;
  }>({ open: false, scope: 'bulk', focus: null });

  const [globalPromptsLoaded, setGlobalPromptsLoaded] = useState(false);
  const [globalPromptsLoading, setGlobalPromptsLoading] = useState(false);
  const [globalPromptsSaving, setGlobalPromptsSaving] = useState(false);
  const [specializationsSaving, setSpecializationsSaving] = useState(false);
  const [engineOverrides, setEngineOverrides] = useState<GlobalCompanionAdminOverrides>({});
  const [engineDefaults, setEngineDefaults] = useState<GlobalCompanionAdminOverrides>({});
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);

  const isCreating = draft?.id === '__new__';

  const applyEditorState = useCallback((state: CompanionV2EditorState) => {
    setEditorState(state);
    const hydrated = hydrateAdminDraftFromState(state);
    setDraft(hydrated);
    setSecondaryText((hydrated.secondary_expertise || []).join(', '));
    setSituationTagsText(
      (hydrated.discoverable_tags || hydrated.situation_tags || []).join(', ')
    );
    setUnlockOverride(false);
    setLockAlert(null);
  }, []);

  const loadCompanionV2Detail = useCallback(
    async (slugOrId: string) => {
      setDetailLoading(true);
      setLockAlert(null);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `/api/admin/companions/${encodeURIComponent(slugOrId)}/v2`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load companion details');
        applyEditorState(data as CompanionV2EditorState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load companion details');
      } finally {
        setDetailLoading(false);
      }
    },
    [applyEditorState, getAccessToken]
  );

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

        const list: AdminCompanionRosterSummary[] = Array.isArray(data.companions)
          ? data.companions
          : [];
        setCompanions(list);
        if (Array.isArray(data.specializations)) {
          setSpecializations(data.specializations);
        }
        if (Array.isArray(data.formulaCartridges)) {
          setFormulaCartridges(data.formulaCartridges);
        }
        if (data.migration022Status) {
          setMigration022Status(data.migration022Status);
        }
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
          await loadCompanionV2Detail(target.slug);
        } else {
          setSelectedId(null);
          setEditorState(null);
          setDraft(null);
          setSituationTagsText('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load companions');
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, loadCompanionV2Detail, selectedId]
  );

  const loadGlobalCompanionPrompts = useCallback(async () => {
    setGlobalPromptsLoading(true);
    try {
      const token = await getAccessToken();
      const [settingsRes, specRes] = await Promise.all([
        fetch('/api/admin/settings/chatbot', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/companions/specializations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = await settingsRes.json();
      if (!settingsRes.ok) {
        throw new Error(data.error || 'Failed to load global companion settings');
      }
      const promptBundle =
        data.enginePrompts && typeof data.enginePrompts === 'object'
          ? data.enginePrompts
          : null;
      const resolvedOverrides =
        promptBundle?.overrides && typeof promptBundle.overrides === 'object'
          ? promptBundle.overrides
          : data.engineOverrides && typeof data.engineOverrides === 'object'
          ? data.engineOverrides
          : {};
      const resolvedDefaults =
        promptBundle?.defaults && typeof promptBundle.defaults === 'object'
          ? promptBundle.defaults
          : data.engineDefaults && typeof data.engineDefaults === 'object'
          ? data.engineDefaults
          : {};
      setEngineOverrides(resolvedOverrides);
      setEngineDefaults(resolvedDefaults);
      if (specRes.ok) {
        const specData = await specRes.json();
        if (Array.isArray(specData.specializations)) {
          setSpecializations(specData.specializations);
        }
      }
      setGlobalPromptsLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load global companion controls'
      );
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

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const filteredCompanions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companions.filter((c) => {
      if (groupFilter !== 'all' && c.companion_group !== groupFilter) return false;
      if (
        specializationFilter !== 'all' &&
        !(c.specialization_slugs || c.specializations || []).includes(specializationFilter)
      ) {
        return false;
      }
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
      if (statusFilter === 'draft_pending' && !c.has_unpublished_draft) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.primary_expertise.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        (c.specializations || []).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [
    companions,
    searchQuery,
    groupFilter,
    specializationFilter,
    categoryFilter,
    skillFilter,
    sexFilter,
    statusFilter,
  ]);

  const buildPayloadFromDraft = useCallback((): Record<string, unknown> | null => {
    if (!draft) return null;
    const parsedSecondary = secondaryText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedSituationTags = situationTagsText
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return {
      ...draft,
      slug: (draft.slug || slugifyName(draft.name)).trim().toLowerCase(),
      backstory: (draft.backstory || '').trim(),
      soul_consciousness: (draft.soul_consciousness || '').trim(),
      secondary_expertise: parsedSecondary,
      situation_tags: parsedSituationTags,
      discoverable_tags: parsedSituationTags,
      welcome_messages: (draft.welcome_messages || []).map((w) => w.trim()).filter(Boolean),
    };
  }, [draft, secondaryText, situationTagsText]);

  const hasUnsavedLocalChanges = useMemo(() => {
    if (!draft || !editorState || isCreating) return false;
    const payload = buildPayloadFromDraft();
    if (!payload) return false;
    const baseline = editorState.has_unpublished_draft
      ? editorState.v2_draft_json
      : editorState.v2_published_json;
    return computeCompanionFieldDiffs(baseline, payload).length > 0;
  }, [buildPayloadFromDraft, draft, editorState, isCreating]);

  const refreshSummaryEntryFromState = (state: CompanionV2EditorState) => {
    const c = state.companion;
    setCompanions((prev) =>
      prev.map((item) =>
        item.slug.toLowerCase() === c.slug.toLowerCase() || item.id === c.id
          ? {
              ...item,
              name: c.name,
              age: c.age,
              sex: c.sex,
              tagline: c.tagline,
              card_subtitle: c.card_subtitle || '',
              primary_expertise: c.primary_expertise,
              secondary_expertise: [...(c.secondary_expertise || [])],
              category_tag: c.category_tag,
              companion_group: c.companion_group || item.companion_group,
              advisory_mode: c.advisory_mode || item.advisory_mode,
              skill_level: c.skill_level,
              chat_style: c.chat_style,
              model_id: c.model_id,
              avatar_url: c.avatar_url,
              monogram_palette: c.monogram_palette,
              override_global_rules: c.override_global_rules,
              is_active: c.is_active,
              sort_order: c.sort_order,
              specializations: [...(c.specialization_slugs || item.specializations)],
              specialization_slugs: [...(c.specialization_slugs || item.specialization_slugs)],
              core_identity_locked: state.core_identity_locked,
              v2_status: state.v2_status,
              v2_version: state.v2_version,
              published_version: state.v2_version,
              has_unpublished_draft: state.has_unpublished_draft,
              last_published_at: state.last_published_at,
            }
          : item
      )
    );
  };

  const handleSelectCompanion = (item: AdminCompanionRosterSummary) => {
    stopSpeaking();
    setTestingVoice(false);
    setSelectedId(item.id);
    setConfirmDelete(false);
    setError(null);
    setFeedback(null);
    setLockAlert(null);
    void loadCompanionV2Detail(item.slug);
  };

  const handleStartNewCompanion = () => {
    stopSpeaking();
    setTestingVoice(false);
    const maxOrder = companions.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
    const blank = createBlankCompanion(maxOrder + 10);
    setManagerView('roster');
    setSelectedId('__new__');
    setEditorState(null);
    setDraft(blank);
    setSecondaryText('');
    setSituationTagsText('');
    setEditorTab('profile');
    setUnlockOverride(true);
    setConfirmDelete(false);
    setError(null);
    setFeedback(null);
    setLockAlert(null);
  };

  const handleSaveDraftOrCreate = async (forceUnlock = false) => {
    const payload = buildPayloadFromDraft();
    if (!draft || !payload) return;
    if (!draft.name.trim()) {
      setError('Companion name is required.');
      return;
    }

    setSavingDraft(true);
    setError(null);
    setFeedback(null);
    setLockAlert(null);
    try {
      const token = await getAccessToken();
      if (isCreating) {
        const res = await fetch('/api/admin/companions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create companion');
        const created = data.companion;
        setFeedback(`Created companion "${created.name}" (${created.slug}).`);
        await loadCompanions(created.slug || created.id);
        return;
      }

      const targetSlug = draft.slug || draft.id;
      const unlockConfirmed = forceUnlock || unlockOverride;
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(targetSlug)}/draft`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            draft: payload,
            unlockCoreIdentity: unlockConfirmed,
          }),
        }
      );
      const data = await res.json();
      if (res.status === 409 && data.code === 'CORE_IDENTITY_PROTECTED') {
        setLockAlert({
          message: data.error || 'Core Identity Protection prevented saving protected fields.',
          protectedChanges: Array.isArray(data.protectedChanges) ? data.protectedChanges : [],
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save draft');

      if (data.state) {
        applyEditorState(data.state as CompanionV2EditorState);
        refreshSummaryEntryFromState(data.state as CompanionV2EditorState);
      }
      setFeedback(`Saved draft for "${draft.name}". Inspect diffs or Publish when ready.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async (forceUnlock = false) => {
    const payload = buildPayloadFromDraft();
    if (!draft || !payload || isCreating) return;
    if (!draft.name.trim()) {
      setError('Companion name is required.');
      return;
    }

    setPublishing(true);
    setError(null);
    setFeedback(null);
    setLockAlert(null);
    try {
      const token = await getAccessToken();
      const targetSlug = draft.slug || draft.id;
      const unlockConfirmed = forceUnlock || unlockOverride;
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(targetSlug)}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            draft: payload,
            changeNote: changeNote.trim() || undefined,
            unlockCoreIdentity: unlockConfirmed,
          }),
        }
      );
      const data = await res.json();
      if (res.status === 409 && data.code === 'CORE_IDENTITY_PROTECTED') {
        setLockAlert({
          message: data.error || 'Core Identity Protection prevented publishing protected changes.',
          protectedChanges: Array.isArray(data.protectedChanges) ? data.protectedChanges : [],
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to publish companion');

      setChangeNote('');
      if (data.state) {
        applyEditorState(data.state as CompanionV2EditorState);
        refreshSummaryEntryFromState(data.state as CompanionV2EditorState);
      }
      setFeedback(
        `Published "${draft.name}" v${data.state?.v2_version || ''} live to Companion Hub.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish companion');
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!draft || isCreating) return;
    setDiscardingDraft(true);
    setError(null);
    setFeedback(null);
    setLockAlert(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(draft.slug || draft.id)}/discard-draft`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to discard draft');
      if (data.state) {
        applyEditorState(data.state as CompanionV2EditorState);
        refreshSummaryEntryFromState(data.state as CompanionV2EditorState);
      }
      setFeedback(`Discarded staged draft for "${draft.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to discard draft');
    } finally {
      setDiscardingDraft(false);
    }
  };

  const handleRollbackToDraft = async (version: CompanionVersionRecord) => {
    if (!draft || isCreating) return;
    setRollingBackVersion(version.version_number);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(draft.slug || draft.id)}/rollback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            versionId: version.id,
            versionNumber: version.version_number,
            targetStage: 'draft',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore snapshot to draft');
      if (data.state) {
        applyEditorState(data.state as CompanionV2EditorState);
        refreshSummaryEntryFromState(data.state as CompanionV2EditorState);
      }
      setFeedback(
        `Restored v${version.version_number} into Draft for "${draft.name}". Review & Publish to go live.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rollback companion');
    } finally {
      setRollingBackVersion(null);
    }
  };

  const handleResetToDefault = async () => {
    if (!draft || isCreating) return;
    setResetting(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(draft.slug)}/reset`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset companion');
      setFeedback(`Restored "${data.companion?.name || draft.name}" back to canonical defaults.`);
      await loadCompanions(draft.slug);
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
        setDraft((prev) =>
          prev ? { ...prev, sort_order: updatedSelected.sort_order } : prev
        );
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

  const handleQuickPatchCompanion = async (
    item: AdminCompanionRosterSummary,
    patch: Partial<
      Pick<
        AdminCompanionRosterSummary,
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
      // Fetch full current published snapshot so partial patch doesn't wipe text fields
      const stateRes = await fetch(
        `/api/admin/companions/${encodeURIComponent(item.slug)}/v2`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const stateData = (await stateRes.json()) as CompanionV2EditorState;
      if (!stateRes.ok || !stateData.companion) {
        throw new Error('Could not load companion state for quick update');
      }

      const res = await fetch(`/api/admin/companions/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...stateData.companion,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update companion');
      const updated = data.companion as AdminCompanionRecord;
      setCompanions((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                is_active: updated.is_active,
                skill_level: updated.skill_level,
                override_global_rules: updated.override_global_rules,
                companion_group: updated.companion_group || c.companion_group,
              }
            : c
        )
      );
      if (draft?.id === updated.id) {
        setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
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
      const res = await fetch('/api/admin/settings/chatbot/engine-prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(engineOverrides),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save global companion controls');
      setEngineOverrides(
        data.overrides && typeof data.overrides === 'object' ? data.overrides : {}
      );
      setFeedback('Saved global companion baselines, guardrails, group defaults & skill rules.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save global companion prompts'
      );
    } finally {
      setGlobalPromptsSaving(false);
    }
  };

  const handleResetGlobalPromptKey = async (key: string) => {
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

  const handleSaveSpecializations = async (nextTags: CompanionSpecializationTag[]) => {
    setSpecializationsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/companions/specializations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ specializations: nextTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save specializations taxonomy');
      if (Array.isArray(data.specializations)) {
        setSpecializations(data.specializations);
      }
      setFeedback('Saved specialization taxonomy across Hub & Admin Studio.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save specializations');
    } finally {
      setSpecializationsSaving(false);
    }
  };

  const isBuiltinDefault = Boolean(
    draft && !isCreating && defaultSlugs.includes(draft.slug.toLowerCase())
  );

  const canReorder =
    searchQuery.trim() === '' &&
    groupFilter === 'all' &&
    specializationFilter === 'all' &&
    categoryFilter === 'all' &&
    skillFilter === 'all' &&
    sexFilter === 'all' &&
    statusFilter === 'all';

  const esotericCount = useMemo(
    () => companions.filter((c) => c.skill_level !== 'none_emotional').length,
    [companions]
  );

  const pendingDraftCount = useMemo(
    () => companions.filter((c) => c.has_unpublished_draft).length,
    [companions]
  );

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] px-5 py-4">
        <div className="space-y-2">
          <div>
            <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
              Companions Authoring Studio V2
            </h2>
            <p className="text-xs text-[#5C5449] mt-0.5">
              Author layered V2 personas, specialization taxonomy, contextual nuances, versioned drafts, and JSON bundles.
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
              Roster &amp; Studio ({companions.length})
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
              Global Intelligence &amp; Taxonomy
            </button>
            <button
              type="button"
              onClick={() => {
                if (draft?.slug && !isCreating) {
                  setTestingTargetSlug(draft.slug);
                }
                setManagerView('testing');
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                managerView === 'testing'
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              Testing Studio
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs tabular-nums text-[#8B8275]">
            {companions.filter((c) => c.is_active).length} active · {esotericCount} chart-skilled ·{' '}
            {pendingDraftCount > 0 ? `${pendingDraftCount} drafts · ` : ''}
            {companions.length} total
          </span>
          <div className="inline-flex items-center rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() =>
                setIoModalState({ open: true, scope: 'bulk', focus: 'import' })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Import</span>
            </button>
            <span className="h-4 w-px bg-[#3D3830]/15" aria-hidden="true" />
            <button
              type="button"
              onClick={() =>
                setIoModalState({ open: true, scope: 'bulk', focus: 'export' })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Export</span>
            </button>
          </div>
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

      {(!tableReady || !migration022Status.columnsReady) && (
        <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/12 p-4 text-xs text-[#3D3830] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {!tableReady
                ? 'Migration 015 Pending in Supabase'
                : 'Migration 022 Overlay Storage Active'}
            </p>
            <p className="text-[#5C5449]">
              {!tableReady
                ? 'Viewing in-memory defaults. Run supabase/migrations/015_companions_v2_and_chat_styles.sql to enable database persistence.'
                : 'Drafts, V2 personas, and version snapshots are persisted safely via platform_settings overlay until supabase/migrations/022_companion_intelligence_v2.sql is applied.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}

      {lockAlert && (
        <div className="rounded-2xl border border-[#B8965A]/50 bg-[#B8965A]/12 p-4 space-y-2.5 text-xs text-[#3D3830]">
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">Core Identity Protection Triggered</p>
              <p className="text-[#5C5449]">{lockAlert.message}</p>
              {lockAlert.protectedChanges.length > 0 && (
                <div className="pt-1 space-y-1">
                  {lockAlert.protectedChanges.map((chg) => (
                    <div key={chg.field} className="text-[11px] text-[#5C5449]">
                      <strong className="text-[#3D3830]">{chg.label}:</strong> {chg.before} →{' '}
                      <span className="text-[#8B7355]">{chg.after}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <button
              type="button"
              onClick={() => {
                setUnlockOverride(true);
                void handleSaveDraftOrCreate(true);
              }}
              className="rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
            >
              Confirm Unlock &amp; Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                setUnlockOverride(true);
                void handlePublish(true);
              }}
              className="rounded-full bg-[#4A453D] px-3.5 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
            >
              Confirm Unlock &amp; Publish Live
            </button>
            <button
              type="button"
              onClick={() => setLockAlert(null)}
              className="text-[11px] text-[#5C5449] hover:text-[#3D3830] px-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
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
          Loading companions studio...
        </div>
      ) : managerView === 'global' ? (
        <GlobalIntelligencePanel
          companions={companions}
          specializations={specializations}
          setSpecializations={setSpecializations}
          globalPromptsLoading={globalPromptsLoading}
          globalPromptsSaving={globalPromptsSaving}
          engineOverrides={engineOverrides}
          setEngineOverrides={setEngineOverrides}
          engineDefaults={engineDefaults}
          onSaveGlobalPrompts={() => void handleSaveGlobalCompanionPrompts()}
          onResetGlobalPromptKey={(k) => void handleResetGlobalPromptKey(k)}
          onSaveSpecializations={handleSaveSpecializations}
          specializationsSaving={specializationsSaving}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          skillFilter={skillFilter}
          setSkillFilter={setSkillFilter}
          filteredCompanions={filteredCompanions}
          quickUpdatingId={quickUpdatingId}
          onQuickPatchCompanion={(item, patch, label) =>
            void handleQuickPatchCompanion(item, patch, label)
          }
          onOpenCompanionInEditor={(item) => {
            handleSelectCompanion(item);
            setManagerView('roster');
          }}
        />
      ) : managerView === 'testing' ? (
        <CompanionTestingStudio
          companions={companions}
          initialSlug={testingTargetSlug || (!isCreating ? draft?.slug : null)}
          activeEditorDraft={!isCreating ? draft : null}
          getAccessToken={getAccessToken}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[296px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)] gap-5 items-start">
          {/* LEFT DIRECTORY RAIL */}
          <aside className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-3.5 border-b border-[#3D3830]/10 space-y-2.5 bg-[#FAF7F2]/60">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, expertise, specialization..."
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
                    ...COMPANION_GROUP_OPTIONS.map((g) => ({
                      value: g.value,
                      label: g.label,
                    })),
                  ]}
                />
                <CustomSelect
                  value={specializationFilter}
                  onChange={setSpecializationFilter}
                  ariaLabel="Filter companions by specialization"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Specializations' },
                    ...specializations.map((s) => ({ value: s.slug, label: s.label })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                    { value: 'draft_pending', label: 'Draft Pending' },
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
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  ariaLabel="Filter companions by category"
                  surface="elevated"
                  size="sm"
                  className="w-full"
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                />
              </div>

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
                      setSpecializationFilter('all');
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
                  const isSelected =
                    !isCreating &&
                    (selectedId === item.id || draft?.slug === item.slug);
                  const globalIdx = companions.findIndex((c) => c.id === item.id);
                  const isDragging = draggedIdx === globalIdx;
                  const isDragOver =
                    dragOverIdx === globalIdx &&
                    draggedIdx !== null &&
                    draggedIdx !== globalIdx;
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
                                item.is_active
                                  ? 'text-[#3D3830]'
                                  : 'text-[#8B8275] line-through'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                              {item.age}
                              {item.sex}
                            </span>
                            {item.core_identity_locked && (
                              <Lock className="h-2.5 w-2.5 text-[#8B8275] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#8B8275] truncate">
                            {item.primary_expertise} ·{' '}
                            <span className="font-mono">v{item.v2_version}</span>
                            {item.has_unpublished_draft && (
                              <span className="text-[#8B7355] font-medium">
                                {' '}
                                · Draft
                              </span>
                            )}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {canReorder && (
                          <>
                            <button
                              type="button"
                              disabled={reordering || globalIdx <= 0}
                              onClick={() =>
                                void handleMoveCompanionToIndex(globalIdx, globalIdx - 1)
                              }
                              aria-label={`Move ${item.name} up`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FDFBF7] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={reordering || globalIdx >= companions.length - 1}
                              onClick={() =>
                                void handleMoveCompanionToIndex(globalIdx, globalIdx + 1)
                              }
                              aria-label={`Move ${item.name} down`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FDFBF7] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void handleQuickPatchCompanion(
                              item,
                              { is_active: !item.is_active },
                              `${item.name} is now ${!item.is_active ? 'active in Chat' : 'hidden'}.`
                            )
                          }
                          title={
                            item.is_active
                              ? 'Active — click to hide'
                              : 'Hidden — click to activate'
                          }
                          aria-label={
                            item.is_active
                              ? `Hide ${item.name}`
                              : `Activate ${item.name}`
                          }
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
          <div className="min-w-0 space-y-4">
            {detailLoading ? (
              <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-10 text-center text-sm text-[#8B8275]">
                Loading companion V2 workspace...
              </div>
            ) : !draft ? (
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
                        {!isCreating && editorState && (
                          <span className="font-mono text-[11px] tabular-nums text-[#5C5449]">
                            · v{editorState.v2_version}
                            {editorState.has_unpublished_draft ? ' · Draft Pending' : ' · Live'}
                            {editorState.core_identity_locked ? ' · Core Locked' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5449] mt-0.5">
                        {isCreating
                          ? 'Custom V2 preset · unsaved draft'
                          : isBuiltinDefault
                          ? 'Built-in Canonical Preset'
                          : 'Admin-Created Companion'}
                        {hasUnsavedLocalChanges && (
                          <span className="text-[#8B7355] font-medium">
                            {' '}
                            · Unsaved local edits
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isCreating && draft.slug && (
                      <button
                        type="button"
                        onClick={() => {
                          setTestingTargetSlug(draft.slug);
                          setManagerView('testing');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#B8965A]/40 bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-[#8B7355]" />
                        <span>Test in Studio</span>
                      </button>
                    )}
                    {isBuiltinDefault && (
                      <button
                        type="button"
                        disabled={resetting || savingDraft || publishing}
                        onClick={() => void handleResetToDefault()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      ))}

                    <button
                      type="button"
                      disabled={savingDraft || publishing}
                      onClick={() => void handleSaveDraftOrCreate(false)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>
                        {savingDraft
                          ? 'Saving...'
                          : isCreating
                          ? 'Create Companion'
                          : 'Save Draft'}
                      </span>
                    </button>

                    {!isCreating && (
                      <button
                        type="button"
                        disabled={publishing || savingDraft}
                        onClick={() => void handlePublish(false)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>{publishing ? 'Publishing...' : 'Publish Live'}</span>
                      </button>
                    )}

                    <div className="inline-flex items-center rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setIoModalState({
                            open: true,
                            scope: 'single',
                            focus: 'import',
                          })
                        }
                        title={
                          isCreating
                            ? 'Import JSON into new companion'
                            : `Import JSON for ${draft.name}`
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-[#8B7355]" />
                        <span>Import</span>
                      </button>
                      <span className="h-4 w-px bg-[#3D3830]/15" aria-hidden="true" />
                      <button
                        type="button"
                        disabled={isCreating || !draft.slug}
                        onClick={() =>
                          setIoModalState({
                            open: true,
                            scope: 'single',
                            focus: 'export',
                          })
                        }
                        title={
                          isCreating
                            ? 'Save companion first to export JSON'
                            : `Export JSON for ${draft.name}`
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 text-[#8B7355]" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6-Tab V2 Authoring Navigation (Full Width) */}
                <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-[#F1ECE3] p-1.5">
                  {(
                    [
                      { key: 'profile', label: 'Public Profile', icon: UserCheck },
                      { key: 'core_identity', label: 'Core Identity & Voice', icon: Sparkles },
                      { key: 'nuances', label: 'Nuances & Dialogues', icon: MessageSquareQuote },
                      { key: 'specialist', label: 'Specialist & Rules', icon: Sliders },
                      { key: 'chat_ai', label: 'Chat & AI Settings', icon: MessageSquare },
                      { key: 'versions', label: 'Versions & Rollback', icon: History },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const active = editorTab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setEditorTab(t.key)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

                {/* Full-width editor by default; split with Live Companion Preview only on Chat & AI Settings */}
                <div
                  className={
                    editorTab === 'chat_ai'
                      ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start'
                      : 'w-full'
                  }
                >
                  <div className="min-w-0 space-y-5">
                    {editorTab === 'profile' && (
                      <CompanionPublicProfileTab
                        draft={draft}
                        setDraft={setDraft}
                        isCreating={isCreating}
                        coreIdentityLocked={Boolean(editorState?.core_identity_locked ?? true)}
                        secondaryText={secondaryText}
                        setSecondaryText={setSecondaryText}
                        situationTagsText={situationTagsText}
                        setSituationTagsText={setSituationTagsText}
                        specializations={specializations}
                        availablePortraits={availablePortraits}
                        monogramPalettes={monogramPalettes}
                        getAccessToken={getAccessToken}
                        onFeedback={(msg) => setFeedback(msg)}
                      />
                    )}

                    {editorTab === 'core_identity' && (
                      <CompanionCoreIdentityTab
                        draft={draft}
                        setDraft={setDraft}
                        isCreating={isCreating}
                        unlockOverride={unlockOverride}
                        setUnlockOverride={setUnlockOverride}
                        getAccessToken={getAccessToken}
                        onFeedback={(msg) => setFeedback(msg)}
                        onError={(msg) => setError(msg || null)}
                      />
                    )}

                    {editorTab === 'nuances' && (
                      <CompanionNuancesDialoguesTab draft={draft} setDraft={setDraft} />
                    )}

                    {editorTab === 'specialist' && (
                      <CompanionSpecialistRulesTab
                        draft={draft}
                        setDraft={setDraft}
                        formulaCartridges={formulaCartridges}
                      />
                    )}

                    {editorTab === 'chat_ai' && (
                      <CompanionChatAiSettingsTab
                        draft={draft}
                        setDraft={setDraft}
                        modelOptions={modelOptions}
                      />
                    )}

                    {editorTab === 'versions' && (
                      <CompanionVersionsTab
                        editorState={editorState}
                        hasUnsavedLocalChanges={hasUnsavedLocalChanges}
                        changeNote={changeNote}
                        setChangeNote={setChangeNote}
                        publishing={publishing}
                        discarding={discardingDraft}
                        rollingBackVersion={rollingBackVersion}
                        onPublish={() => void handlePublish(false)}
                        onDiscardDraft={() => void handleDiscardDraft()}
                        onRollbackToDraft={(ver) => void handleRollbackToDraft(ver)}
                      />
                    )}
                  </div>

                  {/* Sticky Side-by-Side Live Companion Preview (visible only when modifying Chat & AI Settings) */}
                  {editorTab === 'chat_ai' && (
                  <aside className="xl:sticky xl:top-4 space-y-4 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8275]">
                        Live Companion Preview
                      </span>
                      <span className="rounded-full bg-[#F1ECE3] px-2 py-0.5 text-[10px] font-medium text-[#5C5449]">
                        {CHAT_STYLE_OPTIONS.find((o) => o.value === draft.chat_style)
                          ?.label || draft.chat_style}
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
                            {draft.card_subtitle || draft.primary_expertise || 'Role / Expertise'}
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
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import / Export JSON Studio Modal */}
      <CompanionImportExportModal
        isOpen={ioModalState.open}
        onClose={() => setIoModalState((prev) => ({ ...prev, open: false }))}
        selectedSlug={!isCreating && draft?.slug ? draft.slug : null}
        selectedName={!isCreating && draft?.name ? draft.name : null}
        initialScope={ioModalState.scope}
        initialFocus={ioModalState.focus}
        getAccessToken={getAccessToken}
        onImportSuccess={async (msg, targetSlug) => {
          setFeedback(msg);
          setGlobalPromptsLoaded(false);
          await loadCompanions(targetSlug);
        }}
      />
    </div>
  );
};

export default AdminCompanionsManager;
