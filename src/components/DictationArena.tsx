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
  parseAnswerWithBlanks,
  buildShuffledTiles,
  formatAssembledPreview,
  verifyDictationAnswer,
  findAllSpokenMatchingTiles,
  matchDisambiguationChoice,
  inferPositionalLabel,
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
  Zap,
  Brain,
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
    canUseWhisper?: boolean;
  } | null>(null);

  // Media state (question image lightbox + audio player)
  const [playingMediaKey, setPlayingMediaKey] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const mediaAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice input state (SpeechRecognition + Whisper cross-browser hybrid)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [preferWhisperInChrome, setPreferWhisperInChrome] = useState<boolean>(false);
  const [pendingDisambiguation, setPendingDisambiguation] = useState<{
    baseChar: string;
    items: { tile: DictationTile; number: number }[];
  } | null>(null);
  const pendingDisambiguationRef = useRef<{
    baseChar: string;
    items: { tile: DictationTile; number: number }[];
  } | null>(null);
  const countdownIntervalRef = useRef<any>(null);
  const recordingTimeoutRef = useRef<any>(null);
  const safetyFlushTimeoutRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const updatePendingDisambiguation = (
    next: { baseChar: string; items: { tile: DictationTile; number: number }[] } | null
  ) => {
    pendingDisambiguationRef.current = next;
    setPendingDisambiguation(next);
  };

  const supportsWebSpeech = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const isFirefox = /firefox/i.test(navigator.userAgent);
    return !isFirefox && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }, []);

  const exerciseDuration = activeExercise?.durationSeconds || 5;
  const isVoiceOnlyMode = activeExercise?.inputMode === 'voice_only';
  const effectiveLockOnMistake = Boolean(activeExercise?.lockOnMistake);

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
    if (safetyFlushTimeoutRef.current) {
      clearTimeout(safetyFlushTimeoutRef.current);
      safetyFlushTimeoutRef.current = null;
    }
    if (recognizerRef.current) {
      const rec = recognizerRef.current;
      recognizerRef.current = null;
      rec.onresult = null;
      rec.onspeechend = null;
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
    updatePendingDisambiguation(null);
    setWrongAttempts(0);
    setIsCompleted(false);
    setFinalScore(100);
    setLastSubmittedAnswer('');
    setSheetSyncSuccess(null);

    const blanks = parseAnswerWithBlanks(activeExercise.correctAnswer);
    const voiceOnly = activeExercise.inputMode === 'voice_only';
    const locked = Boolean(activeExercise.lockOnMistake);
    let initMsg = blanks.hasBlanks
      ? 'اختر الحرف أو الكلمة المناسبة لإكمال الفراغ، ثم اضغط زر «تحقق».'
      : 'رتب البطاقات بالترتيب الصحيح في مربع التكوين، ثم اضغط زر «تحقق».';
    if (voiceOnly && locked) {
      initMsg = '🎙️ الإجابة بالصوت فقط | 🔒 لا يمكن التراجع بعد الاختيار، ثم اضغط «تحقق».';
    } else if (voiceOnly) {
      initMsg = '🎙️ الإجابة بالصوت فقط: اضغط زر الميكروفون وانطق الحرف أو الكلمة، ثم اضغط «تحقق».';
    } else if (locked) {
      initMsg = '🔒 لا يمكن التراجع بعد وضع الإجابة — اختر بدقة ثم اضغط «تحقق».';
    }
    setGuidanceBox({
      type: 'info',
      message: initMsg,
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

  // Click or voice-select a tile in the options bank
  const handleSelectTile = (tile: DictationTile, fromVoice = false) => {
    unlockAudioEngine();
    if (isCompleted || usedTileIds.has(tile.id)) return;
    if (!fromVoice && isVoiceOnlyMode) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: '🎙️ هذا التمرين بالصوت فقط! اضغط على زر الميكروفون وانطق الحرف أو الكلمة.',
      });
      return;
    }
    playAudioChime('tap');
    updatePendingDisambiguation(null);

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
    if (effectiveLockOnMistake) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: '🔒 لا يمكن التراجع أو تعديل الاختيار في هذا التمرين.',
      });
      return;
    }
    playAudioChime('tap');
    updatePendingDisambiguation(null);
    setSelectedTiles((prev) => prev.filter((t) => t.id !== tileId));
  };

  // Click a blank slot in Fill-in-the-blank mode
  const handleBlankSlotClick = (blankIdx: number) => {
    unlockAudioEngine();
    if (isCompleted) return;
    if (blankAssignments[blankIdx]) {
      if (effectiveLockOnMistake) {
        playAudioChime('error');
        setGuidanceBox({
          type: 'error',
          message: '🔒 لا يمكن التراجع أو إزالة الحرف بعد وضعه في هذا التمرين.',
        });
        return;
      }
      playAudioChime('tap');
      updatePendingDisambiguation(null);
      setBlankAssignments((prev) => ({
        ...prev,
        [blankIdx]: null,
      }));
      setActiveBlankIdx(blankIdx);
      return;
    }
    playAudioChime('tap');
    updatePendingDisambiguation(null);
    setActiveBlankIdx(blankIdx);
  };

  // Undo last placed item
  const handleUndo = () => {
    unlockAudioEngine();
    if (isCompleted) return;
    if (effectiveLockOnMistake) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: '🔒 خيار التراجع مغلق في هذا التمرين.',
      });
      return;
    }
    playAudioChime('tap');
    updatePendingDisambiguation(null);

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

  const finalizeDictationSubmission = async (params: {
    score: number;
    nextWrongAttempts: number;
    formulaString: string;
    lastAnswerDisplay: string;
    guidanceType: 'success' | 'error';
    guidanceMessage: string;
  }) => {
    if (!activeExercise || !activeSubject) return;
    setIsCompleted(true);
    setLastSubmittedAnswer(params.lastAnswerDisplay);
    setFinalScore(params.score);
    setWrongAttempts(params.nextWrongAttempts);
    setGuidanceBox({
      type: params.guidanceType,
      message: params.guidanceMessage,
    });

    const updatedCompleted = {
      ...completedExercisesInSubject,
      [activeExercise.exerciseNumber]: params.score,
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
        formulaString: params.formulaString,
        percentage: params.score,
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
          wrongAttempts: params.nextWrongAttempts,
          percentage: params.score,
          totalExercisesInSubject: totalInSubject,
          completedCountInSubject: completedCount,
          overallPercentage,
          summaryString: params.formulaString,
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

  // Handle explicit Check ("تحقق") button click — REQUIRED IN ALL 5 TYPES!
  const handleCheckAnswer = async () => {
    unlockAudioEngine();
    if (!activeExercise || !activeSubject || isCompleted) return;
    updatePendingDisambiguation(null);

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
      scrambledPool: activeExercise.scrambledPool,
      selectedTiles,
      blankAssignments,
    });

    if (!result.isCorrect) {
      playAudioChime('error');
      const nextWrong = wrongAttempts + 1;

      if (effectiveLockOnMistake) {
        await finalizeDictationSubmission({
          score: 0,
          nextWrongAttempts: nextWrong,
          formulaString: `(خطأ - لا يمكن التراجع = 0%)`,
          lastAnswerDisplay: result.assembledAnswer || '—',
          guidanceType: 'error',
          guidanceMessage: `❌ الإجابة غير صحيحة (${result.assembledAnswer || '—'}). الإجابة الصحيحة: «${result.expectedDisplay}» (0%)`,
        });
        return;
      }

      setWrongAttempts(nextWrong);
      setGuidanceBox({
        type: 'error',
        message: `❌ الإجابة غير صحيحة (${result.assembledAnswer || '—'}). راجع الشكل أو الترتيب وحاول مجدداً ثم اضغط «تحقق».`,
      });
      return;
    }

    // Correct Answer!
    playAudioChime('success');
    const score =
      wrongAttempts === 0
        ? 100
        : Math.max(40, Math.round(100 - wrongAttempts * 15));
    const formulaString =
      wrongAttempts === 0
        ? `(صحيح من أول محاولة = ${score}%)`
        : `(صحيح - أخطاء التحقق ${wrongAttempts} = ${score}%)`;

    await finalizeDictationSubmission({
      score,
      nextWrongAttempts: wrongAttempts,
      formulaString,
      lastAnswerDisplay: result.assembledAnswer || result.expectedDisplay,
      guidanceType: 'success',
      guidanceMessage: `✓ أحسنت! إجابة صحيحة ومتقنة: «${result.expectedDisplay}» (${score}%)`,
    });
  };

  // Voice input matched handler (two-step disambiguation for multiple letter shapes)
  const handleVoiceRecognized = (spokenInput: string | string[], usedWhisper = false) => {
    const availableTiles = shuffledTiles.filter((tile) => !usedTileIds.has(tile.id));
    if (availableTiles.length === 0) return;

    const alternatives = (Array.isArray(spokenInput) ? spokenInput : [spokenInput])
      .map((s) => String(s || '').trim().replace(/[.,،!؟]/g, ''))
      .filter(Boolean);

    if (alternatives.length === 0) return;

    // STEP 2: If student is currently selecting from numbered shapes (1, 2, 3...)
    const activeDisamb = pendingDisambiguationRef.current;
    if (activeDisamb && activeDisamb.items.length > 0) {
      const choice = matchDisambiguationChoice(alternatives, activeDisamb.items);
      if (choice.isCancel) {
        playAudioChime('tap');
        updatePendingDisambiguation(null);
        setGuidanceBox({
          type: 'info',
          message: 'تم إلغاء التحديد وعادت جميع البطاقات. اختر حرفاً أو كلمة جديدة.',
        });
        return;
      }

      if (choice.tile) {
        handleSelectTile(choice.tile, true);
        const posLbl = choice.tile.label || inferPositionalLabel(choice.tile.text);
        setGuidanceBox({
          type: 'success',
          message: `✓ تم اختيار «${choice.tile.text}» (${posLbl}) بنجاح. تابع أو اضغط «تحقق».`,
        });
        return;
      }

      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${choice.heardText || alternatives[0]}» — انطق الرقم (من 1 إلى ${activeDisamb.items.length}) أو انقر على الشكل المطلوب.`,
        canUseWhisper: supportsWebSpeech && !usedWhisper,
      });
      return;
    }

    // STEP 1: Match spoken letter or word against all available tiles
    const { tiles: matchedList, matchedTranscript, requiresDisambiguation } =
      findAllSpokenMatchingTiles(alternatives, availableTiles);

    if (matchedList.length === 0) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${matchedTranscript || alternatives[0]}» — لم يطابق أياً من البطاقات المتبقية. انطق اسم الحرف (مثل: باء، سين، ألف) أو الكلمة بوضوح، أو استخدم المحرك الدقيق.`,
        canUseWhisper: supportsWebSpeech && !usedWhisper,
      });
      return;
    }

    if (requiresDisambiguation) {
      // Order matched shapes visually as they appear in the tiles grid and number them 1..N
      const numbered = matchedList.map((tile, idx) => ({
        tile,
        number: idx + 1,
      }));
      const baseChar = matchedList[0].text.replace(/\u0640/g, '').trim();
      updatePendingDisambiguation({ baseChar, items: numbered });
      playAudioChime('tap');
      setGuidanceBox({
        type: 'info',
        message: `تم العثور على ${numbered.length} أشكال لحرف «${baseChar}» — اضغط زر الصوت مرة أخرى وانطق الرقم المطلوب (1 - ${numbered.length}) أو انقر على الشكل.`,
      });
      return;
    }

    // Single distinct match -> select immediately
    const chosen = matchedList[0];
    handleSelectTile(chosen, true);
    setGuidanceBox({
      type: 'success',
      message: `✓ تم اختيار «${chosen.text}» عبر الصوت. تابع الاختيار أو اضغط «تحقق».`,
    });
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
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
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
          message: 'جاري التعرف على الحرف أو الكلمة المنطوقة بالذكاء الداخلي... ⏳',
        });

        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          const activeDisamb = pendingDisambiguationRef.current;
          const remainingCandidates = activeDisamb
            ? [
                'واحد',
                'اثنان',
                'اثنين',
                'ثلاثة',
                'أربعة',
                'خمسة',
                'مفرد',
                'بداية',
                'وسط',
                'نهاية',
              ]
            : shuffledTiles
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
          const clean = (text || '').trim().replace(/[.,،!؟]/g, '');
          if (clean) {
            handleVoiceRecognized(clean, true);
          } else {
            playAudioChime('error');
            setGuidanceBox({
              type: 'error',
              message: 'لم يتم التقاط صوت واضح، يمكنك إعادة المحاولة أو النقر مباشرة على البطاقات.',
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

      setIsListening(true);
      recorder.start(100);
      setCountdown(exerciseDuration);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);

      setGuidanceBox({
        type: 'recording',
        message: 'تحدث الآن... انطق الحرف أو الكلمة (اضغط الزر مجدداً للإنهاء المبكر) 🎙️',
      });

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

  const startVoiceRecording = (forceWhisper = false) => {
    unlockAudioEngine();
    if (isCompleted || isTranscribing) return;

    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    const SpeechRec =
      !isFirefox && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (forceWhisper || preferWhisperInChrome || !SpeechRec) {
      recordAndTranscribeWithWhisper();
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
      message: pendingDisambiguationRef.current
        ? `تحدث الآن... انطق الرقم المطلوب (1 - ${pendingDisambiguationRef.current.items.length}) 🎙️`
        : 'تحدث الآن... انطق اسم الحرف (مثل: ألف / باء / سين) أو الكلمة المطلوبة 🎙️',
    });

    try {
      const recognizer = new SpeechRec();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 5;
      recognizer.lang = 'ar-SA';

      let resolved = false;
      let latestInterimAlts: string[] = [];

      const finalizeFromTranscripts = (alts: string[]) => {
        if (resolved) return;
        resolved = true;
        stopVoiceRecording();
        if (alts.length > 0) {
          handleVoiceRecognized(alts, false);
        } else {
          playAudioChime('error');
          setGuidanceBox({
            type: 'error',
            message:
              'لم يلتقط المتصفح صوتاً واضحاً — انطق اسم الحرف بوضوح (مثل: باء، ألف، فاء، راء) أو جرّب المحرك الدقيق بالأسفل.',
            canUseWhisper: true,
          });
        }
      };

      // Graceful stop at timeout so buffered transcripts flush cleanly
      recordingTimeoutRef.current = setTimeout(() => {
        if (resolved) return;
        try {
          recognizer.stop();
        } catch {}
        safetyFlushTimeoutRef.current = setTimeout(() => {
          finalizeFromTranscripts(latestInterimAlts);
        }, 350);
      }, exerciseDuration * 1000);

      recognizer.onspeechend = () => {
        try {
          recognizer.stop();
        } catch {}
      };

      recognizer.onresult = (event: any) => {
        if (resolved) return;
        const collectedFinal: string[] = [];
        const collectedInterim: string[] = [];

        for (let r = event.resultIndex || 0; r < (event.results?.length || 0); r++) {
          const resObj = event.results[r];
          if (!resObj) continue;
          const altsForRow: string[] = [];
          for (let a = 0; a < resObj.length; a++) {
            const trText = (resObj[a]?.transcript || '').trim();
            if (trText) altsForRow.push(trText);
          }
          if (resObj.isFinal) {
            collectedFinal.push(...altsForRow);
          } else {
            collectedInterim.push(...altsForRow);
          }
        }

        if (collectedInterim.length > 0) {
          latestInterimAlts = collectedInterim;
          setGuidanceBox({
            type: 'recording',
            message: `يستمع الآن: «${collectedInterim[0]}» 🎙️`,
          });
        }

        if (collectedFinal.length > 0) {
          finalizeFromTranscripts(collectedFinal);
        }
      };

      recognizer.onerror = (event: any) => {
        if (resolved) return;
        const errCode = event?.error || '';
        if (
          errCode === 'network' ||
          errCode === 'service-not-allowed' ||
          errCode === 'language-not-supported' ||
          errCode === 'audio-capture'
        ) {
          resolved = true;
          stopVoiceRecording();
          recordAndTranscribeWithWhisper();
          return;
        }
        finalizeFromTranscripts(latestInterimAlts);
      };

      recognizer.onend = () => {
        if (!resolved) {
          finalizeFromTranscripts(latestInterimAlts);
        }
      };

      recognizerRef.current = recognizer;
      recognizer.start();
    } catch {
      stopVoiceRecording();
      recordAndTranscribeWithWhisper();
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
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
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

    startVoiceRecording(false);
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

        {/* 1. Question Area (Text | Image | Audio in Teacher Order) */}
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
            {/* AREA A: HELPING OPTIONS BOX + Voice Mic */}
            <div className="w-full p-3.5 sm:p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-600">
                  {tr('dictation_helping_options', 'خيارات مساعدة:')}
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
                  {supportsWebSpeech && (
                    <button
                      type="button"
                      disabled={isCompleted || isListening || isTranscribing}
                      onClick={() => setPreferWhisperInChrome((prev) => !prev)}
                      title={
                        preferWhisperInChrome
                          ? 'محرك Whisper الدقيق للحروف المفردة (انقر للتبديل إلى صوت المتصفح السريع)'
                          : 'صوت المتصفح السريع (انقر للتبديل إلى محرك Whisper الدقيق للحروف)'
                      }
                      aria-label={
                        preferWhisperInChrome ? 'محرك Whisper الدقيق' : 'صوت المتصفح السريع'
                      }
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 ${
                        preferWhisperInChrome
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-amber-500 border-slate-300'
                      }`}
                    >
                      {preferWhisperInChrome ? (
                        <Brain className="w-4 h-4" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {pendingDisambiguation && (
                    <button
                      type="button"
                      onClick={() => {
                        updatePendingDisambiguation(null);
                        setGuidanceBox({
                          type: 'info',
                          message: 'تم إلغاء التحديد وعادت جميع البطاقات. اختر أي حرف أو كلمة.',
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-extrabold cursor-pointer transition-all"
                    >
                      <X className="w-3 h-3" />
                      <span>إلغاء التحديد</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleVoiceInput}
                    disabled={isCompleted || isTranscribing}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                      isListening
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse ring-2 ring-rose-200'
                        : isTranscribing
                        ? 'bg-amber-600 text-white border-amber-600'
                        : pendingDisambiguation
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm'
                        : isVoiceOnlyMode
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm'
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
                    ) : pendingDisambiguation ? (
                      <>
                        <Mic className="w-3.5 h-3.5 text-white" />
                        <span>انطق الرقم (1 - {pendingDisambiguation.items.length}) 🎙️</span>
                      </>
                    ) : (
                      <>
                        <Mic className={`w-3.5 h-3.5 ${isVoiceOnlyMode ? 'text-white' : 'text-rose-500'}`} />
                        <span>{isVoiceOnlyMode ? 'انطق الإجابة 🎙️' : 'اختيار بالصوت 🎙️'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Compact Low-Margin Tiles (with optional Positional Labels + Voice Number Badges) */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1.5">
                {shuffledTiles.map((tile) => {
                  const isUsed = usedTileIds.has(tile.id);
                  const disambMatch = pendingDisambiguation?.items.find(
                    (it) => it.tile.id === tile.id
                  );
                  const isDimmedByDisambiguation = Boolean(pendingDisambiguation && !disambMatch);
                  const isHighlightedByDisambiguation = Boolean(pendingDisambiguation && disambMatch);

                  return (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={isUsed || isCompleted || isDimmedByDisambiguation}
                      onClick={() => handleSelectTile(tile, false)}
                      title={
                        isVoiceOnlyMode && !isUsed
                          ? 'هذا التمرين بالصوت فقط — اضغط زر الميكروفون'
                          : undefined
                      }
                      className={`relative px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all select-none ${
                        isUsed
                          ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-default scale-95'
                          : isDimmedByDisambiguation
                          ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-30 grayscale cursor-not-allowed scale-95'
                          : isHighlightedByDisambiguation
                          ? isVoiceOnlyMode
                            ? 'bg-amber-50 border-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md scale-105 cursor-not-allowed'
                            : 'bg-amber-50 hover:bg-amber-100 border-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md scale-105 cursor-pointer active:scale-95'
                          : isVoiceOnlyMode
                          ? 'bg-white border-slate-300 text-slate-900 shadow-2xs cursor-not-allowed opacity-90'
                          : 'bg-white hover:bg-teal-50 border-slate-300 hover:border-teal-500 text-slate-900 shadow-2xs cursor-pointer active:scale-95'
                      }`}
                    >
                      {disambMatch && (
                        <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center shadow-sm border-2 border-white">
                          {disambMatch.number}
                        </span>
                      )}
                      <span className="font-amiri text-xl sm:text-2xl font-bold leading-none">
                        {tile.text}
                      </span>
                      {tile.label && (
                        <span
                          className={`mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none ${
                            isUsed
                              ? 'bg-slate-100 text-slate-300'
                              : isHighlightedByDisambiguation
                              ? 'bg-amber-200/80 text-amber-950'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tile.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AREA B (Relocated): Unified Guidance & Feedback Box directly under options for quick reading */}
            {guidanceBox && (
              <div
                className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex flex-wrap items-center justify-center gap-2 text-center animate-in fade-in duration-200 ${
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
                {guidanceBox.canUseWhisper && !isListening && !isTranscribing && !isCompleted && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreferWhisperInChrome(true);
                      startVoiceRecording(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold shadow-xs cursor-pointer transition-all"
                  >
                    <span>🧠 التسجيل بمحرك Whisper الدقيق</span>
                  </button>
                )}
              </div>
            )}

            {/* AREA C: COMPOSITION / ORDERING BOX (Below Options & Feedback Box) */}
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
                        title={
                          assigned
                            ? effectiveLockOnMistake
                              ? 'لا يمكن التراجع بعد الوضع'
                              : 'انقر لإزالة الاختيار'
                            : 'اختر من الخيارات أعلاه'
                        }
                        className={`inline-flex items-center justify-center min-w-[46px] px-2.5 py-0.5 mx-0.5 rounded-xl border-2 font-amiri text-2xl sm:text-3xl font-bold transition-all ${
                          assigned
                            ? isCompleted
                              ? finalScore === 0
                                ? 'bg-rose-100 border-rose-400 text-rose-900'
                                : 'bg-emerald-100 border-emerald-500 text-emerald-900'
                              : effectiveLockOnMistake
                              ? 'bg-teal-600 border-teal-700 text-white cursor-not-allowed'
                              : 'bg-teal-600 border-teal-700 text-white hover:bg-teal-700 shadow-xs cursor-pointer'
                            : isActiveBlank
                            ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200 animate-pulse cursor-pointer'
                            : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-teal-400 cursor-pointer'
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
                          title={effectiveLockOnMistake ? 'لا يمكن التراجع بعد الوضع' : 'انقر لإرجاع البطاقة'}
                          className={`px-3 py-1 rounded-xl border-2 font-amiri text-xl sm:text-2xl font-bold transition-all ${
                            isCompleted
                              ? finalScore === 0
                                ? 'bg-rose-50 border-rose-400 text-rose-900 cursor-default'
                                : 'bg-emerald-50 border-emerald-400 text-emerald-900 cursor-default'
                              : effectiveLockOnMistake
                              ? 'bg-teal-600 border-teal-700 text-white cursor-not-allowed'
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

              {/* Action Buttons Row: Undo + Check side by side with equal height & compatible styling */}
              {!isCompleted && (
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={effectiveLockOnMistake || usedTileIds.size === 0}
                    title={effectiveLockOnMistake ? 'لا يمكن التراجع في هذا التمرين' : undefined}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {effectiveLockOnMistake ? (
                      <Lock className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Delete className="w-4 h-4" />
                    )}
                    <span>{tr('dictation_undo_btn', 'تراجع')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckAnswer}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white border border-teal-600 text-xs font-extrabold transition-all shadow-sm shadow-teal-600/20 cursor-pointer active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>{tr('dictation_check_btn', 'تحقق')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* AREA D: Completion Result Card */}
            {isCompleted && (
              <div
                className={`w-full p-5 sm:p-6 rounded-3xl border text-center space-y-4 animate-in zoom-in-95 duration-300 ${
                  finalScore === 0
                    ? 'bg-rose-50/70 border-rose-200/80'
                    : 'bg-emerald-50/70 border-emerald-200/80'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md ${
                    finalScore === 0
                      ? 'bg-rose-500 shadow-rose-500/25'
                      : 'bg-emerald-500 shadow-emerald-500/25'
                  }`}
                >
                  {finalScore === 0 ? <Lock className="w-6 h-6" /> : <Award className="w-6 h-6" />}
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {finalScore === 0
                      ? 'انتهت المحاولة — تم تثبيت النتيجة'
                      : 'أحسنت! تم التحقق من الإجابة بنجاح 🎉'}
                  </h3>
                  {lastSubmittedAnswer && (
                    <p
                      className={`font-amiri text-2xl font-bold mt-1 ${
                        finalScore === 0 ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                    >
                      «{lastSubmittedAnswer}»
                    </p>
                  )}
                  {finalScore === 0 && (
                    <p className="text-sm font-bold text-emerald-800 mt-1">
                      الإجابة الصحيحة:{' '}
                      <span className="font-amiri text-xl">
                        «{activeExercise.correctAnswer.replace(/\|/g, '').replace(/\u0640/g, '').trim()}»
                      </span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
                  <div className="bg-white p-2.5 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] text-slate-400 font-bold block">النتيجة</span>
                    <span
                      className={`text-xl font-black ${
                        finalScore === 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {finalScore}%
                    </span>
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
