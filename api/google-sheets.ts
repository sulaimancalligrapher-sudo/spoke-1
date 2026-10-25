export default async function handler(req: any, res: any) {
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

      // Check if Google redirected to a login page
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
        data = { success: response.ok, raw: text };
      }

      return res.status(response.status || 200).json(data);
    }

    if (req.method === 'POST') {
      const webhookUrl = req.body?.webhookUrl || req.query?.url;
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

      // Check if Google redirected to a login page
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
        data = { success: response.ok, raw: text };
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
}
