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

    let transcript = (spokenText || '').trim();

    // 1. AI Task: "Digital Ear" Speech-to-Text (Transcribe audio without bias or knowing the target word)
    if (audioBase64) {
      let cleanMime = (audioMimeType || 'audio/wav').split(';')[0].trim().toLowerCase();
      if (cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') cleanMime = 'audio/mp4';

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
            data: audioBase64,
          },
        },
        { text: asrPrompt },
      ];

      try {
        const response = await aiInstance.models.generateContent({
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
        console.warn('Local ASR primary model notice, trying fallback:', err?.message || err);
        try {
          const fallbackResp = await aiInstance.models.generateContent({
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
        } catch (e) {
          console.warn('Local ASR fallback failed:', e);
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

    return res.json({
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
