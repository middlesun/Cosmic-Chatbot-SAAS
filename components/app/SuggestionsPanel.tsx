import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  Loader2,
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
  onInsertSuggestions?: (items: SuggestionItem[]) => void;
  onToggleAskLater: (
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis',
    messageId: string
  ) => void;
  onBookmarkSuggestions?: (
    entries: Array<{ item: SuggestionItem; tier: 'followup' | 'deeper_analysis' }>,
    messageId: string
  ) => void;
  onLoadMoreSuggestions?: (messageId: string) => Promise<void> | void;
  utilityBar?: React.ReactNode;
  triggerLabel?: string;
  followupHeading?: string;
  actionVerb?: string;
}

interface SelectedEntry {
  key: string;
  item: SuggestionItem;
  tier: 'followup' | 'deeper_analysis';
}

const MAX_BULK_SELECT = 4;

const normalizeKey = (text: string) => text.trim().toLowerCase();

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  messageId,
  suggestions,
  legacyFollowups,
  askLaterItems,
  defaultExpanded: _defaultExpanded,
  disabled = false,
  onSubmitSuggestion,
  onInsertSuggestion,
  onInsertSuggestions,
  onToggleAskLater,
  onBookmarkSuggestions,
  onLoadMoreSuggestions,
  utilityBar,
  triggerLabel = 'Suggestions',
  followupHeading = 'Followup',
  actionVerb = 'Ask',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const copyTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = (message: string) => {
    setStatusNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setStatusNotice(null), 2200);
  };

  // Always start collapsed on mount and on every new response (messageId change)
  useEffect(() => {
    setIsExpanded(false);
    setIsSelecting(false);
    setSelectedEntries([]);
    setIsLoadingMore(false);
    setStatusNotice(null);
  }, [messageId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const normalized = useMemo<MessageSuggestions>(() => {
    const rawFollowups = Array.isArray(suggestions?.followups)
      ? suggestions!.followups.filter((i) => i && typeof i.text === 'string' && i.text.trim())
      : [];
    const rawDeeper = Array.isArray(suggestions?.deeper_analysis)
      ? suggestions!.deeper_analysis.filter(
          (i) =>
            i &&
            typeof i.text === 'string' &&
            i.text.trim() &&
            i.action !== 'deep_audit' &&
            i.id !== 'da_deep_audit'
        )
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

  const selectedKeysSet = useMemo(
    () => new Set(selectedEntries.map((entry) => entry.key)),
    [selectedEntries]
  );

  const totalCount = normalized.followups.length + normalized.deeper_analysis.length;
  if (totalCount === 0) {
    if (!utilityBar) return null;
    return (
      <div className="mt-2 border-t border-[#3D3830]/[0.08] pt-2.5 flex flex-wrap items-center justify-center sm:justify-end gap-2">
        {utilityBar}
      </div>
    );
  }

  const hasFollowups = normalized.followups.length > 0;
  const hasDeeper = normalized.deeper_analysis.length > 0;
  const isTwoColumn = hasFollowups && hasDeeper;

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (!next) {
        setIsSelecting(false);
        setSelectedEntries([]);
      }
      return next;
    });
  };

  const toggleSelectingMode = () => {
    setIsSelecting((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedEntries([]);
      }
      return next;
    });
  };

  const toggleItemSelection = (
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis',
    rowKey: string
  ) => {
    setSelectedEntries((prev) => {
      const exists = prev.some((entry) => entry.key === rowKey);
      if (exists) {
        return prev.filter((entry) => entry.key !== rowKey);
      }
      if (prev.length >= MAX_BULK_SELECT) {
        showNotice(`Select up to ${MAX_BULK_SELECT} items`);
        return prev;
      }
      return [...prev, { key: rowKey, item, tier }];
    });
  };

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
      showNotice("Saved to 'Ask later'");
    }
  };

  const handleBulkInsert = () => {
    if (selectedEntries.length === 0 || disabled) return;
    const items = selectedEntries.map((entry) => entry.item);
    if (onInsertSuggestions) {
      onInsertSuggestions(items);
    } else if (items.length === 1) {
      onInsertSuggestion(items[0]);
    } else {
      onInsertSuggestion({
        id: items[0].id,
        text: items.map((it, idx) => `${idx + 1}. ${it.text.trim()}`).join('\n'),
      });
    }
    setSelectedEntries([]);
    setIsSelecting(false);
  };

  const handleBulkCopy = async () => {
    if (selectedEntries.length === 0) return;
    const textToCopy =
      selectedEntries.length === 1
        ? selectedEntries[0].item.text.trim()
        : selectedEntries.map((entry, idx) => `${idx + 1}. ${entry.item.text.trim()}`).join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      const count = selectedEntries.length;
      showNotice(`Copied ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedEntries([]);
      setIsSelecting(false);
    } catch {
      // Clipboard blocked silently
    }
  };

  const handleBulkBookmark = () => {
    if (selectedEntries.length === 0) return;
    const count = selectedEntries.length;
    if (onBookmarkSuggestions) {
      onBookmarkSuggestions(
        selectedEntries.map(({ item, tier }) => ({ item, tier })),
        messageId
      );
    } else {
      for (const entry of selectedEntries) {
        if (!savedTextKeys.has(normalizeKey(entry.item.text))) {
          onToggleAskLater(entry.item, entry.tier, messageId);
        }
      }
    }
    showNotice(`Bookmarked ${count} to 'Ask later'`);
    setSelectedEntries([]);
    setIsSelecting(false);
  };

  const handleLoadMore = async () => {
    if (!onLoadMoreSuggestions || isLoadingMore || disabled) return;
    setIsLoadingMore(true);
    try {
      await onLoadMoreSuggestions(messageId);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const renderRow = (item: SuggestionItem, tier: 'followup' | 'deeper_analysis', index: number) => {
    const rowKey = `${tier}:${item.id || index}:${normalizeKey(item.text)}`;
    const isSaved = savedTextKeys.has(normalizeKey(item.text));
    const isCopied = copiedId === item.id;
    const isSelected = selectedKeysSet.has(rowKey);

    if (isSelecting) {
      return (
        <button
          key={rowKey}
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          tabIndex={isExpanded ? 0 : -1}
          onClick={() => toggleItemSelection(item, tier, rowKey)}
          className={`w-full flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 cursor-pointer ${
            isSelected
              ? 'border-[#4A453D]/45 bg-[#FAF7F2] shadow-[0_2px_10px_-6px_rgba(61,56,48,0.2)]'
              : 'border-[#3D3830]/10 bg-[#FDFBF7] hover:border-[#3D3830]/22 hover:bg-[#FAF7F2]/60'
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
              isSelected
                ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                : 'border-[#3D3830]/25 bg-[#FAF7F2] text-transparent'
            }`}
          >
            <Check className="h-2.5 w-2.5 stroke-[2.75]" />
          </span>
          <span className="text-[12.5px] leading-snug text-[#3D3830]">{item.text}</span>
        </button>
      );
    }

    return (
      <div
        key={rowKey}
        className="group flex flex-col rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] overflow-hidden transition-all duration-150 hover:border-[#3D3830]/22 hover:shadow-[0_4px_14px_-8px_rgba(61,56,48,0.18)]"
      >
        <button
          type="button"
          disabled={disabled}
          tabIndex={isExpanded ? 0 : -1}
          onClick={() => onSubmitSuggestion(item)}
          className="w-full px-3.5 pt-2.5 pb-2 text-left text-[12.5px] leading-snug text-[#3D3830] hover:bg-[#FAF7F2]/60 transition-colors focus-visible:outline-none focus-visible:underline disabled:opacity-50 cursor-pointer"
        >
          {item.text}
        </button>

        <div className="flex items-center justify-between gap-2 border-t border-[#3D3830]/[0.06] bg-[#FAF7F2]/70 px-3 py-1">
          <button
            type="button"
            disabled={disabled}
            tabIndex={isExpanded ? 0 : -1}
            onClick={() => onSubmitSuggestion(item)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8B8275] group-hover:text-[#3D3830] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <span>{actionVerb}</span>
            <ArrowUpRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip content="Insert into input to edit" placement="top">
              <button
                type="button"
                disabled={disabled}
                tabIndex={isExpanded ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertSuggestion(item);
                }}
                aria-label={`Insert "${item.text}" into input`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </Tooltip>

            <Tooltip content={isCopied ? 'Copied' : 'Copy question'} placement="top">
              <button
                type="button"
                tabIndex={isExpanded ? 0 : -1}
                onClick={(e) => void handleCopy(e, item)}
                aria-label={isCopied ? 'Copied' : `Copy "${item.text}"`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-lg hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer ${
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
                tabIndex={isExpanded ? 0 : -1}
                onClick={(e) => handleToggleStar(e, item, tier)}
                aria-label={
                  isSaved
                    ? `Remove "${item.text}" from Ask later`
                    : `Save "${item.text}" to Ask later`
                }
                aria-pressed={isSaved}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-lg hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer ${
                  isSaved ? 'text-[#D4A017]' : 'text-[#8B8275] hover:text-[#3D3830]'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${isSaved ? 'fill-[#D4A017]' : ''}`} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className="mt-2 border-t border-[#3D3830]/[0.08] pt-2.5"
      aria-label="Suggestions and message actions"
    >
      {/* Unified Option-A Footer: Mobile stacks Utility Icons centered above Suggestions; Desktop keeps Suggestions Left + Utility Icons Right */}
      <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        {utilityBar ? (
          <div className="order-1 sm:order-2 w-full sm:w-auto flex justify-center sm:justify-end sm:ml-auto">
            {utilityBar}
          </div>
        ) : null}

        <button
          type="button"
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          className={`order-2 sm:order-1 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-left text-xs font-medium active:scale-[0.98] transition-all cursor-pointer ${
            isExpanded
              ? 'border-[#3D3830]/22 bg-[#F1ECE3] text-[#3D3830] shadow-xs'
              : 'border-[#3D3830]/14 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3] hover:border-[#3D3830]/22'
          }`}
        >
          <span>{triggerLabel}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#5C5449] transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Smoothly Animated Expandable Suggestions Body */}
      <div
        aria-hidden={!isExpanded}
        className={`grid transition-[grid-template-rows,opacity,transform] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isExpanded
            ? 'grid-rows-[1fr] opacity-100 translate-y-0 mt-3'
            : 'grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none mt-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {/* Quiet Drawer Control Strip: Status Notice + Multiple Select */}
          <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-medium text-[#8B7355] min-h-[16px]">
              {statusNotice || ''}
            </span>

            <button
              type="button"
              tabIndex={isExpanded ? 0 : -1}
              onClick={toggleSelectingMode}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                isSelecting
                  ? 'bg-[#EAE3D7] text-[#3D3830]'
                  : 'text-[#8B8275] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830]'
              }`}
            >
              {isSelecting ? 'Done' : 'Multiple select'}
            </button>
          </div>

          {/* Subtle Bulk Selection Action Bar */}
          <div
            aria-hidden={!isSelecting}
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
              isSelecting ? 'grid-rows-[1fr] opacity-100 mb-3' : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium text-[#5C5449] tabular-nums">
                    {selectedEntries.length}/{MAX_BULK_SELECT} selected
                  </span>
                  {selectedEntries.length > 0 && (
                    <button
                      type="button"
                      tabIndex={isExpanded && isSelecting ? 0 : -1}
                      onClick={() => setSelectedEntries([])}
                      className="text-[11px] text-[#8B8275] hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={disabled || selectedEntries.length === 0}
                    tabIndex={isExpanded && isSelecting ? 0 : -1}
                    onClick={handleBulkInsert}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#FAF7F2] hover:border-[#3D3830]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Insert</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedEntries.length === 0}
                    tabIndex={isExpanded && isSelecting ? 0 : -1}
                    onClick={() => void handleBulkCopy()}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#FAF7F2] hover:border-[#3D3830]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedEntries.length === 0}
                    tabIndex={isExpanded && isSelecting ? 0 : -1}
                    onClick={handleBulkBookmark}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#FAF7F2] hover:border-[#3D3830]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Bookmark className="h-3 w-3" />
                    <span>Bookmark</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Desktop / Stacked Mobile Layout */}
          <div
            className={`grid grid-cols-1 ${
              isTwoColumn ? 'md:grid-cols-2' : ''
            } gap-4 pt-0.5`}
          >
            {hasFollowups && (
              <div className="space-y-2">
                <h4 className="px-0.5 text-xs font-medium text-[#8B8275]">
                  {followupHeading}
                </h4>
                <div className="space-y-2">
                  {normalized.followups.map((item, idx) =>
                    renderRow(item, 'followup', idx)
                  )}
                </div>
              </div>
            )}

            {hasDeeper && (
              <div className="space-y-2">
                <h4 className="px-0.5 text-xs font-medium text-[#8B7355]">
                  Deeper analysis
                </h4>
                <div className="space-y-2">
                  {normalized.deeper_analysis.map((item, idx) =>
                    renderRow(item, 'deeper_analysis', idx)
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Load more (8 additional questions) */}
          {onLoadMoreSuggestions && (
            <div className="pt-3 flex items-center justify-start">
              <button
                type="button"
                disabled={disabled || isLoadingMore}
                tabIndex={isExpanded ? 0 : -1}
                onClick={() => void handleLoadMore()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3 py-1.5 text-[11.5px] font-medium text-[#5C5449] hover:border-[#3D3830]/25 hover:bg-[#FAF7F2] hover:text-[#3D3830] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B7355]" />
                    <span>Generating 8 more...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 text-[#8B8275]" />
                    <span>Load more</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SuggestionsPanel;
