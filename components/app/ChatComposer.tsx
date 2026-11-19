import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Brain,
  ChevronDown,
  Lock,
  Mic,
  MicOff,
  Reply,
  Send,
  SlidersHorizontal,
  Square,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import type {
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  CustomPromptRecord,
} from './chatTypes';
import CustomSelect from './CustomSelect';

interface ChatComposerProps {
  draftText: string;
  onDraftChange: (text: string) => void;
  catalog: ChatCatalog | null;
  profiles: ChatProfile[];
  activeProfileId: string | null;
  useFullProfileMemory: boolean;
  expertSlug: string;
  modeSlug: string;
  outputSlug: string;
  languageSlug: string;
  replyTarget: ChatMessageRecord | null;
  activeFollowups: string[];
  customPrompts: CustomPromptRecord[];
  isStreaming: boolean;
  isThreadLocked?: boolean;
  isPreviewMode?: boolean;
  onChangeExpert: (slug: string) => void;
  onChangeMode: (slug: string) => void;
  onChangeOutput: (slug: string) => void;
  onChangeLanguage: (slug: string) => void;
  onSwitchProfile: (profileId: string | null) => void;
  onToggleMemory: () => void;
  onClearReply: () => void;
  onOpenMyPrompts: () => void;
  onOpenQuickTools: () => void;
  onSendMessage: (overrideText?: string) => void;
  onStopGeneration: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const ChatComposer: React.FC<ChatComposerProps> = ({
  draftText,
  onDraftChange,
  catalog,
  profiles,
  activeProfileId,
  useFullProfileMemory,
  expertSlug,
  modeSlug,
  outputSlug,
  languageSlug,
  replyTarget,
  activeFollowups,
  customPrompts,
  isStreaming,
  isThreadLocked = false,
  isPreviewMode = false,
  onChangeExpert,
  onChangeMode,
  onChangeOutput,
  onChangeLanguage,
  onSwitchProfile,
  onToggleMemory,
  onClearReply,
  onOpenMyPrompts,
  onOpenQuickTools,
  onSendMessage,
  onStopGeneration,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoiceInput = () => {
    setVoiceNotice(null);

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceNotice('Voice dictation is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = languageSlug === 'Hindi' ? 'hi-IN' : 'en-IN';

      recognition.onresult = (event) => {
        const lastIdx = event.results.length - 1;
        const transcript = event.results[lastIdx]?.[0]?.transcript?.trim();
        if (transcript) {
          const next = draftText.trim() ? `${draftText.trim()} ${transcript}` : transcript;
          onDraftChange(next);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setVoiceNotice('Microphone input ended or permission was denied.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setVoiceNotice('Unable to start microphone capture.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      if (isPreviewMode) {
        onSendMessage(draftText.trim() || 'preview');
        return;
      }

      const trimmed = draftText.trim();
      // Numeric follow-up shortcut: typing solely "1".."6" + Enter triggers that numbered follow-up
      if (/^[1-6]$/.test(trimmed) && activeFollowups.length > 0) {
        const idx = Number(trimmed) - 1;
        if (activeFollowups[idx]) {
          onDraftChange('');
          onSendMessage(activeFollowups[idx]);
          return;
        }
      }

      if (trimmed) {
        onSendMessage();
      }
    }
  };

  const activeExpertLabel =
    catalog?.experts.find((opt) => opt.slug === expertSlug)?.displayName ||
    'Vedic astrologer';
  const activeModeLabel =
    catalog?.modes.find((opt) => opt.slug === modeSlug)?.displayName || 'General';
  const activeOutputLabel =
    catalog?.outputs.find((opt) => opt.slug === outputSlug)?.displayName ||
    'Detailed';
  const activeProfileObj = profiles.find((p) => p.id === activeProfileId);
  const activeProfileLabel = activeProfileObj
    ? getProfileDisplayLabel(activeProfileObj)
    : 'General (No Chart)';

  return (
    <div className="border-t border-[#3D3830]/10 bg-[#FAF7F2]/95 px-3 sm:px-4 md:px-8 py-3 sm:py-4">
      <div className="mx-auto max-w-3xl min-w-0 space-y-2.5">
        {/* Quoted Reply Banner */}
        {replyTarget && (
          <div className="animate-cc-drawer-in flex items-start justify-between gap-3 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/12 px-4 py-2.5 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-[#3D3830]">
                <Reply className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Replying to specific Council insight</span>
              </div>
              <p className="mt-0.5 text-[#5C5449] line-clamp-2">{replyTarget.content}</p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="p-1 text-[#8B8275] hover:text-[#3D3830]"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Hidden-by-Default Collapsible Consultation Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsOptionsOpen((v) => !v)}
              aria-expanded={isOptionsOpen}
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-[11px] font-medium transition-all active:scale-[0.98] min-w-0 max-w-full ${
                isOptionsOpen
                  ? 'border-[#3D3830]/25 bg-[#F1ECE3] text-[#3D3830]'
                  : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:border-[#3D3830]/25 hover:text-[#3D3830]'
              }`}
            >
              <SlidersHorizontal className="h-3 w-3 shrink-0 text-[#8B7355]" />
              <span className="shrink-0">Options</span>
              <span className="hidden sm:inline truncate text-[#8B8275] font-normal">
                · {activeProfileLabel} · {activeExpertLabel} · {activeModeLabel} · {activeOutputLabel} · {languageSlug}
              </span>
              <ChevronDown
                className={`h-3 w-3 shrink-0 text-[#8B8275] transition-transform ${
                  isOptionsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isThreadLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#8B8275] shrink-0">
                <Lock className="h-3 w-3" />
                <span className="hidden sm:inline">Context locked</span>
              </span>
            )}
          </div>

          {isOptionsOpen && (
            <div className="animate-cc-drawer-in rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3 space-y-2.5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {isThreadLocked ? (
                  <>
                    <div
                      title="Locked once the thread begins"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/75 px-2.5 py-1.5 text-[#5C5449]"
                    >
                      <Lock className="h-3 w-3 text-[#8B8275]" />
                      <span className="font-medium text-[#3D3830]">{activeProfileLabel}</span>
                    </div>
                    <div
                      title="Locked once the thread begins"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/75 px-2.5 py-1.5 text-[#5C5449]"
                    >
                      <Lock className="h-3 w-3 text-[#8B8275]" />
                      <span className="font-medium text-[#3D3830]">{activeExpertLabel}</span>
                    </div>
                    <div
                      title="Locked once the thread begins"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/75 px-2.5 py-1.5 text-[#5C5449]"
                    >
                      <Lock className="h-3 w-3 text-[#8B8275]" />
                      <span className="font-medium text-[#3D3830]">{activeModeLabel}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <CustomSelect
                      value={activeProfileId || ''}
                      onChange={(val) => onSwitchProfile(val || null)}
                      ariaLabel="Select birth profile"
                      size="xs"
                      surface="elevated"
                      placement="top"
                      minMenuWidth={220}
                      className="max-w-[185px]"
                      icon={<UserCheck className="h-3 w-3 text-[#8B8275]" />}
                      options={[
                        { value: '', label: 'General (No Chart)' },
                        ...profiles.map((p) => ({
                          value: p.id,
                          label: getProfileDisplayLabel(p),
                        })),
                      ]}
                    />

                    <CustomSelect
                      value={expertSlug}
                      onChange={onChangeExpert}
                      ariaLabel="Select astrological expert"
                      placeholder="Astrologer"
                      size="xs"
                      surface="elevated"
                      placement="top"
                      minMenuWidth={210}
                      options={(catalog?.experts || []).map((opt) => ({
                        value: opt.slug,
                        label: opt.displayName,
                      }))}
                    />

                    <CustomSelect
                      value={modeSlug}
                      onChange={onChangeMode}
                      ariaLabel="Select area of life"
                      placeholder="Focus Area"
                      size="xs"
                      surface="elevated"
                      placement="top"
                      minMenuWidth={195}
                      options={(catalog?.modes || []).map((opt) => ({
                        value: opt.slug,
                        label: opt.displayName,
                      }))}
                    />
                  </>
                )}

                <CustomSelect
                  value={outputSlug}
                  onChange={onChangeOutput}
                  ariaLabel="Select output format"
                  placeholder="Output Style"
                  size="xs"
                  surface="elevated"
                  placement="top"
                  minMenuWidth={205}
                  options={(catalog?.outputs || []).map((opt) => ({
                    value: opt.slug,
                    label: opt.displayName,
                  }))}
                />

                <CustomSelect
                  value={languageSlug}
                  onChange={onChangeLanguage}
                  ariaLabel="Select consultation language"
                  placeholder="Language"
                  size="xs"
                  surface="elevated"
                  placement="top"
                  minMenuWidth={165}
                  options={(catalog?.languages || []).map((opt) => ({
                    value: opt.slug,
                    label: opt.displayName,
                  }))}
                />

                {activeProfileId && (
                  <button
                    type="button"
                    onClick={onToggleMemory}
                    title="Toggle longitudinal profile memory across threads"
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors ${
                      useFullProfileMemory
                        ? 'border-[#3D3830]/25 bg-[#F1ECE3] text-[#3D3830]'
                        : 'border-[#3D3830]/10 bg-[#FAF7F2] text-[#8B8275]'
                    }`}
                  >
                    <Brain className="h-3 w-3" />
                    <span>Memory: {useFullProfileMemory ? 'On' : 'Off'}</span>
                  </button>
                )}
              </div>

              {isThreadLocked && (
                <p className="text-[11px] text-[#8B8275]">
                  Profile, astrologer, and area of life are locked for this thread. Start a New Consultation to switch them, or adjust Output Style and Language above anytime.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Main Input Box */}
        <div className="rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 shadow-xs focus-within:border-[#3D3830]/35 transition-colors">
          <textarea
            rows={2}
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeFollowups.length > 0
                ? 'Ask a follow-up, or type 1–6 + Enter to pick a suggested question...'
                : 'Ask the Council about your chart, Dasha timing, career, relationships, or Jyotish mechanics...'
            }
            className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#3D3830]/8">
            {/* Left Utility Triggers: My Prompts, Quick Tools */}
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={onOpenMyPrompts}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] active:scale-[0.97] transition-all"
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0" />
                <span>My Prompts ({customPrompts.length}/10)</span>
              </button>

              <button
                type="button"
                onClick={onOpenQuickTools}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] active:scale-[0.97] transition-all"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0" />
                <span>Quick Tools</span>
              </button>
            </div>

            {/* Right Action Pair: Voice adjacent to Send / Stop */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs active:scale-[0.97] transition-all ${
                  isListening
                    ? 'bg-[#7A3E36] text-[#FAF7F2]'
                    : 'text-[#5C5449] bg-[#F1ECE3]/75 hover:bg-[#EAE3D7] hover:text-[#3D3830]'
                }`}
              >
                {isListening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                <span>{isListening ? 'Listening...' : 'Voice'}</span>
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#7A3E36] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#64322B] active:scale-[0.97] transition-all"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <span
                  className="relative group inline-flex"
                  title={isPreviewMode ? 'This is a preview, login to start chatting' : undefined}
                >
                  <button
                    type="button"
                    disabled={isPreviewMode || !draftText.trim()}
                    onClick={() => onSendMessage()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  {isPreviewMode && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[230px] rounded-xl bg-[#3D3830] px-3 py-1.5 text-[11px] font-medium text-[#FAF7F2] opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                    >
                      This is a preview, login to start chatting
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {isPreviewMode && (
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[#8B8275]">
            <span>This is a preview, login to start chatting.</span>
            <Link
              to="/app/login"
              className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#4A453D]"
            >
              Login
            </Link>
          </div>
        )}

        {voiceNotice && (
          <p className="text-[11px] text-[#7A3E36] px-1">{voiceNotice}</p>
        )}
      </div>
    </div>
  );
};

export default ChatComposer;
