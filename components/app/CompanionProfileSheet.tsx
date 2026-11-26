import React, { useEffect } from 'react';
import { MessageCircle, Plus, X } from 'lucide-react';
import CompanionAvatar from './CompanionAvatar';
import {
  COMPANION_LABEL_SINGULAR,
  type CompanionSkillLevel,
  type PublicCompanionCard,
} from './chatTypes';

interface CompanionProfileSheetProps {
  companion: PublicCompanionCard | null;
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (companion: PublicCompanionCard, options?: { forceNew?: boolean }) => void;
}

const SKILL_NOTE_MAP: Record<CompanionSkillLevel, string> = {
  none_emotional:
    'Focused purely on human conversation, comfort, and emotional presence — never brings up astrology unless you want a friend who reads charts.',
  astrology_soft:
    'Talks like an everyday friend first, and can read your attached natal chart or active transits whenever you invite a deeper look.',
  vedic_soft:
    'A calm everyday confidant who quietly brings Vedic Jyotish timing and contemplative clarity only when you ask.',
  tarot:
    'Warm heart-to-heart company who can pull grounded Rider-Waite or oracle cards whenever you want a mirror on a question.',
  numerology:
    'Measured companion for life crossroads who reads Pythagorean life cycles and timing windows when invited.',
  past_life:
    'Reflective observer for recurring emotional loops and symbolic pattern memory — always optional and present-grounded.',
};

const CompanionProfileSheet: React.FC<CompanionProfileSheetProps> = ({
  companion,
  isOpen,
  onClose,
  onStartChat,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !companion) return null;

  const hasExistingThread = Boolean(companion.last_conversation_id);
  const expertiseLine =
    companion.secondary_expertise && companion.secondary_expertise.length > 0
      ? companion.secondary_expertise.join(' · ')
      : companion.primary_expertise;
  const sexLabel =
    companion.sex === 'F' ? 'Woman' : companion.sex === 'NB' ? 'Non-binary' : 'Man';
  const cleanTagline = (companion.tagline || '').replace(/^[“"]|[”"]$/g, '').trim();
  const conversationsFeelText =
    companion.how_conversations_feel?.trim() ||
    SKILL_NOTE_MAP[companion.skill_level] ||
    SKILL_NOTE_MAP.none_emotional;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F2229]/45 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="companion-sheet-name"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col bg-[#FAF7F2] text-[#3D3830] rounded-t-3xl sm:rounded-3xl border border-[#3D3830]/12 shadow-2xl overflow-hidden transition-transform duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-[#3D3830]/15" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-3 sm:pt-6 pb-4 border-b border-[#3D3830]/10 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <CompanionAvatar
              name={companion.name}
              avatarUrl={companion.avatar_url}
              palette={companion.monogram_palette}
              size="xl"
              shape="circle"
            />
            <div className="min-w-0">
              <h2
                id="companion-sheet-name"
                className="font-['Cormorant_Garamond',serif] text-2xl sm:text-[28px] font-semibold text-[#3D3830] leading-tight truncate"
              >
                {companion.name}
              </h2>
              <p className="mt-1 text-xs text-[#8B8275] leading-relaxed">
                <span>{companion.age}</span>
                <span aria-hidden="true"> · </span>
                <span>{sexLabel}</span>
                <span aria-hidden="true"> · </span>
                <span>{companion.primary_expertise}</span>
              </p>
              {companion.cultural_fluency && (
                <p className="mt-0.5 text-xs text-[#8B8275]/90 leading-snug">
                  {companion.cultural_fluency}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${COMPANION_LABEL_SINGULAR.toLowerCase()} profile`}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Editorial Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">
          {cleanTagline && (
            <p className="font-['Cormorant_Garamond',serif] text-lg sm:text-[19px] italic text-[#3D3830] leading-snug">
              “{cleanTagline}”
            </p>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-[#8B8275]">About {companion.name}</h3>
            <p className="text-[15px] leading-relaxed text-[#5C5449] whitespace-pre-line">
              {companion.full_bio || companion.short_bio}
            </p>
          </div>

          {expertiseLine && (
            <div className="pt-4 border-t border-[#3D3830]/10 space-y-1.5">
              <h3 className="text-xs font-medium text-[#8B8275]">Where {companion.name} shines</h3>
              <p className="text-sm text-[#3D3830] leading-relaxed">{expertiseLine}</p>
            </div>
          )}

          <div className="pt-4 border-t border-[#3D3830]/10 space-y-1.5">
            <h3 className="text-xs font-medium text-[#8B8275]">How conversations feel</h3>
            <p className="text-sm text-[#5C5449] leading-relaxed">
              {conversationsFeelText}
            </p>
          </div>
        </div>

        {/* Thumb-Zone Bottom Action Bar */}
        <div className="px-5 sm:px-7 py-4 bg-[#F1ECE3]/80 border-t border-[#3D3830]/10 shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => onStartChat(companion)}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#4A453D] hover:bg-[#38342E] active:scale-[0.99] text-[#FAF7F2] text-sm font-medium flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {hasExistingThread
                ? `Continue with ${companion.name}`
                : `Start talking with ${companion.name}`}
            </span>
          </button>

          {hasExistingThread && (
            <button
              type="button"
              onClick={() => onStartChat(companion, { forceNew: true })}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Start a fresh conversation with {companion.name}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanionProfileSheet;
