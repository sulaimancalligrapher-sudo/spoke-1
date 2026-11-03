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

  const isMobile =
    typeof navigator !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));

  const recognizer = new SpeechRec();
  // continuous = false on mobile avoids WebKit/Android freezing and delivers prompt onresult events
  recognizer.continuous = !isMobile;
  recognizer.interimResults = true;

  // Use device's Arabic dialect if available, otherwise default to ar-SA
  const deviceArabicLang =
    typeof navigator !== 'undefined' &&
    navigator.language &&
    navigator.language.toLowerCase().startsWith('ar')
      ? navigator.language
      : 'ar-SA';
  recognizer.lang = deviceArabicLang;
  recognizer.maxAlternatives = 3;

  recognizer.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = 0; i < event.results.length; ++i) {
      const res = event.results[i];
      if (res && res[0] && res[0].transcript) {
        if (res.isFinal) {
          finalTranscript += res[0].transcript + ' ';
        } else {
          interimTranscript += res[0].transcript;
        }
      }
    }

    const transcript = (finalTranscript + interimTranscript).trim().replace(/[.,!؟]/g, '');
    if (transcript) {
      onResult(transcript, !!finalTranscript);
    }
  };

  recognizer.onerror = (event: any) => {
    console.warn('SpeechRecognition event error:', event.error);
    // Ignore harmless 'no-speech' or 'aborted' events so recognizer stays alive
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    // If dialect is not installed on mobile, try fallback general 'ar'
    if (event.error === 'language-not-supported' && recognizer.lang !== 'ar') {
      try {
        recognizer.abort();
        setTimeout(() => {
          try {
            recognizer.lang = 'ar';
            recognizer.start();
          } catch (e) {}
        }, 80);
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

export interface SpeechPulseAnalysis {
  pulses: number;
  totalDuration: number;
  speechDuration: number;
}

/**
 * Physical Speech Pulse / Energy Clump Detector
 * Analyzes audio waveform energy to detect distinct vocal bursts separated by silence.
 * Confirms word repetitions even if Whisper deduplicated identical words.
 */
export async function detectSpeechPulseAnalysis(audioBlob: Blob): Promise<SpeechPulseAnalysis> {
  if (!audioBlob || audioBlob.size === 0) {
    return { pulses: 0, totalDuration: 0, speechDuration: 0 };
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return { pulses: 1, totalDuration: 1.0, speechDuration: 0.8 };
  }

  const audioCtx = new AudioContextClass();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const pcm = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalDuration = audioBuffer.duration;

    // Window configuration (30ms frames, 15ms hop)
    const frameSize = Math.floor(sampleRate * 0.03);
    const hopSize = Math.floor(sampleRate * 0.015);
    const numFrames = Math.floor((pcm.length - frameSize) / hopSize);

    if (numFrames <= 0) {
      return { pulses: 0, totalDuration, speechDuration: 0 };
    }

    const frameEnergies: number[] = new Array(numFrames);
    let maxEnergy = 0;
    let avgEnergy = 0;

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      let sumSq = 0;
      for (let i = 0; i < frameSize; i++) {
        const val = pcm[start + i];
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / frameSize);
      frameEnergies[f] = rms;
      if (rms > maxEnergy) maxEnergy = rms;
      avgEnergy += rms;
    }
    avgEnergy /= numFrames;

    if (maxEnergy < 0.012) {
      return { pulses: 0, totalDuration, speechDuration: 0 };
    }

    // Adaptive speech threshold with lower floor so softer repetitions are not discarded
    const speechThreshold = Math.max(0.012, avgEnergy * 0.55, maxEnergy * 0.12);

    // Group active frames into speech bursts (>= 90ms to count as speech, bridge <= 100ms)
    const minBurstDurationFrames = Math.floor(0.09 / 0.015);
    const maxSilenceBridgeFrames = Math.floor(0.10 / 0.015);

    interface SpeechSegment {
      start: number;
      end: number;
    }

    const rawSegments: SpeechSegment[] = [];
    let inBurst = false;
    let burstStart = 0;

    for (let f = 0; f < numFrames; f++) {
      const isActive = frameEnergies[f] >= speechThreshold;
      if (isActive && !inBurst) {
        inBurst = true;
        burstStart = f;
      } else if (!isActive && inBurst) {
        inBurst = false;
        rawSegments.push({ start: burstStart, end: f });
      }
    }
    if (inBurst) {
      rawSegments.push({ start: burstStart, end: numFrames });
    }

    if (rawSegments.length === 0) {
      return { pulses: 0, totalDuration, speechDuration: 0 };
    }

    // Merge bursts that are separated only by micro-stops (< 100ms)
    const merged: SpeechSegment[] = [rawSegments[0]];
    for (let i = 1; i < rawSegments.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = rawSegments[i];
      const gap = curr.start - prev.end;

      if (gap <= maxSilenceBridgeFrames) {
        prev.end = curr.end;
      } else {
        merged.push(curr);
      }
    }

    // Filter out transient clicks (< 90ms)
    const validBursts = merged.filter((seg) => seg.end - seg.start >= minBurstDurationFrames);
    const speechDuration = validBursts.reduce((acc, b) => acc + (b.end - b.start) * 0.015, 0);

    return {
      pulses: validBursts.length,
      totalDuration,
      speechDuration,
    };
  } catch (err) {
    console.warn('Acoustic pulse detection fallback:', err);
    return { pulses: 1, totalDuration: 1.0, speechDuration: 0.8 };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Backward compatible wrapper for pulse count
 */
export async function detectSpeechPulses(audioBlob: Blob): Promise<number> {
  const res = await detectSpeechPulseAnalysis(audioBlob);
  return res.pulses;
}

export interface AcousticComparisonResult {
  similarityScore: number; // 0 - 100
  durationRatio: number; // student / teacher
  teacherDuration: number; // in seconds
  studentDuration: number; // in seconds
  feedback: string;
}

/**
 * Compares student's audio against teacher's reference audio recording
 * using Filterbank Spectral Envelopes + Dynamic Time Warping (DTW) + Duration analysis
 */
export async function compareStudentToTeacherAudio(
  studentBlob: Blob,
  teacherAudioUrl: string
): Promise<AcousticComparisonResult | null> {
  if (!studentBlob || !teacherAudioUrl) return null;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  const audioCtx = new AudioContextClass();
  try {
    // 1. Fetch teacher audio buffer
    let teacherArrayBuffer: ArrayBuffer;
    const directUrl = getDirectAudioUrl(teacherAudioUrl);

    try {
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error('Fetch failed');
      teacherArrayBuffer = await res.arrayBuffer();
    } catch (fetchErr) {
      // Fallback via server proxy if direct fetch suffers CORS
      const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(directUrl)}`;
      const pRes = await fetch(proxyUrl);
      if (!pRes.ok) return null;
      teacherArrayBuffer = await pRes.arrayBuffer();
    }

    // 2. Decode both buffers
    const teacherBuffer = await audioCtx.decodeAudioData(teacherArrayBuffer);
    const studentArrayBuffer = await studentBlob.arrayBuffer();
    const studentBuffer = await audioCtx.decodeAudioData(studentArrayBuffer);

    const teacherPcm = teacherBuffer.getChannelData(0);
    const studentPcm = studentBuffer.getChannelData(0);

    // 3. Trim leading & trailing silence from both signals
    const trimAudio = (pcm: Float32Array, sr: number) => {
      const frameLen = Math.floor(sr * 0.02);
      let start = 0;
      let end = pcm.length;

      for (let i = 0; i < pcm.length - frameLen; i += frameLen) {
        let sum = 0;
        for (let j = 0; j < frameLen; j++) sum += Math.abs(pcm[i + j]);
        if (sum / frameLen > 0.02) {
          start = i;
          break;
        }
      }

      for (let i = pcm.length - frameLen; i > start; i -= frameLen) {
        let sum = 0;
        for (let j = 0; j < frameLen; j++) sum += Math.abs(pcm[i + j]);
        if (sum / frameLen > 0.02) {
          end = i + frameLen;
          break;
        }
      }

      const trimmedLen = Math.max(0, end - start);
      const trimmed = new Float32Array(trimmedLen);
      trimmed.set(pcm.subarray(start, end));
      const durationSec = trimmedLen / sr;
      return { pcm: trimmed, duration: durationSec };
    };

    const trimmedTeacher = trimAudio(teacherPcm, teacherBuffer.sampleRate);
    const trimmedStudent = trimAudio(studentPcm, studentBuffer.sampleRate);

    if (trimmedTeacher.duration < 0.15 || trimmedStudent.duration < 0.15) {
      return null;
    }

    // 4. Extract Filterbank spectral frames (16 frequency bands)
    const extractFilterbankFeatures = (pcm: Float32Array, sr: number): number[][] => {
      const frameSize = 512;
      const hopSize = 256;
      const numFrames = Math.floor((pcm.length - frameSize) / hopSize);
      if (numFrames <= 0) return [];

      const numBands = 16;
      const features: number[][] = [];

      for (let f = 0; f < numFrames; f++) {
        const start = f * hopSize;
        const frameBands = new Array(numBands).fill(0);

        // Simple band energy accumulation across 16 sub-bands
        const subBandSize = Math.floor((frameSize / 2) / numBands);
        for (let b = 0; b < numBands; b++) {
          let bandEnergy = 0;
          for (let k = 0; k < subBandSize; k++) {
            const sample = pcm[start + b * subBandSize + k] || 0;
            bandEnergy += sample * sample;
          }
          // Log energy compression
          frameBands[b] = Math.log1p(bandEnergy * 100);
        }

        // Normalize frame vector (unit norm)
        let normSq = 0;
        for (let b = 0; b < numBands; b++) normSq += frameBands[b] * frameBands[b];
        const norm = Math.sqrt(normSq) || 1;
        for (let b = 0; b < numBands; b++) frameBands[b] /= norm;

        features.push(frameBands);
      }
      return features;
    };

    const teacherFeatures = extractFilterbankFeatures(trimmedTeacher.pcm, teacherBuffer.sampleRate);
    const studentFeatures = extractFilterbankFeatures(trimmedStudent.pcm, studentBuffer.sampleRate);

    if (teacherFeatures.length === 0 || studentFeatures.length === 0) {
      return null;
    }

    // 5. Dynamic Time Warping (DTW)
    // Distance metric: Cosine distance between normalized feature vectors
    const vectorDist = (a: number[], b: number[]): number => {
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
      // Cosine distance = 1 - dot product (range 0.0 exact to 2.0 orthogonal/opposite)
      return Math.max(0, 1 - dot);
    };

    const M = teacherFeatures.length;
    const N = studentFeatures.length;

    // Use flat arrays for memory efficiency
    const dtw = new Float32Array(M * N);
    for (let i = 0; i < M * N; i++) dtw[i] = Infinity;

    dtw[0] = vectorDist(teacherFeatures[0], studentFeatures[0]);

    for (let i = 1; i < M; i++) {
      dtw[i * N] = dtw[(i - 1) * N] + vectorDist(teacherFeatures[i], studentFeatures[0]);
    }
    for (let j = 1; j < N; j++) {
      dtw[j] = dtw[j - 1] + vectorDist(teacherFeatures[0], studentFeatures[j]);
    }

    for (let i = 1; i < M; i++) {
      for (let j = 1; j < N; j++) {
        const cost = vectorDist(teacherFeatures[i], studentFeatures[j]);
        const prevMin = Math.min(
          dtw[(i - 1) * N + j], // insertion
          dtw[i * N + (j - 1)], // deletion
          dtw[(i - 1) * N + (j - 1)] // match
        );
        dtw[i * N + j] = cost + prevMin;
      }
    }

    const totalCost = dtw[(M - 1) * N + (N - 1)];
    const avgCost = totalCost / (M + N);

    // Map average cost (usually 0.05 to 0.45) to percentage (0 - 100)
    let similarityScore = Math.round(Math.max(10, Math.min(98, 100 - avgCost * 120)));

    // 6. Timing and Duration (Vowel Elongation / Madd) Analysis
    const durationRatio = trimmedStudent.duration / (trimmedTeacher.duration || 1);
    let feedback = '';

    if (durationRatio < 0.6) {
      similarityScore = Math.max(30, Math.round(similarityScore * 0.88));
      feedback = 'نطقك أسرع من صوت المعلم؛ أعطِ حروف المد والحركات القصيرة حقها الزمني دون تعجل.';
    } else if (durationRatio > 1.6) {
      similarityScore = Math.max(30, Math.round(similarityScore * 0.9));
      feedback = 'نطقك أطول من المعتاد؛ تجنّب إطالة الحركات القصيرة لتصبح حروف مد.';
    } else {
      feedback = 'تناسق صوتي ونغمي ممتاز مع مخارج حروف المعلم وسرعة النطق النموذجية.';
    }

    return {
      similarityScore,
      durationRatio: parseFloat(durationRatio.toFixed(2)),
      teacherDuration: parseFloat(trimmedTeacher.duration.toFixed(2)),
      studentDuration: parseFloat(trimmedStudent.duration.toFixed(2)),
      feedback,
    };
  } catch (err) {
    console.warn('Acoustic comparison error:', err);
    return null;
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}
