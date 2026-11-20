import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  Lightbulb,
  Menu,
  MessageSquarePlus,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Star,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useAppShell } from './AppLayout';
import ChatSidebar from './ChatSidebar';
import MessageThread, { type InlineChartCreationState } from './MessageThread';
import ChatComposer from './ChatComposer';
import CompanionSetupView from './CompanionSetupView';
import Tooltip from './Tooltip';
import UserAvatar from './UserAvatar';
import MyPromptsModal from './MyPromptsModal';
import ChatSettingsModal, { type ChatFontSize } from './ChatSettingsModal';
import BirthChartModal from './BirthChartModal';
import AskLaterDrawer from './AskLaterDrawer';
import { getUserProfileDisplayLabel, isAffirmativeReply } from './chatUtilities';
import type {
  ActiveChatTab,
  AskLaterItem,
  ChatAttachmentInput,
  ChatCatalog,
  ChatMessageRecord,
  ChatPillar,
  ChatProfile,
  ChatResponseLength,
  ChatToneMode,
  CompanionArchetypeSlug,
  CompanionPersona,
  ConversationRecord,
  CustomPromptRecord,
  FavoriteMessageRecord,
  MessageSuggestions,
  PendingBirthProfileDraft,
  PublicChatbotUiConfig,
  PublicSuggestionsUiConfig,
  SuggestionItem,
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
const ACTIVE_TABS_STORAGE_KEY = 'cc_active_tabs_v1';
const LOCAL_CONV_META_STORAGE_KEY = 'cc_conv_pillar_meta_v1';
const MAX_ACTIVE_TABS = 5;

interface LocalConvPillarMeta {
  pillar: ChatPillar;
  companion_type?: CompanionArchetypeSlug | null;
  companion_persona_json?: CompanionPersona | null;
}

interface TabStateSnapshot {
  draftText: string;
  pendingProfileId: string | null;
  pendingMemory: boolean;
  expertSlug: string;
  modeSlug: string;
  generalReadyMode: boolean;
  extraProfileIds: string[];
  messages: ChatMessageRecord[];
  conversation: ConversationRecord | null;
  askLaterItems: AskLaterItem[];
  hasMoreMessages: boolean;
}

const DEFAULT_CORE_TABS: ActiveChatTab[] = [
  {
    tabId: 'core-council',
    pillar: 'council',
    conversationId: null,
    label: 'Council',
    isCore: true,
  },
  {
    tabId: 'core-companion',
    pillar: 'companion',
    conversationId: null,
    label: 'Companion',
    isCore: true,
  },
  {
    tabId: 'core-clarity',
    pillar: 'clarity',
    conversationId: null,
    label: 'Clarity',
    isCore: true,
  },
];

function readLocalConvMetaMap(): Record<string, LocalConvPillarMeta> {
  try {
    const raw = localStorage.getItem(LOCAL_CONV_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalConvMeta(convId: string, meta: LocalConvPillarMeta): void {
  try {
    const map = readLocalConvMetaMap();
    map[convId] = meta;
    localStorage.setItem(LOCAL_CONV_META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function enrichConversationWithLocalMeta(conv: ConversationRecord): ConversationRecord {
  const local = readLocalConvMetaMap()[conv.id];
  if (!local) {
    return {
      ...conv,
      pillar: conv.pillar || (conv.companion_persona_json ? 'companion' : 'council'),
    };
  }
  return {
    ...conv,
    pillar: conv.pillar && conv.pillar !== 'council' ? conv.pillar : local.pillar,
    companion_type: conv.companion_type || local.companion_type || null,
    companion_persona_json: conv.companion_persona_json || local.companion_persona_json || null,
  };
}

function truncateTabLabel(text: string, maxLen = 18): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

function deriveTabLabelForConversation(
  conv: ConversationRecord,
  profiles: ChatProfile[]
): string {
  const pillar = conv.pillar || (conv.companion_persona_json ? 'companion' : 'council');
  if (pillar === 'clarity') return 'Clarity';
  if (pillar === 'companion') {
    const name = conv.companion_persona_json?.name || conv.title.split('·')[0].trim();
    return truncateTabLabel(name || 'Companion', 16);
  }
  const title = (conv.title || '').trim();
  const isGenericTitle =
    !title || title.toLowerCase() === 'new consultation' || title.toLowerCase() === 'new chat';
  const prof = conv.profile_id ? profiles.find((p) => p.id === conv.profile_id) : null;
  const profShort = prof ? prof.short_name?.trim() || prof.name.split(/\s+/)[0] : null;
  if (!isGenericTitle) {
    return truncateTabLabel(title, 18);
  }
  if (profShort) {
    return truncateTabLabel(profShort, 16);
  }
  return 'Council';
}

function loadInitialTabs(isPreview: boolean): ActiveChatTab[] {
  if (isPreview) {
    const defaultCouncil = PREVIEW_CONVERSATIONS[0];
    return [
      {
        tabId: 'core-council',
        pillar: 'council',
        conversationId: defaultCouncil?.id || null,
        label: defaultCouncil ? truncateTabLabel(defaultCouncil.title, 18) : 'Council',
        isCore: true,
      },
      {
        tabId: 'core-companion',
        pillar: 'companion',
        conversationId: null,
        label: 'Companion',
        isCore: true,
      },
      {
        tabId: 'core-clarity',
        pillar: 'clarity',
        conversationId: null,
        label: 'Clarity',
        isCore: true,
      },
    ];
  }

  try {
    const raw = localStorage.getItem(ACTIVE_TABS_STORAGE_KEY);
    if (!raw) return DEFAULT_CORE_TABS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CORE_TABS;
    const sanitized: ActiveChatTab[] = parsed
      .filter((t): t is ActiveChatTab => Boolean(t && t.tabId && t.pillar))
      .slice(0, MAX_ACTIVE_TABS);

    // Ensure the 3 core tabs always exist
    const ensured = [...sanitized];
    for (const core of DEFAULT_CORE_TABS) {
      if (!ensured.some((t) => t.tabId === core.tabId)) {
        ensured.push(core);
      }
    }
    return ensured.slice(0, MAX_ACTIVE_TABS);
  } catch {
    return DEFAULT_CORE_TABS;
  }
}

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

interface ChatWorkspaceProps {
  embeddedPreview?: boolean;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ embeddedPreview = false }) => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { appUser, isPreviewMode, exitPreviewMode, signOut, getAccessToken, refreshUser } = useAuth();
  const { openAccountSettings } = useAppShell();

  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [chatbotConfig, setChatbotConfig] = useState<PublicChatbotUiConfig | null>(null);
  const [suggestionsConfig, setSuggestionsConfig] = useState<PublicSuggestionsUiConfig | null>(null);
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
    if (embeddedPreview) return false;
    return localStorage.getItem(SIDEBAR_LOCK_STORAGE_KEY) !== 'false';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(embeddedPreview);
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
  const [suggestionsAutoExpand, setSuggestionsAutoExpand] = useState<boolean>(
    appUser?.suggestions_auto_expand ?? true
  );

  const [draftText, setDraftText] = useState('');
  const [pendingTechnicalDirective, setPendingTechnicalDirective] = useState<{
    label: string;
    directive: string;
  } | null>(null);
  const [askLaterItems, setAskLaterItems] = useState<AskLaterItem[]>([]);
  const [showAskLaterDrawer, setShowAskLaterDrawer] = useState(false);
  const [extraProfileIds, setExtraProfileIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachmentInput[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessageRecord | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTabId, setStreamingTabId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Phase 2: Multi-Thread Tabs (Council | Companion | Clarity | + up to 5)
  const [tabs, setTabs] = useState<ActiveChatTab[]>(() => loadInitialTabs(isPreviewMode));
  const [activeTabId, setActiveTabId] = useState<string>('core-council');
  const [companionSetupArchetype, setCompanionSetupArchetype] =
    useState<CompanionArchetypeSlug | null>(null);
  const [companionSetupKey, setCompanionSetupKey] = useState<number>(0);

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
  const tabCacheRef = useRef<Record<string, TabStateSnapshot>>({});
  const previewConvStoreRef = useRef<Record<string, ConversationRecord>>({});
  const previewMsgStoreRef = useRef<Record<string, ChatMessageRecord[]>>({});
  const didHydrateDbTabsRef = useRef(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.tabId === activeTabId) || tabs[0] || DEFAULT_CORE_TABS[0],
    [tabs, activeTabId]
  );
  const activePillar: ChatPillar = activeTab.pillar;
  const activeCompanionPersona: CompanionPersona | null =
    activePillar === 'companion'
      ? activeConversation?.companion_persona_json || null
      : null;

  // Persist active tabs locally (for non-preview reloads and pre-migration 006 fallback)
  useEffect(() => {
    if (isPreviewMode || embeddedPreview) return;
    try {
      localStorage.setItem(ACTIVE_TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // Ignore storage quota errors
    }
  }, [tabs, isPreviewMode, embeddedPreview]);

  // Sync defaults once appUser loads
  useEffect(() => {
    if (appUser) {
      setExpertSlug((prev) => prev || appUser.default_expert || 'council_synthesis');
      setOutputSlug((prev) => prev || appUser.default_output || 'detailed');
      setLanguageSlug((prev) => prev || appUser.default_language || 'English');
      setChatFontSize(appUser.chat_font_size || 'base');
      if (typeof appUser.suggestions_auto_expand === 'boolean') {
        setSuggestionsAutoExpand(appUser.suggestions_auto_expand);
      }
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
      if (cfg.suggestionsConfig) {
        setSuggestionsConfig(cfg.suggestionsConfig as PublicSuggestionsUiConfig);
      }
      if (cfg.chatbotConfig) {
        const uiCfg = cfg.chatbotConfig as PublicChatbotUiConfig;
        setChatbotConfig(uiCfg);
        setToneMode(uiCfg.default_tone || 'technical');
        setResponseLength(uiCfg.default_response_length || 'detailed');
        if (embeddedPreview) {
          if (uiCfg.default_expert) setExpertSlug(uiCfg.default_expert);
          if (uiCfg.default_mode) setModeSlug(uiCfg.default_mode);
          if (uiCfg.default_output) setOutputSlug(uiCfg.default_output);
          if (uiCfg.default_language) setLanguageSlug(uiCfg.default_language);
        } else {
          if (uiCfg.default_mode) setModeSlug((prev) => prev || uiCfg.default_mode);
          if (!appUser?.default_expert && uiCfg.default_expert) {
            setExpertSlug(uiCfg.default_expert);
          }
          if (!appUser?.default_output && uiCfg.default_output) {
            setOutputSlug(uiCfg.default_output);
          }
          if (!appUser?.default_language && uiCfg.default_language) {
            setLanguageSlug(uiCfg.default_language);
          }
        }
      }
    }
    if (promptRes.ok) {
      const pr = await promptRes.json();
      setCustomPrompts(pr.prompts || []);
    }
  }, [getAccessToken, isPreviewMode, embeddedPreview, appUser?.default_expert, appUser?.default_output, appUser?.default_language]);

  const loadConversations = useCallback(async () => {
    if (isPreviewMode) {
      const q = searchQuery.trim().toLowerCase();
      const dynamicPreviewConvs = Object.values(previewConvStoreRef.current);
      const merged = [
        ...dynamicPreviewConvs,
        ...PREVIEW_CONVERSATIONS.filter((c) => !previewConvStoreRef.current[c.id]),
      ];
      const filtered = merged.filter((c) => !q || c.title.toLowerCase().includes(q));
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
      const rawConvs = (data.conversations || []) as ConversationRecord[];
      const enrichedConvs = rawConvs.map(enrichConversationWithLocalMeta);
      const loadedProfiles = (data.profiles || []) as ChatProfile[];
      setConversations(enrichedConvs);
      setProfiles(loadedProfiles);

      // Reconcile tab labels & hydrate DB-pinned tabs once on initial load
      setTabs((prevTabs) => {
        const convById = new Map(enrichedConvs.map((c) => [c.id, c]));
        let nextTabs = prevTabs.map((t) => {
          if (!t.conversationId) return t;
          const match = convById.get(t.conversationId);
          if (!match) {
            if (t.isCore) {
              return {
                ...t,
                conversationId: null,
                label:
                  t.pillar === 'companion'
                    ? 'Companion'
                    : t.pillar === 'clarity'
                    ? 'Clarity'
                    : 'Council',
              };
            }
            return null;
          }
          return {
            ...t,
            label: deriveTabLabelForConversation(match, loadedProfiles),
          };
        }).filter((t): t is ActiveChatTab => Boolean(t));

        if (!didHydrateDbTabsRef.current) {
          didHydrateDbTabsRef.current = true;
          const dbPinned = enrichedConvs.filter((c) => c.is_active_tab);
          for (const pinned of dbPinned) {
            if (nextTabs.some((t) => t.conversationId === pinned.id)) continue;
            const p: ChatPillar =
              pinned.pillar || (pinned.companion_persona_json ? 'companion' : 'council');
            const emptyCoreIdx = nextTabs.findIndex(
              (t) => t.isCore && t.pillar === p && !t.conversationId
            );
            if (emptyCoreIdx >= 0) {
              nextTabs[emptyCoreIdx] = {
                ...nextTabs[emptyCoreIdx],
                conversationId: pinned.id,
                label: deriveTabLabelForConversation(pinned, loadedProfiles),
              };
            } else if (nextTabs.length < MAX_ACTIVE_TABS) {
              nextTabs = [
                ...nextTabs,
                {
                  tabId: `tab-${pinned.id}`,
                  pillar: p,
                  conversationId: pinned.id,
                  label: deriveTabLabelForConversation(pinned, loadedProfiles),
                  isCore: false,
                },
              ];
            }
          }
        }

        return nextTabs;
      });
    }
  }, [getAccessToken, sortBy, searchQuery, isPreviewMode]);

  const loadConversationMessages = useCallback(
    async (convId: string) => {
      if (isPreviewMode) {
        const foundConv =
          previewConvStoreRef.current[convId] ||
          PREVIEW_CONVERSATIONS.find((c) => c.id === convId) ||
          PREVIEW_CONVERSATIONS[0];
        const foundMsgs =
          previewMsgStoreRef.current[foundConv.id] || PREVIEW_MESSAGES[foundConv.id] || [];
        setActiveConversation(foundConv);
        setAskLaterItems(Array.isArray(foundConv.ask_later_json) ? foundConv.ask_later_json : []);
        setMessages(foundMsgs);
        setHasMoreMessages(false);
        setReplyTarget(null);
        setPendingTechnicalDirective(null);
        if (foundConv.mode_type === 'learn_astrology') {
          setModeSlug('learn_astrology');
        }
        return foundConv;
      }
      const token = await getAccessToken();
      if (!token) return null;

      const res = await fetch(`/api/chat/conversations/${convId}/messages?limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const rawConv = (data.conversation || null) as ConversationRecord | null;
        const loadedConv = rawConv ? enrichConversationWithLocalMeta(rawConv) : null;
        const loadedMsgs = (data.messages || []) as ChatMessageRecord[];
        setActiveConversation(loadedConv);
        setAskLaterItems(
          Array.isArray(loadedConv?.ask_later_json) ? loadedConv!.ask_later_json! : []
        );
        setMessages(loadedMsgs);
        setHasMoreMessages(Boolean(data.hasMore));
        setReplyTarget(null);
        setPendingTechnicalDirective(null);

        const firstAssistant = loadedMsgs.find((m) => m.role === 'assistant');
        if (loadedConv?.pillar === 'council' || !loadedConv?.pillar) {
          if (firstAssistant?.expert_used) setExpertSlug(firstAssistant.expert_used);
          if (loadedConv?.mode_type === 'learn_astrology') {
            setModeSlug('learn_astrology');
          } else if (firstAssistant?.mode_used) {
            setModeSlug(firstAssistant.mode_used);
          }
        }
        return loadedConv;
      }
      return null;
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

  // Snapshot helper for instant zero-flicker multi-tab switching
  const snapshotActiveTabState = useCallback(
    (tabIdToSave: string) => {
      tabCacheRef.current[tabIdToSave] = {
        draftText,
        pendingProfileId,
        pendingMemory,
        expertSlug,
        modeSlug,
        generalReadyMode,
        extraProfileIds,
        messages,
        conversation: activeConversation,
        askLaterItems,
        hasMoreMessages,
      };
    },
    [
      draftText,
      pendingProfileId,
      pendingMemory,
      expertSlug,
      modeSlug,
      generalReadyMode,
      extraProfileIds,
      messages,
      activeConversation,
      askLaterItems,
      hasMoreMessages,
    ]
  );

  // Persist active tab pin state to backend (fails gracefully pre-migration 006)
  const syncTabPinBackend = useCallback(
    async (convId: string, isPinned: boolean, tabOrder?: number) => {
      if (isPreviewMode) return;
      try {
        const token = await getAccessToken();
        if (!token) return;
        await fetch(`/api/chat/conversations/${convId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active_tab: isPinned,
            ...(typeof tabOrder === 'number' ? { active_tab_order: tabOrder } : {}),
          }),
        });
      } catch {
        // Pre-migration or transient network error — local state remains intact
      }
    },
    [getAccessToken, isPreviewMode]
  );

  const activateTab = useCallback(
    (nextTab: ActiveChatTab, options?: { skipSnapshot?: boolean; forceReload?: boolean }) => {
      if (!options?.skipSnapshot && activeTabId && activeTabId !== nextTab.tabId) {
        snapshotActiveTabState(activeTabId);
      }

      setActiveTabId(nextTab.tabId);
      setErrorBanner(null);
      setInChatQuery('');
      setActiveMatchIdx(0);
      setReplyTarget(null);
      setPendingTechnicalDirective(null);
      setPendingProfileConfirm(null);
      setInlineChartCreation(null);
      setAttachments([]);

      const cached = tabCacheRef.current[nextTab.tabId];
      setDraftText(cached?.draftText || '');
      setExtraProfileIds(nextTab.pillar === 'council' ? cached?.extraProfileIds || [] : []);

      if (nextTab.pillar === 'clarity') {
        setPendingProfileId(null);
        setGeneralReadyMode(false);
        setPendingMemory(cached ? cached.pendingMemory : false);
      } else if (nextTab.pillar === 'companion') {
        setPendingProfileId(null);
        setGeneralReadyMode(false);
        setPendingMemory(cached ? cached.pendingMemory : true);
      } else {
        setPendingProfileId(cached?.pendingProfileId ?? null);
        setGeneralReadyMode(cached?.generalReadyMode ?? false);
        setPendingMemory(cached ? cached.pendingMemory : true);
        if (nextTab.expertSlug && !nextTab.conversationId) {
          setExpertSlug(nextTab.expertSlug);
        } else if (cached?.expertSlug) {
          setExpertSlug(cached.expertSlug);
        }
        if (cached?.modeSlug) {
          setModeSlug(cached.modeSlug);
        }
      }

      if (nextTab.conversationId) {
        const hasCachedMatch =
          !options?.forceReload &&
          cached &&
          cached.conversation?.id === nextTab.conversationId &&
          cached.messages.length > 0;
        if (hasCachedMatch) {
          setActiveConversation(cached.conversation);
          setMessages(cached.messages);
          setAskLaterItems(cached.askLaterItems || []);
          setHasMoreMessages(Boolean(cached.hasMoreMessages));
        } else {
          void loadConversationMessages(nextTab.conversationId);
        }
      } else {
        setActiveConversation(null);
        setMessages([]);
        setAskLaterItems([]);
        setHasMoreMessages(false);
      }
    },
    [activeTabId, snapshotActiveTabState, loadConversationMessages]
  );

  // Sync direct URL navigation (/app/chat/:conversationId) into the matching pillar tab
  useEffect(() => {
    if (embeddedPreview) {
      return;
    }
    if (routeConversationId) {
      if (activeConversation?.id === routeConversationId) return;
      setPendingProfileId(null);
      void loadConversationMessages(routeConversationId).then((loaded) => {
        if (!loaded) return;
        const convPillar: ChatPillar =
          loaded.pillar || (loaded.companion_persona_json ? 'companion' : 'council');
        setTabs((prev) => {
          const existing = prev.find((t) => t.conversationId === loaded.id);
          if (existing) {
            setActiveTabId(existing.tabId);
            return prev;
          }
          const coreId =
            convPillar === 'companion'
              ? 'core-companion'
              : convPillar === 'clarity'
              ? 'core-clarity'
              : 'core-council';
          setActiveTabId(coreId);
          return prev.map((t) =>
            t.tabId === coreId
              ? {
                  ...t,
                  conversationId: loaded.id,
                  label: deriveTabLabelForConversation(loaded, profiles),
                }
              : t
          );
        });
      });
    } else if (isPreviewMode && activeTabId === 'core-council' && !activeConversation) {
      const defaultConv = PREVIEW_CONVERSATIONS[0];
      setActiveConversation(defaultConv);
      setAskLaterItems(Array.isArray(defaultConv.ask_later_json) ? defaultConv.ask_later_json : []);
      setMessages(PREVIEW_MESSAGES[defaultConv.id] || []);
      setHasMoreMessages(false);
      setReplyTarget(null);
    }
  }, [embeddedPreview, routeConversationId, isPreviewMode]);

  useEffect(() => {
    if (embeddedPreview || routeConversationId) return;
    const seedProfileId = searchParams.get('profileId');
    const seedPrompt = searchParams.get('prompt');
    const seedPillar = searchParams.get('pillar');
    const seedExpert = searchParams.get('expert');
    if (!seedProfileId && !seedPrompt && !seedPillar && !seedExpert) return;

    const queryKey = `${seedProfileId || ''}::${seedPrompt || ''}::${seedPillar || ''}::${seedExpert || ''}`;
    if (seededQueryRef.current === queryKey) return;
    seededQueryRef.current = queryKey;

    if (seedPillar === 'companion') {
      const compTab = tabs.find((t) => t.tabId === 'core-companion') || tabs.find((t) => t.pillar === 'companion');
      if (compTab) {
        setActiveTabId(compTab.tabId);
        if (!compTab.conversationId) {
          setActiveConversation(null);
          setMessages([]);
        }
      }
    } else if (seedPillar === 'clarity') {
      const clarityTab = tabs.find((t) => t.tabId === 'core-clarity') || tabs.find((t) => t.pillar === 'clarity');
      if (clarityTab) {
        setActiveTabId(clarityTab.tabId);
      }
    } else if (seedPillar === 'council' || seedExpert || seedProfileId || seedPrompt) {
      const councilTab = tabs.find((t) => t.tabId === 'core-council') || tabs.find((t) => t.pillar === 'council');
      if (councilTab) {
        setActiveTabId(councilTab.tabId);
        if (seedExpert || seedPrompt) {
          setActiveConversation(null);
          setMessages([]);
          setTabs((prev) =>
            prev.map((t) =>
              t.tabId === councilTab.tabId
                ? { ...t, conversationId: null, label: 'Council', expertSlug: seedExpert || t.expertSlug }
                : t
            )
          );
        }
      }
    }

    if (seedExpert) setExpertSlug(seedExpert);
    if (seedPrompt) setDraftText(seedPrompt);
    if (seedProfileId) setPendingProfileId(seedProfileId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('profileId');
    nextParams.delete('prompt');
    nextParams.delete('pillar');
    nextParams.delete('expert');
    setSearchParams(nextParams, { replace: true });
  }, [embeddedPreview, routeConversationId, searchParams, setSearchParams, tabs]);

  const effectiveProfileId = activeConversation
    ? activeConversation.profile_id
    : pendingProfileId;

  const activeProfile = useMemo(() => {
    if (!effectiveProfileId) return null;
    return profiles.find((p) => p.id === effectiveProfileId) || null;
  }, [effectiveProfileId, profiles]);

  const activeFollowups = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const structured = [
        ...(m.suggestions_json?.followups || []),
        ...(m.suggestions_json?.deeper_analysis || []),
      ]
        .map((s) => s.text)
        .filter(Boolean);
      if (structured.length > 0) return structured;
      if (Array.isArray(m.followups_json) && m.followups_json.length > 0) {
        return m.followups_json;
      }
    }
    return [];
  }, [messages]);

  const suggestionsDefaultExpanded =
    suggestionsAutoExpand && (suggestionsConfig?.default_expanded ?? true);

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
    modeType: 'reading' | 'learn_astrology' = 'reading',
    pillarOverride?: ChatPillar
  ): Promise<ConversationRecord | null> => {
    setErrorBanner(null);
    const token = await getAccessToken();
    if (!token) return null;

    const targetPillar: ChatPillar = pillarOverride || activePillar;
    const isClarity = targetPillar === 'clarity';

    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: isClarity ? null : profileId,
        mode_type: isClarity ? 'reading' : modeType,
        pillar: targetPillar,
        is_active_tab: true,
        use_full_profile_memory: isClarity ? pendingMemory : pendingMemory,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.conversation) {
      setErrorBanner(data.error || 'Could not start consultation');
      return null;
    }

    const rawCreated = data.conversation as ConversationRecord;
    saveLocalConvMeta(rawCreated.id, { pillar: targetPillar });
    const created: ConversationRecord = {
      ...rawCreated,
      pillar: targetPillar,
      is_active_tab: true,
    };

    if (targetPillar !== 'clarity') {
      setConversations((prev) => [created, ...prev]);
    }
    setActiveConversation(created);
    setPendingProfileId(null);
    setMessages([]);
    if (targetPillar === 'council') {
      if (modeType === 'learn_astrology') {
        setModeSlug('learn_astrology');
      } else if (modeSlug === 'learn_astrology') {
        setModeSlug(chatbotConfig?.default_mode || 'general');
      }
    }

    // Bind created conversation to active tab (or matching core tab)
    setTabs((prev) =>
      prev.map((t) => {
        if (t.tabId === activeTabId && t.pillar === targetPillar) {
          return {
            ...t,
            conversationId: created.id,
            label:
              targetPillar === 'clarity'
                ? 'Clarity'
                : deriveTabLabelForConversation(created, profiles),
          };
        }
        return t;
      })
    );

    if (!embeddedPreview && targetPillar === 'council') {
      navigate(`/app/chat/${created.id}`, { replace: true });
    }
    return created;
  };

  // Multi-thread Tab & Companion Handlers
  const handleSelectTab = (nextTabId: string) => {
    if (nextTabId === activeTabId) return;
    const target = tabs.find((t) => t.tabId === nextTabId);
    if (!target) return;
    activateTab(target);
  };

  const handleCloseTab = (tabIdToClose: string) => {
    const target = tabs.find((t) => t.tabId === tabIdToClose);
    if (!target || target.isCore || tabs.length <= 1) return;

    if (target.conversationId) {
      void syncTabPinBackend(target.conversationId, false);
    }
    delete tabCacheRef.current[tabIdToClose];

    const remaining = tabs.filter((t) => t.tabId !== tabIdToClose);
    setTabs(remaining);

    if (activeTabId === tabIdToClose) {
      const fallback = remaining[0] || DEFAULT_CORE_TABS[0];
      activateTab(fallback, { skipSnapshot: true });
    }
  };

  const handleAddCouncilTab = (guideSlug: string) => {
    if (tabs.length >= MAX_ACTIVE_TABS) {
      setErrorBanner(`Up to ${MAX_ACTIVE_TABS} active tabs can be open at once. Close a tab to add another.`);
      return;
    }
    const guide = catalog?.experts.find((e) => e.slug === guideSlug);
    const shortGuideLabel = guide
      ? truncateTabLabel(guide.displayName.replace(/astrologer/i, '').trim() || guide.displayName, 14)
      : 'Council';

    const newTab: ActiveChatTab = {
      tabId: `tab-council-${Date.now()}`,
      pillar: 'council',
      conversationId: null,
      label: shortGuideLabel || 'Council',
      expertSlug: guideSlug,
      isCore: false,
    };

    snapshotActiveTabState(activeTabId);
    setTabs((prev) => [...prev, newTab]);
    setExpertSlug(guideSlug);
    setModeSlug(chatbotConfig?.default_mode || 'general');
    activateTab(newTab, { skipSnapshot: true });
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleOpenNewCompanionSetup = (archetype?: CompanionArchetypeSlug | null) => {
    setCompanionSetupArchetype(archetype || null);
    setCompanionSetupKey((k) => k + 1);

    const coreComp = tabs.find((t) => t.tabId === 'core-companion');
    if (coreComp && !coreComp.conversationId) {
      activateTab(coreComp);
      return;
    }

    // If active tab is already a companion tab and user clicked "New Companion", reset it to setup
    if (activeTab.pillar === 'companion' && !archetype) {
      if (activeTab.conversationId) {
        void syncTabPinBackend(activeTab.conversationId, false);
      }
      const resetTab: ActiveChatTab = {
        ...activeTab,
        conversationId: null,
        label: 'Companion',
      };
      setTabs((prev) => prev.map((t) => (t.tabId === activeTab.tabId ? resetTab : t)));
      delete tabCacheRef.current[activeTab.tabId];
      activateTab(resetTab, { skipSnapshot: true });
      return;
    }

    // Otherwise open a fresh Companion tab if under cap, else repurpose core-companion
    if (tabs.length < MAX_ACTIVE_TABS) {
      const newTab: ActiveChatTab = {
        tabId: `tab-companion-${Date.now()}`,
        pillar: 'companion',
        conversationId: null,
        label: 'Companion',
        isCore: false,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => [...prev, newTab]);
      activateTab(newTab, { skipSnapshot: true });
    } else if (coreComp) {
      if (coreComp.conversationId) {
        void syncTabPinBackend(coreComp.conversationId, false);
      }
      const resetCore: ActiveChatTab = {
        ...coreComp,
        conversationId: null,
        label: 'Companion',
      };
      setTabs((prev) => prev.map((t) => (t.tabId === coreComp.tabId ? resetCore : t)));
      delete tabCacheRef.current[coreComp.tabId];
      activateTab(resetCore);
    }
  };

  const handleOpenClarityTab = () => {
    const clarityTab = tabs.find((t) => t.tabId === 'core-clarity');
    if (clarityTab) {
      activateTab(clarityTab);
      setComposerFocusTrigger((n) => n + 1);
    }
  };

  const handleResetClarity = () => {
    const clarityTab = tabs.find((t) => t.tabId === 'core-clarity');
    if (!clarityTab) return;
    if (clarityTab.conversationId) {
      void syncTabPinBackend(clarityTab.conversationId, false);
    }
    const freshClarity: ActiveChatTab = {
      ...clarityTab,
      conversationId: null,
      label: 'Clarity',
    };
    delete tabCacheRef.current['core-clarity'];
    setTabs((prev) => prev.map((t) => (t.tabId === 'core-clarity' ? freshClarity : t)));
    activateTab(freshClarity, { skipSnapshot: true });
    setPendingMemory(false);
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleOpenExistingConversationAsTab = (conv: ConversationRecord) => {
    const enriched = enrichConversationWithLocalMeta(conv);
    const existingTab = tabs.find((t) => t.conversationId === enriched.id);
    if (existingTab) {
      activateTab(existingTab);
      return;
    }

    const pillar: ChatPillar =
      enriched.pillar || (enriched.companion_persona_json ? 'companion' : 'council');
    const emptyCore = tabs.find((t) => t.isCore && t.pillar === pillar && !t.conversationId);
    const nextLabel = deriveTabLabelForConversation(enriched, profiles);

    if (emptyCore) {
      const bound: ActiveChatTab = {
        ...emptyCore,
        conversationId: enriched.id,
        label: nextLabel,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => prev.map((t) => (t.tabId === emptyCore.tabId ? bound : t)));
      void syncTabPinBackend(enriched.id, true);
      activateTab(bound, { skipSnapshot: true, forceReload: true });
      return;
    }

    if (tabs.length >= MAX_ACTIVE_TABS) {
      setErrorBanner(
        `Up to ${MAX_ACTIVE_TABS} active tabs can stay open at once. Close or unpin a tab to pin another.`
      );
      return;
    }

    const newTab: ActiveChatTab = {
      tabId: `tab-${enriched.id}`,
      pillar,
      conversationId: enriched.id,
      label: nextLabel,
      isCore: false,
    };
    snapshotActiveTabState(activeTabId);
    setTabs((prev) => [...prev, newTab]);
    void syncTabPinBackend(enriched.id, true, tabs.length);
    activateTab(newTab, { skipSnapshot: true, forceReload: true });
  };

  const handleToggleActiveTabFromSidebar = (conv: ConversationRecord) => {
    const existingTab = tabs.find((t) => t.conversationId === conv.id);
    if (existingTab) {
      void syncTabPinBackend(conv.id, false);
      if (existingTab.isCore) {
        const clearedCore: ActiveChatTab = {
          ...existingTab,
          conversationId: null,
          label:
            existingTab.pillar === 'companion'
              ? 'Companion'
              : existingTab.pillar === 'clarity'
              ? 'Clarity'
              : 'Council',
        };
        delete tabCacheRef.current[existingTab.tabId];
        setTabs((prev) =>
          prev.map((t) => (t.tabId === existingTab.tabId ? clearedCore : t))
        );
        if (activeTabId === existingTab.tabId) {
          activateTab(clearedCore, { skipSnapshot: true });
        }
      } else {
        handleCloseTab(existingTab.tabId);
      }
      return;
    }

    handleOpenExistingConversationAsTab(conv);
  };

  const handleSelectSidebarConversation = (convId: string) => {
    const existingTab = tabs.find((t) => t.conversationId === convId);
    if (existingTab) {
      activateTab(existingTab);
      return;
    }

    const conv = conversations.find((c) => c.id === convId);
    const pillar: ChatPillar = conv
      ? conv.pillar || (conv.companion_persona_json ? 'companion' : 'council')
      : 'council';
    const coreId =
      pillar === 'companion'
        ? 'core-companion'
        : pillar === 'clarity'
        ? 'core-clarity'
        : 'core-council';

    const coreTab = tabs.find((t) => t.tabId === coreId) || tabs[0];
    const nextLabel = conv ? deriveTabLabelForConversation(conv, profiles) : coreTab.label;
    const updatedTab: ActiveChatTab = {
      ...coreTab,
      conversationId: convId,
      label: nextLabel,
    };

    snapshotActiveTabState(activeTabId);
    setTabs((prev) => prev.map((t) => (t.tabId === coreTab.tabId ? updatedTab : t)));
    activateTab(updatedTab, { skipSnapshot: true, forceReload: true });
    if (!embeddedPreview && pillar === 'council') {
      navigate(`/app/chat/${convId}`, { replace: true });
    }
  };

  const handleStartWithCompanion = async (persona: CompanionPersona) => {
    setErrorBanner(null);

    if (isPreviewMode) {
      const previewId = `preview-comp-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const previewConv: ConversationRecord = {
        id: previewId,
        user_id: 'preview-user',
        profile_id: null,
        linked_report_id: null,
        title: `${persona.name} · ${persona.role_label}`,
        mode_type: 'reading',
        pillar: 'companion',
        is_active_tab: true,
        companion_type: persona.companion_type,
        companion_persona_json: persona,
        is_bookmarked: false,
        use_full_profile_memory: true,
        total_word_count: persona.opening_message.split(/\s+/).length,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const openingMsg: ChatMessageRecord = {
        id: `preview-msg-open-${Date.now()}`,
        conversation_id: previewId,
        role: 'assistant',
        content: persona.opening_message,
        expert_used: 'companion',
        mode_used: persona.companion_type,
        output_format_used: null,
        language_used: languageSlug,
        is_starred: false,
        excluded_from_context: false,
        word_count: persona.opening_message.split(/\s+/).length,
        parent_message_id: null,
        followups_json: [],
        created_at: nowIso,
      };
      previewConvStoreRef.current[previewId] = previewConv;
      previewMsgStoreRef.current[previewId] = [openingMsg];
      setConversations((prev) => [previewConv, ...prev]);
      setActiveConversation(previewConv);
      setMessages([openingMsg]);
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === activeTabId
            ? {
                ...t,
                pillar: 'companion',
                conversationId: previewId,
                label: truncateTabLabel(persona.name, 16),
              }
            : t
        )
      );
      setComposerFocusTrigger((n) => n + 1);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error('Please sign in to start chatting with a companion.');
    }

    const res = await fetch('/api/chat/companions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        persona,
        makeActiveTab: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.conversation) {
      throw new Error(data.error || 'Could not start companion conversation.');
    }

    const rawConv = data.conversation as ConversationRecord;
    saveLocalConvMeta(rawConv.id, {
      pillar: 'companion',
      companion_type: persona.companion_type,
      companion_persona_json: persona,
    });
    const startedConv: ConversationRecord = {
      ...rawConv,
      pillar: 'companion',
      is_active_tab: true,
      companion_type: persona.companion_type,
      companion_persona_json: persona,
    };
    const openingMsg = (data.openingMessage || null) as ChatMessageRecord | null;

    setConversations((prev) => [startedConv, ...prev.filter((c) => c.id !== startedConv.id)]);
    setActiveConversation(startedConv);
    setMessages(openingMsg ? [openingMsg] : []);
    setHasMoreMessages(false);
    setAskLaterItems([]);
    setTabs((prev) =>
      prev.map((t) =>
        t.tabId === activeTabId
          ? {
              ...t,
              pillar: 'companion',
              conversationId: startedConv.id,
              label: truncateTabLabel(persona.name, 16),
            }
          : t
      )
    );
    setComposerFocusTrigger((n) => n + 1);
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
      setTabs((prev) =>
        prev
          .map((t) => {
            if (t.conversationId !== convId) return t;
            if (t.isCore) {
              return {
                ...t,
                conversationId: null,
                label:
                  t.pillar === 'companion'
                    ? 'Companion'
                    : t.pillar === 'clarity'
                    ? 'Clarity'
                    : 'Council',
              };
            }
            return null;
          })
          .filter((t): t is ActiveChatTab => Boolean(t))
      );
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
        if (!embeddedPreview) {
          navigate('/app/chat', { replace: true });
        }
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
    if (activePillar === 'companion') {
      handleOpenNewCompanionSetup(null);
      return;
    }
    if (activePillar === 'clarity') {
      handleResetClarity();
      return;
    }
    setActiveConversation(null);
    setAskLaterItems([]);
    setPendingProfileId(null);
    setPendingMemory(true);
    setGeneralReadyMode(false);
    setPendingProfileConfirm(null);
    setInlineChartCreation(null);
    setMessages([]);
    setReplyTarget(null);
    setDraftText('');
    setPendingTechnicalDirective(null);
    setExtraProfileIds([]);
    setAttachments([]);
    if (modeSlug === 'learn_astrology') {
      setModeSlug(chatbotConfig?.default_mode || 'general');
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.tabId === activeTabId
          ? {
              ...t,
              conversationId: null,
              label: t.isCore ? 'Council' : t.label,
            }
          : t
      )
    );
    delete tabCacheRef.current[activeTabId];
    if (!embeddedPreview) {
      navigate('/app/chat', { replace: true });
    }
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
    const chosenProfile = profiles.find((p) => p.id === profileId);
    if (chosenProfile && activePillar === 'council') {
      const shortName = chosenProfile.short_name?.trim() || chosenProfile.name.split(/\s+/)[0] || chosenProfile.name;
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === activeTabId && !t.conversationId
            ? { ...t, label: truncateTabLabel(shortName, 16) }
            : t
        )
      );
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
    overrideConversation?: ConversationRecord,
    overrideTechnicalDirective?: string
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

    const sendPillar: ChatPillar = activePillar;
    const sendTabId = activeTabId;

    let targetConversation = overrideConversation || activeConversation;
    if (!targetConversation) {
      if (sendPillar === 'companion') {
        setErrorBanner('Please choose a companion first to begin chatting.');
        return;
      }
      const inferredMode =
        sendPillar === 'council' && modeSlug === 'learn_astrology'
          ? 'learn_astrology'
          : 'reading';
      targetConversation = await handleCreateConversation(
        sendPillar === 'council' ? pendingProfileId : null,
        inferredMode,
        sendPillar
      );
      if (!targetConversation) return;
    }

    const currentReplyTarget = replyTarget;
    const currentExtraProfiles = sendPillar === 'council' ? extraProfileIds : [];
    const directiveToSend =
      sendPillar === 'council'
        ? overrideTechnicalDirective ??
          (!overrideText ? pendingTechnicalDirective?.directive : undefined)
        : undefined;

    if (!overrideText) {
      setDraftText('');
      setAttachments([]);
    }
    setPendingTechnicalDirective(null);
    setReplyTarget(null);
    setPendingProfileConfirm(null);
    setIsStreaming(true);
    setStreamingTabId(sendTabId);
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
          pillar: sendPillar,
          companionPersona:
            sendPillar === 'companion'
              ? targetConversation.companion_persona_json || activeCompanionPersona || undefined
              : undefined,
          technicalDirective: directiveToSend || undefined,
          expert: sendPillar === 'council' ? expertSlug : undefined,
          mode: sendPillar === 'council' ? modeSlug : undefined,
          outputFormat: sendPillar === 'council' ? outputSlug : undefined,
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
            suggestions?: MessageSuggestions | null;
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
              const enrichedAssistant: ChatMessageRecord = {
                ...evt.assistantMessage,
                suggestions_json:
                  sendPillar === 'council'
                    ? evt.assistantMessage.suggestions_json ?? evt.suggestions ?? null
                    : null,
              };
              setMessages((prev) => [...prev, enrichedAssistant]);
              if (sendPillar === 'council' && evt.pendingProfile) {
                setPendingProfileConfirm({
                  messageId: enrichedAssistant.id,
                  draft: evt.pendingProfile,
                });
              } else {
                setPendingProfileConfirm(null);
              }
            }
            if (evt.conversation) {
              const mergedConv = enrichConversationWithLocalMeta({
                ...evt.conversation,
                pillar: sendPillar,
                companion_persona_json:
                  evt.conversation.companion_persona_json ||
                  targetConversation.companion_persona_json ||
                  null,
              });
              setActiveConversation((prev) => ({
                ...mergedConv,
                ask_later_json:
                  mergedConv.ask_later_json ?? prev?.ask_later_json ?? askLaterItems,
              }));
              setTabs((prev) =>
                prev.map((t) =>
                  t.tabId === sendTabId
                    ? {
                        ...t,
                        conversationId: mergedConv.id,
                        label: deriveTabLabelForConversation(mergedConv, profiles),
                      }
                    : t
                )
              );
            }
            setStreamingText('');
            setIsStreaming(false);
            setStreamingTabId(null);
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
      setStreamingTabId(null);
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

  const handleSubmitSuggestion = (item: SuggestionItem) => {
    void handleSendMessage(item.text, undefined, item.technical_directive);
  };

  const handleInsertSuggestion = (item: SuggestionItem) => {
    setDraftText(item.text);
    if (item.technical_directive) {
      setPendingTechnicalDirective({
        label: item.text,
        directive: item.technical_directive,
      });
    } else {
      setPendingTechnicalDirective(null);
    }
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleToggleAskLater = async (
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis',
    sourceMessageId: string
  ) => {
    const normalizedText = item.text.trim().toLowerCase();
    const exists = askLaterItems.some(
      (entry) =>
        entry.id === item.id ||
        entry.text.trim().toLowerCase() === normalizedText
    );

    const optimisticNext: AskLaterItem[] = exists
      ? askLaterItems.filter(
          (entry) =>
            entry.id !== item.id &&
            entry.text.trim().toLowerCase() !== normalizedText
        )
      : [
          {
            id: item.id || `ask_${Date.now()}`,
            text: item.text.trim(),
            tier,
            technical_directive: item.technical_directive,
            source_message_id: sourceMessageId,
            saved_at: new Date().toISOString(),
          },
          ...askLaterItems,
        ].slice(0, 50);

    setAskLaterItems(optimisticNext);
    setActiveConversation((prev) =>
      prev ? { ...prev, ask_later_json: optimisticNext } : prev
    );

    if (isPreviewMode || !activeConversation?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/chat/conversations/${activeConversation.id}/ask-later`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle',
          item: {
            id: item.id,
            text: item.text,
            tier,
            technical_directive: item.technical_directive,
            source_message_id: sourceMessageId,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.persisted !== false && Array.isArray(data.items)) {
          setAskLaterItems(data.items as AskLaterItem[]);
          setActiveConversation((prev) =>
            prev ? { ...prev, ask_later_json: data.items as AskLaterItem[] } : prev
          );
        }
      }
    } catch {
      // Retain optimistic state on transient error
    }
  };

  const handleRemoveAskLaterItem = async (item: AskLaterItem) => {
    const normalizedText = item.text.trim().toLowerCase();
    const optimisticNext = askLaterItems.filter(
      (entry) =>
        entry.id !== item.id &&
        entry.text.trim().toLowerCase() !== normalizedText
    );
    setAskLaterItems(optimisticNext);
    setActiveConversation((prev) =>
      prev ? { ...prev, ask_later_json: optimisticNext } : prev
    );

    if (isPreviewMode || !activeConversation?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/chat/conversations/${activeConversation.id}/ask-later`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'remove',
          item: { id: item.id, text: item.text },
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.persisted !== false && Array.isArray(data.items)) {
          setAskLaterItems(data.items as AskLaterItem[]);
          setActiveConversation((prev) =>
            prev ? { ...prev, ask_later_json: data.items as AskLaterItem[] } : prev
          );
        }
      }
    } catch {
      // Retain optimistic state on transient error
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

  const activeTabConversationIds = useMemo(
    () =>
      tabs
        .map((t) => t.conversationId)
        .filter((id): id is string => Boolean(id)),
    [tabs]
  );

  const pastCompanionConversations = useMemo(
    () =>
      conversations.filter(
        (c) => c.pillar === 'companion' || Boolean(c.companion_persona_json)
      ),
    [conversations]
  );

  const recentPinnableConversations = useMemo(
    () => conversations.filter((c) => c.pillar !== 'clarity'),
    [conversations]
  );

  const isCompanionSetupMode = activePillar === 'companion' && !activeConversation;

  const sameProfileConversations = useMemo(() => {
    const targetProfileId = activeConversation
      ? activeConversation.profile_id || null
      : effectiveProfileId || null;
    const targetMode = activeConversation?.mode_type;

    return conversations
      .filter((c) => {
        if (c.pillar === 'companion' || c.pillar === 'clarity' || c.companion_persona_json) {
          return false;
        }
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
      {/* Profile-Grouped & Companion Collapsible/Lockable Sidebar */}
      <ChatSidebar
        profiles={profiles}
        conversations={conversations}
        activeConversationId={activeConversation?.id || null}
        activeTabConversationIds={activeTabConversationIds}
        maxActiveTabs={MAX_ACTIVE_TABS}
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
        onSelectConversation={handleSelectSidebarConversation}
        onToggleActiveTab={handleToggleActiveTabFromSidebar}
        onCreateConversation={(pid, modeType) => {
          const coreCouncil = tabs.find((t) => t.tabId === 'core-council');
          if (coreCouncil && activeTabId !== 'core-council') {
            activateTab(coreCouncil);
          }
          void handleCreateConversation(pid, modeType, 'council');
        }}
        onStartNewCompanion={() => handleOpenNewCompanionSetup(null)}
        onOpenClarity={handleOpenClarityTab}
        onOpenAddChartModal={() => handleOpenAddChartModal()}
        onToggleBookmark={handleToggleBookmark}
        onDeleteConversation={handleDeleteConversation}
        onLoadFavorites={loadFavorites}
      />

      {/* Main Consultation Studio Pane */}
      <div className="relative flex-1 flex flex-col min-w-0 h-full">
        {/* Slim Single-Line Pillar-Aware Header Strip */}
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

            {/* Pillar-Aware Title Region */}
            {activePillar === 'companion' ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <HeartHandshake className="h-4 w-4 text-[#8B7355] shrink-0" />
                <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate">
                  {activeCompanionPersona ? (
                    <>
                      <span className="font-semibold text-[#3D3830]">
                        {activeCompanionPersona.name}
                      </span>{' '}
                      <span className="text-[#5C5449]">
                        ({activeCompanionPersona.role_label})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-[#3D3830]">Companions</span>{' '}
                      <span className="text-[#5C5449]">(Find your match)</span>
                    </>
                  )}
                </h1>
              </div>
            ) : activePillar === 'clarity' ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Lightbulb className="h-4 w-4 text-[#B8965A] shrink-0" />
                <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate">
                  <span className="font-semibold text-[#3D3830]">Clarity</span>{' '}
                  <span className="text-[#5C5449]">(Off-record sidekick)</span>
                </h1>
              </div>
            ) : (
              /* Council: Single-Line Profile (Chat Title) + Same-Profile Last-Chatted Switcher */
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
                                handleSelectSidebarConversation(conv.id);
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
                                : 'reading',
                              'council'
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
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activePillar === 'companion' && activeConversation && (
              <Tooltip content="Match a different companion" placement="bottom">
                <button
                  type="button"
                  onClick={() => handleOpenNewCompanionSetup(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="hidden sm:inline">New Match</span>
                </button>
              </Tooltip>
            )}

            {activePillar === 'clarity' && messages.length > 0 && (
              <Tooltip content="Clear Clarity sidekick chat" placement="bottom">
                <button
                  type="button"
                  onClick={handleResetClarity}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </Tooltip>
            )}

            {activePillar === 'council' && (
              <Tooltip
                content={
                  askLaterItems.length > 0
                    ? `Ask later (${askLaterItems.length} saved)`
                    : 'Ask later saved questions'
                }
                placement="bottom"
              >
                <button
                  type="button"
                  onClick={() => setShowAskLaterDrawer(true)}
                  aria-label="Open Ask later saved questions"
                  className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border transition-all active:scale-[0.96] cursor-pointer ${
                    askLaterItems.length > 0
                      ? 'border-[#D4A017]/35 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
                      : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${
                      askLaterItems.length > 0
                        ? 'text-[#D4A017] fill-[#D4A017]'
                        : 'text-[#8B8275]'
                    }`}
                  />
                  {askLaterItems.length > 0 && (
                    <span className="font-mono text-[11px] tabular-nums font-medium text-[#3D3830]">
                      {askLaterItems.length}
                    </span>
                  )}
                </button>
              </Tooltip>
            )}

            {!isCompanionSetupMode && (
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
            )}

            <Tooltip content="Chat settings" placement="bottom">
              <button
                type="button"
                onClick={() => setShowChatSettings(true)}
                aria-label="Open chat settings"
                className="p-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830] active:scale-[0.96] transition-all cursor-pointer"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </Tooltip>

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
        {showInChatSearch && !isCompanionSetupMode && (
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
              placeholder="Find keywords in this conversation..."
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
            <div className="flex items-center gap-3 shrink-0">
              {isPreviewMode ? (
                <Link to="/app/login" className="underline font-medium">
                  Login
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="text-[#7A3E36]/75 hover:text-[#7A3E36] cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Viewport: Companion Matching Engine OR Message Thread */}
        {isCompanionSetupMode ? (
          <CompanionSetupView
            key={`${activeTabId}-${companionSetupKey}`}
            initialArchetype={companionSetupArchetype}
            pastCompanionConversations={pastCompanionConversations}
            isPreviewMode={isPreviewMode}
            getAccessToken={getAccessToken}
            onSelectPastCompanion={(convId) => handleSelectSidebarConversation(convId)}
            onStartWithCompanion={handleStartWithCompanion}
          />
        ) : (
          <MessageThread
            activePillar={activePillar}
            activeCompanionPersona={activeCompanionPersona}
            onSelectClarityPrompt={(prompt) => void handleSendMessage(prompt)}
            conversation={activeConversation}
            profile={activePillar === 'council' ? activeProfile : null}
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
            onSubmitSuggestion={handleSubmitSuggestion}
            onInsertSuggestion={handleInsertSuggestion}
            onToggleAskLater={(item, tier, msgId) =>
              void handleToggleAskLater(item, tier, msgId)
            }
            askLaterItems={askLaterItems}
            suggestionsDefaultExpanded={suggestionsDefaultExpanded}
            onSelectProfile={handleSelectProfileFromEmpty}
            onOpenAddChartModal={() => handleOpenAddChartModal()}
            onSelectGeneralChart={handleSelectGeneralChartFromEmpty}
            onConfirmPendingProfile={(draft) => void handleConfirmPendingProfile(draft)}
            onEditPendingProfile={(draft) => handleOpenAddChartModal(draft, true)}
            welcomeTitle={chatbotConfig?.welcome_title}
            welcomeSubtitle={chatbotConfig?.welcome_subtitle}
            generalReadyMessage={chatbotConfig?.general_ready_message}
            enableListen={chatbotConfig?.features?.listen_tts ?? true}
            enableWhatsappShare={chatbotConfig?.features?.whatsapp_share ?? true}
            enableFollowups={
              activePillar === 'council' &&
              (chatbotConfig?.features?.followups ?? true) &&
              ((suggestionsConfig?.followups_enabled ?? true) ||
                (suggestionsConfig?.deeper_analysis_enabled ?? true))
            }
          />
        )}

        {/* Adaptive Multi-Thread Composer */}
        <ChatComposer
          activePillar={activePillar}
          activeCompanionPersona={activeCompanionPersona}
          tabs={tabs}
          activeTabId={activeTabId}
          maxActiveTabs={MAX_ACTIVE_TABS}
          pastCompanionConversations={pastCompanionConversations}
          recentConversations={recentPinnableConversations}
          isStreamingTabId={streamingTabId}
          composerDisabled={isCompanionSetupMode}
          composerDisabledHint="Choose a companion above to begin talking..."
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onAddCouncilTab={handleAddCouncilTab}
          onAddCompanionArchetypeTab={(archetype) => handleOpenNewCompanionSetup(archetype)}
          onOpenExistingConversationAsTab={handleOpenExistingConversationAsTab}
          onResetClarity={handleResetClarity}
          onStartNewCompanion={() => handleOpenNewCompanionSetup(null)}
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
          pendingDirectiveLabel={pendingTechnicalDirective?.label || null}
          onClearPendingDirective={() => setPendingTechnicalDirective(null)}
          focusTrigger={composerFocusTrigger}
          composerPlaceholder={chatbotConfig?.composer_placeholder}
          enableVoiceInput={chatbotConfig?.features?.voice_input ?? true}
          enableAttachments={chatbotConfig?.features?.attachments ?? true}
          enableQuickTools={chatbotConfig?.features?.quick_tools ?? true}
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

      {/* Per-Conversation Ask Later Drawer */}
      <AskLaterDrawer
        isOpen={showAskLaterDrawer}
        items={askLaterItems}
        disabled={isStreaming}
        onClose={() => setShowAskLaterDrawer(false)}
        onSubmitItem={handleSubmitSuggestion}
        onInsertItem={handleInsertSuggestion}
        onRemoveItem={(item) => void handleRemoveAskLaterItem(item)}
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
        initialSuggestionsAutoExpand={suggestionsAutoExpand}
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
          setSuggestionsAutoExpand(updated.suggestionsAutoExpand);
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
