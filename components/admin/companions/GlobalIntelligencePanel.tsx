import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import {
  ACTIVE_COMPANION_GROUP_OPTIONS,
  CHAT_STYLE_OPTIONS,
  COMPANION_ADVISORY_MODE_OPTIONS,
  COMPANION_GROUP_OPTIONS,
  EMPTY_COMPANION_CHART_ACCESS,
  type ChatStyle,
  type CompanionAdvisoryMode,
  type CompanionGroup,
  type CompanionGroupConfig,
  type CompanionGroupConfigsMap,
  type CompanionSkillLevel,
  type CompanionSkillRuleKey,
  type CompanionSkillRulesMap,
} from '../../app/chatTypes';
import {
  CONSULTANTS_ONLY_MODE,
  type CompanionSpecializationTag,
  type SpecializationGroupKey,
} from '../../../lib/companionV2Schema';
import CompanionAvatar from '../../app/CompanionAvatar';
import {
  ACTIVE_SKILL_LEVEL_OPTIONS,
  ACTIVE_SPECIALIZATION_GROUP_OPTIONS,
  GLOBAL_ANALYTICAL_PREP_PROMPT_META,
  GLOBAL_COMPANION_PROMPT_META,
  SKILL_BADGE_MAP,
  SKILL_LEVEL_OPTIONS,
  SPECIALIZATION_GROUP_OPTIONS,
  type AdminCompanionRosterSummary,
  type GlobalAnalyticalPrepPromptKey,
  type GlobalCompanionAdminOverrides,
  type GlobalCompanionPromptKey,
} from './companionStudioTypes';

interface GlobalIntelligencePanelProps {
  companions: AdminCompanionRosterSummary[];
  specializations: CompanionSpecializationTag[];
  setSpecializations: React.Dispatch<React.SetStateAction<CompanionSpecializationTag[]>>;
  globalPromptsLoading: boolean;
  globalPromptsSaving: boolean;
  engineOverrides: GlobalCompanionAdminOverrides;
  setEngineOverrides: React.Dispatch<React.SetStateAction<GlobalCompanionAdminOverrides>>;
  engineDefaults: GlobalCompanionAdminOverrides;
  onSaveGlobalPrompts: () => void;
  onResetGlobalPromptKey: (key: string) => void;
  onSaveSpecializations: (nextTags: CompanionSpecializationTag[]) => Promise<void>;
  specializationsSaving: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  groupFilter: string;
  setGroupFilter: React.Dispatch<React.SetStateAction<string>>;
  skillFilter: string;
  setSkillFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  onStatusFilterChange: (nextStatus: string) => void;
  filteredCompanions: AdminCompanionRosterSummary[];
  quickUpdatingId: string | null;
  onQuickPatchCompanion: (
    item: AdminCompanionRosterSummary,
    patch: Partial<
      Pick<
        AdminCompanionRosterSummary,
        'is_active' | 'skill_level' | 'override_global_rules' | 'companion_group'
      >
    >,
    successLabel: string
  ) => void;
  onOpenCompanionInEditor: (item: AdminCompanionRosterSummary) => void;
}

const SKILL_RULE_LABELS: Array<{ key: CompanionSkillRuleKey; label: string; hint: string }> = [
  { key: 'none_emotional', label: 'Human Companion Only', hint: 'Silent life-stage awareness; no uninvited astrology.' },
  { key: 'vedic', label: 'Vedic Jyotish Skill', hint: 'Dasha, Nakshatra, houses translated without intimidating jargon.' },
  { key: 'western', label: 'Western Tropical Skill', hint: 'Sun/Moon/Rising, transits & aspect reflection.' },
  { key: 'tarot', label: 'Tarot Archetypes Skill', hint: 'Grounded Rider-Waite symbolism & reflective questions.' },
  { key: 'numerology', label: 'Numerology Skill', hint: 'Life Path & Personal Year cycle insights.' },
  { key: 'past_life', label: 'Past-Life & Nodal Skill', hint: 'Ketu/Rahu karmic pattern exploration.' },
  { key: 'council_notes', label: 'Council Memory Notes', hint: 'Honors user-pinned reading takeaways gently.' },
];

const GlobalIntelligencePanel: React.FC<GlobalIntelligencePanelProps> = ({
  specializations,
  setSpecializations,
  globalPromptsLoading,
  globalPromptsSaving,
  engineOverrides,
  setEngineOverrides,
  engineDefaults,
  onSaveGlobalPrompts,
  onResetGlobalPromptKey,
  onSaveSpecializations,
  specializationsSaving,
  searchQuery,
  setSearchQuery,
  groupFilter,
  setGroupFilter,
  skillFilter,
  setSkillFilter,
  statusFilter,
  onStatusFilterChange,
  filteredCompanions,
  quickUpdatingId,
  onQuickPatchCompanion,
  onOpenCompanionInEditor,
}) => {
  const [newSpecLabel, setNewSpecLabel] = useState('');
  const [newSpecSlug, setNewSpecSlug] = useState('');
  const [newSpecGroup, setNewSpecGroup] = useState<SpecializationGroupKey>(
    CONSULTANTS_ONLY_MODE ? 'spiritual_guides' : 'cross_cutting'
  );
  const [newSpecDesc, setNewSpecDesc] = useState('');
  const [globalFieldSearch, setGlobalFieldSearch] = useState('');
  const [collapsedFields, setCollapsedFields] = useState<Record<string, boolean>>({});

  const allFieldKeys = [
    ...GLOBAL_COMPANION_PROMPT_META.map((m) => `prompt_${m.key}`),
    ...GLOBAL_ANALYTICAL_PREP_PROMPT_META.map((m) => `prep_${m.key}`),
    ...ACTIVE_COMPANION_GROUP_OPTIONS.map((g) => `group_${g.value}`),
    ...SKILL_RULE_LABELS.map((s) => `skill_${s.key}`),
  ];

  const toggleFieldCollapse = (key: string) => {
    setCollapsedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    allFieldKeys.forEach((k) => { next[k] = true; });
    setCollapsedFields(next);
  };

  const handleExpandAll = () => {
    setCollapsedFields({});
  };

  const matchesSearch = (title: string, desc: string) => {
    if (!globalFieldSearch.trim()) return true;
    const q = globalFieldSearch.toLowerCase();
    return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  };

  const showArchivedMatrixOptions =
    !CONSULTANTS_ONLY_MODE ||
    statusFilter === 'hidden' ||
    statusFilter === 'all' ||
    statusFilter === 'draft_pending';

  const defaultGroups = (engineDefaults.companion_group_configs ||
    {}) as Partial<CompanionGroupConfigsMap>;
  const overrideGroups = (engineOverrides.companion_group_configs ||
    {}) as Partial<CompanionGroupConfigsMap>;

  const defaultSkillRules = (engineDefaults.companion_skill_rules ||
    {}) as Partial<CompanionSkillRulesMap>;
  const overrideSkillRules = (engineOverrides.companion_skill_rules ||
    {}) as Partial<CompanionSkillRulesMap>;

  const updateGroupConfig = (
    groupKey: CompanionGroup,
    patch: Partial<CompanionGroupConfig>
  ) => {
    const baseGrp: CompanionGroupConfig = {
      group_system_prompt: defaultGroups[groupKey]?.group_system_prompt || '',
      default_advisory_mode: defaultGroups[groupKey]?.default_advisory_mode || 'friend',
      default_chart_access:
        defaultGroups[groupKey]?.default_chart_access || EMPTY_COMPANION_CHART_ACCESS,
      default_chat_style: defaultGroups[groupKey]?.default_chat_style || 'chat_bubbles',
      default_max_output_tokens: defaultGroups[groupKey]?.default_max_output_tokens || 1200,
      ...(overrideGroups[groupKey] || {}),
    };
    setEngineOverrides((prev) => ({
      ...prev,
      companion_group_configs: {
        ...(prev.companion_group_configs || {}),
        [groupKey]: {
          ...baseGrp,
          ...patch,
        },
      },
    }));
  };

  const updateSkillRule = (skillKey: CompanionSkillRuleKey, val: string) => {
    setEngineOverrides((prev) => ({
      ...prev,
      companion_skill_rules: {
        ...(prev.companion_skill_rules || {}),
        [skillKey]: val,
      },
    }));
  };

  const handleAddSpecialization = () => {
    const cleanLabel = newSpecLabel.trim();
    if (!cleanLabel) return;
    const cleanSlug = (
      newSpecSlug.trim() ||
      cleanLabel
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    )
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .slice(0, 64);
    if (!cleanSlug || specializations.some((s) => s.slug === cleanSlug)) return;

    const maxOrder = specializations.reduce((m, s) => Math.max(m, s.sort_order), 0);
    setSpecializations((prev) => [
      ...prev,
      {
        slug: cleanSlug,
        label: cleanLabel.slice(0, 60),
        group: newSpecGroup,
        description: newSpecDesc.trim().slice(0, 200),
        sort_order: maxOrder + 10,
        is_active: true,
      },
    ]);
    setNewSpecLabel('');
    setNewSpecSlug('');
    setNewSpecDesc('');
  };

  const moveSpec = (idx: number, delta: -1 | 1) => {
    setSpecializations((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((item, i) => ({ ...item, sort_order: (i + 1) * 10 }));
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Global Prompts, Pillar Group Postures & Skill Rules */}
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
          <div>
            <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
              Global Companion Intelligence &amp; Guardrails
            </h3>
            <p className="text-xs text-[#5C5449] mt-0.5">
              Always-active realism baselines, posture guardrails, pillar group defaults, skill rules, and hub matcher instructions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCollapseAll}
              className="rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              className="rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              disabled={globalPromptsSaving || globalPromptsLoading}
              onClick={onSaveGlobalPrompts}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{globalPromptsSaving ? 'Saving...' : 'Save Global Intelligence'}</span>
            </button>
          </div>
        </div>

        {/* Search Bar for Global Settings & Prompts */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={globalFieldSearch}
            onChange={(e) => setGlobalFieldSearch(e.target.value)}
            placeholder="Search particular field, prompt, or setting in global intelligence..."
            className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-9 pr-4 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
          />
        </div>

        {globalPromptsLoading ? (
          <p className="text-xs text-[#8B8275] py-4">Loading global companion baselines...</p>
        ) : (
          <div className="space-y-6">
            {/* Scalar Prompt Controls */}
            <div className="grid grid-cols-1 gap-4">
              {GLOBAL_COMPANION_PROMPT_META.filter((meta) => matchesSearch(meta.label, meta.description)).map((meta) => {
                const fieldKey = `prompt_${meta.key}`;
                const isCollapsed = Boolean(collapsedFields[fieldKey]);
                const overrideVal = String(engineOverrides[meta.key as GlobalCompanionPromptKey] ?? '');
                const defaultVal = String(engineDefaults[meta.key as GlobalCompanionPromptKey] ?? '');
                const effectiveText = overrideVal || defaultVal;
                const isOverridden = Boolean(overrideVal.trim());
                return (
                  <div
                    key={meta.key}
                    className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                        onClick={() => toggleFieldCollapse(fieldKey)}
                      >
                        <button
                          type="button"
                          aria-label="Toggle field collapse"
                          className="p-1 rounded-lg text-[#5C5449] hover:bg-[#FDFBF7] shrink-0"
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#3D3830] truncate">
                              {meta.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#8B8275] shrink-0">
                              {isOverridden ? 'Custom Override' : 'Default'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B8275] mt-0.5 truncate">{meta.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => onResetGlobalPromptKey(meta.key)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-2.5 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reset</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleFieldCollapse(fieldKey)}
                          aria-label="Toggle collapse"
                          className="p-1 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <textarea
                        rows={4}
                        value={effectiveText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEngineOverrides((prev) => ({ ...prev, [meta.key]: val }));
                        }}
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Analytical Intelligence Foundations (Prep / Future Multi-Pass — Inactive in Single-Pass Runtime) */}
            <details className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4 py-3">
              <summary className="text-xs font-semibold text-[#3D3830] cursor-pointer select-none">
                Analytical Intelligence Foundations (Prep / Future Multi-Pass — Inactive in Single-Pass Runtime)
              </summary>
              <p className="text-[11px] text-[#8B8275] mt-2 mb-3">
                Future multi-pass analysis templates stored and exported safely in Global Intelligence. Not injected into live single-pass companion chats in Phase 1.
              </p>
              <div className="space-y-3">
                {GLOBAL_ANALYTICAL_PREP_PROMPT_META.map((meta) => {
                  const overrideVal = String(
                    engineOverrides[meta.key as GlobalAnalyticalPrepPromptKey] ?? ''
                  );
                  const defaultVal = String(
                    engineDefaults[meta.key as GlobalAnalyticalPrepPromptKey] ?? ''
                  );
                  const effectiveText = overrideVal || defaultVal;
                  const isOverridden = Boolean(overrideVal.trim());
                  return (
                    <div
                      key={meta.key}
                      className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#3D3830]">
                              {meta.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#8B8275]">
                              {isOverridden ? 'Authored' : 'Prep (Empty)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B8275] mt-0.5">{meta.description}</p>
                        </div>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => onResetGlobalPromptKey(meta.key)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1 text-[11px] text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={effectiveText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEngineOverrides((prev) => ({ ...prev, [meta.key]: val }));
                        }}
                        placeholder="Optional prep prompt template..."
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-2.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>
                  );
                })}
              </div>
            </details>

            {/* Pillar Group Defaults */}
            <div className="space-y-3 pt-3 border-t border-[#3D3830]/10">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-[#8B7355]" />
                <h4 className="text-xs font-semibold text-[#3D3830]">
                  Pillar Group Posture &amp; Output Defaults
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3.5">
                {ACTIVE_COMPANION_GROUP_OPTIONS.map((gMeta) => {
                  const gKey = gMeta.value;
                  const merged = {
                    group_system_prompt: defaultGroups[gKey]?.group_system_prompt || '',
                    default_advisory_mode: defaultGroups[gKey]?.default_advisory_mode || 'friend',
                    default_chart_access:
                      defaultGroups[gKey]?.default_chart_access || EMPTY_COMPANION_CHART_ACCESS,
                    default_chat_style: defaultGroups[gKey]?.default_chat_style || 'chat_bubbles',
                    default_max_output_tokens:
                      defaultGroups[gKey]?.default_max_output_tokens || 1200,
                    ...(overrideGroups[gKey] || {}),
                  };
                  return (
                    <div
                      key={gKey}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-[#3D3830]">{gMeta.label}</p>
                          <p className="text-[11px] text-[#8B8275]">{gMeta.description}</p>
                        </div>
                        <span className="font-mono text-[10px] text-[#8B8275]">{gKey}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#5C5449]">Default Advisory Mode</span>
                          <CustomSelect
                            value={merged.default_advisory_mode}
                            onChange={(val) =>
                              updateGroupConfig(gKey, {
                                default_advisory_mode: val as CompanionAdvisoryMode,
                              })
                            }
                            ariaLabel={`${gMeta.label} default advisory mode`}
                            surface="elevated"
                            size="sm"
                            options={COMPANION_ADVISORY_MODE_OPTIONS}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#5C5449]">Default Chat Style</span>
                          <CustomSelect
                            value={merged.default_chat_style}
                            onChange={(val) =>
                              updateGroupConfig(gKey, {
                                default_chat_style: val as ChatStyle,
                              })
                            }
                            ariaLabel={`${gMeta.label} default chat style`}
                            surface="elevated"
                            size="sm"
                            options={CHAT_STYLE_OPTIONS}
                          />
                        </div>
                        <label className="space-y-1">
                          <span className="text-[11px] text-[#5C5449]">
                            Default Max Output Tokens
                          </span>
                          <input
                            type="number"
                            min={300}
                            max={8000}
                            value={merged.default_max_output_tokens}
                            onChange={(e) =>
                              updateGroupConfig(gKey, {
                                default_max_output_tokens: Number(e.target.value) || 1200,
                              })
                            }
                            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 font-mono text-xs tabular-nums text-[#3D3830] focus:outline-none"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-[11px] text-[#5C5449]">
                          Group Posture Prompt
                        </span>
                        <textarea
                          rows={2}
                          value={merged.group_system_prompt}
                          onChange={(e) =>
                            updateGroupConfig(gKey, {
                              group_system_prompt: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-2.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:outline-none resize-y"
                        />
                      </label>
                    </div>
                  );
                })}

                {CONSULTANTS_ONLY_MODE && (
                  <details className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2]/70 px-4 py-3">
                    <summary className="text-xs font-semibold text-[#5C5449] cursor-pointer select-none">
                      Archived Non-Astrology Pillar Groups (
                      {
                        COMPANION_GROUP_OPTIONS.filter((g) => g.value !== 'spiritual_guides')
                          .length
                      }
                      ) — Preserved for Re-activation
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {COMPANION_GROUP_OPTIONS.filter(
                        (g) => g.value !== 'spiritual_guides'
                      ).map((gMeta) => {
                        const gKey = gMeta.value;
                        const merged = {
                          group_system_prompt: defaultGroups[gKey]?.group_system_prompt || '',
                          default_advisory_mode:
                            defaultGroups[gKey]?.default_advisory_mode || 'friend',
                          default_chart_access:
                            defaultGroups[gKey]?.default_chart_access ||
                            EMPTY_COMPANION_CHART_ACCESS,
                          default_chat_style:
                            defaultGroups[gKey]?.default_chat_style || 'chat_bubbles',
                          default_max_output_tokens:
                            defaultGroups[gKey]?.default_max_output_tokens || 1200,
                          ...(overrideGroups[gKey] || {}),
                        };
                        return (
                          <div
                            key={gKey}
                            className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-[#3D3830]">
                                  {gMeta.label}
                                </p>
                                <p className="text-[11px] text-[#8B8275]">{gMeta.description}</p>
                              </div>
                              <span className="font-mono text-[10px] text-[#8B8275]">{gKey}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <span className="text-[11px] text-[#5C5449]">
                                  Default Advisory Mode
                                </span>
                                <CustomSelect
                                  value={merged.default_advisory_mode}
                                  onChange={(val) =>
                                    updateGroupConfig(gKey, {
                                      default_advisory_mode: val as CompanionAdvisoryMode,
                                    })
                                  }
                                  ariaLabel={`${gMeta.label} default advisory mode`}
                                  surface="elevated"
                                  size="sm"
                                  options={COMPANION_ADVISORY_MODE_OPTIONS}
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[11px] text-[#5C5449]">
                                  Default Chat Style
                                </span>
                                <CustomSelect
                                  value={merged.default_chat_style}
                                  onChange={(val) =>
                                    updateGroupConfig(gKey, {
                                      default_chat_style: val as ChatStyle,
                                    })
                                  }
                                  ariaLabel={`${gMeta.label} default chat style`}
                                  surface="elevated"
                                  size="sm"
                                  options={CHAT_STYLE_OPTIONS}
                                />
                              </div>
                              <label className="space-y-1">
                                <span className="text-[11px] text-[#5C5449]">
                                  Default Max Output Tokens
                                </span>
                                <input
                                  type="number"
                                  min={300}
                                  max={8000}
                                  value={merged.default_max_output_tokens}
                                  onChange={(e) =>
                                    updateGroupConfig(gKey, {
                                      default_max_output_tokens: Number(e.target.value) || 1200,
                                    })
                                  }
                                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 font-mono text-xs tabular-nums text-[#3D3830] focus:outline-none"
                                />
                              </label>
                            </div>

                            <label className="block space-y-1">
                              <span className="text-[11px] text-[#5C5449]">
                                Group Posture Prompt
                              </span>
                              <textarea
                                rows={2}
                                value={merged.group_system_prompt}
                                onChange={(e) =>
                                  updateGroupConfig(gKey, {
                                    group_system_prompt: e.target.value,
                                  })
                                }
                                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-2.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:outline-none resize-y"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Skill Rules */}
            <details className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4 py-3">
              <summary className="text-xs font-semibold text-[#3D3830] cursor-pointer select-none">
                Per-Skill Modifiers ({SKILL_RULE_LABELS.length} Esoteric &amp; Emotional Channels)
              </summary>
              <div className="mt-4 space-y-3">
                {SKILL_RULE_LABELS.map((item) => {
                  const val =
                    overrideSkillRules[item.key] ?? defaultSkillRules[item.key] ?? '';
                  return (
                    <label key={item.key} className="block space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#3D3830]">
                          {item.label}
                        </span>
                        <span className="text-[11px] text-[#8B8275]">{item.hint}</span>
                      </div>
                      <textarea
                        rows={2}
                        value={val}
                        onChange={(e) => updateSkillRule(item.key, e.target.value)}
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-2.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:outline-none resize-y"
                      />
                    </label>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* 2. Specialization Taxonomy CRUD */}
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#3D3830]/10">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#8B7355]" />
              <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Specialization Taxonomy ({specializations.length})
              </h3>
            </div>
            <p className="text-xs text-[#5C5449] mt-0.5">
              Define the canonical specialization tags assigned to companions and surfaced across Hub filters.
            </p>
          </div>
          <button
            type="button"
            disabled={specializationsSaving}
            onClick={() => void onSaveSpecializations(specializations)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{specializationsSaving ? 'Saving...' : 'Save Taxonomy'}</span>
          </button>
        </div>

        {/* Add Specialization Inline Bar */}
        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <label className="sm:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">Label</span>
            <input
              type="text"
              value={newSpecLabel}
              onChange={(e) => setNewSpecLabel(e.target.value)}
              placeholder="e.g. Fertility & Motherhood"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs text-[#3D3830] focus:outline-none"
            />
          </label>
          <label className="sm:col-span-2 space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">Slug (Optional)</span>
            <input
              type="text"
              value={newSpecSlug}
              onChange={(e) => setNewSpecSlug(e.target.value)}
              placeholder="fertility_care"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 font-mono text-xs text-[#3D3830] focus:outline-none"
            />
          </label>
          <div className="sm:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">Group</span>
            <CustomSelect
              value={newSpecGroup}
              onChange={(v) => setNewSpecGroup(v as SpecializationGroupKey)}
              ariaLabel="New specialization group"
              surface="elevated"
              size="sm"
              options={ACTIVE_SPECIALIZATION_GROUP_OPTIONS}
            />
          </div>
          <label className="sm:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">Description</span>
            <input
              type="text"
              value={newSpecDesc}
              onChange={(e) => setNewSpecDesc(e.target.value)}
              placeholder="Short scope summary..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs text-[#3D3830] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleAddSpecialization}
            className="sm:col-span-1 inline-flex items-center justify-center gap-1 rounded-xl border border-[#3D3830]/18 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Taxonomy List */}
        {(() => {
          const isArchivedTag = (s: CompanionSpecializationTag) =>
            CONSULTANTS_ONLY_MODE &&
            (s.group === 'everyday_companions' || s.group === 'life_companions');
          const primarySpecs = specializations
            .map((spec, idx) => ({ spec, idx }))
            .filter(({ spec }) => !isArchivedTag(spec));
          const archivedSpecs = specializations
            .map((spec, idx) => ({ spec, idx }))
            .filter(({ spec }) => isArchivedTag(spec));

          const renderSpecRow = (spec: CompanionSpecializationTag, idx: number) => (
            <div
              key={spec.slug}
              className="flex flex-wrap items-center gap-2.5 bg-[#FDFBF7] px-3.5 py-2.5 hover:bg-[#FAF7F2]"
            >
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275] w-28 truncate">
                {spec.slug}
              </span>
              <input
                type="text"
                value={spec.label}
                onChange={(e) =>
                  setSpecializations((prev) =>
                    prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                  )
                }
                className="flex-1 min-w-[140px] rounded-lg border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1 text-xs font-medium text-[#3D3830] focus:outline-none"
              />
              <div className="w-44">
                <CustomSelect
                  value={spec.group}
                  onChange={(val) =>
                    setSpecializations((prev) =>
                      prev.map((s, i) =>
                        i === idx ? { ...s, group: val as SpecializationGroupKey } : s
                      )
                    )
                  }
                  ariaLabel={`Group for ${spec.label}`}
                  surface="canvas"
                  size="sm"
                  options={SPECIALIZATION_GROUP_OPTIONS}
                />
              </div>
              <input
                type="text"
                value={spec.description}
                onChange={(e) =>
                  setSpecializations((prev) =>
                    prev.map((s, i) =>
                      i === idx ? { ...s, description: e.target.value } : s
                    )
                  )
                }
                placeholder="Description..."
                className="flex-1 min-w-[180px] rounded-lg border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1 text-xs text-[#5C5449] focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setSpecializations((prev) =>
                    prev.map((s, i) =>
                      i === idx ? { ...s, is_active: !s.is_active } : s
                    )
                  )
                }
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium border cursor-pointer ${
                  spec.is_active
                    ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/10 text-[#2D6A4F]'
                    : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                }`}
              >
                {spec.is_active ? 'Active' : 'Disabled'}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveSpec(idx, -1)}
                  aria-label={`Move ${spec.label} up`}
                  className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === specializations.length - 1}
                  onClick={() => moveSpec(idx, 1)}
                  aria-label={`Move ${spec.label} down`}
                  className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                {specializations.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSpecializations((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={`Delete ${spec.label}`}
                    className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );

          return (
            <div className="space-y-3">
              <div className="divide-y divide-[#3D3830]/8 rounded-2xl border border-[#3D3830]/12 overflow-hidden">
                {primarySpecs.map(({ spec, idx }) => renderSpecRow(spec, idx))}
              </div>
              {archivedSpecs.length > 0 && (
                <details className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2]/70 px-4 py-3">
                  <summary className="text-xs font-semibold text-[#5C5449] cursor-pointer select-none">
                    Archived Companionship &amp; Life Area Tags ({archivedSpecs.length}) — Preserved for Re-activation
                  </summary>
                  <div className="mt-3 divide-y divide-[#3D3830]/8 rounded-2xl border border-[#3D3830]/12 overflow-hidden">
                    {archivedSpecs.map(({ spec, idx }) => renderSpecRow(spec, idx))}
                  </div>
                </details>
              )}
            </div>
          );
        })()}
      </div>

      {/* 3. Quick Companion Skill & Visibility Matrix */}
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
              value={statusFilter}
              onChange={onStatusFilterChange}
              ariaLabel="Filter matrix by status"
              surface="canvas"
              size="sm"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active Only' },
                { value: 'hidden', label: 'Hidden Only' },
                { value: 'draft_pending', label: 'Draft Pending' },
              ]}
            />
            <CustomSelect
              value={groupFilter}
              onChange={setGroupFilter}
              ariaLabel="Filter matrix by pillar group"
              surface="canvas"
              size="sm"
              options={[
                { value: 'all', label: 'All Pillars' },
                ...(showArchivedMatrixOptions
                  ? COMPANION_GROUP_OPTIONS
                  : ACTIVE_COMPANION_GROUP_OPTIONS
                ).map((g) => ({ value: g.value, label: g.label })),
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
                ...(showArchivedMatrixOptions
                  ? [{ value: 'human_only', label: 'Human Only' }]
                  : []),
                { value: 'esoteric', label: 'Chart / Esoteric Active' },
                ...(showArchivedMatrixOptions
                  ? SKILL_LEVEL_OPTIONS
                  : ACTIVE_SKILL_LEVEL_OPTIONS
                ).map((s) => ({ value: s.value, label: s.label })),
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
                        value={item.companion_group || 'everyday_companions'}
                        disabled={busy}
                        onChange={(val) =>
                          onQuickPatchCompanion(
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
                          onQuickPatchCompanion(
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
                          onQuickPatchCompanion(
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
                        onClick={() =>
                          onQuickPatchCompanion(
                            item,
                            { is_active: !item.is_active },
                            `${item.name} is now ${!item.is_active ? 'active in Chat' : 'hidden'}.`
                          )
                        }
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
                        onClick={() => onOpenCompanionInEditor(item)}
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
  );
};

export default GlobalIntelligencePanel;
