import { DictationQuestionType } from '../types';
import { ARABIC_LETTER_NAMES, removeTashkeel } from './arabicMatcher';

export interface DictationTile {
  id: string;
  text: string;
  index: number;
}

export interface AnswerSegment {
  kind: 'fixed' | 'blank';
  text: string;
  blankIndex?: number;
}

export interface ParsedAnswerBlanks {
  hasBlanks: boolean;
  segments: AnswerSegment[];
  expectedBlanks: string[];
}

const ARABIC_DIACRITICS_ONLY = /[\u064B-\u0652\u0670]/g;
const TATWEEL_REGEX = /\u0640/g;

/**
 * Normalize Arabic string for letter-level or word-level comparison
 * while keeping tatweel (ـ) and diacritics out of the way.
 */
export function normalizeForDictationCompare(
  text: string,
  options: { stripSpaces?: boolean } = {}
): string {
  let clean = String(text || '')
    .replace(ARABIC_DIACRITICS_ONLY, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[أإآء]/g, 'ا')
    .replace(/[.,،!؟?;:«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (options.stripSpaces) {
    clean = clean.replace(/\s+/g, '');
  }
  return clean;
}

/**
 * Split scrambled pool (Column C of sheet "كلمات") into individual selectable tiles.
 * Supports "|" separator if explicitly present, otherwise whitespace.
 */
export function parsePoolTokens(scrambledPool: string): string[] {
  const raw = String(scrambledPool || '').trim();
  if (!raw) return [];
  if (raw.includes('|')) {
    return raw
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Parse |...| blanks in Column D (e.g. "الـ|ـسـ|ـلام" or "ذهب محمد | إلى | المدرسة").
 * A string uses blanks only if it contains at least two "|" delimiters.
 */
export function parseAnswerWithBlanks(correctAnswer: string): ParsedAnswerBlanks {
  const raw = String(correctAnswer || '');
  const pipeMatches = raw.match(/\|/g);
  if (!pipeMatches || pipeMatches.length < 2) {
    return {
      hasBlanks: false,
      segments: [{ kind: 'fixed', text: raw.trim() }],
      expectedBlanks: [],
    };
  }

  const parts = raw.split('|');
  const segments: AnswerSegment[] = [];
  const expectedBlanks: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      const blankIdx = expectedBlanks.length;
      expectedBlanks.push(part.trim());
      segments.push({ kind: 'blank', text: part.trim(), blankIndex: blankIdx });
    } else if (part.length > 0) {
      segments.push({ kind: 'fixed', text: part });
    }
  }

  return {
    hasBlanks: expectedBlanks.length > 0,
    segments,
    expectedBlanks,
  };
}

/**
 * Automatically classify the exercise into one of the 5 dictation types.
 */
export function detectDictationType(
  scrambledPool: string,
  correctAnswer: string
): DictationQuestionType {
  const parsedBlanks = parseAnswerWithBlanks(correctAnswer);
  const poolTokens = parsePoolTokens(scrambledPool);

  if (parsedBlanks.hasBlanks) {
    const fixedTexts = parsedBlanks.segments
      .filter((s) => s.kind === 'fixed')
      .map((s) => s.text)
      .join(' ');
    const blankHasLongWord = parsedBlanks.expectedBlanks.some((b) => {
      const clean = b.replace(TATWEEL_REGEX, '').replace(ARABIC_DIACRITICS_ONLY, '').trim();
      return clean.length >= 2 && !b.includes('ـ') && clean !== 'لا';
    });
    const fixedHasMultipleWords = fixedTexts.trim().includes(' ');
    if (blankHasLongWord || fixedHasMultipleWords) {
      return 'fill_word';
    }
    return 'fill_letter';
  }

  const cleanAnswer = String(correctAnswer || '').trim();
  const hasSpacesInAnswer = cleanAnswer.includes(' ');

  // Check if pool tokens represent full words rather than isolated/connected letters
  const multiCharTokens = poolTokens.filter((t) => {
    const clean = t.replace(TATWEEL_REGEX, '').replace(ARABIC_DIACRITICS_ONLY, '').trim();
    return clean.length >= 2 && clean !== 'لا';
  });

  if (hasSpacesInAnswer && poolTokens.length > 0 && multiCharTokens.length >= Math.ceil(poolTokens.length * 0.5)) {
    return 'words_sentence';
  }

  if (hasSpacesInAnswer) {
    return 'letters_sentence';
  }

  return 'letters_word';
}

export function getDictationTypeLabel(type: DictationQuestionType): string {
  switch (type) {
    case 'letters_word':
      return 'ترتيب الحروف لتكوين كلمة';
    case 'letters_sentence':
      return 'ترتيب الحروف لتكوين جملة';
    case 'words_sentence':
      return 'ترتيب الكلمات لتكوين جملة';
    case 'fill_letter':
      return 'إكمال الحرف الناقص في الكلمة';
    case 'fill_word':
      return 'إكمال الكلمة الناقصة في الجملة';
  }
}

/**
 * Shuffle tiles with Fisher-Yates, ensuring a non-trivial shuffle when possible
 * so ordering exercises never appear pre-solved.
 */
export function buildShuffledTiles(
  scrambledPool: string,
  correctAnswer: string,
  type: DictationQuestionType
): DictationTile[] {
  const tokens = parsePoolTokens(scrambledPool);
  const tiles: DictationTile[] = tokens.map((text, idx) => ({
    id: `tile-${idx}-${text}`,
    text,
    index: idx,
  }));

  if (tiles.length <= 1) return tiles;

  const targetNorm =
    type === 'words_sentence'
      ? normalizeForDictationCompare(correctAnswer, { stripSpaces: false })
      : normalizeForDictationCompare(correctAnswer, { stripSpaces: true });

  for (let attempt = 0; attempt < 4; attempt++) {
    const arr = [...tiles];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const joined =
      type === 'words_sentence'
        ? normalizeForDictationCompare(arr.map((t) => t.text).join(' '), { stripSpaces: false })
        : normalizeForDictationCompare(arr.map((t) => t.text).join(''), { stripSpaces: true });

    // If all tokens have the exact same text, break immediately
    const allIdentical = arr.every((t) => t.text === arr[0].text);
    if (allIdentical || joined !== targetNorm) {
      return arr;
    }
  }

  return [...tiles].reverse();
}

/**
 * Join chosen letter/word tokens for readable live preview inside the Composition Box.
 */
export function formatAssembledPreview(
  selectedTiles: DictationTile[],
  type: DictationQuestionType,
  correctAnswer?: string
): string {
  if (selectedTiles.length === 0) return '';
  if (type === 'words_sentence') {
    return selectedTiles.map((t) => t.text.replace(TATWEEL_REGEX, '')).join(' ');
  }
  // In letter ordering modes, strip tatweel so connected glyphs join smoothly
  const joinedLetters = selectedTiles.map((t) => t.text.replace(TATWEEL_REGEX, '')).join('');
  // If letters_sentence matches word boundaries of correctAnswer as student types, insert spaces cleanly
  if (type === 'letters_sentence' && correctAnswer) {
    const words = correctAnswer.trim().split(/\s+/).filter(Boolean);
    const normWords = words.map((w) => normalizeForDictationCompare(w, { stripSpaces: true }));
    let remaining = normalizeForDictationCompare(joinedLetters, { stripSpaces: true });
    const reconstructed: string[] = [];
    for (let i = 0; i < normWords.length; i++) {
      const w = normWords[i];
      if (remaining.startsWith(w) && remaining.length >= w.length) {
        reconstructed.push(words[i]);
        remaining = remaining.slice(w.length);
      } else {
        break;
      }
    }
    if (reconstructed.length > 0 && remaining.length === 0) {
      return reconstructed.join(' ');
    }
  }
  return joinedLetters;
}

/**
 * Evaluate the student's answer when clicking "تحقق".
 */
export function verifyDictationAnswer(params: {
  type: DictationQuestionType;
  correctAnswer: string;
  selectedTiles: DictationTile[];
  blankAssignments: Record<number, DictationTile | null>;
}): { isCorrect: boolean; assembledAnswer: string; expectedDisplay: string } {
  const { type, correctAnswer, selectedTiles, blankAssignments } = params;
  const parsedBlanks = parseAnswerWithBlanks(correctAnswer);
  const expectedDisplay = correctAnswer.replace(/\|/g, '').replace(/\s+/g, ' ').trim();

  if (parsedBlanks.hasBlanks) {
    const allFilled = parsedBlanks.expectedBlanks.every((_, idx) => Boolean(blankAssignments[idx]));
    if (!allFilled) {
      return { isCorrect: false, assembledAnswer: '', expectedDisplay };
    }

    const everyBlankMatches = parsedBlanks.expectedBlanks.every((expected, idx) => {
      const chosen = blankAssignments[idx];
      if (!chosen) return false;
      const normExpected = normalizeForDictationCompare(expected, { stripSpaces: true });
      const normChosen = normalizeForDictationCompare(chosen.text, { stripSpaces: true });
      return normExpected === normChosen;
    });

    const assembledAnswer = parsedBlanks.segments
      .map((seg) => {
        if (seg.kind === 'fixed') return seg.text;
        const tile = seg.blankIndex !== undefined ? blankAssignments[seg.blankIndex] : null;
        return tile ? tile.text : '';
      })
      .join('')
      .replace(TATWEEL_REGEX, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (everyBlankMatches) {
      return { isCorrect: true, assembledAnswer, expectedDisplay };
    }

    // Also allow full-string match (e.g. if connected forms match after removing tatweel)
    const fullNormStudent = normalizeForDictationCompare(assembledAnswer, {
      stripSpaces: type === 'fill_letter',
    });
    const fullNormExpected = normalizeForDictationCompare(expectedDisplay, {
      stripSpaces: type === 'fill_letter',
    });
    return {
      isCorrect: Boolean(fullNormStudent) && fullNormStudent === fullNormExpected,
      assembledAnswer,
      expectedDisplay,
    };
  }

  // Ordering modes (letters_word, letters_sentence, words_sentence)
  if (selectedTiles.length === 0) {
    return { isCorrect: false, assembledAnswer: '', expectedDisplay };
  }

  if (type === 'words_sentence') {
    const studentText = selectedTiles.map((t) => t.text).join(' ');
    const normStudent = normalizeForDictationCompare(studentText, { stripSpaces: false });
    const normExpected = normalizeForDictationCompare(correctAnswer, { stripSpaces: false });
    return {
      isCorrect: normStudent === normExpected,
      assembledAnswer: studentText.trim(),
      expectedDisplay,
    };
  }

  // letters_word or letters_sentence
  const studentJoined = selectedTiles.map((t) => t.text).join('');
  const normStudent = normalizeForDictationCompare(studentJoined, { stripSpaces: true });
  const normExpected = normalizeForDictationCompare(correctAnswer, { stripSpaces: true });

  return {
    isCorrect: normStudent === normExpected,
    assembledAnswer: formatAssembledPreview(selectedTiles, type, correctAnswer),
    expectedDisplay,
  };
}

/**
 * Parse Col 4 settings string (minimal defaults now, expandable later).
 */
export function parseDictationSettingsString(str?: string): {
  durationSeconds: number;
  allowRetry: boolean;
} {
  const s = String(str || '').trim();
  const allowRetry = !(
    s.includes('منع الإعادة') ||
    s.includes('لا إعادة') ||
    s.includes('no_retry')
  );
  const durMatch = s.match(/(\d+)\s*ثوان/);
  const durationSeconds = durMatch ? parseInt(durMatch[1], 10) : 5;
  return { durationSeconds, allowRetry };
}

export function formatDictationSettingsString(exercise: {
  durationSeconds?: number;
  allowRetry?: boolean;
}): string {
  const retryStr = exercise.allowRetry === false ? 'منع الإعادة' : 'السماح بالإعادة';
  const dur =
    typeof exercise.durationSeconds === 'number' && exercise.durationSeconds > 0
      ? exercise.durationSeconds
      : 5;
  return `${retryStr} | ${dur} ثواني`;
}

/**
 * Helper for Teacher Admin: auto-generate scrambled pool from Col D answer.
 */
export function generateScrambledFromAnswer(correctAnswer: string): string {
  const raw = String(correctAnswer || '').trim();
  if (!raw) return '';

  const parsedBlanks = parseAnswerWithBlanks(raw);
  const distractorsLetters = ['ف', 'ر', 'م', 'س', 'ل', 'ك', 'د', 'ن'];
  const distractorsWords = ['جلس', 'كتب', 'فوق', 'نام', 'المسجد', 'البيت'];

  if (parsedBlanks.hasBlanks) {
    const type = detectDictationType('', raw);
    const needed = [...parsedBlanks.expectedBlanks].filter(Boolean);
    const poolSet = [...needed];
    const extrasSource = type === 'fill_word' ? distractorsWords : distractorsLetters;
    for (const d of extrasSource) {
      if (poolSet.length >= needed.length + 3) break;
      const normD = normalizeForDictationCompare(d, { stripSpaces: true });
      if (!poolSet.some((x) => normalizeForDictationCompare(x, { stripSpaces: true }) === normD)) {
        poolSet.push(d);
      }
    }
    return poolSet.join(' ');
  }

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    // Word ordering -> reverse/shuffle words
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.join(' ');
  }

  // Letter ordering -> split non-space characters
  const chars = raw.replace(/\s+/g, '').split('').filter(Boolean);
  return chars.join(' ');
}

/**
 * Map Arabic spoken input (word or letter name like "سين", "ألف", "باء") to matching available tiles.
 */
export function matchSpokenToDictationTile(
  spokenText: string,
  availableTiles: DictationTile[]
): DictationTile | null {
  const cleanSpoken = removeTashkeel(spokenText).replace(TATWEEL_REGEX, '').toLowerCase().trim();
  if (!cleanSpoken || availableTiles.length === 0) return null;

  // 1. Direct normalized token match
  for (const tile of availableTiles) {
    const cleanTile = removeTashkeel(tile.text).replace(TATWEEL_REGEX, '').toLowerCase().trim();
    if (!cleanTile) continue;
    if (cleanSpoken === cleanTile) return tile;
  }

  // 2. Spoken phrase contains tile text or tile text matches spoken letter name aliases
  for (const tile of availableTiles) {
    const cleanTile = removeTashkeel(tile.text).replace(TATWEEL_REGEX, '').toLowerCase().trim();
    if (!cleanTile) continue;

    if (cleanTile.length === 1) {
      const aliases = ARABIC_LETTER_NAMES[cleanTile] || [cleanTile];
      const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);
      if (
        aliases.some(
          (alias) => cleanSpoken === alias || spokenTokens.includes(alias)
        )
      ) {
        return tile;
      }
    } else if (cleanTile === 'لا') {
      if (
        cleanSpoken === 'لا' ||
        cleanSpoken.includes('لام الف') ||
        cleanSpoken.includes('لام ألف')
      ) {
        return tile;
      }
    } else if (cleanSpoken.includes(cleanTile) || cleanTile.includes(cleanSpoken)) {
      return tile;
    }
  }

  return null;
}
