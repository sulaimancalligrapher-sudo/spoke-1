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

// Cross-browser safe audio synthesizer (Safari, Chrome, Firefox, iOS, Android)
let sharedAudioCtx: AudioContext | null = null;
function playAudioChime(type: 'success' | 'error' | 'tap') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant rising major chord
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === 'error') {
      // Soft gentle error buzz
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
      // Subtle tap click
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
  } catch {}
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

  // User Interactive Toggles for Answer Behavior (overrides exercise defaults if set)
  const [userLockOnMistake, setUserLockOnMistake] = useState<boolean | null>(null);
  const [userShowMistakeFeedback, setUserShowMistakeFeedback] = useState<boolean | null>(null);

  // Effective settings: User selection takes precedence over exercise default
  const effectiveLockOnMistake = userLockOnMistake !== null
    ? userLockOnMistake
    : !!activeExercise?.lockOnMistake;

  const effectiveShowMistakeFeedback = userShowMistakeFeedback !== null
    ? userShowMistakeFeedback
    : activeExercise?.showMistakeFeedback !== false;

  // Helpers to test if card is already connected
  const isRightConnected = (id: string) => connections.some((c) => c.rightId === id);
  const isLeftConnected = (id: string) => connections.some((c) => c.leftId === id);
  const getRightConn = (id: string) => connections.find((c) => c.rightId === id);
  const getLeftConn = (id: string) => connections.find((c) => c.leftId === id);

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
  const [guidanceBox, setGuidanceBox] = useState<{
    type: 'success' | 'error' | 'recording' | 'info';
    message: string;
  }>({
    type: 'info',
    message: 'اختر طريقة التوصيل: انقر بالفأرة/اللمس 🖱️ أو اضغط زر تسجيل النطق 🎙️',
  });

  const recordingTimeoutRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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
    setIncorrectFlashIds(null);
    setCorrectCount(0);
    setWrongCount(0);
    setIsCompleted(false);
    setSheetSyncSuccess(null);
    setUserLockOnMistake(null);
    setUserShowMistakeFeedback(null);
    setGuidanceBox({
      type: 'info',
      message: 'ابدأ التوصيل: انقر بالفأرة واللمس 🖱️ أو اضغط زر تسجيل النطق 🎙️',
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
          const connectedRIds = new Set(connections.map((c) => c.rightId));
          const connectedLIds = new Set(connections.map((c) => c.leftId));
          const remainingCandidates = [
            ...rightItems.filter((i) => !connectedRIds.has(i.id)).map((i) => i.text),
            ...leftItems.filter((i) => !connectedLIds.has(i.id)).map((i) => i.text),
          ];

          const text = await transcribeWithInBrowserWhisper(
            audioBlob,
            undefined,
            1,
            undefined,
            { lessonVocabulary: remainingCandidates, audioDuration: 2.2 }
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

      // Stop recording automatically after 2.2 seconds for snappy response in Firefox
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }, 2200);
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
    stopVoiceRecording();
    setActiveInputMode('mouse');
    setGuidanceBox({
      type: 'info',
      message: 'وضع الفأرة واللمس مفعّل: انقر على الكلمة في اليمين ثم مقابلتها في اليسار 🖱️',
    });
  };

  // Button 2: Start Voice Recording (Dual Engine: Web Speech API for Chrome/Safari + MediaRecorder/Whisper for Firefox)
  const handleStartVoiceRecording = () => {
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
    setGuidanceBox({
      type: 'recording',
      message: 'استمع لصوتك... انطق أي كلمة ظاهرة أمامك بوضوح 🎙️',
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

        // Auto-stop after 3.5 seconds on PC Chrome to guarantee button returns to normal
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
        }, 3500);

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

  // Match voice spoken text against cards
  const handleVoiceMatchedWord = (spokenText: string) => {
    const cleanSpoken = removeTashkeel(spokenText).toLowerCase().trim();
    if (!cleanSpoken) return;

    // Case 1: If right item is not yet selected
    if (!selectedRightId) {
      // 1. Check in available right items
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
          message: `✓ تم التعرف على: «${matchR.text}» في العمود الأيمن. انطق كلمتها المقابلة أو اخترها بالفأرة!`,
        });
        return;
      }

      // 2. Or maybe student spoke an available left item first
      const availableLefts = leftItems.filter((item) => !isLeftConnected(item.id));
      const leftTexts = availableLefts.map((i) => i.text);
      const snappedLeft = findBestCandidateMatch(cleanSpoken, leftTexts);

      const matchL = availableLefts.find((item) => {
        if (snappedLeft && item.text === snappedLeft) return true;
        const cleanItem = removeTashkeel(item.text).toLowerCase().trim();
        return cleanSpoken.includes(cleanItem) || cleanItem.includes(cleanSpoken);
      });

      if (matchL) {
        setSelectedLeftId(matchL.id);
        playAudioChime('tap');
        setGuidanceBox({
          type: 'success',
          message: `✓ تم التعرف على: «${matchL.text}» في العمود الأيسر. انطق كلمتها المقابلة أو اخترها بالفأرة!`,
        });
        return;
      }

      // No match found
      playAudioChime('error');
      setGuidanceBox({
        type: 'error',
        message: `⚠️ سُمع: «${spokenText}» — لم تتطابق مع الكلمات المتبقية، انطق كلمة أخرى من الكلمات الظاهرة.`,
      });
      return;
    }

    // Case 2: Right item is already selected -> test match with left column!
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
        message: `⚠️ سُمع: «${spokenText}» — لم نجد كلمة مقابلة مطابقة، حاول مجدداً أو اختر بالفأرة.`,
      });
    }
  };

  // Handle Match Evaluation between selectedRightId and selectedLeftId
  const handleCheckMatch = (rId: string, lId: string) => {
    const rItem = rightItems.find((i) => i.id === rId);
    const lItem = leftItems.find((i) => i.id === lId);
    if (!rItem || !lItem) return;

    const correctPair = activeExercise?.pairs.find((p) => p.id === rItem.pairId);
    const isCorrect = rItem.pairId === lItem.pairId;
    const correctLeft = correctPair?.leftText || '';

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
      const nextConnections = [...connections, newConn];
      setConnections(nextConnections);
      const nextCorrect = correctCount + 1;
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

      // Check if all pairs are solved
      if (activeExercise && nextConnections.length >= activeExercise.pairs.length) {
        handleExerciseFinished(nextCorrect, wrongCount, nextConnections);
      }
    } else {
      // Wrong Match!
      const shouldLock = effectiveLockOnMistake || !effectiveShowMistakeFeedback;

      if (shouldLock) {
        // Locked as incorrect! Cannot undo!
        const newConn: ConnectedAttempt = {
          rightId: rId,
          leftId: lId,
          isCorrect: false,
          rightText: rItem.text,
          leftText: lItem.text,
          correctLeftText: correctLeft,
        };
        const nextConnections = [...connections, newConn];
        setConnections(nextConnections);
        const nextWrong = wrongCount + 1;
        setWrongCount(nextWrong);
        setSelectedRightId(null);
        setSelectedLeftId(null);

        if (effectiveShowMistakeFeedback) {
          playAudioChime('error');
          setGuidanceBox({
            type: 'error',
            message: `❌ إجابة غير صحيحة! تم تثبيت النتيجة ولا يمكن التراجع عنها.`,
          });
        } else {
          playAudioChime('tap');
          setGuidanceBox({
            type: 'info',
            message: `تم التوصيل. تابع توصيل الكلمات المتبقية.`,
          });
        }

        // Check if all pairs are solved
        if (activeExercise && nextConnections.length >= activeExercise.pairs.length) {
          handleExerciseFinished(correctCount, nextWrong, nextConnections);
        }
      } else {
        // Standard Retry Mode: Flash error and let student retry
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

  // When exercise finishes, auto-submit to sheet "answers 2"
  const handleExerciseFinished = async (
    finalCorrect: number,
    finalWrong: number,
    _finalConnections?: ConnectedAttempt[]
  ) => {
    setIsCompleted(true);
    stopVoiceRecording();
    if (!activeExercise || !activeSubject) return;

    const totalPairs = activeExercise.pairs.length;
    const totalAttempts = Math.max(totalPairs, finalCorrect + finalWrong);
    const percentage = Math.round((finalCorrect / totalAttempts) * 100);

    // Update completed count
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
    if (isRightConnected(item.id) || isCompleted) return;
    playAudioChime('tap');

    if (selectedRightId === item.id) {
      setSelectedRightId(null);
      return;
    }

    setSelectedRightId(item.id);

    // If a left item is already selected, test match!
    if (selectedLeftId) {
      handleCheckMatch(item.id, selectedLeftId);
    }
  };

  // User click on left column card
  const handleLeftCardClick = (item: ShuffledItem) => {
    if (isLeftConnected(item.id) || isCompleted) return;
    playAudioChime('tap');

    if (selectedLeftId === item.id) {
      setSelectedLeftId(null);
      return;
    }

    setSelectedLeftId(item.id);

    // If a right item is already selected, test match!
    if (selectedRightId) {
      handleCheckMatch(selectedRightId, item.id);
    }
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

        {/* Answer Behavior Mode Badges & Quick Toggles */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          {/* Toggle 1: Lock on Mistake */}
          <button
            type="button"
            onClick={() => setUserLockOnMistake(!effectiveLockOnMistake)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              effectiveLockOnMistake
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="انقر للتبديل: هل يمكن التراجع عند الخطأ أم محاولة واحدة وتثبيت النتيجة؟"
          >
            <span>{effectiveLockOnMistake ? '🔒 لا يمكن التراجع عن الإجابة' : '🔄 إتاحة المحاولة عند الخطأ'}</span>
          </button>

          {/* Toggle 2: Show/Hide Feedback */}
          <button
            type="button"
            onClick={() => setUserShowMistakeFeedback(!effectiveShowMistakeFeedback)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              !effectiveShowMistakeFeedback
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-200'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
            title="انقر للتبديل: هل يظهر الخطأ فوراً أم يُخفى حتى نهاية التمرين؟"
          >
            <span>{effectiveShowMistakeFeedback ? '👁️ إظهار الخطأ فوراً' : '🙈 الخطأ مخفي حتى النهاية'}</span>
          </button>
        </div>

        {/* 2 Dedicated Interaction Buttons: زر تشغيل الفأرة & زر تسجيل النطق */}
        <div className="flex flex-wrap items-center justify-center gap-3 my-2 w-full max-w-md">
          {/* Button 1: تشغيل الفأرة */}
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

          {/* Button 2: تسجيل نطق (يدعم Web Speech API و MediaRecorder + Whisper في فايرفوكس) */}
          <button
            type="button"
            onClick={handleStartVoiceRecording}
            disabled={isTranscribing}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs border disabled:cursor-not-allowed ${
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
                <span>جاري الاستماع... 🎙️</span>
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

        {/* 4. Guidance / Feedback Box placed DIRECTLY UNDER the two buttons */}
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

        {/* 3. The Two Columns (Right Words & Left Words) */}
        {!isCompleted ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full max-w-2xl my-3">
            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيمن
              </span>
              {rightItems.map((item) => {
                const conn = getRightConn(item.id);
                const isMatched = !!conn;
                const isCorrectMatch = conn?.isCorrect;
                const isSelected = selectedRightId === item.id;
                const isFlashingWrong = incorrectFlashIds?.rightId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleRightCardClick(item)}
                    disabled={isMatched}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 select-none ${
                      isMatched
                        ? effectiveShowMistakeFeedback
                          ? isCorrectMatch
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-60 cursor-default'
                            : 'bg-rose-50 border-rose-300 text-rose-900 opacity-70 cursor-default line-through'
                          : 'bg-purple-50/80 border-purple-200 text-purple-900 opacity-70 cursor-default'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-102 ring-4 ring-indigo-200'
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
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-1">
                العمود الأيسر
              </span>
              {leftItems.map((item) => {
                const conn = getLeftConn(item.id);
                const isMatched = !!conn;
                const isCorrectMatch = conn?.isCorrect;
                const isSelected = selectedLeftId === item.id;
                const isFlashingWrong = incorrectFlashIds?.leftId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleLeftCardClick(item)}
                    disabled={isMatched}
                    className={`w-full p-3 sm:p-4 rounded-2xl border-2 font-amiri text-lg sm:text-2xl font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 select-none ${
                      isMatched
                        ? effectiveShowMistakeFeedback
                          ? isCorrectMatch
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-60 cursor-default'
                            : 'bg-rose-50 border-rose-300 text-rose-900 opacity-70 cursor-default line-through'
                          : 'bg-purple-50/80 border-purple-200 text-purple-900 opacity-70 cursor-default'
                        : isFlashingWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : isSelected
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/30 scale-102 ring-4 ring-purple-200'
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
              ({totalPairsCount} - الصحيح {correctCount} - الخطأ {wrongCount} = {accuracyPercent}%)
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
