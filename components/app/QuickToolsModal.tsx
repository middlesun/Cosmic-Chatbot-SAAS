import React, { useState } from 'react';
import { Sparkles, Wand2, HelpCircle, X, ArrowUpRight, Loader2 } from 'lucide-react';
import type { ChatCatalogOption } from './chatTypes';

interface QuickToolsModalProps {
  isOpen: boolean;
  initialDraft: string;
  modeSlug: string;
  languageSlug: string;
  profileId: string | null;
  toolsCatalog?: ChatCatalogOption[];
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
  onInsertText: (text: string, sendNow?: boolean) => void;
}

type ToolSlug = 'question_generator' | 'prompt_expander' | 'prompt_optimizer';

const QuickToolsModal: React.FC<QuickToolsModalProps> = ({
  isOpen,
  initialDraft,
  modeSlug,
  languageSlug,
  profileId,
  toolsCatalog,
  getAccessToken,
  onClose,
  onInsertText,
}) => {
  const [activeTool, setActiveTool] = useState<ToolSlug>('question_generator');
  const [inputText, setInputText] = useState(initialDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedItems, setGeneratedItems] = useState<string[]>([]);
  const [resultText, setResultText] = useState('');

  if (!isOpen) return null;

  const getToolMeta = (slug: ToolSlug, fallbackName: string) => {
    const match = toolsCatalog?.find((t) => t.slug === slug);
    return {
      name: match?.displayName || fallbackName,
      subtitle: match?.subtitle || '',
    };
  };

  const qGenMeta = getToolMeta('question_generator', 'Question Generator');
  const expanderMeta = getToolMeta('prompt_expander', 'Prompt Expander');
  const optimizerMeta = getToolMeta('prompt_optimizer', 'Prompt Optimizer');
  const activeSubtitle =
    activeTool === 'question_generator'
      ? qGenMeta.subtitle
      : activeTool === 'prompt_expander'
      ? expanderMeta.subtitle
      : optimizerMeta.subtitle;

  const handleRun = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/chat/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toolSlug: activeTool,
          inputText,
          modeSlug,
          languageSlug,
          profileId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tool execution failed');
      }

      setGeneratedItems(Array.isArray(data.items) ? data.items : []);
      setResultText(data.resultText || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run tool');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-[#FAF7F2] border border-[#3D3830]/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3D3830]/10 bg-[#F1ECE3]">
          <div>
            <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
              Consultation Prompt Studio
            </h3>
            <p className="text-xs text-[#5C5449]">
              {activeSubtitle || 'Refine or discover high-precision astrological questions before sending.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/10"
            aria-label="Close Quick Tools"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Tool Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTool('question_generator');
                setGeneratedItems([]);
                setResultText('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-medium border transition-colors ${
                activeTool === 'question_generator'
                  ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                  : 'bg-[#FDFBF7] text-[#5C5449] border-[#3D3830]/12 hover:bg-[#F1ECE3]'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{qGenMeta.name}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool('prompt_expander');
                setGeneratedItems([]);
                setResultText('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-medium border transition-colors ${
                activeTool === 'prompt_expander'
                  ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                  : 'bg-[#FDFBF7] text-[#5C5449] border-[#3D3830]/12 hover:bg-[#F1ECE3]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{expanderMeta.name}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool('prompt_optimizer');
                setGeneratedItems([]);
                setResultText('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-medium border transition-colors ${
                activeTool === 'prompt_optimizer'
                  ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                  : 'bg-[#FDFBF7] text-[#5C5449] border-[#3D3830]/12 hover:bg-[#F1ECE3]'
              }`}
            >
              <Wand2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{optimizerMeta.name}</span>
            </button>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              {activeTool === 'question_generator'
                ? 'Life area, milestone, or dilemma (optional)'
                : 'Your draft question'}
            </label>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeTool === 'question_generator'
                  ? 'e.g., Switching from corporate leadership to an independent venture in 2026...'
                  : 'Paste or type your question to expand or sharpen...'
              }
              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleRun}
              className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>
                {isLoading
                  ? 'Synthesizing...'
                  : activeTool === 'question_generator'
                  ? 'Generate 5 Tailored Questions'
                  : activeTool === 'prompt_expander'
                  ? 'Expand Inquiry'
                  : 'Optimize Prompt'}
              </span>
            </button>
          </div>

          {error && (
            <p className="rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-4 py-3 text-xs text-[#7A3E36]">
              {error}
            </p>
          )}

          {/* Output for Question Generator */}
          {generatedItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#3D3830]/10">
              <p className="text-xs font-medium text-[#5C5449]">
                Click any question to insert into your composer:
              </p>
              {generatedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-3.5"
                >
                  <p className="text-xs text-[#3D3830] leading-relaxed">
                    <span className="font-['JetBrains_Mono',monospace] text-[#8B8275] mr-2">
                      0{idx + 1}
                    </span>
                    {item}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onInsertText(item, false);
                        onClose();
                      }}
                      className="rounded-full border border-[#3D3830]/20 px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertText(item, true);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                    >
                      <span>Ask</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Output for Expander / Optimizer */}
          {generatedItems.length === 0 && resultText && (
            <div className="space-y-3 pt-2 border-t border-[#3D3830]/10">
              <p className="text-xs font-medium text-[#5C5449]">Refined Inquiry</p>
              <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/12 p-4 text-sm text-[#3D3830] leading-relaxed whitespace-pre-wrap">
                {resultText}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onInsertText(resultText, false);
                    onClose();
                  }}
                  className="rounded-full border border-[#3D3830]/20 px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
                >
                  Replace Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInsertText(resultText, true);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                >
                  <span>Send Immediately</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickToolsModal;
