/**
 * Arabic Audio & Speech Recognition Utilities
 */

// Global state to track currently playing audio
let currentAudioElement: HTMLAudioElement | null = null;

/**
 * Get available Arabic voices from SpeechSynthesis
 */
export function getArabicVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(
    (v) => v.lang.startsWith('ar') || v.lang.includes('ar-') || v.name.toLowerCase().includes('arabic')
  );
}

/**
 * Speak Arabic text using browser's Web Speech API
 */
export function speakArabicBrowser(
  text: string,
  rate = 0.9,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onError) onError(new Error('ميزة النطق الصوتي غير مدعومة في هذا المتصفح'));
    return () => {};
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement = null;
  }

  const cleanText = text.replace(/↔/g, 'ثم قارن مع').replace(/[-_]/g, ' ');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ar-SA';
  utterance.rate = rate; // 0.7 for slow practice, 0.9 for natural
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
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    if (onEnd) onEnd();
    if (onError) onError(e);
  };

  window.speechSynthesis.speak(utterance);

  // Return cancel function
  return () => {
    window.speechSynthesis.cancel();
    if (onEnd) onEnd();
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
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement = null;
    }

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
    console.warn('Gemini TTS failed, falling back to browser speech:', err);
    speakArabicBrowser(text, slow ? 0.75 : 0.95, onStart, onEnd);
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
    onError('متصفحك لا يدعم التعرف الصوتي المباشر. يمكنك استخدام تسجيل الصوت بالذكاء الاصطناعي.');
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
      // remove data:audio/xxx;base64, prefix
      const commaIndex = base64data.indexOf(',');
      resolve(commaIndex !== -1 ? base64data.substring(commaIndex + 1) : base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
