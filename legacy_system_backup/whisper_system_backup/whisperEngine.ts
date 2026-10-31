/**
 * BACKUP: In-Browser Whisper Engine (WebAssembly & Transformers.js)
 * Transcribes Arabic speech directly inside the visitor's browser (Firefox, Safari, Chrome, iOS, Android)
 * 100% serverless, zero external APIs, zero rate limits.
 * Preserved for backup and future refinement.
 */

export interface WhisperProgress {
  status: 'init' | 'loading' | 'ready' | 'transcribing' | 'error';
  progress?: number;
  message?: string;
}

type ProgressCallback = (progress: WhisperProgress) => void;

let transcriberPromise: Promise<any> | null = null;
let cachedTranscriber: any = null;

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
      }, 3000);

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

    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoPcm = new Float32Array(length);

    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        monoPcm[i] += channelData[i] / numChannels;
      }
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
        onProgress({ status: 'loading', progress: 5, message: 'بدء تهيئة محرك Whisper الداخلي...' });
      }

      const { pipeline, env } = await import('@xenova/transformers');

      env.allowLocalModels = false;
      env.useBrowserCache = true;

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
                  message: `جاري تحميل نموذج الذكاء الاصطناعي الداخلي (${pct}%)... يحدث لمرة واحدة فقط ويُحفظ في جهازك`,
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
 * Transcribe recorded audio blob using in-browser Whisper
 */
export async function transcribeWithInBrowserWhisper(
  audioBlob: Blob,
  onProgress?: ProgressCallback
): Promise<string> {
  const transcriber = await getWhisperTranscriber(onProgress);

  if (onProgress) {
    onProgress({ status: 'transcribing', message: 'جاري استماع الذكاء الاصطناعي الداخلي وتفريغ الكلمة...' });
  }

  const pcmData = await convertBlobToWhisperPcm(audioBlob);

  const output = await transcriber(pcmData, {
    language: 'arabic',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const rawText = (output?.text || '').trim();
  const cleanText = rawText.replace(/[.,!؟;:]/g, '').trim();
  return cleanText;
}
