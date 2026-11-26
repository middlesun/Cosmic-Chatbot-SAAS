import React from 'react';
import { MessageSquare, Volume2 } from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import { CHAT_STYLE_OPTIONS, type ChatStyle } from '../../app/chatTypes';
import type { ModelChoiceOption } from '../PromptLibraryManager';
import type { AdminCompanionRecord } from './companionStudioTypes';

interface CompanionChatAiSettingsTabProps {
  draft: AdminCompanionRecord;
  setDraft: React.Dispatch<React.SetStateAction<AdminCompanionRecord | null>>;
  modelOptions: ModelChoiceOption[];
}

const CompanionChatAiSettingsTab: React.FC<CompanionChatAiSettingsTabProps> = ({
  draft,
  setDraft,
  modelOptions,
}) => {
  const selectedChatStyleMeta =
    CHAT_STYLE_OPTIONS.find((s) => s.value === (draft.chat_style || 'chat_bubbles')) ||
    CHAT_STYLE_OPTIONS[2];

  return (
    <div className="space-y-5">
      {/* Chat Render Style, Model, Token Ceiling & Priority */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-[#8B7355]" />
          <span className="text-xs font-semibold text-[#3D3830]">
            Chat Presentation, AI Model &amp; Priority
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#3D3830]">Chat Render Style</span>
            <CustomSelect
              value={draft.chat_style}
              onChange={(val) =>
                setDraft((prev) =>
                  prev ? { ...prev, chat_style: val as ChatStyle } : prev
                )
              }
              ariaLabel="Companion chat render style"
              surface="elevated"
              className="w-full"
              options={CHAT_STYLE_OPTIONS}
            />
            <p className="text-[11px] text-[#8B8275]">{selectedChatStyleMeta.description}</p>
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
              surface="elevated"
              className="w-full"
              options={modelOptions}
            />
            <p className="text-[11px] text-[#8B8275]">
              Leave on Platform Default or pin a dedicated conversational model.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#3D3830]">
              Max Output Tokens Override
            </span>
            <input
              type="number"
              min={300}
              max={16000}
              value={draft.max_output_tokens ?? ''}
              placeholder="Group default"
              onChange={(e) => {
                const raw = e.target.value.trim();
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        max_output_tokens: raw === '' ? null : Number(raw) || 1200,
                      }
                    : prev
                );
              }}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
            <p className="text-[11px] text-[#8B8275]">
              Leave blank to inherit Pillar Group default (range 300–16000).
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#3D3830]">
              Temperature Override
            </span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={draft.temperature ?? ''}
              placeholder="0.45 (platform default)"
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  setDraft((prev) => (prev ? { ...prev, temperature: null } : prev));
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return;
                const clamped = Math.min(2, Math.max(0, Math.round(parsed * 100) / 100));
                setDraft((prev) => (prev ? { ...prev, temperature: clamped } : prev));
              }}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
            <p className="text-[11px] text-[#8B8275]">
              Leave blank for platform default (0.45). Range 0.00–2.00. Stored in Phase 1; runtime temperature wiring arrives in a later phase.
            </p>
          </label>

          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold text-[#3D3830]">Sort Order Priority</span>
            <input
              type="number"
              min={0}
              max={99999}
              value={draft.sort_order}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, sort_order: Number(e.target.value) || 0 } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
            <p className="text-[11px] text-[#8B8275]">
              Lower numbers appear earlier in the Companion Hub.
            </p>
          </label>
        </div>
      </div>

      {/* TTS Voice Profile */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-[#8B7355]" />
          <span className="text-xs font-semibold text-[#3D3830]">
            Read-Aloud TTS Voice Cadence
          </span>
        </div>
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
    </div>
  );
};

export default CompanionChatAiSettingsTab;
