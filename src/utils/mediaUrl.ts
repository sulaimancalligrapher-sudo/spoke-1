/**
 * Extract Google Drive file ID from various link formats
 */
export function extractDriveFileId(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Match /file/d/FILE_ID or id=FILE_ID
  const match1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) return match1[1];

  const match2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) return match2[1];

  // Raw ID passed directly (alphanumeric with hyphens/underscores >= 25 chars)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Convert standard cloud storage share links (Google Drive, Dropbox, GitHub)
 * into direct playable audio and viewable image URLs.
 */
export function normalizeMediaUrl(
  url: string | undefined,
  type: 'image' | 'audio' | 'auto' = 'auto'
): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Data URLs or blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 1. Google Drive share link converter
  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    if (type === 'image') {
      // High-res Google Drive thumbnail / CDN endpoint (works 100% in <img> without CORS issues)
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
    }
    if (type === 'audio') {
      return `/api/proxy-audio?id=${encodeURIComponent(driveId)}`;
    }
    return `/api/proxy-audio?id=${encodeURIComponent(driveId)}`;
  }

  // 2. Dropbox share link converter
  if (trimmed.includes('dropbox.com')) {
    let clean = trimmed.replace(/\?dl=0$/, '').replace(/\?dl=1$/, '');
    return clean.includes('?') ? `${clean}&raw=1` : `${clean}?raw=1`;
  }

  // 3. GitHub raw content link converter
  if (trimmed.includes('github.com') && trimmed.includes('/blob/')) {
    return trimmed.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  // 4. Local or relative paths (e.g., /audio/test.mp3 or images/test.png)
  return trimmed;
}

/**
 * Specifically format Image URLs
 */
export function getDirectImageUrl(url: string | undefined): string {
  return normalizeMediaUrl(url, 'image');
}

/**
 * Specifically format Audio URLs
 */
export function getDirectAudioUrl(url: string | undefined): string {
  return normalizeMediaUrl(url, 'audio');
}

/**
 * Alternative fallback URLs for Google Drive audio in case one CDN mirror fails
 */
export function getAlternativeAudioUrls(url: string | undefined): string[] {
  if (!url) return [];
  const driveId = extractDriveFileId(url);
  if (driveId) {
    return [
      `/api/proxy-audio?id=${encodeURIComponent(driveId)}`,
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`,
    ];
  }
  return [normalizeMediaUrl(url, 'audio')];
}

