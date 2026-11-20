import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Menu,
  MessageSquarePlus,
  PanelLeftOpen,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useAppShell } from './AppLayout';
import ChatSidebar from './ChatSidebar';
import MessageThread, { type InlineChartCreationState } from './MessageThread';
import ChatComposer from './ChatComposer';
import Tooltip from './Tooltip';
import UserAvatar from './UserAvatar';
import MyPromptsModal from './MyPromptsModal';
import ChatSettingsModal, { type ChatFontSize } from './ChatSettingsModal';
import BirthChartModal from './BirthChartModal';
import { getUserProfileDisplayLabel, isAffirmativeReply } from './chatUtilities';
import type {
  ChatAttachmentInput,
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  ChatResponseLength,
  ChatToneMode,
  ConversationRecord,
  CustomPromptRecord,
  FavoriteMessageRecord,
  PendingBirthProfileDraft,
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

const getHeaderProfileLabel = (p: ChatProfile | null, modeType?: string): string => {
  if (p) {
    return p.short_name?.trim() || p.name;
  }
  if (modeType === 'learn_astrology') return 'Learn Astrology';
  return 'General';
};

const formatLastChatted = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const ChatWorkspace: React.FC = () => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { appUser, isPreviewMode, exitPreviewMode, signOut, getAccessToken, refreshUser } = useAuth();
  const { openAccountSettings } = useAppShell();

  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationRecord | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
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
  const [toneMode, setToneMode] = useState<ChatToneMode>('technical');
  const [responseLength, setResponseLength] = useState<ChatResponseLength>('detailed');
  const [pendingMemory, setPendingMemory] = useState<boolean>(true);
  const [chatFontSize, setChatFontSize] = useState<ChatFontSize>(appUser?.chat_font_size || 'base');

  const [draftText, setDraftText] = useState('');
  const [extraProfileIds, setExtraProfileIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachmentInput[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessageRecord | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [showMyPrompts, setShowMyPrompts] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showHeaderThreadMenu, setShowHeaderThreadMenu] = useState(false);

  // Phase 2 & Phase 3 states
  const [generalReadyMode, setGeneralReadyMode] = useState(false);
  const [showAddChartModal, setShowAddChartModal] = useState(false);
  const [addChartInitialValues, setAddChartInitialValues] = useState<
    Partial<PendingBirthProfileDraft> | undefined
  >(undefined);
  const [editingPendingChatDraft, setEditingPendingChatDraft] = useState(false);
  const [composerFocusTrigger, setComposerFocusTrigger] = useState(0);
  const [pendingProfileConfirm, setPendingProfileConfirm] = useState<{
    messageId: string;
    draft: PendingBirthProfileDraft;
  } | null>(null);
  const [inlineChartCreation, setInlineChartCreation] =
    useState<InlineChartCreationState | null>(null);

  // In-chat keyword search
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inChatSearchInputRef = useRef<HTMLInputElement | null>(null);
  const headerThreadMenuRef = useRef<HTMLDivElement | null>(null);
  const seededQueryRef = useRef<string>('');

  // Sync defaults once appUser loads
  useEffect(() => {
    if (appUser) {
      setExpertSlug((prev) => prev || appUser.default_expert || 'council_synthesis');
      setOutputSlug((prev) => prev || appUser.default_output || 'detailed');
      setLanguageSlug((prev) => prev || appUser.default_language || 'English');
      setChatFontSize(appUser.chat_font_size || 'base');
    }
  }, [appUser]);

  // Close header thread switcher on outside click or Escape
  useEffect(() => {
    if (!showHeaderThreadMenu) return;
    const handlePointer = (e: MouseEvent) => {
      if (
        headerThreadMenuRef.current &&
        !headerThreadMenuRef.current.contains(e.target as Node)
      ) {
        setShowHeaderThreadMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHeaderThreadMenu(false);
    };
    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [showHeaderThreadMenu]);

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
      setPendingProfileId(null);
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
    setExtraProfileIds([]);
    setAttachments([]);
    setGeneralReadyMode(false);
    setPendingProfileConfirm(null);
    setInlineChartCreation(null);
  }, [routeConversationId, loadConversationMessages, isPreviewMode]);

  useEffect(() => {
    if (routeConversationId) return;
    const seedProfileId = searchParams.get('profileId');
    const seedPrompt = searchParams.get('prompt');
    if (!seedProfileId && !seedPrompt) return;

    const queryKey = `${seedProfileId || ''}::${seedPrompt || ''}`;
    if (seededQueryRef.current === queryKey) return;
    seededQueryRef.current = queryKey;

    if (seedPrompt) setDraftText(seedPrompt);
    if (seedProfileId) setPendingProfileId(seedProfileId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('profileId');
    nextParams.delete('prompt');
    setSearchParams(nextParams, { replace: true });
  }, [routeConversationId, searchParams, setSearchParams]);

  const effectiveProfileId = activeConversation
    ? activeConversation.profile_id
    : pendingProfileId;

  const activeProfile = useMemo(() => {
    if (!effectiveProfileId) return null;
    return profiles.find((p) => p.id === effectiveProfileId) || null;
  }, [effectiveProfileId, profiles]);

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
        use_full_profile_memory: pendingMemory,
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
    setPendingProfileId(null);
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

  const effectiveMemory = activeConversation
    ? activeConversation.use_full_profile_memory
    : pendingMemory;

  const handleToggleMemory = async () => {
    if (!activeConversation) {
      setPendingMemory((prev) => !prev);
      return;
    }
    if (isPreviewMode) {
      setActiveConversation((prev) =>
        prev
          ? { ...prev, use_full_profile_memory: !prev.use_full_profile_memory }
          : prev
      );
      return;
    }
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

  const handleNewChat = () => {
    setErrorBanner(null);
    if (isPreviewMode) {
      setErrorBanner('This is a preview, login to start a new consultation');
      return;
    }
    setActiveConversation(null);
    setPendingProfileId(null);
    setPendingMemory(true);
    setGeneralReadyMode(false);
    setPendingProfileConfirm(null);
    setInlineChartCreation(null);
    setMessages([]);
    setReplyTarget(null);
    setDraftText('');
    setExtraProfileIds([]);
    setAttachments([]);
    if (modeSlug === 'learn_astrology') {
      setModeSlug('general');
    }
    navigate('/app/chat');
  };

  const handleOpenAddChartModal = (
    initialDraft?: Partial<PendingBirthProfileDraft>,
    fromPendingChat = false
  ) => {
    if (isPreviewMode) {
      setErrorBanner('This is a preview, login to save birth charts');
      return;
    }
    setAddChartInitialValues(initialDraft);
    setEditingPendingChatDraft(fromPendingChat);
    setShowAddChartModal(true);
  };

  const handleSelectProfileFromEmpty = (profileId: string) => {
    setGeneralReadyMode(false);
    if (activeConversation && messages.length === 0) {
      void handleSwitchProfileBeforeStart(profileId);
    } else {
      setPendingProfileId(profileId);
    }
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleSelectGeneralChartFromEmpty = () => {
    if (activeConversation && messages.length === 0 && activeConversation.profile_id) {
      void handleSwitchProfileBeforeStart(null);
    } else {
      setPendingProfileId(null);
    }
    setGeneralReadyMode(true);
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleSendMessage = async (
    overrideText?: string,
    overrideConversation?: ConversationRecord
  ) => {
    const promptToSend = (overrideText ?? draftText).trim();
    const pendingAttachments = overrideText ? [] : attachments;
    if ((!promptToSend && pendingAttachments.length === 0) || isStreaming) return;

    if (isPreviewMode) {
      setErrorBanner('This is a preview, login to start chatting');
      return;
    }

    // Phase 3: If the user types "Yes" / "Correct" / "Confirm" to the AI's birth-detail confirmation prompt,
    // immediately trigger one-step chart creation and attach to this chat!
    if (
      !overrideConversation &&
      pendingProfileConfirm &&
      pendingAttachments.length === 0 &&
      isAffirmativeReply(promptToSend)
    ) {
      if (!overrideText) setDraftText('');
      void handleConfirmPendingProfile(pendingProfileConfirm.draft);
      return;
    }

    setErrorBanner(null);
    setGeneralReadyMode(false);
    const token = await getAccessToken();
    if (!token) return;

    let targetConversation = overrideConversation || activeConversation;
    if (!targetConversation) {
      const inferredMode = modeSlug === 'learn_astrology' ? 'learn_astrology' : 'reading';
      targetConversation = await handleCreateConversation(pendingProfileId, inferredMode);
      if (!targetConversation) return;
    }

    const currentReplyTarget = replyTarget;
    const currentExtraProfiles = extraProfileIds;
    if (!overrideText) {
      setDraftText('');
      setAttachments([]);
    }
    setReplyTarget(null);
    setPendingProfileConfirm(null);
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
          toneMode,
          responseLength,
          extraProfileIds: currentExtraProfiles,
          attachments: pendingAttachments.map((a) => ({
            kind: a.kind,
            name: a.name,
            mimeType: a.mimeType,
            dataUrl: a.dataUrl,
          })),
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
            pendingProfile?: PendingBirthProfileDraft | null;
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
              if (evt.pendingProfile) {
                setPendingProfileConfirm({
                  messageId: evt.assistantMessage.id,
                  draft: evt.pendingProfile,
                });
              } else {
                setPendingProfileConfirm(null);
              }
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

  const attachCreatedProfileAndResumeReading = async (
    createdProfile: ChatProfile,
    originalQuestion?: string
  ) => {
    const token = await getAccessToken();
    if (!token) return;

    let updatedConv = activeConversation;
    if (activeConversation) {
      const patchRes = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_id: createdProfile.id }),
      });
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        if (patchData.conversation) {
          updatedConv = patchData.conversation as ConversationRecord;
          setActiveConversation(updatedConv);
        }
      }
    }

    await loadConversations();

    const readingPrompt = originalQuestion
      ? `The birth chart for ${createdProfile.name} is now saved and attached to this consultation. Please provide the full Vedic astrology reading for: ${originalQuestion}`
      : `The birth chart for ${createdProfile.name} is now saved and attached to this consultation. Please proceed with a detailed Vedic astrology reading.`;

    void handleSendMessage(readingPrompt, updatedConv || undefined);
  };

  const handleConfirmPendingProfile = async (draft: PendingBirthProfileDraft) => {
    setErrorBanner(null);
    setPendingProfileConfirm(null);
    setInlineChartCreation({
      status: 'creating',
      name: draft.name,
      draft,
    });

    try {
      const token = await getAccessToken();
      if (!token) {
        setInlineChartCreation({
          status: 'error',
          name: draft.name,
          draft,
          errorMessage: 'Please sign in to create and save this birth chart.',
        });
        return;
      }

      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name,
          birth_date: draft.birth_date,
          birth_time: draft.birth_time,
          place_query: draft.place_query,
          birth_city: draft.birth_city,
          birth_state: draft.birth_state,
          birth_country: draft.birth_country,
          gender: draft.gender,
          relationship: draft.relationship || (profiles.length === 0 ? 'Self' : 'Other'),
          is_default: profiles.length === 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        setInlineChartCreation({
          status: 'error',
          name: draft.name,
          draft,
          errorMessage:
            data.error ||
            'Could not calculate this birth chart. Please check the place of birth and try again.',
        });
        return;
      }

      const createdProfile = data.profile as ChatProfile;
      setProfiles((prev) => [
        createdProfile,
        ...prev.filter((p) => p.id !== createdProfile.id),
      ]);
      setInlineChartCreation({
        status: 'success',
        name: createdProfile.name,
        draft,
      });

      window.setTimeout(() => {
        setInlineChartCreation(null);
        void attachCreatedProfileAndResumeReading(
          createdProfile,
          draft.original_question
        );
      }, 950);
    } catch (err) {
      setInlineChartCreation({
        status: 'error',
        name: draft.name,
        draft,
        errorMessage:
          err instanceof Error ? err.message : 'Network error while creating your birth chart.',
      });
    }
  };

  const handleChartCreatedFromModal = (createdProfile: ChatProfile) => {
    setProfiles((prev) => {
      const cleaned = createdProfile.is_default
        ? prev.map((p) => ({ ...p, is_default: false }))
        : prev;
      return [createdProfile, ...cleaned.filter((p) => p.id !== createdProfile.id)];
    });

    const originalQuestion = addChartInitialValues?.original_question;
    const wasEditingChatDraft = editingPendingChatDraft;
    setEditingPendingChatDraft(false);
    setAddChartInitialValues(undefined);

    if (wasEditingChatDraft && activeConversation) {
      setPendingProfileConfirm(null);
      setInlineChartCreation(null);
      void attachCreatedProfileAndResumeReading(createdProfile, originalQuestion);
      return;
    }

    setGeneralReadyMode(false);
    if (activeConversation && messages.length === 0) {
      void handleSwitchProfileBeforeStart(createdProfile.id);
    } else if (!activeConversation) {
      setPendingProfileId(createdProfile.id);
    }
    void loadConversations();
    setComposerFocusTrigger((n) => n + 1);
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

  const headerProfileName = getHeaderProfileLabel(
    activeProfile,
    activeConversation?.mode_type ||
      (modeSlug === 'learn_astrology' ? 'learn_astrology' : 'reading')
  );

  const sameProfileConversations = useMemo(() => {
    const targetProfileId = activeConversation
      ? activeConversation.profile_id || null
      : effectiveProfileId || null;
    const targetMode = activeConversation?.mode_type;

    return conversations
      .filter((c) => {
        const cid = c.profile_id || null;
        if (cid !== targetProfileId) return false;
        if (!targetProfileId && targetMode) {
          return c.mode_type === targetMode;
        }
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(a.updated_at || a.created_at).getTime();
        const tB = new Date(b.updated_at || b.created_at).getTime();
        return tB - tA;
      });
  }, [conversations, activeConversation, effectiveProfileId]);

  return (
    <div className="flex-1 min-h-0 flex w-full max-w-full overflow-hidden bg-[#FAF7F2]">
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
        onOpenAddChartModal={() => handleOpenAddChartModal()}
        onToggleBookmark={handleToggleBookmark}
        onDeleteConversation={handleDeleteConversation}
        onLoadFavorites={loadFavorites}
      />

      {/* Main Consultation Studio Pane */}
      <div className="relative flex-1 flex flex-col min-w-0 h-full">
        {/* Slim Single-Line Consultation Header Strip */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-[#3D3830]/10 bg-[#FAF7F2] px-3 sm:px-4 md:px-6 py-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowMobileDrawer(true)}
              className="lg:hidden p-1.5 rounded-xl border border-[#3D3830]/12 text-[#3D3830] active:scale-[0.97] transition-all shrink-0"
              aria-label="Open consultation menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                aria-label="Expand consultation folders"
                className="hidden lg:inline-flex p-1.5 rounded-xl border border-[#3D3830]/12 text-[#5C5449] hover:text-[#3D3830] shrink-0"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            {/* Single-Line Profile (Chat Title) + Same-Profile Last-Chatted Switcher */}
            <div ref={headerThreadMenuRef} className="relative min-w-0 flex-1 max-w-2xl">
              <button
                type="button"
                onClick={() => setShowHeaderThreadMenu((v) => !v)}
                aria-expanded={showHeaderThreadMenu}
                aria-label="Switch conversations for this profile"
                className="group inline-flex items-center gap-1.5 max-w-full rounded-xl px-2 py-1 -ml-2 hover:bg-[#F1ECE3]/80 transition-colors cursor-pointer text-left"
              >
                <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate">
                  <span className="font-semibold text-[#3D3830]">{headerProfileName}</span>{' '}
                  <span className="text-[#5C5449]">
                    ({activeConversation ? activeConversation.title : 'New Chat'})
                  </span>
                </h1>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-[#8B8275] group-hover:text-[#3D3830] transition-transform duration-150 ${
                    showHeaderThreadMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showHeaderThreadMenu && (
                <div className="animate-cc-dropdown-down absolute left-0 top-full mt-1.5 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-[#F1ECE3]/80 border-b border-[#3D3830]/10">
                    <span className="text-[11px] font-medium text-[#5C5449] truncate">
                      {headerProfileName} · Last chatted
                    </span>
                    <span className="text-[10px] font-['DM_Sans',sans-serif] text-[#8B8275]">
                      {sameProfileConversations.length}
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                    {sameProfileConversations.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-[#8B8275]">
                        No saved chats for {headerProfileName} yet.
                      </p>
                    ) : (
                      sameProfileConversations.map((conv) => {
                        const isActive = conv.id === activeConversation?.id;
                        return (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => {
                              setShowHeaderThreadMenu(false);
                              navigate(`/app/chat/${conv.id}`);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#F1ECE3] text-[#3D3830]'
                                : 'text-[#5C5449] hover:bg-[#F1ECE3]/60 hover:text-[#3D3830]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[#3D3830] truncate">
                                {conv.title}
                              </p>
                              <p className="text-[10px] text-[#8B8275] font-['DM_Sans',sans-serif]">
                                {formatLastChatted(conv.updated_at || conv.created_at)}
                              </p>
                            </div>
                            {isActive && (
                              <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-[#3D3830]/10 p-1.5 bg-[#FAF7F2]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderThreadMenu(false);
                        if (isPreviewMode) {
                          handleNewChat();
                        } else {
                          void handleCreateConversation(
                            effectiveProfileId || null,
                            activeConversation?.mode_type === 'learn_astrology'
                              ? 'learn_astrology'
                              : 'reading'
                          );
                        }
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 transition-colors cursor-pointer"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                      <span className="truncate">New chat for {headerProfileName}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Tooltip content="Search within conversation" placement="bottom">
              <button
                type="button"
                onClick={handleOpenInChatSearch}
                aria-label="Search within conversation"
                className={`p-1.5 rounded-xl border transition-all active:scale-[0.96] cursor-pointer ${
                  showInChatSearch
                    ? 'border-[#3D3830]/25 bg-[#F1ECE3] text-[#3D3830]'
                    : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <Search className="h-4 w-4" />
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              aria-label="Open chat settings"
              className="p-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830] active:scale-[0.96] transition-all cursor-pointer"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <Tooltip
              content={
                isPreviewMode
                  ? 'Design Preview Mode'
                  : appUser?.email
                  ? `Signed in as ${appUser.email}`
                  : 'Account'
              }
              placement="bottom"
            >
              <button
                type="button"
                onClick={openAccountSettings}
                aria-label={
                  isPreviewMode
                    ? 'Account preview settings'
                    : appUser?.email
                    ? `Signed in as ${appUser.email}`
                    : 'Open account settings'
                }
                className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/12 bg-[#FDFBF7] p-0.5 md:pr-2.5 text-[#3D3830] hover:border-[#8B7355]/45 active:scale-[0.97] transition-all cursor-pointer"
              >
                <UserAvatar size="xs" />
                <span className="hidden md:inline max-w-[160px] lg:max-w-[200px] truncate text-[11px] font-medium text-[#5C5449]">
                  {isPreviewMode
                    ? 'Preview'
                    : getUserProfileDisplayLabel(appUser, 'Signed in')}
                </span>
              </button>
            </Tooltip>
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
              <span className="text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] shrink-0">
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
          profiles={profiles}
          generalReadyMode={generalReadyMode}
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          loadingEarlierMessages={loadingEarlierMessages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          catalog={catalog}
          fontSize={chatFontSize}
          languageSlug={languageSlug}
          searchQuery={inChatQuery}
          activeMatchMessageId={activeMatchMessageId}
          pendingProfileConfirm={pendingProfileConfirm}
          inlineChartCreation={inlineChartCreation}
          onLoadEarlierMessages={() => void handleLoadEarlierMessages()}
          onReplyToMessage={(msg) => setReplyTarget(msg)}
          onToggleStar={handleToggleStar}
          onToggleExclude={handleToggleExclude}
          onDeleteMessage={handleDeleteMessage}
          onSelectFollowUp={(q) => void handleSendMessage(q)}
          onSelectProfile={handleSelectProfileFromEmpty}
          onOpenAddChartModal={() => handleOpenAddChartModal()}
          onSelectGeneralChart={handleSelectGeneralChartFromEmpty}
          onConfirmPendingProfile={(draft) => void handleConfirmPendingProfile(draft)}
          onEditPendingProfile={(draft) => handleOpenAddChartModal(draft, true)}
        />

        {/* Composer */}
        <ChatComposer
          draftText={draftText}
          onDraftChange={setDraftText}
          catalog={catalog}
          profiles={profiles}
          activeProfileId={effectiveProfileId}
          extraProfileIds={extraProfileIds}
          attachments={attachments}
          expertSlug={expertSlug}
          modeSlug={modeSlug}
          outputSlug={outputSlug}
          languageSlug={languageSlug}
          fontSize={chatFontSize}
          useFullProfileMemory={effectiveMemory}
          toneMode={toneMode}
          responseLength={responseLength}
          replyTarget={replyTarget}
          activeFollowups={activeFollowups}
          customPrompts={customPrompts}
          isStreaming={isStreaming}
          isThreadLocked={isThreadLocked}
          isPreviewMode={isPreviewMode}
          getAccessToken={getAccessToken}
          onChangeExpert={setExpertSlug}
          onChangeMode={setModeSlug}
          onChangeOutput={setOutputSlug}
          onChangeLanguage={setLanguageSlug}
          onChangeFontSize={(nextSize) => {
            setChatFontSize(nextSize);
            if (!isPreviewMode) {
              void getAccessToken().then((token) => {
                if (!token) return;
                return fetch('/api/app/me/preferences', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ chat_font_size: nextSize }),
                });
              });
            }
          }}
          onToggleMemory={handleToggleMemory}
          onChangeToneMode={setToneMode}
          onChangeResponseLength={setResponseLength}
          onSwitchProfile={handleSwitchProfileBeforeStart}
          onAddExtraProfile={(pid) =>
            setExtraProfileIds((prev) =>
              prev.includes(pid) || prev.length >= 3 ? prev : [...prev, pid]
            )
          }
          onRemoveExtraProfile={(pid) =>
            setExtraProfileIds((prev) => prev.filter((id) => id !== pid))
          }
          onAddAttachments={(newFiles) =>
            setAttachments((prev) => [...prev, ...newFiles].slice(0, 4))
          }
          onRemoveAttachment={(attId) =>
            setAttachments((prev) => prev.filter((a) => a.id !== attId))
          }
          onClearReply={() => setReplyTarget(null)}
          onOpenMyPrompts={() => setShowMyPrompts(true)}
          onOpenSettings={() => setShowChatSettings(true)}
          onOpenAddChartModal={() => handleOpenAddChartModal()}
          onNewChat={handleNewChat}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          focusTrigger={composerFocusTrigger}
        />
      </div>

      {/* One-Step Add Birth Details Modal */}
      <BirthChartModal
        isOpen={showAddChartModal}
        onClose={() => {
          setShowAddChartModal(false);
          setEditingPendingChatDraft(false);
          setAddChartInitialValues(undefined);
        }}
        onCreated={handleChartCreatedFromModal}
        getAccessToken={getAccessToken}
        isPreviewMode={isPreviewMode}
        isFirstChart={profiles.length === 0}
        initialValues={addChartInitialValues}
        title={editingPendingChatDraft ? 'Edit Birth Details' : 'Add Birth Details'}
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

      {/* Consultation & Chat Settings Modal */}
      <ChatSettingsModal
        isOpen={showChatSettings}
        isPreviewMode={isPreviewMode}
        catalog={catalog}
        profiles={profiles}
        activeProfileId={effectiveProfileId}
        useFullProfileMemory={effectiveMemory}
        expertSlug={expertSlug}
        modeSlug={modeSlug}
        outputSlug={outputSlug}
        languageSlug={languageSlug}
        toneMode={toneMode}
        responseLength={responseLength}
        isThreadLocked={isThreadLocked}
        initialFontSize={chatFontSize}
        getAccessToken={getAccessToken}
        onSwitchProfile={handleSwitchProfileBeforeStart}
        onChangeExpert={setExpertSlug}
        onChangeMode={setModeSlug}
        onChangeOutput={setOutputSlug}
        onChangeLanguage={setLanguageSlug}
        onChangeToneMode={setToneMode}
        onChangeResponseLength={setResponseLength}
        onToggleMemory={handleToggleMemory}
        onSaved={(updated) => {
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
