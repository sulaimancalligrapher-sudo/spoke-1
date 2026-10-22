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
    const { targetWord, spokenText, audioBase64, audioMimeType, notes, apiKey: bodyApiKey } = req.body || {};
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

    const promptText = `أنت خبير ومعلم متخصص في تعليم النطق العربي ومخارج الحروف والتجويد والقراءة الصحيحة.
المهمة: تقييم نطق الطالب للكلمة أو الحرف العربي المستهدف.

الكلمة/الحرف المستهدف: "${targetWord}"
ما نطق به الطالب (أو تم التعرف عليه صوتياً): "${spokenText || 'لم يتم التعرف على نص، يرجى التقييم من الصوت إن وُجد'}"
${notes ? `ملاحظات إضافية: ${notes}` : ''}

قم بتحليل النطق بدقة وفق المعايير التالية:
1. نسبة التطابق الإجمالية (score من 0 إلى 100).
2. تقييم مخارج الحروف العربية (مثل التمييز بين: ض و د، ط و ت، ص و س، ق و ك، ع و أ، ح و هـ).
3. الحركات والمدود (الفتحة والضمة والكسرة والسكون والمدود بالألف والواو والياء).
4. تحديد الحروف التي نطقها الطالب بشكل سليم، والحروف التي تحتاج تصحيحاً.
5. نصيحة ملموسة لطريقة وضع اللسان أو حركة الشفتين للنطق السليم لمخرج الحرف.
6. تقديم تعليق تشجيعي وتربوي ملهم باللغة العربية الفصحى.

يرجى الرد بتنسيق JSON حصراً حسب المخطط المحدد.`;

    const contents: any[] = [];

    if (audioBase64) {
      // Clean mimeType so it doesn't fail on codec parameters like ';codecs=opus' or ';codecs=mp4a'
      let cleanMime = (audioMimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      if (cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') cleanMime = 'audio/mp4';
      
      contents.push({
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64,
        },
      });
    }

    contents.push({ text: promptText });

    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;
    let evalResultText = '';

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents.length === 1 ? contents[0].text : { parts: contents },
          config: {
            systemInstruction: 'أنت أستاذ لغة عربية خبير في علم الصوتيات ومخارج الحروف والتجويد. قيّم نطق المتعلم بدقة وموضوعية مع تقديم إرشاد عملي مبسط.',
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
                feedback: {
                  type: Type.STRING,
                  description: 'ملاحظة تربوية وتشجيعية مفصلة عن النطق',
                },
                makhrajAdvice: {
                  type: Type.STRING,
                  description: 'نصيحة دقيقة لكيفية نطق الحرف من مخرجه الصحيح (موضع اللسان والشفتين والحلق)',
                },
                vowelAccuracy: {
                  type: Type.STRING,
                  description: 'تقييم الحركات القصيرة والطويلة (الفتحة، الضمة، الكسرة، المدود)',
                },
                detectedWord: {
                  type: Type.STRING,
                  description: 'الكلمة التي سمعت بدقة مع التشكيل',
                },
                letterBreakdown: {
                  type: Type.ARRAY,
                  description: 'تحليل الحروف حرفاً بحرف',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      letter: { type: Type.STRING, description: 'الحرف' },
                      status: { type: Type.STRING, description: 'صحيح | يحتاج تحسين | مفقود' },
                      comment: { type: Type.STRING, description: 'ملاحظة صوتية على هذا الحرف' },
                    },
                    required: ['letter', 'status'],
                  },
                },
              },
              required: ['score', 'grade', 'isMatch', 'feedback', 'makhrajAdvice', 'vowelAccuracy', 'letterBreakdown'],
            },
          },
        });

        if (response && response.text) {
          evalResultText = response.text;
          break; // Succeeded!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed or throttled, trying next model:`, err?.message || err);
        // If it's a rate limit (429), wait a brief moment before attempting fallback
        if (err?.status === 429 || (err?.message && err.message.includes('429'))) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
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
