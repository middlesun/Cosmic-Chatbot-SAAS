import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import Tooltip from './Tooltip';
import type {
  ActiveChatTab,
  ChatCatalog,
  CompanionArchetypeSlug,
  ConversationRecord,
} from './chatTypes';

interface ComposerTabStripProps {
  tabs: ActiveChatTab[];
  activeTabId: string;
  maxTabs?: number;
  catalog: ChatCatalog | null;
  pastCompanionConversations: ConversationRecord[];
  recentConversations: ConversationRecord[];
  isStreamingTabId?: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddCouncilTab: (expertSlug: string) => void;
  onAddCompanionArchetypeTab: (archetype: CompanionArchetypeSlug) => void;
  onOpenExistingConversationAsTab: (conv: ConversationRecord) => void;
}

const COMPANION_QUICK_TYPES: Array<{
  slug: CompanionArchetypeSlug;
  label: string;
  note: string;
}> = [
  { slug: 'find_someone', label: 'Find someone', note: 'Match by what is on your mind' },
  { slug: 'friend', label: 'Friend', note: 'Easy, grounded company' },
  { slug: 'listener', label: 'Listener', note: 'Unhurried space to be heard' },
  { slug: 'motivator', label: 'Motivator', note: 'Steady encouragement & lift' },
  { slug: 'life_coach', label: 'Life coach', note: 'Accountability & candid clarity' },
  { slug: 'spiritual_guide', label: 'Spiritual guide', note: 'Attuned to your beliefs & depth' },
];

const ComposerTabStrip: React.FC<ComposerTabStripProps> = ({
  tabs,
  activeTabId,
  maxTabs = 5,
  catalog,
  pastCompanionConversations,
  recentConversations,
  isStreamingTabId = null,
  onSelectTab,
  onCloseTab,
  onAddCouncilTab,
  onAddCompanionArchetypeTab,
  onOpenExistingConversationAsTab,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pickerTab, setPickerTab] = useState<'council' | 'companion' | 'recent'>('council');
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const canAddMore = tabs.length < maxTabs;

  useEffect(() => {
    if (!showAddMenu) return;
    const handleOutside = (e: PointerEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddMenu(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [showAddMenu]);

  const openConversationIds = new Set(
    tabs.map((t) => t.conversationId).filter((id): id is string => Boolean(id))
  );

  const availableRecent = recentConversations
    .filter((c) => !openConversationIds.has(c.id))
    .slice(0, 8);

  const renderPillarIcon = (pillar: ActiveChatTab['pillar'], active: boolean) => {
    const cls = `h-3 w-3 shrink-0 ${active ? 'text-[#B8965A]' : 'text-[#8B8275]'}`;
    if (pillar === 'companion') return <HeartHandshake className={cls} />;
    if (pillar === 'clarity') return <Lightbulb className={cls} />;
    return <Sparkles className={cls} />;
  };

  return (
    <div className="relative flex items-end gap-1 pl-2 sm:pl-3 pr-11 min-w-0">
      {/* Scrollable Horizontal Active Thread Tabs */}
      <div className="flex items-end gap-1 overflow-x-auto no-scrollbar min-w-0 max-w-full">
        {tabs.map((tab) => {
          const isActive = tab.tabId === activeTabId;
          const isClosable = !tab.isCore && tabs.length > 1;
          const isTabStreaming = isStreamingTabId === tab.tabId;

          return (
            <div
              key={tab.tabId}
              className={`group relative inline-flex items-center gap-1 rounded-t-xl border border-b-0 text-[11px] transition-all duration-150 shrink-0 max-w-[138px] sm:max-w-[162px] ${
                isActive
                  ? 'bg-[#FDFBF7] border-[#3D3830]/18 text-[#3D3830] font-semibold -mb-px pb-[5px] pt-[5px] z-20 shadow-[0_-2px_8px_-4px_rgba(31,34,41,0.12)]'
                  : 'bg-[#F1ECE3]/90 border-[#3D3830]/12 text-[#5C5449] font-medium hover:bg-[#EAE3D7] hover:text-[#3D3830] pb-[4px] pt-[4px] z-10'
              } ${isClosable ? 'pl-2.5 pr-1.5' : 'px-2.5'}`}
            >
              <button
                type="button"
                onClick={() => onSelectTab(tab.tabId)}
                className="inline-flex items-center gap-1.5 min-w-0 max-w-full cursor-pointer whitespace-nowrap"
                title={tab.subtitle ? `${tab.label} — ${tab.subtitle}` : tab.label}
              >
                {renderPillarIcon(tab.pillar, isActive)}
                <span className="truncate">{tab.label}</span>
                {isTabStreaming && (
                  <span
                    aria-label="Responding"
                    className="h-1.5 w-1.5 rounded-full bg-[#B8965A] animate-pulse shrink-0"
                  />
                )}
              </button>

              {isClosable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.tabId);
                  }}
                  aria-label={`Close ${tab.label} tab`}
                  className={`p-0.5 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/10 transition-opacity cursor-pointer shrink-0 ${
                    isActive ? 'opacity-75 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* '+' Icon-Only Add Tab Trigger (up to 5 active tabs) */}
        <div ref={addMenuRef} className="relative shrink-0">
          <Tooltip
            content={
              canAddMore
                ? `Add chat tab (${tabs.length}/${maxTabs})`
                : `Maximum ${maxTabs} active tabs open`
            }
            placement="top"
          >
            <button
              type="button"
              disabled={!canAddMore}
              onClick={() => setShowAddMenu((v) => !v)}
              aria-expanded={showAddMenu}
              aria-label="Add a new chat tab"
              className={`inline-flex h-[25px] w-7 items-center justify-center rounded-t-xl border border-b-0 transition-all duration-150 ${
                showAddMenu
                  ? 'border-[#3D3830]/25 bg-[#4A453D] text-[#FAF7F2] cursor-pointer'
                  : canAddMore
                  ? 'border-[#3D3830]/14 bg-[#F1ECE3]/90 text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830] cursor-pointer'
                  : 'border-[#3D3830]/10 bg-[#F1ECE3]/50 text-[#8B8275]/55 cursor-not-allowed'
              }`}
            >
              <Plus
                className={`h-3.5 w-3.5 transition-transform duration-150 ${
                  showAddMenu ? 'rotate-45' : ''
                }`}
              />
            </button>
          </Tooltip>

          {/* Dropup Add Tab Picker Popover */}
          {showAddMenu && (
            <div className="animate-cc-dropdown-up absolute bottom-full left-0 mb-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#3D3830]/16 bg-[#FDFBF7] shadow-2xl overflow-hidden">
              {/* Segmented Pillar Switcher */}
              <div className="flex items-center gap-1 p-1.5 bg-[#F1ECE3]/85 border-b border-[#3D3830]/10">
                <button
                  type="button"
                  onClick={() => setPickerTab('council')}
                  className={`flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    pickerTab === 'council'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Council
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('companion')}
                  className={`flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    pickerTab === 'companion'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Companion
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('recent')}
                  className={`flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    pickerTab === 'recent'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Saved ({availableRecent.length})
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                {pickerTab === 'council' && (
                  <>
                    <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                      Starts a fresh chat — attach a birth profile anytime
                    </p>
                    {(catalog?.experts || []).map((guide) => (
                      <button
                        key={guide.slug}
                        type="button"
                        onClick={() => {
                          setShowAddMenu(false);
                          onAddCouncilTab(guide.slug);
                        }}
                        className="w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <Compass className="h-3.5 w-3.5 text-[#8B7355] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#3D3830] truncate">
                            {guide.displayName}
                          </p>
                          <p className="text-[11px] text-[#8B8275] line-clamp-1">
                            {guide.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {pickerTab === 'companion' && (
                  <>
                    <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                      Match a new companion
                    </p>
                    {COMPANION_QUICK_TYPES.map((ct) => (
                      <button
                        key={ct.slug}
                        type="button"
                        onClick={() => {
                          setShowAddMenu(false);
                          onAddCompanionArchetypeTab(ct.slug);
                        }}
                        className="w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#3D3830] truncate">
                            {ct.label}
                          </p>
                          <p className="text-[11px] text-[#8B8275] truncate">{ct.note}</p>
                        </div>
                      </button>
                    ))}

                    {pastCompanionConversations.length > 0 && (
                      <div className="border-t border-[#3D3830]/10 mt-1.5 pt-1.5 space-y-0.5">
                        <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                          Past companions
                        </p>
                        {pastCompanionConversations.slice(0, 5).map((conv) => {
                          const name =
                            conv.companion_persona_json?.name ||
                            conv.title.split('·')[0].trim();
                          return (
                            <button
                              key={conv.id}
                              type="button"
                              onClick={() => {
                                setShowAddMenu(false);
                                onOpenExistingConversationAsTab(conv);
                              }}
                              className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#3D3830] truncate">
                                  {name}
                                </p>
                                <p className="text-[10px] text-[#8B8275] truncate">
                                  {conv.companion_persona_json?.role_label || conv.title}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {pickerTab === 'recent' && (
                  <>
                    {availableRecent.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-[#8B8275]">
                        No other saved threads to pin right now.
                      </p>
                    ) : (
                      availableRecent.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => {
                            setShowAddMenu(false);
                            onOpenExistingConversationAsTab(conv);
                          }}
                          className="w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-[#8B7355] mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[#3D3830] truncate">
                              {conv.title}
                            </p>
                            <p className="text-[10px] text-[#8B8275] truncate">
                              {conv.pillar === 'companion'
                                ? 'Companion'
                                : conv.pillar === 'clarity'
                                ? 'Clarity'
                                : 'Council'}{' '}
                              · {new Date(conv.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComposerTabStrip;
