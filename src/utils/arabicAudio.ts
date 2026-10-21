import { getDirectAudioUrl } from './mediaUrl';

// Global state to track currently playing audio
let currentAudioElement: HTMLAudioElement | null = null;
let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Initialize voices listener as early as possible
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices();
    if (cachedVoices.length > 0) {
      voicesLoaded = true;
    }
  };

  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/**
 * Get available Arabic voices from SpeechSynthesis
 */
export function getArabicVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  return voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('ar') ||
      v.lang.toLowerCase().includes('ar-') ||
      v.name.toLowerCase().includes('arabic') ||
      v.name.toLowerCase().includes('maged') ||
      v.name.toLowerCase().includes('laila') ||
      v.name.toLowerCase().includes('tarik')
  );
}

/**
 * Universal Arabic Audio Stream endpoint
 * Proxies Google TTS server-side without CORS or Referer blocks.
 * Works on any browser (Chrome, Safari, iPhone, Android, Firefox, Edge, PC, Mac).
 */
export function playUniversalArabicStream(
  text: string,
  rate = 1.0,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  stopAllAudio();
  const cleanText = text.replace(/↔/g, ' ثم ').replace(/[-_]/g, ' ').trim();
  if (!cleanText) {
    if (onEnd) onEnd();
    return () => {};
  }

  // 1. First choice: Use local server proxy endpoint to avoid CORS / Referer issues
  const streamUrl = `/api/tts-stream?text=${encodeURIComponent(cleanText)}`;
  const audio = new Audio(streamUrl);
  currentAudioElement = audio;

  if (rate < 0.85) {
    audio.playbackRate = 0.75;
  } else {
    audio.playbackRate = 1.0;
  }

  let started = false;
  const startHandler = () => {
    if (!started) {
      started = true;
      if (onStart) onStart();
    }
  };

  audio.onplay = startHandler;
  audio.onplaying = startHandler;

  audio.onended = () => {
    currentAudioElement = null;
    if (onEnd) onEnd();
  };

  audio.onerror = (e) => {
    console.warn('API TTS Stream error, falling back to browser speech synthesis:', e);
    currentAudioElement = null;
    // Fall back to Web Speech API
    speakArabicBrowser(cleanText, rate, onStart, onEnd, onError);
  };

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn('Audio play() error, falling back to browser speech synthesis:', err);
      currentAudioElement = null;
      speakArabicBrowser(cleanText, rate, onStart, onEnd, onError);
    });
  }

  return () => {
    audio.pause();
    currentAudioElement = null;
    if (onEnd) onEnd();
  };
}

/**
 * Speak Arabic text using browser's Web Speech API with automatic fallback to universal online stream
 */
export function speakArabicBrowser(
  text: string,
  rate = 0.9,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  if (typeof window === 'undefined') {
    if (onEnd) onEnd();
    return () => {};
  }

  stopAllAudio();

  const cleanText = text.replace(/↔/g, 'ثم قارن مع').replace(/[-_]/g, ' ').trim();
  if (!cleanText) {
    if (onEnd) onEnd();
    return () => {};
  }

  const synth = window.speechSynthesis;
  const arabicVoices = getArabicVoices();

  // If browser has no speech synthesis OR no Arabic voices installed (very common on Windows/Android/Linux)
  // Fall back immediately to the universal high-quality Arabic audio stream!
  if (!synth || arabicVoices.length === 0) {
    return playUniversalArabicStream(cleanText, rate, onStart, onEnd, onError);
  }

  let hasEnded = false;
  const finish = () => {
    if (!hasEnded) {
      hasEnded = true;
      if (onEnd) onEnd();
    }
  };

  try {
    if (synth.paused) {
      synth.resume();
    }
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const preferred =
      arabicVoices.find((v) => v.lang === 'ar-SA') ||
      arabicVoices.find((v) => v.name.toLowerCase().includes('maged') || v.name.toLowerCase().includes('google')) ||
      arabicVoices[0];
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      finish();
    };

    utterance.onerror = (e: any) => {
      if (e?.error === 'interrupted' || e?.error === 'canceled') {
        return;
      }
      console.warn('SpeechSynthesis error, falling back to universal stream:', e);
      playUniversalArabicStream(cleanText, rate, onStart, finish);
    };

    // Small delay prevents Chrome from aborting immediately after synth.cancel()
    setTimeout(() => {
      try {
        synth.speak(utterance);
        if (synth.paused) {
          synth.resume();
        }
      } catch (e) {
        playUniversalArabicStream(cleanText, rate, onStart, finish);
      }
    }, 40);

    // Safety timeout: if browser speech synthesis hangs without starting within 800ms
    const safetyCheck = setTimeout(() => {
      if (!synth.speaking && !hasEnded) {
        console.warn('SpeechSynthesis did not start, falling back to universal stream');
        playUniversalArabicStream(cleanText, rate, onStart, finish);
      }
    }, 800);

    return () => {
      clearTimeout(safetyCheck);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      finish();
    };
  } catch (err) {
    console.warn('SpeechSynthesis invocation failed, falling back to universal stream:', err);
    return playUniversalArabicStream(cleanText, rate, onStart, finish);
  }
}

/**
 * Speak Arabic text via Gemini Studio Voice backend API
 * Automatically falls back to universal stream if Gemini key is missing or fails.
 */
export async function speakArabicGemini(
  text: string,
  slow = false,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  try {
    stopAllAudio();

    if (onStart) onStart();

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, slow }),
    });

    if (!res.ok) {
      throw new Error('فشل خادم تحويل النص إلى صوت (قد لا يتوفر مفتاح Gemini في Vercel)');
    }

    const data = await res.json();
    if (!data.success || !data.audioBase64) {
      throw new Error(data.error || 'لم يتم استلام مقطع صوتي');
    }

    const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
    const audio = new Audio(audioUrl);
    currentAudioElement = audio;

    audio.onended = () => {
      currentAudioElement = null;
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      currentAudioElement = null;
      playUniversalArabicStream(text, slow ? 0.75 : 1.0, onStart, onEnd);
    };

    await audio.play();
  } catch (err) {
    console.warn('Gemini TTS failed, falling back to universal stream:', err);
    playUniversalArabicStream(text, slow ? 0.75 : 1.0, onStart, onEnd);
  }
}

/**
 * Stop any ongoing audio playback
 */
export function stopAllAudio(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement = null;
  }
}

/**
 * Play custom audio URL with fallback chain:
 * 1. Base64 / Blob direct audio (mic recording / uploaded file)
 * 2. API Proxy endpoint (for Google Drive with CORS/redirect handling)
 * 3. Direct Google Usercontent CDN
 * 4. Automatic fallback to universal Arabic stream if custom audio fails
 */
export function playCustomAudio(
  url: string,
  fallbackText: string,
  rate = 0.9,
  onStart?: () => void,
  onEnd?: () => void
): void {
  stopAllAudio();

  const trimmed = url.trim();

  // If it's a data URL or blob URL (from microphone recording or uploaded file), play immediately!
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    try {
      const audio = new Audio(trimmed);
      currentAudioElement = audio;
      if (rate < 0.85) audio.playbackRate = 0.75;
      if (onStart) onStart();
      audio.onended = () => {
        currentAudioElement = null;
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        currentAudioElement = null;
        playUniversalArabicStream(fallbackText, rate, onStart, onEnd);
      };
      audio.play().catch(() => {
        playUniversalArabicStream(fallbackText, rate, onStart, onEnd);
      });
      return;
    } catch (e) {
      playUniversalArabicStream(fallbackText, rate, onStart, onEnd);
      return;
    }
  }

  const driveIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const driveId = driveIdMatch ? driveIdMatch[1] : null;

  const candidateUrls: string[] = [];
  if (driveId) {
    // 1. API proxy endpoint handles Google Drive cookies & CORS seamlessly
    candidateUrls.push(`/api/proxy-audio?id=${encodeURIComponent(driveId)}`);
    // 2. Direct Google Drive usercontent download endpoint
    candidateUrls.push(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&authuser=0`);
    // 3. Drive UC download
    candidateUrls.push(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`);
  } else {
    candidateUrls.push(getDirectAudioUrl(trimmed));
  }

  let attemptIndex = 0;

  const tryPlayCandidate = () => {
    if (attemptIndex >= candidateUrls.length) {
      console.warn('All custom audio URLs failed, playing universal reading for:', fallbackText);
      playUniversalArabicStream(fallbackText, rate, onStart, onEnd);
      return;
    }

    const currentUrl = candidateUrls[attemptIndex];
    attemptIndex++;

    try {
      const audio = new Audio(currentUrl);
      currentAudioElement = audio;

      if (rate < 0.85) {
        audio.playbackRate = 0.75;
      }

      let started = false;
      audio.onplay = () => {
        if (!started) {
          started = true;
          if (onStart) onStart();
        }
      };

      audio.onended = () => {
        currentAudioElement = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        console.warn(`Audio attempt ${attemptIndex} failed for URL ${currentUrl}, trying next...`);
        tryPlayCandidate();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`Audio play() failed for attempt ${attemptIndex}:`, err);
          tryPlayCandidate();
        });
      }
    } catch (err) {
      console.warn(`Audio instantiation failed for attempt ${attemptIndex}:`, err);
      tryPlayCandidate();
    }
  };

  tryPlayCandidate();
}

/**
 * Speech Recognition check
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Get best audio mime type supported by the current device/browser (iOS Safari, Android Chrome, etc.)
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }
  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const t of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    } catch (e) {}
  }
  return '';
}

/**
 * Create Arabic Speech Recognizer optimized for mobile, tablet, and desktop
 */
export function createSpeechRecognizer(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
): any {
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    onError('متصفحك لا يدعم التعرف الصوتي المباشر.');
    return null;
  }

  const recognizer = new SpeechRec();
  // continuous: true prevents Android Chrome and mobile browsers from stopping after a tiny initial silence
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = 'ar-SA';
  recognizer.maxAlternatives = 3;

  recognizer.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = 0; i < event.results.length; ++i) {
      const res = event.results[i];
      if (res.isFinal) {
        finalTranscript += res[0].transcript + ' ';
      } else {
        interimTranscript += res[0].transcript;
      }
    }

    const transcript = (finalTranscript + interimTranscript).trim();
    if (transcript) {
      onResult(transcript, !!finalTranscript);
    }
  };

  recognizer.onerror = (event: any) => {
    console.warn('SpeechRecognition event error:', event.error);
    // Ignore harmless 'no-speech' events in continuous mode so recognizer stays listening
    if (event.error === 'no-speech') {
      return;
    }
    // If dialect ar-SA is not downloaded on phone, try general 'ar'
    if (event.error === 'language-not-supported' && recognizer.lang !== 'ar') {
      try {
        recognizer.lang = 'ar';
        recognizer.start();
        return;
      } catch (e) {}
    }
    onError(event.error);
  };

  recognizer.onend = () => {
    onEnd();
  };

  return recognizer;
}

/**
 * Convert Blob to Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const commaIndex = base64data.indexOf(',');
      resolve(commaIndex !== -1 ? base64data.substring(commaIndex + 1) : base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
