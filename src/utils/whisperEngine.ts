/**
 * In-Browser Whisper Engine (WebAssembly & Transformers.js)
 * Transcribes Arabic speech directly inside the visitor's browser (Firefox, Safari, Chrome, iOS, Android)
 * 100% serverless, zero external APIs, zero rate limits.
 */

export interface WhisperProgress {
  status: 'init' | 'loading' | 'ready' | 'transcribing' | 'error';
  progress?: number;
  message?: string;
}

type ProgressCallback = (progress: WhisperProgress) => void;

let transcriberPromise: Promise<any> | null = null;
let cachedTranscriber: any = null;

const CACHE_KEY = 'whisper_model_cached_v1';

/**
 * Check if the Whisper model is already cached on this device
 */
export function isWhisperModelCachedLocally(): boolean {
  if (typeof window === 'undefined') return false;
  return !!cachedTranscriber || localStorage.getItem(CACHE_KEY) === 'true';
}

/**
 * Convert an Audio Blob (WebM, MP4, WAV, OGG) to 16kHz Mono Float32Array PCM
 * required by the Whisper model.
 */
export async function convertBlobToWhisperPcm(audioBlob: Blob): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported on this device.');
  }

  const audioCtx = new AudioContextClass({ sampleRate: 16000 });
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error('Audio decoding timed out'));
        }
      }, 4000);

      const onOk = (buf: AudioBuffer) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          resolve(buf);
        }
      };
      const onErr = (err: any) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          reject(err);
        }
      };

      try {
        const p = audioCtx.decodeAudioData(arrayBuffer.slice(0), onOk, onErr);
        if (p && typeof p.then === 'function') {
          p.then(onOk).catch(onErr);
        }
      } catch (e) {
        onErr(e);
      }
    });

    // Extract mono channel
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoPcm = new Float32Array(length);

    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        monoPcm[i] += channelData[i] / numChannels;
      }
    }

    // Acoustic padding for short utterances (under 1.2 seconds, i.e., 19,200 samples at 16kHz)
    // Short letters like "حَ" or "قُمْ" often fail in Whisper if audio buffer is too brief
    if (monoPcm.length < 19200) {
      const paddedPcm = new Float32Array(19200);
      const offset = Math.floor((19200 - monoPcm.length) / 2);
      paddedPcm.set(monoPcm, offset);
      return paddedPcm;
    }

    return monoPcm;
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Initialize or get the cached Whisper-tiny model
 */
export async function getWhisperTranscriber(onProgress?: ProgressCallback): Promise<any> {
  if (cachedTranscriber) {
    return cachedTranscriber;
  }

  if (transcriberPromise) {
    return transcriberPromise;
  }

  transcriberPromise = (async () => {
    try {
      if (onProgress) {
        onProgress({ status: 'loading', progress: 10, message: 'بدء تهيئة محرك Whisper الداخلي...' });
      }

      const { pipeline, env } = await import('@xenova/transformers');

      // Configure transformers.js for client-side browser execution
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Silence verbose ONNX and transformers console logs
      if (env.backends?.onnx) {
        env.backends.onnx.logLevel = 'error';
      }

      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          progress_callback: (data: any) => {
            if (data.status === 'progress' && typeof data.progress === 'number') {
              const pct = Math.round(data.progress);
              if (onProgress) {
                onProgress({
                  status: 'loading',
                  progress: pct,
                  message: `جاري تحميل نموذج الذكاء الداخلي (${pct}%)... يحدث لمرة واحدة فقط ويُحفظ في جهازك`,
                });
              }
            } else if (data.status === 'ready') {
              if (onProgress) {
                onProgress({ status: 'ready', progress: 100, message: 'اكتمل تجهيز المحرك الداخلي بنجاح!' });
              }
            }
          },
        }
      );

      cachedTranscriber = transcriber;
      try {
        localStorage.setItem(CACHE_KEY, 'true');
      } catch (e) {}

      if (onProgress) {
        onProgress({ status: 'ready', progress: 100, message: 'جاهز للاستماع' });
      }
      return transcriber;
    } catch (err: any) {
      transcriberPromise = null;
      if (onProgress) {
        onProgress({ status: 'error', message: err?.message || 'فشل تحميل نموذج Whisper الداخلي' });
      }
      throw err;
    }
  })();

  return transcriberPromise;
}

/**
 * Transcribe recorded audio blob using in-browser Whisper with context guidance
 */
export async function transcribeWithInBrowserWhisper(
  audioBlob: Blob,
  targetWord?: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const transcriber = await getWhisperTranscriber(onProgress);

  if (onProgress) {
    onProgress({ status: 'transcribing', message: 'جاري استماع الذكاء الاصطناعي الداخلي وتفريغ الكلمة...' });
  }

  const pcmData = await convertBlobToWhisperPcm(audioBlob);

  const plainTarget = targetWord ? targetWord.replace(/[\u064B-\u0652\u0670\u0640\s-]/g, '').trim() : '';
  const isSingleLetter = plainTarget.length === 1;
  const isTwoLetters = plainTarget.length === 2;

  // Guide Whisper decoder with target context to prevent hallucinating english/dialects
  let cleanPrompt: string | undefined = undefined;
  if (targetWord && targetWord.trim()) {
    if (isSingleLetter) {
      cleanPrompt = `قراءة ونطق حرف هجائي عربي مفرد: ${targetWord.trim()} (نطق الحرف: ${targetWord.trim()})`;
    } else if (isTwoLetters) {
      cleanPrompt = `قراءة مقطع أو كلمة عربية قصيرة: ${targetWord.trim()}`;
    } else {
      cleanPrompt = `قراءة عربية فصيحة: ${targetWord.trim()}`;
    }
  }

  const output = await transcriber(pcmData, {
    language: 'arabic',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    initial_prompt: cleanPrompt,
    temperature: 0.0,
    repetition_penalty: 1.3,
    no_repeat_ngram_size: 3,
  });

  const rawText = (output?.text || '').trim();
  // Clean punctuation
  let cleanText = rawText.replace(/[.,!؟;:_#%&*()<>[\]{}"']/g, '').trim();

  // If Whisper produced non-Arabic hallucination (e.g. English subtitles or noise) on short audio, discard hallucination
  const arabicRegex = /[\u0600-\u06FF]/;
  if (cleanPrompt && !arabicRegex.test(cleanText) && cleanText.length > 0) {
    cleanText = '';
  }
  return cleanText;
}
