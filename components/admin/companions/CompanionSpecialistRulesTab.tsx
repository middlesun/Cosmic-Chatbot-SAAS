import React, { useState } from 'react';
import { BookOpen, Shield } from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import {
  COMPANION_ADVISORY_MODE_OPTIONS,
  EMPTY_COMPANION_CHART_ACCESS,
  type CompanionAdvisoryMode,
  type CompanionChartAccess,
  type CompanionSkillLevel,
} from '../../app/chatTypes';
import {
  DEFAULT_COMPANION_PERSONALITY_V2,
  normalizePersonalityV2,
  type AiIdentityDisclosureMode,
  type AstrologyEntryRule,
  type CompanionAstrologicalMemoryMode,
  type CompanionPersonalityV2,
  type CompanionVerificationMode,
} from '../../../lib/companionV2Schema';
import {
  ACTIVE_SKILL_LEVEL_OPTIONS,
  AI_DISCLOSURE_OPTIONS,
  ASTROLOGICAL_MEMORY_MODE_OPTIONS,
  ASTROLOGY_ENTRY_RULE_OPTIONS,
  CHART_ACCESS_TOGGLES,
  SKILL_LEVEL_OPTIONS,
  VERIFICATION_MODE_OPTIONS,
  type AdminCompanionRecord,
  type FormulaCartridgeOption,
} from './companionStudioTypes';

interface CompanionSpecialistRulesTabProps {
  draft: AdminCompanionRecord;
  setDraft: React.Dispatch<React.SetStateAction<AdminCompanionRecord | null>>;
  formulaCartridges: FormulaCartridgeOption[];
}

const CompanionSpecialistRulesTab: React.FC<CompanionSpecialistRulesTabProps> = ({
  draft,
  setDraft,
  formulaCartridges,
}) => {
  const [cartridgeSearch, setCartridgeSearch] = useState('');

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

  const chartAccess: CompanionChartAccess = {
    ...EMPTY_COMPANION_CHART_ACCESS,
    ...(draft.chart_access || {}),
  };

  const selectedCartridges = Array.isArray(draft.formula_cartridge_slugs)
    ? draft.formula_cartridge_slugs
    : [];

  const toggleCartridge = (slug: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = Array.isArray(prev.formula_cartridge_slugs)
        ? prev.formula_cartridge_slugs
        : [];
      const exists = current.includes(slug);
      const next = exists
        ? current.filter((s) => s !== slug)
        : current.length < 24
        ? [...current, slug]
        : current;
      return { ...prev, formula_cartridge_slugs: next };
    });
  };

  const filteredCartridges = formulaCartridges.filter((fc) => {
    const q = cartridgeSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      fc.display_name.toLowerCase().includes(q) ||
      fc.slug.toLowerCase().includes(q) ||
      fc.subtitle.toLowerCase().includes(q) ||
      fc.system.toLowerCase().includes(q)
    );
  });

  const selectedSkillMeta =
    SKILL_LEVEL_OPTIONS.find((s) => s.value === (draft.skill_level || 'none_emotional')) ||
    SKILL_LEVEL_OPTIONS[0];
  const selectedAdvisoryMeta =
    COMPANION_ADVISORY_MODE_OPTIONS.find(
      (a) => a.value === (draft.advisory_mode || 'friend')
    ) || COMPANION_ADVISORY_MODE_OPTIONS[1];

  return (
    <div className="space-y-5">
      {/* Domain Expertise & Signature Methodology */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[#8B7355]" />
          <span className="text-xs font-semibold text-[#3D3830]">
            Domain Craft, Entry Rules &amp; AI Disclosure
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Specialist Expertise (Real-World / Jyotish / Relational Domain)
          </span>
          <textarea
            rows={3}
            value={v2.specialist_expertise}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, specialist_expertise: val }));
            }}
            placeholder="What specific human situations or traditional systems this companion handles with genuine mastery..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Signature Methodology (How They Unpack Problems)
          </span>
          <textarea
            rows={3}
            value={v2.signature_methodology}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, signature_methodology: val }));
            }}
            placeholder="Step-by-step conversational instinct (e.g., mirror tension -> name pattern -> 1 grounded shift)..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Astrology &amp; Esoteric Entry Rule
            </span>
            <CustomSelect
              value={v2.astrology_entry_rule}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  astrology_entry_rule: val as AstrologyEntryRule,
                }))
              }
              ariaLabel="Astrology entry rule"
              surface="elevated"
              className="w-full"
              options={ASTROLOGY_ENTRY_RULE_OPTIONS}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              AI Identity Disclosure Posture
            </span>
            <CustomSelect
              value={v2.ai_identity_disclosure}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  ai_identity_disclosure: val as AiIdentityDisclosureMode,
                }))
              }
              ariaLabel="AI identity disclosure"
              surface="elevated"
              className="w-full"
              options={AI_DISCLOSURE_OPTIONS}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">Advisory Mode</span>
            <CustomSelect
              value={draft.advisory_mode || 'friend'}
              onChange={(val) =>
                setDraft((prev) =>
                  prev ? { ...prev, advisory_mode: val as CompanionAdvisoryMode } : prev
                )
              }
              ariaLabel="Companion advisory mode"
              surface="elevated"
              className="w-full"
              options={COMPANION_ADVISORY_MODE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">{selectedAdvisoryMeta.description}</p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Legacy Skill Classification
            </span>
            <CustomSelect
              value={draft.skill_level}
              onChange={(val) =>
                setDraft((prev) =>
                  prev ? { ...prev, skill_level: val as CompanionSkillLevel } : prev
                )
              }
              ariaLabel="Companion skill level"
              surface="elevated"
              className="w-full"
              options={(() => {
                const base = ACTIVE_SKILL_LEVEL_OPTIONS;
                if (
                  draft.skill_level &&
                  !base.some((s) => s.value === draft.skill_level)
                ) {
                  const legacy = SKILL_LEVEL_OPTIONS.find(
                    (s) => s.value === draft.skill_level
                  );
                  if (legacy) return [...base, legacy];
                }
                return base;
              })()}
            />
            <p className="text-[11px] text-[#8B8275]">{selectedSkillMeta.description}</p>
          </div>
        </div>
      </div>

      {/* Analytical Investigation, Verification & Memory Isolation */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-[#8B7355]" />
            <span className="text-xs font-semibold text-[#3D3830]">
              Analytical Investigation, Verification &amp; Memory Isolation
            </span>
          </div>
          <p className="text-[11px] text-[#8B8275] mt-0.5">
            Authors this character&apos;s chart-inspection instincts, epistemic verification discipline, and case-memory boundary (stored in V2 snapshot; runtime enforcement wires in subsequent phases).
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Analytical Investigation Strategy
          </span>
          <textarea
            rows={3}
            value={v2.investigation_strategy || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, investigation_strategy: val }));
            }}
            placeholder="Which placements, houses, Dashas, Nakshatras, aspects, or transits this practitioner checks first before forming a reading..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Epistemic Refinement &amp; Contradiction Testing (Not Stylistic Polishing)
          </span>
          <textarea
            rows={3}
            value={v2.refinement_philosophy || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, refinement_philosophy: val }));
            }}
            placeholder="How this character stress-tests hypotheses for conflicting chart signals, avoids forced certainty, and separates confirmed indicators from speculation..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">Verification Mode</span>
            <CustomSelect
              value={v2.verification_mode || 'neutral'}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  verification_mode: val as CompanionVerificationMode,
                }))
              }
              ariaLabel="Companion verification mode"
              surface="elevated"
              className="w-full"
              options={VERIFICATION_MODE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">
              {(
                VERIFICATION_MODE_OPTIONS.find(
                  (o) => o.value === (v2.verification_mode || 'neutral')
                ) || VERIFICATION_MODE_OPTIONS[0]
              ).description}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Astrological Memory Mode
            </span>
            <CustomSelect
              value={v2.astrological_memory_mode || 'independent'}
              onChange={(val) =>
                updateV2((prevV2) => ({
                  ...prevV2,
                  astrological_memory_mode: val as CompanionAstrologicalMemoryMode,
                }))
              }
              ariaLabel="Companion astrological memory mode"
              surface="elevated"
              className="w-full"
              options={ASTROLOGICAL_MEMORY_MODE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">
              {(
                ASTROLOGICAL_MEMORY_MODE_OPTIONS.find(
                  (o) => o.value === (v2.astrological_memory_mode || 'independent')
                ) || ASTROLOGICAL_MEMORY_MODE_OPTIONS[0]
              ).description}
            </p>
          </div>
        </div>
      </div>

      {/* Granular Chart Access 6 Toggles */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
        <div>
          <span className="text-xs font-semibold text-[#3D3830]">
            Granular Chart &amp; Context Data Access (6 Context Channels)
          </span>
          <p className="text-[11px] text-[#8B8275] mt-0.5">
            Controls which deterministic ephemeris / reading payloads are unlocked for this companion at runtime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {CHART_ACCESS_TOGGLES.map((item) => {
            const enabled = Boolean(chartAccess[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#3D3830]">{item.label}</p>
                  <p className="text-[11px] text-[#8B8275] truncate">{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={item.label}
                  onClick={() =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            chart_access: {
                              ...EMPTY_COMPANION_CHART_ACCESS,
                              ...(prev.chart_access || {}),
                              [item.key]: !enabled,
                            },
                          }
                        : prev
                    )
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                      enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formula Cartridges Multi-Select */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#3D3830]">
              Formula Cartridges ({selectedCartridges.length}/24)
            </span>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Optional specialized Vedic / Western astrology formula cartridges injected only when chart access applies.
            </p>
          </div>
          <input
            type="text"
            value={cartridgeSearch}
            onChange={(e) => setCartridgeSearch(e.target.value)}
            placeholder="Filter cartridges..."
            className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
          />
        </div>

        <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
          {filteredCartridges.map((fc) => {
            const active = selectedCartridges.includes(fc.slug);
            return (
              <button
                key={fc.slug}
                type="button"
                onClick={() => toggleCartridge(fc.slug)}
                className={`text-left rounded-xl border px-3 py-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                    : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#3D3830] hover:border-[#3D3830]/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{fc.display_name}</span>
                  <span
                    className={`font-mono text-[10px] uppercase shrink-0 ${
                      active ? 'text-[#EAE3D7]' : 'text-[#8B8275]'
                    }`}
                  >
                    {fc.system}
                  </span>
                </div>
                <p
                  className={`text-[10px] truncate mt-0.5 ${
                    active ? 'text-[#EAE3D7]' : 'text-[#8B8275]'
                  }`}
                >
                  {fc.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guardrails, Rule Precedence & Visibility */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-[#8B7355]" />
          <span className="text-xs font-semibold text-[#3D3830]">
            Esoteric Guardrails, Rule Inheritance &amp; Hub Visibility
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            V2 Esoteric / Boundary Guardrails
          </span>
          <textarea
            rows={3}
            value={v2.esoteric_guardrails}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, esoteric_guardrails: val }));
            }}
            placeholder="Non-fatalism, no medical/legal advice, no fabricated placements..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Layer 1: Hard Rules (Strict Companion Guardrails)
          </span>
          <textarea
            rows={4}
            value={draft.hard_rules}
            onChange={(e) =>
              setDraft((prev) => (prev ? { ...prev, hard_rules: e.target.value } : prev))
            }
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Layer 2: Soft Rules (Default Conversational Instincts)
          </span>
          <textarea
            rows={3}
            value={draft.soft_rules}
            onChange={(e) =>
              setDraft((prev) => (prev ? { ...prev, soft_rules: e.target.value } : prev))
            }
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <div className="divide-y divide-[#3D3830]/10 rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3.5">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[#3D3830]">
                Override Pillar Group Rules
              </p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                When ON, skips inherited pillar group posture instructions so this companion runs purely on individual configuration.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(draft.override_group_rules)}
              aria-label="Override pillar group rules"
              onClick={() =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, override_group_rules: !prev.override_group_rules }
                    : prev
                )
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                draft.override_group_rules ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                  draft.override_group_rules ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[#3D3830]">
                Override Global Companion Rules
              </p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                When ON, this companion&apos;s own Hard &amp; Soft Rules take precedence over Global Constitution Layer 1.
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
                    ? { ...prev, override_global_rules: !prev.override_global_rules }
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

          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[#3D3830]">Active in Companion Hub</p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                Hidden companions stay preserved for existing threads without appearing in public matching.
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
    </div>
  );
};

export default CompanionSpecialistRulesTab;
