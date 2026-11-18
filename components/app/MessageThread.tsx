import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUpRight,
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

interface MessageThreadProps {
  conversation: ConversationRecord | null;
  profile: ChatProfile | null;
  messages: ChatMessageRecord[];
  streamingText: string;
  isStreaming: boolean;
  catalog: ChatCatalog | null;
  onReplyToMessage: (message: ChatMessageRecord) => void;
  onToggleStar: (message: ChatMessageRecord) => void;
  onToggleExclude: (message: ChatMessageRecord) => void;
  onDeleteMessage: (messageId: string) => void;
  onSelectFollowUp: (question: string) => void;
  onQuickStarterPrompt: (question: string) => void;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  profile,
  messages,
  streamingText,
  isStreaming,
  catalog,
  onReplyToMessage,
  onToggleStar,
  onToggleExclude,
  onDeleteMessage,
  onSelectFollowUp,
  onQuickStarterPrompt,
}) => {
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);

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

  const starterPrompts = profile
    ? [
        `Give me a Council Synthesis of ${profile.name}'s current Mahadasha, Antardasha, and today's Gochar transits.`,
        `Analyze ${profile.name}'s 10th house, D10 Dasamsa, and KP career significators for growth in the next 12 months.`,
        `What are the key relationship and emotional patterns shown by ${profile.name}'s 7th house, D9 Navamsa, and Darakaraka?`,
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

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-10 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-xs text-[#8B8275]">
              {profile
                ? `${profile.name} · ${profile.birth_date} · ${profile.birth_city}, ${profile.birth_country}`
                : conversation?.mode_type === 'learn_astrology'
                ? 'Learn Astrology · Interactive Jyotish Study'
                : 'General Consultation'}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] tracking-tight">
              {profile
                ? `Observatory Session for ${profile.name}`
                : conversation?.mode_type === 'learn_astrology'
                ? 'Study the Living Architecture of Jyotish'
                : 'Open a Vedic Council Consultation'}
            </h2>
            <p className="text-sm text-[#5C5449] max-w-xl mx-auto leading-relaxed">
              {profile
                ? profile.is_activated
                  ? 'Verified ephemeris data, divisional charts D1–D60, KP Sub-Lords, Jaimini Karakas, and today’s Gochar transits are loaded in context.'
                  : 'This profile is saved as a draft. You can ask conceptual questions now or activate its full ephemeris chart inside Profiles.'
                : 'Select an astrological discipline below, attach any saved birth chart mid-conversation, or explore timeless Vedic principles.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {starterPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onQuickStarterPrompt(prompt)}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 px-5 py-4 text-left transition-colors hover:bg-[#F1ECE3]"
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
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="mx-auto max-w-3xl space-y-7">
        {messages.map((msg, idx) => {
          const parentMsg = msg.parent_message_id
            ? messageMap.get(msg.parent_message_id)
            : null;
          const isUser = msg.role === 'user';
          const isLatestFollowupHolder =
            latestAssistantWithFollowups?.id === msg.id && !isStreaming;

          if (isUser) {
            return (
              <div
                key={msg.id}
                className={`flex flex-col items-end space-y-1.5 ${
                  msg.excluded_from_context ? 'opacity-50' : ''
                }`}
              >
                {parentMsg && parentMsg.role === 'assistant' && (
                  <div className="max-w-[85%] rounded-xl border-l-2 border-[#8B7355] bg-[#F1ECE3]/70 px-3 py-1.5 text-[11px] text-[#5C5449]">
                    <span className="font-medium text-[#3D3830]">Replying to insight: </span>
                    <span className="line-clamp-2">{parentMsg.content}</span>
                  </div>
                )}

                <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-[#F1ECE3] border border-[#3D3830]/10 px-5 py-3.5 text-sm text-[#3D3830] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
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
              className={`space-y-3 border-b border-[#3D3830]/10 pb-6 ${
                msg.excluded_from_context ? 'opacity-50' : ''
              }`}
            >
              <div className="space-y-3 text-sm text-[#3D3830] leading-[1.72]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] pt-2">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830] pt-2">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830] pt-1">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm text-[#3D3830] leading-[1.74]">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-[1.68]">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-[#3D3830]">{children}</strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-[#8B7355] pl-4 py-1 text-sm text-[#5C5449] italic">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="font-['JetBrains_Mono',monospace] text-xs bg-[#F1ECE3] px-1.5 py-0.5 rounded text-[#3D3830]">
                        {children}
                      </code>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7]">
                        <table className="w-full text-xs text-left border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-[#F1ECE3] text-[#3D3830]">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-3.5 py-2 font-medium border-b border-[#3D3830]/12">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3.5 py-2 border-b border-[#3D3830]/8 text-[#5C5449]">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* Whisper-Quiet Metadata & Inline Actions (Zero Pills) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-[#8B8275]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>{labelFor(catalog?.experts, msg.expert_used) || 'Council Synthesis'}</span>
                  <span>·</span>
                  <span>{labelFor(catalog?.modes, msg.mode_used) || 'Life & Dharma'}</span>
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

              {/* 5–6 Structured Numbered Follow-Up Questions on Latest Response */}
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
                        className="group flex items-start gap-2.5 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 px-3.5 py-2.5 text-left text-xs text-[#3D3830] hover:bg-[#F1ECE3] transition-colors"
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
          <article className="space-y-3 pb-6">
            {streamingText ? (
              <div className="space-y-3 text-sm text-[#3D3830] leading-[1.72]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] pt-2">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830] pt-2">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830] pt-1">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm text-[#3D3830] leading-[1.74]">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ol>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-[#3D3830]">{children}</strong>
                    ),
                  }}
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
  );
};

export default MessageThread;
