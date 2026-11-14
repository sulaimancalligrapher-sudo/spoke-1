import React, { useState, useRef, useEffect } from 'react';
import { WordItem, AudioSettings, PronunciationEvaluation, EvaluationMode, StudentRegistrant } from '../types';
import {
  Volume2,
  Volume1,
  Mic,
  MicOff,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Layers,
  Zap,
  User,
  Image as ImageIcon,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Smartphone,
  Clock,
  AlertTriangle,
  Monitor,
  Cpu,
  DownloadCloud,
  Gauge,
  Lock,
} from 'lucide-react';
import {
  speakArabicBrowser,
  speakArabicGemini,
  playUniversalArabicStream,
  playCustomAudio,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  getSupportedAudioMimeType,
  blobToBase64,
  stopAllAudio,
  detectSpeechPulses,
  detectSpeechPulseAnalysis,
  compareStudentToTeacherAudio,
} from '../utils/arabicAudio';
import { normalizeMediaUrl } from '../utils/mediaUrl';
import { evaluateArabicLocal } from '../utils/arabicMatcher';
import { evaluateAcousticLocally } from '../utils/acousticEvaluator';
import { compressAndResampleAudio } from '../utils/audioConverter';
import { getDailyQuotaStatus, incrementDailyQuota } from '../utils/aiQuota';
import {
  transcribeWithInBrowserWhisper,
  getWhisperTranscriber,
  isWhisperModelCachedLocally,
  WhisperProgress,
} from '../utils/whisperEngine';
import { AudioWaveform } from './AudioWaveform';
import { SupportedLang, TranslationItem, translateEvaluationFeedback } from '../utils/translations';

interface PracticeCardProps {
  wordItem: WordItem;
  settings: AudioSettings;
  currentStudent?: StudentRegistrant | null;
  onEvaluationComplete: (
    evaluation: PronunciationEvaluation,
    recordedAudioUrl?: string,
    studentName?: string
  ) => void;
  isEvaluating: boolean;
  setIsEvaluating: (val: boolean) => void;
  currentIndex: number;
  totalCount: number;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  onOpenLessons?: () => void;
  isSubmitted?: boolean;
  onReRecord?: () => void;
  retryNonce?: number;
  recordedHistoryItem?: {
    score: number;
    grade: string;
    spokenText?: string;
    recordedAudioUrl?: string;
    timestamp?: number;
  } | null;
  currentLang?: SupportedLang;
  translations?: TranslationItem[];
  t?: (id: string, fallback?: string) => string;
}

export const PracticeCard: React.FC<PracticeCardProps> = ({
  wordItem,
  settings,
  currentStudent,
  onEvaluationComplete,
  isEvaluating,
  setIsEvaluating,
  currentIndex,
  totalCount,
  onUpdateSettings,
  onOpenLessons,
  isSubmitted = false,
  onReRecord,
  retryNonce = 0,
  recordedHistoryItem = null,
  currentLang = 'ar',
  translations = [],
  t,
}) => {
  const tr = (id: string, fallback: string) => (t ? t(id, fallback) : fallback);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showMakhrajDetails, setShowMakhrajDetails] = useState(false);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);

  // Check if this word was previously submitted and approved by this student
  const [previousSubmission, setPreviousSubmission] = useState<{
    score: number;
    grade: string;
    detectedWord?: string;
    targetWord?: string;
    audioUrl?: string;
    date?: string;
    time?: string;
  } | null>(null);

  // Re-recording toggle: when user clicks "إعادة التسجيل 🔄" on a previously submitted exercise
  const [isReRecording, setIsReRecording] = useState(false);
  const [isPlayingSubmittedAudio, setIsPlayingSubmittedAudio] = useState(false);
  const submittedAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastHandledRetryNonceRef = useRef<number>(0);

  useEffect(() => {
    setIsPlayingSubmittedAudio(false);
    if (submittedAudioRef.current) {
      submittedAudioRef.current.pause();
    }
    if (retryNonce > 0 && retryNonce !== lastHandledRetryNonceRef.current && wordItem?.allowRetry !== false) {
      lastHandledRetryNonceRef.current = retryNonce;
      setIsReRecording(true);
    } else {
      setIsReRecording(false);
    }
  }, [wordItem?.id, currentStudent?.id, retryNonce, wordItem?.allowRetry]);

  const handlePlaySubmittedVoice = (url: string) => {
    if (isPlayingSubmittedAudio && submittedAudioRef.current) {
      submittedAudioRef.current.pause();
      setIsPlayingSubmittedAudio(false);
      return;
    }
    if (submittedAudioRef.current) {
      submittedAudioRef.current.pause();
    }
    const audio = new Audio(url);
    submittedAudioRef.current = audio;
    setIsPlayingSubmittedAudio(true);
    audio.onended = () => setIsPlayingSubmittedAudio(false);
    audio.onerror = () => setIsPlayingSubmittedAudio(false);
    audio.play();
  };

  useEffect(() => {
    if (!wordItem) {
      setPreviousSubmission(null);
      return;
    }
    try {
      const studentId = currentStudent?.id || 'guest';
      const subject = (wordItem.lessonSubject || '').trim();
      const word = wordItem.word.trim();
      const subKey = `faseeh_sub_${studentId}_${subject}_${word}`;
      const raw = localStorage.getItem(subKey);
      if (raw) {
        setPreviousSubmission(JSON.parse(raw));
      } else {
        // Fallback check by word alone if student had no ID at first
        const fallbackKey = `faseeh_sub_any_${subject}_${word}`;
        const fallbackRaw = localStorage.getItem(fallbackKey);
        if (fallbackRaw) {
          setPreviousSubmission(JSON.parse(fallbackRaw));
        } else if (recordedHistoryItem) {
          setPreviousSubmission({
            score: recordedHistoryItem.score,
            grade: recordedHistoryItem.grade,
            detectedWord: recordedHistoryItem.spokenText,
            targetWord: wordItem.word,
            audioUrl: recordedHistoryItem.recordedAudioUrl,
            date: recordedHistoryItem.timestamp
              ? new Date(recordedHistoryItem.timestamp).toLocaleDateString('ar-SA')
              : undefined,
          });
        } else {
          setPreviousSubmission(null);
        }
      }
    } catch {
      setPreviousSubmission(null);
    }
  }, [currentStudent?.id, wordItem.id, wordItem.word, wordItem.lessonSubject, recordedHistoryItem]);

  const isMobileDevice = typeof navigator !== 'undefined' && (
    /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );

  // Active evaluation mode: Exclusively Whisper by default, completely isolated
  const [activeEvalMode, setActiveEvalMode] = useState<EvaluationMode>('whisper');

  useEffect(() => {
    if (settings.preferredEvaluationMode) {
      setActiveEvalMode(settings.preferredEvaluationMode);
    } else {
      setActiveEvalMode('whisper');
    }
  }, [settings.preferredEvaluationMode]);

  const [studentName, setStudentName] = useState(settings.studentName || '');
  const [showMobileQuotaModal, setShowMobileQuotaModal] = useState(false);
  const [keyMissingError, setKeyMissingError] = useState(false);
  const [transientErrorNotice, setTransientErrorNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  
  // Countdown & Safe Stop states
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSafeStopping, setIsSafeStopping] = useState(false);
  const [showFirstTimeDownloadModal, setShowFirstTimeDownloadModal] = useState(false);
  const countdownTimerRef = useRef<any>(null);

  // Initialize whisperStatus with persistent storage check so moving between lessons never resets to un-downloaded
  const [whisperStatus, setWhisperStatus] = useState<WhisperProgress | null>(() => {
    return isWhisperModelCachedLocally()
      ? { status: 'ready', progress: 100, message: 'جاهز ومحفوظ في جهازك' }
      : null;
  });
  const [isPreloadingWhisper, setIsPreloadingWhisper] = useState(false);

  const handlePreloadWhisper = async (): Promise<boolean> => {
    try {
      setIsPreloadingWhisper(true);
      await getWhisperTranscriber((p) => setWhisperStatus(p));
      try {
        localStorage.setItem('whisper_model_cached_v1', 'true');
      } catch (e) {}
      setWhisperStatus({ status: 'ready', progress: 100, message: 'جاهز ومحفوظ في جهازك' });
      return true;
    } catch (e: any) {
      setWhisperStatus({ status: 'error', message: e?.message || 'تعذر تحميل النموذج' });
      return false;
    } finally {
      setIsPreloadingWhisper(false);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognizerRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const cooldownIntervalRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);

  const triggerCooldown = (seconds = 4) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }
    setCooldownSeconds(seconds);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-play audio when wordItem changes if autoPlayTarget is enabled
  useEffect(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setRecordDuration(0);

    // Keep Whisper status ready if already cached
    if (isWhisperModelCachedLocally()) {
      setWhisperStatus({ status: 'ready', progress: 100, message: 'جاهز ومحفوظ في جهازك' });
    }

    if (settings.autoPlayTarget) {
      const timeout = setTimeout(() => {
        handlePlayAudio(false);
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [wordItem.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
      stopRecording();
    };
  }, []);

  const handleStudentNameChange = (val: string) => {
    setStudentName(val);
    onUpdateSettings({ studentName: val });
  };

  // Handle Listen Audio: plays custom audio if provided, otherwise automated Arabic TTS
  const handlePlayAudio = (slow = false) => {
    if (isPlayingAudio) {
      stopAllAudio();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);

    // Text to read: prioritize autoReadText if provided, otherwise the word itself
    const speechTargetText =
      (wordItem.autoReadText && wordItem.autoReadText.trim()) || wordItem.word;

    if (wordItem.audioUrl && wordItem.audioUrl.trim()) {
      // Play custom audio file (mic recording, uploaded mp3, or google drive / web link)
      playCustomAudio(
        wordItem.audioUrl,
        speechTargetText,
        slow ? 0.7 : settings.speed,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    } else if (settings.engine === 'gemini') {
      speakArabicGemini(
        speechTargetText,
        slow,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    } else {
      // High-quality automated Arabic audio stream with browser speech synthesis fallback
      playUniversalArabicStream(
        speechTargetText,
        slow ? 0.75 : settings.speed,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        (err) => {
          console.warn('TTS Stream playback failed, falling back to speech synthesis:', err);
          speakArabicBrowser(
            speechTargetText,
            slow ? 0.75 : settings.speed,
            () => setIsPlayingAudio(true),
            () => setIsPlayingAudio(false),
            () => setIsPlayingAudio(false)
          );
        }
      );
    }
  };

  // Handle Microphone Click: checks model download -> starts 3-second countdown -> records -> safe stop
  const handleMicClick = async () => {
    if (isSubmitted && !isReRecording) {
      return;
    }

    if (cooldownSeconds > 0 || isEvaluating || isSafeStopping) {
      return;
    }

    // If already recording, stop safely
    if (isRecording) {
      stopRecording();
      return;
    }

    // If currently in countdown, allow canceling
    if (countdown !== null) {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        setRecordingStream(null);
      }
      return;
    }

    // Check if Whisper model needs first-time download
    if (activeEvalMode === 'whisper' && !isWhisperModelCachedLocally()) {
      setShowFirstTimeDownloadModal(true);
      const success = await handlePreloadWhisper();
      setShowFirstTimeDownloadModal(false);
      if (!success) {
        setTransientErrorNotice('تعذر تشغيل أو تحميل محرك الذكاء الداخلي (Whisper). لم يتم التحويل لأي نظام بديل. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.');
        return;
      }
    }

    startCountdownAndRecord();
  };

  // Start 3-second countdown with pre-warmed audio hardware
  const startCountdownAndRecord = async () => {
    setTransientErrorNotice(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setRecordDuration(0);
    audioChunksRef.current = [];

    // 1. Pre-warm microphone hardware in background so no audio is clipped
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      setTransientErrorNotice('يرجى تفعيل صلاحية الميكروفون في المتصفح للتسجيل.');
      return;
    }

    // 2. Start 3-second visual countdown for student preparation
    setCountdown(3);

    countdownTimerRef.current = setTimeout(() => {
      setCountdown(2);
      countdownTimerRef.current = setTimeout(() => {
        setCountdown(1);
        countdownTimerRef.current = setTimeout(() => {
          setCountdown(null);
          beginActualRecording(stream);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  // Begin recording after countdown finishes
  const beginActualRecording = (stream: MediaStream | null) => {
    if (!stream) return;
    isRecordingRef.current = true;
    setIsRecording(true);

    // 1. Start SpeechRecognition on desktop ONLY if local mode is explicitly selected
    if (activeEvalMode === 'local' && isSpeechRecognitionSupported()) {
      try {
        let recognitionFailed = false;
        const recognizer = createSpeechRecognizer(
          (transcript) => {
            liveTranscriptRef.current = transcript;
            setLiveTranscript(transcript);
          },
          (error) => {
            recognitionFailed = true;
            console.warn('Speech recognition notice (ignoring loop):', error);
          },
          () => {
            if (isRecordingRef.current && speechRecognizerRef.current && !recognitionFailed) {
              try {
                speechRecognizerRef.current.start();
              } catch (e) {}
            }
          }
        );
        speechRecognizerRef.current = recognizer;
        recognizer.start();
      } catch (e) {
        console.warn('SpeechRecognizer synchronous start failed:', e);
      }
    }

    // 2. Start duration timer with auto-stop (uses exercise recordingDuration or calculated default)
    const maxRecordingSeconds =
      wordItem.recordingDuration && wordItem.recordingDuration >= 2
        ? wordItem.recordingDuration
        : (wordItem.repeatCount && wordItem.repeatCount > 1
            ? Math.min(12, Math.max(7, wordItem.repeatCount * 2 + 3))
            : 6);

    timerIntervalRef.current = setInterval(() => {
      setRecordDuration((prev) => {
        const next = prev + 1;
        if (next >= maxRecordingSeconds) {
          stopRecording();
          return next;
        }
        return next;
      });
    }, 1000);

    // 3. Audio stream handling:
    try {
      const mimeType = getSupportedAudioMimeType();
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
    } catch (err: any) {
      console.warn('MediaRecorder audio stream notice:', err);
    }
  };

  // Stop Recording and Evaluate with 400ms safety padding to prevent truncation of final syllables
  const stopRecording = () => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    isRecordingRef.current = false;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.abort();
      } catch (e) {}
      speechRecognizerRef.current = null;
    }

    setIsSafeStopping(true);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = async () => {
        setIsSafeStopping(false);
        const detectedMime =
          recorder.mimeType || getSupportedAudioMimeType() || 'audio/mp4';
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = []; // Completely sever and clear buffer for clean fresh start next time
        const audioBlob = new Blob(chunks, {
          type: detectedMime,
        });
        const recordedAudioUrl = URL.createObjectURL(audioBlob);

        if (recordingStream) {
          recordingStream.getTracks().forEach((track) => track.stop());
          setRecordingStream(null);
        }

        setIsRecording(false);

        const currentSpoken = (liveTranscriptRef.current || liveTranscript).trim();
        console.log('Voice recorded successfully, starting evaluation:', audioBlob.size, 'bytes');
        await evaluateStudentAttempt(audioBlob, currentSpoken, recordedAudioUrl);
      };

      // 400ms padding buffer before stopping so the last syllable or Haraka is never clipped
      setTimeout(() => {
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch (err) {
          console.warn('MediaRecorder stop notice:', err);
          setIsSafeStopping(false);
          setIsRecording(false);
        }
      }, 400);
    } else {
      setIsSafeStopping(false);
      setIsRecording(false);
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        setRecordingStream(null);
      }
      const currentSpoken = (liveTranscriptRef.current || liveTranscript).trim();
      evaluateStudentAttempt(undefined, currentSpoken, undefined);
    }
  };

  // Evaluate student's pronunciation
  const evaluateStudentAttempt = async (
    audioBlob?: Blob,
    spokenText?: string,
    recordedAudioUrl?: string
  ) => {
    setIsEvaluating(true);
    try {
      const textToEvaluate = spokenText || liveTranscriptRef.current || liveTranscript || '';

      // 1. DEDICATED IN-BROWSER WHISPER (Primary, 100% Dedicated & Isolated - No Fallback)
      if (activeEvalMode === 'whisper') {
        if (audioBlob) {
          try {
            setWhisperStatus({ status: 'transcribing', message: 'جاري استماع Whisper الداخلي وتطبيق حصر المفردات...' });

            // Run physical pulse & duration detection in parallel with Whisper transcription
            const pulseAnalysisPromise = detectSpeechPulseAnalysis(audioBlob).catch(() => ({
              pulses: 1,
              totalDuration: 1.0,
              speechDuration: 0.8,
            }));

            const pulseAnalysis = await pulseAnalysisPromise;
            const acousticPulses = pulseAnalysis.pulses;
            const audioDuration = pulseAnalysis.totalDuration || pulseAnalysis.speechDuration;

            const whisperTranscript = await transcribeWithInBrowserWhisper(
              audioBlob,
              wordItem.word,
              wordItem.repeatCount || 1,
              (p) => setWhisperStatus(p),
              {
                lessonVocabulary: [wordItem.word, wordItem.lessonSubject, wordItem.category].filter(Boolean) as string[],
                audioDuration,
                acousticPulses,
              }
            );
            if (whisperTranscript) {
              setLiveTranscript(whisperTranscript);
            }

            // Acoustic Comparison with Teacher Audio (The Hybrid Approach if audioUrl exists)
            let acousticCompResult: any = null;
            if (wordItem.audioUrl) {
              try {
                setWhisperStatus({ status: 'transcribing', message: 'جاري المطابقة الفيزيائية مع البصمة الصوتية لتسجيل المعلم...' });
                acousticCompResult = await compareStudentToTeacherAudio(audioBlob, wordItem.audioUrl);
              } catch (acErr) {
                console.warn('Teacher acoustic comparison notice:', acErr);
              }
            }

            const textForEval = whisperTranscript || '';
            const evalResult = evaluateArabicLocal(
              wordItem.word,
              textForEval,
              wordItem.repeatCount || 1,
              wordItem.difficultyLevel || 'medium',
              acousticPulses,
              audioDuration
            );

            // Compute Hybrid Score if teacher audio was compared
            let finalScore = evalResult.score;
            let finalFeedback = evalResult.feedback;
            let finalNotice = 'تم التقييم بنجاح عبر محرك الذكاء الاصطناعي الداخلي (Whisper) مع التوجيه بحصر المفردات.';

            if (acousticCompResult && typeof acousticCompResult.similarityScore === 'number') {
              const textScore = evalResult.score;
              const acousticScore = acousticCompResult.similarityScore;
              finalScore = Math.round(textScore * 0.5 + acousticScore * 0.5);

              finalFeedback = `${evalResult.feedback} | مقارنة صوت المعلم: ${acousticCompResult.feedback} (تطابق طيفي: ${acousticScore}%)`;
              finalNotice = 'تم التقييم بالأسلوب الهجين: 50% لمطابقة النص ومخارج الحروف (Whisper) + 50% لمطابقة البصمة الصوتية والمخارج مع تسجيل المعلم.';
            }

            onEvaluationComplete(
              {
                ...evalResult,
                score: finalScore,
                textMatchScore: evalResult.score,
                acousticMatchScore: acousticCompResult?.similarityScore,
                acousticComparison: acousticCompResult || undefined,
                feedback: finalFeedback,
                detectedWord: textForEval || '—',
                engineUsed: 'whisper',
                recordedAudioUrl,
                engineNotice: finalNotice,
              },
              recordedAudioUrl,
              studentName
            );
            setWhisperStatus(null);
            triggerCooldown(3);
            return;
          } catch (whisperErr: any) {
            console.error('Whisper transcription error:', whisperErr);
            setWhisperStatus({ status: 'error', message: whisperErr?.message || 'خطأ في معالجة الصوت' });
            setTransientErrorNotice('تعذر تشغيل محرك Whisper الداخلي: ' + (whisperErr?.message || 'حدث خطأ أثناء معالجة الصوت. لم يتم التحويل لأي نظام بديل بناءً على طلبك.'));
            const baseEval = evaluateArabicLocal(wordItem.word, '', wordItem.repeatCount || 1, wordItem.difficultyLevel || 'medium');
            onEvaluationComplete(
              {
                ...baseEval,
                score: 0,
                grade: 'تعذر المعالجة',
                isMatch: false,
                feedback: 'تعذر على محرك Whisper الداخلي تحليل الصوت. لم يتم التبديل لأي نظام آخر بناءً على الإعدادات. يرجى إعادة المحاولة والتحدث بوضوح.',
                detectedWord: '—',
                engineUsed: 'whisper',
                engineNotice: 'خطأ في محرك Whisper: لم يتم التحويل لأي نظام بديل.',
                recordedAudioUrl,
                timestamp: Date.now(),
              },
              recordedAudioUrl,
              studentName
            );
            triggerCooldown(3);
            return;
          }
        } else if (textToEvaluate.trim()) {
          const evalResult = evaluateArabicLocal(
            wordItem.word,
            textToEvaluate.trim(),
            wordItem.repeatCount || 1,
            wordItem.difficultyLevel || 'medium'
          );
          onEvaluationComplete(
            {
              ...evalResult,
              detectedWord: textToEvaluate.trim(),
              engineUsed: 'whisper',
              engineNotice: 'تم التقييم بنجاح.',
            },
            undefined,
            studentName
          );
          triggerCooldown(3);
          return;
        } else {
          setTransientErrorNotice('لم يتم التقاط أي ملف صوتي من الميكروفون لتحليله بواسطة Whisper. يرجى الضغط والتحدث بوضوح.');
          return;
        }
      }

      // 2. ISOLATED LOCAL ENGINE (Chrome Speech Recognition)
      if (activeEvalMode === 'local') {
        const pulseAnalysis = audioBlob
          ? await detectSpeechPulseAnalysis(audioBlob).catch(() => ({ pulses: 1, totalDuration: 1.0, speechDuration: 0.8 }))
          : { pulses: 1, totalDuration: 1.0, speechDuration: 0.8 };
        const localEval = evaluateArabicLocal(
          wordItem.word,
          textToEvaluate,
          wordItem.repeatCount || 1,
          wordItem.difficultyLevel || 'medium',
          pulseAnalysis.pulses,
          pulseAnalysis.totalDuration || pulseAnalysis.speechDuration
        );
        onEvaluationComplete(
          {
            ...localEval,
            detectedWord: textToEvaluate || '—',
            engineUsed: 'local',
            recordedAudioUrl,
            engineNotice: 'تم التقييم بنجاح عبر التعرف النصي المباشر لمتصفح Chrome.',
          },
          recordedAudioUrl,
          studentName
        );
        triggerCooldown(3);
        return;
      }

      // 3. ISOLATED ACOUSTIC MATCHING (Physical Waveform Analysis)
      if (activeEvalMode === 'acoustic') {
        if (audioBlob) {
          try {
            const acousticResult = await evaluateAcousticLocally(
              audioBlob,
              wordItem.word,
              textToEvaluate,
              recordedAudioUrl
            );
            onEvaluationComplete(acousticResult, recordedAudioUrl, studentName);
            triggerCooldown(3);
            return;
          } catch (err: any) {
            console.warn('Acoustic evaluation error:', err);
          }
        }
        const fallback = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1);
        onEvaluationComplete(
          {
            ...fallback,
            recordedAudioUrl,
            engineUsed: 'acoustic',
            engineNotice: 'تم التقييم النصي السريع لعدم توفر ملف صوتي.',
          },
          recordedAudioUrl,
          studentName
        );
        triggerCooldown(3);
        return;
      }

      // 4. ISOLATED CLOUD AI (Gemini AI)
      if (activeEvalMode === 'ai') {
        let audioBase64 = '';
        const mimeType = audioBlob ? (audioBlob.type || getSupportedAudioMimeType() || 'audio/webm') : 'audio/webm';
        if (audioBlob) {
          try {
            audioBase64 = await blobToBase64(audioBlob);
          } catch (e) {}
        }

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (settings.geminiApiKey) {
            headers['x-gemini-key'] = settings.geminiApiKey;
          }

          const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              targetWord: wordItem.word,
              spokenText: textToEvaluate || undefined,
              audioBase64: audioBase64 || undefined,
              audioMimeType: mimeType,
              apiKey: settings.geminiApiKey || undefined,
              repeatCount: wordItem.repeatCount || 1,
              notes: `الدرس: ${wordItem.lessonSubject} - الفئة: ${wordItem.category}`,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.evaluation) {
              incrementDailyQuota();
              if (data.transcript) {
                setLiveTranscript(data.transcript);
              }
              onEvaluationComplete(
                {
                  ...data.evaluation,
                  timestamp: Date.now(),
                  recordedAudioUrl,
                  engineUsed: 'ai',
                },
                recordedAudioUrl,
                studentName
              );
              triggerCooldown(4);
              return;
            }
          } else {
            const errJson = await response.json().catch(() => null);
            setTransientErrorNotice(errJson?.error || 'تعذر تقييم الصوت عبر الذكاء السحابي.');
          }
        } catch (err: any) {
          setTransientErrorNotice('خطأ في الاتصال بالذكاء السحابي: ' + (err?.message || ''));
        }

        const fallback = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1);
        onEvaluationComplete(
          {
            ...fallback,
            recordedAudioUrl,
            engineUsed: 'ai',
            engineNotice: 'تعذر الاتصال بالذكاء السحابي، يمكنك التحقق من المفتاح في الإعدادات.',
          },
          recordedAudioUrl,
          studentName
        );
        triggerCooldown(3);
        return;
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  // IF PREVIOUSLY SUBMITTED & APPROVED: Render full dedicated review card as requested by the user
  if (previousSubmission && !isReRecording) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-100 border border-slate-100 relative overflow-hidden animate-in fade-in duration-300">
        {/* Soft background accents */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50/70 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-50/70 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Top Header Banner: سبق إرسال واعتماد هذا التمرين */}
        <div className="mb-6 p-4 bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md shadow-emerald-600/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {tr('practice_submitted_and_locked', 'تم التسجيل و التقييم')}
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                {tr('eval_submit_success', 'تم إرسال إجابتك واعتمادها بنجاح! ✅')}
              </p>
            </div>
          </div>
          {previousSubmission.date && (
            <div className="text-xs bg-white/15 px-3 py-1 rounded-xl text-white font-mono">
              {previousSubmission.date}
            </div>
          )}
        </div>

        {/* Exercise Word Details */}
        <div className="text-center py-4 border-b border-slate-100">
          {/* Optional Image */}
          {wordItem.imageUrl && (
            <div className="mb-4 flex justify-center">
              <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-100 shadow-md">
                <img
                  src={normalizeMediaUrl(wordItem.imageUrl)}
                  alt={wordItem.word}
                  className="w-32 h-32 sm:w-40 sm:h-40 object-cover"
                  onError={(e) => {
                    (e.target as any).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          <div className="text-4xl sm:text-6xl font-bold font-amiri text-slate-900 tracking-wide mb-2 select-all">
            {wordItem.word}
          </div>
          {wordItem.meaning && (
            <div className="text-xs sm:text-sm text-slate-500 font-medium">
              {wordItem.meaning}
            </div>
          )}
        </div>

        {/* Student Submission Record: Spoken Text + Audio + Score + Grade */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Box 1: Spoken text & Recorded Voice */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-500 font-bold block mb-1">
                {tr('eval_detected_speech_label', 'ما سُمع من النطق:')}
              </span>
              <div className="text-lg font-bold font-amiri text-slate-800 bg-white p-2.5 rounded-xl border border-slate-100">
                "{previousSubmission.detectedWord || wordItem.word}"
              </div>
            </div>

            {/* Audio player if student's audio is available */}
            {previousSubmission.audioUrl && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-600 font-bold">{tr('eval_listen_student', 'تسجيلك الصوتي:')}</span>
                <button
                  type="button"
                  onClick={() => handlePlaySubmittedVoice(previousSubmission.audioUrl!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isPlayingSubmittedAudio ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>{tr('eval_stop_audio', 'إيقاف الصوت')}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{tr('eval_listen_student', 'استمع لصوتك')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Box 2: Score & Grade */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-emerald-800 font-bold mb-1">
              {tr('eval_score_badge', 'درجة التقييم')}
            </span>
            <div className="text-4xl font-black font-cairo text-emerald-700 mb-1">
              {previousSubmission.score}%
            </div>
            <span className="inline-block px-3 py-1 bg-emerald-200/80 text-emerald-950 rounded-full text-xs font-black shadow-2xs">
              {translateEvaluationFeedback(previousSubmission.grade, currentLang, translations) ||
                tr('eval_grade_mastered', 'متقن')}
            </span>
          </div>
        </div>

        {/* Bottom Action: زر إعادة التسجيل 🔄 أو تنبيه قفل الإعادة */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {wordItem.allowRetry !== false ? (
            <>
              <div className="text-xs text-slate-500 text-center sm:text-right">
                {tr('practice_retry_prompt', 'هل ترغب في إعادة المحاولة وتوثيق تسجيل ودرجة جديدة؟')}
              </div>

              <button
                type="button"
                onClick={() => setIsReRecording(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer hover:scale-102 active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{tr('practice_re_record_btn', 'إعادة التسجيل')}</span>
              </button>
            </>
          ) : (
            <div className="w-full p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold text-center">
              {tr('practice_retry_disabled_notice', '🔒 تم تسجيل درجتك مسبقاً، وإعادة المحاولة مغلقة من المعلم.')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-100 border border-slate-100 relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Arabic Display Stage with Optional Image */}
      <div className="text-center py-4 sm:py-6 border-b border-slate-100">
        {/* Attached Picture if available */}
        {wordItem.imageUrl && (
          <div className="mb-4 flex justify-center">
            <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-100 shadow-md">
              <img
                src={normalizeMediaUrl(wordItem.imageUrl)}
                alt={wordItem.word}
                className="w-36 h-36 sm:w-44 sm:h-44 object-cover hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                }}
              />
            </div>
          </div>
        )}

        {/* شارات التدريب: مستوى التدقيق المحدد + تكرار النطق المطلوب */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          {/* شارة مستوى تدقيق وتقييم النطق */}
          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold border shadow-xs ${
              wordItem.difficultyLevel === 'easy'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : wordItem.difficultyLevel === 'hard'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-sky-50 border-sky-300 text-sky-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>
              {wordItem.difficultyLevel === 'easy'
                ? tr('eval_difficulty_easy', 'سهل 🟢')
                : wordItem.difficultyLevel === 'hard'
                ? tr('eval_difficulty_hard', 'متقدم 🔴')
                : tr('eval_difficulty_medium', 'متوسط 🟡')}
            </span>
          </div>

          {/* شارة التكرار المطلوبة إن وجدت */}
          {wordItem.repeatCount && wordItem.repeatCount > 1 && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl text-xs font-bold shadow-xs">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>🔁 {tr('eval_repetitions_label', 'التكرار:')} {wordItem.repeatCount}x</span>
            </div>
          )}
        </div>

        <div className="inline-block relative">
          <h2
            className="font-amiri text-5xl sm:text-7xl font-bold text-slate-900 tracking-wider mb-3 select-all hover:scale-[1.02] transition-transform duration-300"
            style={{ lineHeight: 1.4 }}
          >
            {wordItem.word}
          </h2>
        </div>

        {wordItem.transliteration && (
          <p className="text-sm font-medium text-slate-400 tracking-wide dir-ltr mb-1">
            {wordItem.transliteration}
          </p>
        )}

        {(() => {
          const displayMeaning = tr(`lesson_${wordItem.word}_meaning`, wordItem.meaning || '');
          return displayMeaning ? (
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {displayMeaning}
            </p>
          ) : null;
        })()}

        {/* Makhraj tip toggle */}
        {(() => {
          const displayMakhraj = tr(`lesson_${wordItem.word}_makhraj`, wordItem.makhrajTip || '');
          if (!displayMakhraj) return null;
          return (
            <div className="mt-4">
              <button
                onClick={() => setShowMakhrajDetails(!showMakhrajDetails)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{tr('practice_makhraj_tip_title', 'مخرج الحرف وكيفية نطقه:')}</span>
                {showMakhrajDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showMakhrajDetails && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed max-w-lg mx-auto text-right animate-in fade-in duration-300">
                  <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                    <span>{tr('practice_makhraj_how_to', '💡 كيف تنطق هذا الحرف؟')}</span>
                  </div>
                  {displayMakhraj}
                  {wordItem.harakat && (
                    <div className="mt-2 text-slate-500 font-semibold border-t border-slate-200 pt-1.5">
                      {tr('practice_harakat_label', 'الحركات:')} {wordItem.harakat}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Interactive Step Controls */}
      <div className="py-6 flex flex-col items-center">
        {/* Listen Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => handlePlayAudio(false)}
            disabled={isRecording || isEvaluating}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer ${
              isPlayingAudio
                ? 'bg-emerald-600 text-white shadow-emerald-500/25 animate-listen-pulse'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 hover:border-emerald-300'
            }`}
          >
            <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'text-white' : 'text-emerald-600'}`} />
            <span>
              {isPlayingAudio
                ? tr('practice_listen_btn', 'جاري الاستماع...')
                : wordItem.audioUrl
                ? tr('practice_teacher_audio', 'استمع لصوت المعلم')
                : tr('practice_listen_btn', 'استمع للنطق النموذجي')}
            </span>
          </button>

          {!wordItem.audioUrl && (
            <button
              onClick={() => handlePlayAudio(true)}
              disabled={isRecording || isEvaluating || isPlayingAudio}
              className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-2xl text-xs font-semibold transition-all cursor-pointer"
              title="نطق بطيء للمبتدئين وللتدرب على التشكيل"
            >
              <Volume1 className="w-4 h-4 text-slate-500" />
              <span>{tr('practice_slow_listen_btn', 'نطق بطيء (0.7x)')}</span>
            </button>
          )}
        </div>

        {/* Microphone Speaking Stage */}
        <div className="flex flex-col items-center w-full max-w-md">
          {/* Waveform */}
          <div className="w-full mb-4">
            <AudioWaveform
              isRecording={isRecording}
              isPlaying={isPlayingAudio}
              stream={recordingStream}
            />
          </div>

          {/* Record Button */}
          <div className="relative my-2">
            {isSubmitted && !isReRecording ? (
              <div className="flex flex-col items-center animate-in fade-in">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center bg-slate-200 text-slate-400 border border-slate-300 select-none cursor-not-allowed shadow-inner"
                  title={tr('practice_submitted_and_locked', 'تم التسجيل و التقييم')}
                >
                  <Mic className="w-8 h-8 text-slate-400" />
                </div>
                <span className="text-xs font-bold text-slate-600 mt-2.5">
                  {tr('practice_submitted_and_locked', 'تم التسجيل و التقييم')}
                </span>
              </div>
            ) : cooldownSeconds > 0 ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-amber-50 text-amber-700 border-2 border-amber-300 shadow-inner select-none animate-in fade-in">
                <Clock className="w-7 h-7 text-amber-600" />
                <span className="text-xs font-extrabold text-amber-800 mt-0.5 font-mono">
                  {cooldownSeconds}ث
                </span>
              </div>
            ) : countdown !== null ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-cyan-600 text-white shadow-xl shadow-cyan-600/40 animate-pulse scale-110 border-4 border-cyan-300 select-none">
                <span className="text-3xl font-extrabold font-mono leading-none">{countdown}</span>
                <span className="text-[9px] font-bold mt-1 text-cyan-100">{tr('practice_get_ready', 'استعد...')}</span>
              </div>
            ) : isSafeStopping ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse select-none">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-[9px] font-bold mt-1">{tr('practice_saving_audio', 'حفظ الصوت...')}</span>
              </div>
            ) : (
              <button
                onClick={handleMicClick}
                disabled={isEvaluating || isSafeStopping}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg ${
                  isRecording
                    ? 'bg-rose-500 text-white hover:bg-rose-600 animate-mic-pulse shadow-rose-500/40 scale-105'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 shadow-emerald-600/30'
                }`}
                title={isRecording ? tr('practice_recording_active', 'اضغط لإنهاء التسجيل والتقييم') : tr('practice_record_btn', 'اضغط للتحدث ونطق الكلمة')}
              >
                {isRecording ? (
                  <div className="flex flex-col items-center justify-center">
                    <MicOff className="w-8 h-8" />
                    <span className="text-[10px] font-bold mt-0.5 font-mono">
                      00:{recordDuration < 10 ? `0${recordDuration}` : recordDuration}
                    </span>
                  </div>
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
            )}
          </div>

          <p className="text-xs font-medium text-slate-500 mt-3 text-center">
            {cooldownSeconds > 0 ? (
              <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                <span>⏳ {tr('practice_cooldown_wait', 'استعد للمحاولة التالية')} ({cooldownSeconds}s)</span>
              </span>
            ) : countdown !== null ? (
              <span className="text-cyan-800 font-bold bg-cyan-50 border border-cyan-300 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 animate-pulse shadow-xs">
                <span>⏱️ {tr('practice_countdown_listen', 'استعد! سيبدأ الاستماع بعد')} ({countdown}s)</span>
              </span>
            ) : isSafeStopping ? (
              <span className="text-amber-800 font-bold bg-amber-50 border border-amber-300 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                <span>💾 {tr('practice_saving_audio', 'جاري حفظ مقطع الصوت بالكامل...')}</span>
              </span>
            ) : isRecording ? (
              <span className="text-rose-700 font-bold bg-rose-50 border border-rose-300 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                <span>
                  🎙️ {tr('practice_recording_active', 'تحدّث الآن بوضوح')} ({Math.max(
                    0,
                    (wordItem.repeatCount && wordItem.repeatCount > 1
                      ? Math.min(10, Math.max(7, wordItem.repeatCount * 2 + 3))
                      : 6) - recordDuration
                  )}s)
                </span>
              </span>
            ) : (
              tr('practice_record_btn', 'اضغط على الميكروفون ثم استعد للنطق بوضوح')
            )}
          </p>

          {(liveTranscript || isRecording) && (
            <div className="mt-4 w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center animate-in fade-in duration-200">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                {liveTranscript ? tr('eval_detected_speech_label', 'ما تم رصده صوتياً:') : tr('practice_mic_status', 'حالة الميكروفون:')}
              </span>
              <div className="text-base font-bold font-amiri text-emerald-800">
                {liveTranscript ? (
                  <span>{liveTranscript}</span>
                ) : (
                  <span className="text-slate-500 text-xs font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <span>🎙️ {tr('practice_listening_prompt', 'يستمع إليك... انطق الكلمة الآن بوضوح')}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {transientErrorNotice && (
            <div className="mt-4 w-full p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex flex-col sm:flex-row items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-center sm:text-right">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{transientErrorNotice}</span>
              </div>
              <button
                onClick={() => {
                  setTransientErrorNotice(null);
                  handleMicClick();
                }}
                className="px-3 py-1 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 text-xs shrink-0 cursor-pointer shadow-xs"
              >
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Quota Exhausted Modal */}
      {showMobileQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center relative">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 shadow-sm border border-amber-200">
              <Smartphone className="w-8 h-8 text-amber-600" />
            </div>

            <span className="px-3 py-1 bg-amber-100/70 text-amber-900 border border-amber-300 rounded-full text-xs font-bold inline-block mb-3">
              {keyMissingError ? 'تفعيل الذكاء الاصطناعي على Vercel' : 'اكتملت الحصة اليومية للهاتف'}
            </span>

            <h3 className="text-lg font-bold text-slate-900 mb-2 font-cairo">
              {keyMissingError ? 'يلزم تفعيل مفتاح السيرفر' : 'أحسنت في تدريبات اليوم!'}
            </h3>

            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 font-medium">
              {keyMissingError ? (
                <span>
                  مفتاح الذكاء الاصطناعي (<code className="font-mono font-bold text-indigo-700">GEMINI_API_KEY</code>) غير مضاف في إعدادات موقع Vercel. ليعمل تقييم الصوت بالذكاء الاصطناعي على الجوال لجميع الطلاب: يُرجى إضافة المفتاح في لوحة تحكم Vercel Environment Variables (أو النقر على أيقونة الإعدادات ⚙️ بأعلى الصفحة ولصقه).
                </span>
              ) : (
                <span>
                  أحسنت! انتهت الحصة اليومية للتقييم الصوتي على الهاتف اليوم. يمكنك إكمال التدريب والتسجيل الصوتي الآن عبر جهاز الكمبيوتر، أو العودة غداً عند تجدد الرصيد.
                </span>
              )}
            </div>

            {!keyMissingError && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl mb-5 text-right flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">التجدد التلقائي:</span> يتجدد الرصيد المجاني تلقائياً في منتصف الليل (12:00 ص) بتوقيت جهازك دون أي تدخل.
                </div>
              </div>
            )}

            <div className="flex gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setShowMobileQuotaModal(false)}
                className="w-full py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Processing Lock Overlay - Prevents all clicks during analysis */}
      {isEvaluating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm animate-pulse">
              <Sparkles className="w-8 h-8 text-emerald-600 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5 font-cairo">
              {tr('practice_analyzing_modal_title', 'جاري تحليل نطقك وتدقيق الحركات...')}
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              {tr('practice_analyzing_modal_desc', 'يقوم محرك الذكاء بفحص مخارج الحركات ومطابقة الكلمة، استعد لرؤية النتيجة!')}
            </p>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>{tr('practice_analyzing_modal_sub', 'لحظات قليلة وتظهر النتيجة...')}</span>
            </div>
          </div>
        </div>
      )}

      {/* First-Time Whisper Setup Modal (Automatic on first click) */}
      {showFirstTimeDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-cyan-50 text-cyan-700 flex items-center justify-center mx-auto mb-4 border border-cyan-200 shadow-sm">
              <Cpu className="w-8 h-8 text-cyan-600 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5 font-cairo">
              تجهيز محرك الذكاء الاصطناعي في جهازك
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              يحدث لمرة واحدة فقط لتنزيل ملف الذكاء (40MB) وحفظه في جهازك ليعمل التطبيق بدون إنترنت وبلا خوادم.
            </p>
            
            {whisperStatus?.status === 'loading' && typeof whisperStatus.progress === 'number' ? (
              <div className="space-y-2">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className="bg-cyan-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${whisperStatus.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-cyan-900">
                  <span>جاري التثبيت في جهازك...</span>
                  <span className="font-mono">{whisperStatus.progress}%</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-cyan-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>بدء التجهيز السريع...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
