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

    const promptText = `أنت أستاذ ومعلم خبير في تعليم النطق العربي ومخارج الحروف والتجويد.
الهدف: تقييم نطق الطالب للكلمة أو الحرف العربي بدقة وموضوعية من خلال الاستماع المباشر للتسجيل الصوتي المرفق.

الكلمة/الحرف المستهدف: "${targetWord}"
${spokenText ? `النص الملتقط أولياً: "${spokenText}"` : 'اعتمد كلياً على الاستماع للتسجيل الصوتي المرفق.'}
${requiredRepetitions > 1 ? `عدد التكرارات المطلوبة: المطلوب من الطالب نطق الكلمة ${requiredRepetitions} مرات متتالية. قم بعد مرات التكرار بدقة في الصوت.` : ''}
${notes ? `ملاحظات إضافية: ${notes}` : ''}

معايير التقييم:
1. استمع للتسجيل الصوتي المرفق وحدد الكلمة أو الحروف المنطوقة في detectedWord بدقة وتشكيل.
2. نسبة التطابق (score من 0 إلى 100) بناء على سلامة النطق ومخارج الحروف. إذا كان الصوت صامتاً أو مختلفاً تماماً، أعطِ درجة منخفضة (0-25).
3. التقدير اللفظي (grade): ممتاز، رائع، جيد جداً، جيد، أو يحتاج تدريباً.
4. هل النطق صحيح ومقبول (isMatch).
5. مخارج الحروف، الحركات (الفتحة، الضمة، الكسرة، السكون، الشدة)، والمدود.
6. ${requiredRepetitions > 1 ? `عدد التكرارات التي رصدتها في الصوت (repetitionsDetected).` : ''}
7. توجيه تربوي وملاحظة لموضع اللسان والشفتين (makhrajAdvice).

يرجى الرد بصيغة JSON وفق المخطط بدقة وسرعة.`;

    const contents: any[] = [];

    if (audioBase64) {
      let cleanMime = (audioMimeType || 'audio/wav').split(';')[0].trim().toLowerCase();
      if (cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') cleanMime = 'audio/mp4';
      
      contents.push({
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64,
        },
      });
    }

    contents.push({ text: promptText });

    const primaryModel = 'gemini-flash-latest';
    let lastError: any = null;
    let evalResultText = '';

    const modelConfig = {
      systemInstruction: 'أنت أستاذ لغة عربية خبير في علم الصوتيات ومخارج الحروف والتجويد. قيّم نطق المتعلم بدقة وموضوعية وسرعة.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.INTEGER,
            description: 'الدرجة الكلية من 0 إلى 100',
          },
          grade: {
            type: Type.STRING,
            description: 'التقدير اللفظي: ممتاز، رائع، جيد جداً، جيد، أو يحتاج تدريباً',
          },
          isMatch: {
            type: Type.BOOLEAN,
            description: 'هل نطق الكلمة بنجاح مقبول؟',
          },
          repetitionsDetected: {
            type: Type.INTEGER,
            description: 'عدد مرات تكرار الكلمة المستهدفة التي رُصدت في التسجيل',
          },
          feedback: {
            type: Type.STRING,
            description: 'ملاحظة تربوية وتشجيعية مفصلة عن النطق وعدد التكرار',
          },
          makhrajAdvice: {
            type: Type.STRING,
            description: 'نصيحة دقيقة لكيفية نطق الحرف من مخرجه الصحيح',
          },
          vowelAccuracy: {
            type: Type.STRING,
            description: 'تقييم الحركات القصيرة والطويلة (الفتحة، الضمة، الكسرة، المدود)',
          },
          detectedWord: {
            type: Type.STRING,
            description: 'الكلمة أو الجملة التي سُمعت بدقة من التسجيل',
          },
          letterBreakdown: {
            type: Type.ARRAY,
            description: 'تحليل الحروف حرفاً بحرف',
            items: {
              type: Type.OBJECT,
              properties: {
                letter: { type: Type.STRING, description: 'الحرف' },
                status: { type: Type.STRING, description: 'صحيح | يحتاج تحسين | مفقود' },
                comment: { type: Type.STRING, description: 'ملاحظة صوتية' },
              },
              required: ['letter', 'status'],
            },
          },
        },
        required: ['score', 'grade', 'isMatch', 'feedback', 'makhrajAdvice', 'vowelAccuracy', 'letterBreakdown'],
      },
    };

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: contents.length === 1 ? contents[0].text : { parts: contents },
        config: modelConfig,
      });

      if (response && response.text) {
        evalResultText = response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Primary model ${primaryModel} notice:`, err?.message || err);

      // Fast fallback to gemini-3.8-flash
      try {
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents.length === 1 ? contents[0].text : { parts: contents },
          config: modelConfig,
        });
        if (fallbackResp && fallbackResp.text) {
          evalResultText = fallbackResp.text;
        }
      } catch (fallbackErr: any) {
        lastError = fallbackErr;
      }
    }

    if (!evalResultText) {
      const errMsg = lastError?.message || '';
      const isRateLimit = lastError?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit) {
        return res.status(429).json({
          success: false,
          isRateLimited: true,
          error: 'تم تجاوز معدل السرعة للذكاء الاصطناعي (أكثر من اللازم في الدقيقة). يرجى الانتظار 5 ثوانٍ ثم النقر على الميكروفون مجدداً.',
        });
      }

      throw lastError || new Error('تعذر الحصول على استجابة من نموذج الذكاء الاصطناعي');
    }

    const parsed = JSON.parse(evalResultText);

    return res.status(200).json({
      success: true,
      evaluation: parsed,
    });
  } catch (err: any) {
    console.error('Error in Vercel /api/evaluate:', err);
    return res.status(500).json({
      success: false,
      error: 'فشل في تقييم النطق عبر الذكاء الاصطناعي: ' + (err?.message || 'خطأ'),
    });
  }
}
