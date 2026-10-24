import { LetterPhoneme, PronunciationEvaluation } from '../types';

// Arabic Diacritics Regex (Fatha, Damma, Kasra, Sukun, Shaddah, Tanween)
export const TASHKEEL_REGEX = /[\u064B-\u0652\u0670\u0640]/g;

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
 * Client-side phonetic evaluation with repetition counting support
 */
export function evaluateArabicLocal(
  target: string,
  spoken: string,
  repeatCount: number = 1
): PronunciationEvaluation {
  const requiredRepetitions = typeof repeatCount === 'number' && repeatCount > 0 ? repeatCount : 1;
  const normTarget = removeTashkeel(target);
  const normSpoken = removeTashkeel(spoken);

  if (!normSpoken) {
    return {
      score: 0,
      grade: 'لم يتم التقاط صوت',
      isMatch: false,
      feedback: 'لم نتمكن من سماع صوتك بوضوح، يرجى التحدث بالقرب من الميكروفون.',
      makhrajAdvice: 'تأكد من تفعيل صلاحية الميكروفون والتحدث في بيئة هادئة.',
      vowelAccuracy: 'غير محدد',
      detectedWord: '—',
      letterBreakdown: [],
      timestamp: Date.now(),
      engineUsed: 'local',
      requiredRepetitions,
      repetitionsDetected: 0,
    };
  }

  const detectedCount = countTargetRepetitions(normTarget, normSpoken);

  // Exact match (single occurrence when repeatCount <= 1)
  if (normTarget === normSpoken && requiredRepetitions <= 1) {
    const letters: LetterPhoneme[] = normTarget.split('').map((l) => ({
      letter: l,
      status: 'صحيح',
      comment: 'نطق سليم وواضح',
    }));

    return {
      score: 95,
      grade: 'ممتاز',
      isMatch: true,
      feedback: 'أحسنت صنعاً! نطقك للكلمة فصيح ومتقن وواضح المخارج.',
      makhrajAdvice: 'استمر على هذا المستوى الرائع في تفخيم المفخم وترقيق المرقق.',
      vowelAccuracy: 'ممتازة ومتطابقة مع الحركات',
      detectedWord: spoken,
      letterBreakdown: letters,
      timestamp: Date.now(),
      engineUsed: 'local',
      requiredRepetitions: 1,
      repetitionsDetected: 1,
    };
  }

  // Calculate similarity ratio against single token or whole
  const maxLen = Math.max(normTarget.length, normSpoken.length);
  const distance = getLevenshteinDistance(normTarget, normSpoken);
  const ratio = Math.max(0, 1 - distance / maxLen);
  let baseScore = Math.round(ratio * 100);

  // Positional letter-by-letter analysis
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
      // Partial repetitions: deduct proportionally as requested
      const completionRatio = detectedCount / requiredRepetitions;
      finalScore = Math.round(baseScore * completionRatio);
      grade = finalScore >= 60 ? 'جيد - نقص في التكرار' : 'غير مكتمل التكرار';
      isMatch = false;
      feedback = `نطقك صحيح ولكنك كررت الكلمة ${detectedCount} ${detectedCount === 1 ? 'مرة واحدة' : 'مرات'} فقط من أصل ${requiredRepetitions} مرات مطلوبة. تم خصم درجات لنقص التكرار، نرجو إكمال التكرار المطلوب للحصول على الدرجة الكاملة!`;
    } else {
      finalScore = Math.min(finalScore, 35);
      grade = 'لم يكتمل التكرار';
      isMatch = false;
      feedback = `المطلوب تكرار الكلمة (${requiredRepetitions} مرات). لم يتم رصد الكلمة المستهدفة بوضوح، يرجى إعادة المحاولة ونطقها ${requiredRepetitions} مرات.`;
    }
  } else {
    // Single repetition
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
      feedback = 'بداية طيبة، استمع مجدداً للنموذج الصوتي وحاول تقليد مخرج الحرف.';
    }
  }

  return {
    score: finalScore,
    grade,
    isMatch,
    feedback,
    makhrajAdvice: 'استمع للتسجيل الصوتي وركّز على حركة الشفتين واللسان عند نطق الحرف المستهدف.',
    vowelAccuracy: finalScore > 75 ? 'جيدة' : 'تحتاج انتباه للحركات القصيرة',
    detectedWord: spoken,
    letterBreakdown: breakdown,
    timestamp: Date.now(),
    engineUsed: 'local',
    requiredRepetitions,
    repetitionsDetected: detectedCount,
  };
}
