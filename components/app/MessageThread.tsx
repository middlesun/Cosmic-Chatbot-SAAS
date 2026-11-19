import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Reply,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  ChatCatalog,
  ChatMessageRecord,
  ChatProfile,
  ConversationRecord,
} from './chatTypes';
import type { ChatFontSize } from './ChatSettingsModal';

interface MessageThreadProps {
  conversation: ConversationRecord | null;
  profile: ChatProfile | null;
  messages: ChatMessageRecord[];
  hasMoreMessages?: boolean;
  loadingEarlierMessages?: boolean;
  streamingText: string;
  isStreaming: boolean;
  catalog: ChatCatalog | null;
  fontSize?: ChatFontSize;
  searchQuery?: string;
  activeMatchMessageId?: string | null;
  onLoadEarlierMessages?: () => void;
  onReplyToMessage: (message: ChatMessageRecord) => void;
  onToggleStar: (message: ChatMessageRecord) => void;
  onToggleExclude: (message: ChatMessageRecord) => void;
  onDeleteMessage: (messageId: string) => void;
  onSelectFollowUp: (question: string) => void;
  onQuickStarterPrompt: (question: string) => void;
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

const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  profile,
  messages,
  hasMoreMessages = false,
  loadingEarlierMessages = false,
  streamingText,
  isStreaming,
  catalog,
  fontSize = 'base',
  searchQuery = '',
  activeMatchMessageId = null,
  onLoadEarlierMessages,
  onReplyToMessage,
  onToggleStar,
  onToggleExclude,
  onDeleteMessage,
  onSelectFollowUp,
  onQuickStarterPrompt,
}) => {
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const didHoldScrollRef = useRef(false);

  const sizeTokens = FONT_SIZE_STYLES[fontSize] || FONT_SIZE_STYLES.base;

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 24;
    setIsScrollable(overflow);
    setCanScrollUp(el.scrollTop > 32);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 32);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [messages.length, streamingText, conversation?.id, updateScrollState]);

  const stopHoldScroll = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopHoldScroll();
  }, [stopHoldScroll]);

  const startHoldScroll = (direction: 'up' | 'down') => {
    stopHoldScroll();
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

  const labelFor = (list: { slug: string; displayName: string }[] | undefined, slug: string | null) => {
    if (!slug) return '';
    return list?.find((item) => item.slug === slug)?.displayName || slug;
  };

  const latestAssistantWithFollowups = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].role === 'assistant' &&
        Array.isArray(messages[i].followups_json) &&
        messages[i].followups_json.length > 0
      ) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const profileLabel = profile ? getProfileDisplayLabel(profile) : null;

  const starterPrompts = profile
    ? [
        `Give me a Vedic synthesis of ${profileLabel}'s current Mahadasha, Antardasha, and today's Gochar transits.`,
        `Analyze ${profileLabel}'s 10th house, D10 Dasamsa, and KP career significators for growth in the next 12 months.`,
        `What are the key relationship and emotional patterns shown by ${profileLabel}'s 7th house, D9 Navamsa, and Darakaraka?`,
      ]
    : conversation?.mode_type === 'learn_astrology'
    ? [
        'Explain how KP Cuspal Sub-Lords confirm or deny a house promise compared to Parashari Rashi reading.',
        'How should I combine Vimshottari Mahadasha with Ashtakavarga scores when timing a major life shift?',
        'Walk me through what Atmakaraka and Karakamsha reveal in Jaimini astrology.',
      ]
    : [
        'How does Saturn’s slow transit interact with Moon sign (Sade Sati) across mind and career?',
        'What is the best framework to evaluate career change timing using Vedic Dasha and D10?',
        'Help me understand how Parashari, KP, Jaimini, and Nadi complement each other.',
      ];

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
        <code className="font-['JetBrains_Mono',monospace] text-xs bg-[#F1ECE3] px-1.5 py-0.5 rounded text-[#3D3830]">
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

  if (messages.length === 0 && !isStreaming) {
    return (
      <div
        key={conversation?.id || 'empty'}
        className="animate-cc-tab-panel flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-8 flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-2xl space-y-7">
          <div className="space-y-3 text-center">
            <p className="text-xs text-[#8B8275]">
              {profile
                ? `${profileLabel} · ${profile.birth_date} · ${profile.birth_city}, ${profile.birth_country}`
                : conversation?.mode_type === 'learn_astrology'
                ? 'Learn Astrology · Interactive Jyotish Study'
                : 'General Consultation'}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] tracking-tight">
              {profile
                ? `Observatory Session for ${profileLabel}`
                : conversation?.mode_type === 'learn_astrology'
                ? 'Study the Living Architecture of Jyotish'
                : 'Open a Vedic Council Consultation'}
            </h2>
            <p className="text-sm text-[#5C5449] max-w-xl mx-auto leading-relaxed">
              {profile
                ? profile.is_activated
                  ? 'Verified ephemeris data, divisional charts D1–D60, KP Sub-Lords, Jaimini Karakas, and today’s Gochar transits are loaded in context.'
                  : 'This profile is saved as a draft. You can ask conceptual questions now or activate its full ephemeris chart inside Profiles.'
                : 'Open Options below to pick your birth chart, astrology system, and area of life before sending your first question.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {starterPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onQuickStarterPrompt(prompt)}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 px-5 py-4 text-left transition-all hover:bg-[#F1ECE3] active:scale-[0.99]"
              >
                <span className="text-xs md:text-sm text-[#3D3830] leading-relaxed">
                  {prompt}
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8B8275] group-hover:text-[#3D3830]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        key={conversation?.id || 'thread'}
        className="animate-cc-tab-panel flex-1 overflow-y-auto px-4 md:px-8 py-6"
      >
        <div className="mx-auto max-w-3xl space-y-7">
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
              latestAssistantWithFollowups?.id === msg.id && !isStreaming;
            const isActiveMatch = activeMatchMessageId === msg.id;

            if (isUser) {
              return (
                <div
                  key={msg.id}
                  data-msg-id={msg.id}
                  className={`animate-cc-message-in flex flex-col items-end space-y-1.5 transition-all ${
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
                    className={`max-w-[85%] rounded-3xl rounded-tr-md bg-[#F1ECE3] border border-[#3D3830]/10 px-5 py-3.5 ${sizeTokens.body} text-[#3D3830] whitespace-pre-wrap`}
                  >
                    {highlightString(msg.content, searchQuery)}
                  </div>

                  <div className="flex items-center gap-3 px-1 text-[11px] text-[#8B8275]">
                    {msg.excluded_from_context && (
                      <span className="text-[#7A3E36]">Excluded from context</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleExclude(msg)}
                      className="inline-flex items-center gap-1 hover:text-[#3D3830]"
                      title={
                        msg.excluded_from_context
                          ? 'Include in context memory'
                          : 'Exclude from AI context'
                      }
                    >
                      {msg.excluded_from_context ? (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Include</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Exclude</span>
                        </>
                      )}
                    </button>

                    {confirmDeleteMsgId === msg.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setConfirmDeleteMsgId(null);
                          }}
                          className="text-[#7A3E36] font-medium"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="hover:text-[#3D3830]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMsgId(msg.id)}
                        className="inline-flex items-center gap-1 hover:text-[#7A3E36]"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Assistant Editorial Prose Card
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
                <div className={`space-y-3 ${sizeTokens.body} text-[#3D3830]`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Whisper-Quiet Metadata & Inline Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-[#8B8275]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{labelFor(catalog?.experts, msg.expert_used) || 'Vedic astrologer'}</span>
                    <span>·</span>
                    <span>{labelFor(catalog?.modes, msg.mode_used) || 'General'}</span>
                    <span>·</span>
                    <span>{labelFor(catalog?.outputs, msg.output_format_used) || 'Detailed'}</span>
                    {msg.language_used && (
                      <>
                        <span>·</span>
                        <span>{msg.language_used}</span>
                      </>
                    )}
                    {msg.excluded_from_context && (
                      <>
                        <span>·</span>
                        <span className="text-[#7A3E36]">Excluded from context</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => onToggleStar(msg)}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        msg.is_starred
                          ? 'text-[#8B7355] font-medium'
                          : 'hover:text-[#3D3830]'
                      }`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${msg.is_starred ? 'fill-current' : ''}`}
                      />
                      <span>{msg.is_starred ? 'Starred' : 'Star'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onReplyToMessage(msg)}
                      className="inline-flex items-center gap-1 hover:text-[#3D3830]"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      <span>Reply</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleExclude(msg)}
                      className="inline-flex items-center gap-1 hover:text-[#3D3830]"
                    >
                      {msg.excluded_from_context ? (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          <span>Include</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Exclude</span>
                        </>
                      )}
                    </button>

                    {confirmDeleteMsgId === msg.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setConfirmDeleteMsgId(null);
                          }}
                          className="text-[#7A3E36] font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="hover:text-[#3D3830]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMsgId(msg.id)}
                        className="inline-flex items-center gap-1 hover:text-[#7A3E36]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Structured Numbered Follow-Up Questions */}
                {isLatestFollowupHolder && idx === messages.length - 1 && (
                  <div className="pt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
                      <span>Continue exploring</span>
                      <span className="font-['JetBrains_Mono',monospace]">
                        Click or type 1–{msg.followups_json.length} + Enter
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {msg.followups_json.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          type="button"
                          onClick={() => onSelectFollowUp(q)}
                          className="group flex items-start gap-2.5 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 px-3.5 py-2.5 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3] active:scale-[0.99] transition-all"
                        >
                          <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[11px] text-[#8B8275] pt-0.5 shrink-0">
                            {qIdx + 1}.
                          </span>
                          <span className="leading-relaxed flex-1">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {/* Live Streaming Response */}
          {isStreaming && (
            <article className="animate-cc-message-in space-y-3 pb-6">
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
                  Synthesizing chart positions, Dasha periods, and Gochar transits...
                </div>
              )}
            </article>
          )}
        </div>
      </div>

      {/* Smart Floating Scroll Controls (Tap = jump top/bottom, Press & Hold = glide) */}
      {isScrollable && messages.length > 0 && (
        <div
          className="absolute right-4 bottom-4 z-20 flex flex-col rounded-2xl bg-[#EAE3D7]/90 backdrop-blur-md border border-[#3D3830]/15 shadow-md overflow-hidden"
          title="Tap to jump top/bottom · Hold to glide smoothly"
        >
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
      )}
    </div>
  );
};

export default MessageThread;
