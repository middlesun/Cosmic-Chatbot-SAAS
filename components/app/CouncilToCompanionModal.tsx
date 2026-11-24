import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Search, Sparkles, X } from 'lucide-react';
import CompanionAvatar from './CompanionAvatar';
import {
  COMPANION_DISCOVERY_TABS,
  matchesCompanionDiscoveryFilter,
  type CompanionDiscoveryTabId,
  type PublicCompanionCard,
} from './chatTypes';

export interface CouncilHandoffSource {
  title: string;
  rawContent: string;
  expertSlug?: string | null;
  expertLabel: string;
  astrologyMode?: 'vedic' | 'western' | null;
  profileId?: string | null;
  profileLabel?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}

export interface CouncilHandoffConfirmPayload {
  card: PublicCompanionCard;
  handoffNote: string;
  fullContext: string;
  title: string;
  rememberReadingNote: boolean;
  source: CouncilHandoffSource;
}

interface CouncilToCompanionModalProps {
  isOpen: boolean;
  source: CouncilHandoffSource | null;
  companions: PublicCompanionCard[];
  submittingSlug?: string | null;
  onClose: () => void;
  onConfirm: (payload: CouncilHandoffConfirmPayload) => Promise<void> | void;
}

function cleanReadingMarkdown(raw: string, maxLen = 1100): string {
  return String(raw || '')
    .replace(/<<<[^>]+>>>/g, '')
    .replace(/\[\[BUBBLE\]\]/g, '\n')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

const CouncilToCompanionModal: React.FC<CouncilToCompanionModalProps> = ({
  isOpen,
  source,
  companions,
  submittingSlug = null,
  onClose,
  onConfirm,
}) => {
  const [summaryText, setSummaryText] = useState('');
  const [rememberReadingNote, setRememberReadingNote] = useState(true);
  const [activeGroup, setActiveGroup] = useState<CompanionDiscoveryTabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !source) return;
    setSummaryText(cleanReadingMarkdown(source.rawContent, 1100));
    setRememberReadingNote(true);
    setActiveGroup('all');
    setSearchQuery('');
    setSelectedSlug(null);
  }, [isOpen, source]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submittingSlug) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submittingSlug, onClose]);

  const filteredCompanions = useMemo(
    () =>
      companions.filter((card) =>
        matchesCompanionDiscoveryFilter(card, {
          groupTab: activeGroup,
          searchQuery,
        })
      ),
    [companions, activeGroup, searchQuery]
  );

  const selectedCard = useMemo(
    () =>
      companions.find((c) => c.slug === selectedSlug) ||
      filteredCompanions[0] ||
      companions[0] ||
      null,
    [companions, filteredCompanions, selectedSlug]
  );

  if (!isOpen || !source) return null;

  const handleConfirmWithCard = async (card: PublicCompanionCard) => {
    const cleanFull = summaryText.trim().slice(0, 1400);
    const conciseOpener = cleanFull
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    await onConfirm({
      card,
      handoffNote: conciseOpener || source.title,
      fullContext: cleanFull || source.title,
      title: source.title,
      rememberReadingNote,
      source,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F2229]/45 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handoff-modal-title"
      onClick={() => {
        if (!submittingSlug) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-[#FAF7F2] text-[#3D3830] rounded-t-3xl sm:rounded-3xl border border-[#3D3830]/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-[#3D3830]/15" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-[#3D3830]/10 shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#8B7355]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{source.expertLabel}</span>
              {source.profileLabel && <span>· Chart: {source.profileLabel}</span>}
            </div>
            <h2
              id="handoff-modal-title"
              className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-[#3D3830] leading-tight"
            >
              Talk through this reading with a Companion
            </h2>
            <p className="text-xs text-[#5C5449]">
              Bring the key takeaway into a calm chat—either for emotional grounding or plain-English perspective.
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(submittingSlug)}
            onClick={onClose}
            aria-label="Close handoff sheet"
            className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Editable Reading Summary */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="handoff-summary-input"
                className="text-xs font-medium text-[#5C5449]"
              >
                Reading note shared with your Companion
              </label>
              <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[10px] text-[#8B8275]">
                {summaryText.length}/1400
              </span>
            </div>
            <textarea
              id="handoff-summary-input"
              rows={4}
              maxLength={1400}
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              className="w-full rounded-2xl border border-[#3D3830]/14 bg-[#FDFBF7] px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#4A453D]/45"
              placeholder="Summarize or keep the part of this reading you want to talk through..."
            />

            <label className="flex items-center gap-2 pt-0.5 text-xs text-[#5C5449] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberReadingNote}
                onChange={(e) => setRememberReadingNote(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#4A453D] rounded cursor-pointer"
              />
              <span>Remember this reading note across future Companion chats</span>
            </label>
          </div>

          {/* Companion Picker */}
          <div className="space-y-3 pt-2 border-t border-[#3D3830]/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div
                className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
                role="tablist"
                aria-label="Filter companions"
              >
                {COMPANION_DISCOVERY_TABS.map((tab) => {
                  const isActive = activeGroup === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveGroup(tab.id)}
                      className={`min-h-[34px] shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#4A453D] text-[#FAF7F2]'
                          : 'border border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:bg-[#F1ECE3]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-48 shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8275]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find by name or topic..."
                  className="w-full min-h-[34px] rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] pl-8 pr-7 py-1 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#4A453D]/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear companion filter"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredCompanions.length === 0 ? (
              <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] p-5 text-center text-xs text-[#5C5449]">
                No companions match that search. Try clearing the search box.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-0.5">
                {filteredCompanions.map((card) => {
                  const isSelected = selectedCard?.slug === card.slug;
                  const isChartSkilled = card.skill_level !== 'none_emotional';
                  return (
                    <button
                      key={card.slug}
                      type="button"
                      disabled={Boolean(submittingSlug)}
                      onClick={() => setSelectedSlug(card.slug)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? 'border-[#4A453D] bg-[#F1ECE3] shadow-xs'
                          : 'border-[#3D3830]/12 bg-[#FDFBF7] hover:border-[#3D3830]/28 hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <CompanionAvatar
                        name={card.name}
                        avatarUrl={card.avatar_url}
                        palette={card.monogram_palette}
                        size="sm"
                        shape="circle"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-['Cormorant_Garamond',serif] text-base font-semibold text-[#3D3830] truncate">
                            {card.name}
                          </span>
                          <span className="text-[10px] font-medium text-[#8B8275] shrink-0">
                            {isChartSkilled ? 'Chart-aware' : 'Emotional'}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-[#8B7355] truncate">
                          {card.primary_expertise}
                        </p>
                        <p className="text-[11px] text-[#5C5449] line-clamp-2 leading-snug">
                          {card.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#F1ECE3]/85 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[#5C5449]">
            {selectedCard ? (
              <>
                Opening chat with <strong className="text-[#3D3830]">{selectedCard.name}</strong>
              </>
            ) : (
              'Select a companion above'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={Boolean(submittingSlug)}
              onClick={onClose}
              className="min-h-[40px] rounded-xl border border-[#3D3830]/14 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedCard || !summaryText.trim() || Boolean(submittingSlug)}
              onClick={() => {
                if (selectedCard) void handleConfirmWithCard(selectedCard);
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#4A453D] hover:bg-[#38342E] px-4 py-2 text-xs font-medium text-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-50"
            >
              {submittingSlug ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Opening…</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedCard ? `Talk with ${selectedCard.name}` : 'Open Companion Chat'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouncilToCompanionModal;
