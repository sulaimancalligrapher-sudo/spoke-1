import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * API: Evaluate Arabic pronunciation
 * Evaluates student's spoken text and/or audio against the target word/letter with diacritics
 */
app.post('/api/evaluate', async (req, res) => {
  try {
    const { targetWord, spokenText, audioBase64, audioMimeType, notes, apiKey: bodyApiKey, repeatCount } = req.body;
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

    const aiInstance = new GoogleGenAI({
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

    // If audio is provided, attach as inline data for multimodal evaluation
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
    };

    try {
      const response = await aiInstance.models.generateContent({
        model: primaryModel,
        contents: contents.length === 1 ? contents[0].text : { parts: contents },
        config: modelConfig,
      });

      if (response && response.text) {
        evalResultText = response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Local primary model ${primaryModel} notice:`, err?.message || err);

      try {
        const fallbackResp = await aiInstance.models.generateContent({
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

    return res.json({
      success: true,
      evaluation: parsed,
    });
  } catch (err: any) {
    console.error('Error in /api/evaluate:', err);
    return res.status(500).json({
      success: false,
      error: 'فشل في تقييم النطق عبر الذكاء الاصطناعي: ' + (err?.message || 'خطأ غير متوقع'),
    });
  }
});

/**
 * API: High-fidelity Arabic TTS via Gemini Studio Voice
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, slow = false } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const speedInstruction = slow 
      ? 'انطق ببطء شديد وبوضوح فائق لكل حركة وسكون ومد لتعليم المبتدئين.'
      : 'انطق باللغة العربية الفصحى الواضحة مع إبراز مخارج الحروف والتشكيل.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${speedInstruction} النص: "${text}"`,
              speechMetadata: {
                style: 'Clear, articulate classical Arabic teacher',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: 'لم يتم توليد الصوت' });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('Error in /api/tts:', err);
    return res.status(500).json({
      success: false,
      error: 'تعذر توليد الصوت بالذكاء الاصطناعي: ' + (err?.message || 'خطأ'),
    });
  }
});

/**
 * Proxy Google Drive audio to bypass browser CORS / redirect issues
 */
app.get('/api/proxy-audio', async (req, res) => {
  try {
    const fileId = req.query.id as string;
    if (!fileId) {
      return res.status(400).send('Missing file ID');
    }

    const driveEndpoints = [
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    ];

    let finalResponse: any = null;

    for (const endpoint of driveEndpoints) {
      try {
        let r = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
          },
          redirect: 'follow',
        });

        if (r.ok) {
          const contentType = (r.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/html')) {
            const html = await r.text();
            const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
            if (confirmMatch && confirmMatch[1]) {
              const confirmedUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=${confirmMatch[1]}`;
              const rConfirm = await fetch(confirmedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                },
                redirect: 'follow',
              });
              if (rConfirm.ok) {
                finalResponse = rConfirm;
                break;
              }
            }
          } else {
            finalResponse = r;
            break;
          }
        }
      } catch (e) {
        console.warn('Drive proxy try failed:', e);
      }
    }

    if (!finalResponse || !finalResponse.ok) {
      return res.status(404).send('Could not retrieve audio from Google Drive. Ensure file is shared as Public ("Anyone with the link").');
    }

    const contentType = finalResponse.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType.includes('html') ? 'audio/mpeg' : contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await finalResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err: any) {
    console.warn('Error in /api/proxy-audio:', err);
    return res.status(500).send('Proxy error: ' + err.message);
  }
});

/**
 * Universal Arabic TTS Audio Stream endpoint
 * Fetches Google Translate TTS on server side without client-side Referer block
 */
app.get('/api/tts-stream', async (req, res) => {
  try {
    const text = (req.query.text as string) || '';
    if (!text || !text.trim()) {
      return res.status(400).send('Missing text parameter');
    }

    const cleanText = text.replace(/↔/g, ' ثم ').replace(/[-_]/g, ' ').trim();
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch TTS stream');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.send(buffer);
  } catch (err: any) {
    console.error('Error in /api/tts-stream:', err);
    return res.status(500).send('Internal server error');
  }
});

/**
 * API: Save updated curriculum directly to src/data/arabicCurriculum.ts
 * Enables persistent saving so exporting to GitHub bakes in all newly added lessons
 */
app.post('/api/save-curriculum', async (req, res) => {
  try {
    const { curriculum, subjects, categories } = req.body;
    if (!Array.isArray(curriculum)) {
      return res.status(400).json({ success: false, error: 'Curriculum array is required' });
    }

    const fs = await import('fs/promises');
    const curriculumPath = path.resolve(__dirname, 'src/data/arabicCurriculum.ts');

    const fileContent = `import { WordItem } from '../types';

export const INITIAL_LESSON_SUBJECTS = ${JSON.stringify(subjects || [], null, 2)};

export const INITIAL_CATEGORIES = ${JSON.stringify(categories || [], null, 2)};

export const ALL_CURRICULUM: WordItem[] = ${JSON.stringify(curriculum, null, 2)};
`;

    await fs.writeFile(curriculumPath, fileContent, 'utf-8');
    return res.json({
      success: true,
      message: 'تم حفظ الدروس والمنهج في ملفات المشروع بنجاح!',
      count: curriculum.length,
    });
  } catch (err: any) {
    console.error('Error saving curriculum to file:', err);
    return res.status(500).json({
      success: false,
      error: 'تعذر الحفظ في الملف: ' + (err?.message || 'خطأ غير متوقع'),
    });
  }
});

/**
 * API: Diagnostic AI Status check
 */
app.get('/api/ai-status', async (_req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  if (!hasKey) {
    return res.json({
      configured: false,
      model: 'gemini-3.8-flash',
      message: 'مفتاح GEMINI_API_KEY غير موجود في متغيرات البيئة.',
    });
  }

  try {
    const testResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'قل كلمة واحدة: متصل',
    });
    return res.json({
      configured: true,
      model: 'gemini-3.8-flash',
      status: 'active',
      sample: testResp.text?.trim() || 'متصل',
    });
  } catch (err: any) {
    return res.json({
      configured: true,
      model: 'gemini-3.8-flash',
      status: 'error',
      error: err?.message || 'فشل الاتصال',
    });
  }
});

/**
 * API: Google Sheets Proxy (handles GET & POST without browser CORS limitations)
 */
app.all('/api/google-sheets', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'Missing target url parameter' });
      }

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        redirect: 'follow',
      });

      const text = await response.text();

      if (text.includes('ServiceLogin') || text.includes('accounts.google.com') || (text.startsWith('<!DOCTYPE') && text.includes('Google Accounts'))) {
        return res.status(403).json({
          success: false,
          error: 'رابط السكربت يطلب تسجيل دخول Google. يرجى في محرر Apps Script التأكد عند النشر (Deploy) من جعل خيار: من يملك حق الوصول (Who has access) = أي شخص (Anyone) وليس (أنا فقط Only myself).',
        });
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE');
        let errorMsg = 'استجابة غير صالحة من Google Apps Script (لم يتم إرجاع JSON).';
        if (text.includes('unable to open the file') || text.includes('Page not found')) {
          errorMsg = 'تعذر فتح الملف في Google Apps Script. تأكد من أن الرابط منسوخ من خيار "تطبيق الويب" (Web App) وصلاحية الوصول (Anyone).';
        } else if (text.includes('Script error')) {
          errorMsg = 'حدث خطأ أثناء تنفيذ السكربت في Google Sheets.';
        }
        return res.status(502).json({
          success: false,
          error: errorMsg,
          raw: isHtml ? text.substring(0, 300) : text,
        });
      }

      return res.status(response.status || 200).json(data);
    }

    if (req.method === 'POST') {
      const webhookUrl = req.body?.webhookUrl || (req.query?.url as string);
      const payload = req.body?.payload !== undefined ? req.body.payload : req.body;

      if (!webhookUrl || typeof webhookUrl !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing webhookUrl in request body' });
      }

      const postBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

      const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        body: postBody,
        redirect: 'follow',
      });

      const text = await response.text();

      if (text.includes('ServiceLogin') || text.includes('accounts.google.com') || (text.startsWith('<!DOCTYPE') && text.includes('Google Accounts'))) {
        return res.status(403).json({
          success: false,
          error: 'رابط السكربت يطلب تسجيل دخول Google. يرجى في محرر Apps Script التأكد عند النشر (Deploy) من جعل خيار: من يملك حق الوصول (Who has access) = أي شخص (Anyone) وليس (أنا فقط Only myself).',
        });
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE');
        let errorMsg = 'استجابة غير صالحة من Google Apps Script (لم يتم إرجاع JSON).';
        if (text.includes('unable to open the file') || text.includes('Page not found')) {
          errorMsg = 'تعذر فتح السكربت في Google Apps Script. تأكد من أن الرابط منسوخ من خيار "تطبيق الويب" (Web App) وصلاحية الوصول (Anyone).';
        } else if (text.includes('Script error')) {
          errorMsg = 'حدث خطأ أثناء تنفيذ السكربت في Google Sheets.';
        }
        return res.status(502).json({
          success: false,
          error: errorMsg,
          raw: isHtml ? text.substring(0, 300) : text,
        });
      }

      return res.status(response.status || 200).json(data);
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Google Sheets Proxy Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Proxy Error: ' + (err?.message || 'Failed to communicate with Google Sheets'),
    });
  }
});

// Setup Vite development server or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
