import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import Tooltip from './Tooltip';
import CompanionAvatar from './CompanionAvatar';
import type {
  ActiveChatTab,
  ChatCatalog,
  CompanionArchetypeSlug,
  ConversationRecord,
  PublicCompanionCard,
} from './chatTypes';

interface ComposerTabStripProps {
  tabs: ActiveChatTab[];
  activeTabId: string;
  maxTabs?: number;
  catalog: ChatCatalog | null;
  companionCatalog?: PublicCompanionCard[];
  defaultAstrologyMode?: 'vedic' | 'western';
  activeTabLocked?: boolean;
  pastCompanionConversations: ConversationRecord[];
  recentConversations: ConversationRecord[];
  isStreamingTabId?: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTabs: (orderedTabIds: string[]) => void;
  onRenameTab: (tabId: string, nextLabel: string) => void;
  onQuickAddTab: () => void;
  onReplaceTabWithCouncil: (targetTabId: string, expertSlug: string) => void;
  onReplaceTabWithCompanionArchetype: (
    targetTabId: string,
    archetype: CompanionArchetypeSlug
  ) => void;
  onReplaceTabWithPresetCompanion?: (
    targetTabId: string,
    card: PublicCompanionCard
  ) => void;
  onOpenCompanionsDirectory?: () => void;
  onReplaceTabWithConversation: (targetTabId: string, conv: ConversationRecord) => void;
  onReplaceTabWithClarity: (targetTabId: string) => void;
}

interface PopoverCoords {
  left: number;
  bottom: number;
  width: number;
}

const MOBILE_MAX_VISIBLE_TABS = 3;
const TAB_LABEL_MAX_CHARS = 9;
const FIXED_DESKTOP_TAB_WIDTH = 108;

function formatFixedTabLabel(label: string): string {
  const clean = label.trim();
  if (clean.length <= TAB_LABEL_MAX_CHARS) return clean;
  return `${clean.slice(0, TAB_LABEL_MAX_CHARS)}..`;
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

function estimateDesktopTabWidth(_tab: ActiveChatTab): number {
  return FIXED_DESKTOP_TAB_WIDTH;
}

const ComposerTabStrip: React.FC<ComposerTabStripProps> = ({
  tabs,
  activeTabId,
  maxTabs = 10,
  catalog,
  companionCatalog = [],
  defaultAstrologyMode = 'vedic',
  activeTabLocked = false,
  pastCompanionConversations,
  recentConversations,
  isStreamingTabId = null,
  isExpanded,
  onToggleExpand,
  onSelectTab,
  onCloseTab,
  onReorderTabs,
  onRenameTab,
  onQuickAddTab,
  onReplaceTabWithCouncil,
  onReplaceTabWithCompanionArchetype,
  onReplaceTabWithPresetCompanion,
  onOpenCompanionsDirectory,
  onReplaceTabWithConversation,
  onReplaceTabWithClarity,
}) => {
  const [customizeTabId, setCustomizeTabId] = useState<string | null>(null);
  const [customizeAnchorEl, setCustomizeAnchorEl] = useState<HTMLElement | null>(null);
  const [addMenuCoords, setAddMenuCoords] = useState<PopoverCoords | null>(null);
  const [pickerTab, setPickerTab] = useState<'chats' | 'council' | 'companions'>('council');

  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [overflowCoords, setOverflowCoords] = useState<PopoverCoords | null>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [trackWidth, setTrackWidth] = useState<number>(640);

  // Drag-and-drop sideways reorder state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  // Inline rename state (works both in tray and inside overflow menu)
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const trackRef = useRef<HTMLDivElement | null>(null);
  const addPortalRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowPortalRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const overflowCloseTimerRef = useRef<number | null>(null);

  // Touch drag / long-press tracking for mobile tabs
  const touchMetaRef = useRef<{
    tabId: string;
    startX: number;
    startY: number;
    moved: boolean;
    longPressTimer: number | null;
    suppressNextClick: boolean;
  } | null>(null);

  const canAddMore = tabs.length < maxTabs;
  const showAddMenu = Boolean(customizeTabId);

  // Responsive breakpoint listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Track width observer for responsive desktop overflow calculation
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setTrackWidth(el.clientWidth || 640);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute visible vs overflow tabs cleanly
  const { visibleTabs, overflowTabs } = useMemo(() => {
    if (tabs.length === 0) {
      return { visibleTabs: [] as ActiveChatTab[], overflowTabs: [] as ActiveChatTab[] };
    }

    if (isMobile) {
      if (tabs.length <= MOBILE_MAX_VISIBLE_TABS) {
        return { visibleTabs: tabs, overflowTabs: [] as ActiveChatTab[] };
      }
      const initialSlice = tabs.slice(0, MOBILE_MAX_VISIBLE_TABS);
      const activeInInitial = initialSlice.some((t) => t.tabId === activeTabId);
      let visible: ActiveChatTab[];
      if (activeInInitial) {
        visible = initialSlice;
      } else {
        const activeTab = tabs.find((t) => t.tabId === activeTabId);
        visible = activeTab
          ? [...tabs.slice(0, MOBILE_MAX_VISIBLE_TABS - 1), activeTab]
          : initialSlice;
      }
      const visibleSet = new Set(visible.map((t) => t.tabId));
      return {
        visibleTabs: visible,
        overflowTabs: tabs.filter((t) => !visibleSet.has(t.tabId)),
      };
    }

    // Desktop width-aware partitioning
    const addControlReserve = 30;
    const overflowControlReserve = 28;
    const gapPx = 1;

    const totalAllWidth = tabs.reduce(
      (sum, t, idx) => sum + estimateDesktopTabWidth(t) + (idx > 0 ? gapPx : 0),
      0
    );

    if (totalAllWidth <= trackWidth - addControlReserve) {
      return { visibleTabs: tabs, overflowTabs: [] as ActiveChatTab[] };
    }

    const budget = Math.max(150, trackWidth - addControlReserve - overflowControlReserve);
    const activeTab = tabs.find((t) => t.tabId === activeTabId) || tabs[0];
    const chosenIds = new Set<string>();
    let usedWidth = 0;

    if (activeTab) {
      chosenIds.add(activeTab.tabId);
      usedWidth = estimateDesktopTabWidth(activeTab);
    }

    for (const tab of tabs) {
      if (chosenIds.has(tab.tabId)) continue;
      const w = estimateDesktopTabWidth(tab) + gapPx;
      if (usedWidth + w <= budget || chosenIds.size < 2) {
        chosenIds.add(tab.tabId);
        usedWidth += w;
      }
    }

    return {
      visibleTabs: tabs.filter((t) => chosenIds.has(t.tabId)),
      overflowTabs: tabs.filter((t) => !chosenIds.has(t.tabId)),
    };
  }, [tabs, activeTabId, isMobile, trackWidth]);

  // Helper to compute portal coordinates right above a trigger button
  const computePopoverCoords = useCallback(
    (anchorEl: HTMLElement | null, desiredWidth: number): PopoverCoords | null => {
      if (!anchorEl || typeof window === 'undefined') return null;
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 10;
      const width = Math.min(desiredWidth, vw - margin * 2);
      let left = rect.left;
      if (left + width > vw - margin) {
        left = vw - margin - width;
      }
      if (left < margin) {
        left = margin;
      }
      const bottom = Math.max(12, window.innerHeight - rect.top + 8);
      return { left, bottom, width };
    },
    []
  );

  // Sync Tab Customization Menu coordinates & outside click / Escape
  useEffect(() => {
    if (!customizeTabId) return;
    setAddMenuCoords(
      computePopoverCoords(
        customizeAnchorEl || trackRef.current,
        isMobile ? 308 : 332
      )
    );

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        addPortalRef.current?.contains(target) ||
        target.closest('[data-tab-customize-trigger="true"]')
      ) {
        return;
      }
      setCustomizeTabId(null);
      setCustomizeAnchorEl(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCustomizeTabId(null);
        setCustomizeAnchorEl(null);
      }
    };
    const handleResize = () => {
      setAddMenuCoords(
        computePopoverCoords(
          customizeAnchorEl || trackRef.current,
          isMobile ? 308 : 332
        )
      );
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [customizeTabId, customizeAnchorEl, computePopoverCoords, isMobile]);

  // Close customization popup automatically if its target tab gets locked or removed
  useEffect(() => {
    if (!customizeTabId) return;
    const target = tabs.find((t) => t.tabId === customizeTabId);
    const locked =
      !target ||
      Boolean(target.conversationId) ||
      (target.tabId === activeTabId && activeTabLocked);
    if (locked) {
      setCustomizeTabId(null);
      setCustomizeAnchorEl(null);
    }
  }, [customizeTabId, tabs, activeTabId, activeTabLocked]);

  // Sync Overflow Menu coordinates & outside click / Escape
  useEffect(() => {
    if (!showOverflowMenu) return;
    setOverflowCoords(computePopoverCoords(overflowButtonRef.current, 248));

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        overflowButtonRef.current?.contains(target) ||
        overflowPortalRef.current?.contains(target)
      ) {
        return;
      }
      setShowOverflowMenu(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOverflowMenu(false);
    };
    const handleResize = () => {
      setOverflowCoords(computePopoverCoords(overflowButtonRef.current, 248));
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [showOverflowMenu, computePopoverCoords]);

  // Close overflow menu automatically if all tabs now fit
  useEffect(() => {
    if (overflowTabs.length === 0 && showOverflowMenu) {
      setShowOverflowMenu(false);
    }
  }, [overflowTabs.length, showOverflowMenu]);

  // Focus & select text when entering inline rename
  useEffect(() => {
    if (!editingTabId) return;
    const raf = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingTabId]);

  const clearOverflowCloseTimer = () => {
    if (overflowCloseTimerRef.current !== null) {
      window.clearTimeout(overflowCloseTimerRef.current);
      overflowCloseTimerRef.current = null;
    }
  };

  const openOverflowMenu = useCallback(() => {
    clearOverflowCloseTimer();
    setCustomizeTabId(null);
    setCustomizeAnchorEl(null);
    setOverflowCoords(computePopoverCoords(overflowButtonRef.current, 248));
    setShowOverflowMenu(true);
  }, [computePopoverCoords]);

  const scheduleCloseOverflowMenu = useCallback(() => {
    clearOverflowCloseTimer();
    overflowCloseTimerRef.current = window.setTimeout(() => {
      setShowOverflowMenu(false);
    }, 180);
  }, []);

  const startEditingTab = useCallback((tab: ActiveChatTab) => {
    setEditingTabId(tab.tabId);
    setEditingValue(tab.label);
  }, []);

  const commitEditingTab = useCallback(() => {
    if (!editingTabId) return;
    const trimmed = editingValue.trim();
    if (trimmed) {
      onRenameTab(editingTabId, trimmed);
    }
    setEditingTabId(null);
    setEditingValue('');
  }, [editingTabId, editingValue, onRenameTab]);

  const cancelEditingTab = useCallback(() => {
    setEditingTabId(null);
    setEditingValue('');
  }, []);

  const reorderByIds = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const fromIdx = tabs.findIndex((t) => t.tabId === sourceId);
      const toIdx = tabs.findIndex((t) => t.tabId === targetId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

      const next = [...tabs];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorderTabs(next.map((t) => t.tabId));
    },
    [tabs, onReorderTabs]
  );

  const openConversationIds = new Set(
    tabs.map((t) => t.conversationId).filter((id): id is string => Boolean(id))
  );

  const availableRecent = recentConversations
    .filter((c) => !openConversationIds.has(c.id))
    .slice(0, 12);

  const orderedCouncilExperts = useMemo(() => {
    const experts = [...(catalog?.experts || [])];
    const prioritySlug =
      defaultAstrologyMode === 'western' ? 'western_astrologer' : 'vedic_astrologer';
    experts.sort((a, b) => {
      if (a.slug === prioritySlug && b.slug !== prioritySlug) return -1;
      if (b.slug === prioritySlug && a.slug !== prioritySlug) return 1;
      return 0;
    });
    return experts;
  }, [catalog?.experts, defaultAstrologyMode]);

  const companionBySlug = useMemo(() => {
    const map = new Map<string, PublicCompanionCard>();
    for (const card of companionCatalog) {
      map.set(card.slug.toLowerCase(), card);
    }
    return map;
  }, [companionCatalog]);

  const { displayedPastCompanions, otherPresetCompanions } = useMemo(() => {
    const pastSlice = pastCompanionConversations.slice(0, 6);
    const seenSlugs = new Set<string>();
    for (const conv of pastSlice) {
      const slug = (
        conv.companion_slug ||
        conv.companion_persona_json?.slug ||
        ''
      )
        .trim()
        .toLowerCase();
      if (slug) seenSlugs.add(slug);
    }
    const others = companionCatalog.filter(
      (c) => !seenSlugs.has(c.slug.toLowerCase())
    );
    return {
      displayedPastCompanions: pastSlice,
      otherPresetCompanions: others,
    };
  }, [pastCompanionConversations, companionCatalog]);

  const closeCustomizeMenu = () => {
    setCustomizeTabId(null);
    setCustomizeAnchorEl(null);
  };

  const renderPillarIcon = (pillar: ActiveChatTab['pillar'], active: boolean) => {
    const cls = `h-3 w-3 shrink-0 ${active ? 'text-[#B8965A]' : 'text-[#8B8275]'}`;
    if (pillar === 'companion') return <HeartHandshake className={cls} />;
    if (pillar === 'clarity') return <Lightbulb className={cls} />;
    return <Sparkles className={cls} />;
  };

  const addMenuPortal =
    showAddMenu && customizeTabId && addMenuCoords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={addPortalRef}
            style={{
              position: 'fixed',
              left: `${addMenuCoords.left}px`,
              bottom: `${addMenuCoords.bottom}px`,
              width: `${addMenuCoords.width}px`,
              zIndex: 240,
            }}
            className="animate-cc-dropdown-up rounded-2xl border border-[#3D3830]/[0.16] bg-[#FDFBF7] shadow-2xl overflow-hidden"
          >
            {/* Segmented Switcher: Chats | Council | Companions */}
            <div className="flex items-center gap-1 p-1.5 bg-[#F1ECE3]/90 border-b border-[#3D3830]/10">
              <button
                type="button"
                onClick={() => setPickerTab('chats')}
                className={`flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  pickerTab === 'chats'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                Chats ({availableRecent.length})
              </button>
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
                onClick={() => setPickerTab('companions')}
                className={`flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  pickerTab === 'companions'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                Companions
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
              {pickerTab === 'chats' && (
                <>
                  {availableRecent.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-[#8B8275]">
                      No other saved chats to open right now.
                    </p>
                  ) : (
                    availableRecent.map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          const targetId = customizeTabId;
                          closeCustomizeMenu();
                          if (targetId) onReplaceTabWithConversation(targetId, conv);
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
                              : 'Council'}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}

              {pickerTab === 'council' && (
                <>
                  <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                    Switch this tab before sending your first message
                  </p>
                  {orderedCouncilExperts.map((guide) => (
                    <button
                      key={guide.slug}
                      type="button"
                      onClick={() => {
                        const targetId = customizeTabId;
                        closeCustomizeMenu();
                        if (targetId) onReplaceTabWithCouncil(targetId, guide.slug);
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

                  <div className="border-t border-[#3D3830]/10 mt-1.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = customizeTabId;
                        closeCustomizeMenu();
                        if (targetId) onReplaceTabWithClarity(targetId);
                      }}
                      className="w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-[#B8965A] mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#3D3830] truncate">
                          Clarity
                        </p>
                        <p className="text-[11px] text-[#8B8275] line-clamp-1">
                          Temporary off-record sidechat to clear doubts
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {pickerTab === 'companions' && (
                <>
                  {onOpenCompanionsDirectory && (
                    <button
                      type="button"
                      onClick={() => {
                        closeCustomizeMenu();
                        onOpenCompanionsDirectory();
                      }}
                      className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-2 mb-1 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                        <span className="text-xs font-medium text-[#3D3830] truncate">
                          Browse all companions
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                    </button>
                  )}

                  {displayedPastCompanions.length > 0 && (
                    <div className="pb-1.5 mb-1.5 border-b border-[#3D3830]/10 space-y-0.5">
                      <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                        Past companions
                      </p>
                      {displayedPastCompanions.map((conv) => {
                        const slug = (
                          conv.companion_slug ||
                          conv.companion_persona_json?.slug ||
                          ''
                        )
                          .trim()
                          .toLowerCase();
                        const card = slug ? companionBySlug.get(slug) : undefined;
                        const name =
                          card?.name ||
                          conv.companion_persona_json?.name ||
                          conv.title.split('·')[0].trim();
                        const previewSnippet =
                          conv.last_message_preview?.trim() ||
                          card?.primary_expertise ||
                          conv.companion_persona_json?.role_label ||
                          conv.title;
                        return (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => {
                              const targetId = customizeTabId;
                              closeCustomizeMenu();
                              if (targetId) onReplaceTabWithConversation(targetId, conv);
                            }}
                            className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                          >
                            <CompanionAvatar
                              name={name}
                              avatarUrl={
                                card?.avatar_url ??
                                conv.companion_persona_json?.avatar_url
                              }
                              palette={
                                card?.monogram_palette ??
                                conv.companion_persona_json?.monogram_palette
                              }
                              size="xs"
                              shape="circle"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[#3D3830] truncate">
                                {name}
                              </p>
                              <p className="text-[11px] text-[#8B8275] truncate">
                                {previewSnippet}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {otherPresetCompanions.length > 0 && onReplaceTabWithPresetCompanion && (
                    <div className="pb-1.5 mb-1.5 border-b border-[#3D3830]/10 space-y-0.5">
                      <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                        {displayedPastCompanions.length > 0
                          ? 'Other companions'
                          : 'Companions'}
                      </p>
                      {otherPresetCompanions.map((card) => (
                        <button
                          key={card.slug}
                          type="button"
                          onClick={() => {
                            const targetId = customizeTabId;
                            closeCustomizeMenu();
                            if (targetId) {
                              onReplaceTabWithPresetCompanion(targetId, card);
                            }
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <CompanionAvatar
                            name={card.name}
                            avatarUrl={card.avatar_url}
                            palette={card.monogram_palette}
                            size="xs"
                            shape="circle"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[#3D3830] truncate">
                              {card.name}
                            </p>
                            <p className="text-[11px] text-[#8B8275] truncate">
                              {card.primary_expertise}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="px-2.5 py-1 text-[10px] text-[#8B8275]">
                    Match a new companion
                  </p>
                  {COMPANION_QUICK_TYPES.map((ct) => (
                    <button
                      key={ct.slug}
                      type="button"
                      onClick={() => {
                        const targetId = customizeTabId;
                        closeCustomizeMenu();
                        if (targetId) onReplaceTabWithCompanionArchetype(targetId, ct.slug);
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
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const overflowMenuPortal =
    showOverflowMenu && overflowTabs.length > 0 && overflowCoords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={overflowPortalRef}
            onMouseEnter={() => {
              if (!isMobile) clearOverflowCloseTimer();
            }}
            onMouseLeave={() => {
              if (!isMobile && editingTabId === null) scheduleCloseOverflowMenu();
            }}
            style={{
              position: 'fixed',
              left: `${overflowCoords.left}px`,
              bottom: `${overflowCoords.bottom}px`,
              width: `${overflowCoords.width}px`,
              zIndex: 240,
            }}
            className="animate-cc-dropdown-up rounded-2xl border border-[#3D3830]/[0.16] bg-[#FDFBF7] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#F1ECE3]/90 border-b border-[#3D3830]/10">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#8B8275]">
                More Open Tabs ({overflowTabs.length})
              </span>
              <span className="text-[10px] text-[#8B8275] tabular-nums">
                {tabs.length}/{maxTabs}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              {overflowTabs.map((tab) => {
                const isActive = tab.tabId === activeTabId;
                const isClosable = tabs.length > 1;
                const isEditing = editingTabId === tab.tabId;
                const isTabStreaming = isStreamingTabId === tab.tabId;

                return (
                  <div
                    key={tab.tabId}
                    className={`group flex items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-[#F1ECE3] text-[#3D3830] font-semibold'
                        : 'text-[#5C5449] hover:bg-[#F1ECE3]/70 hover:text-[#3D3830]'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {renderPillarIcon(tab.pillar, isActive)}
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={editingValue}
                          maxLength={80}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEditingTab();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEditingTab();
                            }
                          }}
                          onBlur={commitEditingTab}
                          aria-label={`Rename ${tab.label} tab`}
                          className="w-full min-w-0 rounded-md border border-[#B8965A]/60 bg-[#FDFBF7] px-1.5 py-0.5 text-xs font-medium text-[#3D3830] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (touchMetaRef.current?.suppressNextClick) return;
                          onSelectTab(tab.tabId);
                          setShowOverflowMenu(false);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditingTab(tab);
                        }}
                        onTouchStart={(e) => {
                          const touch = e.touches[0];
                          if (!touch) return;
                          const timer = window.setTimeout(() => {
                            if (touchMetaRef.current && touchMetaRef.current.tabId === tab.tabId && !touchMetaRef.current.moved) {
                              touchMetaRef.current.suppressNextClick = true;
                              startEditingTab(tab);
                            }
                          }, 480);
                          touchMetaRef.current = {
                            tabId: tab.tabId,
                            startX: touch.clientX,
                            startY: touch.clientY,
                            moved: false,
                            longPressTimer: timer,
                            suppressNextClick: false,
                          };
                        }}
                        onTouchMove={(e) => {
                          const meta = touchMetaRef.current;
                          if (!meta || meta.tabId !== tab.tabId) return;
                          const touch = e.touches[0];
                          if (!touch) return;
                          if (Math.abs(touch.clientX - meta.startX) > 8 || Math.abs(touch.clientY - meta.startY) > 8) {
                            meta.moved = true;
                            if (meta.longPressTimer !== null) {
                              window.clearTimeout(meta.longPressTimer);
                              meta.longPressTimer = null;
                            }
                          }
                        }}
                        onTouchEnd={() => {
                          const meta = touchMetaRef.current;
                          if (meta?.longPressTimer !== null && meta?.longPressTimer !== undefined) {
                            window.clearTimeout(meta.longPressTimer);
                          }
                          if (meta && !meta.suppressNextClick) {
                            touchMetaRef.current = null;
                          } else if (meta) {
                            window.setTimeout(() => {
                              touchMetaRef.current = null;
                            }, 120);
                          }
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left text-xs cursor-pointer"
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
                    )}

                    {!isEditing && isClosable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.tabId);
                        }}
                        aria-label={`Close ${tab.label} tab`}
                        className="p-1 rounded-lg text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#3D3830]/10 cursor-pointer shrink-0"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex items-stretch rounded-t-[15px] bg-[#F1ECE3] border-b border-[#3D3830]/10 select-none overflow-hidden">
      {/* Left/Center Recessed Line-Separated Tab Bar */}
      <div
        ref={trackRef}
        role="tablist"
        aria-label="Active chat threads"
        className="flex items-stretch flex-1 min-w-0"
      >
        {visibleTabs.map((tab, idx) => {
          const isActive = tab.tabId === activeTabId;
          const isClosable = tabs.length > 1;
          const canCustomizeTab =
            (tab.pillar === 'council' || tab.pillar === 'companion') &&
            !tab.conversationId &&
            !(isActive && activeTabLocked);
          const isTabStreaming = isStreamingTabId === tab.tabId;
          const isEditing = editingTabId === tab.tabId;
          const isBeingDragged = draggedTabId === tab.tabId;
          const isDropTarget = dragOverTabId === tab.tabId && draggedTabId !== tab.tabId;
          const nextTab = visibleTabs[idx + 1];
          const nextIsActive = nextTab?.tabId === activeTabId;
          const showTrailingDivider = !isActive && !nextIsActive;

          const tabTooltip =
            tab.pillar === 'companion'
              ? 'Feel better talking to companions'
              : tab.pillar === 'clarity'
              ? 'A temporary sidechat to clear doubts'
              : tab.subtitle
              ? `${tab.label} — ${tab.subtitle}`
              : tab.label;

          return (
            <React.Fragment key={tab.tabId}>
              <div
                data-tab-id={tab.tabId}
                role="tab"
                aria-selected={isActive}
                draggable={!isEditing}
                onDragStart={(e) => {
                  if (isEditing) {
                    e.preventDefault();
                    return;
                  }
                  setDraggedTabId(tab.tabId);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', tab.tabId);
                }}
                onDragOver={(e) => {
                  if (!draggedTabId || draggedTabId === tab.tabId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverTabId !== tab.tabId) {
                    setDragOverTabId(tab.tabId);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverTabId === tab.tabId) {
                    setDragOverTabId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = draggedTabId || e.dataTransfer.getData('text/plain');
                  reorderByIds(sourceId, tab.tabId);
                  setDraggedTabId(null);
                  setDragOverTabId(null);
                }}
                onDragEnd={() => {
                  setDraggedTabId(null);
                  setDragOverTabId(null);
                }}
                onTouchStart={(e) => {
                  if (isEditing) return;
                  const targetEl = e.target as HTMLElement;
                  if (targetEl.closest('[data-tab-action="true"]')) return;
                  const touch = e.touches[0];
                  if (!touch) return;
                  const timer = window.setTimeout(() => {
                    if (touchMetaRef.current && touchMetaRef.current.tabId === tab.tabId && !touchMetaRef.current.moved) {
                      touchMetaRef.current.suppressNextClick = true;
                      startEditingTab(tab);
                    }
                  }, 480);
                  touchMetaRef.current = {
                    tabId: tab.tabId,
                    startX: touch.clientX,
                    startY: touch.clientY,
                    moved: false,
                    longPressTimer: timer,
                    suppressNextClick: false,
                  };
                }}
                onTouchMove={(e) => {
                  const meta = touchMetaRef.current;
                  if (!meta || meta.tabId !== tab.tabId) return;
                  const touch = e.touches[0];
                  if (!touch) return;
                  const dx = Math.abs(touch.clientX - meta.startX);
                  const dy = Math.abs(touch.clientY - meta.startY);
                  if (dx > 8 || dy > 8) {
                    meta.moved = true;
                    if (meta.longPressTimer !== null) {
                      window.clearTimeout(meta.longPressTimer);
                      meta.longPressTimer = null;
                    }
                  }
                  if (dx > 14 && dx > dy) {
                    setDraggedTabId(tab.tabId);
                    const under = document.elementFromPoint(touch.clientX, touch.clientY);
                    const targetNode = under?.closest<HTMLElement>('[data-tab-id]');
                    const hoverId = targetNode?.dataset.tabId || null;
                    if (hoverId && hoverId !== tab.tabId) {
                      setDragOverTabId(hoverId);
                    }
                  }
                }}
                onTouchEnd={() => {
                  const meta = touchMetaRef.current;
                  if (meta?.longPressTimer !== null && meta?.longPressTimer !== undefined) {
                    window.clearTimeout(meta.longPressTimer);
                  }
                  if (draggedTabId && dragOverTabId && draggedTabId !== dragOverTabId) {
                    reorderByIds(draggedTabId, dragOverTabId);
                    if (meta) meta.suppressNextClick = true;
                  }
                  setDraggedTabId(null);
                  setDragOverTabId(null);
                  if (meta && !meta.suppressNextClick) {
                    touchMetaRef.current = null;
                  } else if (meta) {
                    window.setTimeout(() => {
                      touchMetaRef.current = null;
                    }, 120);
                  }
                }}
                className={`group relative flex items-center gap-1 h-[31px] text-[11px] transition-colors duration-150 ${
                  isMobile ? 'flex-1 basis-0 min-w-0' : 'w-[108px] shrink-0'
                } ${
                  isActive
                    ? `bg-[#FDFBF7] text-[#3D3830] font-semibold ${
                        idx === 0 ? 'border-r border-[#3D3830]/10' : 'border-x border-[#3D3830]/10'
                      }`
                    : 'bg-transparent text-[#5C5449] font-medium hover:bg-[#FDFBF7]/50 hover:text-[#3D3830]'
                } ${isBeingDragged ? 'opacity-45' : ''} ${
                  isDropTarget ? 'ring-1 ring-inset ring-[#B8965A] bg-[#FDFBF7]/85' : ''
                } px-2`}
              >
                {isEditing ? (
                  <div className="inline-flex items-center gap-1 min-w-0 w-full">
                    {renderPillarIcon(tab.pillar, isActive)}
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={editingValue}
                      maxLength={80}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEditingTab();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEditingTab();
                        }
                      }}
                      onBlur={commitEditingTab}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Rename ${tab.label} tab`}
                      className="w-full min-w-[44px] rounded border border-[#B8965A]/65 bg-[#FAF7F2] px-1 py-0 text-[11px] font-medium text-[#3D3830] focus:outline-none"
                    />
                  </div>
                ) : (
                  <Tooltip content={tabTooltip} placement="top" className="min-w-0 flex-1 max-w-full">
                    <button
                      type="button"
                      onClick={() => {
                        if (touchMetaRef.current?.suppressNextClick) return;
                        onSelectTab(tab.tabId);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditingTab(tab);
                      }}
                      className="inline-flex items-center gap-1 w-full min-w-0 cursor-pointer whitespace-nowrap"
                    >
                      {renderPillarIcon(tab.pillar, isActive)}
                      <span className="truncate">{formatFixedTabLabel(tab.label)}</span>
                      {isTabStreaming && (
                        <span
                          aria-label="Responding"
                          className="h-1.5 w-1.5 rounded-full bg-[#B8965A] animate-pulse shrink-0"
                        />
                      )}
                    </button>
                  </Tooltip>
                )}

                {!isEditing && (canCustomizeTab || isClosable) && (
                  <div
                    className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 rounded-full pl-1.5 pr-0.5 py-0.5 transition-opacity ${
                      isActive
                        ? 'bg-gradient-to-l from-[#FDFBF7] via-[#FDFBF7]/92 to-transparent'
                        : 'bg-gradient-to-l from-[#EFE9DF] via-[#EFE9DF]/92 to-transparent'
                    } ${
                      canCustomizeTab || isActive
                        ? 'opacity-100'
                        : 'opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto'
                    }`}
                  >
                    {canCustomizeTab && (
                      <button
                        type="button"
                        data-tab-action="true"
                        data-tab-customize-trigger="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOverflowMenu(false);
                          if (customizeTabId === tab.tabId) {
                            closeCustomizeMenu();
                            return;
                          }
                          const tabCard = (e.currentTarget.closest('[data-tab-id]') as HTMLElement) || e.currentTarget;
                          if (tab.tabId !== activeTabId) {
                            onSelectTab(tab.tabId);
                          }
                          setPickerTab('council');
                          setCustomizeAnchorEl(tabCard);
                          setCustomizeTabId(tab.tabId);
                        }}
                        aria-expanded={customizeTabId === tab.tabId}
                        aria-label={`Customize ${tab.label} tab`}
                        className={`inline-flex items-center justify-center p-0.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                          customizeTabId === tab.tabId
                            ? 'bg-[#3D3830]/12 text-[#3D3830]'
                            : 'text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/10'
                        }`}
                      >
                        <ChevronDown
                          className={`h-2.5 w-2.5 transition-transform duration-150 ${
                            customizeTabId === tab.tabId ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}

                    {isClosable && (
                      <button
                        type="button"
                        data-tab-action="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (customizeTabId === tab.tabId) {
                            closeCustomizeMenu();
                          }
                          onCloseTab(tab.tabId);
                        }}
                        aria-label={`Close ${tab.label} tab`}
                        className={`p-0.5 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/10 cursor-pointer shrink-0 ${
                          isActive
                            ? 'inline-flex opacity-75 hover:opacity-100'
                            : 'hidden sm:group-hover:inline-flex opacity-70 hover:opacity-100'
                        }`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {showTrailingDivider && (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-px bg-[#3D3830]/15 shrink-0 self-center"
                />
              )}
            </React.Fragment>
          );
        })}

        {/* '...' Overflow Trigger (Desktop hover+click / Mobile click dropup) */}
        {overflowTabs.length > 0 && (
          <>
            <button
              ref={overflowButtonRef}
              type="button"
              onMouseEnter={() => {
                if (!isMobile) openOverflowMenu();
              }}
              onMouseLeave={() => {
                if (!isMobile) scheduleCloseOverflowMenu();
              }}
              onClick={() => {
                if (showOverflowMenu) {
                  setShowOverflowMenu(false);
                } else {
                  openOverflowMenu();
                }
              }}
              aria-expanded={showOverflowMenu}
              aria-label={`Show ${overflowTabs.length} more open tabs`}
              className={`inline-flex h-[31px] items-center justify-center px-2 text-[11px] font-semibold tracking-wider transition-colors cursor-pointer shrink-0 ${
                showOverflowMenu
                  ? 'bg-[#FDFBF7] text-[#3D3830]'
                  : 'text-[#5C5449] hover:bg-[#FDFBF7]/50 hover:text-[#3D3830]'
              }`}
            >
              ...
            </button>
            <span
              aria-hidden="true"
              className="h-3.5 w-px bg-[#3D3830]/15 shrink-0 self-center"
            />
          </>
        )}

        {/* '+' Instant New Tab Trigger (up to 10 active tabs) */}
        <div className="shrink-0 flex items-stretch">
          <Tooltip
            content={
              canAddMore
                ? `New consultation tab (${tabs.length}/${maxTabs})`
                : `Maximum ${maxTabs} active tabs open`
            }
            placement="top"
          >
            <button
              type="button"
              disabled={!canAddMore}
              onClick={() => {
                setShowOverflowMenu(false);
                closeCustomizeMenu();
                onQuickAddTab();
              }}
              aria-label="Open a new chat tab"
              className={`inline-flex h-[31px] w-7 items-center justify-center transition-colors duration-150 ${
                canAddMore
                  ? 'text-[#5C5449] hover:bg-[#FDFBF7]/55 hover:text-[#3D3830] cursor-pointer'
                  : 'text-[#8B8275]/40 cursor-not-allowed'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Far Right End of Tray: Expand / Collapse Composer Chevron */}
      <div className="shrink-0 flex items-stretch border-l border-[#3D3830]/10">
        <Tooltip
          content={isExpanded ? 'Hide tools & settings' : 'Show tools & settings'}
          placement="top"
        >
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? 'Collapse composer tools and controls'
                : 'Expand composer tools and controls'
            }
            className="inline-flex h-[31px] w-7 items-center justify-center text-[#5C5449] hover:bg-[#FDFBF7]/55 hover:text-[#3D3830] transition-colors duration-150 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      {addMenuPortal}
      {overflowMenuPortal}
    </div>
  );
};

export default ComposerTabStrip;
