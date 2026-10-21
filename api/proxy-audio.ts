export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
          // Check if Google returned an HTML confirmation page instead of the audio file
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
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await finalResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);
  } catch (err: any) {
    console.warn('Error in Vercel /api/proxy-audio:', err);
    return res.status(500).send('Proxy error: ' + err.message);
  }
}
