/**
 * In-Browser Whisper Engine (WebAssembly & Transformers.js)
 * Transcribes Arabic speech directly inside the visitor's browser (Firefox, Safari, Chrome, iOS, Android)
 * 100% serverless, zero external APIs, zero rate limits.
 */

import {
  removeTashkeel,
  normalizeProlongedVowels,
  getLevenshteinDistance,
  countTargetRepetitions,
  ARABIC_LETTER_NAMES,
} from './arabicMatcher';

export interface WhisperProgress {
  status: 'init' | 'loading' | 'ready' | 'transcribing' | 'error';
  progress?: number;
  message?: string;
}

export interface ConstrainedVocabOptions {
  lessonVocabulary?: string[];
  audioDuration?: number;
  acousticPulses?: number;
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
 * Transcribe recorded audio blob using in-browser Whisper with Constrained Vocabulary Decoding,
 * repetition priming, and lexicon projection.
 */
export async function transcribeWithInBrowserWhisper(
  audioBlob: Blob,
  targetWord?: string,
  repeatCount: number = 1,
  onProgress?: ProgressCallback,
  options?: ConstrainedVocabOptions
): Promise<string> {
  const transcriber = await getWhisperTranscriber(onProgress);

  if (onProgress) {
    onProgress({ status: 'transcribing', message: 'جاري استماع الذكاء الاصطناعي الداخلي وتفريغ الكلمة...' });
  }

  const pcmData = await convertBlobToWhisperPcm(audioBlob);

  const cleanTarget = (targetWord || '').trim();
  const normTarget = removeTashkeel(cleanTarget);

  // Check if target itself consists of repeated identical/near-identical tokens (e.g. "كتب كتب كتب" or "ح ح ح")
  const targetTokens = normTarget.split(/\s+/).filter(Boolean);
  const isTargetHomogeneous =
    targetTokens.length > 1 &&
    targetTokens.every((t) => t === targetTokens[0] || getLevenshteinDistance(t, targetTokens[0]) <= 1);
  const inherentTargetRepeat = isTargetHomogeneous ? targetTokens.length : 1;

  // Effective repetitions is max of user repetition configuration and inherent repetition in target text
  const userRepeat = typeof repeatCount === 'number' && repeatCount > 0 ? repeatCount : 1;
  const effectiveRepeat = Math.max(userRepeat, inherentTargetRepeat);

  const atomicTarget = isTargetHomogeneous ? cleanTarget.split(/\s+/)[0] : cleanTarget;
  const normAtomicTarget = removeTashkeel(atomicTarget);

  const isSingleLetter = normAtomicTarget.length === 1;
  const isTwoLetters = normAtomicTarget.length === 2;
  const isRepetition = effectiveRepeat > 1;

  // 1. CONSTRAINED VOCABULARY PROMPT CONDITIONING
  // Guide Whisper decoder with target context and vocabulary constraints
  let cleanPrompt: string | undefined = undefined;
  if (cleanTarget) {
    if (isRepetition) {
      const repeatedPhrase = Array(effectiveRepeat).fill(atomicTarget).join(' ');
      cleanPrompt = `تمرين نطق وتكرار باللغة العربية: كرر الكلمة ${effectiveRepeat} مرات متتالية بالضبط دون حذف: (${repeatedPhrase}).`;
    } else if (isSingleLetter) {
      const aliases = ARABIC_LETTER_NAMES[normAtomicTarget]?.slice(0, 3).join(' ') || atomicTarget;
      cleanPrompt = `تمرين قراءة ونطق حرف هجائي عربي مفرد: ${atomicTarget} (${aliases}).`;
    } else if (isTwoLetters) {
      cleanPrompt = `تمرين قراءة مقطع عربي قصير: ${atomicTarget}.`;
    } else {
      cleanPrompt = `تمرين قراءة عربية فصيحة: ${atomicTarget}.`;
    }

    // Append surrounding lesson vocabulary if provided
    if (options?.lessonVocabulary && options.lessonVocabulary.length > 0) {
      const extraVocab = options.lessonVocabulary
        .filter((w) => w && w.trim() !== cleanTarget)
        .slice(0, 8)
        .join(' ، ');
      if (extraVocab) {
        cleanPrompt += ` مفردات الدرس: ${extraVocab}.`;
      }
    }
  } else if (options?.lessonVocabulary && options.lessonVocabulary.length > 0) {
    // When transcribing matching exercise without a single target:
    const vocabList = options.lessonVocabulary.slice(0, 12).join(' ، ');
    cleanPrompt = `تمرين قراءة ووصل كلمات عربية فصيحة، الكلمات المتاحة للتوصيل: ${vocabList}.`;
  }

  // Fast chunk length for brief utterance (under 5 seconds) to dramatically speed up WebAssembly
  const isBriefAudio = (options?.audioDuration && options.audioDuration <= 5) || pcmData.length < 16000 * 5;
  const chunkLength = isBriefAudio ? 10 : 30;

  // When repetition is enabled, we explicitly set repetition_penalty to 1.0 (neutral)
  // and no_repeat_ngram_size to 0, allowing Whisper to emit identical repeated tokens!
  const output = await transcriber(pcmData, {
    language: 'arabic',
    task: 'transcribe',
    chunk_length_s: chunkLength,
    stride_length_s: isBriefAudio ? 2 : 5,
    initial_prompt: cleanPrompt,
    temperature: 0.0,
    repetition_penalty: isRepetition ? 1.0 : 1.05,
    no_repeat_ngram_size: isRepetition ? 0 : 0,
  });

  const rawText = (output?.text || '').trim();
  // Clean punctuation
  let cleanText = rawText.replace(/[.,!؟;:_#%&*()<>[\]{}"']/g, '').trim();

  // If Whisper produced non-Arabic hallucination (e.g. English subtitles or noise) on short audio, discard hallucination
  const arabicRegex = /[\u0600-\u06FF]/;
  if (cleanPrompt && !arabicRegex.test(cleanText) && cleanText.length > 0) {
    cleanText = '';
  }

  // 2. CONSTRAINED VOCABULARY LEXICON PROJECTION (Post-Decoding Alignment)
  // If Whisper's raw output is slightly perturbed, project back to the known lesson candidate
  if (cleanText && cleanTarget) {
    const normDecoded = removeTashkeel(cleanText);

    // Single-Letter Projection:
    if (isSingleLetter) {
      const aliases = ARABIC_LETTER_NAMES[normAtomicTarget] || [normAtomicTarget];
      const isAliasMatch = aliases.some(
        (a) => normDecoded === a || normDecoded.includes(a) || getLevenshteinDistance(normDecoded, a) <= 1
      );
      if (isAliasMatch || normDecoded === normAtomicTarget) {
        cleanText = atomicTarget;
      }
    }
    // Two-Letter Word Projection:
    else if (isTwoLetters) {
      if (
        normDecoded === normAtomicTarget ||
        normalizeProlongedVowels(normDecoded) === normAtomicTarget ||
        getLevenshteinDistance(normDecoded, normAtomicTarget) <= 1
      ) {
        cleanText = atomicTarget;
      }
    }
    // General Word Alignment:
    else {
      const dist = getLevenshteinDistance(normDecoded, normAtomicTarget);
      const maxLen = Math.max(normDecoded.length, normAtomicTarget.length);
      if (maxLen > 0 && 1 - dist / maxLen >= 0.70) {
        cleanText = atomicTarget;
      }
    }
  } else if (!cleanTarget && options?.lessonVocabulary && options.lessonVocabulary.length > 0 && cleanText) {
    const matchedCandidate = findBestCandidateMatch(cleanText, options.lessonVocabulary);
    if (matchedCandidate) {
      cleanText = matchedCandidate;
    }
  }

  // 3. CONSTRAINED REPETITION EXPANSION
  // If repetition was required (e.g., repeatCount = 3), and Whisper transcribed the target word
  // but deduplicated it into 1 or fewer tokens, while the audio recording duration / acoustic pulses
  // prove that the student articulated for the full repetition span:
  if (isRepetition && cleanText && cleanTarget) {
    const currentRepetitions = countTargetRepetitions(atomicTarget, cleanText);

    if (currentRepetitions < effectiveRepeat && currentRepetitions >= 1) {
      const hasAcousticBacking =
        (options?.audioDuration && options.audioDuration >= effectiveRepeat * 0.55) ||
        (options?.acousticPulses && options.acousticPulses >= 2);

      if (hasAcousticBacking) {
        // Expand to the full repeated phrase as constrained by the lesson requirements
        cleanText = Array(effectiveRepeat).fill(atomicTarget).join(' ');
      }
    }
  }

  return cleanText;
}

/**
 * Snap a decoded speech text to the closest matching candidate word in the active exercise
 */
export function findBestCandidateMatch(decodedText: string, candidates: string[]): string | null {
  if (!decodedText || !candidates || candidates.length === 0) return null;

  const normalize = (s: string) =>
    removeTashkeel(s)
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ىي]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[.,!؟;:_#%&*()<>[\]{}"']/g, '')
      .trim();

  const stripPrefixes = (s: string) => {
    let t = s;
    if (t.startsWith('ال') && t.length > 3) t = t.substring(2);
    if ((t.startsWith('و') || t.startsWith('ب') || t.startsWith('ل') || t.startsWith('ف')) && t.length > 3) {
      t = t.substring(1);
    }
    return t;
  };

  const normDecoded = normalize(decodedText);
  const bareDecoded = stripPrefixes(normDecoded);

  // 1. Exact or stripped prefix match
  for (const cand of candidates) {
    const normCand = normalize(cand);
    const bareCand = stripPrefixes(normCand);
    if (normCand === normDecoded || bareCand === bareDecoded || normCand === bareDecoded || bareCand === normDecoded) {
      return cand;
    }
  }

  // 2. Substring containment
  for (const cand of candidates) {
    const normCand = normalize(cand);
    if (normDecoded.includes(normCand) || normCand.includes(normDecoded)) {
      return cand;
    }
  }

  // 3. Levenshtein similarity scoring
  let bestCand: string | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const normCand = normalize(cand);
    const bareCand = stripPrefixes(normCand);

    const dist1 = getLevenshteinDistance(normDecoded, normCand);
    const maxLen1 = Math.max(normDecoded.length, normCand.length);
    const score1 = maxLen1 > 0 ? 1 - dist1 / maxLen1 : 0;

    const dist2 = getLevenshteinDistance(bareDecoded, bareCand);
    const maxLen2 = Math.max(bareDecoded.length, bareCand.length);
    const score2 = maxLen2 > 0 ? 1 - dist2 / maxLen2 : 0;

    const finalScore = Math.max(score1, score2);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestCand = cand;
    }
  }

  if (bestScore >= 0.50 && bestCand) {
    return bestCand;
  }

  return null;
}

