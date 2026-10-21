import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasKey = !!process.env.GEMINI_API_KEY;
  if (!hasKey) {
    return res.status(200).json({
      configured: false,
      model: 'gemini-3.8-flash',
      message: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel Environment Variables.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const testResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'قل كلمة واحدة: متصل',
    });

    return res.status(200).json({
      configured: true,
      model: 'gemini-3.8-flash',
      status: 'active',
      sample: testResp.text?.trim() || 'متصل',
      message: 'الذكاء الاصطناعي متصل وجاهز للتقييم!',
    });
  } catch (err: any) {
    return res.status(200).json({
      configured: true,
      model: 'gemini-3.8-flash',
      status: 'error',
      error: err?.message || 'خطأ أثناء الاتصال بالنموذج',
    });
  }
}
