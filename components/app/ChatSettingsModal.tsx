import React, { useEffect, useState } from 'react';
import { Brain, Check, Loader2, Lock, UserCheck, X } from 'lucide-react';
import { useAuth, type AstrologyMode } from './AuthContext';
import CustomSelect from './CustomSelect';
import type {
  ChatCatalog,
  ChatProfile,
} from './chatTypes';

export type ChatFontSize = 'sm' | 'base' | 'lg';

interface ChatSettingsModalProps {
  isOpen: boolean;
  isPreviewMode?: boolean;
  catalog: ChatCatalog | null;
  profiles: ChatProfile[];
  activeProfileId: string | null;
  useFullProfileMemory: boolean;
  expertSlug: string;
  languageSlug: string;
  isThreadLocked: boolean;
  initialFontSize: ChatFontSize;
  initialSuggestionsAutoExpand?: boolean;
  getAccessToken: () => Promise<string | null>;
  onSwitchProfile: (profileId: string | null) => void;
  onChangeExpert: (slug: string) => void;
  onChangeLanguage: (slug: string) => void;
  onToggleMemory: () => void;
  onSaved: (updated: {
    chatFontSize: ChatFontSize;
    defaultExpert: string;
    defaultLanguage: string;
    suggestionsAutoExpand: boolean;
    defaultAstrologyMode: AstrologyMode;
  }) => void;
  onClose: () => void;
}

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  isPreviewMode = false,
  catalog,
  profiles,
  activeProfileId,
  useFullProfileMemory,
  expertSlug,
  languageSlug,
  isThreadLocked,
  initialFontSize,
  initialSuggestionsAutoExpand = true,
  getAccessToken,
  onSwitchProfile,
  onChangeExpert,
  onChangeLanguage,
  onToggleMemory,
  onSaved,
  onClose,
}) => {
  const { appUser, astrologyMode, setAstrologyMode, refreshUser } = useAuth();
  const [fontSize, setFontSize] = useState<ChatFontSize>(initialFontSize);
  const [defaultCouncilMode, setDefaultCouncilMode] = useState<AstrologyMode>(() => {
    if (!isPreviewMode && appUser?.default_astrology_mode) {
      return appUser.default_astrology_mode === 'western' ? 'western' : 'vedic';
    }
    if (!isPreviewMode && appUser?.default_expert === 'western_astrologer') {
      return 'western';
    }
    return astrologyMode === 'western' ? 'western' : 'vedic';
  });
  const [suggestionsAutoExpand, setSuggestionsAutoExpand] = useState<boolean>(
    initialSuggestionsAutoExpand
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFontSize(initialFontSize);
      const resolvedMode: AstrologyMode = isPreviewMode
        ? astrologyMode
        : appUser?.default_astrology_mode === 'western' ||
          (!appUser?.default_astrology_mode && appUser?.default_expert === 'western_astrologer')
        ? 'western'
        : 'vedic';
      setDefaultCouncilMode(resolvedMode);
      setSuggestionsAutoExpand(initialSuggestionsAutoExpand);
      setError(null);
    }
  }, [
    isOpen,
    isPreviewMode,
    initialFontSize,
    initialSuggestionsAutoExpand,
    appUser?.default_astrology_mode,
    appUser?.default_expert,
    astrologyMode,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeExpertLabel =
    catalog?.experts.find((opt) => opt.slug === expertSlug)?.displayName || 'Vedic Astrologer';
  const activeProfileObj = profiles.find((p) => p.id === activeProfileId);
  const activeProfileLabel = activeProfileObj
    ? getProfileDisplayLabel(activeProfileObj)
    : 'General (No Chart)';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const savedDefaultExpert =
      defaultCouncilMode === 'western' ? 'western_astrologer' : 'council_synthesis';

    if (isPreviewMode) {
      setAstrologyMode(defaultCouncilMode);
      onSaved({
        chatFontSize: fontSize,
        defaultExpert: savedDefaultExpert,
        defaultLanguage: languageSlug,
        suggestionsAutoExpand,
        defaultAstrologyMode: defaultCouncilMode,
      });
      onClose();
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to save chat settings.');

      const res = await fetch('/api/app/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chat_font_size: fontSize,
          default_astrology_mode: defaultCouncilMode,
          default_expert: savedDefaultExpert,
          default_language: languageSlug,
          suggestions_auto_expand: suggestionsAutoExpand,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not update chat settings');
      }

      setAstrologyMode(defaultCouncilMode);
      await refreshUser();
      onSaved({
        chatFontSize: fontSize,
        defaultExpert: savedDefaultExpert,
        defaultLanguage: languageSlug,
        suggestionsAutoExpand,
        defaultAstrologyMode: defaultCouncilMode,
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
        className="animate-cc-drawer-in w-full max-w-lg rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
              Chat Settings
            </h2>
            <p className="text-[11px] text-[#8B8275]">
              Profile, consultation style, language, and reading preferences
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

        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 max-h-[82dvh] overflow-y-auto">
          {/* Unified Consultation + Reading Preferences (No Duplicates) */}
          <div className="space-y-4">
            {/* Topmost Field: Profile */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-medium text-[#5C5449]">
                  Profile
                </label>
                {isThreadLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#8B8275]">
                    <Lock className="h-3 w-3" />
                    <span>Context locked</span>
                  </span>
                )}
              </div>

              {isThreadLocked ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/80 px-3.5 py-2.5 text-xs font-medium text-[#3D3830]">
                  <Lock className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                  <span className="truncate">{activeProfileLabel}</span>
                </div>
              ) : (
                <CustomSelect
                  value={activeProfileId || ''}
                  onChange={(val) => onSwitchProfile(val || null)}
                  ariaLabel="Select birth profile"
                  size="sm"
                  surface="elevated"
                  className="w-full"
                  icon={<UserCheck className="h-3.5 w-3.5 text-[#8B8275]" />}
                  options={[
                    { value: '', label: 'General (No Chart)' },
                    ...profiles.map((p) => ({
                      value: p.id,
                      label: getProfileDisplayLabel(p),
                    })),
                  ]}
                />
              )}
            </div>

            {/* Context-Locked Pair: Council & Editable Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Council
                </label>
                {isThreadLocked ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/80 px-3.5 py-2.5 text-xs font-medium text-[#3D3830]">
                    <Lock className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                    <span className="truncate">{activeExpertLabel}</span>
                  </div>
                ) : (
                  <CustomSelect
                    value={expertSlug}
                    onChange={onChangeExpert}
                    ariaLabel="Select council guide"
                    size="sm"
                    surface="elevated"
                    className="w-full"
                    options={(catalog?.experts || []).map((opt) => ({
                      value: opt.slug,
                      label: opt.displayName,
                    }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Language
                </label>
                <CustomSelect
                  value={languageSlug}
                  onChange={onChangeLanguage}
                  ariaLabel="Select consultation language"
                  size="sm"
                  surface="elevated"
                  className="w-full"
                  options={(catalog?.languages || []).map((opt) => ({
                    value: opt.slug,
                    label: opt.displayName,
                  }))}
                />
              </div>
            </div>

            {isThreadLocked && (
              <p className="text-[11px] text-[#8B8275] leading-relaxed -mt-1">
                Profile and council guide are locked for this thread. Start a New Chat to switch them; all fields below remain editable anytime.
              </p>
            )}

            {/* Default Council (Always Editable — sets default tradition & new + tab astrologer) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-medium text-[#5C5449]">
                  Default Council
                </label>
                <span className="text-[11px] text-[#8B8275]">
                  New chats &amp; + tabs
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F1ECE3] p-1 border border-[#3D3830]/10">
                {(
                  [
                    { id: 'vedic', label: 'Vedic Astrologer', expert: 'council_synthesis' },
                    { id: 'western', label: 'Western Astrologer', expert: 'western_astrologer' },
                  ] as const
                ).map((opt) => {
                  const active = defaultCouncilMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDefaultCouncilMode(opt.id);
                        if (!isThreadLocked) {
                          onChangeExpert(opt.expert);
                        }
                      }}
                      className={`rounded-xl py-2 px-3 text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                          : 'text-[#5C5449] hover:text-[#3D3830]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reading Font Size */}
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
                      className={`rounded-xl py-2 text-xs font-medium transition-colors cursor-pointer ${
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

            {/* Suggestions Default Expansion (OFF collapses by default; never disables) */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#3D3830]">Suggestions</p>
                <p className="text-[11px] text-[#8B8275]">
                  {suggestionsAutoExpand
                    ? 'Expanded below replies (Followup & Deeper analysis)'
                    : 'Collapsed by default below replies — tap the arrow anytime to expand'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={suggestionsAutoExpand}
                aria-label="Toggle default expansion for Suggestions"
                onClick={() => setSuggestionsAutoExpand((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  suggestionsAutoExpand ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform duration-200 ${
                    suggestionsAutoExpand ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Longitudinal Context Memory (Active for Profiles, General & Learning) */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3.5 py-2.5">
              <div>
                <p className="text-xs font-medium text-[#3D3830]">
                  {activeProfileId
                    ? 'Longitudinal Profile Memory'
                    : expertSlug === 'learn_astrology'
                    ? 'Longitudinal Learning Memory'
                    : 'Longitudinal General Memory'}
                </p>
                <p className="text-[11px] text-[#8B8275]">
                  {activeProfileId
                    ? 'Carry key life context across sessions for this chart'
                    : expertSlug === 'learn_astrology'
                    ? 'Carry your astrology study progress across learning sessions'
                    : 'Carry context across your General discussions'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useFullProfileMemory}
                onClick={onToggleMemory}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  useFullProfileMemory
                    ? 'border-[#3D3830]/25 bg-[#4A453D] text-[#FAF7F2]'
                    : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#5C5449]'
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>{useFullProfileMemory ? 'On' : 'Off'}</span>
              </button>
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
              className="rounded-full px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50 cursor-pointer"
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
