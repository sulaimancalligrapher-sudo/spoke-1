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
 * Quick client-side phonetic evaluation
 */
export function evaluateArabicLocal(target: string, spoken: string): PronunciationEvaluation {
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
    };
  }

  // Exact match
  if (normTarget === normSpoken) {
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
    };
  }

  // Calculate similarity ratio
  const maxLen = Math.max(normTarget.length, normSpoken.length);
  const distance = getLevenshteinDistance(normTarget, normSpoken);
  const ratio = Math.max(0, 1 - distance / maxLen);
  const score = Math.round(ratio * 100);

  // Letter by letter analysis
  const breakdown: LetterPhoneme[] = [];
  const targetChars = normTarget.split('');
  const spokenChars = normSpoken.split('');

  for (let i = 0; i < targetChars.length; i++) {
    const char = targetChars[i];
    if (spokenChars.includes(char)) {
      breakdown.push({
        letter: char,
        status: 'صحيح',
        comment: 'تم نطقه بدقة',
      });
    } else {
      breakdown.push({
        letter: char,
        status: 'يحتاج تحسين',
        comment: `الحرف لم يظهر بوضوح في الصوت المسجل`,
      });
    }
  }

  let grade = 'يحتاج تدريباً';
  let isMatch = false;
  let feedback = 'نطقك قريب لكنه يحتاج إلى مزيد من التدريب على ضبط المخارج والحركات.';

  if (score >= 85) {
    grade = 'رائع وممتاز';
    isMatch = true;
    feedback = 'نطق ممتاز جداً! مخارج الحروف نقية وواضحة.';
  } else if (score >= 70) {
    grade = 'جيد جداً';
    isMatch = true;
    feedback = 'أداء جيد جداً، هناك بعض الحروف أو الحركات تحتاج تركيزاً طفيفاً.';
  } else if (score >= 50) {
    grade = 'جيد';
    feedback = 'بداية طيبة، استمع مجدداً للنموذج الصوتي وحاول تقليد مخرج الحرف.';
  }

  return {
    score,
    grade,
    isMatch,
    feedback,
    makhrajAdvice: 'استمع للتسجيل الصوتي وركّز على حركة الشفتين واللسان عند نطق الحرف المستهدف.',
    vowelAccuracy: score > 75 ? 'جيدة' : 'تحتاج انتباه للحركات القصيرة',
    detectedWord: spoken,
    letterBreakdown: breakdown,
    timestamp: Date.now(),
    engineUsed: 'local',
  };
}
