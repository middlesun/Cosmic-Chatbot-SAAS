/**
 * Shared client utilities for Cosmic Council identity labels,
 * zero-cost browser Speech Synthesis (One-Tap Listen), and brand-clean WhatsApp sharing.
 */

export interface UserIdentityLike {
  full_name?: string | null;
  preferred_call_name?: string | null;
  email?: string | null;
}

/**
 * Extracts only the username/ID portion before "@" (e.g. "pulpsites@gmail.com" -> "pulpsites").
 */
export function getUserEmailHandle(email?: string | null): string {
  const raw = (email || '').trim();
  if (!raw) return '';
  const atIdx = raw.indexOf('@');
  return atIdx > 0 ? raw.slice(0, atIdx) : raw;
}

/**
 * Profile pill & account UI label: Display Name first, otherwise email ID (never full @gmail.com).
 */
export function getUserProfileDisplayLabel(
  user?: UserIdentityLike | null,
  fallback = 'Account'
): string {
  const displayName = user?.full_name?.trim();
  if (displayName) return displayName;
  const handle = getUserEmailHandle(user?.email);
  return handle || fallback;
}

/**
 * Converts Markdown into clean, calm spoken prose with natural pauses and zero symbol artifacts.
 */
export function stripMarkdownForSpeech(markdown: string): string {
  if (!markdown) return '';
  let text = markdown
    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Replace markdown tables with readable comma-separated lines
    .replace(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/gm, '')
    .replace(/^\s*\|(.+)\|\s*$/gm, (_m, row: string) =>
      row
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(', ') + '.'
    )
    // Headings -> natural sentence pause
    .replace(/^#{1,6}\s+(.+)$/gm, '$1.')
    // Links [label](url) -> label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Inline code, bold, italic, strikethrough
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Blockquotes, horizontal rules, list markers
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Clean extra pipes/symbols & collapse whitespace
    .replace(/[|#*_~]/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Soften technical slash abbreviations slightly for smoother narration
  text = text.replace(/\bD(\d{1,2})\b/g, 'D $1');
  return text;
}

const LANGUAGE_TO_BCP47: Record<string, string[]> = {
  English: ['en-IN', 'en-GB', 'en-US'],
  Hinglish: ['en-IN', 'hi-IN', 'en-GB'],
  Hindi: ['hi-IN', 'en-IN'],
  Tamil: ['ta-IN', 'en-IN'],
  Telugu: ['te-IN', 'en-IN'],
  Bengali: ['bn-IN', 'en-IN'],
  Marathi: ['mr-IN', 'hi-IN', 'en-IN'],
  Gujarati: ['gu-IN', 'hi-IN', 'en-IN'],
  Kannada: ['kn-IN', 'en-IN'],
  Malayalam: ['ml-IN', 'en-IN'],
  Punjabi: ['pa-IN', 'hi-IN', 'en-IN'],
};

function pickBestSpeechVoice(
  voices: SpeechSynthesisVoice[],
  languageSlug?: string | null
): { voice: SpeechSynthesisVoice | null; lang: string } {
  const preferredLangs =
    (languageSlug && LANGUAGE_TO_BCP47[languageSlug]) || LANGUAGE_TO_BCP47.English;
  const primaryLang = preferredLangs[0] || 'en-IN';

  if (!voices.length) {
    return { voice: null, lang: primaryLang };
  }

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const vLang = (voice.lang || '').replace('_', '-');
    const vLangLower = vLang.toLowerCase();
    const nameLower = (voice.name || '').toLowerCase();

    let score = 0;

    // Exact locale preference ranking
    const exactIdx = preferredLangs.findIndex(
      (pl) => pl.toLowerCase() === vLangLower
    );
    if (exactIdx >= 0) {
      score += 100 - exactIdx * 20;
    } else {
      const baseMatches = preferredLangs.findIndex(
        (pl) => vLangLower.startsWith(pl.split('-')[0].toLowerCase())
      );
      if (baseMatches >= 0) {
        score += 55 - baseMatches * 10;
      } else {
        continue;
      }
    }

    // Strongly favor modern neural / enhanced / natural voices
    if (/natural|neural|online|enhanced|premium/.test(nameLower)) score += 35;
    if (/google|siri|neerja|prabhat|rishi|isha|samantha|ava|daniel|aria|jenny/.test(nameLower)) {
      score += 22;
    }
    if (/espeak|festival|compact/.test(nameLower)) score -= 30;
    if (voice.localService) score += 6;

    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return {
    voice: bestVoice,
    lang: bestVoice?.lang || primaryLang,
  };
}

function splitSpeechChunks(text: string, maxLen = 220): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (current && current.length + sentence.length + 1 > maxLen) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }

    while (current.length > maxLen * 1.4) {
      const breakAt = current.lastIndexOf(' ', maxLen);
      const cut = breakAt > 60 ? breakAt : maxLen;
      chunks.push(current.slice(0, cut).trim());
      current = current.slice(cut).trim();
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

let activeSpeechSessionId = 0;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  activeSpeechSessionId += 1;
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore browser cleanup quirks
    }
  }
}

export function speakMessageText(
  markdown: string,
  languageSlug: string | null | undefined,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  } = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    callbacks.onError?.();
    return false;
  }

  const cleaned = stripMarkdownForSpeech(markdown);
  if (!cleaned) {
    callbacks.onEnd?.();
    return false;
  }

  const synth = window.speechSynthesis;
  const sessionId = ++activeSpeechSessionId;

  try {
    synth.cancel();
  } catch {
    // Ignore
  }

  const chunks = splitSpeechChunks(cleaned);
  if (chunks.length === 0) {
    callbacks.onEnd?.();
    return false;
  }

  const startSpeaking = () => {
    if (sessionId !== activeSpeechSessionId) return;
    const voices = synth.getVoices();
    const { voice, lang } = pickBestSpeechVoice(voices, languageSlug);

    let index = 0;
    let started = false;

    const speakNext = () => {
      if (sessionId !== activeSpeechSessionId) return;
      if (index >= chunks.length) {
        callbacks.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = lang;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.96;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (sessionId !== activeSpeechSessionId) return;
        if (!started) {
          started = true;
          callbacks.onStart?.();
        }
      };

      utterance.onend = () => {
        if (sessionId !== activeSpeechSessionId) return;
        index += 1;
        speakNext();
      };

      utterance.onerror = () => {
        if (sessionId !== activeSpeechSessionId) return;
        callbacks.onEnd?.();
      };

      try {
        synth.speak(utterance);
      } catch {
        callbacks.onError?.();
      }
    };

    speakNext();
  };

  // Some browsers populate voices asynchronously on first call
  if (synth.getVoices().length === 0) {
    const onVoicesChanged = () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      startSpeaking();
    };
    synth.addEventListener('voiceschanged', onVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      if (sessionId === activeSpeechSessionId) {
        startSpeaking();
      }
    }, 250);
  } else {
    startSpeaking();
  }

  return true;
}

/**
 * Formats Markdown cleanly into WhatsApp-friendly prose (*bold*, crisp bullets, clean signature).
 */
export function formatMarkdownForWhatsApp(markdown: string): string {
  if (!markdown) return '';
  let formatted = markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?/g, '').trim())
    // Headings -> WhatsApp *Bold*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // **bold** -> *bold*
    .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
    // __bold__ -> *bold*
    .replace(/__([^_\n]+)__/g, '*$1*')
    // Markdown links -> label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Table divider lines removed; rows simplified
    .replace(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/gm, '')
    .replace(/^\s*\|(.+)\|\s*$/gm, (_m, row: string) =>
      row
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .join(' · ')
    )
    // Bullets -> clean dot
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const maxChars = 3200;
  if (formatted.length > maxChars) {
    formatted = `${formatted.slice(0, maxChars).trimEnd()}…`;
  }

  return `${formatted}\n\n— Shared via Cosmic Council (cosmiccouncil.chat)`;
}

export function getWhatsAppShareUrl(markdown: string): string {
  const text = formatMarkdownForWhatsApp(markdown);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Detects short affirmative user replies when a birth-profile confirmation is waiting.
 */
export function isAffirmativeReply(input: string): boolean {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[!.,?]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 48) return false;
  return /^(yes|y|yep|yeah|yup|correct|accurate|confirmed|confirm|ok|okay|looks good|all good|all correct|that's right|thats right|right|go ahead|proceed|please proceed|please do|yes please|yes correct|yes it is|yes they are|haan|han|ha|ji|ji haan|sahi hai|theek hai)$/.test(
    normalized
  );
}
