import React, { useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  MessageSquarePlus,
  PanelLeftClose,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useAppShell } from './AppLayout';
import type {
  ChatProfile,
  ConversationRecord,
  FavoriteMessageRecord,
} from './chatTypes';
import CustomSelect from './CustomSelect';

interface ChatSidebarProps {
  profiles: ChatProfile[];
  conversations: ConversationRecord[];
  activeConversationId: string | null;
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
  onCreateConversation: (profileId: string | null, modeType?: 'reading' | 'learn_astrology') => void;
  onToggleBookmark: (conversation: ConversationRecord) => void;
  onDeleteConversation: (conversationId: string) => void;
  onLoadFavorites: (profileId?: string) => void;
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
  activeConversationId,
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
  onCreateConversation,
  onToggleBookmark,
  onDeleteConversation,
  onLoadFavorites,
}) => {
  const { openSupport, openBackup, openAccountSettings } = useAppShell();
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'favorites'>('folders');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    general: true,
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [favFilterProfile, setFavFilterProfile] = useState<string>('');
  const [showNewMenu, setShowNewMenu] = useState(false);

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isFolderOpen = (key: string) => expandedFolders[key] !== false;

  const groupedConversations = useMemo(() => {
    const general: ConversationRecord[] = [];
    const byProfile: Record<string, ConversationRecord[]> = {};
    for (const p of profiles) {
      byProfile[p.id] = [];
    }

    for (const conv of conversations) {
      if (!conv.profile_id || !byProfile[conv.profile_id]) {
        general.push(conv);
      } else {
        byProfile[conv.profile_id].push(conv);
      }
    }

    return { general, byProfile };
  }, [conversations, profiles]);

  const handleOpenFavoritesTab = () => {
    setSidebarTab('favorites');
    onLoadFavorites(favFilterProfile || undefined);
  };

  if (isCollapsed && !showMobileDrawer) {
    return null;
  }

  const renderConversationRow = (conv: ConversationRecord) => {
    const isActive = conv.id === activeConversationId;
    const isConfirming = confirmDeleteId === conv.id;

    return (
      <div
        key={conv.id}
        className={`group flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-left transition-all ${
          isActive
            ? 'bg-[#FAF7F2] text-[#3D3830] shadow-xs border border-[#3D3830]/12'
            : 'text-[#5C5449] hover:bg-[#FAF7F2]/60'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onSelectConversation(conv.id);
            onCloseMobileDrawer();
          }}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5">
            {conv.is_bookmarked && (
              <Bookmark className="h-3 w-3 shrink-0 fill-[#8B7355] text-[#8B7355]" />
            )}
            <span className="truncate text-xs font-medium text-[#3D3830]">
              {conv.title}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#8B8275] font-['JetBrains_Mono',monospace] tabular-nums">
            {new Date(conv.updated_at).toLocaleDateString()}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {isConfirming ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onDeleteConversation(conv.id);
                  setConfirmDeleteId(null);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#7A3E36] text-[#FAF7F2]"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded px-1 py-0.5 text-[10px] text-[#8B8275] hover:text-[#3D3830]"
              >
                No
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onToggleBookmark(conv)}
                aria-label={conv.is_bookmarked ? 'Remove bookmark' : 'Pin to top'}
                className={`p-1 rounded hover:bg-[#3D3830]/10 transition-opacity ${
                  conv.is_bookmarked ? 'opacity-100 text-[#8B7355]' : 'opacity-0 group-hover:opacity-100 text-[#8B8275]'
                }`}
              >
                <Bookmark className={`h-3 w-3 ${conv.is_bookmarked ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(conv.id)}
                aria-label="Delete chat"
                className="p-1 rounded text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#3D3830]/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
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
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#8B8275]" />
                <span>Learn Astrology</span>
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
                      <span className="text-[10px] text-[#8B8275] shrink-0">
                        {p.is_activated ? 'Chart Ready' : 'Draft'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
          {/* Search & Sort Strip */}
          <div className="px-4 pb-3 space-y-2 border-b border-[#3D3830]/10">
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
                  className={`transition-colors ${
                    sortBy === 'newest' ? 'text-[#3D3830] font-medium underline underline-offset-4' : 'hover:text-[#3D3830]'
                  }`}
                >
                  Newest
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSortChange('longest')}
                  className={`transition-colors ${
                    sortBy === 'longest' ? 'text-[#3D3830] font-medium underline underline-offset-4' : 'hover:text-[#3D3830]'
                  }`}
                >
                  Longest
                </button>
              </div>
            </div>
          </div>

          {/* Profile-Grouped Folders */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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
                      className="flex items-center gap-1.5 text-left min-w-0 flex-1 py-1 text-xs font-semibold text-[#3D3830] hover:text-[#5C5449]"
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                      )}
                      <span className="truncate">{displayLabel}</span>
                      <span className="text-[10px] font-medium text-[#8B8275] font-['JetBrains_Mono',monospace] tabular-nums">
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
                      className="p-1 text-[#8B8275] hover:text-[#3D3830] rounded"
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
                        items.map(renderConversationRow)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* General & Learn Astrology Folder */}
            <div className="rounded-2xl bg-[#EAE3D7]/60 border border-[#3D3830]/10 p-2 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => toggleFolder('general')}
                  className="flex items-center gap-1.5 text-left min-w-0 flex-1 py-1 text-xs font-semibold text-[#3D3830] hover:text-[#5C5449]"
                >
                  {isFolderOpen('general') ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[#5C5449] shrink-0" />
                  )}
                  <span className="truncate">General &amp; Learn Astrology</span>
                  <span className="text-[10px] font-medium text-[#8B8275] font-['JetBrains_Mono',monospace] tabular-nums">
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
                  className="p-1 text-[#8B8275] hover:text-[#3D3830] rounded"
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
                    groupedConversations.general.map(renderConversationRow)
                  )}
                </div>
              )}
            </div>
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
                { value: 'general', label: 'General & Learn Astrology' },
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

      {/* Mobile Workspace Navigation Footer (replaces outer mobile bar inside full-screen mobile Chat) */}
      <div className="md:hidden border-t border-[#3D3830]/12 bg-[#EAE3D7]/55 px-3 py-3 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="font-serif text-base font-medium text-[#3D3830]">
            Cosmic Council
          </span>
          <Link
            to="/app/billing"
            onClick={onCloseMobileDrawer}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#3D3830]/10 px-2.5 py-1 text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#3D3830]"
          >
            <Coins className="h-3 w-3 text-[#8B7355]" />
            <span>{creditsBalance.toLocaleString()}</span>
          </Link>
        </div>

        <nav className="grid grid-cols-2 gap-1">
          <NavLink
            to="/app/profiles"
            onClick={onCloseMobileDrawer}
            className={mobileNavLinkClass}
          >
            <Users className="h-3.5 w-3.5 text-[#8B8275]" />
            <span>Profiles</span>
          </NavLink>
          <NavLink
            to="/app/reports"
            onClick={onCloseMobileDrawer}
            className={mobileNavLinkClass}
          >
            <ScrollText className="h-3.5 w-3.5 text-[#8B8275]" />
            <span>Reports</span>
          </NavLink>
          <NavLink
            to="/app/dashboard"
            onClick={onCloseMobileDrawer}
            className={mobileNavLinkClass}
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-[#8B8275]" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/app/billing"
            onClick={onCloseMobileDrawer}
            className={mobileNavLinkClass}
          >
            <Coins className="h-3.5 w-3.5 text-[#8B8275]" />
            <span>Credits</span>
          </NavLink>
          <button
            type="button"
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
            onClick={() => {
              onCloseMobileDrawer();
              openBackup();
            }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors"
          >
            <Database className="h-3.5 w-3.5 text-[#8B8275]" />
            <span>Backup</span>
          </button>
          {onSignOut && (
            <button
              type="button"
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
