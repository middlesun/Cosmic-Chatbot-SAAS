import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import {
  BIRTH_TIME_ACCURACY_OPTIONS,
  CAREER_MODE_OPTIONS,
  CITED_INSIGHT_CATEGORY_LABELS,
  computeLifeContextCompleteness,
  DEEP_PROFILE_BUCKET_LABELS,
  isMarriedRelationshipStatus,
  LIFE_CONTEXT_FRAMING_COPY,
  LOCATION_STATUS_OPTIONS,
  PAST_ANCHOR_TAG_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  type BirthTimeAccuracy,
  type CareerContextMode,
  type CitedInsightCategory,
  type CouncilAnalystNote,
  type DeepProfileBucketKey,
  type DeepProfileData,
  type DeepProfileEntry,
  type LifeContextAnchor,
  type LifeContextChild,
  type LifeContextData,
  type LocationContextStatus,
  type RelationshipContextStatus,
} from '../../lib/lifeContextSchema';

interface LifeContextModalProps {
  isOpen: boolean;
  profileId: string;
  profileName: string;
  initialContext?: LifeContextData | null;
  initialDeepProfile?: DeepProfileData | null;
  initialAnalystNotes?: CouncilAnalystNote[] | null;
  getAccessToken: () => Promise<string | null>;
  isPreviewMode?: boolean;
  onClose: () => void;
  onSaved: (
    updatedContext: LifeContextData,
    completeness: number,
    extra?: {
      deep_profile_json?: DeepProfileData;
      analyst_notes_json?: CouncilAnalystNote[];
    }
  ) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = [
  { value: '', label: 'Select year' },
  ...Array.from({ length: CURRENT_YEAR - 1945 + 1 }, (_, i) => {
    const yr = String(CURRENT_YEAR - i);
    return { value: yr, label: yr };
  }),
];

const HOUR_OPTIONS = [
  { value: '', label: 'Hour' },
  ...Array.from({ length: 24 }, (_, h) => {
    const val = String(h).padStart(2, '0');
    return { value: val, label: `${val}h` };
  }),
];

const MINUTE_OPTIONS = [
  { value: '', label: 'Min' },
  ...Array.from({ length: 60 }, (_, m) => {
    const val = String(m).padStart(2, '0');
    return { value: val, label: `:${val}` };
  }),
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Son / Male' },
  { value: 'female', label: 'Daughter / Female' },
];

function cloneInitial(raw?: LifeContextData | null): LifeContextData {
  if (!raw || typeof raw !== 'object') return {};
  return {
    ...(raw.birth_time_accuracy ? { birth_time_accuracy: raw.birth_time_accuracy } : {}),
    ...(raw.relationship_status ? { relationship_status: raw.relationship_status } : {}),
    ...(typeof raw.marriage_year === 'number' ? { marriage_year: raw.marriage_year } : {}),
    ...(typeof raw.has_children === 'boolean' ? { has_children: raw.has_children } : {}),
    ...(Array.isArray(raw.children)
      ? { children: raw.children.map((c) => ({ ...c })) }
      : {}),
    ...(raw.children_summary ? { children_summary: raw.children_summary } : {}),
    ...(raw.career_mode ? { career_mode: raw.career_mode } : {}),
    ...(raw.career_role ? { career_role: raw.career_role } : {}),
    ...(raw.workplace_context ? { workplace_context: raw.workplace_context } : {}),
    ...(raw.location_status ? { location_status: raw.location_status } : {}),
    ...(Array.isArray(raw.past_anchors)
      ? { past_anchors: raw.past_anchors.map((a) => ({ ...a })) }
      : {}),
    ...(Array.isArray(raw.core_stress_areas)
      ? { core_stress_areas: [...raw.core_stress_areas] }
      : {}),
    ...(Array.isArray(raw.cited_insights)
      ? { cited_insights: raw.cited_insights.map((i) => ({ ...i })) }
      : {}),
  };
}

const CITED_CATEGORY_OPTIONS = (
  Object.entries(CITED_INSIGHT_CATEGORY_LABELS) as Array<[CitedInsightCategory, string]>
).map(([value, label]) => ({ value, label }));

function cloneDeepProfile(raw?: DeepProfileData | null): DeepProfileData {
  if (!raw || typeof raw !== 'object') return {};
  const next: DeepProfileData = {};
  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    if (Array.isArray(raw[key]) && raw[key]!.length > 0) {
      next[key] = [...raw[key]!];
    }
  }
  if (Array.isArray(raw.entries) && raw.entries.length > 0) {
    next.entries = raw.entries.map((entry) => ({ ...entry }));
  }
  if (raw.updated_at) next.updated_at = raw.updated_at;
  return next;
}

const LifeContextModal: React.FC<LifeContextModalProps> = ({
  isOpen,
  profileId,
  profileName,
  initialContext,
  initialDeepProfile,
  initialAnalystNotes,
  getAccessToken,
  isPreviewMode = false,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState<LifeContextData>(() => cloneInitial(initialContext));
  const [deepDraft, setDeepDraft] = useState<DeepProfileData>(() =>
    cloneDeepProfile(initialDeepProfile)
  );
  const [analystNotesDraft, setAnalystNotesDraft] = useState<CouncilAnalystNote[]>(() =>
    Array.isArray(initialAnalystNotes) ? initialAnalystNotes.map((n) => ({ ...n })) : []
  );
  const [deepTouched, setDeepTouched] = useState(false);
  const [analystTouched, setAnalystTouched] = useState(false);

  const [editingInsightIdx, setEditingInsightIdx] = useState<number | null>(null);
  const [editingInsightSummary, setEditingInsightSummary] = useState('');
  const [editingInsightCategory, setEditingInsightCategory] =
    useState<CitedInsightCategory>('practical_life');

  const [editingDeepEntryId, setEditingDeepEntryId] = useState<string | null>(null);
  const [editingDeepEntryFact, setEditingDeepEntryFact] = useState('');

  const [expandedChildExactIdx, setExpandedChildExactIdx] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(cloneInitial(initialContext));
    setDeepDraft(cloneDeepProfile(initialDeepProfile));
    setAnalystNotesDraft(
      Array.isArray(initialAnalystNotes) ? initialAnalystNotes.map((n) => ({ ...n })) : []
    );
    setDeepTouched(false);
    setAnalystTouched(false);
    setEditingInsightIdx(null);
    setEditingDeepEntryId(null);
    setExpandedChildExactIdx({});
    setError(null);
  }, [isOpen, initialContext, initialDeepProfile, initialAnalystNotes, profileId]);

  useEffect(() => {
    if (!isOpen || isPreviewMode) return;
    if (initialDeepProfile !== undefined || initialAnalystNotes !== undefined) return;
    let active = true;
    const controller = new AbortController();

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || !active) return;
        const res = await fetch(`/api/profiles/${profileId}?includeChart=0`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !active) return;
        const data = await res.json().catch(() => ({}));
        const prof = data?.profile as
          | {
              deep_profile_json?: DeepProfileData | null;
              analyst_notes_json?: CouncilAnalystNote[] | null;
            }
          | undefined;
        if (!active || !prof) return;
        if (prof.deep_profile_json && typeof prof.deep_profile_json === 'object') {
          setDeepDraft((prev) =>
            Object.keys(prev).length > 0 ? prev : cloneDeepProfile(prof.deep_profile_json)
          );
        }
        if (Array.isArray(prof.analyst_notes_json)) {
          setAnalystNotesDraft((prev) =>
            prev.length > 0 ? prev : prof.analyst_notes_json!.map((n) => ({ ...n }))
          );
        }
      } catch {
        // Non-fatal silent hydration
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOpen, isPreviewMode, profileId, initialDeepProfile, initialAnalystNotes, getAccessToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const liveCompleteness = useMemo(() => computeLifeContextCompleteness(draft), [draft]);

  if (!isOpen) return null;

  const relStatus = draft.relationship_status;
  const showMarriageYear =
    isMarriedRelationshipStatus(relStatus) ||
    relStatus === 'divorced_separated' ||
    relStatus === 'widowed';

  const needsChildrenPrompt =
    relStatus === 'married_with_children' ||
    relStatus === 'divorced_separated' ||
    relStatus === 'widowed' ||
    draft.has_children === true ||
    (Array.isArray(draft.children) && draft.children.length > 0);

  const showChildrenRows =
    relStatus === 'married_with_children' ||
    draft.has_children === true ||
    (Array.isArray(draft.children) && draft.children.length > 0);

  const handleRelationshipChange = (nextVal: string) => {
    const nextStatus = nextVal as RelationshipContextStatus;
    setDraft((prev) => {
      const next: LifeContextData = { ...prev, relationship_status: nextStatus };
      if (nextStatus === 'married_with_children') {
        next.has_children = true;
        if (!next.children || next.children.length === 0) {
          next.children = [{ gender: 'male', birth_year: CURRENT_YEAR - 4 }];
        }
      } else if (
        nextStatus === 'single' ||
        nextStatus === 'dating_committed' ||
        nextStatus === 'engaged' ||
        nextStatus === 'married_no_children'
      ) {
        next.has_children = false;
        delete next.children;
        if (nextStatus !== 'married_no_children') {
          delete next.marriage_year;
        }
      }
      return next;
    });
  };

  const handleAddChild = () => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.children) ? prev.children : [];
      if (existing.length >= 10) return prev;
      return {
        ...prev,
        has_children: true,
        children: [...existing, { gender: 'female', birth_year: CURRENT_YEAR - 3 }],
      };
    });
  };

  const handleUpdateChild = (idx: number, patch: Partial<LifeContextChild>) => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.children) ? [...prev.children] : [];
      if (!existing[idx]) return prev;
      existing[idx] = { ...existing[idx], ...patch };
      return { ...prev, children: existing };
    });
  };

  const handleRemoveChild = (idx: number) => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.children) ? prev.children : [];
      const filtered = existing.filter((_, i) => i !== idx);
      return {
        ...prev,
        children: filtered,
      };
    });
  };

  const handleAddAnchor = () => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.past_anchors) ? prev.past_anchors : [];
      if (existing.length >= 10) return prev;
      return {
        ...prev,
        past_anchors: [...existing, { year: CURRENT_YEAR - 2, tag: 'career_shift' }],
      };
    });
  };

  const handleUpdateAnchor = (idx: number, patch: Partial<LifeContextAnchor>) => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.past_anchors) ? [...prev.past_anchors] : [];
      if (!existing[idx]) return prev;
      existing[idx] = { ...existing[idx], ...patch };
      return { ...prev, past_anchors: existing };
    });
  };

  const handleRemoveAnchor = (idx: number) => {
    setDraft((prev) => {
      const existing = Array.isArray(prev.past_anchors) ? prev.past_anchors : [];
      return {
        ...prev,
        past_anchors: existing.filter((_, i) => i !== idx),
      };
    });
  };

  const handleStartEditInsight = (idx: number) => {
    const target = draft.cited_insights?.[idx];
    if (!target) return;
    setEditingInsightIdx(idx);
    setEditingInsightSummary(target.summary || '');
    setEditingInsightCategory(target.category || 'practical_life');
  };

  const handleSaveEditInsight = (idx: number) => {
    const trimmed = editingInsightSummary.trim().slice(0, 180);
    if (!trimmed || trimmed.length < 4) return;
    setDraft((prev) => {
      const list = Array.isArray(prev.cited_insights) ? [...prev.cited_insights] : [];
      if (!list[idx]) return prev;
      list[idx] = {
        ...list[idx],
        summary: trimmed,
        category: editingInsightCategory,
        updated_at: new Date().toISOString(),
      };
      return { ...prev, cited_insights: list };
    });
    setEditingInsightIdx(null);
  };

  const handleDeleteDeepEntry = (entry: DeepProfileEntry) => {
    setDeepTouched(true);
    setDeepDraft((prev) => {
      const nextEntries = (prev.entries || []).filter((e) => e.id !== entry.id);
      const next: DeepProfileData = { ...prev, entries: nextEntries };
      if (entry.bucket && Array.isArray(next[entry.bucket])) {
        const lowerFact = entry.fact.trim().toLowerCase();
        next[entry.bucket] = next[entry.bucket]!.filter(
          (item) => item.trim().toLowerCase() !== lowerFact
        );
      }
      return next;
    });
  };

  const handleSaveEditDeepEntry = (entry: DeepProfileEntry) => {
    const trimmed = editingDeepEntryFact.trim().slice(0, 200);
    if (!trimmed || trimmed.length < 4) return;
    setDeepTouched(true);
    setDeepDraft((prev) => {
      const oldLower = entry.fact.trim().toLowerCase();
      const nextEntries = (prev.entries || []).map((e) =>
        e.id === entry.id ? { ...e, fact: trimmed, updated_at: new Date().toISOString() } : e
      );
      const next: DeepProfileData = { ...prev, entries: nextEntries };
      if (entry.bucket && Array.isArray(next[entry.bucket])) {
        next[entry.bucket] = next[entry.bucket]!.map((item) =>
          item.trim().toLowerCase() === oldLower ? trimmed : item
        );
      }
      return next;
    });
    setEditingDeepEntryId(null);
  };

  const handleRemoveBucketFact = (bucketKey: DeepProfileBucketKey, idx: number, factText: string) => {
    setDeepTouched(true);
    setDeepDraft((prev) => {
      const nextList = (prev[bucketKey] || []).filter((_, i) => i !== idx);
      const lower = factText.trim().toLowerCase();
      const nextEntries = (prev.entries || []).filter(
        (e) => e.fact.trim().toLowerCase() !== lower
      );
      return {
        ...prev,
        [bucketKey]: nextList,
        entries: nextEntries,
      };
    });
  };

  const handleRemoveAnalystNote = (noteId: string) => {
    setAnalystTouched(true);
    setAnalystNotesDraft((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isPreviewMode) {
      onSaved(draft, liveCompleteness, {
        ...(deepTouched ? { deep_profile_json: deepDraft } : {}),
        ...(analystTouched ? { analyst_notes_json: analystNotesDraft } : {}),
      });
      onClose();
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setError('Please sign in to save your life context.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...draft };
      if (deepTouched) payload.deep_profile_json = deepDraft;
      if (analystTouched) payload.analyst_notes_json = analystNotesDraft;

      const res = await fetch(`/api/profiles/${profileId}/life-context`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save context details.');
      } else {
        const finalCtx = (data.life_context_json || draft) as LifeContextData;
        const finalScore =
          typeof data.completeness === 'number' ? data.completeness : liveCompleteness;
        onSaved(finalCtx, finalScore, {
          ...(data.deep_profile_json ? { deep_profile_json: data.deep_profile_json } : {}),
          ...(Array.isArray(data.analyst_notes_json)
            ? { analyst_notes_json: data.analyst_notes_json }
            : {}),
        });
        onClose();
      }
    } catch {
      setError('Network error saving life context.');
    } finally {
      setSaving(false);
    }
  };

  const childrenList = Array.isArray(draft.children) ? draft.children : [];
  const anchorsList = Array.isArray(draft.past_anchors) ? draft.past_anchors : [];
  const deepEntries = Array.isArray(deepDraft.entries) ? deepDraft.entries : [];
  const deepEntryFactsSet = new Set(deepEntries.map((e) => e.fact.trim().toLowerCase()));
  const unindexedDeepBuckets = (
    Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]
  )
    .map((key) => ({
      key,
      label: DEEP_PROFILE_BUCKET_LABELS[key],
      items: (deepDraft[key] || []).filter(
        (fact) => !deepEntryFactsSet.has(fact.trim().toLowerCase())
      ),
    }))
    .filter((b) => b.items.length > 0);
  const hasAnyLivingProfileSection =
    (Array.isArray(draft.core_stress_areas) && draft.core_stress_areas.length > 0) ||
    (Array.isArray(draft.cited_insights) && draft.cited_insights.length > 0) ||
    Boolean(draft.children_summary) ||
    deepEntries.length > 0 ||
    unindexedDeepBuckets.length > 0 ||
    analystNotesDraft.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/50 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-cc-drawer-in w-full max-w-2xl rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header with Calibration Progress Meter */}
        <div className="px-5 sm:px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B7355]">
                Life Context &amp; Anchors
              </p>
              <h2 className="font-serif text-2xl font-medium text-[#3D3830] truncate">
                Calibrate {profileName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close life context modal"
              className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-[#5C5449] leading-relaxed">{LIFE_CONTEXT_FRAMING_COPY}</p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#5C5449]">Reading calibration</span>
              <span
                className={`font-['JetBrains_Mono',monospace] tabular-nums font-semibold ${
                  liveCompleteness >= 80 ? 'text-[#2D6A4F]' : 'text-[#3D3830]'
                }`}
              >
                {liveCompleteness}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
              <div
                style={{ width: `${liveCompleteness}%` }}
                className={`h-full rounded-full transition-all duration-300 ${
                  liveCompleteness >= 80 ? 'bg-[#2D6A4F]' : 'bg-[#8B7355]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {/* 1. Birth Time Accuracy (20%) */}
            <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#3D3830]">
                  1. How reliable is the birth time?
                </label>
                <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B8275]">
                  20%
                </span>
              </div>
              <CustomSelect
                ariaLabel="Birth time reliability"
                value={draft.birth_time_accuracy || ''}
                onChange={(val) =>
                  setDraft((prev) => ({
                    ...prev,
                    birth_time_accuracy: val as BirthTimeAccuracy,
                  }))
                }
                placeholder="Select birth time precision"
                options={BIRTH_TIME_ACCURACY_OPTIONS}
                surface="canvas"
              />
            </div>

            {/* 2. Marital & Family Status (25%) */}
            <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#3D3830]">
                  2. Marital &amp; Family Status
                </label>
                <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B8275]">
                  25%
                </span>
              </div>
              <CustomSelect
                ariaLabel="Marital and family status"
                value={draft.relationship_status || ''}
                onChange={handleRelationshipChange}
                placeholder="Select current relationship status"
                options={RELATIONSHIP_STATUS_OPTIONS}
                surface="canvas"
              />

              {showMarriageYear && (
                <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Wedding year (optional)
                    </label>
                    <CustomSelect
                      ariaLabel="Marriage year"
                      value={draft.marriage_year ? String(draft.marriage_year) : ''}
                      onChange={(val) =>
                        setDraft((prev) => ({
                          ...prev,
                          marriage_year: val ? Number(val) : undefined,
                        }))
                      }
                      placeholder="Select year"
                      options={YEAR_OPTIONS}
                      size="sm"
                      surface="canvas"
                    />
                  </div>

                  {(relStatus === 'divorced_separated' || relStatus === 'widowed') && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                        Children
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              has_children: false,
                              children: [],
                            }))
                          }
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                            draft.has_children === false
                              ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                              : 'bg-[#FAF7F2] text-[#5C5449] border-[#3D3830]/15 hover:text-[#3D3830]'
                          }`}
                        >
                          No children
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (childrenList.length === 0) {
                              handleAddChild();
                            } else {
                              setDraft((prev) => ({ ...prev, has_children: true }));
                            }
                          }}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                            draft.has_children === true
                              ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                              : 'bg-[#FAF7F2] text-[#5C5449] border-[#3D3830]/15 hover:text-[#3D3830]'
                          }`}
                        >
                          Have children
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtle link for unmarried/other statuses if user still wants to add children */}
              {!needsChildrenPrompt && (
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[#8B7355] hover:text-[#3D3830] transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add child details (if applicable)</span>
                </button>
              )}

              {/* 3. Conditional Children Repeater (15%) */}
              {showChildrenRows && (
                <div className="pt-3 border-t border-[#3D3830]/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#3D3830]">
                        Children Details <span className="font-normal text-[#8B8275]">(15%)</span>
                      </p>
                      <p className="text-[11px] text-[#8B8275]">
                        Gender and year of birth ground D7 &amp; timing readings cleanly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddChild}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#3D3830]/20 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="h-3 w-3 text-[#8B7355]" />
                      <span>Add Child</span>
                    </button>
                  </div>

                  {childrenList.map((child, idx) => {
                    const showExact = Boolean(expandedChildExactIdx[idx]);
                    const [optHour = '', optMin = ''] = (child.optional_birth_time || '').split(':');

                    return (
                      <div
                        key={`child-${idx}`}
                        className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 p-3 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                          <div className="sm:col-span-6">
                            <label className="block text-[11px] text-[#5C5449] mb-1">
                              Child {idx + 1} Gender
                            </label>
                            <CustomSelect
                              ariaLabel={`Child ${idx + 1} gender`}
                              value={child.gender}
                              onChange={(val) =>
                                handleUpdateChild(idx, { gender: val as 'male' | 'female' })
                              }
                              options={GENDER_OPTIONS}
                              size="sm"
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] text-[#5C5449] mb-1">
                              Year of Birth
                            </label>
                            <CustomSelect
                              ariaLabel={`Child ${idx + 1} birth year`}
                              value={String(child.birth_year)}
                              onChange={(val) => {
                                if (val) handleUpdateChild(idx, { birth_year: Number(val) });
                              }}
                              options={YEAR_OPTIONS.filter((y) => y.value !== '')}
                              size="sm"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveChild(idx)}
                              aria-label={`Remove child ${idx + 1}`}
                              className="p-2 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChildExactIdx((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-[#8B7355] hover:text-[#3D3830] cursor-pointer"
                        >
                          {showExact ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          <span>
                            Optional: Add exact birth date, time &amp; place
                          </span>
                        </button>

                        {showExact && (
                          <div className="pt-2 border-t border-[#3D3830]/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-[#5C5449] mb-1">
                                Exact Birth Date (optional)
                              </label>
                              <CustomDatePicker
                                ariaLabel={`Child ${idx + 1} birth date`}
                                value={child.optional_birth_date || ''}
                                onChange={(iso) => {
                                  const derivedYear = iso ? Number(iso.slice(0, 4)) : undefined;
                                  handleUpdateChild(idx, {
                                    optional_birth_date: iso || undefined,
                                    ...(derivedYear ? { birth_year: derivedYear } : {}),
                                  });
                                }}
                                placeholder="Select date"
                                minYear={1950}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#5C5449] mb-1">
                                Exact Birth Time (24h, optional)
                              </label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <CustomSelect
                                  ariaLabel={`Child ${idx + 1} birth hour`}
                                  value={optHour}
                                  onChange={(h) => {
                                    const nextTime =
                                      h && optMin ? `${h}:${optMin}` : h ? `${h}:00` : undefined;
                                    handleUpdateChild(idx, { optional_birth_time: nextTime });
                                  }}
                                  options={HOUR_OPTIONS}
                                  size="sm"
                                />
                                <CustomSelect
                                  ariaLabel={`Child ${idx + 1} birth minute`}
                                  value={optMin}
                                  onChange={(m) => {
                                    const nextTime =
                                      optHour && m ? `${optHour}:${m}` : m ? `00:${m}` : undefined;
                                    handleUpdateChild(idx, { optional_birth_time: nextTime });
                                  }}
                                  options={MINUTE_OPTIONS}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-[#5C5449] mb-1">
                                Birth Place (optional)
                              </label>
                              <input
                                type="text"
                                maxLength={80}
                                value={child.optional_birth_place || ''}
                                onChange={(e) =>
                                  handleUpdateChild(idx, {
                                    optional_birth_place: e.target.value || undefined,
                                  })
                                }
                                placeholder="City, Country"
                                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Work & Income Structure (20%) */}
            <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#3D3830]">
                  3. Work &amp; Income Structure
                </label>
                <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B8275]">
                  20%
                </span>
              </div>
              <CustomSelect
                ariaLabel="Work and income structure"
                value={draft.career_mode || ''}
                onChange={(val) =>
                  setDraft((prev) => ({
                    ...prev,
                    career_mode: val as CareerContextMode,
                  }))
                }
                placeholder="Select current work mode"
                options={CAREER_MODE_OPTIONS}
                surface="canvas"
              />
              <div>
                <label className="block text-[11px] text-[#5C5449] mb-1">
                  Role or industry (optional)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={draft.career_role || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      career_role: e.target.value || undefined,
                    }))
                  }
                  placeholder="e.g. Product leader, clinic owner, civil engineer"
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#5C5449] mb-1">
                  Workplace &amp; day-to-day setup (optional)
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={draft.workplace_context || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      workplace_context: e.target.value || undefined,
                    }))
                  }
                  placeholder="e.g. Remote fintech team, family-run textile studio, independent clinic"
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                />
              </div>
            </div>

            {/* 5. Current Living Location vs Birthplace (10%) */}
            <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#3D3830]">
                  4. Living Location vs. Birthplace
                </label>
                <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B8275]">
                  10%
                </span>
              </div>
              <CustomSelect
                ariaLabel="Living location status"
                value={draft.location_status || ''}
                onChange={(val) =>
                  setDraft((prev) => ({
                    ...prev,
                    location_status: val as LocationContextStatus,
                  }))
                }
                placeholder="Select where you currently live"
                options={LOCATION_STATUS_OPTIONS}
                surface="canvas"
              />
            </div>

            {/* 6. Major Life Turning Points (10%) */}
            <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#3D3830]">
                    5. Major Past Turning Points{' '}
                    <span className="font-normal text-[#8B8275]">(Optional · 10%)</span>
                  </label>
                  <p className="text-[11px] text-[#8B8275] mt-0.5">
                    Helps cross-check how active planetary periods manifested in real life.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAnchor}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#3D3830]/20 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="h-3 w-3 text-[#8B7355]" />
                  <span>Add Event</span>
                </button>
              </div>

              {anchorsList.length > 0 && (
                <div className="space-y-2.5">
                  {anchorsList.map((anchor, idx) => (
                    <div
                      key={`anchor-${idx}`}
                      className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="sm:col-span-4">
                        <CustomSelect
                          ariaLabel={`Milestone ${idx + 1} year`}
                          value={String(anchor.year)}
                          onChange={(val) => {
                            if (val) handleUpdateAnchor(idx, { year: Number(val) });
                          }}
                          options={YEAR_OPTIONS.filter((y) => y.value !== '')}
                          size="sm"
                        />
                      </div>
                      <div className="sm:col-span-7">
                        <CustomSelect
                          ariaLabel={`Milestone ${idx + 1} event`}
                          value={anchor.tag}
                          onChange={(val) => handleUpdateAnchor(idx, { tag: val })}
                          options={PAST_ANCHOR_TAG_OPTIONS}
                          size="sm"
                        />
                        {anchor.cited_by && (
                          <p className="mt-1 text-[10px] text-[#8B8275]">
                            Noted by {anchor.cited_by}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveAnchor(idx)}
                          aria-label={`Remove milestone ${idx + 1}`}
                          className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Living Profile Notes, Deep Context & Council Takeaways */}
            {hasAnyLivingProfileSection && (
              <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#3D3830]">
                    6. Living Profile Notes &amp; Citations
                  </label>
                  <p className="text-[11px] text-[#8B8275] mt-0.5">
                    Details remembered across conversations with your Council and Companions so you never have to repeat yourself. Edit or remove anything anytime.
                  </p>
                </div>

                {draft.children_summary && (
                  <div className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2 flex items-center justify-between gap-2 text-xs text-[#5C5449]">
                    <span>
                      <span className="font-medium text-[#3D3830]">Children note:</span>{' '}
                      {draft.children_summary}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, children_summary: undefined }))
                      }
                      aria-label="Remove children note"
                      className="p-1 rounded-lg text-[#8B8275] hover:text-[#A94438] cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {Array.isArray(draft.core_stress_areas) && draft.core_stress_areas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[#5C5449]">
                      Recurring Life Themes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {draft.core_stress_areas.map((theme, idx) => (
                        <span
                          key={`${theme}-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1 text-[11px] text-[#3D3830]"
                        >
                          <span>{theme}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                core_stress_areas: (prev.core_stress_areas || []).filter(
                                  (_, i) => i !== idx
                                ),
                              }))
                            }
                            aria-label={`Remove theme ${theme}`}
                            className="text-[#8B8275] hover:text-[#A94438] cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(draft.cited_insights) && draft.cited_insights.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-[#5C5449]">
                      Personal Insights &amp; Context
                    </p>
                    <div className="space-y-2">
                      {draft.cited_insights.map((insight, idx) => {
                        const isEditing = editingInsightIdx === idx;
                        return (
                          <div
                            key={`${insight.id}-${idx}`}
                            className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 px-3 py-2.5 space-y-2"
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <CustomSelect
                                  ariaLabel="Insight category"
                                  value={editingInsightCategory}
                                  onChange={(val) =>
                                    setEditingInsightCategory(val as CitedInsightCategory)
                                  }
                                  options={CITED_CATEGORY_OPTIONS}
                                  size="sm"
                                />
                                <textarea
                                  rows={2}
                                  maxLength={180}
                                  value={editingInsightSummary}
                                  onChange={(e) => setEditingInsightSummary(e.target.value)}
                                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] focus:border-[#4A453D] focus:outline-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingInsightIdx(null)}
                                    className="rounded-full px-3 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditInsight(idx)}
                                    disabled={editingInsightSummary.trim().length < 4}
                                    className="rounded-full bg-[#4A453D] px-3.5 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-40 cursor-pointer"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8B8275]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-[#8B7355]">
                                      {CITED_INSIGHT_CATEGORY_LABELS[insight.category] ||
                                        insight.category.replace(/_/g, ' ')}
                                    </span>
                                    <span>·</span>
                                    <span>Added by {insight.cited_by}</span>
                                    {insight.captured_at && (
                                      <>
                                        <span>·</span>
                                        <span className="font-['JetBrains_Mono',monospace] tabular-nums">
                                          {insight.captured_at.slice(0, 10)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#3D3830] leading-relaxed">
                                    {insight.summary}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditInsight(idx)}
                                    aria-label={`Edit insight ${idx + 1}`}
                                    className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingInsightIdx === idx) setEditingInsightIdx(null);
                                      setDraft((prev) => ({
                                        ...prev,
                                        cited_insights: (prev.cited_insights || []).filter(
                                          (_, i) => i !== idx
                                        ),
                                      }));
                                    }}
                                    aria-label={`Remove insight ${idx + 1}`}
                                    className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(deepEntries.length > 0 || unindexedDeepBuckets.length > 0) && (
                  <div className="pt-2 border-t border-[#3D3830]/10 space-y-2.5">
                    <div>
                      <p className="text-[11px] font-medium text-[#5C5449]">
                        Deep Personal Patterns &amp; Tendencies
                      </p>
                      <p className="text-[10px] text-[#8B8275]">
                        Emotional habits, goals, and practical dynamics shared across your Council &amp; Companion sessions.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {deepEntries.map((entry) => {
                        const isEditing = editingDeepEntryId === entry.id;
                        const bucketLabel = entry.bucket
                          ? DEEP_PROFILE_BUCKET_LABELS[entry.bucket]
                          : CITED_INSIGHT_CATEGORY_LABELS[entry.category] || 'Life Pattern';
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 px-3 py-2.5 space-y-2"
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  maxLength={200}
                                  value={editingDeepEntryFact}
                                  onChange={(e) => setEditingDeepEntryFact(e.target.value)}
                                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] focus:border-[#4A453D] focus:outline-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingDeepEntryId(null)}
                                    className="rounded-full px-3 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditDeepEntry(entry)}
                                    disabled={editingDeepEntryFact.trim().length < 4}
                                    className="rounded-full bg-[#4A453D] px-3.5 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-40 cursor-pointer"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8B8275]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-[#8B7355]">
                                      {bucketLabel}
                                    </span>
                                    <span>·</span>
                                    <span>Noted via {entry.source_label}</span>
                                    {entry.updated_at && (
                                      <>
                                        <span>·</span>
                                        <span className="font-['JetBrains_Mono',monospace] tabular-nums">
                                          {entry.updated_at.slice(0, 10)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#3D3830] leading-relaxed">
                                    {entry.fact}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDeepEntryId(entry.id);
                                      setEditingDeepEntryFact(entry.fact);
                                    }}
                                    aria-label="Edit pattern note"
                                    className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDeepEntry(entry)}
                                    aria-label="Remove pattern note"
                                    className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {unindexedDeepBuckets.map((bucket) =>
                        bucket.items.map((fact, bIdx) => (
                          <div
                            key={`${bucket.key}-${bIdx}`}
                            className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 px-3 py-2 flex items-start justify-between gap-2.5"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8B7355]">
                                {bucket.label}
                              </span>
                              <p className="text-xs text-[#3D3830] leading-relaxed">{fact}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveBucketFact(bucket.key, bIdx, fact)}
                              aria-label={`Remove ${bucket.label} note`}
                              className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {analystNotesDraft.length > 0 && (
                  <div className="pt-2 border-t border-[#3D3830]/10 space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-[#5C5449]">
                        Council Chart Takeaways
                      </p>
                      <p className="text-[10px] text-[#8B8275]">
                        Key astrology findings shared silently with chart-aware Companions so advice stays consistent.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {analystNotesDraft.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 px-3 py-2.5 flex items-start justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8B8275]">
                              <span className="font-semibold uppercase tracking-[0.08em] text-[#8B7355]">
                                {note.system_label}
                              </span>
                              {note.captured_at && (
                                <>
                                  <span>·</span>
                                  <span className="font-['JetBrains_Mono',monospace] tabular-nums">
                                    {note.captured_at.slice(0, 10)}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-[#3D3830] leading-relaxed">{note.summary}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAnalystNote(note.id)}
                            aria-label="Remove chart takeaway"
                            className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#A94438] hover:bg-[#A94438]/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                {error}
              </p>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="px-5 sm:px-6 py-3.5 bg-[#F1ECE3] border-t border-[#3D3830]/10 flex items-center justify-between gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5C5449]">
              <Sparkles className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Editable anytime</span>
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{saving ? 'Saving...' : 'Save Context'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LifeContextModal;
