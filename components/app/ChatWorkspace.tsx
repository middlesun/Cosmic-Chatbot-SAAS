import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
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
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth, type AstrologyMode } from './AuthContext';
import { useAppShell } from './AppLayout';
import AstrologyModeToggle from './AstrologyModeToggle';
import ChatSidebar from './ChatSidebar';
import MessageThread, { type InlineChartCreationState } from './MessageThread';
import ChatComposer from './ChatComposer';
import CompanionSetupView from './CompanionSetupView';
import CompanionAvatar from './CompanionAvatar';
import CompanionProfileSheet from './CompanionProfileSheet';
import Tooltip from './Tooltip';
import UserAvatar from './UserAvatar';
import MyPromptsModal from './MyPromptsModal';
import ChatSettingsModal, {
  CHAT_NUMERIC_FONT_STORAGE_KEY,
  type ChatFontSize,
  type UserNumericFontChoice,
} from './ChatSettingsModal';
import BirthChartModal from './BirthChartModal';
import LifeContextModal from './LifeContextModal';
import AskLaterDrawer from './AskLaterDrawer';
import CouncilToCompanionModal, {
  type CouncilHandoffConfirmPayload,
  type CouncilHandoffSource,
} from './CouncilToCompanionModal';
import SharedReadingNotesModal from './SharedReadingNotesModal';
import { getUserProfileDisplayLabel, isAffirmativeReply } from './chatUtilities';
import {
  CHAT_NUMERIC_FONT_OPTIONS,
  COMPANION_LABEL_PLURAL,
  COMPANION_LABEL_SINGULAR,
  DEFAULT_COUNCIL_EXPERT_SLUG,
  isConsultantCatalogEntryAllowed,
  normalizeCouncilSlug,
  type ActiveChatTab,
  type AskLaterItem,
  type ChatAttachmentInput,
  type ChatCatalog,
  type ChatMessageRecord,
  type ChatNumericFont,
  type ChatPillar,
  type ChatProfile,
  type ChatResponseLength,
  type ChatStyle,
  type ChatToneMode,
  type ClarificationChip,
  type CompanionArchetypeSlug,
  type CompanionChatCue,
  type CompanionPersona,
  type ConversationRecord,
  type CustomPromptRecord,
  type DrawnTarotSpread,
  type FavoriteMessageRecord,
  type LifeContextData,
  type MessageReaction,
  type MessageReferralPayload,
  type MessageSuggestions,
  type PendingBirthProfileDraft,
  type PublicChatbotUiConfig,
  type PublicCompanionCard,
  type PublicSuggestionsUiConfig,
  type SharedReadingNoteRecord,
  type SuggestionItem,
  type TimingProgressWidget,
} from './chatTypes';
import {
  PREVIEW_CHAT_CATALOG,
  PREVIEW_CONVERSATIONS,
  PREVIEW_CUSTOM_PROMPTS,
  PREVIEW_FAVORITES,
  PREVIEW_MESSAGES,
  PREVIEW_PROFILES,
  PREVIEW_PUBLIC_COMPANIONS,
} from './previewFixtures';

const SIDEBAR_LOCK_STORAGE_KEY = 'cc_chat_sidebar_locked';
const ACTIVE_TABS_STORAGE_KEY = 'cc_active_tabs_v1';
const LOCAL_CONV_META_STORAGE_KEY = 'cc_conv_pillar_meta_v1';
const MAX_ACTIVE_TABS = 10;

interface LocalConvPillarMeta {
  pillar: ChatPillar;
  companion_type?: CompanionArchetypeSlug | null;
  companion_slug?: string | null;
  companion_chat_mode?: CompanionChatCue | null;
  companion_persona_json?: CompanionPersona | null;
}

interface TabStateSnapshot {
  draftText: string;
  pendingProfileId: string | null;
  pendingMemory: boolean;
  expertSlug: string;
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
    label: 'Vedic Astrologer',
    expertSlug: DEFAULT_COUNCIL_EXPERT_SLUG,
    isCore: false,
  },
  {
    tabId: 'core-companion',
    pillar: 'companion',
    conversationId: null,
    label: COMPANION_LABEL_SINGULAR,
    isCore: false,
  },
  {
    tabId: 'core-clarity',
    pillar: 'clarity',
    conversationId: null,
    label: 'Clarity',
    isCore: false,
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
    companion_slug: conv.companion_slug || local.companion_slug || null,
    companion_chat_mode: conv.companion_chat_mode || local.companion_chat_mode || null,
    companion_persona_json: conv.companion_persona_json || local.companion_persona_json || null,
  };
}

const COUNCIL_EXPERT_FALLBACK_NAMES: Record<string, string> = {
  [DEFAULT_COUNCIL_EXPERT_SLUG]: 'Vedic Astrologer',
  kp_precision: 'KP Astrology',
  jaimini: 'Jaimini Jyotish',
  western_astrologer: 'Western Astrologer',
  modern_astrologer: 'Modern Astrologer',
  tarot_reader: 'Tarot',
  numerologist: 'Numerology',
  hellenistic_astrologer: 'Hellenistic Astrologer',
  learn_astrology: 'Learn Astrology',
};

function resolveCouncilDisplayName(slug: string, catalog: ChatCatalog | null): string {
  const normalized = normalizeCouncilSlug(slug);
  const match = catalog?.experts?.find((e) => e.slug === normalized)?.displayName?.trim();
  if (match) return match;
  return COUNCIL_EXPERT_FALLBACK_NAMES[normalized] || 'Vedic Astrologer';
}

function buildClientCouncilTitle(
  profile: ChatProfile | null,
  expertSlug: string,
  catalog: ChatCatalog | null
): string {
  const person = profile ? profile.short_name?.trim() || profile.name : 'General';
  return `${person} (${resolveCouncilDisplayName(expertSlug, catalog)})`.slice(0, 80);
}

function isAutoGeneratedCouncilTitleClient(
  title: unknown,
  catalog: ChatCatalog | null
): boolean {
  const clean = typeof title === 'string' ? title.trim().toLowerCase() : '';
  if (!clean || clean === 'new consultation' || clean === 'new chat') return true;
  const match = clean.match(/^.+?\s*\(([^()]+)\)$/);
  if (!match) return false;
  const inner = match[1].trim().toLowerCase();
  const validSet = new Set([
    ...Object.values(COUNCIL_EXPERT_FALLBACK_NAMES).map((v) => v.toLowerCase()),
    ...(catalog?.experts || []).map((e) => e.displayName.trim().toLowerCase()),
  ]);
  return validSet.has(inner);
}

function deriveTabLabelForConversation(
  conv: ConversationRecord,
  profiles: ChatProfile[]
): string {
  const pillar = conv.pillar || (conv.companion_persona_json ? 'companion' : 'council');
  if (pillar === 'clarity') return 'Clarity';
  if (pillar === 'companion') {
    const companionName = conv.companion_persona_json?.name;
    if (
      companionName &&
      (!conv.title ||
        conv.title === 'Companion Chat' ||
        conv.title.startsWith(`${companionName} ·`))
    ) {
      return companionName;
    }
    return (conv.title || companionName || COMPANION_LABEL_SINGULAR).trim();
  }
  const title = (conv.title || '').trim();
  const isGenericTitle =
    !title || title.toLowerCase() === 'new consultation' || title.toLowerCase() === 'new chat';
  if (!isGenericTitle) {
    return title;
  }
  const prof = conv.profile_id ? profiles.find((p) => p.id === conv.profile_id) : null;
  const profShort = prof ? prof.short_name?.trim() || prof.name : 'General';
  const councilFallback =
    conv.mode_type === 'learn_astrology' ? 'Learn Astrology' : 'Vedic Astrologer';
  return `${profShort} (${councilFallback})`;
}

function loadInitialTabs(isPreview: boolean): ActiveChatTab[] {
  if (isPreview) {
    const defaultCouncil = PREVIEW_CONVERSATIONS[0];
    return [
      {
        tabId: 'core-council',
        pillar: 'council',
        conversationId: defaultCouncil?.id || null,
        label: defaultCouncil?.title || 'Vedic Astrologer',
        isCore: false,
      },
      {
        tabId: 'core-companion',
        pillar: 'companion',
        conversationId: null,
        label: COMPANION_LABEL_SINGULAR,
        isCore: false,
      },
      {
        tabId: 'core-clarity',
        pillar: 'clarity',
        conversationId: null,
        label: 'Clarity',
        isCore: false,
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
      .map((t) => ({
        ...t,
        isCore: false,
        label:
          t.pillar === 'companion' &&
          !t.conversationId &&
          !t.customLabel &&
          (t.label === 'Companion' || t.label === 'Consultant')
            ? COMPANION_LABEL_SINGULAR
            : t.label,
      }))
      .slice(0, MAX_ACTIVE_TABS);

    return sanitized.length > 0 ? sanitized : DEFAULT_CORE_TABS;
  } catch {
    return DEFAULT_CORE_TABS;
  }
}

const getHeaderProfileLabel = (p: ChatProfile | null, _modeType?: string): string => {
  if (p) {
    return p.short_name?.trim() || p.name;
  }
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
  const location = useLocation();
  const navigate = useNavigate();
  const {
    appUser,
    isPreviewMode,
    exitPreviewMode,
    signOut,
    getAccessToken,
    refreshUser,
    astrologyMode,
    setAstrologyMode,
  } = useAuth();
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
  const [expertSlug, setExpertSlug] = useState(
    normalizeCouncilSlug(appUser?.default_expert)
  );
  const [languageSlug, setLanguageSlug] = useState(appUser?.default_language || 'English');
  const [toneMode, setToneMode] = useState<ChatToneMode>('technical');
  const [responseLength, setResponseLength] = useState<ChatResponseLength>('detailed');
  const responseMode: 'simple' | 'detailed' =
    responseLength === 'short' || toneMode === 'friendly' ? 'simple' : 'detailed';
  const handleChangeResponseMode = (nextMode: 'simple' | 'detailed') => {
    if (nextMode === 'simple') {
      setToneMode('friendly');
      setResponseLength('short');
    } else {
      setToneMode('technical');
      setResponseLength('detailed');
    }
  };
  const [pendingMemory, setPendingMemory] = useState<boolean>(true);
  const [chatFontSize, setChatFontSize] = useState<ChatFontSize>(appUser?.chat_font_size || 'base');
  const [userNumericFont, setUserNumericFont] = useState<UserNumericFontChoice>(() => {
    const valid = new Set<string>(CHAT_NUMERIC_FONT_OPTIONS.map((o) => o.value));
    if (appUser?.chat_numeric_font && valid.has(appUser.chat_numeric_font)) {
      return appUser.chat_numeric_font;
    }
    const stored =
      typeof window !== 'undefined' ? localStorage.getItem(CHAT_NUMERIC_FONT_STORAGE_KEY) : null;
    return stored && valid.has(stored) ? (stored as ChatNumericFont) : 'default';
  });
  const [suggestionsAutoExpand, setSuggestionsAutoExpand] = useState<boolean>(
    appUser?.suggestions_auto_expand ?? true
  );

  useEffect(() => {
    if (appUser?.chat_numeric_font) {
      setUserNumericFont(appUser.chat_numeric_font);
    }
  }, [appUser?.chat_numeric_font]);

  const [draftText, setDraftText] = useState('');
  const [pendingTechnicalDirective, setPendingTechnicalDirective] = useState<{
    label: string;
    directive: string;
  } | null>(null);
  const [askLaterItems, setAskLaterItems] = useState<AskLaterItem[]>([]);
  const [showAskLaterDrawer, setShowAskLaterDrawer] = useState(false);
  const [extraProfileIds, setExtraProfileIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachmentInput[]>([]);
  const [deepAudit, setDeepAudit] = useState<boolean>(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessageRecord | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTabId, setStreamingTabId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [streamingTimingWidgets, setStreamingTimingWidgets] = useState<TimingProgressWidget[]>([]);
  const [streamingTarotSpread, setStreamingTarotSpread] = useState<DrawnTarotSpread | null>(null);
  const [freshTarotMsgIds, setFreshTarotMsgIds] = useState<Set<string>>(() => new Set());
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Phase 2: Multi-Thread Tabs (Closable; at least 1 tab stays open)
  const [tabs, setTabs] = useState<ActiveChatTab[]>(() => loadInitialTabs(isPreviewMode));
  const [activeTabId, setActiveTabId] = useState<string>(
    () => loadInitialTabs(isPreviewMode)[0]?.tabId || 'core-council'
  );
  const [companionSetupArchetype, setCompanionSetupArchetype] =
    useState<CompanionArchetypeSlug | null>(null);
  const [companionSetupKey, setCompanionSetupKey] = useState<number>(0);
  const [companionCatalog, setCompanionCatalog] = useState<PublicCompanionCard[]>(
    isPreviewMode ? PREVIEW_PUBLIC_COMPANIONS : []
  );
  const [profileSheetCompanion, setProfileSheetCompanion] =
    useState<PublicCompanionCard | null>(null);

  const [showMyPrompts, setShowMyPrompts] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showMemoryInspector, setShowMemoryInspector] = useState(false);
  const [showHeaderThreadMenu, setShowHeaderThreadMenu] = useState(false);
  const [showCompanionChartMenu, setShowCompanionChartMenu] = useState(false);

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

  const [savedNoteMsgIds, setSavedNoteMsgIds] = useState<Set<string>>(() => new Set());
  const [savingNoteMsgId, setSavingNoteMsgId] = useState<string | null>(null);
  const [handoffSource, setHandoffSource] = useState<CouncilHandoffSource | null>(null);
  const [handoffSubmittingSlug, setHandoffSubmittingSlug] = useState<string | null>(null);
  const [sharedReadingNotes, setSharedReadingNotes] = useState<SharedReadingNoteRecord[]>([]);
  const [showSharedReadingNotesModal, setShowSharedReadingNotesModal] = useState(false);
  const [deletingReadingNoteId, setDeletingReadingNoteId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inChatSearchInputRef = useRef<HTMLInputElement | null>(null);
  const headerThreadMenuRef = useRef<HTMLDivElement | null>(null);
  const companionChartMenuRef = useRef<HTMLDivElement | null>(null);
  const seededQueryRef = useRef<string>('');
  const pendingSeedCompanionRef = useRef<string | null>(null);
  const pendingSeedNewRef = useRef<boolean>(false);
  const seededExpertRef = useRef<boolean>(false);
  const seededCouncilFreshRef = useRef<boolean>(false);
  const didLoadInitialTabConvRef = useRef<boolean>(false);
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

  const activeCompanionCard = useMemo(() => {
    if (activePillar !== 'companion') return null;
    const slug = activeConversation?.companion_slug || activeCompanionPersona?.slug;
    if (!slug) return null;
    return companionCatalog.find((c) => c.slug === slug) || null;
  }, [
    activePillar,
    activeConversation?.companion_slug,
    activeCompanionPersona?.slug,
    companionCatalog,
  ]);

  const buildSheetCardFromPersona = useCallback(
    (persona: CompanionPersona, existingCard?: PublicCompanionCard | null): PublicCompanionCard => {
      if (existingCard) return existingCard;
      return {
        id: persona.id || `custom_${persona.slug || 'companion'}`,
        slug: persona.slug || persona.id,
        name: persona.name,
        age: persona.age,
        sex: persona.gender === 'M' ? 'M' : persona.gender === 'NB' ? 'NB' : 'F',
        tagline: persona.tagline,
        short_bio: persona.bio,
        full_bio:
          [persona.background, persona.conversation_style].filter(Boolean).join('\n\n') ||
          persona.bio,
        primary_expertise: persona.role_label || 'Companion',
        secondary_expertise: [],
        category_tag: 'support',
        cultural_fluency: 'Personalized companion',
        avatar_url: persona.avatar_url ?? null,
        monogram_palette: persona.monogram_palette || {
          bg: '#EAE3D7',
          ring: '#8B7355',
          ink: '#3D3830',
        },
        skill_level: persona.skill_level || 'none_emotional',
        chat_style: persona.chat_style || 'chat_bubbles',
        tts_voice_profile: persona.tts_voice_profile || { rate: 0.98, pitch: 1.0 },
        supports_listening_cue: persona.supports_listening_cue ?? true,
        suggestions_enabled: true,
        sort_order: 999,
        last_conversation_id: activeConversation?.id || null,
      };
    },
    [activeConversation?.id]
  );

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
      setExpertSlug((prev) => prev || normalizeCouncilSlug(appUser.default_expert));
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

  // Close companion chart focus popover on outside click, Escape, or tab switch
  useEffect(() => {
    setShowCompanionChartMenu(false);
  }, [activeTabId, activeConversation?.id]);

  useEffect(() => {
    if (!showCompanionChartMenu) return;
    const handlePointer = (e: MouseEvent) => {
      if (
        companionChartMenuRef.current &&
        !companionChartMenuRef.current.contains(e.target as Node)
      ) {
        setShowCompanionChartMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCompanionChartMenu(false);
    };
    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [showCompanionChartMenu]);

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
        const isDefaultSimple =
          uiCfg.default_response_length === 'short' || uiCfg.default_tone === 'friendly';
        setToneMode(isDefaultSimple ? 'friendly' : 'technical');
        setResponseLength(isDefaultSimple ? 'short' : 'detailed');
        if (embeddedPreview) {
          if (uiCfg.default_expert) setExpertSlug(uiCfg.default_expert);
          if (uiCfg.default_language) setLanguageSlug(uiCfg.default_language);
        } else {
          if (!appUser?.default_expert && uiCfg.default_expert) {
            setExpertSlug(uiCfg.default_expert);
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
  }, [getAccessToken, isPreviewMode, embeddedPreview, appUser?.default_expert, appUser?.default_language]);

  const loadCompanionCatalog = useCallback(async () => {
    if (isPreviewMode) {
      setCompanionCatalog(PREVIEW_PUBLIC_COMPANIONS.filter(isConsultantCatalogEntryAllowed));
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/chat/companions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.companions)) {
          setCompanionCatalog(
            (data.companions as PublicCompanionCard[]).filter(isConsultantCatalogEntryAllowed)
          );
        }
      }
    } catch {
      // Non-fatal; CompanionSetupView also fetches when mounted
    }
  }, [getAccessToken, isPreviewMode]);

  const loadSharedReadingNotes = useCallback(
    async (profileId?: string | null) => {
      if (isPreviewMode || embeddedPreview) return;
      try {
        const token = await getAccessToken();
        if (!token) return;
        const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
        const res = await fetch(`/api/chat/reading-notes${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (Array.isArray(data.notes)) {
            setSharedReadingNotes(data.notes as SharedReadingNoteRecord[]);
          }
        }
      } catch {
        // Non-fatal
      }
    },
    [getAccessToken, isPreviewMode, embeddedPreview]
  );

  const loadConversations = useCallback(async () => {
    if (isPreviewMode) {
      const q = searchQuery.trim().toLowerCase();
      const dynamicPreviewConvs = Object.values(previewConvStoreRef.current);
      const merged = [
        ...dynamicPreviewConvs,
        ...PREVIEW_CONVERSATIONS.filter((c) => !previewConvStoreRef.current[c.id]),
      ];
      const filtered = merged.filter((c) => {
        if (q && !c.title.toLowerCase().includes(q)) return false;
        if (c.pillar === 'companion' || c.companion_persona_json) {
          const slug = c.companion_slug || c.companion_persona_json?.slug;
          const card = slug
            ? PREVIEW_PUBLIC_COMPANIONS.find((p) => p.slug === slug)
            : undefined;
          if (card && !isConsultantCatalogEntryAllowed(card)) return false;
        }
        return true;
      });
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

      // Reconcile tab labels & hydrate DB-pinned tabs only on unfiltered loads (never detach tabs during sidebar search)
      if (!searchQuery.trim()) {
        setTabs((prevTabs) => {
          const convById = new Map(enrichedConvs.map((c) => [c.id, c]));
          let nextTabs = prevTabs
            .map((t) => {
              if (!t.conversationId) return t;
              const match = convById.get(t.conversationId);
              if (!match) {
                return null;
              }
              return {
                ...t,
                label: t.customLabel
                  ? t.label
                  : deriveTabLabelForConversation(match, loadedProfiles),
              };
            })
            .filter((t): t is ActiveChatTab => Boolean(t));

          if (!didHydrateDbTabsRef.current) {
            didHydrateDbTabsRef.current = true;
            const dbPinned = enrichedConvs
              .filter((c) => c.is_active_tab)
              .sort((a, b) => (a.active_tab_order ?? 0) - (b.active_tab_order ?? 0));
            for (const pinned of dbPinned) {
              if (nextTabs.some((t) => t.conversationId === pinned.id)) continue;
              const p: ChatPillar =
                pinned.pillar || (pinned.companion_persona_json ? 'companion' : 'council');
              const canUseEmpty = !(p === 'council' && seededCouncilFreshRef.current);
              const emptyIdx = canUseEmpty
                ? nextTabs.findIndex((t) => t.pillar === p && !t.conversationId)
                : -1;
              if (emptyIdx >= 0) {
                nextTabs[emptyIdx] = {
                  ...nextTabs[emptyIdx],
                  conversationId: pinned.id,
                  label: nextTabs[emptyIdx].customLabel
                    ? nextTabs[emptyIdx].label
                    : deriveTabLabelForConversation(pinned, loadedProfiles),
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

          if (nextTabs.length === 0) {
            nextTabs = [DEFAULT_CORE_TABS[0]];
          }
          return nextTabs;
        });
      }
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
          setExpertSlug('learn_astrology');
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
          if (firstAssistant?.expert_used) {
            setExpertSlug(firstAssistant.expert_used);
          } else if (loadedConv?.mode_type === 'learn_astrology') {
            setExpertSlug('learn_astrology');
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
    void loadCompanionCatalog();
  }, [loadConfigAndPrompts, loadCompanionCatalog]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activePillar !== 'companion') return;
    void loadSharedReadingNotes(activeConversation?.profile_id || null);
  }, [activePillar, activeConversation?.id, activeConversation?.profile_id, loadSharedReadingNotes]);

  useEffect(() => {
    if (embeddedPreview || isPreviewMode) return;
    const handleOnboardingProfileReady = (event: Event) => {
      const detail = (
        event as CustomEvent<{ profile?: ChatProfile; conversationId?: string }>
      ).detail;
      const incomingProfile = detail?.profile;
      if (incomingProfile?.id) {
        setProfiles((prev) => {
          const exists = prev.some((p) => p.id === incomingProfile.id);
          return exists
            ? prev.map((p) => (p.id === incomingProfile.id ? incomingProfile : p))
            : [incomingProfile, ...prev];
        });
        if (!detail?.conversationId) {
          setPendingProfileId((prevId) => prevId || incomingProfile.id);
        }
      }
      void loadConversations();
    };
    window.addEventListener('cc-onboarding-profile-ready', handleOnboardingProfileReady);
    return () => {
      window.removeEventListener('cc-onboarding-profile-ready', handleOnboardingProfileReady);
    };
  }, [embeddedPreview, isPreviewMode, loadConversations]);

  // Snapshot helper for instant zero-flicker multi-tab switching
  const snapshotActiveTabState = useCallback(
    (tabIdToSave: string) => {
      tabCacheRef.current[tabIdToSave] = {
        draftText,
        pendingProfileId,
        pendingMemory,
        expertSlug,
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
          const convSlug =
            loaded.companion_slug || loaded.companion_persona_json?.slug || undefined;
          const matchingEmpty = prev.find((t) => t.pillar === convPillar && !t.conversationId);
          if (matchingEmpty) {
            delete tabCacheRef.current[matchingEmpty.tabId];
            setActiveTabId(matchingEmpty.tabId);
            return prev.map((t) =>
              t.tabId === matchingEmpty.tabId
                ? {
                    ...t,
                    conversationId: loaded.id,
                    companionSlug: convSlug,
                    label: deriveTabLabelForConversation(loaded, profiles),
                  }
                : t
            );
          }
          if (prev.length < MAX_ACTIVE_TABS) {
            const newTab: ActiveChatTab = {
              tabId: `tab-${loaded.id}`,
              pillar: convPillar,
              conversationId: loaded.id,
              companionSlug: convSlug,
              label: deriveTabLabelForConversation(loaded, profiles),
              isCore: false,
            };
            setActiveTabId(newTab.tabId);
            return [...prev, newTab];
          }
          const matchingPillar = prev.find((t) => t.pillar === convPillar);
          if (matchingPillar) {
            delete tabCacheRef.current[matchingPillar.tabId];
            setActiveTabId(matchingPillar.tabId);
            return prev.map((t) =>
              t.tabId === matchingPillar.tabId
                ? {
                    ...t,
                    conversationId: loaded.id,
                    companionSlug: convSlug,
                    label: deriveTabLabelForConversation(loaded, profiles),
                  }
                : t
            );
          }
          const fallbackTarget = prev[0] || DEFAULT_CORE_TABS[0];
          setActiveTabId(fallbackTarget.tabId);
          return prev.map((t) =>
            t.tabId === fallbackTarget.tabId
              ? {
                  ...t,
                  pillar: convPillar,
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
    const seedSystem = searchParams.get('system');
    const seedCompanion = searchParams.get('companion');
    const seedNew = searchParams.get('new') === '1';
    if (
      !seedProfileId &&
      !seedPrompt &&
      !seedPillar &&
      !seedExpert &&
      !seedSystem &&
      !seedCompanion &&
      !seedNew
    ) {
      return;
    }

    const queryKey = `${seedProfileId || ''}::${seedPrompt || ''}::${seedPillar || ''}::${seedExpert || ''}::${seedSystem || ''}::${seedCompanion || ''}::${seedNew ? '1' : '0'}`;
    if (seededQueryRef.current === queryKey) return;
    seededQueryRef.current = queryKey;

    if (seedCompanion?.trim()) {
      pendingSeedCompanionRef.current = seedCompanion.trim().toLowerCase();
      pendingSeedNewRef.current = seedNew;
    }

    if (seedPillar === 'companion' || seedCompanion) {
      const compTab = tabs.find((t) => t.pillar === 'companion');
      if (compTab) {
        activateTab(compTab, { skipSnapshot: true });
      } else {
        const newCompTab: ActiveChatTab = {
          tabId: `tab-companion-${Date.now()}`,
          pillar: 'companion',
          conversationId: null,
          label: COMPANION_LABEL_SINGULAR,
          isCore: false,
        };
        setTabs((prev) => (prev.length < MAX_ACTIVE_TABS ? [...prev, newCompTab] : prev));
        activateTab(newCompTab, { skipSnapshot: true });
      }
    } else if (seedPillar === 'clarity') {
      const clarityTab = tabs.find((t) => t.pillar === 'clarity');
      if (clarityTab) {
        activateTab(clarityTab, { skipSnapshot: true });
      } else {
        const newClarityTab: ActiveChatTab = {
          tabId: `tab-clarity-${Date.now()}`,
          pillar: 'clarity',
          conversationId: null,
          label: 'Clarity',
          isCore: false,
        };
        setTabs((prev) => (prev.length < MAX_ACTIVE_TABS ? [...prev, newClarityTab] : prev));
        activateTab(newClarityTab, { skipSnapshot: true });
      }
    } else if (seedPillar === 'council' || seedExpert || seedSystem || seedProfileId || seedPrompt || seedNew) {
      const councilTab = tabs.find((t) => t.pillar === 'council');
      if (councilTab) {
        setActiveTabId(councilTab.tabId);
        if (seedExpert || seedSystem || seedPrompt || seedNew) {
          seededCouncilFreshRef.current = true;
          setActiveConversation(null);
          setMessages([]);
          setAskLaterItems([]);
          const defaultLabel = seedExpert
            ? resolveCouncilDisplayName(seedExpert, catalog)
            : seedSystem === 'western'
            ? 'Western Astrologer'
            : 'Vedic Astrologer';
          setTabs((prev) =>
            prev.map((t) =>
              t.tabId === councilTab.tabId
                ? { ...t, conversationId: null, label: defaultLabel, expertSlug: seedExpert || t.expertSlug }
                : t
            )
          );
        }
      } else {
        const defaultLabel = seedExpert
          ? resolveCouncilDisplayName(seedExpert, catalog)
          : seedSystem === 'western'
          ? 'Western Astrologer'
          : 'Vedic Astrologer';
        const normalizedSeedExpert = seedExpert ? normalizeCouncilSlug(seedExpert) : null;
        const newCouncilTab: ActiveChatTab = {
          tabId: `tab-council-${Date.now()}`,
          pillar: 'council',
          conversationId: null,
          label: defaultLabel,
          expertSlug:
            normalizedSeedExpert ||
            (seedSystem === 'western' ? 'western_astrologer' : DEFAULT_COUNCIL_EXPERT_SLUG),
          isCore: false,
        };
        seededCouncilFreshRef.current = true;
        setActiveConversation(null);
        setMessages([]);
        setAskLaterItems([]);
        setTabs((prev) => (prev.length < MAX_ACTIVE_TABS ? [...prev, newCouncilTab] : prev));
        setActiveTabId(newCouncilTab.tabId);
      }
    }

    if (seedSystem === 'western' || seedSystem === 'vedic') {
      setAstrologyMode(seedSystem);
      if (!seedExpert) {
        seededExpertRef.current = false;
        setExpertSlug(seedSystem === 'western' ? 'western_astrologer' : DEFAULT_COUNCIL_EXPERT_SLUG);
      }
    }
    if (seedExpert) {
      const normalizedSeed = normalizeCouncilSlug(seedExpert);
      seededExpertRef.current = true;
      setExpertSlug(normalizedSeed);
      if (
        normalizedSeed === 'western_astrologer' ||
        normalizedSeed === 'modern_astrologer' ||
        normalizedSeed === 'hellenistic_astrologer'
      ) {
        setAstrologyMode('western');
      } else if (
        normalizedSeed === DEFAULT_COUNCIL_EXPERT_SLUG ||
        normalizedSeed === 'kp_precision' ||
        normalizedSeed === 'jaimini'
      ) {
        setAstrologyMode('vedic');
      }
    }
    if (seedPrompt) setDraftText(seedPrompt);
    if (seedProfileId) setPendingProfileId(seedProfileId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('profileId');
    nextParams.delete('prompt');
    nextParams.delete('pillar');
    nextParams.delete('expert');
    nextParams.delete('system');
    nextParams.delete('companion');
    nextParams.delete('new');
    setSearchParams(nextParams, { replace: true });
  }, [
    embeddedPreview,
    routeConversationId,
    searchParams,
    setSearchParams,
    tabs,
    activateTab,
    setAstrologyMode,
  ]);

  // On fresh /app/chat reload (no URL conversationId and no deep-link seed), load messages for the hydrated active tab
  useEffect(() => {
    if (
      embeddedPreview ||
      isPreviewMode ||
      routeConversationId ||
      didLoadInitialTabConvRef.current ||
      seededQueryRef.current ||
      activeConversation ||
      conversations.length === 0
    ) {
      return;
    }
    if (activeTab.conversationId && conversations.some((c) => c.id === activeTab.conversationId)) {
      didLoadInitialTabConvRef.current = true;
      void loadConversationMessages(activeTab.conversationId);
    }
  }, [
    embeddedPreview,
    isPreviewMode,
    routeConversationId,
    activeConversation,
    conversations,
    activeTab.conversationId,
    loadConversationMessages,
  ]);

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

  const activeGuideSlug =
    activePillar === 'companion'
      ? 'companion'
      : activePillar === 'clarity'
      ? 'clarity'
      : expertSlug;
  const activeGuideUi = chatbotConfig?.guide_overrides?.[activeGuideSlug] || null;

  const suggestionsDefaultExpanded =
    activeGuideUi?.suggestions?.default_expanded !== undefined
      ? suggestionsAutoExpand && activeGuideUi.suggestions.default_expanded
      : suggestionsAutoExpand && (suggestionsConfig?.default_expanded ?? true);

  const isThreadLocked = messages.length > 0 || isStreaming;

  const defaultCouncilMode: AstrologyMode = useMemo(() => {
    if (!isPreviewMode && appUser?.default_astrology_mode) {
      return appUser.default_astrology_mode === 'western' ? 'western' : 'vedic';
    }
    if (
      !isPreviewMode &&
      (appUser?.default_expert === 'western_astrologer' ||
        appUser?.default_expert === 'modern_astrologer' ||
        appUser?.default_expert === 'hellenistic_astrologer')
    ) {
      return 'western';
    }
    return astrologyMode === 'western' ? 'western' : 'vedic';
  }, [isPreviewMode, appUser?.default_astrology_mode, appUser?.default_expert, astrologyMode]);

  // Keep fresh Council consultations synced with the user's active AstrologyMode (and update unlocked tab label)
  useEffect(() => {
    if (isThreadLocked || activeConversation || activePillar !== 'council' || seededExpertRef.current) {
      return;
    }
    const nextExpert =
      astrologyMode === 'western'
        ? expertSlug === 'modern_astrologer' || expertSlug === 'hellenistic_astrologer'
          ? expertSlug
          : 'western_astrologer'
        : expertSlug === 'kp_precision' || expertSlug === 'jaimini'
        ? expertSlug
        : DEFAULT_COUNCIL_EXPERT_SLUG;
    const nextLabel = resolveCouncilDisplayName(nextExpert, catalog);
    if (
      astrologyMode === 'western' &&
      (normalizeCouncilSlug(expertSlug) === DEFAULT_COUNCIL_EXPERT_SLUG ||
        expertSlug === 'kp_precision' ||
        expertSlug === 'jaimini')
    ) {
      setExpertSlug('western_astrologer');
    } else if (
      astrologyMode === 'vedic' &&
      (expertSlug === 'western_astrologer' ||
        expertSlug === 'modern_astrologer' ||
        expertSlug === 'hellenistic_astrologer')
    ) {
      setExpertSlug(DEFAULT_COUNCIL_EXPERT_SLUG);
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.tabId === activeTabId &&
        t.pillar === 'council' &&
        !t.conversationId &&
        !t.customLabel &&
        (t.label === 'Council' ||
          t.label === 'Vedic Astrologer' ||
          t.label === 'Western Astrologer' ||
          t.label === 'KP Astrology' ||
          t.label === 'Jaimini Jyotish')
          ? { ...t, label: nextLabel, expertSlug: nextExpert }
          : t
      )
    );
  }, [astrologyMode, isThreadLocked, activeConversation, activePillar, expertSlug, activeTabId, catalog]);

  const handleChangeChatAstrologyMode = (nextMode: AstrologyMode) => {
    seededExpertRef.current = false;
    setAstrologyMode(nextMode);
    if (!isThreadLocked) {
      const nextExpert =
        nextMode === 'western'
          ? expertSlug === 'modern_astrologer' || expertSlug === 'hellenistic_astrologer'
            ? expertSlug
            : 'western_astrologer'
          : expertSlug === 'kp_precision' || expertSlug === 'jaimini'
          ? expertSlug
          : DEFAULT_COUNCIL_EXPERT_SLUG;
      if (nextMode === 'western') {
        if (expertSlug !== 'modern_astrologer' && expertSlug !== 'hellenistic_astrologer') {
          setExpertSlug('western_astrologer');
        }
      } else {
        if (expertSlug !== 'kp_precision' && expertSlug !== 'jaimini') {
          setExpertSlug(DEFAULT_COUNCIL_EXPERT_SLUG);
        }
      }
      const nextLabel = resolveCouncilDisplayName(nextExpert, catalog);
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === activeTabId && t.pillar === 'council' && !t.conversationId && !t.customLabel
            ? { ...t, label: nextLabel, expertSlug: nextExpert }
            : t
        )
      );
    }
  };

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
    pillarOverride?: ChatPillar,
    signal?: AbortSignal
  ): Promise<ConversationRecord | null> => {
    setErrorBanner(null);
    const token = await getAccessToken();
    if (!token) return null;
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

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
        expert_slug:
          targetPillar === 'council'
            ? modeType === 'learn_astrology'
              ? 'learn_astrology'
              : expertSlug
            : undefined,
        pillar: targetPillar,
        is_active_tab: true,
        use_full_profile_memory: isClarity ? pendingMemory : pendingMemory,
      }),
      signal,
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
        seededExpertRef.current = true;
        setExpertSlug('learn_astrology');
      } else if (expertSlug === 'learn_astrology') {
        seededExpertRef.current = false;
        setExpertSlug(
          normalizeCouncilSlug(appUser?.default_expert || chatbotConfig?.default_expert)
        );
      }
    }

    // Bind created conversation to active tab
    setTabs((prev) =>
      prev.map((t) => {
        if (t.tabId === activeTabId && t.pillar === targetPillar) {
          return {
            ...t,
            conversationId: created.id,
            label: t.customLabel
              ? t.label
              : targetPillar === 'clarity'
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
    if (!target || tabs.length <= 1) return;

    if (streamingTabId === tabIdToClose) {
      abortControllerRef.current?.abort();
    }
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

  const handleReorderTabs = (orderedTabIds: string[]) => {
    setTabs((prev) => {
      const byId = new Map(prev.map((t) => [t.tabId, t]));
      const reordered: ActiveChatTab[] = [];
      for (const id of orderedTabIds) {
        const match = byId.get(id);
        if (match) {
          reordered.push(match);
          byId.delete(id);
        }
      }
      for (const leftover of byId.values()) {
        reordered.push(leftover);
      }

      if (!isPreviewMode) {
        const prevIndexById = new Map(prev.map((t, i) => [t.tabId, i]));
        reordered.forEach((tab, idx) => {
          if (tab.conversationId && prevIndexById.get(tab.tabId) !== idx) {
            void syncTabPinBackend(tab.conversationId, true, idx);
          }
        });
      }
      return reordered;
    });
  };

  const handleRenameConversation = (convId: string, rawTitle: string) => {
    const clean = rawTitle.trim().slice(0, 80);
    if (!clean) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: clean } : c))
    );
    setActiveConversation((prev) =>
      prev && prev.id === convId ? { ...prev, title: clean } : prev
    );
    setTabs((prev) =>
      prev.map((t) =>
        t.conversationId === convId ? { ...t, label: clean, customLabel: true } : t
      )
    );
    for (const [tabKey, cached] of Object.entries(tabCacheRef.current)) {
      if (cached?.conversation && cached.conversation.id === convId) {
        tabCacheRef.current[tabKey] = {
          ...cached,
          conversation: { ...cached.conversation, title: clean },
        };
      }
    }

    if (!isPreviewMode) {
      void getAccessToken().then((token) => {
        if (!token) return;
        return fetch(`/api/chat/conversations/${convId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: clean }),
        });
      });
    }
  };

  const handleRenameTab = (tabId: string, rawLabel: string) => {
    const clean = rawLabel.trim().slice(0, 80);
    if (!clean) return;
    const targetTab = tabs.find((t) => t.tabId === tabId);
    if (!targetTab) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.tabId === tabId ? { ...t, label: clean, customLabel: true } : t
      )
    );

    if (targetTab.conversationId) {
      const convId = targetTab.conversationId;
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: clean } : c))
      );
      setActiveConversation((prev) =>
        prev && prev.id === convId ? { ...prev, title: clean } : prev
      );
      const cached = tabCacheRef.current[tabId];
      if (cached?.conversation && cached.conversation.id === convId) {
        tabCacheRef.current[tabId] = {
          ...cached,
          conversation: { ...cached.conversation, title: clean },
        };
      }

      if (!isPreviewMode) {
        void getAccessToken().then((token) => {
          if (!token) return;
          return fetch(`/api/chat/conversations/${convId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ title: clean }),
          });
        });
      }
    }
  };

  // Instant '+' tab creation: opens Vedic Astrologer or Western Astrologer based on ongoing chat or global Default Council
  const handleQuickAddTab = () => {
    if (tabs.length >= MAX_ACTIVE_TABS) {
      setErrorBanner(`Up to ${MAX_ACTIVE_TABS} active tabs can be open at once. Close a tab to add another.`);
      return;
    }

    let targetTradition: AstrologyMode = defaultCouncilMode;
    if (activePillar === 'council') {
      if (
        expertSlug === 'western_astrologer' ||
        expertSlug === 'modern_astrologer' ||
        expertSlug === 'hellenistic_astrologer'
      ) {
        targetTradition = 'western';
      } else if (expertSlug) {
        targetTradition = 'vedic';
      }
    }

    const nextExpert =
      targetTradition === 'western' ? 'western_astrologer' : DEFAULT_COUNCIL_EXPERT_SLUG;
    const nextLabel =
      targetTradition === 'western' ? 'Western Astrologer' : 'Vedic Astrologer';

    const newTab: ActiveChatTab = {
      tabId: `tab-council-${Date.now()}`,
      pillar: 'council',
      conversationId: null,
      label: nextLabel,
      expertSlug: nextExpert,
      isCore: false,
    };

    seededExpertRef.current = true;
    snapshotActiveTabState(activeTabId);
    setAstrologyMode(targetTradition);
    setExpertSlug(nextExpert);
    setTabs((prev) => [...prev, newTab]);
    activateTab(newTab, { skipSnapshot: true });
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleReplaceTabWithCouncil = (targetTabId: string, guideSlug: string) => {
    const normalizedGuideSlug = normalizeCouncilSlug(guideSlug);
    const targetTab = tabs.find((t) => t.tabId === targetTabId);
    if (!targetTab) return;
    const guide = catalog?.experts.find((e) => e.slug === normalizedGuideSlug);
    const guideLabel = guide?.displayName || 'Vedic Astrologer';

    const updatedTab: ActiveChatTab = {
      ...targetTab,
      pillar: 'council',
      conversationId: null,
      label: guideLabel,
      expertSlug: normalizedGuideSlug,
      customLabel: false,
      isCore: false,
    };

    seededExpertRef.current = true;
    if (
      normalizedGuideSlug === 'western_astrologer' ||
      normalizedGuideSlug === 'modern_astrologer' ||
      normalizedGuideSlug === 'hellenistic_astrologer'
    ) {
      setAstrologyMode('western');
    } else if (
      normalizedGuideSlug === DEFAULT_COUNCIL_EXPERT_SLUG ||
      normalizedGuideSlug === 'kp_precision' ||
      normalizedGuideSlug === 'jaimini'
    ) {
      setAstrologyMode('vedic');
    }

    delete tabCacheRef.current[targetTabId];
    setTabs((prev) => prev.map((t) => (t.tabId === targetTabId ? updatedTab : t)));
    setExpertSlug(normalizedGuideSlug);
    activateTab(updatedTab, { skipSnapshot: activeTabId === targetTabId });
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleReplaceTabWithClarity = (targetTabId: string) => {
    const existingClarity = tabs.find(
      (t) => t.pillar === 'clarity' && t.tabId !== targetTabId
    );
    if (existingClarity) {
      if (tabs.length > 1) {
        delete tabCacheRef.current[targetTabId];
        setTabs((prev) => prev.filter((t) => t.tabId !== targetTabId));
      }
      activateTab(existingClarity, { skipSnapshot: activeTabId === targetTabId });
      setComposerFocusTrigger((n) => n + 1);
      return;
    }

    const targetTab = tabs.find((t) => t.tabId === targetTabId);
    if (!targetTab) return;
    const updatedTab: ActiveChatTab = {
      ...targetTab,
      pillar: 'clarity',
      conversationId: null,
      label: 'Clarity',
      expertSlug: undefined,
      customLabel: false,
      isCore: false,
    };
    delete tabCacheRef.current[targetTabId];
    setTabs((prev) => prev.map((t) => (t.tabId === targetTabId ? updatedTab : t)));
    activateTab(updatedTab, { skipSnapshot: activeTabId === targetTabId });
    setPendingMemory(false);
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleReplaceTabWithCompanionArchetype = (
    targetTabId: string,
    archetype: CompanionArchetypeSlug
  ) => {
    const targetTab = tabs.find((t) => t.tabId === targetTabId);
    if (!targetTab) return;
    setCompanionSetupArchetype(archetype);
    setCompanionSetupKey((k) => k + 1);

    const updatedTab: ActiveChatTab = {
      ...targetTab,
      pillar: 'companion',
      conversationId: null,
      label: COMPANION_LABEL_SINGULAR,
      expertSlug: undefined,
      companionType: archetype,
      customLabel: false,
      isCore: false,
    };
    delete tabCacheRef.current[targetTabId];
    setTabs((prev) => prev.map((t) => (t.tabId === targetTabId ? updatedTab : t)));
    activateTab(updatedTab, { skipSnapshot: activeTabId === targetTabId });
  };

  const handleReplaceTabWithConversation = (
    targetTabId: string,
    conv: ConversationRecord
  ) => {
    const enriched = enrichConversationWithLocalMeta(conv);
    const existingTab = tabs.find((t) => t.conversationId === enriched.id);
    if (existingTab) {
      if (existingTab.tabId !== targetTabId && tabs.length > 1) {
        delete tabCacheRef.current[targetTabId];
        setTabs((prev) => prev.filter((t) => t.tabId !== targetTabId));
      }
      activateTab(existingTab, { skipSnapshot: activeTabId === targetTabId });
      return;
    }

    const targetTab = tabs.find((t) => t.tabId === targetTabId);
    if (!targetTab) {
      handleOpenExistingConversationAsTab(enriched);
      return;
    }

    const pillar: ChatPillar =
      enriched.pillar || (enriched.companion_persona_json ? 'companion' : 'council');
    const nextLabel = deriveTabLabelForConversation(enriched, profiles);

    const updatedTab: ActiveChatTab = {
      ...targetTab,
      pillar,
      conversationId: enriched.id,
      label: nextLabel,
      expertSlug: undefined,
      customLabel: false,
      isCore: false,
    };

    delete tabCacheRef.current[targetTabId];
    setTabs((prev) => prev.map((t) => (t.tabId === targetTabId ? updatedTab : t)));
    void syncTabPinBackend(enriched.id, true);
    activateTab(updatedTab, {
      skipSnapshot: activeTabId === targetTabId,
      forceReload: true,
    });
  };

  const handleOpenNewCompanionSetup = (archetype?: CompanionArchetypeSlug | null) => {
    setCompanionSetupArchetype(archetype || null);
    setCompanionSetupKey((k) => k + 1);

    const emptyComp = tabs.find((t) => t.pillar === 'companion' && !t.conversationId);
    if (emptyComp) {
      activateTab(emptyComp);
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
        label: COMPANION_LABEL_SINGULAR,
      };
      setTabs((prev) => prev.map((t) => (t.tabId === activeTab.tabId ? resetTab : t)));
      delete tabCacheRef.current[activeTab.tabId];
      activateTab(resetTab, { skipSnapshot: true });
      return;
    }

    // Otherwise open a fresh Companion tab if under cap, else repurpose first companion tab
    if (tabs.length < MAX_ACTIVE_TABS) {
      const newTab: ActiveChatTab = {
        tabId: `tab-companion-${Date.now()}`,
        pillar: 'companion',
        conversationId: null,
        label: COMPANION_LABEL_SINGULAR,
        isCore: false,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => [...prev, newTab]);
      activateTab(newTab, { skipSnapshot: true });
    } else {
      const anyComp = tabs.find((t) => t.pillar === 'companion');
      if (anyComp) {
        if (anyComp.conversationId) {
          void syncTabPinBackend(anyComp.conversationId, false);
        }
        const resetComp: ActiveChatTab = {
          ...anyComp,
          conversationId: null,
          label: COMPANION_LABEL_SINGULAR,
        };
        setTabs((prev) => prev.map((t) => (t.tabId === anyComp.tabId ? resetComp : t)));
        delete tabCacheRef.current[anyComp.tabId];
        activateTab(resetComp);
      } else if (!activeTab.conversationId) {
        const resetActive: ActiveChatTab = {
          ...activeTab,
          pillar: 'companion',
          conversationId: null,
          label: COMPANION_LABEL_SINGULAR,
          expertSlug: undefined,
          customLabel: false,
        };
        setTabs((prev) => prev.map((t) => (t.tabId === activeTab.tabId ? resetActive : t)));
        delete tabCacheRef.current[activeTab.tabId];
        activateTab(resetActive, { skipSnapshot: true });
      } else {
        setErrorBanner(
          `Up to ${MAX_ACTIVE_TABS} active tabs can be open at once. Close a tab to browse ${COMPANION_LABEL_PLURAL.toLowerCase()} in chat.`
        );
      }
    }
  };

  const handleOpenClarityTab = () => {
    const clarityTab = tabs.find((t) => t.pillar === 'clarity');
    if (clarityTab) {
      activateTab(clarityTab);
      setComposerFocusTrigger((n) => n + 1);
      return;
    }
    if (tabs.length >= MAX_ACTIVE_TABS) {
      setErrorBanner(`Up to ${MAX_ACTIVE_TABS} active tabs can be open at once. Close a tab to open Clarity.`);
      return;
    }
    const newClarity: ActiveChatTab = {
      tabId: `tab-clarity-${Date.now()}`,
      pillar: 'clarity',
      conversationId: null,
      label: 'Clarity',
      isCore: false,
    };
    snapshotActiveTabState(activeTabId);
    setTabs((prev) => [...prev, newClarity]);
    activateTab(newClarity, { skipSnapshot: true });
    setPendingMemory(false);
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleResetClarity = () => {
    const clarityTab = tabs.find((t) => t.pillar === 'clarity');
    if (!clarityTab) {
      handleOpenClarityTab();
      return;
    }
    if (clarityTab.conversationId) {
      void syncTabPinBackend(clarityTab.conversationId, false);
    }
    const freshClarity: ActiveChatTab = {
      ...clarityTab,
      conversationId: null,
      label: 'Clarity',
    };
    delete tabCacheRef.current[clarityTab.tabId];
    setTabs((prev) => prev.map((t) => (t.tabId === clarityTab.tabId ? freshClarity : t)));
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
    const emptyMatching = tabs.find((t) => t.pillar === pillar && !t.conversationId);
    const nextLabel = deriveTabLabelForConversation(enriched, profiles);

    if (emptyMatching) {
      const bound: ActiveChatTab = {
        ...emptyMatching,
        conversationId: enriched.id,
        label: nextLabel,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => prev.map((t) => (t.tabId === emptyMatching.tabId ? bound : t)));
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
      if (tabs.length > 1) {
        handleCloseTab(existingTab.tabId);
      } else {
        const defaultLabel =
          existingTab.pillar === 'companion'
            ? COMPANION_LABEL_SINGULAR
            : existingTab.pillar === 'clarity'
            ? 'Clarity'
            : defaultCouncilMode === 'western'
            ? 'Western Astrologer'
            : 'Vedic Astrologer';
        const cleared: ActiveChatTab = {
          ...existingTab,
          conversationId: null,
          label: defaultLabel,
        };
        delete tabCacheRef.current[existingTab.tabId];
        setTabs((prev) =>
          prev.map((t) => (t.tabId === existingTab.tabId ? cleared : t))
        );
        if (activeTabId === existingTab.tabId) {
          activateTab(cleared, { skipSnapshot: true });
        }
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

    const emptyMatching = tabs.find((t) => t.pillar === pillar && !t.conversationId);
    const targetTab = emptyMatching || tabs.find((t) => t.pillar === pillar);
    const nextLabel = conv ? deriveTabLabelForConversation(conv, profiles) : 'Vedic Astrologer';

    if (targetTab) {
      const updatedTab: ActiveChatTab = {
        ...targetTab,
        conversationId: convId,
        label: nextLabel,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => prev.map((t) => (t.tabId === targetTab.tabId ? updatedTab : t)));
      activateTab(updatedTab, { skipSnapshot: true, forceReload: true });
    } else if (tabs.length < MAX_ACTIVE_TABS) {
      const newTab: ActiveChatTab = {
        tabId: `tab-${convId}`,
        pillar,
        conversationId: convId,
        label: nextLabel,
        isCore: false,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => [...prev, newTab]);
      activateTab(newTab, { skipSnapshot: true, forceReload: true });
    } else {
      const fallbackTab = tabs[0] || DEFAULT_CORE_TABS[0];
      const updatedTab: ActiveChatTab = {
        ...fallbackTab,
        pillar,
        conversationId: convId,
        label: nextLabel,
      };
      snapshotActiveTabState(activeTabId);
      setTabs((prev) => prev.map((t) => (t.tabId === fallbackTab.tabId ? updatedTab : t)));
      activateTab(updatedTab, { skipSnapshot: true, forceReload: true });
    }

    if (!embeddedPreview && pillar === 'council') {
      navigate(`/app/chat/${convId}`, { replace: true });
    }
  };

  const activateStartedCompanionThread = useCallback(
    async (
      startedConv: ConversationRecord,
      displayName: string,
      companionSlug: string | null,
      openingMsg: ChatMessageRecord | null,
      resumed: boolean,
      targetTabId?: string
    ) => {
      const destTabId = targetTabId || activeTabId;
      setConversations((prev) => [startedConv, ...prev.filter((c) => c.id !== startedConv.id)]);
      setActiveConversation(startedConv);

      if (resumed) {
        await loadConversationMessages(startedConv.id);
      } else {
        setMessages(openingMsg ? [openingMsg] : []);
        setHasMoreMessages(false);
        setAskLaterItems([]);
        setReplyTarget(null);
        setPendingTechnicalDirective(null);
      }

      delete tabCacheRef.current[destTabId];
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === destTabId
            ? {
                ...t,
                pillar: 'companion',
                conversationId: startedConv.id,
                companionSlug,
                label: displayName,
                customLabel: false,
              }
            : t
        )
      );
      if (destTabId !== activeTabId) {
        setActiveTabId(destTabId);
      }
      if (!embeddedPreview && routeConversationId) {
        navigate(`/app/chat/${encodeURIComponent(startedConv.id)}`, { replace: true });
      }
      setComposerFocusTrigger((n) => n + 1);
      void loadCompanionCatalog();
      void loadSharedReadingNotes(startedConv.profile_id || null);
    },
    [
      activeTabId,
      embeddedPreview,
      loadCompanionCatalog,
      loadConversationMessages,
      loadSharedReadingNotes,
      navigate,
      routeConversationId,
    ]
  );

  const handleStartWithCompanion = async (
    persona: CompanionPersona,
    options?: { forceNew?: boolean }
  ) => {
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
        companion_slug: persona.slug || null,
        companion_chat_mode: 'natural',
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
        render_style: persona.chat_style || 'chat_bubbles',
        word_count: persona.opening_message.split(/\s+/).length,
        parent_message_id: null,
        followups_json: [],
        created_at: nowIso,
      };
      previewConvStoreRef.current[previewId] = previewConv;
      previewMsgStoreRef.current[previewId] = [openingMsg];
      await activateStartedCompanionThread(
        previewConv,
        persona.name,
        persona.slug || null,
        openingMsg,
        false
      );
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error(
        `Please sign in to start chatting with a ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`
      );
    }

    const res = await fetch('/api/chat/companions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companionSlug: persona.slug || undefined,
        persona,
        forceNew: options?.forceNew,
        clientLocalHour: new Date().getHours(),
        pinAsTab: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.conversation) {
      throw new Error(
        data.error || `Could not start ${COMPANION_LABEL_SINGULAR.toLowerCase()} conversation.`
      );
    }

    const rawConv = data.conversation as ConversationRecord;
    const resolvedSlug = rawConv.companion_slug || persona.slug || null;
    saveLocalConvMeta(rawConv.id, {
      pillar: 'companion',
      companion_type: persona.companion_type,
      companion_slug: resolvedSlug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: rawConv.companion_persona_json || persona,
    });
    const startedConv: ConversationRecord = {
      ...rawConv,
      pillar: 'companion',
      is_active_tab: true,
      companion_type: rawConv.companion_type || persona.companion_type,
      companion_slug: resolvedSlug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: rawConv.companion_persona_json || persona,
    };
    const openingMsg = (data.openingMessage || null) as ChatMessageRecord | null;
    await activateStartedCompanionThread(
      startedConv,
      persona.name,
      resolvedSlug,
      openingMsg,
      Boolean(data.resumed)
    );
  };

  const handleStartPresetCompanion = async (
    card: PublicCompanionCard,
    options?: {
      forceNew?: boolean;
      handoffNote?: string;
      fromName?: string;
      targetTabId?: string;
      profileId?: string | null;
      handoffFullContext?: string;
      handoffTitle?: string;
      handoffExpertLabel?: string;
      handoffExpertSlug?: string | null;
      handoffMessageId?: string | null;
      handoffConversationId?: string | null;
      handoffAstrologyMode?: AstrologyMode | null;
      rememberReadingNote?: boolean;
    }
  ) => {
    setErrorBanner(null);

    if (isPreviewMode) {
      if (!options?.forceNew && !options?.handoffNote && card.last_conversation_id) {
        const existing =
          previewConvStoreRef.current[card.last_conversation_id] ||
          PREVIEW_CONVERSATIONS.find((c) => c.id === card.last_conversation_id);
        if (existing) {
          handleSelectSidebarConversation(existing.id);
          return;
        }
      }

      const previewId = `preview-preset-${card.slug}-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const openingText = options?.handoffNote
        ? `Hey — ${options.fromName ? `${options.fromName} mentioned you wanted to talk through this: ` : ''}${options.handoffNote}${
            card.chat_style === 'chat_bubbles' ? ' [[BUBBLE]] ' : '\n\n'
          }No need to repeat your whole story. Where would you like to pick up?`
        : card.tagline
        ? `Hey — glad you stopped by. ${card.tagline}`
        : `Hey, I'm ${card.name}. Good to have you here.`;
      const previewPersona: CompanionPersona = {
        id: card.id,
        slug: card.slug,
        name: card.name,
        age: card.age,
        gender: card.sex,
        companion_type: 'friend',
        role_label: card.primary_expertise,
        background: card.full_bio,
        tagline: card.tagline,
        bio: card.short_bio,
        conversation_style: '',
        opening_message: openingText,
        system_prompt: '',
        avatar_url: card.avatar_url,
        monogram_palette: card.monogram_palette,
        chat_style: card.chat_style,
        skill_level: card.skill_level,
        tts_voice_profile: card.tts_voice_profile,
        supports_listening_cue: card.supports_listening_cue,
      };
      const previewConv: ConversationRecord = {
        id: previewId,
        user_id: 'preview-user',
        profile_id: options?.profileId ?? null,
        linked_report_id: null,
        title: card.name,
        mode_type: 'reading',
        pillar: 'companion',
        is_active_tab: true,
        companion_type: 'friend',
        companion_slug: card.slug,
        companion_chat_mode: 'natural',
        companion_persona_json: previewPersona,
        is_bookmarked: false,
        use_full_profile_memory: true,
        total_word_count: openingText.split(/\s+/).length,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const openingMsg: ChatMessageRecord = {
        id: `preview-msg-preset-${Date.now()}`,
        conversation_id: previewId,
        role: 'assistant',
        content: openingText,
        expert_used: 'companion',
        mode_used: card.slug,
        output_format_used: null,
        language_used: languageSlug,
        is_starred: false,
        excluded_from_context: false,
        render_style: card.chat_style,
        word_count: openingText.split(/\s+/).length,
        parent_message_id: null,
        followups_json: [],
        created_at: nowIso,
      };
      previewConvStoreRef.current[previewId] = previewConv;
      previewMsgStoreRef.current[previewId] = [openingMsg];
      if (options?.handoffFullContext && options?.rememberReadingNote !== false) {
        const previewNote: SharedReadingNoteRecord = {
          id: `preview-rn-${Date.now()}`,
          title: options.handoffTitle || 'Council Reading Note',
          summary: options.handoffFullContext,
          expert_slug: options.handoffExpertSlug || null,
          expert_label: options.handoffExpertLabel || options.fromName || 'Astrology Council',
          astrology_mode: options.handoffAstrologyMode || null,
          profile_id: options.profileId ?? null,
          profile_label:
            options.profileId
              ? profiles.find((p) => p.id === options.profileId)?.name || null
              : null,
          conversation_id: options.handoffConversationId || null,
          message_id: options.handoffMessageId || null,
          created_at: nowIso,
          origin: 'shared_handoff',
        };
        setSharedReadingNotes((prev) => [previewNote, ...prev].slice(0, 15));
      }
      setCompanionCatalog((prev) =>
        prev.map((c) =>
          c.slug === card.slug
            ? { ...c, last_conversation_id: previewId, thread_count: (c.thread_count || 0) + 1 }
            : c
        )
      );
      await activateStartedCompanionThread(
        previewConv,
        card.name,
        card.slug,
        openingMsg,
        false,
        options?.targetTabId
      );
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setErrorBanner(
        `Please sign in to chat with a ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`
      );
      return;
    }

    const res = await fetch('/api/chat/companions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companionSlug: card.slug,
        forceNew: options?.forceNew,
        profileId: options?.profileId ?? undefined,
        handoffNote: options?.handoffNote,
        handoffFromName: options?.fromName,
        handoffFullContext: options?.handoffFullContext,
        handoffTitle: options?.handoffTitle,
        handoffExpertLabel: options?.handoffExpertLabel,
        handoffExpertSlug: options?.handoffExpertSlug,
        handoffMessageId: options?.handoffMessageId,
        handoffConversationId: options?.handoffConversationId,
        handoffAstrologyMode: options?.handoffAstrologyMode,
        rememberReadingNote: options?.rememberReadingNote,
        clientLocalHour: new Date().getHours(),
        pinAsTab: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.conversation) {
      setErrorBanner(data.error || `Could not open ${card.name} right now.`);
      return;
    }

    const rawConv = data.conversation as ConversationRecord;
    const personaForMeta: CompanionPersona = rawConv.companion_persona_json || {
      id: card.id,
      slug: card.slug,
      name: card.name,
      age: card.age,
      gender: card.sex,
      companion_type: 'friend',
      role_label: card.primary_expertise,
      background: card.full_bio,
      tagline: card.tagline,
      bio: card.short_bio,
      conversation_style: '',
      opening_message: '',
      system_prompt: '',
      avatar_url: card.avatar_url,
      monogram_palette: card.monogram_palette,
      chat_style: card.chat_style,
      skill_level: card.skill_level,
      tts_voice_profile: card.tts_voice_profile,
      supports_listening_cue: card.supports_listening_cue,
    };

    saveLocalConvMeta(rawConv.id, {
      pillar: 'companion',
      companion_type: rawConv.companion_type || 'friend',
      companion_slug: card.slug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: personaForMeta,
    });

    const startedConv: ConversationRecord = {
      ...rawConv,
      pillar: 'companion',
      is_active_tab: true,
      companion_slug: rawConv.companion_slug || card.slug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: personaForMeta,
    };

    const openingRaw = (data.openingMessage || null) as ChatMessageRecord | null;
    const openingMsg = openingRaw
      ? { ...openingRaw, render_style: openingRaw.render_style || card.chat_style }
      : null;

    await activateStartedCompanionThread(
      startedConv,
      card.name,
      card.slug,
      openingMsg,
      Boolean(data.resumed),
      options?.targetTabId
    );
  };

  const handleReplaceTabWithPresetCompanion = (
    targetTabId: string,
    card: PublicCompanionCard
  ) => {
    const existingTab = tabs.find(
      (t) =>
        t.pillar === 'companion' &&
        ((card.last_conversation_id && t.conversationId === card.last_conversation_id) ||
          (t.companionSlug && t.companionSlug.toLowerCase() === card.slug.toLowerCase() && t.conversationId))
    );
    if (existingTab) {
      if (existingTab.tabId !== targetTabId && tabs.length > 1) {
        const target = tabs.find((t) => t.tabId === targetTabId);
        if (target && !target.conversationId) {
          delete tabCacheRef.current[targetTabId];
          setTabs((prev) => prev.filter((t) => t.tabId !== targetTabId));
        }
      }
      activateTab(existingTab, { skipSnapshot: activeTabId === targetTabId });
      return;
    }

    if (targetTabId !== activeTabId) {
      const targetTab = tabs.find((t) => t.tabId === targetTabId);
      if (targetTab) {
        activateTab(targetTab);
      }
    }
    void handleStartPresetCompanion(card, { targetTabId });
  };

  const handleStartCustomBySlug = async (
    slug: string,
    persona: CompanionPersona,
    options?: { forceNew?: boolean }
  ) => {
    setErrorBanner(null);

    if (isPreviewMode) {
      await handleStartWithCompanion({ ...persona, slug }, options);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setErrorBanner(
        `Please sign in to open this ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`
      );
      return;
    }

    const res = await fetch('/api/chat/companions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companionSlug: slug,
        persona: { ...persona, slug },
        forceNew: options?.forceNew,
        clientLocalHour: new Date().getHours(),
        pinAsTab: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.conversation) {
      setErrorBanner(data.error || `Could not open ${persona.name} right now.`);
      return;
    }

    const rawConv = data.conversation as ConversationRecord;
    const mergedPersona = rawConv.companion_persona_json || { ...persona, slug };
    saveLocalConvMeta(rawConv.id, {
      pillar: 'companion',
      companion_type: mergedPersona.companion_type,
      companion_slug: slug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: mergedPersona,
    });
    const startedConv: ConversationRecord = {
      ...rawConv,
      pillar: 'companion',
      is_active_tab: true,
      companion_slug: rawConv.companion_slug || slug,
      companion_chat_mode: rawConv.companion_chat_mode || 'natural',
      companion_persona_json: mergedPersona,
    };
    const openingMsg = (data.openingMessage || null) as ChatMessageRecord | null;

    await activateStartedCompanionThread(
      startedConv,
      persona.name,
      slug,
      openingMsg,
      Boolean(data.resumed)
    );
  };

  const handleToggleCompanionChatMode = async (nextCue: CompanionChatCue) => {
    if (!activeConversation) return;
    if ((activeConversation.companion_chat_mode || 'natural') === nextCue) return;

    const targetId = activeConversation.id;
    setActiveConversation((prev) =>
      prev && prev.id === targetId ? { ...prev, companion_chat_mode: nextCue } : prev
    );
    setConversations((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, companion_chat_mode: nextCue } : c))
    );
    const existingMeta = readLocalConvMetaMap()[targetId];
    if (existingMeta) {
      saveLocalConvMeta(targetId, { ...existingMeta, companion_chat_mode: nextCue });
    }
    const cached = tabCacheRef.current[activeTabId];
    if (cached?.conversation && cached.conversation.id === targetId) {
      tabCacheRef.current[activeTabId] = {
        ...cached,
        conversation: { ...cached.conversation, companion_chat_mode: nextCue },
      };
    }

    if (isPreviewMode) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(`/api/chat/conversations/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companion_chat_mode: nextCue }),
      });
    } catch {
      // Keep optimistic state
    }
  };

  const defaultYouProfile = useMemo(
    () => profiles.find((p) => p.is_default) || profiles[0] || null,
    [profiles]
  );

  const companionFocusedProfile = useMemo(() => {
    if (activeConversation?.profile_id) {
      return (
        profiles.find((p) => p.id === activeConversation.profile_id) || defaultYouProfile
      );
    }
    return defaultYouProfile;
  }, [activeConversation?.profile_id, profiles, defaultYouProfile]);

  const handleSwitchCompanionChart = async (nextProfileId: string | null) => {
    if (!activeConversation) return;
    setShowCompanionChartMenu(false);
    if ((activeConversation.profile_id || null) === nextProfileId) return;

    const targetId = activeConversation.id;
    setActiveConversation((prev) =>
      prev && prev.id === targetId ? { ...prev, profile_id: nextProfileId } : prev
    );
    setConversations((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, profile_id: nextProfileId } : c))
    );
    const cached = tabCacheRef.current[activeTabId];
    if (cached?.conversation && cached.conversation.id === targetId) {
      tabCacheRef.current[activeTabId] = {
        ...cached,
        conversation: { ...cached.conversation, profile_id: nextProfileId },
      };
    }

    if (isPreviewMode) {
      const stored = previewConvStoreRef.current[targetId];
      if (stored) {
        previewConvStoreRef.current[targetId] = { ...stored, profile_id: nextProfileId };
      }
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(`/api/chat/conversations/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile_id: nextProfileId }),
      });
    } catch {
      // Keep optimistic profile focus
    }
  };

  const handleStartNewTopicWithCurrentCompanion = () => {
    if (activeCompanionCard) {
      void handleStartPresetCompanion(activeCompanionCard, { forceNew: true });
      return;
    }
    if (activeCompanionPersona?.slug) {
      void handleStartCustomBySlug(activeCompanionPersona.slug, activeCompanionPersona, {
        forceNew: true,
      });
      return;
    }
    if (activeCompanionPersona) {
      void handleStartWithCompanion(activeCompanionPersona, { forceNew: true });
    }
  };

  const handleReactToMessage = async (
    msg: ChatMessageRecord,
    nextReaction: MessageReaction | null
  ) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, reaction: nextReaction } : m))
    );
    for (const [tabKey, cached] of Object.entries(tabCacheRef.current)) {
      if (cached?.messages?.some((m) => m.id === msg.id)) {
        tabCacheRef.current[tabKey] = {
          ...cached,
          messages: cached.messages.map((m) =>
            m.id === msg.id ? { ...m, reaction: nextReaction } : m
          ),
        };
      }
    }

    if (isPreviewMode) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(`/api/chat/messages/${msg.id}/reaction`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction: nextReaction }),
      });
    } catch {
      // Keep optimistic reaction state
    }
  };

  const handleSwitchToReferredCompanion = async (
    slug: string,
    options?: {
      mode: 'fresh' | 'handoff';
      handoffNote?: string;
      fromName?: string;
    }
  ) => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return;
    const forceNew = options?.mode === 'fresh';
    const handoffNote = options?.mode === 'handoff' ? options.handoffNote : undefined;
    const fromName = options?.mode === 'handoff' ? options.fromName : undefined;
    const matched = companionCatalog.find((c) => c.slug.toLowerCase() === cleanSlug);
    if (matched) {
      await handleStartPresetCompanion(matched, {
        forceNew,
        handoffNote,
        fromName,
      });
      return;
    }
    if (isPreviewMode) {
      handleOpenNewCompanionSetup(null);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorBanner(
          `Please sign in to start chatting with a ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`
        );
        return;
      }
      const res = await fetch('/api/chat/companions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companionSlug: cleanSlug,
          forceNew,
          handoffNote,
          handoffFromName: fromName,
          clientLocalHour: new Date().getHours(),
          pinAsTab: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.conversation) {
        handleOpenNewCompanionSetup(null);
        return;
      }
      const rawConv = data.conversation as ConversationRecord;
      const persona = rawConv.companion_persona_json;
      saveLocalConvMeta(rawConv.id, {
        pillar: 'companion',
        companion_type: rawConv.companion_type || 'friend',
        companion_slug: cleanSlug,
        companion_chat_mode: rawConv.companion_chat_mode || 'natural',
        companion_persona_json: persona || null,
      });
      await activateStartedCompanionThread(
        {
          ...rawConv,
          pillar: 'companion',
          is_active_tab: true,
          companion_slug: rawConv.companion_slug || cleanSlug,
        },
        persona?.name || cleanSlug,
        cleanSlug,
        (data.openingMessage || null) as ChatMessageRecord | null,
        Boolean(data.resumed)
      );
    } catch {
      handleOpenNewCompanionSetup(null);
    }
  };

  // Complete ?pillar=companion&companion=<slug> deep-links cleanly once companionCatalog is hydrated
  useEffect(() => {
    const targetSlug = pendingSeedCompanionRef.current;
    if (!targetSlug) return;
    const forceNew = pendingSeedNewRef.current;
    if (isPreviewMode) {
      pendingSeedCompanionRef.current = null;
      pendingSeedNewRef.current = false;
      const matched = PREVIEW_PUBLIC_COMPANIONS.find(
        (c) => c.slug.toLowerCase() === targetSlug
      );
      if (matched) {
        void handleStartPresetCompanion(matched, { forceNew });
      }
      return;
    }
    if (companionCatalog.length === 0) return;
    pendingSeedCompanionRef.current = null;
    pendingSeedNewRef.current = false;
    void handleSwitchToReferredCompanion(targetSlug, forceNew ? { mode: 'fresh' } : undefined);
  }, [companionCatalog, isPreviewMode]);

  // Handle matched custom persona or onboarding profile handoff via navigation state
  useEffect(() => {
    if (embeddedPreview) return;
    const navState = location.state as
      | {
          startCompanionPersona?: CompanionPersona;
          forceNew?: boolean;
          selectedProfileId?: string;
          councilHandoff?: CouncilHandoffConfirmPayload;
        }
      | null;
    if (navState?.councilHandoff) {
      const payload = navState.councilHandoff;
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      let destTabId =
        tabs.find((t) => t.pillar === 'companion' && t.companionSlug === payload.card.slug)
          ?.tabId ||
        tabs.find((t) => t.pillar === 'companion' && !t.conversationId)?.tabId ||
        tabs.find((t) => t.pillar === 'companion')?.tabId;
      if (!destTabId && tabs.length < MAX_ACTIVE_TABS) {
        const newCompTab: ActiveChatTab = {
          tabId: `tab-companion-${Date.now()}`,
          pillar: 'companion',
          conversationId: null,
          companionSlug: payload.card.slug,
          label: payload.card.name,
          isCore: false,
        };
        setTabs((prev) => (prev.length < MAX_ACTIVE_TABS ? [...prev, newCompTab] : prev));
        destTabId = newCompTab.tabId;
      }
      void handleStartPresetCompanion(payload.card, {
        forceNew: true,
        targetTabId: destTabId,
        profileId: payload.source.profileId ?? null,
        handoffNote: payload.handoffNote,
        fromName: payload.source.expertLabel,
        handoffFullContext: payload.fullContext,
        handoffTitle: payload.title,
        handoffExpertLabel: payload.source.expertLabel,
        handoffExpertSlug: payload.source.expertSlug ?? null,
        handoffMessageId: payload.source.messageId ?? null,
        handoffConversationId: payload.source.conversationId ?? null,
        handoffAstrologyMode: payload.source.astrologyMode ?? null,
        rememberReadingNote: payload.rememberReadingNote,
      });
      return;
    }
    if (navState?.selectedProfileId && !navState.startCompanionPersona) {
      setPendingProfileId(navState.selectedProfileId);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      return;
    }
    const incomingPersona = navState?.startCompanionPersona;
    if (!incomingPersona) return;

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });

    const existingComp = tabs.find((t) => t.pillar === 'companion' && !t.conversationId);
    if (existingComp) {
      activateTab(existingComp, { skipSnapshot: true });
    } else if (tabs.length < MAX_ACTIVE_TABS) {
      const newTab: ActiveChatTab = {
        tabId: `tab-companion-${Date.now()}`,
        pillar: 'companion',
        conversationId: null,
        label: incomingPersona.name || COMPANION_LABEL_SINGULAR,
        isCore: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.tabId);
    }

    void handleStartWithCompanion(incomingPersona, { forceNew: navState?.forceNew });
  }, [embeddedPreview, location.state, location.pathname, location.search, navigate]);

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
    setErrorBanner(null);

    if (isPreviewMode) {
      delete previewConvStoreRef.current[convId];
      delete previewMsgStoreRef.current[convId];
    } else {
      const token = await getAccessToken();
      if (!token) {
        setErrorBanner('Please sign in again to delete this chat.');
        return;
      }
      try {
        const res = await fetch(`/api/chat/conversations/${convId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setErrorBanner(errData.error || 'Could not delete this chat. Please try again.');
          return;
        }
      } catch {
        setErrorBanner('Network error while deleting chat. Please try again.');
        return;
      }
    }

    // Abort if currently streaming on a tab linked to this conversation
    if (
      streamingTabId &&
      tabs.some((t) => t.tabId === streamingTabId && t.conversationId === convId)
    ) {
      abortControllerRef.current?.abort();
    }

    // Clear tab cache entries holding this conversation
    for (const [tabKey, cached] of Object.entries(tabCacheRef.current)) {
      if (cached?.conversation?.id === convId) {
        delete tabCacheRef.current[tabKey];
      }
    }

    setConversations((prev) => prev.filter((c) => c.id !== convId));

    const remainingTabs = tabs.filter((t) => t.conversationId !== convId);
    const activeWasDeleted = tabs.some(
      (t) => t.tabId === activeTabId && t.conversationId === convId
    );

    if (remainingTabs.length > 0) {
      setTabs(remainingTabs);
      if (activeWasDeleted) {
        const fallbackTab = remainingTabs[0];
        activateTab(fallbackTab, { skipSnapshot: true });
      }
    } else {
      const first = tabs[0] || DEFAULT_CORE_TABS[0];
      const resetTab: ActiveChatTab = {
        ...first,
        conversationId: null,
        label:
          first.pillar === 'companion'
            ? COMPANION_LABEL_SINGULAR
            : first.pillar === 'clarity'
            ? 'Clarity'
            : defaultCouncilMode === 'western'
            ? 'Western Astrologer'
            : 'Vedic Astrologer',
      };
      delete tabCacheRef.current[resetTab.tabId];
      setTabs([resetTab]);
      activateTab(resetTab, { skipSnapshot: true });
    }

    if (activeConversation?.id === convId) {
      setActiveConversation(null);
      setMessages([]);
      setAskLaterItems([]);
      setHasMoreMessages(false);
    }

    if (!embeddedPreview && routeConversationId === convId) {
      navigate('/app/chat', { replace: true });
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
    const targetProf = nextProfileId
      ? profiles.find((p) => p.id === nextProfileId) || null
      : null;
    const shouldUpdateTitle = isAutoGeneratedCouncilTitleClient(
      activeConversation.title,
      catalog
    );
    const nextTitle = shouldUpdateTitle
      ? buildClientCouncilTitle(targetProf, expertSlug, catalog)
      : undefined;

    const res = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: nextProfileId,
        ...(nextTitle ? { title: nextTitle } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const updated = data.conversation as ConversationRecord;
      setActiveConversation(updated);
      if (nextTitle) {
        setTabs((prev) =>
          prev.map((t) =>
            t.conversationId === updated.id && !t.customLabel
              ? { ...t, label: nextTitle }
              : t
          )
        );
      }
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
    seededExpertRef.current = false;
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
    const freshExpert =
      expertSlug === 'learn_astrology'
        ? defaultCouncilMode === 'western'
          ? 'western_astrologer'
          : DEFAULT_COUNCIL_EXPERT_SLUG
        : expertSlug;
    if (expertSlug === 'learn_astrology') {
      seededExpertRef.current = false;
      setExpertSlug(freshExpert);
    }
    const freshGuideName =
      catalog?.experts.find((e) => e.slug === freshExpert)?.displayName ||
      (defaultCouncilMode === 'western' ? 'Western Astrologer' : 'Vedic Astrologer');
    setTabs((prev) =>
      prev.map((t) =>
        t.tabId === activeTabId
          ? {
              ...t,
              conversationId: null,
              expertSlug: freshExpert,
              label: freshGuideName,
              customLabel: false,
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
      const selectedProf = profiles.find((p) => p.id === profileId) || null;
      const previewTitle = buildClientCouncilTitle(selectedProf, expertSlug, catalog);
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === activeTabId && t.pillar === 'council' && !t.conversationId && !t.customLabel
            ? { ...t, label: previewTitle }
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
      const previewTitle = buildClientCouncilTitle(null, expertSlug, catalog);
      setTabs((prev) =>
        prev.map((t) =>
          t.tabId === activeTabId && t.pillar === 'council' && !t.conversationId && !t.customLabel
            ? { ...t, label: previewTitle }
            : t
        )
      );
    }
    setGeneralReadyMode(true);
    setComposerFocusTrigger((n) => n + 1);
  };

  const pendingPartnerPromptRef = useRef<string | null>(null);

  const handleSendMessage = async (
    overrideText?: string,
    overrideConversation?: ConversationRecord,
    overrideTechnicalDirective?: string,
    vedicOptions?: {
      bypassClarification?: boolean;
      clarifiedPlaybookId?: string;
      clarifiedContextPatch?: Partial<LifeContextData>;
      overrideExtraProfileIds?: string[];
      overrideDeepAudit?: boolean;
      curatedStarter?: boolean;
    }
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

    // Clarification escape hatch: if user types "continue", "skip", "proceed", etc. right after
    // a clarification card, bypass clarification and answer the original question directly.
    if (
      !overrideConversation &&
      !overrideText &&
      !vedicOptions?.bypassClarification &&
      pendingAttachments.length === 0 &&
      /^(?:continue|skip|proceed|go ahead|just answer|answer anyway|continue without details|no details|skip details)[.!]?$/i.test(
        promptToSend
      )
    ) {
      const lastMsg = messages[messages.length - 1];
      const activeClarification =
        lastMsg?.role === 'assistant' ? lastMsg.suggestions_json?.clarification : null;
      if (activeClarification) {
        const resolvedQ =
          activeClarification.originalQuestion?.trim() ||
          findPrecedingUserMessageText(messages, lastMsg.id);
        if (resolvedQ) {
          setDraftText('');
          void handleSendMessage(resolvedQ, undefined, undefined, {
            bypassClarification: true,
          });
          return;
        }
      }
    }

    setErrorBanner(null);
    const sendPillar: ChatPillar = activePillar;
    const sendTabId = activeTabId;

    if (sendPillar === 'companion' && !overrideConversation && !activeConversation) {
      setErrorBanner('Please choose a companion first to begin chatting.');
      return;
    }

    const savedDraftOnAbort = !overrideText ? (draftText ?? promptToSend) : null;
    const savedAttachmentsOnAbort = !overrideText ? pendingAttachments : [];
    const priorPendingProfileId = pendingProfileId;
    const priorGeneralReadyMode = generalReadyMode;
    const priorTabSnapshot = tabs.find((t) => t.tabId === sendTabId) || null;
    const currentReplyTarget = replyTarget;
    const currentExtraProfiles =
      sendPillar === 'council'
        ? vedicOptions?.overrideExtraProfileIds ?? extraProfileIds
        : [];
    const directiveToSend =
      sendPillar === 'council'
        ? overrideTechnicalDirective ??
          (!overrideText ? pendingTechnicalDirective?.directive : undefined)
        : undefined;
    const savedDirectiveOnAbort = pendingTechnicalDirective;

    setGeneralReadyMode(false);
    if (!overrideText) {
      setDraftText('');
      setAttachments([]);
    }
    setPendingTechnicalDirective(null);
    setReplyTarget(null);
    setPendingProfileConfirm(null);

    // Flip Send -> Stop immediately on click (covers auth + conversation setup + Stage 1 routing + streaming)
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setStreamingTabId(sendTabId);
    setStreamingText('');
    setStreamingStatus('Preparing consultation...');
    setStreamingTimingWidgets([]);
    setStreamingTarotSpread(null);

    let createdConvForTurn: ConversationRecord | null = null;
    let serverUserMsgId: string | null = null;
    let hasReceivedAssistantChunk = false;
    let authTokenForCleanup: string | null = null;
    let activeTargetConv: ConversationRecord | null = overrideConversation || activeConversation;

    const rollbackAbortedPreReplyTurn = () => {
      if (savedDraftOnAbort !== null) {
        setDraftText(savedDraftOnAbort);
      }
      if (savedAttachmentsOnAbort.length > 0) {
        setAttachments(savedAttachmentsOnAbort);
      }
      if (savedDirectiveOnAbort) {
        setPendingTechnicalDirective(savedDirectiveOnAbort);
      }
      if (currentReplyTarget) {
        setReplyTarget(currentReplyTarget);
      }
      if (serverUserMsgId) {
        const msgIdToRemove = serverUserMsgId;
        setMessages((prev) => prev.filter((m) => m.id !== msgIdToRemove));
        if (authTokenForCleanup && !createdConvForTurn) {
          void fetch(`/api/chat/messages/${msgIdToRemove}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authTokenForCleanup}` },
          }).catch(() => null);
        }
      }
      if (createdConvForTurn) {
        const orphanId = createdConvForTurn.id;
        setActiveConversation(null);
        setPendingProfileId(priorPendingProfileId);
        setGeneralReadyMode(priorGeneralReadyMode);
        setMessages([]);
        setConversations((prev) => prev.filter((c) => c.id !== orphanId));
        if (priorTabSnapshot) {
          setTabs((prev) =>
            prev.map((t) =>
              t.tabId === sendTabId
                ? {
                    ...t,
                    conversationId: null,
                    label: priorTabSnapshot.label,
                    expertSlug: priorTabSnapshot.expertSlug,
                    customLabel: priorTabSnapshot.customLabel,
                  }
                : t
            )
          );
        }
        delete tabCacheRef.current[sendTabId];
        if (!embeddedPreview && sendPillar === 'council') {
          navigate('/app/chat', { replace: true });
        }
        if (authTokenForCleanup) {
          void fetch(`/api/chat/conversations/${orphanId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authTokenForCleanup}` },
          }).catch(() => null);
        }
      }
    };

    try {
      const token = await getAccessToken();
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (!token) {
        rollbackAbortedPreReplyTurn();
        return;
      }
      authTokenForCleanup = token;

      if (!activeTargetConv) {
        const inferredMode =
          sendPillar === 'council' && expertSlug === 'learn_astrology'
            ? 'learn_astrology'
            : 'reading';
        const created = await handleCreateConversation(
          sendPillar === 'council' ? priorPendingProfileId : null,
          inferredMode,
          sendPillar,
          controller.signal
        );
        if (controller.signal.aborted) {
          if (created) createdConvForTurn = created;
          throw new DOMException('Aborted', 'AbortError');
        }
        if (!created) {
          rollbackAbortedPreReplyTurn();
          return;
        }
        createdConvForTurn = created;
        activeTargetConv = created;
      }

      const targetConversation = activeTargetConv;

      const response = await fetch(`/api/chat/conversations/${targetConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: promptToSend,
          pillar: sendPillar,
          companionSlug:
            sendPillar === 'companion'
              ? targetConversation.companion_slug || activeCompanionPersona?.slug || undefined
              : undefined,
          companionChatMode:
            sendPillar === 'companion'
              ? targetConversation.companion_chat_mode || 'natural'
              : undefined,
          companionPersona:
            sendPillar === 'companion'
              ? targetConversation.companion_persona_json || activeCompanionPersona || undefined
              : undefined,
          clientLocalHour: new Date().getHours(),
          technicalDirective: directiveToSend || undefined,
          expert: sendPillar === 'council' ? expertSlug : undefined,
          language: languageSlug,
          toneMode,
          responseLength,
          extraProfileIds: currentExtraProfiles,
          deepAudit:
            sendPillar === 'council' &&
            Boolean(targetConversation.profile_id) &&
            expertSlug !== 'tarot_reader' &&
            expertSlug !== 'numerologist' &&
            expertSlug !== 'learn_astrology' &&
            targetConversation.mode_type !== 'learn_astrology' &&
            targetConversation.mode_type !== 'report_followup' &&
            pendingAttachments.length === 0 &&
            (vedicOptions?.overrideDeepAudit || deepAudit)
              ? true
              : undefined,
          bypassClarification: vedicOptions?.bypassClarification || undefined,
          clarifiedPlaybookId: vedicOptions?.clarifiedPlaybookId || undefined,
          clarifiedContextPatch: vedicOptions?.clarifiedContextPatch || undefined,
          curatedStarter: vedicOptions?.curatedStarter || undefined,
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

      const processSseEventBlock = (rawEvent: string) => {
        const line = rawEvent.trim();
        if (!line.startsWith('data:')) return;
        const jsonText = line.slice(5).trim();
        if (!jsonText) return;

        const evt = JSON.parse(jsonText) as {
          type: string;
          message?: ChatMessageRecord;
          assistantMessage?: ChatMessageRecord;
          messageId?: string | null;
          conversationId?: string;
          followups?: string[];
          suggestions?: MessageSuggestions | null;
          techBreakdown?: string | null;
          timingWidgets?: TimingProgressWidget[];
          tarotSpread?: DrawnTarotSpread | null;
          render_style?: ChatStyle | null;
          referral?: MessageReferralPayload | null;
          title?: string;
          conversation?: ConversationRecord;
          pendingProfile?: PendingBirthProfileDraft | null;
          text?: string;
          error?: string;
        };

        const isCurrentStreamOwner = abortControllerRef.current === controller;

        if (evt.type === 'user_message' && evt.message) {
          serverUserMsgId = evt.message.id;
          setMessages((prev) => [...prev, evt.message!]);
        } else if (evt.type === 'status' && evt.text) {
          if (isCurrentStreamOwner) {
            setStreamingStatus(evt.text);
          }
        } else if (evt.type === 'timing_widgets' && Array.isArray(evt.timingWidgets)) {
          if (isCurrentStreamOwner) {
            setStreamingTimingWidgets(evt.timingWidgets);
          }
        } else if (evt.type === 'tarot_spread' && evt.tarotSpread) {
          if (isCurrentStreamOwner) {
            setStreamingTarotSpread(evt.tarotSpread);
          }
        } else if (evt.type === 'chunk' && evt.text) {
          hasReceivedAssistantChunk = true;
          accumulated += evt.text;
          if (isCurrentStreamOwner) {
            setStreamingStatus(null);
            setStreamingText(accumulated);
          }
        } else if (evt.type === 'aborted') {
          if (!hasReceivedAssistantChunk) {
            rollbackAbortedPreReplyTurn();
          }
        } else if (evt.type === 'done') {
          if (evt.assistantMessage) {
            const baseSuggestions =
              evt.assistantMessage.suggestions_json ?? evt.suggestions ?? null;
            const eventTimingWidgets =
              Array.isArray(evt.timingWidgets) && evt.timingWidgets.length > 0
                ? evt.timingWidgets
                : undefined;
            const eventTarotSpread =
              evt.tarotSpread &&
              Array.isArray(evt.tarotSpread.cards) &&
              evt.tarotSpread.cards.length > 0
                ? evt.tarotSpread
                : undefined;
            const mergedSuggestions: MessageSuggestions | null =
              sendPillar === 'council' && baseSuggestions
                ? {
                    ...baseSuggestions,
                    ...(evt.techBreakdown && !baseSuggestions.tech_breakdown
                      ? { tech_breakdown: evt.techBreakdown }
                      : {}),
                    ...(eventTimingWidgets && !baseSuggestions.timing_widgets?.length
                      ? { timing_widgets: eventTimingWidgets }
                      : {}),
                    ...(eventTarotSpread && !baseSuggestions.tarot_spread
                      ? { tarot_spread: eventTarotSpread }
                      : {}),
                  }
                : sendPillar === 'council' &&
                  (evt.techBreakdown || eventTimingWidgets || eventTarotSpread)
                ? {
                    followups: [],
                    deeper_analysis: [],
                    ...(evt.techBreakdown ? { tech_breakdown: evt.techBreakdown } : {}),
                    ...(eventTimingWidgets ? { timing_widgets: eventTimingWidgets } : {}),
                    ...(eventTarotSpread ? { tarot_spread: eventTarotSpread } : {}),
                  }
                : null;
            const companionSuggestions: MessageSuggestions | null =
              sendPillar === 'companion'
                ? (() => {
                    const compBase: MessageSuggestions | null =
                      baseSuggestions ||
                      (Array.isArray(evt.followups) && evt.followups.length > 0
                        ? {
                            followups: evt.followups.map((text, idx) => ({
                              id: `comp_f_${idx}`,
                              text,
                            })),
                            deeper_analysis: [],
                          }
                        : null);
                    if (compBase) {
                      return eventTarotSpread && !compBase.tarot_spread
                        ? { ...compBase, tarot_spread: eventTarotSpread }
                        : compBase;
                    }
                    if (eventTarotSpread) {
                      return {
                        followups: [],
                        deeper_analysis: [],
                        tarot_spread: eventTarotSpread,
                      };
                    }
                    return null;
                  })()
                : null;
            const finalSuggestions =
              sendPillar === 'council' ? mergedSuggestions : companionSuggestions;
            const enrichedAssistant: ChatMessageRecord = {
              ...evt.assistantMessage,
              suggestions_json: finalSuggestions,
              render_style:
                evt.assistantMessage.render_style ?? evt.render_style ?? null,
              referral_json:
                evt.assistantMessage.referral_json ?? evt.referral ?? null,
            };
            if (finalSuggestions?.tarot_spread?.cards?.length) {
              setFreshTarotMsgIds((prev) => {
                const next = new Set(prev);
                next.add(enrichedAssistant.id);
                return next;
              });
            }
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
              companion_slug:
                evt.conversation.companion_slug ||
                targetConversation.companion_slug ||
                null,
              companion_chat_mode:
                evt.conversation.companion_chat_mode ||
                targetConversation.companion_chat_mode ||
                null,
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
            setConversations((prev) =>
              prev.map((c) =>
                c.id === mergedConv.id
                  ? { ...c, title: mergedConv.title, updated_at: mergedConv.updated_at }
                  : c
              )
            );
            setTabs((prev) =>
              prev.map((t) =>
                t.tabId === sendTabId
                  ? {
                      ...t,
                      conversationId: mergedConv.id,
                      label: t.customLabel
                        ? t.label
                        : deriveTabLabelForConversation(mergedConv, profiles),
                    }
                  : t
              )
            );
          }
          if (isCurrentStreamOwner) {
            setStreamingText('');
            setStreamingStatus(null);
            setStreamingTimingWidgets([]);
            setStreamingTarotSpread(null);
            setIsStreaming(false);
            setStreamingTabId(null);
            abortControllerRef.current = null;
          }
          void Promise.all([loadConversations(), refreshUser()]);
        } else if (evt.type === 'post_meta') {
          if (evt.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === evt.messageId
                  ? {
                      ...m,
                      followups_json: Array.isArray(evt.followups)
                        ? evt.followups
                        : m.followups_json,
                      suggestions_json:
                        evt.suggestions !== undefined
                          ? evt.suggestions
                            ? {
                                ...evt.suggestions,
                                ...(m.suggestions_json?.tarot_spread &&
                                !evt.suggestions.tarot_spread
                                  ? { tarot_spread: m.suggestions_json.tarot_spread }
                                  : {}),
                              }
                            : m.suggestions_json?.tarot_spread
                            ? {
                                followups: [],
                                deeper_analysis: [],
                                tarot_spread: m.suggestions_json.tarot_spread,
                              }
                            : null
                          : m.suggestions_json,
                    }
                  : m
              )
            );
          }
          if (evt.title && evt.conversationId) {
            const nextTitle = evt.title;
            const targetConvId = evt.conversationId;
            setActiveConversation((prev) =>
              prev && prev.id === targetConvId ? { ...prev, title: nextTitle } : prev
            );
            setConversations((prev) =>
              prev.map((c) => (c.id === targetConvId ? { ...c, title: nextTitle } : c))
            );
            setTabs((prev) =>
              prev.map((t) =>
                t.conversationId === targetConvId && !t.customLabel
                  ? { ...t, label: nextTitle }
                  : t
              )
            );
          }
        } else if (evt.type === 'error') {
          throw new Error(evt.error || 'Consultation interrupted');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          processSseEventBlock(rawEvent);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const rawEvent of buffer.split('\n\n')) {
          processSseEventBlock(rawEvent);
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        if (!hasReceivedAssistantChunk) {
          rollbackAbortedPreReplyTurn();
        } else if (activeTargetConv?.id) {
          const convIdToRefresh = activeTargetConv.id;
          window.setTimeout(() => {
            void loadConversationMessages(convIdToRefresh);
          }, 260);
        }
      } else {
        setErrorBanner(err instanceof Error ? err.message : 'Consultation error');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsStreaming(false);
        setStreamingTabId(null);
        setStreamingText('');
        setStreamingStatus(null);
        setStreamingTimingWidgets([]);
        setStreamingTarotSpread(null);
        abortControllerRef.current = null;
      }
    }
  };

  const handleSelectClarificationChip = async (chip: ClarificationChip) => {
    if (isStreaming) return;
    if (chip.action === 'open_partner_picker') {
      pendingPartnerPromptRef.current =
        chip.clarifiedQuestion || 'Please evaluate our synastry compatibility and timing.';
      handleOpenAddChartModal();
      return;
    }

    if (chip.contextPatch && activeProfile) {
      const patch = chip.contextPatch;
      // Optimistically reflect patch locally and update Desh-Kaal-Patra completeness in background
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfile.id
            ? {
                ...p,
                life_context_json: {
                  ...(p.life_context_json || {}),
                  ...patch,
                },
              }
            : p
        )
      );
      void (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return;
          const patchRes = await fetch(`/api/profiles/${activeProfile.id}/life-context`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ patch }),
          });
          if (patchRes.ok) {
            const data = await patchRes.json();
            if (data.profile) {
              const updatedProf = data.profile as ChatProfile;
              setProfiles((prev) =>
                prev.map((p) => (p.id === updatedProf.id ? { ...p, ...updatedProf } : p))
              );
            }
          }
        } catch {
          // Chat route also persists clarifiedContextPatch cleanly as backup
        }
      })();
    }

    await handleSendMessage(chip.clarifiedQuestion, undefined, undefined, {
      bypassClarification: true,
      clarifiedPlaybookId: chip.playbookId,
      clarifiedContextPatch: chip.contextPatch,
    });
  };

  const handleSelectPartnerProfileForClarification = (
    partnerProfileId: string,
    originalQuestion: string
  ) => {
    if (isStreaming) return;
    const nextExtra = Array.from(
      new Set([
        ...extraProfileIds.filter((id) => id !== partnerProfileId && id !== activeProfile?.id),
        partnerProfileId,
      ])
    ).slice(0, 3);
    setExtraProfileIds(nextExtra);

    const partnerObj = profiles.find((p) => p.id === partnerProfileId);
    const questionText =
      originalQuestion.trim() ||
      `Compare compatibility between my chart and ${partnerObj?.name || 'the attached chart'}.`;

    void handleSendMessage(questionText, undefined, undefined, {
      bypassClarification: true,
      overrideExtraProfileIds: nextExtra,
    });
  };

  const findPrecedingUserMessageText = (
    list: ChatMessageRecord[],
    beforeMessageId?: string
  ): string => {
    const startIdx = beforeMessageId
      ? list.findIndex((m) => m.id === beforeMessageId)
      : list.length;
    const upper = startIdx >= 0 ? startIdx : list.length;
    for (let i = upper - 1; i >= 0; i--) {
      if (list[i].role === 'user' && list[i].content.trim()) {
        return list[i].content.trim();
      }
    }
    return '';
  };

  const handleContinueWithoutDetails = (originalQuestion: string, messageId: string) => {
    if (isStreaming) return;
    const resolvedQ =
      originalQuestion.trim() || findPrecedingUserMessageText(messages, messageId);
    if (!resolvedQ) return;
    void handleSendMessage(resolvedQ, undefined, undefined, {
      bypassClarification: true,
    });
  };

  const attachCreatedProfileAndResumeReading = async (
    createdProfile: ChatProfile,
    originalQuestion?: string
  ) => {
    const token = await getAccessToken();
    if (!token) return;

    let updatedConv = activeConversation;
    if (activeConversation) {
      const nextAutoTitle = isAutoGeneratedCouncilTitleClient(
        activeConversation.title,
        catalog
      )
        ? buildClientCouncilTitle(createdProfile, expertSlug, catalog)
        : undefined;
      const patchRes = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile_id: createdProfile.id,
          ...(nextAutoTitle ? { title: nextAutoTitle } : {}),
        }),
      });
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        if (patchData.conversation) {
          updatedConv = patchData.conversation as ConversationRecord;
          setActiveConversation(updatedConv);
          if (nextAutoTitle) {
            setTabs((prev) =>
              prev.map((t) =>
                t.conversationId === updatedConv!.id && !t.customLabel
                  ? { ...t, label: nextAutoTitle }
                  : t
              )
            );
          }
        }
      }
    }

    await loadConversations();

    const isWesternExpert =
      expertSlug === 'western_astrologer' ||
      expertSlug === 'modern_astrologer' ||
      expertSlug === 'hellenistic_astrologer' ||
      (astrologyMode === 'western' && normalizeCouncilSlug(expertSlug) === DEFAULT_COUNCIL_EXPERT_SLUG);
    const systemWord =
      expertSlug === 'hellenistic_astrologer'
        ? 'Hellenistic'
        : isWesternExpert
        ? 'Western'
        : 'Vedic';

    const readingPrompt = originalQuestion
      ? `The birth chart for ${createdProfile.name} is now saved and attached to this consultation. Please provide the full ${systemWord} astrology reading for: ${originalQuestion}`
      : `The birth chart for ${createdProfile.name} is now saved and attached to this consultation. Please proceed with a detailed ${systemWord} astrology reading.`;

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
    const pendingPartnerPrompt = pendingPartnerPromptRef.current;
    pendingPartnerPromptRef.current = null;
    setEditingPendingChatDraft(false);
    setAddChartInitialValues(undefined);

    if (wasEditingChatDraft && activeConversation) {
      setPendingProfileConfirm(null);
      setInlineChartCreation(null);
      void attachCreatedProfileAndResumeReading(createdProfile, originalQuestion);
      return;
    }

    if (pendingPartnerPrompt && activeConversation) {
      const nextExtra = Array.from(
        new Set([
          ...extraProfileIds.filter((id) => id !== createdProfile.id && id !== activeProfile?.id),
          createdProfile.id,
        ])
      ).slice(0, 3);
      setExtraProfileIds(nextExtra);
      void handleSendMessage(pendingPartnerPrompt, undefined, undefined, {
        bypassClarification: true,
        overrideExtraProfileIds: nextExtra,
      });
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

  const handleSaveMessageToNotes = async (msg: ChatMessageRecord) => {
    if (savingNoteMsgId === msg.id || savedNoteMsgIds.has(msg.id)) return;

    if (isPreviewMode) {
      setSavedNoteMsgIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    setSavingNoteMsgId(msg.id);
    try {
      const sourceType =
        activePillar === 'companion'
          ? 'companion'
          : activePillar === 'clarity'
          ? 'personal'
          : 'council';

      const firstLine = msg.content
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim()
        .slice(0, 90);

      const convTitle = activeConversation?.title?.trim();
      const noteTitle =
        convTitle &&
        convTitle.toLowerCase() !== 'new consultation' &&
        convTitle.toLowerCase() !== 'new chat'
          ? convTitle.slice(0, 120)
          : firstLine || 'Saved Insight';

      const msgExpert = msg.expert_used || expertSlug;
      const inferredMode: AstrologyMode | null =
        sourceType === 'council'
          ? msgExpert === 'western_astrologer' ||
            msgExpert === 'modern_astrologer' ||
            msgExpert === 'hellenistic_astrologer'
            ? 'western'
            : normalizeCouncilSlug(msgExpert) === DEFAULT_COUNCIL_EXPERT_SLUG
            ? 'vedic'
            : astrologyMode
          : null;

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: noteTitle,
          content: msg.content,
          source_type: sourceType,
          source_ref_id: msg.id,
          profile_id: activePillar === 'council' ? effectiveProfileId || null : null,
          astrology_mode: inferredMode,
        }),
      });

      if (res.ok) {
        setSavedNoteMsgIds((prev) => {
          const next = new Set(prev);
          next.add(msg.id);
          return next;
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorBanner(errData.error || 'Could not save this message to Notes.');
      }
    } catch {
      setErrorBanner('Network error while saving to Notes.');
    } finally {
      setSavingNoteMsgId(null);
    }
  };

  const handleOpenHandoffFromCouncilMessage = useCallback(
    (msg: ChatMessageRecord) => {
      const msgExpert = msg.expert_used || expertSlug;
      const expertLabel = resolveCouncilDisplayName(msgExpert, catalog);
      const inferredMode: AstrologyMode =
        msgExpert === 'western_astrologer' ||
        msgExpert === 'modern_astrologer' ||
        msgExpert === 'hellenistic_astrologer'
          ? 'western'
          : normalizeCouncilSlug(msgExpert) === DEFAULT_COUNCIL_EXPERT_SLUG
          ? 'vedic'
          : astrologyMode;
      const firstLine = msg.content
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim()
        .slice(0, 90);
      const convTitle = activeConversation?.title?.trim();
      const title =
        convTitle &&
        convTitle.toLowerCase() !== 'new consultation' &&
        convTitle.toLowerCase() !== 'new chat'
          ? convTitle.slice(0, 110)
          : firstLine || `${expertLabel} Reading`;
      const profileLabel = activeProfile
        ? activeProfile.is_default
          ? activeProfile.short_name?.trim()
            ? `You (${activeProfile.short_name.trim()})`
            : 'You'
          : activeProfile.short_name?.trim() || activeProfile.name
        : null;

      setHandoffSource({
        title,
        rawContent: msg.content,
        expertSlug: msgExpert,
        expertLabel,
        astrologyMode: inferredMode,
        profileId: effectiveProfileId || null,
        profileLabel,
        conversationId: activeConversation?.id || null,
        messageId: msg.id,
      });
    },
    [
      activeConversation?.id,
      activeConversation?.title,
      activeProfile,
      astrologyMode,
      catalog,
      effectiveProfileId,
      expertSlug,
    ]
  );

  const handleConfirmCouncilHandoff = async (payload: CouncilHandoffConfirmPayload) => {
    setHandoffSubmittingSlug(payload.card.slug);
    try {
      snapshotActiveTabState(activeTabId);
      let destTabId =
        tabs.find(
          (t) => t.pillar === 'companion' && t.companionSlug === payload.card.slug
        )?.tabId ||
        tabs.find((t) => t.pillar === 'companion' && !t.conversationId)?.tabId ||
        tabs.find((t) => t.pillar === 'companion')?.tabId;

      if (!destTabId && tabs.length < MAX_ACTIVE_TABS) {
        const newCompTab: ActiveChatTab = {
          tabId: `tab-companion-${Date.now()}`,
          pillar: 'companion',
          conversationId: null,
          companionSlug: payload.card.slug,
          label: payload.card.name,
          isCore: false,
        };
        setTabs((prev) => (prev.length < MAX_ACTIVE_TABS ? [...prev, newCompTab] : prev));
        destTabId = newCompTab.tabId;
      }

      await handleStartPresetCompanion(payload.card, {
        forceNew: false,
        targetTabId: destTabId,
        profileId: payload.source.profileId ?? null,
        handoffNote: payload.handoffNote,
        fromName: payload.source.expertLabel,
        handoffFullContext: payload.fullContext,
        handoffTitle: payload.title,
        handoffExpertLabel: payload.source.expertLabel,
        handoffExpertSlug: payload.source.expertSlug ?? null,
        handoffMessageId: payload.source.messageId ?? null,
        handoffConversationId: payload.source.conversationId ?? null,
        handoffAstrologyMode: payload.source.astrologyMode ?? null,
        rememberReadingNote: payload.rememberReadingNote,
      });

      setHandoffSource(null);
      if (!isPreviewMode) {
        await loadSharedReadingNotes(payload.source.profileId ?? null);
      }
    } finally {
      setHandoffSubmittingSlug(null);
    }
  };

  const handleDeleteSharedReadingNote = async (noteId: string) => {
    if (isPreviewMode) {
      setSharedReadingNotes((prev) => prev.filter((n) => n.id !== noteId));
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setDeletingReadingNoteId(noteId);
    try {
      const res = await fetch(`/api/chat/reading-notes/${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSharedReadingNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } finally {
      setDeletingReadingNoteId(null);
    }
  };

  const handleSubmitSuggestion = (item: SuggestionItem) => {
    void handleSendMessage(item.text, undefined, item.technical_directive, {
      bypassClarification: Boolean(
        item.technical_directive || item.action === 'deep_audit' || item.playbook_id
      ),
      clarifiedPlaybookId: item.playbook_id,
      overrideDeepAudit: item.action === 'deep_audit',
      curatedStarter: true,
    });
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

  const handleInsertSuggestions = (items: SuggestionItem[]) => {
    const valid = items.filter((it) => it && typeof it.text === 'string' && it.text.trim());
    if (valid.length === 0) return;
    if (valid.length === 1) {
      handleInsertSuggestion(valid[0]);
      return;
    }
    const combinedText = valid
      .map((it, idx) => `${idx + 1}. ${it.text.trim()}`)
      .join('\n');
    setDraftText(combinedText);
    const directives = valid
      .map((it) => it.technical_directive?.trim())
      .filter((d): d is string => Boolean(d));
    if (directives.length > 0) {
      setPendingTechnicalDirective({
        label: `${valid.length} selected questions`,
        directive: directives.join(' | '),
      });
    } else {
      setPendingTechnicalDirective(null);
    }
    setComposerFocusTrigger((n) => n + 1);
  };

  const handleBookmarkSuggestions = async (
    entries: Array<{ item: SuggestionItem; tier: 'followup' | 'deeper_analysis' }>,
    sourceMessageId: string
  ) => {
    const incomingEntries = entries.filter(
      (entry) => entry?.item && typeof entry.item.text === 'string' && entry.item.text.trim()
    );
    if (incomingEntries.length === 0) return;

    const existingKeys = new Set(
      askLaterItems.map((entry) => entry.text.trim().toLowerCase())
    );
    const existingIds = new Set(askLaterItems.map((entry) => entry.id));

    const toAdd: AskLaterItem[] = [];
    for (const { item, tier } of incomingEntries) {
      const cleanText = item.text.trim();
      const key = cleanText.toLowerCase();
      const itemId =
        item.id || `ask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (existingKeys.has(key) || existingIds.has(itemId)) continue;
      existingKeys.add(key);
      existingIds.add(itemId);
      toAdd.push({
        id: itemId,
        text: cleanText,
        tier,
        technical_directive: item.technical_directive,
        source_message_id: sourceMessageId,
        saved_at: new Date().toISOString(),
      });
    }

    if (toAdd.length === 0) return;

    const optimisticNext = [...toAdd, ...askLaterItems].slice(0, 50);
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
          action: 'add_many',
          items: toAdd.map((entry) => ({
            id: entry.id,
            text: entry.text,
            tier: entry.tier,
            technical_directive: entry.technical_directive,
            source_message_id: entry.source_message_id,
          })),
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

  const handleLoadMoreSuggestions = async (messageId: string) => {
    const applyUpdatedSuggestions = (nextSuggestions: MessageSuggestions) => {
      const nextFollowups = (nextSuggestions.followups || []).map((f) => f.text);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, suggestions_json: nextSuggestions, followups_json: nextFollowups }
            : m
        )
      );
      for (const [tabKey, cached] of Object.entries(tabCacheRef.current)) {
        if (cached?.messages?.some((m) => m.id === messageId)) {
          tabCacheRef.current[tabKey] = {
            ...cached,
            messages: cached.messages.map((m) =>
              m.id === messageId
                ? { ...m, suggestions_json: nextSuggestions, followups_json: nextFollowups }
                : m
            ),
          };
        }
      }
    };

    if (isPreviewMode) {
      const targetMsg = messages.find((m) => m.id === messageId);
      const existingFollowups = targetMsg?.suggestions_json?.followups || [];
      const existingDeeper = targetMsg?.suggestions_json?.deeper_analysis || [];
      const seen = new Set(
        [...existingFollowups, ...existingDeeper].map((s) => s.text.trim().toLowerCase())
      );

      const sampleFollowups: SuggestionItem[] = [
        {
          id: `pf_${Date.now()}_1`,
          text: 'Which specific dates next month favor key conversations?',
        },
        {
          id: `pf_${Date.now()}_2`,
          text: 'What small daily habit best supports this planetary period?',
        },
        {
          id: `pf_${Date.now()}_3`,
          text: 'How might this transit show up in close partnerships?',
        },
        {
          id: `pf_${Date.now()}_4`,
          text: 'Where should I conserve energy over the coming quarter?',
        },
      ];
      const sampleDeeper: SuggestionItem[] = [
        {
          id: `pd_${Date.now()}_1`,
          text: 'Check D9 Navamsa strength and aspect on the 7th lord',
          technical_directive:
            'Inspect D9 Navamsa dignity and planetary aspects on the 7th house and its lord.',
        },
        {
          id: `pd_${Date.now()}_2`,
          text: 'Evaluate Ashtakavarga bindus for upcoming transit houses',
          technical_directive:
            'Review Bhinnashtakavarga and Sarvashtakavarga scores for active Gochar houses.',
        },
        {
          id: `pd_${Date.now()}_3`,
          text: 'Cross-check Pratyantardasha ruler via KP Sub-Lord cusps',
          technical_directive:
            'Analyze the active Pratyantardasha planet as KP Sub-Lord and its star-lord significations.',
        },
        {
          id: `pd_${Date.now()}_4`,
          text: 'Inspect Jaimini Chara Karakas for career and support shifts',
          technical_directive:
            'Examine Amatyakaraka and Atmakaraka placements in Rasi and Navamsa.',
        },
      ];

      const uniqueFollowups = sampleFollowups.filter(
        (item) => !seen.has(item.text.trim().toLowerCase())
      );
      const uniqueDeeper = sampleDeeper.filter(
        (item) => !seen.has(item.text.trim().toLowerCase())
      );
      applyUpdatedSuggestions({
        followups: [...existingFollowups, ...uniqueFollowups],
        deeper_analysis: [...existingDeeper, ...uniqueDeeper],
      });
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/chat/messages/${messageId}/suggestions/more`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorBanner(errData.error || 'Could not generate more suggestions.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.suggestions) {
        applyUpdatedSuggestions(data.suggestions as MessageSuggestions);
      }
    } catch {
      setErrorBanner('Network error while generating more suggestions.');
    }
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
      (expertSlug === 'learn_astrology' ? 'learn_astrology' : 'reading')
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
        companionCatalog={companionCatalog}
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
          const emptyCouncil = tabs.find((t) => t.pillar === 'council' && !t.conversationId);
          const anyCouncil = emptyCouncil || tabs.find((t) => t.pillar === 'council');
          if (anyCouncil && activeTabId !== anyCouncil.tabId) {
            activateTab(anyCouncil);
          } else if (!anyCouncil) {
            handleQuickAddTab();
          }
          void handleCreateConversation(pid, modeType, 'council');
        }}
        onStartNewCompanion={() => handleOpenNewCompanionSetup(null)}
        onOpenClarity={handleOpenClarityTab}
        onOpenAddChartModal={() => handleOpenAddChartModal()}
        onToggleBookmark={handleToggleBookmark}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onLoadFavorites={loadFavorites}
      />

      {/* Main Consultation Studio Pane */}
      <div className="relative flex-1 flex flex-col min-w-0 h-full">
        {/* Slim Single-Line Pillar-Aware Header Strip */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 border-b border-[#3D3830]/10 bg-[#FAF7F2] px-2.5 sm:px-4 md:px-6 py-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
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
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {activeCompanionPersona ? (
                  <button
                    type="button"
                    onClick={() =>
                      setProfileSheetCompanion(
                        buildSheetCardFromPersona(activeCompanionPersona, activeCompanionCard)
                      )
                    }
                    className="group flex items-center gap-2.5 min-w-0 rounded-xl px-1.5 py-0.5 -ml-1.5 hover:bg-[#F1ECE3]/80 transition-colors text-left cursor-pointer"
                    aria-label={`View ${activeCompanionPersona.name}'s profile`}
                  >
                    <CompanionAvatar
                      name={activeCompanionPersona.name}
                      avatarUrl={
                        activeCompanionCard?.avatar_url ?? activeCompanionPersona.avatar_url
                      }
                      palette={
                        activeCompanionCard?.monogram_palette ??
                        activeCompanionPersona.monogram_palette
                      }
                      size="sm"
                      shape="circle"
                    />
                    <div className="min-w-0">
                      <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate">
                        <span className="font-semibold text-[#3D3830] group-hover:underline underline-offset-2">
                          {activeCompanionPersona.name}
                        </span>{' '}
                        <span className="text-[#5C5449]">
                          ·{' '}
                          {activeCompanionCard?.primary_expertise ||
                            activeCompanionPersona.role_label}
                        </span>
                      </h1>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <HeartHandshake className="h-4 w-4 text-[#8B7355] shrink-0" />
                    <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate">
                      <span className="font-semibold text-[#3D3830]">{COMPANION_LABEL_PLURAL}</span>{' '}
                      <span className="text-[#5C5449]">· Choose someone to talk to</span>
                    </h1>
                  </div>
                )}
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
                  className="group inline-flex items-center gap-1 sm:gap-1.5 min-w-0 max-w-full rounded-xl px-1.5 sm:px-2 py-1 -ml-1.5 sm:-ml-2 hover:bg-[#F1ECE3]/80 transition-colors cursor-pointer text-left"
                >
                  <h1 className="font-serif text-[15px] sm:text-base font-medium text-[#3D3830] truncate min-w-0">
                    {(() => {
                      const councilName = resolveCouncilDisplayName(expertSlug, catalog);
                      const fallbackDisplay = `${headerProfileName} (${councilName})`;
                      const rawConvTitle = activeConversation?.title?.trim() || '';
                      const isGenericOrEmpty =
                        !rawConvTitle ||
                        rawConvTitle.toLowerCase() === 'new consultation' ||
                        rawConvTitle.toLowerCase() === 'new chat';
                      const fullHeaderTitle = isGenericOrEmpty ? fallbackDisplay : rawConvTitle;
                      const parenMatch = fullHeaderTitle.match(/^(.+?)\s*(\([^()]+\))$/);
                      if (parenMatch) {
                        return (
                          <>
                            <span className="font-semibold text-[#3D3830]">{parenMatch[1]}</span>
                            <span className="hidden sm:inline text-[#5C5449]"> {parenMatch[2]}</span>
                          </>
                        );
                      }
                      return (
                        <span className="font-semibold text-[#3D3830]">{fullHeaderTitle}</span>
                      );
                    })()}
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
                              activeConversation?.mode_type === 'learn_astrology' ||
                              expertSlug === 'learn_astrology'
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

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {activePillar === 'companion' &&
              activeConversation &&
              (activeCompanionCard?.supports_listening_cue ??
                activeCompanionPersona?.supports_listening_cue ??
                true) && (
                <div
                  role="group"
                  aria-label="Conversation pace"
                  className="hidden md:inline-flex items-center rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/85 p-0.5 shrink-0"
                >
                  <button
                    type="button"
                    aria-pressed={
                      (activeConversation.companion_chat_mode || 'natural') === 'natural'
                    }
                    onClick={() => void handleToggleCompanionChatMode('natural')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      (activeConversation.companion_chat_mode || 'natural') === 'natural'
                        ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    Natural
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeConversation.companion_chat_mode === 'just_listen'}
                    onClick={() => void handleToggleCompanionChatMode('just_listen')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeConversation.companion_chat_mode === 'just_listen'
                        ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    Just listen
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeConversation.companion_chat_mode === 'help_think'}
                    onClick={() => void handleToggleCompanionChatMode('help_think')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      activeConversation.companion_chat_mode === 'help_think'
                        ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    Help me think
                  </button>
                </div>
              )}

            {activePillar === 'companion' && activeConversation && profiles.length > 0 && (
              <div ref={companionChartMenuRef} className="relative shrink-0">
                <Tooltip content="Chart in focus for this companion" placement="bottom">
                  <button
                    type="button"
                    aria-expanded={showCompanionChartMenu}
                    aria-haspopup="listbox"
                    onClick={() => setShowCompanionChartMenu((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2 sm:px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                    <span className="hidden sm:inline truncate max-w-[125px]">
                      Chart:{' '}
                      {companionFocusedProfile
                        ? companionFocusedProfile.short_name?.trim() ||
                          companionFocusedProfile.name
                        : 'You'}
                    </span>
                    <span className="sm:hidden truncate max-w-[54px]">
                      {companionFocusedProfile
                        ? (
                            companionFocusedProfile.short_name?.trim() ||
                            companionFocusedProfile.name
                          ).split(' ')[0]
                        : 'You'}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-[#8B8275] shrink-0 transition-transform duration-150 ${
                        showCompanionChartMenu ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </Tooltip>

                {showCompanionChartMenu && (
                  <div
                    role="listbox"
                    aria-label="Chart in focus"
                    className="animate-cc-dropdown-down absolute right-0 top-full mt-1.5 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-xl overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-[#F1ECE3]/80 border-b border-[#3D3830]/10">
                      <p className="text-[11px] font-medium text-[#5C5449] truncate">
                        Chart in focus for {activeCompanionPersona?.name || 'companion'}
                      </p>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                      <button
                        type="button"
                        role="option"
                        aria-selected={!activeConversation.profile_id}
                        onClick={() => void handleSwitchCompanionChart(null)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          !activeConversation.profile_id
                            ? 'bg-[#F1ECE3] text-[#3D3830] font-medium'
                            : 'text-[#5C5449] hover:bg-[#F1ECE3]/65 hover:text-[#3D3830]'
                        }`}
                      >
                        <span className="truncate">
                          Auto (You
                          {defaultYouProfile
                            ? ` — ${defaultYouProfile.short_name?.trim() || defaultYouProfile.name}`
                            : ''}
                          )
                        </span>
                        {!activeConversation.profile_id && (
                          <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                        )}
                      </button>

                      {profiles.map((p) => {
                        const isSelected = activeConversation.profile_id === p.id;
                        const label = p.short_name?.trim() || p.name;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => void handleSwitchCompanionChart(p.id)}
                            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#F1ECE3] text-[#3D3830] font-medium'
                                : 'text-[#5C5449] hover:bg-[#F1ECE3]/65 hover:text-[#3D3830]'
                            }`}
                          >
                            <span className="truncate">
                              {label}
                              {p.is_default ? ' · You' : ''}
                            </span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activePillar === 'companion' &&
              activeConversation &&
              sharedReadingNotes.length > 0 && (
                <Tooltip
                  content={`View Council reading notes shared with ${COMPANION_LABEL_PLURAL.toLowerCase()}`}
                  placement="bottom"
                >
                  <button
                    type="button"
                    onClick={() => setShowSharedReadingNotesModal(true)}
                    aria-label="Council reading notes"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2 sm:px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span className="hidden md:inline">Council notes</span>
                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[10px] text-[#8B8275]">
                      {sharedReadingNotes.length}
                    </span>
                  </button>
                </Tooltip>
              )}

            {activePillar === 'companion' && activeConversation && (
              <Tooltip content="Start a fresh topic thread" placement="bottom">
                <button
                  type="button"
                  onClick={handleStartNewTopicWithCurrentCompanion}
                  aria-label="Start a fresh topic thread"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2 sm:px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="hidden sm:inline">New topic</span>
                </button>
              </Tooltip>
            )}

            {activePillar === 'companion' && activeConversation && (
              <Tooltip content={`Browse all ${COMPANION_LABEL_PLURAL.toLowerCase()}`} placement="bottom">
                <button
                  type="button"
                  onClick={() => handleOpenNewCompanionSetup(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="hidden sm:inline">All {COMPANION_LABEL_PLURAL.toLowerCase()}</span>
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

            {activePillar === 'council' && !isThreadLocked && (
              <AstrologyModeToggle
                size="xs"
                value={astrologyMode}
                onChange={handleChangeChatAstrologyMode}
                className="max-sm:[&_button]:px-2 max-sm:text-[10.5px]"
              />
            )}

            {activePillar === 'council' && isThreadLocked && (
              <span className="hidden sm:inline-flex items-center rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#5C5449]">
                {expertSlug === 'tarot_reader'
                  ? 'Tarot'
                  : expertSlug === 'numerologist'
                  ? 'Numerology'
                  : expertSlug === 'kp_precision'
                  ? 'KP Astrology'
                  : expertSlug === 'jaimini'
                  ? 'Jaimini'
                  : expertSlug === 'hellenistic_astrologer'
                  ? 'Hellenistic'
                  : expertSlug === 'western_astrologer' || expertSlug === 'modern_astrologer'
                  ? 'Western'
                  : 'Vedic'}
              </span>
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
                  className={`inline-flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-xl border transition-all active:scale-[0.96] cursor-pointer ${
                    askLaterItems.length > 0
                      ? 'border-[#D4A017]/35 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
                      : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                      askLaterItems.length > 0
                        ? 'text-[#D4A017] fill-[#D4A017]'
                        : 'text-[#8B8275]'
                    }`}
                  />
                  {askLaterItems.length > 0 && (
                    <span className="font-['DM_Sans',sans-serif] text-[11px] tabular-nums font-medium text-[#3D3830]">
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
                  <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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

        {/* Mobile Companion Pace Strip (keeps mobile top bar clean & zero-overflow) */}
        {activePillar === 'companion' &&
          activeConversation &&
          (activeCompanionCard?.supports_listening_cue ??
            activeCompanionPersona?.supports_listening_cue ??
            true) && (
            <div className="md:hidden flex items-center justify-between gap-2 border-b border-[#3D3830]/10 bg-[#FAF7F2]/90 px-3 py-1.5">
              <span className="text-[11px] text-[#8B8275] whitespace-nowrap shrink-0">
                Tone right now
              </span>
              <div
                role="group"
                aria-label="Conversation pace"
                className="inline-flex items-center rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/85 p-0.5 shrink-0"
              >
                <button
                  type="button"
                  aria-pressed={
                    (activeConversation.companion_chat_mode || 'natural') === 'natural'
                  }
                  onClick={() => void handleToggleCompanionChatMode('natural')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    (activeConversation.companion_chat_mode || 'natural') === 'natural'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Natural
                </button>
                <button
                  type="button"
                  aria-pressed={activeConversation.companion_chat_mode === 'just_listen'}
                  onClick={() => void handleToggleCompanionChatMode('just_listen')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeConversation.companion_chat_mode === 'just_listen'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Just listen
                </button>
                <button
                  type="button"
                  aria-pressed={activeConversation.companion_chat_mode === 'help_think'}
                  onClick={() => void handleToggleCompanionChatMode('help_think')}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeConversation.companion_chat_mode === 'help_think'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Help me think
                </button>
              </div>
            </div>
          )}

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
            archetypeConfigs={chatbotConfig?.companion_archetypes}
            companionCatalog={companionCatalog}
            isPreviewMode={isPreviewMode}
            getAccessToken={getAccessToken}
            onSelectPastCompanion={(convId) => handleSelectSidebarConversation(convId)}
            onStartWithCompanion={handleStartWithCompanion}
            onStartPresetCompanion={handleStartPresetCompanion}
            onStartCustomBySlug={handleStartCustomBySlug}
            onCatalogLoaded={(cards) => setCompanionCatalog(cards)}
          />
        ) : (
          <MessageThread
            activePillar={activePillar}
            activeCompanionPersona={activeCompanionPersona}
            activeCompanionCard={activeCompanionCard}
            companionCatalog={companionCatalog}
            activeGuideUi={activeGuideUi}
            onOpenCompanionProfile={(card) => {
              if (card) {
                setProfileSheetCompanion(card);
              } else if (activeCompanionPersona) {
                setProfileSheetCompanion(
                  buildSheetCardFromPersona(activeCompanionPersona, activeCompanionCard)
                );
              }
            }}
            onReactToMessage={(msg, nextReaction) =>
              void handleReactToMessage(msg, nextReaction)
            }
            onSwitchToReferredCompanion={(slug, options) =>
              void handleSwitchToReferredCompanion(slug, options)
            }
            onSelectClarityPrompt={(prompt) => void handleSendMessage(prompt)}
            conversation={activeConversation}
            profile={activePillar === 'council' ? activeProfile : null}
            profiles={profiles}
            generalReadyMode={generalReadyMode}
            messages={messages}
            hasMoreMessages={hasMoreMessages}
            loadingEarlierMessages={loadingEarlierMessages}
            streamingText={streamingText}
            streamingStatus={streamingStatus}
            streamingTimingWidgets={streamingTimingWidgets}
            streamingTarotSpread={streamingTarotSpread}
            freshTarotMsgIds={freshTarotMsgIds}
            isStreaming={isStreaming}
            catalog={catalog}
            fontSize={chatFontSize}
            numericFont={
              userNumericFont === 'default'
                ? chatbotConfig?.chat_numeric_font || 'dm_sans'
                : userNumericFont
            }
            languageSlug={languageSlug}
            responseMode={responseMode}
            searchQuery={inChatQuery}
            activeMatchMessageId={activeMatchMessageId}
            pendingProfileConfirm={pendingProfileConfirm}
            inlineChartCreation={inlineChartCreation}
            onLoadEarlierMessages={() => void handleLoadEarlierMessages()}
            onReplyToMessage={(msg) => setReplyTarget(msg)}
            onToggleStar={handleToggleStar}
            onToggleExclude={handleToggleExclude}
            onDeleteMessage={handleDeleteMessage}
            onSelectFollowUp={(q) =>
              void handleSendMessage(q, undefined, undefined, { curatedStarter: true })
            }
            onSubmitSuggestion={handleSubmitSuggestion}
            onInsertSuggestion={handleInsertSuggestion}
            onInsertSuggestions={handleInsertSuggestions}
            onToggleAskLater={(item, tier, msgId) =>
              void handleToggleAskLater(item, tier, msgId)
            }
            onBookmarkSuggestions={(entries, msgId) =>
              void handleBookmarkSuggestions(entries, msgId)
            }
            onLoadMoreSuggestions={handleLoadMoreSuggestions}
            askLaterItems={askLaterItems}
            suggestionsDefaultExpanded={suggestionsDefaultExpanded}
            onSelectProfile={handleSelectProfileFromEmpty}
            onOpenAddChartModal={() => handleOpenAddChartModal()}
            onSelectGeneralChart={handleSelectGeneralChartFromEmpty}
            onConfirmPendingProfile={(draft) => void handleConfirmPendingProfile(draft)}
            onEditPendingProfile={(draft) => handleOpenAddChartModal(draft, true)}
            welcomeTitle={activeGuideUi?.welcome_title ?? chatbotConfig?.welcome_title}
            welcomeSubtitle={activeGuideUi?.welcome_subtitle ?? chatbotConfig?.welcome_subtitle}
            generalReadyMessage={
              activeGuideUi?.general_ready_message ?? chatbotConfig?.general_ready_message
            }
            enableListen={
              activeGuideUi?.features?.listen_tts ?? chatbotConfig?.features?.listen_tts ?? true
            }
            enableWhatsappShare={
              activeGuideUi?.features?.whatsapp_share ??
              chatbotConfig?.features?.whatsapp_share ??
              true
            }
            enableFollowups={
              activePillar === 'companion'
                ? (activeCompanionCard?.suggestions_enabled ?? true) &&
                  (activeGuideUi
                    ? activeGuideUi.suggestions_enabled &&
                      activeGuideUi.features?.followups !== false
                    : chatbotConfig?.features?.followups ?? true)
                : activeGuideUi
                ? activeGuideUi.suggestions_enabled && activeGuideUi.features?.followups !== false
                : activePillar === 'council' &&
                  (chatbotConfig?.features?.followups ?? true) &&
                  ((suggestionsConfig?.followups_enabled ?? true) ||
                    (suggestionsConfig?.deeper_analysis_enabled ?? true))
            }
            astrologyMode={astrologyMode}
            expertSlug={expertSlug}
            onChangeExpert={(nextExpert) => {
              const normalizedNext = normalizeCouncilSlug(nextExpert);
              seededExpertRef.current = true;
              setExpertSlug(normalizedNext);
              if (!isThreadLocked) {
                if (
                  normalizedNext === 'western_astrologer' ||
                  normalizedNext === 'modern_astrologer' ||
                  normalizedNext === 'hellenistic_astrologer'
                ) {
                  setAstrologyMode('western');
                } else if (
                  normalizedNext === DEFAULT_COUNCIL_EXPERT_SLUG ||
                  normalizedNext === 'kp_precision' ||
                  normalizedNext === 'jaimini'
                ) {
                  setAstrologyMode('vedic');
                }
                const nextLabel =
                  activeConversation || activeProfile || generalReadyMode
                    ? buildClientCouncilTitle(activeProfile, normalizedNext, catalog)
                    : resolveCouncilDisplayName(normalizedNext, catalog);
                setTabs((prev) =>
                  prev.map((t) =>
                    t.tabId === activeTabId &&
                    t.pillar === 'council' &&
                    !t.customLabel
                      ? { ...t, label: nextLabel, expertSlug: normalizedNext }
                      : t
                  )
                );
              }
            }}
            onSelectClarificationChip={(chip) => void handleSelectClarificationChip(chip)}
            onSelectPartnerProfileForClarification={(partnerId, originalQ) =>
              handleSelectPartnerProfileForClarification(partnerId, originalQ)
            }
            onContinueWithoutDetails={handleContinueWithoutDetails}
            onSaveToNotes={(msg) => void handleSaveMessageToNotes(msg)}
            savedNoteMsgIds={savedNoteMsgIds}
            savingNoteMsgId={savingNoteMsgId}
            onHandoffToCompanion={handleOpenHandoffFromCouncilMessage}
          />
        )}

        {/* Adaptive Multi-Thread Composer */}
        <ChatComposer
          activePillar={activePillar}
          activeCompanionPersona={activeCompanionPersona}
          activeCompanionCard={activeCompanionCard}
          onOpenCompanionProfile={
            activeCompanionPersona
              ? () =>
                  setProfileSheetCompanion(
                    buildSheetCardFromPersona(activeCompanionPersona, activeCompanionCard)
                  )
              : undefined
          }
          tabs={tabs}
          activeTabId={activeTabId}
          maxActiveTabs={MAX_ACTIVE_TABS}
          companionCatalog={companionCatalog}
          pastCompanionConversations={pastCompanionConversations}
          recentConversations={recentPinnableConversations}
          defaultAstrologyMode={defaultCouncilMode}
          isStreamingTabId={streamingTabId}
          composerDisabled={isCompanionSetupMode}
          composerDisabledHint={`Choose a ${COMPANION_LABEL_SINGULAR.toLowerCase()} above to begin talking...`}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onReorderTabs={handleReorderTabs}
          onRenameTab={handleRenameTab}
          onQuickAddTab={handleQuickAddTab}
          onReplaceTabWithCouncil={handleReplaceTabWithCouncil}
          onReplaceTabWithCompanionArchetype={handleReplaceTabWithCompanionArchetype}
          onReplaceTabWithPresetCompanion={handleReplaceTabWithPresetCompanion}
          onOpenCompanionsDirectory={() => handleOpenNewCompanionSetup(null)}
          onReplaceTabWithConversation={handleReplaceTabWithConversation}
          onReplaceTabWithClarity={handleReplaceTabWithClarity}
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
          languageSlug={languageSlug}
          useFullProfileMemory={effectiveMemory}
          responseMode={responseMode}
          replyTarget={replyTarget}
          activeFollowups={activeFollowups}
          customPrompts={customPrompts}
          isStreaming={isStreaming}
          isThreadLocked={isThreadLocked}
          isPreviewMode={isPreviewMode}
          getAccessToken={getAccessToken}
          onToggleMemory={handleToggleMemory}
          onChangeResponseMode={handleChangeResponseMode}
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
          onOpenMemoryInspector={() => setShowMemoryInspector(true)}
          onOpenAddChartModal={() => handleOpenAddChartModal()}
          onNewChat={handleNewChat}
          onSendMessage={(overrideText, composerOpts) =>
            void handleSendMessage(overrideText, undefined, undefined, composerOpts)
          }
          onStopGeneration={handleStopGeneration}
          pendingDirectiveLabel={pendingTechnicalDirective?.label || null}
          onClearPendingDirective={() => setPendingTechnicalDirective(null)}
          focusTrigger={composerFocusTrigger}
          composerPlaceholder={
            activeGuideUi?.composer_placeholder ?? chatbotConfig?.composer_placeholder
          }
          enableVoiceInput={
            activeGuideUi?.features?.voice_input ?? chatbotConfig?.features?.voice_input ?? true
          }
          enableAttachments={
            activeGuideUi?.features?.attachments ?? chatbotConfig?.features?.attachments ?? true
          }
          enableQuickTools={
            activeGuideUi?.features?.quick_tools ?? chatbotConfig?.features?.quick_tools ?? true
          }
          deepAudit={deepAudit}
          canUseDeepAudit={
            activePillar === 'council' &&
            Boolean(effectiveProfileId) &&
            expertSlug !== 'tarot_reader' &&
            expertSlug !== 'numerologist' &&
            expertSlug !== 'learn_astrology' &&
            activeConversation?.mode_type !== 'learn_astrology' &&
            activeConversation?.mode_type !== 'report_followup' &&
            attachments.length === 0
          }
          onToggleDeepAudit={() => setDeepAudit((prev) => !prev)}
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
        languageSlug={languageSlug}
        isThreadLocked={isThreadLocked}
        initialFontSize={chatFontSize}
        initialNumericFont={userNumericFont}
        platformNumericFont={chatbotConfig?.chat_numeric_font || 'dm_sans'}
        initialSuggestionsAutoExpand={suggestionsAutoExpand}
        getAccessToken={getAccessToken}
        onSwitchProfile={handleSwitchProfileBeforeStart}
        onChangeExpert={(nextExpert) => {
          seededExpertRef.current = true;
          setExpertSlug(nextExpert);
        }}
        onChangeLanguage={setLanguageSlug}
        onToggleMemory={handleToggleMemory}
        onOpenMemoryInspector={() => setShowMemoryInspector(true)}
        onSaved={(updated) => {
          setChatFontSize(updated.chatFontSize);
          setUserNumericFont(updated.chatNumericFont);
          setSuggestionsAutoExpand(updated.suggestionsAutoExpand);
          if (!isThreadLocked) {
            seededExpertRef.current = true;
            setExpertSlug(updated.defaultExpert);
            const updatedLabel =
              updated.defaultAstrologyMode === 'western'
                ? 'Western Astrologer'
                : 'Vedic Astrologer';
            setTabs((prev) =>
              prev.map((t) =>
                t.tabId === activeTabId &&
                t.pillar === 'council' &&
                !t.conversationId &&
                !t.customLabel
                  ? { ...t, label: updatedLabel, expertSlug: updated.defaultExpert }
                  : t
              )
            );
          }
          setLanguageSlug(updated.defaultLanguage);
          if (!isPreviewMode) {
            void refreshUser();
          }
        }}
        onClose={() => setShowChatSettings(false)}
      />

      {/* User-Facing Living Context & Companion Memory Inspector */}
      <LifeContextModal
        isOpen={showMemoryInspector}
        profileId={null}
        profileName={getUserProfileDisplayLabel(appUser)}
        mode="user_memory"
        initialTab="memory"
        getAccessToken={getAccessToken}
        isPreviewMode={isPreviewMode}
        onClose={() => setShowMemoryInspector(false)}
        onPreferencesUpdated={() => {
          if (!isPreviewMode) {
            void refreshUser();
          }
        }}
        onSaved={() => {}}
      />

      {/* Companion Profile Sheet */}
      <CompanionProfileSheet
        companion={profileSheetCompanion}
        isOpen={Boolean(profileSheetCompanion)}
        onClose={() => setProfileSheetCompanion(null)}
        onStartChat={(card, opts) => {
          setProfileSheetCompanion(null);
          if (companionCatalog.some((c) => c.slug === card.slug)) {
            void handleStartPresetCompanion(card, opts);
          } else if (activeCompanionPersona) {
            void handleStartCustomBySlug(card.slug, activeCompanionPersona, opts);
          }
        }}
      />

      {/* Council Reading -> Companion Handoff Modal */}
      <CouncilToCompanionModal
        isOpen={Boolean(handoffSource)}
        source={handoffSource}
        companions={companionCatalog}
        submittingSlug={handoffSubmittingSlug}
        onClose={() => {
          if (!handoffSubmittingSlug) setHandoffSource(null);
        }}
        onConfirm={handleConfirmCouncilHandoff}
      />

      {/* Shared Council Reading Notes Viewer */}
      <SharedReadingNotesModal
        isOpen={showSharedReadingNotesModal}
        notes={sharedReadingNotes}
        deletingId={deletingReadingNoteId}
        onDeleteNote={handleDeleteSharedReadingNote}
        onClose={() => setShowSharedReadingNotesModal(false)}
      />
    </div>
  );
};

export default ChatWorkspace;
