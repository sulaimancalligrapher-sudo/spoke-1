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
 * Comprehensive Arabic single-letter spoken aliases (handles canonical letter names,
 * Google Chrome Web Speech transcriptions like "1000" for ألف, "في" for فاء,
 * "رأى" for راء, "بها" for باء, "كف/كافي" for كاف, etc.)
 */
const DICTATION_LETTER_PRIMARY_NAMES: Record<string, string[]> = {
  'ا': ['الف', 'ألف', 'اليف', 'الاف'],
  'أ': ['الف', 'ألف', 'اليف', 'الاف'],
  'إ': ['الف', 'ألف', 'اليف', 'الاف'],
  'آ': ['الف', 'ألف', 'اليف', 'الاف'],
  'ء': ['همزة', 'همزه', 'نبرة', 'نبره'],
  'ؤ': ['همزة', 'همزه', 'واو همزة'],
  'ئ': ['همزة', 'همزه', 'نبرة', 'نبره'],
  'ب': ['باء', 'با'],
  'ت': ['تاء', 'تا'],
  'ث': ['ثاء', 'ثا'],
  'ج': ['جيم', 'جي'],
  'ح': ['حاء', 'حا'],
  'خ': ['خاء', 'خا'],
  'د': ['دال', 'دا'],
  'ذ': ['ذال', 'ذا'],
  'ر': ['راء', 'را'],
  'ز': ['زاي', 'زا', 'زين'],
  'س': ['سين', 'سي'],
  'ش': ['شين', 'شي'],
  'ص': ['صاد', 'صا'],
  'ض': ['ضاد', 'ضا'],
  'ط': ['طاء', 'طا'],
  'ظ': ['ظاء', 'ظا'],
  'ع': ['عين', 'عي'],
  'غ': ['غين', 'غي'],
  'ف': ['فاء', 'فا'],
  'ق': ['قاف', 'قا'],
  'ك': ['كاف', 'كا'],
  'ل': ['لام', 'لا'],
  'م': ['ميم', 'مي'],
  'ن': ['نون', 'نو'],
  'ه': ['هاء', 'ها'],
  'ة': ['تاء مربوطة', 'تاء مربوطه', 'مربوطة', 'مربوطه', 'هاء', 'ها'],
  'و': ['واو', 'وا'],
  'ي': ['ياء', 'يا'],
  'ى': ['الف مقصورة', 'ألف مقصورة', 'الف مقصوره', 'مقصورة', 'مقصوره', 'ياء', 'يا'],
};

const DICTATION_LETTER_EXTENDED_ALIASES: Record<string, string[]> = {
  'ا': ['1000', '١٠٠٠', 'اه', 'آه', 'ايه', 'همزة', 'همزه', 'ا', 'أ', 'إ', 'آ'],
  'أ': ['1000', '١٠٠٠', 'اه', 'آه', 'ايه', 'همزة', 'همزه', 'ا', 'أ'],
  'إ': ['1000', '١٠٠٠', 'ايه', 'همزة', 'همزه', 'ا', 'إ'],
  'آ': ['1000', '١٠٠٠', 'اه', 'آه', 'ا', 'آ'],
  'ء': ['همزة', 'همزه', 'نبرة', 'ء', 'ا'],
  'ؤ': ['همزة', 'همزه', 'ؤ', 'واو'],
  'ئ': ['همزة', 'همزه', 'نبرة', 'ئ'],
  'ب': ['به', 'بها', 'بأ', 'بى', 'بي', 'بو', 'ب', 'b', 'ba', 'baa'],
  'ت': ['ته', 'تى', 'تي', 'تو', 'تأ', 'تاه', 'ت', 't', 'ta', 'taa'],
  'ث': ['ثه', 'ثى', 'ثي', 'ثو', 'ثأ', 'ث', 'tha'],
  'ج': ['جا', 'جه', 'جو', 'ج', 'j', 'jeem', 'jim'],
  'ح': ['حه', 'حى', 'حي', 'حو', 'حأ', 'ح', 'ha'],
  'خ': ['خه', 'خى', 'خي', 'خو', 'خأ', 'خ', 'kha'],
  'د': ['ده', 'دي', 'دو', 'دل', 'د', 'd', 'dal'],
  'ذ': ['ذه', 'ذي', 'ذو', 'ذل', 'ذ', 'dhal'],
  'ر': ['راي', 'رعي', 'راه', 'ره', 'رى', 'ري', 'رو', 'ر', 'r', 'ra', 'raa'],
  'ز': ['زي', 'زه', 'زو', 'زاى', 'ز', 'z', 'zay', 'zain'],
  'س': ['سا', 'سه', 'سو', 'سن', '60', '٦٠', 'س', 'c', 's', 'sin', 'seen'],
  'ش': ['شا', 'شه', 'شو', 'شئ', 'ش', 'shin', 'sheen'],
  'ص': ['صه', 'صي', 'صو', 'صد', 'ص', 'sad'],
  'ض': ['ضه', 'ضي', 'ضو', 'ضد', 'ض', 'dad'],
  'ط': ['طه', 'طي', 'طو', 'طى', 'ط', 'ta'],
  'ظ': ['ظه', 'ظي', 'ظو', 'ظى', 'ظ', 'za'],
  'ع': ['عا', 'عه', 'عو', 'ع', 'ayn'],
  'غ': ['غا', 'غه', 'غو', 'غ', 'ghayn'],
  'ف': ['في', 'فه', 'فو', 'فى', 'فأ', 'ف', 'f', 'fa', 'faa'],
  'ق': ['قه', 'قي', 'قو', 'قف', 'ق', 'q', 'qaf'],
  'ك': ['كه', 'كي', 'كو', 'كف', 'كافي', 'ك', 'k', 'kaf'],
  'ل': ['له', 'لي', 'لو', 'لم', 'لهم', 'ل', 'l', 'lam'],
  'م': ['ما', 'مه', 'مو', 'مم', 'م', 'm', 'mim', 'meem'],
  'ن': ['نا', 'نه', 'ني', 'ن', 'n', 'nun', 'noon'],
  'ه': ['هه', 'هي', 'هو', 'هيه', 'ه', 'h', 'ha'],
  'ة': ['ته', 'تي', 'تاء', 'هاء', 'ها', 'ة'],
  'و': ['وه', 'وي', 'وو', 'او', 'أو', 'و', 'w', 'wow', 'waw'],
  'ي': ['يه', 'يي', 'يو', 'ياه', 'ي', 'y', 'ya', 'yaa'],
  'ى': ['يا', 'يه', 'ياه', 'ى', 'ي'],
};

function normalizeSpokenForDictation(text: string): string {
  return removeTashkeel(text)
    .replace(TATWEEL_REGEX, '')
    .replace(/[.,،!؟?;:«»"'`~@#$%^&*()_+=\-\[\]{}|\\/<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function stripRawMarksKeepShape(text: string): string {
  return String(text || '')
    .replace(ARABIC_DIACRITICS_ONLY, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[.,،!؟?;:«»"'`~@#$%^&*()_+=\-\[\]{}|\\/<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function tokenMatchesAliasList(spoken: string, tokens: string[], aliases: string[]): boolean {
  const normAliases = aliases.map((a) => normalizeSpokenForDictation(a)).filter(Boolean);
  if (normAliases.includes(spoken)) return true;

  for (const tok of tokens) {
    if (normAliases.includes(tok)) return true;
    // Handle definite article "ال" (e.g. "الباء" -> "باء", "السين" -> "سين", "الألف" -> "ألف")
    if (tok.startsWith('ال') && tok.length >= 4) {
      const bare = tok.slice(2);
      if (normAliases.includes(bare)) return true;
    }
  }

  // Multi-word alias like "تاء مربوطة" / "الف مقصورة"
  return normAliases.some((a) => a.includes(' ') && spoken.includes(a));
}

/**
 * Map Arabic spoken input (word or letter name like "سين", "ألف", "باء") to matching available tiles.
 */
export function matchSpokenToDictationTile(
  spokenText: string,
  availableTiles: DictationTile[]
): DictationTile | null {
  const cleanSpoken = normalizeSpokenForDictation(spokenText);
  const rawSpoken = stripRawMarksKeepShape(spokenText);
  if (!cleanSpoken || availableTiles.length === 0) return null;

  const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);
  const rawTokens = rawSpoken.split(/\s+/).filter(Boolean);

  // Pass 1: Direct exact match (preserving raw shape for ة/ى/أ/إ first, then normalized)
  for (const tile of availableTiles) {
    const rawTile = stripRawMarksKeepShape(tile.text);
    if (rawTile && rawSpoken === rawTile) return tile;
  }
  for (const tile of availableTiles) {
    const cleanTile = normalizeSpokenForDictation(tile.text);
    if (cleanTile && cleanSpoken === cleanTile) return tile;
  }

  // Pass 1b: Special exact "لا" ligature
  for (const tile of availableTiles) {
    const cleanTile = normalizeSpokenForDictation(tile.text);
    if (
      cleanTile === 'لا' &&
      (cleanSpoken === 'لا' ||
        cleanSpoken.includes('لام الف') ||
        cleanSpoken.includes('لام ألف'))
    ) {
      return tile;
    }
  }

  // Pass 2: Primary canonical letter names (e.g. "باء", "سين", "ألف", "تاء مربوطة", "همزة")
  for (const tile of availableTiles) {
    const rawTile = stripRawMarksKeepShape(tile.text);
    const cleanTile = normalizeSpokenForDictation(tile.text);
    if (!cleanTile || cleanTile.length !== 1) continue;

    const primaryList =
      DICTATION_LETTER_PRIMARY_NAMES[rawTile] ||
      DICTATION_LETTER_PRIMARY_NAMES[cleanTile] ||
      ARABIC_LETTER_NAMES[cleanTile] ||
      [];

    if (
      tokenMatchesAliasList(rawSpoken, rawTokens, primaryList) ||
      tokenMatchesAliasList(cleanSpoken, spokenTokens, primaryList)
    ) {
      return tile;
    }
  }

  // Pass 3: Extended Web Speech / Chrome phonetic & numeric aliases for single letters
  // (e.g. "1000"/"١٠٠٠" -> ا, "في" -> ف, "رأى" -> ر, "بها" -> ب, "كف"/"كافي" -> ك, "لم" -> ل)
  for (const tile of availableTiles) {
    const rawTile = stripRawMarksKeepShape(tile.text);
    const cleanTile = normalizeSpokenForDictation(tile.text);
    if (!cleanTile || cleanTile.length !== 1) continue;

    const extList = [
      ...(DICTATION_LETTER_EXTENDED_ALIASES[rawTile] || []),
      ...(DICTATION_LETTER_EXTENDED_ALIASES[cleanTile] || []),
      ...(ARABIC_LETTER_NAMES[cleanTile] || []),
    ];

    if (
      tokenMatchesAliasList(rawSpoken, rawTokens, extList) ||
      tokenMatchesAliasList(cleanSpoken, spokenTokens, extList)
    ) {
      return tile;
    }
  }

  // Pass 4: Multi-character words / phrases (words_sentence, fill_word, 2+ letter tiles)
  for (const tile of availableTiles) {
    const cleanTile = normalizeSpokenForDictation(tile.text);
    if (!cleanTile || cleanTile.length < 2 || cleanTile === 'لا') continue;

    if (
      cleanSpoken.includes(cleanTile) ||
      (cleanSpoken.length >= 2 && cleanTile.includes(cleanSpoken))
    ) {
      return tile;
    }

    // Prefix-stripped comparison for words (e.g. "المدرسة" vs "مدرسة")
    const bareTile = cleanTile.startsWith('ال') && cleanTile.length > 3 ? cleanTile.slice(2) : cleanTile;
    const bareSpoken = cleanSpoken.startsWith('ال') && cleanSpoken.length > 3 ? cleanSpoken.slice(2) : cleanSpoken;
    if (bareTile === bareSpoken || bareSpoken.includes(bareTile)) {
      return tile;
    }
  }

  return null;
}

/**
 * Check a ranked list of SpeechRecognition alternatives in order and return the first matched tile.
 */
export function matchSpokenAlternativesToDictationTile(
  alternatives: string[],
  availableTiles: DictationTile[]
): { tile: DictationTile | null; matchedTranscript: string } {
  for (const alt of alternatives) {
    const clean = String(alt || '').trim();
    if (!clean) continue;
    const tile = matchSpokenToDictationTile(clean, availableTiles);
    if (tile) {
      return { tile, matchedTranscript: clean };
    }
  }
  return { tile: null, matchedTranscript: alternatives[0] || '' };
}
