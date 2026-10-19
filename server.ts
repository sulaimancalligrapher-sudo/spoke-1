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
const PORT = Number(process.env.PORT) || 3000;

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
    const { targetWord, spokenText, audioBase64, audioMimeType, notes } = req.body;

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

    // If audio is provided, attach as inline data for multimodal evaluation
    if (audioBase64) {
      const mime = audioMimeType || 'audio/webm';
      contents.push({
        inlineData: {
          mimeType: mime,
          data: audioBase64,
        },
      });
    }

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText);

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
