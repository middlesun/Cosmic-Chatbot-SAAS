import React, { useMemo, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import CompanionAvatar from './app/CompanionAvatar';
import TarotCardSpread from './app/TarotCardSpread';
import type { DrawnTarotSpread } from '../lib/tarotDeck';

const CUSTOM_CARD_MEANINGS: Record<number, string> = {
  0: 'Eight of Pentacles · Disciplined, quiet refinement — you have already built deeper craft and footing than it feels like in the moment.',
  1: 'XVII · The Star · Calm clarity after mental fatigue. Notice where hope feels grounded rather than frantic; space returns before the next move.',
  2: 'Ace of Wands · A fresh creative spark is ready to test through one small, low-risk step before making a sweeping career commitment.',
};

const REVERSED_THIRD_CARD_MEANING =
  'Ace of Wands (Reversed) · The desire for a new chapter is already lit inside you, though timing or confidence feels momentarily bottled up. Test one private step first instead of forcing an abrupt leap.';

const TarotStyleShowcase: React.FC = () => {
  const [previewReversed, setPreviewReversed] = useState<boolean>(false);

  const landingSpread = useMemo<DrawnTarotSpread>(
    () => ({
      spreadName: '3-Card Illuminated Botanical Spread',
      cards: [
        {
          position: '1. Root Influence',
          card: 'Eight of Pentacles',
          orientation: 'Upright',
          arcana: 'Minor',
        },
        {
          position: '2. Present Energy',
          card: 'XVII · The Star',
          orientation: 'Upright',
          arcana: 'Major',
        },
        {
          position: '3. Next Movement',
          card: 'Ace of Wands',
          orientation: previewReversed ? 'Reversed' : 'Upright',
          arcana: 'Minor',
        },
      ],
    }),
    [previewReversed]
  );

  const customMeanings = useMemo<Record<number, string>>(
    () => ({
      ...CUSTOM_CARD_MEANINGS,
      2: previewReversed ? REVERSED_THIRD_CARD_MEANING : CUSTOM_CARD_MEANINGS[2],
    }),
    [previewReversed]
  );

  return (
    <section
      id="tarot-styles-showcase"
      className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10">
        {/* Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-[#8B8275]">
              Visual Tarot Inside Chat · Full 78-Card Deck
            </p>
            <h2
              className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Illuminated Botanical &amp; Gemstone Tarot
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#5C5449] max-w-md leading-relaxed">
            Talk naturally about life first — whenever clarity calls for a reading, your companion shuffles our full 78-card illustrated deck directly inside chat.
          </p>
        </div>

        {/* Showcase Frame: Craft Overview + Real Interactive 78-Card Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Deck Craft & Companion Philosophy */}
          <div className="lg:col-span-4 rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-5 sm:p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] aspect-[4/3]">
                <img
                  src="/assets/tarot/style2-illuminated.jpg"
                  alt="Illuminated Botanical & Gemstone Tarot deck — indigo-plum gold foil moon back beside The Star card"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-tight">
                  Painted for quiet reflection
                </h3>
                <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed">
                  Lapis night skies, antique ochre gold, sage botanicals, and indigo-plum card backs — every one of the 78 Major and Minor Arcana cards is bespoke-illustrated to match your journal.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#3D3830]/10 space-y-2 text-xs text-[#5C5449]">
              <p className="flex items-center gap-2 text-[#3D3830] font-medium">
                <Sparkles className="h-3.5 w-3.5 text-[#B8965A] shrink-0" />
                <span>Pulled only when a spread adds clarity</span>
              </p>
              <p className="text-[11px] text-[#8B8275] leading-relaxed">
                Everyday conversation stays warm and unscripted; ask for a 1-card pull, 3-card trajectory, or 5-card crossroads whenever you want a visual mirror.
              </p>
            </div>
          </div>

          {/* Right: Live Simulated In-Chat Spread Powered by Real Deck Plates */}
          <div className="lg:col-span-8 rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-5 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
              <div className="flex items-center gap-3">
                <CompanionAvatar
                  name="Bella"
                  avatarUrl="/assets/companions/bella.jpg"
                  size="sm"
                  shape="circle"
                />
                <div>
                  <p className="font-serif text-xl font-medium text-[#3D3830] leading-tight">
                    Bella · Interactive In-Chat Reading
                  </p>
                  <p className="text-xs text-[#8B8275]">
                    Tap any card face-down to reveal, click an open card to inspect larger
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewReversed((prev) => !prev)}
                className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  previewReversed
                    ? 'border-[#7A3E36]/40 bg-[#7A3E36]/10 text-[#7A3E36]'
                    : 'border-[#3D3830]/15 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{previewReversed ? 'Card 3: Reversed' : 'Preview Reversed'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {/* User Question */}
              <div className="flex justify-end">
                <div className="max-w-md rounded-2xl rounded-br-sm bg-[#4A453D] px-4 py-2.5 text-xs sm:text-sm text-[#FAF7F2]">
                  Can you pull a 3-card spread on my career direction right now?
                </div>
              </div>

              {/* Bella Bubble + Real TarotCardSpread Component */}
              <div className="space-y-2">
                <div className="rounded-2xl rounded-tl-sm border border-[#3D3830]/12 bg-[#FDFBF7] px-4 py-3 text-xs sm:text-sm text-[#3D3830] max-w-xl">
                  Let&apos;s look calmly at where your effort sits, what is shifting right now, and one grounded next move.
                </div>
                <TarotCardSpread
                  spread={landingSpread}
                  initialRevealed={false}
                  customMeanings={customMeanings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TarotStyleShowcase;
