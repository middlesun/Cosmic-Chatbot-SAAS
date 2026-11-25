import React, { useEffect, useState } from 'react';
import { Eye, Maximize2, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  getTarotCardMetadata,
  TAROT_BACK_IMAGE_URL,
  type DrawnTarotCard,
  type DrawnTarotSpread,
} from '../../lib/tarotDeck';

interface TarotCardSpreadProps {
  spread: DrawnTarotSpread;
  /** Whether cards start face-down for interactive reveal, or open immediately */
  initialRevealed?: boolean;
  /** Optional custom description snippet per card index for interactive preview demos */
  customMeanings?: Record<number, string>;
  compact?: boolean;
}

const TarotCardFacePlate: React.FC<{
  card: DrawnTarotCard;
  sizeClass?: string;
}> = ({ card, sizeClass = 'text-[10px]' }) => {
  const meta = getTarotCardMetadata(card.card);
  const [imgFailed, setImgFailed] = useState(false);
  const isReversed = card.orientation === 'Reversed';

  return (
    <div className="h-full w-full rounded-2xl border border-[#B8965A]/45 bg-[#FDF8EE] p-2 sm:p-2.5 flex flex-col justify-between shadow-md select-none">
      <div
        className={`flex-1 flex flex-col justify-between min-h-0 ${
          isReversed ? 'rotate-180' : ''
        }`}
      >
        <p
          className={`font-serif font-semibold tracking-[0.14em] text-[#2F2B3A] text-center leading-none pt-0.5 truncate ${sizeClass}`}
        >
          {meta.topLabel}
        </p>

        <div className="my-1.5 flex-1 min-h-0 rounded-md border border-[#2F2B3A]/70 bg-[#203D6A] overflow-hidden relative flex items-center justify-center">
          {!imgFailed ? (
            <img
              src={meta.imageUrl}
              alt={`${meta.title} tarot card`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-[#1E3C6E] via-[#2F4E62] to-[#3B5B4A] flex flex-col items-center justify-center p-2 text-center">
              <Sparkles className="h-5 w-5 text-[#E2B44B] mb-1" />
              <span className="font-serif text-xs text-[#FDF8EE] leading-tight">
                {meta.title}
              </span>
            </div>
          )}
        </div>

        <p className="font-serif text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.07em] text-[#2F2B3A] text-center leading-tight pb-0.5 truncate">
          {meta.title}
        </p>
      </div>
    </div>
  );
};

const TarotCardBackPlate: React.FC = () => {
  const [backFailed, setBackFailed] = useState(false);

  return (
    <div className="h-full w-full rounded-2xl border border-[#D4AF63]/65 bg-[#3B3856] overflow-hidden shadow-md relative flex items-center justify-center">
      {!backFailed ? (
        <img
          src={TAROT_BACK_IMAGE_URL}
          alt="Tarot card back"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBackFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full p-2.5 flex items-center justify-center bg-[#3B3856]">
          <div className="h-full w-full rounded-xl border border-[#D4AF63]/50 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-[#E2BE74]" />
          </div>
        </div>
      )}
    </div>
  );
};

const TarotCardSpread: React.FC<TarotCardSpreadProps> = ({
  spread,
  initialRevealed = true,
  customMeanings,
  compact = false,
}) => {
  const cards = Array.isArray(spread?.cards) ? spread.cards : [];
  const [revealedIndices, setRevealedIndices] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    cards.forEach((_, idx) => {
      initial[idx] = initialRevealed;
    });
    return initial;
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  useEffect(() => {
    setRevealedIndices(() => {
      const next: Record<number, boolean> = {};
      cards.forEach((_, idx) => {
        next[idx] = initialRevealed;
      });
      return next;
    });
    setSelectedIndex(0);
  }, [spread?.spreadName, cards.length, initialRevealed]);

  useEffect(() => {
    if (zoomedIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomedIndex]);

  if (cards.length === 0) return null;

  const allRevealed = cards.every((_, idx) => Boolean(revealedIndices[idx]));

  const toggleRevealAll = () => {
    const nextState = !allRevealed;
    const next: Record<number, boolean> = {};
    cards.forEach((_, idx) => {
      next[idx] = nextState;
    });
    setRevealedIndices(next);
  };

  const handleCardPress = (idx: number) => {
    const currentlyOpen = Boolean(revealedIndices[idx]);
    if (!currentlyOpen) {
      setRevealedIndices((prev) => ({ ...prev, [idx]: true }));
      setSelectedIndex(idx);
      return;
    }
    if (selectedIndex === idx) {
      setZoomedIndex(idx);
    } else {
      setSelectedIndex(idx);
    }
  };

  const selectedCard = cards[selectedIndex] || cards[0];
  const selectedMeta = selectedCard ? getTarotCardMetadata(selectedCard.card) : null;
  const zoomedCard = zoomedIndex !== null ? cards[zoomedIndex] || null : null;
  const zoomedMeta = zoomedCard ? getTarotCardMetadata(zoomedCard.card) : null;

  const gridContainerClass =
    cards.length === 1
      ? 'flex justify-center'
      : cards.length <= 3
      ? 'flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0'
      : 'flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-5 md:gap-3 md:overflow-visible md:pb-0';

  const cardSizeClass =
    cards.length === 1
      ? compact
        ? 'w-36 h-[222px]'
        : 'w-40 h-[246px] sm:w-44 sm:h-[270px]'
      : cards.length <= 3
      ? compact
        ? 'w-[132px] h-[204px] sm:w-full sm:max-w-[164px] sm:h-[252px]'
        : 'w-[144px] h-[222px] sm:w-full sm:max-w-[180px] sm:h-[276px]'
      : 'w-[134px] h-[206px] md:w-full md:h-[218px]';

  return (
    <div className="my-3 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 sm:p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#3D3830]">
            <Sparkles className="h-3.5 w-3.5 text-[#B8965A] shrink-0" />
            <span className="truncate">{spread.spreadName}</span>
          </div>
          <p className="text-[11px] text-[#8B8275] mt-0.5">
            {allRevealed ? 'Tap any card for a closer look' : 'Tap each card to turn it over'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleRevealAll}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {allRevealed ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Turn face-down</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Reveal all</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Card Spread Row */}
      <div className={gridContainerClass}>
        {cards.map((card, idx) => {
          const isOpen = Boolean(revealedIndices[idx]);
          const isSelected = selectedIndex === idx;
          const meta = getTarotCardMetadata(card.card);
          const isReversed = card.orientation === 'Reversed';

          return (
            <div
              key={`${card.card}-${idx}`}
              className={`snap-start shrink-0 sm:shrink flex flex-col items-center space-y-2 ${
                cards.length === 1 ? 'w-44' : cards.length <= 3 ? 'w-[144px] sm:w-full' : 'w-[134px] md:w-full'
              }`}
            >
              <p className="text-[11px] font-medium text-[#5C5449] text-center line-clamp-1 px-1">
                {card.position}
              </p>

              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  onClick={() => handleCardPress(idx)}
                  aria-label={
                    isOpen
                      ? `${card.position}: ${meta.title} (${card.orientation}). Click to inspect larger.`
                      : `${card.position}: Face down. Tap to reveal.`
                  }
                  className={`cc-card-perspective ${cardSizeClass} cursor-pointer rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A] ${
                    isSelected && isOpen
                      ? 'ring-2 ring-[#B8965A]/80 ring-offset-2 ring-offset-[#FAF7F2]'
                      : ''
                  }`}
                >
                  <div className={`cc-card-inner ${isOpen ? 'is-flipped' : ''}`}>
                    <div className="cc-card-face">
                      <TarotCardBackPlate />
                    </div>
                    <div className="cc-card-face cc-card-face-open">
                      <TarotCardFacePlate
                        card={card}
                        sizeClass={cards.length > 3 ? 'text-[9px]' : 'text-[10px]'}
                      />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(idx);
                      setZoomedIndex(idx);
                    }}
                    aria-label={`Zoom ${meta.title}`}
                    className="absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full bg-[#1F2229]/75 text-[#FAF7F2] flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="text-center space-y-0.5 px-1">
                <p className="text-xs font-medium text-[#3D3830] leading-tight">
                  {isOpen ? meta.title : 'Tap to reveal'}
                </p>
                {isOpen && (
                  <p className="text-[11px] text-[#8B8275]">
                    {meta.arcana} ·{' '}
                    <span className={isReversed ? 'text-[#7A3E36] font-medium' : ''}>
                      {card.orientation}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Card Position Summary */}
      {selectedCard && selectedMeta && revealedIndices[selectedIndex] && (
        <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="font-medium text-[#3D3830]">
              {selectedCard.position} — {selectedMeta.canonicalName}
              {selectedCard.orientation === 'Reversed' ? ' (Reversed)' : ''}
            </p>
            <p className="text-[11px] text-[#5C5449] leading-relaxed">
              {customMeanings?.[selectedIndex] ||
                `${selectedMeta.arcana} Arcana · Element of ${selectedMeta.element}${
                  selectedCard.orientation === 'Reversed'
                    ? ' · Inward, delayed, or reflective expression'
                    : ' · Upright open flow'
                }`}
            </p>
          </div>
        </div>
      )}

      {/* Full-View Card Inspection Modal */}
      {zoomedCard && zoomedMeta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomedMeta.canonicalName} detail`}
          onClick={() => setZoomedIndex(null)}
          className="fixed inset-0 z-50 bg-[#1F2229]/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-[#8B8275]">{zoomedCard.position}</p>
                <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-tight">
                  {zoomedMeta.canonicalName}
                </h3>
                <p className="text-xs text-[#5C5449] mt-0.5">
                  {zoomedMeta.arcana} Arcana · {zoomedMeta.element} ·{' '}
                  <span className={zoomedCard.orientation === 'Reversed' ? 'text-[#7A3E36] font-medium' : ''}>
                    {zoomedCard.orientation}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedIndex(null)}
                aria-label="Close card preview"
                className="h-9 w-9 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] flex items-center justify-center text-[#3D3830] hover:bg-[#EAE3D7] cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto w-60 h-[370px]">
              <TarotCardFacePlate card={zoomedCard} sizeClass="text-xs" />
            </div>

            {customMeanings?.[zoomedIndex!] && (
              <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed text-center">
                {customMeanings[zoomedIndex!]}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TarotCardSpread;
