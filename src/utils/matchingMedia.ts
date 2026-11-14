import { getDirectAudioUrl, getDirectImageUrl } from './mediaUrl';

export type QuestionBlockType = 'text' | 'image' | 'audio';

export interface QuestionBlock {
  type: QuestionBlockType;
  value: string;
}

export type MatchingCardType = 'text' | 'image' | 'audio';

export interface ParsedMatchingCard {
  type: MatchingCardType;
  text: string; // Word text (if type === 'text') OR hidden speech text (if image/audio)
  mediaUrl: string;
  rawValue: string;
}

const IMAGE_PREFIX_RE = /^(?:صورة|img|image)\s*:\s*/i;
const AUDIO_PREFIX_RE = /^(?:صوت|aud|audio)\s*:\s*/i;
const TEXT_PREFIX_RE = /^(?:نص|text)\s*:\s*/i;

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i;

/**
 * Parse a flexible question string from Sheet "وصل" (Col 1 of exercise).
 * Format: segments separated by " | " in any teacher-chosen order, e.g.:
 *   "صِلْ الصُّورَةَ | صورة:https://drive.google.com/... | صوت:https://drive.google.com/..."
 */
export function parseQuestionBlocks(rawQuestion?: string): QuestionBlock[] {
  const raw = String(rawQuestion || '').trim();
  if (!raw) return [];

  const segments = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const blocks: QuestionBlock[] = [];
  for (const seg of segments) {
    if (IMAGE_PREFIX_RE.test(seg)) {
      const val = seg.replace(IMAGE_PREFIX_RE, '').trim();
      if (val) blocks.push({ type: 'image', value: val });
    } else if (AUDIO_PREFIX_RE.test(seg)) {
      const val = seg.replace(AUDIO_PREFIX_RE, '').trim();
      if (val) blocks.push({ type: 'audio', value: val });
    } else if (TEXT_PREFIX_RE.test(seg)) {
      const val = seg.replace(TEXT_PREFIX_RE, '').trim();
      if (val) blocks.push({ type: 'text', value: val });
    } else if (IMAGE_EXT_RE.test(seg) || seg.startsWith('data:image/')) {
      blocks.push({ type: 'image', value: seg });
    } else if (AUDIO_EXT_RE.test(seg) || seg.startsWith('data:audio/')) {
      blocks.push({ type: 'audio', value: seg });
    } else {
      blocks.push({ type: 'text', value: seg });
    }
  }

  return blocks;
}

/**
 * Serialize ordered question blocks back into Sheet "وصل" Col 1 format.
 */
export function formatQuestionBlocks(blocks: QuestionBlock[]): string {
  return blocks
    .map((b) => {
      const val = (b.value || '').trim();
      if (!val) return '';
      if (b.type === 'image') return `صورة:${val}`;
      if (b.type === 'audio') return `صوت:${val}`;
      return val;
    })
    .filter(Boolean)
    .join(' | ');
}

/**
 * Extract plain readable question title (without raw URLs) for modals & lists.
 */
export function getQuestionPlainText(rawQuestion?: string): string {
  const blocks = parseQuestionBlocks(rawQuestion);
  const textParts = blocks.filter((b) => b.type === 'text').map((b) => b.value);
  if (textParts.length > 0) return textParts.join(' — ');
  const hasImg = blocks.some((b) => b.type === 'image');
  const hasAud = blocks.some((b) => b.type === 'audio');
  if (hasImg && hasAud) return 'سؤال مصوّر ومسموع (صورة + صوت)';
  if (hasImg) return 'سؤال بالصورة';
  if (hasAud) return 'سؤال صوتي';
  return String(rawQuestion || '').trim();
}

/**
 * Parse a single Right or Left matching card cell segment.
 * Uses "::" inside an item so "|" stays strictly reserved for separating pairs:
 *   - Plain text: "تفاح"
 *   - Image + speech text: "صورة:https://drive.google.com/... :: تفاح"
 *   - Audio + speech text: "صوت:https://drive.google.com/... :: تفاح"
 */
export function parseMatchingCardValue(raw?: string): ParsedMatchingCard {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { type: 'text', text: '', mediaUrl: '', rawValue: '' };
  }

  const sepIdx = trimmed.indexOf('::');
  const firstPart = (sepIdx !== -1 ? trimmed.slice(0, sepIdx) : trimmed).trim();
  const spokenPart = (sepIdx !== -1 ? trimmed.slice(sepIdx + 2) : '').trim();

  if (IMAGE_PREFIX_RE.test(firstPart)) {
    const url = firstPart.replace(IMAGE_PREFIX_RE, '').trim();
    return {
      type: 'image',
      mediaUrl: url,
      text: spokenPart,
      rawValue: trimmed,
    };
  }

  if (AUDIO_PREFIX_RE.test(firstPart)) {
    const url = firstPart.replace(AUDIO_PREFIX_RE, '').trim();
    return {
      type: 'audio',
      mediaUrl: url,
      text: spokenPart,
      rawValue: trimmed,
    };
  }

  if (IMAGE_EXT_RE.test(firstPart) || firstPart.startsWith('data:image/')) {
    return {
      type: 'image',
      mediaUrl: firstPart,
      text: spokenPart,
      rawValue: trimmed,
    };
  }

  if (AUDIO_EXT_RE.test(firstPart) || firstPart.startsWith('data:audio/')) {
    return {
      type: 'audio',
      mediaUrl: firstPart,
      text: spokenPart,
      rawValue: trimmed,
    };
  }

  return {
    type: 'text',
    text: trimmed,
    mediaUrl: '',
    rawValue: trimmed,
  };
}

/**
 * Serialize a card item back into the single-item string (without "|").
 */
export function formatMatchingCardValue(card: {
  type: MatchingCardType;
  text: string;
  mediaUrl: string;
}): string {
  const cleanText = (card.text || '').trim();
  const cleanUrl = (card.mediaUrl || '').trim();

  if (card.type === 'image') {
    if (!cleanUrl) return cleanText;
    return cleanText ? `صورة:${cleanUrl} :: ${cleanText}` : `صورة:${cleanUrl}`;
  }

  if (card.type === 'audio') {
    if (!cleanUrl) return cleanText;
    return cleanText ? `صوت:${cleanUrl} :: ${cleanText}` : `صوت:${cleanUrl}`;
  }

  return cleanText;
}

/**
 * Human-readable short summary of a card item for Admin list preview
 */
export function getCardAdminPreview(raw?: string): string {
  const parsed = parseMatchingCardValue(raw);
  if (parsed.type === 'image') {
    return parsed.text ? `🖼️ ${parsed.text}` : '🖼️ صورة';
  }
  if (parsed.type === 'audio') {
    return parsed.text ? `🔊 ${parsed.text}` : '🔊 ملف صوتي';
  }
  return parsed.text;
}

export { getDirectAudioUrl, getDirectImageUrl };
