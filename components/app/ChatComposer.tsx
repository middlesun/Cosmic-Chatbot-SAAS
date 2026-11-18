import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Brain,
  Mic,
  MicOff,
  Reply,
  Send,
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

  return (
    <div className="border-t border-[#3D3830]/10 bg-[#FAF7F2]/95 px-4 md:px-8 py-4">
      <div className="mx-auto max-w-3xl space-y-3">
        {/* Quoted Reply Banner */}
        {replyTarget && (
          <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/12 px-4 py-2.5 text-xs">
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

        {/* Mid-Chat Discipline, Mode, Output, Language, Profile & Memory Controls */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <select
            value={expertSlug}
            onChange={(e) => onChangeExpert(e.target.value)}
            aria-label="Select astrological expert"
            className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
          >
            {(catalog?.experts || []).map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.displayName}
              </option>
            ))}
          </select>

          <select
            value={modeSlug}
            onChange={(e) => onChangeMode(e.target.value)}
            aria-label="Select consultation mode"
            className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
          >
            {(catalog?.modes || []).map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.displayName}
              </option>
            ))}
          </select>

          <select
            value={outputSlug}
            onChange={(e) => onChangeOutput(e.target.value)}
            aria-label="Select output format"
            className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
          >
            {(catalog?.outputs || []).map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.displayName}
              </option>
            ))}
          </select>

          <select
            value={languageSlug}
            onChange={(e) => onChangeLanguage(e.target.value)}
            aria-label="Select consultation language"
            className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
          >
            {(catalog?.languages || []).map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.displayName}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2 py-1">
            <UserCheck className="h-3 w-3 text-[#8B8275]" />
            <select
              value={activeProfileId || ''}
              onChange={(e) => onSwitchProfile(e.target.value || null)}
              aria-label="Attach or switch birth profile"
              className="bg-transparent text-[#3D3830] focus:outline-none max-w-[140px]"
            >
              <option value="">General (No Chart)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {activeProfileId && (
            <button
              type="button"
              onClick={onToggleMemory}
              title="Toggle longitudinal profile memory across threads"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors ${
                useFullProfileMemory
                  ? 'border-[#3D3830]/25 bg-[#F1ECE3] text-[#3D3830]'
                  : 'border-[#3D3830]/10 bg-[#FDFBF7] text-[#8B8275]'
              }`}
            >
              <Brain className="h-3 w-3" />
              <span>Memory: {useFullProfileMemory ? 'On' : 'Off'}</span>
            </button>
          )}
        </div>

        {/* Main Input Box */}
        <div className="rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 shadow-xs focus-within:border-[#3D3830]/35">
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
            {/* Utility Triggers: My Prompts, Quick Tools, Voice Input */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenMyPrompts}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>My Prompts ({customPrompts.length}/10)</span>
              </button>

              <button
                type="button"
                onClick={onOpenQuickTools}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Quick Tools</span>
              </button>

              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  isListening
                    ? 'bg-[#7A3E36] text-[#FAF7F2]'
                    : 'text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830]'
                }`}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span>{isListening ? 'Listening...' : 'Voice'}</span>
              </button>
            </div>

            {/* Send / Stop Action */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7A3E36] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#64322B] transition-colors"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!draftText.trim()}
                onClick={() => onSendMessage()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-40"
              >
                <span>Consult</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {voiceNotice && (
          <p className="text-[11px] text-[#7A3E36] px-1">{voiceNotice}</p>
        )}
      </div>
    </div>
  );
};

export default ChatComposer;
