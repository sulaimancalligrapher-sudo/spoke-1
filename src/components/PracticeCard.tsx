import React, { useState, useRef, useEffect } from 'react';
import { WordItem, AudioSettings, PronunciationEvaluation, EvaluationMode } from '../types';
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
  Play,
  RotateCcw,
  Smartphone,
  Clock,
  AlertTriangle,
  Monitor,
  Cpu,
  DownloadCloud,
  Gauge,
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

interface PracticeCardProps {
  wordItem: WordItem;
  settings: AudioSettings;
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
}

export const PracticeCard: React.FC<PracticeCardProps> = ({
  wordItem,
  settings,
  onEvaluationComplete,
  isEvaluating,
  setIsEvaluating,
  currentIndex,
  totalCount,
  onUpdateSettings,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showMakhrajDetails, setShowMakhrajDetails] = useState(false);
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);

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

    // 2. Start duration timer
    timerIntervalRef.current = setInterval(() => {
      setRecordDuration((prev) => {
        if (prev >= 12) {
          stopRecording();
          return prev;
        }
        return prev + 1;
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
        speechRecognizerRef.current.stop();
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
        const audioBlob = new Blob(audioChunksRef.current, {
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
      const textToEvaluate = spokenText || liveTranscriptRef.current || liveTranscript || manualText || '';

      // 1. DEDICATED IN-BROWSER WHISPER (Primary, 100% Dedicated & Isolated - No Fallback)
      if (activeEvalMode === 'whisper') {
        if (audioBlob) {
          try {
            setWhisperStatus({ status: 'transcribing', message: 'جاري استماع Whisper الداخلي في متصفحك وكتابة الكلمة...' });
            const whisperTranscript = await transcribeWithInBrowserWhisper(
              audioBlob,
              wordItem.word,
              (p) => setWhisperStatus(p)
            );
            if (whisperTranscript) {
              setLiveTranscript(whisperTranscript);
            }
            const evalResult = evaluateArabicLocal(
              wordItem.word,
              whisperTranscript,
              wordItem.repeatCount || 1,
              wordItem.difficultyLevel || 'medium'
            );
            onEvaluationComplete(
              {
                ...evalResult,
                detectedWord: whisperTranscript || '—',
                engineUsed: 'whisper',
                recordedAudioUrl,
                engineNotice: 'تم التقييم بنجاح عبر محرك الذكاء الاصطناعي الداخلي (Whisper) داخل جهازك مباشرة دون خوادم.',
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
        } else {
          setTransientErrorNotice('لم يتم التقاط أي ملف صوتي من الميكروفون لتحليله بواسطة Whisper. يرجى الضغط والتحدث بوضوح.');
          return;
        }
      }

      // 2. ISOLATED LOCAL ENGINE (Chrome Speech Recognition)
      if (activeEvalMode === 'local') {
        const localEval = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1, wordItem.difficultyLevel || 'medium');
        onEvaluationComplete(
          {
            ...localEval,
            recordedAudioUrl,
            engineUsed: 'local',
            engineNotice: 'تم التقييم عبر التعرف النصي للمتصفح.',
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    evaluateStudentAttempt(undefined, manualText.trim());
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-100 border border-slate-100 relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header: Lesson Subject, Category & Student Name */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full text-xs font-bold flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            {wordItem.lessonSubject || 'الدرس الحالي'}
          </span>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
            {wordItem.category}
          </span>
        </div>

        {/* Student Name Input */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-xl">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={studentName}
            onChange={(e) => handleStudentNameChange(e.target.value)}
            placeholder="اسم الطالب (لتسجيل الدرجات)..."
            className="text-xs bg-transparent border-none focus:outline-hidden text-slate-700 w-36 placeholder:text-slate-400"
          />
        </div>
      </div>

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
                ? 'مستوى التدقيق: سهل 🟢 (تساهل تشجيعي للمبتدئين)'
                : wordItem.difficultyLevel === 'hard'
                ? 'مستوى التدقيق: متقدم 🔴 (صارم في الحركات والمخارج)'
                : 'مستوى التدقيق: متوسط 🟡 (متوازن)'}
            </span>
          </div>

          {/* شارة التكرار المطلوبة إن وجدت */}
          {wordItem.repeatCount && wordItem.repeatCount > 1 && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl text-xs font-bold shadow-xs">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>🔁 كرر ({wordItem.repeatCount}) مرات متتالية</span>
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

        {wordItem.meaning && (
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {wordItem.meaning}
          </p>
        )}

        {/* Makhraj tip toggle */}
        {wordItem.makhrajTip && (
          <div className="mt-4">
            <button
              onClick={() => setShowMakhrajDetails(!showMakhrajDetails)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>مخرج ونطق الحرف الصحيح</span>
              {showMakhrajDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showMakhrajDetails && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed max-w-lg mx-auto text-right animate-in fade-in duration-300">
                <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                  <span>💡 كيف تنطق هذا الحرف؟</span>
                </div>
                {wordItem.makhrajTip}
                {wordItem.harakat && (
                  <div className="mt-2 text-slate-500 font-semibold border-t border-slate-200 pt-1.5">
                    الحركات: {wordItem.harakat}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
                ? 'جاري الاستماع...'
                : wordItem.audioUrl
                ? 'استمع لصوت المعلم'
                : 'استمع للنطق النموذجي'}
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
              <span>نطق بطيء (0.7x)</span>
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
            {cooldownSeconds > 0 ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-amber-50 text-amber-700 border-2 border-amber-300 shadow-inner select-none animate-in fade-in">
                <Clock className="w-7 h-7 text-amber-600" />
                <span className="text-xs font-extrabold text-amber-800 mt-0.5 font-mono">
                  {cooldownSeconds}ث
                </span>
              </div>
            ) : countdown !== null ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-cyan-600 text-white shadow-xl shadow-cyan-600/40 animate-pulse scale-110 border-4 border-cyan-300 select-none">
                <span className="text-3xl font-extrabold font-mono leading-none">{countdown}</span>
                <span className="text-[9px] font-bold mt-1 text-cyan-100">استعد...</span>
              </div>
            ) : isSafeStopping ? (
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse select-none">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-[9px] font-bold mt-1">حفظ الصوت...</span>
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
                title={isRecording ? 'اضغط لإنهاء التسجيل والتقييم' : 'اضغط للتحدث ونطق الكلمة'}
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
                <span>⏳ استعد للمحاولة التالية خلال {cooldownSeconds} ثوانٍ...</span>
              </span>
            ) : countdown !== null ? (
              <span className="text-cyan-800 font-bold bg-cyan-50 border border-cyan-300 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 animate-pulse shadow-xs">
                <span>⏱️ استعد! سيبدأ الاستماع بعد {countdown} ثوانٍ...</span>
              </span>
            ) : isSafeStopping ? (
              <span className="text-amber-800 font-bold bg-amber-50 border border-amber-300 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                <span>💾 جاري حفظ مقطع الصوت بالكامل...</span>
              </span>
            ) : isRecording ? (
              <span className="text-rose-700 font-bold bg-rose-50 border border-rose-300 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                <span>🎙️ تحدّث الآن بوضوح... اضغط على الزر مرة أخرى للتقييم</span>
              </span>
            ) : (
              'اضغط على الميكروفون ثم استعد للنطق بوضوح'
            )}
          </p>

          {(liveTranscript || isRecording) && (
            <div className="mt-4 w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center animate-in fade-in duration-200">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                {liveTranscript ? 'ما تم رصده صوتياً:' : 'حالة الميكروفون:'}
              </span>
              <div className="text-base font-bold font-amiri text-emerald-800">
                {liveTranscript ? (
                  <span>{liveTranscript}</span>
                ) : (
                  <span className="text-slate-500 text-xs font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <span>🎙️ يستمع إليك... انطق الكلمة الآن بوضوح</span>
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

      {/* Manual Input Fallback */}
      <div className="mt-4 pt-4 border-t border-slate-100 text-center">
        {!manualInputMode ? (
          <button
            onClick={() => setManualInputMode(true)}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
          >
            لا يعمل الميكروفون لديك؟ جرّب التقييم اليدوي
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className="max-w-md mx-auto flex items-center gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="اكتب ما نطقته هنا للتقييم..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={isEvaluating || !manualText.trim()}
              className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>تقييم</span>
            </button>
            <button
              type="button"
              onClick={() => setManualInputMode(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
            >
              إلغاء
            </button>
          </form>
        )}
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
              جاري تحليل نطقك وتدقيق الحركات...
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              يقوم محرك الذكاء بفحص مخارج الحركات ومطابقة الكلمة، استعد لرؤية النتيجة!
            </p>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>لحظات قليلة وتظهر النتيجة...</span>
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
