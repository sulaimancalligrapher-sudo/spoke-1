import { DictationQuestionType } from '../types';
import { formatRetrySettingToken, parseRetryCountFromSettingsText } from './retryLimit';
import { ARABIC_LETTER_NAMES, removeTashkeel } from './arabicMatcher';

export interface DictationTile {
  id: string;
  text: string;
  label?: string;
  index: number;
}

export interface ParsedPoolTileEntry {
  text: string;
  label?: string;
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
 * Infer Arabic positional label from tatweel markers:
 * "س" -> مفرد | "سـ" -> بداية | "ـسـ" -> وسط | "ـس" -> نهاية
 */
export function inferPositionalLabel(glyph: string): string {
  const clean = String(glyph || '').trim();
  const startsTatweel = clean.startsWith('ـ');
  const endsTatweel = clean.endsWith('ـ');
  if (startsTatweel && endsTatweel) return 'وسط';
  if (endsTatweel) return 'بداية';
  if (startsTatweel) return 'نهاية';
  return 'مفرد';
}

function canonicalizePositionalLabel(rawLabel?: string, glyph?: string): string | undefined {
  const lbl = String(rawLabel || '').trim();
  if (!lbl) return undefined;
  if (lbl.includes('مفرد') || lbl.includes('منفرد') || lbl.includes('منفصل')) return 'مفرد';
  if (lbl.includes('بداية') || lbl.includes('اول') || lbl.includes('أول')) return 'بداية';
  if (lbl.includes('وسط') || lbl.includes('منتصف')) return 'وسط';
  if (lbl.includes('نهاية') || lbl.includes('اخر') || lbl.includes('آخر')) return 'نهاية';
  return lbl || (glyph ? inferPositionalLabel(glyph) : undefined);
}

/**
 * Parse Col C scrambled pool into { text, label } entries.
 * Supports:
 * 1) Descriptive positional format: "( ـس ) نهاية ( ـسـ ) وسط ( ف ) مفرد ( سـ ) بداية"
 *    (with or without outer parentheses or "|" separators)
 * 2) Pipe-separated tokens: "ـسـ | ـكـ | س"
 * 3) Space-separated tokens: "ب ا ب ف ر" or "المدرسة ذهب إلى محمد"
 */
export function parsePoolEntries(scrambledPool: string): ParsedPoolTileEntry[] {
  let raw = String(scrambledPool || '').trim();
  if (!raw) return [];

  // Strip redundant outer wrapping parens: "( ( ـس ) نهاية ... )" -> "( ـس ) نهاية ..."
  if (/^\(\s*\(/.test(raw) && raw.endsWith(')')) {
    raw = raw.slice(1, -1).trim();
  }

  const hasParenSyntax = /\(\s*[^()]+\s*\)/.test(raw);
  let entries: ParsedPoolTileEntry[] = [];

  if (hasParenSyntax) {
    // Try pipe-split first if pipes are explicitly used between parenthesized entries
    if (raw.includes('|')) {
      const chunks = raw.split('|').map((c) => c.trim()).filter(Boolean);
      for (const chunk of chunks) {
        const m = chunk.match(/^\(\s*([^()]+?)\s*\)(?:\s*(.*))?$/);
        if (m) {
          const text = m[1].trim();
          const label = canonicalizePositionalLabel(m[2], text);
          if (text) entries.push({ text, label });
        } else {
          entries.push({ text: chunk });
        }
      }
    } else {
      const parenRegex =
        /\(\s*([^()]+?)\s*\)(?:\s*(مفردة|مفرد|منفردة|منفرد|منفصلة|منفصل|بداية|أول الكلمة|اول الكلمة|أول|اول|وسط الكلمة|وسطية|وسط|منتصف|نهاية|آخر الكلمة|اخر الكلمة|آخر|اخر))?/g;
      let match: RegExpExecArray | null;
      while ((match = parenRegex.exec(raw)) !== null) {
        const text = match[1].trim();
        const label = canonicalizePositionalLabel(match[2], text);
        if (text) {
          entries.push({ text, label });
        }
      }
    }
  }

  if (entries.length === 0) {
    const rawTokens = raw.includes('|')
      ? raw.split('|').map((t) => t.trim()).filter(Boolean)
      : raw.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    entries = rawTokens.map((text) => ({ text }));
  }

  // If the pool uses positional forms (any tatweel "ـ" or explicit positional label),
  // auto-infer labels on any single-letter entries that don't have one yet.
  const usesPositional = entries.some(
    (e) => Boolean(e.label) || e.text.includes('ـ')
  );
  if (usesPositional) {
    entries = entries.map((e) => {
      if (e.label) return e;
      const bareLen = e.text.replace(ARABIC_DIACRITICS_ONLY, '').replace(TATWEEL_REGEX, '').trim().length;
      if (bareLen <= 1 || e.text.includes('ـ')) {
        return { ...e, label: inferPositionalLabel(e.text) };
      }
      return e;
    });
  }

  return entries;
}

/**
 * Split scrambled pool (Column C of sheet "كلمات") into individual glyph/word tokens.
 */
export function parsePoolTokens(scrambledPool: string): string[] {
  return parsePoolEntries(scrambledPool).map((e) => e.text);
}

/**
 * Format pool tokens into descriptive positional syntax:
 * "( ـس ) نهاية ( ـسـ ) وسط ( ف ) مفرد ( سـ ) بداية"
 */
export function formatPoolWithPositionalLabels(scrambledPool: string): string {
  const entries = parsePoolEntries(scrambledPool);
  if (entries.length === 0) return '';
  return entries
    .map((e) => {
      const lbl = e.label || inferPositionalLabel(e.text);
      return `( ${e.text} ) ${lbl}`;
    })
    .join(' ');
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
 * Returns true when scrambledPool is empty, enabling Direct Keyboard Dictation mode.
 */
export function isDirectDictationExercise(scrambledPool?: string): boolean {
  const clean = String(scrambledPool || '').trim();
  if (!clean) return true;
  return parsePoolEntries(clean).length === 0;
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
  const entries = parsePoolEntries(scrambledPool);
  const tiles: DictationTile[] = entries.map((entry, idx) => ({
    id: `tile-${idx}-${entry.text}-${entry.label || ''}`,
    text: entry.text,
    label: entry.label,
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
 * Supports both tile-based mode and Direct Keyboard Dictation mode (empty scrambledPool).
 */
export function verifyDictationAnswer(params: {
  type: DictationQuestionType;
  correctAnswer: string;
  scrambledPool?: string;
  selectedTiles: DictationTile[];
  blankAssignments: Record<number, DictationTile | null>;
  directText?: string;
  directBlanks?: Record<number, string>;
}): { isCorrect: boolean; assembledAnswer: string; expectedDisplay: string } {
  const {
    type,
    correctAnswer,
    scrambledPool,
    selectedTiles,
    blankAssignments,
    directText,
    directBlanks,
  } = params;
  const isDirectMode = isDirectDictationExercise(scrambledPool);
  const parsedBlanks = parseAnswerWithBlanks(correctAnswer);
  const expectedDisplay = correctAnswer
    .replace(/\|/g, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isDirectMode) {
    if (parsedBlanks.hasBlanks) {
      const allFilled = parsedBlanks.expectedBlanks.every(
        (_, idx) => Boolean((directBlanks?.[idx] || '').trim())
      );
      if (!allFilled) {
        return { isCorrect: false, assembledAnswer: '', expectedDisplay };
      }

      const everyBlankMatches = parsedBlanks.expectedBlanks.every((expected, idx) => {
        const typed = directBlanks?.[idx] || '';
        const normExpected = normalizeForDictationCompare(expected, { stripSpaces: true });
        const normTyped = normalizeForDictationCompare(typed, { stripSpaces: true });
        return Boolean(normTyped) && normExpected === normTyped;
      });

      const assembledAnswer = parsedBlanks.segments
        .map((seg) => {
          if (seg.kind === 'fixed') return seg.text;
          const typed = seg.blankIndex !== undefined ? directBlanks?.[seg.blankIndex] || '' : '';
          return typed.trim();
        })
        .join('')
        .replace(TATWEEL_REGEX, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (everyBlankMatches) {
        return { isCorrect: true, assembledAnswer, expectedDisplay };
      }

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

    // Direct full word or full sentence keyboard dictation
    const typedClean = String(directText || '').replace(TATWEEL_REGEX, '').replace(/\s+/g, ' ').trim();
    if (!typedClean) {
      return { isCorrect: false, assembledAnswer: '', expectedDisplay };
    }
    const stripSpaces = !expectedDisplay.includes(' ');
    const normStudent = normalizeForDictationCompare(typedClean, { stripSpaces });
    const normExpected = normalizeForDictationCompare(expectedDisplay, { stripSpaces });
    return {
      isCorrect: Boolean(normStudent) && normStudent === normExpected,
      assembledAnswer: typedClean,
      expectedDisplay,
    };
  }

  if (parsedBlanks.hasBlanks) {
    const allFilled = parsedBlanks.expectedBlanks.every((_, idx) => Boolean(blankAssignments[idx]));
    if (!allFilled) {
      return { isCorrect: false, assembledAnswer: '', expectedDisplay };
    }

    const poolEntries = scrambledPool ? parsePoolEntries(scrambledPool) : [];
    const poolUsesPositional = poolEntries.some(
      (e) => e.text.includes('ـ') || Boolean(e.label)
    );

    const everyBlankMatches = parsedBlanks.expectedBlanks.every((expected, idx) => {
      const chosen = blankAssignments[idx];
      if (!chosen) return false;
      const normExpected = normalizeForDictationCompare(expected, { stripSpaces: true });
      const normChosen = normalizeForDictationCompare(chosen.text, { stripSpaces: true });
      if (normExpected !== normChosen) return false;

      // Strict positional check (e.g. "ـسـ" وسط vs "س" مفرد vs "سـ" بداية vs "ـس" نهاية)
      const enforcePositional = expected.includes('ـ') || (type === 'fill_letter' && poolUsesPositional);
      if (enforcePositional) {
        const expTrim = expected.trim();
        const choTrim = chosen.text.trim();
        const expStart = expTrim.startsWith('ـ');
        const expEnd = expTrim.endsWith('ـ');
        const choStart = choTrim.startsWith('ـ');
        const choEnd = choTrim.endsWith('ـ');
        return expStart === choStart && expEnd === choEnd;
      }

      return true;
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

    // If positional forms are enforced, do NOT fall back to tatweel-stripped comparison!
    const anyPositionalExpected =
      parsedBlanks.expectedBlanks.some((b) => b.includes('ـ')) ||
      (type === 'fill_letter' && poolUsesPositional);
    if (anyPositionalExpected) {
      return { isCorrect: false, assembledAnswer, expectedDisplay };
    }

    // Fallback full-string match for non-positional blanks
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
 * Parse Col 4 settings string (inputMode, lockOnMistake, allowRetry, durationSeconds).
 */
export function parseDictationSettingsString(str?: string): {
  inputMode: 'voice_only' | 'both';
  lockOnMistake: boolean;
  durationSeconds: number;
  allowRetry: boolean;
  maxRetries: number;
} {
  const s = String(str || '').trim();
  const inputMode: 'voice_only' | 'both' = s.includes('صوت فقط') ? 'voice_only' : 'both';
  const lockOnMistake = s.includes('لا تراجع') || s.includes('لا يمكن التراجع') || s.includes('قفل');
  const { allowRetry, maxRetries } = parseRetryCountFromSettingsText(s);
  const durMatch = s.match(/(\d+)\s*ثوان/);
  const durationSeconds = durMatch ? parseInt(durMatch[1], 10) : 5;
  return { inputMode, lockOnMistake, durationSeconds, allowRetry, maxRetries };
}

export function formatDictationSettingsString(exercise: {
  inputMode?: 'voice_only' | 'both';
  lockOnMistake?: boolean;
  durationSeconds?: number;
  allowRetry?: boolean;
  maxRetries?: number;
}): string {
  const modeStr = exercise.inputMode === 'voice_only' ? 'صوت فقط' : 'فأرة وصوت';
  const lockStr = exercise.lockOnMistake ? 'لا تراجع' : 'إتاحة المحاولة';
  const retryStr = formatRetrySettingToken(exercise.maxRetries, exercise.allowRetry);
  const dur =
    typeof exercise.durationSeconds === 'number' && exercise.durationSeconds > 0
      ? exercise.durationSeconds
      : 5;
  return `${modeStr} | ${lockStr} | ${retryStr} | ${dur} ثواني`;
}

/**
 * Helper for Teacher Admin: auto-generate scrambled pool from Col D answer.
 * When positional shapes are present (or formatPositional = true), auto-generates
 * positional letter forms with descriptive labels: "( ـس ) نهاية ( ـسـ ) وسط ...".
 */
export function generateScrambledFromAnswer(
  correctAnswer: string,
  formatPositional = false
): string {
  const raw = String(correctAnswer || '').trim();
  if (!raw) return '';

  const parsedBlanks = parseAnswerWithBlanks(raw);
  const distractorsLetters = ['ف', 'ر', 'م', 'س', 'ل', 'ك', 'د', 'ن'];
  const distractorsWords = ['جلس', 'كتب', 'فوق', 'نام', 'المسجد', 'البيت'];
  const nonLeftConnectingLetters = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ة', 'ى', 'ء']);

  if (parsedBlanks.hasBlanks) {
    const type = detectDictationType('', raw);
    const needed = [...parsedBlanks.expectedBlanks].filter(Boolean);
    const hasPositionalBlank = needed.some((b) => b.includes('ـ')) || formatPositional;

    if (type === 'fill_letter' && hasPositionalBlank) {
      const poolList: string[] = [...needed];
      const primaryBlank = needed[0] || '';
      const baseChar = primaryBlank.replace(ARABIC_DIACRITICS_ONLY, '').replace(TATWEEL_REGEX, '').trim();

      // Add positional variants of the target letter first (e.g. س, سـ, ـسـ, ـس)
      if (baseChar && baseChar.length === 1) {
        const candidateShapes = nonLeftConnectingLetters.has(baseChar)
          ? [baseChar, `ـ${baseChar}`]
          : [baseChar, `${baseChar}ـ`, `ـ${baseChar}ـ`, `ـ${baseChar}`];
        for (const shape of candidateShapes) {
          if (!poolList.includes(shape)) {
            poolList.push(shape);
          }
        }
      }

      // Add a couple of positional distractors from other letters
      const extraShapes = ['ف', 'ـف', 'ـعـ', 'ع', 'لـ', 'ـكـ', 'مـ', 'ـن'];
      for (const sh of extraShapes) {
        if (poolList.length >= 8) break;
        const shBase = sh.replace(TATWEEL_REGEX, '');
        if (shBase !== baseChar && !poolList.includes(sh)) {
          poolList.push(sh);
        }
      }

      const shuffled = [...poolList].sort(() => Math.random() - 0.5);
      return shuffled.map((g) => `( ${g} ) ${inferPositionalLabel(g)}`).join(' ');
    }

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
  if (formatPositional) {
    return chars.map((g) => `( ${g} ) ${inferPositionalLabel(g)}`).join(' ');
  }
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

/**
 * Find ALL available tiles matching a spoken letter/word (for two-step voice disambiguation
 * when multiple positional shapes of the same letter exist, e.g., ـس / ـسـ / سـ / س).
 */
export function findAllSpokenMatchingTiles(
  alternatives: string[],
  availableTiles: DictationTile[]
): {
  tiles: DictationTile[];
  matchedTranscript: string;
  requiresDisambiguation: boolean;
} {
  const { tile: primaryMatch, matchedTranscript } = matchSpokenAlternativesToDictationTile(
    alternatives,
    availableTiles
  );

  if (!primaryMatch) {
    return { tiles: [], matchedTranscript: alternatives[0] || '', requiresDisambiguation: false };
  }

  const targetBase = normalizeSpokenForDictation(primaryMatch.text);
  const matchingTiles = availableTiles.filter(
    (t) => normalizeSpokenForDictation(t.text) === targetBase
  );

  // Only require number disambiguation if there are 2+ DISTINCT visual shapes/labels
  // (So two identical "ب" tiles in "باب" still select immediately without asking for a number!)
  const distinctVariants = new Set(
    matchingTiles.map((t) => `${t.text.trim()}__${t.label || ''}`)
  );

  return {
    tiles: matchingTiles,
    matchedTranscript,
    requiresDisambiguation: distinctVariants.size >= 2,
  };
}

const ARABIC_NUMBER_WORDS: Record<number, string[]> = {
  1: ['1', '١', 'واحد', 'واحدة', 'أول', 'اول', 'الأول', 'الاول', 'one', 'first'],
  2: ['2', '٢', 'اثنين', 'اثنان', 'إثنين', 'إثنان', 'اتنين', 'تنين', 'ثاني', 'الثاني', 'ثانية', 'two', 'second'],
  3: ['3', '٣', 'ثلاثة', 'ثلاثه', 'ثلاث', 'تلاتة', 'تلاته', 'تلات', 'ثالث', 'الثالث', 'three', 'third'],
  4: ['4', '٤', 'أربعة', 'اربعة', 'أربعه', 'اربعه', 'أربع', 'اربع', 'رابع', 'الرابع', 'four', 'fourth'],
  5: ['5', '٥', 'خمسة', 'خمسه', 'خمس', 'خامس', 'الخامس', 'five', 'fifth'],
  6: ['6', '٦', 'ستة', 'سته', 'ست', 'سادس', 'السادس', 'six', 'sixth'],
  7: ['7', '٧', 'سبعة', 'سبعه', 'سبع', 'سابع', 'السابع', 'seven', 'seventh'],
  8: ['8', '٨', 'ثمانية', 'ثمانيه', 'ثماني', 'تمانية', 'ثامن', 'الثامن', 'eight', 'eighth'],
  9: ['9', '٩', 'تسعة', 'تسعه', 'تسع', 'تاسع', 'التاسع', 'nine', 'ninth'],
};

/**
 * Resolve student's second voice step during disambiguation:
 * Matches spoken digits ("1", "١", "واحد", "اثنين", "ثلاثة"...) OR explicit position ("وسط", "بداية", "نهاية", "مفرد"),
 * or "إلغاء" to cancel selection mode.
 */
export function matchDisambiguationChoice(
  alternatives: string[],
  numberedItems: { tile: DictationTile; number: number }[]
): { tile: DictationTile | null; isCancel: boolean; heardText: string } {
  const cleanAlts = alternatives
    .map((a) => String(a || '').trim())
    .filter(Boolean);
  const heardText = cleanAlts[0] || '';

  for (const alt of cleanAlts) {
    const norm = normalizeSpokenForDictation(alt);
    if (!norm) continue;

    if (norm.includes('الغاء') || norm.includes('تراجع') || norm === 'cancel') {
      return { tile: null, isCancel: true, heardText: alt };
    }

    // 1. Check spoken numbers 1..9
    const tokens = norm.split(/\s+/).filter(Boolean);
    for (const item of numberedItems) {
      const variants = ARABIC_NUMBER_WORDS[item.number] || [String(item.number)];
      const normVariants = variants.map((v) => normalizeSpokenForDictation(v));
      if (
        normVariants.includes(norm) ||
        tokens.some((tok) => normVariants.includes(tok))
      ) {
        return { tile: item.tile, isCancel: false, heardText: alt };
      }
    }

    // 2. Also accept explicit positional label if the student speaks it directly
    for (const item of numberedItems) {
      const lbl = item.tile.label || inferPositionalLabel(item.tile.text);
      if (
        (lbl === 'مفرد' && (norm.includes('مفرد') || norm.includes('منفرد') || norm.includes('منفصل'))) ||
        (lbl === 'بداية' && (norm.includes('بداية') || norm.includes('اول'))) ||
        (lbl === 'وسط' && (norm.includes('وسط') || norm.includes('منتصف'))) ||
        (lbl === 'نهاية' && (norm.includes('نهاية') || norm.includes('اخر')))
      ) {
        return { tile: item.tile, isCancel: false, heardText: alt };
      }
    }
  }

  return { tile: null, isCancel: false, heardText };
}

/**
 * Resolve spoken input in Direct Keyboard Dictation mode (when scrambledPool is empty).
 * If expecting a single Arabic letter (e.g. a single-letter |...| blank), maps spoken letter names
 * like "سين" or "باء" back to the single Arabic letter character; otherwise returns the clean transcript.
 */
export function resolveDirectVoiceTranscript(
  alternatives: string[],
  correctAnswer: string,
  activeBlankIdx: number
): string {
  const cleanAlts = alternatives
    .map((a) => String(a || '').trim().replace(/[.,،!؟?;:«»"']/g, ''))
    .filter(Boolean);
  if (cleanAlts.length === 0) return '';

  const parsedBlanks = parseAnswerWithBlanks(correctAnswer);
  const expectedTarget = parsedBlanks.hasBlanks
    ? parsedBlanks.expectedBlanks[activeBlankIdx] || ''
    : correctAnswer;

  const bareExpected = expectedTarget
    .replace(ARABIC_DIACRITICS_ONLY, '')
    .replace(TATWEEL_REGEX, '')
    .trim();

  // If expecting a single character (letter blank or single-letter answer), try mapping letter names
  if (bareExpected.length === 1) {
    for (const alt of cleanAlts) {
      const cleanSpoken = normalizeSpokenForDictation(alt);
      const rawSpoken = stripRawMarksKeepShape(alt);
      const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);
      const rawTokens = rawSpoken.split(/\s+/).filter(Boolean);

      for (const [letterKey, aliases] of Object.entries(DICTATION_LETTER_PRIMARY_NAMES)) {
        if (
          tokenMatchesAliasList(rawSpoken, rawTokens, aliases) ||
          tokenMatchesAliasList(cleanSpoken, spokenTokens, aliases)
        ) {
          return letterKey;
        }
      }
      for (const [letterKey, aliases] of Object.entries(DICTATION_LETTER_EXTENDED_ALIASES)) {
        if (
          tokenMatchesAliasList(rawSpoken, rawTokens, aliases) ||
          tokenMatchesAliasList(cleanSpoken, spokenTokens, aliases)
        ) {
          return letterKey;
        }
      }
    }
  }

  // If multiple alternatives exist and one matches expected normalized text, prefer that alternative
  const normExpected = normalizeForDictationCompare(bareExpected, { stripSpaces: !bareExpected.includes(' ') });
  for (const alt of cleanAlts) {
    const normAlt = normalizeForDictationCompare(alt, { stripSpaces: !bareExpected.includes(' ') });
    if (normAlt && normAlt === normExpected) {
      return alt;
    }
  }

  return cleanAlts[0];
}


