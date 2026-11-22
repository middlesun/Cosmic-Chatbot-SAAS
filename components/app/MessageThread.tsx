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
import {
  CHAT_NUMERIC_FONT_CLASSES,
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
  type AskLaterItem,
  type ChatCatalog,
  type ChatMessageRecord,
  type ChatNumericFont,
  type ChatPillar,
  type ChatProfile,
  type ClarificationChip,
  type CompanionPersona,
  type ConversationRecord,
  type PendingBirthProfileDraft,
  type SuggestionItem,
  type TimingProgressWidget,
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
  streamingStatus?: string | null;
  streamingTimingWidgets?: TimingProgressWidget[];
  isStreaming: boolean;
  catalog: ChatCatalog | null;
  fontSize?: ChatFontSize;
  numericFont?: ChatNumericFont;
  languageSlug?: string;
  responseMode?: 'simple' | 'detailed';
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
  onChangeExpert?: (slug: string) => void;
  onSelectClarificationChip?: (chip: ClarificationChip, messageId: string) => void;
  onSelectPartnerProfileForClarification?: (partnerId: string, originalQuestion: string) => void;
  onContinueWithoutDetails?: (originalQuestion: string, messageId: string) => void;
  onSaveToNotes?: (message: ChatMessageRecord) => void;
  savedNoteMsgIds?: Set<string>;
  savingNoteMsgId?: string | null;
}

const TIMING_BAR_TOKEN_RE = /\[\[?TIMING_BAR\s*:\s*([a-z0-9_]+)\s*\]?\]/gi;
const TIMING_BAR_ANY_RE = /\[\[?TIMING_BAR\s*:[^\]]*\]?\]?/gi;

const stripTimingBarTokens = (text: string): string => {
  const codeBlocks: string[] = [];
  let working = text.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CC_STRIP_CODE_${idx}__`;
  });

  working = working
    .replace(TIMING_BAR_ANY_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (codeBlocks.length > 0) {
    working = working.replace(
      /__CC_STRIP_CODE_(\d+)__/g,
      (_, i) => codeBlocks[Number(i)] || ''
    );
  }
  return working;
};

const stripInlineTechBreakdown = (text: string): string => {
  const withoutBreakdown = text.replace(/<<<TECH_BREAKDOWN[\s\S]*$/i, '');
  const codeBlocks: string[] = [];
  let working = withoutBreakdown.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CC_MD_CODE_BLOCK_${idx}__`;
  });

  working = working
    .replace(/^[ \t]*:::[a-zA-Z0-9_-]*[ \t]*(?:\r?\n|$)/gm, '')
    .replace(/:::(?:prediction|analysis)\b[ \t]*/gi, '')
    .replace(/^(?:prediction|ediction)\s*[:\-]?\s+/i, '')
    .replace(/[ \t]*:::[ \t]*$/gm, '')
    .replace(/\[CONFIDENCE\s*:[^\]]*\][ \t]*/gi, '')
    .replace(/^[ \t]*\[FOLLOWUP\][^\n]*(?:\r?\n|$)/gim, '')
    .replace(/\[FOLLOWUP\][ \t]*/gi, '')
    .replace(/\[\[?TIMING_BAR[^\]]*$/i, '')
    .replace(/\n{3,}/g, '\n\n');

  if (codeBlocks.length > 0) {
    working = working.replace(/__CC_MD_CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)] || '');
  }

  return working.trimEnd();
};

type MarkdownSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'widget'; widget: TimingProgressWidget };

const splitMarkdownWithTimingWidgets = (
  markdown: string,
  widgetMap: Map<string, TimingProgressWidget>
): MarkdownSegment[] => {
  const codeBlocks: string[] = [];
  const protectedMd = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CC_WIDGET_CODE_${idx}__`;
  });

  const restoreCode = (chunk: string) =>
    codeBlocks.length > 0
      ? chunk.replace(/__CC_WIDGET_CODE_(\d+)__/g, (_, i) => codeBlocks[Number(i)] || '')
      : chunk;

  const segments: MarkdownSegment[] = [];
  const pushMarkdown = (raw: string) => {
    const cleaned = restoreCode(raw).replace(TIMING_BAR_ANY_RE, '').trim();
    if (!cleaned) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.kind === 'markdown') {
      prev.text = `${prev.text}\n\n${cleaned}`;
    } else {
      segments.push({ kind: 'markdown', text: cleaned });
    }
  };

  let lastIdx = 0;
  TIMING_BAR_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TIMING_BAR_TOKEN_RE.exec(protectedMd)) !== null) {
    if (match.index > lastIdx) {
      pushMarkdown(protectedMd.slice(lastIdx, match.index));
    }
    const tokenId = match[1]?.toLowerCase();
    const widget = tokenId ? widgetMap.get(tokenId) : undefined;
    if (widget) {
      segments.push({ kind: 'widget', widget });
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < protectedMd.length) {
    pushMarkdown(protectedMd.slice(lastIdx));
  }

  return segments;
};

const TimingProgressBar: React.FC<{
  widget: TimingProgressWidget;
  inCard: boolean;
  numericFontClass: string;
}> = ({ widget, inCard, numericFontClass }) => {
  const pct = Math.max(0, Math.min(100, Math.round(widget.current.percentElapsed)));
  const daysLeft = Math.max(0, Math.round(widget.current.daysLeft));

  return (
    <div
      className={`my-2.5 rounded-xl border border-[#3D3830]/12 ${
        inCard ? 'bg-[#FAF7F2]/95' : 'bg-[#FDFBF7]'
      } px-3.5 py-3 shadow-[0_1px_2px_rgba(61,56,48,0.03)] min-w-0 max-w-full`}
      role="region"
      aria-label={`${widget.title}: ${widget.current.label}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8B8275] truncate">
          {widget.title}
        </span>
      </div>

      {/* 3-Step Stepper: [ Previous ] ---> [ Highlighted Current ] ---> [ Next ] */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2 mb-2.5 min-w-0">
        <div className="min-w-0 flex items-center gap-1.5 text-[11px] leading-tight text-[#8B8275]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8B8275]/45 shrink-0" />
          <span className="line-clamp-2 break-words" title={widget.previous.label}>
            {widget.previous.label}
          </span>
        </div>

        <ArrowRight className="h-3 w-3 text-[#8B8275]/65 shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex flex-col items-center text-center rounded-lg border border-[#B8965A]/35 bg-[#F1ECE3]/75 px-2 py-1">
          <div className="flex items-center justify-center gap-1.5 max-w-full min-w-0">
            <span className="h-2 w-2 rounded-full bg-[#B8965A] ring-2 ring-[#B8965A]/25 shrink-0" />
            <span
              className="text-xs font-semibold leading-tight text-[#3D3830] line-clamp-2 break-words"
              title={widget.current.label}
            >
              {widget.current.label}
            </span>
          </div>
          <span className={`${numericFontClass} text-[10px] text-[#5C5449] leading-tight mt-0.5 truncate max-w-full`}>
            {widget.current.startDisplay}
          </span>
        </div>

        <ArrowRight className="h-3 w-3 text-[#8B8275]/65 shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex items-center justify-end gap-1.5 text-[11px] leading-tight text-[#8B8275] text-right">
          <span className="line-clamp-2 break-words" title={widget.next.label}>
            {widget.next.label}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#8B8275]/45 shrink-0" />
        </div>
      </div>

      {/* Progress Track */}
      <div
        className="h-1.5 w-full rounded-full bg-[#EAE3D7] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${widget.current.label} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#B8965A] to-[#4A453D] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Bottom Metadata Row */}
      <div className={`mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${numericFontClass} text-[11px] text-[#5C5449]`}>
        <span>
          {widget.current.startDisplay} · {pct}% complete
        </span>
        <span>
          <strong className="font-semibold text-[#3D3830]">
            {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </strong>{' '}
          · {widget.current.endDisplay}
        </span>
      </div>
    </div>
  );
};

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

const NUMERIC_FONT_CLASSES: Record<ChatNumericFont, string> = CHAT_NUMERIC_FONT_CLASSES;

// Matches ISO dates (2026-11-21), planetary degrees (14°22', 14°22'10", 14.5°), and standalone numeric tokens (2028, 10th, 5/5, 82%, 14:30, 2-3) without altering month words or chart codes (D9, H7)
const NUMERIC_TELEMETRY_TOKEN_RE =
  /(\b\d{4}-\d{2}-\d{2}\b|(?<![A-Za-z0-9_])(?:[+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:°(?:\d{1,2}'(?:\d{1,2}")?)?|%|st|nd|rd|th|\/\d+|:\d{2}(?::\d{2})?|[-–—]\d+(?:\.\d+)?(?:°|%|st|nd|rd|th)?)?(?![A-Za-z0-9_]))/g;

const formatStringWithTelemetryAndHighlight = (
  text: string,
  query: string,
  numericFontClass: string
): React.ReactNode => {
  const parts = text.split(NUMERIC_TELEMETRY_TOKEN_RE);
  if (parts.length <= 1) {
    return highlightString(text, query);
  }
  return parts.map((part, idx) => {
    if (!part) return null;
    if (idx % 2 === 1) {
      return (
        <span key={idx} className={numericFontClass}>
          {highlightString(part, query)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{highlightString(part, query)}</React.Fragment>;
  });
};

const formatTelemetryAndHighlightNodes = (
  children: React.ReactNode,
  query: string,
  numericFontClass: string
): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return formatStringWithTelemetryAndHighlight(child, query, numericFontClass);
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        ...child.props,
        children: formatTelemetryAndHighlightNodes(child.props.children, query, numericFontClass),
      });
    }
    return child;
  });
};

const splitMarkdownIntoDetailedSections = (
  markdown: string
): {
  intro: string;
  sections: Array<{ title: string; body: string }>;
} => {
  const lines = markdown.split(/\r?\n/);

  const scanWithHeadingPrefix = (prefixRe: RegExp) => {
    let inFence = false;
    const introLines: string[] = [];
    const sections: Array<{ title: string; lines: string[] }> = [];
    let currentSection: { title: string; lines: string[] } | null = null;

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
      }
      if (!inFence) {
        const match = prefixRe.exec(line);
        if (match) {
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = { title: match[1].trim(), lines: [] };
          continue;
        }
      }
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        introLines.push(line);
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      intro: introLines.join('\n').trim(),
      sections: sections.map((s) => ({
        title: s.title,
        body: s.lines.join('\n').trim(),
      })),
    };
  };

  const h2Split = scanWithHeadingPrefix(/^##\s+(.+?)\s*$/);
  if (h2Split.sections.length > 0) {
    return h2Split;
  }

  // Fallback for preview or legacy messages that use ### for top-level sections without ##
  const h3Split = scanWithHeadingPrefix(/^###\s+(.+?)\s*$/);
  if (h3Split.sections.length >= 2) {
    return h3Split;
  }

  return { intro: markdown.trim(), sections: [] };
};

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
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
    body: 'text-[13px] leading-[1.64]',
    h1: 'text-xl',
    h2: 'text-lg',
    h3: 'text-base',
  },
  base: {
    body: 'text-[15px] leading-[1.74]',
    h1: 'text-2xl',
    h2: 'text-xl',
    h3: 'text-lg',
  },
  lg: {
    body: 'text-[17px] leading-[1.82]',
    h1: 'text-[27px]',
    h2: 'text-[23px]',
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
  streamingStatus = null,
  streamingTimingWidgets = [],
  isStreaming,
  catalog,
  fontSize = 'base',
  numericFont = 'dm_sans',
  languageSlug = 'English',
  responseMode = 'detailed',
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
  expertSlug = DEFAULT_COUNCIL_EXPERT_SLUG,
  onChangeExpert,
  onSelectClarificationChip,
  onSelectPartnerProfileForClarification,
  onContinueWithoutDetails,
  onSaveToNotes,
  savedNoteMsgIds,
  savingNoteMsgId = null,
}) => {
  const normalizedExpertSlug = normalizeCouncilSlug(expertSlug);
  const isWesternSystem =
    normalizedExpertSlug === 'western_astrologer' ||
    normalizedExpertSlug === 'modern_astrologer' ||
    (astrologyMode === 'western' &&
      normalizedExpertSlug !== DEFAULT_COUNCIL_EXPERT_SLUG &&
      normalizedExpertSlug !== 'tarot_reader' &&
      normalizedExpertSlug !== 'numerologist' &&
      normalizedExpertSlug !== 'learn_astrology');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [activeUserMsgId, setActiveUserMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [openEmptyDropdown, setOpenEmptyDropdown] = useState<'council' | 'profile' | null>(null);
  const [expandedBreakdownIds, setExpandedBreakdownIds] = useState<Record<string, boolean>>({});

  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isScrollingActive, setIsScrollingActive] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const emptyDropdownRef = useRef<HTMLDivElement | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const isScrollHoveredRef = useRef(false);
  const didHoldScrollRef = useRef(false);

  const speechSupported = useMemo(() => isSpeechSynthesisSupported(), []);
  const sizeTokens = FONT_SIZE_STYLES[fontSize] || FONT_SIZE_STYLES.base;
  const numericFontClass = NUMERIC_FONT_CLASSES[numericFont] || NUMERIC_FONT_CLASSES.dm_sans;

  // Stop active voice playback when switching threads or unmounting
  useEffect(() => {
    stopSpeaking();
    setSpeakingMsgId(null);
    setOpenEmptyDropdown(null);
    setActiveUserMsgId(null);
  }, [conversation?.id]);

  // Dismiss New Chat dropdowns on outside pointerdown or Escape
  useEffect(() => {
    if (!openEmptyDropdown) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (emptyDropdownRef.current && target && emptyDropdownRef.current.contains(target)) {
        return;
      }
      setOpenEmptyDropdown(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenEmptyDropdown(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openEmptyDropdown]);

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
      const started = speakMessageText(
        stripTimingBarTokens(msg.content),
        msg.language_used || languageSlug,
        {
          onEnd: () => setSpeakingMsgId((prev) => (prev === msg.id ? null : prev)),
          onError: () => setSpeakingMsgId((prev) => (prev === msg.id ? null : prev)),
        }
      );
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
  const activeExpertOption = useMemo(
    () => (catalog?.experts || []).find((opt) => opt.slug === expertSlug) || null,
    [catalog?.experts, expertSlug]
  );
  const activeExpertLabel = activeExpertOption?.displayName || 'Vedic Astrologer';
  const activeProfileButtonLabel = profile ? getProfileDisplayLabel(profile) : 'Select Chart';

  const buildMarkdownComponents = useCallback(
    (inCard: boolean) => ({
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h2 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h1} font-medium text-[#3D3830] pt-1`}>
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </h2>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h3 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h2} font-medium text-[#3D3830] pt-1`}>
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </h3>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h4 className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h3} font-medium text-[#3D3830] pt-1.5`}>
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </h4>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className={`${sizeTokens.body} text-[#5C5449]`}>
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </p>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className={`list-disc pl-5 space-y-1.5 ${sizeTokens.body} text-[#5C5449]`}>
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className={`list-decimal pl-5 space-y-1.5 ${sizeTokens.body} text-[#5C5449]`}>
          {children}
        </ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="leading-[1.68]">
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </li>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold text-[#3D3830]">
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </strong>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className={`border-l-2 border-[#B8965A]/70 pl-4 py-1 ${sizeTokens.body} text-[#5C5449] italic`}>
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </blockquote>
      ),
      code: ({ children }: { children?: React.ReactNode }) => (
        <code className={`${numericFontClass} text-[0.9em] bg-[#F1ECE3] px-1.5 py-0.5 rounded text-[#3D3830]`}>
          {children}
        </code>
      ),
      table: ({ children }: { children?: React.ReactNode }) => (
        <div
          className={`w-full max-w-full overflow-x-auto my-2.5 rounded-xl border border-[#3D3830]/12 ${
            inCard ? 'bg-[#FAF7F2]/60' : 'bg-[#FDFBF7]'
          }`}
        >
          <table className="w-full min-w-[440px] text-xs text-left border-collapse">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="bg-[#F1ECE3]/40 text-[#3D3830]">{children}</thead>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold text-[#3D3830] border-b border-[#3D3830]/12 whitespace-nowrap">
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="px-3 sm:px-3.5 py-2 text-xs text-[#5C5449] border-b border-[#3D3830]/8 align-top leading-relaxed">
          {formatTelemetryAndHighlightNodes(children, searchQuery, numericFontClass)}
        </td>
      ),
    }),
    [numericFontClass, searchQuery, sizeTokens]
  );

  const markdownComponents = useMemo(
    () => buildMarkdownComponents(false),
    [buildMarkdownComponents]
  );

  const cardMarkdownComponents = useMemo(
    () => buildMarkdownComponents(true),
    [buildMarkdownComponents]
  );

  const renderMarkdownWithWidgets = useCallback(
    (
      markdown: string,
      components: ReturnType<typeof buildMarkdownComponents>,
      widgetMap: Map<string, TimingProgressWidget>,
      inCard: boolean,
      className: string
    ) => {
      const segments = splitMarkdownWithTimingWidgets(markdown, widgetMap);
      if (segments.length === 0) return null;
      return (
        <div className={className}>
          {segments.map((seg, idx) =>
            seg.kind === 'widget' ? (
              <TimingProgressBar
                key={`tw-${seg.widget.id}-${idx}`}
                widget={seg.widget}
                inCard={inCard}
                numericFontClass={numericFontClass}
              />
            ) : (
              <ReactMarkdown
                key={`md-${idx}`}
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {seg.text}
              </ReactMarkdown>
            )
          )}
        </div>
      );
    },
    [numericFontClass]
  );

  const renderEditorialContent = useCallback(
    (
      rawMarkdown: string,
      useDetailedCards: boolean,
      timingWidgets?: TimingProgressWidget[] | null
    ) => {
      const clean = stripInlineTechBreakdown(rawMarkdown);
      const widgetMap = new Map<string, TimingProgressWidget>();
      if (Array.isArray(timingWidgets)) {
        for (const w of timingWidgets) {
          if (w && w.id) widgetMap.set(w.id.toLowerCase(), w);
        }
      }

      if (!useDetailedCards) {
        return renderMarkdownWithWidgets(
          clean,
          markdownComponents,
          widgetMap,
          false,
          `space-y-3 min-w-0 ${sizeTokens.body} text-[#5C5449]`
        );
      }

      const { intro, sections } = splitMarkdownIntoDetailedSections(clean);
      if (sections.length === 0) {
        return renderMarkdownWithWidgets(
          clean,
          markdownComponents,
          widgetMap,
          false,
          `space-y-3 min-w-0 ${sizeTokens.body} text-[#5C5449]`
        );
      }

      return (
        <div className="space-y-3 min-w-0">
          {intro &&
            renderMarkdownWithWidgets(
              intro,
              markdownComponents,
              widgetMap,
              false,
              `space-y-3 min-w-0 ${sizeTokens.body} text-[#5C5449]`
            )}
          {sections.map((sec, sIdx) => (
            <section
              key={`${sIdx}-${sec.title}`}
              className="rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] px-4 py-3.5 sm:px-5 sm:py-4 my-3 shadow-[0_1px_2px_rgba(61,56,48,0.03)] min-w-0"
            >
              <h3
                className={`font-['Cormorant_Garamond',serif] ${sizeTokens.h2} font-medium text-[#3D3830] pb-2 mb-2.5 border-b border-[#3D3830]/10`}
              >
                {formatStringWithTelemetryAndHighlight(sec.title, searchQuery, numericFontClass)}
              </h3>
              {sec.body &&
                renderMarkdownWithWidgets(
                  sec.body,
                  cardMarkdownComponents,
                  widgetMap,
                  true,
                  `space-y-2.5 min-w-0 ${sizeTokens.body} text-[#5C5449]`
                )}
            </section>
          ))}
        </div>
      );
    },
    [
      cardMarkdownComponents,
      markdownComponents,
      numericFontClass,
      renderMarkdownWithWidgets,
      searchQuery,
      sizeTokens,
    ]
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
                {welcomeTitle && welcomeTitle !== "I'm ready" ? welcomeTitle : 'Clarity'}
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5449] max-w-md mx-auto leading-relaxed">
                {welcomeSubtitle ||
                  'Your off-record sidekick for quick doubts, prompt drafting, and everyday questions — kept completely separate from your birth chart memory.'}
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

    const newChatActionButtons = (
      <div
        ref={emptyDropdownRef}
        className="flex flex-wrap items-center justify-center gap-2.5 pt-1"
      >
        {/* 1. Council Guide Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenEmptyDropdown((prev) => (prev === 'council' ? null : 'council'))
            }
            aria-expanded={openEmptyDropdown === 'council'}
            aria-haspopup="listbox"
            className={`min-h-[44px] inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
              openEmptyDropdown === 'council'
                ? 'border-[#3D3830]/35 bg-[#F1ECE3] text-[#3D3830]'
                : 'border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
            }`}
          >
            <span className="truncate max-w-[160px]">{activeExpertLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#8B7355] shrink-0 transition-transform duration-150 ${
                openEmptyDropdown === 'council' ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openEmptyDropdown === 'council' && (
            <div
              role="listbox"
              aria-label="Choose Council Guide"
              className="animate-cc-dropdown-down absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-64 sm:w-72 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-xl overflow-hidden text-left z-30"
            >
              <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                {(catalog?.experts || []).map((opt) => {
                  const isSelected = expertSlug === opt.slug;
                  return (
                    <button
                      key={opt.slug}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setOpenEmptyDropdown(null);
                        onChangeExpert?.(opt.slug);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#F1ECE3] text-[#3D3830]'
                          : 'hover:bg-[#F1ECE3]/75 text-[#3D3830]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#3D3830] truncate">
                          {opt.displayName}
                        </p>
                        {opt.subtitle && (
                          <p className="text-[11px] text-[#8B8275] truncate mt-0.5">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. Profile / Chart Scrollable Dropdown with Pinned Bottom "Add New" */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenEmptyDropdown((prev) => (prev === 'profile' ? null : 'profile'))
            }
            aria-expanded={openEmptyDropdown === 'profile'}
            aria-haspopup="listbox"
            className={`min-h-[44px] inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
              profile
                ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                : openEmptyDropdown === 'profile'
                ? 'border-[#3D3830]/35 bg-[#F1ECE3] text-[#3D3830]'
                : 'border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
            }`}
          >
            <UserCheck
              className={`h-3.5 w-3.5 shrink-0 ${
                profile ? 'text-[#FAF7F2]/85' : 'text-[#8B7355]'
              }`}
            />
            <span className="truncate max-w-[150px]">{activeProfileButtonLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                profile ? 'text-[#FAF7F2]/80' : 'text-[#8B7355]'
              } ${openEmptyDropdown === 'profile' ? 'rotate-180' : ''}`}
            />
          </button>

          {openEmptyDropdown === 'profile' && (
            <div
              role="listbox"
              aria-label="Choose Birth Chart Profile"
              className="animate-cc-dropdown-down absolute left-1/2 -translate-x-1/2 mt-2 w-64 sm:w-72 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-xl overflow-hidden text-left z-30"
            >
              <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                {profiles.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-[#8B8275] text-center">
                    No saved charts yet.
                  </p>
                ) : (
                  profiles.map((p) => {
                    const isSelected = profile?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setOpenEmptyDropdown(null);
                          onSelectProfile(p.id);
                        }}
                        className={`w-full min-h-[42px] flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#F1ECE3] text-[#3D3830]'
                            : 'hover:bg-[#F1ECE3]/75 text-[#3D3830]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#3D3830] truncate">
                            {getProfileDisplayLabel(p)}
                          </p>
                          <p className="text-[11px] text-[#8B8275] truncate">
                            {formatReadableDate(p.birth_date)} · {p.birth_city}
                            {p.birth_country ? `, ${p.birth_country}` : ''}
                          </p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-[#3D3830]/10 p-1.5 bg-[#FAF7F2]">
                <button
                  type="button"
                  onClick={() => {
                    setOpenEmptyDropdown(null);
                    onOpenAddChartModal();
                  }}
                  className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>Add New</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. General Chart */}
        <button
          type="button"
          onClick={() => {
            setOpenEmptyDropdown(null);
            onSelectGeneralChart();
          }}
          className={`min-h-[44px] inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
            generalReadyMode && !profile
              ? 'border-[#4A453D]/40 bg-[#F1ECE3] text-[#3D3830]'
              : 'border-[#3D3830]/15 bg-[#FDFBF7] text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
          <span>General Chart</span>
        </button>
      </div>
    );

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
              {newChatActionButtons}
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
              {newChatActionButtons}
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

              {newChatActionButtons}
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
                      <span className="line-clamp-2">{stripTimingBarTokens(parentMsg.content)}</span>
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

            const showSuggestionsFooter =
              enableFollowups &&
              isLatestFollowupHolder &&
              idx === messages.length - 1;

            const utilityFooterContent = (
              <div className="flex flex-wrap items-center justify-end gap-0.5 text-[#8B8275]">
                {msg.excluded_from_context && (
                  <span className="mr-1.5 text-[11px] text-[#7A3E36]">
                    Excluded from context
                  </span>
                )}

                <Tooltip content={isCopied ? 'Copied' : 'Copy'} placement="top">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyMessage(msg.id, stripTimingBarTokens(msg.content))
                    }
                    aria-label={isCopied ? 'Copied' : 'Copy response'}
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

                {enableListen && speechSupported && (
                  <Tooltip
                    content={isSpeaking ? 'Stop reading' : 'Listen'}
                    placement="top"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleListen(msg)}
                      aria-label={isSpeaking ? 'Stop reading aloud' : 'Listen to response'}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
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
                      href={getWhatsAppShareUrl(stripTimingBarTokens(msg.content))}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on WhatsApp"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
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
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer disabled:opacity-50 ${
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
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] transition-colors cursor-pointer ${
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
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
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
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F1ECE3] hover:text-[#7A3E36] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
            );

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
                {activePillar === 'council' && msg.expert_used && (() => {
                  const vedicMeta =
                    msg.suggestions_json?.vedic_meta || msg.suggestions_json?.sutra_meta;
                  const showBadge =
                    Boolean(vedicMeta) &&
                    (vedicMeta!.isDeepAudit ||
                      vedicMeta!.intent === 'HARD_DECISION' ||
                      vedicMeta!.intent === 'TIMING' ||
                      vedicMeta!.intent === 'SOFT_HORIZON' ||
                      vedicMeta!.intent === 'PEER_AUDIT');
                  return (
                    <div className="flex flex-wrap items-center gap-2">
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
                      {showBadge && vedicMeta && (
                        <Tooltip
                          content={
                            vedicMeta.isDeepAudit
                              ? `Deep Council Audit (${vedicMeta.lensesSucceeded ?? 4}/4 specialist checks adjudicated across ${vedicMeta.convergenceBandLabel})`
                              : `Multi-system Observatory check (${vedicMeta.convergenceBandLabel}${
                                  vedicMeta.cancellationsCount > 0
                                    ? ` · ${vedicMeta.cancellationsCount} cancellation${
                                        vedicMeta.cancellationsCount === 1 ? '' : 's'
                                      } checked`
                                    : ''
                                })`
                          }
                          placement="top"
                        >
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                              vedicMeta.isDeepAudit
                                ? 'border-[#B8965A]/45 bg-[#292D36] text-[#F4EFE6]'
                                : 'border-[#3D3830]/12 bg-[#F1ECE3] text-[#5C5449]'
                            }`}
                          >
                            <Sparkles
                              className={`h-2.5 w-2.5 ${
                                vedicMeta.isDeepAudit ? 'text-[#B8965A]' : 'text-[#8B7355]'
                              }`}
                            />
                            <span>
                              {vedicMeta.isDeepAudit
                                ? `Deep Council Audit · ${vedicMeta.convergenceBandLabel}`
                                : vedicMeta.convergenceBandLabel}
                            </span>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const hasTechBreakdown = Boolean(msg.suggestions_json?.tech_breakdown);
                  const useDetailedCards =
                    activePillar === 'council' &&
                    !hasTechBreakdown &&
                    msg.output_format_used !== 'short' &&
                    msg.output_format_used !== 'concise' &&
                    msg.output_format_used !== 'conversational' &&
                    (msg.output_format_used === 'detailed' ||
                      msg.output_format_used === 'bullets' ||
                      msg.output_format_used === 'marriage_master' ||
                      msg.output_format_used === 'dual_view' ||
                      responseMode === 'detailed');
                  return renderEditorialContent(
                    msg.content,
                    useDetailedCards,
                    msg.suggestions_json?.timing_widgets
                  );
                })()}

                {activePillar === 'council' && msg.suggestions_json?.tech_breakdown && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBreakdownIds((prev) => ({
                          ...prev,
                          [msg.id]: !prev[msg.id],
                        }))
                      }
                      aria-expanded={Boolean(expandedBreakdownIds[msg.id])}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/14 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      {expandedBreakdownIds[msg.id] ? (
                        <ChevronUp className="h-3.5 w-3.5 text-[#8B7355]" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-[#8B7355]" />
                      )}
                      <span>
                        {expandedBreakdownIds[msg.id]
                          ? 'Hide technical breakdown'
                          : 'View technical breakdown'}
                      </span>
                    </button>

                    {expandedBreakdownIds[msg.id] && (
                      <div className="mt-2.5 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-4 py-3.5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8B8275]">
                          Astrological Evidence &amp; Verification
                        </p>
                        <div className="space-y-2.5 text-[13px] leading-[1.66] text-[#3D3830]">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {msg.suggestions_json.tech_breakdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                {/* Vedic Astrologer Stage 1 Interactive Clarification Chips */}
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

                      {isActiveClarificationCard && onContinueWithoutDetails && (
                        <button
                          type="button"
                          onClick={() =>
                            onContinueWithoutDetails(
                              clarificationData.originalQuestion || '',
                              msg.id
                            )
                          }
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#3D3830]/20 bg-transparent px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/65 transition-colors cursor-pointer"
                        >
                          <span>Continue without details</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Unified Option-A Message Footer (Suggestions Left + Utility Icons Right) */}
                {showSuggestionsFooter ? (
                  <SuggestionsPanel
                    messageId={msg.id}
                    suggestions={msg.suggestions_json}
                    legacyFollowups={msg.followups_json}
                    askLaterItems={askLaterItems}
                    defaultExpanded={suggestionsDefaultExpanded}
                    disabled={isStreaming}
                    utilityBar={utilityFooterContent}
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
                ) : (
                  <div className="mt-2 border-t border-[#3D3830]/[0.08] pt-2.5 flex flex-wrap items-center justify-end gap-2">
                    {utilityFooterContent}
                  </div>
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
                renderEditorialContent(
                  streamingText,
                  activePillar === 'council' && responseMode === 'detailed',
                  streamingTimingWidgets
                )
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#8B8275]">
                  {streamingStatus && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#B8965A] animate-pulse shrink-0" />
                  )}
                  <span>
                    {streamingStatus
                      ? streamingStatus
                      : activePillar === 'companion'
                      ? `${activeCompanionPersona?.name || 'Companion'} is typing...`
                      : activePillar === 'clarity'
                      ? 'Thinking clearly...'
                      : isWesternSystem
                      ? 'Synthesizing Tropical chart positions, houses, aspects, and transits...'
                      : 'Synthesizing chart positions, Dasha periods, and Gochar transits...'}
                  </span>
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
