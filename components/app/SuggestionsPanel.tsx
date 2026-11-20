import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Star,
} from 'lucide-react';
import Tooltip from './Tooltip';
import type { AskLaterItem, MessageSuggestions, SuggestionItem } from './chatTypes';

interface SuggestionsPanelProps {
  messageId: string;
  suggestions?: MessageSuggestions | null;
  legacyFollowups?: string[];
  askLaterItems: AskLaterItem[];
  defaultExpanded: boolean;
  disabled?: boolean;
  onSubmitSuggestion: (item: SuggestionItem) => void;
  onInsertSuggestion: (item: SuggestionItem) => void;
  onToggleAskLater: (
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis',
    messageId: string
  ) => void;
}

const normalizeKey = (text: string) => text.trim().toLowerCase();

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  messageId,
  suggestions,
  legacyFollowups,
  askLaterItems,
  defaultExpanded,
  disabled = false,
  onSubmitSuggestion,
  onInsertSuggestion,
  onToggleAskLater,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const copyTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // Sync expansion whenever user toggles the Suggestions default in Chat Settings
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded, messageId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const normalized = useMemo<MessageSuggestions>(() => {
    const rawFollowups = Array.isArray(suggestions?.followups)
      ? suggestions!.followups.filter((i) => i && typeof i.text === 'string' && i.text.trim())
      : [];
    const rawDeeper = Array.isArray(suggestions?.deeper_analysis)
      ? suggestions!.deeper_analysis.filter((i) => i && typeof i.text === 'string' && i.text.trim())
      : [];

    if (rawFollowups.length > 0 || rawDeeper.length > 0) {
      return {
        followups: rawFollowups,
        deeper_analysis: rawDeeper,
      };
    }

    const fallbackList = Array.isArray(legacyFollowups)
      ? legacyFollowups
          .filter((q) => typeof q === 'string' && q.trim())
          .map((q, idx) => ({ id: `legacy_${idx + 1}`, text: q.trim() }))
      : [];

    return {
      followups: fallbackList,
      deeper_analysis: [],
    };
  }, [suggestions, legacyFollowups]);

  const savedTextKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of askLaterItems) {
      if (item?.text) set.add(normalizeKey(item.text));
    }
    return set;
  }, [askLaterItems]);

  const totalCount = normalized.followups.length + normalized.deeper_analysis.length;
  if (totalCount === 0) return null;

  const hasFollowups = normalized.followups.length > 0;
  const hasDeeper = normalized.deeper_analysis.length > 0;
  const isTwoColumn = hasFollowups && hasDeeper;

  const handleCopy = async (e: React.MouseEvent, item: SuggestionItem) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.text);
      setCopiedId(item.id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard blocked silently
    }
  };

  const handleToggleStar = (
    e: React.MouseEvent,
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis'
  ) => {
    e.stopPropagation();
    const currentlySaved = savedTextKeys.has(normalizeKey(item.text));
    onToggleAskLater(item, tier, messageId);
    if (!currentlySaved) {
      setSavedNotice("Saved to 'Ask later'");
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSavedNotice(null), 2200);
    }
  };

  const renderRow = (item: SuggestionItem, tier: 'followup' | 'deeper_analysis') => {
    const isSaved = savedTextKeys.has(normalizeKey(item.text));
    const isCopied = copiedId === item.id;

    return (
      <div
        key={`${tier}-${item.id}`}
        className="group flex items-start justify-between gap-2 rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3.5 py-2.5 transition-colors duration-150 hover:border-[#3D3830]/20 hover:bg-[#F1ECE3]/80"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmitSuggestion(item)}
          className="flex-1 min-w-0 text-left text-xs leading-relaxed text-[#3D3830] py-0.5 focus-visible:outline-none focus-visible:underline disabled:opacity-50 cursor-pointer"
        >
          {item.text}
        </button>

        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
          <Tooltip content="Insert into input to edit" placement="top">
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onInsertSuggestion(item);
              }}
              aria-label={`Insert "${item.text}" into input`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={isCopied ? 'Copied' : 'Copy question'} placement="top">
            <button
              type="button"
              onClick={(e) => void handleCopy(e, item)}
              aria-label={isCopied ? 'Copied' : `Copy "${item.text}"`}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer ${
                isCopied ? 'text-[#2D6A4F]' : 'text-[#8B8275] hover:text-[#3D3830]'
              }`}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </Tooltip>

          <Tooltip
            content={isSaved ? "Saved in 'Ask later'" : "Save to 'Ask later'"}
            placement="top"
          >
            <button
              type="button"
              onClick={(e) => handleToggleStar(e, item, tier)}
              aria-label={
                isSaved
                  ? `Remove "${item.text}" from Ask later`
                  : `Save "${item.text}" to Ask later`
              }
              aria-pressed={isSaved}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer ${
                isSaved ? 'text-[#D4A017]' : 'text-[#8B8275] hover:text-[#3D3830]'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${isSaved ? 'fill-[#D4A017]' : ''}`} />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <section className="pt-4 space-y-2.5" aria-label="Suggested questions and deeper analysis">
      {/* Collapsible Editorial Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="inline-flex items-center gap-2 rounded-xl py-1 pr-2 text-left text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors cursor-pointer"
        >
          <span>
            {hasFollowups && hasDeeper
              ? 'Followup & Deeper analysis'
              : hasDeeper
              ? 'Deeper analysis'
              : 'Followup'}
          </span>
          <span className="text-[11px] font-normal text-[#8B8275] tabular-nums">
            · {totalCount}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-[#8B8275]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[#8B8275]" />
          )}
        </button>

        {savedNotice ? (
          <span className="text-[11px] font-medium text-[#8B7355] animate-cc-message-in">
            {savedNotice}
          </span>
        ) : (
          isExpanded && (
            <span className="hidden sm:inline text-[11px] text-[#8B8275]">
              Click to ask · + to edit · ★ for Ask later
            </span>
          )
        )}
      </div>

      {/* Expandable 2-Column Desktop / Stacked Mobile Layout */}
      {isExpanded && (
        <div
          className={`grid grid-cols-1 ${
            isTwoColumn ? 'md:grid-cols-2' : ''
          } gap-4 pt-0.5`}
        >
          {hasFollowups && (
            <div className="space-y-2">
              <h4 className="px-0.5 text-xs font-medium text-[#8B8275]">
                Followup
              </h4>
              <div className="space-y-2">
                {normalized.followups.map((item) => renderRow(item, 'followup'))}
              </div>
            </div>
          )}

          {hasDeeper && (
            <div className="space-y-2">
              <h4 className="px-0.5 text-xs font-medium text-[#8B7355]">
                Deeper analysis
              </h4>
              <div className="space-y-2">
                {normalized.deeper_analysis.map((item) =>
                  renderRow(item, 'deeper_analysis')
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default SuggestionsPanel;
