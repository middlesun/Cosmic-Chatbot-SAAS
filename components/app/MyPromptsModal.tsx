import React, { useState } from 'react';
import { BookmarkPlus, Trash2, X, ArrowUpRight } from 'lucide-react';
import type { CustomPromptRecord } from './chatTypes';

interface MyPromptsModalProps {
  isOpen: boolean;
  prompts: CustomPromptRecord[];
  maxLimit: number;
  getAccessToken: () => Promise<string | null>;
  onPromptsUpdated: (prompts: CustomPromptRecord[]) => void;
  onInsertPrompt: (text: string) => void;
  onClose: () => void;
}

const MyPromptsModal: React.FC<MyPromptsModalProps> = ({
  isOpen,
  prompts,
  maxLimit,
  getAccessToken,
  onPromptsUpdated,
  onInsertPrompt,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !promptText.trim()) {
      setError('Both a title and prompt text are required.');
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/chat/custom-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          prompt_text: promptText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save prompt');

      onPromptsUpdated([data.prompt, ...prompts]);
      setTitle('');
      setPromptText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/chat/custom-prompts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete prompt');
      onPromptsUpdated(prompts.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-[#FAF7F2] border border-[#3D3830]/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3D3830]/10 bg-[#F1ECE3]">
          <div>
            <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
              My Saved Prompts
            </h3>
            <p className="text-xs text-[#5C5449]">
              Store up to {maxLimit} reusable astrological consultation prompts ({prompts.length}/{maxLimit} used).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/10"
            aria-label="Close My Prompts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Add New Prompt Form */}
          <form onSubmit={handleSave} className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#3D3830]">Create Reusable Prompt</span>
              <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B8275]">
                {prompts.length}/{maxLimit}
              </span>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={prompts.length >= maxLimit}
              placeholder="Title (e.g., Annual Solar Return & Career Audit)"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 disabled:opacity-50"
            />
            <textarea
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={prompts.length >= maxLimit}
              placeholder="Write the exact consultation instructions you want to reuse across profiles..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 disabled:opacity-50"
            />

            {error && <p className="text-xs text-[#7A3E36]">{error}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving || prompts.length >= maxLimit}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Prompt'}</span>
              </button>
            </div>
          </form>

          {/* Existing List */}
          <div className="space-y-2.5">
            {prompts.length === 0 ? (
              <p className="text-center py-4 text-xs text-[#8B8275]">
                No saved prompts yet. Add one above to reuse it in any profile consultation.
              </p>
            ) : (
              prompts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-[#3D3830]">{item.title}</h4>
                    <p className="mt-1 text-xs text-[#5C5449] leading-relaxed whitespace-pre-wrap">
                      {item.prompt_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onInsertPrompt(item.prompt_text);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                    >
                      <span>Use</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded px-2 py-1 text-[10px] font-medium bg-[#7A3E36] text-[#FAF7F2]"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded px-1.5 py-1 text-[10px] text-[#8B8275]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label="Delete prompt"
                        className="p-1.5 rounded-full text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#3D3830]/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPromptsModal;
