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
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );

  // Active evaluation mode: Defaults to 'ai' (Fast 16kHz Audio-First Gemini) across all devices and browsers
  const [activeEvalMode, setActiveEvalMode] = useState<EvaluationMode>(
    settings.preferredEvaluationMode || 'ai'
  );
  const [studentName, setStudentName] = useState(settings.studentName || '');
  const [showMobileQuotaModal, setShowMobileQuotaModal] = useState(false);
  const [keyMissingError, setKeyMissingError] = useState(false);
  const [transientErrorNotice, setTransientErrorNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

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

  // Start Voice Recording
  const startRecording = async () => {
    if (cooldownSeconds > 0 || isEvaluating) {
      return;
    }

    setTransientErrorNotice(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setRecordDuration(0);
    audioChunksRef.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);

    // 1. Start SpeechRecognition on desktop (graceful non-looping)
    if (isSpeechRecognitionSupported()) {
      try {
        let recognitionFailed = false;
        const recognizer = createSpeechRecognizer(
          (transcript) => {
            liveTranscriptRef.current = transcript;
            setLiveTranscript(transcript);
          },
          (error) => {
            // Flag as failed so we don't infinitely retry on network / unsupported browser errors
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

    // 3. Audio stream handling for Audio-First evaluation:
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isRecordingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setRecordingStream(stream);

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

      mediaRecorder.start(250);
    } catch (err: any) {
      console.warn('MediaRecorder audio stream notice:', err);
    }
  };

  // Stop Recording and Evaluate
  const stopRecording = () => {
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
        const detectedMime =
          mediaRecorderRef.current?.mimeType || getSupportedAudioMimeType() || 'audio/mp4';
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
        await evaluateStudentAttempt(audioBlob, currentSpoken, recordedAudioUrl);
      };
    } else {
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
    const textToEvaluate = spokenText || liveTranscriptRef.current || liveTranscript || manualText || '';

    const isMobileDevice = typeof navigator !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
    );

    // 1. LOCAL EVALUATION (Only if user explicitly chose local mode AND browser captured text)
    if (activeEvalMode === 'local') {
      if (textToEvaluate.trim()) {
        const localEval = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1);
        const evalResult: PronunciationEvaluation = {
          ...localEval,
          recordedAudioUrl,
          engineUsed: 'local',
        };
        onEvaluationComplete(evalResult, recordedAudioUrl, studentName);
        setIsEvaluating(false);
        triggerCooldown(3);
        return;
      } else if (!audioBlob) {
        // No audio blob and no text: return clear prompt to speak
        const localEval = evaluateArabicLocal(wordItem.word, '', wordItem.repeatCount || 1);
        onEvaluationComplete({ ...localEval, recordedAudioUrl, engineUsed: 'local' }, recordedAudioUrl, studentName);
        setIsEvaluating(false);
        triggerCooldown(3);
        return;
      }
      // If user is in 'local' mode but browser didn't write text (e.g. Firefox/Safari),
      // we proceed below to evaluate the recorded audioBlob directly via AI/Acoustic rather than failing with 0%!
    }

    // 2. ACOUSTIC EVALUATION (Web Audio Physical Waveform - Free in-browser)
    if (activeEvalMode === 'acoustic') {
      try {
        if (audioBlob) {
          const acousticResult = await evaluateAcousticLocally(
            audioBlob,
            wordItem.word,
            textToEvaluate,
            recordedAudioUrl
          );
          onEvaluationComplete(acousticResult, recordedAudioUrl, studentName);
          setIsEvaluating(false);
          triggerCooldown(3);
          return;
        }
      } catch (err) {
        console.warn('Acoustic evaluation notice:', err);
      }

      // If no audio blob (e.g. manual text submit), fall back to local matcher
      const localFallback = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1);
      onEvaluationComplete(
        {
          ...localFallback,
          recordedAudioUrl,
          engineUsed: 'acoustic',
          engineNotice: 'تم التقييم النصي السريع لعدم توفر ملف صوتي مسجل.',
        },
        recordedAudioUrl,
        studentName
      );
      setIsEvaluating(false);
      triggerCooldown(3);
      return;
    }

    // 3. AI EVALUATION (Gemini AI - Direct Audio-First across all devices and browsers)
    const quota = getDailyQuotaStatus();

    // Check if daily quota is exceeded (for AI mode):
    if (quota.isExceeded) {
      if (audioBlob) {
        try {
          const acousticResult = await evaluateAcousticLocally(
            audioBlob,
            wordItem.word,
            textToEvaluate,
            recordedAudioUrl
          );
          onEvaluationComplete(
            {
              ...acousticResult,
              engineUsed: 'acoustic',
              engineNotice:
                'تم التحويل التلقائي لنظام الذبذبات الصوتي لاكتمال الحصة اليومية للذكاء الاصطناعي - واصل تدريبك دون توقف!',
            },
            recordedAudioUrl,
            studentName
          );
          setIsEvaluating(false);
          triggerCooldown(4);
          return;
        } catch (e) {}
      }

      const localEval = evaluateArabicLocal(wordItem.word, textToEvaluate, wordItem.repeatCount || 1);
      onEvaluationComplete(
        {
          ...localEval,
          recordedAudioUrl,
          engineUsed: 'local',
          engineNotice: 'تم التقييم بالمحرك المحلي لاكتمال الحصة اليومية المجانية للذكاء الاصطناعي.',
        },
        recordedAudioUrl,
        studentName
      );
      setIsEvaluating(false);
      triggerCooldown(3);
      return;
    }

    // Compress & Resample to lightweight 16kHz mono WAV (~25KB-55KB) before sending to Gemini API
    let audioBase64 = '';
    let mimeType = 'audio/wav';

    if (audioBlob) {
      try {
        const compressed = await compressAndResampleAudio(audioBlob);
        audioBase64 = compressed.base64;
        mimeType = compressed.mimeType;
      } catch (e) {
        console.warn('Fallback to standard blobToBase64:', e);
        audioBase64 = await blobToBase64(audioBlob);
        mimeType = audioBlob.type || 'audio/webm';
      }
    }

    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      abortController.abort();
    }, 10000); // 10-second hard ceiling to never leave student waiting

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.geminiApiKey) {
        headers['x-gemini-key'] = settings.geminiApiKey;
      }

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers,
        signal: abortController.signal,
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

      clearTimeout(timeoutTimer);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.evaluation) {
          incrementDailyQuota();
          setTransientErrorNotice(null);
          const evalResult: PronunciationEvaluation = {
            ...data.evaluation,
            timestamp: Date.now(),
            recordedAudioUrl,
            engineUsed: 'ai',
          };
          onEvaluationComplete(evalResult, recordedAudioUrl, studentName);
          setIsEvaluating(false);
          triggerCooldown(4);
          return;
        }
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn('Gemini server returned error status:', response.status, errJson);
        
        if (response.status === 400 && (errJson?.error?.includes('مفتاح') || errJson?.error?.includes('API key'))) {
          setKeyMissingError(true);
          setShowMobileQuotaModal(true);
          // Don't leave student stranded; evaluate acoustically
          if (audioBlob) {
            const acousticResult = await evaluateAcousticLocally(
              audioBlob,
              wordItem.word,
              textToEvaluate,
              recordedAudioUrl
            );
            onEvaluationComplete(
              {
                ...acousticResult,
                engineUsed: 'acoustic',
                engineNotice: 'تم التقييم الصوتي المباشر. يمكنك إضافة مفتاحك في الإعدادات لتفعيل الذكاء الاصطناعي.',
              },
              recordedAudioUrl,
              studentName
            );
          }
          setIsEvaluating(false);
          return;
        }

        if (response.status === 429 || errJson?.isRateLimited) {
          setTransientErrorNotice(
            errJson?.error || '⏳ يرجى الانتظار بضع ثوانٍ ثم النقر على الميكروفون مجدداً (تجاوز معدل السرعة).'
          );
        } else if (errJson?.error) {
          setTransientErrorNotice(errJson.error);
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (err.name === 'AbortError') {
        console.warn('AI evaluation timed out after 10s, seamlessly falling back to acoustic.');
      } else {
        console.warn('Gemini server evaluation error:', err);
      }
    }

    // If AI evaluation hit any transient error or rate limit: fall back to acoustic analysis on ANY device!
    if (audioBlob) {
      try {
        const acousticResult = await evaluateAcousticLocally(
          audioBlob,
          wordItem.word,
          textToEvaluate,
          recordedAudioUrl
        );
        onEvaluationComplete(
          {
            ...acousticResult,
            engineUsed: 'acoustic',
            engineNotice:
              'تعذر الاتصال بالذكاء الاصطناعي مؤقتاً، تم التقييم عبر نظام الذبذبات الصوتي المباشر لمواصلة التدريب.',
          },
          recordedAudioUrl,
          studentName
        );
        setIsEvaluating(false);
        triggerCooldown(4);
        return;
      } catch (e) {}
    }

    // Fallback if no audio blob at all
    const fallbackLocal = evaluateArabicLocal(wordItem.word, textToEvaluate);
    onEvaluationComplete(
      {
        ...fallbackLocal,
        recordedAudioUrl,
        engineUsed: 'local',
        engineNotice: 'تنبيه: تعذر الاتصال بالذكاء الاصطناعي، تم التقييم بالمحرك المحلي.',
      },
      recordedAudioUrl,
      studentName
    );
    setIsEvaluating(false);
    triggerCooldown(3);
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

      {/* Multi Evaluation Engine Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-6">
        <span className="text-xs font-bold text-slate-700 pr-1">
          نظام التقييم:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveEvalMode('ai')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeEvalMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>الذكاء الاصطناعي (استماع صوتي مباشر ⚡)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEvalMode('acoustic')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeEvalMode === 'acoustic'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>التحليل الصوتي الفيزيائي (مجاني)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEvalMode('local')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeEvalMode === 'local'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>التعرف النصي للمتصفح</span>
          </button>
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

        {/* شارة التكرار المطلوبة - واضحة ومستقلة تماماً فوق نص الدرس */}
        {wordItem.repeatCount && wordItem.repeatCount > 1 && (
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl text-xs sm:text-sm font-bold shadow-xs">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>🔁 المطلوب: كرر نطق هذا النص ({wordItem.repeatCount}) مرات متتالية بوضوح</span>
            </div>
          </div>
        )}

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
            ) : (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isEvaluating}
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
                    <span className="text-[10px] font-bold mt-0.5">
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
            ) : isRecording ? (
              'تحدّث الآن بوضوح... اضغط على الزر مرة أخرى للتقييم'
            ) : (
              'اضغط على الميكروفون ثم انطق الكلمة بوضوح'
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



          {isEvaluating && (
            <div className="mt-5 flex items-center gap-2.5 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>
                {activeEvalMode === 'acoustic'
                  ? 'جاري التحليل الصوتي الفيزيائي المباشر...'
                  : activeEvalMode === 'ai'
                  ? 'جاري تقييم النطق عبر الذكاء الاصطناعي...'
                  : 'جاري تقييم النطق عبر النظام الداخلي...'}
              </span>
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
                  startRecording();
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
    </div>
  );
};
