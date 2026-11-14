import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DictationLessonSubject,
  DictationExercise,
  DictationHistoryItem,
  StudentRegistrant,
} from '../types';
import { SupportedLang, TranslationItem } from '../utils/translations';
import {
  submitDictationAnswerToSheet,
  extractPercentageFromMatchingText,
} from '../utils/googleSheets';
import { transcribeWithInBrowserWhisper } from '../utils/whisperEngine';
import {
  parseQuestionBlocks,
  getDirectImageUrl,
} from '../utils/matchingMedia';
import { getAlternativeAudioUrls } from '../utils/mediaUrl';
import {
  DictationTile,
  detectDictationType,
  getDictationTypeLabel,
  parseAnswerWithBlanks,
  buildShuffledTiles,
  formatAssembledPreview,
  verifyDictationAnswer,
  matchSpokenToDictationTile,
} from '../utils/dictationUtils';
import {
  Mic,
  Sparkles,
  Award,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowRight,
  ZoomIn,
  Volume2,
  Pause,
  X,
  Lock,
  Check,
  Delete,
  Eraser,
} from 'lucide-react';

interface DictationArenaProps {
  subjects: DictationLessonSubject[];
  currentStudent: StudentRegistrant | null;
  webhookUrl?: string;
  currentLang?: SupportedLang;
  translations?: TranslationItem[];
  t?: (id: string, fallback?: string) => string;
  onRequestLogin?: () => void;
  onBackToPronunciation?: () => void;
  activeSubjectId?: string;
  activeExerciseIndex?: number;
  onSelectSubjectExercise?: (subjectId: string, exerciseIndex: number) => void;
  dictationHistory?: DictationHistoryItem[];
  retryNonce?: number;
  onDictationSubmitted?: (submitted?: {
    subjectName: string;
    exerciseNumber: number;
    formulaString: string;
    percentage: number;
    completionStatus: string;
  }) => void;
}

// Cross-browser safe audio synthesizer (Firefox, Chrome, Safari, iOS, Android)
let sharedAudioCtx: AudioContext | null = null;
const cachedWavUris: Partial<Record<'success' | 'error' | 'tap', string>> = {};

function buildWavDataUri(
  durationSec: number,
  sampleGenerator: (t: number) => number
): string {
  const sampleRate = 22050;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const clamped = Math.max(-1, Math.min(1, sampleGenerator(t)));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getChimeWavUri(type: 'success' | 'error' | 'tap'): string {
  if (cachedWavUris[type]) return cachedWavUris[type]!;

  let uri = '';
  if (type === 'success') {
    const notes = [
      { freq: 523.25, start: 0 },
      { freq: 659.25, start: 0.08 },
      { freq: 783.99, start: 0.16 },
    ];
    uri = buildWavDataUri(0.52, (t) => {
      let sum = 0;
      for (const n of notes) {
        if (t >= n.start && t <= n.start + 0.35) {
          const lt = t - n.start;
          const env = Math.min(1, lt / 0.01) * Math.exp(-lt * 9);
          sum += Math.sin(2 * Math.PI * n.freq * lt) * env * 0.28;
        }
      }
      return sum;
    });
  } else if (type === 'error') {
    uri = buildWavDataUri(0.26, (t) => {
      const freq = 200 - (75 * t) / 0.26;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 8);
      const phase = 2 * Math.PI * freq * t;
      return (Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.2) * env * 0.32;
    });
  } else {
    uri = buildWavDataUri(0.07, (t) => {
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 45);
      return Math.sin(2 * Math.PI * 800 * t) * env * 0.24;
    });
  }

  cachedWavUris[type] = uri;
  return uri;
}

function unlockAudioEngine() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioContextClass();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      try {
        const silentBuf = sharedAudioCtx.createBuffer(1, 1, 22050);
        const src = sharedAudioCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(sharedAudioCtx.destination);
        src.start(0);
      } catch {}
    }
    getChimeWavUri('tap');
  } catch {}
}

function playAudioChime(type: 'success' | 'error' | 'tap') {
  try {
    const wavUri = getChimeWavUri(type);
    const audio = new Audio(wavUri);
    audio.volume = type === 'tap' ? 0.5 : 0.75;
    audio.play().catch(() => {});
  } catch {}
}

export const DictationArena: React.FC<DictationArenaProps> = ({
  subjects,
  currentStudent,
  webhookUrl,
  t,
  onRequestLogin,
  onBackToPronunciation,
  activeSubjectId: propSubjectId,
  activeExerciseIndex: propExerciseIndex,
  onSelectSubjectExercise,
  dictationHistory = [],
  retryNonce = 0,
  onDictationSubmitted,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    propSubjectId || subjects[0]?.id || ''
  );
  const [exerciseIndex, setExerciseIndex] = useState<number>(propExerciseIndex || 0);

  useEffect(() => {
    if (propSubjectId) setSelectedSubjectId(propSubjectId);
  }, [propSubjectId]);

  useEffect(() => {
    if (typeof propExerciseIndex === 'number') setExerciseIndex(propExerciseIndex);
  }, [propExerciseIndex]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  }, [subjects, selectedSubjectId]);

  const activeExercise: DictationExercise | null = useMemo(() => {
    if (!activeSubject || activeSubject.exercises.length === 0) return null;
    const safeIdx = Math.min(exerciseIndex, activeSubject.exercises.length - 1);
    return activeSubject.exercises[safeIdx] || null;
  }, [activeSubject, exerciseIndex]);

  const detectedType = useMemo(() => {
    if (!activeExercise) return 'letters_word';
    return detectDictationType(activeExercise.scrambledPool, activeExercise.correctAnswer);
  }, [activeExercise]);

  const parsedBlanks = useMemo(() => {
    if (!activeExercise) return parseAnswerWithBlanks('');
    return parseAnswerWithBlanks(activeExercise.correctAnswer);
  }, [activeExercise]);

  // Student interaction state
  const [shuffledTiles, setShuffledTiles] = useState<DictationTile[]>([]);
  const [selectedTiles, setSelectedTiles] = useState<DictationTile[]>([]);
  const [blankAssignments, setBlankAssignments] = useState<Record<number, DictationTile | null>>({});
  const [activeBlankIdx, setActiveBlankIdx] = useState<number>(0);

  const [wrongAttempts, setWrongAttempts] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(100);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);
  const [completedExercisesInSubject, setCompletedExercisesInSubject] = useState<Record<number, number>>({});

  // Guidance / feedback message
  const [guidanceBox, setGuidanceBox] = useState<{
    type: 'info' | 'success' | 'error' | 'recording';
    message: string;
  } | null>(null);

  // Media state (question image lightbox + audio player)
  const [playingMediaKey, setPlayingMediaKey] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const mediaAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice input state (SpeechRecognition + Firefox Whisper fallback)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<any>(null);
  const recordingTimeoutRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const exerciseDuration = activeExercise?.durationSeconds || 5;

  const stopMediaAudio = () => {
    if (mediaAudioRef.current) {
      try {
        mediaAudioRef.current.pause();
      } catch {}
      mediaAudioRef.current = null;
    }
    setPlayingMediaKey(null);
  };

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(0);
  };

  const stopVoiceRecording = () => {
    clearCountdown();
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recognizerRef.current) {
      const rec = recognizerRef.current;
      recognizerRef.current = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      mr.ondataavailable = null;
      mr.onstop = null;
      try {
        if (mr.state !== 'inactive') mr.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((trck) => trck.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  };

  // Initialize / reset exercise when activeExercise or retryNonce changes
  const initExercise = () => {
    stopVoiceRecording();
    stopMediaAudio();
    if (!activeExercise) return;

    const exType = detectDictationType(activeExercise.scrambledPool, activeExercise.correctAnswer);
    const tiles = buildShuffledTiles(
      activeExercise.scrambledPool,
      activeExercise.correctAnswer,
      exType
    );

    setShuffledTiles(tiles);
    setSelectedTiles([]);
    setBlankAssignments({});
    setActiveBlankIdx(0);
    setWrongAttempts(0);
    setIsCompleted(false);
    setFinalScore(100);
    setLastSubmittedAnswer('');
    setSheetSyncSuccess(null);

    const blanks = parseAnswerWithBlanks(activeExercise.correctAnswer);
    setGuidanceBox({
      type: 'info',
      message: blanks.hasBlanks
        ? 'اختر الحرف أو الكلمة المناسبة لإكمال الفراغ، ثم اضغط زر «تحقق».'
        : 'رتب البطاقات بالترتيب الصحيح في مربع التكوين، ثم اضغط زر «تحقق».',
    });
  };

  useEffect(() => {
    initExercise();
  }, [activeExercise, retryNonce]);

  useEffect(() => {
    return () => {
      stopVoiceRecording();
      stopMediaAudio();
    };
  }, []);

  // Recorded history entry for retry lock check
  const recordedExerciseEntry = useMemo(() => {
    if (!activeSubject || !activeExercise || !dictationHistory.length) return null;
    const cleanSubj = (activeSubject.subjectName || '').trim();
    const rec = dictationHistory.find((h) => (h.lessonSubject || '').trim() === cleanSubj);
    if (!rec || !Array.isArray(rec.exercises)) return null;
    return rec.exercises.find((e) => e.exerciseNumber === activeExercise.exerciseNumber) || null;
  }, [activeSubject, activeExercise, dictationHistory]);

  const isRetryLockedSubmitted = Boolean(
    activeExercise &&
      activeExercise.allowRetry === false &&
      recordedExerciseEntry &&
      retryNonce === 0
  );

  // Set of tile IDs currently placed in composition box or blanks
  const usedTileIds = useMemo(() => {
    const ids = new Set<string>();
    if (parsedBlanks.hasBlanks) {
      Object.values(blankAssignments).forEach((tile) => {
        if (tile) ids.add(tile.id);
      });
    } else {
      selectedTiles.forEach((tile) => ids.add(tile.id));
    }
    return ids;
  }, [parsedBlanks.hasBlanks, blankAssignments, selectedTiles]);

  // Play question audio
  const handlePlayMediaAudio = (key: string, rawUrl: string) => {
    const clean = (rawUrl || '').trim();
    if (!clean) return;

    if (playingMediaKey === key && mediaAudioRef.current) {
      mediaAudioRef.current.pause();
      setPlayingMediaKey(null);
      return;
    }

    stopMediaAudio();
    const candidates = getAlternativeAudioUrls(clean);
    if (candidates.length === 0) candidates.push(clean);

    setPlayingMediaKey(key);
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        setPlayingMediaKey(null);
        return;
      }
      const src = candidates[idx++];
      const audio = new Audio(src);
      mediaAudioRef.current = audio;
      audio.onended = () => setPlayingMediaKey(null);
      audio.onerror = () => tryNext();
      audio.play().catch(() => tryNext());
    };
    tryNext();
  };

  // Click a tile in the Scrambled Bank
  const handleSelectTile = (tile: DictationTile) => {
    unlockAudioEngine();
    if (isCompleted || usedTileIds.has(tile.id)) return;
    playAudioChime('tap');

    if (parsedBlanks.hasBlanks) {
      const totalBlanks = parsedBlanks.expectedBlanks.length;
      if (totalBlanks === 0) return;

      // Use activeBlankIdx if it's empty, otherwise pick the first empty blank
      let targetBlank = activeBlankIdx;
      if (targetBlank < 0 || targetBlank >= totalBlanks || blankAssignments[targetBlank]) {
        const firstEmpty = parsedBlanks.expectedBlanks.findIndex((_, i) => !blankAssignments[i]);
        targetBlank = firstEmpty !== -1 ? firstEmpty : activeBlankIdx;
      }

      const nextAssignments = {
        ...blankAssignments,
        [targetBlank]: tile,
      };
      setBlankAssignments(nextAssignments);

      const nextEmpty = parsedBlanks.expectedBlanks.findIndex((_, i) => !nextAssignments[i]);
      if (nextEmpty !== -1) {
        setActiveBlankIdx(nextEmpty);
      }
      setGuidanceBox({
        type: 'info',
        message: 'عند الانتهاء من اختيار الإجابة، اضغط على زر «تحقق».',
      });
      return;
    }

    // Ordering modes
    setSelectedTiles((prev) => [...prev, tile]);
    setGuidanceBox({
      type: 'info',
      message: 'تابع الترتيب أو اضغط «تحقق» لفحص إجابتك.',
    });
  };

  // Remove a tile from the Composition Box
  const handleRemovePlacedTile = (tileId: string) => {
    unlockAudioEngine();
    if (isCompleted) return;
    playAudioChime('tap');
    setSelectedTiles((prev) => prev.filter((t) => t.id !== tileId));
  };

  // Click a blank slot in Fill-in-the-blank mode
  const handleBlankSlotClick = (blankIdx: number) => {
    unlockAudioEngine();
    if (isCompleted) return;
    playAudioChime('tap');
    if (blankAssignments[blankIdx]) {
      setBlankAssignments((prev) => ({
        ...prev,
        [blankIdx]: null,
      }));
    }
    setActiveBlankIdx(blankIdx);
  };

  // Undo last placed item
  const handleUndo = () => {
    unlockAudioEngine();
    if (isCompleted) return;
    playAudioChime('tap');

    if (parsedBlanks.hasBlanks) {
      for (let i = parsedBlanks.expectedBlanks.length - 1; i >= 0; i--) {
        if (blankAssignments[i]) {
          setBlankAssignments((prev) => ({ ...prev, [i]: null }));
          setActiveBlankIdx(i);
          break;
        }
      }
      return;
    }

    setSelectedTiles((prev) => prev.slice(0, -1));
  };

  // Clear all placed items
  const handleClear = () => {
    unlockAudioEngine();
    if (isCompleted) return;
    playAudioChime('tap');
    setSelectedTiles([]);
    setBlankAssignments({});
    setActiveBlankIdx(0);
    setGuidanceBox({
      type: 'info',
      message: 'تم مسح المربع. أعد اختيار البطاقات ثم اضغط «تحقق».',
    });
  };

  // Handle explicit Check ("تحقق") button click — REQUIRED IN ALL 5 TYPES!
  const handleCheckAnswer = async () => {
    unlockAudioEngine();
    if (!activeExercise || !activeSubject || isCompleted) return;

    // Ensure student placed at least something
    if (parsedBlanks.hasBlanks) {
      const anyMissing = parsedBlanks.expectedBlanks.some((_, idx) => !blankAssignments[idx]);
      if (anyMissing) {
        playAudioChime('error');
        setGuidanceBox({
          type: 'error',
          message: '⚠️ يرجى إكمال الفراغ الناقص أولاً ثم الضغط على زر «تحقق».',
        });
        return;
      }
    } else if (selectedTiles.length === 0) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: '⚠️ مربع التكوين فارغ! اختر البطاقات أعلاه أولاً ثم اضغط «تحقق».',
      });
      return;
    }

    const result = verifyDictationAnswer({
      type: detectedType,
      correctAnswer: activeExercise.correctAnswer,
      selectedTiles,
      blankAssignments,
    });

    if (!result.isCorrect) {
      playAudioChime('error');
      const nextWrong = wrongAttempts + 1;
      setWrongAttempts(nextWrong);
      setGuidanceBox({
        type: 'error',
        message: `❌ الإجابة غير صحيحة (${result.assembledAnswer || '—'}). راجع الترتيب أو الحرف وحاول مجدداً ثم اضغط «تحقق».`,
      });
      return;
    }

    // Correct Answer!
    playAudioChime('success');
    setIsCompleted(true);
    setLastSubmittedAnswer(result.assembledAnswer || result.expectedDisplay);

    const score =
      wrongAttempts === 0
        ? 100
        : Math.max(40, Math.round(100 - wrongAttempts * 15));
    setFinalScore(score);

    const formulaString =
      wrongAttempts === 0
        ? `(صحيح من أول محاولة = ${score}%)`
        : `(صحيح - أخطاء التحقق ${wrongAttempts} = ${score}%)`;

    setGuidanceBox({
      type: 'success',
      message: `✓ أحسنت! إجابة صحيحة ومتقنة: «${result.expectedDisplay}» (${score}%)`,
    });

    const updatedCompleted = {
      ...completedExercisesInSubject,
      [activeExercise.exerciseNumber]: score,
    };
    setCompletedExercisesInSubject(updatedCompleted);

    const totalInSubject = activeSubject.exercises.length;
    const completedCount = Object.keys(updatedCompleted).length;
    const scoresArr = Object.values(updatedCompleted);
    const overallPercentage = Math.round(
      scoresArr.reduce((a, b) => a + b, 0) / Math.max(1, scoresArr.length)
    );
    const completionStatus =
      completedCount >= totalInSubject
        ? `مكتمل (${completedCount} من ${totalInSubject} تمارين) - النسبة: ${overallPercentage}%`
        : `جاري الإنجاز (${completedCount} من ${totalInSubject} تمارين) - النسبة التراكمية: ${overallPercentage}%`;

    if (onDictationSubmitted) {
      onDictationSubmitted({
        subjectName: activeSubject.subjectName,
        exerciseNumber: activeExercise.exerciseNumber,
        formulaString,
        percentage: score,
        completionStatus,
      });
    }

    if (webhookUrl && currentStudent) {
      setIsSubmitting(true);
      try {
        const res = await submitDictationAnswerToSheet(webhookUrl, {
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          subjectName: activeSubject.subjectName,
          exerciseNumber: activeExercise.exerciseNumber,
          wrongAttempts,
          percentage: score,
          totalExercisesInSubject: totalInSubject,
          completedCountInSubject: completedCount,
          overallPercentage,
          summaryString: formulaString,
        });
        if (res.success) {
          setSheetSyncSuccess('تم توثيق درجتك في ورقة answers 3 بنجاح ✓');
        }
      } catch (err) {
        console.warn('Failed to submit dictation answer:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Voice input matched handler
  const handleVoiceRecognized = (spokenText: string) => {
    const availableTiles = shuffledTiles.filter((tile) => !usedTileIds.has(tile.id));
    if (availableTiles.length === 0) return;

    const matchedTile = matchSpokenToDictationTile(spokenText, availableTiles);
    if (matchedTile) {
      handleSelectTile(matchedTile);
      setGuidanceBox({
        type: 'success',
        message: `✓ تم اختيار «${matchedTile.text}» عبر الصوت. تابع الاختيار أو اضغط «تحقق».`,
      });
    } else {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${spokenText}» — لم يطابق أياً من البطاقات المتبقية. انطق الحرف أو الكلمة بوضوح أو انقر عليها.`,
      });
    }
  };

  const recordAndTranscribeWithWhisper = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('المتصفح لا يدعم الوصول للميكروفون');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        clearCountdown();
        if (mediaStreamRef.current) {
          try {
            mediaStreamRef.current.getTracks().forEach((trck) => trck.stop());
          } catch {}
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setIsListening(false);

        if (chunks.length === 0) {
          setGuidanceBox({
            type: 'error',
            message: 'لم يتم التقاط صوت واضح، حاول مجدداً أو انقر على البطاقات.',
          });
          return;
        }

        setIsTranscribing(true);
        setGuidanceBox({
          type: 'recording',
          message: 'جاري التعرف على الحرف أو الكلمة المنطوقة... ⏳',
        });

        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          const remainingCandidates = shuffledTiles
            .filter((tile) => !usedTileIds.has(tile.id))
            .map((tile) => tile.text);
          const text = await transcribeWithInBrowserWhisper(
            audioBlob,
            undefined,
            1,
            undefined,
            { lessonVocabulary: remainingCandidates, audioDuration: exerciseDuration }
          );
          setIsTranscribing(false);
          const clean = (text || '').trim();
          if (clean) {
            handleVoiceRecognized(clean);
          } else {
            setGuidanceBox({
              type: 'error',
              message: 'لم يتم التقاط صوت واضح، يمكنك النقر بالماوس أو اللمس على البطاقات.',
            });
          }
        } catch {
          setIsTranscribing(false);
          setGuidanceBox({
            type: 'error',
            message: 'تعذر تحليل الصوت، يمكنك النقر مباشرة على البطاقات.',
          });
        }
      };

      recorder.start(100);
      setCountdown(exerciseDuration);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);

      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }, exerciseDuration * 1000);
    } catch {
      stopVoiceRecording();
      setIsTranscribing(false);
      setGuidanceBox({
        type: 'error',
        message: 'تعذر الوصول للميكروفون. يمكنك الاختيار بالنقر أو اللمس مباشرة.',
      });
    }
  };

  const handleToggleVoiceInput = () => {
    unlockAudioEngine();
    if (isCompleted || isTranscribing) return;

    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
          return;
        } catch {}
      }
      stopVoiceRecording();
      setGuidanceBox({
        type: 'info',
        message: 'تم إيقاف الاستماع. انقر على البطاقات أو أعد التسجيل.',
      });
      return;
    }

    setIsListening(true);
    setCountdown(exerciseDuration);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    setGuidanceBox({
      type: 'recording',
      message: 'تحدث الآن... انطق الحرف (مثل: سين / باء) أو الكلمة المطلوبة 🎙️',
    });

    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    const SpeechRec =
      !isFirefox && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRec) {
      try {
        const recognizer = new SpeechRec();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.maxAlternatives = 3;
        recognizer.lang = 'ar-SA';

        recordingTimeoutRef.current = setTimeout(() => {
          stopVoiceRecording();
        }, exerciseDuration * 1000);

        recognizer.onresult = (event: any) => {
          stopVoiceRecording();
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          const trimmed = transcript.trim().replace(/[.,!؟]/g, '');
          if (trimmed) {
            handleVoiceRecognized(trimmed);
          }
        };
        recognizer.onerror = () => {
          stopVoiceRecording();
        };
        recognizer.onend = () => {
          stopVoiceRecording();
        };

        recognizerRef.current = recognizer;
        recognizer.start();
      } catch {
        recordAndTranscribeWithWhisper();
      }
    } else {
      recordAndTranscribeWithWhisper();
    }
  };

  const handleNextExercise = () => {
    if (activeSubject && exerciseIndex < activeSubject.exercises.length - 1) {
      const nextIdx = exerciseIndex + 1;
      setExerciseIndex(nextIdx);
      if (onSelectSubjectExercise) {
        onSelectSubjectExercise(activeSubject.id, nextIdx);
      }
    }
  };

  if (!activeSubject || !activeExercise) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 shadow-sm">
        <Sparkles className="w-12 h-12 text-teal-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          لا توجد تمارين إملاء مضافة حالياً
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          يمكن للمعلم إضافة تمارين جديدة من تبويب «تمرين الإملاء» في لوحة التحكم.
        </p>
        {onBackToPronunciation && (
          <button
            onClick={onBackToPronunciation}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            العودة إلى تمرين النطق
          </button>
        )}
      </div>
    );
  }

  const questionBlocks = parseQuestionBlocks(activeExercise.questionText);
  const assembledPreview = !parsedBlanks.hasBlanks
    ? formatAssembledPreview(selectedTiles, detectedType, activeExercise.correctAnswer)
    : '';

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Main Arena Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-lg shadow-slate-200/40 relative overflow-hidden flex flex-col items-center">
        {/* Background Soft Decor */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* 1. Badges Row: Dictation Badge + Auto-detected Question Type */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200/80 text-teal-800 rounded-full text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>{tr('dictation_question_badge', 'تمرين الإملاء والتركيب')}</span>
          </div>
          <span className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[11px] font-bold">
            {getDictationTypeLabel(detectedType)}
          </span>
        </div>

        {/* 2. Question Area (Text | Image | Audio in Teacher Order) */}
        <div className="w-full flex flex-col items-center gap-3 mb-4 text-center">
          {questionBlocks.map((block, bIdx) => {
            if (block.type === 'text') {
              return (
                <h2
                  key={`dq-txt-${bIdx}`}
                  className="text-xl sm:text-2xl font-extrabold text-slate-900 font-cairo leading-relaxed"
                >
                  {block.value}
                </h2>
              );
            }

            if (block.type === 'image') {
              const directImg = getDirectImageUrl(block.value);
              return (
                <div key={`dq-img-${bIdx}`} className="relative group inline-block">
                  <img
                    src={directImg}
                    alt="صورة السؤال"
                    onClick={() => setLightboxImageUrl(directImg)}
                    className="max-h-44 sm:max-h-52 rounded-2xl border-2 border-slate-200 shadow-sm object-contain bg-white cursor-zoom-in transition-transform hover:scale-[1.02]"
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxImageUrl(directImg)}
                    className="absolute bottom-2 left-2 p-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                    title="تكبير الصورة"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            const qAudioKey = `dict-q-audio-${bIdx}`;
            const isQPlaying = playingMediaKey === qAudioKey;
            return (
              <button
                key={`dq-aud-${bIdx}`}
                type="button"
                onClick={() => handlePlayMediaAudio(qAudioKey, block.value)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold border transition-all cursor-pointer shadow-xs ${
                  isQPlaying
                    ? 'bg-amber-600 text-white border-amber-600 ring-4 ring-amber-200'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {isQPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>إيقاف ⏸️</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>استمع لصوت السؤال 🔊</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Student Login Warning if Guest */}
        {!currentStudent && (
          <div className="mb-3 w-full max-w-md py-2 px-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900 font-bold">
            <span>سجّل دخولك لتوثيق درجاتك في ورقة answers 3</span>
            {onRequestLogin && (
              <button
                type="button"
                onClick={onRequestLogin}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
              >
                دخول المشترك
              </button>
            )}
          </div>
        )}

        {/* 3. Locked View OR Interactive Playable Exercise */}
        {isRetryLockedSubmitted && recordedExerciseEntry ? (
          <div className="w-full max-w-lg my-5 p-6 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                تم تسجيل إجابتك في هذا التمرين
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                الإعادة غير مفعلة لهذا التمرين.
              </p>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 font-mono text-sm font-black text-emerald-700">
              {extractPercentageFromMatchingText(
                recordedExerciseEntry.formulaString,
                recordedExerciseEntry.percentage
              )}
              % — {recordedExerciseEntry.formulaString}
            </div>
            {exerciseIndex < activeSubject.exercises.length - 1 && (
              <button
                type="button"
                onClick={handleNextExercise}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <span>التمرين التالي</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4">
            {/* AREA A: SCRAMBLED TILES (Compact, Low-Margin, Above Composition Box) + Voice Mic */}
            <div className="w-full p-3.5 sm:p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-600">
                  {tr('dictation_pool_title', 'الحروف والكلمات المشتتة (انقر أو انطق للاختيار):')}
                </span>

                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  disabled={isCompleted || isTranscribing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                    isListening
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse ring-2 ring-rose-200'
                      : isTranscribing
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white hover:bg-rose-50 text-slate-700 border-slate-300 hover:border-rose-300'
                  }`}
                >
                  {isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <span className="font-mono">جاري الاستماع ({countdown}) 🎙️</span>
                    </>
                  ) : isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التحليل...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-rose-500" />
                      <span>اختيار بالصوت 🎙️</span>
                    </>
                  )}
                </button>
              </div>

              {/* Compact Low-Margin Tiles */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1">
                {shuffledTiles.map((tile) => {
                  const isUsed = usedTileIds.has(tile.id);
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={isUsed || isCompleted}
                      onClick={() => handleSelectTile(tile)}
                      className={`px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl border-2 font-amiri text-xl sm:text-2xl font-bold leading-none transition-all select-none ${
                        isUsed
                          ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-default scale-95'
                          : 'bg-white hover:bg-teal-50 border-slate-300 hover:border-teal-500 text-slate-900 shadow-2xs cursor-pointer active:scale-95'
                      }`}
                    >
                      {tile.text}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AREA B: COMPOSITION / ORDERING BOX (Directly Below Scrambled Tiles) */}
            <div className="w-full p-4 sm:p-5 bg-teal-50/40 border-2 border-dashed border-teal-300/90 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-teal-900">
                  {tr('dictation_box_title', 'مربع التكوين والترتيب:')}
                </span>
                {wrongAttempts > 0 && !isCompleted && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                    محاولات خاطئة: {wrongAttempts}
                  </span>
                )}
              </div>

              {parsedBlanks.hasBlanks ? (
                /* Mode 4 & 5: Fill-in-the-blank inline display */
                <div
                  dir="rtl"
                  className={`min-h-[68px] flex flex-wrap items-center justify-center rounded-xl bg-white border border-teal-200/80 px-4 py-3 font-amiri text-2xl sm:text-3xl font-bold text-slate-900 ${
                    detectedType === 'fill_letter' ? 'gap-0' : 'gap-2'
                  }`}
                >
                  {parsedBlanks.segments.map((seg, sIdx) => {
                    if (seg.kind === 'fixed') {
                      return (
                        <span key={`seg-${sIdx}`} className="leading-relaxed">
                          {seg.text}
                        </span>
                      );
                    }
                    const bIdx = seg.blankIndex ?? 0;
                    const assigned = blankAssignments[bIdx];
                    const isActiveBlank = activeBlankIdx === bIdx && !isCompleted;
                    return (
                      <button
                        key={`blank-${bIdx}`}
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleBlankSlotClick(bIdx)}
                        title={assigned ? 'انقر لإزالة الاختيار' : 'اختر من البطاقات أعلاه'}
                        className={`inline-flex items-center justify-center min-w-[46px] px-2.5 py-0.5 mx-0.5 rounded-xl border-2 font-amiri text-2xl sm:text-3xl font-bold transition-all cursor-pointer ${
                          assigned
                            ? isCompleted
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-900'
                              : 'bg-teal-600 border-teal-700 text-white hover:bg-teal-700 shadow-xs'
                            : isActiveBlank
                            ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200 animate-pulse'
                            : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-teal-400'
                        }`}
                      >
                        {assigned ? assigned.text : '___'}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Modes 1, 2, 3: Ordered tiles container + live assembled Arabic preview */
                <div className="space-y-2.5">
                  <div className="min-h-[64px] flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 p-3 bg-white rounded-xl border border-teal-200/80">
                    {selectedTiles.length === 0 ? (
                      <span className="text-xs font-semibold text-slate-400">
                        {tr('dictation_box_empty_hint', 'اضغط على البطاقات أعلاه لترتيب إجابتك هنا...')}
                      </span>
                    ) : (
                      selectedTiles.map((tile, idx) => (
                        <button
                          key={`placed-${tile.id}-${idx}`}
                          type="button"
                          disabled={isCompleted}
                          onClick={() => handleRemovePlacedTile(tile.id)}
                          title="انقر لإرجاع البطاقة"
                          className={`px-3 py-1 rounded-xl border-2 font-amiri text-xl sm:text-2xl font-bold transition-all ${
                            isCompleted
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 cursor-default'
                              : 'bg-teal-600 hover:bg-rose-600 border-teal-700 hover:border-rose-700 text-white cursor-pointer shadow-2xs active:scale-95'
                          }`}
                        >
                          {tile.text}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Live Assembled Arabic Preview */}
                  {assembledPreview && (
                    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-white/80 border border-slate-200 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">الشكل المتصل:</span>
                      <span className="font-amiri text-2xl sm:text-3xl font-extrabold text-teal-900">
                        {assembledPreview}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons Row: Undo + Clear + Explicit "تحقق" Button */}
              {!isCompleted && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={usedTileIds.size === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  >
                    <Delete className="w-4 h-4" />
                    <span>{tr('dictation_undo_btn', 'تراجع')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={usedTileIds.size === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  >
                    <Eraser className="w-4 h-4" />
                    <span>{tr('dictation_clear_btn', 'مسح')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckAnswer}
                    className="flex-1 sm:flex-none min-w-[140px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-extrabold transition-all shadow-md shadow-teal-600/25 cursor-pointer active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>{tr('dictation_check_btn', 'تحقق')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* AREA C: Unified Guidance & Feedback Box */}
            {guidanceBox && (
              <div
                className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-center animate-in fade-in duration-200 ${
                  guidanceBox.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : guidanceBox.type === 'error'
                    ? 'bg-rose-50 text-rose-900 border-rose-300'
                    : guidanceBox.type === 'recording'
                    ? 'bg-amber-50 text-amber-950 border-amber-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {guidanceBox.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                {guidanceBox.type === 'error' && (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                {guidanceBox.type === 'recording' && (
                  <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                )}
                {guidanceBox.type === 'info' && (
                  <HelpCircle className="w-4 h-4 text-teal-600 shrink-0" />
                )}
                <span>{guidanceBox.message}</span>
              </div>
            )}

            {/* AREA D: Completion Result Card */}
            {isCompleted && (
              <div className="w-full p-5 sm:p-6 bg-emerald-50/70 rounded-3xl border border-emerald-200/80 text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/25">
                  <Award className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    أحسنت! تم التحقق من الإجابة بنجاح 🎉
                  </h3>
                  {lastSubmittedAnswer && (
                    <p className="font-amiri text-2xl font-bold text-emerald-800 mt-1">
                      «{lastSubmittedAnswer}»
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
                  <div className="bg-white p-2.5 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold block">النتيجة</span>
                    <span className="text-xl font-black text-emerald-700">{finalScore}%</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-rose-100">
                    <span className="text-[10px] text-slate-400 font-bold block">أخطاء التحقق</span>
                    <span className="text-xl font-black text-rose-600">{wrongAttempts}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">نوع السؤال</span>
                    <span className="text-[11px] font-bold text-slate-700">
                      {parsedBlanks.hasBlanks ? 'إكمال' : 'ترتيب'}
                    </span>
                  </div>
                </div>

                {isSubmitting ? (
                  <div className="inline-flex items-center gap-1.5 text-xs text-teal-700 font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري توثيق النتيجة في ورقة answers 3...</span>
                  </div>
                ) : sheetSyncSuccess ? (
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-white px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{sheetSyncSuccess}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  {activeExercise.allowRetry !== false && (
                    <button
                      type="button"
                      onClick={initExercise}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة التمرين</span>
                    </button>
                  )}

                  {exerciseIndex < activeSubject.exercises.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNextExercise}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                    >
                      <span>التمرين التالي</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : onBackToPronunciation ? (
                    <button
                      type="button"
                      onClick={onBackToPronunciation}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <span>العودة لتمرين النطق 🎙️</span>
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-10 left-0 p-2 bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="تكبير الصورة"
              className="max-h-[82vh] w-auto rounded-2xl shadow-2xl border-4 border-white bg-white object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
