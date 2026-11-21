import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Bookmark,
  Brain,
  Check,
  ChevronRight,
  FileText,
  HeartHandshake,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Reply,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  SquarePen,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react';
import Tooltip from './Tooltip';
import ComposerTabStrip from './ComposerTabStrip';
import type {
  ActiveChatTab,
  ChatAttachmentInput,
  ChatCatalog,
  ChatMessageRecord,
  ChatPillar,
  ChatProfile,
  CompanionArchetypeSlug,
  CompanionPersona,
  ConversationRecord,
  CustomPromptRecord,
} from './chatTypes';

interface ChatComposerProps {
  activePillar: ChatPillar;
  activeCompanionPersona?: CompanionPersona | null;
  tabs: ActiveChatTab[];
  activeTabId: string;
  maxActiveTabs?: number;
  pastCompanionConversations: ConversationRecord[];
  recentConversations: ConversationRecord[];
  isStreamingTabId?: string | null;
  composerDisabled?: boolean;
  composerDisabledHint?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTabs: (orderedTabIds: string[]) => void;
  onRenameTab: (tabId: string, nextLabel: string) => void;
  onAddCouncilTab: (expertSlug: string) => void;
  onAddCompanionArchetypeTab: (archetype: CompanionArchetypeSlug) => void;
  onOpenExistingConversationAsTab: (conv: ConversationRecord) => void;
  onResetClarity?: () => void;
  onStartNewCompanion?: () => void;
  draftText: string;
  onDraftChange: (text: string) => void;
  catalog: ChatCatalog | null;
  profiles: ChatProfile[];
  activeProfileId: string | null;
  extraProfileIds: string[];
  attachments: ChatAttachmentInput[];
  expertSlug: string;
  languageSlug: string;
  useFullProfileMemory: boolean;
  responseMode: 'simple' | 'detailed';
  replyTarget: ChatMessageRecord | null;
  activeFollowups: string[];
  customPrompts: CustomPromptRecord[];
  isStreaming: boolean;
  isThreadLocked?: boolean;
  isPreviewMode?: boolean;
  getAccessToken: () => Promise<string | null>;
  onToggleMemory: () => void;
  onChangeResponseMode: (mode: 'simple' | 'detailed') => void;
  onSwitchProfile: (profileId: string | null) => void;
  onAddExtraProfile: (profileId: string) => void;
  onRemoveExtraProfile: (profileId: string) => void;
  onAddAttachments: (files: ChatAttachmentInput[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onClearReply: () => void;
  onOpenMyPrompts: () => void;
  onOpenSettings: () => void;
  onOpenAddChartModal?: () => void;
  onNewChat: () => void;
  onSendMessage: (overrideText?: string, options?: { curatedStarter?: boolean }) => void;
  onStopGeneration: () => void;
  pendingDirectiveLabel?: string | null;
  onClearPendingDirective?: () => void;
  focusTrigger?: number;
  composerPlaceholder?: string;
  enableVoiceInput?: boolean;
  enableAttachments?: boolean;
  enableQuickTools?: boolean;
  deepAudit?: boolean;
  canUseDeepAudit?: boolean;
  onToggleDeepAudit?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex?: number;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const MAX_ATTACHMENTS = 4;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
const MIN_TOOL_WORDS = 5;

const getProfileDisplayLabel = (p: ChatProfile): string => {
  const short = p.short_name?.trim();
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || p.name;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

async function compressImageFile(file: File): Promise<ChatAttachmentInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format'));
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'image',
            name: file.name || 'image.jpg',
            mimeType: file.type || 'image/jpeg',
            sizeBytes: file.size,
            dataUrl: String(reader.result || ''),
          });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outUrl = canvas.toDataURL('image/jpeg', 0.84);
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'image',
          name: file.name || 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: Math.round((outUrl.length * 3) / 4),
          dataUrl: outUrl,
        });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function readPdfFile(file: File): Promise<ChatAttachmentInput> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`"${file.name}" exceeds the 6 MB PDF limit.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => {
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'pdf',
        name: file.name || 'document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  });
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  activePillar,
  activeCompanionPersona = null,
  tabs,
  activeTabId,
  maxActiveTabs = 10,
  pastCompanionConversations,
  recentConversations,
  isStreamingTabId = null,
  composerDisabled = false,
  composerDisabledHint,
  onSelectTab,
  onCloseTab,
  onReorderTabs,
  onRenameTab,
  onAddCouncilTab,
  onAddCompanionArchetypeTab,
  onOpenExistingConversationAsTab,
  onResetClarity,
  onStartNewCompanion,
  draftText,
  onDraftChange,
  catalog,
  profiles,
  activeProfileId,
  extraProfileIds,
  attachments,
  expertSlug,
  languageSlug,
  useFullProfileMemory,
  responseMode,
  replyTarget,
  activeFollowups,
  customPrompts,
  isStreaming,
  isThreadLocked = false,
  isPreviewMode = false,
  getAccessToken,
  onToggleMemory,
  onChangeResponseMode,
  onSwitchProfile,
  onAddExtraProfile,
  onRemoveExtraProfile,
  onAddAttachments,
  onRemoveAttachment,
  onClearReply,
  onOpenMyPrompts,
  onOpenSettings,
  onOpenAddChartModal,
  onNewChat,
  onSendMessage,
  onStopGeneration,
  pendingDirectiveLabel = null,
  onClearPendingDirective,
  focusTrigger = 0,
  composerPlaceholder = '',
  enableVoiceInput = true,
  enableAttachments = true,
  enableQuickTools = true,
  deepAudit = false,
  canUseDeepAudit = false,
  onToggleDeepAudit,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Inline tool states (all 3 tools activate when >= 5 words are typed)
  const [inlineToolRunning, setInlineToolRunning] = useState<
    'prompt_expander' | 'prompt_optimizer' | 'question_generator' | null
  >(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    previousText: string;
    label: string;
  } | null>(null);
  const [qGenItems, setQGenItems] = useState<string[]>([]);
  const [showQuestionResults, setShowQuestionResults] = useState(false);

  // '+' Dropup Menu + Attached Side Mega-Menu (Desktop) / Inline Drawer (Mobile)
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [plusSubMenu, setPlusSubMenu] = useState<'profiles' | 'prompts' | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRootRef = useRef<HTMLDivElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseVoiceDraftRef = useRef<string>('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = useMemo(
    () => draftText.trim().split(/\s+/).filter(Boolean).length,
    [draftText]
  );
  const areToolsActive = wordCount >= MIN_TOOL_WORDS;

  // Auto-grow textarea from compact single-line default height (24px) up to 150px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 24), 150);
    el.style.height = `${nextHeight}px`;
  }, [draftText]);

  // Focus textarea when explicitly requested (e.g., after picking General Chart or a profile)
  useEffect(() => {
    if (focusTrigger > 0) {
      window.setTimeout(() => textareaRef.current?.focus(), 40);
    }
  }, [focusTrigger]);

  // Reset pillar-specific submenus when switching pillar/tab
  useEffect(() => {
    setPlusSubMenu(null);
    setIsPlusOpen(false);
    setShowQuestionResults(false);
  }, [activePillar, activeTabId]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // Reliable outside-click dismissal for expanded panel AND '+' menu (respects portaled CustomSelect menus)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      // Keep expanded panel open when interacting with portaled CustomSelect listboxes
      if (target.closest('[role="listbox"]')) {
        return;
      }

      if (composerRootRef.current && composerRootRef.current.contains(target)) {
        // Inside composer, still close '+' menu if user clicked outside '+' menu container
        if (plusMenuRef.current && !plusMenuRef.current.contains(target)) {
          setIsPlusOpen(false);
          setPlusSubMenu(null);
        }
        return;
      }

      // Clicked anywhere outside composer -> close '+', expanded drawer, and question suggestions
      setIsPlusOpen(false);
      setPlusSubMenu(null);
      setIsExpanded(false);
      setShowQuestionResults(false);
    };

    const handleKeyDownWindow = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlusOpen(false);
        setPlusSubMenu(null);
        setShowQuestionResults(false);
        setIsExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDownWindow);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDownWindow);
    };
  }, []);

  const showSlashPrompts = useMemo(() => {
    if (!draftText.startsWith('/')) return false;
    return !draftText.includes('\n') && draftText.length <= 24 && customPrompts.length > 0;
  }, [draftText, customPrompts.length]);

  const filteredSlashPrompts = useMemo(() => {
    if (!showSlashPrompts) return [];
    const q = draftText.slice(1).trim().toLowerCase();
    if (!q) return customPrompts;
    return customPrompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.prompt_text.toLowerCase().includes(q)
    );
  }, [showSlashPrompts, draftText, customPrompts]);

  const attachedExtraProfiles = useMemo(
    () =>
      extraProfileIds
        .map((id) => profiles.find((p) => p.id === id))
        .filter((p): p is ChatProfile => Boolean(p)),
    [extraProfileIds, profiles]
  );

  const toggleVoiceInput = () => {
    setComposerNotice(null);

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setComposerNotice(
        'Voice dictation is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = languageSlug === 'Hindi' ? 'hi-IN' : 'en-IN';
      baseVoiceDraftRef.current = draftText.trim();

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i]?.[0]?.transcript || '';
        }
        const cleaned = transcript.trim();
        if (cleaned) {
          const base = baseVoiceDraftRef.current;
          onDraftChange(base ? `${base} ${cleaned}` : cleaned);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setComposerNotice('Microphone input ended or permission was denied.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setComposerNotice('Unable to start microphone capture.');
    }
  };

  const processSelectedFiles = async (fileList: FileList | File[]) => {
    setComposerNotice(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setComposerNotice(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }

    const queue = files.slice(0, remainingSlots);
    const processed: ChatAttachmentInput[] = [];

    for (const file of queue) {
      try {
        if (file.type.startsWith('image/')) {
          processed.push(await compressImageFile(file));
        } else if (
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf')
        ) {
          processed.push(await readPdfFile(file));
        } else {
          setComposerNotice('Only Image files (JPG, PNG, WebP) and PDFs are supported.');
        }
      } catch (err) {
        setComposerNotice(err instanceof Error ? err.message : 'Unable to attach file.');
      }
    }

    if (processed.length > 0) {
      onAddAttachments(processed);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!enableAttachments) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) {
          files.push(f);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void processSelectedFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!enableAttachments) return;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void processSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleRunInlineTool = async (
    toolSlug: 'prompt_expander' | 'prompt_optimizer'
  ) => {
    if (!areToolsActive || inlineToolRunning) return;
    setComposerNotice(null);
    setShowQuestionResults(false);
    setIsPlusOpen(false);
    setPlusSubMenu(null);

    if (isPreviewMode) {
      setComposerNotice('This is a preview, login to run AI prompt tools.');
      return;
    }

    const current = draftText.trim();
    setInlineToolRunning(toolSlug);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to use prompt tools.');

      const res = await fetch('/api/chat/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toolSlug,
          inputText: current,
          modeSlug: expertSlug === 'learn_astrology' ? 'learn_astrology' : 'general',
          languageSlug,
          profileId: activeProfileId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.resultText) {
        throw new Error(data.error || 'Tool refinement failed.');
      }

      setUndoSnapshot({
        previousText: draftText,
        label: toolSlug === 'prompt_expander' ? 'Expanded' : 'Optimized',
      });
      onDraftChange(String(data.resultText).trim());
      window.setTimeout(() => textareaRef.current?.focus(), 40);
    } catch (err) {
      setComposerNotice(err instanceof Error ? err.message : 'Unable to refine prompt.');
    } finally {
      setInlineToolRunning(null);
    }
  };

  const handleRunQuestionGenerator = async () => {
    if (!areToolsActive || inlineToolRunning) return;
    setComposerNotice(null);
    setIsPlusOpen(false);
    setPlusSubMenu(null);

    if (isPreviewMode) {
      setComposerNotice('This is a preview, login to generate personalized questions.');
      return;
    }

    setInlineToolRunning('question_generator');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to generate questions.');

      const res = await fetch('/api/chat/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toolSlug: 'question_generator',
          inputText: draftText.trim(),
          modeSlug: expertSlug === 'learn_astrology' ? 'learn_astrology' : 'general',
          languageSlug,
          profileId: activeProfileId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate questions.');
      }
      const generated = Array.isArray(data.items) ? data.items : [];
      setQGenItems(generated);
      setShowQuestionResults(generated.length > 0);
    } catch (err) {
      setComposerNotice(err instanceof Error ? err.message : 'Question generation failed.');
    } finally {
      setInlineToolRunning(null);
    }
  };

  const handleSelectProfileFromPlus = (profileId: string) => {
    if (!activeProfileId && !isThreadLocked) {
      onSwitchProfile(profileId);
      setIsPlusOpen(false);
      setPlusSubMenu(null);
      return;
    }
    if (profileId === activeProfileId) {
      setIsPlusOpen(false);
      setPlusSubMenu(null);
      return;
    }
    if (extraProfileIds.includes(profileId)) {
      onRemoveExtraProfile(profileId);
    } else {
      onAddExtraProfile(profileId);
    }
    setIsPlusOpen(false);
    setPlusSubMenu(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (composerDisabled || isStreaming || inlineToolRunning) return;
      if (isPreviewMode) {
        onSendMessage(draftText.trim() || 'preview');
        return;
      }

      const trimmed = draftText.trim();
      if (
        activePillar === 'council' &&
        /^[1-6]$/.test(trimmed) &&
        activeFollowups.length > 0 &&
        attachments.length === 0
      ) {
        const idx = Number(trimmed) - 1;
        if (activeFollowups[idx]) {
          onDraftChange('');
          onSendMessage(activeFollowups[idx], { curatedStarter: true });
          return;
        }
      }

      if (trimmed || attachments.length > 0) {
        setUndoSnapshot(null);
        setShowQuestionResults(false);
        onSendMessage();
      }
    }
  };

  const canSend =
    !composerDisabled &&
    !isStreaming &&
    !inlineToolRunning &&
    (Boolean(draftText.trim()) || attachments.length > 0);

  const effectivePlaceholder = useMemo(() => {
    if (composerDisabled) {
      return composerDisabledHint || 'Choose a companion above to begin talking...';
    }
    if (activePillar === 'companion') {
      return activeCompanionPersona
        ? `Message ${activeCompanionPersona.name}...`
        : 'Choose a companion above to start talking...';
    }
    if (activePillar === 'clarity') {
      return 'Ask Clarity a quick doubt, untangle a thought, or refine a prompt...';
    }
    return composerPlaceholder || 'Ask anything about your chart, timing, or Vedic astrology...';
  }, [
    composerDisabled,
    composerDisabledHint,
    activePillar,
    activeCompanionPersona,
    composerPlaceholder,
  ]);

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 bg-transparent px-2.5 sm:px-4 md:px-6 pb-3 pt-1">
      {/* Seamless #FAF7F2 canvas floor from behind lower half of input box to viewport bottom so scrolled text vanishes behind the box and never peeks underneath */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58px] bg-gradient-to-t from-[#FAF7F2] from-50% to-transparent"
      />
      <div
        ref={composerRootRef}
        className="pointer-events-auto mx-auto max-w-3xl min-w-0 space-y-1.5 relative"
      >
        {/* Hidden File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void processSelectedFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void processSelectedFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Quoted Reply Banner */}
        {replyTarget && (
          <div className="animate-cc-drawer-in flex items-start justify-between gap-3 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/15 px-3.5 py-2 text-xs shadow-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-[#3D3830]">
                <Reply className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Replying to insight</span>
              </div>
              <p className="mt-0.5 text-[#5C5449] line-clamp-1">{replyTarget.content}</p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="p-1 text-[#8B8275] hover:text-[#3D3830]"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Attached Deeper Analysis Focus Notice (when inserted via '+' for editing) */}
        {pendingDirectiveLabel && (
          <div className="animate-cc-drawer-in flex items-center justify-between gap-2 rounded-xl bg-[#F1ECE3] border border-[#B8965A]/30 px-3 py-1.5 text-[11px] text-[#5C5449] shadow-sm">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Sparkles className="h-3 w-3 text-[#B8965A] shrink-0" />
              <span className="truncate">
                Deeper analysis focus attached · Edit your question freely or press send
              </span>
            </span>
            {onClearPendingDirective && (
              <button
                type="button"
                onClick={onClearPendingDirective}
                aria-label="Clear deeper analysis focus"
                className="text-[#8B8275] hover:text-[#3D3830] shrink-0 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Inline Tool Undo Chip */}
        {undoSnapshot && (
          <div className="animate-cc-drawer-in flex items-center justify-between gap-2 rounded-xl bg-[#F1ECE3] border border-[#3D3830]/15 px-3 py-1.5 text-[11px] text-[#5C5449] shadow-sm">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#B8965A]" />
              <span>Prompt {undoSnapshot.label.toLowerCase()} inline</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onDraftChange(undoSnapshot.previousText);
                  setUndoSnapshot(null);
                  textareaRef.current?.focus();
                }}
                className="inline-flex items-center gap-1 font-medium text-[#3D3830] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => setUndoSnapshot(null)}
                aria-label="Dismiss notice"
                className="text-[#8B8275] hover:text-[#3D3830]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Active Voice Dictation Indicator */}
        {isListening && (
          <div className="animate-cc-drawer-in flex items-center justify-between gap-2 rounded-xl bg-[#FDFBF7] border border-[#7A3E36]/25 px-3.5 py-2 text-xs text-[#7A3E36] shadow-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-[#7A3E36] animate-pulse" />
              <span>Listening… speak naturally, tap Stop when done</span>
            </span>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className="rounded-full bg-[#7A3E36] px-2.5 py-0.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#64322B] transition-colors cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}

        {/* Transient Notice (above floating composer so no background bar underneath) */}
        {composerNotice && (
          <div className="animate-cc-drawer-in flex items-center justify-between gap-2 rounded-xl bg-[#FDFBF7] border border-[#7A3E36]/25 px-3 py-1.5 text-[11px] text-[#7A3E36] shadow-sm">
            <span>{composerNotice}</span>
            <button
              type="button"
              onClick={() => setComposerNotice(null)}
              aria-label="Dismiss notice"
              className="text-[#7A3E36]/75 hover:text-[#7A3E36]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Question Generator Results Sheet (no separate input — powered directly by main input box) */}
        {showQuestionResults && qGenItems.length > 0 && (
          <div className="animate-cc-drawer-in rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 shadow-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-[#B8965A]" />
                <span className="text-xs font-medium text-[#3D3830]">
                  Suggested Questions from Your Draft
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionResults(false)}
                className="p-1 rounded-full text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                aria-label="Close generated questions"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
              {qGenItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                >
                  <span className="leading-snug flex-1">{item}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onDraftChange(item);
                        setShowQuestionResults(false);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-lg border border-[#3D3830]/15 px-2 py-1 text-[10px] font-medium text-[#5C5449] hover:bg-[#F1ECE3] cursor-pointer"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuestionResults(false);
                        onSendMessage(item, { curatedStarter: true });
                      }}
                      className="rounded-lg bg-[#4A453D] px-2 py-1 text-[10px] font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
                    >
                      Ask
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slash-Command My Prompts Quick Palette */}
        {showSlashPrompts && (
          <div className="animate-cc-drawer-in absolute bottom-full left-0 right-0 mb-2 z-40 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-2 shadow-xl max-h-52 overflow-y-auto space-y-1">
            <div className="px-2.5 py-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8B8275]">
              <span>My Prompts</span>
              <span>Tap to insert</span>
            </div>
            {filteredSlashPrompts.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-[#8B8275]">No matching saved prompt.</p>
            ) : (
              filteredSlashPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onDraftChange(p.prompt_text);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  <p className="text-xs font-medium text-[#3D3830] truncate">{p.title}</p>
                  <p className="text-[11px] text-[#8B8275] truncate">{p.prompt_text}</p>
                </button>
              ))
            )}
          </div>
        )}

        {/* UNIFIED COMPOSER CARD WITH RECESSED SEGMENTED TOP TRAY */}
        <div
          onDragOver={(e) => {
            if (composerDisabled) return;
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`relative rounded-2xl border shadow-[0_12px_36px_-14px_rgba(31,34,41,0.22)] transition-colors ${
            isDraggingOver
              ? 'border-[#B8965A] bg-[#FBF6EC]'
              : 'border-[#3D3830]/[0.18] bg-[#FDFBF7] focus-within:border-[#3D3830]/35'
          }`}
        >
          {/* Recessed Segmented Tab Tray Flush Top Cap (Zero transparent gaps) */}
          <ComposerTabStrip
            tabs={tabs}
            activeTabId={activeTabId}
            maxTabs={maxActiveTabs}
            catalog={catalog}
            pastCompanionConversations={pastCompanionConversations}
            recentConversations={recentConversations}
            isStreamingTabId={isStreamingTabId}
            isExpanded={isExpanded}
            onToggleExpand={() => {
              setIsExpanded((prev) => {
                const next = !prev;
                if (next) {
                  setIsPlusOpen(false);
                  setPlusSubMenu(null);
                }
                return next;
              });
            }}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onReorderTabs={onReorderTabs}
            onRenameTab={onRenameTab}
            onAddCouncilTab={onAddCouncilTab}
            onAddCompanionArchetypeTab={onAddCompanionArchetypeTab}
            onOpenExistingConversationAsTab={onOpenExistingConversationAsTab}
          />

          {/* Main Input Body */}
          <div className="px-3 pt-2 pb-1.5 rounded-b-[15px]">
            {/* SMOOTH SLIDING ADAPTIVE EXPANDED PANEL (Council vs Companion vs Clarity) */}
            <div
              aria-hidden={!isExpanded}
              className={`grid transition-[grid-template-rows,opacity,transform,margin] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isExpanded
                  ? 'grid-rows-[1fr] opacity-100 translate-y-0 mb-1.5'
                  : 'grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none mb-0'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                {activePillar === 'council' ? (
                  <div className="border-b border-[#3D3830]/10 pb-2.5 pt-0.5">
                    {/* Single Clean Row: Left = [ Question | Expander | Optimizer ], Right = [ Technical | Detailed | Memory | Settings ] */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {enableQuickTools && (
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <Tooltip
                            content={
                              areToolsActive
                                ? 'Generate deeper follow-up questions from your draft'
                                : 'Type at least 5 words to activate Question Generator'
                            }
                            placement="top"
                          >
                            <button
                              type="button"
                              disabled={!areToolsActive || inlineToolRunning !== null}
                              onClick={() => void handleRunQuestionGenerator()}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                                areToolsActive
                                  ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E] shadow-xs cursor-pointer'
                                  : 'border-[#3D3830]/10 bg-[#F1ECE3]/55 text-[#8B8275] opacity-50 cursor-not-allowed'
                              }`}
                            >
                              {inlineToolRunning === 'question_generator' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <HelpCircle className="h-3 w-3" />
                              )}
                              <span>Question Generator</span>
                            </button>
                          </Tooltip>

                          <Tooltip
                            content={
                              areToolsActive
                                ? 'Expand your draft inline'
                                : 'Type at least 5 words to activate Expander'
                            }
                            placement="top"
                          >
                            <button
                              type="button"
                              disabled={!areToolsActive || inlineToolRunning !== null}
                              onClick={() => void handleRunInlineTool('prompt_expander')}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                                areToolsActive
                                  ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E] shadow-xs cursor-pointer'
                                  : 'border-[#3D3830]/10 bg-[#F1ECE3]/55 text-[#8B8275] opacity-50 cursor-not-allowed'
                              }`}
                            >
                              {inlineToolRunning === 'prompt_expander' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              <span>Expander</span>
                            </button>
                          </Tooltip>

                          <Tooltip
                            content={
                              areToolsActive
                                ? 'Optimize your draft inline'
                                : 'Type at least 5 words to activate Optimizer'
                            }
                            placement="top"
                          >
                            <button
                              type="button"
                              disabled={!areToolsActive || inlineToolRunning !== null}
                              onClick={() => void handleRunInlineTool('prompt_optimizer')}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                                areToolsActive
                                  ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E] shadow-xs cursor-pointer'
                                  : 'border-[#3D3830]/10 bg-[#F1ECE3]/55 text-[#8B8275] opacity-50 cursor-not-allowed'
                              }`}
                            >
                              {inlineToolRunning === 'prompt_optimizer' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3" />
                              )}
                              <span>Optimizer</span>
                            </button>
                          </Tooltip>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                        <div
                          role="group"
                          aria-label="Response depth mode"
                          className="inline-flex items-center rounded-full border border-[#3D3830]/12 bg-[#F1ECE3] p-0.5"
                        >
                          <Tooltip
                            content="Crisp, everyday-friendly reading with expandable astrological breakdown"
                            placement="top"
                          >
                            <button
                              type="button"
                              aria-pressed={responseMode === 'simple'}
                              onClick={() => onChangeResponseMode('simple')}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                responseMode === 'simple'
                                  ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                                  : 'text-[#5C5449] hover:text-[#3D3830]'
                              }`}
                            >
                              Simple
                            </button>
                          </Tooltip>
                          <Tooltip
                            content="Comprehensive reading free to explain technical astrology inline"
                            placement="top"
                          >
                            <button
                              type="button"
                              aria-pressed={responseMode === 'detailed'}
                              onClick={() => onChangeResponseMode('detailed')}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                responseMode === 'detailed'
                                  ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                                  : 'text-[#5C5449] hover:text-[#3D3830]'
                              }`}
                            >
                              Detailed
                            </button>
                          </Tooltip>
                        </div>

                        <Tooltip content="Chat Settings" placement="top">
                          <button
                            type="button"
                            onClick={onOpenSettings}
                            aria-label="Open Chat Settings"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ) : activePillar === 'companion' ? (
                  /* COMPANION ADAPTIVE CONTROL PANEL: Companion Bio + Match another, Memory, Settings */
                  <div className="border-b border-[#3D3830]/10 pb-2.5 pt-0.5 space-y-2">
                    {activeCompanionPersona ? (
                      <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAE3D7] font-serif text-sm font-semibold text-[#3D3830]">
                          {activeCompanionPersona.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-semibold text-[#3D3830] truncate">
                            {activeCompanionPersona.name}{' '}
                            <span className="font-['DM_Sans',sans-serif] text-[11px] font-normal tabular-nums text-[#8B8275]">
                              {activeCompanionPersona.age}
                            </span>
                            <span className="font-normal text-[#5C5449]">
                              {' '}· {activeCompanionPersona.role_label}
                            </span>
                          </p>
                          <p className="text-[11px] text-[#5C5449] leading-snug line-clamp-2">
                            {activeCompanionPersona.bio}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-[#5C5449] py-1">
                        <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
                        <span>Select a companion above to view their profile and begin chatting.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {onStartNewCompanion && activeCompanionPersona && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsExpanded(false);
                            onStartNewCompanion();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3 text-[#8B7355]" />
                          <span>Match another</span>
                        </button>
                      )}
                      <Tooltip
                        content="Keep continuity across your companion conversation (separate from your birth chart)"
                        placement="top"
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={useFullProfileMemory}
                          aria-label="Toggle companion conversation memory"
                          onClick={onToggleMemory}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-2 py-1 text-[11px] text-[#3D3830] hover:border-[#3D3830]/25 transition-colors cursor-pointer"
                        >
                          <span
                            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                              useFullProfileMemory ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full bg-[#FDFBF7] shadow-xs transition-transform duration-200 ${
                                useFullProfileMemory ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </span>
                          <Brain className="h-3 w-3 text-[#8B7355]" />
                          <span className="font-medium select-none">Memory</span>
                        </button>
                      </Tooltip>
                      <Tooltip content="Chat Settings" placement="top">
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          aria-label="Open Chat Settings"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  /* CLARITY ADAPTIVE CONTROL PANEL: Info + Clear Clarity, Memory (default OFF), Settings */
                  <div className="border-b border-[#3D3830]/10 pb-2.5 pt-0.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Lightbulb className="h-3.5 w-3.5 text-[#B8965A] mt-0.5 shrink-0" />
                      <p className="text-[11px] text-[#5C5449] leading-relaxed">
                        <span className="font-semibold text-[#3D3830]">Clarity</span> · Off-record sidekick for quick doubts, prompt drafting &amp; general questions. Never mixed with your birth chart memory.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      {onResetClarity && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsExpanded(false);
                            onResetClarity();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3 text-[#8B7355]" />
                          <span>Clear Clarity</span>
                        </button>
                      )}
                      <Tooltip
                        content="Off by default — Clarity stays off-record and never touches your birth chart memory"
                        placement="top"
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={useFullProfileMemory}
                          aria-label="Toggle Clarity memory"
                          onClick={onToggleMemory}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-2 py-1 text-[11px] text-[#3D3830] hover:border-[#3D3830]/25 transition-colors cursor-pointer"
                        >
                          <span
                            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                              useFullProfileMemory ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full bg-[#FDFBF7] shadow-xs transition-transform duration-200 ${
                                useFullProfileMemory ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </span>
                          <Brain className="h-3 w-3 text-[#8B7355]" />
                          <span className="font-medium select-none">Memory</span>
                        </button>
                      </Tooltip>
                      <Tooltip content="Chat Settings" placement="top">
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          aria-label="Open Chat Settings"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attachment & Extra Profile Chips (0px when empty) */}
            {(attachments.length > 0 || (activePillar === 'council' && attachedExtraProfiles.length > 0)) && (
              <div className="mb-1.5 flex items-center gap-2 overflow-x-auto pb-1">
                {activePillar === 'council' && attachedExtraProfiles.map((prof) => (
                  <div
                    key={`prof-${prof.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#B8965A]/35 bg-[#F1ECE3] px-2.5 py-1 text-[11px] text-[#3D3830] shrink-0"
                  >
                    <UserPlus className="h-3 w-3 text-[#8B7355]" />
                    <span className="font-medium max-w-[130px] truncate">
                      {getProfileDisplayLabel(prof)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveExtraProfile(prof.id)}
                      aria-label={`Remove ${prof.name}`}
                      className="ml-0.5 text-[#8B8275] hover:text-[#3D3830]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-2 py-1 text-[11px] text-[#3D3830] shrink-0"
                  >
                    {att.kind === 'image' ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="h-6 w-6 rounded-md object-cover border border-[#3D3830]/10"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-[#7A3E36] shrink-0" />
                    )}
                    <div className="min-w-0 max-w-[130px]">
                      <p className="truncate font-medium leading-tight">{att.name}</p>
                      <p className="text-[9px] text-[#8B8275] font-['DM_Sans',sans-serif]">
                        {formatBytes(att.sizeBytes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      aria-label={`Remove ${att.name}`}
                      className="text-[#8B8275] hover:text-[#3D3830]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CLAUDE-STYLE FULL-WIDTH COMPACT INPUT + BOTTOM CONTROL BAR */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={draftText}
              disabled={composerDisabled || inlineToolRunning !== null}
              placeholder={effectivePlaceholder}
              onChange={(e) => {
                onDraftChange(e.target.value);
                if (undoSnapshot) setUndoSnapshot(null);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label="Message input"
              className="w-full resize-none bg-transparent px-1 py-0 text-sm text-[#3D3830] placeholder:text-[#8B8275]/80 leading-[22px] focus:outline-none disabled:opacity-55 disabled:cursor-not-allowed"
            />

            {/* Bottom Row: Bottom-Left '+' Menu | Bottom-Right Voice + Send */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {/* Bottom-Left: '+' Button + Dropup + Attached Side Mega-Menu (Desktop) / Inline Drawer (Mobile) */}
              <div ref={plusMenuRef} className="relative">
                <button
                  type="button"
                  disabled={composerDisabled}
                  onClick={() => {
                    setIsPlusOpen((v) => {
                      const next = !v;
                      if (!next) setPlusSubMenu(null);
                      return next;
                    });
                    setShowQuestionResults(false);
                  }}
                  aria-expanded={isPlusOpen}
                  aria-label="Add image, PDF, profile, saved prompt, or start new chat"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    isPlusOpen
                      ? 'border-[#3D3830]/30 bg-[#4A453D] text-[#FAF7F2]'
                      : 'border-[#3D3830]/12 bg-[#F1ECE3] text-[#3D3830] hover:bg-[#EAE3D7]'
                  }`}
                >
                  <Plus
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isPlusOpen ? 'rotate-45' : ''
                    }`}
                  />
                </button>

                {isPlusOpen && (
                  <div className="animate-cc-dropdown-up absolute bottom-full left-0 mb-2.5 z-40">
                    {/* Mobile Inline Drawer View when sub-menu active on < md */}
                    {plusSubMenu !== null && (
                      <div className="md:hidden w-64 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-1.5 shadow-xl">
                        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#3D3830]/10 mb-1">
                          <button
                            type="button"
                            onClick={() => setPlusSubMenu(null)}
                            className="text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            &larr; Back
                          </button>
                          <span className="text-[10px] uppercase tracking-wider text-[#8B8275]">
                            {plusSubMenu === 'profiles' ? 'Saved Profiles' : `My Prompts (${customPrompts.length}/10)`}
                          </span>
                        </div>

                        {plusSubMenu === 'profiles' ? (
                          <div>
                            {profiles.length === 0 ? (
                              <div className="px-2.5 py-2.5 space-y-2">
                                <p className="text-xs text-[#8B8275]">
                                  No birth details saved yet.
                                </p>
                                {onOpenAddChartModal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsPlusOpen(false);
                                      setPlusSubMenu(null);
                                      onOpenAddChartModal();
                                    }}
                                    className="w-full min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Birth Details</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="max-h-52 overflow-y-auto space-y-0.5">
                                  {profiles.map((prof) => {
                                    const isPrimary = prof.id === activeProfileId;
                                    const isAdded = extraProfileIds.includes(prof.id);
                                    return (
                                      <button
                                        key={prof.id}
                                        type="button"
                                        onClick={() => handleSelectProfileFromPlus(prof.id)}
                                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors text-left cursor-pointer ${
                                          isPrimary || isAdded
                                            ? 'bg-[#F1ECE3] font-medium text-[#3D3830]'
                                            : 'text-[#5C5449] hover:bg-[#F1ECE3]/60 hover:text-[#3D3830]'
                                        }`}
                                      >
                                        <span className="truncate">
                                          {getProfileDisplayLabel(prof)}
                                        </span>
                                        {(isPrimary || isAdded) && (
                                          <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {onOpenAddChartModal && (
                                  <div className="border-t border-[#3D3830]/10 mt-1 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsPlusOpen(false);
                                        setPlusSubMenu(null);
                                        onOpenAddChartModal();
                                      }}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7]/75 transition-colors cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3 text-[#8B7355]" />
                                      <span>Add Birth Details</span>
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="max-h-52 overflow-y-auto space-y-0.5">
                              {customPrompts.length === 0 ? (
                                <p className="px-2.5 py-2.5 text-xs text-[#8B8275]">
                                  No saved prompts yet.
                                </p>
                              ) : (
                                customPrompts.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      onDraftChange(p.prompt_text);
                                      setIsPlusOpen(false);
                                      setPlusSubMenu(null);
                                      window.setTimeout(() => textareaRef.current?.focus(), 30);
                                    }}
                                    className="w-full rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                                  >
                                    <p className="text-xs font-medium text-[#3D3830] truncate">
                                      {p.title}
                                    </p>
                                  </button>
                                ))
                              )}
                            </div>
                            <div className="border-t border-[#3D3830]/10 mt-1 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsPlusOpen(false);
                                  setPlusSubMenu(null);
                                  onOpenMyPrompts();
                                }}
                                className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7]/75 transition-colors cursor-pointer"
                              >
                                <Plus className="h-3 w-3 text-[#8B7355]" />
                                <span>
                                  {customPrompts.length === 0
                                    ? 'Create First Prompt'
                                    : 'Manage Prompts'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main '+' Dropup Menu (Always visible on md+, hidden on mobile only when sub-drawer is open) */}
                    <div
                      className={`relative ${
                        plusSubMenu !== null ? 'hidden md:block' : 'block'
                      } w-56 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-1.5 shadow-xl`}
                    >
                      <div className="space-y-0.5">
                        {enableAttachments && (
                          <>
                            <button
                              type="button"
                              onMouseEnter={() => setPlusSubMenu(null)}
                              onClick={() => {
                                setIsPlusOpen(false);
                                setPlusSubMenu(null);
                                imageInputRef.current?.click();
                              }}
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors text-left cursor-pointer"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-[#8B7355]" />
                              <span>Image</span>
                            </button>

                            <button
                              type="button"
                              onMouseEnter={() => setPlusSubMenu(null)}
                              onClick={() => {
                                setIsPlusOpen(false);
                                setPlusSubMenu(null);
                                pdfInputRef.current?.click();
                              }}
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors text-left cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5 text-[#8B7355]" />
                              <span>PDF</span>
                            </button>
                          </>
                        )}

                        {activePillar === 'council' && (
                          <button
                            type="button"
                            onMouseEnter={() => setPlusSubMenu('profiles')}
                            onClick={() =>
                              setPlusSubMenu((s) => (s === 'profiles' ? null : 'profiles'))
                            }
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                              plusSubMenu === 'profiles'
                                ? 'bg-[#F1ECE3] text-[#3D3830]'
                                : 'text-[#3D3830] hover:bg-[#F1ECE3]'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2.5">
                              <UserPlus className="h-3.5 w-3.5 text-[#8B7355]" />
                              <span>Profile</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-[#8B8275]" />
                          </button>
                        )}

                        <button
                          type="button"
                          onMouseEnter={() => setPlusSubMenu('prompts')}
                          onClick={() =>
                            setPlusSubMenu((s) => (s === 'prompts' ? null : 'prompts'))
                          }
                          className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                            plusSubMenu === 'prompts'
                              ? 'bg-[#F1ECE3] text-[#3D3830]'
                              : 'text-[#3D3830] hover:bg-[#F1ECE3]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Bookmark className="h-3.5 w-3.5 text-[#8B7355]" />
                            <span>My Prompts ({customPrompts.length})</span>
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-[#8B8275]" />
                        </button>

                        <div className="my-1 border-t border-[#3D3830]/10" />

                        <button
                          type="button"
                          onMouseEnter={() => setPlusSubMenu(null)}
                          onClick={() => {
                            setIsPlusOpen(false);
                            setPlusSubMenu(null);
                            if (activePillar === 'companion' && onStartNewCompanion) {
                              onStartNewCompanion();
                            } else if (activePillar === 'clarity' && onResetClarity) {
                              onResetClarity();
                            } else {
                              onNewChat();
                            }
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors text-left cursor-pointer"
                        >
                          <SquarePen className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {activePillar === 'companion'
                              ? 'New Companion'
                              : activePillar === 'clarity'
                              ? 'New Clarity Chat'
                              : 'New Chat'}
                          </span>
                        </button>
                      </div>

                      {/* Desktop Attached Scrollable Mega-Menu (Side Flyout) */}
                      {plusSubMenu !== null && (
                        <div className="hidden md:block animate-cc-drawer-in absolute left-full bottom-0 ml-2 z-50 w-64 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-2xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-[#F1ECE3]/85 border-b border-[#3D3830]/10">
                            <span className="text-[11px] font-medium text-[#3D3830]">
                              {plusSubMenu === 'profiles'
                                ? 'Saved Profiles'
                                : `My Prompts (${customPrompts.length}/10)`}
                            </span>
                            <span className="text-[10px] text-[#8B8275]">
                              {plusSubMenu === 'profiles' ? 'Select chart' : 'Click to insert'}
                            </span>
                          </div>

                          {plusSubMenu === 'profiles' ? (
                            <div>
                              <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                                {profiles.length === 0 ? (
                                  <div className="px-2.5 py-2.5 space-y-2.5">
                                    <p className="text-xs text-[#8B8275]">
                                      No birth details saved yet.
                                    </p>
                                    {onOpenAddChartModal && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsPlusOpen(false);
                                          setPlusSubMenu(null);
                                          onOpenAddChartModal();
                                        }}
                                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add Birth Details</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  profiles.map((prof) => {
                                    const isPrimary = prof.id === activeProfileId;
                                    const isAdded = extraProfileIds.includes(prof.id);
                                    return (
                                      <button
                                        key={prof.id}
                                        type="button"
                                        onClick={() => handleSelectProfileFromPlus(prof.id)}
                                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors text-left cursor-pointer ${
                                          isPrimary || isAdded
                                            ? 'bg-[#F1ECE3] font-medium text-[#3D3830]'
                                            : 'text-[#5C5449] hover:bg-[#F1ECE3]/60 hover:text-[#3D3830]'
                                        }`}
                                      >
                                        <span className="truncate">
                                          {getProfileDisplayLabel(prof)}
                                        </span>
                                        {(isPrimary || isAdded) && (
                                          <Check className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                              {profiles.length > 0 && onOpenAddChartModal && (
                                <div className="border-t border-[#3D3830]/10 p-1.5 bg-[#FAF7F2]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsPlusOpen(false);
                                      setPlusSubMenu(null);
                                      onOpenAddChartModal();
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7]/75 transition-colors cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3 text-[#8B7355]" />
                                    <span>Add Birth Details</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                                {customPrompts.length === 0 ? (
                                  <p className="px-2.5 py-2.5 text-xs text-[#8B8275]">
                                    No saved prompts yet. Save reusable questions to insert anytime.
                                  </p>
                                ) : (
                                  customPrompts.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        onDraftChange(p.prompt_text);
                                        setIsPlusOpen(false);
                                        setPlusSubMenu(null);
                                        window.setTimeout(() => textareaRef.current?.focus(), 30);
                                      }}
                                      className="w-full rounded-xl px-2.5 py-2 text-left hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                                    >
                                      <p className="text-xs font-medium text-[#3D3830] truncate">
                                        {p.title}
                                      </p>
                                    </button>
                                  ))
                                )}
                              </div>
                              <div className="border-t border-[#3D3830]/10 p-1.5 bg-[#FAF7F2]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPlusOpen(false);
                                    setPlusSubMenu(null);
                                    onOpenMyPrompts();
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7]/75 transition-colors cursor-pointer"
                                >
                                  <Plus className="h-3 w-3 text-[#8B7355]" />
                                  <span>
                                    {customPrompts.length === 0
                                      ? 'Create First Prompt'
                                      : 'Manage Prompts'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom-Right: Optional Deep Audit Toggle + Voice + Send/Stop */}
              <div className="flex items-center gap-1.5 shrink-0">
                {canUseDeepAudit && onToggleDeepAudit && (
                  <Tooltip
                    content={
                      deepAudit
                        ? 'Deep Council Audit active: runs 4 parallel system checks (Parashari, KP/Nadi, Multi-Clock Timing, Contrarian Audit) before synthesis.'
                        : 'Enable Deep Council Audit: 4 parallel system checks (Parashari, KP, Timing, Contrarian) + Truth Gate adjudication.'
                    }
                    placement="top"
                  >
                    <button
                      type="button"
                      disabled={composerDisabled || isStreaming}
                      onClick={onToggleDeepAudit}
                      aria-pressed={deepAudit}
                      aria-label={deepAudit ? 'Disable Deep Council Audit' : 'Enable Deep Council Audit'}
                      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                        deepAudit
                          ? 'border-[#B8965A]/70 bg-[#292D36] text-[#F4EFE6] shadow-xs'
                          : 'border-[#3D3830]/12 bg-[#F1ECE3] text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830]'
                      }`}
                    >
                      <Sparkles
                        className={`h-3 w-3 shrink-0 ${
                          deepAudit ? 'text-[#B8965A]' : 'text-[#8B7355]'
                        }`}
                      />
                      <span className="hidden sm:inline">Deep Audit</span>
                      <span className="sm:hidden">Deep</span>
                    </button>
                  </Tooltip>
                )}

                {enableVoiceInput && (
                  <Tooltip
                    content={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                    placement="top"
                  >
                    <button
                      type="button"
                      disabled={composerDisabled}
                      onClick={toggleVoiceInput}
                      aria-label={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                        isListening
                          ? 'bg-[#7A3E36] text-[#FAF7F2] animate-pulse'
                          : 'bg-[#F1ECE3] text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830]'
                      }`}
                    >
                      {isListening ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </Tooltip>
                )}

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    aria-label="Stop response"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#7A3E36] text-[#FAF7F2] hover:bg-[#64322B] active:scale-95 transition-all cursor-pointer"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={composerDisabled || (!isPreviewMode && !canSend)}
                    onClick={() => {
                      if (composerDisabled) return;
                      if (isPreviewMode) {
                        onSendMessage(draftText.trim() || 'preview');
                        return;
                      }
                      if (canSend) {
                        setUndoSnapshot(null);
                        setShowQuestionResults(false);
                        onSendMessage();
                      }
                    }}
                    aria-label="Send message"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#4A453D] text-[#FAF7F2] transition-all cursor-pointer ${
                      isPreviewMode && !composerDisabled
                        ? 'opacity-45 hover:opacity-65'
                        : 'hover:bg-[#38342E] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComposer;
