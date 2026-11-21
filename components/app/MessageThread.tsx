import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Plus,
  Reply,
  Sparkles,
  Star,
  Trash2,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AskLaterItem,
  ChatCatalog,
  ChatMessageRecord,
  ChatPillar,
  ChatProfile,
  ClarificationChip,
  CompanionPersona,
  ConversationRecord,
  PendingBirthProfileDraft,
  SuggestionItem,
} from './chatTypes';
import type { ChatFontSize } from './ChatSettingsModal';
import Tooltip from './Tooltip';
import SuggestionsPanel from './SuggestionsPanel';
import { ChartCreationProgress } from './BirthChartModal';
import {
  getWhatsAppShareUrl,
  isSpeechSynthesisSupported,
  speakMessageText,
  stopSpeaking,
} from './chatUtilities';

export interface InlineChartCreationState {
  status: 'creating' | 'success' | 'error';
  name: string;
  draft: PendingBirthProfileDraft;
  errorMessage?: string;
}

interface MessageThreadProps {
  activePillar?: ChatPillar;
  activeCompanionPersona?: CompanionPersona | null;
  onSelectClarityPrompt?: (prompt: string) => void;
  conversation: ConversationRecord | null;
  profile: ChatProfile | null;
  profiles: ChatProfile[];
  generalReadyMode: boolean;
  messages: ChatMessageRecord[];
  hasMoreMessages?: boolean;
  loadingEarlierMessages?: boolean;
  streamingText: string;
  isStreaming: boolean;
  catalog: ChatCatalog | null;
  fontSize?: ChatFontSize;
  languageSlug?: string;
  searchQuery?: string;
  activeMatchMessageId?: string | null;
  pendingProfileConfirm?: { messageId: string; draft: PendingBirthProfileDraft } | null;
  inlineChartCreation?: InlineChartCreationState | null;
  onLoadEarlierMessages?: () => void;
  onReplyToMessage: (message: ChatMessageRecord) => void;
  onToggleStar: (message: ChatMessageRecord) => void;
  onToggleExclude: (message: ChatMessageRecord) => void;
  onDeleteMessage: (messageId: string) => void;
  onSelectFollowUp: (question: string) => void;
  onSubmitSuggestion?: (item: SuggestionItem) => void;
  onInsertSuggestion?: (item: SuggestionItem) => void;
  onInsertSuggestions?: (items: SuggestionItem[]) => void;
  onToggleAskLater?: (
    item: SuggestionItem,
    tier: 'followup' | 'deeper_analysis',
    messageId: string
  ) => void;
  onBookmarkSuggestions?: (
    entries: Array<{ item: SuggestionItem; tier: 'followup' | 'deeper_analysis' }>,
    messageId: string
  ) => void;
  onLoadMoreSuggestions?: (messageId: string) => Promise<void> | void;
  askLaterItems?: AskLaterItem[];
  suggestionsDefaultExpanded?: boolean;
  onSelectProfile: (profileId: string) => void;
  onOpenAddChartModal: () => void;
  onSelectGeneralChart: () => void;
  onConfirmPendingProfile: (draft: PendingBirthProfileDraft) => void;
  onEditPendingProfile: (draft: PendingBirthProfileDraft) => void;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  generalReadyMessage?: string;
  enableListen?: boolean;
  enableWhatsappShare?: boolean;
  enableFollowups?: boolean;
  astrologyMode?: 'vedic' | 'western';
  expertSlug?: string;
  onSelectClarificationChip?: (chip: ClarificationChip, messageId: string) => void;
  onSelectPartnerProfileForClarification?: (partnerId: string, originalQuestion: string) => void;
  onSaveToNotes?: (message: ChatMessageRecord) => void;
  savedNoteMsgIds?: Set<string>;
  savingNoteMsgId?: string | null;
}

const escapeRegExp = (str: string) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightString = (text: string, query: string): React.ReactNode => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  const lower = trimmed.toLowerCase();
  return parts.map((part, idx) =>
    part.toLowerCase() === lower ? (
      <mark
        key={idx}
        className="rounded bg-[#B8965A]/30 px-0.5 text-[#3D3830]"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
};

const highlightNodes = (children: React.ReactNode, query: string): React.ReactNode => {
  if (!query.trim()) return children;
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return highlightString(child, query);
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        ...child.props,
        children: highlightNodes(child.props.children, query),
      });
    }
    return child;
  });
};

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const getOwnChartButtonLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim() || p.name.trim().split(/\s+/)[0] || p.name;
  return `Your Chart (${short})`;
};

const formatReadableDate = (isoDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${day} ${months[monthIdx]} ${match[1]}`;
};

const format12HourTime = (hhmm: string): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/** Brand-matched monochrome WhatsApp outline icon (warm umber/brass, zero neon green) */
const WhatsAppOutlineIcon: React.FC<{ className?: string }> = ({ className = 'h-3.5 w-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <path d="M9.5 9.2c.2-.4.4-.4.6-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.1.1-.1.3 0 .5.4.8 1.2 1.5 2 1.9.2.1.4.1.5 0l.6-.5c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3-.2.6-.6.8-.5.2-1.2.3-2.1 0-1.1-.3-2.4-1.1-3.4-2.1-1-1-1.8-2.3-2.1-3.4-.2-.9-.1-1.6.1-2.1z" />
  </svg>
);

const FONT_SIZE_STYLES: Record<
  ChatFontSize,
  {
    body: string;
    h1: string;
    h2: string;
    h3: string;
  }
> = {
  sm: {
    body: 'text-[13px] leading-[1.66]',
    h1: 'text-xl',
    h2: 'text-lg',
    h3: 'text-base',
  },
  base: {
    body: 'text-sm leading-[1.74]',
    h1: 'text-2xl',
    h2: 'text-xl',
    h3: 'text-lg',
  },
  lg: {
    body: 'text-[15.5px] leading-[1.78]',
    h1: 'text-[26px]',
    h2: 'text-[22px]',
    h3: 'text-xl',
  },
};

const CLARITY_STARTERS = [
  {
    title: 'Explain a Jyotish concept simply',
    prompt: 'Explain Mahadasha and Antardasha in plain, everyday English without jargon.',
  },
  {
    title: 'Craft a sharper Council question',
    prompt: 'Help me turn a vague worry about my career direction into a focused question I can ask the Council.',
  },
  {
    title: 'Think through a tough decision',
    prompt: 'Help me untangle a practical life decision calmly, step by step.',
  },
];

const MessageThread: React.FC<MessageThreadProps> = ({
  activePillar = 'council',
  activeCompanionPersona = null,
  onSelectClarityPrompt,
  conversation,
  profile,
  profiles,
  generalReadyMode,
  messages,
  hasMoreMessages = false,
  loadingEarlierMessages = false,
  streamingText,
  isStreaming,
  fontSize = 'base',
  languageSlug = 'English',
  searchQuery = '',
  activeMatchMessageId = null,
  pendingProfileConfirm = null,
  inlineChartCreation = null,
  onLoadEarlierMessages,
  onReplyToMessage,
  onToggleStar,
  onToggleExclude,
  onDeleteMessage,
  onSelectFollowUp,
  onSubmitSuggestion,
  onInsertSuggestion,
  onInsertSuggestions,
  onToggleAskLater,
  onBookmarkSuggestions,
  onLoadMoreSuggestions,
  askLaterItems = [],
  suggestionsDefaultExpanded = true,
  onSelectProfile,
  onOpenAddChartModal,
  onSelectGeneralChart,
  onConfirmPendingProfile,
  onEditPendingProfile,
  welcomeTitle = "I'm ready",
  welcomeSubtitle = '',
  generalReadyMessage = "Great, I'm ready to answer any question you may have regarding Vedic Astrology.",
  enableListen = true,
  enableWhatsappShare = true,
  enableFollowups = true,
  astrologyMode = 'vedic',
  expertSlug = 'council_synthesis',
  onSelectClarificationChip,
  onSelectPartnerProfileForClarification,
  onSaveToNotes,
  savedNoteMsgIds,
  savingNoteMsgId = null,
}) => {
  const isWesternSystem =
    expertSlug === 'western_astrologer' ||
    expertSlug === 'modern_astrologer' ||
    (astrologyMode === 'western' &&
      expertSlug !== 'council_synthesis' &&
      expertSlug !== 'tarot_reader' &&
      expertSlug !== 'numerologist');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [activeUserMsgId, setActiveUserMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showInlineChartPicker, setShowInlineChartPicker] = useState(false);

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isScrollingActive, setIsScrollingActive] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const isScrollHoveredRef = useRef(false);
  const didHoldScrollRef = useRef(false);

  const speechSupported = useMemo(() => isSpeechSynthesisSupported(), []);
  const sizeTokens = FONT_SIZE_STYLES[fontSize] || FONT_SIZE_STYLES.base;

  const defaultOwnProfile = useMemo(
    () => profiles.find((p) => p.is_default) || null,
    [profiles]
  );

  // Stop active voice playback when switching threads or unmounting
  useEffect(() => {
    stopSpeaking();
    setSpeakingMsgId(null);
    setShowInlineChartPicker(false);
    setActiveUserMsgId(null);
  }, [conversation?.id]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Dismiss tapped user bubble actions on outside click
  useEffect(() => {
    if (!activeUserMsgId) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(`[data-user-bubble="${activeUserMsgId}"]`)) return;
      setActiveUserMsgId(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeUserMsgId]);

  const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msgId ? null : prev));
      }, 1800);
    } catch {
      // Clipboard denied silently
    }
  }, []);

  const handleToggleListen = useCallback(
    (msg: ChatMessageRecord) => {
      if (speakingMsgId === msg.id) {
        stopSpeaking();
        setSpeakingMsgId(null);
        return;
      }
      const started = speakMessageText(msg.content, msg.language_used || languageSlug, {
        onEnd: () => setSpeakingMsgId((prev) => (prev === msg.id ? null : prev)),
        onError: () => setSpeakingMsgId((prev) => (prev === msg.id ? null : prev)),
      });
      if (started) {
        setSpeakingMsgId(msg.id);
      }
    },
    [languageSlug, speakingMsgId]
  );

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 24;
    setIsScrollable(overflow);
    setCanScrollUp(el.scrollTop > 32);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 32);
  }, []);

  const scheduleHideScrollControls = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
    scrollIdleTimerRef.current = window.setTimeout(() => {
      if (
        !isScrollHoveredRef.current &&
        holdTimerRef.current === null &&
        holdRafRef.current === null
      ) {
        setIsScrollingActive(false);
      }
    }, 1400);
  }, []);

  const handleThreadScroll = useCallback(() => {
    updateScrollState();
    setIsScrollingActive(true);
    scheduleHideScrollControls();
  }, [updateScrollState, scheduleHideScrollControls]);

  useEffect(() => {
    updateScrollState();
  }, [
    messages.length,
    streamingText,
    conversation?.id,
    pendingProfileConfirm?.messageId,
    inlineChartCreation?.status,
    updateScrollState,
  ]);

  // Smoothly scroll to bottom when inline chart creation or confirmation card appears
  useEffect(() => {
    if (pendingProfileConfirm || inlineChartCreation) {
      const el = scrollContainerRef.current;
      if (el) {
        window.setTimeout(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 80);
      }
    }
  }, [pendingProfileConfirm, inlineChartCreation]);

  const stopHoldScroll = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    scheduleHideScrollControls();
  }, [scheduleHideScrollControls]);

  useEffect(() => {
    return () => {
      stopHoldScroll();
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, [stopHoldScroll]);

  const startHoldScroll = (direction: 'up' | 'down') => {
    stopHoldScroll();
    setIsScrollingActive(true);
    didHoldScrollRef.current = false;

    holdTimerRef.current = window.setTimeout(() => {
      didHoldScrollRef.current = true;
      const step = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTop += direction === 'up' ? -9 : 9;
        updateScrollState();
        holdRafRef.current = window.requestAnimationFrame(step);
      };
      holdRafRef.current = window.requestAnimationFrame(step);
    }, 180);
  };

  const handleScrollTap = (direction: 'up' | 'down') => {
    const wasHold = didHoldScrollRef.current;
    stopHoldScroll();
    didHoldScrollRef.current = false;
    if (wasHold) return;

    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: direction === 'up' ? 0 : el.scrollHeight,
      behavior: 'smooth',
    });
  };

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessageRecord>();
    for (const m of messages) {
      map.set(m.id, m);
    }
    return map;
  }, [messages]);

  const latestAssistantWithFollowups = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const hasStructured =
        (Array.isArray(m.suggestions_json?.followups) && m.suggestions_json!.followups.length > 0) ||
        (Array.isArray(m.suggestions_json?.deeper_analysis) &&
          m.suggestions_json!.deeper_analysis.length > 0);
      const hasLegacy = Array.isArray(m.followups_json) && m.followups_json.length > 0;
      if (hasStructured || hasLegacy) {
        return m;
      }
    }
    return null;
  }, [messages]);

  const profileLabel = profile ? getProfileDisplayLabel(profile) : null;

  const handleAddChartButtonClick = () => {
    if (profiles.length === 0) {
      onOpenAddChartModal();
      return;
    }
    setShowInlineChartPicker((prev) => !prev);
  };

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h2 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h1} font-medium text-[#3D3830] pt-2`}>
          {highlightNodes(children, searchQuery)}
        </h2>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h3 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h2} font-medium text-[#3D3830] pt-2`}>
          {highlightNodes(children, searchQuery)}
        </h3>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h4 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h3} font-medium text-[#3D3830] pt-1`}>
          {highlightNodes(children, searchQuery)}
        </h4>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className={`${sizeTokens.body} text-[#3D3830]`}>
          {highlightNodes(children, searchQuery)}
        </p>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className={`list-disc pl-5 space-y-1.5 ${sizeTokens.body} text-[#3D3830]`}>
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className={`list-decimal pl-5 space-y-1.5 ${sizeTokens.body} text-[#3D3830]`}>
          {children}
        </ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="leading-[1.68]">{highlightNodes(children, searchQuery)}</li>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold text-[#3D3830]">
          {highlightNodes(children, searchQuery)}
        </strong>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className={`border-l-2 border-[#8B7355] pl-4 py-1 ${sizeTokens.body} text-[#5C5449] italic`}>
          {highlightNodes(children, searchQuery)}
        </blockquote>
      ),
      code: ({ children }: { children?: React.ReactNode }) => (
        <code className="font-['DM_Sans',sans-serif] text-xs bg-[#F1ECE3] px-1.5 py-0.5 rounded text-[#3D3830]">
          {children}
        </code>
      ),
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="overflow-x-auto my-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7]">
          <table className="w-full text-xs text-left border-collapse">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="bg-[#F1ECE3] text-[#3D3830]">{children}</thead>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="px-3.5 py-2 font-medium border-b border-[#3D3830]/12">
          {highlightNodes(children, searchQuery)}
        </th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="px-3.5 py-2 border-b border-[#3D3830]/8 text-[#5C5449]">
          {highlightNodes(children, searchQuery)}
        </td>
      ),
    }),
    [searchQuery, sizeTokens]
  );

  // Minimal Calm Empty State for New Chat
  if (messages.length === 0 && !isStreaming && !inlineChartCreation) {
    if (activePillar === 'clarity') {
      return (
        <div
          key={conversation?.id || 'empty-clarity'}
          className="animate-cc-tab-panel flex-1 min-h-0 overflow-y-auto px-5 md:px-8 pt-8 pb-36 sm:pb-40 flex flex-col items-center"
        >
          <div className="w-full max-w-lg my-auto flex flex-col items-center text-center space-y-6">
            <div className="space-y-2.5">
              <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/10 text-[#B8965A]">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h2 className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight">
                Clarity
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5449] max-w-md mx-auto leading-relaxed">
                Your off-record sidekick for quick doubts, prompt drafting, and everyday questions — kept completely separate from your birth chart memory.
              </p>
            </div>

            <div className="w-full space-y-2 text-left">
              {CLARITY_STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => onSelectClarityPrompt?.(starter.prompt)}
                  className="group w-full flex items-center justify-between gap-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-4 py-3 text-left hover:border-[#3D3830]/28 hover:bg-[#F1ECE3]/55 transition-all cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#3D3830]">{starter.title}</p>
                    <p className="text-[11px] text-[#8B8275] truncate mt-0.5">{starter.prompt}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[#8B8275] group-hover:text-[#3D3830] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={conversation?.id || 'empty'}
        className="animate-cc-tab-panel flex-1 min-h-0 overflow-y-auto px-5 md:px-8 pt-8 pb-36 sm:pb-40 flex flex-col items-center"
      >
        <div className="w-full max-w-xl my-auto flex flex-col items-center text-center space-y-6">
          {generalReadyMode && !profile ? (
            <div className="w-full max-w-lg space-y-5">
              <div className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] px-6 py-6 text-left shadow-xs">
                <p className={`${sizeTokens.body} text-[#3D3830]`}>
                  {isWesternSystem &&
                  (!generalReadyMessage ||
                    generalReadyMessage ===
                      "Great, I'm ready to answer any question you may have regarding Vedic Astrology.")
                    ? "Great, I'm ready to answer any question you may have regarding Western Astrology."
                    : generalReadyMessage ||
                      "Great, I'm ready to answer any question you may have regarding Vedic Astrology."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {defaultOwnProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineChartPicker(false);
                      onSelectProfile(defaultOwnProfile.id);
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span>{getOwnChartButtonLabel(defaultOwnProfile)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddChartButtonClick}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>{profiles.length === 0 ? 'Add Birth Details' : 'Add Chart'}</span>
                </button>
              </div>
            </div>
          ) : profile ? (
            <div className="space-y-4">
              <p className="text-xs text-[#8B8275]">
                {profileLabel} · {formatReadableDate(profile.birth_date)} · {profile.birth_city}
              </p>
              <h2 className="font-['Cormorant_Garamond',serif] text-4xl sm:text-[42px] font-medium text-[#3D3830] tracking-tight">
                {welcomeTitle || "I'm ready"}
              </h2>
              {welcomeSubtitle && (
                <p className="text-sm text-[#5C5449] max-w-md mx-auto leading-relaxed">
                  {welcomeSubtitle}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleAddChartButtonClick}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <span>Switch Chart</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineChartPicker(false);
                    onSelectGeneralChart();
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <span>General Chart</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 w-full">
              <div className="space-y-2">
                <h2 className="font-['Cormorant_Garamond',serif] text-4xl sm:text-[44px] font-medium text-[#3D3830] tracking-tight">
                  {welcomeTitle || "I'm ready"}
                </h2>
                {welcomeSubtitle && (
                  <p className="text-sm text-[#5C5449] max-w-md mx-auto leading-relaxed">
                    {welcomeSubtitle}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {defaultOwnProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineChartPicker(false);
                      onSelectProfile(defaultOwnProfile.id);
                    }}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span>{getOwnChartButtonLabel(defaultOwnProfile)}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddChartButtonClick}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium active:scale-[0.98] transition-all cursor-pointer ${
                    !defaultOwnProfile
                      ? 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                      : 'border border-[#3D3830]/18 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
                  }`}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Add Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowInlineChartPicker(false);
                    onSelectGeneralChart();
                  }}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-6 py-2.5 text-sm font-medium text-[#3D3830] hover:bg-[#F1ECE3] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-[#8B7355] shrink-0" />
                  <span>General Chart</span>
                </button>
              </div>
            </div>
          )}

          {/* Inline Saved Charts Picker (expands cleanly when clicking Add Chart and saved profiles exist) */}
          {showInlineChartPicker && profiles.length > 0 && (
            <div className="animate-cc-dropdown-down w-full max-w-md rounded-2xl border border-[#3D3830]/14 bg-[#FDFBF7] shadow-sm p-2.5 text-left space-y-1.5">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#8B8275]">
                  Choose a Saved Chart
                </span>
                <button
                  type="button"
                  onClick={() => setShowInlineChartPicker(false)}
                  className="text-[11px] text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1">
                {profiles.map((p) => {
                  const isSelected = profile?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setShowInlineChartPicker(false);
                        onSelectProfile(p.id);
                      }}
                      className={`w-full min-h-[44px] flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#F1ECE3] text-[#3D3830]'
                          : 'hover:bg-[#F1ECE3]/75 text-[#3D3830]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#3D3830] truncate">
                          {getProfileDisplayLabel(p)}
                        </p>
                        <p className="text-[11px] text-[#8B8275] truncate">
                          {formatReadableDate(p.birth_date)} · {p.birth_city}
                          {p.birth_country ? `, ${p.birth_country}` : ''}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-[#2D6A4F] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[#3D3830]/10 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineChartPicker(false);
                    onOpenAddChartModal();
                  }}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Birth Details</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleThreadScroll}
        key={conversation?.id || 'thread'}
        className="animate-cc-tab-panel flex-1 overflow-y-auto px-5 md:px-8 pt-6 pb-36 sm:pb-40"
      >
        <div className="mx-auto max-w-2xl space-y-7">
          {/* Quiet Companion Identity Strip at top of Companion conversations */}
          {activePillar === 'companion' && activeCompanionPersona && (
            <div className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] px-5 py-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-[#EAE3D7] border border-[#3D3830]/10 flex items-center justify-center font-serif text-lg font-semibold text-[#3D3830]">
                  {activeCompanionPersona.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-serif text-lg font-semibold text-[#3D3830] truncate">
                      {activeCompanionPersona.name}
                    </h3>
                    <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
                      {activeCompanionPersona.age}
                    </span>
                  </div>
                  <p className="text-xs text-[#5C5449] truncate">
                    {activeCompanionPersona.role_label} · {activeCompanionPersona.background}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#5C5449] leading-relaxed">
                {activeCompanionPersona.bio}
              </p>
            </div>
          )}

          {hasMoreMessages && onLoadEarlierMessages && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={loadingEarlierMessages}
                onClick={onLoadEarlierMessages}
                className="rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-1.5 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors disabled:opacity-50"
              >
                {loadingEarlierMessages ? 'Loading earlier messages...' : 'Load earlier messages'}
              </button>
            </div>
          )}

          {messages.map((msg, idx) => {
            const parentMsg = msg.parent_message_id
              ? messageMap.get(msg.parent_message_id)
              : null;
            const isUser = msg.role === 'user';
            const isLatestFollowupHolder =
              latestAssistantWithFollowups?.id === msg.id &&
              !isStreaming &&
              !pendingProfileConfirm &&
              !inlineChartCreation;
            const isActiveMatch = activeMatchMessageId === msg.id;
            const isCopied = copiedMsgId === msg.id;

            if (isUser) {
              const showUserActions =
                activeUserMsgId === msg.id ||
                confirmDeleteMsgId === msg.id ||
                isCopied;

              return (
                <div
                  key={msg.id}
                  data-msg-id={msg.id}
                  data-user-bubble={msg.id}
                  className={`group animate-cc-message-in flex flex-col items-end space-y-1 transition-all ${
                    msg.excluded_from_context ? 'opacity-50' : ''
                  } ${
                    isActiveMatch
                      ? 'ring-1 ring-[#B8965A]/70 bg-[#B8965A]/[0.05] rounded-2xl p-2 -mx-2'
                      : ''
                  }`}
                >
                  {parentMsg && parentMsg.role === 'assistant' && (
                    <div className="max-w-[85%] rounded-xl border-l-2 border-[#8B7355] bg-[#F1ECE3]/70 px-3 py-1.5 text-[11px] text-[#5C5449]">
                      <span className="font-medium text-[#3D3830]">Replying to insight: </span>
                      <span className="line-clamp-2">{parentMsg.content}</span>
                    </div>
                  )}

                  <div
                    onClick={() =>
                      setActiveUserMsgId((prev) => (prev === msg.id ? null : msg.id))
                    }
                    className={`max-w-[85%] rounded-3xl rounded-tr-md bg-[#F1ECE3] border border-[#3D3830]/10 px-5 py-3.5 ${sizeTokens.body} text-[#3D3830] whitespace-pre-wrap cursor-pointer`}
                  >
                    {highlightString(msg.content, searchQuery)}
                  </div>

                  {/* Hover / Single-Tap Revealed Icon-Only Controls */}
                  <div className="flex items-center gap-2 px-1 min-h-[28px]">
                    {msg.excluded_from_context && (
                      <span className="text-[11px] text-[#7A3E36]">
                        Excluded from context
                      </span>
                    )}

                    <div
                      className={`flex items-center gap-1 text-[#8B8275] transition-opacity duration-150 ${
                        showUserActions
                          ? 'opacity-100 pointer-events-auto'
                          : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto'
                      }`}
                    >
                      <Tooltip content={isCopied ? 'Copied' : 'Copy'} placement="top">
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(msg.id, msg.content)}
                          aria-label={isCopied ? 'Copied' : 'Copy message'}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
                            isCopied ? 'text-[#2D6A4F]' : 'hover:text-[#3D3830]'
                          }`}
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </Tooltip>

                      <Tooltip
                        content={msg.excluded_from_context ? 'Include' : 'Exclude'}
                        placement="top"
                      >
                        <button
                          type="button"
                          onClick={() => onToggleExclude(msg)}
                          aria-label={
                            msg.excluded_from_context
                              ? 'Include message in context'
                              : 'Exclude message from context'
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                        >
                          {msg.excluded_from_context ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </Tooltip>

                      {confirmDeleteMsgId === msg.id ? (
                        <span className="inline-flex items-center gap-1.5 pl-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteMessage(msg.id);
                              setConfirmDeleteMsgId(null);
                              setActiveUserMsgId(null);
                            }}
                            className="text-[#7A3E36] font-medium hover:underline cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMsgId(null)}
                            className="text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <Tooltip content="Delete" placement="top">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMsgId(msg.id)}
                            aria-label="Delete message"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#7A3E36] transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant Editorial Prose Card
            const isSpeaking = speakingMsgId === msg.id;
            const showConfirmCard =
              activePillar === 'council' &&
              pendingProfileConfirm?.messageId === msg.id &&
              !inlineChartCreation;
            const clarificationData =
              activePillar === 'council' ? msg.suggestions_json?.clarification || null : null;
            const isActiveClarificationCard =
              Boolean(clarificationData && clarificationData.chips?.length) &&
              idx === messages.length - 1 &&
              !isStreaming;
            const availablePartnerProfiles =
              clarificationData?.kind === 'partner_required'
                ? profiles.filter((p) => p.id !== profile?.id).slice(0, 3)
                : [];

            return (
              <article
                key={msg.id}
                data-msg-id={msg.id}
                className={`animate-cc-message-in space-y-3 border-b border-[#3D3830]/10 pb-6 transition-all ${
                  msg.excluded_from_context ? 'opacity-50' : ''
                } ${
                  isActiveMatch
                    ? 'ring-1 ring-[#B8965A]/70 bg-[#B8965A]/[0.05] rounded-2xl p-3 -mx-3'
                    : ''
                }`}
              >
                {activePillar === 'companion' && activeCompanionPersona && (
                  <p className="text-[11px] font-semibold text-[#5C5449]">
                    {activeCompanionPersona.name}
                  </p>
                )}
                {activePillar === 'clarity' && (
                  <p className="text-[11px] font-medium text-[#8B8275]">Clarity</p>
                )}
                {activePillar === 'council' && msg.expert_used && (
                  <p className="text-[11px] font-medium text-[#8B8275]">
                    {msg.expert_used === 'western_astrologer'
                      ? 'Western Astrologer (Western)'
                      : msg.expert_used === 'modern_astrologer'
                      ? 'Modern Astrologer (Western)'
                      : msg.expert_used === 'tarot_reader'
                      ? 'Tarot'
                      : msg.expert_used === 'numerologist'
                      ? 'Numerology'
                      : 'Vedic Astrologer (Vedic)'}
                  </p>
                )}

                <div className={`space-y-3 ${sizeTokens.body} text-[#3D3830]`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Phase 3: One-Tap Birth Details Confirmation Card */}
                {showConfirmCard && pendingProfileConfirm && (
                  <div className="mt-4 rounded-2xl border border-[#B8965A]/35 bg-[#FDFBF7] p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
                        Confirm Birth Details
                      </span>
                      <span className="text-[11px] text-[#8B8275]">
                        Saved once permanently
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-wider text-[#8B8275]">
                          Name
                        </span>
                        <span className="font-medium text-[#3D3830] mt-0.5 block">
                          {pendingProfileConfirm.draft.name}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-wider text-[#8B8275]">
                          Date of Birth
                        </span>
                        <span className="font-medium text-[#3D3830] mt-0.5 block">
                          {formatReadableDate(pendingProfileConfirm.draft.birth_date)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-wider text-[#8B8275]">
                          Time of Birth
                        </span>
                        <span className="font-medium text-[#3D3830] mt-0.5 block">
                          {pendingProfileConfirm.draft.birth_time_display ||
                            format12HourTime(pendingProfileConfirm.draft.birth_time)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-wider text-[#8B8275]">
                          Place of Birth
                        </span>
                        <span className="font-medium text-[#3D3830] mt-0.5 block">
                          {pendingProfileConfirm.draft.place_query}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onConfirmPendingProfile(pendingProfileConfirm.draft)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs sm:text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Yes, Create Chart</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditPendingProfile(pendingProfileConfirm.draft)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-5 py-2 text-xs sm:text-sm font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <span>Edit Details</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Sutradhara Stage 1 Interactive Clarification Chips */}
                {clarificationData && clarificationData.chips?.length > 0 && (
                  <div
                    className={`mt-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3.5 sm:p-4 space-y-2.5 transition-opacity ${
                      isActiveClarificationCard ? 'opacity-100' : 'opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8B8275]">
                        {clarificationData.kind === 'partner_required'
                          ? 'Partner Chart Needed'
                          : 'Quick Context Check'}
                      </span>
                      {!isActiveClarificationCard && (
                        <span className="text-[11px] text-[#8B8275]">Answered</span>
                      )}
                    </div>

                    {isActiveClarificationCard && availablePartnerProfiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {availablePartnerProfiles.map((partner) => (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() =>
                              onSelectPartnerProfileForClarification?.(
                                partner.id,
                                clarificationData.chips[0]?.clarifiedQuestion || ''
                              )
                            }
                            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-[#B8965A]/45 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5 text-[#8B7355]" />
                            <span>Compare with {partner.short_name || partner.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {clarificationData.chips.map((chip) => {
                        const isPrimaryAction = chip.action === 'open_partner_picker';
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            disabled={!isActiveClarificationCard || !onSelectClarificationChip}
                            onClick={() => onSelectClarificationChip?.(chip, msg.id)}
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                              isPrimaryAction
                                ? 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                                : 'border border-[#3D3830]/18 bg-[#FAF7F2] text-[#3D3830] hover:bg-[#F1ECE3]'
                            } disabled:opacity-60 disabled:cursor-default cursor-pointer`}
                          >
                            <span>{chip.label}</span>
                            {isActiveClarificationCard && (
                              <ArrowRight className="h-3 w-3 opacity-70" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Clean Icon-Only Assistant Action Bar (No metadata string clutter) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[#8B8275]">
                  <div className="flex items-center gap-2">
                    {msg.excluded_from_context && (
                      <span className="text-[11px] text-[#7A3E36]">
                        Excluded from context
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Tooltip content={isCopied ? 'Copied' : 'Copy'} placement="top">
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(msg.id, msg.content)}
                        aria-label={isCopied ? 'Copied' : 'Copy response'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
                          isCopied ? 'text-[#2D6A4F]' : 'hover:text-[#3D3830]'
                        }`}
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </Tooltip>

                    {enableListen && speechSupported && (
                      <Tooltip
                        content={isSpeaking ? 'Stop reading' : 'Listen'}
                        placement="top"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleListen(msg)}
                          aria-label={isSpeaking ? 'Stop reading aloud' : 'Listen to response'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
                            isSpeaking
                              ? 'bg-[#F1ECE3] text-[#8B7355]'
                              : 'hover:text-[#3D3830]'
                          }`}
                        >
                          {isSpeaking ? (
                            <VolumeX className="h-3.5 w-3.5 animate-pulse" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </Tooltip>
                    )}

                    {enableWhatsappShare && (
                      <Tooltip content="Share on WhatsApp" placement="top">
                        <a
                          href={getWhatsAppShareUrl(msg.content)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on WhatsApp"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                        >
                          <WhatsAppOutlineIcon className="h-3.5 w-3.5" />
                        </a>
                      </Tooltip>
                    )}

                    {onSaveToNotes && (
                      <Tooltip
                        content={
                          savedNoteMsgIds?.has(msg.id)
                            ? 'Saved to Notes'
                            : 'Save to Notes'
                        }
                        placement="top"
                      >
                        <button
                          type="button"
                          disabled={savingNoteMsgId === msg.id}
                          onClick={() => onSaveToNotes(msg)}
                          aria-label={
                            savedNoteMsgIds?.has(msg.id)
                              ? 'Saved to Notes'
                              : 'Save insight to Notes'
                          }
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer disabled:opacity-50 ${
                            savedNoteMsgIds?.has(msg.id)
                              ? 'text-[#2D6A4F]'
                              : 'hover:text-[#3D3830]'
                          }`}
                        >
                          {savingNoteMsgId === msg.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bookmark
                              className={`h-3.5 w-3.5 ${
                                savedNoteMsgIds?.has(msg.id) ? 'fill-current' : ''
                              }`}
                            />
                          )}
                        </button>
                      </Tooltip>
                    )}

                    <Tooltip
                      content={msg.is_starred ? 'Unstar' : 'Star'}
                      placement="top"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleStar(msg)}
                        aria-label={msg.is_starred ? 'Unstar response' : 'Star response'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
                          msg.is_starred ? 'text-[#8B7355]' : 'hover:text-[#3D3830]'
                        }`}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${msg.is_starred ? 'fill-current' : ''}`}
                        />
                      </button>
                    </Tooltip>

                    <Tooltip content="Reply" placement="top">
                      <button
                        type="button"
                        onClick={() => onReplyToMessage(msg)}
                        aria-label="Reply to response"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>

                    <Tooltip
                      content={msg.excluded_from_context ? 'Include' : 'Exclude'}
                      placement="top"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleExclude(msg)}
                        aria-label={
                          msg.excluded_from_context
                            ? 'Include response in context'
                            : 'Exclude response from context'
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                      >
                        {msg.excluded_from_context ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </Tooltip>

                    {confirmDeleteMsgId === msg.id ? (
                      <span className="inline-flex items-center gap-1.5 pl-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setConfirmDeleteMsgId(null);
                          }}
                          className="text-[#7A3E36] font-medium hover:underline cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <Tooltip content="Delete" placement="top">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(msg.id)}
                          aria-label="Delete response"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#7A3E36] transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Two-Tier Followup & Deeper analysis Suggestions Panel (Council only) */}
                {activePillar === 'council' &&
                  enableFollowups &&
                  isLatestFollowupHolder &&
                  idx === messages.length - 1 && (
                    <SuggestionsPanel
                      messageId={msg.id}
                      suggestions={msg.suggestions_json}
                      legacyFollowups={msg.followups_json}
                      askLaterItems={askLaterItems}
                      defaultExpanded={suggestionsDefaultExpanded}
                      disabled={isStreaming}
                      onSubmitSuggestion={(item) => {
                        if (onSubmitSuggestion) {
                          onSubmitSuggestion(item);
                        } else {
                          onSelectFollowUp(item.text);
                        }
                      }}
                      onInsertSuggestion={(item) => {
                        onInsertSuggestion?.(item);
                      }}
                      onInsertSuggestions={onInsertSuggestions}
                      onToggleAskLater={(item, tier, sourceMsgId) => {
                        onToggleAskLater?.(item, tier, sourceMsgId);
                      }}
                      onBookmarkSuggestions={onBookmarkSuggestions}
                      onLoadMoreSuggestions={onLoadMoreSuggestions}
                    />
                  )}
              </article>
            );
          })}

          {/* Phase 3: Inline Chart Creation Status & Progress */}
          {activePillar === 'council' && inlineChartCreation && (
            <article className="animate-cc-message-in space-y-3 pb-4">
              {inlineChartCreation.status === 'creating' && (
                <p className={`${sizeTokens.body} text-[#3D3830]`}>
                  Ok, give me a minute...
                </p>
              )}
              <ChartCreationProgress
                compact
                status={inlineChartCreation.status}
                subjectName={inlineChartCreation.name}
                errorMessage={inlineChartCreation.errorMessage}
                onRetryEdit={() => onEditPendingProfile(inlineChartCreation.draft)}
              />
            </article>
          )}

          {/* Live Streaming Response */}
          {isStreaming && (
            <article className="animate-cc-message-in space-y-3 pb-6">
              {activePillar === 'companion' && activeCompanionPersona && (
                <p className="text-[11px] font-semibold text-[#5C5449]">
                  {activeCompanionPersona.name}
                </p>
              )}
              {activePillar === 'clarity' && (
                <p className="text-[11px] font-medium text-[#8B8275]">Clarity</p>
              )}
              {streamingText ? (
                <div className={`space-y-3 ${sizeTokens.body} text-[#3D3830]`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {streamingText}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-xs text-[#8B8275]">
                  {activePillar === 'companion'
                    ? `${activeCompanionPersona?.name || 'Companion'} is typing...`
                    : activePillar === 'clarity'
                    ? 'Thinking clearly...'
                    : isWesternSystem
                    ? 'Synthesizing Tropical chart positions, houses, aspects, and transits...'
                    : 'Synthesizing chart positions, Dasha periods, and Gochar transits...'}
                </div>
              )}
            </article>
          )}
        </div>
      </div>

      {/* Smart Floating Scroll Controls — hidden by default, visible only while actively scrolling */}
      {isScrollable && messages.length > 0 && (canScrollUp || canScrollDown) && (
        <div
          onMouseEnter={() => {
            isScrollHoveredRef.current = true;
            if (scrollIdleTimerRef.current !== null) {
              window.clearTimeout(scrollIdleTimerRef.current);
              scrollIdleTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            isScrollHoveredRef.current = false;
            scheduleHideScrollControls();
          }}
          className={`absolute right-4 bottom-32 sm:bottom-36 z-20 transition-all duration-200 ${
            isScrollingActive
              ? 'opacity-100 pointer-events-auto translate-y-0'
              : 'opacity-0 pointer-events-none translate-y-1'
          }`}
        >
          <Tooltip content="Tap to jump top/bottom · Hold to glide smoothly" placement="left">
            <div className="flex flex-col rounded-2xl bg-[#EAE3D7]/90 backdrop-blur-md border border-[#3D3830]/15 shadow-md overflow-hidden">
              <button
                type="button"
                disabled={!canScrollUp}
                onPointerDown={() => startHoldScroll('up')}
                onPointerUp={() => handleScrollTap('up')}
                onPointerLeave={stopHoldScroll}
                onPointerCancel={stopHoldScroll}
                aria-label="Scroll to top or hold to scroll up"
                className="p-2 text-[#3D3830] hover:bg-[#FAF7F2]/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <div className="h-px bg-[#3D3830]/10" />
              <button
                type="button"
                disabled={!canScrollDown}
                onPointerDown={() => startHoldScroll('down')}
                onPointerUp={() => handleScrollTap('down')}
                onPointerLeave={stopHoldScroll}
                onPointerCancel={stopHoldScroll}
                aria-label="Scroll to bottom or hold to scroll down"
                className="p-2 text-[#3D3830] hover:bg-[#FAF7F2]/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default MessageThread;
