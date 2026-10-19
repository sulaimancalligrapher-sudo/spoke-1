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
 * Speak Arabic text using browser's Web Speech API with automatic Gemini fallback
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

  // Stop any currently playing audio
  stopAllAudio();

  const cleanText = text.replace(/↔/g, 'ثم قارن مع').replace(/[-_]/g, ' ').trim();
  if (!cleanText) {
    if (onEnd) onEnd();
    return () => {};
  }

  // Check if speech synthesis is supported and available
  const synth = window.speechSynthesis;
  if (!synth) {
    console.warn('SpeechSynthesis not supported, falling back to Gemini TTS');
    speakArabicGemini(cleanText, rate < 0.8, onStart, onEnd);
    return () => {};
  }

  // Chrome bugfix: cancel and wait 50ms before speaking
  synth.cancel();

  let hasEnded = false;
  const finish = () => {
    if (!hasEnded) {
      hasEnded = true;
      if (onEnd) onEnd();
    }
  };

  const timeoutId = setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      utterance.rate = rate;
      utterance.pitch = 1.0;

      const arabicVoices = getArabicVoices();
      if (arabicVoices.length > 0) {
        // Prefer higher quality Saudi or standard voices if available
        const preferred =
          arabicVoices.find((v) => v.lang === 'ar-SA') ||
          arabicVoices.find((v) => v.name.toLowerCase().includes('maged') || v.name.toLowerCase().includes('google')) ||
          arabicVoices[0];
        utterance.voice = preferred;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        finish();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis utterance error, falling back to Gemini TTS:', e);
        // Seamless fallback to Gemini API if browser speech synthesis fails
        speakArabicGemini(cleanText, rate < 0.8, onStart, finish);
      };

      synth.speak(utterance);

      // Safety timeout: if browser speech synthesis hangs without starting (common on some OS)
      const safetyCheck = setTimeout(() => {
        if (!synth.speaking && !hasEnded) {
          console.warn('SpeechSynthesis did not start, falling back to Gemini TTS');
          speakArabicGemini(cleanText, rate < 0.8, onStart, finish);
        }
      }, 1200);

      utterance.onstart = () => {
        clearTimeout(safetyCheck);
        if (onStart) onStart();
      };
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed, falling back to Gemini TTS:', err);
      speakArabicGemini(cleanText, rate < 0.8, onStart, finish);
    }
  }, 60);

  return () => {
    clearTimeout(timeoutId);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    finish();
  };
}

/**
 * Speak Arabic text via Gemini Studio Voice backend API
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
      throw new Error('فشل استجابة خادم الصوت');
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
      if (onEnd) onEnd();
    };

    await audio.play();
  } catch (err) {
    console.warn('Gemini TTS failed:', err);
    if (onEnd) onEnd();
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
 * Play custom audio URL (Google Drive, Dropbox, GitHub, or direct link)
 * Falls back to browser speech synthesis if URL cannot be played
 */
export function playCustomAudio(
  url: string,
  fallbackText: string,
  rate = 0.9,
  onStart?: () => void,
  onEnd?: () => void
): void {
  stopAllAudio();

  const directUrl = getDirectAudioUrl(url);
  if (!directUrl) {
    speakArabicBrowser(fallbackText, rate, onStart, onEnd);
    return;
  }

  try {
    const audio = new Audio(directUrl);
    currentAudioElement = audio;

    if (onStart) onStart();

    audio.onended = () => {
      currentAudioElement = null;
      if (onEnd) onEnd();
    };

    audio.onerror = (e) => {
      console.warn('Custom audio playback failed, falling back to TTS:', e);
      currentAudioElement = null;
      speakArabicBrowser(fallbackText, rate, onStart, onEnd);
    };

    audio.play().catch((err) => {
      console.warn('Audio play() rejected, falling back to TTS:', err);
      currentAudioElement = null;
      speakArabicBrowser(fallbackText, rate, onStart, onEnd);
    });
  } catch (err) {
    console.warn('Custom audio initialization error, falling back to TTS:', err);
    speakArabicBrowser(fallbackText, rate, onStart, onEnd);
  }
}

/**
 * Speech Recognition check
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Create Arabic Speech Recognizer
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
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.lang = 'ar-SA';
  recognizer.maxAlternatives = 3;

  recognizer.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const transcript = finalTranscript || interimTranscript;
    onResult(transcript.trim(), !!finalTranscript);
  };

  recognizer.onerror = (event: any) => {
    console.warn('SpeechRecognition error:', event.error);
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
