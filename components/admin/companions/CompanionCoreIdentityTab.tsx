import React, { useState } from 'react';
import { Lock, RefreshCw, Sparkles, Unlock } from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import type { CompanionAutonomyLevel } from '../../app/chatTypes';
import {
  DEFAULT_COMPANION_PERSONALITY_V2,
  estimateTokensRough,
  normalizePersonalityV2,
  type CompanionPersonalityV2,
} from '../../../lib/companionV2Schema';
import {
  AUTONOMY_OPTIONS,
  approxTokens,
  type AdminCompanionRecord,
} from './companionStudioTypes';

interface CompanionCoreIdentityTabProps {
  draft: AdminCompanionRecord;
  setDraft: React.Dispatch<React.SetStateAction<AdminCompanionRecord | null>>;
  isCreating: boolean;
  unlockOverride: boolean;
  setUnlockOverride: React.Dispatch<React.SetStateAction<boolean>>;
  getAccessToken: () => Promise<string | null>;
  onFeedback: (msg: string) => void;
  onError: (msg: string) => void;
}

const CompanionCoreIdentityTab: React.FC<CompanionCoreIdentityTabProps> = ({
  draft,
  setDraft,
  isCreating,
  unlockOverride,
  setUnlockOverride,
  getAccessToken,
  onFeedback,
  onError,
}) => {
  const [compilingMode, setCompilingMode] = useState<'none' | 'deterministic' | 'ai'>('none');

  const v2 = normalizePersonalityV2(
    draft.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
  );
  const coreLocked = draft.core_identity_locked !== false;

  const updateV2 = (
    updater: (prevV2: CompanionPersonalityV2) => CompanionPersonalityV2
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const baseV2 = normalizePersonalityV2(
        prev.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
      );
      const nextV2 = updater(baseV2);
      nextV2.capsule_token_estimate = estimateTokensRough(nextV2.core_identity_capsule);
      return {
        ...prev,
        personality_v2_json: nextV2,
      };
    });
  };

  const capsuleTokens = estimateTokensRough(v2.core_identity_capsule);
  const capsuleOutsideSweetSpot =
    capsuleTokens > 0 && (capsuleTokens < 500 || capsuleTokens > 700);

  const valuesText = v2.inner_compass.values.join('\n');
  const anchorsText = v2.inner_compass.core_anchors.join('\n');

  const handleCompileCapsule = async (useAi: boolean) => {
    setCompilingMode(useAi ? 'ai' : 'deterministic');
    onError('');
    try {
      const token = await getAccessToken();
      const targetSlug = isCreating ? '__new__' : draft.slug || draft.id;
      const res = await fetch(
        `/api/admin/companions/${encodeURIComponent(targetSlug)}/capsule/compile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ draft, useAi }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile core identity capsule');
      if (typeof data.capsule === 'string') {
        updateV2((prevV2) => ({
          ...prevV2,
          core_identity_capsule: data.capsule,
          capsule_token_estimate: data.tokenEstimate ?? estimateTokensRough(data.capsule),
        }));
        onFeedback(
          data.source === 'ai_synthesized'
            ? `Refined Core Identity Capsule via ${data.modelUsed || 'utility AI'} (~${data.tokenEstimate} tokens). Review & save draft to stage.`
            : `Built deterministic Core Identity Capsule (~${data.tokenEstimate} tokens). Review & save draft to stage.`
        );
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to compile capsule');
    } finally {
      setCompilingMode('none');
    }
  };

  const selectedAutonomyMeta =
    AUTONOMY_OPTIONS.find((a) => a.value === (draft.autonomy_level || 'intuitive')) ||
    AUTONOMY_OPTIONS[1];

  return (
    <div className="space-y-5">
      {/* Core Identity Protection Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          coreLocked && !unlockOverride
            ? 'border-[#B8965A]/40 bg-[#B8965A]/10'
            : 'border-[#3D3830]/15 bg-[#FAF7F2]'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {coreLocked && !unlockOverride ? (
            <Lock className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          ) : (
            <Unlock className="h-4 w-4 text-[#2D6A4F] shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#3D3830]">
              Core Identity Protection{' '}
              <span className="font-mono text-[11px] font-normal text-[#8B8275]">
                · {coreLocked ? 'Locked by Default' : 'Unlocked on Companion'}
              </span>
            </p>
            <p className="text-[11px] text-[#5C5449] mt-0.5">
              Protects canonical essence, fictional lore, inner compass, linguistic fingerprint, backstory, and sex from accidental overwrites. Non-core tweaks (tags, model, voice cadence, active toggle) always save freely.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {coreLocked && (
            <button
              type="button"
              onClick={() => setUnlockOverride((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                unlockOverride
                  ? 'border-[#2D6A4F]/35 bg-[#2D6A4F]/12 text-[#2D6A4F]'
                  : 'border-[#B8965A]/45 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
              }`}
            >
              {unlockOverride ? 'One-Time Unlock Active' : 'Unlock Core for Edit'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const nextLocked = !coreLocked;
              if (!nextLocked) setUnlockOverride(true);
              setDraft((prev) => {
                if (!prev) return prev;
                const nextV2 = normalizePersonalityV2(
                  prev.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
                );
                nextV2.core_identity_locked = nextLocked;
                return {
                  ...prev,
                  core_identity_locked: nextLocked,
                  personality_v2_json: nextV2,
                };
              });
            }}
            className="rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer whitespace-nowrap"
          >
            {coreLocked ? 'Disable Lock Flag' : 'Re-Lock Core Identity'}
          </button>
        </div>
      </div>

      {/* Live Core Identity Capsule Editor (~500–700 Token Gauge) */}
      <div className="rounded-2xl border border-[#3D3830]/14 bg-[#FAF7F2] p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#3D3830]">
                Core Identity Capsule (Always-Injected Runtime Layer)
              </span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  capsuleOutsideSweetSpot ? 'text-[#8B7355]' : 'text-[#2D6A4F]'
                }`}
              >
                ~{capsuleTokens} tokens · {v2.core_identity_capsule.length} chars (sweet spot 500–700 tokens)
              </span>
            </div>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Synthesized voice identity injected every turn for lean token efficiency while preserving nuance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={compilingMode !== 'none'}
              onClick={() => void handleCompileCapsule(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  compilingMode === 'deterministic' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {compilingMode === 'deterministic' ? 'Building...' : 'Build From Fields'}
              </span>
            </button>
            <button
              type="button"
              disabled={compilingMode !== 'none'}
              onClick={() => void handleCompileCapsule(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3 w-3" />
              <span>
                {compilingMode === 'ai' ? 'Refining...' : 'AI Refine Capsule'}
              </span>
            </button>
          </div>
        </div>

        {/* Soft Amber Informational Notice (never blocks save) */}
        {capsuleOutsideSweetSpot && (
          <div className="rounded-xl border border-[#B8965A]/40 bg-[#B8965A]/10 px-3 py-2 text-[11px] text-[#5C5449]">
            Informational note: Capsule is currently ~{capsuleTokens} tokens (recommended soft target is ~500–700 tokens for optimal prompt density &amp; recall). You can still save or publish anytime.
          </div>
        )}

        <textarea
          rows={8}
          value={v2.core_identity_capsule}
          onChange={(e) => {
            const val = e.target.value;
            updateV2((prevV2) => ({ ...prevV2, core_identity_capsule: val }));
          }}
          placeholder="Click 'Build From Fields' or write the 500–700 token core voice capsule directly..."
          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none resize-y"
        />
      </div>

      {/* Character Essence & Fictional Lore (Protected) */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3D3830]">
              Character Essence
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
              {v2.character_essence.length} chars
            </span>
          </div>
          <textarea
            rows={3}
            value={v2.character_essence}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, character_essence: val }));
            }}
            placeholder="Who this person fundamentally is in two vivid sentences..."
            className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3D3830]">
              Fictional Lore &amp; Formative Roots
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
              {v2.fictional_lore.length} chars
            </span>
          </div>
          <textarea
            rows={4}
            value={v2.fictional_lore}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, fictional_lore: val }));
            }}
            placeholder="City/neighborhood roots, career turning points, lived texture, sensory memories..."
            className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </div>
      </div>

      {/* Inner Compass (Worldview, Values, Core Anchors) */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3.5">
        <div>
          <span className="text-xs font-semibold text-[#3D3830]">
            Inner Compass (Worldview, Values &amp; Core Anchors)
          </span>
          <p className="text-[11px] text-[#8B8275] mt-0.5">
            Defines moral gravity and emotional stillness across difficult conversations.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[#5C5449]">Worldview</span>
          <textarea
            rows={2}
            value={v2.inner_compass.worldview}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({
                ...prevV2,
                inner_compass: { ...prevV2.inner_compass, worldview: val },
              }));
            }}
            placeholder="How they fundamentally view suffering, change, agency, and human tenderness..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">
              Living Values (one per line, max 12)
            </span>
            <textarea
              rows={4}
              value={valuesText}
              onChange={(e) => {
                const items = e.target.value.split('\n').map((s) => s.trimEnd());
                updateV2((prevV2) => ({
                  ...prevV2,
                  inner_compass: {
                    ...prevV2.inner_compass,
                    values: items.filter((s, idx) => Boolean(s.trim()) || idx === items.length - 1),
                  },
                }));
              }}
              onBlur={() => {
                updateV2((prevV2) => ({
                  ...prevV2,
                  inner_compass: {
                    ...prevV2.inner_compass,
                    values: prevV2.inner_compass.values
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  },
                }));
              }}
              placeholder={'Loyalty without enabling\nCuriosity before judgment'}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-[#5C5449]">
              Core Anchors (one per line, max 12)
            </span>
            <textarea
              rows={4}
              value={anchorsText}
              onChange={(e) => {
                const items = e.target.value.split('\n').map((s) => s.trimEnd());
                updateV2((prevV2) => ({
                  ...prevV2,
                  inner_compass: {
                    ...prevV2.inner_compass,
                    core_anchors: items.filter(
                      (s, idx) => Boolean(s.trim()) || idx === items.length - 1
                    ),
                  },
                }));
              }}
              onBlur={() => {
                updateV2((prevV2) => ({
                  ...prevV2,
                  inner_compass: {
                    ...prevV2.inner_compass,
                    core_anchors: prevV2.inner_compass.core_anchors
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  },
                }));
              }}
              placeholder={'Ask what hurts before fixing\nHonor the user’s pace'}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />
          </label>
        </div>
      </div>

      {/* Rich Psychological & Voice Nuances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Expression Spectrum</span>
          <textarea
            rows={3}
            value={v2.expression_spectrum}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, expression_spectrum: val }));
            }}
            placeholder="Shift between playful warmth, sober candor, and tender steadiness..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Subtle Contradictions</span>
          <textarea
            rows={3}
            value={v2.subtle_contradictions}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, subtle_contradictions: val }));
            }}
            placeholder="Human tensions that keep them real (e.g., hyper-organized calendar yet sentimental late at night)..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Humor &amp; Everyday Interests</span>
          <textarea
            rows={3}
            value={v2.humour_and_interests}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, humour_and_interests: val }));
            }}
            placeholder="Dry observational wit, late-night masala chai, indie cinema, long walks..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Quirks &amp; Conversational Habits</span>
          <textarea
            rows={3}
            value={v2.quirks_and_habits}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, quirks_and_habits: val }));
            }}
            placeholder="Short opening check-ins, noticing small phrasing details, never rushing big feelings..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-[#3D3830]">
            Linguistic Fingerprint (Sentence Rhythm, Phrasing &amp; Restraint)
          </span>
          <textarea
            rows={3}
            value={v2.linguistic_fingerprint}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, linguistic_fingerprint: val }));
            }}
            placeholder="How they punctuate, split chat bubbles, use colloquial phrases naturally without overdoing slang..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Interpersonal Dynamics</span>
          <textarea
            rows={3}
            value={v2.interpersonal_dynamics}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, interpersonal_dynamics: val }));
            }}
            placeholder="How they bond over weeks, disagree kindly, and respect boundaries..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">Soft Instincts (V2)</span>
          <textarea
            rows={3}
            value={v2.soft_instincts}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, soft_instincts: val }));
            }}
            placeholder="Adapt pacing when user gives 1-word replies vs long late-night vent messages..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>
      </div>

      {/* Autonomy & Behavioral Pace Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#3D3830]/10">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">
            Autonomy / Instinct Freedom
          </span>
          <CustomSelect
            value={draft.autonomy_level}
            onChange={(val) =>
              setDraft((prev) =>
                prev ? { ...prev, autonomy_level: val as CompanionAutonomyLevel } : prev
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
          <p className="text-[11px] text-[#8B8275]">{selectedAutonomyMeta.description}</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#3D3830]">
            Autonomy Guidance Note
          </span>
          <textarea
            rows={2}
            value={v2.autonomy_guidance}
            onChange={(e) => {
              const val = e.target.value;
              updateV2((prevV2) => ({ ...prevV2, autonomy_guidance: val }));
            }}
            placeholder="When they may break habit cleanly to match human urgency..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
        </label>
      </div>

      {/* UX Interaction Toggles */}
      <div className="divide-y divide-[#3D3830]/10 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4">
        <div className="flex items-center justify-between gap-4 py-3">
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
                  ? { ...prev, supports_listening_cue: !prev.supports_listening_cue }
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

        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-xs font-semibold text-[#3D3830]">
              Follow-up Conversation Suggestions
            </p>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Generates gentle follow-up prompts to keep quiet or hesitant chats flowing.
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
                  ? { ...prev, suggestions_enabled: !prev.suggestions_enabled }
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
      </div>

      {/* Legacy Reference Textareas (kept accessible for parity) */}
      <details className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-4 py-3">
        <summary className="text-xs font-semibold text-[#3D3830] cursor-pointer select-none">
          Legacy Reference Blobs (Back Story, Soul &amp; Consciousness, Core System Prompt)
        </summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5C5449]">
                Back Story (Private Lived History)
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                {(draft.backstory || '').length} chars · ~{approxTokens(draft.backstory || '')} tokens
              </span>
            </div>
            <textarea
              rows={3}
              value={draft.backstory || ''}
              onChange={(e) =>
                setDraft((prev) => (prev ? { ...prev, backstory: e.target.value } : prev))
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5C5449]">
                Soul &amp; Consciousness
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                {(draft.soul_consciousness || '').length} chars · ~
                {approxTokens(draft.soul_consciousness || '')} tokens
              </span>
            </div>
            <textarea
              rows={3}
              value={draft.soul_consciousness || ''}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, soul_consciousness: e.target.value } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#5C5449]">
                Core System Prompt (Fallback / Legacy Persona Prompt)
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                {draft.system_prompt.length} chars · ~{approxTokens(draft.system_prompt)} tokens
              </span>
            </div>
            <textarea
              rows={7}
              value={draft.system_prompt}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, system_prompt: e.target.value } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />
          </div>
        </div>
      </details>
    </div>
  );
};

export default CompanionCoreIdentityTab;
