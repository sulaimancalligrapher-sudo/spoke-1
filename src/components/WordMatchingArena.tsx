import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MatchingLessonSubject,
  MatchingExercise,
  StudentRegistrant,
} from '../types';
import { SupportedLang } from '../utils/translations';
import { submitMatchingAnswerToSheet } from '../utils/googleSheets';
import { removeTashkeel } from '../utils/arabicMatcher';
import { transcribeWithInBrowserWhisper, findBestCandidateMatch } from '../utils/whisperEngine';
import {
  Mic,
  MousePointer,
  Sparkles,
  Award,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Loader2,
  User,
  ArrowRight,
} from 'lucide-react';

interface WordMatchingArenaProps {
  subjects: MatchingLessonSubject[];
  currentStudent: StudentRegistrant | null;
  webhookUrl?: string;
  currentLang?: SupportedLang;
  t?: (id: string, fallback?: string) => string;
  onOpenLogin?: () => void;
  onRequestLogin?: () => void;
  onGoToPronunciation?: () => void;
  onBackToPronunciation?: () => void;
  activeSubjectId?: string;
  activeExerciseIndex?: number;
  onSelectSubjectExercise?: (subjectId: string, exerciseIndex: number) => void;
  onOpenMatchingLessonsModal?: () => void;
}

interface ShuffledItem {
  id: string;
  text: string;
  pairId: string;
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
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
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
    // Rising C5 -> E5 -> G5 triad chime
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
    // Soft descending tone (200Hz -> 125Hz)
    uri = buildWavDataUri(0.26, (t) => {
      const freq = 200 - (75 * t) / 0.26;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 8);
      // Warm soft triangle/sine mix instead of harsh buzz
      const phase = 2 * Math.PI * freq * t;
      return (Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.2) * env * 0.32;
    });
  } else {
    // Subtle crisp tap click
    uri = buildWavDataUri(0.07, (t) => {
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 45);
      return Math.sin(2 * Math.PI * 800 * t) * env * 0.24;
    });
  }

  cachedWavUris[type] = uri;
  return uri;
}

// Call synchronously inside user click/tap handlers to unlock AudioContext on Firefox & iOS
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
      // Play a 1-sample silent buffer synchronously to permanently unlock context in Firefox/Safari
      try {
        const silentBuf = sharedAudioCtx.createBuffer(1, 1, 22050);
        const src = sharedAudioCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(sharedAudioCtx.destination);
        src.start(0);
      } catch {}
    }
    // Pre-generate WAV URIs lazily on first interaction
    getChimeWavUri('tap');
  } catch {}
}

function playWebAudioFallback(type: 'success' | 'error' | 'tap') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;

    const triggerOscillators = () => {
      const now = ctx.currentTime;
      if (type === 'success') {
        const freqs = [523.25, 659.25, 783.99];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.14, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.35);
        });
      } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerOscillators).catch(() => {});
    } else {
      triggerOscillators();
    }
  } catch {}
}

function playAudioChime(type: 'success' | 'error' | 'tap') {
  try {
    // Primary: lightweight in-memory WAV via HTMLAudioElement (unaffected by Firefox mic/AEC WebAudio conflicts)
    const uri = getChimeWavUri(type);
    const audio = new Audio(uri);
    audio.volume = 0.75;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        playWebAudioFallback(type);
      });
    }
  } catch {
    playWebAudioFallback(type);
  }
}

export const WordMatchingArena: React.FC<WordMatchingArenaProps> = ({
  subjects,
  currentStudent,
  webhookUrl,
  currentLang = 'ar',
  t,
  onOpenLogin,
  onRequestLogin,
  onGoToPronunciation,
  onBackToPronunciation,
  activeSubjectId,
  activeExerciseIndex = 0,
  onSelectSubjectExercise,
  onOpenMatchingLessonsModal,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const handleTriggerLogin = onRequestLogin || onOpenLogin || (() => {});
  const handleTriggerPronunciation = onBackToPronunciation || onGoToPronunciation || (() => {});

  // Active Subject & Exercise state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSubjectId || subjects[0]?.id || ''
  );
  const [exerciseIndex, setExerciseIndex] = useState<number>(activeExerciseIndex);

  // Synchronize when activeSubjectId or activeExerciseIndex prop changes from outside (e.g. MatchingLessonsModal)
  useEffect(() => {
    if (activeSubjectId) {
      setSelectedSubjectId(activeSubjectId);
    }
  }, [activeSubjectId]);

  useEffect(() => {
    if (typeof activeExerciseIndex === 'number') {
      setExerciseIndex(activeExerciseIndex);
    }
  }, [activeExerciseIndex]);

  // Keep selectedSubject in sync if subjects change
  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  }, [subjects, selectedSubjectId]);

  const activeExercise: MatchingExercise | null = useMemo(() => {
    if (!activeSubject || !activeSubject.exercises.length) return null;
    return activeSubject.exercises[exerciseIndex] || activeSubject.exercises[0];
  }, [activeSubject, exerciseIndex]);

  // Shuffled columns
  const [rightItems, setRightItems] = useState<ShuffledItem[]>([]);
  const [leftItems, setLeftItems] = useState<ShuffledItem[]>([]);

  // Selection states
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);

interface ConnectedAttempt {
  rightId: string;
  leftId: string;
  isCorrect: boolean;
  rightText: string;
  leftText: string;
  correctLeftText: string;
}

  // Connections and attempts in current exercise
  const [connections, setConnections] = useState<ConnectedAttempt[]>([]);
  const [incorrectFlashIds, setIncorrectFlashIds] = useState<{ rightId: string; leftId: string } | null>(null);

  // Exercise settings defined by teacher (Column 4 in sheet "وصل")
  const effectiveLockOnMistake = !!activeExercise?.lockOnMistake;
  const effectiveShowMistakeFeedback = activeExercise?.showMistakeFeedback !== false;
  const effectiveAllowSmartReassign = !!activeExercise?.allowSmartReassign && !effectiveLockOnMistake;
  const exerciseDuration = typeof activeExercise?.durationSeconds === 'number' && activeExercise.durationSeconds > 0
    ? activeExercise.durationSeconds
    : 4;
  const isVoiceOnlyMode = activeExercise?.inputMode === 'voice_only';

  // SVG Curved Connecting Lines between paired cards
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgLines, setSvgLines] = useState<Array<{
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }>>([]);

  // Helpers to test if card is locked from further selection
  const getRightConn = (id: string) => connections.find((c) => c.rightId === id);
  const getLeftConn = (id: string) => connections.find((c) => c.leftId === id);
  const isRightConnected = (id: string) => {
    const conn = getRightConn(id);
    if (!conn) return false;
    if (effectiveLockOnMistake) return true;
    if (!effectiveShowMistakeFeedback) {
      return !effectiveAllowSmartReassign;
    }
    return conn.isCorrect;
  };
  const isLeftConnected = (id: string) => {
    const conn = getLeftConn(id);
    if (!conn) return false;
    if (effectiveLockOnMistake) return true;
    if (!effectiveShowMistakeFeedback) {
      return !effectiveAllowSmartReassign;
    }
    return conn.isCorrect;
  };

  // Score tracking for current exercise
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Student progress in this subject
  const [completedExercisesInSubject, setCompletedExercisesInSubject] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);

  // Interaction Mode & Voice Recognition state
  const [activeInputMode, setActiveInputMode] = useState<'mouse' | 'voice'>('mouse');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(4);
  const countdownIntervalRef = useRef<any>(null);

  const [guidanceBox, setGuidanceBox] = useState<{
    type: 'success' | 'error' | 'recording' | 'info';
    message: string;
  }>({
    type: 'info',
    message: isVoiceOnlyMode
      ? 'اضغط زر تسجيل النطق 🎙️ وانطق الكلمة المستهدفة بالعمود الأيمن'
      : 'اختر طريقة التوصيل: انقر بالفأرة/اللمس 🖱️ أو اضغط زر تسجيل النطق 🎙️',
  });

  const recordingTimeoutRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Measure and update SVG curved connection lines
  const updateSvgLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof svgLines = [];

    connections.forEach((conn) => {
      const rEl = containerRef.current?.querySelector(`[data-card-id="${conn.rightId}"]`);
      const lEl = containerRef.current?.querySelector(`[data-card-id="${conn.leftId}"]`);
      if (rEl && lEl) {
        const rRect = rEl.getBoundingClientRect();
        const lRect = lEl.getBoundingClientRect();

        const rCenterX = rRect.left + rRect.width / 2;
        const lCenterX = lRect.left + lRect.width / 2;

        const x1 = rCenterX > lCenterX ? (rRect.left - containerRect.left) : (rRect.right - containerRect.left);
        const x2 = rCenterX > lCenterX ? (lRect.right - containerRect.left) : (lRect.left - containerRect.left);
        const y1 = rRect.top - containerRect.top + rRect.height / 2;
        const y2 = lRect.top - containerRect.top + lRect.height / 2;

        let color = '#10b981'; // emerald-500
        if (!conn.isCorrect) {
          color = effectiveShowMistakeFeedback ? '#ef4444' : '#8b5cf6';
        }

        newLines.push({
          key: `${conn.rightId}-${conn.leftId}`,
          x1,
          y1,
          x2,
          y2,
          color,
        });
      }
    });

    setSvgLines(newLines);
  };

  useEffect(() => {
    updateSvgLines();
    const t = setTimeout(updateSvgLines, 60);
    window.addEventListener('resize', updateSvgLines);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateSvgLines);
    };
  }, [connections, rightItems, leftItems, effectiveShowMistakeFeedback]);

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startCountdown = (sec: number) => {
    clearCountdown();
    setCountdown(sec);
    let remaining = sec;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  // Initialize or re-shuffle when activeExercise changes
  const initExercise = () => {
    stopVoiceRecording();
    if (!activeExercise || !activeExercise.pairs.length) return;

    // Shuffle right items
    const rights: ShuffledItem[] = activeExercise.pairs.map((p, idx) => ({
      id: `r-${p.id}-${idx}`,
      text: p.rightText,
      pairId: p.id,
    }));
    const shuffledR = [...rights].sort(() => Math.random() - 0.5);

    // Shuffle left items
    const lefts: ShuffledItem[] = activeExercise.pairs.map((p, idx) => ({
      id: `l-${p.id}-${idx}`,
      text: p.leftText,
      pairId: p.id,
    }));
    const shuffledL = [...lefts].sort(() => Math.random() - 0.5);

    setRightItems(shuffledR);
    setLeftItems(shuffledL);
    setSelectedRightId(null);
    setSelectedLeftId(null);
    setConnections([]);
    setSvgLines([]);
    setIncorrectFlashIds(null);
    setCorrectCount(0);
    setWrongCount(0);
    setIsCompleted(false);
    setSheetSyncSuccess(null);
    setActiveInputMode(activeExercise.inputMode === 'voice_only' ? 'voice' : 'mouse');
    setGuidanceBox({
      type: 'info',
      message: activeExercise.inputMode === 'voice_only'
        ? 'اضغط زر تسجيل النطق 🎙️ وانطق الكلمة المستهدفة بالعمود الأيمن'
        : 'ابدأ التوصيل: انقر بالفأرة واللمس 🖱️ أو اضغط زر تسجيل النطق 🎙️',
    });
  };

  useEffect(() => {
    initExercise();
  }, [activeExercise]);

  // Clean up timers & speech recognizer on unmount
  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, []);

  // Stop recording safely and revert button to normal state across all browsers
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
      rec.onspeechend = null;
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
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  };

  // Dedicated Firefox & MediaRecorder + in-browser Whisper audio recording pipeline
  const recordAndTranscribeWithWhisper = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('المتصفح لا يدعم الوصول إلى الميكروفون');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
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
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        clearCountdown();
        if (mediaStreamRef.current) {
          try {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch {}
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setIsListening(false);

        if (chunks.length === 0) {
          setGuidanceBox({
            type: 'error',
            message: 'لم يتم التقاط صوت واضح، انقر تسجيل نطق وحاول مجدداً.',
          });
          return;
        }

        setIsTranscribing(true);
        setGuidanceBox({
          type: 'recording',
          message: 'جاري التعرف على الكلمة المنطوقة... ⏳',
        });

        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          // Phase 1 (no right item selected yet): candidates are ONLY available right words!
          // Phase 2 (right item selected): candidates are ONLY available left words!
          const remainingCandidates = !selectedRightId
            ? rightItems.filter((i) => !isRightConnected(i.id)).map((i) => i.text)
            : leftItems.filter((i) => !isLeftConnected(i.id)).map((i) => i.text);

          const text = await transcribeWithInBrowserWhisper(
            audioBlob,
            undefined,
            1,
            undefined,
            { lessonVocabulary: remainingCandidates, audioDuration: exerciseDuration }
          );

          setIsTranscribing(false);
          const rawSpoken = (text || '').trim();
          if (rawSpoken) {
            const snapped = findBestCandidateMatch(rawSpoken, remainingCandidates);
            handleVoiceMatchedWord(snapped || rawSpoken);
          } else {
            setGuidanceBox({
              type: 'error',
              message: 'لم يتم التقاط كلمة واضحة، انطق إحدى الكلمات المعروضة وحاول مجدداً.',
            });
          }
        } catch (err: any) {
          console.warn('Whisper recognition error:', err);
          setIsTranscribing(false);
          setGuidanceBox({
            type: 'error',
            message: 'تعذر تحليل الصوت، يمكنك النقر بالفأرة أو اللمس للتوصيل.',
          });
        }
      };

      recorder.start(100);
      startCountdown(exerciseDuration);

      // Stop recording automatically when duration finishes
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }, exerciseDuration * 1000);
    } catch (err: any) {
      console.warn('Microphone access error in Firefox/MediaRecorder:', err);
      stopVoiceRecording();
      setIsTranscribing(false);
      setGuidanceBox({
        type: 'error',
        message: 'تعذر الوصول للميكروفون في المتصفح. تأكد من إعطاء إذن الميكروفون، أو استخدم الفأرة.',
      });
    }
  };

  // Button 1: Activate Mouse/Touch Mode
  const handleActivateMouseMode = () => {
    unlockAudioEngine();
    stopVoiceRecording();
    setActiveInputMode('mouse');
    setGuidanceBox({
      type: 'info',
      message: 'وضع الفأرة واللمس مفعّل: انقر على الكلمة في اليمين أولاً ثم مقابلتها في اليسار 🖱️',
    });
  };

  // Button 2: Start Voice Recording (Dual Engine: Web Speech API for Chrome/Safari + MediaRecorder/Whisper for Firefox)
  const handleStartVoiceRecording = () => {
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
        message: 'تم إيقاف التسجيل. اضغط تسجيل نطق مجدداً أو استخدم الفأرة.',
      });
      return;
    }

    setActiveInputMode('voice');
    setIsListening(true);
    startCountdown(exerciseDuration);

    setGuidanceBox({
      type: 'recording',
      message: !selectedRightId
        ? 'استمع لصوتك... انطق الكلمة المستهدفة من العمود الأيمن أولاً 🎙️'
        : 'استمع لصوتك... انطق الكلمة المقابلة من العمود الأيسر 🎙️',
    });

    const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    const SpeechRec = !isFirefox && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRec) {
      try {
        const recognizer = new SpeechRec();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.maxAlternatives = 3;
        recognizer.lang = 'ar-SA';

        // Auto-stop after exerciseDuration seconds to guarantee button returns to normal
        recordingTimeoutRef.current = setTimeout(() => {
          stopVoiceRecording();
          setGuidanceBox((prev) =>
            prev?.type === 'recording'
              ? {
                  type: 'error',
                  message: 'انتهت مدة الاستماع دون التقاط صوت واضح. اضغط تسجيل نطق وحاول مجدداً.',
                }
              : prev
          );
        }, exerciseDuration * 1000);

        recognizer.onresult = (event: any) => {
          stopVoiceRecording();
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          const trimmed = transcript.trim().replace(/[.,!؟]/g, '');
          if (trimmed) {
            handleVoiceMatchedWord(trimmed);
          }
        };

        recognizer.onspeechend = () => {
          try {
            recognizer.stop();
          } catch {}
        };

        recognizer.onerror = (event: any) => {
          console.warn('Speech error notice:', event.error);
          stopVoiceRecording();
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setGuidanceBox({
              type: 'error',
              message: 'لم يتم التقاط النطق بوضوح. تأكد من تفعيل الميكروفون والتحدث بوضوح.',
            });
          }
        };

        recognizer.onend = () => {
          stopVoiceRecording();
        };

        recognizerRef.current = recognizer;
        recognizer.start();
      } catch (err) {
        console.warn('Web Speech API failed, falling back to MediaRecorder + Whisper:', err);
        recordAndTranscribeWithWhisper();
      }
    } else {
      // In Firefox (or browsers without SpeechRecognition): MediaRecorder + Whisper
      recordAndTranscribeWithWhisper();
    }
  };

  // Match voice spoken text against cards with strict Right-Column-First rule
  const handleVoiceMatchedWord = (spokenText: string) => {
    const cleanSpoken = removeTashkeel(spokenText).toLowerCase().trim();
    if (!cleanSpoken) return;

    // Phase 1: No Right card is selected yet -> search EXCLUSIVELY in available Right items
    if (!selectedRightId) {
      const availableRights = rightItems.filter((item) => !isRightConnected(item.id));
      const rightTexts = availableRights.map((i) => i.text);
      const snappedRight = findBestCandidateMatch(cleanSpoken, rightTexts);

      const matchR = availableRights.find((item) => {
        if (snappedRight && item.text === snappedRight) return true;
        const cleanItem = removeTashkeel(item.text).toLowerCase().trim();
        return cleanSpoken.includes(cleanItem) || cleanItem.includes(cleanSpoken);
      });

      if (matchR) {
        setSelectedRightId(matchR.id);
        playAudioChime('tap');
        setGuidanceBox({
          type: 'success',
          message: `✓ تم اختيار: «${matchR.text}» من العمود الأيمن. الآن انطق كلمتها المقابلة أو اخترها بالفأرة!`,
        });
        return;
      }

      // No match found in Right column
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${spokenText}» — لم تتطابق مع كلمات العمود الأيمن المتبقية. انطق كلمة من اليمين.`,
      });
      return;
    }

    // Phase 2: Right card IS selected -> search EXCLUSIVELY in available Left items
    const availableLefts = leftItems.filter((item) => !isLeftConnected(item.id));
    const leftTexts = availableLefts.map((i) => i.text);
    const snappedLeft = findBestCandidateMatch(cleanSpoken, leftTexts);

    const matchL = availableLefts.find((item) => {
      if (snappedLeft && item.text === snappedLeft) return true;
      const cleanItem = removeTashkeel(item.text).toLowerCase().trim();
      return cleanSpoken.includes(cleanItem) || cleanItem.includes(cleanSpoken);
    });

    if (matchL) {
      handleCheckMatch(selectedRightId, matchL.id);
    } else {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${spokenText}» — لم نجد كلمة مقابلة مطابقة في العمود الأيسر، حاول مجدداً.`,
      });
    }
  };

  // Handle Match Evaluation between selectedRightId and selectedLeftId
  // Includes independent Smart Re-assignment (controlled by effectiveAllowSmartReassign)
  const handleCheckMatch = (rId: string, lId: string) => {
    const rItem = rightItems.find((i) => i.id === rId);
    const lItem = leftItems.find((i) => i.id === lId);
    if (!rItem || !lItem) return;

    const correctPair = activeExercise?.pairs.find((p) => p.id === rItem.pairId);
    const isCorrect = rItem.pairId === lItem.pairId;
    const correctLeft = correctPair?.leftText || '';

    // Smart Re-assignment: if enabled by teacher, unlink any previous connection involving rId or lId
    const cleanedConnections = effectiveAllowSmartReassign
      ? connections.filter((c) => c.rightId !== rId && c.leftId !== lId)
      : connections;

    if (isCorrect) {
      // Correct Match!
      const newConn: ConnectedAttempt = {
        rightId: rId,
        leftId: lId,
        isCorrect: true,
        rightText: rItem.text,
        leftText: lItem.text,
        correctLeftText: correctLeft,
      };
      const nextConnections = [...cleanedConnections, newConn];
      setConnections(nextConnections);
      const nextCorrect = nextConnections.filter((c) => c.isCorrect).length;
      setCorrectCount(nextCorrect);
      setSelectedRightId(null);
      setSelectedLeftId(null);

      if (effectiveShowMistakeFeedback) {
        playAudioChime('success');
        setGuidanceBox({
          type: 'success',
          message: `✓ أحسنت! إجابة صحيحة: «${rItem.text}» ⟷ «${lItem.text}»`,
        });
      } else {
        playAudioChime('tap');
        setGuidanceBox({
          type: 'info',
          message: `تم التوصيل بنجاح. تابع توصيل الكلمات المتبقية.`,
        });
      }

      // Check completion
      if (activeExercise) {
        const allPairsConnected = nextConnections.length >= activeExercise.pairs.length;
        const allPairsCorrect = nextCorrect >= activeExercise.pairs.length;
        if (effectiveLockOnMistake || !effectiveShowMistakeFeedback ? allPairsConnected : allPairsCorrect) {
          handleExerciseFinished(nextCorrect, wrongCount, nextConnections);
        }
      }
    } else {
      // Wrong Match!
      // Keep persistent connection line if: locked, hidden feedback, OR smart reassign is active
      const shouldKeepConnection =
        effectiveLockOnMistake || !effectiveShowMistakeFeedback || effectiveAllowSmartReassign;

      if (shouldKeepConnection) {
        const newConn: ConnectedAttempt = {
          rightId: rId,
          leftId: lId,
          isCorrect: false,
          rightText: rItem.text,
          leftText: lItem.text,
          correctLeftText: correctLeft,
        };
        const nextConnections = [...cleanedConnections, newConn];
        setConnections(nextConnections);
        const nextCorrect = nextConnections.filter((c) => c.isCorrect).length;
        setCorrectCount(nextCorrect);
        const nextWrong = wrongCount + 1;
        setWrongCount(nextWrong);
        setSelectedRightId(null);
        setSelectedLeftId(null);

        if (effectiveShowMistakeFeedback) {
          playAudioChime('error');
          setGuidanceBox({
            type: 'error',
            message: effectiveLockOnMistake
              ? `❌ إجابة غير صحيحة! تم تثبيت النتيجة ولا يمكن التراجع عنها.`
              : `❌ إجابة غير صحيحة: «${rItem.text}» لا تطابق «${lItem.text}». يمكنك إعادة التوصيل لتصحيح الخطأ الذكي!`,
          });
        } else {
          playAudioChime('tap');
          setGuidanceBox({
            type: 'info',
            message: `تم التوصيل. تابع توصيل الكلمات المتبقية.`,
          });
        }

        // Check completion (only finish on wrong connection if locked or hidden feedback)
        if (
          activeExercise &&
          (effectiveLockOnMistake || !effectiveShowMistakeFeedback) &&
          nextConnections.length >= activeExercise.pairs.length
        ) {
          handleExerciseFinished(nextCorrect, nextWrong, nextConnections);
        }
      } else {
        // Standard Retry Mode (no smart reassign): Flash error briefly and let student retry
        playAudioChime('error');
        setWrongCount((prev) => prev + 1);
        setIncorrectFlashIds({ rightId: rId, leftId: lId });
        setGuidanceBox({
          type: 'error',
          message: `❌ إجابة غير صحيحة: «${rItem.text}» لا تطابق «${lItem.text}»، حاول مجدداً!`,
        });
        setTimeout(() => {
          setIncorrectFlashIds(null);
          setSelectedRightId(null);
          setSelectedLeftId(null);
        }, 700);
      }
    }
  };

  // When exercise finishes, auto-submit to sheet "answers 2" with standard formula
  const handleExerciseFinished = async (
    finalCorrect: number,
    finalWrong: number,
    _finalConnections?: ConnectedAttempt[]
  ) => {
    setIsCompleted(true);
    stopVoiceRecording();
    if (!activeExercise || !activeSubject) return;

    const totalPairs = activeExercise.pairs.length;
    let percentage = 0;
    let formulaString = '';

    if (effectiveLockOnMistake) {
      // Single attempt mode: (5 كلمات - 4 صحيح - 1 خطأ = 80%)
      percentage = Math.round((finalCorrect / Math.max(1, totalPairs)) * 100);
      formulaString = `(${totalPairs} - ${finalCorrect} صحيح - ${finalWrong} خطأ = ${percentage}%)`;
    } else {
      // Retry mode: (5 - الصحيح 5 - أخطاء المحاولات 2 = 71%)
      const totalAttempts = Math.max(totalPairs, finalCorrect + finalWrong);
      percentage = Math.round((finalCorrect / Math.max(1, totalAttempts)) * 100);
      formulaString = `(${totalPairs} - الصحيح ${finalCorrect} - أخطاء المحاولات ${finalWrong} = ${percentage}%)`;
    }

    // Update completed count in subject
    const updatedCompleted = {
      ...completedExercisesInSubject,
      [activeExercise.exerciseNumber]: percentage,
    };
    setCompletedExercisesInSubject(updatedCompleted);

    const totalInSubject = activeSubject.exercises.length;
    const completedCount = Object.keys(updatedCompleted).length;
    const scoresArr = Object.values(updatedCompleted);
    const overallPercentage = Math.round(
      scoresArr.reduce((a, b) => a + b, 0) / Math.max(1, scoresArr.length)
    );

    // Auto-sync to sheet "answers 2" if student is registered and webhook is active
    if (webhookUrl && currentStudent) {
      setIsSubmitting(true);
      try {
        const res = await submitMatchingAnswerToSheet(webhookUrl, {
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          subjectName: activeSubject.subjectName,
          exerciseNumber: activeExercise.exerciseNumber,
          totalPairs,
          correctCount: finalCorrect,
          wrongCount: finalWrong,
          percentage,
          totalExercisesInSubject: totalInSubject,
          completedCountInSubject: completedCount,
          overallPercentage,
          modeDescription: effectiveLockOnMistake ? 'محاولة واحدة' : 'إعادة المحاولة',
          summaryString: formulaString,
        });
        if (res.success) {
          setSheetSyncSuccess('تم توثيق إنجازك بنجاح في ورقة answers 2 ✓');
        }
      } catch (err) {
        console.warn('Failed to submit to answers 2:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // User click on right column card
  const handleRightCardClick = (item: ShuffledItem) => {
    unlockAudioEngine();
    if (isVoiceOnlyMode) {
      setGuidanceBox({
        type: 'info',
        message: 'هذا التمرين بنظام الصوت فقط 🎙️ — استخدم زر «تسجيل نطق» بدلاً من النقر على الكلمات.',
      });
      return;
    }
    if (isRightConnected(item.id) || isCompleted) return;
    playAudioChime('tap');

    if (selectedRightId === item.id) {
      setSelectedRightId(null);
      return;
    }

    setSelectedRightId(item.id);
    setGuidanceBox({
      type: 'info',
      message: `تم اختيار: «${item.text}». الآن اختر كلمتها المقابلة بالعمود الأيسر 👈`,
    });
  };

  // User click on left column card - Enforces Right-Column-First rule
  const handleLeftCardClick = (item: ShuffledItem) => {
    unlockAudioEngine();
    if (isVoiceOnlyMode) {
      setGuidanceBox({
        type: 'info',
        message: 'هذا التمرين بنظام الصوت فقط 🎙️ — استخدم زر «تسجيل نطق» بدلاً من النقر على الكلمات.',
      });
      return;
    }
    if (isLeftConnected(item.id) || isCompleted) return;

    // Enforce Right Column First!
    if (!selectedRightId) {
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: '👈 يرجى اختيار أو نطق الكلمة من العمود الأيمن أولاً!',
      });
      return;
    }

    playAudioChime('tap');

    if (selectedLeftId === item.id) {
      setSelectedLeftId(null);
      return;
    }

    setSelectedLeftId(item.id);
    handleCheckMatch(selectedRightId, item.id);
  };

  // Pagination navigation
  const handleNextExercise = () => {
    if (activeSubject && exerciseIndex < activeSubject.exercises.length - 1) {
      const nextIdx = exerciseIndex + 1;
      setExerciseIndex(nextIdx);
      if (onSelectSubjectExercise) {
        onSelectSubjectExercise(selectedSubjectId, nextIdx);
      }
    }
  };

  const handlePrevExercise = () => {
    if (exerciseIndex > 0) {
      const prevIdx = exerciseIndex - 1;
      setExerciseIndex(prevIdx);
      if (onSelectSubjectExercise) {
        onSelectSubjectExercise(selectedSubjectId, prevIdx);
      }
    }
  };

  if (!activeSubject || !activeExercise) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 shadow-sm">
        <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          لا توجد تمارين وصل مضافة حالياً
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          يمكن للمعلم إضافة تمارين جديدة في ورقة "وصل" أو من خلال لوحة التحكم.
        </p>
        <button
          onClick={handleTriggerPronunciation}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
        >
          الانتقال لتمرين نطق الكلمات 🎙️
        </button>
      </div>
    );
  }

  const totalPairsCount = activeExercise.pairs.length;
  const accuracyPercent = Math.round(
    (correctCount / Math.max(1, correctCount + wrongCount)) * 100
  );

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-300">
      {/* 1. Header Toolbar: Subject & Exercise Selector + Matching Lessons List trigger */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Subject dropdown & Lessons Modal Trigger */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
            <span>موضوع الدرس:</span>
          </div>

          <select
            value={selectedSubjectId}
            onChange={(e) => {
              const newSubjId = e.target.value;
              setSelectedSubjectId(newSubjId);
              setExerciseIndex(0);
              if (onSelectSubjectExercise) {
                onSelectSubjectExercise(newSubjId, 0);
              }
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl text-xs sm:text-sm font-bold text-slate-800 cursor-pointer focus:outline-hidden"
          >
            {subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.subjectName} ({subj.exercises.length} تمارين)
              </option>
            ))}
          </select>

          {onOpenMatchingLessonsModal && (
            <button
              type="button"
              onClick={onOpenMatchingLessonsModal}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="استعراض كافة دروس وتمارين الوصل"
            >
              <span>قائمة الدروس 📑</span>
            </button>
          )}
        </div>

        {/* Exercise Pagination / Step */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={handlePrevExercise}
            disabled={exerciseIndex === 0}
            className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
            title="التمرين السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="px-3.5 py-1 rounded-xl bg-purple-50 border border-purple-100 text-purple-900 font-extrabold text-xs">
            التمرين {activeExercise.exerciseNumber} من {activeSubject.exercises.length}
          </span>

          <button
            onClick={handleNextExercise}
            disabled={exerciseIndex >= activeSubject.exercises.length - 1}
            className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
            title="التمرين التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Question Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        {/* Question Text */}
        <div className="mb-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 mb-2">
            سؤال التوصيل
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-amiri text-slate-900 tracking-wide">
            {activeExercise.questionText}
          </h2>
        </div>

        {/* Teacher Configured Behavior Badges */}
        {(effectiveLockOnMistake || !effectiveShowMistakeFeedback || isVoiceOnlyMode || effectiveAllowSmartReassign) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
            {effectiveLockOnMistake && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-800">
                🔒 محاولة واحدة بدون تراجع
              </span>
            )}
            {!effectiveShowMistakeFeedback && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-900">
                🙈 كشف الخطأ في نهاية التمرين
              </span>
            )}
            {effectiveAllowSmartReassign && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-900">
                🧠 تبديل الإجابة والتصحيح الذكي متاح
              </span>
            )}
            {isVoiceOnlyMode && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-900">
                🎙️ إدخال صوتي فقط (النقر معطّل)
              </span>
            )}
          </div>
        )}

        {/* Interaction Buttons: زر تشغيل الفأرة & زر تسجيل النطق */}
        <div className="flex flex-wrap items-center justify-center gap-3 my-2 w-full max-w-md">
          {/* Button 1: تشغيل الفأرة - only rendered if teacher didn't force voice_only */}
          {!isVoiceOnlyMode && (
            <button
              type="button"
              onClick={handleActivateMouseMode}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs border ${
                activeInputMode === 'mouse' && !isListening
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <MousePointer className="w-4 h-4" />
              <span>تشغيل الفأرة 🖱️</span>
            </button>
          )}

          {/* Button 2: تسجيل نطق مع عداد تنازلي رقمي */}
          <button
            type="button"
            onClick={handleStartVoiceRecording}
            disabled={isTranscribing}
            className={`${isVoiceOnlyMode ? 'w-full max-w-xs' : 'flex-1'} flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs border disabled:cursor-not-allowed ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse ring-4 ring-rose-200 shadow-lg shadow-rose-600/30'
                : isTranscribing
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300'
            }`}
          >
            {isListening ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span className="font-mono font-bold">جاري الاستماع... ({countdown} ث) 🎙️</span>
              </>
            ) : isTranscribing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>جاري التحليل... ⏳</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-rose-500" />
                <span>تسجيل نطق 🎙️</span>
              </>
            )}
          </button>
        </div>

        {/* 4. Guidance / Feedback Box placed DIRECTLY UNDER the buttons */}
        {guidanceBox && (
          <div
            className={`w-full max-w-xl mx-auto mb-4 p-3 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 animate-in fade-in duration-200 transition-all ${
              guidanceBox.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : guidanceBox.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-300'
                : guidanceBox.type === 'recording'
                ? 'bg-amber-50 text-amber-950 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {guidanceBox.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {guidanceBox.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {guidanceBox.type === 'recording' && <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />}
            {guidanceBox.type === 'info' && <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span>{guidanceBox.message}</span>
          </div>
        )}

        {/* 3. The Two Columns with SVG Connecting Curves Overlay */}
        {!isCompleted ? (
          <div ref={containerRef} className="relative grid grid-cols-2 gap-4 sm:gap-8 w-full max-w-2xl my-3">
            {/* SVG Connecting Curves */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
              {svgLines.map((line) => (
                <g key={line.key}>
                  <circle cx={line.x1} cy={line.y1} r={4} fill={line.color} />
                  <circle cx={line.x2} cy={line.y2} r={4} fill={line.color} />
                  <path
                    d={`M ${line.x1} ${line.y1} C ${(line.x1 + line.x2) / 2} ${line.y1}, ${(line.x1 + line.x2) / 2} ${line.y2}, ${line.x2} ${line.y2}`}
                    stroke={line.color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.88}
                  />
                </g>
              ))}
            </svg>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-2.5 z-20">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيمن
              </span>
              {rightItems.map((item) => {
                const conn = getRightConn(item.id);
                const isMatched = !!conn;
                const isCorrectMatch = conn?.isCorrect;
                const isSelected = selectedRightId === item.id;
                const isFlashingWrong = incorrectFlashIds?.rightId === item.id;
                const isLocked = isRightConnected(item.id);

                return (
                  <button
                    key={item.id}
                    data-card-id={item.id}
                    onClick={() => handleRightCardClick(item)}
                    disabled={isVoiceOnlyMode || isLocked}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between select-none relative ${
                      isVoiceOnlyMode ? 'cursor-default' : 'cursor-pointer active:scale-98'
                    } ${
                      isMatched
                        ? effectiveShowMistakeFeedback
                          ? isCorrectMatch
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-75 cursor-default'
                            : 'bg-rose-50 border-rose-300 text-rose-900 opacity-85'
                          : 'bg-purple-50/80 border-purple-200 text-purple-900 opacity-85'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-102 ring-4 ring-indigo-200'
                        : isVoiceOnlyMode
                        ? 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-indigo-300'
                    }`}
                  >
                    <span className="truncate">{item.text}</span>
                    {isMatched && (
                      effectiveShowMistakeFeedback ? (
                        isCorrectMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )
                      ) : (
                        <span className="text-xs text-purple-600 shrink-0 font-sans">🔗</span>
                      )
                    )}
                  </button>
                );
              })}
            </div>

            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-2.5 z-20">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيسر
              </span>
              {leftItems.map((item) => {
                const conn = getLeftConn(item.id);
                const isMatched = !!conn;
                const isCorrectMatch = conn?.isCorrect;
                const isSelected = selectedLeftId === item.id;
                const isFlashingWrong = incorrectFlashIds?.leftId === item.id;
                const isLocked = isLeftConnected(item.id);

                return (
                  <button
                    key={item.id}
                    data-card-id={item.id}
                    onClick={() => handleLeftCardClick(item)}
                    disabled={isVoiceOnlyMode || isLocked}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between select-none relative ${
                      isVoiceOnlyMode ? 'cursor-default' : 'cursor-pointer active:scale-98'
                    } ${
                      isMatched
                        ? effectiveShowMistakeFeedback
                          ? isCorrectMatch
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-75 cursor-default'
                            : 'bg-rose-50 border-rose-300 text-rose-900 opacity-85'
                          : 'bg-purple-50/80 border-purple-200 text-purple-900 opacity-85'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : isSelected
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/30 scale-102 ring-4 ring-purple-200'
                        : isVoiceOnlyMode
                        ? 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-purple-300'
                    }`}
                  >
                    <span className="truncate">{item.text}</span>
                    {isMatched && (
                      effectiveShowMistakeFeedback ? (
                        isCorrectMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )
                      ) : (
                        <span className="text-xs text-purple-600 shrink-0 font-sans">🔗</span>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* 4. EXERCISE COMPLETED RESULT CARD */
          <div className="w-full max-w-lg my-6 p-6 sm:p-8 bg-linear-to-b from-purple-50/70 to-emerald-50/70 rounded-3xl border border-purple-200 text-center space-y-4 animate-in zoom-in-95 duration-300 shadow-md">
            <div className="w-16 h-16 rounded-3xl bg-linear-to-tr from-purple-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-600/20">
              <Award className="w-9 h-9" />
            </div>

            <div>
              <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                تم إنهاء التوصيل بنجاح!
              </span>
              <h3 className="text-xl sm:text-2xl font-black font-amiri text-slate-900 mt-2">
                نتيجة التمرين:
              </h3>
            </div>

            {/* Official Formula: (إجمالي الكلمات - الصحيح X - الخطأ Y = %Z) */}
            <div className="bg-white p-4 rounded-2xl border border-purple-200/90 shadow-xs font-mono text-base sm:text-lg font-black text-purple-950 tracking-wide dir-ltr select-all">
              {effectiveLockOnMistake
                ? `(${totalPairsCount} - ${correctCount} صحيح - ${wrongCount} خطأ = ${accuracyPercent}%)`
                : `(${totalPairsCount} - الصحيح ${correctCount} - أخطاء المحاولات ${wrongCount} = ${accuracyPercent}%)`}
            </div>

            {/* Detailed Reveal Breakdown if Feedback was Hidden during exercise */}
            {!effectiveShowMistakeFeedback && connections.length > 0 && (
              <div className="bg-white/95 p-3.5 rounded-2xl border border-purple-200 text-right space-y-2 shadow-2xs">
                <span className="text-xs font-extrabold text-slate-800 block border-b border-slate-100 pb-1.5">
                  كشف الإجابات والتوصيلات:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {connections.map((c, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        c.isCorrect
                          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/90 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {c.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-amiri font-bold text-sm">
                          {c.rightText} ⟷ {c.leftText}
                        </span>
                      </div>
                      {!c.isCorrect && (
                        <span className="text-[10px] font-bold text-rose-800 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                          الصواب: {c.correctLeftText}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student & Sheet Sync feedback */}
            <div className="text-xs text-slate-600 space-y-1.5 pt-1">
              {currentStudent ? (
                <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  <span>المشترك: {currentStudent.name} (ID: {currentStudent.id})</span>
                </div>
              ) : null}

              {isSubmitting ? (
                <div className="flex items-center justify-center gap-1.5 text-purple-700 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري توثيق النتيجة في ورقة answers 2...</span>
                </div>
              ) : sheetSyncSuccess ? (
                <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{sheetSyncSuccess}</span>
                </div>
              ) : !currentStudent ? (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 text-[11px] space-y-1.5">
                  <p>سجّل دخولك لتوثيق نتائجك تلقائياً في ورقة answers 2 باسمك ورقمك</p>
                  <button
                    onClick={handleTriggerLogin}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs"
                  >
                    دخول الطالب
                  </button>
                </div>
              ) : null}
            </div>

            {/* Bottom Actions inside Completion Card */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-purple-200/80">
              <button
                onClick={initExercise}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة التمرين</span>
              </button>

              {exerciseIndex < activeSubject.exercises.length - 1 ? (
                <button
                  onClick={handleNextExercise}
                  className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  <span>التمرين التالي</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleTriggerPronunciation}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <span>الانتقال لتمرين النطق 🎙️</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
