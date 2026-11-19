import React, { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import CustomSelect from './CustomSelect';
import type { ChatCatalog } from './chatTypes';

export type ChatFontSize = 'sm' | 'base' | 'lg';

interface ChatSettingsModalProps {
  isOpen: boolean;
  isPreviewMode?: boolean;
  catalog: ChatCatalog | null;
  initialCallName: string;
  initialFontSize: ChatFontSize;
  initialExpert: string;
  initialOutput: string;
  initialLanguage: string;
  getAccessToken: () => Promise<string | null>;
  onSaved: (updated: {
    preferredCallName: string;
    chatFontSize: ChatFontSize;
    defaultExpert: string;
    defaultOutput: string;
    defaultLanguage: string;
  }) => void;
  onClose: () => void;
}

const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  isPreviewMode = false,
  catalog,
  initialCallName,
  initialFontSize,
  initialExpert,
  initialOutput,
  initialLanguage,
  getAccessToken,
  onSaved,
  onClose,
}) => {
  const [callName, setCallName] = useState(initialCallName);
  const [fontSize, setFontSize] = useState<ChatFontSize>(initialFontSize);
  const [defaultExpert, setDefaultExpert] = useState(initialExpert);
  const [defaultOutput, setDefaultOutput] = useState(initialOutput);
  const [defaultLanguage, setDefaultLanguage] = useState(initialLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCallName(initialCallName);
      setFontSize(initialFontSize);
      setDefaultExpert(initialExpert);
      setDefaultOutput(initialOutput);
      setDefaultLanguage(initialLanguage);
      setError(null);
    }
  }, [
    isOpen,
    initialCallName,
    initialFontSize,
    initialExpert,
    initialOutput,
    initialLanguage,
  ]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isPreviewMode) {
      onSaved({
        preferredCallName: callName.trim(),
        chatFontSize: fontSize,
        defaultExpert,
        defaultOutput,
        defaultLanguage,
      });
      onClose();
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to save chat preferences.');

      const res = await fetch('/api/app/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferred_call_name: callName.trim(),
          chat_font_size: fontSize,
          default_expert: defaultExpert,
          default_output: defaultOutput,
          default_language: defaultLanguage,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not update chat settings');
      }

      onSaved({
        preferredCallName: callName.trim(),
        chatFontSize: fontSize,
        defaultExpert,
        defaultOutput,
        defaultLanguage,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-cc-drawer-in w-full max-w-md rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
              Chat Preferences
            </h2>
            <p className="text-[11px] text-[#8B8275]">
              Customize how your astrologer speaks and displays readings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[78dvh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Personal Name (What should we call you?)
            </label>
            <input
              type="text"
              value={callName}
              onChange={(e) => setCallName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Sameer, Aditi..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Reading Font Size
            </label>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F1ECE3] p-1 border border-[#3D3830]/10">
              {(
                [
                  { id: 'sm', label: 'Compact' },
                  { id: 'base', label: 'Balanced' },
                  { id: 'lg', label: 'Large' },
                ] as const
              ).map((opt) => {
                const active = fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFontSize(opt.id)}
                    className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#4A453D] text-[#FAF7F2]'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Default Astrologer
            </label>
            <CustomSelect
              value={defaultExpert}
              onChange={setDefaultExpert}
              ariaLabel="Default Astrologer"
              size="md"
              surface="elevated"
              className="w-full"
              options={(catalog?.experts || []).map((opt) => ({
                value: opt.slug,
                label: opt.displayName,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Default Output Style
              </label>
              <CustomSelect
                value={defaultOutput}
                onChange={setDefaultOutput}
                ariaLabel="Default Output Style"
                size="md"
                surface="elevated"
                className="w-full"
                options={(catalog?.outputs || []).map((opt) => ({
                  value: opt.slug,
                  label: opt.displayName,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Default Language
              </label>
              <CustomSelect
                value={defaultLanguage}
                onChange={setDefaultLanguage}
                ariaLabel="Default Language"
                size="md"
                surface="elevated"
                className="w-full"
                options={(catalog?.languages || []).map((opt) => ({
                  value: opt.slug,
                  label: opt.displayName,
                }))}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-[#3D3830]/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatSettingsModal;
