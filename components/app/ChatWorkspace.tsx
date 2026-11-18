import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Menu, PanelLeftOpen, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import ChatSidebar from './ChatSidebar';
import MessageThread from './MessageThread';
import ChatComposer from './ChatComposer';
import QuickToolsModal from './QuickToolsModal';
import MyPromptsModal from './MyPromptsModal';
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

const ChatWorkspace: React.FC = () => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { appUser, isPreviewMode, getAccessToken, refreshUser } = useAuth();

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

  // Mid-chat active consultation parameters
  const [expertSlug, setExpertSlug] = useState(appUser?.default_expert || 'council_synthesis');
  const [modeSlug, setModeSlug] = useState('life');
  const [outputSlug, setOutputSlug] = useState(appUser?.default_output || 'detailed');
  const [languageSlug, setLanguageSlug] = useState(appUser?.default_language || 'English');

  const [draftText, setDraftText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessageRecord | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [showQuickTools, setShowQuickTools] = useState(false);
  const [showMyPrompts, setShowMyPrompts] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync defaults once appUser loads
  useEffect(() => {
    if (appUser) {
      setExpertSlug((prev) => prev || appUser.default_expert || 'council_synthesis');
      setOutputSlug((prev) => prev || appUser.default_output || 'detailed');
      setLanguageSlug((prev) => prev || appUser.default_language || 'English');
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
        setReplyTarget(null);
        if (foundConv.mode_type === 'learn_astrology') {
          setModeSlug('learn_astrology');
        }
        return;
      }
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data.conversation || null);
        setMessages(data.messages || []);
        setReplyTarget(null);
        if (data.conversation?.mode_type === 'learn_astrology') {
          setModeSlug('learn_astrology');
        }
      }
    },
    [getAccessToken, isPreviewMode]
  );

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
      setReplyTarget(null);
    } else {
      setActiveConversation(null);
      setMessages([]);
      setReplyTarget(null);
    }
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
      setModeSlug('life');
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

  const handleSwitchProfileMidChat = async (nextProfileId: string | null) => {
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
      if (!overrideText) setDraftText('');
      const nowIso = new Date().toISOString();
      const userPreviewMsg: ChatMessageRecord = {
        id: `preview-u-${Date.now()}`,
        conversation_id: activeConversation?.id || 'preview-conv-1',
        parent_message_id: replyTarget?.id || null,
        role: 'user',
        content: promptToSend,
        word_count: promptToSend.split(/\s+/).length,
        expert_used: null,
        mode_used: null,
        output_format_used: null,
        language_used: null,
        is_starred: false,
        excluded_from_context: false,
        followups_json: [],
        created_at: nowIso,
      };
      const assistantPreviewMsg: ChatMessageRecord = {
        id: `preview-a-${Date.now() + 1}`,
        conversation_id: activeConversation?.id || 'preview-conv-1',
        parent_message_id: null,
        role: 'assistant',
        content: `### Design Preview Response\nYou tested sending a prompt using **${expertSlug}** in **${modeSlug}** mode (${outputSlug} · ${languageSlug}).\n\nOnce Supabase credentials are connected and you sign in, this studio streams live Gemini multi-system Vedic readings grounded in your activated chart & daily Gochar transits.`,
        word_count: 42,
        expert_used: expertSlug,
        mode_used: modeSlug,
        output_format_used: outputSlug,
        language_used: languageSlug,
        is_starred: false,
        excluded_from_context: false,
        followups_json: [],
        credits_charged: 0,
        created_at: nowIso,
      };
      setReplyTarget(null);
      setMessages((prev) => [...prev, userPreviewMsg, assistantPreviewMsg]);
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

  return (
    <div className="-mx-4 md:-mx-8 -my-8 flex h-[calc(100vh-84px)] overflow-hidden bg-[#FAF7F2]">
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
        <div className="flex items-center justify-between gap-4 border-b border-[#3D3830]/10 bg-[#FAF7F2] px-4 md:px-8 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setShowMobileDrawer(true)}
              className="lg:hidden p-2 rounded-xl border border-[#3D3830]/12 text-[#3D3830]"
              aria-label="Open consultation folders"
            >
              <Menu className="h-4 w-4" />
            </button>

            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:inline-flex p-2 rounded-xl border border-[#3D3830]/12 text-[#5C5449] hover:text-[#3D3830]"
                title="Expand consultation folders"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="font-serif text-lg md:text-xl font-medium text-[#3D3830] truncate">
                {activeConversation ? activeConversation.title : 'Cosmic Council Chat Studio'}
              </h1>
              <p className="text-[11px] text-[#8B8275] truncate">
                {activeProfile
                  ? `${activeProfile.name} · ${activeProfile.is_activated ? 'Chart Context Loaded' : 'Draft Profile'}`
                  : activeConversation?.mode_type === 'learn_astrology'
                  ? 'Learn Astrology · Interactive Jyotish Tutor'
                  : 'General Consultation · Attach a birth profile anytime below'}
              </p>
            </div>
          </div>

          {activeProfile && !activeProfile.is_activated && (
            <Link
              to="/app/profiles"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] shrink-0"
            >
              <Sparkles className="h-3 w-3" />
              <span>Activate Chart</span>
            </Link>
          )}
        </div>

        {/* Error Notification */}
        {errorBanner && (
          <div className="mx-4 md:mx-8 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-4 py-2.5 text-xs text-[#7A3E36]">
            <span>{errorBanner}</span>
            <Link to="/app/billing" className="underline font-medium shrink-0">
              View Credits
            </Link>
          </div>
        )}

        {/* Editorial Message Reading Thread */}
        <MessageThread
          conversation={activeConversation}
          profile={activeProfile}
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          catalog={catalog}
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
          onChangeExpert={setExpertSlug}
          onChangeMode={setModeSlug}
          onChangeOutput={setOutputSlug}
          onChangeLanguage={setLanguageSlug}
          onSwitchProfile={handleSwitchProfileMidChat}
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
    </div>
  );
};

export default ChatWorkspace;
