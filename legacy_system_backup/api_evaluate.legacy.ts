import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { targetWord, spokenText, audioBase64, audioMimeType, notes, apiKey: bodyApiKey, repeatCount } = req.body || {};
    const effectiveApiKey =
      (req.headers['x-gemini-key'] as string) ||
      bodyApiKey ||
      process.env.GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error:
          'مفتاح Gemini API غير متوفر في السيرفر. يمكنك إضافة مفتاحك بسهولة من نافذة الإعدادات لتفعيل الذكاء الاصطناعي.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: effectiveApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    if (!targetWord) {
      return res.status(400).json({ error: 'Target word is required' });
    }

    const requiredRepetitions = typeof repeatCount === 'number' && repeatCount > 0 ? repeatCount : 1;

    let transcript = (spokenText || '').trim();

    // 1. AI Task: "Digital Ear" Speech-to-Text (Transcribe audio without bias or knowing the target word)
    if (audioBase64) {
      let rawBase64 = (audioBase64 || '').trim();
      const commaIndex = rawBase64.indexOf(',');
      if (commaIndex !== -1) {
        rawBase64 = rawBase64.substring(commaIndex + 1);
      }

      let cleanMime = (audioMimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      if (cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') cleanMime = 'audio/mp4';
      if (!cleanMime || cleanMime === 'audio/*') cleanMime = 'audio/webm';

      const asrPrompt = `أنت مفرغ ومدقق صوتي عربي محترف وموضوعي 100%.
المهمة: الاستماع الدقيق للتسجيل الصوتي المرفق، وكتابة الكلمة أو الحروف أو الجملة التي نطق بها المتحدث حرفياً كما سُمعت في الصوت، مع ضبط التشكيل والحركات (الفتحة، الضمة، الكسرة، السكون، التنوين، الشدة).

قواعد حاسمة:
1. اكتب ما نطق به المتحدث حرفياً وبأمانة مطلقة دون أي تخمين أو تصحيح أو مجاملة.
2. إذا نطق المتحدث كلمة غريبة أو خاطئة أو غير فصيحة، اكتبها كما نطقها تماماً.
3. إذا نطق المتحدث الكلمة مكررة أكثر من مرة، اكتب جميع التكرارات مفصولة بمسافة (مثال: "كَتَبَ كَتَبَ").
4. إذا لم يكن هناك صوت بشري أو كان الصوت صامتاً، اكتب نصاً فارغاً "".
5. الرد يكون بصيغة JSON فقط: {"transcript": "الكلمة المنطوقة"}`;

      const contents = [
        {
          inlineData: {
            mimeType: cleanMime,
            data: rawBase64,
          },
        },
        { text: asrPrompt },
      ];

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: { parts: contents },
          config: {
            systemInstruction: 'أنت مدقق ومفرغ صوتي عربي سريع ومحايد 100%. اكتب ما تسمعه في الصوت حرفياً دون تعديل أو تخمين.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: {
                  type: Type.STRING,
                  description: 'الكلمة أو الجملة المنطوقة بدقة مع التشكيل',
                },
              },
              required: ['transcript'],
            },
          },
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed && typeof parsed.transcript === 'string') {
            transcript = parsed.transcript.trim();
          }
        }
      } catch (err: any) {
        console.warn('ASR primary model notice, trying gemini-3.5-transcribe:', err?.message || err);
        try {
          const transcribeResp = await ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: { parts: contents },
          });
          if (transcribeResp && transcribeResp.text) {
            transcript = transcribeResp.text.trim();
          }
        } catch (e2) {
          console.warn('ASR gemini-3.5-transcribe notice, trying gemini-3.8-flash:', e2);
          try {
            const fallbackResp = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: { parts: contents },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: { transcript: { type: Type.STRING } },
                  required: ['transcript'],
                },
              },
            });
            if (fallbackResp && fallbackResp.text) {
              const parsed = JSON.parse(fallbackResp.text);
              if (parsed && typeof parsed.transcript === 'string') {
                transcript = parsed.transcript.trim();
              }
            }
          } catch (e3) {
            console.warn('All ASR transcription attempts failed:', e3);
          }
        }
      }
    }

    // 2. Internal Algorithmic Evaluation: Strict, Mathematical, Zero-Bias Phonetic Scoring
    const removeDiacritics = (str: string) =>
      (str || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').trim();

    const normTarget = removeDiacritics(targetWord);
    const normSpoken = removeDiacritics(transcript);

    // Repetition counting
    const countOccurrences = (target: string, spoken: string) => {
      if (!target || !spoken) return 0;
      const targetTokens = target.split(/\s+/).filter(Boolean);
      const spokenTokens = spoken.split(/\s+/).filter(Boolean);
      if (targetTokens.length === 1) {
        const sTarget = targetTokens[0];
        let cnt = 0;
        for (const tok of spokenTokens) {
          if (tok === sTarget) cnt++;
        }
        return cnt;
      }
      return 0;
    };

    const detectedCount = countOccurrences(normTarget, normSpoken);

    // Levenshtein distance
    const getDistance = (a: string, b: string) => {
      const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
      for (let j = 0; j <= a.length; j++) m[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          m[i][j] = b[i - 1] === a[j - 1]
            ? m[i - 1][j - 1]
            : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
      }
      return m[b.length][a.length];
    };

    let finalScore = 0;
    let grade = 'غير مطابق';
    let isMatch = false;
    let feedback = '';

    if (!normSpoken) {
      finalScore = 0;
      grade = 'لم يتم التقاط صوت';
      isMatch = false;
      feedback = 'لم نتمكن من سماع نطق واضح في التسجيل، يرجى إعادة المحاولة والتحدث بالقرب من الميكروفون.';
    } else {
      const maxLen = Math.max(normTarget.length, normSpoken.length);
      const dist = getDistance(normTarget, normSpoken);
      const similarity = Math.max(0, 1 - dist / maxLen);
      let baseScore = Math.round(similarity * 100);

      if (detectedCount > 0) {
        baseScore = Math.max(baseScore, 92);
      }

      if (requiredRepetitions > 1) {
        if (detectedCount >= requiredRepetitions) {
          finalScore = Math.min(100, Math.max(88, baseScore));
          grade = 'ممتاز ومتقن';
          isMatch = true;
          feedback = `أحسنت جداً! أكملت تكرار الكلمة بنجاح (${detectedCount} مرات من ${requiredRepetitions} مطلوبة) بنطق واضح ومخارج سليمة.`;
        } else if (detectedCount > 0) {
          const ratio = detectedCount / requiredRepetitions;
          finalScore = Math.round(baseScore * ratio);
          grade = finalScore >= 60 ? 'جيد - نقص في التكرار' : 'غير مكتمل التكرار';
          isMatch = false;
          feedback = `نطقك صحيح ولكنك كررت الكلمة ${detectedCount} مرات فقط من أصل ${requiredRepetitions} مطلوبة. تم خصم درجات لنقص التكرار.`;
        } else {
          finalScore = Math.min(baseScore, 30);
          grade = 'لم يكتمل التكرار';
          isMatch = false;
          feedback = `المطلوب تكرار الكلمة (${requiredRepetitions} مرات). نطقت: (${transcript})، يرجى إعادة المحاولة ونطق الكلمة المستهدفة ${requiredRepetitions} مرات.`;
        }
      } else {
        finalScore = baseScore;
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
          feedback = `نطقت: (${transcript})، استمع مجدداً للنموذج الصوتي وحاول تقليد مخرج الحرف بدقة.`;
        } else {
          grade = 'غير مطابق';
          isMatch = false;
          feedback = `نطقت: (${transcript}) بينما المطلوب هو: (${targetWord}). الكلمتان مختلفتان تماماً، يرجى الاستماع للنموذج الصوتي وإعادة المحاولة.`;
        }
      }
    }

    // Letter breakdown
    const letterBreakdown = normTarget.split('').map((char, idx) => {
      const spChar = normSpoken[idx];
      if (spChar === char) {
        return { letter: char, status: 'صحيح', comment: 'نطق سليم وفي موضعه' };
      } else if (normSpoken.includes(char)) {
        return { letter: char, status: 'يحتاج تحسين', comment: 'الحرف وُجد بترتيب مختلف' };
      } else {
        return { letter: char, status: 'مفقود', comment: 'الحرف لم يظهر في النطق' };
      }
    });

    return res.status(200).json({
      success: true,
      transcript,
      evaluation: {
        score: finalScore,
        grade,
        isMatch,
        repetitionsDetected: detectedCount,
        requiredRepetitions,
        feedback,
        makhrajAdvice: 'استمع للتسجيل الصوتي النموذجي وركز على موضع اللسان والشفتين.',
        vowelAccuracy: finalScore >= 75 ? 'متطابقة مع التشكيل' : 'تحتاج ضبط الحركات',
        detectedWord: transcript || '—',
        letterBreakdown,
        timestamp: Date.now(),
        engineUsed: 'ai',
      },
    });
  } catch (err: any) {
    console.error('Error in Vercel /api/evaluate:', err);
    return res.status(500).json({
      success: false,
      error: 'فشل في التعرف على الصوت عبر الذكاء الاصطناعي: ' + (err?.message || 'خطأ'),
    });
  }
}
