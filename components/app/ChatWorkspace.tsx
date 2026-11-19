import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Menu,
  PanelLeftOpen,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import ChatSidebar from './ChatSidebar';
import MessageThread from './MessageThread';
import ChatComposer from './ChatComposer';
import QuickToolsModal from './QuickToolsModal';
import MyPromptsModal from './MyPromptsModal';
import ChatSettingsModal, { type ChatFontSize } from './ChatSettingsModal';
import type {
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  ConversationRecord,
  CustomPromptRecord,
  FavoriteMessageRecord,
} from './chatTypes';
import {
  PREVIEW_CHAT_CATALOG,
  PREVIEW_CONVERSATIONS,
  PREVIEW_CUSTOM_PROMPTS,
  PREVIEW_FAVORITES,
  PREVIEW_MESSAGES,
  PREVIEW_PROFILES,
} from './previewFixtures';

const SIDEBAR_LOCK_STORAGE_KEY = 'cc_chat_sidebar_locked';

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const ChatWorkspace: React.FC = () => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { appUser, isPreviewMode, exitPreviewMode, signOut, getAccessToken, refreshUser } = useAuth();

  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [customPrompts, setCustomPrompts] = useState<CustomPromptRecord[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMessageRecord[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'longest'>('newest');
  const [isSidebarLocked, setIsSidebarLocked] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_LOCK_STORAGE_KEY) !== 'false';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // Active consultation parameters
  const [expertSlug, setExpertSlug] = useState(appUser?.default_expert || 'council_synthesis');
  const [modeSlug, setModeSlug] = useState('general');
  const [outputSlug, setOutputSlug] = useState(appUser?.default_output || 'detailed');
  const [languageSlug, setLanguageSlug] = useState(appUser?.default_language || 'English');
  const [chatFontSize, setChatFontSize] = useState<ChatFontSize>(appUser?.chat_font_size || 'base');
  const [preferredCallName, setPreferredCallName] = useState(appUser?.preferred_call_name || '');

  const [draftText, setDraftText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessageRecord | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [showQuickTools, setShowQuickTools] = useState(false);
  const [showMyPrompts, setShowMyPrompts] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);

  // In-chat keyword search
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inChatSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync defaults once appUser loads
  useEffect(() => {
    if (appUser) {
      setExpertSlug((prev) => prev || appUser.default_expert || 'council_synthesis');
      setOutputSlug((prev) => prev || appUser.default_output || 'detailed');
      setLanguageSlug((prev) => prev || appUser.default_language || 'English');
      setChatFontSize(appUser.chat_font_size || 'base');
      setPreferredCallName(appUser.preferred_call_name || '');
    }
  }, [appUser]);

  const loadConfigAndPrompts = useCallback(async () => {
    if (isPreviewMode) {
      setCatalog(PREVIEW_CHAT_CATALOG);
      setCustomPrompts(PREVIEW_CUSTOM_PROMPTS);
      return;
    }
    const token = await getAccessToken();
    if (!token) return;

    const [cfgRes, promptRes] = await Promise.all([
      fetch('/api/chat/config', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/chat/custom-prompts', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      setCatalog(cfg.catalog || null);
    }
    if (promptRes.ok) {
      const pr = await promptRes.json();
      setCustomPrompts(pr.prompts || []);
    }
  }, [getAccessToken, isPreviewMode]);

  const loadConversations = useCallback(async () => {
    if (isPreviewMode) {
      const q = searchQuery.trim().toLowerCase();
      const filtered = PREVIEW_CONVERSATIONS.filter((c) =>
        !q || c.title.toLowerCase().includes(q)
      );
      setConversations(filtered);
      setProfiles(PREVIEW_PROFILES);
      return;
    }
    const token = await getAccessToken();
    if (!token) return;

    const params = new URLSearchParams({ sort: sortBy });
    if (searchQuery.trim()) params.set('q', searchQuery.trim());

    const res = await fetch(`/api/chat/conversations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
      setProfiles(data.profiles || []);
    }
  }, [getAccessToken, sortBy, searchQuery, isPreviewMode]);

  const loadConversationMessages = useCallback(
    async (convId: string) => {
      if (isPreviewMode) {
        const foundConv =
          PREVIEW_CONVERSATIONS.find((c) => c.id === convId) || PREVIEW_CONVERSATIONS[0];
        setActiveConversation(foundConv);
        setMessages(PREVIEW_MESSAGES[foundConv.id] || []);
        setHasMoreMessages(false);
        setReplyTarget(null);
        if (foundConv.mode_type === 'learn_astrology') {
          setModeSlug('learn_astrology');
        }
        return;
      }
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`/api/chat/conversations/${convId}/messages?limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const loadedConv = (data.conversation || null) as ConversationRecord | null;
        const loadedMsgs = (data.messages || []) as ChatMessageRecord[];
        setActiveConversation(loadedConv);
        setMessages(loadedMsgs);
        setHasMoreMessages(Boolean(data.hasMore));
        setReplyTarget(null);

        const firstAssistant = loadedMsgs.find((m) => m.role === 'assistant');
        if (firstAssistant?.expert_used) setExpertSlug(firstAssistant.expert_used);
        if (loadedConv?.mode_type === 'learn_astrology') {
          setModeSlug('learn_astrology');
        } else if (firstAssistant?.mode_used) {
          setModeSlug(firstAssistant.mode_used);
        }
      }
    },
    [getAccessToken, isPreviewMode]
  );

  const handleLoadEarlierMessages = useCallback(async () => {
    if (isPreviewMode || !activeConversation || loadingEarlierMessages || messages.length === 0) {
      return;
    }
    const oldest = messages[0];
    if (!oldest?.created_at) return;

    const token = await getAccessToken();
    if (!token) return;

    setLoadingEarlierMessages(true);
    try {
      const params = new URLSearchParams({
        limit: '40',
        before: oldest.created_at,
      });
      const res = await fetch(
        `/api/chat/conversations/${activeConversation.id}/messages?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const olderRows = (data.messages || []) as ChatMessageRecord[];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = olderRows.filter((m) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });
        setHasMoreMessages(Boolean(data.hasMore));
      }
    } finally {
      setLoadingEarlierMessages(false);
    }
  }, [isPreviewMode, activeConversation, loadingEarlierMessages, messages, getAccessToken]);

  const loadFavorites = useCallback(
    async (profileId?: string) => {
      if (isPreviewMode) {
        setFavorites(
          profileId
            ? PREVIEW_FAVORITES.filter((f) => f.profile_id === profileId)
            : PREVIEW_FAVORITES
        );
        return;
      }
      const token = await getAccessToken();
      if (!token) return;
      const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
      const res = await fetch(`/api/chat/favorites${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    },
    [getAccessToken, isPreviewMode]
  );

  useEffect(() => {
    void loadConfigAndPrompts();
  }, [loadConfigAndPrompts]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (routeConversationId) {
      void loadConversationMessages(routeConversationId);
    } else if (isPreviewMode) {
      const defaultConv = PREVIEW_CONVERSATIONS[0];
      setActiveConversation(defaultConv);
      setMessages(PREVIEW_MESSAGES[defaultConv.id] || []);
      setHasMoreMessages(false);
      setReplyTarget(null);
    } else {
      setActiveConversation(null);
      setMessages([]);
      setHasMoreMessages(false);
      setReplyTarget(null);
    }
    setInChatQuery('');
    setActiveMatchIdx(0);
  }, [routeConversationId, loadConversationMessages, isPreviewMode]);

  const activeProfile = useMemo(() => {
    if (!activeConversation?.profile_id) return null;
    return profiles.find((p) => p.id === activeConversation.profile_id) || null;
  }, [activeConversation, profiles]);

  const activeFollowups = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].role === 'assistant' &&
        Array.isArray(messages[i].followups_json) &&
        messages[i].followups_json.length > 0
      ) {
        return messages[i].followups_json;
      }
    }
    return [];
  }, [messages]);

  const isThreadLocked = messages.length > 0 || isStreaming;

  // In-chat keyword search match tracking
  const matchedMessageIds = useMemo(() => {
    const q = inChatQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, inChatQuery]);

  const activeMatchMessageId =
    matchedMessageIds.length > 0
      ? matchedMessageIds[activeMatchIdx % matchedMessageIds.length]
      : null;

  useEffect(() => {
    if (!activeMatchMessageId) return;
    const node = document.querySelector(`[data-msg-id="${activeMatchMessageId}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeMatchMessageId]);

  const handleOpenInChatSearch = () => {
    setShowInChatSearch((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => inChatSearchInputRef.current?.focus(), 60);
      } else {
        setInChatQuery('');
        setActiveMatchIdx(0);
      }
      return next;
    });
  };

  const handleStepMatch = (delta: number) => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIdx((prev) => {
      const len = matchedMessageIds.length;
      return (prev + delta + len) % len;
    });
  };

  const handleCreateConversation = async (
    profileId: string | null,
    modeType: 'reading' | 'learn_astrology' = 'reading'
  ): Promise<ConversationRecord | null> => {
    setErrorBanner(null);
    const token = await getAccessToken();
    if (!token) return null;

    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: profileId,
        mode_type: modeType,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.conversation) {
      setErrorBanner(data.error || 'Could not start consultation');
      return null;
    }

    const created = data.conversation as ConversationRecord;
    setConversations((prev) => [created, ...prev]);
    setActiveConversation(created);
    setMessages([]);
    if (modeType === 'learn_astrology') {
      setModeSlug('learn_astrology');
    } else if (modeSlug === 'learn_astrology') {
      setModeSlug('general');
    }
    navigate(`/app/chat/${created.id}`);
    return created;
  };

  const handleToggleBookmark = async (conv: ConversationRecord) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_bookmarked: !conv.is_bookmarked }),
    });
    if (res.ok) {
      await loadConversations();
      if (activeConversation?.id === conv.id) {
        setActiveConversation((prev) =>
          prev ? { ...prev, is_bookmarked: !conv.is_bookmarked } : prev
        );
      }
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/conversations/${convId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
        navigate('/app/chat');
      }
    }
  };

  const handleSwitchProfileBeforeStart = async (nextProfileId: string | null) => {
    if (isThreadLocked) return;
    if (!activeConversation) {
      await handleCreateConversation(nextProfileId, 'reading');
      return;
    }

    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profile_id: nextProfileId }),
    });

    if (res.ok) {
      const data = await res.json();
      setActiveConversation(data.conversation);
      await loadConversations();
    }
  };

  const handleToggleMemory = async () => {
    if (!activeConversation) return;
    const token = await getAccessToken();
    if (!token) return;
    const nextVal = !activeConversation.use_full_profile_memory;
    const res = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ use_full_profile_memory: nextVal }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveConversation(data.conversation);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    const promptToSend = (overrideText ?? draftText).trim();
    if (!promptToSend || isStreaming) return;

    if (isPreviewMode) {
      setErrorBanner('This is a preview, login to start chatting');
      return;
    }

    setErrorBanner(null);
    const token = await getAccessToken();
    if (!token) return;

    let targetConversation = activeConversation;
    if (!targetConversation) {
      const inferredMode = modeSlug === 'learn_astrology' ? 'learn_astrology' : 'reading';
      targetConversation = await handleCreateConversation(null, inferredMode);
      if (!targetConversation) return;
    }

    if (!overrideText) {
      setDraftText('');
    }
    const currentReplyTarget = replyTarget;
    setReplyTarget(null);
    setIsStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/chat/conversations/${targetConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: promptToSend,
          expert: expertSlug,
          mode: modeSlug,
          outputFormat: outputSlug,
          language: languageSlug,
          parentMessageId: currentReplyTarget?.id || null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start consultation response');
      }

      if (!response.body) {
        throw new Error('Streaming response body missing');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith('data:')) continue;
          const jsonText = line.slice(5).trim();
          if (!jsonText) continue;

          const evt = JSON.parse(jsonText) as {
            type: string;
            message?: ChatMessageRecord;
            assistantMessage?: ChatMessageRecord;
            conversation?: ConversationRecord;
            text?: string;
            error?: string;
          };

          if (evt.type === 'user_message' && evt.message) {
            setMessages((prev) => [...prev, evt.message!]);
          } else if (evt.type === 'chunk' && evt.text) {
            accumulated += evt.text;
            setStreamingText(accumulated);
          } else if (evt.type === 'done') {
            if (evt.assistantMessage) {
              setMessages((prev) => [...prev, evt.assistantMessage!]);
            }
            if (evt.conversation) {
              setActiveConversation(evt.conversation);
            }
            setStreamingText('');
            setIsStreaming(false);
            await Promise.all([loadConversations(), refreshUser()]);
          } else if (evt.type === 'error') {
            throw new Error(evt.error || 'Consultation interrupted');
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorBanner(err instanceof Error ? err.message : 'Consultation error');
      }
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleToggleStar = async (msg: ChatMessageRecord) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/messages/${msg.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_starred: !msg.is_starred }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? data.message : m)));
    }
  };

  const handleToggleExclude = async (msg: ChatMessageRecord) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/messages/${msg.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ excluded_from_context: !msg.excluded_from_context }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? data.message : m)));
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/chat/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      await loadConversations();
    }
  };

  const handleToggleLock = () => {
    const next = !isSidebarLocked;
    setIsSidebarLocked(next);
    localStorage.setItem(SIDEBAR_LOCK_STORAGE_KEY, String(next));
    if (next) {
      setIsSidebarCollapsed(false);
    }
  };

  const handleMobileDrawerSignOut = async () => {
    if (isPreviewMode) {
      exitPreviewMode();
    } else {
      await signOut();
    }
    navigate('/app/login');
  };

  const activeExpertDisplay =
    catalog?.experts.find((e) => e.slug === expertSlug)?.displayName || 'Vedic astrologer';
  const activeModeDisplay =
    catalog?.modes.find((m) => m.slug === modeSlug)?.displayName || 'General';
  const activeProfileDisplay = activeProfile
    ? getProfileDisplayLabel(activeProfile)
    : activeConversation?.mode_type === 'learn_astrology'
    ? 'Learn Astrology'
    : 'General';

  return (
    <div className="flex-1 min-h-0 flex w-full max-w-full overflow-hidden bg-[#FAF7F2] md:rounded-3xl md:border md:border-[#3D3830]/12 md:shadow-[0_20px_50px_-24px_rgba(61,56,48,0.16)]">
      {/* Profile-Grouped Collapsible/Lockable Sidebar */}
      <ChatSidebar
        profiles={profiles}
        conversations={conversations}
        activeConversationId={activeConversation?.id || null}
        favorites={favorites}
        searchQuery={searchQuery}
        sortBy={sortBy}
        isLocked={isSidebarLocked}
        isCollapsed={isSidebarCollapsed}
        showMobileDrawer={showMobileDrawer}
        isPreviewMode={isPreviewMode}
        creditsBalance={appUser?.credits_balance ?? 0}
        onSignOut={handleMobileDrawerSignOut}
        onCloseMobileDrawer={() => setShowMobileDrawer(false)}
        onToggleCollapse={() => setIsSidebarCollapsed(true)}
        onToggleLock={handleToggleLock}
        onSearchChange={setSearchQuery}
        onSortChange={setSortBy}
        onSelectConversation={(id) => navigate(`/app/chat/${id}`)}
        onCreateConversation={handleCreateConversation}
        onToggleBookmark={handleToggleBookmark}
        onDeleteConversation={handleDeleteConversation}
        onLoadFavorites={loadFavorites}
      />

      {/* Main Consultation Studio Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Consultation Header Strip */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 border-b border-[#3D3830]/10 bg-[#FAF7F2] px-3 sm:px-4 md:px-7 py-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setShowMobileDrawer(true)}
              className="lg:hidden p-2 rounded-xl border border-[#3D3830]/12 text-[#3D3830] active:scale-[0.97] transition-all shrink-0"
              aria-label="Open consultation menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:inline-flex p-2 rounded-xl border border-[#3D3830]/12 text-[#5C5449] hover:text-[#3D3830] shrink-0"
                title="Expand consultation folders"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="font-serif text-lg md:text-xl font-medium text-[#3D3830] truncate">
                {activeConversation ? activeConversation.title : 'Cosmic Council Chat'}
              </h1>
              <p className="text-[11px] text-[#8B8275] truncate">
                <span className="font-medium text-[#5C5449]">{activeProfileDisplay}</span>
                <span> · {activeExpertDisplay}</span>
                <span> · {activeModeDisplay}</span>
                {activeProfile && (
                  <span className="hidden sm:inline">
                    {' '}
                    · {activeProfile.is_activated ? 'Chart Context Loaded' : 'Draft Profile'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeProfile && !activeProfile.is_activated && (
              <Link
                to="/app/profiles"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-3 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E]"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Activate Chart</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleOpenInChatSearch}
              title="Search within conversation"
              aria-label="Search within conversation"
              className={`p-2 rounded-xl border transition-all active:scale-[0.96] ${
                showInChatSearch
                  ? 'border-[#3D3830]/25 bg-[#F1ECE3] text-[#3D3830]'
                  : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              title="Chat settings"
              aria-label="Open chat settings"
              className="p-2 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830] active:scale-[0.96] transition-all"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* In-Chat Keyword Search Bar */}
        {showInChatSearch && (
          <div className="animate-cc-drawer-in flex items-center gap-2 border-b border-[#3D3830]/10 bg-[#F1ECE3]/80 px-4 md:px-7 py-2">
            <Search className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
            <input
              ref={inChatSearchInputRef}
              type="text"
              value={inChatQuery}
              onChange={(e) => {
                setInChatQuery(e.target.value);
                setActiveMatchIdx(0);
              }}
              placeholder="Find keywords in this reading..."
              className="flex-1 min-w-0 bg-transparent text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
            />

            {inChatQuery.trim() && (
              <span className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#8B8275] shrink-0">
                {matchedMessageIds.length > 0
                  ? `${(activeMatchIdx % matchedMessageIds.length) + 1} of ${matchedMessageIds.length}`
                  : '0 matches'}
              </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={matchedMessageIds.length === 0}
                onClick={() => handleStepMatch(-1)}
                aria-label="Previous match"
                className="p-1 rounded-lg text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-35"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={matchedMessageIds.length === 0}
                onClick={() => handleStepMatch(1)}
                aria-label="Next match"
                className="p-1 rounded-lg text-[#5C5449] hover:bg-[#FAF7F2] disabled:opacity-35"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInChatSearch(false);
                  setInChatQuery('');
                  setActiveMatchIdx(0);
                }}
                aria-label="Close in-chat search"
                className="p-1 rounded-lg text-[#8B8275] hover:text-[#3D3830]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorBanner && (
          <div className="mx-4 md:mx-8 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-4 py-2.5 text-xs text-[#7A3E36]">
            <span>{errorBanner}</span>
            {isPreviewMode ? (
              <Link to="/app/login" className="underline font-medium shrink-0">
                Login
              </Link>
            ) : (
              <Link to="/app/billing" className="underline font-medium shrink-0">
                View Credits
              </Link>
            )}
          </div>
        )}

        {/* Editorial Message Reading Thread */}
        <MessageThread
          conversation={activeConversation}
          profile={activeProfile}
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          loadingEarlierMessages={loadingEarlierMessages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          catalog={catalog}
          fontSize={chatFontSize}
          searchQuery={inChatQuery}
          activeMatchMessageId={activeMatchMessageId}
          onLoadEarlierMessages={() => void handleLoadEarlierMessages()}
          onReplyToMessage={(msg) => setReplyTarget(msg)}
          onToggleStar={handleToggleStar}
          onToggleExclude={handleToggleExclude}
          onDeleteMessage={handleDeleteMessage}
          onSelectFollowUp={(q) => void handleSendMessage(q)}
          onQuickStarterPrompt={(q) => void handleSendMessage(q)}
        />

        {/* Composer */}
        <ChatComposer
          draftText={draftText}
          onDraftChange={setDraftText}
          catalog={catalog}
          profiles={profiles}
          activeProfileId={activeConversation?.profile_id || null}
          useFullProfileMemory={activeConversation?.use_full_profile_memory ?? true}
          expertSlug={expertSlug}
          modeSlug={modeSlug}
          outputSlug={outputSlug}
          languageSlug={languageSlug}
          replyTarget={replyTarget}
          activeFollowups={activeFollowups}
          customPrompts={customPrompts}
          isStreaming={isStreaming}
          isThreadLocked={isThreadLocked}
          isPreviewMode={isPreviewMode}
          onChangeExpert={setExpertSlug}
          onChangeMode={setModeSlug}
          onChangeLanguage={setLanguageSlug}
          onChangeOutput={setOutputSlug}
          onSwitchProfile={handleSwitchProfileBeforeStart}
          onToggleMemory={handleToggleMemory}
          onClearReply={() => setReplyTarget(null)}
          onOpenMyPrompts={() => setShowMyPrompts(true)}
          onOpenQuickTools={() => setShowQuickTools(true)}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
        />
      </div>

      {/* Quick Tools Modal (Question Generator, Prompt Expander, Prompt Optimizer) */}
      <QuickToolsModal
        isOpen={showQuickTools}
        initialDraft={draftText}
        modeSlug={modeSlug}
        languageSlug={languageSlug}
        profileId={activeConversation?.profile_id || null}
        toolsCatalog={catalog?.tools}
        getAccessToken={getAccessToken}
        onClose={() => setShowQuickTools(false)}
        onInsertText={(text, sendNow) => {
          if (sendNow) {
            void handleSendMessage(text);
          } else {
            setDraftText(text);
          }
        }}
      />

      {/* User Custom Prompts Modal ("My Prompts", max 10) */}
      <MyPromptsModal
        isOpen={showMyPrompts}
        prompts={customPrompts}
        maxLimit={10}
        getAccessToken={getAccessToken}
        onPromptsUpdated={setCustomPrompts}
        onInsertPrompt={(text) => setDraftText(text)}
        onClose={() => setShowMyPrompts(false)}
      />

      {/* Top-Right Chat Preferences Modal */}
      <ChatSettingsModal
        isOpen={showChatSettings}
        isPreviewMode={isPreviewMode}
        catalog={catalog}
        initialCallName={preferredCallName}
        initialFontSize={chatFontSize}
        initialExpert={appUser?.default_expert || expertSlug}
        initialOutput={appUser?.default_output || outputSlug}
        initialLanguage={appUser?.default_language || languageSlug}
        getAccessToken={getAccessToken}
        onSaved={(updated) => {
          setPreferredCallName(updated.preferredCallName);
          setChatFontSize(updated.chatFontSize);
          if (!isThreadLocked) {
            setExpertSlug(updated.defaultExpert);
          }
          setOutputSlug(updated.defaultOutput);
          setLanguageSlug(updated.defaultLanguage);
          if (!isPreviewMode) {
            void refreshUser();
          }
        }}
        onClose={() => setShowChatSettings(false)}
      />
    </div>
  );
};

export default ChatWorkspace;
