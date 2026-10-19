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
} from 'lucide-react';
import {
  speakArabicBrowser,
  speakArabicGemini,
  playCustomAudio,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  blobToBase64,
  stopAllAudio,
} from '../utils/arabicAudio';
import { normalizeMediaUrl } from '../utils/mediaUrl';
import { evaluateArabicLocal } from '../utils/arabicMatcher';
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

  // Active evaluation mode for this attempt (local or ai)
  const [activeEvalMode, setActiveEvalMode] = useState<EvaluationMode>(
    settings.preferredEvaluationMode || 'local'
  );
  const [studentName, setStudentName] = useState(settings.studentName || '');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognizerRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Auto-play audio when wordItem changes if autoPlayTarget is enabled
  useEffect(() => {
    setIsRecording(false);
    setLiveTranscript('');
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

  // Handle Listen Audio: plays custom audio if provided, otherwise browser TTS
  const handlePlayAudio = (slow = false) => {
    if (isPlayingAudio) {
      stopAllAudio();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);

    if (wordItem.audioUrl) {
      // Play custom audio file
      playCustomAudio(
        wordItem.audioUrl,
        wordItem.word,
        slow ? 0.7 : settings.speed,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    } else if (settings.engine === 'gemini') {
      speakArabicGemini(
        wordItem.word,
        slow,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false)
      );
    } else {
      speakArabicBrowser(
        wordItem.word,
        slow ? 0.7 : settings.speed,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        (err) => {
          console.warn('SpeechSynthesis error:', err);
          setIsPlayingAudio(false);
        }
      );
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    setLiveTranscript('');
    setRecordDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 12) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Web Speech Recognition
      if (isSpeechRecognitionSupported()) {
        try {
          const recognizer = createSpeechRecognizer(
            (transcript) => {
              setLiveTranscript(transcript);
            },
            (error) => {
              console.warn('Recognition error:', error);
            },
            () => {}
          );
          if (recognizer) {
            speechRecognizerRef.current = recognizer;
            recognizer.start();
          }
        } catch (e) {
          console.warn('SpeechRecognizer start failed:', e);
        }
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل ونطق الكلمة.');
    }
  };

  // Stop Recording and Evaluate
  const stopRecording = () => {
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
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm',
        });
        const recordedAudioUrl = URL.createObjectURL(audioBlob);

        if (recordingStream) {
          recordingStream.getTracks().forEach((track) => track.stop());
          setRecordingStream(null);
        }

        setIsRecording(false);
        await evaluateStudentAttempt(audioBlob, liveTranscript, recordedAudioUrl);
      };
    } else {
      setIsRecording(false);
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        setRecordingStream(null);
      }
    }
  };

  // Evaluate student's pronunciation
  const evaluateStudentAttempt = async (
    audioBlob?: Blob,
    spokenText?: string,
    recordedAudioUrl?: string
  ) => {
    setIsEvaluating(true);
    const textToEvaluate = spokenText || liveTranscript || manualText || '';

    // If Mode is LOCAL (Primary / Default)
    if (activeEvalMode === 'local') {
      const localEval = evaluateArabicLocal(wordItem.word, textToEvaluate);
      const evalResult: PronunciationEvaluation = {
        ...localEval,
        recordedAudioUrl,
        engineUsed: 'local',
      };
      onEvaluationComplete(evalResult, recordedAudioUrl, studentName);
      setIsEvaluating(false);
      return;
    }

    // If Mode is AI (Gemini)
    let audioBase64 = '';
    let mimeType = 'audio/webm';

    if (audioBlob) {
      try {
        audioBase64 = await blobToBase64(audioBlob);
        mimeType = audioBlob.type || 'audio/webm';
      } catch (e) {}
    }

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWord: wordItem.word,
          spokenText: textToEvaluate,
          audioBase64: audioBase64 || undefined,
          audioMimeType: mimeType,
          notes: `الدرس: ${wordItem.lessonSubject} - الفئة: ${wordItem.category}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.evaluation) {
          const evalResult: PronunciationEvaluation = {
            ...data.evaluation,
            timestamp: Date.now(),
            recordedAudioUrl,
            engineUsed: 'ai',
          };
          onEvaluationComplete(evalResult, recordedAudioUrl, studentName);
          setIsEvaluating(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Gemini server evaluation error, falling back to local matcher:', err);
    }

    // Fallback if AI was unavailable
    const fallbackLocal = evaluateArabicLocal(wordItem.word, textToEvaluate);
    onEvaluationComplete(
      {
        ...fallbackLocal,
        recordedAudioUrl,
        engineUsed: 'local',
      },
      recordedAudioUrl,
      studentName
    );
    setIsEvaluating(false);
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

      {/* Dual Evaluation Engine Selector */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-6">
        <span className="text-xs font-bold text-slate-700 pr-2">
          نظام التقييم:
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveEvalMode('local')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeEvalMode === 'local'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>التقييم الداخلي (الأساسي)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEvalMode('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeEvalMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>الذكاء الاصطناعي</span>
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
            <Volume2 className="w-5 h-5 text-emerald-600" />
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
          </div>

          <p className="text-xs font-medium text-slate-500 mt-3 text-center">
            {isRecording
              ? 'تحدّث الآن بوضوح... اضغط على الزر مرة أخرى للتقييم'
              : 'اضغط على الميكروفون ثم انطق الكلمة بوضوح'}
          </p>

          {(liveTranscript || isRecording) && (
            <div className="mt-4 w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center animate-in fade-in duration-200">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                ما يُسمع الآن:
              </span>
              <div className="text-base font-bold font-amiri text-emerald-800">
                {liveTranscript || 'في انتظار نطقك...'}
              </div>
            </div>
          )}

          {isEvaluating && (
            <div className="mt-5 flex items-center gap-2.5 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>
                {activeEvalMode === 'ai'
                  ? 'جاري تقييم النطق عبر الذكاء الاصطناعي...'
                  : 'جاري تقييم النطق عبر النظام الداخلي...'}
              </span>
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
    </div>
  );
};
