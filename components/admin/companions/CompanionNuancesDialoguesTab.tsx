import React from 'react';
import { ArrowDown, ArrowUp, MessageSquareQuote, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import {
  DEFAULT_COMPANION_PERSONALITY_V2,
  normalizePersonalityV2,
  type CompanionContextualNuance,
  type CompanionFamiliarityCeiling,
  type CompanionFamiliarityMode,
  type CompanionGreetingMode,
  type CompanionPersonalityV2,
  type CompanionReferenceDialogue,
} from '../../../lib/companionV2Schema';
import {
  FAMILIARITY_CEILING_OPTIONS,
  FAMILIARITY_MODE_OPTIONS,
  GREETING_MODE_OPTIONS,
  type AdminCompanionRecord,
} from './companionStudioTypes';

interface CompanionNuancesDialoguesTabProps {
  draft: AdminCompanionRecord;
  setDraft: React.Dispatch<React.SetStateAction<AdminCompanionRecord | null>>;
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const CompanionNuancesDialoguesTab: React.FC<CompanionNuancesDialoguesTabProps> = ({
  draft,
  setDraft,
}) => {
  const v2 = normalizePersonalityV2(
    draft.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
  );

  const updateV2 = (
    updater: (prevV2: CompanionPersonalityV2) => CompanionPersonalityV2
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const baseV2 = normalizePersonalityV2(
        prev.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
      );
      return {
        ...prev,
        personality_v2_json: updater(baseV2),
      };
    });
  };

  // ---------------- Contextual Nuances Handlers ----------------
  const addNuance = () => {
    updateV2((prevV2) => ({
      ...prevV2,
      contextual_nuances: [
        ...prevV2.contextual_nuances,
        {
          id: makeId('nuance'),
          label: 'New Contextual Nuance',
          trigger_topics: [],
          trigger_moods: [],
          guidance: '',
          priority: Math.max(1, prevV2.contextual_nuances.length + 1),
        },
      ],
    }));
  };

  const updateNuance = (
    index: number,
    patch: Partial<CompanionContextualNuance>
  ) => {
    updateV2((prevV2) => ({
      ...prevV2,
      contextual_nuances: prevV2.contextual_nuances.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const moveNuance = (index: number, delta: -1 | 1) => {
    updateV2((prevV2) => {
      const next = [...prevV2.contextual_nuances];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prevV2;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prevV2, contextual_nuances: next };
    });
  };

  const removeNuance = (index: number) => {
    updateV2((prevV2) => ({
      ...prevV2,
      contextual_nuances: prevV2.contextual_nuances.filter((_, idx) => idx !== index),
    }));
  };

  // ---------------- Reference Dialogues Handlers ----------------
  const addDialogue = () => {
    updateV2((prevV2) => ({
      ...prevV2,
      reference_dialogues: [
        ...prevV2.reference_dialogues,
        {
          id: makeId('dlg'),
          scenario: '',
          user_prompt: '',
          companion_reply: '',
          context_note: '',
          tags: [],
        },
      ],
    }));
  };

  const updateDialogue = (
    index: number,
    patch: Partial<CompanionReferenceDialogue>
  ) => {
    updateV2((prevV2) => ({
      ...prevV2,
      reference_dialogues: prevV2.reference_dialogues.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const moveDialogue = (index: number, delta: -1 | 1) => {
    updateV2((prevV2) => {
      const next = [...prevV2.reference_dialogues];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prevV2;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prevV2, reference_dialogues: next };
    });
  };

  const removeDialogue = (index: number) => {
    updateV2((prevV2) => ({
      ...prevV2,
      reference_dialogues: prevV2.reference_dialogues.filter((_, idx) => idx !== index),
    }));
  };

  const greetingCfg = v2.greeting_config || {
    mode: 'generated_returning' as CompanionGreetingMode,
    allow_memory_callback: true,
    custom_return_instruction: '',
  };
  const familiarityPolicy = v2.familiarity_policy || {
    mode: 'warm_progressive' as CompanionFamiliarityMode,
    max_familiarity: 'close' as CompanionFamiliarityCeiling,
  };

  return (
    <div className="space-y-6">
      {/* Section 0: Greeting Behavior & Relational Familiarity Policy */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-[#8B7355]" />
            <span className="text-xs font-semibold text-[#3D3830]">
              Greeting Behavior &amp; Relational Familiarity Policy
            </span>
          </div>
          <p className="text-[11px] text-[#8B8275] mt-0.5">
            Controls how this character greets returning users and how warmth or relational distance evolves over repeated sessions (stored in V2 snapshot; live behavior updates in upcoming phases).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">Greeting Mode</span>
            <CustomSelect
              value={greetingCfg.mode}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  greeting_config: {
                    mode: val as CompanionGreetingMode,
                    allow_memory_callback:
                      prevV2.greeting_config?.allow_memory_callback !== false,
                    custom_return_instruction:
                      prevV2.greeting_config?.custom_return_instruction || '',
                  },
                }))
              }
              ariaLabel="Companion greeting mode"
              surface="elevated"
              className="w-full"
              options={GREETING_MODE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">
              {(
                GREETING_MODE_OPTIONS.find((o) => o.value === greetingCfg.mode) ||
                GREETING_MODE_OPTIONS[0]
              ).description}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#3D3830]">
                Allow Memory Callback in Return Greetings
              </p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                Permits gently referencing prior threads or life events when welcoming a returning member.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={greetingCfg.allow_memory_callback !== false}
              aria-label="Allow memory callback in return greetings"
              onClick={() =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  greeting_config: {
                    mode: prevV2.greeting_config?.mode || 'generated_returning',
                    allow_memory_callback:
                      prevV2.greeting_config?.allow_memory_callback === false,
                    custom_return_instruction:
                      prevV2.greeting_config?.custom_return_instruction || '',
                  },
                }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                greetingCfg.allow_memory_callback !== false
                  ? 'bg-[#4A453D]'
                  : 'bg-[#D6CEC0]'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                  greetingCfg.allow_memory_callback !== false
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Custom Return-Greeting Instruction (Optional)
          </span>
          <textarea
            rows={2}
            value={greetingCfg.custom_return_instruction || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({
                ...prevV2,
                greeting_config: {
                  mode: prevV2.greeting_config?.mode || 'generated_returning',
                  allow_memory_callback:
                    prevV2.greeting_config?.allow_memory_callback !== false,
                  custom_return_instruction: val,
                },
              }));
            }}
            placeholder="Specific phrasing cues, tone boundaries, or welcome rituals when returning..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Relational Familiarity Progression
            </span>
            <CustomSelect
              value={familiarityPolicy.mode}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  familiarity_policy: {
                    mode: val as CompanionFamiliarityMode,
                    max_familiarity:
                      prevV2.familiarity_policy?.max_familiarity || 'close',
                  },
                }))
              }
              ariaLabel="Familiarity progression mode"
              surface="elevated"
              className="w-full"
              options={FAMILIARITY_MODE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">
              {(
                FAMILIARITY_MODE_OPTIONS.find((o) => o.value === familiarityPolicy.mode) ||
                FAMILIARITY_MODE_OPTIONS[0]
              ).description}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Maximum Familiarity Ceiling
            </span>
            <CustomSelect
              value={familiarityPolicy.max_familiarity || 'close'}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  familiarity_policy: {
                    mode: prevV2.familiarity_policy?.mode || 'warm_progressive',
                    max_familiarity: val as CompanionFamiliarityCeiling,
                  },
                }))
              }
              ariaLabel="Maximum familiarity ceiling"
              surface="elevated"
              className="w-full"
              options={FAMILIARITY_CEILING_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">
              {(
                FAMILIARITY_CEILING_OPTIONS.find(
                  (o) => o.value === (familiarityPolicy.max_familiarity || 'close')
                ) || FAMILIARITY_CEILING_OPTIONS[0]
              ).description}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Contextual Nuances */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#8B7355]" />
              <span className="text-xs font-semibold text-[#3D3830]">
                Contextual Nuances ({v2.contextual_nuances.length}/24)
              </span>
            </div>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Injected dynamically ONLY when the active conversation matches trigger topics or emotional moods.
            </p>
          </div>
          <button
            type="button"
            disabled={v2.contextual_nuances.length >= 24}
            onClick={addNuance}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-45 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Nuance</span>
          </button>
        </div>

        {v2.contextual_nuances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#3D3830]/18 bg-[#FDFBF7] p-6 text-center text-xs text-[#8B8275]">
            No contextual nuances yet. Add situational guidance such as late-night spirals, breakup grief, or career burnout.
          </div>
        ) : (
          <div className="space-y-3">
            {v2.contextual_nuances.map((nuance, idx) => (
              <div
                key={nuance.id || idx}
                className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={nuance.label}
                      onChange={(e) => updateNuance(idx, { label: e.target.value })}
                      placeholder="Nuance label (e.g. Late-Night Spiral)"
                      className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="inline-flex items-center gap-1 text-[11px] text-[#8B8275] mr-1">
                      <span>Priority</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={nuance.priority}
                        onChange={(e) =>
                          updateNuance(idx, {
                            priority: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                          })
                        }
                        className="w-14 rounded-lg border border-[#3D3830]/15 bg-[#FAF7F2] px-2 py-1 font-mono text-[11px] tabular-nums text-[#3D3830] focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveNuance(idx, -1)}
                      aria-label={`Move nuance ${idx + 1} up`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === v2.contextual_nuances.length - 1}
                      onClick={() => moveNuance(idx, 1)}
                      aria-label={`Move nuance ${idx + 1} down`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNuance(idx)}
                      aria-label={`Delete nuance ${idx + 1}`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">
                      Trigger Topics (comma-separated)
                    </span>
                    <input
                      type="text"
                      value={(nuance.trigger_topics || []).join(', ')}
                      onChange={(e) =>
                        updateNuance(idx, {
                          trigger_topics: e.target.value
                            .split(',')
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="breakup, career, family, insomnia"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">
                      Trigger Moods (comma-separated)
                    </span>
                    <input
                      type="text"
                      value={(nuance.trigger_moods || []).join(', ')}
                      onChange={(e) =>
                        updateNuance(idx, {
                          trigger_moods: e.target.value
                            .split(',')
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="anxious, overwhelmed, numb, hopeful"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] text-[#5C5449]">Behavioral Guidance</span>
                  <textarea
                    rows={2}
                    value={nuance.guidance}
                    onChange={(e) => updateNuance(idx, { guidance: e.target.value })}
                    placeholder="Specific shifts in tone, pacing, questions, or restraint when these triggers appear..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Reference Dialogues */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="h-3.5 w-3.5 text-[#8B7355]" />
              <span className="text-xs font-semibold text-[#3D3830]">
                Reference Dialogues ({v2.reference_dialogues.length}/20)
              </span>
            </div>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Voice calibration exchanges — only top 2 matching examples are pulled at runtime to show rhythm without bloat.
            </p>
          </div>
          <button
            type="button"
            disabled={v2.reference_dialogues.length >= 20}
            onClick={addDialogue}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-45 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Dialogue</span>
          </button>
        </div>

        {v2.reference_dialogues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#3D3830]/18 bg-[#FDFBF7] p-6 text-center text-xs text-[#8B8275]">
            No reference dialogues authored yet. Add 2–4 concise user ↔ companion examples to anchor cadence and phrasing.
          </div>
        ) : (
          <div className="space-y-3">
            {v2.reference_dialogues.map((dlg, idx) => (
              <div
                key={dlg.id || idx}
                className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={dlg.scenario || ''}
                      onChange={(e) => updateDialogue(idx, { scenario: e.target.value })}
                      placeholder="Scenario label (e.g. Texting anxiety at 1am)"
                      className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveDialogue(idx, -1)}
                      aria-label={`Move dialogue ${idx + 1} up`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === v2.reference_dialogues.length - 1}
                      onClick={() => moveDialogue(idx, 1)}
                      aria-label={`Move dialogue ${idx + 1} down`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDialogue(idx)}
                      aria-label={`Delete dialogue ${idx + 1}`}
                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">User Prompt Example</span>
                    <textarea
                      rows={3}
                      value={dlg.user_prompt}
                      onChange={(e) => updateDialogue(idx, { user_prompt: e.target.value })}
                      placeholder="What the member says..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">
                      Companion Reply (Use [[BUBBLE]] for multi-bubble texting)
                    </span>
                    <textarea
                      rows={3}
                      value={dlg.companion_reply}
                      onChange={(e) => updateDialogue(idx, { companion_reply: e.target.value })}
                      placeholder="How this companion naturally responds..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">Tags (comma-separated)</span>
                    <input
                      type="text"
                      value={(dlg.tags || []).join(', ')}
                      onChange={(e) =>
                        updateDialogue(idx, {
                          tags: e.target.value
                            .split(',')
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="heartbreak, listen_only, late_night"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-[#5C5449]">Voice Note (Optional)</span>
                    <input
                      type="text"
                      value={dlg.context_note || ''}
                      onChange={(e) => updateDialogue(idx, { context_note: e.target.value })}
                      placeholder="Why this cadence lands..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanionNuancesDialoguesTab;
