import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, slow = false } = req.body || {};

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

    return res.status(200).json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('Error in Vercel /api/tts:', err);
    return res.status(500).json({
      success: false,
      error: 'تعذر توليد الصوت بالذكاء الاصطناعي: ' + (err?.message || 'خطأ'),
    });
  }
}
