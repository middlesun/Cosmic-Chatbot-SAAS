import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  Database,
  FolderOpen,
  HeartHandshake,
  Home,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Lightbulb,
  Lock,
  LogOut,
  MessageSquarePlus,
  PanelLeftClose,
  Pencil,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppShell } from './AppLayout';
import { useAuth } from './AuthContext';
import type {
  ChatProfile,
  ConversationRecord,
  FavoriteMessageRecord,
  PublicCompanionCard,
} from './chatTypes';
import CompanionAvatar from './CompanionAvatar';
import CustomSelect from './CustomSelect';
import Tooltip from './Tooltip';

interface ChatSidebarProps {
  profiles: ChatProfile[];
  conversations: ConversationRecord[];
  companionCatalog?: PublicCompanionCard[];
  activeConversationId: string | null;
  activeTabConversationIds: string[];
  maxActiveTabs?: number;
  favorites: FavoriteMessageRecord[];
  searchQuery: string;
  sortBy: 'newest' | 'longest';
  isLocked: boolean;
  isCollapsed: boolean;
  showMobileDrawer: boolean;
  isPreviewMode?: boolean;
  creditsBalance?: number;
  onSignOut?: () => void;
  onCloseMobileDrawer: () => void;
  onToggleCollapse: () => void;
  onToggleLock: () => void;
  onSearchChange: (q: string) => void;
  onSortChange: (sort: 'newest' | 'longest') => void;
  onSelectConversation: (conversationId: string) => void;
  onToggleActiveTab: (conversation: ConversationRecord) => void;
  onCreateConversation: (profileId: string | null, modeType?: 'reading' | 'learn_astrology') => void;
  onStartNewCompanion: () => void;
  onOpenClarity: () => void;
  onToggleBookmark: (conversation: ConversationRecord) => void;
  onRenameConversation?: (conversationId: string, nextTitle: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onLoadFavorites: (profileId?: string) => void;
  onOpenAddChartModal?: () => void;
}

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  profiles,
  conversations,
  companionCatalog = [],
  activeConversationId,
  activeTabConversationIds,
  maxActiveTabs = 10,
  favorites,
  searchQuery,
  sortBy,
  isLocked,
  isCollapsed,
  showMobileDrawer,
  isPreviewMode = false,
  creditsBalance = 0,
  onSignOut,
  onCloseMobileDrawer,
  onToggleCollapse,
  onToggleLock,
  onSearchChange,
  onSortChange,
  onSelectConversation,
  onToggleActiveTab,
  onCreateConversation,
  onStartNewCompanion,
  onOpenClarity,
  onToggleBookmark,
  onRenameConversation,
  onDeleteConversation,
  onLoadFavorites,
  onOpenAddChartModal,
}) => {
  const { openSupport, openBackup, openAccountSettings } = useAppShell();
  const { appUser } = useAuth();
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'favorites'>('folders');
  const [pillarFilter, setPillarFilter] = useState<'all' | 'council' | 'companion'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    general: true,
    companions: true,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState<string>('');
  const [favFilterProfile, setFavFilterProfile] = useState<string>('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [mobileFooterExpanded, setMobileFooterExpanded] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showMobileDrawer) {
      setMobileFooterExpanded(false);
    }
  }, [showMobileDrawer]);

  const companionCatalogBySlug = useMemo(() => {
    const map = new Map<string, PublicCompanionCard>();
    for (const c of companionCatalog) {
      map.set(c.slug, c);
    }
    return map;
  }, [companionCatalog]);

  useEffect(() => {
    if (!editingRowId) return;
    const raf = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingRowId]);

  const startRenameConversation = (rowId: string, convId: string, currentTitle: string) => {
    setConfirmDeleteId(null);
    setEditingRowId(rowId);
    setEditingConvId(convId);
    setEditingConvTitle(currentTitle);
  };

  const commitRenameConversation = () => {
    if (!editingConvId) return;
    const clean = editingConvTitle.trim();
    if (clean && onRenameConversation) {
      onRenameConversation(editingConvId, clean);
    }
    setEditingConvId(null);
    setEditingRowId(null);
    setEditingConvTitle('');
  };

  const cancelRenameConversation = () => {
    setEditingConvId(null);
    setEditingRowId(null);
    setEditingConvTitle('');
  };

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isFolderOpen = (key: string) => expandedFolders[key] !== false;

  const groupedConversations = useMemo(() => {
    const general: ConversationRecord[] = [];
    const companions: ConversationRecord[] = [];
    const byProfile: Record<string, ConversationRecord[]> = {};
    for (const p of profiles) {
      byProfile[p.id] = [];
    }

    for (const conv of conversations) {
      // Keep Clarity off-record threads out of the saved astrology & companion library
      if (conv.pillar === 'clarity') continue;

      if (conv.pillar === 'companion' || Boolean(conv.companion_persona_json)) {
        companions.push(conv);
        continue;
      }

      if (!conv.profile_id || !byProfile[conv.profile_id]) {
        general.push(conv);
      } else {
        byProfile[conv.profile_id].push(conv);
      }
    }

    return { general, companions, byProfile };
  }, [conversations, profiles]);

  const recentConversations = useMemo(() => {
    return conversations
      .filter((conv) => {
        if (conv.pillar === 'clarity') return false;
        const isComp = conv.pillar === 'companion' || Boolean(conv.companion_persona_json);
        if (pillarFilter === 'companion' && !isComp) return false;
        if (pillarFilter === 'council' && isComp) return false;
        return true;
      })
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [conversations, pillarFilter]);

  const handleOpenFavoritesTab = () => {
    setSidebarTab('favorites');
    onLoadFavorites(favFilterProfile || undefined);
  };

  if (isCollapsed && !showMobileDrawer) {
    return null;
  }

  const renderConversationRow = (
    conv: ConversationRecord,
    rowKeyPrefix = '',
    options?: { inPersonGroup?: boolean }
  ) => {
    const rowId = `${rowKeyPrefix}${conv.id}`;
    const isActive = conv.id === activeConversationId;
    const isConfirming = confirmDeleteId === rowId;
    const isEditing = editingRowId === rowId;
    const isPinnedTab = activeTabConversationIds.includes(conv.id);
    const isCompanion = conv.pillar === 'companion' || Boolean(conv.companion_persona_json);
    const companionSlug = conv.companion_slug || conv.companion_persona_json?.slug || null;
    const catalogCard = companionSlug ? companionCatalogBySlug.get(companionSlug) : undefined;
    const companionName = catalogCard?.name || conv.companion_persona_json?.name;
    const previewSnippet = (conv.last_message_preview || '').trim();
    const rawTitle = (conv.title || '').trim();
    const isGenericCompanionTitle =
      !rawTitle ||
      rawTitle === 'Companion Chat' ||
      (Boolean(companionName) && rawTitle.toLowerCase() === companionName!.toLowerCase());
    const strippedTopicTitle =
      companionName && rawTitle.startsWith(`${companionName} ·`)
        ? rawTitle.slice(`${companionName} ·`.length).trim()
        : rawTitle;
    const displayTitle = isCompanion
      ? options?.inPersonGroup
        ? isGenericCompanionTitle
          ? previewSnippet
            ? previewSnippet.slice(0, 48) + (previewSnippet.length > 48 ? '…' : '')
            : 'Conversation'
          : strippedTopicTitle || 'Conversation'
        : companionName &&
          (!rawTitle ||
            rawTitle === 'Companion Chat' ||
            rawTitle.startsWith(`${companionName} ·`))
        ? companionName
        : conv.title
      : conv.title;

    return (
      <div
        key={rowId}
        className={`group flex items-start justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left transition-all ${
          isActive
            ? 'bg-[#FAF7F2] text-[#3D3830] shadow-xs border border-[#3D3830]/12'
            : 'text-[#5C5449] hover:bg-[#FAF7F2]/60'
        }`}
      >
        {isEditing ? (
          <div className="flex-1 min-w-0 py-0.5">
            <input
              ref={renameInputRef}
              type="text"
              value={editingConvTitle}
              maxLength={80}
              onChange={(e) => setEditingConvTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRenameConversation();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRenameConversation();
                }
              }}
              onBlur={commitRenameConversation}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Rename ${displayTitle}`}
              className="w-full rounded-lg border border-[#B8965A]/65 bg-[#FDFBF7] px-2 py-1 text-xs font-medium text-[#3D3830] focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onSelectConversation(conv.id);
              onCloseMobileDrawer();
            }}
            onDoubleClick={(e) => {
              if (!onRenameConversation) return;
              e.stopPropagation();
              startRenameConversation(rowId, conv.id, displayTitle);
            }}
            className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
          >
            {isCompanion && !options?.inPersonGroup && (
              <CompanionAvatar
                name={companionName || displayTitle}
                avatarUrl={catalogCard?.avatar_url ?? conv.companion_persona_json?.avatar_url}
                palette={
                  catalogCard?.monogram_palette ??
                  conv.companion_persona_json?.monogram_palette
                }
                size="xs"
                shape="circle"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {conv.is_bookmarked && (
                  <Bookmark className="h-3 w-3 shrink-0 fill-[#8B7355] text-[#8B7355]" />
                )}
                <span className="truncate text-xs font-medium text-[#3D3830]">
                  {displayTitle}
                </span>
              </div>
              {isCompanion && previewSnippet && (
                <p className="mt-0.5 text-[11px] leading-snug text-[#5C5449]/85 line-clamp-1">
                  {previewSnippet}
                </p>
              )}
            </div>
          </button>
        )}

        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
            {isConfirming ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                    setConfirmDeleteId(null);
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#7A3E36] text-[#FAF7F2] cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(null);
                  }}
                  className="rounded px-1 py-0.5 text-[10px] text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                <Tooltip
                  content={isPinnedTab ? 'Remove from chat' : 'Add to chat'}
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActiveTab(conv);
                    }}
                    aria-label={isPinnedTab ? 'Remove from chat' : 'Add to chat'}
                    className={`p-1 rounded hover:bg-[#3D3830]/10 transition-colors cursor-pointer ${
                      isPinnedTab
                        ? 'text-[#B8965A] bg-[#B8965A]/12'
                        : 'text-[#8B8275] hover:text-[#3D3830]'
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                </Tooltip>
                {onRenameConversation && (
                  <Tooltip content="Rename" placement="top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenameConversation(rowId, conv.id, displayTitle);
                      }}
                      aria-label={`Rename ${displayTitle}`}
                      className="p-1 rounded hover:bg-[#3D3830]/10 text-[#8B8275] hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </Tooltip>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(conv);
                  }}
                  aria-label={conv.is_bookmarked ? 'Remove bookmark' : 'Pin to top'}
                  className={`p-1 rounded hover:bg-[#3D3830]/10 transition-colors cursor-pointer ${
                    conv.is_bookmarked
                      ? 'text-[#8B7355]'
                      : 'text-[#8B8275] hover:text-[#3D3830]'
                  }`}
                >
                  <Bookmark className={`h-3 w-3 ${conv.is_bookmarked ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(rowId);
                  }}
                  aria-label="Delete chat"
                  className="p-1 rounded text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#3D3830]/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
      isActive
        ? 'bg-[#FAF7F2] text-[#3D3830] border border-[#3D3830]/10'
        : 'text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830]'
    }`;

  const sidebarBody = (
    <aside className="flex h-full w-full flex-col bg-[#F1ECE3] border-r border-[#3D3830]/10">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-[#3D3830]/10">
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setShowNewMenu((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-3.5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">New Consultation</span>
          </button>

          {showNewMenu && (
            <div className="animate-cc-dropdown-down absolute left-0 right-0 top-11 z-30 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/15 shadow-lg p-2 space-y-1 max-h-72 overflow-y-auto">
              <p className="px-2.5 py-1 text-[10px] font-medium text-[#8B8275]">
                Choose Profile Folder
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowNewMenu(false);
                  onCreateConversation(null, 'reading');
                  onCloseMobileDrawer();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>General Consultation</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewMenu(false);
                  onCreateConversation(null, 'learn_astrology');
                  onCloseMobileDrawer();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Learn Astrology</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewMenu(false);
                  onStartNewCompanion();
                  onCloseMobileDrawer();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>New Companion</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewMenu(false);
                  onOpenClarity();
                  onCloseMobileDrawer();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Lightbulb className="h-3.5 w-3.5 text-[#B8965A]" />
                <span>Open Clarity</span>
              </button>
              {profiles.length > 0 && (
                <div className="border-t border-[#3D3830]/10 my-1 pt-1">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setShowNewMenu(false);
                        onCreateConversation(p.id, 'reading');
                        onCloseMobileDrawer();
                      }}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3]"
                    >
                      <span className="truncate font-medium">
                        {getProfileDisplayLabel(p)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-[#3D3830]/10 my-1 pt-1">
                {onOpenAddChartModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewMenu(false);
                      onOpenAddChartModal();
                      onCloseMobileDrawer();
                    }}
                    className="w-full min-h-[40px] flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[#3D3830] bg-[#F1ECE3]/75 hover:bg-[#EAE3D7] transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                    <span>Add Birth Details</span>
                  </button>
                ) : (
                  <Link
                    to="/app/profiles"
                    onClick={() => {
                      setShowNewMenu(false);
                      onCloseMobileDrawer();
                    }}
                    className="w-full min-h-[40px] flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[#3D3830] bg-[#F1ECE3]/75 hover:bg-[#EAE3D7] transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                    <span>Add Birth Details</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleLock}
          aria-label={isLocked ? 'Unlock sidebar width' : 'Lock sidebar open'}
          className={`hidden lg:inline-flex p-2 rounded-xl border transition-colors ${
            isLocked
              ? 'border-[#3D3830]/25 bg-[#FAF7F2] text-[#3D3830]'
              : 'border-transparent text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830]'
          }`}
        >
          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>

        {!isLocked && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="hidden lg:inline-flex p-2 rounded-xl text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830]"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onCloseMobileDrawer}
          className="lg:hidden p-2 rounded-xl text-[#8B8275] hover:text-[#3D3830]"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Switch: Folders vs Starred Favorites */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setSidebarTab('folders')}
          className={`flex-1 rounded-xl py-1.5 text-xs font-medium transition-colors ${
            sidebarTab === 'folders'
              ? 'bg-[#FAF7F2] text-[#3D3830] border border-[#3D3830]/10'
              : 'text-[#8B8275] hover:text-[#3D3830]'
          }`}
        >
          Consultations
        </button>
        <button
          type="button"
          onClick={handleOpenFavoritesTab}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors ${
            sidebarTab === 'favorites'
              ? 'bg-[#FAF7F2] text-[#3D3830] border border-[#3D3830]/10'
              : 'text-[#8B8275] hover:text-[#3D3830]'
          }`}
        >
          <Star className="h-3 w-3" />
          <span>Starred</span>
        </button>
      </div>

      {sidebarTab === 'folders' ? (
        <>
          {/* Pillar Filter + Search & Sort Strip */}
          <div className="px-4 pb-3 space-y-2 border-b border-[#3D3830]/10">
            {/* Segmented All | Council | Companion Toggle */}
            <div className="flex items-center gap-1 rounded-xl bg-[#EAE3D7]/80 p-0.5 border border-[#3D3830]/8">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'council', label: 'Council' },
                  { id: 'companion', label: 'Companion' },
                ] as const
              ).map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setPillarFilter(seg.id)}
                  className={`flex-1 rounded-lg py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    pillarFilter === seg.id
                      ? 'bg-[#FAF7F2] text-[#3D3830] shadow-xs border border-[#3D3830]/10'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search threads..."
                className="w-full rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] pl-8 pr-3 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
              <span>Sort folders by</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSortChange('newest')}
                  className={`transition-colors cursor-pointer ${
                    sortBy === 'newest' ? 'text-[#3D3830] font-medium underline underline-offset-4' : 'hover:text-[#3D3830]'
                  }`}
                >
                  Newest
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSortChange('longest')}
                  className={`transition-colors cursor-pointer ${
                    sortBy === 'longest' ? 'text-[#3D3830] font-medium underline underline-offset-4' : 'hover:text-[#3D3830]'
                  }`}
                >
                  Longest
                </button>
              </div>
            </div>
          </div>

          {/* Root Recent 5 Chats + Profile-Grouped Folders & Companions Library */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {/* Last 5 Recent Chats in Root */}
            {recentConversations.length > 0 && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleFolder('recent')}
                  className="flex items-center gap-1.5 w-full px-1.5 py-0.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                >
                  {isFolderOpen('recent') ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <span>Recent</span>
                  <span className="text-[10px] font-medium font-['DM_Sans',sans-serif] tabular-nums">
                    ({recentConversations.length})
                  </span>
                </button>
                {isFolderOpen('recent') && (
                  <div className="space-y-1">
                    {recentConversations.map((conv) => renderConversationRow(conv, 'recent-'))}
                  </div>
                )}
              </div>
            )}

            {/* Companions Folder (shown in All & Companion filters) */}
            {(pillarFilter === 'all' || pillarFilter === 'companion') && (
              <div className="rounded-2xl bg-[#EAE3D7]/60 border border-[#3D3830]/10 p-2 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => toggleFolder('companions')}
                    className="flex items-center gap-1.5 text-left min-w-0 flex-1 py-1 text-xs font-semibold text-[#3D3830] hover:text-[#5C5449] cursor-pointer"
                  >
                    {isFolderOpen('companions') ? (
                      <ChevronDown className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                    )}
                    <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                    <span className="truncate">Companions</span>
                    <span className="text-[10px] font-medium text-[#8B8275] font-['DM_Sans',sans-serif] tabular-nums">
                      ({groupedConversations.companions.length})
                    </span>
                  </button>
                  <Tooltip content="Browse all companions" placement="top">
                    <button
                      type="button"
                      onClick={() => {
                        onStartNewCompanion();
                        onCloseMobileDrawer();
                      }}
                      aria-label="Browse all companions"
                      className="p-1 text-[#8B8275] hover:text-[#3D3830] rounded cursor-pointer"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>

                {isFolderOpen('companions') && (
                  <div className="space-y-2 pl-1">
                    {groupedConversations.companions.length === 0 ? (
                      <div className="px-2.5 py-2 space-y-2">
                        <p className="text-[11px] text-[#8B8275]">
                          No companion chats yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onStartNewCompanion();
                            onCloseMobileDrawer();
                          }}
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                        >
                          Find a Companion
                        </button>
                      </div>
                    ) : (() => {
                      const personGroups: Array<{
                        key: string;
                        name: string;
                        role?: string;
                        avatarUrl?: string | null;
                        palette?: typeof groupedConversations.companions[0]['companion_persona_json'] extends infer P
                          ? P extends { monogram_palette?: infer M }
                            ? M
                            : undefined
                          : undefined;
                        items: ConversationRecord[];
                      }> = [];
                      const groupMap = new Map<string, (typeof personGroups)[number]>();

                      for (const conv of groupedConversations.companions) {
                        const slug =
                          conv.companion_slug ||
                          conv.companion_persona_json?.slug ||
                          null;
                        const card = slug ? companionCatalogBySlug.get(slug) : undefined;
                        const name =
                          card?.name ||
                          conv.companion_persona_json?.name ||
                          conv.title ||
                          'Companion';
                        const key = (slug || name).toLowerCase();
                        let group = groupMap.get(key);
                        if (!group) {
                          group = {
                            key,
                            name,
                            role:
                              card?.primary_expertise ||
                              conv.companion_persona_json?.role_label,
                            avatarUrl:
                              card?.avatar_url ??
                              conv.companion_persona_json?.avatar_url,
                            palette:
                              card?.monogram_palette ??
                              conv.companion_persona_json?.monogram_palette,
                            items: [],
                          };
                          groupMap.set(key, group);
                          personGroups.push(group);
                        }
                        group.items.push(conv);
                      }

                      return personGroups.map((group, gIdx) => {
                        const folderKey = `comp-person:${group.key}`;
                        const containsActive = group.items.some(
                          (c) => c.id === activeConversationId
                        );
                        const isOpen =
                          expandedFolders[folderKey] !== undefined
                            ? expandedFolders[folderKey]
                            : containsActive || gIdx < 5;

                        return (
                          <div key={group.key} className="space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFolders((prev) => ({
                                  ...prev,
                                  [folderKey]: !isOpen,
                                }))
                              }
                              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-[#FAF7F2]/60 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CompanionAvatar
                                  name={group.name}
                                  avatarUrl={group.avatarUrl}
                                  palette={group.palette}
                                  size="xs"
                                  shape="circle"
                                />
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <span className="truncate text-[11px] font-semibold text-[#3D3830]">
                                    {group.name}
                                  </span>
                                  {group.items.length > 1 ? (
                                    <span className="text-[10px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] shrink-0">
                                      ({group.items.length})
                                    </span>
                                  ) : group.role ? (
                                    <span className="truncate text-[10px] text-[#8B8275]">
                                      · {group.role}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3 text-[#8B8275] shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-[#8B8275] shrink-0" />
                              )}
                            </button>
                            {isOpen && (
                              <div className="space-y-1 pl-2.5 ml-3 border-l border-[#3D3830]/10">
                                {group.items.map((conv) =>
                                  renderConversationRow(conv, 'folder-comp-', {
                                    inPersonGroup: true,
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {groupedConversations.companions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartNewCompanion();
                          onCloseMobileDrawer();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2]/80 px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:bg-[#FDFBF7] hover:text-[#3D3830] transition-colors cursor-pointer"
                      >
                        <HeartHandshake className="h-3 w-3 text-[#8B7355]" />
                        <span>Browse all companions</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Council Folders (shown in All & Council filters) */}
            {(pillarFilter === 'all' || pillarFilter === 'council') && (
              <>
                {/* Prominent Add Birth Details CTA (Council filter only) */}
                {pillarFilter === 'council' && profiles.length === 0 && (
                  <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/12 p-3.5 space-y-2.5">
                    <p className="text-xs font-medium text-[#3D3830]">
                      No birth chart saved yet
                    </p>
                    <p className="text-[11px] text-[#5C5449] leading-relaxed">
                      Add birth details when you want natal astrology readings in Council.
                    </p>
                    {onOpenAddChartModal ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenAddChartModal();
                          onCloseMobileDrawer();
                        }}
                        className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Add Birth Details</span>
                      </button>
                    ) : (
                      <Link
                        to="/app/profiles"
                        onClick={onCloseMobileDrawer}
                        className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Add Birth Details</span>
                      </Link>
                    )}
                  </div>
                )}

                {/* Profile Folders */}
                {profiles.map((profile) => {
                  const items = groupedConversations.byProfile[profile.id] || [];
                  const open = isFolderOpen(profile.id);
                  const displayLabel = getProfileDisplayLabel(profile);

                  return (
                    <div
                      key={profile.id}
                      className="rounded-2xl bg-[#EAE3D7]/60 border border-[#3D3830]/10 p-2 space-y-1.5"
                    >
                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => toggleFolder(profile.id)}
                          className="flex items-center gap-1.5 text-left min-w-0 flex-1 py-1 text-xs font-semibold text-[#3D3830] hover:text-[#5C5449] cursor-pointer"
                        >
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                          )}
                          <span className="truncate">{displayLabel}</span>
                          <span className="text-[10px] font-medium text-[#8B8275] font-['DM_Sans',sans-serif] tabular-nums">
                            ({items.length})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onCreateConversation(profile.id, 'reading');
                            onCloseMobileDrawer();
                          }}
                          aria-label={`New consultation for ${displayLabel}`}
                          className="p-1 text-[#8B8275] hover:text-[#3D3830] rounded cursor-pointer"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {open && (
                        <div className="space-y-1 pl-1">
                          {items.length === 0 ? (
                            <p className="px-3 py-1.5 text-[11px] text-[#8B8275]">
                              No consultations yet.
                            </p>
                          ) : (
                            items.map((conv) => renderConversationRow(conv, `folder-prof-${profile.id}-`))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Astrology lessons Folder */}
                <div className="rounded-2xl bg-[#EAE3D7]/60 border border-[#3D3830]/10 p-2 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => toggleFolder('general')}
                      className="flex items-center gap-1.5 text-left min-w-0 flex-1 py-1 text-xs font-semibold text-[#3D3830] hover:text-[#5C5449] cursor-pointer"
                    >
                      {isFolderOpen('general') ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                      )}
                      <span className="truncate">Astrology lessons</span>
                      <span className="text-[10px] font-medium text-[#8B8275] font-['DM_Sans',sans-serif] tabular-nums">
                        ({groupedConversations.general.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateConversation(null, 'reading');
                        onCloseMobileDrawer();
                      }}
                      aria-label="New general consultation"
                      className="p-1 text-[#8B8275] hover:text-[#3D3830] rounded cursor-pointer"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isFolderOpen('general') && (
                    <div className="space-y-1 pl-1">
                      {groupedConversations.general.length === 0 ? (
                        <p className="px-3 py-1.5 text-[11px] text-[#8B8275]">
                          Start a general reading or Jyotish lesson.
                        </p>
                      ) : (
                        groupedConversations.general.map((conv) =>
                          renderConversationRow(conv, 'folder-gen-')
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Starred Favorites Filterable per Profile */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pb-3 border-b border-[#3D3830]/10">
            <CustomSelect
              value={favFilterProfile}
              onChange={(next) => {
                setFavFilterProfile(next);
                onLoadFavorites(next || undefined);
              }}
              ariaLabel="Filter starred insights by profile"
              size="sm"
              surface="canvas"
              className="w-full"
              options={[
                { value: '', label: 'All Profiles & General' },
                { value: 'general', label: 'Astrology lessons' },
                ...profiles.map((p) => ({
                  value: p.id,
                  label: getProfileDisplayLabel(p),
                })),
              ]}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {favorites.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#8B8275] leading-relaxed">
                Star any Council response in a consultation to save it here as a permanent profile bookmark.
              </p>
            ) : (
              favorites.map((fav) => (
                <button
                  key={fav.id}
                  type="button"
                  onClick={() => {
                    onSelectConversation(fav.conversation_id);
                    onCloseMobileDrawer();
                  }}
                  className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3 text-left hover:border-[#3D3830]/25 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#8B8275]">
                    <span className="truncate font-medium text-[#3D3830]">
                      {fav.conversation_title}
                    </span>
                    <Star className="h-3 w-3 shrink-0 fill-[#8B7355] text-[#8B7355]" />
                  </div>
                  <p className="mt-1.5 text-xs text-[#5C5449] line-clamp-3 leading-relaxed">
                    {fav.content}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Mobile Workspace Navigation Footer (collapsed by default; expands upward) */}
      <div className="md:hidden border-t border-[#3D3830]/12 bg-[#EAE3D7]/65 px-3 py-2.5">
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
            mobileFooterExpanded
              ? 'grid-rows-[1fr] opacity-100 mb-2'
              : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none'
          }`}
          aria-hidden={!mobileFooterExpanded}
        >
          <div className="overflow-hidden min-h-0">
            <nav className="grid grid-cols-2 gap-1 pb-1">
              <NavLink
                to="/app/home"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <Home className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Home</span>
              </NavLink>
              <NavLink
                to="/app/companions"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <HeartHandshake className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Companions</span>
              </NavLink>
              <NavLink
                to="/app/apps"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <LayoutGrid className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Apps</span>
              </NavLink>
              <NavLink
                to="/app/profiles"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <Users className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Profiles</span>
              </NavLink>
              <NavLink
                to="/app/reports"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <ScrollText className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Reports</span>
              </NavLink>
              <NavLink
                to="/app/billing"
                onClick={onCloseMobileDrawer}
                tabIndex={mobileFooterExpanded ? 0 : -1}
                className={mobileNavLinkClass}
              >
                <Coins className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Credits</span>
              </NavLink>
              <button
                type="button"
                tabIndex={mobileFooterExpanded ? 0 : -1}
                onClick={() => {
                  onCloseMobileDrawer();
                  openSupport();
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors"
              >
                <LifeBuoy className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Support</span>
              </button>
              <button
                type="button"
                tabIndex={mobileFooterExpanded ? 0 : -1}
                onClick={() => {
                  onCloseMobileDrawer();
                  openAccountSettings();
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors"
              >
                <Settings className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                tabIndex={mobileFooterExpanded ? 0 : -1}
                onClick={() => {
                  onCloseMobileDrawer();
                  openBackup();
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors"
              >
                <Database className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Backup</span>
              </button>
              {appUser?.is_admin && !isPreviewMode && (
                <NavLink
                  to="/app/admin"
                  onClick={onCloseMobileDrawer}
                  tabIndex={mobileFooterExpanded ? 0 : -1}
                  className={mobileNavLinkClass}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Admin</span>
                </NavLink>
              )}
              {onSignOut && (
                <button
                  type="button"
                  tabIndex={mobileFooterExpanded ? 0 : -1}
                  onClick={() => {
                    onCloseMobileDrawer();
                    onSignOut();
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#7A3E36] hover:bg-[#FAF7F2]/70 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{isPreviewMode ? 'Exit Preview' : 'Sign Out'}</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setMobileFooterExpanded((v) => !v)}
            aria-expanded={mobileFooterExpanded}
            aria-label={mobileFooterExpanded ? 'Collapse workspace menu' : 'Expand workspace menu'}
            className="flex items-center gap-2 min-w-0 text-left py-0.5 cursor-pointer"
          >
            <span className="font-serif text-base font-medium text-[#3D3830] truncate">
              Cosmic Council
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {(() => {
              const tierBaseline =
                appUser?.tier === 'guru' ? 8000 : appUser?.tier === 'pro' ? 2500 : 500;
              const isLowCredits =
                !isPreviewMode &&
                (creditsBalance <= 0 || creditsBalance / tierBaseline < 0.1);
              return (
                <Tooltip
                  content={
                    isLowCredits
                      ? 'Under 10% credits remaining — tap to top up'
                      : `${creditsBalance.toLocaleString()} credits remaining`
                  }
                  placement="top"
                >
                  <Link
                    to="/app/billing"
                    onClick={onCloseMobileDrawer}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-['DM_Sans',sans-serif] tabular-nums transition-colors ${
                      isLowCredits
                        ? 'bg-[#FAF0EE] border-[#7A3E36]/30 text-[#7A3E36] font-medium'
                        : 'bg-[#FAF7F2] border-[#3D3830]/10 text-[#3D3830]'
                    }`}
                  >
                    <Coins
                      className={`h-3 w-3 ${isLowCredits ? 'text-[#7A3E36]' : 'text-[#8B7355]'}`}
                    />
                    {isLowCredits && <span className="text-[10px] font-semibold">Low ·</span>}
                    <span>{creditsBalance.toLocaleString()}</span>
                  </Link>
                </Tooltip>
              );
            })()}

            <button
              type="button"
              onClick={() => setMobileFooterExpanded((v) => !v)}
              aria-expanded={mobileFooterExpanded}
              aria-label={mobileFooterExpanded ? 'Collapse workspace menu' : 'Expand workspace menu'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2]/80 text-[#5C5449] hover:text-[#3D3830] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              <ChevronUp
                className={`h-4 w-4 transition-transform duration-200 ${
                  mobileFooterExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Rail */}
      <div className="hidden lg:block w-80 shrink-0 h-full">{sidebarBody}</div>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1F2229]/40 backdrop-blur-xs"
            onClick={onCloseMobileDrawer}
          />
          <div className="relative z-10 w-80 max-w-[85vw] h-full shadow-2xl">
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSidebar;
