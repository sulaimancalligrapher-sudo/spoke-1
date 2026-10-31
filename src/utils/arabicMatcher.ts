import { LetterPhoneme, PronunciationEvaluation, DifficultyLevel } from '../types';

// Arabic Diacritics Regex (Fatha, Damma, Kasra, Sukun, Shaddah, Tanween)
export const TASHKEEL_REGEX = /[\u064B-\u0652\u0670\u0640]/g;

// Arabic Letter Names and Pronunciation Aliases (Single Letter Recognition)
export const ARABIC_LETTER_NAMES: Record<string, string[]> = {
  'ا': ['الف', 'ألف', 'همزة', 'ا', 'ء', 'آ'],
  'أ': ['الف', 'ألف', 'همزة', 'ا', 'ء', 'أ'],
  'إ': ['الف', 'ألف', 'همزة', 'ا', 'ء', 'إ'],
  'ء': ['همزة', 'الف', 'ء'],
  'ب': ['باء', 'با', 'ب'],
  'ت': ['تاء', 'تا', 'ت'],
  'ث': ['ثاء', 'ثا', 'ث'],
  'ج': ['جيم', 'جي', 'ج'],
  'ح': ['حاء', 'حا', 'ح'],
  'خ': ['خاء', 'خا', 'خ'],
  'د': ['دال', 'دا', 'د'],
  'ذ': ['ذال', 'ذا', 'ذ'],
  'ر': ['راء', 'را', 'ر'],
  'ز': ['زاي', 'زا', 'زين', 'ز'],
  'س': ['سين', 'سي', 'س'],
  'ش': ['شين', 'شي', 'ش'],
  'ص': ['صاد', 'صا', 'ص'],
  'ض': ['ضاد', 'ضا', 'ض'],
  'ط': ['طاء', 'طا', 'ط'],
  'ظ': ['ظاء', 'ظا', 'ظ'],
  'ع': ['عين', 'عي', 'ع'],
  'غ': ['غين', 'غي', 'غ'],
  'ف': ['فاء', 'فا', 'ف'],
  'ق': ['قاف', 'قا', 'ق'],
  'ك': ['كاف', 'كا', 'ك'],
  'ل': ['لام', 'لا', 'ل'],
  'م': ['ميم', 'مي', 'م'],
  'ن': ['نون', 'نو', 'ن'],
  'ه': ['هاء', 'ها', 'ه'],
  'و': ['واو', 'وا', 'و'],
  'ي': ['ياء', 'يا', 'ي'],
};

// Similar phonetic cousins allowed in Easy difficulty mode
export const PHONETIC_COUSINS: Record<string, string[]> = {
  'س': ['ص', 'ث'],
  'ص': ['س'],
  'ت': ['ط', 'د'],
  'ط': ['ت'],
  'ذ': ['ز', 'ظ', 'د'],
  'ز': ['ذ', 'ظ'],
  'ظ': ['ذ', 'ض', 'ز'],
  'د': ['ض', 'ت'],
  'ض': ['د', 'ظ'],
  'ه': ['ح', 'ء'],
  'ح': ['ه', 'خ'],
  'ك': ['ق'],
  'ق': ['ك', 'غ'],
  'ث': ['س', 'ذ'],
};

/**
 * Remove Arabic Tashkeel (diacritics) for structural comparison
 */
export function removeTashkeel(text: string): string {
  if (!text) return '';
  return text
    .replace(TASHKEEL_REGEX, '')
    .replace(/[أإآء]/g, 'ا') // Normalize alefs for baseline comparison
    .replace(/ة/g, 'ه') // Normalize taa marbuta
    .replace(/ى/g, 'ي') // Normalize alif maqsura
    .trim();
}

/**
 * Normalize prolonged vowels where a student or ASR elongated a short vowel (فتحة -> ا, ضمة -> و, كسرة -> ي)
 */
export function normalizeProlongedVowels(text: string): string {
  if (!text) return '';
  return text
    .replace(/([^\s])ا+/g, '$1')
    .replace(/([^\s])و+/g, '$1')
    .replace(/([^\s])ي+/g, '$1');
}

/**
 * Calculate Levenshtein Distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Count how many times the target word or phrase was repeated in the spoken text
 */
export function countTargetRepetitions(target: string, spoken: string): number {
  const normTarget = removeTashkeel(target).trim();
  const normSpoken = removeTashkeel(spoken).trim();
  if (!normTarget || !normSpoken) return 0;

  const targetTokens = normTarget.split(/\s+/).filter(Boolean);
  const spokenTokens = normSpoken.split(/\s+/).filter(Boolean);
  if (targetTokens.length === 0 || spokenTokens.length === 0) return 0;

  if (targetTokens.length === 1) {
    const singleTarget = targetTokens[0];
    let count = 0;
    for (const token of spokenTokens) {
      if (token === singleTarget) {
        count++;
      } else {
        const dist = getLevenshteinDistance(token, singleTarget);
        const maxLen = Math.max(token.length, singleTarget.length);
        if (maxLen > 0 && 1 - dist / maxLen >= 0.65) {
          count++;
        } else {
          // Check prolonged vowels
          const shortToken = normalizeProlongedVowels(token);
          const shortTarget = normalizeProlongedVowels(singleTarget);
          if (shortToken === shortTarget) {
            count++;
          }
        }
      }
    }
    return count;
  }

  // Multi-word phrase matching
  const phraseLen = targetTokens.length;
  let count = 0;
  for (let i = 0; i <= spokenTokens.length - phraseLen; i++) {
    const windowPhrase = spokenTokens.slice(i, i + phraseLen).join(' ');
    const dist = getLevenshteinDistance(windowPhrase, normTarget);
    const maxLen = Math.max(windowPhrase.length, normTarget.length);
    if (1 - dist / maxLen >= 0.65) {
      count++;
      i += phraseLen - 1;
    }
  }
  return count;
}

/**
 * Client-side phonetic evaluation with Tashkeel and repetition counting support
 */
/**
 * Client-side phonetic evaluation with Tashkeel, difficulty levels, and single/two letter recognition
 */
export function evaluateArabicLocal(
  target: string,
  spoken: string,
  repeatCount: number = 1,
  difficultyLevel: DifficultyLevel = 'medium'
): PronunciationEvaluation {
  const requiredRepetitions = typeof repeatCount === 'number' && repeatCount > 0 ? repeatCount : 1;
  const normTarget = removeTashkeel(target).trim();
  const normSpoken = removeTashkeel(spoken).trim();

  if (!normSpoken) {
    return {
      score: 0,
      grade: 'لم يتم التقاط صوت',
      isMatch: false,
      feedback: 'لم نتمكن من سماع نطق واضح في التسجيل، يرجى التحدث بالقرب من الميكروفون.',
      makhrajAdvice: 'تأكد من تفعيل صلاحية الميكروفون والتحدث في بيئة هادئة.',
      vowelAccuracy: 'غير محدد',
      detectedWord: '—',
      letterBreakdown: [],
      timestamp: Date.now(),
      engineUsed: 'local',
      requiredRepetitions,
      repetitionsDetected: 0,
      difficultyLevel,
    };
  }

  const detectedCount = countTargetRepetitions(normTarget, normSpoken);

  // 1. SPECIALIZED SINGLE-LETTER RECOGNITION (e.g. "حَ" or "ح")
  if (normTarget.length === 1) {
    const letterAliases = ARABIC_LETTER_NAMES[normTarget] || [normTarget];
    const spokenTokens = normSpoken.split(/\s+/).filter(Boolean);
    const isSingleMatch =
      normTarget === normSpoken ||
      spokenTokens.includes(normTarget) ||
      letterAliases.some((alias) => normSpoken === alias || spokenTokens.includes(alias) || normSpoken.includes(alias));

    if (isSingleMatch) {
      const letters: LetterPhoneme[] = [
        {
          letter: normTarget,
          status: 'صحيح',
          comment: 'نطق سليم ومتقن لصوت أو اسم الحرف',
        },
      ];

      return {
        score: 96,
        grade: 'ممتاز ومتقن',
        isMatch: true,
        feedback: `نطق رائع ومتقن لمخرج وصوت حرف (${target})!`,
        makhrajAdvice: 'أحسنت! مخارج الحروف نقية وصحيحة.',
        vowelAccuracy: 'متطابقة مع التشكيل',
        detectedWord: spoken,
        letterBreakdown: letters,
        timestamp: Date.now(),
        engineUsed: 'local',
        requiredRepetitions,
        repetitionsDetected: Math.max(1, detectedCount),
        difficultyLevel,
      };
    }
  }

  // 2. SPECIALIZED TWO-LETTER WORD RECOGNITION (e.g. "قُمْ")
  if (normTarget.length === 2) {
    const spokenTokens = normSpoken.split(/\s+/).filter(Boolean);
    const isTwoMatch =
      normTarget === normSpoken ||
      spokenTokens.includes(normTarget) ||
      normSpoken.includes(normTarget) ||
      normalizeProlongedVowels(normSpoken) === normTarget ||
      getLevenshteinDistance(normTarget, normSpoken) <= 1;

    if (isTwoMatch) {
      const letters: LetterPhoneme[] = normTarget.split('').map((l) => ({
        letter: l,
        status: 'صحيح',
        comment: 'تم نطقه بدقة ووضوح',
      }));

      return {
        score: 95,
        grade: 'ممتاز ومتقن',
        isMatch: true,
        feedback: `أحسنت صنعاً! نطق صحيح ومتقن للمقطع (${target}).`,
        makhrajAdvice: 'أداء صوتي فصيح وسليم.',
        vowelAccuracy: 'متطابقة مع التشكيل',
        detectedWord: spoken,
        letterBreakdown: letters,
        timestamp: Date.now(),
        engineUsed: 'local',
        requiredRepetitions,
        repetitionsDetected: Math.max(1, detectedCount),
        difficultyLevel,
      };
    }
  }

  // Check if student elongated vowels (e.g. كَتَبَ pronounced or transcribed as كاتا)
  const isProlongedMatch = normalizeProlongedVowels(normTarget) === normalizeProlongedVowels(normSpoken);

  // Exact match (single occurrence when repeatCount <= 1)
  if ((normTarget === normSpoken || isProlongedMatch) && requiredRepetitions <= 1) {
    const letters: LetterPhoneme[] = normTarget.split('').map((l) => ({
      letter: l,
      status: 'صحيح',
      comment: 'نطق سليم وواضح',
    }));

    return {
      score: isProlongedMatch && normTarget !== normSpoken ? 90 : 96,
      grade: 'ممتاز ومتقن',
      isMatch: true,
      feedback:
        isProlongedMatch && normTarget !== normSpoken
          ? 'أحسنت! نطق صحيح، مع ملاحظة عدم إشباع الحركة القصيرة لحرف مد.'
          : 'أحسنت صنعاً! نطقك للكلمة فصيح ومتقن وواضح المخارج.',
      makhrajAdvice: 'استمر على هذا المستوى الرائع في تفخيم المفخم وترقيق المرقق.',
      vowelAccuracy: 'متطابقة مع التشكيل',
      detectedWord: spoken,
      letterBreakdown: letters,
      timestamp: Date.now(),
      engineUsed: 'local',
      requiredRepetitions: 1,
      repetitionsDetected: 1,
      difficultyLevel,
    };
  }

  // Calculate similarity ratio against single token or whole
  const maxLen = Math.max(normTarget.length, normSpoken.length);
  const distance = getLevenshteinDistance(normTarget, normSpoken);
  const ratio = Math.max(0, 1 - distance / maxLen);
  let baseScore = Math.round(ratio * 100);

  // Positional letter-by-letter analysis with difficulty-aware phonetic proximity
  const breakdown: LetterPhoneme[] = [];
  const targetChars = normTarget.split('');
  const spokenChars = normSpoken.split('');

  for (let i = 0; i < targetChars.length; i++) {
    const char = targetChars[i];
    const spokenChar = spokenChars[i];

    if (spokenChar === char) {
      breakdown.push({
        letter: char,
        status: 'صحيح',
        comment: 'تم نطقه بدقة وفي موضعه',
      });
    } else if (difficultyLevel === 'easy' && spokenChar && PHONETIC_COUSINS[char]?.includes(spokenChar)) {
      // In easy mode, accept close phonetic cousins without penalty
      breakdown.push({
        letter: char,
        status: 'صحيح',
        comment: `نطق قريب ومقبول في المستوى السهل (${spokenChar} ≈ ${char})`,
      });
      baseScore = Math.min(100, baseScore + 10);
    } else if (spokenChars.includes(char)) {
      breakdown.push({
        letter: char,
        status: 'يحتاج تحسين',
        comment: 'الحرف وُجد لكن بترتيب أو موضع غير مضبوط',
      });
    } else if (spokenChar) {
      breakdown.push({
        letter: char,
        status: 'يحتاج تحسين',
        comment: `سُمع بدلاً منه: ${spokenChar}`,
      });
    } else {
      breakdown.push({
        letter: char,
        status: 'مفقود',
        comment: 'الحرف لم يظهر في الصوت المنطوق',
      });
    }
  }

  // If repetitions were detected, raise baseScore because words were matched!
  if (detectedCount > 0) {
    baseScore = Math.max(baseScore, 92);
  }

  // Difficulty multiplier
  if (difficultyLevel === 'easy') {
    baseScore = Math.min(100, Math.round(baseScore * 1.2) + 8);
  } else if (difficultyLevel === 'hard') {
    baseScore = Math.round(baseScore * 0.95);
  }

  let finalScore = baseScore;
  let grade = 'غير مطابق';
  let isMatch = false;
  let feedback = 'الكلمة المنطوقة تختلف عن الكلمة المستهدفة، استمع للنطق النموذجي وأعد المحاولة.';

  // Handling repetition count requirement:
  if (requiredRepetitions > 1) {
    if (detectedCount >= requiredRepetitions) {
      // Completed all repetitions (or even exceeded)!
      finalScore = Math.min(100, Math.max(88, baseScore));
      grade = 'ممتاز ومتقن';
      isMatch = true;
      feedback = `رائع جداً! أكملت تكرار الكلمة بنجاح (${detectedCount} مرات من ${requiredRepetitions} مطلوبة) بنطق واضح ومخارج سليمة.`;
    } else if (detectedCount > 0) {
      // Partial repetitions: lenient in easy mode, standard in medium/hard
      if (difficultyLevel === 'easy' && detectedCount >= requiredRepetitions - 1) {
        finalScore = Math.max(82, Math.round(baseScore * 0.9));
        grade = 'جيد جداً - مشجع';
        isMatch = true;
        feedback = `أحسنت! كررت الكلمة ${detectedCount} من ${requiredRepetitions} مرات بنطق جيد في المستوى السهل.`;
      } else {
        const completionRatio = detectedCount / requiredRepetitions;
        finalScore = Math.round(baseScore * completionRatio);
        grade = finalScore >= 60 ? 'جيد - نقص في التكرار' : 'غير مكتمل التكرار';
        isMatch = false;
        feedback = `نطقك صحيح ولكنك كررت الكلمة ${detectedCount} ${detectedCount === 1 ? 'مرة واحدة' : 'مرات'} فقط من أصل ${requiredRepetitions} مرات مطلوبة. تم خصم درجات لنقص التكرار، نرجو إكمال التكرار المطلوب للحصول على الدرجة الكاملة!`;
      }
    } else {
      finalScore = Math.min(finalScore, 35);
      grade = 'لم يكتمل التكرار';
      isMatch = false;
      feedback = `المطلوب تكرار الكلمة (${requiredRepetitions} مرات). لم يتم رصد الكلمة المستهدفة بوضوح، يرجى إعادة المحاولة ونطقها ${requiredRepetitions} مرات.`;
    }
  } else {
    // Single repetition thresholds by difficulty
    if (difficultyLevel === 'easy') {
      if (finalScore >= 70) {
        grade = 'رائع وممتاز';
        isMatch = true;
        feedback = 'أحسنت! نطق ممتاز ومشجع، بداية موفقة جداً!';
      } else if (finalScore >= 55) {
        grade = 'جيد جداً';
        isMatch = true;
        feedback = 'نطق جيد جداً ومقبول، واصل التدريب!';
      } else if (finalScore >= 40) {
        grade = 'جيد - خطوة ممتازة';
        isMatch = true;
        feedback = 'محاولة جيدة، استمع للصوت النموذجي وكرر.';
      }
    } else if (difficultyLevel === 'hard') {
      if (finalScore >= 90) {
        grade = 'رائع ومتقن تماماً';
        isMatch = true;
        feedback = 'إتقان تام وتجويد فصيح لكافة الحركات والمخارج!';
      } else if (finalScore >= 80) {
        grade = 'جيد جداً';
        isMatch = true;
        feedback = 'أداء جيد جداً، مع ملاحظة تدقيق إضافي على الحركات الدقيقة.';
      } else if (finalScore >= 65) {
        grade = 'يحتاج تدريباً مكثفاً';
        isMatch = false;
        feedback = 'في المستوى المتقدم يلزم نطق كل حركة بدقة تامة دون تساهل.';
      }
    } else {
      // Medium (default)
      if (finalScore >= 85) {
        grade = 'رائع وممتاز';
        isMatch = true;
        feedback = 'نطق ممتاز جداً! مخارج الحروف نقية وواضحة.';
      } else if (finalScore >= 70) {
        grade = 'جيد جداً';
        isMatch = true;
        feedback = 'أداء جيد جداً، هناك بعض الحروف أو الحركات تحتاج تركيزاً طفيفاً.';
      } else if (finalScore >= 50) {
        grade = 'جيد - يحتاج تدريباً';
        isMatch = false;
        feedback = 'بداية طيبة، استمع مجدداً للنموذج الصوتي وحاول تقليد مخرج الحرف بدقة.';
      }
    }
  }

  return {
    score: finalScore,
    grade,
    isMatch,
    feedback,
    makhrajAdvice: 'استمع للتسجيل الصوتي وركّز على حركة الشفتين واللسان عند نطق الحرف المستهدف.',
    vowelAccuracy: finalScore >= 75 ? 'متطابقة مع التشكيل' : 'تحتاج انتباه لضبط الحركات',
    detectedWord: spoken,
    letterBreakdown: breakdown,
    timestamp: Date.now(),
    engineUsed: 'local',
    requiredRepetitions,
    repetitionsDetected: detectedCount,
    difficultyLevel,
  };
}
