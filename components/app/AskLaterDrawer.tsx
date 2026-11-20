import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Plus, Star, X } from 'lucide-react';
import Tooltip from './Tooltip';
import type { AskLaterItem, SuggestionItem } from './chatTypes';

interface AskLaterDrawerProps {
  isOpen: boolean;
  items: AskLaterItem[];
  disabled?: boolean;
  onClose: () => void;
  onSubmitItem: (item: SuggestionItem) => void;
  onInsertItem: (item: SuggestionItem) => void;
  onRemoveItem: (item: AskLaterItem) => void;
}

const AskLaterDrawer: React.FC<AskLaterDrawerProps> = ({
  isOpen,
  items,
  disabled = false,
  onClose,
  onSubmitItem,
  onInsertItem,
  onRemoveItem,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleCopy = async (e: React.MouseEvent, item: AskLaterItem) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ask later saved questions"
        className="animate-cc-drawer-in w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden flex flex-col max-h-[82dvh]"
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-medium text-[#3D3830] leading-tight">
              Ask later
            </h2>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Saved questions for this conversation · Tap to ask, + to edit, or unstar to remove
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask later"
            className="h-9 w-9 rounded-full flex items-center justify-center text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] px-5 py-8 text-center space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-[#F1ECE3] flex items-center justify-center text-[#8B7355]">
                <Star className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-[#3D3830]">
                Nothing saved to Ask later yet
              </p>
              <p className="text-xs text-[#8B8275] max-w-xs mx-auto leading-relaxed">
                Tap the star icon on any Followup or Deeper analysis suggestion below a reply to bookmark it here for this conversation.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isCopied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] px-4 py-3 hover:border-[#3D3830]/20 hover:bg-[#F1ECE3]/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onSubmitItem({
                          id: item.id,
                          text: item.text,
                          technical_directive: item.technical_directive,
                        });
                        onClose();
                      }}
                      className="flex-1 min-w-0 text-left space-y-1 focus-visible:outline-none disabled:opacity-50 cursor-pointer"
                    >
                      <span className="block text-[11px] text-[#8B7355]">
                        {item.tier === 'deeper_analysis' ? 'Deeper analysis' : 'Followup'}
                      </span>
                      <span className="block text-xs sm:text-[13px] leading-relaxed text-[#3D3830]">
                        {item.text}
                      </span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                      <Tooltip content="Insert into input to edit" placement="top">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            onInsertItem({
                              id: item.id,
                              text: item.text,
                              technical_directive: item.technical_directive,
                            });
                            onClose();
                          }}
                          aria-label={`Insert "${item.text}" into input`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830] active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>

                      <Tooltip content={isCopied ? 'Copied' : 'Copy question'} placement="top">
                        <button
                          type="button"
                          onClick={(e) => void handleCopy(e, item)}
                          aria-label={isCopied ? 'Copied' : `Copy "${item.text}"`}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer ${
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

                      <Tooltip content="Remove from Ask later" placement="top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem(item);
                          }}
                          aria-label={`Remove "${item.text}" from Ask later`}
                          aria-pressed={true}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#D4A017] hover:bg-[#EAE3D7] active:scale-95 transition-all cursor-pointer"
                        >
                          <Star className="h-3.5 w-3.5 fill-[#D4A017]" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AskLaterDrawer;
