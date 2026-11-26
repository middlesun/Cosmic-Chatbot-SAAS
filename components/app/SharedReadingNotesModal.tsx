import React, { useEffect } from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import {
  COMPANION_LABEL_SINGULAR,
  type SharedReadingNoteRecord,
} from './chatTypes';

interface SharedReadingNotesModalProps {
  isOpen: boolean;
  notes: SharedReadingNoteRecord[];
  deletingId?: string | null;
  onDeleteNote: (noteId: string) => Promise<void> | void;
  onClose: () => void;
}

const SharedReadingNotesModal: React.FC<SharedReadingNotesModalProps> = ({
  isOpen,
  notes,
  deletingId = null,
  onDeleteNote,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F2229]/45 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-reading-notes-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-[#FAF7F2] text-[#3D3830] rounded-t-3xl sm:rounded-3xl border border-[#3D3830]/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-[#3D3830]/15" aria-hidden="true" />
        </div>

        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-[#3D3830]/10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B7355]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Shared Council Context</span>
            </div>
            <h2
              id="shared-reading-notes-title"
              className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-[#3D3830]"
            >
              Council reading notes
            </h2>
            <p className="text-xs text-[#5C5449]">
              Your {COMPANION_LABEL_SINGULAR} can quietly reference these saved or handed-off Council notes when you ask about your chart or readings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shared reading notes"
            className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-3">
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] p-6 text-center space-y-1.5">
              <p className="font-serif text-lg text-[#3D3830]">No shared Council notes yet</p>
              <p className="text-xs text-[#5C5449] leading-relaxed">
                Tap &ldquo;Discuss with a {COMPANION_LABEL_SINGULAR}&rdquo; on any Astrology Council response—or save a Council note—to give your {COMPANION_LABEL_SINGULAR} this context automatically.
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const isSavedNoteOrigin =
                note.origin === 'saved_note' || note.id.startsWith('saved_note:');
              return (
                <div
                  key={note.id}
                  className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[#8B7355] truncate">
                        {note.expert_label}
                        {note.profile_label ? ` · ${note.profile_label}` : ''}
                      </p>
                      <h3 className="font-['Cormorant_Garamond',serif] text-lg font-semibold text-[#3D3830] leading-snug">
                        {note.title}
                      </h3>
                    </div>
                    {!isSavedNoteOrigin && (
                      <button
                        type="button"
                        disabled={deletingId === note.id}
                        onClick={() => void onDeleteNote(note.id)}
                        aria-label={`Remove ${note.title}`}
                        className="p-1.5 rounded-full text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#F1ECE3] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#5C5449] leading-relaxed whitespace-pre-line line-clamp-4">
                    {note.summary}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedReadingNotesModal;
